import { CSSProperties } from "react";

/**
 * 微信公众号官方推荐标准字体族规范 (Spec 3.x)
 * 来源：https://developers.weixin.qq.com/doc/service/guide/product/plugin_spec.html#_3、字体使用规范
 */
export const WECHAT_OFFICIAL_FONT_FAMILY =
  "'mp-quote', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei UI', 'Microsoft YaHei', Arial, sans-serif";

export const WECHAT_MONOSPACE_FONT_FAMILY =
  'Consolas, Monaco, Menlo, monospace';

/**
 * 顶部装饰栏类型
 */
export type BannerType =
  | "none"
  | "terminal"          // macOS 终端三色圆点 + 控制台栏
  | "newspaper"         // 传统报纸通栏大报头
  | "journal-tape"      // 手帐和纸胶带与贴纸
  | "report-bar"        // 商务麦肯锡报告企业级页眉
  | "tech-status"       // 未来科技 HUD 状态抬头
  | "magazine-issue"    // 时尚杂志专栏期号
  | "academic-meta"     // 学术期刊卷号与双线
  | "wechat-tag"        // 微信公众号精选标识
  | "swiss-minimal"     // 瑞士国际主义极简几何条
  | "neo-chinese-seal"  // 东方印章款识与回纹
  | "morandi-bar"       // 莫兰迪雅致温和细栏
  | "pop-badge"         // 新野兽派潮流波普撞色
  | "latte-warm"        // 暖阳拿铁咖啡手作
  | "gallery-frame"     // 艺术画廊策展导览
  | "fresh-lemon";      // 薄荷柠檬元气清新

/**
 * 二级标题装饰风格
 */
export type H2DecorationType =
  | "default"
  | "wechat-badge"       // 微信胶囊徽章与绿意装饰
  | "newspaper-banner"   // 报纸粗黑横幅与老排字框
  | "journal-sticker"    // 手帐暖彩圆角贴纸
  | "report-pill"        // 商务章节编号卡片
  | "cyber-glow"         // 未来科技发光边框
  | "terminal-prompt"    // 终端命令提示符 >_
  | "magazine-centered"  // 杂志双线优雅居中
  | "academic-bracket"   // 学术章节点缀
  | "literary-dash"      // 文艺两端破折号
  | "swiss-block"        // 纯黑实色反白几何色块
  | "seal-tag"           // 中式朱砂印章题签
  | "morandi-soft"       // 莫兰迪低饱和柔和椭圆
  | "pop-box"            // 波普硬黑轮廓撞色标签
  | "latte-badge"        // 暖阳燕麦柔和圆角条
  | "gallery-line"       // 艺术画廊极细双黑线
  | "mint-capsule";      // 薄荷马卡龙清甜胶囊

/**
 * 引用块装饰风格
 */
export type QuoteStyleType =
  | "default"
  | "wechat-bubble"      // 微信对话气泡框
  | "post-it"            // 手帐黄色便签纸（带虚线与微投影）
  | "pull-quote"         // 杂志大号居中金句（双大引号）
  | "cyber-card"         // 科技毛玻璃半透明发光卡片
  | "terminal-box"       // 极客命令行日志输出框
  | "newspaper-clip"     // 报纸社论剪报双线框
  | "report-takeaway"    // 商务“核心洞察 KEY TAKEAWAY”高亮卡
  | "academic-abstract"  // 学术摘要边框
  | "literary-minimal"   // 文艺轻盈无底色诗意段落
  | "chinese-scroll"     // 中式典雅卷轴引用
  | "morandi-card"       // 莫兰迪低饱和柔和卡片
  | "pop-shadow"         // 新野兽派硬阴影立体框
  | "latte-card"         // 拿铁咖啡馆慢读卡片
  | "gallery-clean"      // 艺术画廊纯净微边框
  | "mint-bubble";       // 薄荷清爽微甜气泡卡片

/**
 * 容器额外外观与阴影风格
 */
export type ContainerVariant =
  | "default"
  | "newspaper-frame"   // 报纸双实线复古外框
  | "terminal-window"   // 极客终端窗口外框
  | "journal-notebook"  // 手帐本活页质感
  | "tech-cyber-glow"   // 科技边缘微发光
  | "academic-paper"    // 学术严谨纸张感
  | "magazine-spread"   // 时尚杂志跨页留白
  | "minimal-flat"      // 纯平现代
  | "neo-chinese"       // 新中式宣纸墨香
  | "pop-brutalism"     // 新野兽派硬朗黑色描边
  | "latte-soft";       // 暖拿铁柔光

/**
 * 排版预设的完整类型定义
 */
export interface ThemePreset {
  /** 唯一标识符，使用 kebab-case */
  id: string;

  /** 显示名称（中文） */
  name: string;

  /** 一句话特色描述 */
  description: string;

  /** 预览时使用的标签 */
  tags: string[];

  /** 预览卡片的渐变背景色 [fromColor, toColor] */
  cardGradient: [string, string];

  /** 容器外观变体 */
  containerVariant?: ContainerVariant;

  /** 顶部装饰栏配置 */
  banner?: {
    type: BannerType;
    title?: string;
    subtitle?: string;
    meta?: string;
  };

  /** 二级标题装饰类型 */
  h2Decoration?: H2DecorationType;

  /** 引用块装饰类型 */
  quoteStyle?: QuoteStyleType;

  /** 分割线文本或字符 */
  dividerText?: string;

  /** 强调文字（strong）的特殊样式 */
  markHighlight?: CSSProperties;

  /** 文章容器的全局样式 */
  container: CSSProperties;

  /** 各 HTML 元素的样式映射 */
  elements: {
    h1: CSSProperties;
    h2: CSSProperties;
    h3: CSSProperties;
    h4: CSSProperties;
    h5: CSSProperties;
    h6: CSSProperties;
    p: CSSProperties;
    blockquote: CSSProperties;
    ul: CSSProperties;
    ol: CSSProperties;
    li: CSSProperties;
    a: CSSProperties;
    strong: CSSProperties;
    em: CSSProperties;
    code: CSSProperties;
    pre: CSSProperties;
    img: CSSProperties;
    hr: CSSProperties;
    table: CSSProperties;
    th: CSSProperties;
    td: CSSProperties;
  };

  /** 可选：首字下沉样式 */
  dropcap?: CSSProperties;
}

export type ElementKey = keyof ThemePreset["elements"];
