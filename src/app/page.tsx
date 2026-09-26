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
import { processContentByMode, ConversionDecision } from '@/lib/smart-parser';
import { enhanceWithAi, loadAiSettings, saveAiSettings, AiSettings } from '@/lib/ai-enhance';
import { AiSettingsModal } from '@/components/AiSettingsModal';
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
  const [firstLineAsTitle, setFirstLineAsTitle] = useState(true);
  const [showThemes, setShowThemes] = useState(false);
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('preview');
  const [draftStatus, setDraftStatus] = useState<string>('草稿就绪');
  const [isLoaded, setIsLoaded] = useState(false);
  // 第二阶段：用户纠偏的识别决策（抑制键持久化；已确认保留的会话内隐藏）
  const [suppressedKeys, setSuppressedKeys] = useState<string[]>([]);
  const [dismissedKeys, setDismissedKeys] = useState<string[]>([]);
  // 第三阶段：AI 增强识别
  const [aiSettings, setAiSettings] = useState<AiSettings>({ endpoint: '', apiKey: '', model: 'gpt-4o-mini' });
  const [showAiSettings, setShowAiSettings] = useState(false);
  const [aiApplying, setAiApplying] = useState(false);

  const previewRef = useRef<HTMLDivElement>(null);

  // 1. 初始化从浏览器 LocalStorage 恢复草稿与用户偏好
  useEffect(() => {
    try {
      let savedDraft = localStorage.getItem('radiant_article_draft');
      if (savedDraft !== null) {
        if (savedDraft.trim() === '') {
          setMarkdown('');
        } else {
          // 自动平滑升级旧草稿中不稳定的外网图片为本地高可靠静态图片，避免吞噬末尾的括号或管道符
          let updated = savedDraft
            .replace(/https:\/\/images\.unsplash\.com\/photo-1512820790803-83ca734da794[^\s)"'<>]+/g, '/images/sample/sample-1.jpg')
            .replace(/https:\/\/images\.unsplash\.com\/photo-1544716278-ca5e3f4abd8c[^\s)"'<>]+/g, '/images/sample/sample-2.jpg')
            .replace(/https:\/\/images\.unsplash\.com\/photo-1499750310107-5fef28a66643[^\s)"'<>]+/g, '/images/sample/sample-3.jpg')
            .replace(/https:\/\/images\.unsplash\.com\/photo-1455390582262-044cdead277a[^\s)"'<>]+/g, '/images/sample/sample-4.jpg')
            .replace(/https:\/\/images\.unsplash\.com\/photo-1542744094-3a31f272c490[^\s)"'<>]+/g, '/images/sample/sample-5.jpg')
            .replace(/https:\/\/images\.unsplash\.com\/photo-1460925895917-afdab827c52f[^\s)"'<>]+/g, '/images/sample/sample-6.jpg')
            .replace(/https:\/\/images\.unsplash\.com\/photo-1497633762265-9d179a990aa6[^\s)"'<>]+/g, '/images/sample/sample-7.jpg');

          // 强力修复因历史正则导致缺失右括号的图片语法: ![alt](/images/sample/sample-X.jpg -> ![alt](/images/sample/sample-X.jpg)
          updated = updated.replace(/(!\[[^\]]*\]\(\/images\/sample\/sample-\d+\.jpg)(?!\))/g, '$1)');

          // 若草稿是系统范文但仍有外链遗留，直接对齐最新的 SAMPLE_MARKDOWN
          if (updated.includes('排版之美') && updated.includes('unsplash.com')) {
            updated = SAMPLE_MARKDOWN;
          }

          savedDraft = updated;
          try {
            localStorage.setItem('radiant_article_draft', savedDraft);
          } catch {}
          setMarkdown(savedDraft);
        }
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

      setAiSettings(loadAiSettings());

      const savedSuppressed = localStorage.getItem('radiant_suppressed_decisions');
      if (savedSuppressed) {
        try {
          const parsed = JSON.parse(savedSuppressed);
          if (Array.isArray(parsed)) setSuppressedKeys(parsed);
        } catch {}
      }

      const savedFirstLine = localStorage.getItem('radiant_first_line_title');
      if (savedFirstLine !== null) {
        setFirstLineAsTitle(savedFirstLine === 'true');
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
        localStorage.setItem('radiant_first_line_title', String(firstLineAsTitle));

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
  }, [markdown, themeId, customColor, fontSize, linkFootnotes, mode, firstLineAsTitle, isLoaded]);

  // 3. 一键清空处理
  const handleClear = () => {
    setMarkdown('');
    try {
      localStorage.setItem('radiant_article_draft', '');
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
      suppressedDecisions: suppressedKeys,
    });
    const withFootnotes = convertLinksToFootnotes(rawResult.renderedMarkdown, linkFootnotes);
    return {
      ...rawResult,
      renderedMarkdown: withFootnotes.content,
      footnotes: withFootnotes.footnotes,
    };
  }, [markdown, mode, linkFootnotes, firstLineAsTitle, suppressedKeys]);

  // 第二阶段：低置信度识别决策的纠偏与反馈
  const lowConfidenceDecisions = (processed.decisions || []).filter(
    (d) => d.confidence < 0.75 && !dismissedKeys.includes(`${d.type}:${d.snippet}`)
  );

  const logFeedback = (d: ConversionDecision, action: string) => {
    try {
      const log = JSON.parse(localStorage.getItem('radiant_feedback_log') || '[]');
      log.push({ ts: new Date().toISOString(), action, type: d.type, confidence: d.confidence, snippet: d.snippet });
      localStorage.setItem('radiant_feedback_log', JSON.stringify(log.slice(-200)));
    } catch {}
  };

  const handleResolveDecision = (d: ConversionDecision) => {
    const key = `${d.type}:${d.snippet}`;
    logFeedback(d, d.type === '金句' ? '转为金句' : '改为正文');

    // HTML 代码块：将草稿中对应原始 HTML 块用 ```html 围栏包裹（切换为源码展示）
    if (d.type === 'HTML代码块') {
      setMarkdown((prev) => {
        const lines = prev.split('\n');
        const startIdx = lines.findIndex((l) => l.trim().startsWith('<') && l.includes(d.snippet.slice(0, 10)));
        if (startIdx < 0) return prev;
        let endIdx = startIdx;
        while (endIdx + 1 < lines.length && lines[endIdx + 1].trim() !== '') endIdx++;
        const block = lines.slice(startIdx, endIdx + 1);
        return [...lines.slice(0, startIdx), '```html', ...block, '```', ...lines.slice(endIdx + 1)].join('\n');
      });
      setDraftStatus('已将 HTML 块切换为源码展示');
      return;
    }

    // 金句：将草稿中对应段落包装为居中金句段（升级而非抑制）
    if (d.type === '金句') {
      setMarkdown((prev) => {
        const lines = prev.split('\n');
        const idx = lines.findIndex((l) => l.trim() === d.snippet || l.trim().includes(d.snippet));
        if (idx >= 0) lines[idx] = `<p data-role="golden-line">${lines[idx].trim()}</p>`;
        return lines.join('\n');
      });
      setDraftStatus(`已将「${d.snippet}」转为金句`);
      return;
    }

    // 其他类型：抑制该识别决策（恢复普通正文渲染）
    setSuppressedKeys((prev) => {
      const next = prev.includes(key) ? prev : [...prev, key];
      try {
        localStorage.setItem('radiant_suppressed_decisions', JSON.stringify(next));
      } catch {}
      return next;
    });
    setDraftStatus(`已将「${d.snippet}」改为正文`);
  };

  const handleKeepDecision = (d: ConversionDecision) => {
    const key = `${d.type}:${d.snippet}`;
    setDismissedKeys((prev) => (prev.includes(key) ? prev : [...prev, key]));
    logFeedback(d, '保留');
  };

  const handleExportFeedback = () => {
    try {
      const log = localStorage.getItem('radiant_feedback_log') || '[]';
      const blob = new Blob([log], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `wenpai-feedback-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {}
  };

  // 第三阶段：AI 增强排版 —— 将当前纯文本交给 AI 按系统排版约定直接转换为 Markdown；失败回退启发式结果
  const handleAiEnhance = async () => {
    if (!aiSettings.endpoint || !aiSettings.apiKey) {
      setShowAiSettings(true);
      return;
    }
    setAiApplying(true);
    setDraftStatus('⏳ AI 正在排版…');
    try {
      const md = await enhanceWithAi(markdown, aiSettings);
      setFirstLineAsTitle(true); // AI 输出的 # 大标题需要首句标题开启才能保留
      setMarkdown(md);
      try {
        localStorage.setItem('radiant_article_draft', md);
      } catch {}
      setDraftStatus('✨ AI 排版完成');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setDraftStatus(`AI 排版失败：${msg}`);
      console.warn('AI enhance failed', err);
    } finally {
      setAiApplying(false);
    }
  };

  const handleSaveAiSettings = (s: AiSettings) => {
    setAiSettings(s);
    saveAiSettings(s);
    setDraftStatus('AI 设置已保存');
  };

  return (
    <div className="flex flex-col h-screen bg-[#f6f7f9]">
      <Header />

      {/* 桌面端：左右分栏布局 */}
      <main className="flex-1 flex overflow-hidden">
        {/* 左栏：编辑器 */}
        <div className="hidden lg:flex w-[45%] border-r border-gray-200/70 flex-col">
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
            lowConfidenceDecisions={lowConfidenceDecisions}
            onResolveDecision={handleResolveDecision}
            onKeepDecision={handleKeepDecision}
            onExportFeedback={handleExportFeedback}
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
            aiApplying={aiApplying}
            onAiEnhance={handleAiEnhance}
            onOpenAiSettings={() => setShowAiSettings(true)}
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
                lowConfidenceDecisions={lowConfidenceDecisions}
                onResolveDecision={handleResolveDecision}
                onKeepDecision={handleKeepDecision}
                onExportFeedback={handleExportFeedback}
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

      <AiSettingsModal
        isOpen={showAiSettings}
        settings={aiSettings}
        onClose={() => setShowAiSettings(false)}
        onSave={handleSaveAiSettings}
      />
    </div>
  );
}
