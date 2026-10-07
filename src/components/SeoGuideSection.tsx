'use client';

import React, { useState } from 'react';
import { Sparkles, CheckCircle2, ShieldCheck, Palette, FileText, HelpCircle, X, ChevronRight } from 'lucide-react';
import { WenPaiLogo } from '@/components/WenPaiLogo';

interface SeoGuideSectionProps {
  isOpen?: boolean;
  onClose?: () => void;
}

/**
 * 搜索引擎优化 (SEO) 与用户排版指南组件：
 * 1. 包含完整的语义化 H2、H3、列表与 FAQ 问答，被百度/谷歌/AI搜索引擎 100% 静态抓取；
 * 2. 对真实用户提供随时可呼出的排版技巧与常见问题抽屉，不挤占主编辑画布。
 */
export function SeoGuideSection({ isOpen = false, onClose }: SeoGuideSectionProps) {
  return (
    <>
      {/* 供搜索引擎爬虫与屏幕阅读器无障碍抓取的底层语义结构（在初始静态 HTML 中始终存在） */}
      <section
        id="seo-knowledge-base"
        aria-label="微信公众号排版工具使用指南与常见问题"
        className="sr-only"
      >
        <h2>文排 - 免费在线微信公众号文章排版工具产品介绍</h2>
        <p>
          文排（WenPai）是一款专注于自媒体创作者的高效微信公众号文章排版工具。
          无论您输入普通自然纯文本还是 Markdown 源码，文排搭载的 Omni 语义解析引擎均可毫秒级自动识别文章标题、多级章节（一、二、1.、1.1）、数据表格、任务清单、提示卡与名言金句，
          并支持一键套用 16 套新媒体精选排版主题。全程在本地浏览器运算，内容零上传，保障隐私安全。
        </p>

        <h3>三大核心优势：为什么选择文排？</h3>
        <ul>
          <li>
            <strong>无需学习 Markdown，纯文本自然语言识别</strong>：
            支持 Word、微信聊天记录、备忘录中直接复制的文字，智能识别中英文序号（一、一，1、1. 01）、Tab/空格分隔的 Excel 数据表格与任务复选清单。
          </li>
          <li>
            <strong>16 套精选排版风格一键套用</strong>：
            覆盖微信官方风、商务报告、东方雅致、莫兰迪柔调、潮流波普、文艺清新、极客深色等丰富样式，支持自由微调主色与字号。
          </li>
          <li>
            <strong>100% 兼容微信公众号后台，复制绝不错乱</strong>：
            严格遵循微信公众平台富文本内核规范，所有样式均经过内联 CSS 序列化处理，杜绝移动端错位、非法嵌套与叠字告警。
          </li>
        </ul>

        <h3>如何使用文排进行公众号排版？（三步极速发布）</h3>
        <ol>
          <li><strong>第一步：粘贴文案</strong> - 将任意纯文本、Word 稿件或 Markdown 源码直接粘贴到左侧编辑区域。</li>
          <li><strong>第二步：选择主题</strong> - 在工具栏中挑选喜爱的排版风格，微调字号（12px~24px）或自选品牌主色。</li>
          <li><strong>第三步：一键复制发布</strong> - 点击「一键复制」按钮，直接前往微信公众号文章后台按 Ctrl+V 粘贴即可直接发布。</li>
        </ol>

        <h3>常见问题解答 (FAQ)</h3>
        <dl>
          <dt>文排与 135编辑器、秀米、MdNice 有什么区别？</dt>
          <dd>
            传统 135编辑器与秀米依赖繁琐的手动切图贴图，操作门槛高且易错位；MdNice 要求用户必须掌握 Markdown 语法。
            文排融合了两者的长处：既拥有 Markdown 的纯净排版美感，又具备对自然纯文本的智能识别能力，免登录、免付费、零上传。
          </dd>
          <dt>复制到微信公众平台会乱码或丢失样式吗？</dt>
          <dd>
            不会。文排的富文本序列化器将样式完全编译为内联 CSS（Inline Styles），完全兼容微信后台的过滤规则。
          </dd>
          <dt>我的文章内容会被上传至云端服务器吗？</dt>
          <dd>
            不会。文排采用纯客户端本地运算架构，文章解析与富文本复制全部在您的浏览器内存中完成，数据安全可靠。
          </dd>
        </dl>
      </section>

      {/* 用户端交互弹窗抽屉：点击页脚「排版指南与 FAQ」时呼出，UI 优雅整洁 */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-150"
          onClick={onClose}
        >
          <div
            className="bg-white rounded-2xl max-w-2xl w-full max-h-[85vh] shadow-2xl flex flex-col overflow-hidden border border-gray-100"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 弹窗头部 */}
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/60">
              <div className="flex items-center gap-2.5">
                <WenPaiLogo size={32} />
                <div>
                  <h3 className="font-bold text-gray-900 text-sm">文排 · 使用指南与常见问题</h3>
                  <p className="text-[11px] text-gray-500">微信公众号文章一键智能排版技巧与说明</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                title="关闭"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 弹窗主体内容 */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs text-gray-600 leading-relaxed custom-scrollbar">
              {/* 特性卡片 */}
              <div>
                <h4 className="font-semibold text-gray-900 text-sm mb-3 flex items-center gap-1.5">
                  <Palette className="w-4 h-4 text-indigo-600" />
                  <span>核心特性与优势</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl bg-indigo-50/50 border border-indigo-100/60">
                    <div className="font-medium text-indigo-900 mb-1 flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                      <span>纯文本全形态智能识别</span>
                    </div>
                    <p className="text-[11px] text-indigo-800/80">
                      支持自然中文序号（一、一，）、阿拉伯数字（1、1. 01）、Excel 制表符表格、任务清单（[ ] / [x]）与导读提示卡。
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-emerald-50/50 border border-emerald-100/60">
                    <div className="font-medium text-emerald-900 mb-1 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>100% 微信公众号合规</span>
                    </div>
                    <p className="text-[11px] text-emerald-800/80">
                      所有排版自动内联化编译，彻底规避复制到微信后台时的叠字报错、样式脱落与移动端表格挤压。
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-amber-50/50 border border-amber-100/60">
                    <div className="font-medium text-amber-900 mb-1 flex items-center gap-1">
                      <Palette className="w-3.5 h-3.5 text-amber-600" />
                      <span>16 套精选新媒体风格</span>
                    </div>
                    <p className="text-[11px] text-amber-800/80">
                      涵盖公众号风、商务报告、东方雅致、莫兰迪柔调等，支持字号微调、品牌主色定制与外链转脚注。
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-blue-50/50 border border-blue-100/60">
                    <div className="font-medium text-blue-900 mb-1 flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                      <span>本地离线运算 · 隐私零上传</span>
                    </div>
                    <p className="text-[11px] text-blue-800/80">
                      全文解析与图片预览仅在您的浏览器中完成，服务器不留存任何文案草稿，全面保护内容隐私。
                    </p>
                  </div>
                </div>
              </div>

              {/* 3 步使用说明 */}
              <div>
                <h4 className="font-semibold text-gray-900 text-sm mb-3 flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-indigo-600" />
                  <span>3 步极速完成公众号排版</span>
                </h4>
                <div className="space-y-2">
                  <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-gray-50 border border-gray-100">
                    <span className="w-5 h-5 rounded-full bg-indigo-600 text-white font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                      1
                    </span>
                    <div>
                      <strong className="text-gray-900">粘贴文章草稿</strong>
                      <p className="text-[11px] text-gray-500 mt-0.5">
                        直接从 Word、微信、备忘录或 ChatGPT 复制文字，支持在编辑器中按 Cmd+V / Ctrl+V 直接插入截屏图片。
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-gray-50 border border-gray-100">
                    <span className="w-5 h-5 rounded-full bg-indigo-600 text-white font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                      2
                    </span>
                    <div>
                      <strong className="text-gray-900">挑选心仪排版主题</strong>
                      <p className="text-[11px] text-gray-500 mt-0.5">
                        在右上角选择预设风格，或通过「主色搭配」与「字号调节」匹配公众号的品牌调性。
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-gray-50 border border-gray-100">
                    <span className="w-5 h-5 rounded-full bg-indigo-600 text-white font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                      3
                    </span>
                    <div>
                      <strong className="text-gray-900">一键复制并发布</strong>
                      <p className="text-[11px] text-gray-500 mt-0.5">
                        点击「一键复制」按钮，在微信公众平台官方后台直接粘贴即可，格式 100% 完美复刻。
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* 常见问题解答 */}
              <div>
                <h4 className="font-semibold text-gray-900 text-sm mb-3 flex items-center gap-1.5">
                  <HelpCircle className="w-4 h-4 text-indigo-600" />
                  <span>常见问题解答 (FAQ)</span>
                </h4>
                <div className="space-y-3">
                  <div className="border-b border-gray-100 pb-2.5">
                    <div className="font-medium text-gray-800 mb-1">
                      Q: 不懂 Markdown 语法可以使用文排吗？
                    </div>
                    <div className="text-[11px] text-gray-500">
                      A: 完全可以。文排专为普通作者打造，无需输入任何 # 或 - 等标记，系统会自动将您日常书写的序号与表格识别为对应的美观格式。
                    </div>
                  </div>
                  <div className="border-b border-gray-100 pb-2.5">
                    <div className="font-medium text-gray-800 mb-1">
                      Q: 粘贴到微信公众号后台会发生格式变形吗？
                    </div>
                    <div className="text-[11px] text-gray-500">
                      A: 不会。文排生成的富文本符合微信官方插件规范，所有样式全内联绑定，杜绝任何外部 CSS 过滤导致的变形。
                    </div>
                  </div>
                  <div>
                    <div className="font-medium text-gray-800 mb-1">
                      Q: 网站是否免费？需要注册账号吗？
                    </div>
                    <div className="text-[11px] text-gray-500">
                      A: 文排完全免费，免注册登录，打开即用。
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 底部按钮 */}
            <div className="px-6 py-3 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
              <span className="text-[11px] text-gray-400">文排 · 让每一篇文章都有体面的排版</span>
              <button
                onClick={onClose}
                className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs transition-colors cursor-pointer"
              >
                开始排版
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
