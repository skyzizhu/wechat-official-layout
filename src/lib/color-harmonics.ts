/**
 * 智能色彩搭配与调和算法引擎 (Color Harmonics Engine)
 * 用户只需选定一个核心主色，算法根据色彩学原理（HSL/明度感知）
 * 自动计算出一整套和谐搭配的色彩梯次（包含主色、深浅标题、引用浅底色、分割边框、高亮马克笔、正文温和墨色等）。
 */

export interface ColorPalette {
  primary: string;         // 核心主色（H1/H2、重要边框、徽章）
  primaryDark: string;     // 加深色（深色文本、强强调）
  primaryLight: string;    // 极浅底色（引用块背景、表格斑马纹、标签底色）
  primaryBorder: string;   // 浅边框色（引用框边、卡片边、分割线）
  primaryBadgeText: string;// 徽章文字色（白或深色）
  highlightBg: string;     // 荧光笔涂抹标记底色
  neutralText: string;     // 调和后的正文文字色
  subtleText: string;      // 调和后的辅助小字色
}

/**
 * 将 Hex 转换为 RGB [r, g, b]
 */
export function hexToRgb(hex: string): [number, number, number] {
  let clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    clean = clean.split('').map((c) => c + c).join('');
  }
  const num = parseInt(clean, 16);
  if (isNaN(num)) return [37, 99, 235]; // 默认安全蓝
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

/**
 * 将 RGB 转换为 Hex
 */
export function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (val: number) => Math.max(0, Math.min(255, Math.round(val)));
  const toHex = (c: number) => clamp(c).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * RGB 转换为 HSL [h(0-360), s(0-100), l(0-100)]
 */
export function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }

  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

/**
 * HSL 转换为 RGB
 */
export function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  h /= 360;
  s /= 100;
  l /= 100;
  let r: number, g: number, b: number;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

/**
 * 计算颜色亮度 (0-1) 用于对比度判断
 */
export function getLuminance(r: number, g: number, b: number): number {
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

/**
 * 根据用户输入的单一颜色，全自动生成整套和谐排版配色方案
 */
export function generateHarmonicPalette(baseHex: string): ColorPalette {
  const [r, g, b] = hexToRgb(baseHex);
  const [h, s, l] = rgbToHsl(r, g, b);
  const lum = getLuminance(r, g, b);

  // 1. 深色强调（用于副标题、加深描边）
  const darkL = Math.max(15, l - 22);
  const [dr, dg, db] = hslToRgb(h, Math.min(100, s + 10), darkL);
  const primaryDark = rgbToHex(dr, dg, db);

  // 2. 极浅底色（用于引用框淡底、表格表头、卡片底）
  const lightL = 96;
  const lightS = Math.min(50, Math.max(15, Math.round(s * 0.4)));
  const [lr, lg, lb] = hslToRgb(h, lightS, lightL);
  const primaryLight = rgbToHex(lr, lg, lb);

  // 3. 浅边框色（用于细分界线、引用块内线）
  const borderL = 88;
  const [br, bg, bb] = hslToRgb(h, Math.min(45, Math.round(s * 0.5)), borderL);
  const primaryBorder = rgbToHex(br, bg, bb);

  // 4. 徽章反白字检测：主色亮度若小于 0.65，用白字，否则用深黑字
  const primaryBadgeText = lum < 0.65 ? '#ffffff' : '#0f172a';

  // 5. 荧光笔高亮背景色（带透明度）
  const highlightBg = `rgba(${r}, ${g}, ${b}, 0.22)`;

  // 6. 正文调和墨色：根据主色冷暖注入微量色调，避免死黑
  let neutralText = '#27272a';
  if (h >= 20 && h <= 55) {
    // 暖黄/橙色系 -> 暖棕墨黑
    neutralText = '#372a22';
  } else if (h >= 180 && h <= 250) {
    // 蓝/青系 -> 极客冷灰墨色
    neutralText = '#1e293b';
  } else if (h >= 90 && h <= 170) {
    // 绿色系 -> 幽微墨绿
    neutralText = '#243329';
  }

  const subtleText = '#71717a';

  return {
    primary: baseHex,
    primaryDark,
    primaryLight,
    primaryBorder,
    primaryBadgeText,
    highlightBg,
    neutralText,
    subtleText,
  };
}

/**
 * 经典推荐主色预设库（供用户快速点选）
 */
export const PRESET_THEME_COLORS = [
  { name: '默认原色', hex: '' },
  { name: '经典曜黑', hex: '#18181b' },
  { name: '克莱因蓝', hex: '#2563eb' },
  { name: '故宫朱红', hex: '#be123c' },
  { name: '翡翠林绿', hex: '#059669' },
  { name: '落日金橙', hex: '#ea580c' },
  { name: '深海湛蓝', hex: '#0f2b5c' },
  { name: '优雅紫罗兰', hex: '#7c3aed' },
  { name: '莫兰迪豆沙', hex: '#9d727b' },
  { name: '秋日拿铁棕', hex: '#854d0e' },
  { name: '青瓷古韵', hex: '#0d9488' },
];
