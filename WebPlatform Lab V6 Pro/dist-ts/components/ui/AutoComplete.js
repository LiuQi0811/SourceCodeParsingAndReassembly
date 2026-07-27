// AutoComplete.ts —— 自动补全（参考 antd AutoComplete）
import { Component } from '../../core/Component.js';
import { h } from '../../core/utils.js';
import { Input } from './Input.js';
import { mountDropdown, isClickInside } from './_portal.js';
/** 把 options 规范化为 { value, label } 数组 */
function normalizeOptions(options) {
    if (!Array.isArray(options))
        return [];
    return options.map((o) => (typeof o === 'string' || typeof o === 'number')
        ? { value: String(o), label: String(o) }
        : { value: o.value, label: o.label != null ? o.label : o.value });
}
/**
 * 自动补全
 * props:
 *   - options: Array<string> | Array<{value, label}>
 *   - value, placeholder, disabled, allowClear
 *   - onChange: (value) => void
 *   - onSelect: (value, option) => void
 *   - filterOption: (inputValue, option) => boolean | false（关闭过滤）
 *   - defaultValue
 */
export class AutoComplete extends Component {
    _outsideHandler = null;
    _dropdownEl = null;
    _portalRAF = null;
    _portalCleanup = null;
    _inputEl = null;
    initialState() {
        return {
            open: false,
            value: this.props.value ?? this.props.defaultValue ?? '',
            activeIdx: -1,
        };
    }
    componentDidMount() {
        this._outsideHandler = (e) => {
            if (this.state.open && !isClickInside(e, this.el, this._dropdownEl))
                this._setOpen(false);
        };
        document.addEventListener('click', this._outsideHandler);
    }
    componentWillUnmount() {
        if (this._outsideHandler)
            document.removeEventListener('click', this._outsideHandler);
        this._closePortal();
    }
    _setOpen(open) {
        if (open) {
            this.setState({ open: true, activeIdx: -1 });
            this._openPortal();
        }
        else {
            this.setState({ open: false, activeIdx: -1 });
            this._closePortal();
        }
    }
    _openPortal() {
        this._closePortal();
        this._portalRAF = requestAnimationFrame(() => {
            if (!this.state.open || !this.el)
                return;
            const dropdown = this.el.querySelector('.autocomplete__dropdown');
            const trigger = this.el.querySelector('.input');
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
    /** 当前过滤后的候选项 */
    _filtered() {
        const opts = normalizeOptions(this.props.options);
        const filter = this.props.filterOption;
        if (filter === false)
            return opts;
        const fn = typeof filter === 'function'
            ? filter
            : (input, option) => (option.label || '').toLowerCase().includes(String(input).toLowerCase());
        return opts.filter((o) => fn(this.state.value, o));
    }
    _onInput(value) {
        this.setState({ value, open: true, activeIdx: -1 });
        this._openPortal();
        this.props.onChange?.(value);
    }
    _select(opt) {
        this.setState({ value: opt.value, open: false, activeIdx: -1 });
        this._closePortal();
        this.props.onSelect?.(opt.value, opt);
        this.props.onChange?.(opt.value);
    }
    _moveActive(delta) {
        const list = this._filtered();
        if (!list.length)
            return;
        let idx = this.state.activeIdx;
        if (idx < 0)
            idx = delta > 0 ? -1 : list.length;
        idx = (idx + delta + list.length) % list.length;
        this.setState({ activeIdx: idx });
    }
    _onKeyDown(e) {
        if (!this.state.open) {
            if (e.key === 'ArrowDown' && this._filtered().length) {
                e.preventDefault();
                this._setOpen(true);
            }
            return;
        }
        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                this._moveActive(1);
                break;
            case 'ArrowUp':
                e.preventDefault();
                this._moveActive(-1);
                break;
            case 'Enter': {
                const list = this._filtered();
                const cur = list[this.state.activeIdx];
                if (cur) {
                    e.preventDefault();
                    this._select(cur);
                }
                break;
            }
            case 'Escape':
                this._setOpen(false);
                break;
        }
    }
    _clear() {
        this.setState({ value: '', open: false });
        this._closePortal();
        this.props.onChange?.('');
    }
    _renderDropdown() {
        const list = this._filtered();
        if (!list.length)
            return null;
        return h('div', { class: 'autocomplete__dropdown', role: 'listbox', onClick: (e) => e.stopPropagation() }, ...list.map((opt, i) => h('div', {
            class: [
                'autocomplete__option',
                i === this.state.activeIdx && 'is-active',
            ].filter(Boolean).join(' '),
            role: 'option',
            'aria-selected': 'false',
            onMouseEnter: () => this.setState({ activeIdx: i }),
            onClick: (e) => { e.stopPropagation(); this._select(opt); },
        }, opt.label)));
    }
    render() {
        const { placeholder = '', disabled = false, allowClear = false } = this.props;
        const input = new Input({
            placeholder,
            disabled,
            value: this.state.value,
            onChange: (v) => this._onInput(v),
            onFocus: () => { if (this._filtered().length)
                this._setOpen(true); },
            onKeyDown: (e) => this._onKeyDown(e),
        });
        this.registerChild(input);
        const inputEl = input.render();
        this._inputEl = input._inputEl;
        const root = h('div', { class: `autocomplete ${this.state.open ? 'is-open' : ''}` }, inputEl, allowClear && this.state.value && h('span', {
            class: 'autocomplete__clear', role: 'button', 'aria-label': '清除',
            onClick: (e) => { e.stopPropagation(); this._clear(); },
        }, '×'));
        if (this.state.open) {
            const dd = this._renderDropdown();
            if (dd)
                root.appendChild(dd);
        }
        return root;
    }
    getValue() { return this.state.value; }
    setValue(v) {
        this.setState({ value: v });
        if (this._inputEl)
            this._inputEl.value = v;
    }
}
//# sourceMappingURL=AutoComplete.js.map