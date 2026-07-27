// Cascader.ts —— 级联选择（参考 antd Cascader）
import { Component } from '../../core/Component.js';
import { h } from '../../core/utils.js';
import { mountDropdown, isClickInside } from './_portal.js';
import type { Props, State } from '../../core/types.js';

export interface FieldNames {
  label: string;
  value: string;
  children: string;
  disabled: string;
}

export interface CascaderOption {
  value?: any;
  label?: Node | string;
  children?: CascaderOption[];
  disabled?: boolean;
  [key: string]: any;
}

export interface CascaderProps extends Props {
  options?: CascaderOption[];
  value?: Array<string | number>;
  defaultValue?: Array<string | number>;
  placeholder?: string;
  disabled?: boolean;
  allowClear?: boolean;
  changeOnSelect?: boolean;
  expandTrigger?: 'click' | 'hover';
  fieldNames?: Partial<FieldNames>;
  onChange?: (value: Array<string | number>, selectedOptions: CascaderOption[]) => void;
}

export interface CascaderState extends State {
  open: boolean;
  activePath: CascaderOption[];
  fieldNames: FieldNames;
}

const DEFAULT_FIELD_NAMES: FieldNames = { label: 'label', value: 'value', children: 'children', disabled: 'disabled' };

/**
 * 级联选择器
 * props:
 *   - options: Array<{ value, label, children, disabled }>
 *   - value: Array<string|number>（路径）
 *   - placeholder, disabled, allowClear
 *   - onChange: (value, selectedOptions) => void
 *   - changeOnSelect: boolean（点任一级即触发 onChange）
 *   - expandTrigger: 'click' | 'hover'（默认 click）
 *   - fieldNames: 自定义字段名
 */
export class Cascader extends Component {
  declare props: CascaderProps;
  declare state: CascaderState;
  _outsideHandler: ((e: Event) => void) | null = null;
  _dropdownEl: HTMLElement | null = null;
  _portalCleanup: (() => void) | null = null;

  initialState(): CascaderState {
    const fn: FieldNames = { ...DEFAULT_FIELD_NAMES, ...(this.props.fieldNames || {}) };
    return {
      open: false,
      // 当前展开路径（含已选与 hover 中）
      activePath: this._resolvePath(this.props.value || this.props.defaultValue, fn),
      fieldNames: fn,
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

  _openPortal(): void {
    this._closePortal();
    if (!this.state.open || !this.el) return;
    const panel = (this.el as Element).querySelector('.cascader__panel') as HTMLElement | null;
    const trigger = (this.el as Element).querySelector('.cascader__trigger') as HTMLElement | null;
    if (panel && trigger) {
      this._dropdownEl = panel;
      this._portalCleanup = mountDropdown(panel, trigger);
    }
  }

  _closePortal(): void {
    this._portalCleanup?.();
    this._portalCleanup = null;
    this._dropdownEl = null;
  }

  /** 重渲染后重新 portal，避免 body 旧 panel 变孤儿（根因 B） */
  componentDidUpdate(): void {
    if (this.state.open && this.el) {
      this._closePortal();
      this._openPortal();
    }
  }

  /** 根据路径 value 数组解析出对应的 option 节点路径 */
  _resolvePath(values: Array<string | number> | undefined, fn: FieldNames): CascaderOption[] {
    if (!Array.isArray(values) || !values.length) return [];
    let nodes: CascaderOption[] = this.props.options || [];
    const path: CascaderOption[] = [];
    for (const v of values) {
      const found = nodes.find((n) => n[fn.value] === v);
      if (!found) break;
      path.push(found);
      if (!found[fn.children] || !found[fn.children].length) break;
      nodes = found[fn.children];
    }
    return path;
  }

  _setOpen(open: boolean): void {
    if (open) {
      // setState 同步触发 _rerender，末尾 componentDidUpdate 完成 portal
      this.setState({ open: true });
    } else {
      this.setState({ open: false });
      this._closePortal();
    }
  }

  _select(option: CascaderOption, level: number): void {
    const fn = this.state.fieldNames;
    const newPath = this.state.activePath.slice(0, level);
    newPath[level] = option;
    this.setState({ activePath: newPath });

    const hasChildren = option[fn.children]?.length > 0;
    // changeOnSelect：每级点击都触发；否则仅在叶子触发
    if (this.props.changeOnSelect || !hasChildren) {
      const values = newPath.map((o) => o[fn.value]);
      this.props.onChange?.(values, newPath);
    }
    if (!hasChildren) {
      // 叶子：关闭面板
      this.setState({ open: false });
      this._closePortal();
    }
  }

  _hover(option: CascaderOption, level: number): void {
    if (this.props.expandTrigger !== 'hover') return;
    const fn = this.state.fieldNames;
    if (!option[fn.children]?.length) return;
    const newPath = this.state.activePath.slice(0, level);
    newPath[level] = option;
    this.setState({ activePath: newPath });
  }

  _clear(e: MouseEvent): void {
    e.stopPropagation();
    this.setState({ activePath: [], open: false });
    this._closePortal();
    this.props.onChange?.([], []);
  }

  /** 渲染某一列 */
  _renderColumn(options: CascaderOption[] | null | undefined, level: number): Node {
    const fn = this.state.fieldNames;
    const active = this.state.activePath[level];
    return h('div', { class: 'cascader__column' },
      ...(options || []).map((opt) => {
        const isSelected = active && active[fn.value] === opt[fn.value];
        const hasChildren = opt[fn.children]?.length > 0;
        const classes = [
          'cascader__option',
          isSelected && 'is-selected',
          opt[fn.disabled] && 'is-disabled',
        ].filter(Boolean).join(' ');
        const handlers = opt[fn.disabled] ? {} : {
          onClick: (e: MouseEvent) => { e.stopPropagation(); this._select(opt, level); },
          onMouseEnter: () => this._hover(opt, level),
        };
        return h('div', { class: classes, ...handlers },
          h('span', { class: 'cascader__option-label' }, opt[fn.label]),
          hasChildren && h('span', { class: 'cascader__option-arrow', 'aria-hidden': 'true' }, '›'),
        );
      }),
    );
  }

  _renderPanel(): Node {
    const fn = this.state.fieldNames;
    const columns: Node[] = [];
    // 第 0 列始终为顶级 options
    columns.push(this._renderColumn(this.props.options || [], 0));
    // 后续列根据 activePath 展开下一级 children
    for (let i = 0; i < this.state.activePath.length; i++) {
      const cur = this.state.activePath[i];
      const children = cur?.[fn.children];
      if (children?.length) {
        columns.push(this._renderColumn(children, i + 1));
      }
    }
    return h('div', { class: 'cascader__panel', role: 'dialog', onClick: (e: MouseEvent) => e.stopPropagation() },
      ...columns,
    );
  }

  render(): Node | string {
    const { placeholder = '请选择', disabled = false, allowClear = false } = this.props;
    const fn = this.state.fieldNames;
    const text = this.state.activePath.length
      ? this.state.activePath.map((o) => o[fn.label]).join(' / ')
      : '';
    const root = h('div', { class: `cascader ${this.state.open ? 'is-open' : ''} ${disabled ? 'is-disabled' : ''}` },
      h('div', {
        class: 'cascader__trigger',
        tabindex: disabled ? '-1' : '0',
        role: 'combobox',
        'aria-expanded': String(this.state.open),
        'aria-haspopup': 'dialog',
        onClick: (e: MouseEvent) => {
          // 阻止冒泡到 document 的 outside 处理器：
          // setState 触发同步 rerender 替换 trigger 节点后，
          // 原事件 target 变为游离节点，outsideHandler 会误判为外部点击而立即关闭。
          e.stopPropagation();
          if (!disabled) this._setOpen(!this.state.open);
        },
        onKeyDown: (e: KeyboardEvent) => {
          if (e.key === 'Escape' && this.state.open) this._setOpen(false);
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (!disabled) this._setOpen(!this.state.open); }
        },
      },
        h('span', { class: text ? '' : 'text-tertiary' }, text || placeholder),
        h('span', { class: 'cascader__arrow', 'aria-hidden': 'true' }, '▾'),
        allowClear && text && h('span', {
          class: 'cascader__clear', role: 'button', 'aria-label': '清除',
          onClick: (e: MouseEvent) => this._clear(e),
        }, '×'),
      ),
    );
    if (this.state.open && !disabled) root.appendChild(this._renderPanel());
    return root;
  }

  getValue(): Array<string | number> {
    const fn = this.state.fieldNames;
    return this.state.activePath.map((o) => o[fn.value]);
  }
  setValue(v: Array<string | number> | undefined): void {
    this.setState({ activePath: this._resolvePath(v || [], this.state.fieldNames) });
  }
}
