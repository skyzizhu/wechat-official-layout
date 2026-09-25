'use client';

import type { ThemePreset } from '@/themes/types';

interface ThemeCardProps {
  theme: ThemePreset;
  isSelected: boolean;
  onClick: () => void;
}

export function ThemeCard({ theme, isSelected, onClick }: ThemeCardProps) {
  const isDark =
    theme.id === 'dark-geek' ||
    theme.id === 'tech-future' ||
    theme.id === 'curator-gallery';

  const accentColor = (theme.elements.h1.color as string) || '#2563eb';

  return (
    <button
      onClick={onClick}
      className={`rounded-xl overflow-hidden border-2 transition-all hover:shadow-lg text-left cursor-pointer flex flex-col h-full ${
        isSelected
          ? 'border-blue-600 shadow-md ring-2 ring-blue-300'
          : 'border-gray-200 hover:border-gray-300'
      }`}
    >
      {/* 缩略图版式标本区域 */}
      <div
        style={{
          background: `linear-gradient(135deg, ${theme.cardGradient[0]}, ${theme.cardGradient[1]})`,
        }}
        className="h-32 p-3 flex flex-col justify-between relative overflow-hidden select-none border-b border-gray-100"
      >
        {/* 顶部微型风格分类标签 */}
        <div className="flex items-center justify-between">
          <span
            style={{
              backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.75)',
              color: isDark ? '#e2e8f0' : (theme.elements.h2.color as string) || '#18181b',
              backdropFilter: 'blur(4px)',
            }}
            className="text-[9px] font-semibold px-1.5 py-0.5 rounded shadow-2xs tracking-wide"
          >
            {theme.tags[0] || '精选'}
          </span>
          <span
            style={{ backgroundColor: accentColor }}
            className="w-2.5 h-2.5 rounded-full shadow-xs border border-white/50"
          />
        </div>

        {/* 标本排印预览 */}
        <div
          style={{
            fontFamily: theme.container.fontFamily as string,
          }}
          className="mt-auto"
        >
          {/* H1 预览 */}
          <div
            style={{
              fontWeight: 800,
              fontSize: '13px',
              color: isDark ? '#ffffff' : accentColor,
              letterSpacing: (theme.elements.h1.letterSpacing as string) || 'normal',
              marginBottom: '4px',
            }}
            className="truncate"
          >
            {theme.name}
          </div>

          {/* H2 与正文视觉微预览 */}
          <div
            style={{
              color: isDark ? '#94a3b8' : (theme.elements.p.color as string) || '#4b5563',
              fontSize: '10px',
            }}
            className="flex items-center gap-1.5 truncate opacity-90"
          >
            {theme.h2Decoration === 'seal-tag' && (
              <span style={{ color: accentColor }}>「 标题 」</span>
            )}
            {(theme.h2Decoration === 'magazine-centered' || theme.h2Decoration === 'gallery-line') && (
              <span>── ✦ ──</span>
            )}
            {theme.h2Decoration === 'literary-dash' && (
              <span>— 随笔 —</span>
            )}
            {theme.h2Decoration === 'pop-box' && (
              <span className="bg-yellow-300 text-black px-1 font-bold border border-black text-[8.5px]">潮流</span>
            )}
            {theme.h2Decoration === 'terminal-prompt' && (
              <span style={{ color: accentColor }}>❯ prompt</span>
            )}
            {theme.h2Decoration !== 'seal-tag' &&
              theme.h2Decoration !== 'magazine-centered' &&
              theme.h2Decoration !== 'gallery-line' &&
              theme.h2Decoration !== 'literary-dash' &&
              theme.h2Decoration !== 'pop-box' &&
              theme.h2Decoration !== 'terminal-prompt' && (
                <span className="flex items-center gap-1">
                  <span style={{ backgroundColor: accentColor }} className="w-1 h-2.5 rounded-xs inline-block" />
                  <span>章节排版</span>
                </span>
              )}
            <span className="text-[9px] opacity-60">· 阅览正文</span>
          </div>
        </div>
      </div>

      {/* 底部信息区域 */}
      <div className="p-3 bg-white flex-1 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between">
            <span className="font-bold text-sm text-gray-900">{theme.name}</span>
            {isSelected && (
              <span className="text-[10px] bg-blue-100 text-blue-700 font-semibold px-1.5 py-0.2 rounded">
                生效中
              </span>
            )}
          </div>
          <div className="text-xs text-gray-500 mt-1 line-clamp-1">{theme.description}</div>
        </div>

        <div className="flex gap-1 mt-2.5 flex-wrap">
          {theme.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
    </button>
  );
}
