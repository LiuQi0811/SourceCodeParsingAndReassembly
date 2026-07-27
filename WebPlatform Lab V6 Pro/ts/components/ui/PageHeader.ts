// PageHeader.ts —— 页头组件
import { Component } from '../../core/Component.js';
import { h } from '../../core/utils.js';
import type { Props } from '../../core/types.js';

export interface PageHeaderProps extends Props {
  title?: Node | string;
  subtitle?: Node | string;
  backIcon?: Node | string | false;
  onBack?: (e: MouseEvent) => void;
  tags?: (Node | string)[];
  extra?: (Node | string)[];
  footer?: Node | string;
  breadcrumb?: Node | string;
  avatar?: Node | string;
  children?: Node | string | (Node | string)[];
}

export class PageHeader extends Component {
  declare props: PageHeaderProps;

  render(): Node | string {
    const {
      title,
      subtitle,
      backIcon = '←',
      onBack,
      tags = [],
      extra = [],
      footer,
      breadcrumb,
      avatar,
      children,
    } = this.props;

    // backIcon 传 false 表示隐藏返回按钮
    const showBack = backIcon !== false;
    const kids: any[] = [];

    if (breadcrumb) kids.push(h('div', { class: 'page-header__breadcrumb' }, breadcrumb));

    kids.push(h('div', { class: 'page-header__heading' },
      showBack && h('button', {
        type: 'button',
        class: 'page-header__back',
        'aria-label': '返回',
        onClick: (e: MouseEvent) => onBack?.(e),
      }, backIcon),
      avatar && h('div', { class: 'page-header__avatar' }, avatar),
      h('div', { class: 'page-header__heading-title-wrap' },
        title && h('span', { class: 'page-header__heading-title' }, title),
        subtitle && h('span', { class: 'page-header__heading-subtitle' }, subtitle),
        tags.length > 0 && h('span', { class: 'page-header__tags' }, ...tags),
      ),
      extra.length > 0 && h('div', { class: 'page-header__extra' }, ...extra),
    ));

    if (children != null) {
      const arr = Array.isArray(children) ? children : [children];
      kids.push(h('div', { class: 'page-header__content' }, ...arr));
    }
    if (footer) kids.push(h('div', { class: 'page-header__footer' }, footer));

    return h('div', { class: 'page-header' }, ...kids);
  }
}
