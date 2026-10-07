"use strict";
/**
 * Markdown → 纯文本降级转换（双副本模型的「纯文本」侧）
 *
 * 产品模型：左侧编辑器永远展示纯文本（用户编辑面），内部另持一份
 * 「排版用 markdown」副本（转换源，保留加粗/标题层级等完整语义）。
 * 用户粘贴 Markdown 时，编辑器展示的是本模块降级出的纯文本；
 * 用户一旦编辑，排版副本失效，预览改由智能引擎从纯文本重新推导。
 *
 * 降级原则——只溶解「可安全再识别或可接受丢失」的语法，其余原样保留：
 * - 溶解：标题 # 标记、加粗 **x** 与 __x__、行内代码 `x`、删除线 ~~x~~、
 *   行内链接 [文字](url) → 文字（url）、常见转义符
 * - 保留：代码围栏（含语言标记）、表格管道行、列表/任务清单标记、
 *   引用 > 前缀、分割线、图片 ![alt](src)、题注斜体行 *▲ x*
 *   （这些在纯文本中可读，且能被智能引擎稳定重新识别）
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.stripMarkdownToPlainText = stripMarkdownToPlainText;
/** 单行行内语法溶解（不含围栏/结构判断） */
function stripInlineSyntax(line) {
    let out = line;
    // 行内链接 [文字](url) → 文字（url)；(?<!!) 跳过图片 ![alt](src)
    out = out.replace(/(?<!!)\[([^\]\n]+)\]\(([^)\n]+)\)/g, '$1（$2）');
    // 加粗 **x**（允许内部含单个 *，边界不能是空白）
    out = out.replace(/\*\*(?=\S)([\s\S]*?\S)\*\*/g, '$1');
    // 加粗 __x__：前后不能是单词字符，避免误伤 __init__ 这类双下划线标识符
    out = out.replace(/(?<![\w])__(?=\S)([\s\S]*?\S)__(?!\w)/g, '$1');
    // 删除线 ~~x~~
    out = out.replace(/~~(?=\S)([\s\S]*?\S)~~/g, '$1');
    // 行内代码 `x`
    out = out.replace(/`([^`\n]+)`/g, '$1');
    // 常见转义符还原：\* \_ \# \[ \] \( \) \` \~ \- \> \\ 等
    out = out.replace(/\\([\\`*_{}\[\]()#+\-.!>~|])/g, '$1');
    return out;
}
/** 剥离行首标题标记：'## 一、背景' → '一、背景'；'#标题'（中文紧贴）也视为标题 */
function stripHeadingMarker(line) {
    // 标准写法：#{1,6} + 空白；兼容结尾闭合标记 '## 标题 ##'
    const spaced = line.match(/^ {0,3}#{1,6}[ \t]+(.*?)(?:[ \t]+#{1,6})?[ \t]*$/);
    if (spaced)
        return spaced[1];
    // 中文习惯：# 直接跟 CJK 字符（'#标题'）。# 后跟数字/字母不动，避免误伤 '#1 话题' 式内容
    const cjk = line.match(/^ {0,3}#{1,6}(?=[\u4e00-\u9fff])(.*)$/);
    if (cjk)
        return cjk[1];
    return line;
}
/** 分割线行：***、---、___（三个以上，允许空格），原样保留 */
function isHorizontalRule(line) {
    return /^ {0,3}(?:(?:\*[ \t]*){3,}|(?:-[ \t]*){3,}|(?:_[ \t]*){3,})$/.test(line);
}
/**
 * 将 Markdown 源码降级为可读、可编辑的纯文本。
 * 围栏代码块内部的任何内容都不做处理；题注斜体行（*▲ x*）保留星号，
 * 因为编辑器图片块依赖该约定识别题注。
 */
function stripMarkdownToPlainText(md) {
    const lines = md.split('\n');
    const out = [];
    let fence = null;
    for (const line of lines) {
        // 围栏状态机：``` 或 ~~~（≥3 个）开合；围栏内一律原样保留
        const fenceOpen = line.match(/^ {0,3}(`{3,}|~{3,})/);
        if (fenceOpen) {
            const char = fenceOpen[1][0];
            const len = fenceOpen[1].length;
            if (!fence) {
                fence = { char, len };
            }
            else if (char === fence.char && len >= fence.len) {
                fence = null;
            }
            out.push(line);
            continue;
        }
        if (fence) {
            out.push(line);
            continue;
        }
        // 题注斜体行（编辑器图片块约定）：原样保留
        if (/^\s*\*▲?\s*[^*]+\*\s*$/.test(line)) {
            out.push(line);
            continue;
        }
        // 分割线：原样保留（智能引擎会转为样式分割线）
        if (isHorizontalRule(line)) {
            out.push(line);
            continue;
        }
        // 提取引用前缀（可多层 '> > '），保留前缀、溶解余下内容
        let prefix = '';
        let rest = line;
        let m;
        while ((m = rest.match(/^(\s*>\s?)(.*)$/))) {
            prefix += m[1];
            rest = m[2];
        }
        if (prefix) {
            rest = stripHeadingMarker(rest);
        }
        else {
            rest = stripHeadingMarker(rest);
        }
        out.push(prefix + stripInlineSyntax(rest));
    }
    return out.join('\n');
}
