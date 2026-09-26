'use client';

import { Type } from 'lucide-react';

export function Header() {
  return (
    <header className="h-14 bg-white/80 backdrop-blur-xl border-b border-gray-200/60 flex items-center justify-between px-6 flex-shrink-0 sticky top-0 z-30">
      <div className="flex items-center gap-2">
        <span className="w-6 h-6 rounded-lg bg-gradient-to-br from-blue-600 to-violet-500 flex items-center justify-center shadow-sm">
          <Type className="w-4 h-4 text-white" />
        </span>
        <span className="font-bold text-lg bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">文排</span>
        <span className="text-xs text-gray-400 ml-2 hidden sm:inline">一键文章排版</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-xs text-gray-400">选择排版，一键美化</span>
      </div>
    </header>
  );
}
