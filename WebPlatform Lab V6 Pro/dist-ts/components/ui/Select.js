// Select.ts —— 下拉选择组件
// 遵循 WAI-ARIA Combobox 模式（listbox popup 变体）：
//   - trigger: role=combobox + aria-expanded + aria-haspopup=listbox + aria-labelledby
//   - 列表: role=listbox；选项: role=option + aria-selected
//   - 键盘：Enter/↓ 展开；↓/↑ 移动 active option；Enter 选中；Esc 关闭
//   - 焦点：trigger 始终保持焦点，使用 aria-activedescendant 指向活动 option
import { Component } from '../../core/Component.js';
import { h } from '../../core/utils.js';
import { mountDropdown, isClickInside } from './_portal.js';
export class Select extends Component {
    _id = null;
    _dropdownEl = null;
    _portalRAF = null;
    _portalCleanup = null;
    _outsideHandler = null;
    initialState() {
        return { open: false, value: this.props.value ?? null, activeIdx: -1 };
    }
    render() {
        const { options = [], placeholder = '请选择', disabled = false, ariaLabel } = this.props;
        const selected = options.find((o) => o.value === this.state.value);
        const baseId = this._id || (this._id = `select-${Math.random().toString(36).slice(2, 9)}`);
        const listboxId = `${baseId}-listbox`;
        // 维持 activeIdx 在合法范围（options 变化或关闭后重置）
        const opts = options;
        let activeIdx = this.state.activeIdx;
        if (activeIdx >= opts.length)
            activeIdx = opts.length - 1;
        if (activeIdx < 0 && selected)
            activeIdx = opts.findIndex((o) => o.value === selected.value);
        if (activeIdx < 0 && opts.length > 0 && this.state.open)
            activeIdx = 0;
        const activeOptionId = (this.state.open && activeIdx >= 0) ? `${baseId}-opt-${activeIdx}` : undefined;
        const root = h('div', {
            class: `select ${this.state.open ? 'is-open' : ''} ${disabled ? 'is-disabled' : ''}`,
        }, h('div', {
            class: 'select__trigger',
            role: 'combobox',
            tabindex: disabled ? '-1' : '0',
            'aria-expanded': String(this.state.open),
            'aria-haspopup': 'listbox',
            'aria-controls': listboxId,
            'aria-activedescendant': activeOptionId,
            'aria-label': ariaLabel || (typeof placeholder === 'string' ? placeholder : undefined),
            'aria-disabled': disabled ? 'true' : undefined,
            onClick: (e) => {
                // 阻止冒泡到 document 的 outside 处理器：
                // 否则 setState 触发同步 rerender 替换触发器节点后，
                // 原事件 target 变为游离节点，this.el.contains(target) 为 false，
                // 下拉会被立即关闭，表现为“点击无反应”。
                e.stopPropagation();
                if (!disabled)
                    this._setOpen(!this.state.open);
            },
            onKeyDown: (e) => this._onTriggerKeyDown(e),
        }, h('span', { class: selected ? '' : 'text-tertiary' }, selected ? selected.label : placeholder), h('span', { class: 'select__arrow', 'aria-hidden': 'true' }, '▾')));
        if (this.state.open && !disabled) {
            const dropdown = h('div', { class: 'select__dropdown', role: 'listbox', id: listboxId }, ...opts.map((opt, i) => h('div', {
                class: `select__option ${opt.value === this.state.value ? 'is-selected' : ''} ${opt.disabled ? 'is-disabled' : ''} ${i === activeIdx ? 'is-active-opt' : ''}`,
                role: 'option',
                id: `${baseId}-opt-${i}`,
                'aria-selected': String(opt.value === this.state.value),
                'aria-disabled': opt.disabled ? 'true' : undefined,
                onClick: (e) => {
                    e.stopPropagation();
                    if (opt.disabled)
                        return;
                    this._select(opt);
                },
                onMouseEnter: () => {
                    if (!opt.disabled)
                        this.setState({ activeIdx: i });
                },
            }, opt.label)));
            root.appendChild(dropdown);
        }
        return root;
    }
    _setOpen(open) {
        if (!open) {
            this.setState({ open: false, activeIdx: -1 });
            this._closePortal();
        }
        else {
            // 打开时把 active 指到当前选中项（或第一项）
            const opts = this.props.options || [];
            const selIdx = opts.findIndex((o) => o.value === this.state.value);
            this.setState({ open: true, activeIdx: selIdx >= 0 ? selIdx : (opts.length > 0 ? 0 : -1) });
            this._openPortal();
        }
    }
    /** 把 dropdown portal 到 body，避免被 Card overflow:hidden 裁剪 */
    _openPortal() {
        this._closePortal();
        // RAF 等 setState 触发的 _rerender 完成，dropdown 已挂到 root
        this._portalRAF = requestAnimationFrame(() => {
            if (!this.state.open || !this.el)
                return;
            const dropdown = this.el.querySelector('.select__dropdown');
            const trigger = this.el.querySelector('.select__trigger');
            if (dropdown && trigger) {
                this._dropdownEl = dropdown;
                this._portalCleanup = mountDropdown(dropdown, trigger, { align: 'matchWidth' });
            }
        });
    }
    _closePortal() {
        if (this._portalRAF) {
            cancelAnimationFrame(this._portalRAF);
            this._portalRAF = null;
        }
        this._portalCleanup?.();
        this._portalCleanup = null;
        this._dropdownEl = null;
    }
    _select(opt) {
        this.setState({ value: opt.value, open: false, activeIdx: -1 });
        this._closePortal();
        this.props.onChange?.(opt.value, opt);
    }
    _moveActive(delta) {
        const opts = this.props.options || [];
        if (opts.length === 0)
            return;
        let idx = this.state.activeIdx;
        if (idx < 0)
            idx = opts.findIndex((o) => o.value === this.state.value);
        if (idx < 0)
            idx = delta > 0 ? -1 : opts.length; // 从首/末开始
        // 跳过禁用项
        for (let step = 0; step < opts.length; step++) {
            idx = (idx + delta + opts.length) % opts.length;
            if (!opts[idx].disabled)
                break;
        }
        this.setState({ activeIdx: idx });
    }
    _onTriggerKeyDown(e) {
        if (this.props.disabled)
            return;
        const opts = this.props.options || [];
        switch (e.key) {
            case 'Enter':
            case ' ':
            case 'Spacebar':
                e.preventDefault();
                if (!this.state.open) {
                    this._setOpen(true);
                }
                else if (this.state.activeIdx >= 0 && opts[this.state.activeIdx]) {
                    this._select(opts[this.state.activeIdx]);
                }
                break;
            case 'ArrowDown':
                e.preventDefault();
                if (!this.state.open)
                    this._setOpen(true);
                else
                    this._moveActive(1);
                break;
            case 'ArrowUp':
                e.preventDefault();
                if (!this.state.open)
                    this._setOpen(true);
                else
                    this._moveActive(-1);
                break;
            case 'Home':
                if (this.state.open) {
                    e.preventDefault();
                    this._moveActiveTo(0);
                }
                break;
            case 'End':
                if (this.state.open) {
                    e.preventDefault();
                    this._moveActiveTo(opts.length - 1);
                }
                break;
            case 'Escape':
                if (this.state.open) {
                    e.preventDefault();
                    this._setOpen(false);
                }
                break;
            case 'Tab':
                if (this.state.open)
                    this._setOpen(false);
                break;
        }
    }
    _moveActiveTo(idx) {
        const opts = this.props.options || [];
        if (idx < 0 || idx >= opts.length)
            return;
        // 跳过禁用项
        if (opts[idx].disabled)
            return;
        this.setState({ activeIdx: idx });
    }
    componentDidMount() {
        // 点击外部关闭（含 portal 的 dropdown）
        this._outsideHandler = (e) => {
            if (this.state.open && !isClickInside(e, this.el, this._dropdownEl)) {
                this._setOpen(false);
            }
        };
        document.addEventListener('click', this._outsideHandler);
    }
    componentWillUnmount() {
        if (this._outsideHandler) {
            document.removeEventListener('click', this._outsideHandler);
        }
        this._closePortal();
    }
    getValue() { return this.state.value; }
    setValue(v) { this.setState({ value: v }); }
}
//# sourceMappingURL=Select.js.map