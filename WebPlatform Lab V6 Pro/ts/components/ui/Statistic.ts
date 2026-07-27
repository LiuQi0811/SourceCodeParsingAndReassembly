// Statistic.ts —— 统计数值展示
import { Component } from '../../core/Component.js';
import { h } from '../../core/utils.js';
import type { Props } from '../../core/types.js';

export interface StatisticProps extends Props {
  title?: Node | string;
  value?: Node | string | number;
  precision?: number;
  prefix?: Node | string;
  suffix?: Node | string;
  valueStyle?: Partial<CSSStyleDeclaration> | null;
}

export class Statistic extends Component {
  declare props: StatisticProps;

  render(): Node | string {
    const { title, value, precision, prefix, suffix, valueStyle = null } = this.props;

    // 数值精度格式化（仅对数字生效）
    let displayValue: Node | string | number | undefined = value;
    if (typeof value === 'number' && precision != null) {
      displayValue = value.toFixed(precision);
    }

    const valueEl = h('div', { class: 'statistic__value' },
      prefix,
      String(displayValue ?? ''),
      suffix,
    ) as HTMLElement;
    if (valueStyle) Object.assign(valueEl.style, valueStyle);

    return h('div', { class: 'statistic' },
      title && h('div', { class: 'statistic__title' }, title),
      valueEl,
    );
  }
}
