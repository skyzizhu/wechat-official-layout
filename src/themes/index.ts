import type { CSSProperties } from 'react';
import { ThemePreset } from './types';
import { modernMinimal } from './presets/modern-minimal';
import { classicAcademic } from './presets/classic-academic';
import { wechat } from './presets/wechat';
import { magazine } from './presets/magazine';
import { businessReport } from './presets/business-report';
import { literaryFresh } from './presets/literary-fresh';
import { darkGeek } from './presets/dark-geek';
import { retroNewspaper } from './presets/retro-newspaper';
import { warmJournal } from './presets/warm-journal';
import { techFuture } from './presets/tech-future';
// 6 个新增的高颜值排版预设
import { neoChinese } from './presets/neo-chinese';
import { morandiSoft } from './presets/morandi-soft';
import { popBrutalism } from './presets/pop-brutalism';
import { warmLatte } from './presets/warm-latte';
import { curatorGallery } from './presets/curator-gallery';
import { freshMint } from './presets/fresh-mint';
import { generateHarmonicPalette } from '@/lib/color-harmonics';

export const allThemes: ThemePreset[] = [
  wechat,          // 公众号风
  neoChinese,      // 新中式 / 东方雅致
  morandiSoft,     // 莫兰迪柔调
  popBrutalism,    // 潮流波普 / 新野兽派
  warmLatte,       // 暖阳拿铁 / 咖啡慢读
  freshMint,       // 薄荷柠檬 / 清新活力
  modernMinimal,   // 现代简约 / 瑞士风格
  magazine,        // 杂志风 / 时尚画报
  businessReport,  // 商务报告 / 麦肯锡
  curatorGallery,  // 艺术策展 / 画廊黑金
  literaryFresh,   // 文艺清新 / 日系散文
  classicAcademic, // 经典学术 / 期刊论文
  retroNewspaper,  // 复古报纸 / 百年老报
  warmJournal,     // 温暖手帐 / 和纸胶带
  darkGeek,        // 暗色极客 / macOS终端
  techFuture,      // 科技未来 / 赛博HUD
];

export const DEFAULT_THEME_ID = 'wechat';

export function getThemeById(id: string): ThemePreset {
  return allThemes.find((t) => t.id === id) ?? allThemes[0];
}

/**
 * 智能色彩搭配引擎应用器：
 * 当用户指定一个主色时，自动保持该模板的版心与骨架，
 * 智能重排标题、线框、徽章、引用块背景、高亮马克笔等为全新搭配色系！
 */
export function applyColorToTheme(baseTheme: ThemePreset, customColor?: string): ThemePreset {
  if (!customColor || !customColor.trim()) {
    return baseTheme;
  }

  const palette = generateHarmonicPalette(customColor);

  return {
    ...baseTheme,
    // 渐变卡片预览色
    cardGradient: [palette.primaryLight, palette.primaryBorder],
    // 粗体划线荧光笔底色
    markHighlight: {
      background: palette.highlightBg,
      padding: '0 4px',
      borderRadius: '2px',
      fontWeight: 700,
      color: palette.primaryDark,
    },
    container: {
      ...baseTheme.container,
      color: palette.neutralText,
    },
    elements: {
      ...baseTheme.elements,
      h1: {
        ...baseTheme.elements.h1,
        color: palette.primary,
        borderBottomColor: palette.primaryBorder,
      },
      h2: {
        ...baseTheme.elements.h2,
        color: palette.primaryDark,
      },
      h3: {
        ...baseTheme.elements.h3,
        color: palette.primary,
        borderLeftColor: palette.primary,
      },
      p: {
        ...baseTheme.elements.p,
        color: palette.neutralText,
      },
      blockquote: {
        ...baseTheme.elements.blockquote,
        backgroundColor: palette.primaryLight,
        borderLeftColor: palette.primary,
        borderColor: palette.primaryBorder,
        color: palette.primaryDark,
      },
      a: {
        ...baseTheme.elements.a,
        color: palette.primary,
      },
      strong: {
        ...baseTheme.elements.strong,
        color: palette.primaryDark,
        background: palette.highlightBg,
        padding: '0 3px',
      },
      hr: {
        ...baseTheme.elements.hr,
        borderTopColor: palette.primaryBorder,
      },
      th: {
        ...baseTheme.elements.th,
        backgroundColor: palette.primaryLight,
        color: palette.primaryDark,
        borderBottomColor: palette.primary,
      },
      code: {
        ...baseTheme.elements.code,
        backgroundColor: palette.primaryLight,
        color: palette.primaryDark,
        borderColor: palette.primaryBorder,
      },
    },
  };
}

export type FontSizeOption = number;

/**
 * 字号连续缩放：以 15px 为基准，对主题内全部 px 字号等比缩放（保留主题内部层级比例）。
 * em 单位（如代码块）自动跟随，无需处理。
 */
export function applyFontSizeToTheme(theme: ThemePreset, size: FontSizeOption = 15): ThemePreset {
  if (!Number.isFinite(size) || size === 15 || size <= 0) return theme;
  const ratio = size / 15;
  const scalePx = (v: unknown, fallback: number): string => {
    const m = typeof v === 'string' ? v.match(/^([\d.]+)px$/) : null;
    const base = m ? parseFloat(m[1]) : fallback;
    return Math.round(base * ratio * 10) / 10 + 'px';
  };
  const elements = { ...theme.elements } as ThemePreset['elements'];
  (Object.keys(elements) as (keyof ThemePreset['elements'])[]).forEach((key) => {
    if (key === 'code') return; // em 单位随父级自动缩放
    const el = elements[key] as CSSProperties;
    if (el && typeof el.fontSize === 'string' && el.fontSize.includes('px')) {
      elements[key] = { ...el, fontSize: scalePx(el.fontSize, 15) };
    }
  });
  return {
    ...theme,
    container: {
      ...theme.container,
      fontSize: scalePx(theme.container.fontSize, 15.5),
    },
    elements,
  };
}

export type { ThemePreset } from './types';
