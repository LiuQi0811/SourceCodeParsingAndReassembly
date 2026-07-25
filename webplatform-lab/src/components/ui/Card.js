// Card.js —— 卡片组件
import { Component } from '../../core/Component.js';
import { h } from '../../core/utils.js';

export class Card extends Component {
  render() {
    const { title, extra, hoverable = false, children, bodyStyle = null } = this.props;
    const classes = ['card', hoverable && 'card--hoverable'].filter(Boolean).join(' ');

    const kids = [];
    if (title || extra) {
      kids.push(h('div', { class: 'card__head' },
        title && h('div', { class: 'card__title' }, title),
        extra && h('div', { class: 'card__extra' }, extra),
      ));
    }
    const body = h('div', { class: 'card__body' }, ...(Array.isArray(children) ? children : [children]));
    if (bodyStyle) Object.assign(body.style, bodyStyle);
    kids.push(body);

    return h('div', { class: classes }, ...kids);
  }
}
