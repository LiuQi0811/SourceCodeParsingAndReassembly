// Popconfirm.js —— 气泡确认框组件
import { Component } from '../../core/Component.js';
import { h } from '../../core/utils.js';
import { Popover } from './Popover.js';

export class Popconfirm extends Popover {
  initialState() { return { visible: !!this.props.open }; }

  componentDidMount() {
    super.componentDidMount();
    // 受控初始 open=true 时，把内容 portal 到 body 并定位
    if (this.state.visible) {
      requestAnimationFrame(() => {
        if (this._content && this._content.parentElement !== document.body) {
          document.body.appendChild(this._content);
        }
        this._positionContent();
      });
    }
  }

  show() {
    if (this.props.disabled) return;
    if (this.state.visible) return;
    super.show();
    this.props.onOpenChange?.(true);
  }

  hide() {
    if (!this.state.visible) return;
    super.hide();
    this.props.onOpenChange?.(false);
  }

  _handleConfirm() {
    this.hide();
    this.props.onConfirm?.();
  }

  _handleCancel() {
    this.hide();
    this.props.onCancel?.();
  }

  render() {
    const {
      title,
      description,
      icon,
      okText = '确定',
      okType = 'primary',
      okButtonProps = {},
      cancelText = '取消',
      cancelButtonProps = {},
      placement = 'top',
      children,
      disabled,
    } = this.props;

    // okType 映射到 btn 修饰类
    const okClass = [
      'btn',
      okType === 'primary' ? 'btn--primary'
        : okType === 'danger' ? 'btn--danger'
        : '',
      okButtonProps.class,
    ].filter(Boolean).join(' ');
    const cancelClass = ['btn', cancelButtonProps.class].filter(Boolean).join(' ');

    const contentEl = h('div', {
      class: `popconfirm__content popover__content popover__content--${placement}`,
      role: 'dialog',
      'aria-label': typeof title === 'string' ? title : undefined,
      style: 'position:absolute;',
    },
      h('div', { class: 'popconfirm__inner' },
        icon && h('span', { class: 'popconfirm__icon' }, icon),
        h('div', { class: 'popconfirm__body' },
          title && h('div', { class: 'popconfirm__title' }, title),
          description && h('div', { class: 'popconfirm__description' }, description),
        ),
      ),
      h('div', { class: 'popconfirm__buttons' },
        h('button', {
          type: 'button',
          class: cancelClass,
          onClick: (e) => { e.stopPropagation(); this._handleCancel(); },
        }, cancelText),
        h('button', {
          type: 'button',
          class: okClass,
          onClick: (e) => { e.stopPropagation(); this._handleConfirm(); },
        }, okText),
      ),
    );
    this._content = contentEl;
    if (!this.state.visible) contentEl.style.display = 'none';
    return h('span', {
      class: 'popconfirm',
      'aria-disabled': disabled ? 'true' : undefined,
    }, children);
  }
}
