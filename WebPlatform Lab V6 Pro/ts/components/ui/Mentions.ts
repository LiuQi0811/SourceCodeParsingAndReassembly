// Mentions.ts —— 提及组件（参考 antd Mentions）
import { Component } from '../../core/Component.js';
import { h } from '../../core/utils.js';
import { mountDropdown, isClickInside } from './_portal.js';
import type { Props, State } from '../../core/types.js';

export interface MentionsOption {
  value: string;
  label?: string;
}

export interface MentionContext {
  start: number;
  prefix: string;
  query: string;
  options: MentionsOption[];
}

export interface MentionsProps extends Props {
  options?: (MentionsOption | string)[];
  value?: string;
  placeholder?: string;
  disabled?: boolean;
  rows?: number;
  prefix?: string | string[];
  split?: string;
  onChange?: (value: string) => void;
  onSelect?: (option: MentionsOption, prefix: string) => void;
}

export interface MentionsState extends State {
  value: string;
  open: boolean;
  active: MentionContext | null;
  activeIdx: number;
}

/** 把 options 规范化为 { value, label } */
function normalizeOptions(options: (MentionsOption | string)[] | undefined): MentionsOption[] {
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
  declare props: MentionsProps;
  declare state: MentionsState;
  _dropdownEl: HTMLElement | null = null;
  _portalCleanup: (() => void) | null = null;
  _outsideHandler: ((e: Event) => void) | null = null;
  _ta: HTMLTextAreaElement | null = null;

  initialState(): MentionsState {
    return {
      value: this.props.value ?? '',
      open: false,
      // 触发下拉的当前提及上下文：{ start, prefix, query, options }
      active: null,
      activeIdx: 0,
    };
  }

  componentDidMount(): void {
    this._outsideHandler = (e: Event) => {
      if (this.state.open && !isClickInside(e, this.el as HTMLElement | null, this._dropdownEl)) this._close();
    };
    document.addEventListener('click', this._outsideHandler);
  }

  componentWillUnmount(): void {
    if (this._outsideHandler) {
      document.removeEventListener('click', this._outsideHandler);
    }
    this._closePortal();
  }

  _getTa(): HTMLTextAreaElement | null {
    return (this.el as Element | null)?.querySelector<HTMLTextAreaElement>('textarea') ?? null;
  }

  _close(): void {
    this.setState({ open: false, active: null, activeIdx: 0 });
    this._closePortal();
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
    const dropdown = (this.el as Element).querySelector<HTMLElement>('.mentions__dropdown');
    const ta = this._getTa();
    if (dropdown && ta) {
      this._dropdownEl = dropdown;
      this._portalCleanup = mountDropdown(dropdown, ta, { align: 'matchWidth' });
    }
  }

  _closePortal(): void {
    this._portalCleanup?.();
    this._portalCleanup = null;
    this._dropdownEl = null;
  }

  /** 解析光标位置前是否触发了 prefix */
  _detectMention(text: string, caret: number): MentionContext | null {
    const prefixes: string[] = Array.isArray(this.props.prefix) ? this.props.prefix : [this.props.prefix || '@'];
    // 从光标向前找：连续非空白字符序列
    let i = caret - 1;
    while (i >= 0 && !/\s/.test(text[i])) i--;
    // i+1 是序列起点
    const seg = text.slice(i + 1, caret);
    for (const p of prefixes) {
      if (seg.startsWith(p) && seg.length >= p.length) {
        return { start: i + 1, prefix: p, query: seg.slice(p.length), options: [] };
      }
    }
    return null;
  }

  _onInput(e: Event): void {
    const ta = e.target as HTMLTextAreaElement;
    const value = ta.value;
    const caret = ta.selectionStart ?? 0;
    const selStart = ta.selectionStart;
    const selEnd = ta.selectionEnd;

    // 先计算目标状态，再合并为一次 setState，避免两次 rerender 导致 textarea 重建丢光标。
    // componentDidUpdate 会在 rerender 后重新 portal dropdown，无需在此手动 _openPortal。
    let open = false;
    let active: MentionContext | null = null;
    let activeIdx = 0;
    const mention = this._detectMention(value, caret);
    if (mention) {
      const opts = normalizeOptions(this.props.options);
      const filtered = opts.filter((o) =>
        (o.label || '').toLowerCase().includes(mention.query.toLowerCase()));
      if (filtered.length) {
        open = true;
        active = { ...mention, options: filtered };
        activeIdx = 0;
      }
    }
    this.setState({ value, open, active, activeIdx });
    if (!open) this._closePortal(); // 关闭时同步清理 body 旧 dropdown
    this.props.onChange?.(value);
    // 恢复光标（rerender 后 textarea 是新节点）
    requestAnimationFrame(() => {
      if (this._ta && selStart != null && selEnd != null) {
        this._ta.focus();
        this._ta.setSelectionRange(selStart, selEnd);
      }
    });
  }

  _onKeyDown(e: KeyboardEvent): void {
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
  _insertMention(opt: MentionsOption): void {
    const ta = this._getTa();
    if (!ta || !this.state.active) return;
    const { start, prefix } = this.state.active;
    const split = this.props.split || ' ';
    const before = this.state.value.slice(0, start);
    const after = this.state.value.slice(ta.selectionStart ?? 0);
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

  _renderDropdown(): Node | null {
    if (!this.state.active) return null;
    const opts = this.state.active.options;
    return h('div', { class: 'mentions__dropdown', role: 'listbox', onClick: (e: MouseEvent) => e.stopPropagation() },
      ...opts.map((opt, i) => h('div', {
        class: ['mentions__option', i === this.state.activeIdx && 'is-active'].filter(Boolean).join(' '),
        role: 'option',
        onMouseEnter: () => this.setState({ activeIdx: i }),
        onMouseDown: (e: MouseEvent) => { e.preventDefault(); this._insertMention(opt); },
      }, opt.label)),
    );
  }

  render(): Node | string {
    const { placeholder = '请输入', disabled = false } = this.props;
    const ta = h('textarea', {
      class: `mentions__editor ${disabled ? 'is-disabled' : ''}`,
      placeholder, disabled,
      rows: this.props.rows || 3,
      onInput: (e: Event) => this._onInput(e),
      onKeyDown: (e: KeyboardEvent) => this._onKeyDown(e),
      onBlur: () => { /* 失焦不立即关，留给下拉 mousedown 时间 */ setTimeout(() => this._close(), 150); },
    }, this.state.value);
    this._ta = ta as unknown as HTMLTextAreaElement;
    const root = h('div', { class: `mentions ${this.state.open ? 'is-open' : ''}` }, ta);
    if (this.state.open) {
      const dd = this._renderDropdown();
      if (dd) root.appendChild(dd);
    }
    return root;
  }

  getValue(): string { return this.state.value; }
  setValue(v: string): void {
    this.setState({ value: v });
    const ta = this._getTa();
    if (ta) ta.value = v;
  }
}
