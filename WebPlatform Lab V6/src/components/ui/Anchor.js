// Anchor.js —— 锚点组件
import { Component } from '../../core/Component.js';
import { h } from '../../core/utils.js';

export class Anchor extends Component {
  initialState() { return { activeKey: null }; }

  componentDidMount() {
    const { getContainer } = this.props;
    this._container = getContainer ? getContainer() : window;
    this._onScroll = () => this._handleScroll();
    // 滚动监听用捕获阶段，确保子容器滚动也能捕获
    this.on(this._container, 'scroll', this._onScroll, true);
    this.on(window, 'resize', this._onScroll);
    // 委托：点击链接标题时平滑滚动到目标
    this.on(this.el, 'click', (e) => this._handleClick(e));
    // 初始高亮：等 DOM 与目标元素就位后再计算
    requestAnimationFrame(() => this._handleScroll());
  }

  /** 点击锚点链接：阻止默认跳转，平滑滚动到目标元素 */
  _handleClick(e) {
    const link = e.target.closest('.anchor__link-title');
    if (!link) return;
    e.preventDefault();
    const href = link.getAttribute('data-href') || link.getAttribute('href');
    if (!href) return;
    const target = document.querySelector(href);
    if (!target) return;
    const { offsetTop = 0, targetOffset = 0, onClick } = this.props;
    const top = target.getBoundingClientRect().top + window.scrollY
      - (targetOffset || offsetTop) - 5;
    window.scrollTo({ top, behavior: 'smooth' });
    onClick?.(e, { href, title: link.textContent });
  }

  /** 滚动时根据各目标元素位置高亮当前激活项 */
  _handleScroll() {
    const { bounds = 5, offsetTop = 0, targetOffset = 0 } = this.props;
    const items = this._flattenItems(this.props.items || []);
    const threshold = targetOffset || offsetTop;
    let active = null;
    let maxTop = -Infinity;
    // 取视口顶部之上、且最靠近阈值线的目标作为激活项
    for (const item of items) {
      if (!item.href) continue;
      const el = document.querySelector(item.href);
      if (!el) continue;
      const top = el.getBoundingClientRect().top;
      if (top - threshold <= bounds && top > maxTop) {
        maxTop = top;
        active = item.key || item.href;
      }
    }
    if (active === this.state.activeKey) return;
    this.state.activeKey = active;
    // 切换激活态 class
    this.el?.querySelectorAll('.anchor__link-title').forEach((link) => {
      const key = link.getAttribute('data-key');
      link.classList.toggle('anchor__link-title--active', key === active);
    });
    // 同步 ink 圆点到激活链接位置
    this._moveInk();
  }

  _moveInk() {
    const list = this.el?.querySelector('.anchor__list');
    const ink = this.el?.querySelector('.anchor__ink');
    const active = this.el?.querySelector('.anchor__link-title--active');
    if (!list || !ink) return;
    if (!active) { ink.style.opacity = '0'; return; }
    const listRect = list.getBoundingClientRect();
    const linkRect = active.getBoundingClientRect();
    ink.style.top = `${linkRect.top - listRect.top}px`;
    ink.style.height = `${linkRect.height}px`;
    ink.style.opacity = '1';
  }

  /** 把树形 items 展平，带 depth 用于缩进 */
  _flattenItems(items, depth = 0, result = []) {
    for (const item of items) {
      result.push({ ...item, depth });
      if (item.children?.length) this._flattenItems(item.children, depth + 1, result);
    }
    return result;
  }

  _renderLink(item) {
    return h('div', { class: 'anchor__link', style: { paddingLeft: `${item.depth * 16 + 8}px` } },
      h('a', {
        class: 'anchor__link-title',
        href: item.href,
        'data-href': item.href,
        'data-key': item.key || item.href,
        title: typeof item.title === 'string' ? item.title : undefined,
      }, item.title),
    );
  }

  render() {
    const { items = [], affix = true } = this.props;
    const flat = this._flattenItems(items);
    return h('div', { class: ['anchor', affix && 'anchor--affix'].filter(Boolean).join(' ') },
      h('div', { class: 'anchor__list' },
        h('span', { class: 'anchor__ink' }),
        ...flat.map((item) => this._renderLink(item)),
      ),
    );
  }
}
