'use client';

import {
  Undo2,
  Redo2,
  Trash2,
  RotateCcw,
  Image as ImageIcon,
  Code2,
  Loader2,
} from 'lucide-react';
import { detectContentFormat } from '@/lib/smart-parser';

import { compressAndEncodeImage } from '@/lib/image-utils';
import { putImageDataUrl, resolveImageSrc } from '@/lib/image-store';
import type { ConversionDecision } from '@/lib/smart-parser';
import React, { useMemo, useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';

interface EditorProps {
  value: string;
  onChange: (value: string) => void;
  /** 输入源是 Markdown（双副本模型下左侧已自动转为纯文本编辑） */
  sourceIsMarkdown?: boolean;
  /** 当前生效的排版用 Markdown 源码（与预览/下载 MD 同源），供只读透镜展示 */
  markdownSource?: string;
  /** 轻通知（如远程图片本地化失败提示） */
  onNotify?: (msg: string) => void;
  onClear: () => void;
  onRestoreSample: () => void;
  draftStatus?: string;
  firstLineAsTitle?: boolean;
  onToggleFirstLineAsTitle?: (enabled: boolean) => void;
  lowConfidenceDecisions?: ConversionDecision[];
  onResolveDecision?: (d: ConversionDecision) => void;
  onKeepDecision?: (d: ConversionDecision) => void;
  onExportFeedback?: () => void;
  onResolveAllDecisions?: (ds: ConversionDecision[]) => void;
  onKeepAllDecisions?: (ds: ConversionDecision[]) => void;
  /** 编辑器滚动比例（0~1）上报，用于联动右侧预览滚动 */
  onScrollRatio?: (ratio: number) => void;
  /** ⌘S 手动保存草稿 */
  onSaveDraft?: () => void;
}

interface ImageItem {
  alt: string;
  src: string;
}

type EditorBlock =
  | { kind: 'text'; lines: string[] }
  | { kind: 'images'; images: ImageItem[]; captions: string[]; layout: 1 | 2 | 3; polaroid?: boolean };

const IMAGE_LINE_RE = /^!\[([^\]]*)\]\(([^)]+)\)$/;
const GALLERY_SEP_CELL_RE = /^:?-{3,}:?$/;
const CAPTION_LINE_RE = /^\*▲?\s*[^*]+\*$/;

/**
 * 把编辑器文本解析为「文本块 + 图片块」序列：
 * - 独占一行的图片 → 图片块；连续多行图片自动成组（布局默认按张数 1/2/3 列）
 * - 画廊表格（| ![a](x) | ![b](y) |）→ 解析出图片与题注
 * - 图片后紧跟的斜体行（*▲ xxx*）→ 该图片的题注
 * - 其余行（含空行）→ 文本块，原样保留
 */
function parseEditorBlocks(value: string): EditorBlock[] {
  const lines = value.split('\n');
  const blocks: EditorBlock[] = [];
  let buf: string[] = [];
  const flush = () => {
    while (buf.length && !buf[0].trim()) buf.shift();
    while (buf.length && !buf[buf.length - 1].trim()) buf.pop();
    if (buf.length) blocks.push({ kind: 'text', lines: buf });
    buf = [];
  };
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    const isStandaloneImage = IMAGE_LINE_RE.test(t);
    const isGalleryRow = t.startsWith('|') && t.includes('![');
    // photo-card 拍立得 HTML 块 → 可视化图片块（不再以源码形式示人）
    if (/^<section\b/i.test(t) && /data[-–—\s]*role\s*=\s*["']photo-card["']/i.test(t)) {
      flush();
      let html = '';
      let j = i;
      while (j < lines.length) {
        html += (html ? '\n' : '') + lines[j];
        const closed = /<\/section>/i.test(lines[j]);
        j++;
        if (closed) break;
      }
      const images: ImageItem[] = [];
      for (const im of html.matchAll(/<img\b[^>]*>/gi)) {
        const tag = im[0];
        const srcM = tag.match(/src=["']([^"']+)["']/i);
        const altM = tag.match(/alt=["']([^"']*)["']/i);
        if (srcM) images.push({ alt: (altM?.[1] || '').trim(), src: srcM[1] });
      }
      let caption = '';
      const pM = html.match(/<p\b[^>]*>([\s\S]*?)<\/p>/i);
      if (pM) caption = pM[1].replace(/<[^>]+>/g, '').replace(/^▲\s*/, '').trim();
      if (images.length === 0) {
        // 非 photo 图片的 section：保持文本原样
        buf.push(...html.split('\n'));
        i = j - 1;
        continue;
      }
      if (images.length === 1) {
        blocks.push({ kind: 'images', images, captions: [caption], layout: 1, polaroid: true });
      } else {
        blocks.push({
          kind: 'images',
          images,
          captions: images.map(() => ''),
          layout: Math.min(3, Math.max(1, images.length)) as 1 | 2 | 3,
        });
      }
      i = j - 1;
      continue;
    }
    if (!isStandaloneImage && !isGalleryRow) {
      buf.push(lines[i]);
      continue;
    }
    flush();
    const images: ImageItem[] = [];
    const captions: string[] = [];
    let layout: 1 | 2 | 3 = 1;
    if (isGalleryRow) {
      const rows: string[][] = [];
      let sepIdx = -1;
      let cols = 2;
      let j = i;
      // 收集连续管道行；老版本散落的画廊行（分隔行/空题注行被空行拆开）跨单个空行续收
      const isPipeRow = (idx: number) => lines[idx].trim().startsWith('|');
      const isJunkPipeRow = (idx: number) => {
        const cells = lines[idx].trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
        return cells.every((c) => GALLERY_SEP_CELL_RE.test(c) || c === '');
      };
      while (j < lines.length) {
        if (isPipeRow(j)) {
          const cells = lines[j].trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
          const isSep = cells.length > 0 && cells.every((c) => GALLERY_SEP_CELL_RE.test(c.replace(/\s/g, '')) || c === '');
          if (isSep && sepIdx === -1) {
            sepIdx = rows.length;
            cols = Math.max(1, cells.filter((c) => c !== '').length || cells.length);
          }
          rows.push(cells);
          j++;
          continue;
        }
        if (!lines[j].trim() && j + 1 < lines.length && isPipeRow(j + 1) && isJunkPipeRow(j + 1)) {
          j++; // 跳过单个空行，下一轮收集散落行
          continue;
        }
        break;
      }
      rows.forEach((r) =>
        r.forEach((c) => {
          const m = c.match(/!\[([^\]]*)\]\(([^)]+)\)/);
          if (m) images.push({ alt: m[1], src: m[2] });
        })
      );
      if (sepIdx >= 0 && rows[sepIdx + 1]) {
        rows[sepIdx + 1].forEach((c, k) => {
          if (k >= images.length) return;
          const cap = c.replace(/^\*/, '').replace(/\*$/, '').replace(/^▲\s*/, '').trim();
          captions[k] = cap;
        });
      }
      for (let k = 0; k < images.length; k++) captions[k] = captions[k] || '';
      layout = Math.min(3, Math.max(1, cols)) as 1 | 2 | 3;
      blocks.push({ kind: 'images', images, captions, layout });
      i = j - 1;
    } else {
      const m = t.match(IMAGE_LINE_RE);
      if (m) images.push({ alt: m[1], src: m[2] });
      // 连续相邻的图片行并入同组（两三张即画廊）
      let j = i + 1;
      while (j < lines.length && IMAGE_LINE_RE.test(lines[j].trim())) {
        const mm = lines[j].trim().match(IMAGE_LINE_RE);
        if (mm) images.push({ alt: mm[1], src: mm[2] });
        j++;
      }
      let capFound = false;
      if (j < lines.length && CAPTION_LINE_RE.test(lines[j].trim())) {
        captions[images.length - 1] = lines[j]
          .trim()
          .replace(/^\*/, '')
          .replace(/\*$/, '')
          .replace(/^▲\s*/, '')
          .trim();
        capFound = true;
      }
      for (let k = 0; k < images.length; k++) captions[k] = captions[k] || '';
      layout = Math.min(3, Math.max(1, images.length)) as 1 | 2 | 3;
      // 老版本散落的画廊残行自愈：图片行后（隔一空行）的分隔行/空题注行并入图片块并恢复列数
      let absorbEnd = capFound ? j : j - 1;
      const k2 = absorbEnd + 1;
      if (k2 < lines.length && !lines[k2].trim() && k2 + 1 < lines.length && lines[k2 + 1].trim().startsWith('|')) {
        const cellsOf = (idx: number) =>
          lines[idx].trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
        const junk = (idx: number) => {
          const cs = cellsOf(idx);
          return cs.length > 0 && cs.every((c) => GALLERY_SEP_CELL_RE.test(c) || c === '');
        };
        if (junk(k2 + 1)) {
          const sepCells = cellsOf(k2 + 1);
          const n = sepCells.filter((c) => c !== '').length;
          if (n >= 2 && images.length === 1) layout = Math.min(3, n) as 1 | 2 | 3;
          let cur = k2 + 1;
          while (cur + 1 < lines.length && !lines[cur + 1].trim() && cur + 2 < lines.length && lines[cur + 2].trim().startsWith('|') && junk(cur + 2)) {
            cur += 2;
          }
          absorbEnd = cur;
        }
      }
      blocks.push({ kind: 'images', images, captions, layout });
      i = absorbEnd;
    }
  }
  flush();
  // 收敛存量泄漏：文本块中与任一图片块题注相同的孤立斜体行自动删除（历史 bug 遗留损坏自愈）。
  // 必须在最后一次 flush() 之后执行，否则尾部的文本块还在 buf 里未入 blocks
  const knownCaps = new Set(
    blocks.flatMap((b) => (b.kind === 'images' ? b.captions.map((c) => c.trim()).filter(Boolean) : []))
  );
  if (knownCaps.size > 0) {
    for (const b of blocks) {
      if (b.kind !== 'text') continue;
      b.lines = b.lines.filter((l) => {
        const t = l.trim();
        if (!CAPTION_LINE_RE.test(t)) return true;
        const content = t.replace(/^\*/, '').replace(/\*$/, '').replace(/^▲\s*/, '').trim();
        return !knownCaps.has(content);
      });
      while (b.lines.length && !b.lines[0].trim()) b.lines.shift();
      while (b.lines.length && !b.lines[b.lines.length - 1].trim()) b.lines.pop();
    }
  }
  return blocks;
}

/** 图片块写回 Markdown：单图逐行 + 斜体题注；两列/三列输出画廊表格 */
function serializeEditorBlocks(blocks: EditorBlock[]): string {
  const parts: string[] = [];
  for (const b of blocks) {
    if (b.kind === 'text') {
      parts.push(b.lines.join('\n'));
      continue;
    }
    const rows: string[] = [];
    if (b.polaroid && b.images.length === 1) {
      // 拍立得衬底卡片（Dark Mode 安全型）：输出 photo-card section
      const img = b.images[0];
      const cap = (b.captions[0] || '').trim();
      rows.push(
        '<section data-role="photo-card" style="margin: 20px auto; max-width: 100%; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px 8px 10px 8px; box-shadow: 0 4px 16px rgba(0,0,0,0.06); text-align: center;">'
      );
      rows.push(`<img src="${img.src}" alt="${img.alt}" style="width: 100%; border-radius: 6px; display: block; margin: 0 auto;" />`);
      if (cap) {
        rows.push(`<p style="margin: 8px 0 0 0; font-size: 13px; font-weight: 500; text-align: center;">▲ ${cap}</p>`);
      }
      rows.push('</section>');
      parts.push(rows.join('\n'));
      continue;
    }
    if (b.layout === 1) {
      b.images.forEach((img, k) => {
        rows.push(`![${img.alt}](${img.src})`);
        if (b.captions[k]) rows.push(`*▲ ${b.captions[k]}*`);
      });
    } else {
      const n = b.layout;
      for (let r = 0; r < b.images.length; r += n) {
        const imgs = b.images.slice(r, r + n);
        while (imgs.length < n) imgs.push({ alt: '', src: '' }); // 补空位保证往返稳定
        rows.push('| ' + imgs.map((img) => (img.src ? `![${img.alt}](${img.src})` : '')).join(' | ') + ' |');
        rows.push('| ' + imgs.map(() => ':---:').join(' | ') + ' |');
        rows.push('| ' + imgs.map((_, k) => (b.captions[r + k] ? `*▲ ${b.captions[r + k]}*` : '')).join(' | ') + ' |');
      }
    }
    parts.push(rows.join('\n'));
  }
  return parts.join('\n\n');
}

// ======================================================================
// 统一编辑面（单一 contentEditable）：文本段落与图片组在同一条文档流中
// 连续编辑。内部数据模型不变（parseEditorBlocks / serializeEditorBlocks），
// DOM 为编辑态事实源：输入时 DOM → blocks → 序列化上抛；外部 value 变化
// （范文/清空/撤销/粘贴全文）时才整体重建 DOM，避免光标跳动。
// ======================================================================

/**
 * 行文本 → 语义化段落：标题/引用/题注等格式记在 data-kind 上，
 * 编辑器只显示干净文本（序列化时再注入 markdown 标记）。
 * 语义段落同样用于意图转换的回写（## x / > x / *▲ x* 自动转为对应 kind）。
 */
function buildParagraph(line: string): HTMLParagraphElement {
  const p = document.createElement('p');
  const t = line;
  // 标题（含中文习惯 #标题 与闭合 ## 标题 ##）
  const h = t.match(/^ {0,3}(#{1,6})[ \t]+(.*?)(?:[ \t]+#{1,6})?[ \t]*$/) || t.match(/^ {0,3}(#{1,6})(?=[\u4e00-\u9fff])(.*)$/);
  if (h) {
    p.dataset.kind = 'h' + h[1].length;
    p.textContent = (h[2] || '').trim();
    return p;
  }
  // 引用
  const q = t.match(/^ {0,3}> ?(.*)$/);
  if (q) {
    p.dataset.kind = 'quote';
    p.textContent = q[1];
    return p;
  }
  // 题注约定行（*▲ xxx*）——去掉星号显示，保留 ▲
  const cap = t.match(/^\*▲?\s*([^*]+)\*$/);
  if (cap) {
    p.dataset.kind = 'caption';
    p.textContent = ('▲ ' + cap[1].trim()).trim();
    return p;
  }
  if (t.trim() === '') {
    p.innerHTML = '<br>';
    return p;
  }
  p.textContent = t;
  return p;
}

/**
 * 把一组源码行写入文档片段：围栏行不渲染，围栏内的行转为代码段落
 * （首段携带语言标记 data-lang），其余行走 buildParagraph 语义识别。
 * 围栏外的空行是段落边界（序列化时补的分隔），不渲染为空段落。
 */
function appendLinesAsParagraphs(container: HTMLElement | DocumentFragment, lines: string[]) {
  let inFence = false;
  let lang = '';
  for (const line of lines) {
    const fence = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
    if (fence) {
      if (!inFence) {
        inFence = true;
        lang = fence[2].trim();
      } else {
        inFence = false;
        lang = '';
      }
      continue;
    }
    if (!inFence && line.trim() === '') {
      continue;
    }
    const p = buildParagraph(line);
    if (inFence) {
      p.dataset.kind = 'code';
      if (lang) {
        p.dataset.lang = lang;
        lang = '';
      }
      if ((p.textContent || '') === '') p.innerHTML = '<br>';
    }
    container.appendChild(p);
  }
}

/** 把光标定到段落末尾 */
function focusParagraphEnd(p: Element) {
  const sel = window.getSelection();
  if (!sel) return;
  const range = document.createRange();
  range.selectNodeContents(p);
  range.collapse(false);
  sel.removeAllRanges();
  sel.addRange(range);
}

export function Editor({
    value,
    onChange,
    sourceIsMarkdown,
    markdownSource,
    onNotify,
    onClear,
    onRestoreSample,
    draftStatus,
    firstLineAsTitle,
    onToggleFirstLineAsTitle,
    lowConfidenceDecisions,
    onResolveDecision,
    onKeepDecision,
    onExportFeedback,
    onResolveAllDecisions,
    onKeepAllDecisions,
    onScrollRatio,
    onSaveDraft,
  }: EditorProps) {
  const charCount = value.replace(/\s/g, '').length;
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  // Markdown 透镜：只读查看当前生效的排版用 Markdown 源码（与预览/下载 MD 同源）
  const [showMdSource, setShowMdSource] = useState(false);
  // 选中文本意图转换工具栏：{ 起始段落索引, 结束段落索引 }
  const [intentBar, setIntentBar] = useState<{ s: number; e: number; top: number; left: number } | null>(null);
  const intentBarRef = useRef<HTMLDivElement>(null);
  // 渲染后按菜单实际宽度做左右边界收敛（translateX(-50%) 居中依赖真实宽度）
  useLayoutEffect(() => {
    if (!intentBar || !intentBarRef.current || !editSurfaceRef.current) return;
    const w = intentBarRef.current.offsetWidth;
    const half = w / 2 + 8;
    const clamped = Math.min(Math.max(intentBar.left, half), Math.max(half, editSurfaceRef.current.clientWidth - half));
    if (clamped !== intentBar.left) {
      setIntentBar((prev) => (prev ? { ...prev, left: clamped } : prev));
    }
  }, [intentBar]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const ceRef = useRef<HTMLDivElement>(null);
  const editSurfaceRef = useRef<HTMLDivElement>(null);
  const lastSerializedRef = useRef(value);
  const pendingFocusRef = useRef(false);

  // 实时分析文本格式
  const detection = useMemo(() => detectContentFormat(value), [value]);
  const showsMarkdown = sourceIsMarkdown ?? detection.isMarkdown;

  // ---------- DOM ↔ blocks 双向 ----------

  /** 遍历编辑面顶层节点还原 blocks（P → 文本行；image-group → 图片块）。
   *  语义段落（data-kind）回写为带 markdown 标记的行；连续代码段落补回围栏 */
  const readBlocksFromDom = useCallback((): EditorBlock[] => {
    const ce = ceRef.current;
    const blocks: EditorBlock[] = [];
    if (!ce) return blocks;
    let buf: string[] = [];
    let inCode = false;
    const closeCode = () => {
      if (inCode) {
        buf.push('```');
        inCode = false;
      }
    };
    const flushText = () => {
      closeCode();
      while (buf.length && !buf[0].trim()) buf.shift();
      while (buf.length && !buf[buf.length - 1].trim()) buf.pop();
      if (buf.length) blocks.push({ kind: 'text', lines: buf });
      buf = [];
    };
    Array.from(ce.children).forEach((child) => {
      const el = child as HTMLElement;
      if (el.dataset && el.dataset.role === 'image-group') {
        flushText();
        try {
          blocks.push({
            kind: 'images',
            images: JSON.parse(el.dataset.images || '[]'),
            captions: JSON.parse(el.dataset.captions || '[]'),
            layout: (Number(el.dataset.layout) || 1) as 1 | 2 | 3,
            polaroid: el.dataset.polaroid === '1',
          });
        } catch {}
        return;
      }
      if (el.tagName !== 'P') return;
      const kind = el.dataset.kind || '';
      const text = (el.innerText || '').replace(/\n$/, '');
      const lines = text.split('\n');
      // 编辑器中「换行即分段」：任意相邻段落之间补空行，保证预览与引擎
      // 不会把紧邻的普通段落并进上一段或上一条列表项（如独立行「专业技能」）
      if (!inCode && buf.length && buf[buf.length - 1].trim() !== '') {
        buf.push('');
      }
      if (kind === 'code') {
        if (!inCode) {
          if (buf.length && buf[buf.length - 1].trim() !== '') buf.push('');
          buf.push('```' + (el.dataset.lang || ''));
          inCode = true;
        }
        lines.forEach((l) => buf.push(l));
        return;
      }
      closeCode();
      if (/^h[1-6]$/.test(kind)) {
        buf.push('#'.repeat(Number(kind[1])) + ' ' + text);
      } else if (kind === 'quote') {
        lines.forEach((l) => buf.push('> ' + l));
      } else if (kind === 'caption') {
        lines.forEach((l) => buf.push(l.trim() ? '*' + l + '*' : l));
      } else {
        lines.forEach((l) => buf.push(l));
      }
    });
    flushText();
    return blocks;
  }, []);

  /** 结构收敛：杂散节点转 P、容器空时补段落、末尾保证有可输入位置 */
  const normalizeDom = useCallback(() => {
    const ce = ceRef.current;
    if (!ce) return;
    Array.from(ce.children).forEach((child) => {
      const el = child as HTMLElement;
      if (el.tagName === 'DIV' && !(el.dataset && el.dataset.role === 'image-group')) {
        const p = document.createElement('p');
        p.innerHTML = el.innerHTML || '<br>';
        ce.replaceChild(p, el);
      } else if (el.tagName === 'DIV' && el.dataset && el.dataset.role === 'image-group') {
        el.setAttribute('contenteditable', 'false');
      }
    });
    // 顶层裸文本节点包成段落
    Array.from(ce.childNodes).forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) {
        const p = document.createElement('p');
        p.textContent = node.textContent;
        ce.replaceChild(p, node);
      } else if (node.nodeType === Node.TEXT_NODE) {
        ce.removeChild(node);
      }
    });
    if (ce.children.length === 0) {
      ce.appendChild(buildParagraph(''));
    }
    const last = ce.lastElementChild as HTMLElement | null;
    if (last && last.dataset && last.dataset.role === 'image-group') {
      ce.appendChild(buildParagraph(''));
    }
  }, []);

  /** DOM → blocks → 上抛 value（不重建 DOM，光标不动） */
  const syncFromDom = useCallback(() => {
    normalizeDom();
    const blocks = readBlocksFromDom();
    const md = serializeEditorBlocks(blocks);
    lastSerializedRef.current = md;
    onChange(md);
  }, [normalizeDom, readBlocksFromDom, onChange]);

  /** 外部 value（范文/清空/撤销/双副本导入）→ 整体重建编辑面 */
  const rebuildDom = useCallback((md: string, opts?: { focusEnd?: boolean }) => {
    const ce = ceRef.current;
    if (!ce) return;
    const blocks = parseEditorBlocks(md);
    ce.innerHTML = '';
    blocks.forEach((b) => {
      if (b.kind === 'text') {
        appendLinesAsParagraphs(ce, b.lines);
      } else {
        ce.appendChild(buildImageGroup(b));
      }
    });
    normalizeDom();
    lastSerializedRef.current = md;
    if (opts?.focusEnd || pendingFocusRef.current) {
      pendingFocusRef.current = false;
      const last = ce.lastElementChild;
      if (last && last.tagName === 'P') {
        focusParagraphEnd(last);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [normalizeDom]);

  // ---------- 内联图片组（vanilla 构建，contenteditable=false 原子块） ----------

  /** 图片组内 hover 工具栏 + 网格 + 题注输入，重建组内容（布局切换后调用） */
  function renderGroupInner(fig: HTMLElement, block: EditorBlock & { kind: 'images' }) {
    fig.dataset.images = JSON.stringify(block.images);
    fig.dataset.captions = JSON.stringify(block.captions);
    fig.dataset.layout = String(block.layout);
    fig.dataset.polaroid = block.polaroid ? '1' : '0';
    fig.innerHTML = '';

    const wrap = document.createElement('div');
    wrap.className = 'relative group rounded-xl border border-black/[0.06] bg-gray-50/60 p-3 shadow-[0_1px_2px_rgba(15,23,42,0.03)]';

    // 悬浮工具栏
    const bar = document.createElement('div');
    bar.className =
      'gp-bar absolute right-2 top-2 z-10 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity bg-white/95 rounded-lg border border-gray-200 px-1 py-0.5 shadow-sm';
    ([1, 2, 3] as const).forEach((n) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = n + '列';
      btn.title = n === 1 ? '单图（各占一行）' : n + ' 列画廊；图片不足的格子可点击后补图';
      btn.className =
        'px-1.5 py-0.5 rounded text-[11px] font-medium cursor-pointer transition-colors ' +
        (block.layout === n ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:bg-gray-100');
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        applyGroupPatch(fig, { layout: n });
      });
      bar.appendChild(btn);
    });
    if (block.images.length === 1 && block.layout === 1) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = block.polaroid ? '安全型开' : '安全型';
      btn.title = '拍立得衬底卡片（Dark Mode 安全型）：白底留白护城河，暗色主题下图片更耐看';
      btn.className =
        'px-1.5 py-0.5 rounded text-[11px] font-medium cursor-pointer transition-colors ' +
        (block.polaroid ? 'bg-slate-700 text-white' : 'text-gray-500 hover:bg-gray-100');
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        applyGroupPatch(fig, { polaroid: !block.polaroid });
      });
      bar.appendChild(btn);
    }
    const del = document.createElement('button');
    del.type = 'button';
    del.textContent = '删除';
    del.title = '删除此图片块';
    del.className = 'px-1.5 py-0.5 rounded text-[11px] text-red-500 hover:bg-red-50 cursor-pointer font-medium';
    del.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      fig.remove();
      syncFromDom();
      ceRef.current?.focus();
    });
    bar.appendChild(del);
    wrap.appendChild(bar);

    // 图片网格
    const cols = block.layout;
    const grid = document.createElement('div');
    grid.className = 'grid gap-2 ' + (cols === 1 ? 'grid-cols-1' : cols === 2 ? 'grid-cols-2' : 'grid-cols-3');
    const rowCount = Math.max(1, Math.ceil(block.images.length / cols));
    const cellCount = Math.max(block.images.length, rowCount * cols);
    for (let k = 0; k < cellCount; k++) {
      const img = block.images[k];
      const cell = document.createElement('div');
      cell.className = 'flex flex-col gap-1.5 min-w-0';
      if (!img || !img.src) {
        const pick = document.createElement('button');
        pick.type = 'button';
        pick.className =
          'rounded-lg border border-dashed border-gray-300/90 bg-white/70 flex flex-col items-center justify-center gap-1 min-h-[140px] text-gray-400 hover:border-indigo-400 hover:text-indigo-500 hover:bg-indigo-50/30 transition-colors cursor-pointer';
        pick.title = '选择本地图片填充此格子';
        pick.innerHTML =
          '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg><span style="font-size:11px">添加图片</span>';
        pick.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          pickSlotRef.current = { fig, slot: k };
          fileInputRef.current?.click();
        });
        cell.appendChild(pick);
      } else {
        const box = document.createElement('div');
        box.className =
          'rounded-lg border border-black/[0.06] bg-white overflow-hidden flex items-center justify-center ' +
          (block.polaroid ? 'p-3 pb-4 shadow-[0_2px_8px_rgba(15,23,42,0.06)]' : '');
        const im = document.createElement('img');
        // display-only：剥掉 src 上的 title 后缀（如 /a.jpg "标题"），避免卡片加载失败
        im.src = (resolveImageSrc(img.src) || img.src).replace(/\s+(["'])(?:(?!\1).)*\1\s*$/, '');
        im.alt = img.alt;
        im.className = block.polaroid ? 'w-full rounded-sm' : 'w-full max-h-[320px] object-contain';
        im.draggable = false;
        box.appendChild(im);
        cell.appendChild(box);
      }
      // 题注输入（本地草稿态：blur/Enter 才写回 dataset 并上抛）
      const cap = document.createElement('input');
      cap.type = 'text';
      cap.value = block.captions[k] || '';
      cap.placeholder = '题注（如：图 1 · 说明文字）';
      cap.className =
        'w-full text-[12px] text-gray-500 bg-transparent border-b border-dashed border-gray-200 focus:border-blue-400 outline-none px-1 py-0.5 text-center';
      cap.addEventListener('input', () => {
        const caps = JSON.parse(fig.dataset.captions || '[]');
        while (caps.length < block.images.length) caps.push('');
        caps[k] = cap.value;
        fig.dataset.captions = JSON.stringify(caps);
      });
      cap.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          cap.blur();
        }
      });
      cap.addEventListener('blur', () => {
        syncFromDom();
      });
      cell.appendChild(cap);
      grid.appendChild(cell);
    }
    wrap.appendChild(grid);
    fig.appendChild(wrap);
  }

  function buildImageGroup(block: EditorBlock & { kind: 'images' }): HTMLElement {
    const fig = document.createElement('div');
    fig.setAttribute('data-role', 'image-group');
    fig.setAttribute('contenteditable', 'false');
    fig.className = 'my-3 select-none';
    renderGroupInner(fig, block);
    return fig;
  }

  /** 结构性操作（布局/题注提交/补图/拍立得）：改 DOM 数据集 → 原地重渲染 → 上抛 */
  function applyGroupPatch(fig: HTMLElement, patch: { layout?: 1 | 2 | 3; polaroid?: boolean; images?: ImageItem[]; captions?: string[] }) {
    const current: EditorBlock & { kind: 'images' } = {
      kind: 'images',
      images: JSON.parse(fig.dataset.images || '[]'),
      captions: JSON.parse(fig.dataset.captions || '[]'),
      layout: (Number(fig.dataset.layout) || 1) as 1 | 2 | 3,
      polaroid: fig.dataset.polaroid === '1',
    };
    const next = { ...current, ...patch };
    renderGroupInner(fig, next);
    syncFromDom();
  }

  // ---------- 外部 value 变化 → 重建 ----------

  useEffect(() => {
    // 首挂 + 外部变更（范文/清空/撤销/草稿恢复/双副本导入）
    if (value !== lastSerializedRef.current) {
      rebuildDom(value);
    }
  }, [value, rebuildDom]);

  useEffect(() => {
    // 首次挂载构建编辑面
    rebuildDom(value);
    document.execCommand('defaultParagraphSeparator', false, 'p');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- 撤销/重做：基于文档快照的栈 ----------
  const historyRef = useRef<{ stack: string[]; index: number; lastAt: number }>({ stack: [value], index: 0, lastAt: 0 });
  const applyingRef = useRef(false);
  const [histState, setHistState] = useState({ canUndo: false, canRedo: false });
  const syncHistState = () => {
    const h = historyRef.current;
    setHistState({ canUndo: h.index > 0, canRedo: h.index < h.stack.length - 1 });
  };

  useEffect(() => {
    if (applyingRef.current) {
      applyingRef.current = false;
      return;
    }
    const h = historyRef.current;
    if (value === h.stack[h.index]) {
      syncHistState();
      return;
    }
    // 撤销后产生新编辑：丢弃重做分支
    if (h.index < h.stack.length - 1) h.stack = h.stack.slice(0, h.index + 1);
    const now = Date.now();
    if (now - h.lastAt < 500 && h.stack.length > 1) {
      h.stack[h.stack.length - 1] = value;
    } else {
      h.stack.push(value);
      h.index = h.stack.length - 1;
    }
    h.lastAt = now;
    if (h.stack.length > 100) {
      h.stack.shift();
      h.index = Math.max(0, h.index - 1);
    }
    syncHistState();
  }, [value]);

  const applyHistory = (md: string) => {
    applyingRef.current = true;
    rebuildDom(md);
    onChange(md);
    syncHistState();
  };
  const undo = useCallback(() => {
    const h = historyRef.current;
    if (h.index <= 0) return;
    h.index -= 1;
    applyHistory(h.stack[h.index]);
  }, [onChange, rebuildDom]);
  const redo = useCallback(() => {
    const h = historyRef.current;
    if (h.index >= h.stack.length - 1) return;
    h.index += 1;
    applyHistory(h.stack[h.index]);
  }, [onChange, rebuildDom]);

  // 全局 ⌘Z / ⌘⇧Z / Ctrl+Y（拦截浏览器原生 contentEditable undo，统一走快照栈）
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      const k = e.key.toLowerCase();
      if (k === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (k === 'y') {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo]);

  // 图片插入后自动聚焦新增位置（rebuildDom 的 focusEnd 处理，无额外副作用）

  // ---------- 插入图片 ----------

  // 补图选择器上下文：{ 目标图片组, 槽位 }
  const pickSlotRef = useRef<{ fig: HTMLElement; slot: number } | null>(null);

  const handlePickedFile = async (file: File) => {
    try {
      setIsUploading(true);
      const { dataUrl, fileName } = await compressAndEncodeImage(file);
      const cleanAlt = fileName.replace(/\.[^/.]+$/, '') || '配图';
      const { token, persisted } = putImageDataUrl(dataUrl);
      const src = persisted ? token : dataUrl;
      const picked = pickSlotRef.current;
      pickSlotRef.current = null;
      if (picked && picked.fig.isConnected) {
        // 空位补图
        const images = JSON.parse(picked.fig.dataset.images || '[]');
        const captions = JSON.parse(picked.fig.dataset.captions || '[]');
        images[picked.slot] = { alt: cleanAlt, src };
        while (captions.length < images.length) captions.push('');
        applyGroupPatch(picked.fig, { images, captions });
        return;
      }
      appendImageAtEnd([{ alt: cleanAlt, src }]);
    } catch (err) {
      console.error('Image insertion failed', err);
    } finally {
      setIsUploading(false);
    }
  };

  /** 文末追加图片组（工具栏插入 / 拖放） */
  const appendImageAtEnd = (images: ImageItem[]) => {
    const ce = ceRef.current;
    if (!ce) return;
    normalizeDom();
    const captions = images.map(() => '');
    const fig = buildImageGroup({ kind: 'images', images, captions, layout: Math.min(3, Math.max(1, images.length)) as 1 | 2 | 3 });
    ce.appendChild(fig);
    normalizeDom();
    pendingFocusRef.current = true;
    syncFromDom();
    const last = ce.lastElementChild;
    if (last && last.tagName === 'P') focusParagraphEnd(last);
  };

  /** 同步捕获当前光标：所在段落 + 段内文本偏移（异步贴图前必须先捕获） */
  const captureCaret = (): { p: HTMLParagraphElement | null; offset: number } => {
    const ce = ceRef.current;
    const sel = window.getSelection();
    if (!ce || !sel || sel.rangeCount === 0) return { p: null, offset: 0 };
    const range = sel.getRangeAt(0);
    let n: Node | null = range.startContainer;
    while (n && n !== ce) {
      if ((n as Element).tagName === 'P' && (n as Element).parentNode === ce) break;
      n = n.parentNode;
    }
    if (!n || n === ce) return { p: null, offset: 0 };
    const p = n as HTMLParagraphElement;
    const pre = document.createRange();
    pre.selectNodeContents(p);
    try {
      pre.setEnd(range.startContainer, range.startOffset);
    } catch {
      return { p, offset: (p.innerText || '').length };
    }
    return { p, offset: pre.toString().length };
  };

  /** 图片文件批量入库（压缩 + 令牌化），保持顺序 */
  const tokenizeImageFiles = async (fileList: File[]): Promise<ImageItem[]> => {
    const out: ImageItem[] = [];
    for (const f of fileList) {
      const { dataUrl, fileName } = await compressAndEncodeImage(f);
      const alt = fileName.replace(/\.[^/.]+$/, '') || '配图';
      const { token, persisted } = putImageDataUrl(dataUrl);
      out.push({ alt, src: persisted ? token : dataUrl });
    }
    return out;
  };

  /** 由一组图片构建内联图片组节点 */
  const buildGroupElement = (images: ImageItem[]): HTMLElement =>
    buildImageGroup({
      kind: 'images',
      images,
      captions: images.map(() => ''),
      layout: Math.min(3, Math.max(1, images.length)) as 1 | 2 | 3,
    });

  /** 在指定位置（或文末）插入节点片段：光标所在段落从中间断开（同旧版「\n\n![..](..)\n\n」行为） */
  const insertFragmentNearCaret = (frag: DocumentFragment, caret: { p: HTMLParagraphElement | null; offset: number }) => {
    const ce = ceRef.current;
    if (!ce) return;
    const targetP = caret.p && caret.p.isConnected ? caret.p : null;
    if (!targetP) {
      normalizeDom();
      ce.appendChild(frag);
      normalizeDom();
      syncFromDom();
      const last = ce.lastElementChild;
      if (last && last.tagName === 'P') focusParagraphEnd(last);
      return;
    }
    const text = targetP.innerText || '';
    const off = Math.min(caret.offset, text.length);
    const before = text.slice(0, off);
    const after = text.slice(off);
    const wrap = document.createDocumentFragment();
    if (before.trim()) wrap.appendChild(buildParagraph(before));
    wrap.appendChild(frag);
    const afterP = buildParagraph(after);
    wrap.appendChild(afterP);
    targetP.replaceWith(wrap);
    normalizeDom();
    syncFromDom();
    focusParagraphEnd(afterP);
  };

  // ---------- 粘贴 ----------

  /**
   * HTML 图文粘贴：按文档顺序解析——文字成段落、<img> 成图片卡。
   * 图片源策略：data:/本站图片直接用；远程图尝试 fetch 本地化（压缩入库），
   * 跨域失败则保留原链接并计数提示。
   */
  const localizeImage = async (im: ImageItem): Promise<ImageItem> => {
    const { alt, src } = im;
    if (!src) throw new Error('empty src');
    if (src.startsWith('data:')) {
      const { token, persisted } = putImageDataUrl(src);
      return { alt, src: persisted ? token : src };
    }
    if (src.startsWith('/') || src.startsWith(location.origin + '/')) {
      return { alt, src }; // 本站静态图直接引用
    }
    const res = await fetch(src, { mode: 'cors', signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error('http ' + res.status);
    const blob = await res.blob();
    if (!blob.type.startsWith('image/')) throw new Error('not image');
    const file = new File([blob], 'remote-image', { type: blob.type });
    const { dataUrl, fileName } = await compressAndEncodeImage(file);
    const { token, persisted } = putImageDataUrl(dataUrl);
    return { alt: alt || fileName.replace(/\.[^/.]+$/, '') || '配图', src: persisted ? token : dataUrl };
  };

  const insertHtmlWithImages = async (html: string, caret: { p: HTMLParagraphElement | null; offset: number }) => {
    setIsUploading(true);
    try {
      const holder = document.createElement('div');
      // 注意：不能用 visibility:hidden——Chromium 对不可见元素的 innerText 返回空串
      holder.setAttribute('style', 'position:fixed;left:-99999px;top:0;opacity:0;pointer-events:none;white-space:pre-wrap;');
      holder.innerHTML = html;
      holder.querySelectorAll('script,style,noscript,meta,link,title').forEach((el) => el.remove());
      const imgs: ImageItem[] = [];
      holder.querySelectorAll('img').forEach((im, i) => {
        imgs.push({ alt: im.getAttribute('alt') || '', src: im.getAttribute('src') || '' });
        im.replaceWith(document.createTextNode(`\u0000IMG${i}\u0000`));
      });
      // 挂到文档中读取 innerText，保证块级元素间产生换行
      document.body.appendChild(holder);
      const flattened = (holder.innerText || '').replace(/\u00a0/g, ' ');
      holder.remove();

      let failed = 0;
      const resolved = await Promise.all(
        imgs.map(async (im): Promise<ImageItem | null> => {
          try {
            return await localizeImage(im);
          } catch {
            const remote = im.src.startsWith('http') && !im.src.startsWith(location.origin);
            if (remote) failed += 1;
            return im.src ? im : null;
          }
        })
      );
      if (failed && onNotify) onNotify(`${failed} 张远程图片未能本地化（跨域限制），已保留原链接`);

      const frag = document.createDocumentFragment();
      let pending: ImageItem[] = [];
      const flushPending = () => {
        if (pending.length) {
          frag.appendChild(buildGroupElement(pending));
          pending = [];
        }
      };
      for (const rawLine of flattened.split('\n')) {
        const parts = rawLine.split(/\u0000IMG(\d+)\u0000/);
        for (let k = 0; k < parts.length; k++) {
          if (k % 2 === 1) {
            const im = resolved[Number(parts[k])];
            if (im && im.src) pending.push(im);
            continue;
          }
          if (parts[k].trim()) {
            flushPending();
            frag.appendChild(buildParagraph(parts[k]));
          }
        }
      }
      flushPending();
      insertFragmentNearCaret(frag, caret);
    } finally {
      setIsUploading(false);
    }
  };

  /** 文本自带图片行/图片组的载荷：拆分为段落 + 内联图片组片段 */
  const buildTextPayloadFragment = (text: string): DocumentFragment => {
    const frag = document.createDocumentFragment();
    parseEditorBlocks(text).forEach((b) => {
      if (b.kind === 'text') {
        appendLinesAsParagraphs(frag, b.lines);
      } else {
        frag.appendChild(buildImageGroup(b));
      }
    });
    return frag;
  };

  const handlePaste = async (e: React.ClipboardEvent<HTMLDivElement>) => {
    const cd = e.clipboardData;
    if (!cd) return;
    const files = Array.from(cd.files || []);
    const items = Array.from(cd.items || []);
    const clipImages = files.filter((f) => f.type.startsWith('image/'));
    const itemImages = items
      .filter((it) => it.kind === 'file' && it.type.startsWith('image/'))
      .map((it) => it.getAsFile())
      .filter((f): f is File => !!f);
    const imageFiles = clipImages.length ? clipImages : itemImages;
    const text = cd.getData('text/plain') || '';
    const html = cd.getData('text/html') || '';
    const htmlHasImages = /<img\b/i.test(html);

    // 1) 纯图片粘贴（截图等，无文本）
    if (imageFiles.length && !text.trim()) {
      e.preventDefault();
      const caret = captureCaret();
      void (async () => {
        try {
          setIsUploading(true);
          const images = await tokenizeImageFiles(imageFiles);
          if (!images.length) return;
          const frag = document.createDocumentFragment();
          frag.appendChild(buildGroupElement(images));
          insertFragmentNearCaret(frag, caret);
        } catch (err) {
          console.error('Image paste failed', err);
        } finally {
          setIsUploading(false);
        }
      })();
      return;
    }

    // 2) 图文混合粘贴（图片文件 + 文本）：文本成段、图片成卡，全部保留
    if (imageFiles.length && text.trim()) {
      e.preventDefault();
      const caret = captureCaret();
      void (async () => {
        try {
          setIsUploading(true);
          const images = await tokenizeImageFiles(imageFiles);
          const frag = document.createDocumentFragment();
          text.split('\n').forEach((l) => frag.appendChild(buildParagraph(l)));
          if (images.length) frag.appendChild(buildGroupElement(images));
          insertFragmentNearCaret(frag, caret);
        } catch (err) {
          console.error('Mixed paste failed', err);
        } finally {
          setIsUploading(false);
        }
      })();
      return;
    }

    // 3) 仅 HTML（无纯文本形态）：按图文解析
    if (!text && htmlHasImages) {
      e.preventDefault();
      const caret = captureCaret();
      void (async () => {
        try {
          await insertHtmlWithImages(html, caret);
        } catch (err) {
          console.error('HTML paste failed', err);
        }
      })();
      return;
    }

    if (!text) return;

    const pastedLines = text.split('\n').map((l) => l.trim());
    const hasImagePayload =
      pastedLines.some((l) => IMAGE_LINE_RE.test(l)) ||
      pastedLines.some((l) => l.startsWith('|') && l.includes('![')) ||
      pastedLines.some((l) => /^<section\b/i.test(l) && /photo-card/i.test(l));

    if (hasImagePayload) {
      // 4) 文本自带图片载荷：拆分为段落 + 内联图片组插入光标处
      e.preventDefault();
      const caret = captureCaret();
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed) sel.deleteFromDocument();
      insertFragmentNearCaret(buildTextPayloadFragment(text), caret);
      return;
    }

    // 5) 纯文本但 HTML 里有 <img>（网页/Word 图文混选）：按 HTML 文档顺序解析
    if (htmlHasImages) {
      e.preventDefault();
      const caret = captureCaret();
      void (async () => {
        try {
          await insertHtmlWithImages(html, caret);
        } catch (err) {
          console.error('HTML paste failed', err);
        }
      })();
      return;
    }

    // 6) 纯文本粘贴：insertText 保留段落内的换行（white-space: pre-wrap 渲染）
    e.preventDefault();
    document.execCommand('insertText', false, text);
  };

  // ---------- 快捷键（⌘B / ⌘I / ⌘1~3 / ⌘S） ----------

  const getSelectionParagraphRange = (): { ps: HTMLParagraphElement[]; s: number; e: number } | null => {
    const ce = ceRef.current;
    const sel = window.getSelection();
    if (!ce || !sel || sel.isCollapsed || sel.rangeCount === 0) return null;
    const range = sel.getRangeAt(0);
    if (!ce.contains(range.commonAncestorContainer)) return null;
    const ownerOf = (node: Node | null): HTMLParagraphElement | null => {
      let n: Node | null = node;
      while (n && n !== ce) {
        if ((n as Element).tagName === 'P' && (n as Element).parentNode === ce) return n as HTMLParagraphElement;
        n = n.parentNode;
      }
      return null;
    };
    const a = ownerOf(range.startContainer);
    const b = ownerOf(range.endContainer);
    if (!a || !b) return null;
    const children = Array.from(ce.children);
    const s = children.indexOf(a);
    const e = children.indexOf(b);
    if (s < 0 || e < 0) return null;
    const ps = children.slice(Math.min(s, e), Math.max(s, e) + 1).filter(
      (el) => el.tagName === 'P'
    ) as HTMLParagraphElement[];
    if (!ps.length) return null;
    return { ps, s: Math.min(s, e), e: Math.max(s, e) };
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    // 回车在语义段落（标题/引用/题注）的开头或结尾：浏览器默认会克隆 data-kind，
    // 这里改为插入普通段落——标题后回车回到正文，代码块内回车保持代码（交给默认行为）
    if (e.key === 'Enter' && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
      const ce = ceRef.current;
      const sel = window.getSelection();
      if (ce && sel && sel.isCollapsed && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        let n: Node | null = range.startContainer;
        while (n && n !== ce) {
          if ((n as Element).tagName === 'P' && (n as Element).parentNode === ce) break;
          n = n.parentNode;
        }
        const p = n && n !== ce ? (n as HTMLParagraphElement) : null;
        const kind = p?.dataset?.kind || '';
        if (p && kind && kind !== 'code') {
          const pre = document.createRange();
          pre.selectNodeContents(p);
          try {
            pre.setEnd(range.startContainer, range.startOffset);
          } catch {
            return;
          }
          const off = pre.toString().length;
          const text = (p.innerText || '').replace(/\n$/, '');
          const atEnd = off >= text.length;
          const atStart = off === 0;
          if (!atEnd && !atStart) return; // 段中拆分：交给默认行为
          e.preventDefault();
          const fresh = document.createElement('p');
          fresh.innerHTML = '<br>';
          if (atEnd) {
            p.after(fresh);
            syncFromDom();
            focusParagraphEnd(fresh);
          } else {
            p.before(fresh);
            syncFromDom();
            const sel2 = window.getSelection();
            if (sel2) {
              const r = document.createRange();
              r.setStart(fresh, 0);
              r.collapse(true);
              sel2.removeAllRanges();
              sel2.addRange(r);
            }
          }
          return;
        }
      }
      return;
    }
    if (!(e.metaKey || e.ctrlKey)) return;
    const k = e.key.toLowerCase();
    if (k === 's') {
      e.preventDefault();
      onSaveDraft?.();
      return;
    }
    if (k === 'b' || k === 'i') {
      e.preventDefault();
      const sel = window.getSelection();
      const range = getSelectionParagraphRange();
      if (!sel || !range || range.ps.length !== 1) return;
      const selected = sel.toString();
      if (!selected || selected.includes('\n')) return;
      const p = range.ps[0];
      const mark = k === 'b' ? '**' : '*';
      const text = p.innerText || '';
      const idx = text.indexOf(selected);
      if (idx < 0) return;
      // 已包裹则取消，否则包裹
      let next: string;
      if (text.slice(idx - mark.length, idx) === mark && text.slice(idx + selected.length, idx + selected.length + mark.length) === mark) {
        next = text.slice(0, idx - mark.length) + selected + text.slice(idx + selected.length + mark.length);
      } else {
        next = text.slice(0, idx) + mark + selected + mark + text.slice(idx + selected.length);
      }
      p.textContent = next;
      syncFromDom();
      // 恢复选区到包裹后的内容（单文本节点场景精确恢复，其余落到段尾）
      const sel2 = window.getSelection();
      if (sel2 && p.firstChild && p.firstChild.nodeType === Node.TEXT_NODE) {
        const len = (p.firstChild as Text).length;
        const wrapped = text.slice(idx - mark.length, idx) === mark && text.slice(idx + selected.length, idx + selected.length + mark.length) === mark;
        const r = document.createRange();
        try {
          if (wrapped) {
            r.setStart(p.firstChild, Math.max(0, idx - mark.length));
            r.setEnd(p.firstChild, Math.max(0, idx - mark.length + selected.length));
          } else {
            r.setStart(p.firstChild, Math.min(idx + mark.length, len));
            r.setEnd(p.firstChild, Math.min(idx + mark.length + selected.length, len));
          }
          sel2.removeAllRanges();
          sel2.addRange(r);
        } catch {}
      }
      return;
    }
    if (k === '1' || k === '2' || k === '3') {
      e.preventDefault();
      const range = getSelectionParagraphRange();
      if (!range) return;
      const level = Number(k);
      // 语义化标题：格式记在 data-kind，编辑器内不显示 # 标记
      range.ps.forEach((p) => {
        const t = (p.innerText || '').replace(/\n$/, '');
        if (!t.trim()) return;
        p.dataset.kind = 'h' + level;
        p.textContent = t.replace(/^#{1,6}[ \t]+/, '');
      });
      syncFromDom();
    }
  };

  // ---------- 选中 → 意图转换工具栏（悬浮层，锚定选区上方） ----------

  const handleSelect = () => {
    const range = getSelectionParagraphRange();
    if (!range) {
      setIntentBar((prev) => (prev ? null : prev));
      return;
    }
    // 计算悬浮位置：水平居中于选区、垂直贴在选区上方（贴近视口顶部时改到下方）。
    // 坐标相对编辑面内容层（随滚动保持贴合文字）
    let top = 0;
    let left = 0;
    const sel = window.getSelection();
    const wrap = editSurfaceRef.current;
    if (sel && sel.rangeCount > 0 && wrap && scrollRef.current) {
      const rect = sel.getRangeAt(0).getBoundingClientRect();
      const wrapRect = wrap.getBoundingClientRect();
      const BAR_H = 40;
      const above = rect.top - wrapRect.top + scrollRef.current.scrollTop - BAR_H - 6;
      top = above >= 0 ? above : rect.bottom - wrapRect.top + scrollRef.current.scrollTop + 6;
      const center = rect.left + rect.width / 2 - wrapRect.left;
      const half = Math.min(210, wrap.clientWidth / 2 - 8);
      left = Math.min(Math.max(center, half), Math.max(half, wrap.clientWidth - half));
    }
    setIntentBar((prev) =>
      prev && prev.s === range.s && prev.e === range.e && prev.top === top && prev.left === left
        ? prev
        : { s: range.s, e: range.e, top, left }
    );
  };

  /** 意图转换：把选中范围内的段落文本按行提取 → 行级变换 → 回写段落 */
  const applyIntentTransform = (kind: string) => {
    if (!intentBar) return;
    const ce = ceRef.current;
    if (!ce) return;
    const children = Array.from(ce.children);
    const lines: string[] = [];
    const targets: HTMLParagraphElement[] = [];
    for (let i = intentBar.s; i <= intentBar.e && i < children.length; i++) {
      const el = children[i] as HTMLElement;
      if (el.tagName === 'P') {
        targets.push(el as HTMLParagraphElement);
        (el.innerText || '').replace(/\n$/, '').split('\n').forEach((l) => lines.push(l));
      }
    }
    if (!targets.length) {
      setIntentBar(null);
      return;
    }
    const out: string[] = [...lines];
    switch (kind) {
      case 'h2':
        for (let k = 0; k < out.length; k++) {
          const t = (out[k] || '').trim();
          if (t) out[k] = '## ' + t.replace(/^#+\s*/, '');
        }
        break;
      case 'h3':
        for (let k = 0; k < out.length; k++) {
          const t = (out[k] || '').trim();
          if (t) out[k] = '### ' + t.replace(/^#+\s*/, '');
        }
        break;
      case 'list':
        for (let k = 0; k < out.length; k++) {
          const t = (out[k] || '').trim();
          if (t) out[k] = '- ' + t.replace(/^[-•●·✦\s]+/, '');
        }
        break;
      case 'table': {
        const rows: string[] = [];
        for (let k = 0; k < out.length; k++) {
          const t = (out[k] || '').trim();
          if (!t) continue;
          const cells = t.split(/\s*(?:\t|[｜|]\s*|\s{2,}|[,，])\s*/).filter(Boolean);
          rows.push('| ' + cells.join(' | ') + ' |');
        }
        if (rows.length >= 2) {
          const colCount = rows[0].split('|').length - 2;
          rows.splice(1, 0, '| ' + Array(Math.max(colCount, 1)).fill(':---').join(' | ') + ' |');
        }
        out.length = 0;
        rows.forEach((r) => out.push(r));
        break;
      }
      case 'quote':
        for (let k = 0; k < out.length; k++) {
          const t = (out[k] || '').trim();
          if (t) out[k] = '> ' + t;
        }
        break;
      case 'code': {
        const selected = out.filter((l) => l.trim());
        out.length = 0;
        out.push('```', ...selected, '```');
        break;
      }
      case 'caption':
        for (let k = 0; k < out.length; k++) {
          const t = (out[k] || '').trim().replace(/^[*_]+|[*_]+$/g, '');
          if (t) out[k] = '*' + (t.startsWith('▲') ? t : '▲ ' + t) + '*';
        }
        break;
      case 'text':
        for (let k = 0; k < out.length; k++) {
          // 剥离结构标记，回写为普通正文段落（buildParagraph 不再识别出格式）
          out[k] = (out[k] || '')
            .replace(/^ {0,3}#{1,6}[ \t]+/, '')
            .replace(/^ {0,3}>\s?/, '')
            .replace(/^\*▲?\s*([^*]+)\*$/, '$1')
            .trim();
        }
        break;
    }
    // 回写：第一个目标段落替换为全部输出行，其余目标段落移除。
    // 非代码行走 buildParagraph（自动把 ## /> *▲* 识别为语义段落，编辑器仍显示纯文本）；
    // 代码合并为一个代码块：剥掉 out 里的围栏标记行（序列化器负责补围栏），
    // 仅内容行转为语义代码段，首段携带语言标记
    const frag = document.createDocumentFragment();
    if (kind === 'code') {
      const lang = targets[0]?.dataset?.lang || '';
      const body = out.filter((l) => !/^ {0,3}(`{3,}|~{3,})/.test(l));
      if (!body.length) body.push('');
      body.forEach((l, i) => {
        const p = document.createElement('p');
        if (l.trim() === '') p.innerHTML = '<br>';
        else p.textContent = l;
        p.dataset.kind = 'code';
        if (i === 0 && lang) p.dataset.lang = lang;
        frag.appendChild(p);
      });
    } else {
      out.forEach((l) => frag.appendChild(buildParagraph(l)));
    }
    targets[0].replaceWith(frag);
    targets.slice(1).forEach((p) => p.remove());
    setIntentBar(null);
    syncFromDom();
  };

  // ---------- 滚动联动 / 拖放 ----------

  const handleContentScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const max = el.scrollHeight - el.clientHeight;
    onScrollRatio?.(max > 0 ? el.scrollTop / max : 0);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files || []);
    const imgFile = files.find((f) => f.type.startsWith('image/'));
    if (imgFile) {
      pickSlotRef.current = null;
      void handlePickedFile(imgFile);
      return;
    }
    const textFile = files.find((f) => /\.(txt|md|markdown)$/i.test(f.name));
    if (textFile) {
      void (async () => {
        try {
          setIsUploading(true);
          const text = await textFile.text();
          if (!text.trim()) return;
          const caret = captureCaret();
          if (text.includes('![') || text.includes('| ![') || text.includes('photo-card')) {
            insertFragmentNearCaret(buildTextPayloadFragment(text), caret);
          } else {
            text.split('\n').forEach((l) => ceRef.current?.appendChild(buildParagraph(l)));
            normalizeDom();
            syncFromDom();
            focusLastParagraph();
          }
        } catch (err) {
          console.error('Text file drop failed', err);
        } finally {
          setIsUploading(false);
        }
      })();
    }
  };

  const triggerImagePicker = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      pickSlotRef.current = null;
      fileInputRef.current.click();
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) void handlePickedFile(file);
  };

  // 光标落到最后一个段落末尾（点击空白处 / 补空段后）
  const focusLastParagraph = () => {
    const ce = ceRef.current;
    if (!ce) return;
    normalizeDom();
    const last = ce.lastElementChild;
    if (last && last.tagName === 'P') {
      focusParagraphEnd(last);
      ce.focus();
    }
  };

  return (
    <div
      className={`flex flex-col h-full bg-white relative ${isDragging ? 'ring-2 ring-indigo-500 bg-indigo-50/20' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
    >
      {/* 隐藏的本地图片选取 input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileInputChange}
        accept="image/*"
        className="hidden"
      />

      {/* 顶部主工具栏 */}
      <div className="h-11 border-b border-black/[0.05] bg-white flex items-center px-3 sm:px-4 text-sm text-gray-600 flex-shrink-0 gap-2">
        {/* 快捷操作区：撤销重做 + 本地图片插入 + 本地草稿状态 + 多格式范文库 + 一键清空 */}
        <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
          {/* 撤销 / 重做 */}
          <button
            onClick={() => historyRef.current.index > 0 && undo()}
            disabled={!histState.canUndo}
            title="撤销 (⌘Z)"
            className={`p-1.5 rounded-md transition-colors ${
              histState.canUndo ? 'text-gray-500 hover:text-gray-900 hover:bg-gray-100 cursor-pointer' : 'text-gray-200 cursor-not-allowed'
            }`}
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => historyRef.current.index < historyRef.current.stack.length - 1 && redo()}
            disabled={!histState.canRedo}
            title="重做 (⌘⇧Z)"
            className={`p-1.5 rounded-md transition-colors ${
              histState.canRedo ? 'text-gray-500 hover:text-gray-900 hover:bg-gray-100 cursor-pointer' : 'text-gray-200 cursor-not-allowed'
            }`}
          >
            <Redo2 className="w-3.5 h-3.5" />
          </button>
          <span className="hidden sm:block w-px h-4 bg-black/[0.07]" aria-hidden />
          {/* 插入图片按钮 */}
          <button
            onClick={() => triggerImagePicker()}
            disabled={isUploading}
            className="px-2 py-1 rounded-md text-xs text-indigo-700 bg-indigo-50 hover:bg-indigo-100/80 border border-indigo-200 transition-all flex items-center gap-1 cursor-pointer font-medium"
            title="选择本地图片，或直接在编辑区 Cmd+V / Ctrl+V 粘贴截屏"
          >
            {isUploading ? (
              <Loader2 className="w-3 h-3 animate-spin text-indigo-600" />
            ) : (
              <ImageIcon className="w-3 h-3 text-indigo-600" />
            )}
            <span className="hidden sm:inline">插入图片</span>
          </button>

          {/* 本地草稿自动暂存状态胶囊 */}
          {draftStatus && (
            <div className="hidden 2xl:flex items-center gap-1 text-[11px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/80">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>{draftStatus}</span>
            </div>
          )}

          {/* 字符计数 + 阅读时长（中文约 400 字/分钟） */}
          <span className="text-xs text-gray-400" title="正文总字数与预计阅读时长">
            {charCount} 字 · 约 {Math.max(1, Math.ceil(charCount / 400))} 分钟
          </span>

          {/* 示例范文：一键载入 */}
          <button
            onClick={() => onRestoreSample()}
            className="h-7 px-2 rounded-md text-xs text-gray-700 hover:text-indigo-600 hover:bg-indigo-50 transition-all flex items-center gap-1 cursor-pointer font-medium border border-gray-200"
            title="载入示例范文（纯文本智能识别全格式演示）"
          >
            <RotateCcw className="w-3 h-3 text-indigo-500" />
            <span className="hidden md:inline">范文</span>
          </button>

          {/* 一键清空 */}
          <button
            onClick={onClear}
            className="px-2 py-1 rounded-md text-xs text-gray-500 hover:text-red-600 hover:bg-red-50 transition-all flex items-center gap-1 cursor-pointer font-medium border border-gray-200 hover:border-red-200"
            title="一键清空输入框所有内容"
          >
            <Trash2 className="w-3 h-3 text-gray-400 group-hover:text-red-500" />
            <span className="hidden md:inline">清空</span>
          </button>
        </div>
      </div>

      {/* 智能检测状态提示浮条 */}
      <div className="px-4 py-1.5 bg-slate-50/80 border-b border-black/[0.04] flex items-center justify-between text-xs text-gray-500 flex-shrink-0">
        <span className="hidden xl:inline text-[11px] text-gray-400 whitespace-nowrap overflow-hidden text-ellipsis flex-shrink min-w-0" title="选中文字后可使用快捷键与悬浮工具栏">选中文字可转格式 · ⌘B 加粗 · ⌘1/2/3 标题 · ⌘S 保存</span>
        <div className="flex items-center gap-1.5">
          {showsMarkdown ? (
            <span className="inline-flex items-center gap-1 font-medium text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-full text-[11px]">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              已识别：Markdown 输入 · 左侧已转为纯文本编辑
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 font-medium text-indigo-700 bg-indigo-100/70 px-2 py-0.5 rounded-full text-[11px]">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
              {detection.stats?.summaryText || '已识别：自然普通文本 (已智能提取标题、配图、表格与段落)'}
            </span>
          )}

          {/* Markdown 透镜开关：只读查看当前生效的排版用源码（与预览/下载 MD 同源） */}
          {value.trim() && (
            <button
              onClick={() => {
                setIntentBar(null);
                setShowMdSource((prev) => !prev);
              }}
              className={`flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border transition-all cursor-pointer ${
                showMdSource
                  ? 'text-white bg-gray-900 border-gray-900'
                  : 'text-gray-500 bg-white border-gray-200 hover:text-gray-800 hover:border-gray-400'
              }`}
              title={showMdSource ? '返回纯文本编辑' : '只读查看当前生效的排版用 Markdown 源码（与预览/下载 MD 同源）'}
            >
              <Code2 className="w-3 h-3" />
              Markdown
            </button>
          )}
        </div>
      </div>

      {/* 统一编辑面：文本段落 + 内联图片组连续排布 */}
      <div
        ref={scrollRef}
        className="relative flex-1 min-h-0 overflow-y-auto custom-scrollbar"
        onScroll={handleContentScroll}
        onClick={(e) => {
          if (e.target === e.currentTarget) focusLastParagraph();
        }}
      >
        <div
          ref={editSurfaceRef}
          className="relative min-h-full"
          onClick={(e) => {
            if (e.target === e.currentTarget) focusLastParagraph();
          }}
        >
          {/* 悬浮格式菜单：锚定选区上方（随内容滚动保持贴合），不占文档流 */}
          {intentBar && (
            <div
              ref={intentBarRef}
              className="absolute z-30 flex items-center gap-1 px-3 py-1.5 bg-gray-900/95 backdrop-blur text-white text-xs flex-wrap rounded-lg shadow-xl border border-white/10 max-w-[94%]"
              style={{ top: intentBar.top, left: intentBar.left, transform: 'translateX(-50%)' }}
              onMouseDown={(e) => e.preventDefault()}
            >
              <span className="text-gray-400 mr-1">选中 {intentBar.e - intentBar.s + 1} 段：</span>
              {[
                { kind: 'h2', label: 'H2' },
                { kind: 'h3', label: 'H3' },
                { kind: 'list', label: '列表' },
                { kind: 'table', label: '表格' },
                { kind: 'quote', label: '引用' },
                { kind: 'code', label: '代码' },
                { kind: 'caption', label: '题注' },
                { kind: 'text', label: '正文' },
              ].map((item) => (
                <button
                  key={item.kind}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => applyIntentTransform(item.kind)}
                  className="px-2 py-0.5 rounded hover:bg-white/20 cursor-pointer whitespace-nowrap"
                >
                  {item.label}
                </button>
              ))}
              <button
                onClick={() => setIntentBar(null)}
                className="ml-1 px-1.5 py-0.5 rounded hover:bg-white/20 text-gray-400 cursor-pointer"
              >
                ×
              </button>
            </div>
          )}
          <div
            ref={ceRef}
            contentEditable
            suppressContentEditableWarning
            spellCheck={false}
            className={`wenpai-ce px-4 py-4 min-h-full outline-none text-[15px] leading-[1.9] tracking-[0.01em] text-gray-800 cursor-text ${
              showMdSource ? 'hidden' : ''
            }`}
            onInput={() => syncFromDom()}
            onPaste={handlePaste}
            onKeyDown={handleKeyDown}
            onSelect={handleSelect}
            onBlur={() => setTimeout(() => setIntentBar((prev) => (prev ? null : prev)), 200)}
          />
          {showMdSource && (
            <pre className="px-4 py-4 min-h-full whitespace-pre-wrap break-words font-mono text-[13px] leading-[1.85] text-gray-700 select-text">
              {markdownSource ?? value}
            </pre>
          )}
          {isUploading && (
            <div className="flex items-center gap-2 text-xs text-indigo-600 py-2 px-4">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              正在处理图片…
            </div>
          )}
        </div>
      </div>

      {/* 空状态引导：无内容时给出起点 */}
      {!value.trim() && (
        <div className="absolute inset-x-0 top-28 bottom-10 flex flex-col items-center justify-center gap-1.5 text-center pointer-events-none select-none">
          <div className="text-4xl mb-1">📝</div>
          <p className="text-sm text-gray-400">粘贴你的文稿开始排版，或直接拖入 / 截图粘贴图片</p>
          <p className="text-xs text-gray-300">⌘B 加粗 · ⌘I 斜体 · ⌘1/2/3 标题 · 选中文字可快速转格式</p>
          <button
            onClick={() => onRestoreSample()}
            className="mt-2 pointer-events-auto px-3.5 py-1.5 rounded-full bg-indigo-50 text-indigo-700 text-xs font-medium border border-indigo-200 hover:bg-indigo-100 transition-colors cursor-pointer"
          >
            载入范文试一试
          </button>
        </div>
      )}

      {isDragging && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-indigo-50/80 text-indigo-600 text-sm font-medium pointer-events-none">
          松开鼠标，插入图片
        </div>
      )}
    </div>
  );
}
