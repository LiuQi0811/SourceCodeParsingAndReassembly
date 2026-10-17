import { generateStandaloneHtml } from './export';
import type { PageSchema } from '../core/schema';

const PREVIEW_DEBOUNCE_MS = 200;

export class PreviewManager {
  private readonly iframe: HTMLIFrameElement;
  private readonly container: HTMLElement;
  private updateTimer: number | undefined;

  constructor(container: HTMLElement) {
    this.container = container;
    this.iframe = document.createElement('iframe');
    this.iframe.className = 'lc-preview-frame';
    this.iframe.title = '页面预览';
    this.iframe.setAttribute('sandbox', 'allow-same-origin');
    container.appendChild(this.iframe);
  }

  update(schema: PageSchema): void {
    window.clearTimeout(this.updateTimer);
    this.updateTimer = undefined;
    this.iframe.srcdoc = generateStandaloneHtml(schema);
  }

  // 编辑过程中 Schema 频繁变化，防抖后再重建 srcdoc，避免每次按键都重新生成整页 HTML。
  requestUpdate(schema: PageSchema): void {
    window.clearTimeout(this.updateTimer);
    this.updateTimer = window.setTimeout(() => {
      this.updateTimer = undefined;
      this.iframe.srcdoc = generateStandaloneHtml(schema);
    }, PREVIEW_DEBOUNCE_MS);
  }

  show(): void {
    this.container.classList.remove('hidden');
  }

  hide(): void {
    this.container.classList.add('hidden');
  }
}
