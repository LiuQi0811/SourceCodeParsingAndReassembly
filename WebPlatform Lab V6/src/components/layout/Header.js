// Header.js —— 顶部导航
// 演示：编程式导航（无 <a> 标签）、主题切换、Store 订阅、MutationObserver 高亮
import { Component } from '../../core/Component.js';
import { h } from '../../core/utils.js';
import { store } from '../../core/Store.js';
import { eventBus, EVENTS } from '../../core/EventBus.js';

const MENU = [
  { path: '/', label: '首页', name: 'home' },
  { path: '/components', label: '组件', name: 'components' },
  { path: '/router', label: '路由', name: 'router' },
  { path: '/api-lab', label: 'API 实验室', name: 'api-lab' },
  { path: '/about', label: '关于', name: 'about' },
];

export class Header extends Component {
  initialState() {
    return {
      // 关键修复：刷新页面时 router.start() 同步触发首次 ROUTER_AFTER，
      // 而 componentDidMount 用 requestAnimationFrame 异步订阅，会错过该事件。
      // 这里直接从 window.location.pathname 读取真实路径，确保刷新后高亮正确。
      activePath: (typeof window !== 'undefined' && window.location?.pathname) || '/',
      theme: store.get('app', 'theme'),
    };
  }

  render() {
    const isDark = this.state.theme === 'dark';
    return h('header', { class: 'app-header' },
      // Logo：用 <a> 提供语义与键盘可达性，onClick 阻止默认跳转走 SPA 编程式导航
      h('a', {
        class: 'app-header__logo',
        href: '/',
        'aria-label': 'WebPlatform Lab 首页',
        'aria-current': this._isActive('/') ? 'page' : undefined,
        onClick: (e) => { e.preventDefault(); this.props.router?.push('/'); },
      },
        h('div', { class: 'app-header__logo-mark' }, 'W'),
        h('span', {}, 'WebPlatform Lab'),
      ),
      h('nav', { class: 'app-header__menu' },
        ...MENU.map((item) => h('a', {
          class: `app-header__menu-item ${this._isActive(item.path) ? 'is-active' : ''}`,
          href: item.path,
          'aria-current': this._isActive(item.path) ? 'page' : undefined,
          onClick: (e) => { e.preventDefault(); this.props.router?.push(item.path); },
        }, item.label)),
      ),
      h('div', { class: 'app-header__actions' },
        h('a', {
          class: 'app-header__icon-btn',
          href: 'https://developer.mozilla.org/zh-CN/docs/Web',
          target: '_blank',
          rel: 'noopener noreferrer',
          'aria-label': 'MDN Web Docs（在新标签打开）',
          title: 'MDN Web Docs（外链，非 SPA 路由）',
        }, 'MDN'),
        h('button', {
          type: 'button',
          class: 'app-header__icon-btn',
          'aria-label': isDark ? '切换到浅色主题' : '切换到深色主题',
          'aria-pressed': String(isDark),
          title: '切换主题',
          onClick: () => this._toggleTheme(),
        }, isDark ? '☀' : '☾'),
      ),
    );
  }

  _isActive(path) {
    const current = this.state.activePath;
    if (path === '/') return current === '/';
    return current === path || current.startsWith(path + '/') || current.startsWith(path);
  }

  _toggleTheme() {
    store.commit('app', 'toggleTheme');
    this.setState({ theme: store.get('app', 'theme') });
    this._applyTheme();
  }

  _applyTheme() {
    document.documentElement.dataset.theme = store.get('app', 'theme');
    eventBus.emit(EVENTS.THEME_CHANGE, store.get('app', 'theme'));
  }

  componentDidMount() {
    // 订阅路由变化，更新高亮
    this._unsubAfter = eventBus.on(EVENTS.ROUTER_AFTER, ({ to }) => {
      this.setState({ activePath: to.path });
    });
    // 初始应用主题
    this._applyTheme();
  }

  componentWillUnmount() {
    this._unsubAfter?.();
  }
}
