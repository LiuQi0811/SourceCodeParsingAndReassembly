// Statistic.js —— 统计数值展示
import { Component } from '../../core/Component.js';
import { h } from '../../core/utils.js';

export class Statistic extends Component {
  render() {
    const { title, value, precision, prefix, suffix, valueStyle = null } = this.props;

    // 数值精度格式化（仅对数字生效）
    let displayValue = value;
    if (typeof value === 'number' && precision != null) {
      displayValue = value.toFixed(precision);
    }

    const valueEl = h('div', { class: 'statistic__value' },
      prefix,
      String(displayValue ?? ''),
      suffix,
    );
    if (valueStyle) Object.assign(valueEl.style, valueStyle);

    return h('div', { class: 'statistic' },
      title && h('div', { class: 'statistic__title' }, title),
      valueEl,
    );
  }
}
