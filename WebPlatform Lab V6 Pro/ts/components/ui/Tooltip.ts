// Tooltip.ts —— 悬浮提示组件
import { Component } from '../../core/Component.js';
import { h } from '../../core/utils.js';
import type { Props, State } from '../../core/types.js';

export interface TooltipProps extends Props {
  title?: Node | string;
  placement?: 'top' | 'bottom' | 'left' | 'right';
  children?: Node | string | (Node | string)[];
}

export interface TooltipState extends State {
  visible: boolean;
}

export class Tooltip extends Component {
  declare props: TooltipProps;
  declare state: TooltipState;
  _tipId: string | null = null;
  _content: HTMLElement | null = null;
  _hideTimer: ReturnType<typeof setTimeout> | null = null;
  _onReposition: (() => void) | null = null;

  initialState(): TooltipState { return { visible: false }; }

  componentDidMount(): void {
    // 给 tooltip 内容分配稳定 id，并在 trigger 上挂 aria-describedby
    this._setupTriggerAria();
    // 在根元素上绑定 hover / focus 事件（destroy 时自动解绑）
    this.on(this.el as EventTarget, 'mouseenter', () => this.show());
    this.on(this.el as EventTarget, 'mouseleave', () => this.hide());
    this.on(this.el as EventTarget, 'focusin', () => this.show());
    this.on(this.el as EventTarget, 'focusout', () => this.hide());
    // 滚动/resize 时同步浮动位置
    this._onReposition = () => { if (this.state.visible) this._positionContent(); };
    this.on(window, 'scroll', this._onReposition, true);
    this.on(window, 'resize', this._onReposition);
  }

  /** 取触发元素：children 的第一个元素节点 */
  _getTrigger(): Element | null {
    return (this.el as Element | null)?.firstElementChild || null;
  }

  _setupTriggerAria(): void {
    const tipId = this._tipId || (this._tipId = `tooltip-${Math.random().toString(36).slice(2, 9)}`);
    if (this._content) this._content.setAttribute('id', tipId);
    const trigger = this._getTrigger();
    if (!trigger) return;
    // 若 trigger 已有 aria-describedby，追加而非覆盖
    const existing = trigger.getAttribute('aria-describedby');
    trigger.setAttribute('aria-describedby', existing ? `${existing} ${tipId}` : tipId);
    if (!trigger.hasAttribute('tabindex') && trigger.tagName !== 'BUTTON' && trigger.tagName !== 'A') {
      trigger.setAttribute('tabindex', '0');
    }
  }

  componentWillUnmount(): void {
    clearTimeout(this._hideTimer!);
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
    // 先显示才能测量
    const cw = content.offsetWidth;
    const ch = content.offsetHeight;
    const gap = 8;
    const scrollX = window.scrollX || 0;
    const scrollY = window.scrollY || 0;
    let left = 0, top = 0;
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
    clearTimeout(this._hideTimer!);
    // 直接切换 DOM 显隐而非走 setState：避免重渲染替换 this.el
    // 导致 componentDidMount 中绑定的 hover/focus 监听器失效。
    this.state.visible = true;
    if (this._content) {
      // portal 到 body，避免被 Card overflow:hidden 裁剪
      if (this._content.parentElement !== document.body) {
        document.body.appendChild(this._content);
      }
      this._content.style.display = '';
      this._positionContent();
      this._content.classList.add('tooltip__content--visible');
    }
  }

  hide(): void {
    clearTimeout(this._hideTimer!);
    // 100ms 延迟，避免鼠标在 trigger 与 content 之间移动时闪烁
    this._hideTimer = setTimeout(() => {
      this.state.visible = false;
      if (this._content) {
        this._content.classList.remove('tooltip__content--visible');
        this._content.style.display = 'none';
      }
    }, 100);
  }

  render(): Node | string {
    const { title, placement = 'top', children } = this.props;
    const content = h('span', {
      class: `tooltip__content tooltip__content--${placement}`,
      role: 'tooltip',
      style: 'position:absolute;',
    }, title) as HTMLElement;
    this._content = content;
    if (!this.state.visible) content.style.display = 'none';
    return h('span', { class: 'tooltip' }, children, content);
  }
}
