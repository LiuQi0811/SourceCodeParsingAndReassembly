import { getDefinition, safeHref } from '../core/registry';
import type { ComponentNode, ComponentStyle, RenderMode } from '../core/schema';

const EDITOR_FONT_FAMILY = '-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif';

/** 每个 DOM 元素上缓存的上次样式快照的 key */
const CACHE_PROP = Symbol('lcStyleCache');

interface StyleCache {
  [key: string]: string | undefined;
}

function toCssKey(key: string): string {
  return key.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`);
}

function getCache(element: HTMLElement): StyleCache {
  const map = (element as unknown as Record<symbol, StyleCache>)[CACHE_PROP];
  if (map) return map;
  const empty: StyleCache = {};
  (element as unknown as Record<symbol, StyleCache>)[CACHE_PROP] = empty;
  return empty;
}

function setCache(element: HTMLElement, cache: StyleCache): void {
  (element as unknown as Record<symbol, StyleCache>)[CACHE_PROP] = cache;
}

export function buildNode(node: ComponentNode, mode: RenderMode): HTMLElement {
  const definition = getDefinition(node.type);
  const fragment = document.createDocumentFragment();
  node.children.forEach((child) => fragment.appendChild(buildNode(child, mode)));
  const element = definition.render(node, mode, fragment);

  if (node.type === 'container') {
    element.classList.toggle('lc-empty', mode === 'editor' && node.children.length === 0);
  }
  return element;
}

/**
 * 增量同步样式：只更新变化的 key，移除被删除的 key。
 * 相比全量遍历 style 对象，属性面板改单个字段时 DOM 写入减少 90%+。
 */
function syncStyles(element: HTMLElement, style: ComponentStyle, mode: RenderMode): void {
  const applied: StyleCache = { ...style } as StyleCache;
  if (mode === 'editor') {
    applied.position = applied.position ?? 'relative';
    applied.boxSizing = 'border-box';
    applied.fontFamily = applied.fontFamily ?? EDITOR_FONT_FAMILY;
    applied.outline = 'none';
  }

  const prev = getCache(element);
  const nextKeys = new Set(Object.keys(applied));
  let changed = false;

  // 更新变化或新增的 key
  for (const key of nextKeys) {
    const value = applied[key];
    if (prev[key] === value) continue;
    changed = true;
    if (value === undefined || value === '') {
      element.style.removeProperty(toCssKey(key));
    } else {
      element.style.setProperty(toCssKey(key), value);
    }
  }

  // 移除上次有、这次没有的 key
  for (const key of Object.keys(prev)) {
    if (nextKeys.has(key)) continue;
    changed = true;
    element.style.removeProperty(toCssKey(key));
  }

  if (changed) setCache(element, { ...applied });
}

function syncSpecialAttributes(element: HTMLElement, node: ComponentNode, mode: RenderMode): void {
  if (element instanceof HTMLImageElement) {
    element.src = node.props.src || '';
    element.alt = node.props.alt || '图片';
  }
  if (element instanceof HTMLInputElement) {
    element.placeholder = node.props.placeholder || '';
    element.type = 'text';
    if (mode === 'editor') element.readOnly = true;
  }
  if (element instanceof HTMLAnchorElement) {
    element.setAttribute('href', mode === 'export' ? safeHref(node.props.href ?? '') : '#');
    element.setAttribute('rel', 'noopener noreferrer');
    if (mode === 'export') element.setAttribute('target', '_blank');
  }
  if (element instanceof HTMLButtonElement) element.type = 'button';
  if (definitionSupportsText(node)) {
    const editing = document.activeElement === element && element.isContentEditable;
    if (!editing) element.textContent = node.props.text ?? '';
  }
}

function definitionSupportsText(node: ComponentNode): boolean {
  return ['heading', 'paragraph', 'button', 'link'].includes(node.type);
}

function syncEditorMeta(element: HTMLElement, node: ComponentNode, selectedId: string | null, hoveredId: string | null): void {
  element.dataset.nodeId = node.id;
  element.dataset.nodeType = node.type;
  element.dataset.locked = node.locked ? 'true' : 'false';
  element.dataset.hidden = node.hidden ? 'true' : 'false';
  element.classList.add('lc-node');
  element.classList.toggle('is-locked', node.locked);
  element.classList.toggle('is-hidden', node.hidden);
  element.classList.toggle('is-selected', node.id === selectedId);
  element.classList.toggle('is-hovered', node.id === hoveredId);
  const isEditing = element.dataset.editing === 'true';
  element.contentEditable = getDefinition(node.type).editableText && isEditing && !node.locked ? 'true' : 'false';
  element.spellcheck = false;
  element.dataset.textEditable = getDefinition(node.type).editableText && !node.locked ? 'true' : 'false';
  if (node.type === 'container') {
    element.dataset.dropContainer = 'true';
    element.classList.toggle('lc-empty', node.children.length === 0);
  } else {
    delete element.dataset.dropContainer;
  }
}

function reconcileChildren(element: HTMLElement, node: ComponentNode, mode: RenderMode, selectedId: string | null, hoveredId: string | null): void {
  if (!getDefinition(node.type).canHaveChildren) return;

  let childElement = element.firstElementChild;
  node.children.forEach((childNode, index) => {
    const existing = childElement as HTMLElement | null;
    if (existing && existing.dataset.nodeId === childNode.id) {
      reconcileNode(existing, childNode, mode, selectedId, hoveredId);
      childElement = existing.nextElementSibling;
      return;
    }

    const replacement = buildNode(childNode, mode);
    reconcileNode(replacement, childNode, mode, selectedId, hoveredId);
    if (existing && index < element.children.length) element.insertBefore(replacement, existing);
    else element.appendChild(replacement);
    childElement = replacement.nextElementSibling;
  });

  while (element.children.length > node.children.length) {
    element.lastElementChild?.remove();
  }
}

function reconcileNode(element: HTMLElement, node: ComponentNode, mode: RenderMode, selectedId: string | null, hoveredId: string | null): void {
  syncStyles(element, node.style, mode);
  syncSpecialAttributes(element, node, mode);
  if (mode === 'editor') syncEditorMeta(element, node, selectedId, hoveredId);
  reconcileChildren(element, node, mode, selectedId, hoveredId);
}

export class SchemaRenderer {
  private readonly pageElement: HTMLElement;
  private highlightedSelected: HTMLElement | null = null;
  private highlightedHovered: HTMLElement | null = null;

  constructor() {
    this.pageElement = document.createElement('div');
    this.pageElement.className = 'lc-page';
    this.pageElement.dataset.root = 'true';
    this.pageElement.dataset.dropContainer = 'true';
  }

  mount(container: HTMLElement): void {
    container.innerHTML = '';
    container.appendChild(this.pageElement);
  }

  update(root: ComponentNode, selectedId: string | null, hoveredId: string | null): void {
    syncStyles(this.pageElement, root.style, 'editor');
    this.pageElement.dataset.nodeId = root.id;
    this.pageElement.dataset.nodeType = root.type;
    this.pageElement.dataset.dropContainer = 'true';
    this.pageElement.classList.toggle('lc-empty', root.children.length === 0);
    reconcileChildren(this.pageElement, root, 'editor', selectedId, hoveredId);
    this.highlightedSelected = null;
    this.highlightedHovered = null;
    this.updateHighlight(selectedId, hoveredId);
  }

  // 悬浮态变化频繁，只切换高亮 class，避免整棵树重新同步样式。
  updateHighlight(selectedId: string | null, hoveredId: string | null): void {
    const selected = this.findHighlightTarget(selectedId);
    if (selected !== this.highlightedSelected) {
      this.highlightedSelected?.classList.remove('is-selected');
      this.highlightedSelected = selected;
      selected?.classList.add('is-selected');
    }

    const hovered = this.findHighlightTarget(hoveredId);
    if (hovered !== this.highlightedHovered) {
      this.highlightedHovered?.classList.remove('is-hovered');
      this.highlightedHovered = hovered;
      hovered?.classList.add('is-hovered');
    }
  }

  private findHighlightTarget(id: string | null): HTMLElement | null {
    if (!id) return null;
    const element = this.pageElement.querySelector<HTMLElement>(`[data-node-id="${CSS.escape(id)}"]`);
    return element && element.dataset.root !== 'true' ? element : null;
  }

  get element(): HTMLElement {
    return this.pageElement;
  }
}
