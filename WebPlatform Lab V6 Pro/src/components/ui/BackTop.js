// BackTop.js —— 回到顶部组件
import { Component } from '../../core/Component.js';
import { h } from '../../core/utils.js';

export class BackTop extends Component {
  initialState() { return { visible: false }; }

  componentDidMount() {
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
  _getScrollTop() {
    const t = this._scrollTarget;
    if (t === window) return window.pageYOffset || document.documentElement.scrollTop || 0;
    return t.scrollTop || 0;
  }

  _handleScroll() {
    const { visibilityHeight = 400 } = this.props;
    const visible = this._getScrollTop() >= visibilityHeight;
    if (visible !== this.state.visible) {
      // 直接切换 DOM 显隐而非 setState，保持 this.el 稳定
      this.state.visible = visible;
      const btn = this.el?.querySelector('.backtop__btn');
      if (btn) btn.style.display = visible ? '' : 'none';
    }
  }

  /** requestAnimationFrame + easeInOutCubic 平滑滚动到顶部 */
  _scrollToTop() {
    const { duration = 450, onClick } = this.props;
    const startTop = this._getScrollTop();
    if (startTop === 0) { onClick?.(); return; }
    const startTime = performance.now();
    const t = this._scrollTarget;
    const step = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // easeInOutCubic 缓动函数
      const ease = progress < 0.5
        ? 4 * progress ** 3
        : 1 - Math.pow(-2 * progress + 2, 3) / 2;
      const top = startTop * (1 - ease);
      if (t === window) window.scrollTo(0, top);
      else t.scrollTop = top;
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
    onClick?.();
  }

  render() {
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
