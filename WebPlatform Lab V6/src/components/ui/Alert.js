// Alert.js —— 警告提示组件
import { Component } from '../../core/Component.js';
import { h } from '../../core/utils.js';

const ICONS = {
  info: 'ℹ', success: '✓', warning: '!', error: '✕',
};

export class Alert extends Component {
  render() {
    const { type = 'info', message, description, closable = false } = this.props;
    return h('div', { class: `alert alert--${type}`, role: 'alert' },
      h('span', { class: 'alert__icon' }, ICONS[type] || ICONS.info),
      h('div', { class: 'flex-1' },
        message && h('div', { class: 'fw-medium' }, message),
        description && h('div', { class: 'fs-sm text-secondary mt-xs' }, description),
      ),
      closable && h('span', {
        class: 'alert__close', onClick: () => this.el?.remove(),
      }, '×'),
    );
  }
}
