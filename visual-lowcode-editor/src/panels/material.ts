import { getDefinitions } from '../core/registry';
import type { ComponentType } from '../core/schema';

export class MaterialPanel {
  readonly element: HTMLElement;

  constructor(
    private readonly onDragStart: (event: PointerEvent, type: ComponentType) => void,
    private readonly onAdd: (type: ComponentType) => void,
  ) {
    this.element = document.createElement('aside');
    this.element.className = 'panel material-panel';
    this.element.innerHTML = '<div class="panel-title">物料</div>';
    const list = document.createElement('div');
    list.className = 'material-list';

    getDefinitions().forEach((definition) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'material-item';
      item.dataset.componentType = definition.type;
      item.innerHTML = `
        <span class="material-icon">${definition.icon}</span>
        <span class="material-copy">
          <strong>${definition.label}</strong>
          <small>${definition.description}</small>
        </span>
      `;
      item.addEventListener('pointerdown', (event) => this.onDragStart(event, definition.type));
      item.addEventListener('click', () => this.onAdd(definition.type));
      list.appendChild(item);
    });

    this.element.appendChild(list);
  }
}
