import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';

export const dynamic = 'force-static';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // 统计后端与后台入口禁止爬取（后台目录若改名，需同步加一条 Disallow）
        disallow: ['/analytics/', '/admin/'],
      },
      // 显式欢迎国内外主流蜘蛛（Google/Bing/百度/搜狗/360/神马）
      {
        userAgent: ['Googlebot', 'bingbot', 'Baiduspider', 'Sogou web spider', '360Spider', 'YisouSpider'],
        allow: '/',
        disallow: ['/analytics/', '/admin/'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
