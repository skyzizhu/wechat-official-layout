'use client';

import { X, Sparkles } from 'lucide-react';
import { ThemeCard } from './ThemeCard';
import { allThemes } from '@/themes';

interface ThemeSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  selectedThemeId: string;
  onSelect: (themeId: string) => void;
}

export function ThemeSelector({
  isOpen,
  onClose,
  selectedThemeId,
  onSelect,
}: ThemeSelectorProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-2xs flex items-center justify-center p-4 sm:p-6"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-5xl max-h-[88vh] overflow-auto p-6 sm:p-8 shadow-2xl border border-gray-100 animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-100">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-gray-900">选择排版风格</h2>
              <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full font-semibold">
                共 {allThemes.length} 款精选风格
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              汇聚新媒体爆款、新中式、莫兰迪、潮流波普、期刊学术等多样化版式，点击即刻套用
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Theme grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 gap-4">
          {allThemes.map((theme) => (
            <ThemeCard
              key={theme.id}
              theme={theme}
              isSelected={theme.id === selectedThemeId}
              onClick={() => {
                onSelect(theme.id);
                onClose();
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
