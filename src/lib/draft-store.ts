/**
 * 本地多草稿存储（纯 localStorage，无后端依赖）
 *
 * 模型：radiant_drafts = DraftEntry[]，radiant_active_draft = 当前草稿 id。
 * 每份草稿独立保存纯文本编辑面（plain）与排版用 markdown 副本（md），
 * 图片以内容寻址令牌存于独立图片库，跨草稿自然共享。
 *
 * 迁移：首次运行时把旧版单草稿键（radiant_article_draft / _source_md）
 * 收编为第一份草稿，随后删除旧键，避免双份数据源。
 */

export interface DraftEntry {
  id: string;
  /** 用户手动命名的标题；customTitle 为 false 时自动取内容首行 */
  title: string;
  customTitle: boolean;
  plain: string;
  md: string;
  createdAt: number;
  updatedAt: number;
}

const KEY = 'radiant_drafts';
const ACTIVE_KEY = 'radiant_active_draft';
const LEGACY_DRAFT = 'radiant_article_draft';
const LEGACY_MD = 'radiant_article_source_md';
/** 草稿数量上限：防止 localStorage 容量被无限挤占 */
const MAX_DRAFTS = 50;

function readAll(): DraftEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((d) => d && typeof d.id === 'string' && typeof d.plain === 'string');
  } catch {
    return [];
  }
}

function writeAll(list: DraftEntry[]): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}

/** 存储配额不足等写入失败——抛出让上层在 UI 上明示，杜绝「以为存了其实没存」 */
function writeAllOrThrow(list: DraftEntry[]): void {
  if (!writeAll(list)) {
    throw new Error('存储空间不足，草稿保存失败');
  }
}

function newId(): string {
  return `d_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** 草稿标题自动推导：首个非空行，剥掉常见结构标记，截断到 24 字 */
export function deriveTitle(plain: string): string {
  const firstLine = (plain || '')
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l.length > 0);
  if (!firstLine) return '未命名草稿';
  const bare = firstLine
    .replace(/^#{1,6}[ \t]+/, '')
    .replace(/^#{1,6}(?=[\u4e00-\u9fff])/, '')
    .replace(/^>[ \t]?/, '')
    .replace(/^[-•●·✦*][ \t]+/, '')
    .replace(/^\*▲?\s*/, '')
    .replace(/^<p data-role="(?:note|center)">|<\/p>$/g, '');
  const t = bare.trim();
  return t ? (t.length > 24 ? t.slice(0, 24) + '…' : t) : '未命名草稿';
}

export function listDrafts(): DraftEntry[] {
  return readAll().sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getActiveId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_KEY) || null;
  } catch {
    return null;
  }
}

export function setActiveId(id: string | null): void {
  try {
    if (id) localStorage.setItem(ACTIVE_KEY, id);
    else localStorage.removeItem(ACTIVE_KEY);
  } catch {}
}

/** 保存指定草稿内容（不动 customTitle）；不存在则视为新建 */
export function saveDraft(id: string, plain: string, md: string): DraftEntry[] {
  const list = readAll();
  const now = Date.now();
  const idx = list.findIndex((d) => d.id === id);
  if (idx >= 0) {
    const d = list[idx];
    list[idx] = { ...d, plain, md, updatedAt: now, title: d.customTitle ? d.title : deriveTitle(plain) };
  } else {
    list.push({ id, title: deriveTitle(plain), customTitle: false, plain, md, createdAt: now, updatedAt: now });
  }
  // 超限时淘汰最旧的草稿（保留当前激活的）
  const trimmed = [...list].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, MAX_DRAFTS);
  if (!trimmed.some((d) => d.id === id)) trimmed.push(list[idx] ?? list[list.length - 1]);
  writeAllOrThrow(trimmed);
  setActiveId(id);
  return listDrafts();
}

export function createDraft(plain = '', md = ''): DraftEntry {
  const now = Date.now();
  const entry: DraftEntry = { id: newId(), title: deriveTitle(plain), customTitle: false, plain, md, createdAt: now, updatedAt: now };
  const list = readAll();
  list.push(entry);
  writeAll(list);
  setActiveId(entry.id);
  return entry;
}

/** 删除草稿，返回建议的下一个激活 id（最近更新的其他草稿，没有则 null） */
export function deleteDraft(id: string): string | null {
  const list = readAll().filter((d) => d.id !== id);
  writeAll(list);
  const next = list.sort((a, b) => b.updatedAt - a.updatedAt)[0];
  const nextId = next ? next.id : null;
  setActiveId(nextId);
  return nextId;
}

export function renameDraft(id: string, title: string): DraftEntry[] {
  const list = readAll();
  const idx = list.findIndex((d) => d.id === id);
  if (idx >= 0) {
    const t = title.trim();
    list[idx] = { ...list[idx], title: t || deriveTitle(list[idx].plain), customTitle: !!t };
  }
  writeAll(list);
  return listDrafts();
}

/**
 * 旧版单草稿迁移：radiant_drafts 尚不存在且存在旧键时，
 * 把旧草稿收编为第一份草稿并删除旧键（幂等：新键存在即跳过）
 */
export function migrateLegacy(): void {
  if (localStorage.getItem(KEY) !== null) return;
  const legacyPlain = localStorage.getItem(LEGACY_DRAFT);
  const legacyMd = localStorage.getItem(LEGACY_MD);
  if (legacyPlain === null && legacyMd === null) return;
  const now = Date.now();
  const entry: DraftEntry = {
    id: newId(),
    title: deriveTitle(legacyPlain || ''),
    customTitle: false,
    plain: legacyPlain || '',
    md: legacyMd || '',
    createdAt: now,
    updatedAt: now,
  };
  // 写入失败（如配额不足）时保留旧键，下次再试——绝不先删后写
  if (!writeAll([entry])) return;
  setActiveId(entry.id);
  try {
    localStorage.removeItem(LEGACY_DRAFT);
    localStorage.removeItem(LEGACY_MD);
  } catch {}
}
