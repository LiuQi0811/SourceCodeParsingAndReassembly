// Select.js —— 下拉选择组件
import { Component } from '../../core/Component.js';
import { h } from '../../core/utils.js';

export class Select extends Component {
  initialState() {
    return { open: false, value: this.props.value ?? null };
  }

  render() {
    const { options = [], placeholder = '请选择', disabled = false } = this.props;
    const selected = options.find((o) => o.value === this.state.value);

    const root = h('div', {
      class: `select ${this.state.open ? 'is-open' : ''}`,
    },
      h('div', {
        class: 'select__trigger', tabindex: '0',
        onClick: (e) => {
          // 阻止冒泡到 document 的 outside 处理器：
          // 否则 setState 触发同步 rerender 替换触发器节点后，
          // 原事件 target 变为游离节点，this.el.contains(target) 为 false，
          // 下拉会被立即关闭，表现为“点击无反应”。
          e.stopPropagation();
          if (!disabled) this.setState({ open: !this.state.open });
        },
      },
        h('span', { class: selected ? '' : 'text-tertiary' },
          selected ? selected.label : placeholder),
        h('span', { class: 'select__arrow' }, '▾'),
      ),
    );

    if (this.state.open && !disabled) {
      const dropdown = h('div', { class: 'select__dropdown' },
        ...options.map((opt) => h('div', {
          class: `select__option ${opt.value === this.state.value ? 'is-selected' : ''} ${opt.disabled ? 'is-disabled' : ''}`,
          onClick: (e) => {
            e.stopPropagation();
            if (opt.disabled) return;
            this.setState({ value: opt.value, open: false });
            this.props.onChange?.(opt.value, opt);
          },
        }, opt.label)),
      );
      root.appendChild(dropdown);
    }
    return root;
  }

  componentDidMount() {
    // 点击外部关闭
    this._outsideHandler = (e) => {
      if (this.state.open && this.el && !this.el.contains(e.target)) {
        this.setState({ open: false });
      }
    };
    document.addEventListener('click', this._outsideHandler);
  }

  componentWillUnmount() {
    document.removeEventListener('click', this._outsideHandler);
  }

  getValue() { return this.state.value; }
  setValue(v) { this.setState({ value: v }); }
}
