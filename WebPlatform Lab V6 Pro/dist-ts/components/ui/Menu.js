// Menu.ts —— 导航菜单（参考 antd Menu，支持横向/纵向/子菜单）
// 横向模式的子菜单 popup 使用 portal 到 document.body，避免被父级 Card overflow:hidden 裁剪
import { Component } from '../../core/Component.js';
import { h } from '../../core/utils.js';
/**
 * 把 antd 风格的 items 数组规范化
 * item: { key, label, icon, disabled, danger, children, type: 'group'|'divider' }
 */
function normalizeItems(items) {
    if (!Array.isArray(items))
        return [];
    return items.filter(Boolean).map((it) => ({
        key: it.key,
        label: it.label,
        icon: it.icon,
        disabled: !!it.disabled,
        danger: !!it.danger,
        type: it.type,
        children: Array.isArray(it.children) ? normalizeItems(it.children) : null,
    }));
}
/** 在 items 树中查找指定 key 的节点 */
function findItem(items, key) {
    for (const it of items) {
        if (it.key === key)
            return it;
        if (it.children) {
            const f = findItem(it.children, key);
            if (f)
                return f;
        }
    }
    return null;
}
/**
 * 导航菜单
 * props:
 *   - items: Array<{key, label, icon, disabled, danger, children, type}>
 *   - mode: 'horizontal' | 'vertical' | 'inline'（默认 horizontal）
 *   - theme: 'light' | 'dark'（默认 light）
 *   - selectedKeys: string[]
 *   - openKeys: string[]（inline 模式下展开的子菜单 key）
 *   - onSelect: ({ key, item, keyPath }) => void
 *   - onOpenChange: (openKeys) => void
 *   - multiple: boolean（默认 false）
 */
export class Menu extends Component {
    _onDocClick = null;
    _onScrollResize = null;
    _popupEl = null;
    _hideTimer = undefined;
    initialState() {
        return {
            selectedKeys: new Set(this.props.selectedKeys || []),
            openKeys: new Set(this.props.openKeys || []),
            // 横向模式下当前 popup 打开的子菜单 key（hover 切换）
            popupKey: null,
        };
    }
    componentDidMount() {
        // 横向模式：popup 用 portal，需要全局监听以处理点击外部关闭、scroll/resize 重新定位
        if (this._isHorizontal()) {
            this._onDocClick = (e) => {
                if (!this.state.popupKey)
                    return;
                // 点击在 trigger 或 popup 内则不处理（由对应 handler 处理）
                if (this.el && this.el.contains(e.target))
                    return;
                if (this._popupEl && this._popupEl.contains(e.target))
                    return;
                this._closePopup();
            };
            this._onScrollResize = () => { if (this.state.popupKey)
                this._positionPopup(); };
            document.addEventListener('click', this._onDocClick);
            window.addEventListener('scroll', this._onScrollResize, true);
            window.addEventListener('resize', this._onScrollResize);
        }
    }
    componentWillUnmount() {
        if (this._onDocClick)
            document.removeEventListener('click', this._onDocClick);
        if (this._onScrollResize) {
            window.removeEventListener('scroll', this._onScrollResize, true);
            window.removeEventListener('resize', this._onScrollResize);
        }
        // 清理 portal 元素
        this._popupEl?.remove();
        clearTimeout(this._hideTimer);
    }
    _isHorizontal() { return this.props.mode === 'horizontal' || !this.props.mode; }
    _select(key) {
        const item = findItem(this.props.items || [], key);
        if (!item || item.disabled)
            return;
        const multiple = this.props.multiple;
        let next;
        if (multiple) {
            next = new Set(this.state.selectedKeys);
            if (next.has(key))
                next.delete(key);
            else
                next.add(key);
        }
        else {
            next = new Set([key]);
        }
        this.setState({ selectedKeys: next });
        const keyPath = this._keyPath(this.props.items || [], key);
        this.props.onSelect?.({ key, item, keyPath });
        // 选中后关闭 popup
        if (this.state.popupKey)
            this._closePopup();
    }
    _keyPath(items, key, path = []) {
        for (const it of items) {
            if (it.key === key)
                return [key, ...path];
            if (it.children) {
                const r = this._keyPath(it.children, key, [it.key, ...path]);
                if (r)
                    return r;
            }
        }
        return null;
    }
    _toggleOpen(key) {
        const next = new Set(this.state.openKeys);
        if (next.has(key))
            next.delete(key);
        else
            next.add(key);
        this.setState({ openKeys: next });
        this.props.onOpenChange?.([...next]);
    }
    /** 横向模式：打开子菜单 popup（portal 到 body） */
    _openPopup(key, item) {
        clearTimeout(this._hideTimer);
        // 构建 popup 内容
        const popup = h('ul', {
            class: 'menu__popup',
            role: 'menu',
            // 鼠标移到 popup 上时取消关闭
            onMouseenter: () => { clearTimeout(this._hideTimer); },
            onMouseleave: () => { this._scheduleHidePopup(); },
        }, ...this._renderChildren(item.children || []));
        // 移除旧 popup
        this._popupEl?.remove();
        this._popupEl = popup;
        document.body.appendChild(popup);
        this.setState({ popupKey: key });
        this._positionPopup();
    }
    _closePopup() {
        clearTimeout(this._hideTimer);
        this.setState({ popupKey: null });
        this._popupEl?.remove();
        this._popupEl = null;
    }
    _scheduleHidePopup() {
        clearTimeout(this._hideTimer);
        this._hideTimer = setTimeout(() => this._closePopup(), 120);
    }
    /** 计算 popup 位置：基于 trigger 的 boundingRect */
    _positionPopup() {
        if (!this._popupEl || !this.state.popupKey)
            return;
        const trigger = this.el?.querySelector(`[data-submenu-key="${this.state.popupKey}"]`);
        if (!trigger)
            return;
        const rect = trigger.getBoundingClientRect();
        const popup = this._popupEl;
        // 先临时设为可见以测量尺寸
        popup.style.visibility = 'hidden';
        popup.style.left = '0px';
        popup.style.top = '0px';
        popup.style.display = 'block';
        const pw = popup.offsetWidth;
        // 横向模式下，popup 在 trigger 下方，左对齐
        const left = rect.left;
        const top = rect.bottom + 2;
        popup.style.left = `${left + (window.scrollX || 0)}px`;
        popup.style.top = `${top + (window.scrollY || 0)}px`;
        popup.style.visibility = '';
        void pw;
    }
    /** 渲染单个菜单项（叶子节点） */
    _renderItem(item) {
        const selected = this.state.selectedKeys.has(item.key);
        const classes = [
            'menu__item',
            selected && 'is-selected',
            item.disabled && 'is-disabled',
            item.danger && 'menu__item--danger',
        ].filter(Boolean).join(' ');
        return h('li', {
            class: classes,
            role: 'menuitem',
            tabindex: item.disabled ? '-1' : '0',
            'aria-disabled': item.disabled ? 'true' : undefined,
            'aria-selected': selected ? 'true' : 'false',
            title: typeof item.label === 'string' ? item.label : undefined,
            onClick: (e) => {
                e.stopPropagation();
                if (!item.disabled)
                    this._select(item.key);
            },
            onKeyDown: (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    if (!item.disabled)
                        this._select(item.key);
                }
            },
        }, item.icon && h('span', { class: 'menu__item-icon' }, item.icon), h('span', { class: 'menu__item-label' }, item.label));
    }
    /** 渲染子菜单（含子项） */
    _renderSubMenu(item) {
        const horizontal = this._isHorizontal();
        // 横向模式：popup 用 portal，子菜单容器本身不渲染 children
        if (horizontal) {
            const isPopup = this.state.popupKey === item.key;
            const hasSelectedChild = this._hasSelectedChild(item.children);
            const classes = [
                'menu__submenu',
                isPopup && 'is-open',
                hasSelectedChild && 'has-selected-child',
            ].filter(Boolean).join(' ');
            const title = h('div', {
                class: 'menu__submenu-title',
                role: 'menuitem',
                tabindex: '0',
                'aria-expanded': String(isPopup),
                'aria-haspopup': 'true',
                'data-submenu-key': item.key,
                onMouseenter: () => {
                    // 进入 trigger：打开对应 popup（替换当前打开的）
                    this._openPopup(item.key, item);
                },
                onMouseleave: () => { this._scheduleHidePopup(); },
                onClick: (e) => {
                    e.stopPropagation();
                    // 点击也支持切换（移动端友好）
                    if (isPopup)
                        this._closePopup();
                    else
                        this._openPopup(item.key, item);
                },
                onKeyDown: (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        if (isPopup)
                            this._closePopup();
                        else
                            this._openPopup(item.key, item);
                    }
                    else if (e.key === 'Escape' && isPopup) {
                        this._closePopup();
                    }
                },
            }, item.icon && h('span', { class: 'menu__item-icon' }, item.icon), h('span', { class: 'menu__item-label' }, item.label), h('span', { class: 'menu__submenu-arrow' }, '▾'));
            return h('li', { class: classes, role: 'presentation' }, title);
        }
        // inline/vertical 模式：children 内嵌，由 openKeys 控制展开
        const isOpen = this.state.openKeys.has(item.key);
        const hasSelectedChild = this._hasSelectedChild(item.children);
        const classes = [
            'menu__submenu',
            isOpen && 'is-open',
            hasSelectedChild && 'has-selected-child',
        ].filter(Boolean).join(' ');
        const title = h('div', {
            class: 'menu__submenu-title',
            role: 'menuitem',
            tabindex: '0',
            'aria-expanded': String(isOpen),
            'aria-haspopup': 'true',
            onClick: (e) => {
                e.stopPropagation();
                this._toggleOpen(item.key);
            },
            onKeyDown: (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    this._toggleOpen(item.key);
                }
            },
        }, item.icon && h('span', { class: 'menu__item-icon' }, item.icon), h('span', { class: 'menu__item-label' }, item.label), h('span', { class: 'menu__submenu-arrow' }, isOpen ? '▾' : '▸'));
        const childClasses = [
            'menu__submenu-children',
            'menu__submenu-children--inline',
            isOpen ? 'is-open' : 'is-closed',
        ].join(' ');
        return h('li', { class: classes, role: 'presentation' }, title, h('ul', { class: childClasses, role: 'menu' }, ...this._renderChildren(item.children)));
    }
    _hasSelectedChild(children) {
        if (!children)
            return false;
        return children.some((c) => {
            if (c.type === 'divider' || c.type === 'group')
                return false;
            if (this.state.selectedKeys.has(c.key))
                return true;
            if (c.children)
                return this._hasSelectedChild(c.children);
            return false;
        });
    }
    _renderChildren(items) {
        return items.map((item) => {
            if (item.type === 'divider')
                return h('li', { class: 'menu__divider', role: 'separator' });
            if (item.type === 'group') {
                return h('li', { class: 'menu__group', role: 'presentation' }, h('div', { class: 'menu__group-title' }, item.label), h('ul', { class: 'menu__group-list', role: 'menu' }, ...this._renderChildren(item.children || [])));
            }
            if (item.children && item.children.length)
                return this._renderSubMenu(item);
            return this._renderItem(item);
        });
    }
    render() {
        const { mode = 'horizontal', theme = 'light', items = [] } = this.props;
        const normalized = normalizeItems(items);
        const classes = [
            'menu',
            `menu--${mode}`,
            `menu--${theme}`,
        ].join(' ');
        return h('ul', { class: classes, role: 'menu' }, ...this._renderChildren(normalized));
    }
}
//# sourceMappingURL=Menu.js.map