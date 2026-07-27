// AutoComplete.js —— 自动补全（参考 antd AutoComplete）
import { Component } from '../../core/Component.js';
import { h, uid } from '../../core/utils.js';
import { Input } from './Input.js';
import { mountDropdown, isClickInside } from './_portal.js';

/** 把 options 规范化为 { value, label } 数组 */
function normalizeOptions(options) {
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
  initialState() {
    return {
      open: false,
      value: this.props.value ?? this.props.defaultValue ?? '',
      activeIdx: -1,
    };
  }

  componentDidMount() {
    this._outsideHandler = (e) => {
      if (this.state.open && !isClickInside(e, this.el, this._dropdownEl)) this._setOpen(false);
    };
    document.addEventListener('click', this._outsideHandler);
  }

  componentWillUnmount() {
    document.removeEventListener('click', this._outsideHandler);
    this._closePortal();
  }

  _setOpen(open) {
    if (open) {
      // setState 同步触发 _rerender，末尾 componentDidUpdate 完成 portal
      this.setState({ open: true, activeIdx: -1 });
    } else {
      this.setState({ open: false, activeIdx: -1 });
      this._closePortal();
    }
  }

  /** 重渲染后重新 portal，避免 body 旧 dropdown 变孤儿（根因 B） */
  componentDidUpdate() {
    if (this.state.open && this.el) {
      this._closePortal();
      this._openPortal();
    }
  }

  _openPortal() {
    this._closePortal();
    if (!this.state.open || !this.el) return;
    const dropdown = this.el.querySelector('.autocomplete__dropdown');
    const trigger = this.el.querySelector('.input');
    if (dropdown && trigger) {
      this._dropdownEl = dropdown;
      this._portalCleanup = mountDropdown(dropdown, trigger, { align: 'matchWidth' });
    }
  }

  _closePortal() {
    this._portalCleanup?.();
    this._portalCleanup = null;
    this._dropdownEl = null;
  }

  /**
   * 局部重建下拉列表，不重建 input DOM（避免输入闪屏/光标丢失）。
   * onInput 时绕过 setState，仅刷新已 portal 到 body 的 dropdown 内容；
   * 首次打开时构建 dropdown 并 portal，无候选项时关闭 portal。
   */
  _refreshDropdown() {
    if (!this.el) return;
    const list = this._filtered();
    this.el.classList.toggle('is-open', this.state.open);
    if (!this.state.open || !list.length) {
      this._closePortal();
      this._updateAriaActive();
      return;
    }
    if (!this._dropdownEl) {
      // 首次打开：构建 dropdown，append 到 el 后由 _openPortal 移到 body
      const dd = this._renderDropdown();
      if (dd) {
        this.el.appendChild(dd);
        this._openPortal();
      }
    } else {
      // dropdown 已 portal 到 body：清空并重建 option 列表
      this._dropdownEl.innerHTML = '';
      list.forEach((opt, i) => this._dropdownEl.appendChild(this._renderOption(opt, i)));
    }
    this._updateAriaActive();
  }

  /** 当前过滤后的候选项 */
  _filtered() {
    const opts = normalizeOptions(this.props.options);
    const filter = this.props.filterOption;
    if (filter === false) return opts;
    const fn = typeof filter === 'function'
      ? filter
      : (input, option) => (option.label || '').toLowerCase().includes(String(input).toLowerCase());
    return opts.filter((o) => fn(this.state.value, o));
  }

  _onInput(e) {
    const value = e.target.value;
    // 直接改 state 字段，不触发 setState/rerender：
    // setState 会触发 _rerender 重建 Input 子组件（input 是新 DOM 节点），
    // 导致正在输入的 input 被销毁重建 → 闪屏、光标丢失。
    // 浏览器原生 input 已自动更新自身 value，无需重建 DOM。
    this.state.value = value;
    this.state.open = true;
    this.state.activeIdx = -1;
    // 仅重建 dropdown 部分，input DOM 不重建
    this._refreshDropdown();
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
    if (!list.length) return;
    let idx = this.state.activeIdx;
    if (idx < 0) idx = delta > 0 ? -1 : list.length;
    idx = (idx + delta + list.length) % list.length;
    // 纯 DOM 切 class + 同步 aria-activedescendant，不触发 rerender
    this._syncActive(idx);
  }

  /** 纯 DOM 切换 active 项的 is-active class + 同步 aria-activedescendant */
  _syncActive(newIdx) {
    if (this.state.activeIdx === newIdx) return;
    const oldIdx = this.state.activeIdx;
    this.state.activeIdx = newIdx;
    if (!this._dropdownEl) return;
    const options = this._dropdownEl.querySelectorAll('.autocomplete__option');
    if (options[oldIdx]) options[oldIdx].classList.remove('is-active');
    if (options[newIdx]) options[newIdx].classList.add('is-active');
    this._updateAriaActive(options);
  }

  /** 同步 trigger 的 aria-activedescendant 到当前 active 项 */
  _updateAriaActive(options) {
    if (!this._inputEl) return;
    const opts = options || (this._dropdownEl ? this._dropdownEl.querySelectorAll('.autocomplete__option') : []);
    const cur = opts[this.state.activeIdx];
    if (cur) this._inputEl.setAttribute('aria-activedescendant', cur.id);
    else this._inputEl.removeAttribute('aria-activedescendant');
  }

  /** option 元素的唯一 id（供 aria-activedescendant 引用） */
  _optionId(i) {
    if (!this._id) this._id = uid('autocomplete');
    return `${this._id}-opt-${i}`;
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

  _clear() {
    this.setState({ value: '', open: false });
    this._closePortal();
    this.props.onChange?.('');
  }

  _renderOption(opt, i) {
    return h('div', {
      class: [
        'autocomplete__option',
        i === this.state.activeIdx && 'is-active',
      ].filter(Boolean).join(' '),
      role: 'option',
      id: this._optionId(i),
      'aria-selected': 'false',
      // hover 时纯 DOM 切 class，不触发 setState/rerender
      onMouseEnter: () => this._syncActive(i),
      onClick: (e) => { e.stopPropagation(); this._select(opt); },
    }, opt.label);
  }

  _renderDropdown() {
    const list = this._filtered();
    if (!list.length) return null;
    return h('div', { class: 'autocomplete__dropdown', role: 'listbox', onClick: (e) => e.stopPropagation() },
      ...list.map((opt, i) => this._renderOption(opt, i)),
    );
  }

  render() {
    const { placeholder = '', disabled = false, allowClear = false } = this.props;
    const input = new Input({
      placeholder,
      disabled,
      value: this.state.value,
      onChange: (v, e) => this._onInput(e),
      onFocus: () => { if (this._filtered().length) this._setOpen(true); },
      onKeyDown: (e) => this._onKeyDown(e),
    });
    this.registerChild(input);
    const inputEl = input.render();
    this._inputEl = input._inputEl;

    const root = h('div', { class: `autocomplete ${this.state.open ? 'is-open' : ''}` },
      inputEl,
      allowClear && this.state.value && h('span', {
        class: 'autocomplete__clear', role: 'button', 'aria-label': '清除',
        onClick: (e) => { e.stopPropagation(); this._clear(); },
      }, '×'),
    );
    if (this.state.open) {
      const dd = this._renderDropdown();
      if (dd) root.appendChild(dd);
    }
    return root;
  }

  getValue() { return this.state.value; }
  setValue(v) {
    this.setState({ value: v });
    if (this._inputEl) this._inputEl.value = v;
  }
}
