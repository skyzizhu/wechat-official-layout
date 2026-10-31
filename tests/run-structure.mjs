#!/usr/bin/env node
/**
 * 结构完整性扫描（Kitchen-sink Structure Test）：
 * 全 16 主题 × 原生/自定义主色两种配色，序列化一份「全要素」文档
 * （标题/正文行内样式全家桶/引用/多级列表/表格/代码块/备注/居中/金句/任务清单/图片/分割线），
 * 检查产物结构健康度：
 *   1. 标签配平（section 开闭数量一致）
 *   2. 无空 style 属性
 *   3. 无同属性重复声明（微信 sanitizer 可能保留首个声明，重复+冲突会让形态悄悄失效）
 *   4. 代码块内不得出现 text-indent（缩进主题不得渗入代码）
 *   5. 语义段落 data-role（note/center/golden-line）不丢失
 *   6. 链接 href 保留、图片 data-w 宽度声明注入
 *   7. 外层容器 color 声明唯一
 *   8. 表格 th/td 保留
 * 用法：node tests/run-structure.mjs
 */
import { execSync } from 'node:child_process';
import path from 'node:path';
import url from 'node:url';
execSync('npx tsc -p tests/tsconfig.wechat.json --outDir tests/.wechat-build', { cwd: process.cwd(), stdio: 'pipe' });
const { createRequire } = await import('node:module');
const require = createRequire(import.meta.url);
const Module = await import('node:module');
const orig = Module.default._resolveFilename;
Module.default._resolveFilename = function (request, ...args) {
  if (request.startsWith('@/')) return orig.call(this, path.join(process.cwd(), 'tests/.wechat-build', request.slice(2)), ...args);
  return orig.call(this, request, ...args);
};
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<body></body>');
global.window = dom.window; global.document = dom.window.document;
global.DOMParser = dom.window.DOMParser; global.Node = dom.window.Node;
global.Element = dom.window.Element; global.HTMLElement = dom.window.HTMLElement;
global.NodeFilter = dom.window.NodeFilter; global.getComputedStyle = dom.window.getComputedStyle;
const { serializeToWeChatRichText } = require(path.join(process.cwd(), 'tests/.wechat-build/lib/rich-text-serializer.js'));
const { allThemes, applyColorToTheme } = require(path.join(process.cwd(), 'tests/.wechat-build/themes/index.js'));
const { PRESET_THEME_COLORS } = require(path.join(process.cwd(), 'tests/.wechat-build/lib/color-harmonics.js'));

const doc = `<div id="a">
  <h1>一级标题</h1>
  <h2><span>二级标题</span></h2>
  <h3>三级小标题</h3>
  <p>正文段落，含<a href="https://example.com">链接</a>、<strong>加粗</strong>、<em>斜体</em>、<u>下划线</u>、<mark>高亮</mark>、<sup>上标</sup>、<sub>下标</sub>与<del>删除线</del>。</p>
  <blockquote><p>引用内容一行。</p></blockquote>
  <ul><li>顶层列表甲</li><li>顶层列表乙<ul><li>嵌套列表子项</li></ul></li></ul>
  <ol><li>有序第一</li><li>有序第二</li></ol>
  <table><thead><tr><th>表头一</th><th>表头二</th></tr></thead><tbody><tr><td>单元格甲</td><td>单元格乙</td></tr></tbody></table>
  <pre><code>function demo() {
  const x = 1;

  return x;
}</code></pre>
  <p data-role="note">备注说明文字。</p>
  <p data-role="center">居中的一句话。</p>
  <p data-role="golden-line">金句样例文字。</p>
  <hr/>
  <p><input type="checkbox" checked/> 已完成任务</p>
  <p><img src="https://example.com/pic.jpg" alt="示例图"/></p>
</div>`;

let totalProblems = 0;
const allWarns = [];
const casesList = [];
for (const t of allThemes) {
  casesList.push([`${t.name}/原生`, t]);
  for (const c of PRESET_THEME_COLORS.filter((x) => x.hex)) {
    casesList.push([`${t.name}/${c.name}`, applyColorToTheme(t, c.hex)]);
  }
}

for (const [label, theme] of casesList) {
  document.body.innerHTML = doc;
  const html = serializeToWeChatRichText(document.getElementById('a'), theme, undefined);
  const doc2 = new JSDOM(html).window.document;
  const problems = [];
  const warns = [];

  // 1. 标签配平
  const openSec = (html.match(/<section\b/g) || []).length;
  const closeSec = (html.match(/<\/section>/g) || []).length;
  if (openSec !== closeSec) problems.push(`section 不配平 ${openSec}/${closeSec}`);

  // 2. 空 style
  if (/style=""[\s>]/.test(html)) problems.push('存在空 style 属性');

  // 3. 同一 style 内重复 CSS 属性
  doc2.querySelectorAll('[style]').forEach((el) => {
    const style = el.getAttribute('style') || '';
    const keys = (style.match(/(^|;)\s*([a-z-]+)\s*:/g) || []).map((s) => s.replace(/[^a-z-]/g, ''));
    const dup = keys.filter((k, i) => keys.indexOf(k) !== i);
    if (dup.length) {
      problems.push(`${el.tagName} style 重复属性: ${[...new Set(dup)].join(',')}「${(el.textContent || '').trim().slice(0, 8)}」`);
    }
  });

  // 4. 缩进不得渗入代码块
  doc2.querySelectorAll('[data-role="code-block"], pre, code').forEach((el) => {
    if (/text-indent/.test(el.getAttribute('style') || '')) problems.push('代码块内出现 text-indent');
  });

  // 5. 语义段落 data-role 不丢失
  ['note', 'center', 'golden-line'].forEach((role) => {
    if (!doc2.querySelector(`[data-role="${role}"]`)) problems.push(`data-role=${role} 丢失`);
  });

  // 6. 链接 href 保留、图片 data-w 注入
  const a = doc2.querySelector('a');
  if (!a || a.getAttribute('href') !== 'https://example.com') problems.push('链接 href 丢失');
  const img = doc2.querySelector('img');
  if (!img || !img.hasAttribute('data-w')) problems.push('图片缺 data-w');

  // 7. 外层容器 color 声明唯一（background-color 等复合属性不计）
  const outerStyle = doc2.querySelector('[data-role="outer"]')?.getAttribute('style') || '';
  if ((outerStyle.match(/(^|;)\s*color:/g) || []).length !== 1) problems.push('外层 color 声明数异常');

  // 8. 表格单元格保留
  if (!doc2.querySelector('th') || !doc2.querySelector('td')) problems.push('表格单元格丢失');

  // 9. 微信机制审计：section 不携带 text-indent——微信粘贴对块级 section 的
  //    text-indent 不可靠、且会剥掉子元素的零值继承防护（text-indent: 0），
  //    缩进必须由块级 p（正文已验证）或行首 inline-block 占位 span（徽章同款）承载
  doc2.querySelectorAll('section').forEach((el) => {
    if (/text-indent/.test(el.getAttribute('style') || '')) {
      problems.push(`section 携带 text-indent（微信粘贴不可靠）「${(el.textContent || '').trim().slice(0, 8)}」`);
    }
  });

  // 警示级（不计入失败）：微信会剥行内元素 padding、inline-block 固定宽高——
  // 存量输出中允许存在，但新增依赖前需确认劣化表现可接受
  doc2.querySelectorAll('[style]').forEach((el) => {
    const st = el.getAttribute('style') || '';
    if (/display:\s*inline;/.test(st) && /padding:\s*(?!0px? 0px?)[^;]+/.test(st)) {
      warns.push(`${el.tagName} 行内元素带 padding（微信会剥）「${(el.textContent || '').trim().slice(0, 8)}」`);
    }
    if (/display:\s*inline-block;/.test(st) && /(width|height):\s*\d/.test(st)) {
      warns.push(`${el.tagName} inline-block 固定宽高（微信会剥）「${(el.textContent || '').trim().slice(0, 8)}」`);
    }
  });

  if (problems.length) {
    totalProblems += problems.length;
    console.log(`❌ ${label}`);
    problems.forEach((p) => console.log(`   · ${p}`));
  }
  warns.forEach((w) => allWarns.push(`${label}: ${w}`));
}
if (allWarns.length) {
  console.log(`\n⚠️ 警示（微信剥除类样式，存量可接受，新增依赖前需确认）：`);
  [...new Set(allWarns)].slice(0, 10).forEach((w) => console.log(`   · ${w}`));
  if (allWarns.length > 10) console.log(`   · …共 ${allWarns.length} 条`);
}
console.log(`\n===== 结构扫描：${allThemes.length} 主题 × ${casesList.length / allThemes.length} 组配色，${totalProblems} 处异常 =====`);
process.exit(totalProblems ? 1 : 0);
