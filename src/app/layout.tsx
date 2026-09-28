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
    default: "文排 — 微信公众号文章排版工具 | 纯文本智能识别，一键美化",
    template: "%s · 文排",
  },
  description:
    "免费在线微信公众号排版工具：粘贴纯文本或 Markdown，AI 智能识别标题、列表、表格、代码块与图片画廊，16 款精选主题一键美化，复制即可发布到公众号。全程浏览器本地处理，内容零上传。",
  keywords: [
    "公众号排版",
    "微信公众号编辑器",
    "微信排版工具",
    "Markdown 排版",
    "文章排版",
    "公众号美化",
    "在线排版工具",
    "免费排版",
  ],
  authors: [{ name: "文排" }],
  creator: "文排",
  applicationName: "文排",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "zh_CN",
    url: "/",
    siteName: "文排",
    title: "文排 — 微信公众号文章排版工具",
    description:
      "粘贴纯文本自动识别结构，16 款主题一键美化，复制即可发布到公众号。本地处理零上传。",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "文排 · 微信公众号文章排版工具" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "文排 — 微信公众号文章排版工具",
    description: "纯文本智能识别，16 款主题一键美化，本地处理零上传。",
    images: [{ url: "/og-image.png", alt: "文排 · 微信公众号文章排版工具" }],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
  },
  // 无障碍与 X/Twitter 分享的图片替代文本（og:image:alt / twitter:image:alt）
  other: {
    "applicable-device": "pc,mobile",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#4f46e5",
};

// 结构化数据：帮助 Google 理解这是一个 WebApplication，可触发富结果展示
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "文排",
  alternateName: "文排 · 公众号排版工具",
  url: SITE_URL,
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description:
    "微信公众号文章排版工具：粘贴纯文本或 Markdown，智能识别结构并一键美化，复制即可发布。",
  offers: { "@type": "Offer", price: "0", priceCurrency: "CNY" },
  featureList: [
    "纯文本智能结构识别",
    "16 款排版主题",
    "一键复制微信合规富文本",
    "图片画廊与代码高亮",
    "外链自动转文末脚注",
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="zh-CN" className={`h-full antialiased ${notoSansSC.variable} ${jetbrainsMono.variable}`} suppressHydrationWarning>
      <head>
        <meta name="referrer" content="no-referrer" />
        <meta name="baidu-site-verification" content="TODO-上线后在百度搜索资源平台获取并替换" />
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
