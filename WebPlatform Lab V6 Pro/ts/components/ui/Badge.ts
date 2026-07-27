// Badge.ts —— 徽标组件
import { Component } from '../../core/Component.js';
import { h } from '../../core/utils.js';
import type { Props } from '../../core/types.js';

export interface BadgeProps extends Props {
  count?: number;
  dot?: boolean;
  overflowCount?: number;
  children?: Node | string;
}

export class Badge extends Component {
  declare props: BadgeProps;

  render(): Node | string {
    const { count = 0, dot = false, overflowCount = 99, children } = this.props;
    const display: string | number = count > overflowCount ? `${overflowCount}+` : count;
    return h('span', { class: 'badge' },
      children,
      dot
        ? h('span', { class: 'badge__dot' })
        : count > 0 && h('span', { class: 'badge__count' }, String(display)),
    );
  }
}
