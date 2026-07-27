// Notification.ts —— 通知提醒框（命令式 API）
import { h } from '../../core/utils.js';

type NotificationType = 'success' | 'warning' | 'error' | 'info';

const ICONS: Record<NotificationType, string> = { success: '✓', warning: '!', error: '✕', info: 'ℹ' };

function getContainer(): HTMLElement | null {
  return document.getElementById('global-notification-container');
}

function _show(
  type: NotificationType,
  title: Node | string,
  description: Node | string | null | undefined,
  duration = 4.5,
): (() => void) | undefined {
  const container = getContainer();
  if (!container) return;

  const notif = h('div', { class: `notification notification--${type}`, role: 'alert' },
    h('div', { class: 'notification__icon' }, ICONS[type] || ICONS.info),
    h('div', { class: 'flex-1' },
      h('div', { class: 'notification__title' }, title),
      description && h('div', { class: 'notification__desc' }, description),
    ),
    h('span', { class: 'notification__close', onClick: () => close() }, '×'),
  ) as HTMLElement;
  container.appendChild(notif);

  const close = (): void => {
    notif.classList.add('is-leave');
    notif.addEventListener('animationend', () => notif.remove(), { once: true });
  };

  if (duration > 0) setTimeout(close, duration * 1000);
  return close;
}

export interface NotificationOpenOptions {
  type?: NotificationType;
  title: Node | string;
  description?: Node | string | null;
  duration?: number;
}

export const notification = {
  success: (title: Node | string, desc?: Node | string | null, dur?: number): (() => void) | undefined => _show('success', title, desc, dur),
  warning: (title: Node | string, desc?: Node | string | null, dur?: number): (() => void) | undefined => _show('warning', title, desc, dur),
  error: (title: Node | string, desc?: Node | string | null, dur?: number): (() => void) | undefined => _show('error', title, desc, dur),
  info: (title: Node | string, desc?: Node | string | null, dur?: number): (() => void) | undefined => _show('info', title, desc, dur),
  open: (opts: NotificationOpenOptions): (() => void) | undefined => _show(opts.type || 'info', opts.title, opts.description, opts.duration),
};
