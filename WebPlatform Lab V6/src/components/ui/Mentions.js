// Mentions.js —— 提及组件（参考 antd Mentions）
import { Component } from '../../core/Component.js';
import { h } from '../../core/utils.js';
import { mountDropdown, isClickInside } from './_portal.js';

/** 把 options 规范化为 { value, label } */
function normalizeOptions(options) {
  if (!Array.isArray(options)) return [];
  return options.map((o) => (typeof o === 'string'
    ? { value: o, label: o }
    : { value: o.value, label: o.label != null ? o.label : o.value }));
}

/**
 * 提及
 * props:
 *   - options: Array<{value, label}>
 *   - value, placeholder, disabled
 *   - onChange: (value) => void
 *   - onSelect: (option, prefix) => void
 *   - prefix: string（默认 '@'）
 *   - split: string（默认 ' '，多提及之间的分隔符）
 */
export class Mentions extends Component {
  initialState() {
    return {
      value: this.props.value ?? '',
      open: false,
      // 触发下拉的当前提及上下文：{ start, prefix, query, options }
      active: null,
      activeIdx: 0,
    };
  }

  componentDidMount() {
    this._outsideHandler = (e) => {
      if (this.state.open && !isClickInside(e, this.el, this._dropdownEl)) this._close();
    };
    document.addEventListener('click', this._outsideHandler);
  }

  componentWillUnmount() {
    document.removeEventListener('click', this._outsideHandler);
    this._closePortal();
  }

  _getTa() { return this.el?.querySelector('textarea'); }

  _close() {
    this.setState({ open: false, active: null, activeIdx: 0 });
    this._closePortal();
  }

  _openPortal() {
    this._closePortal();
    this._portalRAF = requestAnimationFrame(() => {
      if (!this.state.open || !this.el) return;
      const dropdown = this.el.querySelector('.mentions__dropdown');
      const ta = this._getTa();
      if (dropdown && ta) {
        this._dropdownEl = dropdown;
        this._portalCleanup = mountDropdown(dropdown, ta, { align: 'matchWidth' });
      }
    });
  }

  _closePortal() {
    if (this._portalRAF) { cancelAnimationFrame(this._portalRAF); this._portalRAF = null; }
    this._portalCleanup?.();
    this._portalCleanup = null;
    this._dropdownEl = null;
  }

  /** 解析光标位置前是否触发了 prefix */
  _detectMention(text, caret) {
    const prefixes = Array.isArray(this.props.prefix) ? this.props.prefix : [this.props.prefix || '@'];
    // 从光标向前找：连续非空白字符序列
    let i = caret - 1;
    while (i >= 0 && !/\s/.test(text[i])) i--;
    // i+1 是序列起点
    const seg = text.slice(i + 1, caret);
    for (const p of prefixes) {
      if (seg.startsWith(p) && seg.length >= p.length) {
        return { start: i + 1, prefix: p, query: seg.slice(p.length) };
      }
    }
    return null;
  }

  _onInput(e) {
    const ta = e.target;
    const value = ta.value;
    const caret = ta.selectionStart;
    this.setState({ value });
    this.props.onChange?.(value);

    const mention = this._detectMention(value, caret);
    if (mention) {
      const opts = normalizeOptions(this.props.options);
      const filtered = opts.filter((o) =>
        (o.label || '').toLowerCase().includes(mention.query.toLowerCase()));
      if (filtered.length) {
        this.setState({ open: true, active: { ...mention, options: filtered }, activeIdx: 0 });
        this._openPortal();
        return;
      }
    }
    this._close();
  }

  _onKeyDown(e) {
    if (!this.state.open || !this.state.active) {
      // 未触发下拉时，按 prefix 键自动展开（用户随后输入字符触发 input 事件）
      return;
    }
    const opts = this.state.active.options;
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        this.setState({ activeIdx: (this.state.activeIdx + 1) % opts.length });
        break;
      case 'ArrowUp':
        e.preventDefault();
        this.setState({ activeIdx: (this.state.activeIdx - 1 + opts.length) % opts.length });
        break;
      case 'Enter': {
        e.preventDefault();
        const cur = opts[this.state.activeIdx];
        if (cur) this._insertMention(cur);
        break;
      }
      case 'Escape':
        e.preventDefault();
        this._close();
        break;
    }
  }

  /** 把当前激活的提及替换为选中项 */
  _insertMention(opt) {
    const ta = this._getTa();
    if (!ta || !this.state.active) return;
    const { start, prefix } = this.state.active;
    const split = this.props.split || ' ';
    const before = this.state.value.slice(0, start);
    const after = this.state.value.slice(ta.selectionStart);
    const mentionText = `${prefix}${opt.value}${split}`;
    const next = before + mentionText + after;
    this.setState({ value: next, open: false, active: null, activeIdx: 0 });
    this._closePortal();
    this.props.onChange?.(next);
    this.props.onSelect?.(opt, prefix);
    // 恢复光标到提及之后
    requestAnimationFrame(() => {
      const pos = (before + mentionText).length;
      ta.focus();
      ta.setSelectionRange(pos, pos);
    });
  }

  _renderDropdown() {
    if (!this.state.active) return null;
    const opts = this.state.active.options;
    return h('div', { class: 'mentions__dropdown', role: 'listbox', onClick: (e) => e.stopPropagation() },
      ...opts.map((opt, i) => h('div', {
        class: ['mentions__option', i === this.state.activeIdx && 'is-active'].filter(Boolean).join(' '),
        role: 'option',
        onMouseEnter: () => this.setState({ activeIdx: i }),
        onMouseDown: (e) => { e.preventDefault(); this._insertMention(opt); },
      }, opt.label)),
    );
  }

  render() {
    const { placeholder = '请输入', disabled = false } = this.props;
    const ta = h('textarea', {
      class: `mentions__editor ${disabled ? 'is-disabled' : ''}`,
      placeholder, disabled,
      rows: this.props.rows || 3,
      onInput: (e) => this._onInput(e),
      onKeyDown: (e) => this._onKeyDown(e),
      onBlur: () => { /* 失焦不立即关，留给下拉 mousedown 时间 */ setTimeout(() => this._close(), 150); },
    }, this.state.value);
    this._ta = ta;
    const root = h('div', { class: `mentions ${this.state.open ? 'is-open' : ''}` }, ta);
    if (this.state.open) {
      const dd = this._renderDropdown();
      if (dd) root.appendChild(dd);
    }
    return root;
  }

  getValue() { return this.state.value; }
  setValue(v) {
    this.setState({ value: v });
    const ta = this._getTa();
    if (ta) ta.value = v;
  }
}
