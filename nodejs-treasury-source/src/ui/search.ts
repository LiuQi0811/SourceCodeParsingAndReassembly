import type { ChapterDoc } from '../types';
import { getSearchIndex, search } from '../lib/search';
import type { SearchResult } from '../lib/search';
import { navigateTo } from '../lib/router';

function esc(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** 标题命中部分高亮 */
function markTitle(title: string, q: string): string {
  const idx = title.toLowerCase().indexOf(q.toLowerCase());
  if (idx === -1) return esc(title);
  return esc(title.slice(0, idx)) + '<mark>' + esc(title.slice(idx, idx + q.length)) + '</mark>' + esc(title.slice(idx + q.length));
}

export function initSearch(
  wrap: HTMLElement,
  input: HTMLInputElement,
  dropdown: HTMLElement,
  chapters: ChapterDoc[],
): void {
  const index = getSearchIndex(chapters);
  let results: SearchResult[] = [];
  let active = -1;

  const close = (): void => {
    dropdown.hidden = true;
    active = -1;
  };

  function renderDropdown(): void {
    if (results.length === 0) {
      dropdown.innerHTML = '<div class="search-empty">未找到匹配的 API，试试 "readFile"、"事件循环" 或 "fs"</div>';
      return;
    }
    const q = input.value.trim();
    dropdown.innerHTML = results
      .map(
        (r) => `
      <a class="search-item${results[active] === r ? ' active' : ''}" data-ch="${r.chapterId}" data-api="${r.apiId}" href="#/${r.chapterId}/${r.apiId}">
        <span class="si-chapter">${esc(r.chapterTitle)}</span>
        <span class="si-title">${markTitle(r.title, q)}</span>
        <span class="si-sig">${esc(r.signature)}</span>
      </a>`,
      )
      .join('');
  }

  function update(): void {
    const q = input.value.trim();
    if (q.length === 0) {
      close();
      return;
    }
    results = search(index, q);
    active = results.length > 0 ? 0 : -1;
    renderDropdown();
    dropdown.hidden = false;
  }

  input.addEventListener('input', update);
  input.addEventListener('focus', () => {
    if (input.value.trim().length > 0) update();
  });
  input.addEventListener('blur', () => {
    // 延迟关闭，避免下拉项 click 前被 blur 干掉
    window.setTimeout(close, 180);
  });

  input.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (results.length === 0) return;
      const delta = e.key === 'ArrowDown' ? 1 : -1;
      active = (active + delta + results.length) % results.length;
      renderDropdown();
      return;
    }
    if (e.key === 'Enter') {
      const target = results[active] ?? results[0];
      if (target) {
        input.blur();
        close();
        navigateTo({ name: 'chapter', chapterId: target.chapterId, apiId: target.apiId });
      }
      return;
    }
    if (e.key === 'Escape') {
      input.value = '';
      input.blur();
      close();
    }
  });

  dropdown.addEventListener('mousedown', (e: MouseEvent) => {
    e.preventDefault();
  });
  dropdown.addEventListener('click', (e: MouseEvent) => {
    const item = (e.target as HTMLElement).closest('a.search-item') as HTMLElement | null;
    if (!item) return;
    e.preventDefault();
    input.blur();
    close();
    navigateTo({
      name: 'chapter',
      chapterId: item.dataset.ch ?? '',
      apiId: item.dataset.api ?? null,
    });
  });

  // 全局快捷键：/ 或 Ctrl/Cmd + K 聚焦搜索
  window.addEventListener('keydown', (e: KeyboardEvent) => {
    const tag = (e.target as HTMLElement).tagName;
    const typing = tag === 'INPUT' || tag === 'TEXTAREA';
    if ((e.key === '/' && !typing) || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k')) {
      e.preventDefault();
      input.focus();
      input.select();
    }
  });
}
