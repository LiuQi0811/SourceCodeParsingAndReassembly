// Dropdown.ts —— 下拉菜单组件
import { Component } from '../../core/Component.js';
import { h } from '../../core/utils.js';
export class Dropdown extends Component {
    _menu = null;
    _hideTimer = null;
    initialState() { return { visible: false }; }
    componentDidMount() {
        const { trigger = 'click' } = this.props;
        // 给触发元素（children 的第一个元素节点）补 ARIA 状态
        this._setupTriggerAria();
        if (trigger === 'hover') {
            this.on(this.el, 'mouseenter', () => this.show());
            this.on(this.el, 'mouseleave', () => this.hide());
        }
        else {
            // click 触发：菜单内部点击交给各 item 的 onClick 处理，其余点击切换显隐
            this.on(this.el, 'click', (e) => {
                const me = e;
                if (this._menu && this._menu.contains(me.target))
                    return;
                me.stopPropagation(); // 阻止冒泡到 document，避免立即关闭
                this.toggle();
            });
            this.on(document, 'click', (e) => {
                if (this.state.visible && this.el && !this.el.contains(e.target))
                    this.hide();
            });
            // 键盘：触发器上按 ↓ 打开，Esc 关闭
            this.on(this.el, 'keydown', (e) => {
                const ke = e;
                if (ke.key === 'ArrowDown' && !this.state.visible) {
                    ke.preventDefault();
                    this.show();
                    // 把焦点移到首个可聚焦菜单项
                    requestAnimationFrame(() => {
                        const first = this._menu?.querySelector('[role="menuitem"]:not(.is-disabled)');
                        first?.focus();
                    });
                }
                else if (ke.key === 'Escape' && this.state.visible) {
                    this.hide();
                    this._getTrigger()?.focus();
                }
            });
        }
    }
    /** 取触发元素：children 的第一个元素节点（通常是 button/a） */
    _getTrigger() {
        return this.el?.firstElementChild || null;
    }
    _setupTriggerAria() {
        const trigger = this._getTrigger();
        if (!trigger)
            return;
        trigger.setAttribute('aria-haspopup', 'true');
        trigger.setAttribute('aria-expanded', String(this.state.visible));
        if (!trigger.hasAttribute('tabindex') && trigger.tagName !== 'BUTTON' && trigger.tagName !== 'A') {
            trigger.setAttribute('tabindex', '0');
        }
    }
    _syncTriggerExpanded() {
        this._getTrigger()?.setAttribute('aria-expanded', String(this.state.visible));
    }
    componentWillUnmount() {
        if (this._hideTimer)
            clearTimeout(this._hideTimer);
        // portal 元素随组件销毁移除
        this._menu?.remove();
    }
    /** 将菜单 portal 到 body 并按 trigger 位置计算坐标，避免被父级 overflow:hidden 裁剪 */
    _positionMenu() {
        const trigger = this._getTrigger();
        if (!trigger || !this._menu)
            return;
        const rect = trigger.getBoundingClientRect();
        const menu = this._menu;
        menu.style.left = '0px';
        menu.style.top = '0px';
        const mw = menu.offsetWidth;
        const mh = menu.offsetHeight;
        const gap = 4;
        const scrollX = window.scrollX || 0;
        const scrollY = window.scrollY || 0;
        let left;
        let top;
        const placement = this.props.placement || 'bottomLeft';
        if (placement === 'bottomLeft') {
            left = rect.left;
            top = rect.bottom + gap;
        }
        else if (placement === 'bottomRight') {
            left = rect.right - mw;
            top = rect.bottom + gap;
        }
        else if (placement === 'topLeft') {
            left = rect.left;
            top = rect.top - mh - gap;
        }
        else if (placement === 'topRight') {
            left = rect.right - mw;
            top = rect.top - mh - gap;
        }
        else {
            left = rect.left;
            top = rect.bottom + gap;
        }
        menu.style.left = `${left + scrollX}px`;
        menu.style.top = `${top + scrollY}px`;
    }
    show() {
        if (this._hideTimer)
            clearTimeout(this._hideTimer);
        // 直接切换 DOM 显隐而非 setState，保持 this.el 稳定，
        // 使 componentDidMount 绑定的事件监听持续生效。
        this.state.visible = true;
        if (this._menu) {
            // portal 到 body，避免被 Card overflow:hidden 裁剪
            if (this._menu.parentElement !== document.body) {
                document.body.appendChild(this._menu);
            }
            this._menu.style.display = '';
            this._positionMenu();
            this._menu.classList.add('dropdown__menu--visible');
        }
        this._syncTriggerExpanded();
    }
    hide() {
        if (this._hideTimer)
            clearTimeout(this._hideTimer);
        this._hideTimer = setTimeout(() => {
            this.state.visible = false;
            if (this._menu) {
                this._menu.classList.remove('dropdown__menu--visible');
                this._menu.style.display = 'none';
            }
            this._syncTriggerExpanded();
        }, 100);
    }
    toggle() {
        this.state.visible ? this.hide() : this.show();
    }
    render() {
        const { menu = [], placement = 'bottomLeft', children } = this.props;
        const menuEl = h('div', { class: `dropdown__menu dropdown__menu--${placement}`, role: 'menu', style: 'position:absolute;' }, ...menu.map((item) => {
            if (item.type === 'divider')
                return h('div', { class: 'dropdown__divider', role: 'separator' });
            return h('div', {
                class: [
                    'dropdown__item',
                    item.disabled && 'is-disabled',
                    item.danger && 'dropdown__item--danger',
                ],
                role: 'menuitem',
                tabindex: item.disabled ? '-1' : '0',
                'aria-disabled': item.disabled ? 'true' : undefined,
                onClick: (e) => {
                    e.stopPropagation();
                    if (item.disabled)
                        return;
                    item.onClick?.(item, e);
                    this.hide();
                },
                onKeyDown: (e) => {
                    if (e.key !== 'Enter' && e.key !== ' ')
                        return;
                    e.preventDefault();
                    if (item.disabled)
                        return;
                    item.onClick?.(item, e);
                    this.hide();
                    this._getTrigger()?.focus();
                },
            }, item.label);
        }));
        this._menu = menuEl;
        if (!this.state.visible)
            menuEl.style.display = 'none';
        return h('span', { class: 'dropdown' }, children, menuEl);
    }
}
//# sourceMappingURL=Dropdown.js.map