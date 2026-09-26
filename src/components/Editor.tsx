'use client';

import {
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
import type { ConversionDecision } from '@/lib/smart-parser';
import React, { useMemo, useState, useRef, useEffect } from 'react';

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
}: EditorProps) {
  const charCount = value.replace(/\s/g, '').length;
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

  // 插入图片：压缩后以 Markdown 图片语法写入光标处（预览负责渲染）
  const insertImageMarkdown = async (file: File) => {
    try {
      setIsUploading(true);
      const { dataUrl, fileName } = await compressAndEncodeImage(file);
      const cleanAlt = fileName.replace(/\.[^/.]+$/, '') || '配图';
      insertAtCaret(`\n![${cleanAlt}](${dataUrl})\n`);
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
          lines[k] = (lines[k] || '').replace(/^(?:#{1,6}\s*|>\s*|-\s*|\*+|```)/, '').trim();
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
      {/* 第二阶段：低置信度识别决策 —— 悬浮确认窗（默认收起为数量徽标，点击展开列表） */}
      {lowConfidenceDecisions && lowConfidenceDecisions.length > 0 && (
        <div className="absolute bottom-3 right-3 z-40">
          {decisionPanelOpen ? (
            <div className="w-[440px] max-w-[92vw] max-h-[460px] flex flex-col bg-white border border-amber-200 rounded-xl shadow-2xl">
              <div className="flex items-center justify-between px-3 py-2 border-b border-amber-100 flex-shrink-0">
                <span className="font-medium text-amber-800 text-xs">
                  ⚠ {lowConfidenceDecisions.length} 处识别需要确认
                </span>
                <span className="flex items-center gap-2">
                  {onExportFeedback && (
                    <button
                      onClick={onExportFeedback}
                      className="text-[11px] text-amber-700 hover:text-amber-900 underline cursor-pointer"
                      title="导出本地反馈数据（JSON），帮助改进识别规则"
                    >
                      导出反馈
                    </button>
                  )}
                  <button
                    onClick={() => setDecisionPanelOpen(false)}
                    className="text-gray-400 hover:text-gray-600 cursor-pointer text-xs"
                  >
                    收起 ×
                  </button>
                </span>
              </div>
              <div className="overflow-y-auto px-3 py-2 space-y-2 text-xs">
                {lowConfidenceDecisions.map((d) => {
                  const key = `${d.type}:${d.snippet}`;
                  return (
                    <div key={key} className="flex items-center justify-between gap-2 text-gray-700">
                      <span className="truncate flex-1" title={d.snippet}>
                        「{d.snippet}」… {d.type}（{Math.round(d.confidence * 100)}%）
                      </span>
                      <span className="flex items-center gap-1.5 flex-shrink-0">
                        {onResolveDecision && (
                          <button
                            onClick={() => onResolveDecision(d)}
                            className="px-1.5 py-0.5 rounded border border-gray-300 bg-white hover:bg-gray-100 cursor-pointer whitespace-nowrap"
                          >
                            {d.type === '金句' ? '转为金句' : d.type === 'HTML代码块' ? '转为代码块' : '改为正文'}
                          </button>
                        )}
                        {onKeepDecision && (
                          <button
                            onClick={() => onKeepDecision(d)}
                            className="px-1.5 py-0.5 rounded border border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 cursor-pointer whitespace-nowrap"
                          >
                            保留 ✓
                          </button>
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <button
              onClick={() => setDecisionPanelOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-500/95 backdrop-blur text-white text-xs font-medium rounded-full shadow-lg shadow-amber-500/25 hover:bg-amber-600 cursor-pointer transition-all"
              title="点击展开识别确认列表"
            >
              ⚠ {lowConfidenceDecisions.length} 处识别需要确认
            </button>
          )}
        </div>
      )}

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
                className="absolute right-0 top-full mt-1.5 w-64 bg-white border border-gray-200 shadow-xl rounded-xl p-1.5 z-50"
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
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onSelect={handleSelect}
        onPaste={handlePaste}
        placeholder="在这里输入或粘贴文章内容……纯文本即可，系统会自动识别结构并排版；也可以直接粘贴截图插入图片。"
        className="flex-1 w-full resize-none outline-none px-5 py-5 text-[15px] leading-[1.9] tracking-[0.01em] text-gray-800 bg-white"
        spellCheck={false}
      />

      {isDragging && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-blue-50/80 text-blue-600 text-sm font-medium pointer-events-none">
          松开鼠标，插入图片
        </div>
      )}
    </div>
  );
}
