'use client';

import React from 'react';
import { APP_VERSION } from '@/lib/version';
import { SITE_URL } from '@/lib/site';

/**
 * 站点页脚：品牌 + Slogan + 版权 + 备案占位 + 关联站点
 * 细窄条设计（h-9），不挤压编辑/预览工作区
 */
export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="h-9 flex-shrink-0 border-t border-black/[0.04] bg-white/60 backdrop-blur flex items-center justify-center px-4 text-[11px] text-gray-400 gap-2 select-none">
      <span className="font-medium text-gray-500">文排</span>
      <span aria-hidden>·</span>
      <span>让每一篇文章，都有体面的排版</span>
      <span aria-hidden className="hidden sm:inline">·</span>
      <span className="hidden sm:inline">
        © {year} XTools
      </span>
      <a
        href={SITE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="hidden sm:inline hover:text-indigo-500 transition-colors"
        title="前往 XTools 官网"
      >
        XTools 出品
      </a>
      {/* ICP 备案号：大陆服务器依法必须展示；上线后替换为实际备案号，海外服务器可删除此行 */}
      <a
        href="https://beian.miit.gov.cn/"
        target="_blank"
        rel="noopener noreferrer"
        className="hidden lg:inline hover:text-gray-500 transition-colors"
        title="替换为你的实际备案号；海外部署可删除"
      >
        京ICP备XXXXXXXX号-1
      </a>
      <span aria-hidden className="hidden lg:inline">·</span>
      <span className="hidden lg:inline">{APP_VERSION}</span>
    </footer>
  );
}
