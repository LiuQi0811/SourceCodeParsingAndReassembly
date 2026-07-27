// Result.ts —— 结果页组件（成功/错误/告警等状态展示）
import { Component } from '../../core/Component.js';
import { h } from '../../core/utils.js';
import type { Props } from '../../core/types.js';

const ICONS: Record<string, string> = {
  success: '✓',
  error: '✗',
  info: 'i',
  warning: '!',
  '404': '404',
  '403': '403',
  '500': '500',
};

export interface ResultProps extends Props {
  status?: string | number;
  title?: Node | string;
  subTitle?: Node | string;
  extra?: Node | string | (Node | string)[];
}

export class Result extends Component {
  declare props: ResultProps;

  render(): Node | string {
    const { status = 'info', title, subTitle, extra } = this.props;
    const icon = ICONS[status] ?? ICONS.info;

    return h('div', { class: `result result--${status}` },
      h('div', { class: 'result__icon' }, icon),
      title && h('div', { class: 'result__title' }, title),
      subTitle && h('div', { class: 'result__subtitle' }, subTitle),
      extra && h('div', { class: 'result__extra' },
        ...(Array.isArray(extra) ? extra : [extra])),
    );
  }
}
