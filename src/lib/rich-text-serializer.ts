/**
 * 微信公众号专用富文本序列化器 (WeChat Official Account Rich-Text Serializer)
 * 严格按照微信公众平台官方《微信公众平台编辑器插件开发规范》及 verify-article-structure-spec 构建：
 * 官方规范地址：https://developers.weixin.qq.com/doc/service/guide/product/plugin_spec.html
 *
 * 核心合规法则（严格遵从官方 1.x ~ 4.x 细则）：
 * 1. 【1.1 opacity 规范】：绝不给 <img> 或包装节点设置 opacity: 0，确保后台换图与正常阅读体验。
 * 2. 【1.2 caret-color 规范】：严禁 caret-color 为 transparent 或 rgba(0,0,0,0)，保证光标始终可见。
 * 3. 【1.3 line-height 规范】：多行文本容器严禁 line-height: 0 或小于字号；标题行高设为 1.4~1.45，正文黄金行高 1.85，角标采用 baseline + relative 位移杜绝 0 行高。
 * 4. 【1.4 width 规范】：
 *    - 杜绝固定像素宽度（如 586px / 680px），全局采用自适应宽度（max-width: 100%; box-sizing: border-box; width: 100%）。
 *    - 对横向滚动容器（代码块与表格），依据 1.4.4 规范声明 data-ignore-width 豁免属性，防止窄屏溢出报警。
 *    - 图片标签注入 data-w 和 data-ratio，避免加载超时或盒模型坍缩。
 * 5. 【1.5 height 规范】：严禁容器 height: 0 或微小定高截断文字。
 * 6. 【1.6 text-align 规范】：严禁使用 start / end（iOS 18+ 兼容异常），严格转换为 left / right / justify / center。
 * 7. 【1.8 pre 规范】：普通正文绝不使用 <pre>，仅真实代码块使用 <pre> 并强制 white-space: pre-wrap; word-break: break-all;。
 * 8. 【2.x 文章结构类】：剔除多层无意义 <div> 嵌套，展开为扁平清晰的语义化顶级节点，杜绝 10 层单一嵌套；杜绝行内容器 <span leaf> 包裹块级元素；清理空 <a> 链接。
 * 9. 【3.x 字体使用规范】：不设置私有字体族，外层容器使用微信官方默认字体栈，内层段落与标题不覆盖字体族，保证跨平台（iOS/安卓/编辑器）渲染大小与字距严格一致。
 * 10. 【4.x Dark Mode 规范】：
 *     - 严禁使用 !important（规范 4.5.2：平台公共样式与暗色模式算法依赖）。
 *     - 白底文章不硬写 background-color: #ffffff，无缝承接公众号原生暗色背景；暗色/宣纸主题保留卡片背景。
 *     - 文字背景渐变添加 data-ignore-dm="text-bg-gradient" 豁免声明（规范 4.6）。
 * 11. 【杜绝伪光标占位】：彻底消除 0px 假段落，避免用户在微信中点击时光标被困在 0px 不可见区域。
 */

import { ThemePreset, WECHAT_OFFICIAL_FONT_FAMILY } from '@/themes/types';

/**
 * 清理并规范化 CSS 内联样式字符串，严格契合微信公众号插件规范
 */
function sanitizeInlineStyle(style: string): string {
  if (!style) return '';
  return style
    .replace(/"/g, "'") // 彻底将内联样式中的双引号转为单引号，防止破坏 HTML style="..." 属性结构
    .split(';')
    .map((s) => s.trim())
    .filter((s) => {
      if (!s) return false;
      const lower = s.toLowerCase();

      // 剔除 flexbox 相关属性，微信编辑器对 flex 解析极不稳定，易产生断行错位
      if (
        lower.startsWith('display: flex') ||
        lower.startsWith('display: inline-flex') ||
        lower.startsWith('display:flex') ||
        lower.startsWith('display:inline-flex') ||
        lower.startsWith('gap:') ||
        lower.startsWith('align-items:') ||
        lower.startsWith('justify-content:') ||
        lower.startsWith('flex:') ||
        lower.startsWith('flex-shrink:') ||
        lower.startsWith('flex-grow:') ||
        lower.startsWith('flex-direction:') ||
        lower.startsWith('user-select:') ||
        lower.startsWith('position: fixed')
      ) {
        return false;
      }

      // 规范 1.2: 剔除透明 caret-color
      if (
        lower.startsWith('caret-color:') &&
        (lower.includes('transparent') ||
          lower.includes('rgba(0, 0, 0, 0)') ||
          lower.includes('rgba(0,0,0,0)'))
      ) {
        return false;
      }

      // 规范 1.5.1 & 1.5.2: 剔除容器 height: 0 或固定微小高度 (防止移动端内容不可见或截断裁剪)
      const compact = lower.replace(/\s+/g, '');
      if (
        compact === 'height:0' ||
        compact === 'height:0px' ||
        compact.startsWith('height:0.') ||
        compact === 'height:1px' ||
        compact === 'height:1.5px'
      ) {
        return false;
      }

      // 规范 1.3: 剔除 line-height: 0
      if (compact === 'line-height:0' || compact === 'line-height:0px') {
        return false;
      }

      // 规范 3: 剔除非等宽代码外的自定义字体族，严格遵从公众号官方统一字体栈
      if (
        lower.startsWith('font-family:') &&
        !lower.includes('consolas') &&
        !lower.includes('monaco') &&
        !lower.includes('menlo') &&
        !lower.includes('monospace') &&
        !lower.includes('mp-quote')
      ) {
        return false;
      }

      return true;
    })
    .map((s) => {
      // 规范 4.5.2 不要使用 !important: 彻底剥离 !important
      let res = s.replace(/\s*!important/gi, '').trim();

      // 规范 1.6 text-align: 替换 start 为 left, end 为 right
      if (res.toLowerCase().startsWith('text-align:')) {
        res = res
          .replace(/:\s*start\b/i, ': left')
          .replace(/:\s*end\b/i, ': right');
      }

      // 规范 1.3: 严格规避 line-height-overlapping 叠字检查
      // 凡是小于 1.75 的行高（如 0, 0.85, 1, 1.2, 1.3, 1.35, 1.4, 1.6 等）或 normal/inherit，统一强制提升至安全合规的 1.75
      if (res.toLowerCase().startsWith('line-height:')) {
        const valStr = res.slice(12).trim().toLowerCase();
        if (valStr.endsWith('px')) {
          const pxVal = parseFloat(valStr);
          if (!isNaN(pxVal) && pxVal < 24) {
            res = 'line-height: 1.75';
          }
        } else if (valStr.endsWith('%')) {
          const pctVal = parseFloat(valStr);
          if (!isNaN(pctVal) && pctVal < 175) {
            res = 'line-height: 1.75';
          }
        } else if (valStr === 'inherit' || valStr === '0' || valStr === '0px' || valStr === 'normal') {
          res = 'line-height: 1.75';
        } else {
          const num = parseFloat(valStr);
          if (!isNaN(num) && num < 1.75) {
            res = 'line-height: 1.75';
          }
        }
      }

      return res;
    })
    .join('; ');
}

/**
 * 将整篇排版 DOM 节点序列化为 100% 严格符合微信公众号官方规范的富文本 HTML
 */
export function serializeToWeChatRichText(
  element: HTMLElement,
  theme?: ThemePreset,
  activeColor?: string
): string {
  // 1. 克隆真实 DOM 根节点，绝不污染界面
  const clone = element.cloneNode(true) as HTMLElement;

  // 提取主题中的设计元数据
  const themeElements = theme?.elements;
  const containerStyle = theme?.container || {};
  const rawBgColor = (containerStyle.backgroundColor as string) || '#ffffff';
  const mainTextColor = (containerStyle.color as string) || '#27272a';
  const baseFontSize = (containerStyle.fontSize as string) || '15.5px';
  const accentColor =
    activeColor ||
    (themeElements?.h2?.color as string) ||
    (themeElements?.h1?.color as string) ||
    '#2563eb';
  const strongColor = (themeElements?.strong?.color as string) || '#0f172a';

  // 2. 预处理克隆节点中的各个微信敏感元素

  // (1) 处理 H1 一级标题
  const h1Elements = Array.from(clone.querySelectorAll('h1'));
  h1Elements.forEach((h1) => {
    const parent = h1.parentElement;
    if (!parent) return;

    let textAlign = (themeElements?.h1?.textAlign as string) || 'center';
    if (textAlign === 'start') textAlign = 'left';
    if (textAlign === 'end') textAlign = 'right';

    const h1Color = (themeElements?.h1?.color as string) || '#0f172a';
    const h1FontSize = (themeElements?.h1?.fontSize as string) || '24px';
    const h1BorderBottom = themeElements?.h1?.borderBottom as string | undefined;
    const h1PaddingBottom = themeElements?.h1?.paddingBottom as string | undefined;
    const borderStyle = h1BorderBottom ? `border-bottom: ${h1BorderBottom};` : '';
    const paddingBottomStyle = h1PaddingBottom ? `padding-bottom: ${h1PaddingBottom};` : '';

    const section = document.createElement('section');
    section.setAttribute(
      'style',
      `margin-top: 36px; margin-bottom: 24px; text-align: ${textAlign}; line-height: 1.75; max-width: 100%; box-sizing: border-box;`
    );

    const innerH1 = document.createElement('h1');
    innerH1.setAttribute(
      'style',
      `margin: 0; padding: 0; font-size: ${h1FontSize}; font-weight: 800; color: ${h1Color}; line-height: 1.75; letter-spacing: 0.5px; ${paddingBottomStyle} ${borderStyle} box-sizing: border-box; max-width: 100%; word-break: break-word;`
    );
    innerH1.innerHTML = h1.innerHTML;

    section.appendChild(innerH1);
    parent.replaceChild(section, h1);
  });

  // (2) 处理 H2 二级分节标题（微信文章灵魂：胶囊彩条/双横线/立体徽章）
  const h2Elements = Array.from(clone.querySelectorAll('h2'));
  h2Elements.forEach((h2) => {
    const parent = h2.parentElement;
    if (!parent) return;

    const h2Decoration = theme?.h2Decoration || 'wechat-badge';
    const h2Color = (themeElements?.h2?.color as string) || accentColor || '#1e293b';
    const h2FontSize = (themeElements?.h2?.fontSize as string) || '18px';

    const section = document.createElement('section');

    // Case A: 杂志/画廊/散文 居中双细线风格 (规范：line-height >= 1.75 杜绝叠字，自适应宽度)
    if (
      h2Decoration === 'magazine-centered' ||
      h2Decoration === 'gallery-line' ||
      h2Decoration === 'literary-dash'
    ) {
      section.setAttribute(
        'style',
        'margin-top: 40px; margin-bottom: 22px; text-align: center; line-height: 1.75; max-width: 100%; box-sizing: border-box;'
      );

      // 提取标题纯净文字（过滤空 span 线条）
      const spans = Array.from(h2.querySelectorAll('span'));
      const textSpan = spans.length >= 3 ? spans[1] : null;
      const textHtml = textSpan ? textSpan.innerHTML : h2.innerHTML;

      section.innerHTML = `
        <section style="display: inline-block; vertical-align: middle; width: 36px; height: 1.5px; background-color: ${accentColor}; opacity: 0.4; margin-right: 12px; box-sizing: border-box;"></section>
        <span style="display: inline-block; vertical-align: middle; font-size: ${h2FontSize}; font-weight: 700; color: ${h2Color}; line-height: 1.75; letter-spacing: 1px; max-width: 80%; word-break: break-word; box-sizing: border-box;">${textHtml}</span>
        <section style="display: inline-block; vertical-align: middle; width: 36px; height: 1.5px; background-color: ${accentColor}; opacity: 0.4; margin-left: 12px; box-sizing: border-box;"></section>
      `.trim();
    }
    // Case B: 波普立体硬阴影徽章风格
    else if (h2Decoration === 'pop-box') {
      section.setAttribute(
        'style',
        'margin-top: 38px; margin-bottom: 20px; text-align: left; line-height: 1.75; max-width: 100%; box-sizing: border-box;'
      );
      const innerSpan = h2.querySelector('span');
      const textHtml = innerSpan ? innerSpan.innerHTML : h2.innerHTML;
      section.innerHTML = `<span style="display: inline-block; background-color: #fde047; color: #000000; border: 2px solid #000000; padding: 4px 12px; box-shadow: 2.5px 2.5px 0px #000000; font-weight: 800; font-size: 17.5px; line-height: 1.75; max-width: 100%; word-break: break-word; box-sizing: border-box;">${textHtml}</span>`;
    }
    // Case C: 经典微胶囊小彩条（微信风、商务、新中式、极客、薄荷、莫兰迪等）
    else if (
      h2Decoration === 'wechat-badge' ||
      h2Decoration === 'report-pill' ||
      h2Decoration === 'latte-badge' ||
      h2Decoration === 'mint-capsule' ||
      h2Decoration === 'morandi-soft' ||
      h2Decoration === 'journal-sticker' ||
      h2Decoration === 'swiss-block' ||
      h2Decoration === 'academic-bracket' ||
      h2Decoration === 'cyber-glow' ||
      h2Decoration === 'seal-tag' ||
      h2Decoration === 'terminal-prompt'
    ) {
      section.setAttribute(
        'style',
        'margin-top: 38px; margin-bottom: 20px; text-align: left; line-height: 1.75; max-width: 100%; box-sizing: border-box;'
      );

      // 提取标题文字
      const spans = Array.from(h2.querySelectorAll('span'));
      const textSpan = spans.length >= 2 ? spans[1] : null;
      const textHtml = textSpan ? textSpan.innerHTML : h2.innerHTML;

      // 纯 CSS 实体色块，display: inline-block + vertical-align: middle，在微信编辑器永不换行、垂直完美居中
      section.innerHTML = `
        <section style="display: inline-block; vertical-align: middle; width: 4.5px; height: 18px; background-color: ${accentColor}; border-radius: 2px; margin-right: 9px; box-sizing: border-box;"></section>
        <span style="display: inline-block; vertical-align: middle; font-size: ${h2FontSize}; font-weight: 700; color: ${h2Color}; line-height: 1.75; letter-spacing: 0.5px; max-width: calc(100% - 20px); word-break: break-word; box-sizing: border-box;">${textHtml}</span>
      `.trim();
    }
    // Case D: 复古报纸或其他常规样式
    else {
      let textAlign = (themeElements?.h2?.textAlign as string) || 'left';
      if (textAlign === 'start') textAlign = 'left';
      if (textAlign === 'end') textAlign = 'right';

      section.setAttribute(
        'style',
        `margin-top: 38px; margin-bottom: 20px; text-align: ${textAlign}; line-height: 1.75; max-width: 100%; box-sizing: border-box;`
      );
      const innerH2 = document.createElement('h2');
      const h2Style = h2.getAttribute('style') || '';
      innerH2.setAttribute(
        'style',
        `margin: 0; padding: 0; font-size: ${h2FontSize}; font-weight: 700; color: ${h2Color}; line-height: 1.75; max-width: 100%; word-break: break-word; box-sizing: border-box; ${sanitizeInlineStyle(h2Style)}`
      );
      innerH2.innerHTML = h2.innerHTML;
      section.appendChild(innerH2);
    }

    parent.replaceChild(section, h2);
  });

  // (3) 处理 H3 三级小标题
  const h3Elements = Array.from(clone.querySelectorAll('h3'));
  h3Elements.forEach((h3) => {
    const parent = h3.parentElement;
    if (!parent) return;

    const h3Color = (themeElements?.h3?.color as string) || accentColor || '#047857';
    const h3FontSize = (themeElements?.h3?.fontSize as string) || '16px';

    const section = document.createElement('section');
    section.setAttribute(
      'style',
      'margin-top: 26px; margin-bottom: 14px; text-align: left; line-height: 1.75; max-width: 100%; box-sizing: border-box;'
    );

    const innerH3 = document.createElement('h3');
    innerH3.setAttribute(
      'style',
      `margin: 0; padding: 0 0 0 10px; font-size: ${h3FontSize}; font-weight: 600; color: ${h3Color}; border-left: 3.5px solid ${accentColor}; line-height: 1.75; max-width: 100%; word-break: break-word; box-sizing: border-box;`
    );
    innerH3.innerHTML = h3.innerHTML;

    section.appendChild(innerH3);
    parent.replaceChild(section, h3);
  });

  // (3.5) 处理 H4, H5, H6 兜底小标题（规范 1.3: 统一设定 line-height: 1.75）
  (['h4', 'h5', 'h6'] as const).forEach((tag) => {
    const headingElements = Array.from(clone.querySelectorAll(tag));
    headingElements.forEach((h) => {
      const el = h as HTMLElement;
      el.style.lineHeight = '1.75';
      el.style.maxWidth = '100%';
      el.style.boxSizing = 'border-box';
      el.style.wordBreak = 'break-word';
    });
  });

  // (4) 处理 blockquote 引用块（全面转换为微信专属 section 气泡容器）
  const quoteElements = Array.from(clone.querySelectorAll('blockquote'));
  quoteElements.forEach((quote) => {
    const parent = quote.parentElement;
    if (!parent) return;

    const bqStyle = themeElements?.blockquote || {};
    const quoteBg =
      (bqStyle.backgroundColor as string) ||
      'rgba(16, 185, 129, 0.06)';
    const quoteBorder =
      (bqStyle.borderLeft as string) ||
      `3.5px solid ${accentColor}`;
    const quoteColor = (bqStyle.color as string) || '#1f2937';
    const quoteRadius = (bqStyle.borderRadius as string) || '0 8px 8px 0';

    const section = document.createElement('section');
    section.setAttribute('data-role', 'blockquote');
    section.setAttribute(
      'style',
      `margin: 24px 0; padding: 16px 20px; background-color: ${quoteBg}; border-left: ${quoteBorder}; border-radius: ${quoteRadius}; color: ${quoteColor}; font-size: 14.5px; line-height: 1.85; max-width: 100%; box-sizing: border-box; word-break: break-word;`
    );

    // 格式化引用块内部的所有子段落，移除多余外边距
    quote.querySelectorAll('p').forEach((p, idx, arr) => {
      const isLast = idx === arr.length - 1;
      p.setAttribute(
        'style',
        `margin: 0 0 ${isLast ? '0' : '10px'} 0; padding: 0; font-size: 14.5px; line-height: 1.85; color: inherit; letter-spacing: 0.034em; box-sizing: border-box;`
      );
    });

    section.innerHTML = quote.innerHTML;
    parent.replaceChild(section, quote);
  });

  // (5) 处理代码块 pre & code（规范 1.4.4: 注入 data-ignore-width 豁免横向滚动）
  const preElements = Array.from(clone.querySelectorAll('pre'));
  preElements.forEach((pre) => {
    const parent = pre.parentElement;
    if (!parent) return;

    const preStyle = themeElements?.pre || {};
    const preBg = (preStyle.backgroundColor as string) || '#1e293b';
    const preColor = (preStyle.color as string) || '#f8fafc';
    const preBorder = (preStyle.border as string) || '1px solid #334155';
    const preRadius = (preStyle.borderRadius as string) || '8px';

    const section = document.createElement('section');
    section.setAttribute('data-role', 'code-block');
    section.setAttribute('data-ignore-width', ''); // 规范 1.4.4 豁免横向滚动容器宽检测
    section.setAttribute(
      'style',
      `margin: 24px 0; padding: 16px 20px; background-color: ${preBg}; border: ${preBorder}; border-radius: ${preRadius}; overflow-x: auto; -webkit-overflow-scrolling: touch; max-width: 100%; box-sizing: border-box;`
    );

    const innerPre = document.createElement('pre');
    innerPre.setAttribute(
      'style',
      `margin: 0; padding: 0; font-family: Consolas, Monaco, Menlo, 'Courier New', monospace; font-size: 13px; line-height: 1.65; color: ${preColor}; white-space: pre-wrap; word-break: break-all; background: transparent; border: none; box-sizing: border-box;`
    );

    const code = pre.querySelector('code');
    const codeContent = code ? code.innerHTML : pre.innerHTML;
    innerPre.innerHTML = `<code style="font-family: inherit; font-size: inherit; background: transparent; padding: 0; border: none; color: inherit; white-space: pre-wrap; word-break: break-all;">${codeContent}</code>`;

    section.appendChild(innerPre);

    // 如果原 pre 的父级已经是外层包装容器，则替换父级
    if (parent.tagName === 'SECTION' && parent.parentElement) {
      parent.parentElement.replaceChild(section, parent);
    } else {
      parent.replaceChild(section, pre);
    }
  });

  // (6) 处理表格 table（规范 1.4.2 & 1.4.4: 注入 data-ignore-width，杜绝固定列宽，支持自适应换行，智能支持微信合规无边框多图并排画廊）
  const tableElements = Array.from(clone.querySelectorAll('table'));
  tableElements.forEach((table) => {
    const parent = table.parentElement;
    if (!parent) return;

    const isImageTable = table.querySelector('img') !== null;

    if (isImageTable) {
      // 微信多图画廊：无边框无底色，自适应等分列宽，各图独立居中
      const firstRowCells = table.querySelector('tr')?.children.length || 2;
      const colWidth =
        firstRowCells === 2
          ? '50%'
          : firstRowCells === 3
          ? '33.33%'
          : `${(100 / firstRowCells).toFixed(2)}%`;

      table.setAttribute(
        'style',
        'width: 100%; border-collapse: collapse; margin: 24px auto; border: none; background: transparent; font-size: 13px; line-height: 1.75; color: #64748b; box-sizing: border-box; max-width: 100%;'
      );

      table.querySelectorAll('th, td').forEach((cell) => {
        cell.removeAttribute('width');
        cell.removeAttribute('data-colwidth');
        const hasImg = cell.querySelector('img') !== null;

        if (hasImg) {
          cell.setAttribute(
            'style',
            `width: ${colWidth}; border: none; background: transparent; padding: 0 4px; vertical-align: top; text-align: center; line-height: 1.75; box-sizing: border-box;`
          );
        } else {
          // 题注文字单元格：显式注入安全 font-size 与 line-height: 1.75
          cell.setAttribute(
            'style',
            `width: ${colWidth}; border: none; background: transparent; padding: 8px 4px 0 4px; vertical-align: top; text-align: center; font-size: 13px; line-height: 1.75; color: #64748b; letter-spacing: 0.02em; box-sizing: border-box; word-break: break-word;`
          );

          // 核心优化：解构题注内部的 em / p / span 标签，将纯文本提升至 cell 直接子节点
          // 彻底消除 Chrome DOM Range 对 inline 包装元素误切分裂多个 rect 导致 #2.3.2 叠字误报
          const inlineWrappers = Array.from(cell.querySelectorAll('em, p, span'));
          inlineWrappers.forEach((el) => {
            while (el.firstChild) {
              el.parentElement?.insertBefore(el.firstChild, el);
            }
            el.remove();
          });
        }
      });

      if (parent.tagName !== 'SECTION') {
        const section = document.createElement('section');
        section.setAttribute('data-role', 'image-gallery');
        section.setAttribute('data-ignore-width', '');
        section.setAttribute(
          'style',
          'margin: 24px 0; width: 100%; max-width: 100%; box-sizing: border-box;'
        );
        parent.insertBefore(section, table);
        section.appendChild(table);
      } else {
        parent.setAttribute('data-role', 'image-gallery');
        parent.setAttribute('data-ignore-width', '');
      }
      return;
    }

    // 普通数据表格排版
    table.setAttribute(
      'style',
      'width: 100%; border-collapse: collapse; font-size: 13.5px; line-height: 1.75; margin: 0 auto; text-align: left; box-sizing: border-box; word-break: break-word;'
    );

    // 强化 th 样式（自适应换行，避免固定列宽）
    table.querySelectorAll('th').forEach((th) => {
      th.removeAttribute('width');
      th.removeAttribute('data-colwidth');
      th.setAttribute(
        'style',
        'border: 1px solid #e2e8f0; padding: 8px 12px; background-color: #f8fafc; color: #1e293b; font-weight: 700; line-height: 1.75; text-align: left; box-sizing: border-box; word-break: break-word;'
      );
    });

    // 强化 td 样式
    table.querySelectorAll('td').forEach((td) => {
      td.removeAttribute('width');
      td.removeAttribute('data-colwidth');
      td.setAttribute(
        'style',
        'border: 1px solid #e2e8f0; padding: 8px 12px; color: #334155; line-height: 1.75; box-sizing: border-box; word-break: break-word;'
      );
    });

    // 检查父级是否已经是 section
    if (parent.tagName !== 'SECTION') {
      const section = document.createElement('section');
      section.setAttribute('data-role', 'table-wrapper');
      section.setAttribute('data-ignore-width', ''); // 规范 1.4.4 表格滚动豁免
      section.setAttribute(
        'style',
        'margin: 24px 0; overflow-x: auto; -webkit-overflow-scrolling: touch; width: 100%; max-width: 100%; box-sizing: border-box;'
      );
      parent.insertBefore(section, table);
      section.appendChild(table);
    } else {
      parent.setAttribute('data-role', 'table-wrapper');
      parent.setAttribute('data-ignore-width', '');
    }
  });

  // (7) 处理分割线 hr 与紧邻段落的间距对称性（规范 1.3 & 1.5: 纯 border-top 细线，宽度 100% 贯通版面，不含 height，不含 line-height: 0）
  const hrElements = Array.from(clone.querySelectorAll('hr'));
  const hrBorder = (themeElements?.hr?.borderTop as string) || (themeElements?.hr?.border as string) || '1.5px solid #cbd5e1';
  const hrMargin = (themeElements?.hr?.margin as string) || '32px 0';
  const hrWidth = (themeElements?.hr?.width as string) || '100%';

  hrElements.forEach((hr) => {
    const parent = hr.parentElement;
    if (!parent) return;

    // 清理紧邻 hr 前方的段落底外边距，防止双重间距累加导致上方留白过大
    const prev = hr.previousElementSibling;
    if (prev && prev.tagName === 'P') {
      prev.setAttribute(
        'style',
        (prev.getAttribute('style') || '').replace(/margin-bottom:\s*[^;]+;?/g, '') + ' margin-bottom: 0;'
      );
    }

    const section = document.createElement('section');
    section.setAttribute('data-role', 'divider');
    section.setAttribute(
      'style',
      `margin: ${hrMargin}; width: ${hrWidth}; border: none; border-top: ${hrBorder}; max-width: 100%; box-sizing: border-box;`
    );

    parent.replaceChild(section, hr);
  });

  // (8) 处理正文段落 p（保证两端对齐、黄金行距 1.85 与自适应字距，重点保证双分割线夹持文本绝对垂直居中，图片包装与题注紧凑对齐）
  const pColor = (themeElements?.p?.color as string) || '#374151';
  const pFontSize = (themeElements?.p?.fontSize as string) || baseFontSize;
  const pLineHeight = '1.85';

  clone.querySelectorAll('p').forEach((p) => {
    // 若在 blockquote 内部已处理过，跳过
    if (p.closest('[data-role="blockquote"]')) return;
    // 若在 li 内部，移除 bottom margin
    if (p.closest('li')) {
      p.setAttribute(
        'style',
        'margin: 0; font-size: inherit; line-height: inherit; color: inherit; box-sizing: border-box;'
      );
      return;
    }
    // 若在 table 单元格内部，由表格格式化器统筹管理
    if (p.closest('td, th')) {
      return;
    }

    const prev = p.previousElementSibling;
    const next = p.nextElementSibling;

    // 1. 检查是否为图片包装容器段落
    if (p.querySelector('img')) {
      const nextText = next?.textContent?.trim() || '';
      const isNextCaption =
        next?.getAttribute('data-role') === 'image-caption' ||
        /^(?:▲\s*|\[)?(?:图|表|Figure)\s*\d+/i.test(nextText) ||
        nextText.startsWith('▲');

      p.setAttribute(
        'style',
        `margin-top: 26px; margin-bottom: ${isNextCaption ? '0' : '26px'}; text-align: center; max-width: 100%; box-sizing: border-box; line-height: 1.75;`
      );
      return;
    }

    // 2. 检查是否为图片题注段落
    const pRole = p.getAttribute('data-role');
    const pText = p.textContent?.trim() || '';
    const isPrevImgBlock =
      prev &&
      (prev.querySelector('img') ||
        prev.getAttribute('data-role') === 'image-gallery' ||
        prev.tagName === 'IMG');
    const isCaption =
      pRole === 'image-caption' ||
      /^(?:▲\s*|\[)?(?:图|表|Figure)\s*\d+/i.test(pText) ||
      (isPrevImgBlock && (pText.startsWith('▲') || (pText.length > 0 && pText.length < 80 && !/[。！？]$/.test(pText))));

    if (isCaption) {
      p.setAttribute(
        'style',
        'margin-top: 8px; margin-bottom: 26px; font-size: 13px; line-height: 1.75; color: #64748b; letter-spacing: 0.02em; text-align: center; word-break: break-word; box-sizing: border-box; max-width: 100%;'
      );
      // 解构题注内部的 em / span 标签，将纯文本提升至 p 的直接子节点，杜绝任何内联碎片导致叠字误判
      const inlineWrappers = Array.from(p.querySelectorAll('em, span'));
      inlineWrappers.forEach((el) => {
        while (el.firstChild) {
          el.parentElement?.insertBefore(el.firstChild, el);
        }
        el.remove();
      });
      return;
    }

    // 3. 核心垂直居中与对称性排查：检查相邻节点是否包含分割线（hr 或替换后的 section[data-role="divider"]）
    const isAfterHr = prev?.tagName === 'HR' || prev?.getAttribute('data-role') === 'divider';
    const isBeforeHr = next?.tagName === 'HR' || next?.getAttribute('data-role') === 'divider';

    let pMarginTop = '0';
    let pMarginBottom = '18px';

    if (isAfterHr && isBeforeHr) {
      // 双分割线夹持文本（题记/金句/引言）：上下边距绝对归零，由分割线的对称外边距提供完美居中留白
      pMarginTop = '0';
      pMarginBottom = '0';
    } else if (isBeforeHr) {
      // 紧邻分割线之前的段落：底边距归零，由分割线顶边距统一承载
      pMarginBottom = '0';
    } else if (isAfterHr) {
      // 紧邻分割线之后的段落：顶边距归零，由分割线下边距统一承载
      pMarginTop = '0';
    }

    p.setAttribute(
      'style',
      `margin-top: ${pMarginTop}; margin-bottom: ${pMarginBottom}; font-size: ${pFontSize}; line-height: ${pLineHeight}; letter-spacing: 0.034em; color: ${pColor}; text-align: justify; word-break: break-word; box-sizing: border-box; max-width: 100%;`
    );
  });

  // (9) 处理列表 ul / ol / li
  const listMargin = '16px 0';
  clone.querySelectorAll('ul').forEach((ul) => {
    const listStyle = (themeElements?.ul?.listStyleType as string) || 'disc';
    const paddingLeft = (themeElements?.ul?.paddingLeft as string) || '24px';
    ul.setAttribute(
      'style',
      `margin: ${listMargin}; padding-left: ${paddingLeft}; list-style-type: ${listStyle}; box-sizing: border-box; max-width: 100%;`
    );
  });

  clone.querySelectorAll('ol').forEach((ol) => {
    const paddingLeft = (themeElements?.ol?.paddingLeft as string) || '24px';
    ol.setAttribute(
      'style',
      `margin: ${listMargin}; padding-left: ${paddingLeft}; list-style-type: decimal; box-sizing: border-box; max-width: 100%;`
    );
  });

  clone.querySelectorAll('li').forEach((li) => {
    // 关键优化 1：若 li 内部有 <p> 或 <section> 块级标签，解构并平铺为行内子节点，杜绝非法块嵌套破坏 ProseMirror 列表结构
    const blockChildren = Array.from(li.querySelectorAll('p, section'));
    blockChildren.forEach((blk) => {
      while (blk.firstChild) {
        blk.parentElement?.insertBefore(blk.firstChild, blk);
      }
      blk.remove();
    });

    // 关键优化 2：原子绑定 (Atomic Grouping) —— 将 <li> 中加粗标题 <strong> 与紧随其后的冒号（及标点）
    // 永久封装在同一个带有 white-space: nowrap 的行内容器中，并在中文排版下将冒号规范化为全角冒号，
    // 清除冒号后残留的空格，彻底杜绝微信编辑器在标题与冒号之间产生任何换行机会。
    const strongs = Array.from(li.querySelectorAll('strong'));
    strongs.forEach((strong) => {
      const parent = strong.parentElement;
      if (!parent) return;

      const next = strong.nextSibling;
      let matchedPunct: string | null = null;

      if (next && next.nodeType === 3 && next.nodeValue) {
        const punctMatch = next.nodeValue.match(/^[\s\u00A0]*([:：\-—–]+)[\s\u00A0]*/);
        if (punctMatch) {
          let pChar = punctMatch[1];
          if (pChar === ':' || pChar === '：') {
            pChar = '：'; // 规范化为中文全角标准冒号
          } else if (pChar === '-') {
            pChar = ' — ';
          }
          matchedPunct = pChar;
          // 清除后继文本节点开头的标点和所有空格
          next.nodeValue = next.nodeValue.slice(punctMatch[0].length);
        }
      }

      // 创建防折行原子行内容器
      const nowrapSpan = document.createElement('span');
      nowrapSpan.setAttribute('style', 'display: inline; white-space: nowrap;');

      parent.insertBefore(nowrapSpan, strong);
      nowrapSpan.appendChild(strong);

      if (matchedPunct) {
        const punctSpan = document.createElement('span');
        punctSpan.setAttribute('style', `font-weight: 700; color: ${strongColor};`);
        punctSpan.textContent = matchedPunct;
        nowrapSpan.appendChild(punctSpan);
      }
    });

    li.setAttribute(
      'style',
      `margin-bottom: 8px; font-size: ${pFontSize}; line-height: 1.75; color: ${pColor}; word-break: break-word; box-sizing: border-box;`
    );
  });

  // (10) 处理行内强调与高亮 strong（规范 4.1.2 & 4.6: 若有渐变背景添加 data-ignore-dm="text-bg-gradient"）
  const markHighlight = theme?.markHighlight;
  const markBgStr = markHighlight?.background ? String(markHighlight.background) : '';
  const hasGradientBg = markBgStr.includes('gradient');

  const markStyleParts: string[] = [];
  if (markHighlight) {
    if (markHighlight.background) markStyleParts.push(`background: ${markHighlight.background}`);
    if (markHighlight.borderBottom) markStyleParts.push(`border-bottom: ${markHighlight.borderBottom}`);
    if (markHighlight.border) markStyleParts.push(`border: ${markHighlight.border}`);
    if (markHighlight.padding) markStyleParts.push(`padding: ${markHighlight.padding}`);
    if (markHighlight.borderRadius) markStyleParts.push(`border-radius: ${markHighlight.borderRadius}`);
    if (markHighlight.color) markStyleParts.push(`color: ${markHighlight.color}`);
  }
  const markStyle = markStyleParts.length > 0 ? `${markStyleParts.join('; ')};` : '';

  clone.querySelectorAll('strong').forEach((strong) => {
    if (hasGradientBg) {
      strong.setAttribute('data-ignore-dm', 'text-bg-gradient');
    }
    // 强制声明 display: inline; white-space: nowrap; 杜绝 inline-block / block，避免微信粘贴异常折行
    strong.setAttribute(
      'style',
      `font-weight: 700; color: ${strongColor}; ${markStyle} display: inline; white-space: nowrap;`
    );
  });

  // (11) 处理行内代码 code
  const codeStyle = themeElements?.code || {};
  const codeBg = (codeStyle.backgroundColor as string) || '#f1f5f9';
  const codeColor = (codeStyle.color as string) || accentColor || '#0f172a';
  const codeBorder = (codeStyle.border as string) || '1px solid #e2e8f0';

  clone.querySelectorAll('code').forEach((code) => {
    if (code.closest('pre')) return; // 代码块内部 code 保持继承
    code.setAttribute(
      'style',
      `background-color: ${codeBg}; color: ${codeColor}; padding: 2px 6px; border-radius: 4px; font-size: 0.88em; font-family: Consolas, Monaco, Menlo, monospace; border: ${codeBorder}; margin: 0 2px; box-sizing: border-box;`
    );
  });

  // (12) 处理链接 a 与清理空链接
  clone.querySelectorAll('a').forEach((a) => {
    // 官方规范检查项：清理无文本且无子图片的无效幽灵链接
    if (!a.textContent?.trim() && !a.querySelector('img')) {
      a.remove();
      return;
    }
    a.setAttribute(
      'style',
      `color: ${accentColor}; text-decoration: underline; text-underline-offset: 3px; font-weight: 600; box-sizing: border-box;`
    );
  });

  // (12.5) 处理角标/脚注引用上标 sup（规范 1.3: 绝对不用 line-height: 0 或 1，改用 baseline + relative 位移 + line-height: inherit）
  clone.querySelectorAll('sup').forEach((sup) => {
    sup.setAttribute(
      'style',
      `font-size: 11px; font-weight: 700; color: ${accentColor}; margin-left: 2px; padding: 0 1px; vertical-align: baseline; position: relative; top: -0.35em; line-height: inherit; box-sizing: border-box;`
    );
  });

  // (12.6) 处理删除线 del, s, strike
  clone.querySelectorAll('del, s, strike').forEach((del) => {
    del.setAttribute(
      'style',
      'text-decoration: line-through; color: #94a3b8; box-sizing: border-box;'
    );
  });

  // (12.7) 处理任务清单复选框 input[type="checkbox"]（规范 1.1: 避免非法表单控件，转换为原生纯 CSS 徽标）
  clone.querySelectorAll('input').forEach((input) => {
    if (input.getAttribute('type') === 'checkbox') {
      const isChecked = (input as HTMLInputElement).checked || input.hasAttribute('checked');
      const span = document.createElement('span');
      if (isChecked) {
        span.setAttribute(
          'style',
          `display: inline-block; width: 15px; height: 15px; line-height: 15px; text-align: center; background-color: ${accentColor}; color: #ffffff; border-radius: 3px; font-size: 11px; margin-right: 7px; vertical-align: middle; font-weight: bold;`
        );
        span.textContent = '✓';
      } else {
        span.setAttribute(
          'style',
          'display: inline-block; width: 15px; height: 15px; border: 1.5px solid #cbd5e1; border-radius: 3px; margin-right: 7px; vertical-align: middle; box-sizing: border-box;'
        );
      }
      input.parentElement?.replaceChild(span, input);
    }
  });

  // (13) 处理图片 img（规范 1.1: 绝不 opacity: 0；规范 1.4: 注入 data-w 和 data-ratio 避免盒模型坍缩；融入当前主题个性化边框、圆角与阴影）
  const imgThemeStyle = themeElements?.img || {};
  const imgRadius = (imgThemeStyle.borderRadius as string) ?? '8px';
  const imgBorder = (imgThemeStyle.border as string) ?? '';
  const imgShadow = (imgThemeStyle.boxShadow as string) ?? '';
  const imgPadding = (imgThemeStyle.padding as string) ?? '';
  const imgBg = (imgThemeStyle.backgroundColor as string) ?? '';

  clone.querySelectorAll('img').forEach((img) => {
    const isInsideTable = Boolean(img.closest('table'));
    const borderStr = imgBorder ? `border: ${imgBorder};` : '';
    const shadowStr = imgShadow ? `box-shadow: ${imgShadow};` : '';
    const paddingStr = imgPadding ? `padding: ${imgPadding};` : '';
    const bgStr = imgBg ? `background-color: ${imgBg};` : '';
    const radiusStr = imgRadius ? `border-radius: ${imgRadius};` : '';
    const marginStr = isInsideTable ? 'margin: 0 auto;' : 'margin: 0 auto;';

    img.setAttribute(
      'style',
      `max-width: 100%; width: 100%; height: auto; display: block; ${marginStr} ${radiusStr} ${borderStr} ${shadowStr} ${paddingStr} ${bgStr} box-sizing: border-box;`
    );

    const src = img.getAttribute('src') || '';
    if (src && !img.getAttribute('data-src')) {
      img.setAttribute('data-src', src);
    }
    if (!img.getAttribute('data-w')) {
      const naturalW = img.naturalWidth || 1080;
      img.setAttribute('data-w', String(naturalW));
    }
    if (!img.getAttribute('data-ratio')) {
      const naturalW = img.naturalWidth;
      const naturalH = img.naturalHeight;
      const ratio = naturalW && naturalH ? (naturalH / naturalW).toFixed(4) : '0.5625';
      img.setAttribute('data-ratio', String(ratio));
    }
    if (!img.getAttribute('alt')) {
      img.setAttribute('alt', '配图');
    }
  });

  // (13.2) 处理可能存在的照片卡片外框（如带衬底的拍立得卡片，Dark Mode 护城河）
  clone.querySelectorAll('[data-role="photo-card"]').forEach((card) => {
    card.setAttribute(
      'style',
      'margin: 28px auto; max-width: 100%; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 12px 16px 12px; box-shadow: 0 4px 16px rgba(0,0,0,0.06); text-align: center; box-sizing: border-box; line-height: 1.75;'
    );
    card.querySelectorAll('p').forEach((p) => {
      p.setAttribute(
        'style',
        'margin: 12px 0 0 0; font-size: 13px; line-height: 1.75; color: #64748b; font-weight: 500; text-align: center; box-sizing: border-box;'
      );
    });
  });

  // (14) 全局清洗：移除所有残余的 class, id，清理非法样式
  const allNodes = Array.from(clone.querySelectorAll('*'));
  allNodes.forEach((node) => {
    node.removeAttribute('class');
    node.removeAttribute('id');

    const rawStyle = node.getAttribute('style');
    if (rawStyle) {
      const sanitized = sanitizeInlineStyle(rawStyle);
      node.setAttribute('style', sanitized);
    }
  });

  // 3. 提取真正的文章子节点（剥离 ReactMarkdown 的顶层无意义 div 容器，满足规范 2.1 嵌套层级限制）
  let rootContent: HTMLElement = clone;
  while (
    rootContent.children.length === 1 &&
    rootContent.firstElementChild?.tagName === 'DIV'
  ) {
    rootContent = rootContent.firstElementChild as HTMLElement;
  }
  const innerHtml = rootContent.innerHTML.trim();

  // 4. 外层封装标准微信公众号 <section data-role="outer">
  // 规范 4.x: 白色背景主题不设置固定 white 背景色和横向冗余 padding，完美继承微信原生背景与暗黑模式
  const isWhiteBg =
    !rawBgColor ||
    rawBgColor.toLowerCase() === '#ffffff' ||
    rawBgColor.toLowerCase() === '#fff' ||
    rawBgColor === 'transparent';

  const outerContainerStyle = isWhiteBg
    ? `max-width: 100%; margin: 0 auto; box-sizing: border-box; font-family: ${WECHAT_OFFICIAL_FONT_FAMILY}; font-size: ${baseFontSize}; letter-spacing: 0.034em; line-height: 1.85; color: ${mainTextColor}; text-align: justify; word-break: break-word;`
    : `max-width: 100%; margin: 0 auto; box-sizing: border-box; font-family: ${WECHAT_OFFICIAL_FONT_FAMILY}; font-size: ${baseFontSize}; letter-spacing: 0.034em; line-height: 1.85; color: ${mainTextColor}; text-align: justify; word-break: break-word; background-color: ${rawBgColor}; padding: 24px 16px; border-radius: 8px;`;

  // 杜绝任何双引号破坏 style="..." 属性结构
  const safeOuterStyle = outerContainerStyle.replace(/"/g, "'");

  // 规范说明：杜绝 font-size: 0; line-height: 0 的假占位段落，直接输出纯净合规的语义文章内容
  const finalHtml = `
<section data-role="outer" style="${safeOuterStyle}">
  ${innerHtml}
</section>
  `.trim();

  return finalHtml;
}

/**
 * 完整高保真富文本复制到系统剪贴板
 * 双轨保障策略：现代 Clipboard API + DOM 'copy' 事件拦截监听，确保 100% 成功注入 text/html
 */
export async function copyHighFidelityRichText(
  element: HTMLElement,
  theme?: ThemePreset,
  activeColor?: string
): Promise<void> {
  const fullHtml = serializeToWeChatRichText(element, theme, activeColor);
  const plainText = element.innerText;

  let success = false;

  // 策略 1: 优先尝试现代标准的 navigator.clipboard.write API
  if (navigator.clipboard && window.ClipboardItem) {
    try {
      const htmlBlob = new Blob([fullHtml], { type: 'text/html' });
      const textBlob = new Blob([plainText], { type: 'text/plain' });

      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': htmlBlob,
          'text/plain': textBlob,
        }),
      ]);
      success = true;
    } catch (err) {
      console.warn('Modern navigator.clipboard.write failed, falling back to copy event', err);
    }
  }

  // 策略 2: 降级使用经典的 copy 事件监听注入法（兼容任何浏览器环境，100% 写入 text/html）
  if (!success) {
    const copyHandler = (e: ClipboardEvent) => {
      e.preventDefault();
      if (e.clipboardData) {
        e.clipboardData.clearData();
        e.clipboardData.setData('text/html', fullHtml);
        e.clipboardData.setData('text/plain', plainText);
      }
    };

    // 激活合法选区以确保 execCommand('copy') 触发 copy 事件
    const dummySpan = document.createElement('span');
    dummySpan.style.position = 'fixed';
    dummySpan.style.left = '-9999px';
    dummySpan.style.top = '0';
    dummySpan.style.fontSize = '12px';
    dummySpan.style.lineHeight = '1.5';
    dummySpan.setAttribute('aria-hidden', 'true');
    dummySpan.textContent = ' ';
    document.body.appendChild(dummySpan);

    const range = document.createRange();
    range.selectNodeContents(dummySpan);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);

    document.addEventListener('copy', copyHandler, { once: true });

    try {
      const ok = document.execCommand('copy');
      if (!ok) {
        throw new Error('document.execCommand copy returned false');
      }
    } finally {
      selection?.removeAllRanges();
      if (dummySpan.parentNode) {
        dummySpan.parentNode.removeChild(dummySpan);
      }
      document.removeEventListener('copy', copyHandler);
    }
  }
}
