// Carousel.js —— 轮播图组件
import { Component } from '../../core/Component.js';
import { h } from '../../core/utils.js';

export class Carousel extends Component {
  initialState() {
    return { current: 0 };
  }

  componentDidMount() {
    if (this.props.autoplay) this._startAutoplay();
    // 鼠标悬停暂停
    if (this.props.pauseOnHover && this.el) {
      this.on(this.el, 'mouseenter', () => this._stopAutoplay());
      this.on(this.el, 'mouseleave', () => { if (this.props.autoplay) this._startAutoplay(); });
    }
  }

  componentWillUnmount() {
    this._stopAutoplay();
  }

  /** 获取所有幻灯片（兼容单节点 children） */
  _getSlides() {
    const { children } = this.props;
    return Array.isArray(children) ? children : (children ? [children] : []);
  }

  _startAutoplay() {
    this._stopAutoplay();
    const speed = this.props.autoplaySpeed ?? 3000;
    this._timer = setInterval(() => this.next(), speed);
  }

  _stopAutoplay() {
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
  }

  /** 跳转到指定索引 */
  goTo(slideIndex) {
    const slides = this._getSlides();
    const total = slides.length;
    if (!total) return;
    const { infinite = true } = this.props;

    let next;
    if (infinite) {
      next = ((slideIndex % total) + total) % total;
    } else {
      next = Math.max(0, Math.min(total - 1, slideIndex));
    }
    if (next === this.state.current) return;

    const from = this.state.current;
    this.props.beforeChange?.(from, next);
    // 直接更新 state 字段，不触发 setState/rerender：
    // setState 会触发 _rerender 重建整个 Carousel DOM，
    // 导致正在交互的 dot / slide 被销毁重建 → 闪屏。
    // CSS transition 自然结束，不需要 animating 状态。
    this.state.current = next;
    this._syncDom(from, next);
    setTimeout(() => this.props.afterChange?.(next), this.props.speed ?? 300);
    // 用户手动切换后重置自动播放计时
    if (this.props.autoplay) this._startAutoplay();
  }

  /** 直接操作 DOM 同步当前页视图，不触发 rerender */
  _syncDom(from, to) {
    if (!this.el) return;
    const { effect = 'scrollx', slidesToShow = 1 } = this.props;
    const track = this.el.querySelector('.carousel__track');
    if (!track) return;
    if (effect === 'fade') {
      const slideEls = track.querySelectorAll('.carousel__slide');
      if (slideEls[from]) {
        slideEls[from].style.opacity = '0';
        slideEls[from].style.zIndex = '1';
      }
      if (slideEls[to]) {
        slideEls[to].style.opacity = '1';
        slideEls[to].style.zIndex = '2';
      }
    } else {
      // scrollx：平移轨道
      track.style.transform = `translateX(-${to * (100 / slidesToShow)}%)`;
    }
    // 更新圆点 active 状态
    const dots = this.el.querySelectorAll('.carousel__dot');
    if (dots.length) {
      if (dots[from]) dots[from].classList.remove('carousel__dot--active');
      if (dots[to]) dots[to].classList.add('carousel__dot--active');
    }
  }

  next() { this.goTo(this.state.current + (this.props.slidesToScroll ?? 1)); }
  prev() { this.goTo(this.state.current - (this.props.slidesToScroll ?? 1)); }

  render() {
    const {
      dots = true, dotPosition = 'bottom', effect = 'scrollx',
      slidesToShow = 1, easing = 'linear',
    } = this.props;
    const slides = this._getSlides();
    const total = slides.length;
    const current = this.state.current;

    // 轨道：scrollx 用 translateX 平移；fade 用绝对定位 + 透明度切换
    const trackStyle = effect === 'fade'
      ? { position: 'relative' }
      : {
          display: 'flex',
          transition: `transform ${this.props.speed ?? 300}ms ${easing}`,
          transform: `translateX(-${current * (100 / slidesToShow)}%)`,
          willChange: 'transform',
        };

    const trackEl = h('div', { class: `carousel__track carousel__track--${effect}`, style: trackStyle },
      ...slides.map((slide, i) => {
        const slideStyle = effect === 'fade'
          ? {
              position: 'absolute',
              inset: '0',
              opacity: i === current ? '1' : '0',
              transition: `opacity ${this.props.speed ?? 300}ms ${easing}`,
              zIndex: i === current ? '2' : '1',
            }
          : { flex: `0 0 ${100 / slidesToShow}%`, width: `${100 / slidesToShow}%` };
        return h('div', { class: 'carousel__slide', style: slideStyle }, slide);
      }),
    );

    // 圆点导航
    const dotsEl = dots && total > 0 ? h('ul', { class: `carousel__dots carousel__dots--${dotPosition}` },
      ...slides.map((_, i) => h('li', {
        class: ['carousel__dot', i === current && 'carousel__dot--active'].filter(Boolean).join(' '),
        onClick: () => this.goTo(i),
      })),
    ) : null;

    return h('div', { class: 'carousel' },
      h('div', { class: 'carousel__viewport' }, trackEl),
      dotsEl,
    );
  }
}
