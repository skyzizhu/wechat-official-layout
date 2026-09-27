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
    case 'case11':
      expect(has('A good interface whispers'), '英文段落丢失');
      expect(/1\.\s?(\*\*)?Reduce/.test(md), '中英混排编号列表未生成');
      expect(has('**Part One**') && has('The Problem'), '英文小节标题丢失');
      break;
    case 'case12':
      expect(has('a * b 表示乘法'), '字面星号被转义/吞掉');
      expect(has('variable_name'), '下划线被误转斜体');
      expect(has('# 注释'), '行内井号丢失');
      expect(has('`console.log()`'), '行内代码丢失');
      break;
    case 'case13':
      expect((md.match(/^>/gm) || []).length >= 5, '引用行数量不足');
      expect(has('先定基调'), '引用内清单内容丢失');
      expect(has('阅读完成率提升了三成'), '多段引用内容丢失');
      break;
    case 'case14':
      expect((md.match(/^(?:---|\*\*\*|___)$/gm) || []).length >= 2, '分割线数量不足');
      expect(has('流量红利见顶'), '分割线前段落丢失');
      expect(has('反馈周期从月缩短到周'), '分割线后段落丢失');
      break;
    case 'case15':
      expect(has('１、全角数字序号'), '全角序号内容丢失');
      expect(has('（一）') && has('这一段讲全角括号'), '全角括号序号内容丢失');
      expect(has('这一段讲全角逗号'), '全角括号第二行内容丢失');
      expect(hasNot('### １、'), '全角序号被误判为标题');
      break;
    case 'case16':
      expect(has('这次调查持续了四十天'), '长段落内容丢失');
      expect(has('方法永远服务于人'), '长段落结尾丢失');
      expect(hasNot('## '), '无结构长文不应产生小节标题');
      break;
    case 'case17':
      expect(has('**产品经理**'), '台词说话人未加粗强调');
      expect(has('布鲁克斯定律'), '台词内容丢失');
      expect(has('（全场沉默了三秒）'), '舞台提示丢失');
      break;
    case 'case18':
      expect(has('必带物品'), '星标分组丢失');
      expect(has('护照与身份证复印件'), '圆点条目内容丢失');
      expect(has('- [x] 出发前最后确认'), '对勾条目未转为任务清单');
      expect(has('- [ ] 不要带超过两个箱子'), '叉号条目未转为未完成任务');
      break;
    case 'case19':
      expect((md.match(/^\|/gm) || []).length >= 5, '速查表行数不足');
      expect(has('[官网]'), '表格内链接丢失');
      expect(has('9.9 元/月') || has('9.9元/月'), '小数价格内容丢失');
      expect(hasNot('1. 9.9') && hasNot('### 9.9'), '小数价格被误判');
      break;
    case 'case20':
      expect(has('```yaml'), 'yaml 代码块丢失');
      expect(has('# 这不是标题'), '代码内注释丢失');
      expect(has('### 这更不是标题'), '代码内伪标题未保持字面');
      expect(has('1. 这不是列表项'), '代码内伪列表未保持字面');
      break;
    case 'case21':
      expect(has('[x] 数据库迁移脚本'), '已完成任务丢失');
      expect(has('[ ] 灰度方案评审'), '未完成任务丢失');
      expect(has('三天观察期'), '任务清单后段落丢失');
      break;
    case 'case22':
      expect(has('存在争议[^1]'), '脚注引用语法丢失');
      expect(has('[^1]: 见 Sweller'), '脚注定义丢失');
      expect(has('<sup>[注]</sup>'), '角标标签丢失');
      expect(has('| Cognitive Load |'), '译名表格丢失');
      break;
    case 'case23':
      expect(has('![工作台](/images/sample/sample-5.jpg'), '带标题图片丢失');
      expect(has('[Markdown 指南](https://example.com/guide'), '行内链接丢失');
      expect(has('spec]: https://example.com/spec'), '引用式链接定义丢失');
      break;
    case 'case24':
      expect(/#{1,3} 第一章 绪论/.test(md), '第一章未转为标题');
      expect(/#{1,4} 第二节 研究方法/.test(md), '第二节未转为标题');
      expect(has('1. 数据安全法') || has('1、数据安全法'), '章内编号列表丢失');
      expect(has('已有研究集中在三个方向'), '第二章内容丢失');
      break;
    case 'case25':
      expect(has('那时没有伞，也不觉得狼狈。'), '诗体短行内容丢失');
      expect(hasNot('### 那时没有伞'), '诗体短行被误判为标题');
      expect(hasNot('### 一路踩着水洼'), '诗句被误判为标题');
      expect(has('笑声比雨声还大'), '诗句内容丢失');
      break;
    case 'case26':
      expect(has('E = mc^2'), '质能方程丢失');
      expect(has('π ≈ 3.14159'), '圆周率行丢失');
      expect(has('1 千卡') || has('１千卡'), '单位换算行丢失');
      expect(hasNot('1. 千卡'), '单位换算行被拆成列表');
      expect(hasNot('### π'), '常数行被误判为标题');
      break;
    case 'case27':
      expect(has('<mark>高亮标记</mark>'), 'mark 标签丢失');
      expect(has('H<sub>2</sub>O'), '下标标签丢失');
      expect(has('x<sup>2</sup>'), '上标标签丢失');
      break;
    case 'case28':
      expect(/#{1,3} .*二十、腌制类/.test(md) || has('## 二十、'), '超十中文序号未转为标题');
      expect(has('九是序号不是数量'), '正文说明丢失');
      expect(has('桂花酒酿圆子收尾'), '十二节内容丢失');
      break;
    case 'case29':
      expect(has('138-1234-5678'), '热线号码丢失');
      expect(has('186 8765 4321'), '备用号码丢失');
      expect(has('邮编 100102'), '地址数字丢失');
      expect(hasNot('1. 138'), '号码行被误判为编号');
      expect(/1\.\s?(\*\*)?发票怎么开|1\. 发票/.test(md), '常见问题列表未生成');
      break;
    case 'case30':
      expect(has('listen 80'), '缩进配置内容丢失');
      expect(has('proxy_pass'), '嵌套缩进内容丢失');
      expect(has('不规则空行是粘贴最常见的痕迹'), '说明段落丢失');
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
