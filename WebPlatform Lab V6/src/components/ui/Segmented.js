// Segmented.js —— 分段控制器（iOS 风格分段选择）
import { Component } from '../../core/Component.js';
import { h } from '../../core/utils.js';

export class Segmented extends Component {
  initialState() {
    return { value: this.props.value ?? this.props.defaultValue };
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
            this.setState({ value: opt.value });
            this.props.onChange?.(opt.value);
          },
        }, opt.label);
      }),
    );
  }

  getValue() { return this.state.value; }
  setValue(v) { this.setState({ value: v }); }
}
