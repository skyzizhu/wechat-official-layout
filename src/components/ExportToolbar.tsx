'use client';

import { Palette, ChevronDown, Copy, ImageDown, Pipette, Link2, Heading1 } from 'lucide-react';
import type { ThemePreset, FontSizeOption } from '@/themes';
import { copyRichText, exportAsImage } from '@/lib/export';
import { useToast } from './Toast';
import { ColorPickerModal } from './ColorPickerModal';
import React, { useState } from 'react';

interface ExportToolbarProps {
  previewRef: React.RefObject<HTMLDivElement | null>;
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
}

export function ExportToolbar({
  previewRef,
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
}: ExportToolbarProps) {
  const { showToast } = useToast();
  const [exporting, setExporting] = useState(false);
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);

  const handleCopyRichText = async () => {
    if (!previewRef.current) return;
    try {
      await copyRichText(previewRef.current, theme, currentColor);
      showToast('✅ 微信公众号富文本已复制！格式与样式严格适配，可直接粘贴发布');
    } catch {
      showToast('❌ 复制失败，请重试');
    }
  };

  const handleExportImage = async () => {
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
      <div className="h-12 border-b border-gray-200 bg-white flex items-center justify-between px-3 sm:px-4 flex-shrink-0 shadow-xs gap-2">
        {/* 左侧：排版预设选择按钮 + 风格主色调节 + 字号大小微调器 + 外链转脚注开关 */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 overflow-x-auto no-scrollbar py-1">
          <button
            onClick={onOpenThemeSelector}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs sm:text-sm font-semibold transition-all cursor-pointer border border-blue-200 shadow-2xs flex-shrink-0"
            title="点击切换 16 款个性排版风格"
          >
            <Palette className="w-4 h-4 text-blue-600" />
            <span>{theme.name}</span>
            <ChevronDown className="w-3.5 h-3.5 text-blue-500" />
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
            <span className="hidden md:inline">主色搭配</span>
            <Pipette className="w-3 h-3 text-gray-400" />
          </button>

          {/* 字号大小微调器 (14 / 15 / 16) */}
          <div className="flex items-center bg-gray-100 p-0.5 rounded-lg border border-gray-200 text-xs flex-shrink-0">
            <span className="hidden xl:inline text-gray-400 px-1 text-[11px] font-medium">字号:</span>
            {(['14', '15', '16'] as const).map((size) => (
              <button
                key={size}
                onClick={() => onFontSizeChange(size)}
                className={`px-2 py-0.5 rounded-md transition-all font-medium cursor-pointer ${
                  fontSize === size
                    ? 'bg-white text-blue-600 shadow-2xs font-bold'
                    : 'text-gray-500 hover:text-gray-800'
                }`}
                title={`${size}px 字号 - ${size === '14' ? '紧凑小巧' : size === '15' ? '微信推荐黄金字号' : '清晰大号'}`}
              >
                {size}
              </button>
            ))}
          </div>

          {/* 外链转文末脚注开关 */}
          <button
            onClick={() => onToggleFootnotes(!linkFootnotes)}
            className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium border transition-all cursor-pointer shadow-2xs flex-shrink-0 ${
              linkFootnotes
                ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
            }`}
            title="微信公众号无法直接跳转外链。开启后自动将 [文字](链接) 编译为文末 [1] 参考链接清单"
          >
            <Link2 className="w-3.5 h-3.5 text-blue-600" />
            <span className="hidden sm:inline">外链转脚注</span>
            <span
              className={`text-[10px] px-1 py-0.2 rounded font-bold ${
                linkFootnotes ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
              }`}
            >
              {linkFootnotes ? '开' : '关'}
            </span>
          </button>

          {/* 首句设为标题开关（默认关闭：第一句话作为详情内容中的首个正文段落） */}
          {onToggleFirstLineAsTitle && (
            <button
              onClick={() => onToggleFirstLineAsTitle(!firstLineAsTitle)}
              className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium border transition-all cursor-pointer shadow-2xs flex-shrink-0 ${
                firstLineAsTitle
                  ? 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                  : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
              }`}
              title="默认关闭：第一句话作为正文详情首段；开启后符合条件的首句将提升为文章大标题"
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

        {/* 右侧：导出操作 */}
        <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
          <button
            onClick={handleCopyRichText}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-50 hover:bg-gray-100 text-sm text-gray-700 font-medium transition-colors border border-gray-200 cursor-pointer shadow-2xs"
            title="复制带完整内联样式的富文本，支持原封不动粘贴到微信公众号后台"
          >
            <Copy className="w-4 h-4 text-gray-600" />
            <span className="hidden sm:inline">复制富文本</span>
            <span className="sm:hidden">复制</span>
          </button>

          <button
            onClick={handleExportImage}
            disabled={exporting}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-sm text-white font-medium transition-colors cursor-pointer shadow-xs disabled:opacity-50"
            title="导出整篇排版长图为 2x 高清 PNG"
          >
            <ImageDown className="w-4 h-4" />
            <span>{exporting ? '导出中...' : '导出长图'}</span>
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
