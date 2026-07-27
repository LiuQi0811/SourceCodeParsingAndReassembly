// Layout.js —— 应用外壳：Header + Sidebar + Content Outlet + Breadcrumb
import { Component } from '../../core/Component.js';
import { h } from '../../core/utils.js';
import { store } from '../../core/Store.js';
import { eventBus, EVENTS } from '../../core/EventBus.js';
import { Header } from './Header.js';
import { Sidebar } from './Sidebar.js';

export class Layout extends Component {
  initialState() {
    return {};
  }

  render() {
    const header = new Header({ router: this.props.router });
    this.registerChild(header);

    const sidebar = new Sidebar({ router: this.props.router });
    this.registerChild(sidebar);
    this._sidebar = sidebar;

    // 面包屑容器：路由切换时直接更新其子节点，绝不触发整树重渲染，
    // 否则会重建 #router-outlet，导致 Router 当前挂载的页面 DOM 被剥离文档。
    this._breadcrumbEl = h('nav', { class: 'app-breadcrumb', style: { display: 'none' } });

    // 移动端抽屉遮罩：仅 <992px 显示，点击关闭抽屉。
    // 通过 SIDEBAR_TOGGLE 事件切换 is-visible 类，桌面端 CSS 强制隐藏避免残留。
    this._maskEl = h('div', {
      class: 'app-mask app-mask--sidebar',
      onClick: () => this._closeSidebar(),
    });

    return h('div', { class: 'app-shell' },
      // Skip-to-content：键盘用户按 Tab 第一个聚焦到它，回车跳过 Header/Sidebar 直达正文
      h('a', {
        class: 'skip-link',
        href: '#main-content',
        onClick: (e) => {
          e.preventDefault();
          const target = document.getElementById('main-content');
          if (target) {
            target.setAttribute('tabindex', '-1');
            target.focus();
            // 滚动到顶部，避免焦点已聚焦但视口未滚动
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        },
      }, '跳到主要内容'),
      header.render(),
      h('div', { class: 'app-body' },
        sidebar.render(),
        h('main', { class: 'app-content', id: 'main-content' },
          h('div', { class: 'app-content__inner' },
            this._breadcrumbEl,
            // 路由出口：Router 会把页面挂到这里，本组件不再重渲染以保持该节点稳定
            h('div', { id: 'router-outlet' }),
          ),
        ),
      ),
      this._maskEl,
    );
  }

  /** 关闭移动端抽屉并同步 mask */
  _closeSidebar() {
    store.commit('app', 'closeSidebar');
    eventBus.emit(EVENTS.SIDEBAR_TOGGLE);
  }

  componentDidMount() {
    // 监听路由切换，直接更新面包屑 DOM（不使用 setState，避免重渲染）
    this._unsubAfter = eventBus.on(EVENTS.ROUTER_AFTER, ({ to }) => {
      const crumbs = this._buildBreadcrumb(to);
      store.commit('app', 'setBreadcrumb', crumbs);
      this._renderBreadcrumb(crumbs);
    });
    // 监听抽屉开关：同步 mask 显示状态（直接操作 DOM，避免重渲染整树）
    this._unsubToggle = eventBus.on(EVENTS.SIDEBAR_TOGGLE, () => {
      if (this._maskEl) {
        this._maskEl.classList.toggle('is-visible', store.get('app', 'sidebarOpen'));
      }
    });
    // 关键修复：刷新页面时 router.start() 同步触发首次 ROUTER_AFTER，
    // 而本组件 componentDidMount 用 requestAnimationFrame 异步执行，会错过该事件，
    // 导致刷新后面包屑为空。这里基于当前 location.pathname 主动渲染一次。
    const currentPath = (typeof window !== 'undefined' && window.location?.pathname) || '/';
    const currentRoute = this.props.router?.current;
    const to = currentRoute
      ? { path: currentPath, route: currentRoute, params: this.props.router?.currentParams, }
      : { path: currentPath };
    const crumbs = this._buildBreadcrumb(to);
    store.commit('app', 'setBreadcrumb', crumbs);
    this._renderBreadcrumb(crumbs);
  }

  /** 直接操作面包屑 DOM，避免触发 _rerender 重建 router-outlet */
  _renderBreadcrumb(crumbs) {
    const el = this._breadcrumbEl;
    if (!el) return;
    while (el.firstChild) el.removeChild(el.firstChild);
    if (!crumbs || crumbs.length === 0) {
      el.style.display = 'none';
      return;
    }
    el.style.display = '';
    crumbs.forEach((item, i, arr) => {
      const last = i === arr.length - 1;
      el.appendChild(h('span', {
        class: `app-breadcrumb__item ${last ? 'is-current' : ''}`,
        onClick: () => { if (!last && item.path) this.props.router?.push(item.path); },
      }, item.label));
      if (!last) el.appendChild(h('span', { class: 'app-breadcrumb__sep' }, '/'));
    });
  }

  _buildBreadcrumb(to) {
    const crumbs = [{ label: '首页', path: '/' }];
    const path = to.path;
    if (path === '/') return crumbs;
    if (path.startsWith('/components')) {
      crumbs.push({ label: '组件', path: '/components' });
      if (path.includes('/basic')) crumbs.push({ label: '基础组件' });
      else if (path.includes('/form')) crumbs.push({ label: '表单组件' });
      else if (path.includes('/data')) crumbs.push({ label: '数据展示' });
      else if (path.includes('/feedback')) crumbs.push({ label: '反馈组件' });
    } else if (path.startsWith('/router')) {
      crumbs.push({ label: '路由示例', path: '/router' });
      if (to.params?.id) crumbs.push({ label: `用户 #${to.params.id}` });
    } else if (path.startsWith('/api-lab')) {
      crumbs.push({ label: 'API 实验室', path: '/api-lab' });
      if (to.route?.meta?.title) crumbs.push({ label: to.route.meta.title });
    } else if (path === '/about') {
      crumbs.push({ label: '关于' });
    } else if (path === '*') {
      crumbs.push({ label: '404' });
    }
    return crumbs;
  }

  componentWillUnmount() {
    this._unsubAfter?.();
    this._unsubToggle?.();
  }
}
