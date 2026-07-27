// BackTop.ts —— 回到顶部组件
import { Component } from '../../core/Component.js';
import { h } from '../../core/utils.js';
import type { Props, State } from '../../core/types.js';

export interface BackTopProps extends Props {
  target?: (() => HTMLElement | Window) | HTMLElement | Window;
  visibilityHeight?: number;
  duration?: number;
  onClick?: () => void;
  children?: Node | string;
}

export interface BackTopState extends State {
  visible: boolean;
}

export class BackTop extends Component {
  declare props: BackTopProps;
  declare state: BackTopState;
  _scrollTarget: HTMLElement | Window = window;
  _onScroll: (() => void) | null = null;

  initialState(): BackTopState { return { visible: false }; }

  componentDidMount(): void {
    const { target } = this.props;
    // target 支持函数（返回滚动容器）或直接传 window/元素
    this._scrollTarget = typeof target === 'function' ? target() : (target || window);
    this._onScroll = () => this._handleScroll();
    this.on(this._scrollTarget, 'scroll', this._onScroll);
    this.on(window, 'resize', this._onScroll);
    // 初始检测一次，避免首屏已滚动但按钮未显示
    this._handleScroll();
  }

  /** 读取当前滚动距离：window 用 pageYOffset，元素用 scrollTop */
  _getScrollTop(): number {
    const t = this._scrollTarget;
    if (t === window) return window.pageYOffset || document.documentElement.scrollTop || 0;
    return (t as HTMLElement).scrollTop || 0;
  }

  _handleScroll(): void {
    const { visibilityHeight = 400 } = this.props;
    const visible = this._getScrollTop() >= visibilityHeight;
    if (visible !== this.state.visible) {
      // 直接切换 DOM 显隐而非 setState，保持 this.el 稳定
      this.state.visible = visible;
      const btn = (this.el as Element | null)?.querySelector<HTMLElement>('.backtop__btn');
      if (btn) btn.style.display = visible ? '' : 'none';
    }
  }

  /** requestAnimationFrame + easeInOutCubic 平滑滚动到顶部 */
  _scrollToTop(): void {
    const { duration = 450, onClick } = this.props;
    const startTop = this._getScrollTop();
    if (startTop === 0) { onClick?.(); return; }
    const startTime = performance.now();
    const t = this._scrollTarget;
    const step = (now: number): void => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // easeInOutCubic 缓动函数
      const ease = progress < 0.5
        ? 4 * progress ** 3
        : 1 - Math.pow(-2 * progress + 2, 3) / 2;
      const top = startTop * (1 - ease);
      if (t === window) window.scrollTo(0, top);
      else (t as HTMLElement).scrollTop = top;
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
    onClick?.();
  }

  render(): Node | string {
    return h('div', { class: 'backtop' },
      h('button', {
        type: 'button',
        class: 'backtop__btn',
        'aria-label': '回到顶部',
        style: { display: this.state.visible ? '' : 'none' },
        onClick: () => this._scrollToTop(),
      }, this.props.children || '↑'),
    );
  }
}
