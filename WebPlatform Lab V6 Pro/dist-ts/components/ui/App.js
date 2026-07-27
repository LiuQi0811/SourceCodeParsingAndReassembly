// App.ts —— 全局应用容器组件（对标 antd 5.x App 组件）
// 主要能力：
//   1. 提供应用级根容器，统一注入根类名（影响后代组件样式作用域）
//   2. 暴露 message / notification / modal 的"实例化"静态方法，
//      使弹出层挂载在 App 范围内（而非 document.body），便于样式作用域隔离与卸载清理
//   3. 支持 subApp（嵌套 App），通过 rootClassName 区分作用域
import { Component } from '../../core/Component.js';
import { h } from '../../core/utils.js';
import { message as globalMessage } from './Message.js';
import { notification as globalNotification } from './Notification.js';
import { confirm as globalConfirm } from './Modal.js';
// 全局已挂载的 App 实例栈：支持嵌套，最近一次 mount 的 App 作为当前上下文
const _appStack = [];
/**
 * 取当前激活的 App 上下文（最近挂载的 App）。
 * 未挂载任何 App 时返回 null，调用方应回退到全局静态方法。
 */
export function getAppContext() {
    return _appStack.length > 0 ? _appStack[_appStack.length - 1] : null;
}
/**
 * 把命令式 API 包装成"挂载到指定 root"的版本。
 * 这里复用全局 message/notification/confirm 的实现，
 * 但通过 root 参数让它们的容器限定在 App 根节点内。
 * 注：message/notification 的 getContainer 默认查 #global-message-container，
 * 这里通过在 App 内部插入同名容器并优先匹配的方式实现"作用域内渲染"。
 */
function _scopedAPI(root) {
    // 在 root 内部插入作用域容器（若尚未存在）
    const ensureScope = (id, className) => {
        let el = root.querySelector(`#${id}`);
        if (!el) {
            el = h('div', { id, class: className, 'aria-live': 'polite' });
            root.appendChild(el);
        }
        return el;
    };
    const msgContainer = ensureScope('app-message-container', 'global-message-container');
    const notifContainer = ensureScope('app-notification-container', 'global-notification-container');
    // 作用域版 message：临时把 getContainer 指向 App 内部容器
    // 由于 message 模块直接读 #global-message-container，这里采用"双写"策略：
    // 渲染到 App 容器（视觉上挂在 App 内）的同时保持全局 API 兼容。
    const message = {
        success: (c, d) => _scopedShow(msgContainer, 'success', c, d),
        warning: (c, d) => _scopedShow(msgContainer, 'warning', c, d),
        error: (c, d) => _scopedShow(msgContainer, 'error', c, d),
        info: (c, d) => _scopedShow(msgContainer, 'info', c, d),
        loading: (c) => _scopedShow(msgContainer, 'loading', c, 0),
    };
    const notification = {
        success: (t, d, dur) => _scopedNotif(notifContainer, 'success', t, d, dur),
        warning: (t, d, dur) => _scopedNotif(notifContainer, 'warning', t, d, dur),
        error: (t, d, dur) => _scopedNotif(notifContainer, 'error', t, d, dur),
        info: (t, d, dur) => _scopedNotif(notifContainer, 'info', t, d, dur),
        open: (opts) => _scopedNotif(notifContainer, opts.type || 'info', opts.title, opts.description, opts.duration),
    };
    // confirm 弹层本身就是 portal 到 document.body，App 作用域不改变其挂载点
    const modal = { confirm: globalConfirm };
    return { message, notification, modal };
}
// 作用域版 message 渲染（复用全局 ICONS 逻辑，避免循环依赖）
const _MSG_ICONS = { success: '✓', warning: '!', error: '✕', info: 'ℹ', loading: '◌' };
function _scopedShow(container, type, content, duration = 3) {
    if (!container)
        return () => { };
    const msg = h('div', { class: `message message--${type}` }, h('span', { class: 'message__icon' }, _MSG_ICONS[type] || _MSG_ICONS.info), h('span', {}, content));
    container.appendChild(msg);
    const close = () => {
        msg.classList.add('is-leave');
        msg.addEventListener('animationend', () => msg.remove(), { once: true });
    };
    if (duration > 0 && type !== 'loading')
        setTimeout(close, duration * 1000);
    return close;
}
const _NOTIF_ICONS = { success: '✓', warning: '!', error: '✕', info: 'ℹ' };
function _scopedNotif(container, type, title, description, duration = 4.5) {
    if (!container)
        return () => { };
    const notif = h('div', { class: `notification notification--${type}`, role: 'alert' }, h('div', { class: 'notification__icon' }, _NOTIF_ICONS[type] || _NOTIF_ICONS.info), h('div', { class: 'flex-1' }, h('div', { class: 'notification__title' }, title), description && h('div', { class: 'notification__desc' }, description)), h('span', { class: 'notification__close', onClick: () => close() }, '×'));
    container.appendChild(notif);
    const close = () => {
        notif.classList.add('is-leave');
        notif.addEventListener('animationend', () => notif.remove(), { once: true });
    };
    if (duration > 0)
        setTimeout(close, duration * 1000);
    return close;
}
export class App extends Component {
    initialState() {
        return { message: null, notification: null, modal: null };
    }
    componentDidMount() {
        // 入栈：使本 App 成为当前激活上下文
        _appStack.push(this);
        // 构造作用域 API 实例并缓存到 state，供 useApp 风格调用
        const api = _scopedAPI(this.el);
        this.state.message = api.message;
        this.state.notification = api.notification;
        this.state.modal = api.modal;
        // 兼容：把作用域容器 id 同步挂到根，便于外部 CSS 选择器作用域化
        this.el.classList.add('app-root');
    }
    componentWillUnmount() {
        // 出栈：移除当前 App
        const idx = _appStack.indexOf(this);
        if (idx >= 0)
            _appStack.splice(idx, 1);
        // 清理作用域容器（卸载时连带移除内部 message/notification DOM）
        if (this.el) {
            this.el.querySelectorAll('#app-message-container, #app-notification-container').forEach((n) => n.remove());
        }
    }
    /** 获取本 App 的作用域 API（对标 antd 的 useApp hook） */
    useApp() {
        return {
            message: this.state.message || globalMessage,
            notification: this.state.notification || globalNotification,
            modal: this.state.modal || { confirm: globalConfirm },
        };
    }
    render() {
        const { children, rootClassName = '', direction, componentSize, } = this.props;
        const classes = ['app', rootClassName].filter(Boolean).join(' ');
        return h('div', {
            class: classes,
            dir: direction,
            'data-component-size': componentSize || undefined,
        }, children);
    }
}
/**
 * 静态便捷方法：直接取当前激活 App 的作用域 API。
 * 未挂载任何 App 时回退到全局 message/notification/confirm。
 */
export const app = {
    useApp() {
        const ctx = getAppContext();
        if (ctx)
            return ctx.useApp();
        return {
            message: globalMessage,
            notification: globalNotification,
            modal: { confirm: globalConfirm },
        };
    },
};
//# sourceMappingURL=App.js.map