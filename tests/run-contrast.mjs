#!/usr/bin/env node
/**
 * 可读性回归（Contrast Test）：全 16 主题 × 全文字组件，
 * 在微信产物 DOM 上计算每处文字与其实际堆叠背景的 WCAG 对比度（阈值 4.5:1）。
 * 用法：node tests/run-contrast.mjs
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
const { allThemes } = require(path.join(process.cwd(), 'tests/.wechat-build/themes/index.js'));

function parseColor(str) {
  if (!str) return null;
  str = str.trim();
  let m = str.match(/^#([0-9a-f]{6})$/i);
  if (m) return [parseInt(m[1].slice(0, 2), 16), parseInt(m[1].slice(2, 4), 16), parseInt(m[1].slice(4, 6), 16)];
  m = str.match(/^#([0-9a-f]{3})$/i);
  if (m) return m[1].split('').map((c) => parseInt(c + c, 16));
  m = str.match(/rgba?\(([^)]+)\)/);
  if (m) {
    const parts = m[1].split(',').map((s) => parseFloat(s));
    const a = parts[3] === undefined ? 1 : parts[3];
    return [parts[0], parts[1], parts[2], a];
  }
  return null;
}
function blend(fg, bg) {
  const a = fg[3] === undefined ? 1 : fg[3];
  return [
    Math.round(fg[0] * a + bg[0] * (1 - a)),
    Math.round(fg[1] * a + bg[1] * (1 - a)),
    Math.round(fg[2] * a + bg[2] * (1 - a)),
  ];
}
function luminance([r, g, b]) {
  const f = (v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function contrast(c1, c2) {
  const l1 = luminance(c1);
  const l2 = luminance(c2);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}
/** 解析 style 中的 background-color / background */
function bgOf(styleStr) {
  if (!styleStr) return null;
  let m = styleStr.match(/background-color:\s*([^;]+);?/);
  if (m) return parseColor(m[1]);
  m = styleStr.match(/background:\s*([^;]+);?/);
  if (m) return parseColor(m[1]);
  return null;
}
function colorOf(styleStr) {
  if (!styleStr) return null;
  const m = styleStr.match(/(?:^|;)\s*color:\s*([^;]+);?/);
  return m ? parseColor(m[1]) : null;
}

const doc = `<div id="a">
  <h1>一级标题文字</h1>
  <h2><span>二级标题装饰文字</span></h2>
  <h3>三级小标题文字</h3>
  <p>正文段落文字，验证可读性与对比度。</p>
  <blockquote><p>引用块中的文字内容。</p></blockquote>
  <ul><li>列表项文字样例</li><li>第二项文字样例</li></ul>
  <p>这是一段<code>行内代码</code>与<strong>加粗文字</strong>。</p>
  <p data-role="note">备注文字说明内容。</p>
  <p data-role="center">居中的一句话。</p>
  <p data-role="golden-line">金句样例文字内容。</p>
</div>`;

let totalProblems = 0;
for (const theme of allThemes) {
  document.body.innerHTML = doc;
  const article = document.getElementById('a');
  const html = serializeToWeChatRichText(article, theme, undefined);
  const dom2 = new JSDOM(html);
  const outer = dom2.window.document.querySelector('[data-role="outer"]');
  // 主题级底色（背景层层向后合成）
  const outerBg = bgOf(outer.getAttribute('style')) || [255, 255, 255, 1];
  const problems = [];
  const walk = (el, bgStack) => {
    const style = el.getAttribute && el.getAttribute('style');
    const ownBg = bgOf(style || '');
    const stack = ownBg ? [...bgStack, ownBg] : bgStack;
    const isTextEl = el.children && el.children.length === 0 && (el.textContent || '').trim().length > 2;
    if (isTextEl) {
      let fg = colorOf(style || '') || colorOf(el.parentElement.getAttribute('style') || '');
      for (let up = el.parentElement; up && !fg; up = up.parentElement) {
        fg = colorOf(up.getAttribute && up.getAttribute('style') || '');
      }
      if (fg) {
        // 从最内层背景向外合成直到不透明
        let bg = null;
        for (let i = stack.length - 1; i >= 0; i--) {
          const layer = stack[i];
          bg = bg === null ? layer : (layer[3] === undefined || layer[3] >= 1 ? layer : blend(layer, bg));
          if (layer[3] === undefined || layer[3] >= 1) break;
        }
        if (bg === null) bg = [255, 255, 255];
        if (bg[3] !== undefined && bg[3] < 1) bg = blend(bg, [255, 255, 255]);
        const ratio = contrast(fg.slice(0, 3), bg.slice(0, 3));
        if (ratio < 4.5) {
          problems.push(`${el.tagName}「${(el.textContent || '').trim().slice(0, 10)}」 ${ratio.toFixed(2)}:1 (fg=${colorOf(style || '')?.join(',') || 'inherit'} bg≈${bg.slice(0, 3).join(',')})`);
        }
      }
    }
    Array.from(el.children || []).forEach((c) => walk(c, stack));
  };
  walk(outer, [outerBg]);

  if (problems.length) {
    totalProblems += problems.length;
    console.log(`❌ ${theme.name} (${theme.id})`);
    problems.forEach((p) => console.log(`   · ${p}`));
  } else {
    console.log(`✅ ${theme.name}`);
  }
}
console.log(`\n===== 可读性审计：${totalProblems} 处对比度不足 =====`);
process.exit(totalProblems ? 1 : 0);
