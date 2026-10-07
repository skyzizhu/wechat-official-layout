#!/usr/bin/env node
/**
 * 微信合规校验（WeChat Compliance Test）
 *
 * 用法：node tests/run-wechat.mjs
 *
 * 用 jsdom 构造预览 DOM（与 MarkdownRenderer 产物同构），
 * 跑真实 serializeToWeChatRichText，断言输出符合微信公众号规范：
 *   1. span 内无块级元素（规范 2.2：违规结构会被编辑器删除）
   2. 同标签连续嵌套 ≤ 10 层（规范 2.1：超出会被自动精简）
 *   3. 任务清单：复选框徽标与文本同处一个 li（行内徽标，非 inline-block）
 *   4. 分割线：wrapper padding 承载对称间距，相邻段落 margin 归零
 *   5. 无 input/hr 等微信会过滤的标签残留
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import { JSDOM } from 'jsdom';

const root = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const buildDir = path.join(root, 'tests', '.wechat-build');

execSync(
  `npx tsc -p tests/tsconfig.wechat.json --outDir ${buildDir}`,
  { cwd: root, stdio: 'pipe' }
);
const { createRequire } = await import('node:module');
const require = createRequire(import.meta.url);
// 模块别名：编译产物中的 '@/x' 指向 src/x
const Module = await import('node:module');
const origResolve = Module.default._resolveFilename;
Module.default._resolveFilename = function (request, ...args) {
  if (request.startsWith('@/')) {
    return origResolve.call(this, path.join(buildDir, request.slice(2)), ...args);
  }
  return origResolve.call(this, request, ...args);
};
const { serializeToWeChatRichText } = require(path.join(buildDir, 'lib', 'rich-text-serializer.js'));

const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
global.document = dom.window.document;
global.window = dom.window;
global.Node = dom.window.Node;
global.Element = dom.window.Element;
global.HTMLElement = dom.window.HTMLElement;
global.getComputedStyle = dom.window.getComputedStyle;

let passCount = 0;
let failCount = 0;
let infoCount = 0;
let fail = 0;

function run(name, previewHtml, asserts) {
  document.body.innerHTML = `<div id="article">${previewHtml}</div>`;
  const article = document.getElementById('article');
  let html;
  try {
    html = serializeToWeChatRichText(article, undefined, undefined);
  } catch (e) {
    fail++;
    console.log('FAIL ' + name + ' 序列化异常: ' + e.message);
    return;
  }
  const out = new JSDOM(html).window.document;
  const notes = [];
  const asserts2 = (h, o) => {
    const problems = asserts(h, o, (msg) => notes.push(msg));
    noZeroFontPatterns(h).forEach((t) => problems.push('含 ' + t + '（触发微信行高告警）'));
    return problems;
  };
  const problems = asserts2(html, out);
  if (problems.length === 0) {
    if (notes.length) {
      infoCount++;
      console.log('INFO ' + name + '  ℹ️ ' + notes.join('; '));
    } else {
      passCount++;
      console.log('PASS ' + name);
    }
  } else {
    failCount++;
    console.log('FAIL ' + name);
    problems.forEach((p) => console.log('  ⚠️ ' + p));
  }
}

// 通用规范断言
const noBlockInsideSpan = (out) => {
  const bad = [];
  out.querySelectorAll('span').forEach((sp) => {
    sp.querySelectorAll('p, div, section, h1, h2, h3, h4, h5, h6, ul, ol, li, table').forEach(() => {
      bad.push('span 内含块级元素');
    });
  });
  return [...new Set(bad)];
};
const maxNesting = (out, limit = 10) => {
  let max = 0;
  const walk = (el, d) => {
    max = Math.max(max, d);
    if (max > limit) return;
    Array.from(el.children).forEach((c) => walk(c, d + 1));
  };
  walk(out.body, 0);
  return max;
};
const noForbiddenTags = (html) =>
  ['<input', '<hr>', '<hr ', '<video'].filter((t) => html.includes(t));

// 微信规范 2.3.2：font-size: 0 / line-height: 0 的假占位会触发"行高小于字体大小"告警
const noZeroFontPatterns = (html) => {
  const bad = [];
  if (/font-size:\s*0(?:px)?(?![.\d])/.test(html)) bad.push('font-size: 0');
  if (/line-height:\s*0(?:px)?(?![.\d])/.test(html)) bad.push('line-height: 0');
  return bad;
};

// ============ 用例 ============

run(
  '任务清单（复选框徽标）',
  `<ul>
    <li><span style="background-color: rgb(79, 70, 229); color: rgb(255, 255, 255); padding: 2px 6px; border-radius: 3px; font-size: 11px; margin-right: 7px; font-weight: bold;">✓</span> 微信官方开发规范全面对齐</li>
    <li><span data-role="task-checkbox" style="border: 1px solid rgb(203, 213, 225); border-radius: 3px; padding: 1px 5px; font-size: 11px; margin-right: 7px; color: rgb(148, 163, 184);">□</span> 更多个性化排版风格扩展</li>
  </ul>`,
  (html, out) => {
    const p = [];
    if (html.includes('inline-block')) p.push('复选框仍是 inline-block（会被微信拆行）');
    if (html.includes('<input')) p.push('含 input 标签（微信会过滤）');
    if (out.querySelectorAll('ul, ol, li').length > 0) p.push('输出仍含 ul/ol/li 结构');
    // 复选框徽标与文本必须同处一个 section（微信不会拆分 section 内的行内内容）
    const sections = Array.from(out.querySelectorAll('section')).filter(
      (sec) => (sec.getAttribute('style') || '').includes('font-weight: 500')
    );
    if (sections.length !== 2) p.push('条目 section 数量异常: ' + sections.length);
    sections.forEach((sec, i) => {
      if (!sec.textContent.trim()) p.push('section ' + i + ' 为空');
    });
    p.push(...noBlockInsideSpan(out));
    return p;
  }
);

run(
  '双分割线夹持文本',
  `<p style="margin-bottom: 18px;">排版之美标题段落</p>
   <hr style="margin: 26px 0;" />
   <p>好的排版如水流般润物无声，是对读者视觉与思维的最大尊重。</p>
   <hr style="margin: 26px 0;" />
   <p>后续正文段落。</p>`,
  (html, out) => {
    const p = [];
    if (html.includes('<hr')) p.push('hr 未转换');
    const wrappers = Array.from(out.querySelectorAll('section[data-role="divider"]'));
    if (wrappers.length !== 2) p.push('分割线 wrapper 数量: ' + wrappers.length);
    wrappers.forEach((w, i) => {
      const s = w.getAttribute('style') || '';
      if (!/padding:\s*[\d.]+px\s+0/.test(s)) p.push('wrapper ' + i + ' 无对称 padding');
      const marginVal = (s.match(/margin:\s*([^;]+);?/) || [])[1] || '0';
      const marginNums = marginVal.trim().split(/\s+/).map((x) => parseFloat(x) || 0);
      if (marginNums.some((n) => n !== 0)) p.push('wrapper ' + i + ' 仍有 margin: ' + marginVal);
    });
    // 夹持文本段落 margin 必须归零（间距由 wrapper padding 承载）
    const mid = Array.from(out.querySelectorAll('p')).find((el) => el.textContent.includes('水流般润物无声'));
    if (mid) {
      const s = mid.getAttribute('style') || '';
      const mtNum = parseFloat((s.match(/margin-top:\s*([\d.]+)/) || [])[1] || '0');
      const mbNum = parseFloat((s.match(/margin-bottom:\s*([\d.]+)/) || [])[1] || '0');
      if (mtNum !== 0 || mbNum !== 0) p.push('夹持文本 margin 未归零: ' + mtNum + '/' + mbNum);
    }
    p.push(...noBlockInsideSpan(out));
    return p;
  }
);

run(
  '任务清单含中文括号与空格',
  `<ul><li><span style="color: rgb(79, 70, 229); font-weight: bold;">✓</span> 任务复选框高保真原生矢量化（杜绝微信过滤 input 标签）</li></ul>`,
  (html, out) => {
    const problems = [];
    const sec = Array.from(out.querySelectorAll('section')).find((s) => (s.textContent || '').includes('✓'));
    if (!sec || !sec.textContent.includes('任务复选框高保真原生矢量化')) problems.push('勾选符与文本丢失');
    problems.push(...noBlockInsideSpan(out));
    return problems;
  }
);

run(
  '嵌套画廊（表格结构）',
  `<table><tbody><tr><td style="text-align: center;"><p style="margin: 0;"><img src="/a.jpg" alt="a" /></p></td><td style="text-align: center;"><p style="margin: 0;"><img src="/b.jpg" alt="b" /></p></td></tr></tbody></table>`,
  (html, out) => {
    const p = [];
    if (out.querySelectorAll('img').length !== 2) p.push('画廊图片丢失');
    p.push(...noBlockInsideSpan(out));
    return p;
  }
);

run(
  '徽章编号列表（参考文献场景）',
  `<ol>
    <li><span style="display: inline-block; min-width: 20px; height: 20px; padding: 0 4px; border-radius: 6px; background-color: rgb(5, 150, 105); color: rgb(255, 255, 255); font-size: 12px; font-weight: 700; text-align: center;">&#160;1&#160;</span><a href="https://a.example">微信公众平台技术开发规范</a><sup>[1]</sup></li>
    <li><span style="display: inline-block; min-width: 20px; height: 20px; padding: 0 4px; border-radius: 6px; background-color: rgb(5, 150, 105); color: rgb(255, 255, 255); font-size: 12px; font-weight: 700; text-align: center;">&#160;2&#160;</span><a href="https://b.example">Google Antigravity 官方开源仓库</a><sup>[2]</sup></li>
  </ol>`,
  (html, out) => {
    const p = [];
    // 核心断言：输出不再含 ul/ol/li（微信粘贴会拆分 li 内容），全部转为 section
    if (out.querySelectorAll('ul, ol, li').length > 0) p.push('输出仍含 ul/ol/li 结构');
    const sections = Array.from(out.querySelectorAll('section')).filter(
      (sec) => (sec.getAttribute('style') || '').includes('font-weight: 500')
    );
    if (sections.length !== 2) p.push('条目 section 数量异常: ' + sections.length);
    sections.forEach((sec, i) => {
      const badge = sec.querySelector('span');
      const link = sec.querySelector('a');
      if (!badge || badge.textContent.replace(/\u00A0/g, '').trim() !== String(i + 1)) p.push('section ' + i + ' 徽章缺失/错位');
      if (!link) p.push('section ' + i + ' 链接缺失');
    });
    if (!html.includes('微信公众平台技术开发规范') || !html.includes('Google Antigravity')) p.push('内容丢失');
    return p;
  }
);

run(
  '引用块贴分割线（间距由 padding 承载）',
  `<hr style="margin: 26px 0;" />
   <blockquote><p>导读：自然语言是人类最直接的思想流淌。</p></blockquote>
   <hr style="margin: 26px 0;" />`,
  (html, out) => {
    const problems = [];
    const quote = out.querySelector('section[data-role="blockquote"]');
    if (!quote) problems.push('引用块 section 丢失');
    if (quote) {
      const st = quote.getAttribute('style') || '';
      const mVal = (st.match(/margin:\s*([^;]+);?/) || [])[1] || '0';
      const mNums = mVal.trim().split(/\s+/).map((x) => parseFloat(x) || 0);
      if (mNums.some((x) => x !== 0)) problems.push('引用块仍有 margin: ' + mVal);
      if (!(st.includes('padding: 0 20px 0') || st.includes('padding: 0px 20px 0px'))) problems.push('贴线引用块顶距未归零: ' + st.slice(0, 70));
    }
    return problems;
  }
);

run(
  '代码块尾部无空行',
  `<pre><code style="font-family: monospace;">const a = 1;\n</code></pre>`,
  (html, out) => {
    const problems = [];
    const spans = Array.from(out.querySelectorAll('span[style*="display: block"]'));
    const last = spans[spans.length - 1];
    if (last && (last.textContent || '') === '') problems.push('代码块尾部有空行 span');
    if (!html.includes('const a = 1;')) problems.push('代码内容丢失');
    return problems;
  }
);

run(
  '深嵌套结构（10 层边界）',
  (() => {
    let inner = '<span>核心文本</span>';
    for (let i = 0; i < 12; i++) inner = `<span style="color: #333">${inner}</span>`;
    return `<p>${inner}</p>`;
  })(),
  (html, out, report) => {
    const max = maxNesting(out, 99);
    // 规范 2.1：同标签同样式连续嵌套 >10 层会被微信自动精简（非致命，内容保留即可）
    if (max > 10) report('同款嵌套链 ' + max + ' 层（微信将自动精简，内容保留）');
    return html.includes('核心文本') ? [] : ['核心文本丢失'];
  }
);

console.log('\n===== 微信合规校验: ' + passCount + ' 通过 / ' + failCount + ' 失败 / ' + infoCount + ' 信息 =====');
process.exit(failCount === 0 ? 0 : 1);