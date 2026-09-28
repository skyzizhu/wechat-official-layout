import type { Metadata } from "next";
import { SITE_URL } from "@/lib/site";
import "./globals.css";

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
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
  },
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
    <html lang="zh-CN" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <meta name="referrer" content="no-referrer" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@300;400;500;700&family=Noto+Serif+SC:wght@400;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
          crossOrigin="anonymous"
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
