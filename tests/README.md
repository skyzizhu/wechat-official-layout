# 黄金语料回归测试

保护纯文本智能转换引擎的行为不回归。

## 用法

```bash
npm run test:golden            # 对照快照逐例比较（CI/改动后必跑）
npm run test:golden:update     # 有意变更行为后重新生成快照
```

## 机制

- `golden-cases.json`：测试输入集（纯文本文章 + 边界对抗用例）
- `golden-snapshots/`：每例的期望输出快照（首次运行自动生成）
- 运行器：用 tsc 编译 `src/lib/smart-parser.ts` → 执行与线上一致的完整管线
  （`repairPastedHtml → convertPlainTextToMarkdown → repairPastedHtml`，即 auto 模式）→ 逐例精确比较

## 规则

1. 修改转换引擎前先跑一遍确认全绿；
2. 改完后若快照有差异：**预期改进** → `--update` 刷新快照并在提交说明中写明；**非预期差异** → 修复代码；
3. 新增格式能力时，在 `golden-cases.json` 中补充对应测试输入。
