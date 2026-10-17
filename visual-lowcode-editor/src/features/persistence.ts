import type { PageSchema } from '../core/schema';
import { validateSchema } from '../core/schema-utils';

const STORAGE_KEY = 'lowcode-editor-schema-v1';

/**
 * 老版本 Schema 可能缺少 events、customCode 等字段，
 * 加载时补齐默认值，保证后续代码不用做空值判断。
 * @internal 导出供测试使用
 */
export function normalizeSchema(parsed: PageSchema): PageSchema {
  const ensureEvents = (node: PageSchema['root']): void => {
    if (!node.events) (node as PageSchema['root'] & { events?: unknown }).events = {};
    if (typeof node.locked !== 'boolean') (node as PageSchema['root'] & { locked?: unknown }).locked = false;
    if (typeof node.hidden !== 'boolean') (node as PageSchema['root'] & { hidden?: unknown }).hidden = false;
    node.children.forEach(ensureEvents);
  };
  ensureEvents(parsed.root);

  if (!parsed.customCode) {
    (parsed as PageSchema & { customCode?: unknown }).customCode = {
      headScript: '',
      bodyScript: '',
      headStyle: '',
    };
  } else {
    const cc = parsed.customCode;
    if (typeof cc.headScript !== 'string') cc.headScript = '';
    if (typeof cc.bodyScript !== 'string') cc.bodyScript = '';
    if (typeof cc.headStyle !== 'string') cc.headStyle = '';
  }

  return parsed;
}

export function loadSchema(): PageSchema | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!validateSchema(parsed)) return null;
    return normalizeSchema(parsed);
  } catch {
    return null;
  }
}

export function saveSchema(schema: PageSchema): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(schema));
  } catch (error) {
    console.warn('自动保存失败', error);
  }
}

export function downloadJson(schema: PageSchema): void {
  const blob = new Blob([JSON.stringify(schema, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'lowcode-schema.json';
  link.click();
  URL.revokeObjectURL(url);
}

export function parseSchemaFile(file: File): Promise<PageSchema> {
  return file.text().then((text) => {
    const parsed: unknown = JSON.parse(text);
    if (!validateSchema(parsed)) throw new Error('JSON 结构不符合页面 Schema 规范');
    return normalizeSchema(parsed);
  });
}
