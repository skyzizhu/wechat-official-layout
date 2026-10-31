/**
 * 轻量访问统计：同域图片信标（1px gif），无 CORS/预检问题，微信 WebView 兼容。
 * 接口与后台见 server/analytics/README.md（部署在站点 /analytics/ 目录）。
 *
 * 隐私：不带任何个人信息；uid 是 localStorage 里随机生成的匿名 id；
 * 仅生产域名发送，本地/内网开发自动静默。
 */
const ENDPOINT = '/analytics/track.php';

function isProdHost(): boolean {
  if (typeof window === 'undefined') return false;
  const h = window.location.hostname;
  return !/^(localhost|0\.0\.0\.0|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(h);
}

function uid(): string {
  try {
    let id = localStorage.getItem('wp_uid');
    if (!id || !/^[a-f0-9]{8,32}$/.test(id)) {
      const b = new Uint8Array(8);
      crypto.getRandomValues(b);
      id = Array.from(b)
        .map((x) => x.toString(16).padStart(2, '0'))
        .join('');
      try {
        localStorage.setItem('wp_uid', id);
      } catch {
        /* 隐私模式写入失败：本次用临时 id */
      }
    }
    return id;
  } catch {
    return 'anonymous00000000';
  }
}

/** 上报事件：pv（页面浏览）/ copy（一键复制，extra=字数档位）/ theme（主题切换，extra=主题id）/ export_md */
export function trackEvent(event: 'pv' | 'copy' | 'theme' | 'export_md', extra = ''): void {
  if (!isProdHost()) return;
  try {
    const q = new URLSearchParams({ e: event, uid: uid(), p: window.location.pathname });
    if (extra) q.set('x', extra.slice(0, 64));
    const img = new Image();
    img.src = `${ENDPOINT}?${q.toString()}`;
  } catch {
    /* 统计永不影响主功能 */
  }
}

export function trackPageView(): void {
  trackEvent('pv');
}

/** copy 事件的字数分档，避免上报精确字数 */
export function lengthBucket(chars: number): string {
  if (chars <= 500) return 'le500';
  if (chars <= 2000) return 'le2000';
  if (chars <= 5000) return 'le5000';
  return 'gt5000';
}
