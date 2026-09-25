import { toPng } from 'html-to-image';
import { copyHighFidelityRichText } from './rich-text-serializer';
import type { ThemePreset } from '@/themes/types';

/**
 * 复制带完整内联样式的富文本到剪贴板
 * 深度适配微信公众号后台、知乎、邮件、飞书等平台，格式 100% 还原，绝不错乱
 */
export async function copyRichText(
  element: HTMLElement,
  theme?: ThemePreset,
  currentColor?: string
): Promise<void> {
  return copyHighFidelityRichText(element, theme, currentColor);
}

/**
 * 导出为 PNG 高清长图 (2x 像素密度)
 * 彻底解决：
 * 1. 元素居中时因 margin: auto 计算出的 margin-left 像素偏移，导致图片左边留白、右边被裁切的问题
 * 2. 导出时尺寸仅为可视区域而非完整滚动内容的问题
 * 3. 跨域字体 SecurityError
 * 4. 非白色背景主题（暗色极客、宣纸、科技等）导出白底的问题
 */
export async function exportAsImage(
  element: HTMLElement,
  filename: string = 'article'
): Promise<void> {
  // 1. 等待所有图片加载完毕
  const images = Array.from(element.querySelectorAll('img'));
  await Promise.all(
    images.map((img) => {
      if (img.complete) return Promise.resolve();
      return new Promise((resolve) => {
        img.onload = resolve;
        img.onerror = resolve;
      });
    })
  );

  // 2. 精确获取版心真实的物理尺寸与全部滚动高度
  const rect = element.getBoundingClientRect();
  const computedStyle = window.getComputedStyle(element);

  const leftBorder = parseFloat(computedStyle.borderLeftWidth) || 0;
  const rightBorder = parseFloat(computedStyle.borderRightWidth) || 0;
  const topBorder = parseFloat(computedStyle.borderTopWidth) || 0;
  const bottomBorder = parseFloat(computedStyle.borderBottomWidth) || 0;

  // 目标宽度：精确包含内边距和边框的卡片自身宽度（排除外部 margin）
  const targetWidth = Math.round(
    element.offsetWidth || (element.clientWidth + leftBorder + rightBorder) || rect.width || 720
  );

  // 目标高度：长文完整高度（即使处于滚动容器内也能完整渲染）
  const targetHeight = Math.round(
    Math.max(element.offsetHeight, element.scrollHeight + topBorder + bottomBorder)
  );

  // 3. 提取卡片真实背景色
  let bg = computedStyle.backgroundColor;
  if (!bg || bg === 'transparent' || bg === 'rgba(0, 0, 0, 0)') {
    bg = '#ffffff';
  }

  // 4. 调用 html-to-image 生成高清 2x 长图
  const dataUrl = await toPng(element, {
    quality: 1.0,
    pixelRatio: 2,
    backgroundColor: bg,
    skipFonts: true,
    width: targetWidth,
    height: targetHeight,
    canvasWidth: targetWidth,
    canvasHeight: targetHeight,
    style: {
      // 强制重置所有外边距为 0，确保克隆节点在 (0, 0) 处精确对齐，绝不向右偏移
      margin: '0',
      marginLeft: '0',
      marginRight: '0',
      marginTop: '0',
      marginBottom: '0',
      transform: 'none',
      left: '0',
      top: '0',
      position: 'static',
      width: `${targetWidth}px`,
      maxWidth: `${targetWidth}px`,
      minWidth: `${targetWidth}px`,
      height: `${targetHeight}px`,
      boxShadow: 'none', // 导出长图时去除浏览器网页阴影，保持画面边缘干练整洁
    },
  });

  const link = document.createElement('a');
  link.download = `${filename}.png`;
  link.href = dataUrl;
  link.click();
}
