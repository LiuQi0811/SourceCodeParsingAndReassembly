// Message.ts —— 全局消息（工厂模式 + 命令式 API）
// 演示 MDN：DOM 增删、setTimeout、animationend
import { h } from '../../core/utils.js';
const ICONS = {
    success: '✓', warning: '!', error: '✕', info: 'ℹ', loading: '◌',
};
function getContainer() {
    return document.getElementById('global-message-container');
}
function _show(type, content, duration = 3) {
    const container = getContainer();
    if (!container)
        return;
    const msg = h('div', { class: `message message--${type}` }, h('span', { class: 'message__icon' }, ICONS[type] || ICONS.info), h('span', {}, content));
    container.appendChild(msg);
    const close = () => {
        msg.classList.add('is-leave');
        msg.addEventListener('animationend', () => msg.remove(), { once: true });
    };
    if (duration > 0 && type !== 'loading') {
        setTimeout(close, duration * 1000);
    }
    return close;
}
export const message = {
    success: (content, duration) => _show('success', content, duration),
    warning: (content, duration) => _show('warning', content, duration),
    error: (content, duration) => _show('error', content, duration),
    info: (content, duration) => _show('info', content, duration),
    loading: (content) => _show('loading', content, 0),
    /** 用于演示 Promise + message 流程 */
    async withLoading(loadingText, task, successText) {
        const close = _show('loading', loadingText, 0);
        try {
            const result = await task();
            close?.();
            if (successText)
                _show('success', successText);
            return result;
        }
        catch (err) {
            close?.();
            _show('error', err.message || '操作失败');
            throw err;
        }
    },
};
//# sourceMappingURL=Message.js.map