// Result.js —— 结果页组件（成功/错误/告警等状态展示）
import { Component } from '../../core/Component.js';
import { h } from '../../core/utils.js';

const ICONS = {
  success: '✓',
  error: '✗',
  info: 'i',
  warning: '!',
  404: '404',
  403: '403',
  500: '500',
};

export class Result extends Component {
  render() {
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
