// Message.ts —— 全局消息（工厂模式 + 命令式 API）
// 演示 MDN：DOM 增删、setTimeout、animationend
import { h, formatTime } from '../../core/utils.js';

type MessageType = 'success' | 'warning' | 'error' | 'info' | 'loading';

const ICONS: Record<MessageType, string> = {
  success: '✓', warning: '!', error: '✕', info: 'ℹ', loading: '◌',
};

function getContainer(): HTMLElement | null {
  return document.getElementById('global-message-container');
}

function _show(type: MessageType, content: Node | string, duration = 3): (() => void) | undefined {
  const container = getContainer();
  if (!container) return;

  const msg = h('div', { class: `message message--${type}` },
    h('span', { class: 'message__icon' }, ICONS[type] || ICONS.info),
    h('span', {}, content),
  ) as HTMLElement;
  container.appendChild(msg);

  const close = (): void => {
    msg.classList.add('is-leave');
    msg.addEventListener('animationend', () => msg.remove(), { once: true });
  };

  if (duration > 0 && type !== 'loading') {
    setTimeout(close, duration * 1000);
  }
  return close;
}

export const message = {
  success: (content: Node | string, duration?: number): (() => void) | undefined => _show('success', content, duration),
  warning: (content: Node | string, duration?: number): (() => void) | undefined => _show('warning', content, duration),
  error: (content: Node | string, duration?: number): (() => void) | undefined => _show('error', content, duration),
  info: (content: Node | string, duration?: number): (() => void) | undefined => _show('info', content, duration),
  loading: (content: Node | string): (() => void) | undefined => _show('loading', content, 0),
  /** 用于演示 Promise + message 流程 */
  async withLoading<T>(loadingText: Node | string, task: () => Promise<T>, successText?: Node | string): Promise<T> {
    const close = _show('loading', loadingText, 0);
    try {
      const result = await task();
      close?.();
      if (successText) _show('success', successText);
      return result;
    } catch (err) {
      close?.();
      _show('error', (err as Error).message || '操作失败');
      throw err;
    }
  },
};
