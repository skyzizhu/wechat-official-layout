'use client';

import ReactMarkdown, { defaultUrlTransform } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import type { ThemePreset } from '@/themes/types';
import type { Components } from 'react-markdown';
import React, { CSSProperties } from 'react';

interface MarkdownRendererProps {
  content: string;
  theme: ThemePreset;
}

/**
 * photo-card 图片卡片内部段落的题注色上下文：
 * 卡片为白色衬底，题注需使用主题强调色（而非正文黑/主题正文色），保证卡片上清晰可读且跟随主题
 */
const PhotoCardColorContext = React.createContext<string | null>(null);

/**
 * 递归提取 AST 节点中的纯文本
 */
function getNodeText(node: any): string {
  if (!node) return '';
  if (node.type === 'text') return node.value || '';
  if (node.children && Array.isArray(node.children)) {
    return node.children.map(getNodeText).join('');
  }
  return '';
}

/**
 * 检查节点及其子节点是否包含指定标签
 */
function treeContainsTag(node: any, tagName: string): boolean {
  if (!node) return false;
  if (node.tagName === tagName) return true;
  if (node.children && Array.isArray(node.children)) {
    return node.children.some((child: any) => treeContainsTag(child, tagName));
  }
  return false;
}

/**
 * 递归给指定标签的子节点注入属性
 */
function markNodesWithTag(node: any, tagName: string, propKey: string, propValue: string) {
  if (!node) return;
  if (node.tagName === tagName) {
    node.properties = node.properties || {};
    node.properties[propKey] = propValue;
  }
  if (node.children && Array.isArray(node.children)) {
    node.children.forEach((child: any) => markNodesWithTag(child, tagName, propKey, propValue));
  }
}

/**
 * 提取 GFM 表格列对齐（:--- 左对齐 / :---: 居中 / ---: 右对齐）。
 * react-markdown 将对齐信息放入单元格组件的 style prop；
 * 兜底再从 hast 节点的 properties.style 字符串中解析，确保 :---: 与 ---: 在预览中不丢失。
 */
function getCellAlignStyle(incomingStyle: any, node: any): CSSProperties {
  if (incomingStyle && typeof incomingStyle === 'object') {
    return incomingStyle as CSSProperties;
  }
  const raw = node?.properties?.style;
  if (typeof raw === 'string' && /text-align/i.test(raw)) {
    const match = raw.match(/text-align:\s*([a-z-]+)/i);
    if (match) {
      return { textAlign: match[1] as CSSProperties['textAlign'] };
    }
  }
  return {};
}

/**
 * URL 安全过滤：在 react-markdown 默认白名单基础上放行 data:image/（粘贴截图的 Base64 内嵌图）
 * 与 blob:（本地预览对象地址），其余协议仍交由默认过滤处理
 */
function imageUrlTransform(url: string): string {
  if (/^(?:data:image\/|blob:)/i.test(url)) {
    return url;
  }
  return defaultUrlTransform(url);
}

/**
 * Rehype 插件：识别分割线间距、图片段落、图片题注及多图并排画廊表格
 * 解决分割线垂直居中留白，并确保微信合规多形态图片排版与题注紧凑对齐
 */
function rehypeLayoutEnhancer() {
  return (tree: any) => {
    if (!tree || !tree.children) return;
    const elementChildren = tree.children.filter((c: any) => c.type === 'element');
    for (let i = 0; i < elementChildren.length; i++) {
      const prev = elementChildren[i - 1];
      const curr = elementChildren[i];
      const next = elementChildren[i + 1];

      // 1. 处理分割线相邻段落
      if (curr.tagName === 'p') {
        curr.properties = curr.properties || {};
        const afterHr = prev && prev.tagName === 'hr';
        const beforeHr = next && next.tagName === 'hr';

        if (afterHr) {
          curr.properties.dataAfterHr = 'true';
        }
        if (beforeHr) {
          curr.properties.dataBeforeHr = 'true';
        }
        if (afterHr && beforeHr) {
          curr.properties.dataBetweenHrs = 'true';
        }

        // 2. 检测是否为纯图片段落或单段图文
        const containsImg = treeContainsTag(curr, 'img');
        if (containsImg) {
          curr.properties.dataImageParagraph = 'true';

          // 若同一个段落中同时包含图片与后续题注文字/em（如 Markdown 中未空行），拆分为两个独立段落
          if (curr.children && Array.isArray(curr.children)) {
            const imgIdx = curr.children.findIndex(
              (c: any) => c.tagName === 'img' || treeContainsTag(c, 'img')
            );
            if (imgIdx !== -1) {
              const afterImgNodes = curr.children.slice(imgIdx + 1);
              const hasTrailingContent = afterImgNodes.some((c: any) => {
                if (c.type === 'text') return Boolean(c.value?.trim());
                return true;
              });

              if (hasTrailingContent) {
                // 将后续节点切出为一个独立的题注段落
                curr.children = curr.children.slice(0, imgIdx + 1);
                curr.properties.dataHasCaption = 'true';

                const captionNode = {
                  type: 'element',
                  tagName: 'p',
                  properties: {
                    dataImageCaption: 'true',
                  },
                  children: afterImgNodes,
                };

                const treeIdx = tree.children.indexOf(curr);
                if (treeIdx !== -1) {
                  tree.children.splice(treeIdx + 1, 0, captionNode);
                }
                elementChildren.splice(i + 1, 0, captionNode);
                continue;
              }
            }
          }
        }

        // 3. 检测是否为紧邻图片的题注段落
        const isPrevImg =
          prev &&
          (prev.tagName === 'img' ||
            prev.properties?.dataImageParagraph === 'true' ||
            prev.properties?.dataImageTable === 'true');
        const textContent = getNodeText(curr).trim();
        const isCaptionText =
          /^(?:▲\s*|\[)?(?:图|表|Figure|阶段)\s*[\dA-Za-z\-]+/i.test(textContent) ||
          textContent.startsWith('▲') ||
          /^(?:注|注\d+|※)[：:]/.test(textContent) ||
          (isPrevImg && (
            (curr.children?.some((c: any) => c.tagName === 'em') && textContent.length < 140) ||
            (textContent.length > 0 && textContent.length < 120 && !/[。！？]$/.test(textContent))
          ));

        if (isPrevImg && isCaptionText) {
          curr.properties.dataImageCaption = 'true';
          if (prev.properties) {
            prev.properties.dataHasCaption = 'true';
          }
          markNodesWithTag(prev, 'img', 'dataHasCaption', 'true');
        }
      }

      // 4. 检测是否为包含图片的并排画廊表格
      if (curr.tagName === 'table') {
        if (treeContainsTag(curr, 'img')) {
          curr.properties = curr.properties || {};
          curr.properties.dataImageTable = 'true';
          markNodesWithTag(curr, 'th', 'dataImageCell', 'true');
          markNodesWithTag(curr, 'td', 'dataImageCell', 'true');
          markNodesWithTag(curr, 'img', 'dataInsideCell', 'true');
        }
      }
    }
  };
}

export function MarkdownRenderer({ content, theme }: MarkdownRendererProps) {
  const { elements, h2Decoration, markHighlight } = theme;

  // 题注统一色：跟随主题的弱化文字色（td 单元格色优先，正文色兜底），暗色主题自动呈浅色、亮色主题呈深灰
  const captionColor = (elements.td?.color as string) || (elements.p?.color as string) || '#64748b';
  // 主题强调色（H3/链接色，响应主色搭配），用于白色衬底卡片上的题注
  const accentColor = (elements.h3?.color as string) || (elements.a?.color as string) || captionColor;

  const components: Components = {
    // 一级大标题：醒目、克制、大气通透，绝不附带无关字符
    h1: ({ children }) => <h1 style={elements.h1}>{children}</h1>,

    // 二级标题：根据风格进行纯 CSS 排版装饰，绝对不注入任何额外文字、符号或破折号
    h2: ({ children }) => {
      // 杂志/画廊/散文：横向延展贯穿纯 CSS 细线（左右两条 span 仅为线条，零文本内容）
      if (
        h2Decoration === 'magazine-centered' ||
        h2Decoration === 'gallery-line' ||
        h2Decoration === 'literary-dash'
      ) {
        const accent = (elements.h2.color as string) || '#881337';
        return (
          <h2
            style={{
              ...elements.h2,
              textAlign: 'center',
              lineHeight: 1.75,
            }}
          >
            <span
              style={{
                display: 'inline-block',
                verticalAlign: 'middle',
                width: '36px',
                height: '1px',
                backgroundColor: accent,
                opacity: 0.35,
                marginRight: '12px',
                userSelect: 'none',
              }}
            />
            <span
              style={{
                display: 'inline-block',
                verticalAlign: 'middle',
                lineHeight: 1.75,
              }}
            >
              {children}
            </span>
            <span
              style={{
                display: 'inline-block',
                verticalAlign: 'middle',
                width: '36px',
                height: '1px',
                backgroundColor: accent,
                opacity: 0.35,
                marginLeft: '12px',
                userSelect: 'none',
              }}
            />
          </h2>
        );
      }

      // 波普立体硬阴影徽章（纯 CSS 边框与阴影包裹标题文字，零附加字符）
      if (h2Decoration === 'pop-box') {
        return (
          <h2 style={{ ...elements.h2, textAlign: 'left', lineHeight: 1.75 }}>
            <span
              style={{
                display: 'inline-block',
                backgroundColor: '#fde047',
                color: '#000000',
                border: '2px solid #000000',
                padding: '4px 12px',
                boxShadow: '2.5px 2.5px 0px #000000',
                fontWeight: 800,
                fontSize: '17.5px',
                lineHeight: 1.75,
              }}
            >
              {children}
            </span>
          </h2>
        );
      }

      // 复古报纸横幅栏（上下横栏实线包裹，古典铅印大标题风格）
      if (h2Decoration === 'newspaper-banner') {
        return (
          <h2
            style={{
              ...elements.h2,
              textAlign: (elements.h2.textAlign as any) || 'center',
              lineHeight: 1.75,
              boxSizing: 'border-box',
            }}
          >
            {children}
          </h2>
        );
      }

      // 经典微胶囊小彩条（微信、新中式、商务、暗色极客等：空 span 纯背景色块，零文本内容）
      if (
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
        const accent = (elements.h2.color as string) || (elements.h1.color as string) || '#2563eb';
        return (
          <h2 style={{ ...elements.h2, textAlign: 'left', lineHeight: 1.75 }}>
            <span
              style={{
                display: 'inline-block',
                verticalAlign: 'middle',
                width: '4.5px',
                height: '18px',
                backgroundColor: accent,
                borderRadius: '2px',
                marginRight: '9px',
                userSelect: 'none',
              }}
            />
            <span
              style={{
                display: 'inline-block',
                verticalAlign: 'middle',
                lineHeight: 1.75,
              }}
            >
              {children}
            </span>
          </h2>
        );
      }

      return <h2 style={elements.h2}>{children}</h2>;
    },

    h3: ({ children }) => <h3 style={{ ...elements.h3, lineHeight: 1.75 }}>{children}</h3>,
    h4: ({ children }) => <h4 style={{ ...elements.h4, lineHeight: 1.75 }}>{children}</h4>,
    h5: ({ children }) => <h5 style={{ ...elements.h5, lineHeight: 1.75 }}>{children}</h5>,
    h6: ({ children }) => <h6 style={{ ...elements.h6, lineHeight: 1.75 }}>{children}</h6>,

    // 正文段落：原样保留用户文本，智能支持题注紧凑对齐与大图留白
    // 合并策略：用户原生 HTML 中显式写的内联样式（incomingStyle）优先于主题默认值，
    // 保证 <p style="text-align: center"> 等用户意图不被主题覆盖
    p: ({ node, style: incomingStyle, children }: any) => {
      const photoCardColor = React.useContext(PhotoCardColorContext);
      const isImageCaption = Boolean(node?.properties?.dataImageCaption);
      const isImageParagraph = Boolean(node?.properties?.dataImageParagraph);
      const hasCaption = Boolean(node?.properties?.dataHasCaption);
      const isBetweenHrs = Boolean(node?.properties?.dataBetweenHrs);
      const isBeforeHr = Boolean(node?.properties?.dataBeforeHr);
      const isAfterHr = Boolean(node?.properties?.dataAfterHr);

      // (1) 图片题注：紧凑居中、优雅小字、适度留白
      if (isImageCaption) {
        return (
          <p
            data-role="image-caption"
            style={{
              marginTop: '8px',
              marginBottom: '26px',
              textAlign: 'center',
              fontSize: '13px',
              lineHeight: 1.75,
              color: accentColor,
              fontStyle: 'normal',
              letterSpacing: '0.02em',
              boxSizing: 'border-box',
              maxWidth: '100%',
              wordBreak: 'break-word',
            }}
          >
            {children}
          </p>
        );
      }

      // (2) 纯图片容器段落：消除内部两端对齐与双重 margin
      if (isImageParagraph) {
        return (
          <p
            data-role="image-wrapper"
            style={{
              marginTop: '26px',
              marginBottom: hasCaption ? 0 : '26px',
              textAlign: 'center',
              boxSizing: 'border-box',
              maxWidth: '100%',
              lineHeight: 1.75,
            }}
          >
            {children}
          </p>
        );
      }

      // (3) 普通文字段落：核心修复 marginTop: 0 杜绝浏览器默认 1em 导致上方留白过大
      const marginTop = 0;
      const marginBottom = (isBetweenHrs || isBeforeHr) ? 0 : (elements.p.marginBottom ?? '18px');

      return (
        <p
          data-role={isBetweenHrs ? 'enclosed-quote' : undefined}
          data-between-hrs={isBetweenHrs ? 'true' : undefined}
          data-after-hr={isAfterHr ? 'true' : undefined}
          data-before-hr={isBeforeHr ? 'true' : undefined}
          style={{
            ...elements.p,
            ...(incomingStyle && typeof incomingStyle === 'object' ? incomingStyle : null),
            marginTop,
            marginBottom,
            wordBreak: 'break-word',
            boxSizing: 'border-box',
            // photo-card 白色卡片内的段落统一为题注规范：13px、居中、主题强调色、非斜体
            ...(photoCardColor
              ? { fontSize: '13px', color: photoCardColor, textAlign: 'center', fontStyle: 'normal', fontWeight: 500 }
              : null),
          }}
        >
          {children}
        </p>
      );
    },

    // 引用块：纯净排版格式，绝对不注入任何多余文字或冒名引号
    blockquote: ({ children }) => {
      return (
        <blockquote
          style={{
            ...elements.blockquote,
            boxSizing: 'border-box',
          }}
        >
          {children}
        </blockquote>
      );
    },

    ul: ({ children, node, className }: any) => {
      const isTaskList = className === 'contains-task-list' || node?.properties?.className?.includes('contains-task-list');
      return (
        <ul
          style={{
            listStyleType: (elements.ul?.listStyleType as string) || 'disc',
            paddingLeft: (elements.ul?.paddingLeft as string) || '24px',
            margin: (elements.ul?.margin as string) || '16px 0',
            ...elements.ul,
            ...(isTaskList ? { listStyleType: 'none', paddingLeft: '8px' } : {})
          }}
        >
          {children}
        </ul>
      );
    },
    ol: ({ children, start }: any) => (
      <ol
        start={start}
        style={{
          listStyleType: (elements.ol?.listStyleType as string) || 'decimal',
          paddingLeft: (elements.ol?.paddingLeft as string) || '24px',
          margin: (elements.ol?.margin as string) || '16px 0',
          ...elements.ol,
        }}
      >
        {children}
      </ol>
    ),
    li: ({ children }) => {
      const childArray = React.Children.toArray(children);
      const processedChildren: React.ReactNode[] = [];

      for (let i = 0; i < childArray.length; i++) {
        const curr = childArray[i];
        const next = childArray[i + 1];

        // 检查加粗节点后是否紧跟冒号或标点符号
        if (React.isValidElement(curr) && typeof next === 'string') {
          const colonMatch = next.match(/^[\s\u00A0]*([:：\-—–]+)[\s\u00A0]*/);
          if (colonMatch) {
            let punct = colonMatch[1];
            if (punct === ':' || punct === '：') punct = '：';
            else if (punct === '-') punct = ' — ';

            const remainingText = next.slice(colonMatch[0].length);

            processedChildren.push(
              <span key={`atomic-grp-${i}`} style={{ display: 'inline', whiteSpace: 'nowrap' }}>
                {curr}
                <span style={{ fontWeight: 700, color: (elements.strong?.color as string) || '#0f172a' }}>
                  {punct}
                </span>
              </span>
            );
            if (remainingText) {
              processedChildren.push(<span key={`leaf-rem-${i}`}>{remainingText}</span>);
            }
            i++;
            continue;
          }
        }
        processedChildren.push(curr);
      }

      return (
        <li
          style={{
            lineHeight: 1.75,
            marginBottom: '8px',
            ...elements.li,
          }}
          className="[&>p:last-child]:mb-0"
        >
          {processedChildren}
        </li>
      );
    },

    a: ({ children, href }) => (
      <a href={href ?? '#'} style={elements.a} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    ),

    strong: ({ children }) => {
      const style = markHighlight ? { ...elements.strong, ...markHighlight } : elements.strong;
      return <strong style={{ ...style, display: 'inline', wordBreak: 'break-word' }}>{children}</strong>;
    },

    em: ({ children }) => <em style={elements.em}>{children}</em>,

    del: ({ children }) => (
      <del style={{ textDecoration: 'line-through', color: '#94a3b8' }}>{children}</del>
    ),

    input: ({ checked, ...props }) => {
      const accent = (elements.h1?.color as string) || '#2563eb';
      if (props.type === 'checkbox') {
        if (checked) {
          return (
            <span
              style={{
                display: 'inline-block',
                width: '15px',
                height: '15px',
                lineHeight: '15px',
                textAlign: 'center',
                backgroundColor: accent,
                color: '#ffffff',
                borderRadius: '3px',
                fontSize: '11px',
                marginRight: '7px',
                verticalAlign: 'middle',
                fontWeight: 'bold',
                userSelect: 'none',
              }}
            >
              ✓
            </span>
          );
        }
        return (
          <span
            data-role="task-checkbox"
            style={{
              display: 'inline-block',
              width: '15px',
              height: '15px',
              lineHeight: '15px',
              textAlign: 'center',
              border: '1.5px solid #cbd5e1',
              borderRadius: '3px',
              fontSize: '11px',
              marginRight: '7px',
              verticalAlign: 'middle',
              boxSizing: 'border-box',
              color: 'transparent',
              userSelect: 'none',
            }}
          >
            □
          </span>
        );
      }
      return <input checked={checked} {...props} />;
    },

    pre: ({ children }: any) => {
      return (
        <section data-role="code-block" data-ignore-width="" style={{ margin: '24px 0', overflowX: 'auto' as const, WebkitOverflowScrolling: 'touch' as any }}>
          <pre style={{ ...elements.pre, margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
            {children}
          </pre>
        </section>
      );
    },

    code: ({ className, children, node, ...props }: any) => {
      const isCodeBlock =
        className?.startsWith('language-') ||
        (typeof children === 'string' && children.includes('\n'));
      // If inside a pre (code block), just render the code with minimal styling
      if (isCodeBlock) {
        return (
          <code style={{ fontFamily: 'inherit', fontSize: 'inherit', backgroundColor: 'transparent', padding: 0 }}>
            {children}
          </code>
        );
      }
      // Inline code
      return <code style={elements.code}>{children}</code>;
    },

    // 图片：合并用户原生 HTML 中显式写的内联样式（优先），避免主题 margin 覆盖用户排版意图
    img: ({ src, alt, node, style: incomingStyle }: any) => {
      const isInsideCell = Boolean(node?.properties?.dataInsideCell);
      const hasCaption = Boolean(node?.properties?.dataHasCaption);
      const userStyle = incomingStyle && typeof incomingStyle === 'object' ? incomingStyle : null;
      return (
        <img
          src={src ?? ''}
          alt={alt ?? '配图'}
          data-w="1080"
          data-ratio="auto"
          referrerPolicy="no-referrer"
          loading="lazy"
          onError={(e) => {
            const target = e.currentTarget;
            if (!target.dataset.hasFailed) {
              target.dataset.hasFailed = 'true';
              target.alt = alt || '图片加载失败';
            }
          }}
          style={{
            maxWidth: '100%',
            height: 'auto',
            display: 'block',
            boxSizing: 'border-box',
            ...elements.img,
            ...userStyle,
            ...(isInsideCell
              ? { margin: '0 auto', width: '100%', aspectRatio: '4 / 3', objectFit: 'cover' }
              : hasCaption
              ? { marginBottom: 0 }
              : {}),
          }}
        />
      );
    },

    // 分割线：纯 CSS 实体分割线，绝不注入文字表情或装饰符号
    hr: () => (
      <hr
        style={{
          ...elements.hr,
          width: elements.hr.width || '100%',
          maxWidth: '100%',
          boxSizing: 'border-box',
        }}
      />
    ),

    // 自定义 HTML 卡片（photo-card）：宽度与正文对齐，并为内部题注提供主题强调色上下文
    section: ({ node, style: incomingStyle, children }: any) => {
      const role = node?.properties?.dataRole;
      const userStyle = incomingStyle && typeof incomingStyle === 'object' ? incomingStyle : null;
      if (role === 'photo-card') {
        return (
          <PhotoCardColorContext.Provider value={accentColor}>
            <section
              data-role="photo-card"
              style={{ ...userStyle, margin: userStyle?.margin || '20px auto', maxWidth: '100%' }}
            >
              {children}
            </section>
          </PhotoCardColorContext.Provider>
        );
      }
      return <section style={userStyle}>{children}</section>;
    },

    table: ({ node, children }: any) => {
      const isImageTable = Boolean(node?.properties?.dataImageTable);
      if (isImageTable) {
        return (
          <section
            data-role="image-gallery"
            data-ignore-width=""
            style={{ width: '100%', margin: '24px 0', boxSizing: 'border-box' }}
          >
            <table
              style={{
                width: '100%',
                tableLayout: 'fixed',
                borderCollapse: 'collapse',
                border: 'none',
                background: 'transparent',
                margin: 0,
              }}
            >
              {children}
            </table>
          </section>
        );
      }

      return (
        <section
          data-role="table-wrapper"
          data-ignore-width=""
          style={{ overflowX: 'auto', margin: '24px 0', width: '100%', WebkitOverflowScrolling: 'touch' }}
        >
          <table style={{ ...elements.table, width: '100%', borderCollapse: 'collapse' }}>{children}</table>
        </section>
      );
    },

    th: ({ node, style: incomingAlign, children }: any) => {
      const isImageCell = Boolean(node?.properties?.dataImageCell);
      if (isImageCell) {
        return (
          <th
            style={{
              border: 'none',
              background: 'transparent',
              padding: '0 4px',
              verticalAlign: 'top',
              textAlign: 'center',
              fontWeight: 'normal',
              fontStyle: 'normal',
              fontSize: '13px',
              lineHeight: 1.75,
              color: accentColor,
              letterSpacing: '0.02em',
              boxSizing: 'border-box',
            }}
          >
            {children}
          </th>
        );
      }
      return <th style={{ ...elements.th, ...getCellAlignStyle(incomingAlign, node), lineHeight: 1.75 }}>{children}</th>;
    },

    td: ({ node, style: incomingAlign, children }: any) => {
      const isImageCell = Boolean(node?.properties?.dataImageCell);
      if (isImageCell) {
        return (
          <td
            style={{
              border: 'none',
              background: 'transparent',
              padding: '6px 4px 0 4px',
              verticalAlign: 'top',
              textAlign: 'center',
              fontStyle: 'normal',
              fontSize: '13px',
              lineHeight: 1.75,
              color: accentColor,
              letterSpacing: '0.02em',
              boxSizing: 'border-box',
            }}
          >
            {children}
          </td>
        );
      }
      return <td style={{ ...elements.td, ...getCellAlignStyle(incomingAlign, node), lineHeight: 1.75 }}>{children}</td>;
    },

    // 微信角标/脚注引用上标（规范 1.3: 继承行高，使用 baseline + relative 位移）
    sup: ({ children }) => (
      <sup
        style={{
          fontSize: '11px',
          fontWeight: 700,
          color: (elements.a.color as string) || '#2563eb',
          marginLeft: '2px',
          padding: '0 1px',
          verticalAlign: 'baseline',
          position: 'relative',
          top: '-0.35em',
          lineHeight: 'inherit',
        }}
      >
        {children}
      </sup>
    ),
  };

  return (
    <div>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw, rehypeLayoutEnhancer]}
        urlTransform={imageUrlTransform}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
