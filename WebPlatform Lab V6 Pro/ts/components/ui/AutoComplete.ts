// AutoComplete.ts —— 自动补全（参考 antd AutoComplete）
import { Component } from '../../core/Component.js';
import { h } from '../../core/utils.js';
import { Input } from './Input.js';
import { mountDropdown, isClickInside } from './_portal.js';
import type { Props, State } from '../../core/types.js';

export interface AutoCompleteOption {
  value: string;
  label: string;
}

export interface AutoCompleteProps extends Props {
  options?: Array<string | number | AutoCompleteOption>;
  value?: string;
  defaultValue?: string;
  placeholder?: string;
  disabled?: boolean;
  allowClear?: boolean;
  onChange?: (value: string) => void;
  onSelect?: (value: string, option: AutoCompleteOption) => void;
  filterOption?: ((input: string, option: AutoCompleteOption) => boolean) | false;
}

export interface AutoCompleteState extends State {
  open: boolean;
  value: string;
  activeIdx: number;
}

/** 把 options 规范化为 { value, label } 数组 */
function normalizeOptions(options: Array<string | number | AutoCompleteOption> | undefined): AutoCompleteOption[] {
  if (!Array.isArray(options)) return [];
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
  declare props: AutoCompleteProps;
  declare state: AutoCompleteState;
  _outsideHandler: ((e: Event) => void) | null = null;
  _dropdownEl: HTMLElement | null = null;
  _portalCleanup: (() => void) | null = null;
  _inputEl: HTMLInputElement | HTMLTextAreaElement | null = null;

  initialState(): AutoCompleteState {
    return {
      open: false,
      value: this.props.value ?? this.props.defaultValue ?? '',
      activeIdx: -1,
    };
  }

  componentDidMount(): void {
    this._outsideHandler = (e: Event) => {
      if (this.state.open && !isClickInside(e, this.el as HTMLElement | null, this._dropdownEl)) this._setOpen(false);
    };
    document.addEventListener('click', this._outsideHandler);
  }

  componentWillUnmount(): void {
    if (this._outsideHandler) document.removeEventListener('click', this._outsideHandler);
    this._closePortal();
  }

  _setOpen(open: boolean): void {
    if (open) {
      // setState 同步触发 _rerender，末尾 componentDidUpdate 完成 portal
      this.setState({ open: true, activeIdx: -1 });
    } else {
      this.setState({ open: false, activeIdx: -1 });
      this._closePortal();
    }
  }

  /** 重渲染后重新 portal，避免 body 旧 dropdown 变孤儿（根因 B） */
  componentDidUpdate(): void {
    if (this.state.open && this.el) {
      this._closePortal();
      this._openPortal();
    }
  }

  _openPortal(): void {
    this._closePortal();
    if (!this.state.open || !this.el) return;
    const dropdown = (this.el as Element).querySelector('.autocomplete__dropdown') as HTMLElement | null;
    const trigger = (this.el as Element).querySelector('.input') as HTMLElement | null;
    if (dropdown && trigger) {
      this._dropdownEl = dropdown;
      this._portalCleanup = mountDropdown(dropdown, trigger, { align: 'matchWidth' });
    }
  }

  _closePortal(): void {
    this._portalCleanup?.();
    this._portalCleanup = null;
    this._dropdownEl = null;
  }

  /** 当前过滤后的候选项 */
  _filtered(): AutoCompleteOption[] {
    const opts = normalizeOptions(this.props.options);
    const filter = this.props.filterOption;
    if (filter === false) return opts;
    const fn = typeof filter === 'function'
      ? filter
      : (input: string, option: AutoCompleteOption) => (option.label || '').toLowerCase().includes(String(input).toLowerCase());
    return opts.filter((o) => fn(this.state.value, o));
  }

  _onInput(e: Event): void {
    const target = e.target as HTMLInputElement | HTMLTextAreaElement;
    const value = target.value;
    const selStart = target.selectionStart;
    const selEnd = target.selectionEnd;
    // setState 触发 _rerender 会重建 Input 子组件（input 是新 DOM 节点），
    // 焦点与光标会丢失——用 RAF 在 rerender 后重新 focus 并恢复光标位置。
    // componentDidUpdate 会重新 portal dropdown，无需在此手动 _openPortal。
    this.setState({ value, open: true, activeIdx: -1 });
    requestAnimationFrame(() => {
      if (this._inputEl) {
        this._inputEl.focus();
        if (selStart != null && selEnd != null) {
          this._inputEl.setSelectionRange(selStart, selEnd);
        }
      }
    });
    this.props.onChange?.(value);
  }

  _select(opt: AutoCompleteOption): void {
    this.setState({ value: opt.value, open: false, activeIdx: -1 });
    this._closePortal();
    this.props.onSelect?.(opt.value, opt);
    this.props.onChange?.(opt.value);
  }

  _moveActive(delta: number): void {
    const list = this._filtered();
    if (!list.length) return;
    let idx = this.state.activeIdx;
    if (idx < 0) idx = delta > 0 ? -1 : list.length;
    idx = (idx + delta + list.length) % list.length;
    this.setState({ activeIdx: idx });
  }

  _onKeyDown(e: KeyboardEvent): void {
    if (!this.state.open) {
      if (e.key === 'ArrowDown' && this._filtered().length) {
        e.preventDefault();
        this._setOpen(true);
      }
      return;
    }
    switch (e.key) {
      case 'ArrowDown': e.preventDefault(); this._moveActive(1); break;
      case 'ArrowUp': e.preventDefault(); this._moveActive(-1); break;
      case 'Enter': {
        const list = this._filtered();
        const cur = list[this.state.activeIdx];
        if (cur) { e.preventDefault(); this._select(cur); }
        break;
      }
      case 'Escape': this._setOpen(false); break;
    }
  }

  _clear(): void {
    this.setState({ value: '', open: false });
    this._closePortal();
    this.props.onChange?.('');
  }

  _renderDropdown(): Node | null {
    const list = this._filtered();
    if (!list.length) return null;
    return h('div', { class: 'autocomplete__dropdown', role: 'listbox', onClick: (e: MouseEvent) => e.stopPropagation() },
      ...list.map((opt, i) => h('div', {
        class: [
          'autocomplete__option',
          i === this.state.activeIdx && 'is-active',
        ].filter(Boolean).join(' '),
        role: 'option',
        'aria-selected': 'false',
        onMouseEnter: () => this.setState({ activeIdx: i }),
        onClick: (e: MouseEvent) => { e.stopPropagation(); this._select(opt); },
      }, opt.label)),
    );
  }

  render(): Node | string {
    const { placeholder = '', disabled = false, allowClear = false } = this.props;
    const input = new Input({
      placeholder,
      disabled,
      value: this.state.value,
      onChange: (v: string, e: Event) => this._onInput(e),
      onFocus: () => { if (this._filtered().length) this._setOpen(true); },
      onKeyDown: (e: KeyboardEvent) => this._onKeyDown(e),
    });
    this.registerChild(input);
    const inputEl = input.render();
    this._inputEl = input._inputEl;

    const root = h('div', { class: `autocomplete ${this.state.open ? 'is-open' : ''}` },
      inputEl,
      allowClear && this.state.value && h('span', {
        class: 'autocomplete__clear', role: 'button', 'aria-label': '清除',
        onClick: (e: MouseEvent) => { e.stopPropagation(); this._clear(); },
      }, '×'),
    );
    if (this.state.open) {
      const dd = this._renderDropdown();
      if (dd) root.appendChild(dd);
    }
    return root;
  }

  getValue(): string { return this.state.value; }
  setValue(v: string): void {
    this.setState({ value: v });
    if (this._inputEl) this._inputEl.value = v;
  }
}
