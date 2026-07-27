// Popover.ts —— 弹出框组件
import { Component } from '../../core/Component.js';
import { h } from '../../core/utils.js';
import type { Props, State } from '../../core/types.js';

export interface PopoverProps extends Props {
  title?: Node | string;
  content?: Node | string;
  placement?: 'top' | 'bottom' | 'left' | 'right';
  trigger?: 'click' | 'hover';
  ariaLabel?: string;
  children?: Node | string | (Node | string)[];
}

export interface PopoverState extends State {
  visible: boolean;
}

export class Popover extends Component {
  declare props: PopoverProps;
  declare state: PopoverState;
  _content: HTMLElement | null = null;
  _hideTimer: ReturnType<typeof setTimeout> | null = null;
  _onReposition: (() => void) | null = null;

  initialState(): PopoverState { return { visible: false }; }

  componentDidMount(): void {
    const { trigger = 'click' } = this.props;
    this._setupTriggerAria();

    if (trigger === 'hover') {
      this.on(this.el as EventTarget, 'mouseenter', () => this.show());
      this.on(this.el as EventTarget, 'mouseleave', () => this.hide());
    } else {
      // click 触发：在根元素上委托，content 内部点击不切换显隐
      this.on(this.el as EventTarget, 'click', (e: Event) => {
        const me = e as MouseEvent;
        if (this._content && this._content.contains(me.target as Node)) return;
        me.stopPropagation(); // 阻止冒泡到 document，避免触发立即关闭
        this.toggle();
      });
      this.on(document, 'click', (e: Event) => {
        if (this.state.visible && this.el && !this.el.contains(e.target as Node)) this.hide();
      });
      // 键盘：Esc 关闭并把焦点还给触发器
      this.on(this.el as EventTarget, 'keydown', (e: Event) => {
        const ke = e as KeyboardEvent;
        if (ke.key === 'Escape' && this.state.visible) {
          this.hide();
          this._getTrigger()?.focus();
        }
      });
    }
    // 滚动/resize 时同步浮动位置
    this._onReposition = () => { if (this.state.visible) this._positionContent(); };
    this.on(window, 'scroll', this._onReposition as EventListener, true);
    this.on(window, 'resize', this._onReposition as EventListener);
  }

  /** 取触发元素：children 的第一个元素节点 */
  _getTrigger(): HTMLElement | null {
    return (this.el as Element | null)?.firstElementChild as HTMLElement | null || null;
  }

  _setupTriggerAria(): void {
    const trigger = this._getTrigger();
    if (!trigger) return;
    trigger.setAttribute('aria-haspopup', 'dialog');
    trigger.setAttribute('aria-expanded', String(this.state.visible));
    if (!trigger.hasAttribute('tabindex') && trigger.tagName !== 'BUTTON' && trigger.tagName !== 'A') {
      trigger.setAttribute('tabindex', '0');
    }
  }

  _syncTriggerExpanded(): void {
    this._getTrigger()?.setAttribute('aria-expanded', String(this.state.visible));
  }

  componentWillUnmount(): void {
    if (this._hideTimer) clearTimeout(this._hideTimer);
    // portal 元素随组件销毁移除
    this._content?.remove();
  }

  /** 将内容 portal 到 body 并按 trigger 位置计算坐标，避免被父级 overflow:hidden 裁剪 */
  _positionContent(): void {
    const trigger = this._getTrigger();
    if (!trigger || !this._content) return;
    const rect = trigger.getBoundingClientRect();
    const content = this._content;
    content.style.left = '0px';
    content.style.top = '0px';
    const cw = content.offsetWidth;
    const ch = content.offsetHeight;
    const gap = 8;
    const scrollX = window.scrollX || 0;
    const scrollY = window.scrollY || 0;
    let left: number = 0;
    let top: number = 0;
    switch (this.props.placement || 'top') {
      case 'top':
        left = rect.left + rect.width / 2 - cw / 2;
        top = rect.top - ch - gap;
        break;
      case 'bottom':
        left = rect.left + rect.width / 2 - cw / 2;
        top = rect.bottom + gap;
        break;
      case 'left':
        left = rect.left - cw - gap;
        top = rect.top + rect.height / 2 - ch / 2;
        break;
      case 'right':
        left = rect.right + gap;
        top = rect.top + rect.height / 2 - ch / 2;
        break;
    }
    content.style.left = `${left + scrollX}px`;
    content.style.top = `${top + scrollY}px`;
  }

  show(): void {
    if (this._hideTimer) clearTimeout(this._hideTimer);
    // 直接切换 DOM 显隐而非 setState，保持 this.el 稳定，
    // 使 componentDidMount 绑定的事件监听持续生效。
    this.state.visible = true;
    if (this._content) {
      // portal 到 body，避免被 Card overflow:hidden 裁剪
      if (this._content.parentElement !== document.body) {
        document.body.appendChild(this._content);
      }
      this._content.style.display = '';
      this._positionContent();
      this._content.classList.add('popover__content--visible');
    }
    this._syncTriggerExpanded();
  }

  hide(): void {
    if (this._hideTimer) clearTimeout(this._hideTimer);
    this._hideTimer = setTimeout(() => {
      this.state.visible = false;
      if (this._content) {
        this._content.classList.remove('popover__content--visible');
        this._content.style.display = 'none';
      }
      this._syncTriggerExpanded();
    }, 100);
  }

  toggle(): void {
    this.state.visible ? this.hide() : this.show();
  }

  render(): Node | string {
    const { title, content, placement = 'top', children, ariaLabel } = this.props;
    const contentEl = h('span', {
      class: `popover__content popover__content--${placement}`,
      role: 'dialog',
      'aria-modal': 'false',
      'aria-label': ariaLabel || (typeof title === 'string' ? title : undefined),
      style: 'position:absolute;',
    },
      title && h('div', { class: 'popover__title' }, title),
      content,
    );
    this._content = contentEl as HTMLElement;
    if (!this.state.visible) (contentEl as HTMLElement).style.display = 'none';
    return h('span', { class: 'popover' }, children, contentEl);
  }
}
