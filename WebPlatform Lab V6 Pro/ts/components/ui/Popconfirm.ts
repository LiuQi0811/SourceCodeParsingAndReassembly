// Popconfirm.ts —— 气泡确认框组件
import { h } from '../../core/utils.js';
import { Popover } from './Popover.js';
import type { PopoverProps, PopoverState } from './Popover.js';

export interface PopconfirmProps extends PopoverProps {
  title?: Node | string;
  description?: Node | string;
  icon?: Node | string;
  okText?: string;
  okType?: 'primary' | 'danger' | 'default';
  okButtonProps?: { class?: string };
  cancelText?: string;
  cancelButtonProps?: { class?: string };
  open?: boolean;
  disabled?: boolean;
  onConfirm?: () => void;
  onCancel?: () => void;
  onOpenChange?: (open: boolean) => void;
}

export interface PopconfirmState extends PopoverState {}

export class Popconfirm extends Popover {
  declare props: PopconfirmProps;
  declare state: PopconfirmState;

  initialState(): PopconfirmState { return { visible: !!this.props.open }; }

  componentDidMount(): void {
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

  show(): void {
    if (this.props.disabled) return;
    if (this.state.visible) return;
    super.show();
    this.props.onOpenChange?.(true);
  }

  hide(): void {
    if (!this.state.visible) return;
    super.hide();
    this.props.onOpenChange?.(false);
  }

  _handleConfirm(): void {
    this.hide();
    this.props.onConfirm?.();
  }

  _handleCancel(): void {
    this.hide();
    this.props.onCancel?.();
  }

  render(): Node | string {
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
          onClick: (e: MouseEvent) => { e.stopPropagation(); this._handleCancel(); },
        }, cancelText),
        h('button', {
          type: 'button',
          class: okClass,
          onClick: (e: MouseEvent) => { e.stopPropagation(); this._handleConfirm(); },
        }, okText),
      ),
    );
    this._content = contentEl as HTMLElement;
    if (!this.state.visible) (contentEl as HTMLElement).style.display = 'none';
    return h('span', {
      class: 'popconfirm',
      'aria-disabled': disabled ? 'true' : undefined,
    }, children);
  }
}
