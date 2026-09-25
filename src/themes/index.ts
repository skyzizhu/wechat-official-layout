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

export type FontSizeOption = '14' | '15' | '16';

/**
 * 字号大小微调器应用器：
 * 针对公众号阅读习惯定制三档黄金字号体系（14px 紧凑小号 / 15px 微信标准 / 16px 醒目大号）
 * 保持标题、正文、引用、列表层级比例协调微调。
 */
export function applyFontSizeToTheme(
  theme: ThemePreset,
  size: FontSizeOption = '15'
): ThemePreset {
  if (size === '15') {
    return theme; // 默认微信推荐黄金字号
  }

  if (size === '14') {
    // 14px 紧凑精致型
    return {
      ...theme,
      container: {
        ...theme.container,
        fontSize: '14px',
        lineHeight: '1.8',
      },
      elements: {
        ...theme.elements,
        h1: {
          ...theme.elements.h1,
          fontSize: '22px',
        },
        h2: {
          ...theme.elements.h2,
          fontSize: '17px',
        },
        h3: {
          ...theme.elements.h3,
          fontSize: '15px',
        },
        p: {
          ...theme.elements.p,
          fontSize: '14px',
          lineHeight: '1.8',
        },
        blockquote: {
          ...theme.elements.blockquote,
          fontSize: '13.5px',
          lineHeight: '1.75',
        },
        li: {
          ...theme.elements.li,
          fontSize: '14px',
          lineHeight: '1.75',
        },
        code: {
          ...theme.elements.code,
          fontSize: '0.86em',
        },
      },
    };
  }

  // size === '16': 16px 醒目通透型
  return {
    ...theme,
    container: {
      ...theme.container,
      fontSize: '16.5px',
      lineHeight: '1.9',
    },
    elements: {
      ...theme.elements,
      h1: {
        ...theme.elements.h1,
        fontSize: '26px',
      },
      h2: {
        ...theme.elements.h2,
        fontSize: '20px',
      },
      h3: {
        ...theme.elements.h3,
        fontSize: '17.5px',
      },
      p: {
        ...theme.elements.p,
        fontSize: '16.5px',
        lineHeight: '1.9',
      },
      blockquote: {
        ...theme.elements.blockquote,
        fontSize: '15.5px',
        lineHeight: '1.85',
      },
      li: {
        ...theme.elements.li,
        fontSize: '16px',
        lineHeight: '1.85',
      },
      code: {
        ...theme.elements.code,
        fontSize: '0.9em',
      },
    },
  };
}

export type { ThemePreset } from './types';
