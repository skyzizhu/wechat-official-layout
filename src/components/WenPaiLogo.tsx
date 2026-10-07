'use client';

import React from 'react';

interface WenPaiLogoProps {
  className?: string;
  size?: number;
  showText?: boolean;
}

/**
 * 文排官方品牌 Logo 组件
 * 采用现代科技圆角图标，融合“文”字与公众号版面网格，兼顾精致感与辨识度。
 */
export function WenPaiLogo({ className = 'w-7 h-7', size = 28, showText = false }: WenPaiLogoProps) {
  return (
    <div className={`inline-flex items-center gap-2 select-none ${showText ? '' : ''}`}>
      <div
        className={`relative ${className} rounded-[9px] overflow-hidden flex-shrink-0 shadow-md shadow-indigo-500/20 ring-1 ring-black/[0.08] transition-transform duration-200 hover:scale-105`}
        style={{ width: size, height: size }}
      >
        <img
          src="/icon-192.png"
          alt="文排 Logo"
          width={size}
          height={size}
          className="w-full h-full object-cover block"
          loading="eager"
        />
      </div>
      {showText && (
        <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-gray-900 via-gray-800 to-gray-500 bg-clip-text text-transparent">
          文排
        </span>
      )}
    </div>
  );
}

/**
 * 纯矢量 SVG 版本 Logo（适用于独立导出、印刷或无需图片静态请求场景）
 */
export function WenPaiSvgLogo({ size = 32, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="wpGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#7C3AED" />
          <stop offset="45%" stopColor="#3B82F6" />
          <stop offset="100%" stopColor="#10B981" />
        </linearGradient>
      </defs>
      {/* 平滑圆角矩形底座 */}
      <rect width="64" height="64" rx="16" fill="url(#wpGrad)" />

      {/* 排版网格参考线 */}
      <g stroke="white" strokeOpacity="0.22" strokeWidth="1">
        <line x1="12" y1="20" x2="52" y2="20" />
        <line x1="12" y1="34" x2="52" y2="34" />
        <line x1="12" y1="48" x2="52" y2="48" />
        <line x1="32" y1="12" x2="32" y2="52" />
      </g>

      {/* 左侧：书法风“文”字简化轮廓 */}
      <g fill="white">
        {/* 顶点 */}
        <circle cx="21" cy="18" r="2.2" />
        {/* 横笔 */}
        <rect x="13" y="23" width="16" height="3" rx="1.5" />
        {/* 撇笔 */}
        <path d="M22 25 Q18 36 12 45 Q15 45 19 39 Q22 34 23 27 Z" />
        {/* 捺笔 */}
        <path d="M19 32 Q23 37 30 45 Q28 43 23 37 Z" />
      </g>

      {/* 右侧：排版段落横线区块 */}
      <g stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeOpacity="0.9">
        <line x1="36" y1="24" x2="51" y2="24" />
        <line x1="36" y1="30" x2="49" y2="30" />
        <line x1="36" y1="36" x2="51" y2="36" />
        <line x1="36" y1="42" x2="45" y2="42" />
      </g>
    </svg>
  );
}
