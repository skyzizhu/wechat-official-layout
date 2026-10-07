import { CSSProperties } from 'react';
import type { ThemePreset } from './types';

/**
 * 分级列表样式引擎
 *
 * 与标题层级（H2 > H3 > H4…）呼应，列表层级也遵循视觉权重的单调递减：
 *   一级（章节标题）→ 主题 H2 装饰（不在此处理）
 *   二级（顶层列表项）→ 主题色徽章编号 / 圆点 + 半加重文字，比正文醒目
 *   三级及更深（嵌套列表项）→ 全部统一的轻量样式：空心圆点/朴素数字、正文字色、无荧光高亮
 *
 * 全部为内联样式（微信合规），主色从主题元素推导，
 * 自选主色（applyColorToTheme / activeColor）改写主题后自动跟随。
 */
export interface ListLevelStyleSet {
  /** 顶层有序列表容器：编号由徽章 span 承担，关闭原生序号 */
  depth1Ol: CSSProperties;
  /** 顶层无序列表容器：圆点由标记 span 承担，关闭原生符号 */
  depth1Ul: CSSProperties;
  /** 任务列表容器（复选框自带视觉，不做徽章化） */
  taskListUl: CSSProperties;
  /** 顶层列表项文字：比正文更深、半加重 */
  depth1Li: CSSProperties;
  /** 顶层有序编号徽章 */
  badge: CSSProperties;
  /** 顶层无序圆点标记 */
  dot: CSSProperties;
  /** 嵌套有序列表容器（三级及更深统一） */
  nestedOl: CSSProperties;
  /** 嵌套无序列表容器（三级及更深统一） */
  nestedUl: CSSProperties;
  /** 嵌套列表项：正文字色、常规字重 */
  nestedLi: CSSProperties;
  /** 嵌套列表内的加粗：仅字重区分，不带荧光笔高亮（避免三级比二级更抢眼） */
  nestedStrong: CSSProperties;
}

/** 列表强调主色：链接色通常是最饱和的中调色，其次小节标题色 */
export function resolveListAccent(theme?: ThemePreset): string {
  const el = theme?.elements;
  return (
    (el?.a?.color as string) ||
    (el?.h3?.color as string) ||
    (el?.h2?.color as string) ||
    '#2563eb'
  );
}

export function getListLevelStyles(theme?: ThemePreset): ListLevelStyleSet {
  const el = theme?.elements;
  const accent = resolveListAccent(theme);
  const bodyColor = (el?.p?.color as string) || '#374151';
  const darkerColor = (el?.strong?.color as string) || '#1f2937';

  return {
    depth1Ol: {
      listStyleType: 'none',
      paddingLeft: '4px',
      margin: '16px 0 20px',
      boxSizing: 'border-box',
      maxWidth: '100%',
    },
    depth1Ul: {
      listStyleType: 'none',
      paddingLeft: '4px',
      margin: '16px 0 20px',
      boxSizing: 'border-box',
      maxWidth: '100%',
    },
    taskListUl: {
      ...(el?.ul || {}),
      listStyleType: 'none',
      paddingLeft: '8px',
      margin: '16px 0',
    },
    depth1Li: {
      marginBottom: '10px',
      fontSize: (el?.p?.fontSize as string) || '15.5px',
      lineHeight: 1.75,
      color: darkerColor,
      fontWeight: 500,
      wordBreak: 'break-word',
      boxSizing: 'border-box',
    },
    badge: {
      // 微信合规：无固定宽高/CSS 大 padding（微信粘贴会剥掉行内 padding 导致瘪条），
      // 宽度由文本中的 &nbsp; 承载（渲染层输出 \u00A0 + 序号 + \u00A0）。
      // 显式 lineHeight:1 + 对称小内边距：胶囊高度固定紧凑、序号在任意主题
      // （含衬线字体与 2.x 大行高主题）下都垂直居中，不再随主题行高膨胀偏移。
      // textIndent:0 必须显式声明——首行缩进主题（如复古报纸 2em）会继承进
      // inline-block，在胶囊内部把序号推到右侧并撑宽徽章
      display: 'inline-block',
      padding: '3px 4px',
      lineHeight: 1,
      textIndent: 0,
      borderRadius: '6px',
      backgroundColor: accent,
      color: '#ffffff',
      fontSize: '12px',
      fontWeight: 700,
      boxSizing: 'border-box',
    },
    dot: {
      // 微信合规：文本圆点（●），非定宽高空心元素
      color: accent,
      fontSize: '12px',
      marginRight: '8px',
    },
    nestedOl: {
      listStyleType: 'decimal',
      paddingLeft: '20px',
      margin: '6px 0 10px',
      boxSizing: 'border-box',
      maxWidth: '100%',
    },
    nestedUl: {
      listStyleType: 'circle',
      paddingLeft: '20px',
      margin: '6px 0 10px',
      boxSizing: 'border-box',
      maxWidth: '100%',
    },
    nestedLi: {
      marginBottom: '6px',
      fontSize: (el?.li?.fontSize as string) || (el?.p?.fontSize as string) || '15px',
      lineHeight: 1.75,
      color: bodyColor,
      fontWeight: 400,
      wordBreak: 'break-word',
      boxSizing: 'border-box',
    },
    nestedStrong: {
      fontWeight: 600,
      color: darkerColor,
      background: 'none',
      padding: 0,
    },
  };
}
