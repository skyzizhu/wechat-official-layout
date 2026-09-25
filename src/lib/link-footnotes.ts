/**
 * 微信公众号外链转文末脚注引擎 (WeChat External Links to Footnotes Engine)
 * 微信公众号文章内直接点击外部 http/https 链接会被微信拦截阻断。
 * 业界通用标准做法：
 * 1. 在正文中将外部链接标记为：[链接文本](url)<sup>[1]</sup>；
 * 2. 统计所有非微信原生/非锚点的外部链接；
 * 3. 在文章末尾自动聚合生成标准排版的【参考链接】清单。
 */

export interface FootnoteLink {
  index: number;
  text: string;
  url: string;
}

export function convertLinksToFootnotes(
  markdown: string,
  enabled: boolean = true
): { content: string; footnotes: FootnoteLink[] } {
  if (!enabled || !markdown) {
    return { content: markdown, footnotes: [] };
  }

  const footnotes: FootnoteLink[] = [];
  const urlMap = new Map<string, number>();

  // 匹配 Markdown 链接 [text](url)，但排除图片 ![alt](url)
  // 使用 (?<!\!) 负向回顾确保不是图片
  const linkRegex = /(?<!\!)\[([^\]]+)\]\((https?:\/\/[^\s\)\"\']+)(?:\s+["'][^"']*["'])?\)/g;

  const transformedContent = markdown.replace(linkRegex, (match, text, url) => {
    // 微信公众号原生文章链接 (mp.weixin.qq.com) 可以在公众号内直接跳转，无需作为脚注
    if (url.startsWith('https://mp.weixin.qq.com') || url.startsWith('http://mp.weixin.qq.com')) {
      return match;
    }

    let index = urlMap.get(url);
    if (!index) {
      index = footnotes.length + 1;
      urlMap.set(url, index);
      footnotes.push({ index, text, url });
    }

    // 保留链接本身（在浏览器端仍可点击查看），并附带微信角标 <sup>[1]</sup>
    return `[${text}](${url})<sup>[${index}]</sup>`;
  });

  if (footnotes.length === 0) {
    return { content: markdown, footnotes: [] };
  }

  // 在文末自动追加格式优美的参考资料清单
  const footnoteItems = footnotes
    .map(
      (fn) =>
        `* [${fn.index}] **${fn.text}**：*${fn.url}*`
    )
    .join('\n');

  const finalMarkdown = `${transformedContent}\n\n---\n\n### 🔗 参考链接\n\n${footnoteItems}\n`;

  return { content: finalMarkdown, footnotes };
}
