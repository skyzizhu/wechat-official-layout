'use client';

import { MarkdownRenderer } from './MarkdownRenderer';
import type { ThemePreset } from '@/themes/types';
import React from 'react';

interface PreviewProps {
  content: string;
  theme: ThemePreset;
  previewRef: React.RefObject<HTMLDivElement | null>;
}

// React.memo：content/theme 未变时跳过重渲染（配合 page 的 useDeferredValue，长文输入不再全量重排）
export const Preview = React.memo(function Preview({ content, theme, previewRef }: PreviewProps) {
  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar bg-gradient-to-b from-[#f0f2f5] via-[#eceef2] to-[#e6e9ee] p-4 sm:p-10 flex justify-center items-start">
      <div
        ref={previewRef}
        style={{
          ...theme.container,
          margin: 0, // 核心修复：由父级 flex 居中，避免计算样式产生 margin-left 像素偏移导致长图导出右移截断
        }}
        className="shadow-[0_2px_6px_rgba(15,23,42,0.04),0_16px_48px_-12px_rgba(15,23,42,0.14)] ring-1 ring-black/[0.04] rounded-lg w-full transition-all"
      >
        <MarkdownRenderer content={content} theme={theme} />
      </div>
      {/* 文末收束标记：置于导出容器（previewRef）之外——不进入一键复制/长图，仅给短文预览一个「到底了」的视觉收束 */}
      {content.trim() && (
        <div
          className="select-none"
          style={{ textAlign: 'center', paddingTop: 22, paddingBottom: 4, color: 'rgba(148,163,184,0.75)', fontSize: 12, letterSpacing: '0.4em' }}
        >
          · 完 ·
        </div>
      )}
    </div>
  );
});
