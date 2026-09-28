import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';

export const dynamic = 'force-static';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: '*', allow: '/' },
      // 显式欢迎国内外主流蜘蛛（Google/Bing/百度/搜狗/360/神马）
      { userAgent: ['Googlebot', 'bingbot', 'Baiduspider', 'Sogou web spider', '360Spider', 'YisouSpider'], allow: '/' },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
