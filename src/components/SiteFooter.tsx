'use client';

import React, { useState } from 'react';
import { APP_VERSION } from '@/lib/version';
import { SITE_URL } from '@/lib/site';
import { HelpCircle } from 'lucide-react';
import { SeoGuideSection } from './SeoGuideSection';

/**
 * 站点页脚：品牌 + Slogan + 排版指南与FAQ + 版权 + 关联站点
 * 细窄条设计（h-9），不挤压编辑/预览工作区，兼具 SEO 知识库承载
 */
export function SiteFooter() {
  const [showGuide, setShowGuide] = useState(false);
  const year = new Date().getFullYear();

  return (
    <>
      <footer className="h-9 flex-shrink-0 border-t border-black/[0.04] bg-white/60 backdrop-blur flex items-center justify-center px-4 text-[11px] text-gray-400 gap-2 select-none">
        <span className="font-medium text-gray-500">文排</span>
        <span aria-hidden>·</span>
        <span>让每一篇文章，都有体面的排版</span>
        <span aria-hidden className="hidden sm:inline">·</span>

        {/* 触发排版指南与 FAQ 弹窗，同时承载 SEO 爬虫抓取入口 */}
        <button
          onClick={() => setShowGuide(true)}
          className="hidden sm:inline-flex items-center gap-1 text-indigo-600/90 hover:text-indigo-700 font-medium cursor-pointer transition-colors"
          title="查看微信公众号文章排版使用指南与常见问题"
        >
          <HelpCircle className="w-3 h-3" />
          <span>指南 &amp; FAQ</span>
        </button>

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
        <span className="hidden lg:inline">{APP_VERSION}</span>
      </footer>

      {/* 挂载 SEO 语义结构与使用指南抽屉 */}
      <SeoGuideSection isOpen={showGuide} onClose={() => setShowGuide(false)} />
    </>
  );
}
