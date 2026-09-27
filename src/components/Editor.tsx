'use client';

import {
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
import React, { useMemo, useState, useRef, useEffect } from 'react';

export type ContentMode = 'auto' | 'plain-text' | 'markdown';

/** 测量图片令牌行在编辑框字体下的渲染宽度（覆盖层药丸需精确盖住整行源码） */
function measureTokenLineWidth(text: string): number {
  if (typeof document === 'undefined') return 220;
  const canvas =
    (measureTokenLineWidth as unknown as { _canvas?: HTMLCanvasElement })._canvas ||
    ((measureTokenLineWidth as unknown as { _canvas?: HTMLCanvasElement })._canvas = document.createElement('canvas'));
  const ctx = canvas.getContext('2d');
  if (!ctx) return 220;
  ctx.font = '15px ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif';
  const w = ctx.measureText(text).width;
  return Math.ceil(w + text.length * 0.15);
}

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

export function Editor({
  value,
  onChange,
  mode,
  onModeChange,
  onClear,
  onRestoreSample,
  draftStatus,
  firstLineAsTitle = false,
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
  // 行内图片预览：解析正文中的独占图片行（![alt](img:xxx) 或内联 base64），原位显示缩略图
  const imageLines = useMemo(() => {
    const out: Array<{ line: number; alt: string; src: string; w: number; left: number }> = [];
    const re = /!\[([^\]]*)\]\((img:[a-z0-9-]+|data:image\/[^;]+;base64,[^)\s]+)\)/g;
    value.split('\n').forEach((l, i) => {
      let m: RegExpExecArray | null;
      re.lastIndex = 0;
      while ((m = re.exec(l))) {
        out.push({
          line: i,
          alt: m[1] || '配图',
          src: m[2].startsWith('img:') ? resolveImageSrc(m[2]) : m[2],
          w: measureTokenLineWidth(m[0]) + 14,
          left: measureTokenLineWidth(l.slice(0, m.index)),
        });
      }
    });
    return out;
  }, [value]);
  // 编辑框行度量：覆盖层定位用（字号 15px × 行高 1.9，内边距 py-5/px-5）
  const [editorMetrics, setEditorMetrics] = useState({ paddingTop: 20, paddingLeft: 20, lineHeight: 28.5 });
  const overlayRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const ta = textareaRef.current;
    const ov = overlayRef.current;
    if (ta && ov) ov.style.transform = 'translateY(' + -ta.scrollTop + 'px)';
  }, [value, editorMetrics]);

  const [showPresetMenu, setShowPresetMenu] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  // 第二阶段：选中行意图转换工具栏 { 起始行, 结束行（含） }
  const [intentBar, setIntentBar] = useState<{ s: number; e: number } | null>(null);
  // 低置信度决策悬浮确认窗：默认收起为数量徽标，点击展开
  const [decisionPanelOpen, setDecisionPanelOpen] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 实时分析文本格式
  const detection = useMemo(() => detectContentFormat(value), [value]);

  // 选中区域 → 行范围（0 起始，含端点）
  const selectionLines = (): { s: number; e: number } | null => {
    const ta = textareaRef.current;
    if (!ta) return null;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    if (start === end) return null;
    const s = value.slice(0, start).split('\n').length - 1;
    const selected = value.slice(start, end);
    const e = s + selected.split('\n').length - 1;
    return { s, e };
  };

  const handleSelect = () => setIntentBar(selectionLines());
  const handleTextareaBlur = () => setTimeout(() => setIntentBar(null), 200);

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
    const converted = convertPlainTextToMarkdown(value, {
      treatFirstLineAsTitle: firstLineAsTitle,
    });
    onChange(converted);
  };

  // 在光标处插入文本（粘贴图片/插入图片共用）
  const insertAtCaret = (text: string) => {
    const ta = textareaRef.current;
    const start = ta?.selectionStart ?? value.length;
    const end = ta?.selectionEnd ?? start;
    const next = value.slice(0, start) + text + value.slice(end);
    onChange(next);
    // 等重渲染后把光标放到插入文本末尾
    requestAnimationFrame(() => {
      if (ta) {
        ta.focus();
        ta.selectionStart = ta.selectionEnd = start + text.length;
      }
    });
  };

  // 插入图片：压缩后存入图片库，正文只写短令牌（避免 base64 淹没编辑框）；
  // 存储已满时退回内联 base64，保证图片零丢失
  const insertImageMarkdown = async (file: File) => {
    try {
      setIsUploading(true);
      const { dataUrl, fileName } = await compressAndEncodeImage(file);
      const cleanAlt = fileName.replace(/\.[^/.]+$/, '') || '配图';
      const { token, persisted } = putImageDataUrl(dataUrl);
      insertAtCaret(`\n![${cleanAlt}](${persisted ? token : dataUrl})\n`);
    } catch (err) {
      console.error('Image insertion failed', err);
    } finally {
      setIsUploading(false);
    }
  };

  // 粘贴：图片文件 → 转为 Markdown 图片语法；文本粘贴走浏览器原生行为
  const handlePaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const clipboardData = e.clipboardData;
    if (!clipboardData) return;
    const files = Array.from(clipboardData.files || []);
    const items = Array.from(clipboardData.items || []);
    const itemImg = items.find((item) => item.type.startsWith('image/'));
    const imgFile = files.find((f) => f.type.startsWith('image/')) || (itemImg ? itemImg.getAsFile() : null);
    if (!imgFile) return; // 普通文本粘贴放行原生行为
    e.preventDefault();
    await insertImageMarkdown(imgFile);
  };

  // 拖放图片支持
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files || []);
    const imgFile = files.find((f) => f.type.startsWith('image/'));
    if (imgFile) {
      insertImageMarkdown(imgFile);
    }
  };

  // 触发本地文件选择
  const triggerImagePicker = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  // 图片覆盖层跟随编辑框滚动（直接改 transform，避免重渲染）
  const syncOverlayScroll = () => {
    const ta = textareaRef.current;
    const ov = overlayRef.current;
    if (ta && ov) ov.style.transform = 'translateY(' + -ta.scrollTop + 'px)';
  };

  // 编辑器滚动 → 按比例联动右侧预览（单向同步，无回环）
  const handleTextareaScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    syncOverlayScroll();
    if (!onScrollRatio) return;
    const el = e.currentTarget;
    const max = el.scrollHeight - el.clientHeight;
    onScrollRatio(max > 0 ? el.scrollTop / max : 0);
  };

  // 快捷键：选区包裹（加粗 / 斜体），支持再按一次取消
  const wrapSelection = (mark: string) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = value.slice(start, end);
    let next: string;
    let cursor: number;
    if (selected.startsWith(mark) && selected.endsWith(mark) && selected.length >= mark.length * 2) {
      const inner = selected.slice(mark.length, selected.length - mark.length);
      next = value.slice(0, start) + inner + value.slice(end);
      cursor = start + inner.length;
    } else if (!selected) {
      next = value.slice(0, start) + mark + mark + value.slice(end);
      cursor = start + mark.length;
    } else {
      next = value.slice(0, start) + mark + selected + mark + value.slice(end);
      cursor = start + selected.length + mark.length * 2;
    }
    onChange(next);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(cursor, cursor);
    });
  };

  // 快捷键：选中行转标题（⌘1/⌘2/⌘3 → #/##/###，覆盖选区所在的所有行）
  const applyHeadingLevel = (level: number) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const lineStart = value.lastIndexOf('\n', start - 1) + 1;
    const restIdx = value.indexOf('\n', end);
    const lineEnd = restIdx === -1 ? value.length : restIdx;
    const block = value.slice(lineStart, lineEnd);
    const prefix = '#'.repeat(level) + ' ';
    const newBlock = block
      .split('\n')
      .map((l) => prefix + l.replace(/^#{1,6}\s*/, ''))
      .join('\n');
    onChange(value.slice(0, lineStart) + newBlock + value.slice(lineEnd));
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(lineStart, lineStart + newBlock.length);
    });
  };

  // 快捷键总入口：⌘B 加粗 / ⌘I 斜体 / ⌘1~3 标题 / ⌘S 保存草稿
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!(e.metaKey || e.ctrlKey)) return;
    const k = e.key.toLowerCase();
    if (k === 'b') {
      e.preventDefault();
      wrapSelection('**');
    } else if (k === 'i') {
      e.preventDefault();
      wrapSelection('*');
    } else if (k === 's') {
      e.preventDefault();
      onSaveDraft?.();
    } else if (k === '1' || k === '2' || k === '3') {
      e.preventDefault();
      applyHeadingLevel(Number(k));
    }
  };

  // 点击行内缩略图 → 选中该图片行（可直接改 alt 或删除）
  const selectLine = (line: number) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const lines = value.split('\n');
    let start = 0;
    for (let i = 0; i < line; i++) start += lines[i].length + 1;
    ta.focus();
    ta.setSelectionRange(start, start + lines[line].length);
  };

  // 编辑框行高/内边距测量（窗口缩放时重测）
  useEffect(() => {
    const measure = () => {
      const ta = textareaRef.current;
      if (!ta) return;
      const cs = getComputedStyle(ta);
      setEditorMetrics({
        paddingTop: parseFloat(cs.paddingTop) || 20,
        paddingLeft: parseFloat(cs.paddingLeft) || 20,
        lineHeight: parseFloat(cs.lineHeight) || 28.5,
      });
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  // 本地文件选取完成
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      insertImageMarkdown(file);
    }
  };

  // 选中行意图转换（行级操作：直接改写源码行）
  const applyIntentTransform = (kind: string) => {
    if (!intentBar) return;
    const { s, e } = intentBar;
    const lines = value.split('\n');
    switch (kind) {
      case 'h2':
        for (let k = s; k <= e; k++) {
          const t = (lines[k] || '').trim();
          if (t) lines[k] = `## ${t.replace(/^#+\s*/, '')}`;
        }
        break;
      case 'h3':
        for (let k = s; k <= e; k++) {
          const t = (lines[k] || '').trim();
          if (t) lines[k] = `### ${t.replace(/^#+\s*/, '')}`;
        }
        break;
      case 'list':
        for (let k = s; k <= e; k++) {
          const t = (lines[k] || '').trim();
          if (t) lines[k] = `- ${t.replace(/^[-•●·✦\s]+/, '')}`;
        }
        break;
      case 'table': {
        const rows: string[] = [];
        for (let k = s; k <= e; k++) {
          const t = (lines[k] || '').trim();
          if (!t) continue;
          const cells = t.split(/\s*(?:\t|[｜|]\s*|\s{2,}|[,，])\s*/).filter(Boolean);
          rows.push(`| ${cells.join(' | ')} |`);
        }
        if (rows.length >= 2) {
          const colCount = rows[0].split('|').length - 2;
          rows.splice(1, 0, `| ${Array(Math.max(colCount, 1)).fill(':---').join(' | ')} |`);
        }
        lines.splice(s, e - s + 1, ...rows);
        break;
      }
      case 'quote':
        for (let k = s; k <= e; k++) {
          const t = (lines[k] || '').trim();
          if (t) lines[k] = `> ${t}`;
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
          if (t) lines[k] = `*${t.startsWith('▲') ? t : `▲ ${t}`}*`;
        }
        break;
      case 'text':
        for (let k = s; k <= e; k++) {
          lines[k] = (lines[k] || '').trim();
        }
        break;
    }
    const next = lines.join('\n');
    onChange(next);
    setIntentBar(null);
  };

  return (
    <div
      className={`flex flex-col h-full bg-white relative ${
        isDragging ? 'ring-2 ring-blue-500 bg-blue-50/20' : ''
      }`}
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
      <div className="h-11 border-b border-gray-200/70 flex items-center px-3 sm:px-4 text-sm text-gray-600 justify-between flex-shrink-0 bg-white">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-gray-800 text-xs tracking-wider uppercase hidden sm:inline">
            输入内容
          </span>

          {/* 模式选择切换（自动识别 / 纯文本 / Markdown） */}
          <div className="flex items-center bg-gray-200/60 p-0.5 rounded-lg text-xs">
            <button
              onClick={() => onModeChange('auto')}
              className={`px-2 py-1 rounded-md transition-all flex items-center gap-1 font-medium cursor-pointer ${
                mode === 'auto'
                  ? 'bg-white text-blue-600 shadow-xs'
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
                  ? 'bg-white text-blue-600 shadow-xs font-medium'
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
                  ? 'bg-white text-blue-600 shadow-xs font-medium'
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
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* 插入图片按钮 */}
          <button
            onClick={() => triggerImagePicker()}
            disabled={isUploading}
            className="px-2 py-1 rounded-md text-xs text-blue-700 bg-blue-50 hover:bg-blue-100/80 border border-blue-200 transition-all flex items-center gap-1 cursor-pointer font-medium"
            title="选择本地图片，或直接在输入框 Cmd+V / Ctrl+V 粘贴截屏"
          >
            {isUploading ? (
              <Loader2 className="w-3 h-3 animate-spin text-blue-600" />
            ) : (
              <ImageIcon className="w-3 h-3 text-blue-600" />
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

          {/* 字符计数 */}
          <span className="text-xs text-gray-400">{charCount} 字</span>

          {/* 多格式范文库快捷下拉 */}
          <div className="relative" ref={menuRef}>
            <div className="flex items-center">
              <button
                onClick={() => onRestoreSample('all-round-markdown')}
                className="px-2 py-1 rounded-l-md text-xs text-gray-700 hover:text-blue-600 hover:bg-blue-50 transition-all flex items-center gap-1 cursor-pointer font-medium border border-gray-200 border-r-0"
                title="载入全能 Markdown 范文（含单图、双排图、三排画廊、表格、代码、清单）"
              >
                <RotateCcw className="w-3 h-3 text-blue-500" />
                <span className="hidden md:inline">测试范文</span>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowPresetMenu((prev) => !prev);
                }}
                className="px-1.5 py-1 rounded-r-md text-[11px] text-gray-600 hover:text-blue-600 hover:bg-blue-50 transition-all cursor-pointer font-medium border border-gray-200 flex items-center"
                title="选择更多不同格式的测试范文"
              >
                <ChevronDown
                  className={`w-3 h-3 transition-transform pointer-events-none ${
                    showPresetMenu ? 'rotate-180 text-blue-600' : ''
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
                  className="w-full text-left px-2.5 py-2.5 rounded-lg text-xs text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-all flex items-start gap-2.5 cursor-pointer group border-b border-gray-100"
                >
                  <FileCheck2 className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                  <div>
                    <div className="font-semibold text-gray-800 group-hover:text-blue-700 flex items-center gap-1.5">
                      <span>全能旗舰 Markdown 范文</span>
                      <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.2 rounded font-normal">
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

                <div className="px-2 pt-1.5 pb-1 text-[10px] font-semibold text-blue-400 uppercase tracking-wider border-t border-gray-100 mt-1">Ten Test Articles · 智能识别压测</div>
                <button
                  onClick={() => {
                    onRestoreSample('test01-plain');
                    setShowPresetMenu(false);
                  }}
                  className="w-full text-left px-2.5 py-2 rounded-lg text-xs text-gray-700 hover:bg-blue-50 hover:text-blue-800 transition-all flex items-start gap-2.5 cursor-pointer group"
                >
                  <FlaskConical className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
                  <div>
                    <div className="font-semibold text-gray-800 group-hover:text-blue-800 flex items-center gap-1.5">
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
                  className="w-full text-left px-2.5 py-2 rounded-lg text-xs text-gray-700 hover:bg-blue-50 hover:text-blue-800 transition-all flex items-start gap-2.5 cursor-pointer group"
                >
                  <FlaskConical className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
                  <div>
                    <div className="font-semibold text-gray-800 group-hover:text-blue-800 flex items-center gap-1.5">
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
                  className="w-full text-left px-2.5 py-2 rounded-lg text-xs text-gray-700 hover:bg-blue-50 hover:text-blue-800 transition-all flex items-start gap-2.5 cursor-pointer group"
                >
                  <FlaskConical className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
                  <div>
                    <div className="font-semibold text-gray-800 group-hover:text-blue-800 flex items-center gap-1.5">
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
                  className="w-full text-left px-2.5 py-2 rounded-lg text-xs text-gray-700 hover:bg-blue-50 hover:text-blue-800 transition-all flex items-start gap-2.5 cursor-pointer group"
                >
                  <FlaskConical className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
                  <div>
                    <div className="font-semibold text-gray-800 group-hover:text-blue-800 flex items-center gap-1.5">
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
                  className="w-full text-left px-2.5 py-2 rounded-lg text-xs text-gray-700 hover:bg-blue-50 hover:text-blue-800 transition-all flex items-start gap-2.5 cursor-pointer group"
                >
                  <FlaskConical className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
                  <div>
                    <div className="font-semibold text-gray-800 group-hover:text-blue-800 flex items-center gap-1.5">
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
                  className="w-full text-left px-2.5 py-2 rounded-lg text-xs text-gray-700 hover:bg-blue-50 hover:text-blue-800 transition-all flex items-start gap-2.5 cursor-pointer group"
                >
                  <FlaskConical className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
                  <div>
                    <div className="font-semibold text-gray-800 group-hover:text-blue-800 flex items-center gap-1.5">
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
                  className="w-full text-left px-2.5 py-2 rounded-lg text-xs text-gray-700 hover:bg-blue-50 hover:text-blue-800 transition-all flex items-start gap-2.5 cursor-pointer group"
                >
                  <FlaskConical className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
                  <div>
                    <div className="font-semibold text-gray-800 group-hover:text-blue-800 flex items-center gap-1.5">
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
                  className="w-full text-left px-2.5 py-2 rounded-lg text-xs text-gray-700 hover:bg-blue-50 hover:text-blue-800 transition-all flex items-start gap-2.5 cursor-pointer group"
                >
                  <FlaskConical className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
                  <div>
                    <div className="font-semibold text-gray-800 group-hover:text-blue-800 flex items-center gap-1.5">
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
                  className="w-full text-left px-2.5 py-2 rounded-lg text-xs text-gray-700 hover:bg-blue-50 hover:text-blue-800 transition-all flex items-start gap-2.5 cursor-pointer group"
                >
                  <FlaskConical className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
                  <div>
                    <div className="font-semibold text-gray-800 group-hover:text-blue-800 flex items-center gap-1.5">
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
                  className="w-full text-left px-2.5 py-2 rounded-lg text-xs text-gray-700 hover:bg-blue-50 hover:text-blue-800 transition-all flex items-start gap-2.5 cursor-pointer group"
                >
                  <FlaskConical className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
                  <div>
                    <div className="font-semibold text-gray-800 group-hover:text-blue-800 flex items-center gap-1.5">
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
      <div className="px-4 py-1.5 bg-blue-50/40 border-b border-blue-100/70 flex items-center justify-between text-xs text-gray-600 flex-shrink-0">
        <span className="hidden xl:inline text-[11px] text-gray-400 whitespace-nowrap overflow-hidden text-ellipsis flex-shrink min-w-0" title="选中文字后可使用快捷键与悬浮工具栏">选中文字可转格式 · ⌘B 加粗 · ⌘1/2/3 标题 · ⌘S 保存</span>
        <div className="flex items-center gap-1.5">
          {detection.isMarkdown ? (
            <span className="inline-flex items-center gap-1 font-medium text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-full text-[11px]">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              已识别：Markdown 源码
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 font-medium text-blue-700 bg-blue-100/70 px-2 py-0.5 rounded-full text-[11px]">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
              {detection.stats?.summaryText || '已识别：自然普通文本 (已智能提取标题、配图、表格与段落)'}
            </span>
          )}
        </div>

        {/* 当是纯文本或自动识别时，提供一键格式化 */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {!detection.isMarkdown && value.trim().length > 0 && (
            <button
              onClick={handleConvertToMarkdown}
              className="flex items-center gap-1 text-[11px] text-blue-700 hover:text-blue-900 bg-white hover:bg-blue-50 px-2 py-0.5 rounded border border-blue-200 shadow-2xs transition-all cursor-pointer font-medium"
              title="把当前智能解析的结构转换为带 # 等标号的 Markdown 源码写回编辑器"
            >
              <Wand2 className="w-3 h-3 text-blue-600" />
              一键转为标准 Markdown
            </button>
          )}
        </div>
      </div>

      {/* 输入区：纯文本 / Markdown 源码（左边永远是源码，渲染效果只在右边预览） */}
      {/* 选中行意图转换工具栏（源码行级操作） */}
      {intentBar && (
        <div className="flex-shrink-0 flex items-center gap-1 px-3 py-1.5 bg-gray-900/90 backdrop-blur text-white text-xs flex-wrap rounded-lg mx-3 mt-2">
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

      {/* 输入区：纯文本 / Markdown 源码（左边永远是源码，渲染效果只在右边预览） */}
      <div className="relative flex-1 flex flex-col min-h-0">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onSelect={handleSelect}
        onPaste={handlePaste}
        onScroll={handleTextareaScroll}
        onKeyDown={handleKeyDown}
        placeholder="在这里输入或粘贴文章内容……纯文本即可，系统会自动识别结构并排版；也可以直接粘贴截图插入图片。"
        className="flex-1 w-full resize-none outline-none px-5 py-5 text-[15px] leading-[1.9] tracking-[0.01em] text-gray-800 bg-white"
        spellCheck={false}
      />

      {/* 行内图片预览层：图片行原位显示缩略图，其余内容保持源码形态 */}
      <div ref={overlayRef} className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
        {imageLines.map(({ line, alt, src: imgSrc, w, left: leftOffset }) => (
          <div
            key={line + '-' + alt}
            style={{
              position: 'absolute',
              top: editorMetrics.paddingTop + line * editorMetrics.lineHeight,
              left: editorMetrics.paddingLeft + leftOffset,
              width: Math.min(Math.max(w, 90), 720),
            }}
            className="pointer-events-auto overflow-hidden"
          >
            {imgSrc ? (
              <div
                title="点击选中此图片行（可直接编辑或删除）"
                onClick={() => selectLine(line)}
                className="h-7 w-full inline-flex items-center gap-1.5 bg-white px-1.5 rounded-sm border border-gray-200 cursor-pointer overflow-hidden"
              >
                <img src={imgSrc} alt={alt} className="h-full w-auto max-w-[60%] rounded-sm" />
                <span className="text-[10px] text-gray-400 whitespace-nowrap">{alt}</span>
              </div>
            ) : (
              <span className="h-7 inline-flex items-center px-2 rounded border border-dashed border-gray-300 text-[11px] text-gray-400 bg-white cursor-pointer" onClick={() => selectLine(line)}>
                图片已失效（{alt}）
              </span>
            )}
          </div>
        ))}
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
            className="mt-2 pointer-events-auto px-3.5 py-1.5 rounded-full bg-blue-50 text-blue-700 text-xs font-medium border border-blue-200 hover:bg-blue-100 transition-colors cursor-pointer"
          >
            载入范文试一试
          </button>
        </div>
      )}

      {isDragging && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-blue-50/80 text-blue-600 text-sm font-medium pointer-events-none">
          松开鼠标，插入图片
        </div>
      )}
    </div>
  );
}
