/**
 * 轻量访问统计 v2：同域图片信标（1px gif）+ 内容捕获（sendBeacon POST）
 * 接口与后台见 server/analytics/README.md（部署在站点 /analytics/ 目录）。
 *
 * 身份识别（全部匿名，不含个人信息）：
 *   uid — localStorage 随机 id，跨回访稳定；
 *   fp  — 浏览器指纹（UA/语言/时区/屏幕/canvas 绘制哈希的 SHA-256 前 16 位），
 *         辅助区分「清了 localStorage 的同一浏览器」；
 *   sid — sessionStorage 随机 id，一次访问会话（关标签页即新会话）。
 *
 * 隐私：仅生产域名发送；本地/内网开发自动静默；统计失败永不影响主功能。
 */
const ENDPOINT = '/analytics';
const UID_KEY = 'wp_uid';
const SID_KEY = 'wp_sid';

function isProdHost(): boolean {
  if (typeof window === 'undefined') return false;
  const h = window.location.hostname;
  return !/^(localhost|0\.0\.0\.0|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(h);
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** localStorage 随机访客 id */
function uid(): string {
  try {
    let id = localStorage.getItem(UID_KEY);
    if (!id || !/^[a-f0-9]{8,32}$/.test(id)) {
      const b = new Uint8Array(8);
      crypto.getRandomValues(b);
      id = Array.from(b)
        .map((x) => x.toString(16).padStart(2, '0'))
        .join('');
      localStorage.setItem(UID_KEY, id);
    }
    return id;
  } catch {
    return 'anonymous00000000';
  }
}

/** 会话 id（sessionStorage，标签页内稳定） */
function sid(): string {
  try {
    let id = sessionStorage.getItem(SID_KEY);
    if (!id || !/^[a-f0-9]{8,32}$/.test(id)) {
      const b = new Uint8Array(8);
      crypto.getRandomValues(b);
      id = Array.from(b)
        .map((x) => x.toString(16).padStart(2, '0'))
        .join('');
      sessionStorage.setItem(SID_KEY, id);
    }
    return id;
  } catch {
    return '';
  }
}

/** 浏览器指纹：环境特征 + canvas 绘制哈希（异步，首帧计算一次后缓存） */
let fpPromise: Promise<string> | null = null;
function fingerprint(): Promise<string> {
  if (fpPromise) return fpPromise;
  fpPromise = (async () => {
    try {
      const nav = navigator as Navigator & { deviceMemory?: number };
      const parts = [
        navigator.userAgent,
        navigator.language,
        (navigator.languages || []).join(','),
        Intl.DateTimeFormat().resolvedOptions().timeZone || '',
        `${screen.width}x${screen.height}x${screen.colorDepth}`,
        nav.hardwareConcurrency || 0,
        navigator.platform || '',
        new Date().getTimezoneOffset(),
      ];
      // canvas 指纹：同一浏览器渲染结果稳定，跨浏览器差异大
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 200;
        canvas.height = 40;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.textBaseline = 'top';
          ctx.font = "14px 'Arial'";
          ctx.fillStyle = '#f60';
          ctx.fillRect(0, 0, 100, 20);
          ctx.fillStyle = '#06f';
          ctx.fillText('文排,waroom;wp-1.0', 2, 15);
          ctx.strokeStyle = 'rgba(102,204,0,0.7)';
          ctx.arc(50, 20, 18, 0, Math.PI * 2);
          ctx.stroke();
          parts.push(canvas.toDataURL().slice(-64));
        }
      } catch {
        /* canvas 被禁用则跳过该分量 */
      }
      const hex = await sha256Hex(parts.join('|'));
      return hex.slice(0, 16);
    } catch {
      return '';
    }
  })();
  return fpPromise;
}

function beaconImage(query: URLSearchParams): void {
  const img = new Image();
  img.src = `${ENDPOINT}/track.php?${query.toString()}`;
}

/** 上报事件：pv / copy（extra=字数档位）/ theme（extra=主题id）/ export_md */
export function trackEvent(event: 'pv' | 'copy' | 'theme' | 'export_md', extra = ''): void {
  if (!isProdHost()) return;
  const q = new URLSearchParams({ e: event, uid: uid(), sid: sid(), p: window.location.pathname });
  if (extra) q.set('x', extra.slice(0, 64));
  fingerprint()
    .then((fp) => {
      if (fp) q.set('fp', fp);
      beaconImage(q);
    })
    .catch(() => beaconImage(q));
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

/**
 * 内容捕获：用户显式复制/导出时，把作品全文匿名入库（服务端 capture_content 开关控制）。
 * sendBeacon 优先（页面关闭也能发出），超大内容或失败时回退 fetch keepalive。
 */
export function captureContent(event: 'copy' | 'export_md', content: string): void {
  if (!isProdHost() || !content.trim()) return;
  const payload = {
    uid: uid(),
    sid: sid(),
    event,
    content: content.slice(0, 60000),
  };
  try {
    const body = new Blob([JSON.stringify(payload)], { type: 'text/plain;charset=UTF-8' });
    if (navigator.sendBeacon && navigator.sendBeacon(`${ENDPOINT}/capture.php`, body)) return;
    throw new Error('sendBeacon unavailable');
  } catch {
    try {
      fetch(`${ENDPOINT}/capture.php`, {
        method: 'POST',
        body: JSON.stringify(payload),
        keepalive: true,
        headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      }).catch(() => {});
    } catch {
      /* 静默 */
    }
  }
}
