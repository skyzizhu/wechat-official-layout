#!/usr/bin/env node
/**
 * 复杂场景冒烟测试（10 case）
 *
 * 用法：node tests/run-complex.mjs
 *
 * 覆盖：图文混排、base64 内嵌图、多级编号混合家族、表格对齐、多语言代码块、
 * 问答与金句、参考文献链接、数字边界、Markdown 直通、综合长文。
 * 每个 case 跑 app 同款管线（processContentByMode auto + 首句标题）并做结构断言。
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const root = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const casesDir = path.join(root, 'tests', 'complex-cases');
const buildDir = path.join(root, 'tests', '.parser-build');

execSync(
  `npx tsc src/lib/smart-parser.ts --outDir ${buildDir} --module commonjs --target es2020 --skipLibCheck --noEmit false`,
  { cwd: root, stdio: 'pipe' }
);
const { createRequire } = await import('node:module');
const require = createRequire(import.meta.url);
const { processContentByMode } = require(path.join(buildDir, 'smart-parser.js'));

const cases = fs.readdirSync(casesDir).filter((f) => f.endsWith('.txt')).sort();
let passCount = 0;
const rows = [];

for (const file of cases) {
  const name = file.replace(/\.txt$/, '');
  const content = fs.readFileSync(path.join(casesDir, file), 'utf8');
  const t0 = performance.now();
  let result;
  try {
    result = processContentByMode(content, 'auto', { treatFirstLineAsTitle: true });
  } catch (e) {
    rows.push({ name, ok: false, ms: 0, fails: ['解析抛异常: ' + e.message] });
    continue;
  }
  const ms = Math.round((performance.now() - t0) * 10) / 10;
  const md = result.renderedMarkdown;
  const fails = [];

  const expect = (cond, desc) => { if (!cond) fails.push(desc); };
  const has = (s) => md.includes(s);
  const hasNot = (s) => !md.includes(s);

  switch (name.split('-')[0]) {
    case 'case01':
      expect(has('![雨中的街角书店](/images/sample/sample-1.jpg)'), '本地图片语法丢失');
      expect(has('data-role="photo-card"'), '拍立得 HTML 卡片被破坏');
      expect(has('/images/sample/sample-2.jpg'), '卡片内图片丢失');
      expect(/#{2,3} /.test(md), '章节标题未生成');
      break;
    case 'case02':
      expect((md.match(/data:image\/png;base64,/g) || []).length >= 2, 'base64 图片未保留 2 张');
      expect(has('1. 色值稳定度') || has('1. **色值稳定度'), '密集编号列表未生成');
      expect(hasNot('### 色值'), '列表项被误判为标题');
      break;
    case 'case03':
      expect(has('1. 准备工作') || has('1. **准备工作'), '顶层有序列表未生成');
      expect(has('- **1.1、**') || has('- **1.1**'), '1.1 未成为嵌套子列表');
      expect(has('- **2.2.1、**') || has('- **2.2.1**'), '三级编号未成为更深嵌套');
      expect(has('- **（1）**'), '括号序号未成为列表');
      expect(has('- **A.**'), '字母序号未成为列表');
      expect(hasNot('### 1.1'), '1.1 被误判为标题');
      expect(hasNot('#### （1）'), '（1）被误判为标题');
      break;
    case 'case04':
      expect((md.match(/^\|/gm) || []).length >= 7, '表格行数不足（含表头分隔行）');
      expect(has('**续航得分**'), '单元格加粗丢失');
      expect(has(':---:') || has('---:'), '对齐标记丢失');
      break;
    case 'case05':
      expect(has('```typescript'), 'ts 代码块语言标记丢失');
      expect(has('```json'), 'json 代码块丢失');
      expect(has('```sql'), 'sql 代码块丢失');
      expect(has('const registry'), '代码内容被改写');
      expect(has('`npm run build`'), '行内代码丢失');
      break;
    case 'case06':
      expect(has('**Q：') || has('**Q:'), '问句未转为问答结构');
      expect((md.match(/\*\*A\*\*：/g) || []).length >= 3, '答句数量不足或结构错误');
      expect(has('真正的克制'), '金句候选段落内容丢失');
      break;
    case 'case07':
      expect(has('1. ') && has('https://example.com/cognitive-load'), '参考文献 [1] 未转条目');
      expect(has('https://example.com/perf'), '参考文献 2) 未保留链接');
      expect(has('example.com/docs'), '裸链接丢失');
      expect(hasNot('#### 2)'), '参考文献被误判为标题');
      break;
    case 'case08':
      expect(has('3.5 亿元的资金投入'), '小数开头段落内容丢失');
      expect(hasNot('### 3.5') && hasNot('## 3.5'), '小数开头段落被误判为标题');
      expect(/1\.5\s?倍增长/.test(md), '小数+倍数表述被拆坏');
      expect(hasNot('1. 5倍'), '小数被拆成编号列表');
      expect(has('v2.0.1'), '版本号丢失');
      expect(has('2026 年度计划'), '年份行内容丢失');
      expect(hasNot('2026. 年度计划'), '年份行被误加编号点');
      expect(hasNot('## 2026'), '年份句被误判为标题');
      break;
    case 'case09':
      expect(result.isTransformed === false, 'Markdown 源码未被直通（isTransformed 应为 false）');
      expect(has('- [x] 数据库快照已创建'), '任务列表丢失');
      expect(has('# 迁移指南'), '一级标题丢失');
      expect(has('~~回滚脚本演练~~'), '删除线丢失');
      break;
    case 'case10':
      expect(has('![样张：城市黄昏]'), '综合长文图片丢失');
      expect(has('data-role="photo-card"'), '综合长文 HTML 卡片丢失');
      expect((md.match(/^\|/gm) || []).length >= 5, '综合长文表格丢失');
      expect(has('```json'), '综合长文代码块丢失');
      expect(has('- **1.1、**') || has('- **1.1**'), '综合长文嵌套列表丢失');
      expect(has('example.com/spec'), '综合长文参考文献丢失');
      expect(hasNot('### 3.6') && hasNot('1. 6分'), '小数 3.6 分被误判');
      break;
  }

  if (fails.length === 0) passCount++;
  rows.push({ name, ok: fails.length === 0, ms, fails, outLen: md.length });
}

for (const r of rows) {
  console.log(`${r.ok ? '✅' : '❌'} ${r.name}  (解析 ${r.ms}ms, 输出 ${r.outLen || 0} 字符)`);
  if (!r.ok) r.fails.forEach((f) => console.log(`   ⚠️  ${f}`));
}
console.log(`\n===== 复杂场景：${passCount} 通过 / ${rows.length - passCount} 失败（共 ${rows.length} 例）=====`);
process.exit(passCount === rows.length ? 0 : 1);
