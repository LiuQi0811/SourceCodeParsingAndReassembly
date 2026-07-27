// NotFoundPage.ts —— 404 页
import { Page } from '../core/Component.js';
import { h } from '../core/utils.js';
import { Button } from '../components/ui/Button.js';
import type { Props, State, RouteLocation } from '../core/types.js';
import type { Router } from '../core/Router.js';

export interface NotFoundPageProps extends Props {
  router: Router;
  to?: RouteLocation;
}

export interface NotFoundPageState extends State {}

export class NotFoundPage extends Page {
  declare props: NotFoundPageProps;
  declare state: NotFoundPageState;

  renderPage(): Node | string | (Node | string)[] {
    const backHome = new Button({
      type: 'primary', size: 'lg',
      children: '返回首页',
      onClick: () => this.props.router.push('/'),
    });
    this.registerChild(backHome);
    const backBtn = new Button({
      size: 'lg',
      children: '返回上一页',
      onClick: () => this.props.router.back(),
    });
    this.registerChild(backBtn);

    return [
      h('div', { class: 'not-found' },
        h('div', { class: 'not-found__code' }, '404'),
        h('h2', { class: 'fs-2xl mb-md' }, '页面未找到'),
        h('p', { class: 'text-secondary mb-lg' },
          `您访问的路径 "${this.props.to?.path || ''}" 不存在，可能已被移除或地址有误。`),
        h('div', { class: 'flex gap-sm justify-center' },
          backHome.render(),
          backBtn.render(),
        ),
      ),
    ];
  }
}
