import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '页面不存在 · 文排',
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 text-center px-6">
      <div className="text-5xl font-bold tracking-tight bg-gradient-to-r from-gray-900 via-gray-800 to-gray-500 bg-clip-text text-transparent">
        404
      </div>
      <p className="text-gray-500">你要找的页面不存在，可能已被移动或删除。</p>
      <a
        href="/"
        className="mt-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors"
      >
        返回首页
      </a>
    </div>
  );
}
