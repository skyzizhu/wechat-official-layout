/**
 * 图片令牌存储服务
 *
 * 解决两个问题：
 * 1. 可读性：粘贴/拖入的图片以 base64 存进正文时，编辑框会被几十万字符的源码淹没；
 *    改为正文只保留短令牌（img:xxxx），图片本体存放在独立的 localStorage 存储。
 * 2. 性能：全篇正则扫描不再反复处理巨型 dataURL 字符串。
 *
 * 预览与复制不受影响：预览渲染时把令牌解析回 dataURL，序列化器克隆的是
 * 预览 DOM，复制产物里天然就是完整图片。localStorage 写满（约 5MB）时
 * 返回 persisted=false，调用方退回旧的 base64 内联方式，保证零丢失。
 */

const LS_KEY = 'radiant_image_store_v1';
const TOKEN_PREFIX = 'img:';
const DATA_URL_IMAGE_RE = /!\[([^\]]*)\]\((data:image\/[^;]+;base64,[^)\s]+)\)/g;
const TOKEN_IMAGE_RE = /!\[([^\]]*)\]\((img:[a-z0-9-]+)\)/g;

let cache: Record<string, string> | null = null;

function load(): Record<string, string> {
  if (cache) return cache;
  try {
    cache = JSON.parse(localStorage.getItem(LS_KEY) || '{}') || {};
  } catch {
    cache = {};
  }
  return cache!;
}

function persist(): boolean {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(cache));
    return true;
  } catch {
    return false;
  }
}

/** 存入一张图片，返回可放入 Markdown 的短令牌；persisted=false 表示存储已满，调用方应退回内联 base64 */
export function putImageDataUrl(dataUrl: string): { token: string; persisted: boolean } {
  const store = load();
  const token = TOKEN_PREFIX + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  store[token] = dataUrl;
  if (!persist()) {
    delete store[token];
    return { token, persisted: false };
  }
  return { token, persisted: true };
}

/** 预览渲染时解析：令牌 → dataURL；未命中返回空串（由调用方渲染失效占位） */
export function resolveImageSrc(src: string | undefined): string {
  if (src && src.startsWith(TOKEN_PREFIX)) {
    const store = load();
    return store[src] || '';
  }
  return src || '';
}

/** 把正文中已存在的内联 base64 图片迁移为令牌（用于草稿恢复等入口，幂等） */
export function extractAndTokenizeDataUrls(markdown: string): { markdown: string; count: number } {
  let count = 0;
  let overflow = false;
  const md = markdown.replace(DATA_URL_IMAGE_RE, (_match, alt: string, dataUrl: string) => {
    const { token, persisted } = putImageDataUrl(dataUrl);
    if (!persisted) {
      overflow = true;
      return _match; // 存储已满时保持原样，宁可臃肿不丢图
    }
    count++;
    return `![${alt}](${token})`;
  });
  return { markdown: overflow ? markdown : md, count };
}

/** 收集当前文档里引用的全部图片（编辑器缩略图栏使用） */
export function collectDocImages(markdown: string): Array<{ token: string; alt: string; dataUrl: string }> {
  const store = load();
  const out: Array<{ token: string; alt: string; dataUrl: string }> = [];
  for (const m of markdown.matchAll(TOKEN_IMAGE_RE)) {
    out.push({ token: m[2], alt: m[1] || '配图', dataUrl: store[m[2]] || '' });
  }
  return out;
}
