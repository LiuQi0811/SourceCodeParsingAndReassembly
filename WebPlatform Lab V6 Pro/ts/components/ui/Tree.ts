// Tree.ts —— 树形控件
import { Component } from '../../core/Component.js';
import { h } from '../../core/utils.js';
import type { Props, State } from '../../core/types.js';

export interface TreeNode {
  key: string;
  title: Node | string;
  icon?: Node | string | null;
  disabled?: boolean;
  isLeaf?: boolean;
  children?: TreeNode[] | null;
}

export interface TreeProps extends Props {
  treeData?: TreeNode[];
  selectedKeys?: string[];
  expandedKeys?: string[];
  checkedKeys?: string[];
  defaultExpandAll?: boolean;
  checkable?: boolean;
  selectable?: boolean;
  draggable?: boolean;
  showLine?: boolean;
  blockNode?: boolean;
  onExpand?: (keys: string[], info: { expanded: boolean; node: TreeNode | null }) => void;
  onSelect?: (keys: string[], info: { node: TreeNode | null; selected: boolean; selectedKeys: string[] }) => void;
  onCheck?: (keys: string[], info: { node: TreeNode; checked: boolean }) => void;
  onDragStart?: (info: { event: DragEvent; node: TreeNode }) => void;
  onDragEnter?: (info: { event: DragEvent; node: TreeNode }) => void;
  onDragOver?: (info: { event: DragEvent; node: TreeNode }) => void;
  onDrop?: (info: { event: DragEvent; node: TreeNode }) => void;
}

export interface TreeState extends State {
  selectedKeys: Set<string>;
  expandedKeys: Set<string>;
  checkedKeys: Set<string>;
}

export class Tree extends Component {
  declare props: TreeProps;
  declare state: TreeState;

  initialState(): TreeState {
    const {
      selectedKeys = [], expandedKeys, checkedKeys = [],
      defaultExpandAll = false, treeData = [],
    } = this.props;
    // 受控/非受控统一处理：把传入 keys 作为初值
    const initialExpanded = expandedKeys
      ? new Set(expandedKeys)
      : new Set(defaultExpandAll ? this._collectKeys(treeData) : []);
    return {
      selectedKeys: new Set(selectedKeys),
      expandedKeys: initialExpanded,
      checkedKeys: new Set(checkedKeys),
    };
  }

  /** 递归收集所有节点 key */
  _collectKeys(nodes: TreeNode[], acc: string[] = []): string[] {
    for (const n of nodes) {
      acc.push(n.key);
      if (n.children?.length) this._collectKeys(n.children, acc);
    }
    return acc;
  }

  /** 在树中查找指定 key 的节点 */
  _findNode(nodes: TreeNode[], key: string): TreeNode | null {
    for (const n of nodes) {
      if (n.key === key) return n;
      if (n.children?.length) {
        const found = this._findNode(n.children, key);
        if (found) return found;
      }
    }
    return null;
  }

  /** 查找从根到指定 key 的路径（含自身） */
  _findPath(nodes: TreeNode[], key: string, path: TreeNode[] = []): TreeNode[] | null {
    for (const n of nodes) {
      path.push(n);
      if (n.key === key) return path;
      if (n.children?.length && this._findPath(n.children, key, path)) return path;
      path.pop();
    }
    return null;
  }

  /** 展开 / 收起节点 */
  _toggleExpand(key: string): void {
    const next = new Set(this.state.expandedKeys);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    this.setState({ expandedKeys: next });
    this.props.onExpand?.(Array.from(next), { expanded: next.has(key), node: this._findNode(this.props.treeData || [], key) });
  }

  /** 选中节点（单选语义） */
  _select(key: string, node: TreeNode | null): void {
    if (node?.disabled) return;
    // selectable 默认 true：未传时也应允许选中（与 render 中解构默认值保持一致）
    if (this.props.selectable === false) return;
    const next = new Set([key]);
    this.setState({ selectedKeys: next });
    this.props.onSelect?.(Array.from(next), { node, selected: true, selectedKeys: Array.from(next) });
  }

  /** 勾选 / 取消勾选（含父子联动） */
  _toggleCheck(key: string, checked: boolean): void {
    const next = new Set(this.state.checkedKeys);
    const node = this._findNode(this.props.treeData || [], key);
    if (!node) return;
    // 自身及所有后代同步
    const descendants = this._collectKeys([node]);
    descendants.forEach((k) => (checked ? next.add(k) : next.delete(k)));
    // 自下而上重算祖先勾选状态：直接子节点全选则父勾选
    const path = this._findPath(this.props.treeData || [], key);
    if (path) {
      for (let i = path.length - 2; i >= 0; i--) {
        const ancestor = path[i];
        const childKeys = (ancestor.children || []).map((c) => c.key);
        const allChecked = childKeys.length > 0 && childKeys.every((k) => next.has(k));
        if (allChecked) next.add(ancestor.key);
        else next.delete(ancestor.key);
      }
    }
    this.setState({ checkedKeys: next });
    this.props.onCheck?.(Array.from(next), { node, checked });
  }

  render(): Node | string {
    const {
      treeData = [], checkable = false, selectable = true,
      draggable = false, showLine = false, blockNode = false,
    } = this.props;

    const classes = [
      'tree',
      showLine && 'tree--line',
      blockNode && 'tree--block',
    ].filter(Boolean).join(' ');

    return h('div', { class: classes },
      ...(treeData.map((node) => this._renderNode(node, 0))),
    );
  }

  /** 递归渲染单个节点 */
  _renderNode(node: TreeNode, level: number): Node {
    const hasChildren = (node.children?.length ?? 0) > 0;
    const isLeaf = node.isLeaf ?? !hasChildren;
    const expanded = this.state.expandedKeys.has(node.key);
    const selected = this.state.selectedKeys.has(node.key);
    const checked = this.state.checkedKeys.has(node.key);
    const { checkable, draggable } = this.props;

    // 层级缩进
    const indents: Node[] = [];
    for (let i = 0; i < level; i++) {
      indents.push(h('span', { class: 'tree__indent' }));
    }

    // 展开/收起箭头
    const switcher = h('span', {
      class: [
        'tree__switcher',
        isLeaf ? 'tree__switcher--leaf' : (expanded ? 'tree__switcher--open' : 'tree__switcher--close'),
      ].join(' '),
      onClick: (e: MouseEvent) => {
        e.stopPropagation();
        if (!isLeaf) this._toggleExpand(node.key);
      },
    }, isLeaf ? '' : (expanded ? '▼' : '▶'));

    // 勾选框
    const checkbox = checkable ? h('span', {
      class: [
        'tree__checkbox',
        checked && 'tree__checkbox--checked',
        node.disabled && 'tree__checkbox--disabled',
      ].filter(Boolean).join(' '),
      onClick: (e: MouseEvent) => {
        e.stopPropagation();
        if (node.disabled) return;
        this._toggleCheck(node.key, !checked);
      },
    }) : null;

    // 标题区
    const titleProps: Record<string, any> = {
      class: [
        'tree__title',
        selected && 'tree__title--selected',
        node.disabled && 'tree__title--disabled',
      ].filter(Boolean).join(' '),
      onClick: () => this._select(node.key, node),
    };
    if (draggable) {
      titleProps.draggable = true;
      titleProps.onDragStart = (e: DragEvent) => this.props.onDragStart?.({ event: e, node });
      titleProps.onDragEnter = (e: DragEvent) => { e.preventDefault(); this.props.onDragEnter?.({ event: e, node }); };
      titleProps.onDragOver = (e: DragEvent) => e.preventDefault();
      titleProps.onDrop = (e: DragEvent) => { e.preventDefault(); this.props.onDrop?.({ event: e, node }); };
    }
    const title = h('span', titleProps,
      node.icon && h('span', { class: 'tree__icon' }, node.icon),
      h('span', { class: 'tree__label' }, node.title),
    );

    return h('div', { class: 'tree__node', 'data-key': node.key },
      h('div', { class: 'tree__node-content' },
        ...indents,
        switcher,
        checkbox,
        title,
      ),
      hasChildren && expanded && h('div', { class: 'tree__children' },
        ...node.children!.map((c) => this._renderNode(c, level + 1)),
      ),
    );
  }

  /** 外部调用：展开/收起 */
  setExpandedKeys(keys: string[]): void { this.setState({ expandedKeys: new Set(keys) }); }
  setSelectedKeys(keys: string[]): void { this.setState({ selectedKeys: new Set(keys) }); }
  setCheckedKeys(keys: string[]): void { this.setState({ checkedKeys: new Set(keys) }); }
}
