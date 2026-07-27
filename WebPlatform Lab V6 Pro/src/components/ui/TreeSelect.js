// TreeSelect.js —— 树选择（参考 antd TreeSelect）
import { Component } from '../../core/Component.js';
import { h } from '../../core/utils.js';
import { mountDropdown, isClickInside } from './_portal.js';

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
  initialState() {
    const data = this.props.treeData || [];
    const initialExpanded = this.props.treeDefaultExpandAll
      ? this._collectKeys(data)
      : (this.props.treeExpandedKeys || []);
    const value = this.props.value ?? this.props.defaultValue;
    return {
      open: false,
      // multiple/treeCheckable 用 Set；单选用标量
      value: (this.props.multiple || this.props.treeCheckable)
        ? new Set(Array.isArray(value) ? value : (value == null ? [] : [value]))
        : (value ?? null),
      expandedKeys: new Set(initialExpanded),
    };
  }

  /** 递归收集所有节点 value */
  _collectKeys(nodes, acc = []) {
    for (const n of nodes) {
      acc.push(n.value);
      if (n.children?.length) this._collectKeys(n.children, acc);
    }
    return acc;
  }

  /** 在树中查找指定 value 的节点 */
  _findNode(nodes, value) {
    for (const n of nodes) {
      if (n.value === value) return n;
      if (n.children?.length) {
        const f = this._findNode(n.children, value);
        if (f) return f;
      }
    }
    return null;
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
      this.setState({ open: true });
    } else {
      this.setState({ open: false });
      this._closePortal();
    }
  }

  /** 重渲染后重新 portal，避免 body 旧 panel 变孤儿（根因 B） */
  componentDidUpdate() {
    if (this.state.open && this.el) {
      this._closePortal();
      this._openPortal();
    }
  }

  _openPortal() {
    this._closePortal();
    if (!this.state.open || !this.el) return;
    const panel = this.el.querySelector('.treeselect__panel');
    const trigger = this.el.querySelector('.treeselect__trigger');
    if (panel && trigger) {
      this._dropdownEl = panel;
      this._portalCleanup = mountDropdown(panel, trigger, { align: 'matchWidth' });
    }
  }

  _closePortal() {
    this._portalCleanup?.();
    this._portalCleanup = null;
    this._dropdownEl = null;
  }

  /** 选中节点 */
  _select(node) {
    if (node.disabled) return;
    if (this.props.multiple || this.props.treeCheckable) {
      const next = new Set(this.state.value);
      if (next.has(node.value)) next.delete(node.value);
      else next.add(node.value);
      // 直接更新 state 字段，不触发 setState/rerender：
      // setState 会触发 _rerender 重建整个 TreeSelect DOM（含 panel），
      // 导致正在交互的节点被销毁重建 → 闪屏，且会触发 componentDidUpdate 重新 portal。
      this.state.value = next;
      this._syncNodeCheckDom(node.value);
      this._syncTriggerDom();
      const arr = Array.from(next);
      this.props.onChange?.(arr, arr.map((v) => this._findNode(this.props.treeData || [], v)?.title), { node, selected: next.has(node.value) });
    } else {
      // 单选：低频，保留 setState（关闭面板）
      this.setState({ value: node.value, open: false });
      this._closePortal();
      this.props.onChange?.(node.value, node.title, { node, selected: true });
    }
  }

  /** 勾选复选框：含父子联动 */
  _toggleCheck(node) {
    if (node.disabled) return;
    const next = new Set(this.state.value);
    const descendants = this._collectKeys([node]);
    const checked = next.has(node.value);
    descendants.forEach((k) => (checked ? next.delete(k) : next.add(k)));
    // 自下而上重算祖先
    const path = this._findPath(this.props.treeData || [], node.value);
    const affectedAncestors = [];
    if (path) {
      for (let i = path.length - 2; i >= 0; i--) {
        const anc = path[i];
        const childKeys = (anc.children || []).map((c) => c.value);
        const allChecked = childKeys.length > 0 && childKeys.every((k) => next.has(k));
        if (allChecked) next.add(anc.value);
        else next.delete(anc.value);
        affectedAncestors.push(anc.value);
      }
    }
    this.state.value = next;
    [...descendants, ...affectedAncestors].forEach((k) => this._syncNodeCheckDom(k));
    this._syncTriggerDom();
    const arr = Array.from(next);
    this.props.onChange?.(arr, arr.map((v) => this._findNode(this.props.treeData || [], v)?.title), { node, checked: !checked });
  }

  _findPath(nodes, value, path = []) {
    for (const n of nodes) {
      path.push(n);
      if (n.value === value) return path;
      if (n.children?.length && this._findPath(n.children, value, path)) return path;
      path.pop();
    }
    return null;
  }

  _toggleExpand(value) {
    const next = new Set(this.state.expandedKeys);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    this.state.expandedKeys = next;
    this._syncExpandDom(value);
  }

  /** panel 被 portal 到 body 后，节点查询应基于 portal 元素 */
  _getPanelRoot() {
    return this._dropdownEl || this.el;
  }

  /** 直接操作 DOM 同步展开/收起状态，不触发 rerender */
  _syncExpandDom(value) {
    const root = this._getPanelRoot();
    if (!root) return;
    const nodeEl = root.querySelector(`.treeselect__node[data-value="${value}"]`);
    if (!nodeEl) return;
    const expanded = this.state.expandedKeys.has(value);
    const children = nodeEl.querySelector(':scope > .treeselect__children');
    if (children) children.hidden = !expanded;
    const switcher = nodeEl.querySelector(':scope > .treeselect__node-content > .treeselect__switcher');
    if (switcher) {
      switcher.classList.toggle('is-open', expanded);
      switcher.classList.toggle('is-close', !expanded);
      switcher.textContent = expanded ? '▼' : '▶';
    }
  }

  /** 直接操作 DOM 同步节点选中/勾选状态，不触发 rerender */
  _syncNodeCheckDom(value) {
    const root = this._getPanelRoot();
    if (!root) return;
    const nodeEl = root.querySelector(`.treeselect__node[data-value="${value}"]`);
    if (!nodeEl) return;
    const checked = (this.props.multiple || this.props.treeCheckable)
      ? this.state.value.has(value)
      : this.state.value === value;
    const checkable = !!this.props.treeCheckable;
    if (checkable) {
      const checkbox = nodeEl.querySelector(':scope > .treeselect__node-content > .treeselect__checkbox');
      if (checkbox) checkbox.classList.toggle('is-checked', checked);
    } else {
      const title = nodeEl.querySelector(':scope > .treeselect__node-content > .treeselect__title');
      if (title) title.classList.toggle('is-selected', checked);
    }
  }

  /** 直接操作 DOM 同步 trigger 文本与 clear 按钮显隐，不触发 rerender */
  _syncTriggerDom() {
    if (!this.el) return;
    const trigger = this.el.querySelector('.treeselect__trigger');
    if (!trigger) return;
    const text = this._renderText();
    // 文本 span 是 trigger 的第一个子元素
    const textSpan = trigger.firstElementChild;
    if (textSpan) {
      textSpan.textContent = text || this.props.placeholder || '请选择';
      textSpan.className = text ? '' : 'text-tertiary';
    }
    // clear 按钮（render 中 allowClear 时始终渲染，用 hidden 控制）
    const clearBtn = trigger.querySelector('.treeselect__clear');
    if (clearBtn) clearBtn.hidden = !text;
  }

  /** 显示文字：单选为单个 title，多选为逗号拼接 */
  _renderText() {
    const data = this.props.treeData || [];
    if (this.props.multiple || this.props.treeCheckable) {
      const arr = Array.from(this.state.value);
      if (!arr.length) return '';
      return arr.map((v) => this._findNode(data, v)?.title || v).join('，');
    }
    if (this.state.value == null) return '';
    return this._findNode(data, this.state.value)?.title || '';
  }

  _clear(e) {
    e.stopPropagation();
    const value = (this.props.multiple || this.props.treeCheckable) ? new Set() : null;
    this.setState({ value, open: false });
    this._closePortal();
    this.props.onChange?.(value, [], {});
  }

  /** 递归渲染树节点 */
  _renderNode(node, level) {
    const hasChildren = node.children?.length > 0;
    const isLeaf = !hasChildren;
    const expanded = this.state.expandedKeys.has(node.value);
    const checkable = !!this.props.treeCheckable;
    const checked = (this.props.multiple || this.props.treeCheckable)
      ? this.state.value.has(node.value)
      : this.state.value === node.value;

    const indents = [];
    for (let i = 0; i < level; i++) indents.push(h('span', { class: 'treeselect__indent' }));

    const switcher = h('span', {
      class: ['treeselect__switcher', isLeaf ? 'is-leaf' : (expanded ? 'is-open' : 'is-close')].join(' '),
      onClick: (e) => { e.stopPropagation(); if (!isLeaf) this._toggleExpand(node.value); },
    }, isLeaf ? '' : (expanded ? '▼' : '▶'));

    const checkbox = checkable ? h('span', {
      class: ['treeselect__checkbox', checked && 'is-checked', node.disabled && 'is-disabled'].filter(Boolean).join(' '),
      onClick: (e) => { e.stopPropagation(); this._toggleCheck(node); },
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
      // 始终渲染 children，用 hidden 控制显隐：
      // 这样 _toggleExpand 只需切 hidden 属性，无需重建 DOM（避免闪屏）。
      hasChildren && h('div', { class: 'treeselect__children', hidden: !expanded },
        ...node.children.map((c) => this._renderNode(c, level + 1)),
      ),
    );
  }

  _renderPanel() {
    return h('div', { class: 'treeselect__panel', role: 'dialog', onClick: (e) => e.stopPropagation() },
      ...(this.props.treeData || []).map((n) => this._renderNode(n, 0)),
    );
  }

  render() {
    const { placeholder = '请选择', disabled = false, allowClear = false } = this.props;
    const text = this._renderText();
    const root = h('div', { class: `treeselect ${this.state.open ? 'is-open' : ''} ${disabled ? 'is-disabled' : ''}` },
      h('div', {
        class: 'treeselect__trigger',
        tabindex: disabled ? '-1' : '0',
        role: 'combobox',
        'aria-expanded': String(this.state.open),
        'aria-haspopup': 'dialog',
        onClick: (e) => {
          // 阻止冒泡到 document 的 outside 处理器（同 DatePicker/Cascader/ColorPicker/TimePicker）
          e.stopPropagation();
          if (!disabled) this._setOpen(!this.state.open);
        },
        onKeyDown: (e) => {
          if (e.key === 'Escape' && this.state.open) this._setOpen(false);
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (!disabled) this._setOpen(!this.state.open); }
        },
      },
        h('span', { class: text ? '' : 'text-tertiary' }, text || placeholder),
        h('span', { class: 'treeselect__arrow', 'aria-hidden': 'true' }, '▾'),
        // 始终渲染 clear 按钮（allowClear 时），用 hidden 控制显隐：
        // 这样多选切换时 _syncTriggerDom 只需切 hidden，无需重建 DOM。
        allowClear && h('span', {
          class: 'treeselect__clear', role: 'button', 'aria-label': '清除',
          hidden: !text,
          onClick: (e) => this._clear(e),
        }, '×'),
      ),
    );
    if (this.state.open && !disabled) root.appendChild(this._renderPanel());
    return root;
  }

  getValue() {
    if (this.props.multiple || this.props.treeCheckable) return Array.from(this.state.value);
    return this.state.value;
  }
  setValue(v) {
    if (this.props.multiple || this.props.treeCheckable) {
      this.setState({ value: new Set(Array.isArray(v) ? v : (v == null ? [] : [v])) });
    } else {
      this.setState({ value: v });
    }
  }
}
