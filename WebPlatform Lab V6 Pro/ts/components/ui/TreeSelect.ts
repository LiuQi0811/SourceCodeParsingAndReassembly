// TreeSelect.ts —— 树选择（参考 antd TreeSelect）
import { Component } from '../../core/Component.js';
import { h } from '../../core/utils.js';
import { mountDropdown, isClickInside } from './_portal.js';
import type { Props, State } from '../../core/types.js';

export interface TreeSelectNode {
  value: string | number;
  title: Node | string;
  children?: TreeSelectNode[] | null;
  disabled?: boolean;
}

/** value 在多选/treeCheckable 模式下为 Set，单选模式下为标量或 null */
type TreeSelectValue = Set<string | number> | string | number | null;

export interface TreeSelectProps extends Props {
  treeData?: TreeSelectNode[];
  value?: Array<string | number> | string | number | null;
  defaultValue?: Array<string | number> | string | number | null;
  placeholder?: string;
  disabled?: boolean;
  allowClear?: boolean;
  onChange?: (value: any, label: any, extra: any) => void;
  treeDefaultExpandAll?: boolean;
  multiple?: boolean;
  treeCheckable?: boolean;
  treeExpandedKeys?: Array<string | number>;
}

export interface TreeSelectState extends State {
  open: boolean;
  // multiple/treeCheckable 用 Set；单选用标量
  value: TreeSelectValue;
  expandedKeys: Set<string | number>;
}

/**
 * 树选择器
 * props:
 *   - treeData: Array<{ value, title, children, disabled }>
 *   - value: 单值或数组（multiple/treeCheckable 时为数组）
 *   - placeholder, disabled, allowClear
 *   - onChange: (value, label, extra) => void
 *   - treeDefaultExpandAll: boolean
 *   - multiple: boolean（多选）
 *   - treeCheckable: boolean（带复选框多选）
 *   - treeExpandedKeys: 受控展开
 */
export class TreeSelect extends Component {
  declare props: TreeSelectProps;
  declare state: TreeSelectState;
  _outsideHandler: ((e: Event) => void) | null = null;
  _dropdownEl: HTMLElement | null = null;
  _portalCleanup: (() => void) | null = null;

  initialState(): TreeSelectState {
    const data = this.props.treeData || [];
    const initialExpanded = this.props.treeDefaultExpandAll
      ? this._collectKeys(data)
      : (this.props.treeExpandedKeys || []);
    const value = this.props.value ?? this.props.defaultValue;
    return {
      open: false,
      // multiple/treeCheckable 用 Set；单选用标量
      value: (this.props.multiple || this.props.treeCheckable)
        ? new Set<string | number>(Array.isArray(value) ? value : (value == null ? [] : [value]))
        : ((value as string | number | null) ?? null),
      expandedKeys: new Set(initialExpanded),
    };
  }

  /** 递归收集所有节点 value */
  _collectKeys(nodes: TreeSelectNode[], acc: Array<string | number> = []): Array<string | number> {
    for (const n of nodes) {
      acc.push(n.value);
      if (n.children?.length) this._collectKeys(n.children, acc);
    }
    return acc;
  }

  /** 在树中查找指定 value 的节点 */
  _findNode(nodes: TreeSelectNode[], value: string | number): TreeSelectNode | null {
    for (const n of nodes) {
      if (n.value === value) return n;
      if (n.children?.length) {
        const f = this._findNode(n.children, value);
        if (f) return f;
      }
    }
    return null;
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
      this.setState({ open: true });
    } else {
      this.setState({ open: false });
      this._closePortal();
    }
  }

  /** 重渲染后重新 portal，避免 body 旧 panel 变孤儿（根因 B） */
  componentDidUpdate(): void {
    if (this.state.open && this.el) {
      this._closePortal();
      this._openPortal();
    }
  }

  _openPortal(): void {
    this._closePortal();
    if (!this.state.open || !this.el) return;
    const panel = (this.el as Element).querySelector('.treeselect__panel') as HTMLElement | null;
    const trigger = (this.el as Element).querySelector('.treeselect__trigger') as HTMLElement | null;
    if (panel && trigger) {
      this._dropdownEl = panel;
      this._portalCleanup = mountDropdown(panel, trigger, { align: 'matchWidth' });
    }
  }

  _closePortal(): void {
    this._portalCleanup?.();
    this._portalCleanup = null;
    this._dropdownEl = null;
  }

  /** 选中节点 */
  _select(node: TreeSelectNode): void {
    if (node.disabled) return;
    if (this.props.multiple || this.props.treeCheckable) {
      const next = new Set<string | number>(this.state.value as Set<string | number>);
      if (next.has(node.value)) next.delete(node.value);
      else next.add(node.value);
      this.setState({ value: next });
      const arr = Array.from(next);
      this.props.onChange?.(arr, arr.map((v) => this._findNode(this.props.treeData || [], v)?.title), { node, selected: next.has(node.value) });
    } else {
      this.setState({ value: node.value, open: false });
      this._closePortal();
      this.props.onChange?.(node.value, node.title, { node, selected: true });
    }
  }

  /** 勾选复选框：含父子联动 */
  _toggleCheck(node: TreeSelectNode): void {
    if (node.disabled) return;
    const next = new Set<string | number>(this.state.value as Set<string | number>);
    const descendants = this._collectKeys([node]);
    const checked = next.has(node.value);
    descendants.forEach((k) => (checked ? next.delete(k) : next.add(k)));
    // 自下而上重算祖先
    const path = this._findPath(this.props.treeData || [], node.value);
    if (path) {
      for (let i = path.length - 2; i >= 0; i--) {
        const anc = path[i];
        const childKeys = (anc.children || []).map((c) => c.value);
        const allChecked = childKeys.length > 0 && childKeys.every((k) => next.has(k));
        if (allChecked) next.add(anc.value);
        else next.delete(anc.value);
      }
    }
    this.setState({ value: next });
    const arr = Array.from(next);
    this.props.onChange?.(arr, arr.map((v) => this._findNode(this.props.treeData || [], v)?.title), { node, checked: !checked });
  }

  _findPath(nodes: TreeSelectNode[], value: string | number, path: TreeSelectNode[] = []): TreeSelectNode[] | null {
    for (const n of nodes) {
      path.push(n);
      if (n.value === value) return path;
      if (n.children?.length && this._findPath(n.children, value, path)) return path;
      path.pop();
    }
    return null;
  }

  _toggleExpand(value: string | number): void {
    const next = new Set(this.state.expandedKeys);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    this.setState({ expandedKeys: next });
  }

  /** 显示文字：单选为单个 title，多选为逗号拼接 */
  _renderText(): string {
    const data = this.props.treeData || [];
    if (this.props.multiple || this.props.treeCheckable) {
      const arr = Array.from(this.state.value as Set<string | number>);
      if (!arr.length) return '';
      return arr.map((v) => this._findNode(data, v)?.title || v).join('，');
    }
    if (this.state.value == null) return '';
    return String(this._findNode(data, this.state.value as string | number)?.title || '');
  }

  _clear(e: MouseEvent): void {
    e.stopPropagation();
    const value: TreeSelectValue = (this.props.multiple || this.props.treeCheckable) ? new Set<string | number>() : null;
    this.setState({ value, open: false });
    this._closePortal();
    this.props.onChange?.(value, [], {});
  }

  /** 递归渲染树节点 */
  _renderNode(node: TreeSelectNode, level: number): Node {
    const hasChildren = (node.children?.length ?? 0) > 0;
    const isLeaf = !hasChildren;
    const expanded = this.state.expandedKeys.has(node.value);
    const checkable = !!this.props.treeCheckable;
    const checked = (this.props.multiple || this.props.treeCheckable)
      ? (this.state.value as Set<string | number>).has(node.value)
      : this.state.value === node.value;

    const indents: Node[] = [];
    for (let i = 0; i < level; i++) indents.push(h('span', { class: 'treeselect__indent' }));

    const switcher = h('span', {
      class: ['treeselect__switcher', isLeaf ? 'is-leaf' : (expanded ? 'is-open' : 'is-close')].join(' '),
      onClick: (e: MouseEvent) => { e.stopPropagation(); if (!isLeaf) this._toggleExpand(node.value); },
    }, isLeaf ? '' : (expanded ? '▼' : '▶'));

    const checkbox = checkable ? h('span', {
      class: ['treeselect__checkbox', checked && 'is-checked', node.disabled && 'is-disabled'].filter(Boolean).join(' '),
      onClick: (e: MouseEvent) => { e.stopPropagation(); this._toggleCheck(node); },
    }) : null;

    const title = h('span', {
      class: ['treeselect__title',
        !checkable && checked && 'is-selected',
        node.disabled && 'is-disabled',
      ].filter(Boolean).join(' '),
      onClick: () => this._select(node),
    }, node.title);

    return h('div', { class: 'treeselect__node', 'data-value': node.value },
      h('div', { class: 'treeselect__node-content' },
        ...indents, switcher, checkbox, title,
      ),
      hasChildren && expanded && h('div', { class: 'treeselect__children' },
        ...node.children!.map((c) => this._renderNode(c, level + 1)),
      ),
    );
  }

  _renderPanel(): Node {
    return h('div', { class: 'treeselect__panel', role: 'dialog', onClick: (e: MouseEvent) => e.stopPropagation() },
      ...(this.props.treeData || []).map((n) => this._renderNode(n, 0)),
    );
  }

  render(): Node | string {
    const { placeholder = '请选择', disabled = false, allowClear = false } = this.props;
    const text = this._renderText();
    const root = h('div', { class: `treeselect ${this.state.open ? 'is-open' : ''} ${disabled ? 'is-disabled' : ''}` },
      h('div', {
        class: 'treeselect__trigger',
        tabindex: disabled ? '-1' : '0',
        role: 'combobox',
        'aria-expanded': String(this.state.open),
        'aria-haspopup': 'dialog',
        onClick: (e: MouseEvent) => {
          // 阻止冒泡到 document 的 outside 处理器（同 DatePicker/Cascader/ColorPicker/TimePicker）
          e.stopPropagation();
          if (!disabled) this._setOpen(!this.state.open);
        },
        onKeyDown: (e: KeyboardEvent) => {
          if (e.key === 'Escape' && this.state.open) this._setOpen(false);
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (!disabled) this._setOpen(!this.state.open); }
        },
      },
        h('span', { class: text ? '' : 'text-tertiary' }, text || placeholder),
        h('span', { class: 'treeselect__arrow', 'aria-hidden': 'true' }, '▾'),
        allowClear && text && h('span', {
          class: 'treeselect__clear', role: 'button', 'aria-label': '清除',
          onClick: (e: MouseEvent) => this._clear(e),
        }, '×'),
      ),
    );
    if (this.state.open && !disabled) root.appendChild(this._renderPanel());
    return root;
  }

  getValue(): Array<string | number> | string | number | null {
    if (this.props.multiple || this.props.treeCheckable) return Array.from(this.state.value as Set<string | number>);
    return this.state.value as string | number | null;
  }
  setValue(v: Array<string | number> | string | number | null | undefined): void {
    if (this.props.multiple || this.props.treeCheckable) {
      this.setState({ value: new Set<string | number>(Array.isArray(v) ? v : (v == null ? [] : [v])) });
    } else {
      this.setState({ value: v ?? null });
    }
  }
}
