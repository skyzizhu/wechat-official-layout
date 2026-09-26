/**
 * 统一单体图文编辑器（Unified Rich Visual Editor）核心工具库
 * 1. Markdown 转换为单体富文本 HTML (包含内联可交互的图片卡片与画廊)
 * 2. 单体富文本 HTML 高保真反向还原为标准 Markdown
 * 3. 剪贴板全量图文内容清洗与安全注入
 */

/**
 * 将 Markdown 源码渲染为单体编辑画布所需的 HTML 结构
 */
export function markdownToUnifiedHtml(markdown: string): string {
  if (!markdown || !markdown.trim()) {
    return '<p><br></p>';
  }

  const lines = markdown.split('\n');
  const htmlParts: string[] = [];
  let i = 0;

  // 为每个生成的块元素注入源码行号标记（data-ml-s / data-ml-e），
  // 供意图工具栏在「编辑器选区 ↔ Markdown 行」之间精确映射
  const withLineMark = (html: string, s: number, e: number) => {
    // 已含行号标记（如引用卡片模板自带）则不重复注入，避免属性被挤成文本
    if (/data-ml-s=/.test(html)) return html;
    return html.replace(/^<([a-zA-Z]+)/, `<$1 data-ml-s="${s}" data-ml-e="${e}"`);
  };

  while (i < lines.length) {
    const blockStart = i;
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    // 1. 空行
    if (!trimmed) {
      // 避免连续多个空行导致无限 br
      if (htmlParts[htmlParts.length - 1] !== '<p><br></p>') {
        htmlParts.push('<p><br></p>');
      }
      i++;
      continue;
    }

    // 2. 多图并排画廊表格识别 (| ![img1](...) | ![img2](...) |)
    if (trimmed.startsWith('|') && trimmed.includes('![') && trimmed.includes('](')) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        tableLines.push(lines[i].trim());
        i++;
      }

      const imgRow = tableLines[0] || '';
      const capRow = tableLines[2] || '';
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

        const cols = imgMatches.length;
        const colClass = cols === 2 ? 'grid-cols-2' : 'grid-cols-3';

        const galleryHtml = `
          <div class="unified-gallery my-4 p-3 bg-purple-50/50 border border-purple-200 rounded-xl select-none" contenteditable="false" data-type="gallery">
            <div class="flex items-center justify-between text-xs text-purple-800 font-medium mb-2.5 pb-1.5 border-b border-purple-100">
              <span class="flex items-center gap-1.5">🖼️ 并排画廊 (${cols} 张图片)</span>
              <button type="button" class="del-gallery-btn px-1.5 py-0.5 text-gray-400 hover:text-red-500 rounded text-xs cursor-pointer" title="删除整个画廊">删除画廊 ×</button>
            </div>
            <div class="grid gap-3 ${colClass}">
              ${imgMatches
                .map((m, idx) => {
                  const alt = m[1] || '配图';
                  const url = m[2];
                  const cap = captions[idx] || '';
                  return `
                    <div class="unified-gallery-item flex flex-col items-center" data-url="${url}" data-alt="${alt}">
                      <img src="${url}" alt="${alt}" referrerpolicy="no-referrer" class="w-full max-h-36 object-cover rounded-lg border border-purple-100 shadow-2xs cursor-zoom-in" />
                      <div class="unified-gallery-cap mt-1.5 w-full text-xs text-center text-gray-600 bg-white border border-gray-200 rounded px-2 py-0.5 outline-none focus:border-purple-400 select-text" contenteditable="true" data-placeholder="▲ 输入题注...">${cap}</div>
                    </div>
                  `;
                })
                .join('')}
            </div>
          </div>
          <p><br></p>
        `;
        htmlParts.push(withLineMark(galleryHtml.trim(), blockStart, i - 1));
        continue;
      }
    }

    // 3. 单张 Markdown 图片识别 (![alt](url))
    const singleImgMatch = trimmed.match(/^!\[(.*?)\]\((.+?)\)$/);
    if (singleImgMatch) {
      const alt = singleImgMatch[1] || '配图';
      const url = singleImgMatch[2];
      let caption = '';
      let hasCaption = false;

      // 检查接下来的行（允许跳过空行）是否是题注
      let nextIdx = i + 1;
      while (nextIdx < lines.length && !lines[nextIdx].trim()) {
        nextIdx++;
      }

      if (nextIdx < lines.length) {
        const nextLine = lines[nextIdx].trim();
        const isCaption =
          nextLine.length > 0 &&
          nextLine.length <= 120 &&
          (nextLine.startsWith('▲') ||
            nextLine.startsWith('*▲') ||
            /^\*?(?:图|表|Figure|阶段)\s*[\dA-Za-z\-]+/i.test(nextLine) ||
            /^\*?注[：:]/.test(nextLine) ||
            (nextLine.startsWith('*') && nextLine.endsWith('*') && !nextLine.startsWith('**')));
        if (isCaption) {
          caption = nextLine.replace(/^[*_]+|[*_]+$/g, '').trim();
          hasCaption = true;
        }
      }

      const isBase64 = url.startsWith('data:image/');
      const figureHtml = `
        <figure class="unified-figure my-3 border border-gray-200 hover:border-blue-400 rounded-xl overflow-hidden bg-white shadow-xs transition-all select-none" contenteditable="false" data-type="single-image" data-url="${url}" data-alt="${alt}">
          <div class="flex items-center justify-between px-3 py-1.5 bg-gray-50 border-b border-gray-200 text-xs text-gray-500">
            <span class="flex items-center gap-1 font-medium text-gray-700">
              🖼️ ${isBase64 ? '剪贴板/本地图片' : '配图'}
              <span class="text-gray-400 text-[11px] truncate max-w-[150px] sm:max-w-xs ml-1">(${alt})</span>
            </span>
            <div class="flex items-center gap-1">
              <button type="button" class="view-img-btn p-1 hover:bg-gray-200 text-gray-500 rounded cursor-pointer" title="点击放大预览">🔍 放大</button>
              <button type="button" class="del-img-btn p-1 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded cursor-pointer" title="删除图片">🗑️ 删除</button>
            </div>
          </div>
          <div class="p-3 bg-gray-50/30 flex justify-center cursor-zoom-in view-img-trigger">
            <img src="${url}" alt="${alt}" referrerpolicy="no-referrer" class="max-h-64 sm:max-h-80 w-auto max-w-full rounded-lg object-contain shadow-2xs border border-gray-100" />
          </div>
          <div class="px-3 py-1.5 bg-white border-t border-gray-100 flex items-center gap-2">
            <span class="text-[11px] text-gray-400 shrink-0">题注:</span>
            <figcaption class="unified-caption flex-1 text-xs text-center text-gray-700 bg-gray-50 hover:bg-white focus:bg-white border border-gray-200 rounded px-2.5 py-1 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition-all select-text" contenteditable="true" data-placeholder="▲ 输入图片说明（如：图1：系统架构图）">${caption}</figcaption>
          </div>
        </figure>
        <p><br></p>
      `;
      htmlParts.push(withLineMark(figureHtml.trim(), blockStart, i));
      i = hasCaption ? nextIdx + 1 : i + 1;
      continue;
    }

    // 4. HTML 格式图片识别 (<img src="..." />)
    const htmlImgMatch = trimmed.match(/<img\s+[^>]*src=["']([^"']+)["'][^>]*>/i);
    if (htmlImgMatch) {
      const url = htmlImgMatch[1];
      const altMatch = trimmed.match(/alt=["']([^"']*)["']/i);
      const alt = altMatch ? altMatch[1] : '配图';
      let caption = '';
      let hasCaption = false;

      let nextIdx = i + 1;
      while (nextIdx < lines.length && !lines[nextIdx].trim()) {
        nextIdx++;
      }

      if (nextIdx < lines.length) {
        const nextLine = lines[nextIdx].trim();
        if (nextLine.startsWith('*') || nextLine.startsWith('▲') || nextLine.startsWith('<p>')) {
          caption = nextLine.replace(/<[^>]+>/g, '').replace(/^[*_]+|[*_]+$/g, '').trim();
          hasCaption = true;
        }
      }

      const figureHtml = `
        <figure class="unified-figure my-3 border border-gray-200 hover:border-blue-400 rounded-xl overflow-hidden bg-white shadow-xs transition-all select-none" contenteditable="false" data-type="single-image" data-url="${url}" data-alt="${alt}">
          <div class="flex items-center justify-between px-3 py-1.5 bg-gray-50 border-b border-gray-200 text-xs text-gray-500">
            <span class="font-medium text-gray-700">🖼️ 配图 (${alt})</span>
            <button type="button" class="del-img-btn p-1 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded cursor-pointer" title="删除图片">🗑️ 删除</button>
          </div>
          <div class="p-3 bg-gray-50/30 flex justify-center cursor-zoom-in view-img-trigger">
            <img src="${url}" alt="${alt}" referrerpolicy="no-referrer" class="max-h-64 sm:max-h-80 w-auto max-w-full rounded-lg object-contain shadow-2xs border border-gray-100" />
          </div>
          <div class="px-3 py-1.5 bg-white border-t border-gray-100 flex items-center gap-2">
            <span class="text-[11px] text-gray-400 shrink-0">题注:</span>
            <figcaption class="unified-caption flex-1 text-xs text-center text-gray-700 bg-gray-50 hover:bg-white focus:bg-white border border-gray-200 rounded px-2.5 py-1 outline-none focus:border-blue-400 select-text" contenteditable="true" data-placeholder="▲ 输入图片说明...">${caption}</figcaption>
          </div>
        </figure>
        <p><br></p>
      `;
      htmlParts.push(withLineMark(figureHtml.trim(), blockStart, i));
      i = hasCaption ? nextIdx + 1 : i + 1;
      continue;
    }

    // 4.5 引用块（> 开头的连续行 → 引用卡片）：保证「一键转 Markdown / AI 排版」
    // 产出的引用块在编辑器中可视化呈现，且同步回写时保留 > 前缀，杜绝整篇变引用的污染
    if (trimmed.startsWith('>')) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ''));
        i++;
      }
      const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const inner = quoteLines.map((l) => esc(l) || ' ').join('<br>');
      const quoteHtml = `<blockquote class="unified-quote my-3 border-l-4 border-emerald-400 bg-emerald-50/60 rounded-r-lg px-4 py-3 text-gray-600" data-ml-s="${blockStart}" data-ml-e="${i - 1}">${inner}</blockquote>\n<p><br></p>`;
      htmlParts.push(withLineMark(quoteHtml, blockStart, i - 1));
      continue;
    }

    // 5. 自然纯文本配图标记（配图：URL / [图片] URL）不再转为图片卡片：
    // 纯文本输入遵循「URL 只显示 URL」的排版需求，此类行按普通文本段落处理；
    // 仅显式 Markdown 图片语法 ![alt](url) 与 <img> 标签才在画布中呈现图片卡片

    // 6. 普通段落与文本行（包裹在 <p> 标签中，保持行间自然断句）
    // 特殊字符转义避免 XSS 破坏 DOM 结构
    const escaped = rawLine
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    // 金句段落（引擎识别的观点句/点题句）：编辑器内以居中卡片呈现，回写保留原始标记行
    if (/^<p data-role="golden-line">/.test(trimmed)) {
      const innerRaw = trimmed.replace(/^<p data-role="golden-line">/, '').replace(/<\/p>$/, '');
      const unescaped = innerRaw.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
      const goldenHtml = `<p class="unified-golden-line my-6 text-center font-semibold text-[15.5px] tracking-wide text-emerald-700" contenteditable="true">${unescaped}</p>`;
      htmlParts.push(withLineMark(goldenHtml, blockStart, i));
      i++;
      continue;
    }
    htmlParts.push(withLineMark(`<p>${escaped}</p>`, blockStart, i));
    i++;
  }

  return htmlParts.join('\n');
}

/**
 * 将单体编辑画布中的完整 DOM 树高保真提取还原为干净的 Markdown 文本
 */
export function unifiedHtmlToMarkdown(container: HTMLElement): string {
  const parts: string[] = [];
  const children = Array.from(container.childNodes);

  for (const node of children) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent?.trim();
      if (text) parts.push(text);
      continue;
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;

      // 0. 金句段落：原样保留标记行，保证往返稳定
      if (el.matches('p[data-role="golden-line"]')) {
        const t = el.textContent?.trim() || '';
        if (t) parts.push(`<p data-role="golden-line">${t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>`);
        continue;
      }

      // 1. 单图卡片 <figure>
      if (el.classList.contains('unified-figure') || el.tagName === 'FIGURE') {
        const img = el.querySelector('img');
        const url = el.getAttribute('data-url') || img?.getAttribute('src') || '';
        const alt = el.getAttribute('data-alt') || img?.getAttribute('alt') || '配图';
        const figcaption = el.querySelector('figcaption');
        const caption = figcaption?.textContent?.trim() || '';

        if (url) {
          parts.push(`![${alt}](${url})`);
          if (caption) {
            const cleanCap = caption.replace(/^[*_]+|[*_]+$/g, '').trim();
            const textOnly = cleanCap.replace(/^▲\s*/, '').trim();
            if (textOnly) {
              const formattedCap = cleanCap.startsWith('▲') ? cleanCap : `▲ ${cleanCap}`;
              parts.push(`*${formattedCap}*`);
            }
          }
        }
        continue;
      }

      // 1.5 引用卡片 <blockquote class="unified-quote">：还原为 > 前缀行
      if (el.classList.contains('unified-quote')) {
        const qlines = (el.innerText || '').split('\n').map((t) => t.trim()).filter(Boolean);
        qlines.forEach((q) => parts.push(`> ${q}`));
        continue;
      }

      // 2. 多图画廊 <div class="unified-gallery">
      if (el.classList.contains('unified-gallery')) {
        const items = Array.from(el.querySelectorAll('.unified-gallery-item')).map((itemEl) => {
          const img = itemEl.querySelector('img');
          const url = itemEl.getAttribute('data-url') || img?.getAttribute('src') || '';
          const alt = itemEl.getAttribute('data-alt') || img?.getAttribute('alt') || '配图';
          const capEl = itemEl.querySelector('.unified-gallery-cap');
          const caption = capEl?.textContent?.trim() || '';
          return { url, alt, caption };
        });

        if (items.length > 0) {
          const imgCells = items.map((it) => `![${it.alt}](${it.url})`);
          const sepCells = items.map(() => ':---:');
          const capCells = items.map((it) => {
            if (!it.caption) return ' ';
            const cleanCap = it.caption.replace(/^[*_]+|[*_]+$/g, '').trim();
            const textOnly = cleanCap.replace(/^▲\s*/, '').trim();
            if (!textOnly) return ' ';
            const formatted = cleanCap.startsWith('▲') ? cleanCap : `▲ ${cleanCap}`;
            return `*${formatted}*`;
          });

          const imgRow = `| ${imgCells.join(' | ')} |`;
          const sepRow = `| ${sepCells.join(' | ')} |`;
          const capRow = `| ${capCells.join(' | ')} |`;

          parts.push(`${imgRow}\n${sepRow}\n${capRow}`);
        }
        continue;
      }

      // 3. 普通文本段落与块级标签
      // 如果内部包含直接的 <img> 标签（如历史内容中图片嵌在段落里）：
      // 必须保留段落中图片前后的文字与题注，绝不能只输出图片导致整段文字丢失
      const standaloneImg = el.querySelector('img');
      if (standaloneImg && !el.classList.contains('unified-figure') && !el.classList.contains('unified-gallery')) {
        const src = standaloneImg.getAttribute('src');
        const alt = standaloneImg.getAttribute('alt') || '配图';
        const capEl = el.querySelector('figcaption');
        const capText = capEl?.textContent?.replace(/^[*_]+|[*_]+$/g, '').trim() || '';
        if (src) {
          const segs: string[] = [];
          let imgEmitted = false;
          Array.from(el.childNodes).forEach((n) => {
            if (n === standaloneImg) {
              segs.push(`![${alt}](${src})`);
              imgEmitted = true;
              if (capText) segs.push(`*▲ ${capText}*`);
              return;
            }
            if (n.nodeType === Node.ELEMENT_NODE && (n as HTMLElement).tagName === 'FIGCAPTION') return;
            const t = n.nodeType === Node.TEXT_NODE ? n.textContent : (n as HTMLElement).innerText;
            if (t && t.trim()) segs.push(t.trim());
          });
          if (!imgEmitted) segs.push(`![${alt}](${src})`);
          parts.push(segs.join('\n\n'));
          continue;
        }
      }

      // 提取纯文本内容
      const text = el.innerText !== undefined ? el.innerText : el.textContent || '';
      const trimmed = text.trim();

      // 空白行跳过或加入空占位
      if (!trimmed) {
        continue;
      }

      parts.push(trimmed);
    }
  }

  if (parts.length === 0) return '';

  let result = '';
  let inCodeBlock = false;

  for (let i = 0; i < parts.length; i++) {
    const curr = parts[i];
    if (i === 0) {
      result = curr;
      if (curr.startsWith('```')) {
        inCodeBlock = curr.trim() === '```' || !curr.trim().slice(3).includes('```');
      }
      continue;
    }

    const prev = parts[i - 1];
    const isCurrTable = curr.startsWith('|');
    const isPrevTable = prev.startsWith('|');
    const isCurrList = /^(\s*[-*+]|\s*\d+[.)])\s/.test(curr);
    const isPrevList = /^(\s*[-*+]|\s*\d+[.)])\s/.test(prev);
    const isCurrQuote = curr.startsWith('>');
    const isPrevQuote = prev.startsWith('>');

    let sep = '\n\n';

    if (inCodeBlock) {
      sep = '\n';
      if (curr.startsWith('```')) {
        inCodeBlock = false;
      }
    } else {
      if (curr.startsWith('```')) {
        inCodeBlock = curr.trim() === '```' || !curr.trim().slice(3).includes('```');
        sep = '\n\n';
      } else if (isPrevTable && isCurrTable) {
        // 连续表格行：必须使用单换行，双换行会破坏 GFM 表格语法
        sep = '\n';
      } else if (isPrevList && isCurrList) {
        // 连续列表项：紧凑列表使用单换行
        sep = '\n';
      } else if (isPrevQuote && isCurrQuote) {
        // 连续引用块
        sep = '\n';
      }
    }

    result += sep + curr;
  }

  return result;
}

/**
 * 构造用于单张图片精准插入到 contenteditable 光标处的 DOM 节点
 */
export function createSingleImageFigureNode(
  url: string,
  alt: string = '配图',
  caption: string = ''
): HTMLElement {
  const figure = document.createElement('figure');
  figure.className =
    'unified-figure my-3 border border-gray-200 hover:border-blue-400 rounded-xl overflow-hidden bg-white shadow-xs transition-all select-none';
  figure.setAttribute('contenteditable', 'false');
  figure.setAttribute('data-type', 'single-image');
  figure.setAttribute('data-url', url);
  figure.setAttribute('data-alt', alt);

  const isBase64 = url.startsWith('data:image/');

  figure.innerHTML = `
    <div class="flex items-center justify-between px-3 py-1.5 bg-gray-50 border-b border-gray-200 text-xs text-gray-500">
      <span class="flex items-center gap-1 font-medium text-gray-700">
        🖼️ ${isBase64 ? '剪贴板/截屏图片' : '配图'}
        <span class="text-gray-400 text-[11px] truncate max-w-[150px] sm:max-w-xs ml-1">(${alt})</span>
      </span>
      <div class="flex items-center gap-1">
        <button type="button" class="view-img-btn p-1 hover:bg-gray-200 text-gray-500 rounded cursor-pointer" title="点击放大预览">🔍 放大</button>
        <button type="button" class="del-img-btn p-1 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded cursor-pointer" title="删除图片">🗑️ 删除</button>
      </div>
    </div>
    <div class="p-3 bg-gray-50/30 flex justify-center cursor-zoom-in view-img-trigger">
      <img src="${url}" alt="${alt}" referrerpolicy="no-referrer" class="max-h-64 sm:max-h-80 w-auto max-w-full rounded-lg object-contain shadow-2xs border border-gray-100" />
    </div>
    <div class="px-3 py-1.5 bg-white border-t border-gray-100 flex items-center gap-2">
      <span class="text-[11px] text-gray-400 shrink-0">题注:</span>
      <figcaption class="unified-caption flex-1 text-xs text-center text-gray-700 bg-gray-50 hover:bg-white focus:bg-white border border-gray-200 rounded px-2.5 py-1 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition-all select-text" contenteditable="true" data-placeholder="▲ 输入图片说明（如：图1：系统架构图）">${caption}</figcaption>
    </div>
  `;

  return figure;
}
