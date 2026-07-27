// _portal.ts —— 弹层 portal 工具
// 把下拉/面板 DOM 移到 document.body，避免被父级 overflow:hidden 裁剪。

export type DropdownPlacement = 'bottom' | 'top';
export type DropdownAlign = 'left' | 'right' | 'matchWidth';

export interface MountDropdownOptions {
  placement?: DropdownPlacement;
  gap?: number;
  align?: DropdownAlign;
  zIndex?: number;
}

/**
 * 把弹层 portal 到 document.body 并按 trigger 定位。
 * @returns cleanup 函数
 */
export function mountDropdown(
  dropdownEl: HTMLElement,
  triggerEl: HTMLElement,
  opts: MountDropdownOptions = {},
): () => void {
  if (!dropdownEl || !triggerEl) return () => {};

  const {
    placement = 'bottom',
    gap = 4,
    align = 'left',
    zIndex = 1050,
  } = opts;

  // 移到 body（若尚未在 body）
  if (dropdownEl.parentElement !== document.body) {
    document.body.appendChild(dropdownEl);
  }

  // 让 dropdown 脱离父级定位上下文，使用 absolute + 全局坐标
  dropdownEl.style.position = 'absolute';
  dropdownEl.style.zIndex = String(zIndex);

  const position = (): void => {
    if (!triggerEl.isConnected || !dropdownEl.isConnected) return;
    const rect = triggerEl.getBoundingClientRect();
    const scrollX = window.scrollX || 0;
    const scrollY = window.scrollY || 0;
    const dw = dropdownEl.offsetWidth;
    const dh = dropdownEl.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let left: number;
    let top: number;
    if (placement === 'top') {
      left = rect.left + scrollX;
      top = rect.top - dh - gap + scrollY;
      if (rect.top - dh - gap < 8) {
        top = rect.bottom + gap + scrollY;
      }
    } else {
      left = rect.left + scrollX;
      top = rect.bottom + gap + scrollY;
      if (rect.bottom + gap + dh > vh - 8 && rect.top - dh - gap > 8) {
        top = rect.top - dh - gap + scrollY;
      }
    }

    if (align === 'right') {
      left = rect.right - dw + scrollX;
    } else if (align === 'matchWidth') {
      dropdownEl.style.width = `${rect.width}px`;
    }

    if (left + dw > vw - 8 + scrollX) left = vw - dw - 8 + scrollX;
    if (left < scrollX + 8) left = scrollX + 8;

    dropdownEl.style.left = `${left}px`;
    dropdownEl.style.top = `${top}px`;
  };

  position();

  const onScroll = (): void => position();
  const onResize = (): void => position();
  window.addEventListener('scroll', onScroll, true);
  window.addEventListener('resize', onResize);

  return () => {
    window.removeEventListener('scroll', onScroll, true);
    window.removeEventListener('resize', onResize);
    if (dropdownEl.parentElement === document.body) {
      dropdownEl.remove();
    }
  };
}

/**
 * 判断点击事件是否发生在给定组件根元素或其 portal 弹层内。
 */
export function isClickInside(e: Event, rootEl: HTMLElement | null, dropdownEl: HTMLElement | null): boolean {
  if (rootEl && rootEl.contains(e.target as Node)) return true;
  if (dropdownEl && dropdownEl.contains(e.target as Node)) return true;
  return false;
}
