'use client';

import { APP_VERSION } from '@/lib/version';
import { WenPaiLogo } from '@/components/WenPaiLogo';

export function Header() {
  return (
    <header className="h-14 bg-white/65 backdrop-blur-2xl [saturate:1.8] border-b border-black/[0.05] shadow-[0_1px_3px_rgba(0,0,0,0.03)] flex items-center justify-between px-6 flex-shrink-0 sticky top-0 z-30">
      {/* 搜索引擎核心 H1：视觉隐藏，语义被百度/谷歌/必应蜘蛛 100% 抓取 */}
      <h1 className="sr-only">
        文排 - 免费在线微信公众号文章排版工具 | 纯文本智能识别，一键美化复制
      </h1>

      <div className="flex items-center gap-2.5">
        <WenPaiLogo size={28} />
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
