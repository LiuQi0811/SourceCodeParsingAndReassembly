// FloatButton.ts —— 浮动按钮组件
import { Component } from '../../core/Component.js';
import { h } from '../../core/utils.js';
import { Tooltip } from './Tooltip.js';
import type { Props, State } from '../../core/types.js';

type Badge = number | string | { dot?: boolean; count?: number };

export interface FloatButtonProps extends Props {
  icon?: Node | string;
  type?: string;
  shape?: string;
  size?: number;
  tooltip?: Node | string;
  placement?: 'top' | 'bottom' | 'left' | 'right';
  href?: string;
  target?: string;
  onClick?: (e: MouseEvent) => void;
  badge?: Badge;
  fixed?: boolean;
}

export interface FloatButtonState extends State {}

export interface FloatButtonGroupProps extends Props {
  children?: Node | string | (Node | string)[];
  backTop?: boolean | { visibilityHeight?: number; duration?: number; onClick?: () => void };
}

export interface FloatButtonGroupState extends State {}

export class FloatButton extends Component {
  declare props: FloatButtonProps;
  declare state: FloatButtonState;

  render(): Node | string {
    const {
      icon,
      type = 'default',
      shape = 'circle',
      size = 40,
      tooltip,
      placement = 'right',
      href,
      target,
      onClick,
      badge,
      fixed = true,
    } = this.props;

    const classes = [
      'float-button',
      `float-button--${type}`,
      `float-button--${shape}`,
    ].join(' ');

    // 徽标渲染：number/string 直接显示；{dot:true} 显示圆点；{count} 显示数字
    let badgeEl: Node | null = null;
    if (badge != null && badge !== 0) {
      if (typeof badge === 'number' || typeof badge === 'string') {
        badgeEl = h('span', { class: 'float-button__badge' }, badge);
      } else if (badge.dot) {
        badgeEl = h('span', { class: 'float-button__badge float-button__badge--dot' });
      } else if (badge.count != null && badge.count !== 0) {
        badgeEl = h('span', { class: 'float-button__badge' }, badge.count);
      }
    }

    // 有 href 渲染 a，否则渲染 button
    const triggerEl = h(href ? 'a' : 'button', {
      ...(href ? { href, target } : { type: 'button' }),
      class: classes,
      style: { width: `${size}px`, height: `${size}px` },
      'aria-label': typeof tooltip === 'string' ? tooltip : undefined,
      onClick: (e: MouseEvent) => onClick?.(e),
    },
      h('span', { class: 'float-button__icon' }, icon),
      badgeEl,
    );

    // 包一层：fixed=true 时内联定位到右下角，组件单独使用即固定
    const wrapStyle: Record<string, string> = fixed
      ? { position: 'fixed', bottom: '48px', right: '48px', zIndex: '99' }
      : {};
    // 有 tooltip 则用 Tooltip 包裹触发器，否则直接放触发器
    const inner = tooltip
      ? h(Tooltip, { title: tooltip, placement }, triggerEl)
      : triggerEl;
    return h('span', { class: 'float-button-wrap', style: wrapStyle }, inner);
  }
}

export class FloatButtonGroup extends Component {
  declare props: FloatButtonGroupProps;
  declare state: FloatButtonGroupState;

  render(): Node | string {
    const { children = [], backTop } = this.props;
    const kids: (Node | string)[] = [];

    // backTop=true 或配置对象：渲染回到顶部按钮
    if (backTop) {
      const btProps = backTop === true ? {} : backTop;
      kids.push(h(FloatButton, {
        fixed: false,
        icon: '↑',
        shape: 'circle',
        tooltip: '回到顶部',
        onClick: () => this._scrollToTop(btProps),
      }));
    }

    const arr = Array.isArray(children) ? children : [children];
    for (const child of arr) {
      if (child) kids.push(child);
    }

    return h('div', {
      class: 'float-button-group',
      style: {
        position: 'fixed',
        bottom: '48px',
        right: '48px',
        zIndex: '99',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      },
    }, ...kids);
  }

  /** 平滑滚动到顶部（复用 BackTop 的缓动逻辑） */
  _scrollToTop(props: { visibilityHeight?: number; duration?: number; onClick?: () => void } = {}): void {
    const { visibilityHeight = 400, duration = 450, onClick } = props;
    const startTop = window.pageYOffset || document.documentElement.scrollTop || 0;
    if (startTop < visibilityHeight) return;
    const startTime = performance.now();
    const step = (now: number): void => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const ease = progress < 0.5
        ? 4 * progress ** 3
        : 1 - Math.pow(-2 * progress + 2, 3) / 2;
      window.scrollTo(0, startTop * (1 - ease));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
    onClick?.();
  }
}
