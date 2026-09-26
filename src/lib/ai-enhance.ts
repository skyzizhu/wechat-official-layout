/**
 * 第三阶段：AI 增强识别
 * 通过 OpenAI 兼容接口（/chat/completions）将纯文本直接排版为公众号适用的 Markdown。
 * 可配置任意兼容端点（官方 OpenAI、Azure、本地 vLLM、各类中转服务），失败时由调用方回退到启发式结果。
 */

export interface AiSettings {
  /** OpenAI 兼容接口地址（如 https://api.openai.com/v1/chat/completions） */
  endpoint: string;
  /** API Key */
  apiKey: string;
  /** 模型名（如 gpt-4o-mini、deepseek-chat 等） */
  model: string;
}

export const AI_SETTINGS_KEY = 'radiant_ai_settings';

/**
 * 端点归一化：支持直接填 Base URL（如 https://agentrouter.org/v1），
 * 自动补全 /chat/completions；已填完整地址则原样使用
 */
export function normalizeEndpoint(endpoint: string): string {
  const trimmed = endpoint.trim().replace(/\/+$/, '');
  if (/\/chat\/completions$/.test(trimmed)) return trimmed;
  return `${trimmed}/chat/completions`;
}

export function loadAiSettings(): AiSettings {
  try {
    const raw = localStorage.getItem(AI_SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (typeof parsed.endpoint === 'string') return parsed as AiSettings;
    }
  } catch {}
  return { endpoint: '', apiKey: '', model: 'gpt-4o-mini' };
}

export function saveAiSettings(settings: AiSettings) {
  localStorage.setItem(AI_SETTINGS_KEY, JSON.stringify(settings));
}

/**
 * 系统提示词：约束 AI 按本系统的排版约定输出 Markdown
 */
const SYSTEM_PROMPT = `你是微信公众号排版助手。将用户给的纯文本文章转换为排版用 Markdown，严格遵守：
1. 文章第一行标题用 # ；一级章节（一、二、三 / 第一章 / 1、孤立编号）用 ##；小节（（一）/1.1/A.）用 ###；（1）/1.1.1 用 ####。
2. 并列的多行编号（1、2、3 或 ①、•、-）保持为有序/无序列表，不要升为标题。
3. 多空格/制表符/管道符对齐的多行数据转换为 GFM 表格（含 | --- | 分隔行）；孤立的说明性短行保持正文。
4. 代码片段用三个反引号围栏包裹并标注语言；"问：/答：" 转为 **Q：…** 与 > **A**：…；"注意：/提示：" 转为 > **注意**：… 提示块。
5. 独立成行的引号金句转为 > 引用；"配图：URL" 或独立图片 URL 转为 ![配图](URL)；紧随图片后的 ▲ 短句转为 *▲ 题注*。
6. 参考文献区（参考来源/References 等）下的编号条目保持编号列表，URL 用 Markdown 链接。
7. 不要添加原文没有的内容，不要改写句子，不要使用 !important 或行内 HTML；只输出 Markdown 本身，不要解释。
8. 情感类散文的点题句识别：独立成段的短句（8~48 字、以句号/感叹号/引号收尾、逗号不超过 2 个、非首行）视为金句，
   用 <p data-role="golden-line">原句</p> 包裹（每篇挑 3~5 处最点题的即可，不要每段都包）。
9. 完整性红线：这是排版任务而非缩写任务——必须逐字保留原文的全部段落与内容，一个字都不能删减或概括；
   输出长度必须与输入长度相当。`;

export async function enhanceWithAi(text: string, settings: AiSettings): Promise<string> {
  if (!text.trim()) throw new Error('内容为空');
  if (!settings.endpoint || !settings.apiKey) throw new Error('AI 接口未配置');

  const res = await fetch(normalizeEndpoint(settings.endpoint), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${settings.apiKey}`,
    },
    body: JSON.stringify({
      model: settings.model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: text },
      ],
      temperature: 0.2,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`AI 接口返回 ${res.status}：${detail.slice(0, 120)}`);
  }

  const data = await res.json();
  let content: string = data?.choices?.[0]?.message?.content ?? '';
  // 剥离模型可能自行包裹的 ``` 围栏
  content = content.replace(/^```(?:markdown|md)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  if (!content.trim()) throw new Error('AI 返回内容为空');
  return content;
}
