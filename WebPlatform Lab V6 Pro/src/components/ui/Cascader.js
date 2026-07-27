// Cascader.js —— 级联选择（参考 antd Cascader）
import { Component } from '../../core/Component.js';
import { h } from '../../core/utils.js';
import { mountDropdown, isClickInside } from './_portal.js';

const DEFAULT_FIELD_NAMES = { label: 'label', value: 'value', children: 'children', disabled: 'disabled' };

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
  initialState() {
    const fn = { ...DEFAULT_FIELD_NAMES, ...(this.props.fieldNames || {}) };
    return {
      open: false,
      // 当前展开路径（含已选与 hover 中）
      activePath: this._resolvePath(this.props.value || this.props.defaultValue, fn),
      fieldNames: fn,
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

  _openPortal() {
    this._closePortal();
    if (!this.state.open || !this.el) return;
    const panel = this.el.querySelector('.cascader__panel');
    const trigger = this.el.querySelector('.cascader__trigger');
    if (panel && trigger) {
      this._dropdownEl = panel;
      this._portalCleanup = mountDropdown(panel, trigger);
    }
  }

  _closePortal() {
    this._portalCleanup?.();
    this._portalCleanup = null;
    this._dropdownEl = null;
  }

  /** 重渲染后重新 portal，避免 body 旧 panel 变孤儿（根因 B） */
  componentDidUpdate() {
    if (this.state.open && this.el) {
      this._closePortal();
      this._openPortal();
    }
  }

  /** 根据路径 value 数组解析出对应的 option 节点路径 */
  _resolvePath(values, fn) {
    if (!Array.isArray(values) || !values.length) return [];
    let nodes = this.props.options || [];
    const path = [];
    for (const v of values) {
      const found = nodes.find((n) => n[fn.value] === v);
      if (!found) break;
      path.push(found);
      if (!found[fn.children] || !found[fn.children].length) break;
      nodes = found[fn.children];
    }
    return path;
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

  _select(option, level) {
    const fn = this.state.fieldNames;
    const newPath = this.state.activePath.slice(0, level);
    newPath[level] = option;
    // 直接改 state 字段，绕过 setState，避免 _rerender 重建 DOM 导致闪屏
    this.state.activePath = newPath;

    const hasChildren = option[fn.children]?.length > 0;
    // changeOnSelect：每级点击都触发；否则仅在叶子触发
    if (this.props.changeOnSelect || !hasChildren) {
      const values = newPath.map((o) => o[fn.value]);
      this.props.onChange?.(values, newPath);
    }
    if (!hasChildren) {
      // 叶子：关闭面板（_setOpen 内部用 setState，属低频操作，允许；
      // _rerender 会重建 trigger，文本随之更新）
      this._setOpen(false);
    } else {
      // 非叶子：仅重建 panel + 更新 trigger 文本，不触发 _rerender
      this._syncPanelDom();
      this._syncTriggerText();
    }
  }

  _hover(option, level) {
    if (this.props.expandTrigger !== 'hover') return;
    const fn = this.state.fieldNames;
    if (!option[fn.children]?.length) return;
    const newPath = this.state.activePath.slice(0, level);
    newPath[level] = option;
    // 直接改 state 字段，绕过 setState，避免 _rerender 重建 DOM 导致闪屏
    this.state.activePath = newPath;
    // 仅重建 panel，不重建 trigger
    this._syncPanelDom();
  }

  /** 局部重建 panel：用 _renderPanel 生成新 DOM 替换旧 panel 节点，并重新 portal */
  _syncPanelDom() {
    const oldPanel = this._dropdownEl || this.el?.querySelector('.cascader__panel');
    if (!oldPanel) return;
    const newPanel = this._renderPanel();
    // 同步替换旧 panel 节点（浏览器不会在同步操作之间渲染，无闪屏）
    if (oldPanel.parentNode) {
      oldPanel.parentNode.replaceChild(newPanel, oldPanel);
    }
    // 重新 portal 新 panel：先关闭旧 portal（解绑监听），再挂载新 portal
    this._closePortal();
    const trigger = this.el?.querySelector('.cascader__trigger');
    if (trigger) {
      this._dropdownEl = newPanel;
      this._portalCleanup = mountDropdown(newPanel, trigger);
    }
  }

  /** 同步 trigger 文本（不触发 rerender） */
  _syncTriggerText() {
    if (!this.el) return;
    const trigger = this.el.querySelector('.cascader__trigger');
    if (!trigger) return;
    const fn = this.state.fieldNames;
    const text = this.state.activePath.length
      ? this.state.activePath.map((o) => o[fn.label]).join(' / ')
      : '';
    const textSpan = trigger.querySelector('span');
    if (!textSpan) return;
    textSpan.textContent = text || (this.props.placeholder ?? '请选择');
    textSpan.className = text ? '' : 'text-tertiary';
  }

  _clear(e) {
    e.stopPropagation();
    this.setState({ activePath: [], open: false });
    this._closePortal();
    this.props.onChange?.([], []);
  }

  /** 渲染某一列 */
  _renderColumn(options, level) {
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
          onClick: (e) => { e.stopPropagation(); this._select(opt, level); },
          onMouseEnter: () => this._hover(opt, level),
        };
        return h('div', { class: classes, ...handlers },
          h('span', { class: 'cascader__option-label' }, opt[fn.label]),
          hasChildren && h('span', { class: 'cascader__option-arrow', 'aria-hidden': 'true' }, '›'),
        );
      }),
    );
  }

  _renderPanel() {
    const fn = this.state.fieldNames;
    const columns = [];
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
    return h('div', { class: 'cascader__panel', role: 'dialog', onClick: (e) => e.stopPropagation() },
      ...columns,
    );
  }

  render() {
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
        onClick: (e) => {
          // 阻止冒泡到 document 的 outside 处理器：
          // setState 触发同步 rerender 替换 trigger 节点后，
          // 原事件 target 变为游离节点，outsideHandler 会误判为外部点击而立即关闭。
          e.stopPropagation();
          if (!disabled) this._setOpen(!this.state.open);
        },
        onKeyDown: (e) => {
          if (e.key === 'Escape' && this.state.open) this._setOpen(false);
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (!disabled) this._setOpen(!this.state.open); }
        },
      },
        h('span', { class: text ? '' : 'text-tertiary' }, text || placeholder),
        h('span', { class: 'cascader__arrow', 'aria-hidden': 'true' }, '▾'),
        allowClear && text && h('span', {
          class: 'cascader__clear', role: 'button', 'aria-label': '清除',
          onClick: (e) => this._clear(e),
        }, '×'),
      ),
    );
    if (this.state.open && !disabled) root.appendChild(this._renderPanel());
    return root;
  }

  getValue() {
    const fn = this.state.fieldNames;
    return this.state.activePath.map((o) => o[fn.value]);
  }
  setValue(v) {
    this.setState({ activePath: this._resolvePath(v || [], this.state.fieldNames) });
  }
}
