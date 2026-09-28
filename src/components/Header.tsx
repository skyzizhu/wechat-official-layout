'use client';

import { Type } from 'lucide-react';
import { APP_VERSION } from '@/lib/version';

export function Header() {
  return (
    <header className="h-14 bg-white/65 backdrop-blur-2xl [saturate:1.8] border-b border-black/[0.05] shadow-[0_1px_3px_rgba(0,0,0,0.03)] flex items-center justify-between px-6 flex-shrink-0 sticky top-0 z-30">
      <div className="flex items-center gap-2">
        <span className="w-7 h-7 rounded-[10px] bg-gradient-to-br from-blue-600 via-indigo-500 to-violet-500 flex items-center justify-center shadow-md shadow-indigo-500/25 ring-1 ring-white/20">
          <Type className="w-4 h-4 text-white drop-shadow-sm" />
        </span>
        <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-gray-900 via-gray-800 to-gray-500 bg-clip-text text-transparent">文排</span>
        <span className="text-[10px] text-gray-300 ml-1 hidden md:inline" title="当前部署版本（线上排查旧缓存时核对）">{APP_VERSION}</span>
        <span className="text-xs text-gray-400 ml-2 hidden sm:inline">公众号文章排版工具 · 纯文本一键美化</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-xs text-gray-400">选择排版，一键美化</span>
      </div>
    </header>
  );
}
