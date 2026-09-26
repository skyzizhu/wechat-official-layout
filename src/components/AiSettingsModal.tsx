'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { AiSettings } from '@/lib/ai-enhance';

interface AiSettingsModalProps {
  isOpen: boolean;
  settings: AiSettings;
  onClose: () => void;
  onSave: (settings: AiSettings) => void;
}

export function AiSettingsModal({ isOpen, settings, onClose, onSave }: AiSettingsModalProps) {
  const [draft, setDraft] = useState<AiSettings>(settings);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl w-[92%] max-w-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
          <h3 className="font-semibold text-gray-800">AI 增强识别设置</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3 text-sm">
          <p className="text-xs text-gray-500 leading-relaxed">
            配置任意 OpenAI 兼容接口（/chat/completions）。启用后点击「AI 排版」，系统会将纯文本发给
            AI 按本系统的排版约定直接转换为 Markdown；未配置或请求失败时自动回退到内置智能识别。
          </p>
          <label className="block">
            <span className="text-gray-600">接口地址（完整 /chat/completions URL）</span>
            <input
              value={draft.endpoint}
              onChange={(e) => setDraft({ ...draft, endpoint: e.target.value })}
              placeholder="https://api.openai.com/v1/chat/completions"
              className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
            />
          </label>
          <label className="block">
            <span className="text-gray-600">API Key</span>
            <input
              type="password"
              value={draft.apiKey}
              onChange={(e) => setDraft({ ...draft, apiKey: e.target.value })}
              placeholder="sk-..."
              className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
            />
          </label>
          <label className="block">
            <span className="text-gray-600">模型名</span>
            <input
              value={draft.model}
              onChange={(e) => setDraft({ ...draft, model: e.target.value })}
              placeholder="gpt-4o-mini"
              className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
            />
          </label>
          <p className="text-[11px] text-gray-400">
            密钥仅保存在本浏览器 LocalStorage，随请求发送给你配置的接口地址；请勿填写不受信任的第三方地址。
          </p>
        </div>

        <div className="flex justify-end gap-2 px-5 py-3 border-t border-gray-200">
          <button onClick={onClose} className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg cursor-pointer">
            取消
          </button>
          <button
            onClick={() => {
              onSave(draft);
              onClose();
            }}
            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
}
