// Badge.js —— 徽标组件
import { Component } from '../../core/Component.js';
import { h } from '../../core/utils.js';

export class Badge extends Component {
  render() {
    const { count = 0, dot = false, overflowCount = 99, children } = this.props;
    const display = count > overflowCount ? `${overflowCount}+` : count;
    return h('span', { class: 'badge' },
      children,
      dot
        ? h('span', { class: 'badge__dot' })
        : count > 0 && h('span', { class: 'badge__count' }, String(display)),
    );
  }
}
