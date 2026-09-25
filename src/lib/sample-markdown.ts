/**
 * 旗舰全格式范文库：容纳系统中支持的【全部】排版格式
 * 涵盖：H1~H4标题、双分割线夹持题记、导读/注意提示卡片、加粗荧光高亮、斜体强调、
 * 删除线、行内等宽代码、角标上标、任务清单Checkbox、多级嵌套列表、带冒号条目标题、
 * 复杂全对齐斑马纹表格、图片与居中题注、多语言代码块（TS/JSON/SQL/Bash）、
 * Q&A问答访谈录、注释与旁白、名言金句、外链与文末参考文献清单、分割线与结语。
 */

/**
 * 1. 深度全能旗舰 Markdown 范文（一次性体验并测试所有 16 种不同模板风格与微信后台复制）
 */
export const SAMPLE_MARKDOWN = `# 排版之美：现代数字化长文的视觉与阅读艺术

---

好的排版如水流般润物无声，是对读者视觉与思维的最大尊重。它消除一切浮夸多余的装潢，让真正重要的思想在字里行间静静流淌。

---

> **导读**：自然语言是人类最直接的思想流淌。一套优秀的现代排版系统，应当深度理解文字的呼吸感与视觉节奏，在不同终端与场景下呈现高保真美感。

## 一、重新发现字里行间的秩序与美感

文字排版不仅仅是单纯的视觉装潢，更是**信息传递效率**的核心枢纽。在信息过载的时代，一篇经过考究排版的文章，能够让读者在舒适的呼吸感中，迅速理清逻辑脉络。

我们可以将文字排版的核心表现形式划分为以下维度：

- **字体与情绪**：衬线体的典雅严谨与无衬线体的干练现代，诉说着完全不同的语境。
- **空间与留白**：精确到像素的行间距与外边距，是给读者视线最好的休憩区。
- **高亮与微标**：通过 **荧光笔加粗高亮** 与 *斜体重点强调*，瞬间抓住读者注意力。
- **文本修饰细节**：支持 ~~过时删除线~~ 与 \`inline_code\` 等宽对比标记。

### 1.1 排版工程的核心支撑体系

在设计一套面向公众号与多端分发的排版系统时，需要兼顾以下三个要素：

1. **结构清晰度**：严格遵循层级递进（H1 $\\to$ H2 $\\to$ H3 $\\to$ H4），禁止层级倒置；
2. **样式内联化**：深度遵循《微信公众平台第三方开发规范》，消除一切非法外部样式；
3. **响应式自适应**：在 375px 小屏手机与大屏平板之间，均保持不换行的优雅呼吸感。

#### 1.1.1 关键任务推进清单

- [x] 微信官方开发规范全面对齐（规避 #2.3.2 叠字告警与零乱码）
- [x] 纯 CSS 无侵入标题装饰栏（微胶囊、画廊线、波普硬阴影）
- [x] 斑马纹自适应表格与横向防溢出滑动卡片
- [x] 任务复选框高保真原生矢量化（杜绝微信过滤 input 标签）
- [ ] 更多个性化排版风格扩展与动态配色调优

## 二、数据矩阵与全形态表格

高质量的技术长文与商业分析，离不开精细的数据对比。系统支持全形态表格排版（左对齐、居中、右对齐），自带斑马纹、圆角边框与主色表头：

| 评估维度 | 传统手工排版 | 通用富文本编辑器 | 本系统原生渲染引擎 | 体验提升 |
| :--- | :---: | :---: | :---: | ---: |
| **标题微装饰** | 手工切图贴图 | 仅支持基础字号 | 纯 CSS 智能微胶囊/波普框 | **100% 矢量** |
| **表格兼容性** | 手机端经常挤扁 | 样式丢失变形 | 自动横向丝滑滑动卡片 | **零溢出** |
| **代码高亮** | 无高亮或乱码 | 格式极易错乱 | 深色 Mac 窗口与等宽字体 | **高保真** |
| **外链转脚注** | 手动逐个复制 | 不支持 | 自动生成上标角标与文末清单 | **全自动** |
| **排版耗时** | 45 分钟/篇 | 15 分钟/篇 | 仅需 1 秒一键粘贴 | **效率提升 90%** |

## 三、视觉传达与多形态配图艺术

排版艺术不仅关乎文字的秩序，更离不开考究的多形态视觉配图。系统严格遵循微信公众平台图片开发规范（自适应宽度、防排版坍塌、暗黑模式护城河），并能根据不同主题呈现独一无二的版式美学：

### 3.1 典雅高清单图与居中题注

![极简主义书籍与现代版式设计美学](https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=1200&q=80)

*▲ 图 1：极简主义书籍与现代版式设计的视觉呼吸感*

### 3.2 微信合规双图并列画廊（对比展示）

| ![传统手工印刷工艺](https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=600&q=80) | ![现代数字化排版交互](https://images.unsplash.com/photo-1499750310107-5fef28a66643?auto=format&fit=crop&w=600&q=80) |
| :---: | :---: |
| *▲ 图 2-A：传统手工印刷工艺* | *▲ 图 2-B：现代数字化排版交互* |

> **排版贴士**：微信对 CSS Flex/Grid 极易过滤或导致移动端错位。系统采用微信官方最稳定的无边框自适应双列结构，支持手机端完美并排与独立点击放大换图。

### 3.3 三图流程串联（工作流呈现）

| ![构思草图](https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=500&q=80) | ![视觉编排](https://images.unsplash.com/photo-1542744094-3a31f272c490?auto=format&fit=crop&w=500&q=80) | ![全端发布](https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=500&q=80) |
| :---: | :---: | :---: |
| *▲ 阶段 1：灵感与结构草图* | *▲ 阶段 2：高保真排版设计* | *▲ 阶段 3：多端与公众号分发* |

### 3.4 拍立得留白卡片（Dark Mode 安全型）

<section data-role="photo-card" style="margin: 28px auto; max-width: 90%; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 12px 16px 12px; box-shadow: 0 4px 16px rgba(0,0,0,0.06); text-align: center;">
  <img src="https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&w=1000&q=80" alt="沉浸式阅读与知识空间" style="width: 100%; border-radius: 6px; display: block; margin: 0 auto;" />
  <p style="margin: 12px 0 0 0; font-size: 13px; color: #64748b; font-weight: 500; text-align: center;">▲ 图 3：拍立得衬底卡片，暗黑模式下自带留白护城河</p>
</section>

## 四、代码美学与多语言技术呈现

无论是现代前端、数据分析，还是系统运维，代码块都拥有 Mac 窗口风格、优雅的深色背景与等宽字体：

\`\`\`typescript
interface ArticleTheme {
  readonly id: string;
  readonly name: string;
  readonly typography: 'serif' | 'sans-serif' | 'monospace';
  readonly accentColor: string;
  readonly h2Decoration: 'wechat-badge' | 'magazine-centered' | 'pop-box' | 'academic-bracket';
}

/**
 * 智能编译自然文章为微信合规富文本
 */
export function renderOptimizedArticle(rawText: string, theme: ArticleTheme): string {
  const normalized = detectAndFormat(rawText);
  return compileToWechatHtml(normalized, {
    theme,
    enableFootnotes: true,
  });
}
\`\`\`

配置与接口数据使用 JSON 呈现同样赏心悦目：

\`\`\`json
{
  "project": "radiant-maxwell",
  "version": "2.0.0",
  "engine": "turbopack",
  "wechatSpecCompliant": true,
  "supportedFormats": ["headings", "tables", "code-blocks", "callouts", "task-lists"]
}
\`\`\`

数据库查询 SQL 语句：

\`\`\`sql
SELECT 
    theme_name,
    COUNT(*) as total_articles,
    AVG(word_count) as avg_words
FROM articles
WHERE created_at >= '2026-01-01'
GROUP BY theme_name
ORDER BY total_articles DESC;
\`\`\`

终端构建与部署命令行：

\`\`\`bash
# 启动开发服务器并开启热重载
npm run dev -- --turbo
\`\`\`

## 五、问答访谈、重点提示与名言金句

**问：为什么排版系统需要针对微信公众号做专门适配？**

> **答**：微信公众号编辑器采用 ProseMirror 富文本内核，对外部 CSS 类名、外链脚本以及部分非法行内样式有严格的过滤规则。只有遵循微信官方规范的纯内联高保真序列化，才能保证在后台粘贴时零乱码、零叠字报错。

### 💡 核心注意事项与导读

> **注意**：在将文章复制到微信公众号后台之前，建议通过右上角的字号与主色微调器预览不同配色，确保最佳的阅读效果。

> **提示**：当正文中包含外部 HTTP/HTTPS 链接时，系统会自动开启「外链转脚注」引擎，将拦截链接自动转为文末的清晰角标。

*※ 注：所有智能识别与富文本序列化均在浏览器本地秒级完成，杜绝任何外部数据传输。*

正如现代主义设计巨匠 Dieter Rams 在其设计十诫中所强调的极简原则：

> “好的设计是少，却更好。它让核心的事物更加纯粹与凸显，消除一切浮夸多余的装饰，让真正重要的思想在字里行间静静流淌。”

## 六、参考文献与延伸阅读

1. [微信公众平台技术开发规范](https://developers.weixin.qq.com/doc/service/guide/product/plugin_spec.html)
2. [Google Antigravity 官方开源仓库](https://github.com/google/antigravity)
3. [MDN Web Docs 现代排版指南](https://developer.mozilla.org/zh-CN/docs/Learn_web_development/Core/Text_styling/Fundamentals)

---

让每一篇精心撰写的文字，都拥有值得被久久驻足的版面秩序。
`;

/**
 * 2. 深度全能纯文本范文（以自然语言纯文本呈现同等丰富格式，验证智能语义识别引擎）
 */
export const SAMPLE_PLAIN_TEXT = `排版之美：现代数字化长文的视觉与阅读艺术

-------------------
好的排版如水流般润物无声，是对读者视觉与思维的最大尊重。它消除一切浮夸多余的装潢，让真正重要的思想在字里行间静静流淌。
-------------------

导读：自然语言是人类最直接的思想流淌。创作者无需费心记忆复杂的排版语法，只需专注笔下的思想流淌，智能引擎将自动推断全部版面秩序。

一、重新发现字里行间的秩序与美感
在碎片化信息充斥日常的今天，长文阅读变得前所未有的奢侈。然而，越是喧嚣嘈杂的时代，深度文字的沉淀越显得不可替代。

文字不仅是符号的堆砌，它拥有一种建筑学的美感。当段落有了舒适的自然间距，当标题有了清晰的视觉层级，阅读就不再是一场焦躁的信息扫描，而是一次惬意的精神漫步。

二、高质量排版的四大核心支柱
1、字体的呼吸感：不同的字体拥有不同的心跳频率，严谨的宋体适合深度沉思，利落的无衬线适合快节奏阅读。
2、色彩的克制感：高对比度的黑白亦或是温暖的米黄纸质，决定了读者的专注时长与情绪共鸣。
3、结构的层次感：小节标题与重点标注，宛如旅途中的路标，时刻指引读者思维的方向。
4、留白的节奏感：恰到好处的外边距让版面不显逼仄，给予视线缓冲与喘息的空间。

【全格式智能解析与传统排版对比】
排版维度 ｜ 传统手动排版 ｜ 智能语义识别引擎
标题与层级 ｜ 手动选择字号加粗 ｜ 自动提取大标题与多级章节
列表与强调 ｜ 繁琐加标点着色 ｜ 冒号前重点自动高亮与微标
数据表格 ｜ 需第三方编辑器插表 ｜ 管道符/制表符自动补齐渲染
代码与命令 ｜ 缩进乱码无高亮 ｜ 自动推断语言并呈现深色卡片
外链与注释 ｜ 手动逐一编号记录 ｜ 自动提取生成上标与文末清单

制表符数据对比
阶段    负责人    预计耗时    当前状态
需求梳理    产品组    1天    已完成
算法设计    架构组    2天    已完成
代码集成    研发组    3天    进行中
线上发布    运维组    0.5天    待启动

三、视觉传达与多形态配图展示
排版艺术不仅关乎文字，更离不开考究的多形态视觉配图。智能语义引擎同样支持自然语言下的多种图片形态识别与自动转换：

配图：https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=1200&q=80
▲ 图1：极简主义书籍与现代版式设计的视觉呼吸感

【双图并列对比画廊】
传统手工装订工艺 ｜ 现代数字化排版交互
https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=600&q=80 ｜ https://images.unsplash.com/photo-1499750310107-5fef28a66643?auto=format&fit=crop&w=600&q=80
▲ 图2-A：传统手工装订工艺 ｜ ▲ 图2-B：现代数字化排版交互

提示：对于纯文本输入，无论输入“配图：URL”还是表格中粘贴多张图片链接，引擎都能毫秒级识别并转换为微信官方合规的自适应多图画廊。

图片：https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&w=1000&q=80
▲ 图3：沉浸式阅读与知识空间（自适应当前主题专属质感）

四、技术代码与逻辑呈现
纯文本中的代码段落无需手动输入繁琐的反引号，系统能够自动推断语法结构：

function calculateReadingTime(text) {
  const wordsPerMinute = 300;
  const wordCount = text.trim().length;
  return Math.ceil(wordCount / wordsPerMinute);
}

五、核心特性问答与访谈录
问：为什么排版系统需要针对微信公众号做专门适配？
答：微信公众号编辑器采用 ProseMirror 富文本内核，对外部样式有严格的过滤规则。只有遵循微信官方规范的纯内联高保真序列化，才能保证在后台粘贴时零乱码、零叠字报错。

问：对于表格和代码，纯文本真的不需要打 Markdown 符号吗？
答：是的！无论是制表符对齐的表格、管道符数据，还是多行编程代码，系统都能毫秒级侦测并自动包裹对应的结构。

步骤一：在左侧直接粘贴您的文章纯文本草稿。
步骤二：右侧即时呈现预设风格的专业排版。
步骤三：点击「复制公众号」，直接粘贴至公众平台后台发布。

注意：在将文章复制到微信公众号后台之前，建议通过右上角的字号与主色微调器预览不同配色。

提示：当正文中包含外部链接时，系统会自动开启「外链转脚注」引擎。

注：所有智能识别与富文本序列化均在浏览器本地秒级完成，杜绝任何外部数据传输。

“好的设计是少，却更好。它让核心的事物更加纯粹与凸显。”

六、参考资料：
https://developers.weixin.qq.com/doc/service/guide/product/plugin_spec.html
https://github.com/google/antigravity
https://developer.mozilla.org/zh-CN/docs/Learn_web_development/Core/Text_styling/Fundamentals

-------------------

让每一篇精心撰写的文字，都拥有值得被久久驻足的版面秩序。
`;

/**
 * 3. 预设范文库
 */
export const SAMPLE_PRESETS: Record<string, { title: string; type: 'markdown' | 'plain-text'; content: string }> = {
  'all-round-markdown': {
    title: '全能旗舰 Markdown 范文（全格式集大成）',
    type: 'markdown',
    content: SAMPLE_MARKDOWN,
  },
  'all-round-plain-text': {
    title: '全能旗舰自然纯文本范文（智能语义转换）',
    type: 'plain-text',
    content: SAMPLE_PLAIN_TEXT,
  },
};
