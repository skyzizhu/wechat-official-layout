#!/usr/bin/env node
/**
 * 遗留草稿形态审计（Legacy Draft Audit）
 *
 * 用法：node tests/run-legacy.mjs
 *
 * 把历代 bug / 历史版本可能留下的草稿损坏形态逐一通过编辑器分块往返测试：
 * 带title图片、golden-line包裹、损坏属性、双转义HTML、损坏链接引用、
 * 时间/JSON/年份拆坏、散落画廊、URL括号、实体、photo-card单行等。
 * 全部要求：结构往返稳定、图片零丢失、题注零丢失。
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const root = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const buildDir = path.join(root, 'tests', '.editor-build');

// 从 Editor.tsx 提取分块纯函数（依赖类型声明一起带上）
const editorSrc = fs.readFileSync(path.join(root, 'src/components/Editor.tsx'), 'utf8');
const i1 = editorSrc.indexOf('interface ImageItem');
const i2 = editorSrc.indexOf('function AutoTextarea');
const tsBody = editorSrc.slice(i1, i2) + '\nexport { parseEditorBlocks, serializeEditorBlocks };';
fs.writeFileSync(path.join(buildDir, 'rt-src.ts'), tsBody);
execSync(`npx tsc ${path.join(buildDir, 'rt-src.ts')} --outDir ${buildDir} --module commonjs --target es2020`, { cwd: root, stdio: 'pipe' });
const { createRequire } = await import('node:module');
const require = createRequire(import.meta.url);
const { parseEditorBlocks, serializeEditorBlocks } = require(path.join(buildDir, 'rt-src.js'));

const legacy = [
  ['L1-带title的图片行', '开头\n\n![工作台](/images/sample/sample-5.jpg "清晨的工作台")\n\n结尾'],
  ['L2-golden-line包裹行', '开头\n\n<p data-role="golden-line">这是金句内容</p>\n\n结尾'],
  ['L3-损坏的data-role属性', '<section data — role="photo-card" style="margin: 20px auto;">\n<img src="/images/sample/sample-7.jpg" alt="图" />\n</section>'],
  ['L4-双转义section', '&lt;section data-role=&quot;photo-card&quot;&gt;\n&lt;img src=&quot;/images/sample/sample-7.jpg&quot; /&gt;\n&lt;/section&gt;'],
  ['L5-损坏的链接引用定义', '正文 [规范][spec]。\n\n[spec]: [example.com](https://example.com/spec) "规范文档"'],
  ['L6-时间被拆坏的旧草稿', '- **09**：00 签到入场\n- **09**：30 开场致辞'],
  ['L7-JSON被拆坏的旧草稿', '成功时返回 {"code"**：0, "msg": "ok"} 这样的结构。'],
  ['L8-年份被编号化旧草稿', '2026. 年度计划里，我们设置了三个里程碑。'],
  ['L9-散落画廊3列', '![a](img:1)\n\n| :---: | :---: | :---: |\n\n|  |  |  |\n\n|  |  |  |'],
  ['L10-图片URL含括号', '![图表](https://example.com/a_(1).png)\n\n正文'],
  ['L11-图片URL含空格转义', '![图](/images/sample/my%20photo.jpg)\n\n正文'],
  ['L12-题注带HTML实体', '![a](img:1)\n*▲ AT&amp;T 大厦*'],
  ['L13-连续图片块夹空文本', '![a](img:1)\n\n\n\n![b](img:2)\n\n\n\n![c](img:3)'],
  ['L14-画廊缺题注行', '| ![a](img:1) | ![b](img:2) |\n| :---: | :---: |'],
  ['L15-photo-card单行', '<section data-role="photo-card"><img src="/images/x.jpg" alt="x" /></section>'],
  ['L16-金句+图片+画廊混合', '<p data-role="golden-line">金句</p>\n\n![a](img:1)\n*▲ 题*\n\n| ![b](img:2) | ![c](img:3) |\n| :---: | :---: |\n|  |  |'],
];
let issues = 0;
for (const [name, value] of legacy) {
  try {
    const b1 = parseEditorBlocks(value);
    const s1 = serializeEditorBlocks(b1);
    const b2 = parseEditorBlocks(s1);
    const stable = JSON.stringify(b1) === JSON.stringify(b2);
    const imgsIn = (value.match(/<img\b|!\[/g) || []).length;
    const imgsOut = (s1.match(/<img\b|!\[/g) || []).length;
    const capKept = !value.includes('▲') || s1.includes('▲') || !/题|甲|乙/.test(value);
    if (!stable || imgsIn !== imgsOut || !capKept) {
      issues++;
      console.log('ISSUE ' + name + (stable ? '' : ' | 不稳定') + (imgsIn !== imgsOut ? ' | 图片数变' : '') + (!capKept ? ' | 题注丢失' : ''));
    } else {
      console.log('ok   ' + name);
    }
  } catch (e) {
    issues++;
    console.log('ISSUE ' + name + ' 异常: ' + e.message);
  }
}
console.log('\n===== 遗留形态审计: ' + (legacy.length - issues) + '/' + legacy.length + ' 通过 =====');
process.exit(issues === 0 ? 0 : 1);
