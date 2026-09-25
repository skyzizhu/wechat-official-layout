'use client';

import { Type } from 'lucide-react';

export function Header() {
  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6 flex-shrink-0">
      <div className="flex items-center gap-2">
        <Type className="w-5 h-5 text-blue-600" />
        <span className="font-bold text-lg">文排</span>
        <span className="text-xs text-gray-400 ml-2 hidden sm:inline">一键文章排版</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-xs text-gray-400">选择排版，一键美化</span>
      </div>
    </header>
  );
}
