#!/usr/bin/env node
/**
 * 双副本模型校验（Dual-Copy Model Test）
 *
 * 用法：node tests/run-dual.mjs
 *
 * 校验「编辑器纯文本副本 + 排版用 markdown 副本」模型的三条生命线：
 *  1. 降级：stripMarkdownToPlainText 溶解标题/加粗/行内代码/链接标记，
 *     同时原样保留表格、围栏、列表、任务、引用、图片与题注
 *  2. 往返：降级后的纯文本再次过智能引擎，结构意图（表格/清单/任务/引用/代码）全部还原
 *  3. 保真：未编辑时预览走「排版用 markdown」副本，加粗等行内语义不因降级丢失
 */
import { execSync } from 'node:child_process';
import path from 'node:path';
import url from 'node:url';

const root = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const buildDir = path.join(root, 'tests', '.dual-build');

execSync(
  `npx tsc src/lib/markdown-plain.ts src/lib/smart-parser.ts --outDir ${buildDir} --module commonjs --target es2020 --skipLibCheck --noEmit false`,
  { cwd: root, stdio: 'pipe' }
);
const { createRequire } = await import('node:module');
const require = createRequire(import.meta.url);
const { stripMarkdownToPlainText } = require(path.join(buildDir, 'markdown-plain.js'));
const { processContentByMode } = require(path.join(buildDir, 'smart-parser.js'));

let pass = 0;
let failCount = 0;
function test(name, fn) {
  try {
    const problems = fn() || [];
    if (problems.length === 0) {
      pass++;
      console.log('PASS ' + name);
    } else {
      failCount++;
      console.log('FAIL ' + name);
      problems.forEach((p) => console.log('  ⚠️ ' + p));
    }
  } catch (e) {
    failCount++;
    console.log('FAIL ' + name + ' 异常: ' + e.message);
  }
}
const has = (md, s) => md.includes(s);

// ============ 1. 降级溶解 ============
const sample = [
  '# 项目复盘报告',
  '',
  '## 一、背景说明',
  '',
  '本季度**执行效率**显著提升，详见 `报表系统`，~~旧口径~~已弃用。',
  '',
  '- [x] 需求评审完成',
  '- [ ] 性能压测待执行',
  '',
  '| 指标 | 目标 |',
  '| :--- | :--- |',
  '| 交付周期 | 14天 |',
  '',
  '```typescript',
  '# 这是代码注释不是标题',
  'const a = **not-bold**;',
  '```',
  '',
  '> 排版是对读者时间的基本尊重。',
  '',
  '![截图](img:token123)',
  '',
  '*▲ 图 1：季度看板*',
  '',
  '参考 [微信规范](https://developers.weixin.qq.com/spec) 与 [文本][1]。',
].join('\n');

test('标题标记溶解（含闭合 #）', () => {
  const plain = stripMarkdownToPlainText(sample);
  const p = [];
  if (!plain.split('\n').includes('项目复盘报告')) p.push('H1 标记未溶解');
  if (!plain.split('\n').includes('一、背景说明')) p.push('H2 标记未溶解');
  // 残留检查需先剔除围栏代码块（围栏内的 # 注释是合法内容）
  const kept = [];
  let inFence = false;
  for (const l of plain.split('\n')) {
    if (/^ {0,3}(`{3,}|~{3,})/.test(l)) {
      inFence = !inFence;
      continue;
    }
    if (!inFence) kept.push(l);
  }
  if (/^ {0,3}#{1,6}[ \t]/m.test(kept.join('\n'))) p.push('围栏外仍残留标题标记');
  return p;
});

test('行内语义标记溶解', () => {
  const plain = stripMarkdownToPlainText(sample);
  const p = [];
  if (has(plain, '**执行效率**')) p.push('加粗未溶解');
  if (!has(plain, '执行效率')) p.push('加粗内容丢失');
  if (has(plain, '`报表系统`')) p.push('行内代码标记未溶解');
  if (!has(plain, '报表系统')) p.push('行内代码内容丢失');
  if (has(plain, '~~旧口径~~')) p.push('删除线未溶解');
  if (!has(plain, '旧口径')) p.push('删除线内容丢失');
  if (!has(plain, '微信规范（https://developers.weixin.qq.com/spec）')) p.push('链接未转为 文字（url）');
  if (!has(plain, '[文本][1]')) p.push('引用式链接被误改');
  if (!has(plain, '![截图](img:token123)')) p.push('图片语法被误改');
  return p;
});

test('结构性语法保留（表格/围栏/任务/引用/题注）', () => {
  const plain = stripMarkdownToPlainText(sample);
  const p = [];
  if (!has(plain, '| 指标 | 目标 |')) p.push('表格管道行丢失');
  if (!has(plain, '```typescript')) p.push('代码围栏丢失');
  if (!has(plain, '# 这是代码注释不是标题')) p.push('围栏内内容被误溶解');
  if (!has(plain, 'const a = **not-bold**;')) p.push('围栏内星号被误溶解');
  if (!has(plain, '- [x] 需求评审完成')) p.push('任务清单标记丢失');
  if (!has(plain, '> 排版是对读者时间的基本尊重。')) p.push('引用前缀丢失');
  if (!has(plain, '*▲ 图 1：季度看板*')) p.push('题注斜体行被误溶解');
  return p;
});

test('转义符还原', () => {
  const plain = stripMarkdownToPlainText('字面星号 \\*a\\* 与字面井号 \\#tag 保留');
  const p = [];
  if (!has(plain, '字面星号 *a* 与字面井号 #tag 保留')) p.push('转义还原异常: ' + plain);
  return p;
});

// ============ 2. 往返：降级纯文本 → 智能引擎 → 结构还原 ============
test('往返：降级后结构意图全部还原', () => {
  const plain = stripMarkdownToPlainText(sample);
  const result = processContentByMode(plain, 'auto', { treatFirstLineAsTitle: true });
  const md = result.renderedMarkdown;
  const p = [];
  if (!/^# 项目复盘报告/m.test(md)) p.push('标题未还原（降级后的独立行未被引擎识别）');
  if (!has(md, '## 一、背景说明')) p.push('编号章节标题未还原');
  if ((md.match(/^\|/gm) || []).length < 3) p.push('表格未还原');
  if (!has(md, '[x] 需求评审完成')) p.push('任务清单未还原');
  if (!/^> /m.test(md)) p.push('引用未还原');
  if (!has(md, '```typescript')) p.push('代码围栏未还原');
  if (!has(md, '![截图](img:token123)')) p.push('图片未保留');
  if (!has(md, '*▲ 图 1：季度看板*')) p.push('题注未保留');
  return p;
});

// ============ 3. 保真：排版副本保留行内语义 ============
test('保真：未编辑时加粗语义由排版副本承载', () => {
  // 模拟 page.tsx 双副本管线：副本 = 原始 markdown；纯文本 = 降级产物
  const snapshot = { plain: stripMarkdownToPlainText(sample), md: sample };
  const fromCopy = processContentByMode(snapshot.md, 'auto', { treatFirstLineAsTitle: true });
  const fromPlain = processContentByMode(snapshot.plain, 'auto', { treatFirstLineAsTitle: true });
  const p = [];
  if (!/\*\*执行效率\*\*|<strong|font-weight.*bold/i.test(fromCopy.renderedMarkdown)) {
    p.push('排版副本的加粗语义丢失');
  }
  if (!has(fromCopy.renderedMarkdown, '## 一、背景说明')) p.push('排版副本标题层级丢失');
  // 用户编辑后（纯文本分歧）由引擎重新推导，结构仍在
  if (!has(fromPlain.renderedMarkdown, '执行效率')) p.push('编辑后正文内容丢失');
  if ((fromPlain.renderedMarkdown.match(/^\|/gm) || []).length < 3) p.push('编辑后表格丢失');
  return p;
});

// ============ 4. 纯文本不受影响 ============
test('纯文本输入降级为恒等变换', () => {
  const plainText = '季度复盘\n\n一、数据表现\n\n指标    目标\n交付周期  14天\n\n✓ 已完成';
  const out = stripMarkdownToPlainText(plainText);
  return out === plainText ? [] : ['纯文本被误改: ' + out];
});

console.log('\n===== 双副本模型校验: ' + pass + ' 通过 / ' + failCount + ' 失败 =====');
process.exit(failCount === 0 ? 0 : 1);
