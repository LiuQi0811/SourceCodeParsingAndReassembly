// Notification.ts —— 通知提醒框（命令式 API）
import { h } from '../../core/utils.js';
const ICONS = { success: '✓', warning: '!', error: '✕', info: 'ℹ' };
function getContainer() {
    return document.getElementById('global-notification-container');
}
function _show(type, title, description, duration = 4.5) {
    const container = getContainer();
    if (!container)
        return;
    const notif = h('div', { class: `notification notification--${type}`, role: 'alert' }, h('div', { class: 'notification__icon' }, ICONS[type] || ICONS.info), h('div', { class: 'flex-1' }, h('div', { class: 'notification__title' }, title), description && h('div', { class: 'notification__desc' }, description)), h('span', { class: 'notification__close', onClick: () => close() }, '×'));
    container.appendChild(notif);
    const close = () => {
        notif.classList.add('is-leave');
        notif.addEventListener('animationend', () => notif.remove(), { once: true });
    };
    if (duration > 0)
        setTimeout(close, duration * 1000);
    return close;
}
export const notification = {
    success: (title, desc, dur) => _show('success', title, desc, dur),
    warning: (title, desc, dur) => _show('warning', title, desc, dur),
    error: (title, desc, dur) => _show('error', title, desc, dur),
    info: (title, desc, dur) => _show('info', title, desc, dur),
    open: (opts) => _show(opts.type || 'info', opts.title, opts.description, opts.duration),
};
//# sourceMappingURL=Notification.js.map