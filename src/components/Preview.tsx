'use client';

import { MarkdownRenderer } from './MarkdownRenderer';
import type { ThemePreset } from '@/themes/types';
import React from 'react';

interface PreviewProps {
  content: string;
  theme: ThemePreset;
  previewRef: React.RefObject<HTMLDivElement | null>;
}

export function Preview({ content, theme, previewRef }: PreviewProps) {
  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar bg-[#eef0f3] p-4 sm:p-10 flex justify-center items-start">
      <div
        ref={previewRef}
        style={{
          ...theme.container,
          margin: 0, // 核心修复：由父级 flex 居中，避免计算样式产生 margin-left 像素偏移导致长图导出右移截断
        }}
        className="shadow-[0_8px_40px_-12px_rgba(0,0,0,0.12)] w-full transition-all"
      >
        <MarkdownRenderer content={content} theme={theme} />
      </div>
    </div>
  );
}
