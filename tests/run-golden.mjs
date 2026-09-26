#!/usr/bin/env node
/**
 * 黄金语料回归测试（Golden Corpus Regression）
 *
 * 用法：
 *   node tests/run-golden.mjs            # 对照快照逐例比较
 *   node tests/run-golden.mjs --update   # 重新生成快照（有意变更行为后使用）
 *
 * 原理：
 *   1. 用 tsc 将 src/lib/smart-parser.ts 编译为 CommonJS
 *   2. 对 tests/golden-cases.json 中的每个输入执行完整管线
 *      repairPastedHtml → convertPlainTextToMarkdown → repairPastedHtml（与线上 auto 模式一致）
 *   3. 与 tests/golden-snapshots/<用例名>.md 快照精确比较
 *
 * 首次运行会生成全部快照作为当前行为的基线。
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const root = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const casesFile = path.join(root, 'tests', 'golden-cases.json');
const snapshotDir = path.join(root, 'tests', 'golden-snapshots');
const buildDir = path.join(root, 'tests', '.parser-build');

const isUpdate = process.argv.includes('--update');

fs.mkdirSync(snapshotDir, { recursive: true });

// 1. 编译转换器（独立文件，无外部依赖，仅路径别名报错可忽略）
execSync(
  `npx tsc src/lib/smart-parser.ts --outDir ${buildDir} --module commonjs --target es2020 --skipLibCheck --noEmit false`,
  { cwd: root, stdio: 'pipe' }
);

// 2. 加载转换器
const parserPath = path.join(buildDir, 'smart-parser.js');
const { createRequire } = await import('node:module');
const require = createRequire(import.meta.url);
const sp = require(parserPath);

const pipeline = (input) =>
  sp.repairPastedHtml(sp.convertPlainTextToMarkdown(sp.repairPastedHtml(input)));

// 3. 逐例比较
const cases = JSON.parse(fs.readFileSync(casesFile, 'utf8')).cases;
let pass = 0;
let fail = 0;
const failures = [];

for (const c of cases) {
  const actual = pipeline(c.input);
  const snapFile = path.join(snapshotDir, `${c.name}.md`);

  if (isUpdate || !fs.existsSync(snapFile)) {
    fs.writeFileSync(snapFile, actual);
    console.log(`📸 基线生成 ${c.name}`);
    pass++;
    continue;
  }

  const expected = fs.readFileSync(snapFile, 'utf8');
  if (actual === expected) {
    pass++;
    console.log(`✅ ${c.name}`);
  } else {
    fail++;
    const expLines = expected.split('\n');
    const actLines = actual.split('\n');
    const diffs = [];
    for (let i = 0; i < Math.max(expLines.length, actLines.length); i++) {
      if (expLines[i] !== actLines[i]) {
        diffs.push(`    行${i + 1}: 期望 ${JSON.stringify((expLines[i] || '').slice(0, 60))}\n          实际 ${JSON.stringify((actLines[i] || '').slice(0, 60))}`);
      }
    }
    console.log(`❌ ${c.name}`);
    failures.push({ name: c.name, diff: diffs.slice(0, 6).join('\n') });
  }
}

if (failures.length) {
  console.log('\n===== 差异详情 =====');
  for (const f of failures) {
    console.log(`\n◀ ${f.name}\n${f.diff}`);
  }
}

console.log(`\n===== 结果：${pass} 通过 / ${fail} 失败（共 ${cases.length} 例）=====`);
process.exit(fail > 0 ? 1 : 0);
