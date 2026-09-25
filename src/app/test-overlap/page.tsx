'use client';

import React, { useEffect, useState, useRef } from 'react';
import { SAMPLE_MARKDOWN } from '@/lib/sample-markdown';
import { processContentByMode } from '@/lib/smart-parser';
import { convertLinksToFootnotes } from '@/lib/link-footnotes';
import { getThemeById, DEFAULT_THEME_ID, applyFontSizeToTheme } from '@/themes';
import { serializeToWeChatRichText } from '@/lib/rich-text-serializer';
import { MarkdownRenderer } from '@/components/MarkdownRenderer';

// Official WeChat getParaList
const blockEleTagName = ['P', 'DIV', 'SECTION', 'LI', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'TABLE', 'WX-VIEW'];
const canNotSplitEleClassName = ['js_product_container', 'js_blockquote_wrap'];
const canNotSplitEleTagName = ['BLOCKQUOTE'];
const selfTagName = ['HR', 'IMG'];

interface GetParaListOpts {
  getNestedStructure?: boolean;
  isMarkNode?: (node: any) => boolean;
  ignoreFlexChildren?: boolean;
  ignoreNotWriteableChildren?: boolean;
  getSpan?: boolean;
  [key: string]: unknown;
}

function childNodesHasBlockEle(element: any, opts: GetParaListOpts): boolean {
  if (!element || element.nodeType !== 1) return false;
  for (let i = 0, len = element.children.length; i < len; i++) {
    if (
      blockEleTagName.indexOf(element.children[i].tagName) !== -1 ||
      (opts.getSpan &&
        element.children[i].tagName === 'SPAN' &&
        (childNodesHasBlockEle(element.children[i], opts) || element.children[i].querySelector('br') !== null))
    ) {
      return true;
    }
  }
  return false;
}

function isNotSplitEle(ele: any, opts: GetParaListOpts): boolean {
  for (let i = 0; i < canNotSplitEleClassName.length; i++) {
    if (ele.className && ele.className.indexOf(canNotSplitEleClassName[i]) > -1) return true;
  }
  if (
    (opts.ignoreFlexChildren &&
      ele.style.display === 'flex' &&
      (ele.style.flexDirection === 'row' || ele.style.flexDirection === 'row-reverse') &&
      ele.children.length > 1) ||
    (opts.ignoreNotWriteableChildren &&
      (ele.getAttribute('contenteditable') === 'false' ||
        (ele.childNodes.length === 1 && ele.childNodes[0].getAttribute('contenteditable') === 'false')))
  ) {
    return true;
  }
  return canNotSplitEleTagName.indexOf(ele.tagName) > -1;
}

function getParaList(element: any, opts: GetParaListOpts = {}, isRoot = true): any[] {
  const children = element.children;
  if (!children || !children.length) return children ? Array.from(children) : [];

  let child: any;
  let paragraphList: any[] = [];
  for (let i = 0; i < children.length; i++) {
    child = children[i];
    child.isWrapper = undefined;

    if (opts && opts.isMarkNode && opts.isMarkNode(child)) continue;

    if (childNodesHasBlockEle(child, opts) && !isNotSplitEle(child, opts)) {
      paragraphList = paragraphList.concat(getParaList(child, opts, false));
      if (opts.getNestedStructure && child.tagName !== 'SPAN') {
        child.isWrapper = true;
        paragraphList.push(child);
      }
    } else if (opts.getSpan && child.querySelector('br') !== null) {
      let pushed = false;
      Array.prototype.forEach.call(child.querySelectorAll('br'), (br: any) => {
        let currentNode = br;
        let parentNode = br.parentNode;
        while (parentNode.tagName === 'SPAN' && currentNode === parentNode.lastChild) {
          currentNode = parentNode;
          parentNode = parentNode.parentNode;
        }
        if (parentNode.tagName === 'SPAN' || (parentNode.tagName !== 'SPAN' && currentNode !== parentNode.lastChild)) {
          paragraphList.push(br);
          pushed = true;
        }
      });
      if (child.tagName !== 'SPAN') {
        if (pushed === false) {
          paragraphList.push(child);
        } else if (opts.getNestedStructure) {
          child.isWrapper = true;
          paragraphList.push(child);
        }
      }
    } else if (!opts.getSpan || (opts.getSpan && child.tagName !== 'SPAN' && selfTagName.indexOf(child.tagName) === -1)) {
      paragraphList.push(child);
    }
  }
  return paragraphList;
}

function detectLineHeightOverlap(node: any): {
  fontSize: number;
  lineHeight: number;
  lineCount: number;
  contentHeight: number;
  overlapping: boolean;
  rects: { top: number; bottom: number; left: number; right: number; width: number; height: number }[];
} {
  const cs = window.getComputedStyle(node);
  const fontSize = parseFloat(cs.fontSize);
  const lhRaw = cs.lineHeight;
  const lineHeight = lhRaw === 'normal' ? fontSize * 1.2 : parseFloat(lhRaw);

  const range = document.createRange();
  range.selectNodeContents(node);
  const clientRects = Array.from(range.getClientRects()).filter((r: any) => r.height > 0);
  const lineCount = clientRects.length;
  const contentHeight = range.getBoundingClientRect().height;

  let overlapping = false;
  if (Number.isFinite(lineHeight) && lineHeight === 0) {
    overlapping = true; // Rule A
  } else if (lineCount >= 2) {
    const avgLineHeight = contentHeight / lineCount;
    overlapping = avgLineHeight < fontSize * 0.95; // Rule B
  }

  return {
    fontSize,
    lineHeight,
    lineCount,
    contentHeight,
    overlapping,
    rects: clientRects.map((r: any) => ({
      top: r.top,
      bottom: r.bottom,
      left: r.left,
      right: r.right,
      width: r.width,
      height: r.height,
    })),
  };
}

function collectLineHeightFallback(sandbox: HTMLElement): any[] {
  const blockTags = new Set(['p', 'div', 'section', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'td', 'a']);
  const items: any[] = [];

  sandbox.querySelectorAll('*').forEach((node: any) => {
    const tag = node.tagName.toLowerCase();
    if (!blockTags.has(tag)) return;
    const hasDirectText = Array.from(node.childNodes).some(
      (c: any) => c.nodeType === 3 && c.textContent.trim().length > 0
    );
    if (!hasDirectText) return;

    const text = (node.textContent || '').trim().replace(/\s+/g, ' ');
    if (!text.length) return;

    const m = detectLineHeightOverlap(node);
    if (m.overlapping) {
      items.push({
        tag,
        node,
        fontSize: m.fontSize,
        lineHeight: m.lineHeight,
        elementHeight: node.getBoundingClientRect().height,
        estLines: m.lineCount,
        text: text.slice(0, 60),
        outerHTML: node.outerHTML.slice(0, 160),
        measurement: m,
      });
    }
  });

  return items;
}

export default function TestOverlapPage() {
  const previewRef = useRef<HTMLDivElement>(null);
  const [report, setReport] = useState<any>(null);

  const rawTheme = getThemeById(DEFAULT_THEME_ID);
  const theme = applyFontSizeToTheme(rawTheme, '15');

  const rawResult = processContentByMode(SAMPLE_MARKDOWN, 'auto', {
    treatFirstLineAsTitle: false,
  });
  const withFootnotes = convertLinksToFootnotes(rawResult.renderedMarkdown, true);

  useEffect(() => {
    if (!previewRef.current) return;

    // Serialize to WeChat HTML
    const serializedHtml = serializeToWeChatRichText(previewRef.current, theme);

    // Run official WeChat validator flow
    const screenConfigs = [
      { width: 585, style: '585px' },
      { width: 677, style: '677px' },
      { width: 375, style: '375px' },
    ];

    const screenFindings: Record<string, any[]> = {};
    const fallbackFindings: any[] = [];

    // Create container
    const sandbox = document.createElement('div');
    sandbox.style.position = 'absolute';
    sandbox.style.left = '-9999px';
    sandbox.style.top = '0';
    sandbox.innerHTML = serializedHtml;
    document.body.appendChild(sandbox);

    const paraList = getParaList(sandbox, {});

    // Collect candidates exactly like collect.ts
    const invalidNodes: any[] = [];
    paraList.forEach((pNode: any, paragraphIndex: number) => {
      const q: any[] = [pNode];
      let lastNodeWithText: any = null;

      while (q.length) {
        const n = q.shift();
        const tag = n.tagName ? n.tagName.toLowerCase() : '';
        if (tag !== 'svg') {
          const text = (n.textContent || '').replace(/\s+/g, '');
          if (text) {
            lastNodeWithText = n;
          }
        }
        Array.from(n.children || []).forEach((c) => q.push(c));
      }

      if (lastNodeWithText) {
        const violationId = `violation-${paragraphIndex}`;
        lastNodeWithText.setAttribute('data-violation-id', violationId);
        invalidNodes.push({
          paragraphIndex,
          node: lastNodeWithText,
          violationId,
          outerHTML: lastNodeWithText.outerHTML.slice(0, 160),
        });
      }
    });

    // Check fallback items under first screen
    sandbox.style.width = '585px';
    const fallbacks = collectLineHeightFallback(sandbox);
    fallbackFindings.push(...fallbacks);

    // Screen tests
    screenConfigs.forEach((cfg) => {
      sandbox.style.width = cfg.style;

      invalidNodes.forEach((nodeInfo) => {
        const cloned = sandbox.querySelector(`[data-violation-id="${nodeInfo.violationId}"]`);
        if (!cloned) return;
        const m = detectLineHeightOverlap(cloned);

        if (!screenFindings[nodeInfo.violationId]) {
          screenFindings[nodeInfo.violationId] = [];
        }
        screenFindings[nodeInfo.violationId].push({
          paragraphIndex: nodeInfo.paragraphIndex,
          idx1Based: nodeInfo.paragraphIndex + 1,
          tag: cloned.tagName,
          screenWidth: cfg.width,
          isOverlapping: m.overlapping,
          measurement: m,
          outerHTML: nodeInfo.outerHTML,
          text: (cloned.textContent || '').slice(0, 40),
        });
      });
    });

    // Aggregate official issues
    const officialLineHeightViolations: any[] = [];
    Object.entries(screenFindings).forEach(([vId, findings]) => {
      const isInvalid = findings.some((f) => f.isOverlapping);
      if (isInvalid) {
        officialLineHeightViolations.push({
          violationId: vId,
          paragraphIndex: findings[0].paragraphIndex,
          idx1Based: findings[0].idx1Based,
          tag: findings[0].tag,
          text: findings[0].text,
          outerHTML: findings[0].outerHTML,
          screenFindings: findings,
        });
      }
    });

    document.body.removeChild(sandbox);

    const summary = {
      totalParas: paraList.length,
      officialLineHeightViolations,
      fallbackViolations: fallbackFindings,
      totalViolations: officialLineHeightViolations.length + fallbackFindings.length,
      para35: invalidNodes[35],
      para36: invalidNodes[36],
      paraListSummary: paraList.map((p: any, idx: number) => ({
        idx1Based: idx + 1,
        idx0Based: idx,
        tag: p.tagName,
        text: (p.textContent || '').trim().slice(0, 40),
      })),
    };

    setReport(summary);
    console.log('OFFICIAL_VALIDATOR_SUMMARY:', JSON.stringify(summary));
  }, []);

  return (
    <div style={{ padding: 20 }}>
      <h1>WeChat Official Validator Test</h1>
      <div style={{ display: 'none' }}>
        <div ref={previewRef} style={{ ...theme.container, margin: 0 }}>
          <MarkdownRenderer content={withFootnotes.content} theme={theme} />
        </div>
      </div>

      <div id="results">
        {report ? (
          <div>
            <h2>Total Paragraphs: {report.totalParas}</h2>
            <h2>Official Line-Height Violations: {report.officialLineHeightViolations.length}</h2>
            <h2>Fallback Violations: {report.fallbackViolations.length}</h2>
            <pre id="official-violations-json">
              {JSON.stringify(report.officialLineHeightViolations, null, 2)}
            </pre>
            <pre id="fallback-violations-json">
              {JSON.stringify(report.fallbackViolations, null, 2)}
            </pre>
          </div>
        ) : (
          <p>Loading...</p>
        )}
      </div>
    </div>
  );
}
