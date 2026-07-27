// StoragePage.ts —— Storage 实验室：localStorage / sessionStorage / Cookie / IndexedDB
// 演示 MDN：Storage API、document.cookie、StorageEvent、indexedDB（简介）、JSON
import { Page } from '../../core/Component.js';
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Input } from '../../components/ui/Input.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';
import { message } from '../../components/ui/Message.js';
const STORAGE_PREFIX = 'mdn-lab:';
export class StoragePage extends Page {
    _onStorage = null;
    initialState() {
        return {
            key: 'demo',
            value: '{"hello":"world"}',
            localItems: this._snapshot('localStorage'),
            sessionItems: this._snapshot('sessionStorage'),
            cookies: this._snapshotCookies(),
            events: [],
        };
    }
    _snapshot(type) {
        const store = window[type];
        const items = [];
        for (let i = 0; i < store.length; i++) {
            const k = store.key(i);
            if (!k || !k.startsWith(STORAGE_PREFIX))
                continue;
            items.push({ key: k, value: store.getItem(k) });
        }
        return items;
    }
    _snapshotCookies() {
        if (!document.cookie)
            return [];
        return document.cookie.split('; ').map((pair) => {
            const [k, ...rest] = pair.split('=');
            return { key: k, value: decodeURIComponent(rest.join('=')) };
        });
    }
    _refresh() {
        this.setState({
            localItems: this._snapshot('localStorage'),
            sessionItems: this._snapshot('sessionStorage'),
            cookies: this._snapshotCookies(),
        });
    }
    componentDidMount() {
        // 跨标签页 Storage 事件监听
        this._onStorage = (e) => {
            this.setState({
                events: [...this.state.events, {
                        time: formatTime(),
                        key: e.key,
                        oldValue: e.oldValue,
                        newValue: e.newValue,
                        url: e.url,
                    }].slice(-20),
            });
            this._refresh();
        };
        window.addEventListener('storage', this._onStorage);
    }
    componentWillUnmount() {
        if (this._onStorage) {
            window.removeEventListener('storage', this._onStorage);
        }
    }
    _btn(label, opts) {
        const btn = new Button({ ...opts, children: label, onClick: opts.onClick });
        this.registerChild(btn);
        return btn.render();
    }
    _operate(type, action) {
        const store = window[type];
        const fullKey = STORAGE_PREFIX + this.state.key;
        try {
            if (action === 'set') {
                store.setItem(fullKey, this.state.value);
                message.success(`${type}.setItem 已写入`);
            }
            else if (action === 'get') {
                const v = store.getItem(fullKey);
                message.info(v == null ? '值为空' : `读取：${v}`);
            }
            else if (action === 'remove') {
                store.removeItem(fullKey);
                message.warning(`${type}.removeItem 已删除`);
            }
            else if (action === 'clear') {
                // 仅清除本前缀
                for (let i = store.length - 1; i >= 0; i--) {
                    const k = store.key(i);
                    if (k && k.startsWith(STORAGE_PREFIX))
                        store.removeItem(k);
                }
                message.warning(`已清空 ${type} 中前缀项`);
            }
            this._refresh();
        }
        catch (err) {
            message.error(err.message);
        }
    }
    _operateCookie(action) {
        const name = STORAGE_PREFIX + this.state.key;
        if (action === 'set') {
            const expires = new Date(Date.now() + 7 * 864e5).toUTCString();
            document.cookie = `${name}=${encodeURIComponent(this.state.value)}; expires=${expires}; path=/; SameSite=Lax`;
            message.success('Cookie 已写入');
        }
        else if (action === 'remove') {
            document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
            message.warning('Cookie 已删除');
        }
        this._refresh();
    }
    renderPage() {
        const keyInput = new Input({
            value: this.state.key, size: 'sm', style: { width: '160px' },
            onChange: (v) => { this.state.key = v; },
        });
        this.registerChild(keyInput);
        const valueInput = new Input({
            value: this.state.value, size: 'sm', style: { width: '320px' },
            onChange: (v) => { this.state.value = v; },
        });
        this.registerChild(valueInput);
        const renderTable = (title, items, type) => h(Card, { title, extra: h(Tag, { color: 'primary' }, `${items.length} 项`) }, items.length === 0
            ? h('div', { class: 'fs-sm text-tertiary' }, '（暂无数据，使用上方表单写入）')
            : h('div', { class: 'storage-list' }, ...items.map((item) => h('div', { class: 'storage-list__item' }, h('div', { class: 'storage-list__key' }, item.key), h('div', { class: 'storage-list__value' }, item.value), h('button', {
                type: 'button',
                class: 'btn btn--sm btn--danger',
                onClick: () => {
                    if (type === 'cookie') {
                        document.cookie = `${item.key}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
                    }
                    else if (type === 'localStorage' || type === 'sessionStorage') {
                        window[type].removeItem(item.key);
                    }
                    this._refresh();
                },
            }, '×')))));
        return [
            h('h2', { class: 'section-title' }, 'Storage 实验室'),
            h(Alert, {
                type: 'info',
                message: 'localStorage / sessionStorage / Cookie 三大持久化方案对比',
                description: 'localStorage 永久保存；sessionStorage 仅当前标签页会话；Cookie 会随请求发送到服务端。所有写入均带 "mdn-lab:" 前缀，避免污染。',
            }),
            // 写入表单
            h(Card, { title: '写入 / 读取 / 删除', extra: '统一操作面板' }, h('div', { class: 'flex flex-col gap-sm' }, h('div', { class: 'flex items-center gap-sm flex-wrap' }, h('span', { class: 'fs-sm text-secondary', style: { width: '50px' } }, 'key'), keyInput.render(), h('span', { class: 'fs-sm text-secondary', style: { width: '50px' } }, 'value'), valueInput.render()), h('div', { class: 'flex flex-wrap gap-sm' }, this._btn('localStorage.set', { type: 'primary', size: 'sm', onClick: () => this._operate('localStorage', 'set') }), this._btn('localStorage.get', { size: 'sm', onClick: () => this._operate('localStorage', 'get') }), this._btn('localStorage.remove', { size: 'sm', onClick: () => this._operate('localStorage', 'remove') }), this._btn('session.set', { type: 'primary', size: 'sm', onClick: () => this._operate('sessionStorage', 'set') }), this._btn('session.get', { size: 'sm', onClick: () => this._operate('sessionStorage', 'get') }), this._btn('session.remove', { size: 'sm', onClick: () => this._operate('sessionStorage', 'remove') }), this._btn('cookie.set', { type: 'success', size: 'sm', onClick: () => this._operateCookie('set') }), this._btn('cookie.remove', { danger: true, size: 'sm', onClick: () => this._operateCookie('remove') }), this._btn('清空所有前缀项', { danger: true, size: 'sm', onClick: () => {
                    this._operate('localStorage', 'clear');
                    this._operate('sessionStorage', 'clear');
                } })))),
            // 三栏对比
            h('div', { class: 'storage-grid mt-lg' }, renderTable('localStorage', this.state.localItems, 'localStorage'), renderTable('sessionStorage', this.state.sessionItems, 'sessionStorage'), renderTable('Cookie', this.state.cookies, 'cookie')),
            // Storage 事件（跨标签页通信）
            h(Card, { title: 'storage 事件（跨标签页通信）', extra: h(Tag, { color: 'warning' }, '打开两个标签页测试') }, this.state.events.length === 0
                ? h('p', { class: 'fs-sm text-tertiary' }, '在另一个标签页修改 localStorage 时，本标签页会收到 storage 事件。')
                : h('div', { class: 'log-panel' }, ...this.state.events.map((e) => h('div', { class: 'log-panel__line' }, h('span', { class: 'log-panel__time' }, e.time), h('span', { class: 'log-panel__tag log-panel__tag--push' }, 'storage'), h('span', {}, `${e.key}  ${e.oldValue} → ${e.newValue}`))))),
        ];
    }
}
//# sourceMappingURL=StoragePage.js.map