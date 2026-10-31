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
const { processContentByMode } = require(path.join(process.cwd(), 'tests/.wechat-build/lib/smart-parser.js'));
const md = '是撒打阿萨法阿萨法阿萨法阿萨法阿萨法阿萨法阿萨法阿萨法。\n\n第一个坎：赚得虽然多，但花得太吓人了';
const out = processContentByMode(md, 'auto', { treatFirstLineAsTitle: true });
console.log('=== rendered ===');
console.log(out.renderedMarkdown);
