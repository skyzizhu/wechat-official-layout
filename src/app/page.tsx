'use client';

import { useState, useRef, useMemo, useEffect } from 'react';
import { Header } from '@/components/Header';
import { Editor, ContentMode } from '@/components/Editor';
import { Preview } from '@/components/Preview';
import { ThemeSelector } from '@/components/ThemeSelector';
import { ExportToolbar } from '@/components/ExportToolbar';
import { ToastProvider, useToast } from '@/components/Toast';
import {
  getThemeById,
  DEFAULT_THEME_ID,
  applyColorToTheme,
  applyFontSizeToTheme,
  FontSizeOption,
} from '@/themes';
import { SAMPLE_MARKDOWN, SAMPLE_PLAIN_TEXT, SAMPLE_PRESETS } from '@/lib/sample-markdown';
import { processContentByMode } from '@/lib/smart-parser';
import { convertLinksToFootnotes } from '@/lib/link-footnotes';
import { PenLine, Eye } from 'lucide-react';

export default function Home() {
  return (
    <ToastProvider>
      <MainLayout />
    </ToastProvider>
  );
}

function MainLayout() {
  const { showToast } = useToast();

  const [markdown, setMarkdown] = useState(SAMPLE_MARKDOWN);
  const [themeId, setThemeId] = useState(DEFAULT_THEME_ID);
  const [customColor, setCustomColor] = useState<string>(''); // 用户自定义主色
  const [fontSize, setFontSize] = useState<FontSizeOption>('15'); // 字号微调：14px / 15px / 16px
  const [linkFootnotes, setLinkFootnotes] = useState<boolean>(true); // 微信外链转文末脚注开关 (默认开启)
  const [mode, setMode] = useState<ContentMode>('auto');
  const [showThemes, setShowThemes] = useState(false);
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('preview');
  const [draftStatus, setDraftStatus] = useState<string>('草稿就绪');
  const [isLoaded, setIsLoaded] = useState(false);

  const previewRef = useRef<HTMLDivElement>(null);

  // 1. 初始化从浏览器 LocalStorage 恢复草稿与用户偏好
  useEffect(() => {
    try {
      const savedDraft = localStorage.getItem('radiant_article_draft');
      if (savedDraft !== null && savedDraft.trim() !== '') {
        setMarkdown(savedDraft);
      }

      const savedTheme = localStorage.getItem('radiant_theme_id');
      if (savedTheme) setThemeId(savedTheme);

      const savedColor = localStorage.getItem('radiant_custom_color');
      if (savedColor) setCustomColor(savedColor);

      const savedFontSize = localStorage.getItem('radiant_font_size') as FontSizeOption;
      if (savedFontSize && ['14', '15', '16'].includes(savedFontSize)) {
        setFontSize(savedFontSize);
      }

      const savedFootnotes = localStorage.getItem('radiant_link_footnotes');
      if (savedFootnotes !== null) {
        setLinkFootnotes(savedFootnotes === 'true');
      }

      const savedMode = localStorage.getItem('radiant_content_mode') as ContentMode;
      if (savedMode && ['auto', 'plain-text', 'markdown'].includes(savedMode)) {
        setMode(savedMode);
      }

      setDraftStatus('草稿已载入');
      setIsLoaded(true);
    } catch {
      setIsLoaded(true);
    }
  }, []);

  // 2. 自动防抖暂存草稿到 localStorage (500ms)
  useEffect(() => {
    if (!isLoaded) return;

    const timer = setTimeout(() => {
      try {
        localStorage.setItem('radiant_article_draft', markdown);
        localStorage.setItem('radiant_theme_id', themeId);
        localStorage.setItem('radiant_custom_color', customColor);
        localStorage.setItem('radiant_font_size', fontSize);
        localStorage.setItem('radiant_link_footnotes', String(linkFootnotes));
        localStorage.setItem('radiant_content_mode', mode);

        const now = new Date();
        const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now
          .getMinutes()
          .toString()
          .padStart(2, '0')}`;
        setDraftStatus(`已自动保存 ${timeStr}`);
      } catch (err) {
        console.warn('LocalStorage save failed', err);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [markdown, themeId, customColor, fontSize, linkFootnotes, mode, isLoaded]);

  // 3. 一键清空处理
  const handleClear = () => {
    setMarkdown('');
    try {
      localStorage.removeItem('radiant_article_draft');
    } catch {}
    setDraftStatus('内容已清空');
    showToast('🗑️ 输入框内容已清空');
  };

  // 4. 快速恢复范文处理（支持多格式预设库）
  const handleRestoreSample = (presetKey: string = 'markdown') => {
    let text = SAMPLE_MARKDOWN;
    let toastMsg = '📄 已恢复全能 Markdown 范文';

    if (presetKey === 'plain-text' || presetKey === 'all-round-plain-text') {
      text = SAMPLE_PLAIN_TEXT;
      toastMsg = '📝 已恢复全格式纯文本排版范文';
    } else if (SAMPLE_PRESETS[presetKey]) {
      text = SAMPLE_PRESETS[presetKey].content;
      toastMsg = `📋 已载入「${SAMPLE_PRESETS[presetKey].title}」`;
    }

    setMarkdown(text);
    setMode('auto');
    try {
      localStorage.setItem('radiant_article_draft', text);
    } catch {}
    setDraftStatus('范文已载入');
    showToast(toastMsg);
  };

  // 5. 字号微调切换
  const handleFontSizeChange = (size: FontSizeOption) => {
    setFontSize(size);
    showToast(`🔤 已切换为 ${size}px 字号微调体系`);
  };

  // 6. 外链转文末脚注切换
  const handleToggleFootnotes = (enabled: boolean) => {
    setLinkFootnotes(enabled);
    showToast(enabled ? '🔗 外链转文末脚注已开启' : '🔗 外链转文末脚注已关闭');
  };

  // 7. 首句设为大标题开关（默认关闭：第一句话作为详情内容中的首个正文段落）
  const [firstLineAsTitle, setFirstLineAsTitle] = useState(false);
  const handleToggleFirstLineAsTitle = (enabled: boolean) => {
    setFirstLineAsTitle(enabled);
    showToast(
      enabled
        ? '🏷️ 首句设为标题已开启（符合条件的首句将提升为 H1 大标题）'
        : '📝 首句设为标题已关闭（首句默认作为详情内容首个正文段落）'
    );
  };

  // 获取基础预设并智能融合色彩与字号微调
  const rawTheme = getThemeById(themeId);
  const theme = useMemo(() => {
    const coloredTheme = applyColorToTheme(rawTheme, customColor);
    return applyFontSizeToTheme(coloredTheme, fontSize);
  }, [rawTheme, customColor, fontSize]);

  // 智能区分与预处理输入内容，并根据开关自动执行外链转文末脚注与首句标题识别
  const processed = useMemo(() => {
    const rawResult = processContentByMode(markdown, mode, {
      treatFirstLineAsTitle: firstLineAsTitle,
    });
    const withFootnotes = convertLinksToFootnotes(rawResult.renderedMarkdown, linkFootnotes);
    return {
      ...rawResult,
      renderedMarkdown: withFootnotes.content,
      footnotes: withFootnotes.footnotes,
    };
  }, [markdown, mode, linkFootnotes, firstLineAsTitle]);

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <Header />

      {/* 桌面端：左右分栏布局 */}
      <main className="flex-1 flex overflow-hidden">
        {/* 左栏：编辑器 */}
        <div className="hidden lg:flex w-[45%] border-r border-gray-200 flex-col">
          <Editor
            value={markdown}
            onChange={setMarkdown}
            mode={mode}
            onModeChange={setMode}
            onClear={handleClear}
            onRestoreSample={handleRestoreSample}
            draftStatus={draftStatus}
            firstLineAsTitle={firstLineAsTitle}
            onToggleFirstLineAsTitle={handleToggleFirstLineAsTitle}
          />
        </div>

        {/* 右栏：导出工具栏 + 实时排版预览 */}
        <div className="flex-1 flex flex-col min-w-0">
          <ExportToolbar
            theme={theme}
            previewRef={previewRef}
            onOpenThemeSelector={() => setShowThemes(true)}
            currentColor={customColor}
            onSelectColor={setCustomColor}
            fontSize={fontSize}
            onFontSizeChange={handleFontSizeChange}
            linkFootnotes={linkFootnotes}
            onToggleFootnotes={handleToggleFootnotes}
            firstLineAsTitle={firstLineAsTitle}
            onToggleFirstLineAsTitle={handleToggleFirstLineAsTitle}
          />

          {/* 移动端切换视图 */}
          <div className="flex-1 flex flex-col overflow-hidden lg:hidden">
            {activeTab === 'edit' ? (
              <Editor
                value={markdown}
                onChange={setMarkdown}
                mode={mode}
                onModeChange={setMode}
                onClear={handleClear}
                onRestoreSample={handleRestoreSample}
                draftStatus={draftStatus}
                firstLineAsTitle={firstLineAsTitle}
                onToggleFirstLineAsTitle={handleToggleFirstLineAsTitle}
              />
            ) : (
              <Preview
                content={processed.renderedMarkdown}
                theme={theme}
                previewRef={previewRef}
              />
            )}
          </div>

          {/* 桌面端始终显示预览 */}
          <div className="hidden lg:flex flex-1 flex-col overflow-hidden">
            <Preview
              content={processed.renderedMarkdown}
              theme={theme}
              previewRef={previewRef}
            />
          </div>
        </div>
      </main>

      {/* 移动端底部 Tab 栏 */}
      <div className="lg:hidden flex-shrink-0 bg-white border-t border-gray-200 flex">
        <button
          onClick={() => setActiveTab('edit')}
          className={`flex-1 py-3 flex items-center justify-center gap-1.5 text-sm cursor-pointer transition-colors ${
            activeTab === 'edit' ? 'text-blue-600 font-medium' : 'text-gray-400'
          }`}
        >
          <PenLine className="w-4 h-4" />
          编辑内容
        </button>
        <button
          onClick={() => setActiveTab('preview')}
          className={`flex-1 py-3 flex items-center justify-center gap-1.5 text-sm cursor-pointer transition-colors ${
            activeTab === 'preview' ? 'text-blue-600 font-medium' : 'text-gray-400'
          }`}
        >
          <Eye className="w-4 h-4" />
          排版预览
        </button>
      </div>

      {/* 风格选择器弹窗 */}
      <ThemeSelector
        isOpen={showThemes}
        onClose={() => setShowThemes(false)}
        selectedThemeId={themeId}
        onSelect={(newId) => {
          setThemeId(newId);
        }}
      />
    </div>
  );
}
