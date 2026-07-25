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
  initialState() { return { activePath: '/', theme: store.get('app', 'theme') }; }

  render() {
    const isDark = this.state.theme === 'dark';
    return h('header', { class: 'app-header' },
      // Logo：点击编程式跳转首页
      h('div', {
        class: 'app-header__logo',
        onClick: () => this.props.router?.push('/'),
      },
        h('div', { class: 'app-header__logo-mark' }, 'W'),
        h('span', {}, 'WebPlatform Lab'),
      ),
      h('nav', { class: 'app-header__menu' },
        ...MENU.map((item) => h('div', {
          class: `app-header__menu-item ${this._isActive(item.path) ? 'is-active' : ''}`,
          onClick: () => this.props.router?.push(item.path),
        }, item.label)),
      ),
      h('div', { class: 'app-header__actions' },
        h('a', {
          class: 'app-header__icon-btn',
          href: 'https://developer.mozilla.org/zh-CN/docs/Web',
          target: '_blank',
          rel: 'noopener noreferrer',
          title: 'MDN Web Docs（外链，非 SPA 路由）',
        }, 'MDN'),
        h('div', {
          class: 'app-header__icon-btn',
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
