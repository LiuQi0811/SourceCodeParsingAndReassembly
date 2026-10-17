export type DeviceWidth = 'pc' | 'tablet' | 'phone';

export interface ToolbarState {
  canUndo: boolean;
  canRedo: boolean;
  previewing: boolean;
  device: DeviceWidth;
}

interface ToolbarCallbacks {
  onUndo: () => void;
  onRedo: () => void;
  onTogglePreview: () => void;
  onImport: (file: File) => void;
  onExportHtml: () => void;
  onClear: () => void;
  onDevice: (device: DeviceWidth) => void;
}

const DEVICES: DeviceWidth[] = ['pc', 'tablet', 'phone'];
const DEVICE_LABELS: Record<DeviceWidth, string> = { pc: 'PC', tablet: '平板', phone: '手机' };

export class Toolbar {
  readonly element: HTMLElement;
  private state: ToolbarState;
  private readonly undoButton: HTMLButtonElement;
  private readonly redoButton: HTMLButtonElement;
  private readonly previewButton: HTMLButtonElement;
  private readonly deviceButtons = new Map<DeviceWidth, HTMLButtonElement>();

  constructor(initial: ToolbarState, private readonly callbacks: ToolbarCallbacks) {
    this.state = initial;
    this.element = document.createElement('header');
    this.element.className = 'toolbar';
    this.element.innerHTML = `
      <div class="brand">
        <span class="brand-mark"></span>
        <div><strong>低代码页面编辑器</strong><small>Visual Page Builder MVP</small></div>
      </div>
      <div class="toolbar-actions">
        <button type="button" data-action="undo">撤销</button>
        <button type="button" data-action="redo">重做</button>
        <span class="toolbar-divider"></span>
        <button type="button" data-action="preview">预览</button>
        <button type="button" data-action="import-json">导入</button>
        <button type="button" data-action="export-html">导出 HTML</button>
        <button type="button" data-action="clear" class="danger">清空</button>
        <span class="toolbar-divider"></span>
        <div class="device-switch" role="group" aria-label="画布宽度"></div>
      </div>
    `;

    this.undoButton = this.query('[data-action="undo"]');
    this.redoButton = this.query('[data-action="redo"]');
    this.previewButton = this.query('[data-action="preview"]');

    const deviceSwitch = this.element.querySelector('.device-switch') as HTMLElement;
    DEVICES.forEach((device) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.device = device;
      button.textContent = DEVICE_LABELS[device];
      button.addEventListener('click', () => this.callbacks.onDevice(device));
      deviceSwitch.appendChild(button);
      this.deviceButtons.set(device, button);
    });

    this.undoButton.addEventListener('click', () => this.callbacks.onUndo());
    this.redoButton.addEventListener('click', () => this.callbacks.onRedo());
    this.previewButton.addEventListener('click', () => this.callbacks.onTogglePreview());
    this.query('[data-action="export-html"]').addEventListener('click', () => this.callbacks.onExportHtml());
    this.query('[data-action="clear"]').addEventListener('click', () => this.callbacks.onClear());
    this.query('[data-action="import-json"]').addEventListener('click', () => this.pickJsonFile());

    this.sync();
  }

  setState(partial: Partial<ToolbarState>): void {
    this.state = { ...this.state, ...partial };
    this.sync();
  }

  private query(selector: string): HTMLButtonElement {
    const button = this.element.querySelector<HTMLButtonElement>(selector);
    if (!button) throw new Error(`Toolbar 缺少按钮：${selector}`);
    return button;
  }

  // DOM 只构建一次，状态变化仅同步按钮属性，避免整块 innerHTML 重建与重复绑定事件。
  private sync(): void {
    this.undoButton.disabled = !this.state.canUndo;
    this.redoButton.disabled = !this.state.canRedo;
    this.previewButton.textContent = this.state.previewing ? '退出预览' : '预览';
    this.deviceButtons.forEach((button, device) => {
      button.classList.toggle('active', this.state.device === device);
    });
  }

  private pickJsonFile(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (file) this.callbacks.onImport(file);
    });
    input.click();
  }
}
