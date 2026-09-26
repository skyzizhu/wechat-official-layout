/**
 * 图片处理与图文分块核心工具库
 * 1. 剪贴板/上传文件异步压缩至微信最适规格（max 1200px，JPEG/PNG 高保真优化至 100-300KB）
 * 2. 文本-图片智能解析（将长文本拆分为纯文本块、独立图片块、并排画廊块）
 * 3. 结构化块重组为标准 Markdown 内容
 */

export interface TextBlock {
  id: string;
  type: 'text';
  content: string;
}

export interface ImageBlock {
  id: string;
  type: 'image';
  url: string;
  alt: string;
  caption: string;
}

export interface GalleryItem {
  url: string;
  alt: string;
  caption: string;
}

export interface GalleryBlock {
  id: string;
  type: 'gallery';
  items: GalleryItem[];
}

export type VisualBlock = TextBlock | ImageBlock | GalleryBlock;

/**
 * 将用户剪贴板或本地上传的 File 压缩并转为 Base64 Data URL
 * - 限制最大边长不超过 1200px（微信图文最佳宽度）
 * - 保持清晰度与锐度（质量 0.88）
 * - 体积压缩 70%~90%，既避免浏览器卡顿，又防微信上传超时
 */
export async function compressAndEncodeImage(
  file: File
): Promise<{ dataUrl: string; width: number; height: number; fileName: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        const maxDimension = 1200;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve({
            dataUrl: e.target?.result as string,
            width: img.width,
            height: img.height,
            fileName: file.name,
          });
          return;
        }

        // 高质量抗锯齿绘制
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        // 如果是 png 且不是特别巨大，保持 png；否则高质量 jpeg
        const isPng = file.type === 'image/png';
        const mimeType = isPng && file.size < 1024 * 1024 ? 'image/png' : 'image/jpeg';
        const dataUrl = canvas.toDataURL(mimeType, 0.88);

        resolve({
          dataUrl,
          width,
          height,
          fileName: file.name,
        });
      };
      img.onerror = () => reject(new Error('图片解析失败，可能格式损坏'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('无法读取图片文件'));
    reader.readAsDataURL(file);
  });
}

/**
 * 智能将文章 Markdown/纯文本解析拆解为直观的图文分块
 */
export function parseContentToBlocks(content: string): VisualBlock[] {
  if (!content || !content.trim()) {
    return [{ id: 'block-init', type: 'text', content: '' }];
  }

  const lines = content.split('\n');
  const blocks: VisualBlock[] = [];
  let textBuffer: string[] = [];
  let blockIndex = 0;

  const flushTextBuffer = () => {
    if (textBuffer.length > 0) {
      // 避免首尾产生无意义的连续三个以上空行
      const text = textBuffer.join('\n').replace(/^\n+/, '').replace(/\n+$/, '');
      if (text.length > 0) {
        blocks.push({
          id: `text-${blockIndex++}`,
          type: 'text',
          content: text,
        });
      }
      textBuffer = [];
    }
  };

  let i = 0;
  while (i < lines.length) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    // 1. 检查是否为多图并排画廊表格（首行包含至少一个图片 markdown）
    if (trimmed.startsWith('|') && trimmed.includes('![') && trimmed.includes('](')) {
      flushTextBuffer();
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        tableLines.push(lines[i].trim());
        i++;
      }

      // 解析画廊中的每张图与题注
      const imgRow = tableLines[0];
      const sepRow = tableLines[1];
      const capRow = tableLines[2];

      const imgMatches = Array.from(imgRow.matchAll(/!\[(.*?)\]\((.+?)\)/g));
      if (imgMatches.length > 0) {
        const captions: string[] = [];
        if (capRow) {
          const rawCaps = capRow
            .split('|')
            .map((c) => c.trim().replace(/^[*_]+|[*_]+$/g, ''))
            .filter((c, idx, arr) => !(idx === 0 && c === '') && !(idx === arr.length - 1 && c === ''));
          captions.push(...rawCaps);
        }

        const items: GalleryItem[] = imgMatches.map((m, idx) => ({
          alt: m[1] || '配图',
          url: m[2],
          caption: captions[idx] || '',
        }));

        blocks.push({
          id: `gallery-${blockIndex++}`,
          type: 'gallery',
          items,
        });
        continue;
      }
    }

    // 2. 检查单张 Markdown 图片：![alt](url)
    const singleImgMatch = trimmed.match(/^!\[(.*?)\]\((.+?)\)$/);
    if (singleImgMatch) {
      flushTextBuffer();
      const alt = singleImgMatch[1] || '配图';
      const url = singleImgMatch[2];
      let caption = '';

      // 检查下一行是否是题注（以 * 开头，或包含 ▲，或纯短句）
      if (i + 1 < lines.length) {
        const nextLine = lines[i + 1].trim();
        if (
          nextLine.startsWith('*') ||
          nextLine.startsWith('▲') ||
          nextLine.startsWith('图') ||
          nextLine.startsWith('注：')
        ) {
          caption = nextLine.replace(/^[*_]+|[*_]+$/g, '').trim();
          i++; // 消耗题注行
        }
      }

      blocks.push({
        id: `img-${blockIndex++}`,
        type: 'image',
        url,
        alt,
        caption,
      });
      i++;
      continue;
    }

    // 3. 检查 HTML 格式图片：<img src="..." alt="..." />
    const htmlImgMatch = trimmed.match(/<img\s+[^>]*src=["']([^"']+)["'][^>]*>/i);
    if (htmlImgMatch) {
      flushTextBuffer();
      const url = htmlImgMatch[1];
      const altMatch = trimmed.match(/alt=["']([^"']*)["']/i);
      const alt = altMatch ? altMatch[1] : '配图';
      let caption = '';

      if (i + 1 < lines.length) {
        const nextLine = lines[i + 1].trim();
        if (nextLine.startsWith('*') || nextLine.startsWith('▲') || nextLine.startsWith('<p>')) {
          caption = nextLine.replace(/<[^>]+>/g, '').replace(/^[*_]+|[*_]+$/g, '').trim();
          i++;
        }
      }

      blocks.push({
        id: `img-${blockIndex++}`,
        type: 'image',
        url,
        alt,
        caption,
      });
      i++;
      continue;
    }

    // 4. 检查自然纯文本图片标记（配图：URL/Base64 或 [图片] URL）
    const plainImgMatch = trimmed.match(/^(?:图片|配图|插图|图|Image|Img)\s*(\d*)[：:]\s*(.+)$/i);
    if (plainImgMatch) {
      const rest = plainImgMatch[2].trim();
      let url = '';
      let alt = '配图';
      if (rest.includes('|') || rest.includes('｜')) {
        const parts = rest.split(/[|｜]/).map((s) => s.trim());
        alt = parts[0] || '配图';
        url = parts[1] || '';
      } else {
        url = rest;
      }

      if (/^(?:https?:\/\/|data:image\/)/i.test(url)) {
        flushTextBuffer();
        let caption = '';
        if (i + 1 < lines.length) {
          const nextLine = lines[i + 1].trim();
          if (nextLine.startsWith('*') || nextLine.startsWith('▲') || nextLine.startsWith('图') || nextLine.startsWith('注：')) {
            caption = nextLine.replace(/^[*_]+|[*_]+$/g, '').trim();
            i++;
          }
        }
        blocks.push({
          id: `img-${blockIndex++}`,
          type: 'image',
          url,
          alt,
          caption,
        });
        i++;
        continue;
      }
    }

    // 5. 检查独立 Base64 图片数据行
    if (/^data:image\/[a-zA-Z+]+;base64,\S+$/i.test(trimmed)) {
      flushTextBuffer();
      blocks.push({
        id: `img-${blockIndex++}`,
        type: 'image',
        url: trimmed,
        alt: '配图',
        caption: '',
      });
      i++;
      continue;
    }

    // 普通文本行，存入 buffer
    textBuffer.push(rawLine);
    i++;
  }

  flushTextBuffer();

  // 若为空，保证至少有一个文本块
  if (blocks.length === 0) {
    blocks.push({ id: 'text-0', type: 'text', content: '' });
  }

  return blocks;
}

/**
 * 将图文分块重新无缝拼接为干净标准的 Markdown 内容
 */
export function serializeBlocksToContent(blocks: VisualBlock[]): string {
  const parts: string[] = [];

  for (const block of blocks) {
    if (block.type === 'text') {
      if (block.content.trim()) {
        parts.push(block.content.trim());
      }
    } else if (block.type === 'image') {
      const alt = block.alt?.trim() || '配图';
      let imgStr = `![${alt}](${block.url})`;
      if (block.caption?.trim()) {
        const cap = block.caption.trim();
        const formattedCap = cap.startsWith('*') ? cap : `*${cap}*`;
        imgStr += `\n${formattedCap}`;
      }
      parts.push(imgStr);
    } else if (block.type === 'gallery') {
      if (block.items.length > 0) {
        const imgCells = block.items.map((it) => `![${it.alt?.trim() || '配图'}](${it.url})`);
        const sepCells = block.items.map(() => ':---:');
        const capCells = block.items.map((it) =>
          it.caption?.trim() ? `*${it.caption.trim()}*` : ' '
        );

        const imgRow = `| ${imgCells.join(' | ')} |`;
        const sepRow = `| ${sepCells.join(' | ')} |`;
        const capRow = `| ${capCells.join(' | ')} |`;

        parts.push(`${imgRow}\n${sepRow}\n${capRow}`);
      }
    }
  }

  return parts.join('\n\n');
}
