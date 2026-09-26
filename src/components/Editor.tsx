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
  X,
  Loader2,
} from 'lucide-react';
import { detectContentFormat, convertPlainTextToMarkdown } from '@/lib/smart-parser';

import { compressAndEncodeImage } from '@/lib/image-utils';
import {
  markdownToUnifiedHtml,
  unifiedHtmlToMarkdown,
  createSingleImageFigureNode,
} from '@/lib/unified-editor-utils';
import React, { useMemo, useState, useRef, useEffect, useCallback } from 'react';

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
}: EditorProps) {
  const charCount = value.replace(/\s/g, '').length;
  const [showPresetMenu, setShowPresetMenu] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  const menuRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 记录最后一次向外广播的 Markdown，避免用户正在输入时被外部 props 反向重写 innerHTML 导致光标丢失
  const lastMarkdownRef = useRef<string>(value);
  // 中文拼音输入法 IME 保护标志
  const isComposingRef = useRef<boolean>(false);
  const isInitializedRef = useRef<boolean>(false);

  // 外部 value 改变时（如首次加载、载入范文、一键清空、切换草稿）且非本地用户输入时，更新编辑器 DOM
  useEffect(() => {
    if (!editorRef.current) return;

    // 当 DOM 节点为空（如初次挂载、Strict Mode 双重挂载恢复）或外部 Markdown 真正发生变动时同步
    if (!editorRef.current.innerHTML.trim() || value !== lastMarkdownRef.current) {
      lastMarkdownRef.current = value;
      editorRef.current.innerHTML = markdownToUnifiedHtml(value);
    }
  }, [value]);

  // 实时分析文本格式
  const detection = useMemo(() => detectContentFormat(value), [value]);

  // 点击外部自动关闭范文下拉菜单
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowPresetMenu(false);
      }
    }
    if (showPresetMenu) {
      document.addEventListener('click', handleClickOutside);
    }
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [showPresetMenu]);

  // 同步编辑器当前 DOM 到外部 Markdown
  const syncDomToMarkdown = useCallback(() => {
    if (!editorRef.current) return;
    const md = unifiedHtmlToMarkdown(editorRef.current);
    lastMarkdownRef.current = md;
    onChange(md);
  }, [onChange]);

  // 监听输入事件（处理文字录入与题注修改）
  const handleInput = () => {
    if (isComposingRef.current) return;
    syncDomToMarkdown();
  };

  // 绑定原生捕获阶段事件监听器，确保子节点（如 figure 内 contenteditable="false" 嵌套的 figcaption）
  // 发生的 input、keyup、blur、compositionend 事件能够百分之百被捕获并触发 DOM 状态向 Markdown 同步
  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;

    const handleNativeEvent = () => {
      if (isComposingRef.current) return;
      syncDomToMarkdown();
    };

    const handleCompositionStart = () => {
      isComposingRef.current = true;
    };

    const handleCompositionEnd = () => {
      isComposingRef.current = false;
      syncDomToMarkdown();
    };

    const handleBlur = () => {
      isComposingRef.current = false;
      syncDomToMarkdown();
    };

    el.addEventListener('input', handleNativeEvent, true);
    el.addEventListener('keyup', handleNativeEvent, true);
    el.addEventListener('blur', handleBlur, true);
    el.addEventListener('compositionstart', handleCompositionStart, true);
    el.addEventListener('compositionend', handleCompositionEnd, true);

    return () => {
      el.removeEventListener('input', handleNativeEvent, true);
      el.removeEventListener('keyup', handleNativeEvent, true);
      el.removeEventListener('blur', handleBlur, true);
      el.removeEventListener('compositionstart', handleCompositionStart, true);
      el.removeEventListener('compositionend', handleCompositionEnd, true);
    };
  }, [syncDomToMarkdown]);

  // 一键将当前普通文本转为标准 Markdown 填入编辑器
  const handleConvertToMarkdown = () => {
    if (!value.trim()) return;
    const converted = convertPlainTextToMarkdown(value, {
      treatFirstLineAsTitle: firstLineAsTitle,
    });
    lastMarkdownRef.current = converted;
    if (editorRef.current) {
      editorRef.current.innerHTML = markdownToUnifiedHtml(converted);
    }
    onChange(converted);
  };

  // 插入单张图片到光标所在位置或末尾
  const insertImageAtSelection = async (file: File) => {
    try {
      setIsUploading(true);
      const { dataUrl, fileName } = await compressAndEncodeImage(file);
      const cleanAlt = fileName.replace(/\.[^/.]+$/, '') || '配图';
      const figure = createSingleImageFigureNode(dataUrl, cleanAlt, '');

      if (!editorRef.current) return;
      editorRef.current.focus();

      const sel = window.getSelection();
      let inserted = false;

      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        // 确保光标在当前编辑器内部
        if (editorRef.current.contains(range.commonAncestorContainer)) {
          range.deleteContents();
          range.insertNode(figure);

          // 若插入点位于文本段落内部，将所在段落按图片位置拆分为三段：
          // 前文段落 / 图片卡片 / 后文段落，避免图片嵌在段落内导致文字随 Markdown 转换丢失
          const parentEl = figure.parentElement;
          if (parentEl && parentEl !== editorRef.current && parentEl.tagName === 'P') {
            const headNodes: Node[] = [];
            let m = figure.previousSibling;
            while (m) {
              headNodes.unshift(m);
              m = m.previousSibling;
            }
            const tailNodes: Node[] = [];
            let n = figure.nextSibling;
            while (n) {
              tailNodes.push(n);
              n = n.nextSibling;
            }
            const mk = (nodes: Node[]) => {
              const np = document.createElement('p');
              if (nodes.length === 0) np.innerHTML = '<br>';
              nodes.forEach((x) => np.appendChild(x));
              return np;
            };
            const headP = mk(headNodes);
            const tailP = mk(tailNodes);
            parentEl.parentNode!.insertBefore(headP, parentEl);
            parentEl.parentNode!.insertBefore(figure, parentEl);
            parentEl.parentNode!.insertBefore(tailP, parentEl);
            parentEl.remove();

            // 光标移动到后文段落，方便继续键入文字
            const newRange = document.createRange();
            newRange.setStart(tailP, 0);
            newRange.collapse(true);
            sel.removeAllRanges();
            sel.addRange(newRange);
            inserted = true;
          }

          if (!inserted) {
            // 插入点在顶层：紧接着插入一个新空段落，并将光标移动到该段落
            const p = document.createElement('p');
            p.innerHTML = '<br>';
            figure.after(p);

            const newRange = document.createRange();
            newRange.setStart(p, 0);
            newRange.collapse(true);
            sel.removeAllRanges();
            sel.addRange(newRange);
            inserted = true;
          }
        }
      }

      if (!inserted) {
        // 如果没有有效选区，则直接追加到文档末尾
        editorRef.current.appendChild(figure);
        const p = document.createElement('p');
        p.innerHTML = '<br>';
        editorRef.current.appendChild(p);
      }

      syncDomToMarkdown();
    } catch (err) {
      console.error('Image insertion failed', err);
    } finally {
      setIsUploading(false);
    }
  };

  // 核心粘贴处理：智能分流单图粘贴与全量图文粘贴
  const handlePaste = async (e: React.ClipboardEvent) => {
    const clipboardData = e.clipboardData;
    if (!clipboardData) return;

    const files = Array.from(clipboardData.files || []);
    const items = Array.from(clipboardData.items || []);
    const itemImg = items.find((item) => item.type.startsWith('image/'));
    const imgFile = files.find((f) => f.type.startsWith('image/')) || (itemImg ? itemImg.getAsFile() : null);

    // 场景 A：剪贴板直接包含单张截屏或图片文件
    if (imgFile) {
      e.preventDefault();
      await insertImageAtSelection(imgFile);
      return;
    }

    // 场景 B：粘贴全量混合内容（包含文字和多张图片，如从网页、Word、富文本粘贴）
    const textPlain = clipboardData.getData('text/plain');

    // 如果粘贴纯文本中包含了 Markdown 图片语法 ![...](...) 或纯文本配图标记
    if (
      textPlain &&
      (textPlain.includes('![') ||
        textPlain.includes('配图：') ||
        textPlain.includes('图片：'))
    ) {
      e.preventDefault();
      const generatedHtml = markdownToUnifiedHtml(textPlain);
      let inserted = false;
      try {
        inserted = document.execCommand('insertHTML', false, generatedHtml);
      } catch {}

      if (!inserted) {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = generatedHtml;
        const sel = window.getSelection();
        if (
          sel &&
          sel.rangeCount > 0 &&
          editorRef.current?.contains(sel.getRangeAt(0).commonAncestorContainer)
        ) {
          const range = sel.getRangeAt(0);
          range.deleteContents();
          const frag = document.createDocumentFragment();
          while (tempDiv.firstChild) {
            frag.appendChild(tempDiv.firstChild);
          }
          range.insertNode(frag);
        } else if (editorRef.current) {
          while (tempDiv.firstChild) {
            editorRef.current.appendChild(tempDiv.firstChild);
          }
        }
      }
      syncDomToMarkdown();
      return;
    }

    // 普通纯文本粘贴：放行浏览器默认原生行为，确保光标与撤销栈自然流畅
  };


  // 委托捕获编辑器内部的交互操作（删除图片、查看大图）
  const handleCanvasClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;

    // 1. 删除单张图片
    if (target.closest('.del-img-btn')) {
      e.preventDefault();
      e.stopPropagation();
      const figure = target.closest('.unified-figure');
      if (figure) {
        figure.remove();
        syncDomToMarkdown();
      }
      return;
    }

    // 2. 删除整个画廊
    if (target.closest('.del-gallery-btn')) {
      e.preventDefault();
      e.stopPropagation();
      const gallery = target.closest('.unified-gallery');
      if (gallery) {
        gallery.remove();
        syncDomToMarkdown();
      }
      return;
    }

    // 3. 点击大图预览
    if (target.closest('.view-img-trigger') || target.closest('.view-img-btn')) {
      e.preventDefault();
      e.stopPropagation();
      const figure = target.closest('.unified-figure');
      const img = figure?.querySelector('img');
      if (img?.src) {
        setPreviewImageUrl(img.src);
      }
      return;
    }

    // 4. 点击画廊中的图片预览
    if (target.tagName === 'IMG' && target.closest('.unified-gallery')) {
      setPreviewImageUrl((target as HTMLImageElement).src);
      return;
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
      insertImageAtSelection(file);
    }
  };

  // 拖放图片支持
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files || []);
    const imgFile = files.find((f) => f.type.startsWith('image/'));
    if (imgFile) {
      insertImageAtSelection(imgFile);
    }
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
      <div className="h-11 border-b border-gray-200 flex items-center px-3 sm:px-4 text-sm text-gray-600 justify-between flex-shrink-0 bg-gray-50/50">
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
            title="选择本地图片或在画布中按 Cmd+V / Ctrl+V 粘贴截屏"
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
                className="absolute right-0 top-full mt-1.5 w-64 bg-white border border-gray-200 shadow-xl rounded-xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-100"
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
      <div className="px-4 py-1.5 bg-blue-50/60 border-b border-blue-100 flex items-center justify-between text-xs text-gray-600 flex-shrink-0">
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

          {/* 统一整体操作提示 */}
          <span className="hidden sm:inline text-[11px] text-gray-400 ml-1">
            • 整篇为一个编辑整体，支持 Cmd+A 全选；截图按 Cmd+V 可直接插入
          </span>
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

      {/* 编辑主体区域：单体图文混排统一整体连贯画布 */}
      <div className="flex-1 overflow-y-auto bg-gray-50/10">
        <div className="min-h-full p-4 sm:p-6 max-w-4xl mx-auto flex flex-col">
          <div
            ref={editorRef}
            contentEditable={true}
            suppressContentEditableWarning={true}
            suppressHydrationWarning={true}
            onInput={handleInput}
            onPaste={handlePaste}
            onClick={handleCanvasClick}
            onCompositionStart={() => {
              isComposingRef.current = true;
            }}
            onCompositionEnd={() => {
              isComposingRef.current = false;
              syncDomToMarkdown();
            }}
            className="flex-1 w-full min-h-[480px] outline-none text-sm text-gray-800 leading-relaxed font-sans focus:ring-0 empty:before:content-[attr(data-placeholder)] empty:before:text-gray-400 empty:before:pointer-events-none"
            data-placeholder="在此输入文章全部内容。支持从外部一次性全量粘贴整篇文章（含文字与所有图片），或停在任意位置按 Cmd+V 直接插入单张截屏..."
            spellCheck={false}
          />
        </div>
      </div>

      {/* 查看大图弹窗 */}
      {previewImageUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setPreviewImageUrl(null)}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] bg-white rounded-2xl p-2 overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setPreviewImageUrl(null)}
              className="absolute top-3 right-3 p-1.5 bg-black/60 hover:bg-black/80 text-white rounded-full transition-colors cursor-pointer z-10"
              title="关闭预览"
            >
              <X className="w-4 h-4" />
            </button>
            <img
              src={previewImageUrl}
              alt="原图预览"
              className="max-h-[82vh] w-auto max-w-full rounded-xl object-contain mx-auto"
            />
          </div>
        </div>
      )}
    </div>
  );
}
