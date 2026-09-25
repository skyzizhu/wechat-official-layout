'use client';

import { X, RotateCcw, Check, Sparkles } from 'lucide-react';
import { PRESET_THEME_COLORS } from '@/lib/color-harmonics';
import React, { useState } from 'react';

interface ColorPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentColor: string;
  onSelectColor: (color: string) => void;
  themeName: string;
}

export function ColorPickerModal({
  isOpen,
  onClose,
  currentColor,
  onSelectColor,
  themeName,
}: ColorPickerModalProps) {
  const [customHex, setCustomHex] = useState(currentColor || '#2563eb');

  if (!isOpen) return null;

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (/^#[0-9A-Fa-f]{6}$/.test(customHex)) {
      onSelectColor(customHex);
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-2xs flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6 border border-gray-100 animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-gray-100">
          <div>
            <div className="flex items-center gap-1.5 font-bold text-gray-900 text-base">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>智能色彩搭配</span>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              为「{themeName}」自定主色，系统自动智能调和全套版面色彩
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 预设推荐色彩矩阵 */}
        <div className="my-5">
          <label className="text-xs font-semibold text-gray-600 mb-3 block">
            大师经典色系推荐
          </label>
          <div className="grid grid-cols-4 gap-2.5">
            {PRESET_THEME_COLORS.map((item) => {
              const isSelected =
                (!item.hex && !currentColor) ||
                (item.hex && item.hex.toLowerCase() === currentColor.toLowerCase());

              return (
                <button
                  key={item.name}
                  onClick={() => {
                    onSelectColor(item.hex);
                    if (item.hex) setCustomHex(item.hex);
                    onClose();
                  }}
                  className={`p-2 rounded-xl border flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                    isSelected
                      ? 'border-blue-600 bg-blue-50/60 ring-2 ring-blue-200'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <div
                    style={{
                      backgroundColor: item.hex || '#9ca3af',
                    }}
                    className="w-7 h-7 rounded-full shadow-xs flex items-center justify-center relative border border-black/10"
                  >
                    {!item.hex && (
                      <span className="text-[10px] text-white font-bold">原</span>
                    )}
                    {isSelected && (
                      <Check className="w-3.5 h-3.5 text-white drop-shadow-md stroke-[3]" />
                    )}
                  </div>
                  <span className="text-[11px] text-gray-700 font-medium truncate w-full text-center">
                    {item.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 自定义色板选择器 */}
        <div className="pt-4 border-t border-gray-100">
          <label className="text-xs font-semibold text-gray-600 mb-2.5 block">
            任意自定义主色
          </label>
          <form onSubmit={handleCustomSubmit} className="flex items-center gap-3">
            <div className="relative flex items-center">
              <input
                type="color"
                value={customHex}
                onChange={(e) => setCustomHex(e.target.value)}
                className="w-10 h-10 rounded-xl cursor-pointer border border-gray-200 p-0.5"
              />
            </div>
            <input
              type="text"
              value={customHex}
              onChange={(e) => setCustomHex(e.target.value)}
              placeholder="#2563eb"
              className="flex-1 px-3 py-2 text-xs font-mono border border-gray-200 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold cursor-pointer shadow-xs transition-colors"
            >
              应用
            </button>
          </form>
        </div>

        {/* 底部说明与重置 */}
        <div className="mt-5 pt-3.5 border-t border-gray-100 flex items-center justify-between text-xs">
          <span className="text-[11px] text-gray-400">
            💡 其他文字与背景将智能和谐搭配
          </span>
          {currentColor && (
            <button
              onClick={() => {
                onSelectColor('');
                onClose();
              }}
              className="flex items-center gap-1 text-[11px] text-gray-500 hover:text-red-600 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              恢复模板原色
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
