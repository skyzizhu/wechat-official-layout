/**
 * 智能文本/Markdown 识别与排版格式化工具 (Omni Plain-Text Semantic Parser)
 * 能够自动区分用户输入是 Markdown 源码还是普通自然文本，
 * 并对普通自然纯文本进行全能智能语义层级解析：
 * 涵盖标题（H1~H5）、多形态数据表格（Excel/TSV/多空格/半全角管道符/CSV）、
 * 任务复选清单（[ ] / [x] / □ / ✓）、有序/无序项目列表、
 * 提示警告与导读卡片（Callout）、名人金句（Pull-Quote）、问答访谈（Q&A）、
 * 代码块与命令行（Mac 窗口风格与多语言推断）、
 * 注释与旁白（※注）、条目标题自动高亮强调、纯文本配图与题注、
 * 参考文献与外链脚注、段落呼吸感重构与盘古之白。
 */

export interface FormatDetectionResult {
  isMarkdown: boolean;
  confidence: number; // 0 到 100
  features: string[];
  suggestedMode: 'markdown' | 'plain-text';
  // 丰富统计特征，用于界面实时展示给用户
  stats?: {
    headingCount: number;
    tableCount: number;
    listCount: number;
    taskCount: number;
    calloutCount: number;
    imageCount: number;
    codeCount: number;
    summaryText: string;
  };
}

/**
 * 章节/序号通用分隔符集合正则字符集：
 * 支持顿号(、)、半角逗号(,)、全角逗号(，)、半角句点(.)、全角句点(．)、
 * 半角冒号(:)、全角冒号(：)、空格(\s)、制表符(\t)、短横线(-)、中文破折号(——)、波浪号(~)
 */
export const NUM_SEPARATORS_CLASS = '[、,，.．:：\\s\\-—–_~]';
export const CHINESE_NUMERALS_CLASS = '[一二三四五六七八九十百千万壹贰叁肆伍陆柒捌玖拾]';

export interface HeadingMatchResult {
  isHeading: boolean;
  level: 2 | 3 | 4 | 5;
  num: string;
  title: string;
  raw: string;
}

/**
 * 匹配中文序号章节标题（如 "一、"、"一，"、"一,"、"一."、"一 "、"第一章"、"首先，"、"（一）" 等）
 */
export function matchChineseHeading(trimmed: string): HeadingMatchResult | null {
  if (!trimmed || trimmed.length > 55 || /[。！？…!?;；]$/.test(trimmed)) {
    return null;
  }

  // 1. 完整括号中文/阿拉伯数字：（一）标题、(一) 标题、【一】标题
  const bracketNumMatch = trimmed.match(
    new RegExp(`^[（(【［\\[](${CHINESE_NUMERALS_CLASS}+)[）)】］\\]]\\s*(.+)$`)
  );
  if (bracketNumMatch) {
    return {
      isHeading: true,
      level: 3,
      num: bracketNumMatch[1],
      title: bracketNumMatch[2].trim(),
      raw: trimmed,
    };
  }

  // 2. 中文数字开头 + 分隔符/单右括号 + 标题内容（一、 一， 一, 一. 一． 一  一： 一: 一 - 一—— 一） ）
  const chineseNumMatch = trimmed.match(
    new RegExp(`^(${CHINESE_NUMERALS_CLASS}+)(?:${NUM_SEPARATORS_CLASS}+|[)）]\\s*)(.+)$`)
  );
  if (chineseNumMatch) {
    return {
      isHeading: true,
      level: 2,
      num: chineseNumMatch[1],
      title: chineseNumMatch[2].trim(),
      raw: trimmed,
    };
  }

  // 3. "第" + 中文/阿拉伯数字 + 章节部篇 / 分隔符（第一章、第1节、第一部分、第一、第一，第一. 第一 ）
  const diMatch =
    trimmed.match(
      new RegExp(`^第([一二三四五六七八九十0-9]+)(?:[章节篇部卷集讲堂课回期分步]|阶段)?(?:${NUM_SEPARATORS_CLASS}+|[)）]\\s*)(.+)$`)
    ) ||
    trimmed.match(/^第([一二三四五六七八九十0-9]+)[章节篇部卷集讲堂课回期分]+(?:\s*[:：、,，.．\-—–_~]\s*|\s+)(.+)$/);
  if (diMatch) {
    return {
      isHeading: true,
      level: 2,
      num: diMatch[1],
      title: (diMatch[2] || '').trim(),
      raw: trimmed,
    };
  }

  // 4. "其" + 中文/阿拉伯数字（其一、其二，其三.）
  const qiMatch = trimmed.match(
    new RegExp(`^其([一二三四五六七八九十0-9]+)(?:${NUM_SEPARATORS_CLASS}+|[)）]\\s*)(.+)$`)
  );
  if (qiMatch) {
    return {
      isHeading: true,
      level: 2,
      num: qiMatch[1],
      title: qiMatch[2].trim(),
      raw: trimmed,
    };
  }

  // 5. 序数过渡词（首先、其次、再次、最后、起初、接着、最终）
  const seqMatch = trimmed.match(
    new RegExp(`^(首先|其次|再次|最后|起初|接着|最终)(?:${NUM_SEPARATORS_CLASS}+)(.+)$`)
  );
  if (seqMatch) {
    return {
      isHeading: true,
      level: 2,
      num: seqMatch[1],
      title: seqMatch[2].trim(),
      raw: trimmed,
    };
  }

  // 6. 英文 Chapter / Part / Section / Step / Phase
  const engMatch = trimmed.match(
    new RegExp(`^(?:Chapter|Section|Part|Step|Phase)\\s+([0-9IVXLCDM]+)(?:${NUM_SEPARATORS_CLASS}+)(.+)$`, 'i')
  );
  if (engMatch) {
    return {
      isHeading: true,
      level: 2,
      num: engMatch[1],
      title: engMatch[2].trim(),
      raw: trimmed,
    };
  }

  // 7. 独立无序号常规核心大纲词（前言、概述、总结等）
  if (/^(?:前言|引言|背景|背景介绍|概述|核心观点|业务架构|技术实现|结语|总结|写在最后|写在前面|结语与展望)$/.test(trimmed)) {
    return {
      isHeading: true,
      level: 2,
      num: '',
      title: trimmed,
      raw: trimmed,
    };
  }

  // 8. 独立方括号/书名号标题：【核心选型】、「技术架构」
  if (/^[【\[「『［][^】\]」』］]{2,25}[】\]」』］]$/.test(trimmed)) {
    return {
      isHeading: true,
      level: 2,
      num: '',
      title: trimmed.slice(1, -1).trim(),
      raw: trimmed,
    };
  }

  return null;
}

/**
 * 匹配阿拉伯数字章节标题（1、, 1，, 1, , 1. , 1 , 01 , 01、, 第1、, 1.1, 1.1.1 等）
 * @param hasChineseHeadings 全文是否已存在大写中文数字章节（若有，阿拉伯数字降级为二级 H3，否则升级为主章节 H2）
 */
export function matchArabicHeading(
  trimmed: string,
  prevLine: string = '',
  hasChineseHeadings: boolean = false
): HeadingMatchResult | null {
  if (!trimmed || trimmed.length > 50 || /[。！？…!?;；]$/.test(trimmed)) {
    return null;
  }

  // 1. 多级数字：1.1, 1.1.1, 1.1.1.1
  const multiDecimal = trimmed.match(/^(\d+\.\d+(?:\.\d+)?(?:\.\d+)?)(?:[、,，.．:：\s\-—–_~]+|[)）]\s*)(.+)$/);
  if (multiDecimal) {
    const dots = (multiDecimal[1].match(/\./g) || []).length;
    let level: 2 | 3 | 4 | 5 = 3;
    if (dots === 1) level = hasChineseHeadings ? 4 : 3;
    else if (dots === 2) level = hasChineseHeadings ? 5 : 4;
    else level = 5;

    return {
      isHeading: true,
      level,
      num: multiDecimal[1],
      title: multiDecimal[2].trim(),
      raw: trimmed,
    };
  }

  // 2. 完整括号阿拉伯数字：（1）标题、(1) 标题、【1】标题、1) 标题、1）标题
  const bracketNumMatch =
    trimmed.match(/^[（(【［\[](\d{1,2})[）)】］\]]\s*(.+)$/) ||
    trimmed.match(/^(\d{1,2})[)）]\s*(.+)$/);
  if (bracketNumMatch) {
    return {
      isHeading: true,
      level: hasChineseHeadings ? 4 : 3,
      num: bracketNumMatch[1],
      title: bracketNumMatch[2].trim(),
      raw: trimmed,
    };
  }

  // 3. 英文字母序号：A. 数据清洗、B、特征工程
  const letterMatch = trimmed.match(/^[A-Z][.、．,，:：\s]+\s*(.+)$/);
  if (letterMatch) {
    return {
      isHeading: true,
      level: hasChineseHeadings ? 4 : 3,
      num: trimmed[0],
      title: letterMatch[1].trim(),
      raw: trimmed,
    };
  }

  // 4. 单级阿拉伯数字：1、, 1，, 1, , 1. , 1 , 01 , 01、, 第1、, 1:
  const arabicMatch = trimmed.match(
    new RegExp(`^(?:第)?(0\\d|\\d{1,2})(?:(${NUM_SEPARATORS_CLASS}+)|([)）])\\s*)(.+)$`)
  );
  if (!arabicMatch) return null;

  const num = arabicMatch[1];
  const sep = arabicMatch[2] || arabicMatch[3];
  const title = arabicMatch[4].trim();

  // 若标题为空或超过 45 字符
  if (!title || title.length > 45) return null;

  // 排除浮点数/版本号：如 "1.234" 后面是纯数字
  if (sep.includes('.') && /^\d+$/.test(title)) return null;

  // 判定是否是显式标题强特征：
  // - 逗号/冒号/破折号分隔符（1， 1, 1： 1: 1 - 1——）
  // - 零补齐数字（01 02 03）
  // - "第" 前缀（第1、 第1，）
  // - 纯空格分隔符（1 架构思考）
  const isDefiniteHeading =
    /[，,:：\-—–_~]/.test(sep) ||
    num.startsWith('0') ||
    trimmed.startsWith('第') ||
    /^\s+$/.test(sep);

  if (isDefiniteHeading) {
    return {
      isHeading: true,
      level: hasChineseHeadings ? 3 : 2,
      num,
      title,
      raw: trimmed,
    };
  }

  // 对于 1、 或 1. 分隔符：
  // 检查前置行是否为列表引导行（如以冒号结尾，或包含 "如下" / "清单"）
  const prevTrimmed = prevLine.trim();
  const isPrecededByListLeadIn =
    /[：:]$/.test(prevTrimmed) ||
    /(?:如下|以下|清单|包括|维度|建议|原则|步骤)[：:]?$/.test(prevTrimmed);

  if (isPrecededByListLeadIn) {
    // 属于前置说明引导的列表项，不作为标题
    return null;
  }

  return {
    isHeading: true,
    level: hasChineseHeadings ? 3 : 2,
    num,
    title,
    raw: trimmed,
  };
}

/**
 * 智能检测输入文本的格式与语义特征
 */
export function detectContentFormat(text: string): FormatDetectionResult {
  if (!text || text.trim().length === 0) {
    return {
      isMarkdown: false,
      confidence: 0,
      features: [],
      suggestedMode: 'plain-text',
      stats: {
        headingCount: 0,
        tableCount: 0,
        listCount: 0,
        taskCount: 0,
        calloutCount: 0,
        imageCount: 0,
        codeCount: 0,
        summaryText: '空白内容',
      },
    };
  }

  const features: string[] = [];
  let score = 0;

  // 1. 检测标准的 Markdown 标题 (# )
  const mdHeadings = text.match(/^#{1,6}\s+\S+/gm);
  if (mdHeadings && mdHeadings.length > 0) {
    score += 45;
    features.push(`Markdown 标题 (${mdHeadings.length}处)`);
  }

  // 2. 检测代码块 (```)
  const codeBlocks = text.match(/```[\s\S]*?```/g);
  if (codeBlocks && codeBlocks.length > 0) {
    score += 35;
    features.push(`代码块 (${codeBlocks.length}处)`);
  }

  // 3. 检测行内代码 (`code`)
  if (/`[^`\n]+`/.test(text)) {
    score += 15;
    features.push('行内代码 (` `)');
  }

  // 4. 检测引用语法 (> )
  const blockquotes = text.match(/^>\s+\S+/gm);
  if (blockquotes && blockquotes.length > 0) {
    score += 25;
    features.push(`引用语法 (${blockquotes.length}处)`);
  }

  // 5. 检测标准 Markdown 链接 [text](url) 或图片 ![alt](url)
  const linksAndImgs = text.match(/!?\[[^\]]+\]\([^)]+\)/g);
  if (linksAndImgs && linksAndImgs.length > 0) {
    // 仅当包含普通超链接时计入 Markdown 特征分，单张插入的图片不应压倒性判定为 Markdown 源码
    const hasNormalLinks = linksAndImgs.some((m) => !m.startsWith('!'));
    if (hasNormalLinks) {
      score += 25;
      features.push('Markdown 链接');
    }
  }

  // 6. 检测 Markdown 表格 (| --- |)
  const mdTables = text.match(/\|[ \t]*[-:]+[-| :]*\|/g);
  if (mdTables && mdTables.length > 0) {
    score += 35;
    features.push('Markdown 标头表格');
  }

  // 7. 检测加粗或斜体 (**text** or *text*)
  if (/\*\*[^*\n]+\*\*/.test(text) || /__[^_\n]+__/.test(text)) {
    score += 15;
    features.push('加粗强调 (**text**)');
  }

  // 8. 检测标准 Markdown 任务列表 (- [ ] / - [x])
  const taskLists = text.match(/^[\t ]*[-*]\s+\[[ xX]\]\s+\S+/gm);
  if (taskLists && taskLists.length > 0) {
    score += 30;
    features.push(`任务复选清单 (${taskLists.length}项)`);
  }

  // 9. 统计纯文本语义特征
  let headingCount = mdHeadings ? mdHeadings.length : 0;
  let tableCount = mdTables ? mdTables.length : 0;
  let listCount = 0;
  let taskCount = taskLists ? taskLists.length : 0;
  let calloutCount = blockquotes ? blockquotes.length : 0;
  let imageCount = (text.match(/!\[[^\]]*\]\([^)]+\)/g) || []).length;
  let codeCount = codeBlocks ? codeBlocks.length : 0;

  // 纯文本章节与列表智能匹配（覆盖中文序号 一、 一， 一, 一. 一  以及阿拉伯数字 1、 1， 1. 1  01  第1 等全部变体）
  const textLines = text.split('\n');
  const hasChineseHeadingsInDoc = textLines.some((l) => Boolean(matchChineseHeading(l.trim())));

  for (let idx = 0; idx < textLines.length; idx++) {
    const trimmedLine = textLines[idx].trim();
    if (!trimmedLine || trimmedLine.startsWith('```') || trimmedLine.startsWith('|') || trimmedLine.startsWith('#')) {
      continue;
    }
    const prevLine = idx > 0 ? textLines[idx - 1] : '';
    const isHeading = Boolean(matchChineseHeading(trimmedLine) || matchArabicHeading(trimmedLine, prevLine, hasChineseHeadingsInDoc));
    if (isHeading) {
      headingCount++;
    } else {
      if (/^[\t ]*(?:[•·●◆◇■▶►👉🔹🔸📌✅⭐]|\d+[、.．,，)）]|[①②③④⑤⑥⑦⑧⑨⑩⑴⑵⑶⑷⑸⑹⑺⑻⑼⑽])\s+\S+/.test(trimmedLine)) {
        listCount++;
      }
    }
  }

  // 纯文本表格匹配 (TSV / 管道符)
  const tsvLines = text.match(/^[^\n\t]+\t[^\n\t]+/gm);
  if (tsvLines && tsvLines.length >= 2) tableCount += 1;
  const pipeLines = text.match(/^[^\n|｜]+[|｜][^\n|｜]+/gm);
  if (pipeLines && pipeLines.length >= 2 && !mdTables) tableCount += 1;

  // 纯文本任务列表 (□ / ✓ / [ ])
  const rawTasks = text.match(/^[\t ]*(?:\[\s*\]|\[[xX]\]|□|✓|☑|✔)\s+\S+/gm);
  if (rawTasks) taskCount += rawTasks.length;

  // 纯文本提示与导读 (导读：/ 提示：/ 💡 提示：)
  const rawCallouts = text.match(/^(?:(?:💡|⚠️|❗|📌|🎯|📝|⚡|🔥|💬|🔔)\s*)?(?:导读|导言|编者按|摘要|前言|引言|核心看点|核心观点|总结|思考|提示|警告|注意|重要|小贴士|Tips?|Warning|Note|Notice|Caution)[：:]\s*\S+/gim);
  if (rawCallouts) calloutCount += rawCallouts.length;

  // 纯文本配图 (配图：/ 图片：)
  const rawImages = text.match(/^(?:配图|图片|插图)[：:]\s*\S+/gm);
  if (rawImages) imageCount += rawImages.length;

  // 构造用户友好的格式汇总提示文案
  const summaryParts: string[] = [];
  if (headingCount > 0) summaryParts.push(`${headingCount}个章节标题`);
  if (tableCount > 0) summaryParts.push(`${tableCount}个数据表格`);
  if (calloutCount > 0) summaryParts.push(`${calloutCount}条提示导读`);
  if (taskCount > 0) summaryParts.push(`${taskCount}项任务清单`);
  if (listCount > 0) summaryParts.push(`${listCount}条项目列表`);
  if (imageCount > 0) summaryParts.push(`${imageCount}张配图`);
  if (codeCount > 0) summaryParts.push(`${codeCount}处代码`);

  const summaryText =
    summaryParts.length > 0 ? `✨ 已智能识别：${summaryParts.join('、')}` : '已识别：自然普通文本';

  // 仅当用户成体系书写了标准 Markdown 标题、代码块、引用块，且没有大量纯文本序号章节时，才视作纯粹的 Markdown 源码
  const hasSubstantialMarkdown = score >= 50 && Boolean(mdHeadings && mdHeadings.length >= 2);
  const isMarkdown = hasSubstantialMarkdown;

  return {
    isMarkdown,
    confidence: Math.min(100, Math.max(0, score)),
    features,
    suggestedMode: isMarkdown ? 'markdown' : 'plain-text',
    stats: {
      headingCount,
      tableCount,
      listCount,
      taskCount,
      calloutCount,
      imageCount,
      codeCount,
      summaryText,
    },
  };
}

/**
 * 中英文排版规范化：在中英文字符、数字之间添加适当间隙（盘古之白）
 * 保护已有 URL、Markdown 标记及特殊符号
 */
export function addPanguSpacing(text: string): string {
  if (!text) return '';
  return text
    // 中文与英文/数字之间插入空格
    .replace(/([\u4e00-\u9fa5])([a-zA-Z0-9$#@`])/g, '$1 $2')
    // 英文/数字与中文之间插入空格
    .replace(/([a-zA-Z0-9$#%`])([\u4e00-\u9fa5])/g, '$1 $2');
}

/**
 * 判断是否为图片类型的 URL。
 * 支持 http/https 外链、本地静态路径 (/images/...) 及 base64 图像
 */
export function isImageUrl(url: string): boolean {
  if (!url) return false;
  return (
    /^(?:https?:\/\/|\/|\.\/)\S+\.(?:jpg|jpeg|png|webp|gif|svg|avif)(?:\?.*)?$/i.test(url) ||
    /^data:image\/(?:png|jpeg|jpg|webp|gif|svg\+xml);base64,/i.test(url) ||
    /^https?:\/\/images\.unsplash\.com\/\S+/i.test(url) ||
    /^https?:\/\/mmbiz\.qpic\.cn\/\S+/i.test(url)
  );
}

/**
 * 智能转换正文中的裸 URL 为 Markdown 链接，以便文末脚注引擎识别
 */
export function formatBareUrls(text: string): string {
  const bareUrlRegex = /(?<![(\[="'])(https?:\/\/[a-zA-Z0-9\-._~:/?#[\]@!$&'()*+,;=%]+)(?![)\]"'])/g;

  return text.replace(bareUrlRegex, (url) => {
    // 图片类型 URL：保持原样显示
    if (isImageUrl(url)) {
      return url;
    }
    try {
      const parsed = new URL(url);
      const host = parsed.hostname.toLowerCase();
      let label = host;

      if (host.includes('weixin.qq.com')) {
        label = '微信公众平台';
      } else if (host.includes('github.com')) {
        const parts = parsed.pathname.split('/').filter(Boolean);
        label = parts.length >= 2 ? `GitHub - ${parts[0]}/${parts[1]}` : 'GitHub';
      } else if (host.includes('zhihu.com')) {
        label = '知乎专栏';
      } else if (host.includes('juejin.cn')) {
        label = '稀土掘金';
      } else if (host.includes('developer.mozilla.org')) {
        label = 'MDN Web Docs';
      } else {
        label = host.replace(/^www\./, '');
      }

      return `[${label}](${url})`;
    } catch {
      return `[链接](${url})`;
    }
  });
}

/**
 * 检测代码块语言类型
 */
function inferCodeLanguage(code: string): string {
  if (/^\s*[\{\[][\s\S]*[\}\]]\s*$/.test(code.trim()) && /"[\w\-]+":\s*/.test(code)) {
    return 'json';
  }
  if (/(?:import\s+.+from|export\s+(?:default|const|function)|const\s+\w+\s*=|function\s+\w+\s*\(|<[A-Z]\w+.*>)/.test(code)) {
    return 'typescript';
  }
  if (/(?:def\s+\w+\s*\(|class\s+\w+[\(:]|if\s+__name__\s*==\s*['"]__main__['"]|print\s*\()/.test(code)) {
    return 'python';
  }
  if (/(?:SELECT\s+.+\s+FROM|INSERT\s+INTO|CREATE\s+TABLE|UPDATE\s+\w+\s+SET)/i.test(code)) {
    return 'sql';
  }
  if (/(?:^\s*\$\s+|^\s*(?:npm|pnpm|yarn|git|docker|curl|chmod|brew|npx|pip)\s+)/m.test(code)) {
    return 'bash';
  }
  if (/(?:<\/?[a-z][\s\S]*>)/i.test(code) && /<\/(?:div|p|span|section|h[1-6])>/i.test(code)) {
    return 'html';
  }
  return '';
}

/**
 * 智能条目标题自动强调提取：
 * 将形如 "字体的呼吸感：不同字体拥有..." 或 "【核心特性】全面支持..."
 * 自动提取加粗为 "**字体的呼吸感**：不同字体拥有..."，以无缝激活模板的荧光笔加粗高亮样式
 */
function emphasizeItemHeader(text: string): string {
  // 0. 如果是以 http:// 或 https:// 开头，或者包含完整 URL，或者本身是 Markdown 标题/引用/斜体/粗体/图片/链接，不当作条目标题
  if (/^\s*https?:\/\//i.test(text) || /^\s*[#>*!_\[]/.test(text)) {
    return text;
  }

  // 1. 匹配已经包含 Markdown 加粗的，直接返回
  if (/^\*\*[^*\n]+\*\*/.test(text)) {
    return text;
  }

  // 2. 匹配方括号/书名号标题开头的模式：【核心要素】具体描述...
  const bracketMatch = text.match(/^([【\[「『][^】\]」』]{2,20}[】\]」』])\s*(.*)$/);
  if (bracketMatch) {
    const header = bracketMatch[1];
    const rest = bracketMatch[2];
    return `**${header}** ${rest}`.trim();
  }

  // 3. 匹配冒号前面的条目标题：条目标题：具体说明...
  const colonMatch = text.match(/^([^：:——\-，。！？\n]{2,18})([：:])\s*(.+)$/);
  if (colonMatch) {
    const title = colonMatch[1].trim();
    const punct = '：';
    const rest = colonMatch[3].trim();
    // 防止把 URL 协议的冒号误判为条目标题分隔符
    if (/(?:https?|ftp|file|ws|wss)$/i.test(title) || /^\/\//.test(rest)) {
      return text;
    }
    return `**${title}**${punct}${rest}`;
  }

  // 4. 匹配破折号前面的条目标题：条目标题 —— 具体说明...
  // 单个连字符/破折号必须两侧都有空格才视为分隔符（避免 "font-size"、"co-work" 等词内连字符被误判炸出 **）
  const dashMatch = text.match(/^([^：:——\-，。！？\n]{2,18})(\s*——\s*|\s-\s|\s—\s)(.+)$/);
  if (dashMatch) {
    const title = dashMatch[1].trim();
    const rest = dashMatch[3].trim();
    if (/(?:https?|ftp|file|ws|wss)$/i.test(title)) {
      return text;
    }
    return `**${title}** — ${rest}`;
  }

  return text;
}

export interface ParserOptions {
  /**
   * 是否将文本的首个非空行识别为文章大标题（# H1）
   * 默认：false（首句默认作为详情内容中的首个正文段落）
   */
  treatFirstLineAsTitle?: boolean;
  /**
   * 用户纠偏后抑制的识别决策键（${type}:${snippet}）：
   * 命中的内容块将不再被转换为对应格式，保持普通正文
   */
  suppressedDecisions?: string[];
}

/**
 * 单条识别决策：引擎对某个内容块做出的格式判定
 */
export interface ConversionDecision {
  /** 决策类型（表格/题注/小节标题等） */
  type: string;
  /** 置信度 0~1，低于 0.75 的决策会在界面提示用户确认 */
  confidence: number;
  /** 识别块首行内容片段（用于定位与纠偏） */
  snippet: string;
}

/**
 * 将普通中文/英文长文本智能转换为结构化优雅的 Markdown
 */
export function convertPlainTextToMarkdown(
  text: string,
  options?: ParserOptions,
  decisions?: ConversionDecision[]
): string {
  if (!text || text.trim().length === 0) return '';

  const treatFirstLineAsTitle = options?.treatFirstLineAsTitle ?? false;
  // 用户纠偏抑制清单：命中键的识别决策不再应用（转为普通正文）
  const suppressed = new Set(options?.suppressedDecisions ?? []);
  const isSuppressed = (type: string, snippet: string) => suppressed.has(`${type}:${snippet}`);

  // 记录低置信度识别决策的辅助函数
  const noteDecision = (type: string, confidence: number, snippet: string) => {
    decisions?.push({ type, confidence, snippet: snippet.slice(0, 24) });
  };

  // 1. 统一换行符，并拆分为原始行
  const rawLines = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    // 去除段首无意义的中文全角空格 "　　"
    .replace(/^[　 \t]+/gm, (match) => {
      // 保留可能的代码缩进（4个半角空格以上），清除全角缩进
      return match.includes('　') ? '' : match;
    })
    .split('\n');

  // 2. 第一阶段：多行块探测与规整（代码块、全形态表格块）
  const blockProcessedLines: string[] = [];
  let i = 0;

  while (i < rawLines.length) {
    const line = rawLines[i];
    const trimmed = line.trim();

    // 2.0a 整篇代码检测：用户直接粘贴纯代码（无任何说明文字）时，
    // 首行即强代码特征且大部分行为代码形态 → 整篇包装为单个代码块，
    // 跳过一切文本排版规则（章节/列表/强调规则对纯代码毫无意义且会产生误判）
    if (i === 0) {
      const nonEmpty = rawLines.map((l) => l.trim()).filter(Boolean);
      const strongCodeStart =
        /^(?:interface\s|type\s+[A-Za-z_$<{]|class\s|function\s|def\s|export\s|import\s|const\s|let\s|var\s|public\s|private\s|package\s|#include|using\s|SELECT\s|INSERT\s|CREATE\s+TABLE|<!DOCTYPE|<html|#!)/i;
      const codeLikeRe =
        /(?:[;{}]\s*$|^\s*[{}\[\]]\s*$|^\s*(?:readonly|const|let|var|function|return|export|import|interface|type|enum|if|for|while|switch|case|try|catch|def|print|console)\b|^\s*(?:\/\*\*?|\*(?:\s|$)|\*\/|\/\/)|^\s{2,}\S|=>|^[a-zA-Z_$][\w$]*\s*:\s*|^[a-zA-Z_$][\w$]*,\s*$|\b(?:SELECT|FROM|WHERE|GROUP\s+BY|ORDER\s+BY|INSERT\s+INTO|UPDATE|DELETE\s+FROM)\b)/;
      if (nonEmpty.length >= 3 && strongCodeStart.test(nonEmpty[0])) {
        const sample = nonEmpty.slice(0, 30);
        const codeLike = sample.filter((l) => codeLikeRe.test(l)).length;
        if (codeLike / sample.length >= 0.5) {
          const lang = inferCodeLanguage(nonEmpty.join('\n')) || 'typescript';
          blockProcessedLines.push('```' + lang);
          blockProcessedLines.push(...rawLines);
          blockProcessedLines.push('```');
          break;
        }
      }
    }

    // 2.0 若行本身已处于 Markdown 代码块内 (```)，保留并原样放行
    if (trimmed.startsWith('```')) {
      blockProcessedLines.push(line);
      i++;
      while (i < rawLines.length) {
        blockProcessedLines.push(rawLines[i]);
        if (rawLines[i].trim().startsWith('```')) {
          i++;
          break;
        }
        i++;
      }
      continue;
    }

    // 2.1 检查是否是纯文本代码块（如连续几行包含代码特征或 JSON 结构）
    const isCodeStart =
      /^(?:const|let|var|function|import|export|class|def|public|private|protected|static|void|async|interface|type|enum|readonly)\s/.test(trimmed) ||
      /^type\s+[A-Za-z_$][\w$]*\s*[={]/.test(trimmed) ||
      /^\/\*\*/.test(trimmed) ||
      /^(?:if|for|while|switch|try)\s*[\(\{]/.test(trimmed) ||
      /^(?:console\.|print\(|System\.out\.|echo\s)/.test(trimmed) ||
      /^(?:\{\s*$|\[\s*$)/.test(trimmed) ||
      /^(?:\$|npm|pnpm|yarn|git|docker|curl|pip)\s+/.test(trimmed) ||
      /^(?:SELECT|INSERT|UPDATE|DELETE|CREATE\s+TABLE)\s+/i.test(trimmed);

    if (isCodeStart) {
      const codeLines: string[] = [line];
      let j = i + 1;
      let consecutiveEmpty = 0;

      while (j < rawLines.length) {
        const nextLine = rawLines[j];
        const nextTrimmed = nextLine.trim();

        if (!nextTrimmed) {
          consecutiveEmpty++;
          if (consecutiveEmpty > 1) break; // 连续两个空行视为代码块结束
          codeLines.push(nextLine);
          j++;
          continue;
        }

        consecutiveEmpty = 0;
        const isStillCode =
          /^(?:const|let|var|function|import|export|class|interface|type|enum|def|return|if|else|for|while|switch|case|try|catch|finally|console|print|readonly)\b/.test(nextTrimmed) ||
          /^[}\]\);,]/.test(nextTrimmed) ||
          /["'][\w\-]+["']\s*:\s*/.test(nextTrimmed) ||
          /^[a-zA-Z_$][\w$]*\s*:\s*/.test(nextTrimmed) ||
          /^[a-zA-Z_$][\w$]*,\s*$/.test(nextTrimmed) ||
          /^\s*(?:\/\*\*?|\*(?:\s|$)|\*\/)/.test(nextTrimmed) ||
          /^(?:\$|npm|pnpm|yarn|git|docker|curl|pip)\s+/.test(nextTrimmed) ||
          /^(?:FROM|WHERE|GROUP\s+BY|ORDER\s+BY|LIMIT|JOIN|HAVING)\b/i.test(nextTrimmed) ||
          /^[a-zA-Z0-9_$.]+\(.*\)[;]?$/.test(nextTrimmed) ||
          /^\s{2,}\S+/.test(nextLine);

        if (isStillCode) {
          codeLines.push(nextLine);
          j++;
        } else {
          break;
        }
      }

      // 如果代码行数量 >= 2，或者单行包含了完整的 JSON/Shell 指令，封装为标准代码块
      const joinedCode = codeLines.join('\n').trim();
      if (codeLines.length >= 2 || /^(?:\$|npm|pnpm|yarn|git|docker|curl|pip)\s+/.test(trimmed)) {
        const lang = inferCodeLanguage(joinedCode);
        blockProcessedLines.push('');
        blockProcessedLines.push(`\`\`\`${lang}`);
        blockProcessedLines.push(joinedCode);
        blockProcessedLines.push('```');
        blockProcessedLines.push('');
        i = j;
        continue;
      }
    }

    // 2.2 检查是否是表格行（包含半角 | 或全角 ｜ 管道符）
    const hasPipe = (trimmed.includes('|') || trimmed.includes('｜')) && trimmed.length >= 3;
    if (hasPipe) {
      const tableLines: string[] = [line];
      let jTable = i + 1;
      let blankRun = 0;
      while (jTable < rawLines.length) {
        const nextTrimmed = rawLines[jTable].trim();
        if (!nextTrimmed) {
          blankRun++;
          if (blankRun >= 2) break;
          jTable++;
          continue;
        }
        blankRun = 0;
        if (nextTrimmed.includes('|') || nextTrimmed.includes('｜')) {
          tableLines.push(rawLines[jTable]);
          jTable++;
        } else {
          break;
        }
      }

      const nonEmptyTableLines = tableLines.filter((l) => l.trim());
      const pipeFirstCell = (() => {
        const first = nonEmptyTableLines[0].replace(/｜/g, '|').trim();
        return first.replace(/^\|/, '').split('|')[0].trim() || first;
      })();
      const pipeBlankSkips = nonEmptyTableLines.length !== tableLines.length;
      const pipeSuppressed = pipeBlankSkips && isSuppressed('表格（管道分隔）', pipeFirstCell);
      if (nonEmptyTableLines.length >= 2 && !pipeSuppressed) {
        // 置信度：行间穿插过空行的表格判定把握略低，提示用户确认
        if (pipeBlankSkips) {
          noteDecision('表格（管道分隔）', 0.68, pipeFirstCell);
        }
        const normalizedTable: string[] = [];
        let colCount = 0;

        nonEmptyTableLines.forEach((tLine, idx) => {
          const replaced = tLine.replace(/｜/g, '|').trim();
          const rawCells = replaced
            .split('|')
            .map((c) => c.trim())
            .filter((c, cellIdx, arr) => {
              if ((cellIdx === 0 || cellIdx === arr.length - 1) && c === '') {
                return false;
              }
              return true;
            });

          const cells = rawCells.map((cellText) => {
            const cellTrimmed = cellText.trim();
            if (isImageUrl(cellTrimmed) && !cellTrimmed.startsWith('![')) {
              return `![配图](${cellTrimmed})`;
            }
            if (/^▲\s*.+$/.test(cellTrimmed) && !cellTrimmed.startsWith('*')) {
              return `*${cellTrimmed}*`;
            }
            return cellText;
          });

          colCount = Math.max(colCount, cells.length);
          const formattedRow = `| ${cells.join(' | ')} |`;
          normalizedTable.push(formattedRow);

          // 第一行后面如果尚未包含表头分割线，自动插入表头线
          if (idx === 0) {
            const hasDividerNext =
              nonEmptyTableLines.length > 1 &&
              /^\|?[\s\-:]+(\|[\s\-:]+)+\|?$/.test(nonEmptyTableLines[1].replace(/｜/g, '|').trim());
            if (!hasDividerNext) {
              const divider = `| ${Array(cells.length).fill(':---').join(' | ')} |`;
              normalizedTable.push(divider);
            }
          }
        });

        blockProcessedLines.push('');
        blockProcessedLines.push(...normalizedTable);
        blockProcessedLines.push('');
        i = jTable;
        continue;
      }
    }

    // 2.3 检查是否是 Excel / WPS 粘贴的制表符 (Tab - \t) 或多空格对齐数据表格
    // 连续 2 行以上，每行包含 \t 或 >=2 个连续空格切分的 2~12 列
    const splitBySpaceOrTab = (str: string) => {
      if (str.includes('\t')) {
        return str.split('\t').map((s) => s.trim()).filter((s) => s !== '');
      }
      return str.split(/\s{2,}/).map((s) => s.trim()).filter((s) => s !== '');
    };

    const initialColumns = splitBySpaceOrTab(trimmed);
    const isPotentialSpaceTable =
      initialColumns.length >= 2 &&
      initialColumns.length <= 12 &&
      !trimmed.startsWith('-') &&
      !trimmed.startsWith('*') &&
      !/^[0-9]+[、.]/.test(trimmed) &&
      !/[。！？…]$/.test(trimmed);

    if (isPotentialSpaceTable) {
      const spaceTableLines: string[][] = [initialColumns];
      let jSpace = i + 1;
      let blankRun = 0;

      while (jSpace < rawLines.length) {
        const nextTrimmed = rawLines[jSpace].trim();
        if (!nextTrimmed) {
          blankRun++;
          if (blankRun >= 2) break;
          jSpace++;
          continue;
        }
        blankRun = 0;
        const nextCols = splitBySpaceOrTab(nextTrimmed);
        // 如果列数与第一行相近（相差不超过 1 列）且 >= 2 列
        if (Math.abs(nextCols.length - initialColumns.length) <= 1 && nextCols.length >= 2) {
          spaceTableLines.push(nextCols);
          jSpace++;
        } else {
          break;
        }
      }

      if (spaceTableLines.length >= 2 && !isSuppressed('表格（空格对齐）', (spaceTableLines[0][0] || '').slice(0, 24))) {
        // 置信度：双空格/制表符对齐的表格判定把握中等（Word 粘贴常见误判），提示用户确认
        noteDecision(
          '表格（空格对齐）',
          0.65,
          (spaceTableLines[0][0] || '').slice(0, 24)
        );
        const maxCols = Math.max(...spaceTableLines.map((r) => r.length));
        const formattedTable: string[] = [];

        spaceTableLines.forEach((row, rIdx) => {
          while (row.length < maxCols) row.push('-');
          const cells = row.map((cellText) => {
            const cellTrimmed = cellText.trim();
            if (isImageUrl(cellTrimmed) && !cellTrimmed.startsWith('![')) {
              return `![配图](${cellTrimmed})`;
            }
            if (/^▲\s*.+$/.test(cellTrimmed) && !cellTrimmed.startsWith('*')) {
              return `*${cellTrimmed}*`;
            }
            return cellText;
          });
          formattedTable.push(`| ${cells.join(' | ')} |`);
          if (rIdx === 0) {
            formattedTable.push(`| ${Array(maxCols).fill(':---').join(' | ')} |`);
          }
        });

        blockProcessedLines.push('');
        blockProcessedLines.push(...formattedTable);
        blockProcessedLines.push('');
        i = jSpace;
        continue;
      }
    }

    blockProcessedLines.push(line);
    i++;
  }

  // 3. 第二阶段：单行语义分析与转换
  const processedLines: string[] = [];
  let isFirstNonEmpty = true;
  let inCodeBlock = false;
  let inHtmlBlock = false;
  let lastNonEmptyWasImage = false;

  // 阿拉伯数字编号行的智能消歧辅助：
  // 编号行在相邻位置（含仅隔一个空行）成组出现 → 有序列表；
  // 孤立出现（前后都是正文/标题/空行隔断）→ 小节标题 (H2)
  const arabicNumberedRe = /^\d{1,3}(?:\s*[、,，.．)）:：]\s*|\s)\s*\S+/  // 1~3 位：四位数字（如年份）不参与编号消歧;
  const nearestNonEmptyLine = (arr: string[], from: number, step: number): string => {
    let k = from;
    while (k >= 0 && k < arr.length) {
      const t = (arr[k] || '').trim();
      if (t) return t;
      k += step;
    }
    return '';
  };

  // ===== 第一阶段引擎：编号家族聚类与层级分配（文档级结构推断）=====
  // 家族：相同数字体系+分隔风格的编号行归为一族（如「一、二、三」中文族、「1、2、3」阿拉伯族）
  // 层级：中文族恒为 H2（章节）；阿拉伯族为小节——若文中存在中文族则降级 H3 形成父子层级
  // 形态：族内相邻（含隔一空行）→ 有序列表；孤立（前后最近非空行都不是编号行）→ 小节标题
  const cnSectionLineRe =
    /^[一二三四五六七八九十百千万]+(?:\s*[、,，.．:：]\s*|\s+).+$/;
  // 小节分类允许 1~4 位编号（如「2026 年度报告」）；连号密度检测仍为 1~3 位（年份不触发连号）
  const arabicSectionLineRe = /^(\d{1,4})(?:\s*[、,，.．:：]\s*|\s+)(.+)$/;
  let hasChineseNumberedSections = false;
  const arabicSectionIndexes = new Set<number>();
  const arabicSectionLevelMap = new Map<number, string>();
  {
    const arabicEntries: { index: number; trimmed: string }[] = [];
    blockProcessedLines.forEach((l, idx) => {
      const t = l.trim();
      if (!t) return;
      if (cnSectionLineRe.test(t)) {
        hasChineseNumberedSections = true;
        return;
      }
      const m = t.match(arabicSectionLineRe);
      if (m && !/^\d+(?:\.\d+)+/.test(t) && !/https?:\/\//i.test(t) && m[2].length <= 40 && !/[。！？…]$/.test(m[2]) && !/^\d/.test(m[2])) {
        arabicEntries.push({ index: idx, trimmed: t });
      }
    });
    const arabicSectionLevel = hasChineseNumberedSections ? '###' : '##';
    for (const entry of arabicEntries) {
      const prevNearest = nearestNonEmptyLine(blockProcessedLines, entry.index - 1, -1);
      const nextNearest = nearestNonEmptyLine(blockProcessedLines, entry.index + 1, 1);
      const isDense = arabicNumberedRe.test(prevNearest) || arabicNumberedRe.test(nextNearest);
      if (!isDense) {
        arabicSectionIndexes.add(entry.index);
        arabicSectionLevelMap.set(entry.index, arabicSectionLevel);
      }
    }
  }

  for (let idx = 0; idx < blockProcessedLines.length; idx++) {
    const rawLine = blockProcessedLines[idx];
    const trimmed = rawLine.trim();

    if (trimmed.startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      processedLines.push(rawLine);
      continue;
    }

    if (inCodeBlock) {
      processedLines.push(rawLine);
      continue;
    }

    if (!trimmed) {
      inHtmlBlock = false; // 空行结束 HTML 块
      processedLines.push('');
      continue;
    }

    // 保留用户内嵌的显式 HTML 块（photo-card 图片卡片、自定义 section 等）：
    // 以 "<字母" 开头的行开启 HTML 块，直到空行为止；块内行原样输出，
    // 杜绝条目标题提取/强调/间距等文本规则破坏 style 属性与卡片结构
    if (inHtmlBlock || /^<[a-zA-Z]/.test(trimmed)) {
      inHtmlBlock = true;
      lastNonEmptyWasImage = false;
      processedLines.push(trimmed);
      continue;
    }

    // 保留表格行
    if (trimmed.startsWith('|')) {
      lastNonEmptyWasImage = false;
      processedLines.push(trimmed);
      continue;
    }

    // 保留显式 Markdown 图片语法
    if (/^!\[[^\]]*\]\(.+\)$/.test(trimmed)) {
      isFirstNonEmpty = false;
      lastNonEmptyWasImage = true;
      processedLines.push(trimmed);
      continue;
    }

    // 3.1 识别分割线：如 "---", "===", "***", "———", "·····"
    if (/^[-—_*=·.]{3,}$/.test(trimmed)) {
      processedLines.push('');
      processedLines.push('---');
      processedLines.push('');
      continue;
    }

    // 3.2 识别首行文章大标题 (H1)
    // 无论是 explicit "标题：..." 还是第一行短文本（由 treatFirstLineAsTitle 开关控制）
    const explicitTitleMatch = trimmed.match(/^(?:文章大标题|文章标题|文章题目|标题|题目|Title)[：:]\s*(.+)$/i);
    if (explicitTitleMatch) {
      processedLines.push('');
      processedLines.push(`# ${explicitTitleMatch[1].trim()}`);
      processedLines.push('');
      isFirstNonEmpty = false;
      continue;
    }

    if (isFirstNonEmpty) {
      isFirstNonEmpty = false;
      if (treatFirstLineAsTitle) {
        const isLikelyMainTitle =
          trimmed.length <= 40 &&
          !/[，。；！？…：:]$/.test(trimmed) &&
          !/^[一二三四五六七八九十0-9①②③]/.test(trimmed) &&
          !/^(?:导读|导言|摘要|前言|总结|注意|提示)/.test(trimmed);

        if (isLikelyMainTitle && !trimmed.startsWith('#')) {
          processedLines.push(`# ${trimmed}`);
          processedLines.push('');
          continue;
        }
      }
    }

    // 3.2.5 若已有 Markdown 标题语法 (# )，原样放行并确保前后空行
    if (/^#{1,6}\s+/.test(trimmed)) {
      processedLines.push('');
      processedLines.push(trimmed);
      processedLines.push('');
      continue;
    }

    // 3.3 识别一级大章节 (H2)
    // 中文序号：如 "一、背景介绍", "第一章 绪论", "壹、核心问题", "第一部分 系统架构", "第1节 原理剖析"
    // 分隔符灵活支持：顿号/点/逗号(中英)/冒号(中英)/空格，如 "一 背景" "一，背景" "一:背景" "1、背景"
    const isH2Pattern =
      /^[一二三四五六七八九十百千万]+(?:\s*[、,，.．:：]\s*|\s+).+$/.test(trimmed) ||
      /^[壹贰叁肆伍陆柒捌玖拾]+(?:\s*[、,，.．:：]\s*|\s+).+$/.test(trimmed) ||
      /^第[一二三四五六七八九十0-9]+[章节篇部卷集讲堂课回期分]+[\s：:].*$/.test(trimmed) ||
      /^(?:Chapter|Section|Part)\s+[0-9IVXLCDM]+[\s：:].*$/i.test(trimmed) ||
      /^(?:前言|背景|背景介绍|概述|核心观点|业务架构|技术实现|结语|总结|写在最后|写在前面|结语与展望)$/.test(trimmed) ||
      /^(?:阶段|Phase|Step)\s*[一二三四五六七八九十0-9]+[：:、.\s]+.+$/i.test(trimmed);

    if (isH2Pattern) {
      processedLines.push('');
      processedLines.push(`## ${trimmed}`);
      processedLines.push('');
      continue;
    }

    // 独立方括号/书名号标题：如 "【重点梳理】" 或 "「核心观点」"
    if (/^[【\[「『［][^】\]」』］]{2,25}[】\]」』］]$/.test(trimmed)) {
      const cleanTitle = trimmed.slice(1, -1).trim();
      processedLines.push('');
      processedLines.push(`## ${cleanTitle}`);
      processedLines.push('');
      continue;
    }

    // 3.4 识别二级小节 (H3)
    // 如 "1.1 架构设计", "（一）基本假设", "(一) 需求分析", "A. 数据清洗"
    const isH3Pattern =
      /^\d+\.\d+[\s、.．]+\S+/.test(trimmed) ||
      /^[（(][一二三四五六七八九十]+[）)][\s、.．]*\S+/.test(trimmed) ||
      /^[A-Z][.、．\s]+\S+/.test(trimmed);

    if (isH3Pattern) {
      processedLines.push('');
      processedLines.push(`### ${trimmed}`);
      processedLines.push('');
      continue;
    }

    // 3.5 识别三级小节 (H4) 与四级小节 (H5)
    // 如 "1.1.1 缓存机制", "（1）细节规范", "(1) 细节规范", "1) 补充说明"
    if (/^\d+\.\d+\.\d+\.\d+[\s、.．]*\S+/.test(trimmed)) {
      processedLines.push('');
      processedLines.push(`##### ${trimmed}`);
      processedLines.push('');
      continue;
    }
    if (/^\d+\.\d+\.\d+[\s、.．]*\S+/.test(trimmed)) {
      processedLines.push('');
      processedLines.push(`#### ${trimmed}`);
      processedLines.push('');
      continue;
    }
    if (
      /^[（(]\d+[）)][\s、.．]*\S+/.test(trimmed) ||
      /^\d+[)）][\s、.．]*\S+/.test(trimmed)
    ) {
      // 避免误判单行简短选项（如 "(1) 选项A" 当处于紧凑段落时作为列表）
      processedLines.push('');
      processedLines.push(`#### ${trimmed}`);
      processedLines.push('');
      continue;
    }

    // 3.6 识别 Q&A 问答与访谈录结构
    const questionMatch = trimmed.match(/^(?:问|Q|Question|提问|读者问)[：:]\s*(.+)$/i);
    if (questionMatch) {
      processedLines.push('');
      processedLines.push(`**Q：${questionMatch[1].trim()}**`);
      processedLines.push('');
      continue;
    }
    const answerMatch = trimmed.match(/^(?:答|A|Answer|回答|作者答)[：:]\s*(.+)$/i);
    if (answerMatch) {
      processedLines.push('');
      processedLines.push(`> **A**：${answerMatch[1].trim()}`);
      processedLines.push('');
      continue;
    }

    // 3.7 识别导读、编者按、摘要、核心看点等文章先导 Callout
    const leadCalloutMatch = trimmed.match(
      /^(导读|导言|编者按|摘要|前言|引言|核心看点|核心观点|总结|思考|声明)[：:]\s*(.+)$/i
    );
    if (leadCalloutMatch) {
      const tag = leadCalloutMatch[1];
      const content = leadCalloutMatch[2];
      processedLines.push('');
      processedLines.push(`> **${tag}**：${content}`);
      processedLines.push('');
      continue;
    }

    // 3.8 识别带 Emoji 或标准提示语的重点、警告、提示 Callout
    const alertCalloutMatch = trimmed.match(
      /^(?:(💡|⚠️|❗|📌|🎯|📝|⚡|🔥|💬|🔔)\s*)?((?:核心|重要|特别|关键)?(?:提示|警告|注意|注意事项|要点|小贴士|目标|提醒)|Tips?|Warning|Note|Notice|Caution)[：:]\s*(.+)$/i
    );
    if (alertCalloutMatch) {
      const emoji = alertCalloutMatch[1] ? `${alertCalloutMatch[1]} ` : '';
      const tag = alertCalloutMatch[2];
      const content = alertCalloutMatch[3];
      processedLines.push('');
      processedLines.push(`> **${emoji}${tag}**：${content}`);
      processedLines.push('');
      continue;
    }

    // 3.9 识别独立注释与旁白说明（注：、※、补充说明）
    const noteMatch = trimmed.match(/^(?:注|注\d+|※|补充说明|附注|PS)[：:]\s*(.+)$/i);
    if (noteMatch) {
      const noteContent = noteMatch[1].trim();
      processedLines.push('');
      processedLines.push(`*※ 注：${noteContent}*`);
      processedLines.push('');
      continue;
    }

    // 3.10 识别带破折号署名的名言金句 (Pull-Quote)
    const quoteWithAuthor = trimmed.match(/^[“"『「](.+)[”"』」]\s*(?:——|-|—|by|By|——\s*By)\s*(.+)$/);
    if (quoteWithAuthor) {
      const quoteText = quoteWithAuthor[1].trim();
      const author = quoteWithAuthor[2].trim();
      processedLines.push('');
      processedLines.push(`> “${quoteText}”\n>\n> —— ${author}`);
      processedLines.push('');
      continue;
    }

    // 识别独立成行的金句（整行被引号包裹且长度合适）
    if (/^[“"『「].+[”"』」]$/.test(trimmed) && trimmed.length >= 8 && trimmed.length <= 160) {
      processedLines.push('');
      processedLines.push(`> ${trimmed}`);
      processedLines.push('');
      continue;
    }

    // 3.11 配图 / 图片标记行（配图：URL、[图片] URL）不再转为图片：
    // 纯文本输入遵循「URL 只显示 URL」的需求，此类行按普通文本处理；
    // 仅显式 Markdown 图片语法 ![alt](url) 与 <img> 标签才在预览中按图片渲染

    // 3.12 识别图片题注或图表标注：如 "▲ 图1：系统整体架构" 或 "▲ 阶段 1：草图" 或 "*▲ 图1：系统架构*"
    const explicitCaption =
      /^\*?(?:▲\s*|\[)?(?:图|表|Figure|阶段)\s*[\dA-Za-z\-]+/i.test(trimmed) ||
      /^\*?▲\s*.+$/i.test(trimmed) ||
      /^\*?注[：:]/.test(trimmed);
    const adjacencyCaption =
      lastNonEmptyWasImage &&
      trimmed.length > 0 &&
      trimmed.length < 120 &&
      !/[。！？]$/.test(trimmed);
    const isCaptionPattern = explicitCaption || adjacencyCaption;

    if (isCaptionPattern) {
      const cleanCap = trimmed.replace(/^[*_]+|[*_]+$/g, '').trim();
      const formattedCap = cleanCap.startsWith('▲') ? cleanCap : `▲ ${cleanCap}`;
      // 置信度：紧随图片且无显式标记的短行判定为题注的把握中等（可能是普通正文），提示用户确认
      if (adjacencyCaption && !explicitCaption) {
        if (!isSuppressed('题注', cleanCap)) {
          noteDecision('题注', 0.68, cleanCap);
        } else {
          // 用户已纠偏为正文：去除斜体与题注标记，按普通文本输出
          processedLines.push(addPanguSpacing(formatBareUrls(cleanCap)));
          lastNonEmptyWasImage = false;
          continue;
        }
      }
      processedLines.push(`*${formattedCap}*`);
      lastNonEmptyWasImage = false;
      continue;
    }

    lastNonEmptyWasImage = false;

    // 3.13 识别任务复选清单 (Task Lists: [ ] / [x] / □ / ✓ / ☑)
    const uncheckedTask = trimmed.match(/^[\t ]*(?:\[\s*\]|□|○|待办[：:])\s*(.+)$/);
    if (uncheckedTask) {
      const taskContent = emphasizeItemHeader(uncheckedTask[1].trim());
      processedLines.push(`- [ ] ${taskContent}`);
      continue;
    }
    const checkedTask = trimmed.match(/^[\t ]*(?:\[[xX]\]|✓|✔|☑|已完成[：:])\s*(.+)$/);
    if (checkedTask) {
      const taskContent = emphasizeItemHeader(checkedTask[1].trim());
      processedLines.push(`- [x] ${taskContent}`);
      continue;
    }

    // 3.14 识别流程步骤与时间线：如 "步骤一：初始化系统", "阶段1：需求调研"
    const stepMatch = trimmed.match(/^(?:步骤|Step)\s*([一二三四五六七八九十0-9]+)[：:、.\s]+(.+)$/i);
    if (stepMatch) {
      const stepName = `步骤 ${stepMatch[1]}`;
      const stepDesc = stepMatch[2].trim();
      processedLines.push('');
      processedLines.push(`- **${stepName}**：${stepDesc}`);
      continue;
    }

    // 3.15 识别无序列表（•, ·, ●, ○, ◆, ◇, ★, ■, □, ▪, ▫, ▶, ▸, ➤, ※, ✦, ✧, 👉, 🔹, 🔸, 📌, ✅, ⭐, -）
    if (/^[•·●○◆◇★■□▪▫▶▸➤👉🔹🔸📌✅⭐✦✧※-]\s*(.+)$/.test(trimmed)) {
      const itemContent = trimmed.replace(/^[•·●○◆◇★■□▪▫▶▸➤👉🔹🔸📌✅⭐✦✧※-]\s*/, '');
      const emphasized = emphasizeItemHeader(itemContent);
      processedLines.push(`- ${emphasized}`);
      continue;
    }

    // 3.16 识别有序列表项与小节编号（1、, 1. , 1 , 1, , 1: , ①, ⑴, 一) ）
    // 智能消歧：阿拉伯数字编号行若成组出现（相邻或仅隔一个空行）→ 有序列表；
    // 孤立出现（前后最近的非空行都不是编号行）且内容短小 → 小节标题 (H2)，
    // 让 "1 xxx" "1,xxx" "1:xxx" 等任意分隔风格都能按意图正确呈现
    const circleNumMatch = trimmed.match(/^([①②③④⑤⑥⑦⑧⑨⑩⑴⑵⑶⑷⑸⑹⑺⑻⑼⑽])\s*(.+)$/);
    if (circleNumMatch) {
      const symbols = '①②③④⑤⑥⑦⑧⑨⑩⑴⑵⑶⑷⑸⑹⑺⑻⑼⑽';
      const char = circleNumMatch[1];
      const rawIdx = symbols.indexOf(char);
      const num = rawIdx >= 10 ? rawIdx - 9 : rawIdx + 1;
      const content = circleNumMatch[2];
      const emphasized = emphasizeItemHeader(content);
      processedLines.push(`${num}. ${emphasized}`);
      continue;
    }

    const numMatch = trimmed.match(/^(\d{1,4})(?:\s*[、,，.．:：]\s*|\s+)(.+)$/);
    if (numMatch) {
      const num = numMatch[1];
      const content = numMatch[2];
      // 多级编号保护："1.1 架构设计"、"3.14.5" 等由上方 H3/H4/H5 规则处理
      const isMultiLevelNumbering = /^\d+(?:\.\d+)+/.test(trimmed);
      // 参考文献条目（含 URL）不走标题转换，保持编号列表形态
      const isReferenceLike = /https?:\/\//i.test(trimmed);

      // 层级与形态由第一阶段的「编号家族聚类」预计算（arabicSectionIndexes / arabicSectionLevelMap）：
      // 孤立编号行 → 小节标题（文档含中文族时 H3，否则 H2）；密集编号行 → 有序列表项
      if (!isMultiLevelNumbering && !isReferenceLike && arabicSectionIndexes.has(idx)) {
        // 置信度：文档中存在中文序号章节时，阿拉伯编号是否应降级为小节存在歧义，提示用户确认
        if (hasChineseNumberedSections) {
          if (isSuppressed('小节标题（编号）', content)) {
            // 用户已纠偏为正文：原样输出，不转标题也不转列表
            processedLines.push(trimmed);
            continue;
          }
          noteDecision('小节标题（编号）', 0.72, content);
        }
        processedLines.push('');
        processedLines.push(`${arabicSectionLevelMap.get(idx)} ${trimmed}`);
        processedLines.push('');
        continue;
      }

      const emphasized = emphasizeItemHeader(content);
      processedLines.push(`${num}. ${emphasized}`);
      continue;
    }

    // 3.17 孤立短行（前后空行，无标点，2~18字）识别为小节标题
    const isPrevEmpty = idx > 0 && !blockProcessedLines[idx - 1].trim();
    const isNextEmpty = idx < blockProcessedLines.length - 1 && !blockProcessedLines[idx + 1].trim();
    if (
      isPrevEmpty &&
      isNextEmpty &&
      trimmed.length >= 2 &&
      trimmed.length <= 18 &&
      !/[，。；！？…、“”'’（）()：:]/.test(trimmed) &&
      !trimmed.startsWith('#') &&
      !trimmed.startsWith('-') &&
      !isSuppressed('小节标题（短行）', trimmed)
    ) {
      // 置信度：孤立短句（如「受益匪浅」）可能是文末感叹而非标题，提示用户确认
      noteDecision('小节标题（短行）', 0.7, trimmed);
      processedLines.push(`### ${trimmed}`);
      continue;
    }

    // 3.18 识别参考文献段落标头（覆盖常见中英文关键词）
    if (/^(?:参考资料|参考文献|参考链接|引用来源|资料来源|相关阅读|延伸阅读|参考|引用|链接|References?|Links?|Sources?)[：:]?$/i.test(trimmed)) {
      processedLines.push('');
      processedLines.push(`### 🔗 ${trimmed.replace(/[：:]$/, '')}`);
      processedLines.push('');
      continue;
    }

    // 3.19 识别参考文献条目形如 [1] 标题: https://... 、1. 标题: https://... 、1) 标题: https://...
    const refItemMatch = trimmed.match(/^(?:\[(\d+)\]|(\d+)(?:[.、)）])?)\s*(.*)$/);
    if (refItemMatch && /https?:\/\//i.test(trimmed)) {
      const refNum = refItemMatch[1] || refItemMatch[2];
      const rest = refItemMatch[3].trim();
      const formattedRef = formatBareUrls(emphasizeItemHeader(rest));
      processedLines.push(`${refNum}. ${formattedRef}`);
      continue;
    }

    // 3.20 如果整行就是纯裸 URL，转为清晰的列表链接
    if (/^https?:\/\/\S+$/i.test(trimmed)) {
      const formattedLink = formatBareUrls(trimmed);
      processedLines.push(`- ${formattedLink}`);
      continue;
    }

    // 3.21 普通正文行：条目标题自动强调提取 + 裸链接转换 + 盘古排版间距优化
    const withEmphasize = emphasizeItemHeader(trimmed);
    const withUrls = formatBareUrls(withEmphasize);
    const formattedLine = addPanguSpacing(withUrls);

    processedLines.push(formattedLine);
  }

  // 4. 第三阶段：自然段落呼吸感重构（防止软换行被 Markdown 强行拼接挤压）
  const finalResult: string[] = [];
  let emptyCounter = 0;
  let inCodeBlockStage3 = false;

  for (let j = 0; j < processedLines.length; j++) {
    const curLine = processedLines[j];

    if (curLine.trim().startsWith('```')) {
      inCodeBlockStage3 = !inCodeBlockStage3;
    }

    if (!curLine) {
      emptyCounter++;
      if (inCodeBlockStage3) {
        finalResult.push('');
      } else if (emptyCounter === 1 && finalResult.length > 0) {
        finalResult.push('');
      }
    } else {
      emptyCounter = 0;

      // 检查当前行与上一行：如果两者都是普通文本（非列表、非表格、非标题、非引用、非代码），
      // 且上一行以句号、感叹号、问号、冒号、省略号或破折号结尾，即使没有手动打空行，
      // 也智能补足空行，彻底解决从 Word / 微信 / 网页粘贴无空行段落挤压的顽疾！
      if (!inCodeBlockStage3 && finalResult.length > 0) {
        const lastLine = finalResult[finalResult.length - 1];
        const isLastLineSpecial =
          lastLine === '' ||
          lastLine.startsWith('#') ||
          lastLine.startsWith('- ') ||
          /^\d+\.\s/.test(lastLine) ||
          lastLine.startsWith('> ') ||
          lastLine.startsWith('|') ||
          lastLine.startsWith('```') ||
          lastLine.startsWith('![') ||
          lastLine.startsWith('<');

        const isCurLineSpecial =
          curLine.startsWith('#') ||
          curLine.startsWith('- ') ||
          /^\d+\.\s/.test(curLine) ||
          curLine.startsWith('> ') ||
          curLine.startsWith('|') ||
          curLine.startsWith('```') ||
          curLine.startsWith('![') ||
          curLine.startsWith('*▲') ||
          curLine.startsWith('<');

        if (!isLastLineSpecial && !isCurLineSpecial) {
          if (/[。！？…!?:：~”’"）)]$|^[一二三四五六七八九十0-9]/.test(lastLine.trim())) {
            finalResult.push('');
          }
        }
      }

      finalResult.push(curLine);
    }
  }

  return finalResult.join('\n').trim();
}

/**
 * 根据「首句标题」开关调整首行标题状态：
 * - treatAsTitle = true: 首个有效文本行若非大标题，则提升为 # 大标题
 * - treatAsTitle = false: 首个有效文本行若是 H1 大标题 (# 开头)，则移除 # 降为普通正文段落
 */
export function adjustFirstLineTitle(markdown: string, treatAsTitle: boolean): string {
  if (!markdown) return markdown;

  const lines = markdown.split('\n');
  let targetIdx = -1;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed) continue;
    if (trimmed.startsWith('<!--') || trimmed.startsWith('---') || trimmed.startsWith('***')) continue;
    if (trimmed.startsWith('![') || trimmed.startsWith('<img') || trimmed.startsWith('<section data-role="photo-card"')) {
      return markdown;
    }

    targetIdx = i;
    break;
  }

  if (targetIdx === -1) return markdown;

  const trimmed = lines[targetIdx].trim();

  if (treatAsTitle) {
    if (!trimmed.startsWith('#')) {
      const isSpecialBlock = /^[>\-*+`|]/.test(trimmed) || /^\d+\.\s/.test(trimmed);
      if (!isSpecialBlock) {
        lines[targetIdx] = `# ${trimmed}`;
      }
    }
  } else {
    if (/^#\s+/.test(trimmed)) {
      lines[targetIdx] = trimmed.replace(/^#\s+/, '');
    }
  }

  return lines.join('\n');
}

/**
 * 智能预处理器：根据模式决定是否应用转换
 * @param content 输入内容
 * @param mode 'auto' (自动侦测并格式化) | 'plain-text' (强制格式化纯文本) | 'markdown' (纯 Markdown 直通)
 * @param options 纯文本解析选项，如是否识别首句为大标题
 */
/**
 * 修复用户从网页 / 文档 / AI 对话中复制而来的"损伤 HTML"：
 * 1. 双重转义还原：&lt;section ...&gt; → <section ...>（粘贴被转义的源码时按真实 HTML 渲染，而非显示源码文本）
 * 2. 属性名破折号损伤修复：data — role / data – role → data-role（输入法或富文本编辑器常把连字符替换为长破折号）
 * 代码块围栏内的内容不做任何修复，保持源码原样展示。
 */
export function repairPastedHtml(text: string): string {
  if (!text) return '';
  const segments = text.split(/(```[\s\S]*?```)/g);
  const repaired = segments.map((segment, i) => {
    if (i % 2 === 1) return segment; // 代码围栏内保持原样
    let out = segment;
    // 1) 还原被转义的常见 HTML 标签
    if (/&lt;\/?(?:section|div|p|img|h[1-6]|table|thead|tbody|tr|td|th|ul|ol|li|blockquote|figure|figcaption|span|a|br|strong|em|b|i)\b/i.test(out)) {
      out = out.replace(/&lt;(\/?[a-zA-Z][^&<>]*?)&gt;/g, '<$1>');
    }
    // 2) 修复标签内属性名的破折号损伤（data — role → data-role）
    out = out.replace(/(<[a-zA-Z][^<>]*?)\bdata\s+[—–−]\s*(?=[a-zA-Z][a-zA-Z-]*\s*=)/g, '$1data-');
    // 3) 清除历史转换残留的孤立星号垃圾行（整行有且仅有两个星号——它既非合法加粗也非分割线，纯属转换残渣；
    //    必须锚定行尾，绝不能误伤以 ** 开头的正常加粗行（如 **Q：...**、**需求梳理** — ...）；注意保留 *** 水平分割线）
    out = out.replace(/^[ \t]*\*\*[ \t]*(?:\n|$)/gm, '');
    return out;
  });
  return repaired.join('');
}

export function processContentByMode(
  content: string,
  mode: 'auto' | 'plain-text' | 'markdown' = 'auto',
  options?: ParserOptions
): {
  renderedMarkdown: string;
  detectedFormat: FormatDetectionResult;
  isTransformed: boolean;
  /** 低置信度识别决策（置信度 < 0.75），供界面提示用户确认 */
  decisions: ConversionDecision[];
} {
  const detected = detectContentFormat(content);
  const treatAsTitle = options?.treatFirstLineAsTitle ?? false;

  let baseMd: string;
  let isTransformed: boolean;
  const decisions: ConversionDecision[] = [];

  // 先修复输入端的损伤 HTML（双重转义、data — role 等属性破折号损伤），
  // 避免智能转换引擎把受损属性中的连字符/破折号误判为标题分隔符
  const sanitizedContent = repairPastedHtml(content);

  // 在 auto 模式与 plain-text 模式下，统一执行全能语义规整与格式转换：
  // 保持文档中已有的代码块、图片与标准表格不被破坏的同时，
  // 将文档中未格式化的各级章节、表格、清单、提示、列表与段落全面升级为语义化结构！
  // 仅当用户显式选择 'markdown' 模式时才直通跳过。
  if (mode === 'plain-text' || mode === 'auto') {
    baseMd = convertPlainTextToMarkdown(
      sanitizedContent,
      {
        ...options,
        treatFirstLineAsTitle: treatAsTitle,
      },
      decisions
    );
    isTransformed = baseMd !== content;
  } else {
    baseMd = sanitizedContent;
    isTransformed = false;
  }

  // 修复从网页 / 文档 / AI 对话复制而来的损伤 HTML（双重转义、属性破折号损伤），
  // 保证 photo-card 等自定义 HTML 卡片在预览中按真实结构渲染而非显示源码
  const finalMd = repairPastedHtml(adjustFirstLineTitle(baseMd, treatAsTitle));

  return {
    renderedMarkdown: finalMd,
    detectedFormat: detected,
    isTransformed: isTransformed || finalMd !== content,
    decisions,
  };
}
