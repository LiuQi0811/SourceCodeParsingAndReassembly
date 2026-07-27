// Alert.ts —— 警告提示组件
import { Component } from '../../core/Component.js';
import { h } from '../../core/utils.js';
import type { Props } from '../../core/types.js';

const ICONS: Record<string, string> = {
  info: 'ℹ', success: '✓', warning: '!', error: '✕',
};

export interface AlertProps extends Props {
  type?: string;
  message?: Node | string;
  description?: Node | string;
  closable?: boolean;
}

export class Alert extends Component {
  declare props: AlertProps;

  render(): Node | string {
    const { type = 'info', message, description, closable = false } = this.props;
    return h('div', { class: `alert alert--${type}`, role: 'alert' },
      h('span', { class: 'alert__icon' }, ICONS[type] || ICONS.info),
      h('div', { class: 'flex-1' },
        message && h('div', { class: 'fw-medium' }, message),
        description && h('div', { class: 'fs-sm text-secondary mt-xs' }, description),
      ),
      closable && h('span', {
        class: 'alert__close',
        onClick: () => { (this.el as Element | null)?.remove(); },
      }, '×'),
    );
  }
}
