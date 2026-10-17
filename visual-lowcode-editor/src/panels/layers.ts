import { getDefinition } from '../core/registry';
import type { ComponentNode, PageSchema } from '../core/schema';

interface LayerHandlers {
  onSelect: (id: string | null) => void;
  onMove: (id: string, direction: -1 | 1) => void;
}

export class LayersPanel {
  readonly element: HTMLElement;
  private readonly treeElement: HTMLElement;

  constructor(
    private readonly getSchema: () => PageSchema,
    private readonly getSelectedId: () => string | null,
    private readonly handlers: LayerHandlers,
  ) {
    this.element = document.createElement('div');
    this.element.className = 'layers-panel';
    this.element.innerHTML = '<div class="panel-title compact">图层</div>';
    this.treeElement = document.createElement('div');
    this.treeElement.className = 'layer-tree';
    this.element.appendChild(this.treeElement);
  }

  render(): void {
    const selectedId = this.getSelectedId();
    this.treeElement.innerHTML = '';
    this.renderNode(this.getSchema().root, 0, true, selectedId);
  }

  private renderNode(node: ComponentNode, depth: number, root: boolean, selectedId: string | null): void {
    const definition = getDefinition(node.type);
    const row = document.createElement('div');
    row.className = 'layer-row';
    row.classList.toggle('selected', node.id === selectedId);
    row.style.paddingLeft = `${8 + depth * 14}px`;
    row.innerHTML = `
      <span class="layer-icon">${definition.icon}</span>
      <span class="layer-name">${root ? '页面根节点' : definition.label}</span>
    `;
    row.addEventListener('click', () => this.handlers.onSelect(root ? null : node.id));

    if (!root) {
      const actions = document.createElement('span');
      actions.className = 'layer-actions';
      const up = document.createElement('button');
      up.type = 'button';
      up.textContent = '↑';
      up.title = '上移';
      up.addEventListener('click', (event) => {
        event.stopPropagation();
        this.handlers.onMove(node.id, -1);
      });
      const down = document.createElement('button');
      down.type = 'button';
      down.textContent = '↓';
      down.title = '下移';
      down.addEventListener('click', (event) => {
        event.stopPropagation();
        this.handlers.onMove(node.id, 1);
      });
      actions.append(up, down);
      row.appendChild(actions);
    }

    this.treeElement.appendChild(row);
    node.children.forEach((child) => this.renderNode(child, depth + 1, false, selectedId));
  }
}
