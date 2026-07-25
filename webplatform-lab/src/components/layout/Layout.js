// Layout.js —— 应用外壳：Header + Sidebar + Content Outlet + Breadcrumb
import { Component } from '../../core/Component.js';
import { h } from '../../core/utils.js';
import { store } from '../../core/Store.js';
import { eventBus, EVENTS } from '../../core/EventBus.js';
import { Header } from './Header.js';
import { Sidebar } from './Sidebar.js';

export class Layout extends Component {
  initialState() {
    return { sidebarCollapsed: store.get('app', 'sidebarCollapsed'), breadcrumb: [] };
  }

  render() {
    const header = new Header({ router: this.props.router });
    this.registerChild(header);

    const sidebar = new Sidebar({ router: this.props.router });
    this.registerChild(sidebar);
    this._sidebar = sidebar;

    return h('div', { class: 'app-shell' },
      header.render(),
      h('div', { class: 'app-body' },
        sidebar.render(),
        h('main', { class: 'app-content' },
          h('div', { class: 'app-content__inner' },
            // 面包屑
            this.state.breadcrumb.length > 0 && h('nav', { class: 'app-breadcrumb' },
              ...this.state.breadcrumb.map((item, i, arr) => {
                const last = i === arr.length - 1;
                return [
                  h('span', {
                    class: `app-breadcrumb__item ${last ? 'is-current' : ''}`,
                    onClick: () => { if (!last && item.path) this.props.router?.push(item.path); },
                  }, item.label),
                  !last && h('span', { class: 'app-breadcrumb__sep' }, '/'),
                ];
              }).flat(),
            ),
            // 路由出口：Router 会把页面挂到这里
            h('div', { id: 'router-outlet' }),
          ),
        ),
      ),
    );
  }

  componentDidMount() {
    // 监听路由切换，构建面包屑
    this._unsubAfter = eventBus.on(EVENTS.ROUTER_AFTER, ({ to }) => {
      const crumbs = this._buildBreadcrumb(to);
      store.commit('app', 'setBreadcrumb', crumbs);
      this.setState({ breadcrumb: crumbs });
    });

    // 监听侧栏状态
    this._unsubSidebar = eventBus.on(EVENTS.SIDEBAR_TOGGLE, () => {
      this.setState({ sidebarCollapsed: store.get('app', 'sidebarCollapsed') });
    });

    // 移动端点击遮罩关闭侧栏
    this._onContentClick = (e) => {
      if (window.innerWidth <= 992 && store.get('app', 'sidebarOpen')) {
        // 点击内容区关闭抽屉
        store.commit('app', 'closeSidebar');
        eventBus.emit(EVENTS.SIDEBAR_TOGGLE);
      }
    };
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
    this._unsubSidebar?.();
  }
}
