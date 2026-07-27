// Segmented.js —— 分段控制器（iOS 风格分段选择）
import { Component } from '../../core/Component.js';
import { h } from '../../core/utils.js';

export class Segmented extends Component {
  initialState() {
    return { value: this.props.value ?? this.props.defaultValue };
  }

  /** 直接操作 DOM 切换选中项，不触发 setState/rerender */
  _syncDom(newValue) {
    if (!this.el) return;
    const { options = [] } = this.props;
    const newIdx = Math.max(0, options.findIndex((o) => o.value === newValue));
    // 移动 thumb 指示器
    const thumb = this.el.querySelector('.segmented__thumb');
    if (thumb) thumb.style.transform = `translateX(${newIdx * 100}%)`;
    // 切换各 item 的选中 class
    const items = this.el.querySelectorAll('.segmented__item');
    items.forEach((item, i) => {
      item.classList.toggle('segmented__item--selected', i === newIdx);
    });
  }

  render() {
    const { options = [], block = false } = this.props;
    const { value } = this.state;
    const count = options.length;
    const selectedIndex = Math.max(0, options.findIndex((o) => o.value === value));

    // 滑动指示器：宽度按等分计算，通过 transform 平移到选中项位置
    const thumb = count > 0 ? h('div', {
      class: 'segmented__thumb',
      style: {
        width: `${100 / count}%`,
        transform: `translateX(${selectedIndex * 100}%)`,
      },
    }) : null;

    return h('div', {
      class: ['segmented', block && 'segmented--block'],
    },
      thumb,
      ...options.map((opt) => {
        const selected = opt.value === value;
        return h('div', {
          class: [
            'segmented__item',
            selected && 'segmented__item--selected',
            opt.disabled && 'is-disabled',
          ],
          onClick: () => {
            if (opt.disabled || selected) return;
            this.state.value = opt.value;
            this._syncDom(opt.value);
            this.props.onChange?.(opt.value);
          },
        }, opt.label);
      }),
    );
  }

  getValue() { return this.state.value; }
  setValue(v) { this.setState({ value: v }); }
}
