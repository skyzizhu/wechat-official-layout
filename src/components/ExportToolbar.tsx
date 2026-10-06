'use client';

import { Palette, ChevronDown, Copy, ImageDown, FileDown, Pipette, Link2, Heading1, Loader2 } from 'lucide-react';
import type { ThemePreset, FontSizeOption } from '@/themes';
import { copyRichText, exportAsImage } from '@/lib/export';
import { useToast } from './Toast';
import { ColorPickerModal } from './ColorPickerModal';
import React, { useState } from 'react';

interface ExportToolbarProps {
  previewRef: React.RefObject<HTMLDivElement | null>;
  markdown: string;
  theme: ThemePreset;
  onOpenThemeSelector: () => void;
  currentColor: string;
  onSelectColor: (color: string) => void;
  fontSize: FontSizeOption;
  onFontSizeChange: (size: FontSizeOption) => void;
  linkFootnotes: boolean;
  onToggleFootnotes: (enabled: boolean) => void;
  firstLineAsTitle?: boolean;
  onToggleFirstLineAsTitle?: (enabled: boolean) => void;
  /** 导出前的准备钩子：移动端编辑 Tab 下预览未挂载时，先切到预览 Tab 等待挂载完成 */
  onPrepareExport?: () => Promise<void> | void;
}

export function ExportToolbar({

  previewRef,
  markdown,
  theme,
  onOpenThemeSelector,
  currentColor,
  onSelectColor,
  fontSize,
  onFontSizeChange,
  linkFootnotes,
  onToggleFootnotes,
  firstLineAsTitle = false,
  onToggleFirstLineAsTitle,
  onPrepareExport,
} : ExportToolbarProps) {
  const { showToast } = useToast();
  const [exporting, setExporting] = useState(false);
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);

  const handleCopyRichText = async () => {
    if (onPrepareExport) await onPrepareExport();
    if (!previewRef.current) return;
    try {
      await copyRichText(previewRef.current, theme, currentColor);
      showToast('✅ 微信公众号富文本已复制！格式与样式严格适配，可直接粘贴发布');
    } catch {
      showToast('❌ 复制失败，请重试');
    }
  };

  // 下载 Markdown 源文件：保留用户的原始创作，可迁移到任何编辑器
  const handleDownloadMd = () => {
    const titleMatch = markdown.match(/^#\s+(.+)$/m)?.[1];
    const name =
      (titleMatch || '文排文档')
        .replace(/[\\/:*?"<>|]/g, '')
        .trim()
        .slice(0, 40) || '文排文档';
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name + '.md';
    a.click();
    URL.revokeObjectURL(url);
    showToast('✅ Markdown 源文件已下载');
  };

  const handleExportImage = async () => {
    if (onPrepareExport) await onPrepareExport();
    if (!previewRef.current) return;
    try {
      setExporting(true);
      showToast('⏳ 正在渲染 2x 超清长图...');
      await exportAsImage(previewRef.current, `文排-${theme.name}`);
      showToast('✅ 长图已成功导出下载！');
    } catch {
      showToast('❌ 导出失败，请重试');
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <div className="h-12 border-b border-black/[0.05] bg-white/70 backdrop-blur-xl [saturate:1.6] flex items-center justify-between px-3 sm:px-4 flex-shrink-0 gap-2">
        {/* 左侧：排版预设选择按钮 + 风格主色调节 + 字号大小微调器 + 外链转脚注开关 + 首句标题开关 */}
        <div className="flex items-center gap-1 sm:gap-1.5 xl:gap-2 overflow-x-auto no-scrollbar py-1 min-w-0">
          <button
            onClick={onOpenThemeSelector}
            className="flex items-center gap-1 px-2 sm:px-2.5 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-xs sm:text-sm font-semibold transition-all cursor-pointer border border-indigo-200 shadow-2xs flex-shrink-0"
            title="点击切换 16 款个性排版风格"
          >
            <Palette className="w-4 h-4 text-indigo-600" />
            <span>{theme.name}</span>
            <ChevronDown className="w-3.5 h-3.5 text-indigo-500" />
          </button>

          {/* 智能主色搭配选项 */}
          <button
            onClick={() => setIsColorPickerOpen(true)}
            className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-gray-50 hover:bg-gray-100 text-xs text-gray-700 font-medium transition-all cursor-pointer border border-gray-200 shadow-2xs flex-shrink-0"
            title="自选主色，系统自动智能搭配全套排版色彩"
          >
            <span
              style={{
                backgroundColor: currentColor || (theme.elements.h1.color as string) || '#2563eb',
              }}
              className="w-3 h-3 rounded-full border border-black/15 shadow-2xs flex-shrink-0"
            />
            <span className="hidden 2xl:inline">主色搭配</span>
            <Pipette className="w-3 h-3 text-gray-400" />
          </button>

          {/* 字号滑动条：12~24px 连续调节 */}
          <div className="flex items-center gap-1.5 bg-gray-50 ring-1 ring-black/[0.04] px-2 py-1 rounded-lg flex-shrink-0" title="正文字号：拖动连续调节（12~24px）">
            <span className="text-[11px] font-semibold text-gray-400">A</span>
            <input
              type="range"
              min={12}
              max={24}
              step={1}
              value={fontSize}
              onChange={(e) => onFontSizeChange(Number(e.target.value))}
              className="w-16 sm:w-24 accent-indigo-600 cursor-pointer"
              aria-label="正文字号"
            />
            <span className="text-[11px] text-gray-500 font-medium tabular-nums w-7">{fontSize}px</span>
          </div>

          {/* 外链转文末脚注开关 */}
          <button
            onClick={() => onToggleFootnotes(!linkFootnotes)}
            className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium border transition-all cursor-pointer shadow-2xs flex-shrink-0 ${
              linkFootnotes
                ? 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100'
                : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
            }`}
            title="微信公众号无法直接跳转外链。开启后自动将 [文字](链接) 编译为文末 [1] 参考链接清单"
          >
            <Link2 className="w-3.5 h-3.5 text-indigo-600" />
            <span className="hidden sm:inline">外链脚注</span>
            <span
              className={`text-[10px] px-1 py-0.2 rounded font-bold ${
                linkFootnotes ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-600'
              }`}
            >
              {linkFootnotes ? '开' : '关'}
            </span>
          </button>

          {/* 首句设为标题开关 */}
          {onToggleFirstLineAsTitle && (
            <button
              onClick={() => onToggleFirstLineAsTitle(!firstLineAsTitle)}
              className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium border transition-all cursor-pointer shadow-2xs flex-shrink-0 ${
                firstLineAsTitle
                  ? 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                  : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
              }`}
              title="开启后首句作为文章 H1 大标题；关闭后首句作为正文首个段落"
            >
              <Heading1 className="w-3.5 h-3.5 text-amber-600" />
              <span className="hidden sm:inline">首句标题</span>
              <span
                className={`text-[10px] px-1 py-0.2 rounded font-bold ${
                  firstLineAsTitle ? 'bg-amber-600 text-white' : 'bg-gray-200 text-gray-600'
                }`}
              >
                {firstLineAsTitle ? '开' : '关'}
              </span>
            </button>
          )}
        </div>

        {/* 右侧：导出操作（复制为主操作，置于最前；AI 与导出为次级） */}
        <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
          <div className="w-px h-6 bg-gray-200 mx-0.5" aria-hidden />
          <button
            onClick={handleCopyRichText}
            className="flex items-center gap-1.5 px-3 sm:px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-sm text-white font-semibold transition-colors cursor-pointer shadow-sm"
            title="复制带完整内联样式的富文本，支持原封不动粘贴到微信公众号后台"
          >
            <Copy className="w-4 h-4" />
            <span>一键复制</span>
          </button>

          <button
            onClick={handleExportImage}
            disabled={exporting}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-50 hover:bg-gray-100 text-sm text-gray-700 font-medium transition-colors border border-gray-200 cursor-pointer shadow-2xs disabled:opacity-50"
            title="导出整篇排版长图为 2x 高清 PNG"
          >
            <ImageDown className="w-4 h-4 text-gray-600" />
            <span className="hidden md:inline">{exporting ? '导出中...' : '导出长图'}</span>
            <span className="md:hidden">长图</span>
          </button>

          <button
            onClick={handleDownloadMd}
            disabled={!markdown.trim()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-50 hover:bg-gray-100 text-sm text-gray-700 font-medium transition-colors border border-gray-200 cursor-pointer shadow-2xs disabled:opacity-50"
            title="下载当前内容的 Markdown 源文件（.md），可导入其他编辑器"
          >
            <FileDown className="w-4 h-4 text-gray-600" />
            <span className="hidden xl:inline">下载 MD</span>
          </button>
        </div>
      </div>

      {/* 色彩选择器弹窗 */}
      <ColorPickerModal
        isOpen={isColorPickerOpen}
        onClose={() => setIsColorPickerOpen(false)}
        currentColor={currentColor}
        onSelectColor={onSelectColor}
        themeName={theme.name}
      />
    </>
  );
}
