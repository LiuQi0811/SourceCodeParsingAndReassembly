// Steps.js —— 步骤条组件
import { Component } from '../../core/Component.js';
import { h } from '../../core/utils.js';

export class Steps extends Component {
  /** 计算指定步骤的状态 */
  getItemStatus(index) {
    const { current = 0, status } = this.props;
    if (index < current) return 'finish';
    if (index === current) return status || 'process';
    return 'wait';
  }

  render() {
    const { items = [], direction = 'horizontal' } = this.props;
    const children = [];

    items.forEach((item, index) => {
      const status = this.getItemStatus(index);
      // 图标：自定义优先，否则按状态给出默认符号
      let icon;
      if (item.icon != null) icon = item.icon;
      else if (status === 'finish') icon = '✓';
      else if (status === 'error') icon = '!';
      else icon = String(index + 1);

      children.push(h('div', { class: 'steps__item' },
        h('div', { class: `steps__indicator steps__indicator--${status}` }, icon),
        h('div', { class: 'steps__content' },
          h('div', { class: 'steps__title' }, item.title),
          item.description != null && h('div', { class: 'steps__description' }, item.description),
        ),
      ));
      // 相邻步骤之间的连接线（最后一步不渲染）
      if (index < items.length - 1) {
        children.push(h('div', { class: 'steps__connector' }));
      }
    });

    return h('div', { class: `steps steps--${direction}` }, ...children);
  }
}
