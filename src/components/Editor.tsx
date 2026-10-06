'use client';

import {
  Undo2,
  Redo2,
  FlaskConical,
  Trash2,
  Sparkles,
  FileText,
  Code2,
  Wand2,
  RotateCcw,
  ChevronDown,
  FileCheck2,
  Image as ImageIcon,
  Loader2,
} from 'lucide-react';
import { detectContentFormat, convertPlainTextToMarkdown } from '@/lib/smart-parser';

import { compressAndEncodeImage } from '@/lib/image-utils';
import { putImageDataUrl, resolveImageSrc } from '@/lib/image-store';
import type { ConversionDecision } from '@/lib/smart-parser';
import React, { useMemo, useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';

export type ContentMode = 'auto' | 'plain-text' | 'markdown';

interface EditorProps {
  value: string;
  onChange: (value: string) => void;
  mode: ContentMode;
  onModeChange: (mode: ContentMode) => void;
  onClear: () => void;
  onRestoreSample: (presetKey?: string) => void;
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

/** 自适应高度文本域：文本块编辑器 */
function AutoTextarea(props: {
  value: string;
  onChange: (v: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onSelect?: (e: React.SyntheticEvent<HTMLTextAreaElement>) => void;
  onPaste?: (e: React.ClipboardEvent<HTMLTextAreaElement>) => void;
  onBlur?: () => void;
  placeholder?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = el.scrollHeight + 'px';
    }
  }, [props.value]);
  return (
    <textarea
      ref={ref}
      value={props.value}
      onChange={(e) => props.onChange(e.target.value)}
      onKeyDown={props.onKeyDown}
      onSelect={props.onSelect}
      onPaste={props.onPaste}
      onBlur={props.onBlur}
      placeholder={props.placeholder}
      spellCheck={false}
      rows={1}
      className="w-full resize-none outline-none text-[15px] leading-[1.9] tracking-[0.01em] text-gray-800 bg-transparent overflow-hidden min-h-[28px] placeholder:text-gray-300"
    />
  );
}

/** 图片块卡片：真实图片按布局网格展示，悬停出现布局切换与删除，图下可编辑题注 */
function ImageBlockCard(props: {
  block: Extract<EditorBlock, { kind: 'images' }>;
  onLayout: (l: 1 | 2 | 3) => void;
  onCaption: (k: number, cap: string) => void;
  onRemove: () => void;
  onPolaroid: (v: boolean) => void;
  onPickSlotImage: (slot: number, file: File) => void;
}) {
  const { block, onLayout, onCaption, onRemove, onPolaroid, onPickSlotImage } = props;
  const cols = block.layout;
  // 题注本地草稿态：输入时只改本地，失焦/回车才提交一次（避免每次击键都全篇序列化往返）。
  // 外部 captions 变化（引用比较）时在渲染期同步草稿，不经过 effect
  const [draftCaps, setDraftCaps] = useState<string[]>(block.captions);
  const [lastSeenCaps, setLastSeenCaps] = useState<string[]>(block.captions);
  if (lastSeenCaps !== block.captions) {
    setLastSeenCaps(block.captions);
    setDraftCaps(block.captions);
  }
  const commitCaption = (k: number) => {
    const v = (draftCaps[k] || '').trim();
    if (v !== (block.captions[k] || '')) onCaption(k, v);
  };
  // 空位补图：点击占位格选择本地图片
  const [pickSlot, setPickSlot] = useState<number | null>(null);
  const slotInputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="relative group rounded-xl border border-black/[0.06] bg-gray-50/60 p-3 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
      <div className="absolute right-2 top-2 z-10 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity bg-white/95 rounded-lg border border-gray-200 px-1 py-0.5 shadow-sm">
        {([1, 2, 3] as const).map((n) => (
          <button
            key={n}
            onClick={() => onLayout(n)}
            title={n === 1 ? '单图（各占一行）' : n + ' 列画廊；图片不足的格子可点击后补图'}
            className={`px-1.5 py-0.5 rounded text-[11px] font-medium cursor-pointer transition-colors ${
              block.layout === n ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            {n}列
          </button>
        ))}
        {block.images.length === 1 && block.layout === 1 && (
          <button
            onClick={() => onPolaroid(!block.polaroid)}
            title="拍立得衬底卡片（Dark Mode 安全型）：白底留白护城河，暗色主题下图片更耐看"
            className={`px-1.5 py-0.5 rounded text-[11px] font-medium cursor-pointer transition-colors ${
              block.polaroid ? 'bg-slate-700 text-white' : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            {block.polaroid ? '安全型开' : '安全型'}
          </button>
        )}
        <button
          onClick={onRemove}
          title="删除此图片块"
          className="px-1.5 py-0.5 rounded text-[11px] text-red-500 hover:bg-red-50 cursor-pointer font-medium"
        >
          删除
        </button>
      </div>
      <div className={`grid gap-2 ${cols === 1 ? 'grid-cols-1' : cols === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
        {(() => {
          const rowCount = Math.max(1, Math.ceil(block.images.length / cols));
          const cellCount = Math.max(block.images.length, rowCount * cols);
          return Array.from({ length: cellCount }, (_, k) => {
            const img = block.images[k];
            if (!img || !img.src) {
              return (
                <button
                  key={'slot-' + k}
                  onClick={() => {
                    setPickSlot(k);
                    slotInputRef.current?.click();
                  }}
                  className="rounded-lg border border-dashed border-gray-300/90 bg-white/70 flex flex-col items-center justify-center gap-1 min-h-[140px] text-gray-400 hover:border-indigo-400 hover:text-indigo-500 hover:bg-indigo-50/30 transition-colors cursor-pointer"
                  title="选择本地图片填充此格子"
                >
                  <ImageIcon className="w-6 h-6" />
                  <span className="text-[11px]">添加图片</span>
                </button>
              );
            }
            // display-only：剥掉 src 上的 title 后缀（如 /a.jpg "标题"），避免卡片加载失败
            const displaySrc = (resolveImageSrc(img.src) || img.src).replace(/\s+(["'])(?:(?!\1).)*\1\s*$/, '');
            const resolved = displaySrc;
            return (
            <div key={k} className="flex flex-col gap-1.5 min-w-0">
              <div
                className={
                  'rounded-lg border border-black/[0.06] bg-white overflow-hidden flex items-center justify-center ' +
                  (block.polaroid ? 'p-3 pb-4 shadow-[0_2px_8px_rgba(15,23,42,0.06)]' : '')
                }
              >
                {resolved ? (
                  <img
                    src={resolved}
                    alt={img.alt}
                    className={block.polaroid ? 'w-full rounded-sm' : 'w-full max-h-[320px] object-contain'}
                  />
                ) : (
                  <div className="w-full h-28 flex items-center justify-center text-[12px] text-gray-400 border-dashed">
                    图片已失效
                  </div>
                )}
              </div>
              <input
                value={draftCaps[k] || ''}
                onChange={(e) => setDraftCaps((prev) => prev.map((c, kk) => (kk === k ? e.target.value : c)))}
                onBlur={() => commitCaption(k)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    (e.target as HTMLInputElement).blur();
                  }
                }}
                placeholder="题注（如：图 1 · 说明文字）"
                className="w-full text-[12px] text-gray-500 bg-transparent border-b border-dashed border-gray-200 focus:border-blue-400 outline-none px-1 py-0.5 text-center"
              />
            </div>
            );
          });
        })()}
      </div>
    </div>
  );
}

export function Editor({
    value,
    onChange,
    mode,
    onModeChange,
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
  const [showPresetMenu, setShowPresetMenu] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  // 选中行意图转换工具栏：{ 文本块索引, 块内起始行, 块内结束行 }
  const [intentBar, setIntentBar] = useState<{ blockIdx: number; s: number; e: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pendingFocusRef = useRef(false);

  // 分块：文本块（源码编辑）与图片块（可视化编辑）交替。
  // 编辑态以 blocksState 为准（保留文本块行尾换行等编辑意图），
  // 仅当外部 value 变化（载入范文/清空/AI/粘贴全文）时才重新解析——
  // 否则「文本末尾按回车」产生的行尾空行会被 parse 的尾部剥除吞掉
  const [blocksState, setBlocksState] = useState<EditorBlock[]>(() => parseEditorBlocks(value));
  const [lastSerialized, setLastSerialized] = useState(value);
  if (value !== lastSerialized) {
    setLastSerialized(value);
    setBlocksState(parseEditorBlocks(value));
  }
  const rawBlocks = blocksState;
  const blocks = rawBlocks.length > 0 ? rawBlocks : [{ kind: 'text' as const, lines: [''] }];

  // 实时分析文本格式
  const detection = useMemo(() => detectContentFormat(value), [value]);

  const commitBlocks = (next: EditorBlock[], reparse?: boolean) => {
    let final = next;
    if (reparse) {
      const reparsed = parseEditorBlocks(serializeEditorBlocks(next));
      // 只剩图片块时（如空文档贴图）自动补一个空文本块，保证始终有可输入位置
      final = reparsed.some((b) => b.kind === 'text')
        ? reparsed
        : [...reparsed, { kind: 'text' as const, lines: [''] }];
      if (final.length !== reparsed.length) pendingFocusRef.current = true;
    }
    const md = serializeEditorBlocks(final);
    setBlocksState(final);
    setLastSerialized(md);
    onChange(md);
  };
  const updateBlocks = (next: EditorBlock[]) => commitBlocks(next, true);
  const updateTextBlock = (idx: number, text: string) => {
    commitBlocks(
      blocks.map((b, k) => (k === idx && b.kind === 'text' ? { kind: 'text' as const, lines: text.split('\n') } : b)),
      false
    );
  };
  const updateImageBlock = (
    idx: number,
    patch: { images?: ImageItem[]; captions?: string[]; layout?: 1 | 2 | 3; polaroid?: boolean }
  ) => {
    updateBlocks(
      blocks.map((b, k) => (k === idx && b.kind === 'images' ? { ...b, ...patch } : b))
    );
  };
  const removeImageBlock = (idx: number) => {
    updateBlocks(blocks.filter((_, k) => k !== idx));
  };

  // 布局切换：2/3 列时合并相邻（中间无文本块）的图片块；
  // 图片不足列数也允许切换——不足的格子渲染为「添加图片」占位，随后补图
  const setImageLayout = (idx: number, layout: 1 | 2 | 3) => {
    const target = blocks[idx];
    if (!target || target.kind !== 'images') return;
    if (layout === 1) {
      if (target.images.length > 1) {
        // 拆回单图：每张独立一个图片块
        const next: EditorBlock[] = [];
        blocks.forEach((b, k) => {
          if (k !== idx || b.kind !== 'images') {
            next.push(b);
            return;
          }
          b.images.forEach((img, kk) =>
            next.push({ kind: 'images', images: [img], captions: [b.captions[kk] || ''], layout: 1, polaroid: false })
          );
        });
        updateBlocks(next);
        return;
      }
      updateImageBlock(idx, { layout: 1 });
      return;
    }
    let start = idx;
    let end = idx;
    const isImageBlock = (k: number) => blocks[k] && blocks[k].kind === 'images';
    while (start - 1 >= 0 && isImageBlock(start - 1)) start--;
    while (end + 1 < blocks.length && isImageBlock(end + 1)) end++;
    const groupImages: ImageItem[] = [];
    const groupCaptions: string[] = [];
    for (let k = start; k <= end; k++) {
      const b = blocks[k];
      if (b.kind !== 'images') continue;
      b.images.forEach((im, kk) => {
        groupImages.push(im);
        groupCaptions.push(b.captions[kk] || '');
      });
    }
    const merged: EditorBlock = { kind: 'images', images: groupImages, captions: groupCaptions, layout, polaroid: false };
    updateBlocks([...blocks.slice(0, start), merged, ...blocks.slice(end + 1)]);
  };

  // ===== 撤销/重做：基于文档快照的栈 =====
  // 所有文档变化（打字/块操作/范文/清空/AI）统一在此记账：
  // 500ms 内的连续变化合并为一个快照（打字不爆炸），块操作各成一步
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
    setLastSerialized(md);
    setBlocksState(parseEditorBlocks(md));
    onChange(md);
    syncHistState();
  };
  const undo = useCallback(() => {
    const h = historyRef.current;
    if (h.index <= 0) return;
    h.index -= 1;
    applyHistory(h.stack[h.index]);
  }, [onChange]);
  const redo = useCallback(() => {
    const h = historyRef.current;
    if (h.index >= h.stack.length - 1) return;
    h.index += 1;
    applyHistory(h.stack[h.index]);
  }, [onChange]);

  // 全局 ⌘Z / ⌘⇧Z / Ctrl+Y（覆盖文本块内外的所有场景）
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

  // 图片插入后自动聚焦新增的空文本块（贴图后可直接打字）
  useEffect(() => {
    if (!pendingFocusRef.current) return;
    pendingFocusRef.current = false;
    const tas = Array.from((scrollRef.current || document).querySelectorAll('textarea'));
    const last = tas[tas.length - 1];
    if (last) {
      last.focus();
      const n = last.value.length;
      last.setSelectionRange(n, n);
    }
  }, [blocksState]);

  // 点击块与块之间的空白区域 → 聚焦最近的文本块
  const focusLastTextBlock = () => {
    const tas = Array.from((scrollRef.current || document).querySelectorAll('textarea'));
    const last = tas[tas.length - 1];
    if (last) {
      last.focus();
      const n = last.value.length;
      last.setSelectionRange(n, n);
    }
  };

  // 点击外部自动关闭范文下拉菜单
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowPresetMenu(false);
      }
    }
    if (showPresetMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showPresetMenu]);

  // 一键将当前普通文本转为标准 Markdown 填回编辑器
  const handleConvertToMarkdown = () => {
    if (!value.trim()) return;
    onChange(convertPlainTextToMarkdown(value, { treatFirstLineAsTitle: firstLineAsTitle }));
  };

  // 插入图片（工具栏/拖放/文件选择）：图片入库并在文末追加图片块
  const insertImageMarkdown = async (file: File) => {
    try {
      setIsUploading(true);
      const { dataUrl, fileName } = await compressAndEncodeImage(file);
      const cleanAlt = fileName.replace(/\.[^/.]+$/, '') || '配图';
      const { token, persisted } = putImageDataUrl(dataUrl);
      const imageBlock: EditorBlock = {
        kind: 'images',
        images: [{ alt: cleanAlt, src: persisted ? token : dataUrl }],
        captions: [''],
        layout: 1,
      };
      onChange(serializeEditorBlocks([...blocks, imageBlock]));
    } catch (err) {
      console.error('Image insertion failed', err);
    } finally {
      setIsUploading(false);
    }
  };

  // 粘贴：图片文件 → 存入库并在光标处插入图片块；文本粘贴走浏览器原生行为
  const makePasteHandler = (blockIdx: number) => async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const cd = e.clipboardData;
    if (!cd) return;
    const files = Array.from(cd.files || []);
    const items = Array.from(cd.items || []);
    const itemImg = items.find((it) => it.type.startsWith('image/'));
    const imgFile = files.find((f) => f.type.startsWith('image/')) || (itemImg ? itemImg.getAsFile() : null);
    if (!imgFile) return;
    e.preventDefault();
    // currentTarget 在异步等待后会置空，必须在事件同步阶段先捕获
    const ta = e.currentTarget;
    const caretStart = ta.selectionStart ?? 0;
    const caretEnd = ta.selectionEnd ?? caretStart;
    setIsUploading(true);
    try {
      const { dataUrl, fileName } = await compressAndEncodeImage(imgFile);
      const cleanAlt = fileName.replace(/\.[^/.]+$/, '') || '配图';
      const { token, persisted } = putImageDataUrl(dataUrl);
      const src = persisted ? token : dataUrl;
      const start = caretStart;
      const end = caretEnd;
      const b = blocks[blockIdx];
      const text = b && b.kind === 'text' ? b.lines.join('\n') : '';
      const next = text.slice(0, start) + '\n\n![' + cleanAlt + '](' + src + ')\n\n' + text.slice(end);
      // 粘贴引入了图片行，需要重解析拆出独立图片块
      commitBlocks(
        blocks.map((b, k) => (k === blockIdx && b.kind === 'text' ? { kind: 'text' as const, lines: next.split('\n') } : b)),
        true
      );
    } catch (err) {
      console.error('Image paste failed', err);
    } finally {
      setIsUploading(false);
    }
  };

  // 拖放图片支持
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files || []);
    const imgFile = files.find((f) => f.type.startsWith('image/'));
    if (imgFile) insertImageMarkdown(imgFile);
  };

  // 触发本地文件选取
  const triggerImagePicker = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) insertImageMarkdown(file);
  };

  // 编辑区滚动 → 按比例联动右侧预览
  const handleContentScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const max = el.scrollHeight - el.clientHeight;
    onScrollRatio?.(max > 0 ? el.scrollTop / max : 0);
  };

  // 快捷键（文本块内）：⌘B 加粗 / ⌘I 斜体 / ⌘1~3 标题 / ⌘S 保存草稿
  const makeKeyDownHandler = (blockIdx: number, text: string) => (
    e: React.KeyboardEvent<HTMLTextAreaElement>
  ) => {
    if (!(e.metaKey || e.ctrlKey)) return;
    const k = e.key.toLowerCase();
    const ta = e.currentTarget;
    const apply = (next: string, c1: number, c2: number) => {
      updateTextBlock(blockIdx, next);
      requestAnimationFrame(() => {
        ta.focus();
        ta.setSelectionRange(c1, c2);
      });
    };
    if (k === 'b' || k === 'i') {
      e.preventDefault();
      const mark = k === 'b' ? '**' : '*';
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const selected = text.slice(start, end);
      let next: string;
      let c1: number;
      let c2: number;
      if (selected.startsWith(mark) && selected.endsWith(mark) && selected.length >= mark.length * 2) {
        const inner = selected.slice(mark.length, selected.length - mark.length);
        next = text.slice(0, start) + inner + text.slice(end);
        c1 = start;
        c2 = start + inner.length;
      } else if (!selected) {
        next = text.slice(0, start) + mark + mark + text.slice(end);
        c1 = start + mark.length;
        c2 = c1;
      } else {
        next = text.slice(0, start) + mark + selected + mark + text.slice(end);
        c1 = start + mark.length;
        c2 = c1 + selected.length;
      }
      apply(next, c1, c2);
    } else if (k === 's') {
      e.preventDefault();
      onSaveDraft?.();
    } else if (k === '1' || k === '2' || k === '3') {
      e.preventDefault();
      const level = Number(k);
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const lineStart = text.lastIndexOf('\n', start - 1) + 1;
      const nl = text.indexOf('\n', end);
      const lineEnd = nl === -1 ? text.length : nl;
      const prefix = '#'.repeat(level) + ' ';
      const newBlock = text
        .slice(lineStart, lineEnd)
        .split('\n')
        .map((l) => prefix + l.replace(/^#{1,6}\s*/, ''))
        .join('\n');
      apply(text.slice(0, lineStart) + newBlock + text.slice(lineEnd), lineStart, lineStart + newBlock.length);
    }
  };

  // 选中文本块内容 → 显示意图转换工具栏（块内行号）
  const makeSelectHandler = (blockIdx: number, text: string) => (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    const ta = e.currentTarget;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    if (start === end) {
      setIntentBar((prev) => (prev && prev.blockIdx === blockIdx ? null : prev));
      return;
    }
    const s = text.slice(0, start).split('\n').length - 1;
    const selected = text.slice(start, end);
    const eLine = s + selected.split('\n').length - 1;
    setIntentBar({ blockIdx, s, e: eLine });
  };

  // 意图转换（块内行级操作：直接改写源码行）
  const applyIntentTransform = (kind: string) => {
    if (!intentBar) return;
    const { blockIdx, s, e } = intentBar;
    const b = blocks[blockIdx];
    if (!b || b.kind !== 'text') {
      setIntentBar(null);
      return;
    }
    const lines = [...b.lines];
    switch (kind) {
      case 'h2':
        for (let k = s; k <= e; k++) {
          const t = (lines[k] || '').trim();
          if (t) lines[k] = '## ' + t.replace(/^#+\s*/, '');
        }
        break;
      case 'h3':
        for (let k = s; k <= e; k++) {
          const t = (lines[k] || '').trim();
          if (t) lines[k] = '### ' + t.replace(/^#+\s*/, '');
        }
        break;
      case 'list':
        for (let k = s; k <= e; k++) {
          const t = (lines[k] || '').trim();
          if (t) lines[k] = '- ' + t.replace(/^[-•●·✦\s]+/, '');
        }
        break;
      case 'table': {
        const rows: string[] = [];
        for (let k = s; k <= e; k++) {
          const t = (lines[k] || '').trim();
          if (!t) continue;
          const cells = t.split(/\s*(?:\t|[｜|]\s*|\s{2,}|[,，])\s*/).filter(Boolean);
          rows.push('| ' + cells.join(' | ') + ' |');
        }
        if (rows.length >= 2) {
          const colCount = rows[0].split('|').length - 2;
          rows.splice(1, 0, '| ' + Array(Math.max(colCount, 1)).fill(':---').join(' | ') + ' |');
        }
        lines.splice(s, e - s + 1, ...rows);
        break;
      }
      case 'quote':
        for (let k = s; k <= e; k++) {
          const t = (lines[k] || '').trim();
          if (t) lines[k] = '> ' + t;
        }
        break;
      case 'code': {
        const selected = lines.slice(s, e + 1);
        lines.splice(s, e - s + 1, '```', ...selected, '```');
        break;
      }
      case 'caption':
        for (let k = s; k <= e; k++) {
          const t = (lines[k] || '').trim().replace(/^[*_]+|[*_]+$/g, '');
          if (t) lines[k] = '*' + (t.startsWith('▲') ? t : '▲ ' + t) + '*';
        }
        break;
      case 'text':
        for (let k = s; k <= e; k++) {
          lines[k] = (lines[k] || '').trim();
        }
        break;
    }
    updateTextBlock(blockIdx, lines.join('\n'));
    setIntentBar(null);
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

      {/* 隐藏的本地图片选取 input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileInputChange}
        accept="image/*"
        className="hidden"
      />

      {/* 顶部主工具栏 */}
      <div className="h-11 border-b border-black/[0.05] bg-white flex items-center px-3 sm:px-4 text-sm text-gray-600 justify-between flex-shrink-0 gap-2">
        <div className="flex items-center gap-2 min-w-0">

          {/* 模式选择切换（自动识别 / 纯文本 / Markdown） */}
          <div className="flex items-center bg-gray-100 ring-1 ring-black/[0.04] p-0.5 rounded-lg text-xs">
            <button
              onClick={() => onModeChange('auto')}
              className={`px-2 py-1 rounded-md transition-all flex items-center gap-1 font-medium cursor-pointer ${
                mode === 'auto'
                  ? 'bg-white text-indigo-600 shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              title="智能检测并自动排版"
            >
              <Sparkles className="w-3 h-3 text-amber-500" />
              <span>自动</span>
            </button>
            <button
              onClick={() => onModeChange('plain-text')}
              className={`px-2 py-1 rounded-md transition-all flex items-center gap-1 cursor-pointer ${
                mode === 'plain-text'
                  ? 'bg-white text-indigo-600 shadow-xs font-medium'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              title="强制按纯文本提取层级排版"
            >
              <FileText className="w-3 h-3" />
              <span>纯文本</span>
            </button>
            <button
              onClick={() => onModeChange('markdown')}
              className={`px-2 py-1 rounded-md transition-all flex items-center gap-1 cursor-pointer ${
                mode === 'markdown'
                  ? 'bg-white text-indigo-600 shadow-xs font-medium'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              title="按原始 Markdown 语法渲染"
            >
              <Code2 className="w-3 h-3" />
              <span>MD</span>
            </button>
          </div>
        </div>

        {/* 快捷操作区：本地图片插入 + 本地草稿状态 + 多格式范文库 + 一键清空 */}
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
            title="选择本地图片，或直接在输入框 Cmd+V / Ctrl+V 粘贴截屏"
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

          {/* 多格式范文库快捷下拉 */}
          <div className="relative" ref={menuRef}>
            <div className="flex items-center">
              <button
                onClick={() => onRestoreSample('all-round-markdown')}
                className="px-2 py-1 rounded-l-md text-xs text-gray-700 hover:text-indigo-600 hover:bg-indigo-50 transition-all flex items-center gap-1 cursor-pointer font-medium border border-gray-200 border-r-0"
                title="载入全能 Markdown 范文（含单图、双排图、三排画廊、表格、代码、清单）"
              >
                <RotateCcw className="w-3 h-3 text-indigo-500" />
                <span className="hidden md:inline">范文</span>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowPresetMenu((prev) => !prev);
                }}
                className="px-1.5 py-1 rounded-r-md text-[11px] text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 transition-all cursor-pointer font-medium border border-gray-200 flex items-center"
                title="选择更多不同格式的测试范文"
              >
                <ChevronDown
                  className={`w-3 h-3 transition-transform pointer-events-none ${
                    showPresetMenu ? 'rotate-180 text-indigo-600' : ''
                  }`}
                />
              </button>
            </div>

            {/* 下拉范文选项卡片 */}
            {showPresetMenu && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="absolute right-0 top-full mt-1.5 w-72 max-h-[70vh] overflow-y-auto custom-scrollbar bg-white border border-gray-200 shadow-xl rounded-xl p-1.5 z-50"
              >
                <div className="px-2 py-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                  选择测试范文类型
                </div>

                <button
                  onClick={() => {
                    onRestoreSample('all-round-markdown');
                    setShowPresetMenu(false);
                  }}
                  className="w-full text-left px-2.5 py-2.5 rounded-lg text-xs text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 transition-all flex items-start gap-2.5 cursor-pointer group border-b border-gray-100"
                >
                  <FileCheck2 className="w-4 h-4 text-indigo-500 mt-0.5 shrink-0" />
                  <div>
                    <div className="font-semibold text-gray-800 group-hover:text-indigo-700 flex items-center gap-1.5">
                      <span>全能旗舰 Markdown 范文</span>
                      <span className="text-[10px] bg-blue-100 text-indigo-700 px-1.5 py-0.2 rounded font-normal">
                        全格式
                      </span>
                    </div>
                    <div className="text-[11px] text-gray-400 leading-tight mt-1">
                      单图、双排图、三排画廊、大标题、任务清单、对齐表格、多语言代码、文末脚注
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => {
                    onRestoreSample('all-round-plain-text');
                    setShowPresetMenu(false);
                  }}
                  className="w-full text-left px-2.5 py-2.5 rounded-lg text-xs text-gray-700 hover:bg-amber-50 hover:text-amber-800 transition-all flex items-start gap-2.5 cursor-pointer group"
                >
                  <FileText className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                  <div>
                    <div className="font-semibold text-gray-800 group-hover:text-amber-800 flex items-center gap-1.5">
                      <span>全能旗舰自然纯文本范文</span>
                      <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.2 rounded font-normal">
                        智能识别
                      </span>
                    </div>
                    <div className="text-[11px] text-gray-400 leading-tight mt-1">
                      自然文本配图、管道符表格、纯文本代码段、问答访谈、智能分段呼吸感
                    </div>
                  </div>
                </button>

                <div className="px-2 pt-1.5 pb-1 text-[10px] font-semibold text-indigo-400 uppercase tracking-wider border-t border-gray-100 mt-1">Ten Test Articles · 智能识别压测</div>
                <button
                  onClick={() => {
                    onRestoreSample('test01-plain');
                    setShowPresetMenu(false);
                  }}
                  className="w-full text-left px-2.5 py-2 rounded-lg text-xs text-gray-700 hover:bg-indigo-50 hover:text-indigo-800 transition-all flex items-start gap-2.5 cursor-pointer group"
                >
                  <FlaskConical className="w-4 h-4 text-indigo-400 mt-0.5 shrink-0" />
                  <div>
                    <div className="font-semibold text-gray-800 group-hover:text-indigo-800 flex items-center gap-1.5">
                      <span>测试01 · 深度评测长文</span>
                    </div>
                    <div className="text-[11px] text-gray-400 leading-tight mt-0.5">多级章节、对齐表格、编号列表、小数评分边界</div>
                  </div>
                </button>
                <button
                  onClick={() => {
                    onRestoreSample('test02-plain');
                    setShowPresetMenu(false);
                  }}
                  className="w-full text-left px-2.5 py-2 rounded-lg text-xs text-gray-700 hover:bg-indigo-50 hover:text-indigo-800 transition-all flex items-start gap-2.5 cursor-pointer group"
                >
                  <FlaskConical className="w-4 h-4 text-indigo-400 mt-0.5 shrink-0" />
                  <div>
                    <div className="font-semibold text-gray-800 group-hover:text-indigo-800 flex items-center gap-1.5">
                      <span>测试02 · 图文安装教程</span>
                    </div>
                    <div className="text-[11px] text-gray-400 leading-tight mt-0.5">步骤编号与配图穿插、图注、缩进代码块</div>
                  </div>
                </button>
                <button
                  onClick={() => {
                    onRestoreSample('test03-plain');
                    setShowPresetMenu(false);
                  }}
                  className="w-full text-left px-2.5 py-2 rounded-lg text-xs text-gray-700 hover:bg-indigo-50 hover:text-indigo-800 transition-all flex items-start gap-2.5 cursor-pointer group"
                >
                  <FlaskConical className="w-4 h-4 text-indigo-400 mt-0.5 shrink-0" />
                  <div>
                    <div className="font-semibold text-gray-800 group-hover:text-indigo-800 flex items-center gap-1.5">
                      <span>测试03 · 创始人访谈</span>
                    </div>
                    <div className="text-[11px] text-gray-400 leading-tight mt-0.5">问答结构、引用行、金句候选短段</div>
                  </div>
                </button>
                <button
                  onClick={() => {
                    onRestoreSample('test04-plain');
                    setShowPresetMenu(false);
                  }}
                  className="w-full text-left px-2.5 py-2 rounded-lg text-xs text-gray-700 hover:bg-indigo-50 hover:text-indigo-800 transition-all flex items-start gap-2.5 cursor-pointer group"
                >
                  <FlaskConical className="w-4 h-4 text-indigo-400 mt-0.5 shrink-0" />
                  <div>
                    <div className="font-semibold text-gray-800 group-hover:text-indigo-800 flex items-center gap-1.5">
                      <span>测试04 · 政务公文风</span>
                    </div>
                    <div className="text-[11px] text-gray-400 leading-tight mt-0.5">第一章/第一节/一、/（一）四级章节体系</div>
                  </div>
                </button>
                <button
                  onClick={() => {
                    onRestoreSample('test05-plain');
                    setShowPresetMenu(false);
                  }}
                  className="w-full text-left px-2.5 py-2 rounded-lg text-xs text-gray-700 hover:bg-indigo-50 hover:text-indigo-800 transition-all flex items-start gap-2.5 cursor-pointer group"
                >
                  <FlaskConical className="w-4 h-4 text-indigo-400 mt-0.5 shrink-0" />
                  <div>
                    <div className="font-semibold text-gray-800 group-hover:text-indigo-800 flex items-center gap-1.5">
                      <span>测试05 · 工程手记</span>
                    </div>
                    <div className="text-[11px] text-gray-400 leading-tight mt-0.5">多语言代码块、围栏与语言标记、文末链接</div>
                  </div>
                </button>
                <button
                  onClick={() => {
                    onRestoreSample('test06-plain');
                    setShowPresetMenu(false);
                  }}
                  className="w-full text-left px-2.5 py-2 rounded-lg text-xs text-gray-700 hover:bg-indigo-50 hover:text-indigo-800 transition-all flex items-start gap-2.5 cursor-pointer group"
                >
                  <FlaskConical className="w-4 h-4 text-indigo-400 mt-0.5 shrink-0" />
                  <div>
                    <div className="font-semibold text-gray-800 group-hover:text-indigo-800 flex items-center gap-1.5">
                      <span>测试06 · 运营周报</span>
                    </div>
                    <div className="text-[11px] text-gray-400 leading-tight mt-0.5">时间线日程、日期段落、百分比、跳号清单</div>
                  </div>
                </button>
                <button
                  onClick={() => {
                    onRestoreSample('test07-plain');
                    setShowPresetMenu(false);
                  }}
                  className="w-full text-left px-2.5 py-2 rounded-lg text-xs text-gray-700 hover:bg-indigo-50 hover:text-indigo-800 transition-all flex items-start gap-2.5 cursor-pointer group"
                >
                  <FlaskConical className="w-4 h-4 text-indigo-400 mt-0.5 shrink-0" />
                  <div>
                    <div className="font-semibold text-gray-800 group-hover:text-indigo-800 flex items-center gap-1.5">
                      <span>测试07 · 旅行攻略</span>
                    </div>
                    <div className="text-[11px] text-gray-400 leading-tight mt-0.5">★●◆符号列表、callout提示、✓✗任务</div>
                  </div>
                </button>
                <button
                  onClick={() => {
                    onRestoreSample('test08-plain');
                    setShowPresetMenu(false);
                  }}
                  className="w-full text-left px-2.5 py-2 rounded-lg text-xs text-gray-700 hover:bg-indigo-50 hover:text-indigo-800 transition-all flex items-start gap-2.5 cursor-pointer group"
                >
                  <FlaskConical className="w-4 h-4 text-indigo-400 mt-0.5 shrink-0" />
                  <div>
                    <div className="font-semibold text-gray-800 group-hover:text-indigo-800 flex items-center gap-1.5">
                      <span>测试08 · 读书笔记</span>
                    </div>
                    <div className="text-[11px] text-gray-400 leading-tight mt-0.5">书名号、引用块、编号参考文献与链接</div>
                  </div>
                </button>
                <button
                  onClick={() => {
                    onRestoreSample('test09-plain');
                    setShowPresetMenu(false);
                  }}
                  className="w-full text-left px-2.5 py-2 rounded-lg text-xs text-gray-700 hover:bg-indigo-50 hover:text-indigo-800 transition-all flex items-start gap-2.5 cursor-pointer group"
                >
                  <FlaskConical className="w-4 h-4 text-indigo-400 mt-0.5 shrink-0" />
                  <div>
                    <div className="font-semibold text-gray-800 group-hover:text-indigo-800 flex items-center gap-1.5">
                      <span>测试09 · 需求文档</span>
                    </div>
                    <div className="text-[11px] text-gray-400 leading-tight mt-0.5">多级编号、任务清单、✅❌验收对照</div>
                  </div>
                </button>
                <button
                  onClick={() => {
                    onRestoreSample('test10-plain');
                    setShowPresetMenu(false);
                  }}
                  className="w-full text-left px-2.5 py-2 rounded-lg text-xs text-gray-700 hover:bg-indigo-50 hover:text-indigo-800 transition-all flex items-start gap-2.5 cursor-pointer group"
                >
                  <FlaskConical className="w-4 h-4 text-indigo-400 mt-0.5 shrink-0" />
                  <div>
                    <div className="font-semibold text-gray-800 group-hover:text-indigo-800 flex items-center gap-1.5">
                      <span>测试10 · 观点随笔</span>
                    </div>
                    <div className="text-[11px] text-gray-400 leading-tight mt-0.5">无结构长段、金句短段、数字边界压测</div>
                  </div>
                </button>
              </div>
            )}
          </div>

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
          {detection.isMarkdown ? (
            <span className="inline-flex items-center gap-1 font-medium text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-full text-[11px]">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              已识别：Markdown 源码
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 font-medium text-indigo-700 bg-indigo-100/70 px-2 py-0.5 rounded-full text-[11px]">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
              {detection.stats?.summaryText || '已识别：自然普通文本 (已智能提取标题、配图、表格与段落)'}
            </span>
          )}
        </div>

        {/* 当是纯文本或自动识别时，提供一键格式化 */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {!detection.isMarkdown && value.trim().length > 0 && (
            <button
              onClick={handleConvertToMarkdown}
              className="flex items-center gap-1 text-[11px] text-indigo-700 hover:text-indigo-900 bg-white hover:bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200 shadow-2xs transition-all cursor-pointer font-medium"
              title="把当前智能解析的结构转换为带 # 等标号的 Markdown 源码写回编辑器"
            >
              <Wand2 className="w-3 h-3 text-indigo-600" />
              一键转为标准 Markdown
            </button>
          )}
        </div>
      </div>

      {/* 选中行意图转换工具栏（文本块内行级操作） */}
      {intentBar && (
        <div className="flex-shrink-0 flex items-center gap-1 px-3 py-1.5 bg-gray-900/90 backdrop-blur text-white text-xs flex-wrap rounded-lg mx-3 mt-2 z-10">
          <span className="text-gray-400 mr-1">选中 {intentBar.e - intentBar.s + 1} 行：</span>
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

      {/* 分块编辑区：文本块（源码）+ 图片块（可视化），滚动时联动右侧预览 */}
      <div
        ref={scrollRef}
        className="relative flex-1 min-h-0 overflow-y-auto custom-scrollbar"
        onScroll={handleContentScroll}
        onClick={(e) => {
          if (e.target === e.currentTarget) focusLastTextBlock();
        }}
      >
        <div
          className="px-4 py-4 space-y-3 min-h-full"
          onClick={(e) => {
            if (e.target === e.currentTarget) focusLastTextBlock();
          }}
        >
          {value.trim() === '' && (
            <p className="text-sm text-gray-300 text-center py-8">
              在这里输入或粘贴文章内容……纯文本即可，系统会自动识别结构并排版；也可以直接粘贴截图插入图片。
            </p>
          )}
          {blocks.map((b, idx) =>
            b.kind === 'text' ? (
              <AutoTextarea
                key={idx}
                value={b.lines.join('\n')}
                onChange={(text) => updateTextBlock(idx, text)}
                onKeyDown={makeKeyDownHandler(idx, b.lines.join('\n'))}
                onSelect={makeSelectHandler(idx, b.lines.join('\n'))}
                onPaste={makePasteHandler(idx)}
                onBlur={() => setTimeout(() => setIntentBar((prev) => (prev && prev.blockIdx === idx ? null : prev)), 200)}
              />
            ) : (
              <ImageBlockCard
                key={idx}
                block={b}
                onLayout={(l) => setImageLayout(idx, l)}
                onPickSlotImage={async (slot, file) => {
                  try {
                    setIsUploading(true);
                    const { dataUrl, fileName } = await compressAndEncodeImage(file);
                    const cleanAlt = fileName.replace(/\.[^/.]+$/, '') || '配图';
                    const { token, persisted } = putImageDataUrl(dataUrl);
                    const nextBlocks = blocks.map((b, k) => {
                      if (k !== idx || b.kind !== 'images') return b;
                      const images = b.images.map((im, kk) => (kk === slot ? { alt: cleanAlt, src: persisted ? token : dataUrl } : im));
                      const captions = b.captions.map((c, kk) => (kk === slot ? c || '' : c));
                      while (captions.length < images.length) captions.push('');
                      return { ...b, images, captions };
                    });
                    commitBlocks(nextBlocks, true);
                  } catch (err) {
                    console.error('Slot image failed', err);
                  } finally {
                    setIsUploading(false);
                  }
                }}
                onPolaroid={(v) => updateImageBlock(idx, { polaroid: v })}
                onCaption={(k, cap) =>
                  updateImageBlock(idx, { captions: b.captions.map((c, kk) => (kk === k ? cap : c)) })
                }
                onRemove={() => removeImageBlock(idx)}
              />
            )
          )}
          {isUploading && (
            <div className="flex items-center gap-2 text-xs text-indigo-600 py-2">
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
            onClick={() => onRestoreSample('all-round-plain-text')}
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
