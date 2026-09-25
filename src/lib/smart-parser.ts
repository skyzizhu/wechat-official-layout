/**
 * 智能文本/Markdown 识别与排版格式化工具
 * 能够自动区分用户输入是 Markdown 源码还是普通自然文本，
 * 并对普通自然纯文本进行全能智能语义层级解析：
 * 涵盖标题（H1~H4）、列表、条目标题自动加粗强调、表格（管道符/全角符/制表符）、
 * 代码块（JavaScript/Python/JSON/SQL/Shell等多语言推断）、
 * 注释与旁白（※注）、Q&A问答访谈、流程步骤、引用金句与提示警告块、裸外链与参考文献等。
 */

export interface FormatDetectionResult {
  isMarkdown: boolean;
  confidence: number; // 0 到 100
  features: string[];
  suggestedMode: 'markdown' | 'plain-text';
}

/**
 * 智能检测输入文本是否为 Markdown 源码
 */
export function detectContentFormat(text: string): FormatDetectionResult {
  if (!text || text.trim().length === 0) {
    return {
      isMarkdown: false,
      confidence: 0,
      features: [],
      suggestedMode: 'plain-text',
    };
  }

  const features: string[] = [];
  let score = 0;

  // 1. 检测标准的 Markdown 标题 (# )
  if (/^#{1,6}\s+\S+/m.test(text)) {
    score += 40;
    features.push('Markdown 标题 (#)');
  }

  // 2. 检测代码块 (```)
  if (/```[\s\S]*?```/.test(text)) {
    score += 35;
    features.push('代码块 (```)');
  }

  // 3. 检测行内代码 (`code`)
  if (/`[^`\n]+`/.test(text)) {
    score += 15;
    features.push('行内代码 (` `)');
  }

  // 4. 检测引用语法 (> )
  if (/^>\s+\S+/m.test(text)) {
    score += 25;
    features.push('Markdown 引用 (>)');
  }

  // 5. 检测标准 Markdown 链接或图片 [text](url) 或 ![alt](url)
  if (/!?\[[^\]]+\]\([^)]+\)/.test(text)) {
    score += 30;
    features.push('链接/图片语法 [text](url)');
  }

  // 6. 检测 Markdown 表格 (| --- |)
  if (/\|[ \t]*[-:]+[-| :]*\|/.test(text)) {
    score += 35;
    features.push('Markdown 表格');
  }

  // 7. 检测加粗或斜体 (**text** or *text*)
  if (/\*\*[^*\n]+\*\*/.test(text) || /__[^_\n]+__/.test(text)) {
    score += 20;
    features.push('加粗语法 (**text**)');
  }

  // 8. 检测标准无序列表 (- 或 * 后面加空格)
  if (/^[\t ]*[-*+]\s+\S+/m.test(text)) {
    score += 15;
    features.push('标准列表项 (- )');
  }

  const isMarkdown = score >= 35;

  return {
    isMarkdown,
    confidence: Math.min(100, Math.max(0, score)),
    features,
    suggestedMode: isMarkdown ? 'markdown' : 'plain-text',
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
 * 纯文本输入中的图片类型 URL 按排版需求保持原样：仅显示用户输入的 URL 文本，
 * 不自动转为图片，也不转为短标签链接。
 */
export function isImageUrl(url: string): boolean {
  return (
    /^https?:\/\/\S+\.(?:jpg|jpeg|png|webp|gif|svg|avif)(?:\?.*)?$/i.test(url) ||
    /^https?:\/\/images\.unsplash\.com\/\S+/i.test(url) ||
    /^https?:\/\/mmbiz\.qpic\.cn\/\S+/i.test(url)
  );
}

/**
 * 智能转换正文中的裸 URL 为 Markdown 链接，以便文末脚注引擎识别
 */
export function formatBareUrls(text: string): string {
  // 匹配未被 []() 围闭的独立 http/https 链接
  // 负向回顾确保不在 []() 语法内
  const bareUrlRegex = /(?<![(\[="'])(https?:\/\/[a-zA-Z0-9\-._~:/?#[\]@!$&'()*+,;=%]+)(?![)\]"'])/g;

  return text.replace(bareUrlRegex, (url) => {
    // 图片类型 URL：保持用户输入的 URL 原样显示（不转图片、不转短标签）
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
  if (/(?:^\s*\$\s+|^\s*(?:npm|pnpm|yarn|git|docker|curl|chmod|brew|npx)\s+)/m.test(code)) {
    return 'bash';
  }
  return '';
}

/**
 * 智能条目标题自动强调提取：
 * 将形如 "字体的呼吸感：不同字体拥有..." 或 "【核心特性】全面支持..."
 * 自动提取加粗为 "**字体的呼吸感**：不同字体拥有..."，以无缝激活模板的荧光笔加粗高亮样式
 */
function emphasizeItemHeader(text: string): string {
  // 0. 如果是以 http:// 或 https:// 开头，或者包含完整 URL，不当作条目标题
  if (/^\s*https?:\/\//i.test(text)) {
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

  // 3. 匹配冒号或破折号前面的条目标题：条目标题：具体说明...
  // 限制条目标题长度在 2 到 18 个字符以内，且不能是 URL 协议头，不包含逗号句号顿号
  const colonMatch = text.match(/^([^：:——\-，。！？\n]{2,18})([：:])\s*(.+)$/);
  if (colonMatch) {
    const title = colonMatch[1].trim();
    const punct = '：';
    const rest = colonMatch[3].trim();
    // 防止把 URL 协议的冒号误判为条目标题分隔符（如 "普通链接 https://..." 会被拆成 "**普通链接 https**：//..." 损坏 URL）：
    // 标题以协议名结尾（https/http/ftp/file/ws/wss），或冒号后紧跟 //，均视为 URL 的一部分，保持原样
    if (
      /^(?:https?|ftp|file|ws|wss)$/i.test(title) ||
      /(?:https?|ftp|file|ws|wss)$/i.test(title) ||
      /^\/\//.test(rest)
    ) {
      return text;
    }
    return `**${title}**${punct}${rest}`;
  }

  // 4. 匹配破折号前面的条目标题：条目标题 —— 具体说明...
  const dashMatch = text.match(/^([^：:——\-，。！？\n]{2,18})(\s*——\s*|\s*-\s*)(.+)$/);
  if (dashMatch) {
    const title = dashMatch[1].trim();
    const rest = dashMatch[3].trim();
    // 同上：标题以 URL 协议名结尾时保持原样，避免损坏链接
    if (
      /^(?:https?|ftp|file|ws|wss)$/i.test(title) ||
      /(?:https?|ftp|file|ws|wss)$/i.test(title)
    ) {
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
}

/**
 * 将普通中文长文本智能转换为结构化优雅的 Markdown
 */
export function convertPlainTextToMarkdown(text: string, options?: ParserOptions): string {
  if (!text || text.trim().length === 0) return '';

  const treatFirstLineAsTitle = options?.treatFirstLineAsTitle ?? false;

  // 1. 统一换行符，并拆分为原始行
  const rawLines = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    // 去除段首无意义的中文全角空格 "　　"
    .replace(/^[　 \t]+/gm, (match) => {
      // 保留可能的代码缩进（4个半角空格以上），但清除全角缩进
      return match.includes('　') ? '' : match;
    })
    .split('\n');

  // 2. 第一阶段：多行块探测与规整（代码块、表格块）
  const blockProcessedLines: string[] = [];
  let i = 0;

  while (i < rawLines.length) {
    const line = rawLines[i];
    const trimmed = line.trim();

    // 2.1 检查是否是纯文本代码块（如连续几行包含代码特征或 JSON 结构）
    const isCodeStart =
      /^(?:const|let|var|function|import|export|class|def|public|private)\s+/.test(trimmed) ||
      /^(?:\{\s*$|\[\s*$)/.test(trimmed) ||
      /^(?:\$|npm|pnpm|yarn|git|docker|curl)\s+/.test(trimmed) ||
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
        // 判断是否仍是代码行特征
        const isStillCode =
          /^(?:const|let|var|function|import|export|class|def|return|if|else|for|while|switch|case|try|catch|finally|console|print)\b/.test(nextTrimmed) ||
          /^[}\]\);,]/.test(nextTrimmed) ||
          /["'][\w\-]+["']\s*:\s*/.test(nextTrimmed) || // JSON 键值对
          /^(?:\$|npm|pnpm|yarn|git|docker|curl)\s+/.test(nextTrimmed) ||
          /^(?:FROM|WHERE|GROUP\s+BY|ORDER\s+BY|LIMIT|JOIN|HAVING)\b/i.test(nextTrimmed) ||
          /^[a-zA-Z0-9_$.]+\(.*\)[;]?$/.test(nextTrimmed) || // 函数调用
          /^\s{2,}\S+/.test(nextLine); // 缩进行

        if (isStillCode) {
          codeLines.push(nextLine);
          j++;
        } else {
          break;
        }
      }

      // 如果代码行数量 >= 2，或者单行包含了完整的 JSON/Shell 指令，封装为代码块
      const joinedCode = codeLines.join('\n').trim();
      if (codeLines.length >= 2 || /^(?:\$|npm|pnpm|yarn|git|docker|curl)\s+/.test(trimmed)) {
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
      let j = i + 1;
      let blankRun = 0;
      while (j < rawLines.length) {
        const nextTrimmed = rawLines[j].trim();
        if (!nextTrimmed) {
          // 允许表格行之间出现单个空行（用户粘贴的表格行间常有空行）；连续两个空行视为表格结束
          blankRun++;
          if (blankRun >= 2) break;
          j++;
          continue;
        }
        blankRun = 0;
        if (nextTrimmed.includes('|') || nextTrimmed.includes('｜')) {
          tableLines.push(rawLines[j]);
          j++;
        } else {
          break;
        }
      }

      // 连续 2 行以上带竖线（忽略行间单个空行），规整为合法 Markdown 表格
      const nonEmptyTableLines = tableLines.filter((l) => l.trim());
      if (nonEmptyTableLines.length >= 2) {
        const normalizedTable: string[] = [];
        let colCount = 0;

        nonEmptyTableLines.forEach((tLine, idx) => {
          // 将全角 ｜ 替换为半角 |
          const replaced = tLine.replace(/｜/g, '|').trim();
          const rawCells = replaced
            .split('|')
            .map((c) => c.trim())
            .filter((c, cellIdx, arr) => {
              // 过滤掉首尾因为 | 切割产生的多余空串
              if ((cellIdx === 0 || cellIdx === arr.length - 1) && c === '') {
                return false;
              }
              return true;
            });

          // 单元格中的图片类型 URL 保持用户输入的 URL 原样显示（不自动转为图片）；仅保留 ▲ 题注的斜体强调
          const cells = rawCells.map((cellText) => {
            const cellTrimmed = cellText.trim();
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
              const divider = `| ${Array(cells.length).fill(':---:').join(' | ')} |`;
              normalizedTable.push(divider);
            }
          }
        });

        blockProcessedLines.push('');
        blockProcessedLines.push(...normalizedTable);
        blockProcessedLines.push('');
        i = j;
        continue;
      }
    }

    // 2.3 检查是否是制表符 (Tab) 或多空格对齐数据表格
    // 连续 2 行以上，每行包含 \t 或 >=2 个连续空格切分的 2~8 列
    const splitBySpaceOrTab = (str: string) => {
      if (str.includes('\t')) {
        return str.split('\t').map((s) => s.trim()).filter(Boolean);
      }
      return str.split(/\s{2,}/).map((s) => s.trim()).filter(Boolean);
    };

    const initialColumns = splitBySpaceOrTab(trimmed);
    const isPotentialSpaceTable =
      initialColumns.length >= 2 &&
      initialColumns.length <= 8 &&
      !trimmed.startsWith('-') &&
      !trimmed.startsWith('*') &&
      !/^[0-9]+[、.]/.test(trimmed) &&
      !/[。！？…]$/.test(trimmed);

    if (isPotentialSpaceTable) {
      const spaceTableLines: string[][] = [initialColumns];
      let j = i + 1;
      let blankRun = 0;

      while (j < rawLines.length) {
        const nextTrimmed = rawLines[j].trim();
        if (!nextTrimmed) {
          // 允许表格行之间出现单个空行（用户粘贴的表格行间常有空行）；连续两个空行视为表格结束
          blankRun++;
          if (blankRun >= 2) break;
          j++;
          continue;
        }
        blankRun = 0;
        const nextCols = splitBySpaceOrTab(nextTrimmed);
        // 如果列数与第一行一致（或相差不超过 1 列）
        if (Math.abs(nextCols.length - initialColumns.length) <= 1 && nextCols.length >= 2) {
          spaceTableLines.push(nextCols);
          j++;
        } else {
          break;
        }
      }

      // 如果连续 2 行以上满足空格/Tab 分割表格特征
      if (spaceTableLines.length >= 2) {
        const maxCols = Math.max(...spaceTableLines.map((r) => r.length));
        const formattedTable: string[] = [];

        spaceTableLines.forEach((row, rIdx) => {
          // 补齐列数
          while (row.length < maxCols) row.push('-');
          formattedTable.push(`| ${row.join(' | ')} |`);
          if (rIdx === 0) {
            formattedTable.push(`| ${Array(maxCols).fill(':---').join(' | ')} |`);
          }
        });

        blockProcessedLines.push('');
        blockProcessedLines.push(...formattedTable);
        blockProcessedLines.push('');
        i = j;
        continue;
      }
    }

    blockProcessedLines.push(line);
    i++;
  }

  // 3. 第二阶段：单行语义分析与转换
  const processedLines: string[] = [];
  let isFirstNonEmpty = true;

  for (let idx = 0; idx < blockProcessedLines.length; idx++) {
    const rawLine = blockProcessedLines[idx];
    const trimmed = rawLine.trim();

    if (!trimmed) {
      processedLines.push('');
      continue;
    }

    // 保留已由第一阶段格式化的代码块或表格行
    if (trimmed.startsWith('```') || trimmed.startsWith('|')) {
      processedLines.push(trimmed);
      continue;
    }

    // 保留显式 Markdown 图片语法（含粘贴截图生成的 Base64 图片）整行原样输出：
    // 不参与条目标题提取与间距改写，避免 data:URL 中的冒号被误拆导致图片损坏
    if (/^!\[[^\]]*\]\(.+\)$/.test(trimmed)) {
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

    // 3.2 识别首行文章大标题 (H1)（受 treatFirstLineAsTitle 开关控制，默认关闭作为详情内容首段）
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

    // 3.3 识别二级标题 (H2)
    // 中文序号：如 "一、背景介绍", "第一章 绪论", "壹、核心问题", "第一部分 系统架构"
    if (
      /^[一二三四五六七八九十百千万]+[、.．\s]+.+$/.test(trimmed) ||
      /^第[一二三四五六七八九十0-9]+[章节篇部卷集讲堂课回期分]+[\s：:].*$/.test(trimmed) ||
      /^(?:前言|背景|概述|结语|总结|写在最后|结语与展望)$/.test(trimmed)
    ) {
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

    // 3.4 识别三级标题 (H3) 与四级标题 (H4)
    // 如 "1.1 架构设计", "1.1.1 缓存机制", "（一）基本假设", "(1) 需求分析"
    if (/^\d+\.\d+\.\d+[\s、.．]*\S+/.test(trimmed)) {
      processedLines.push('');
      processedLines.push(`#### ${trimmed}`);
      processedLines.push('');
      continue;
    }
    if (
      /^[（(][一二三四五六七八九十0-9]+[）)][\s、.．]*\S+/.test(trimmed) ||
      /^\d+\.\d+[\s、.．]*\S+/.test(trimmed)
    ) {
      processedLines.push('');
      processedLines.push(`### ${trimmed}`);
      processedLines.push('');
      continue;
    }

    // 3.5 识别 Q&A 问答与访谈录结构
    const questionMatch = trimmed.match(/^(?:问|Q|Question)[：:]\s*(.+)$/i);
    if (questionMatch) {
      processedLines.push('');
      processedLines.push(`**Q：${questionMatch[1].trim()}**`);
      processedLines.push('');
      continue;
    }
    const answerMatch = trimmed.match(/^(?:答|A|Answer)[：:]\s*(.+)$/i);
    if (answerMatch) {
      processedLines.push('');
      processedLines.push(`> **A**：${answerMatch[1].trim()}`);
      processedLines.push('');
      continue;
    }

    // 3.6 识别导读、编者按、摘要、注意、警告等 Callout 提示框
    const calloutMatch = trimmed.match(
      /^(导读|导言|编者按|摘要|前言|总结|注意|提示|警告|重要|声明|Tips?|Warning|Summary|Note)[：:]\s*(.+)$/i
    );
    if (calloutMatch) {
      const tag = calloutMatch[1];
      const content = calloutMatch[2];
      processedLines.push('');
      processedLines.push(`> **${tag}**：${content}`);
      processedLines.push('');
      continue;
    }

    // 3.7 识别独立注释与旁白说明（注：、※、补充说明）
    const noteMatch = trimmed.match(/^(?:注|注\d+|※|补充说明|附注|PS)[：:]\s*(.+)$/i);
    if (noteMatch) {
      const noteContent = noteMatch[1].trim();
      processedLines.push('');
      processedLines.push(`*※ 注：${noteContent}*`);
      processedLines.push('');
      continue;
    }

    // 3.8 识别独立成行的金句（整行被引号包裹）
    if (/^[“"『「].+[”"』」]$/.test(trimmed) && trimmed.length < 100) {
      processedLines.push('');
      processedLines.push(`> ${trimmed}`);
      processedLines.push('');
      continue;
    }

    // 3.8.5 图片类 URL 不再自动转为图片（配图：URL、[图片] URL、独立图片链接、Base64 均保持用户输入原样）：
    // 纯文本输入遵循「URL 只显示 URL」的排版需求；仅当用户显式写出 Markdown 图片语法 ![alt](url) 时才按图片渲染

    // 3.9 识别图片题注或图表标注：如 "▲ 图1：系统整体架构" 或 "▲ 阶段 1：草图"
    if (
      /^(?:▲\s*|\[)?(?:图|表|Figure|阶段)\s*[\dA-Za-z\-]+[\s：:.-]+([^\]\n]+)(?:\])?$/i.test(trimmed) ||
      /^▲\s*.+$/.test(trimmed)
    ) {
      processedLines.push(`*${trimmed}*`);
      continue;
    }

    // 3.10 识别流程步骤与时间线：如 "步骤一：初始化系统", "2025年：发布2.0"
    const stepMatch = trimmed.match(/^(?:步骤|阶段|Step|Phase)\s*([一二三四五六七八九十0-9]+)[：:、.\s]+(.+)$/i);
    if (stepMatch) {
      const stepName = `步骤 ${stepMatch[1]}`;
      const stepDesc = stepMatch[2].trim();
      processedLines.push('');
      processedLines.push(`- **${stepName}**：${stepDesc}`);
      continue;
    }

    // 3.11 识别无序列表（•, ·, ◆, ★, ■, ▶, -）
    if (/^[•·◆★■▶-]\s*(.+)$/.test(trimmed)) {
      const itemContent = trimmed.replace(/^[•·◆★■▶-]\s*/, '');
      const emphasized = emphasizeItemHeader(itemContent);
      processedLines.push(`- ${emphasized}`);
      continue;
    }

    // 3.12 识别有序列表项（1、, 1. , ①, ⑴）
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

    const numMatch = trimmed.match(/^(\d+)[、.．)）]\s*(.+)$/);
    if (numMatch) {
      const num = numMatch[1];
      const content = numMatch[2];
      const emphasized = emphasizeItemHeader(content);
      processedLines.push(`${num}. ${emphasized}`);
      continue;
    }

    // 3.13 孤立短行（前后空行，无标点，2~18字）识别为小节标题
    const isPrevEmpty = idx > 0 && !blockProcessedLines[idx - 1].trim();
    const isNextEmpty = idx < blockProcessedLines.length - 1 && !blockProcessedLines[idx + 1].trim();
    if (
      isPrevEmpty &&
      isNextEmpty &&
      trimmed.length >= 2 &&
      trimmed.length <= 18 &&
      !/[，。；！？…、“”'’（）()：:]/.test(trimmed) &&
      !trimmed.startsWith('#')
    ) {
      processedLines.push(`### ${trimmed}`);
      continue;
    }

    // 3.14 识别参考文献段落标头
    if (/^(?:参考资料|参考文献|参考链接|References)[：:]?$/i.test(trimmed)) {
      processedLines.push('');
      processedLines.push(`### 🔗 ${trimmed.replace(/[：:]$/, '')}`);
      processedLines.push('');
      continue;
    }

    // 3.14.5 识别参考文献条目形如 [1] 标题: https://... 或 1. 标题: https://...
    const refItemMatch = trimmed.match(/^(?:\[(\d+)\]|(\d+)[.、])\s*(.*)$/);
    if (refItemMatch && /https?:\/\//i.test(trimmed)) {
      const refNum = refItemMatch[1] || refItemMatch[2];
      const rest = refItemMatch[3].trim();
      const formattedRef = formatBareUrls(emphasizeItemHeader(rest));
      processedLines.push(`${refNum}. ${formattedRef}`);
      continue;
    }

    // 3.14.6 如果整行就是纯裸 URL，转为清晰的列表链接
    if (/^https?:\/\/\S+$/i.test(trimmed)) {
      const formattedLink = formatBareUrls(trimmed);
      processedLines.push(`- ${formattedLink}`);
      continue;
    }

    // 3.15 普通正文行：进行条目标题自动强调提取 + 裸链接转换 + 盘古排版间距优化
    const withEmphasize = emphasizeItemHeader(trimmed);
    const withUrls = formatBareUrls(withEmphasize);
    const formattedLine = addPanguSpacing(withUrls);

    processedLines.push(formattedLine);
  }

  // 4. 第三阶段：自然段落呼吸感重构（防止换行被 Markdown 强行挤压合并）
  const finalResult: string[] = [];
  let emptyCounter = 0;

  for (let j = 0; j < processedLines.length; j++) {
    const curLine = processedLines[j];

    if (!curLine) {
      emptyCounter++;
      // 保持最多 1 个空行分隔
      if (emptyCounter === 1 && finalResult.length > 0) {
        finalResult.push('');
      }
    } else {
      emptyCounter = 0;

      // 检查当前行与上一行，如果两者都是普通文本（非列表、非表格、非标题、非引用、非代码），
      // 且上一行以句号、感叹号、问号、省略号结尾，即使没有手动打空行，也智能补足空行，
      // 保证微信文章段落间的纯净呼吸感！
      if (finalResult.length > 0) {
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
          // 上一行是句子结尾
          if (/[。！？…]$/.test(lastLine.trim())) {
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
 * 智能预处理器：根据模式决定是否应用转换
 * @param content 输入内容
 * @param mode 'auto' (自动侦测) | 'plain-text' (强制格式化纯文本) | 'markdown' (原样输出)
 * @param options 纯文本解析选项，如是否识别首句为大标题
 */
export function processContentByMode(
  content: string,
  mode: 'auto' | 'plain-text' | 'markdown' = 'auto',
  options?: ParserOptions
): {
  renderedMarkdown: string;
  detectedFormat: FormatDetectionResult;
  isTransformed: boolean;
} {
  const detected = detectContentFormat(content);

  if (mode === 'markdown') {
    return {
      renderedMarkdown: content,
      detectedFormat: detected,
      isTransformed: false,
    };
  }

  if (mode === 'plain-text') {
    return {
      renderedMarkdown: convertPlainTextToMarkdown(content, options),
      detectedFormat: detected,
      isTransformed: true,
    };
  }

  // 自动模式 (auto)
  if (!detected.isMarkdown) {
    // 纯文本 -> 智能转排版
    return {
      renderedMarkdown: convertPlainTextToMarkdown(content, options),
      detectedFormat: detected,
      isTransformed: true,
    };
  }

  // 已是 Markdown
  return {
    renderedMarkdown: content,
    detectedFormat: detected,
    isTransformed: false,
  };
}
