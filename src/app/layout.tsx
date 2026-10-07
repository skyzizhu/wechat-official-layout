import type { Metadata, Viewport } from "next";
import { Noto_Sans_SC, JetBrains_Mono } from "next/font/google";
import { SITE_URL } from "@/lib/site";
import "./globals.css";

// 字体构建期自托管（next/font）：运行时零外部请求——
// Google Fonts 在中国大陆被墙，外链会阻塞渲染并拖慢百度蜘蛛抓取
const notoSansSC = Noto_Sans_SC({
  weight: ["300", "400", "500", "700"],
  subsets: [],
  display: "swap",
  variable: "--font-noto-sans",
});
const jetbrainsMono = JetBrains_Mono({
  weight: ["400", "500"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-jetbrains-mono",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "文排 - 免费微信公众号文章排版工具 | 纯文本智能识别，一键美化复制",
    template: "%s · 文排",
  },
  description:
    "免费在线微信公众号排版工具：粘贴纯文本或 Markdown，智能识别章节标题、数据表格、任务清单与提示卡，16 款精选主题一键美化，高保真内联样式一键复制到公众号后台。全程浏览器本地离线计算，文章隐私零上传。",
  keywords: [
    "公众号排版",
    "微信公众号编辑器",
    "微信排版工具",
    "公众号文章排版",
    "纯文本一键排版",
    "Markdown公众号排版",
    "公众号美化工具",
    "微信表格排版",
    "免费排版工具",
    "135编辑器替代",
    "秀米替代",
    "MdNice替代",
    "自媒体排版工具",
    "一键排版复制",
  ],
  authors: [{ name: "文排团队", url: SITE_URL }],
  creator: "文排",
  publisher: "XTools",
  applicationName: "文排",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "zh_CN",
    url: "/",
    siteName: "文排",
    title: "文排 - 免费微信公众号文章排版工具 | 纯文本智能识别",
    description:
      "粘贴纯文本自动识别多级章节、表格与清单，16 款新媒体主题一键美化，100% 微信合规内联样式复制即发。本地处理零上传。",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "文排 - 微信公众号文章智能排版工具",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "文排 - 免费微信公众号文章排版工具",
    description: "纯文本智能识别，16 款主题一键美化，本地离线处理零上传，格式完美兼容微信公众号后台。",
    images: [{ url: "/og-image.png", alt: "文排 - 微信公众号文章智能排版工具" }],
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  verification: {
    google: "google-site-verification-placeholder",
    other: {
      "baidu-site-verification": "codeva-baidu-verify-placeholder",
      "360-site-verification": "360-site-verify-placeholder",
      "sogou_site_verification": "sogou-site-verify-placeholder",
    },
  },
  other: {
    "applicable-device": "pc,mobile",
    "renderer": "webkit",
    "force-rendering": "webkit",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#4f46e5",
};

// 复合结构化数据：包含 WebApplication、FAQPage（触发富摘要展开框）、HowTo（操作指南）与 BreadcrumbList
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebApplication",
      "@id": `${SITE_URL}/#webapp`,
      name: "文排",
      alternateName: ["文排公众号编辑器", "文排排版工具", "WenPai"],
      url: SITE_URL,
      applicationCategory: "BusinessApplication",
      operatingSystem: "All",
      browserRequirements: "Requires HTML5 and modern JavaScript",
      description:
        "免费在线微信公众号排版工具：粘贴纯文本或 Markdown，智能识别章节标题、数据表格、任务清单与提示卡，16 款精选主题一键美化，复制即可发布到公众号。",
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "CNY",
      },
      featureList: [
        "纯文本自然语言智能识别（支持中文序号一、二、阿拉伯数字1.、表格、清单与导读）",
        "16 款新媒体精选排版主题（公众号风、商务报告、东方雅致、莫兰迪等）",
        "100% 兼容微信公众号后台，严格纯内联 CSS 绝不错乱",
        "图片画廊自动平齐对齐与题注联动",
        "外链自动转文末标准参考脚注",
        "浏览器本地极速运算，文章隐私零上传",
      ],
    },
    {
      "@type": "FAQPage",
      "@id": `${SITE_URL}/#faq`,
      mainEntity: [
        {
          "@type": "Question",
          "name": "文排与 135编辑器、秀米、MdNice 有什么区别和优势？",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "传统富文本编辑器（如 135编辑器、秀米）需要反复挑选样式手动拼贴，操作繁琐且移动端容易错位；而 Markdown 工具（如 MdNice）则要求作者熟记标记语法。文排专为普通作者设计：用户直接粘贴普通纯文本，系统即可智能提取章节、多形态表格、清单与提示卡，一键套用 16 套主题，全程浏览器本地运行，文章隐私零上传且完全免费。",
          },
        },
        {
          "@type": "Question",
          "name": "复制到微信公众号后台会发生排版错乱、叠字或样式丢失吗？",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "绝对不会。文排严格遵循微信公众平台富文本内核规范，所有标题勋章、表格斑马纹、清单复选框均经过专用序列化器编译为微信最兼容的纯内联 CSS（Inline Styles），完全杜绝非法类名与嵌套告警，一键粘贴即可发布。",
          },
        },
        {
          "@type": "Question",
          "name": "不会使用 Markdown 标记语言可以使用文排吗？",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "完全可以。文排搭载了 Omni 纯文本语义解析引擎，用户输入'一、'、'一，'、'1、'、'1.'、制表符表格或'导读：'等自然语言，系统均可毫秒级智能识别并自动排版，无需输入任何 # 或 - 等标记符号。",
          },
        },
        {
          "@type": "Question",
          "name": "使用文排需要付费或者注册账号登录吗？",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "不需要。文排所有功能全部免费开放，免注册、免登录、免广告，打开浏览器即可即开即用。",
          },
        },
        {
          "@type": "Question",
          "name": "我编辑的文章内容会被上传到服务器吗？",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "不会。文排采用纯前端客户端架构，文字解析、主题美化与富文本复制全部在您的本地浏览器内存中完成，数据零上传，充分保障商业文案与个人隐私安全。",
          },
        },
      ],
    },
    {
      "@type": "HowTo",
      "@id": `${SITE_URL}/#howto`,
      name: "如何使用文排进行微信公众号文章一键排版与发布？",
      description: "只需 3 步即可完成专业级微信公众号排版并复制到后台发布。",
      step: [
        {
          "@type": "HowToStep",
          name: "粘贴文章内容",
          text: "在左侧编辑画布中直接粘贴 Word、备忘录、微信或 ChatGPT 的纯文本，亦支持 Markdown 源码或直接拖拽插入配图。",
          position: 1,
        },
        {
          "@type": "HowToStep",
          name: "挑选排版风格",
          text: "在顶部工具栏中选择 16 款精选排版主题之一（如公众号风、商务报告、东方雅致），并可微调字号或品牌主色。",
          position: 2,
        },
        {
          "@type": "HowToStep",
          name: "一键复制发布",
          text: "点击右上角「一键复制」按钮，直接前往微信公众平台文章编辑后台按 Ctrl+V / Cmd+V 粘贴即可直接发布。",
          position: 3,
        },
      ],
    },
    {
      "@type": "BreadcrumbList",
      "@id": `${SITE_URL}/#breadcrumb`,
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "首页",
          item: SITE_URL,
        },
      ],
    },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="zh-CN" className={`h-full antialiased ${notoSansSC.variable} ${jetbrainsMono.variable}`} suppressHydrationWarning>
      <head>
        <meta name="referrer" content="no-referrer" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className={`min-h-full flex flex-col ${notoSansSC.className}`} suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
