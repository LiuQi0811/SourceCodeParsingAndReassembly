// Select.ts —— 下拉选择组件
// 遵循 WAI-ARIA Combobox 模式（listbox popup 变体）：
//   - trigger: role=combobox + aria-expanded + aria-haspopup=listbox + aria-labelledby
//   - 列表: role=listbox；选项: role=option + aria-selected
//   - 键盘：Enter/↓ 展开；↓/↑ 移动 active option；Enter 选中；Esc 关闭
//   - 焦点：trigger 始终保持焦点，使用 aria-activedescendant 指向活动 option
import { Component } from '../../core/Component.js';
import { h } from '../../core/utils.js';
import { mountDropdown, isClickInside } from './_portal.js';
import type { Props, State } from '../../core/types.js';

export interface SelectOption {
  value: any;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends Props {
  options?: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  ariaLabel?: string;
  value?: any;
  onChange?: (value: any, opt: SelectOption) => void;
}

export interface SelectState extends State {
  open: boolean;
  value: any;
  activeIdx: number;
}

export class Select extends Component {
  declare props: SelectProps;
  declare state: SelectState;
  _id: string | null = null;
  _dropdownEl: HTMLElement | null = null;
  _portalCleanup: (() => void) | null = null;
  _outsideHandler: ((e: Event) => void) | null = null;

  initialState(): SelectState {
    return { open: false, value: this.props.value ?? null, activeIdx: -1 };
  }

  render(): Node | string {
    const { options = [], placeholder = '请选择', disabled = false, ariaLabel } = this.props;
    const selected = options.find((o) => o.value === this.state.value);
    const baseId = this._id || (this._id = `select-${Math.random().toString(36).slice(2, 9)}`);
    const listboxId = `${baseId}-listbox`;
    // 维持 activeIdx 在合法范围（options 变化或关闭后重置）
    const opts = options;
    let activeIdx = this.state.activeIdx;
    if (activeIdx >= opts.length) activeIdx = opts.length - 1;
    if (activeIdx < 0 && selected) activeIdx = opts.findIndex((o) => o.value === selected.value);
    if (activeIdx < 0 && opts.length > 0 && this.state.open) activeIdx = 0;
    const activeOptionId = (this.state.open && activeIdx >= 0) ? `${baseId}-opt-${activeIdx}` : undefined;

    const root = h('div', {
      class: `select ${this.state.open ? 'is-open' : ''} ${disabled ? 'is-disabled' : ''}`,
    },
      h('div', {
        class: 'select__trigger',
        role: 'combobox',
        tabindex: disabled ? '-1' : '0',
        'aria-expanded': String(this.state.open),
        'aria-haspopup': 'listbox',
        'aria-controls': listboxId,
        'aria-activedescendant': activeOptionId,
        'aria-label': ariaLabel || (typeof placeholder === 'string' ? placeholder : undefined),
        'aria-disabled': disabled ? 'true' : undefined,
        onClick: (e: MouseEvent) => {
          // 阻止冒泡到 document 的 outside 处理器：
          // 否则 setState 触发同步 rerender 替换触发器节点后，
          // 原事件 target 变为游离节点，this.el.contains(target) 为 false，
          // 下拉会被立即关闭，表现为“点击无反应”。
          e.stopPropagation();
          if (!disabled) this._setOpen(!this.state.open);
        },
        onKeyDown: (e: KeyboardEvent) => this._onTriggerKeyDown(e),
      },
        h('span', { class: selected ? '' : 'text-tertiary' },
          selected ? selected.label : placeholder),
        h('span', { class: 'select__arrow', 'aria-hidden': 'true' }, '▾'),
      ),
    );

    if (this.state.open && !disabled) {
      const dropdown = h('div', { class: 'select__dropdown', role: 'listbox', id: listboxId },
        ...opts.map((opt, i) => h('div', {
          class: `select__option ${opt.value === this.state.value ? 'is-selected' : ''} ${opt.disabled ? 'is-disabled' : ''} ${i === activeIdx ? 'is-active-opt' : ''}`,
          role: 'option',
          id: `${baseId}-opt-${i}`,
          'aria-selected': String(opt.value === this.state.value),
          'aria-disabled': opt.disabled ? 'true' : undefined,
          onClick: (e: MouseEvent) => {
            e.stopPropagation();
            if (opt.disabled) return;
            this._select(opt);
          },
          onMouseEnter: () => {
            if (!opt.disabled) this.setState({ activeIdx: i });
          },
        }, opt.label)),
      );
      root.appendChild(dropdown);
    }
    return root;
  }

  _setOpen(open: boolean): void {
    if (!open) {
      this.setState({ open: false, activeIdx: -1 });
      this._closePortal();
    } else {
      // 打开时把 active 指到当前选中项（或第一项）
      const opts = this.props.options || [];
      const selIdx = opts.findIndex((o) => o.value === this.state.value);
      // setState 同步触发 _rerender，末尾会调 componentDidUpdate 完成 portal，
      // 因此此处不再手动调 _openPortal（否则会与 componentDidUpdate 重复 portal
      // 导致已 portal 的 dropdown 被 _closePortal 移除后无法找回）。
      this.setState({ open: true, activeIdx: selIdx >= 0 ? selIdx : (opts.length > 0 ? 0 : -1) });
    }
  }

  /** 重渲染后重新 portal：旧 dropdown 已被 mountDropdown 移到 body，
   *  rerender 生成的新 dropdown 留在 root 内，需关闭旧的再开新的，否则旧 dropdown 变孤儿。 */
  componentDidUpdate(): void {
    if (this.state.open && this.el) {
      this._closePortal();
      this._openPortal();
    }
  }

  /** 把 dropdown portal 到 body，避免被 Card overflow:hidden 裁剪。
   *  同步执行（componentDidUpdate 已在 _rerender 之后调用，dropdown 已在 DOM 中）。 */
  _openPortal(): void {
    this._closePortal();
    if (!this.state.open || !this.el) return;
    const dropdown = (this.el as Element).querySelector('.select__dropdown') as HTMLElement | null;
    const trigger = (this.el as Element).querySelector('.select__trigger') as HTMLElement | null;
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

  _select(opt: SelectOption): void {
    this.setState({ value: opt.value, open: false, activeIdx: -1 });
    this._closePortal();
    this.props.onChange?.(opt.value, opt);
  }

  _moveActive(delta: number): void {
    const opts = this.props.options || [];
    if (opts.length === 0) return;
    let idx = this.state.activeIdx;
    if (idx < 0) idx = opts.findIndex((o) => o.value === this.state.value);
    if (idx < 0) idx = delta > 0 ? -1 : opts.length; // 从首/末开始
    // 跳过禁用项
    for (let step = 0; step < opts.length; step++) {
      idx = (idx + delta + opts.length) % opts.length;
      if (!opts[idx].disabled) break;
    }
    this.setState({ activeIdx: idx });
  }

  _onTriggerKeyDown(e: KeyboardEvent): void {
    if (this.props.disabled) return;
    const opts = this.props.options || [];
    switch (e.key) {
      case 'Enter':
      case ' ':
      case 'Spacebar':
        e.preventDefault();
        if (!this.state.open) {
          this._setOpen(true);
        } else if (this.state.activeIdx >= 0 && opts[this.state.activeIdx]) {
          this._select(opts[this.state.activeIdx]);
        }
        break;
      case 'ArrowDown':
        e.preventDefault();
        if (!this.state.open) this._setOpen(true);
        else this._moveActive(1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (!this.state.open) this._setOpen(true);
        else this._moveActive(-1);
        break;
      case 'Home':
        if (this.state.open) { e.preventDefault(); this._moveActiveTo(0); }
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
        if (this.state.open) this._setOpen(false);
        break;
    }
  }

  _moveActiveTo(idx: number): void {
    const opts = this.props.options || [];
    if (idx < 0 || idx >= opts.length) return;
    // 跳过禁用项
    if (opts[idx].disabled) return;
    this.setState({ activeIdx: idx });
  }

  componentDidMount(): void {
    // 点击外部关闭（含 portal 的 dropdown）
    this._outsideHandler = (e: Event) => {
      if (this.state.open && !isClickInside(e, this.el as HTMLElement | null, this._dropdownEl)) {
        this._setOpen(false);
      }
    };
    document.addEventListener('click', this._outsideHandler);
  }

  componentWillUnmount(): void {
    if (this._outsideHandler) {
      document.removeEventListener('click', this._outsideHandler);
    }
    this._closePortal();
  }

  getValue(): any { return this.state.value; }
  setValue(v: any): void { this.setState({ value: v }); }
}
