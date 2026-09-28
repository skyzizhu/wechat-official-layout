'use client';

import React, { useState } from 'react';

/**
 * 右下角悬浮胶囊：引导用户前往 XTools 官网下载 App（新标签页打开）。
 * 固定悬浮、不占用页面内任何布局位置；移动端上移避开底部 Tab 栏。
 * 图标加载失败时降级为字母徽标。
 */
export function AppPromoBadge() {
  const [imgOk, setImgOk] = useState(true);
  return (
    <a
      href="https://www.yourtools.xyz/"
      target="_blank"
      rel="noopener noreferrer"
      title="前往 XTools 官网，下载 App 体验更多功能"
      className="fixed right-4 bottom-16 lg:bottom-5 z-40 flex items-center gap-2 pl-1.5 pr-3 py-1.5 rounded-full bg-white/90 hover:bg-white shadow-[0_2px_8px_rgba(15,23,42,0.06),0_8px_24px_-6px_rgba(15,23,42,0.12)] hover:shadow-[0_4px_12px_rgba(15,23,42,0.08),0_12px_32px_-6px_rgba(15,23,42,0.16)] border border-black/[0.05] backdrop-blur-xl transition-all text-xs text-gray-600 hover:text-gray-900"
    >
      {imgOk ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src="https://www.yourtools.xyz/images/xtools-logo.png"
          alt="XTools"
          className="w-6 h-6 rounded-full object-cover bg-gray-100"
          onError={() => setImgOk(false)}
        />
      ) : (
        <span className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-bold">
          Xt
        </span>
      )}
      <span className="whitespace-nowrap">
        更多功能，下载 <span className="font-semibold text-gray-800">XTools App</span>
      </span>
      <span aria-hidden className="text-gray-400">
        ↗
      </span>
    </a>
  );
}
