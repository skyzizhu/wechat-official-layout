#!/usr/bin/env node
/**
 * 主题全矩阵回归（Theme Matrix Test）
 *
 * 用法：node tests/run-themes.mjs
 *
 * 对全部 16 款主题逐一序列化同一篇样章（H2 长标题 / H3 / 正文 / 引用 / 列表），
 * 断言微信产物的结构与合规硬项：
 *   - 装饰元素不允许以 inline-block 的 section 承载（微信会归一化为块级导致拆行分离）
 *   - 胶囊族 H2：竖线必须是文字容器自身的 border-left，且文字与竖线同处一个 span
 *   - 居中族 H2：左右细线以 span 承载、文字居中
 *   - 波普/横幅族：特征样式在位
 *   - 全局：无 !important / class / id / 原生 hr·input·video 残留
 */
import { execSync } from 'node:child_process';
import path from 'node:path';
import url from 'node:url';
import { JSDOM } from 'jsdom';

const root = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const buildDir = path.join(root, 'tests', '.wechat-build');

execSync(`npx tsc -p tests/tsconfig.wechat.json --outDir ${buildDir}`, { cwd: root, stdio: 'pipe' });
const { createRequire } = await import('node:module');
const require = createRequire(import.meta.url);
const Module = await import('node:module');
const origResolve = Module.default._resolveFilename;
Module.default._resolveFilename = function (request, ...args) {
  if (request.startsWith('@/')) {
    return origResolve.call(this, path.join(buildDir, request.slice(2)), ...args);
  }
  return origResolve.call(this, request, ...args);
};
const { serializeToWeChatRichText } = require(path.join(buildDir, 'lib', 'rich-text-serializer.js'));
const { allThemes } = require(path.join(buildDir, 'themes', 'index.js'));

const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
global.window = dom.window;
global.document = dom.window.document;
global.DOMParser = dom.window.DOMParser;
global.Node = dom.window.Node;
global.Element = dom.window.Element;
global.HTMLElement = dom.window.HTMLElement;
global.NodeFilter = dom.window.NodeFilter;
global.getComputedStyle = dom.window.getComputedStyle;

const TITLE = '二、枷锁一：搜索思维——它始终把 AI 当让搜索更好的工具，这一行足够长，在公众号编辑器里必然折行到第二行';

// 按预览端（MarkdownRenderer）各装饰分支的真实 DOM 形态构造 H2
function buildH2(theme) {
  const d = theme.h2Decoration;
  if (
    d === 'magazine-centered' || d === 'gallery-line' || d === 'literary-dash'
  ) {
    return `<h2><span style="display: inline-block; vertical-align: middle; width: 36px; height: 1px; background-color: #888; opacity: 0.35; margin-right: 12px;"></span><span>标题文字</span><span style="display: inline-block; vertical-align: middle; width: 36px; height: 1px; background-color: #888; opacity: 0.35; margin-left: 12px;"></span></h2>`;
  }
  if (d === 'pop-box') {
    return `<h2><span style="display: inline-block; background-color: #fde047; padding: 4px 12px;">标题文字</span></h2>`;
  }
  if (d === 'newspaper-banner') {
    return `<h2>标题文字</h2>`;
  }
  // 胶囊族 11 款：新版预览 DOM（竖线 = 文字 span 自身 border-left）
  return `<h2><span style="display: inline-block; vertical-align: middle; font-weight: 700; line-height: 1.75; border-left: 4.5px solid #2563eb; border-radius: 2px; padding-left: 9px; word-break: break-word;">标题文字</span></h2>`;
}

function sampleDoc(theme) {
  return `<div id="article">
    ${buildH2(theme)}
    <h3>子节标题：层级与留白</h3>
    <p>正文段落，包含<strong>加粗强调</strong>与普通文字，验证各主题下的基础排版稳定性。</p>
    <blockquote><p>这是一段引用块，验证左右边距与内边距。</p></blockquote>
    <ul><li>列表项一：第一点</li><li>列表项二：第二点</li></ul>
    <p>结尾段落。</p>
  </div>`;
}

function familyOf(theme) {
  const d = theme.h2Decoration;
  if (['magazine-centered', 'gallery-line', 'literary-dash'].includes(d)) return 'centered';
  if (d === 'pop-box') return 'pop';
  if (d === 'newspaper-banner') return 'banner';
  return 'capsule';
}

let pass = 0;
let fail = 0;
const failures = [];

for (const theme of allThemes) {
  document.body.innerHTML = sampleDoc(theme);
  const article = document.getElementById('article');
  const problems = [];
  let html = '';
  try {
    html = serializeToWeChatRichText(article, theme, undefined);
  } catch (e) {
    problems.push('序列化抛错: ' + e.message);
  }

  if (!html) problems.push('产物为空');
  else {
    if (!html.includes('标题文字')) problems.push('H2 标题文字丢失');
    if (!html.includes('子节标题')) problems.push('H3 丢失');
    if (!html.includes('加粗强调')) problems.push('正文加粗丢失');
    if (!html.includes('列表项一')) problems.push('列表丢失');
    // 全局合规硬项
    if (html.includes('!important')) problems.push('含 !important');
    if (/<[a-z]+[^>]*\s(?:class|id)=/i.test(html)) problems.push('含 class/id 属性');
    if (/<section[^>]*display:\s*inline-block/i.test(html)) problems.push('存在 inline-block 的 section 装饰（微信会归一化为块级）');
    if (/<hr[\s>]|<input|<video/.test(html)) problems.push('含微信会过滤的原生标签残留');

    // 分族结构断言
    const family = familyOf(theme);
    if (family === 'capsule') {
      const m = html.match(/<span[^>]*border-left[^>]*>([^<]*)/);
      if (!m) problems.push('胶囊族：H2 竖线未以文字 span 的 border-left 输出');
      else if (!m[1].includes('标题文字')) problems.push('胶囊族：标题文字与竖线不在同一 span');
      if (/width:\s*4\.5px[^>]*background-color/.test(html)) problems.push('胶囊族：仍存在独立色条元素');
    } else if (family === 'centered') {
      const lineSpans = (html.match(/width:\s*36px/g) || []).length;
      if (lineSpans < 2) problems.push(`居中族：左右细线缺失（找到 ${lineSpans} 条）`);
      if (!/text-align:\s*center/.test(html)) problems.push('居中族：标题未居中');
    } else if (family === 'pop') {
      if (!html.includes('#fde047')) problems.push('波普族：黄色徽章底色丢失');
    } else if (family === 'banner') {
      if (!/border-top/.test(html)) problems.push('横幅族：上下横线丢失');
    }
  }

  if (problems.length) {
    fail++;
    failures.push({ theme: theme.name, id: theme.id, problems });
    console.log(`❌ ${theme.name} (${theme.id})`);
    problems.forEach((p) => console.log(`   - ${p}`));
  } else {
    pass++;
    console.log(`✅ ${theme.name} (${theme.id}) [${familyOf(theme)}]`);
  }
}

console.log(`\n===== 主题矩阵：${pass} 通过 / ${fail} 失败（共 ${allThemes.length} 款）=====`);
process.exit(fail ? 1 : 0);
