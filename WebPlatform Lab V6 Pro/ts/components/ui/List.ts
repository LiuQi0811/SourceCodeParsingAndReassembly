// List.ts —— 列表组件
import { Component } from '../../core/Component.js';
import { h } from '../../core/utils.js';
import type { Props } from '../../core/types.js';

export interface ListProps extends Props {
  dataSource?: any[];
  renderItem?: (item: any, index: number) => Node | string;
  header?: Node | string;
  footer?: Node | string;
  split?: boolean;
  size?: string;
}

export class List extends Component {
  declare props: ListProps;

  render(): Node | string {
    const {
      dataSource = [], renderItem, header, footer,
      split = true, size = 'middle',
    } = this.props;

    // 列表项渲染：split 控制分隔线修饰类
    const items = dataSource.map((item, index) => {
      const body = renderItem ? renderItem(item, index) : item;
      const itemClasses = ['list__item', split && 'list__item--split']
        .filter(Boolean).join(' ');
      return h('div', { class: itemClasses }, body);
    });

    return h('div', { class: `list list--${size}` },
      header && h('div', { class: 'list__header' }, header),
      h('div', { class: 'list__body' }, ...items),
      footer && h('div', { class: 'list__footer' }, footer),
    );
  }
}
