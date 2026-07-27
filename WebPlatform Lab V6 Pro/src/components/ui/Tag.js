// Tag.js —— 标签组件
import { Component } from '../../core/Component.js';
import { h } from '../../core/utils.js';

export class Tag extends Component {
  render() {
    const { color = 'default', closable = false, children } = this.props;
    const classes = ['tag', color !== 'default' && `tag--${color}`].filter(Boolean).join(' ');
    return h('span', { class: classes },
      children,
      closable && h('span', {
        class: 'tag__close',
        onClick: (e) => { e.stopPropagation(); this.emit('close'); this.el?.remove(); },
      }, '×'),
    );
  }
}
