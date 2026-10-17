import type { ComponentNode, PageSchema } from '../core/schema';
import { SchemaRenderer } from '../engine/renderer';
import { ContextMenu, type ContextMenuItem } from './context-menu';

export interface NodeLocation {
  parent: ComponentNode;
  index: number;
}

export interface CanvasHandlers {
  onSelect: (id: string | null) => void;
  onHover: (id: string | null) => void;
  onNodePointerDown: (event: PointerEvent, id: string) => void;
  onTextCommit: (id: string, text: string) => void;
  onCopy: (id: string) => void;
  onPaste: (id: string) => void;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
  onToggleLock: (id: string) => void;
  onToggleHidden: (id: string) => void;
  onDelete: (id: string) => void;
}

export class CanvasPanel {
  readonly element: HTMLElement;
  private readonly host: HTMLElement;
  private readonly emptyHint: HTMLElement;
  private readonly renderer = new SchemaRenderer();
  private readonly contextMenu = new ContextMenu();

  constructor(
    private readonly getSchema: () => PageSchema,
    private readonly getSelectedId: () => string | null,
    private readonly getHoveredId: () => string | null,
    private readonly getNode: (id: string) => ComponentNode | null,
    private readonly getLocation: (id: string) => NodeLocation | null,
    private readonly hasClipboard: () => boolean,
    private readonly handlers: CanvasHandlers,
  ) {
    this.element = document.createElement('section');
    this.element.className = 'canvas-panel';
    this.element.innerHTML = `
      <div class="canvas-stage">
        <div class="canvas-scroll">
          <div class="canvas-page-host"></div>
        </div>
        <div class="canvas-empty-hint">从左侧拖入组件，开始搭建页面</div>
      </div>
    `;
    this.host = this.element.querySelector('.canvas-page-host') as HTMLElement;
    this.emptyHint = this.element.querySelector('.canvas-empty-hint') as HTMLElement;
    this.renderer.mount(this.host);
    this.bindEvents();
  }

  private bindEvents(): void {
    this.element.addEventListener('pointerdown', (event) => {
      const nodeElement = (event.target as HTMLElement).closest<HTMLElement>('[data-node-id]');
      if (!nodeElement || !this.element.contains(nodeElement)) return;
      const id = nodeElement.dataset.nodeId;
      if (!id) return;
      if ((event.target as HTMLElement).isContentEditable) {
        event.stopPropagation();
      } else {
        this.handlers.onSelect(nodeElement.dataset.root === 'true' ? null : id);
      }
      if (nodeElement.dataset.root !== 'true') this.handlers.onNodePointerDown(event, id);
    });

    this.element.addEventListener('pointermove', (event) => {
      if (event.buttons !== 0) return;
      const nodeElement = (event.target as HTMLElement).closest<HTMLElement>('[data-node-id]');
      this.handlers.onHover(nodeElement?.dataset.nodeId ?? null);
    });

    this.element.addEventListener('pointerleave', () => this.handlers.onHover(null));

    this.element.addEventListener('dblclick', (event) => {
      const editable = (event.target as HTMLElement).closest<HTMLElement>('[data-text-editable="true"]');
      if (!editable?.dataset.nodeId) return;
      event.preventDefault();
      editable.dataset.editing = 'true';
      editable.contentEditable = 'true';
      editable.classList.add('is-editing-inline');
      editable.focus();
      const range = document.createRange();
      range.selectNodeContents(editable);
      range.collapse(false);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
    });

    this.element.addEventListener('focusout', (event) => {
      const editable = (event.target as HTMLElement).closest<HTMLElement>('[data-text-editable="true"]');
      if (!editable?.dataset.nodeId) return;
      const text = editable.textContent ?? '';
      editable.dataset.editing = 'false';
      editable.contentEditable = 'false';
      editable.classList.remove('is-editing-inline');
      window.getSelection()?.removeAllRanges();
      this.handlers.onTextCommit(editable.dataset.nodeId, text);
      this.render();
    });

    this.element.addEventListener('keydown', (event) => {
      if (!((event.target as HTMLElement).isContentEditable)) return;
      if (event.key === 'Enter' && (event.target as HTMLElement).tagName !== 'P') {
        event.preventDefault();
        (event.target as HTMLElement).blur();
      }
      if (event.key === 'Escape') (event.target as HTMLElement).blur();
    });

    this.element.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      const nodeElement = (event.target as HTMLElement).closest<HTMLElement>('[data-node-id]');
      if (!nodeElement || !this.element.contains(nodeElement)) return;
      const id = nodeElement.dataset.nodeId;
      if (!id || nodeElement.dataset.root === 'true') return;

      this.handlers.onSelect(id);
      this.showContextMenu(event.clientX, event.clientY, id);
    });
  }

  private showContextMenu(x: number, y: number, nodeId: string): void {
    const node = this.getNode(nodeId);
    if (!node) return;

    const location = this.getLocation(nodeId);
    const isFirst = location ? location.index === 0 : true;
    const isLast = location ? location.index === location.parent.children.length - 1 : true;
    const schema = this.getSchema();
    const isRoot = node.id === schema.root.id;
    const clipboardEmpty = !this.hasClipboard();

    const items: ContextMenuItem[] = [
      {
        id: 'copy',
        label: '复制',
        icon: '📋',
        onClick: () => this.handlers.onCopy(nodeId),
      },
      {
        id: 'paste',
        label: '粘贴',
        icon: '📎',
        disabled: clipboardEmpty,
        onClick: () => this.handlers.onPaste(nodeId),
      },
      { id: 'divider-1', label: '', onClick: () => {}, divider: true },
      {
        id: 'moveUp',
        label: '上移',
        icon: '⬆️',
        disabled: isFirst,
        onClick: () => this.handlers.onMoveUp(nodeId),
      },
      {
        id: 'moveDown',
        label: '下移',
        icon: '⬇️',
        disabled: isLast,
        onClick: () => this.handlers.onMoveDown(nodeId),
      },
      { id: 'divider-2', label: '', onClick: () => {}, divider: true },
      {
        id: 'toggleLock',
        label: node.locked ? '解锁' : '锁定',
        icon: node.locked ? '🔓' : '🔒',
        onClick: () => this.handlers.onToggleLock(nodeId),
      },
      {
        id: 'toggleHidden',
        label: node.hidden ? '显示' : '隐藏',
        icon: node.hidden ? '👁️' : '👁️‍🗨️',
        onClick: () => this.handlers.onToggleHidden(nodeId),
      },
      { id: 'divider-3', label: '', onClick: () => {}, divider: true },
      {
        id: 'delete',
        label: '删除',
        icon: '🗑️',
        danger: true,
        disabled: node.locked || isRoot,
        onClick: () => this.handlers.onDelete(nodeId),
      },
    ];

    this.contextMenu.show(x, y, items);
  }

  render(): void {
    const schema = this.getSchema();
    this.renderer.update(schema.root, this.getSelectedId(), this.getHoveredId());
    this.emptyHint.hidden = schema.root.children.length > 0;
  }

  // 悬浮态只切换高亮 class，不重建 DOM。
  renderHighlight(): void {
    this.renderer.updateHighlight(this.getSelectedId(), this.getHoveredId());
  }

  destroy(): void {
    this.contextMenu.destroy();
  }
}
