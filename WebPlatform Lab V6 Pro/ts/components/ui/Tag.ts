// Tag.ts —— 标签组件
import { Component } from '../../core/Component.js';
import { h } from '../../core/utils.js';
import type { Props } from '../../core/types.js';

export interface TagProps extends Props {
  color?: string;
  closable?: boolean;
  children?: Node | string;
}

export class Tag extends Component {
  declare props: TagProps;

  render(): Node | string {
    const { color = 'default', closable = false, children } = this.props;
    const classes = ['tag', color !== 'default' && `tag--${color}`].filter(Boolean).join(' ');
    return h('span', { class: classes },
      children,
      closable && h('span', {
        class: 'tag__close',
        onClick: (e: MouseEvent) => {
          e.stopPropagation();
          this.emit('close');
          (this.el as Element | null)?.remove();
        },
      }, '×'),
    );
  }
}
