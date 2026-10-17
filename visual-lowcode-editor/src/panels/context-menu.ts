export interface ContextMenuItem {
  id: string;
  label: string;
  icon?: string;
  disabled?: boolean;
  danger?: boolean;
  divider?: boolean;
  onClick: () => void;
}

export class ContextMenu {
  private element: HTMLElement;
  private onDocumentMouseDown: ((event: MouseEvent) => void) | null = null;
  private onWindowScroll: ((event: Event) => void) | null = null;
  private onDocumentKeyDown: ((event: KeyboardEvent) => void) | null = null;

  constructor() {
    this.element = document.createElement('div');
    this.element.className = 'lc-context-menu';
    this.element.hidden = true;
    document.body.appendChild(this.element);
  }

  show(x: number, y: number, items: ContextMenuItem[]): void {
    this.element.innerHTML = '';

    for (const item of items) {
      if (item.divider) {
        const divider = document.createElement('div');
        divider.className = 'lc-context-menu-divider';
        this.element.appendChild(divider);
        continue;
      }

      const menuItem = document.createElement('div');
      menuItem.className = 'lc-context-menu-item';
      if (item.disabled) menuItem.classList.add('is-disabled');
      if (item.danger) menuItem.classList.add('is-danger');

      if (item.icon) {
        const iconSpan = document.createElement('span');
        iconSpan.className = 'lc-context-menu-icon';
        iconSpan.textContent = item.icon;
        menuItem.appendChild(iconSpan);
      }

      const labelSpan = document.createElement('span');
      labelSpan.textContent = item.label;
      menuItem.appendChild(labelSpan);

      if (!item.disabled) {
        menuItem.addEventListener('click', () => {
          item.onClick();
          this.hide();
        });
      }

      this.element.appendChild(menuItem);
    }

    // 先显示以测量尺寸
    this.element.hidden = false;
    this.element.style.left = '0px';
    this.element.style.top = '0px';

    const rect = this.element.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let finalX = x;
    let finalY = y;

    if (x + rect.width > viewportWidth) {
      finalX = viewportWidth - rect.width - 4;
    }
    if (y + rect.height > viewportHeight) {
      finalY = viewportHeight - rect.height - 4;
    }

    this.element.style.left = `${finalX}px`;
    this.element.style.top = `${finalY}px`;

    this.bindGlobalListeners();
  }

  hide(): void {
    this.element.hidden = true;
    this.unbindGlobalListeners();
  }

  destroy(): void {
    this.unbindGlobalListeners();
    this.element.remove();
  }

  private bindGlobalListeners(): void {
    this.onDocumentMouseDown = (event: MouseEvent) => {
      if (!this.element.contains(event.target as Node)) {
        this.hide();
      }
    };
    this.onWindowScroll = () => {
      this.hide();
    };
    this.onDocumentKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        this.hide();
      }
    };

    document.addEventListener('mousedown', this.onDocumentMouseDown);
    window.addEventListener('scroll', this.onWindowScroll, true);
    document.addEventListener('keydown', this.onDocumentKeyDown);
  }

  private unbindGlobalListeners(): void {
    if (this.onDocumentMouseDown) {
      document.removeEventListener('mousedown', this.onDocumentMouseDown);
      this.onDocumentMouseDown = null;
    }
    if (this.onWindowScroll) {
      window.removeEventListener('scroll', this.onWindowScroll, true);
      this.onWindowScroll = null;
    }
    if (this.onDocumentKeyDown) {
      document.removeEventListener('keydown', this.onDocumentKeyDown);
      this.onDocumentKeyDown = null;
    }
  }
}
