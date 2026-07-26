// Layout.js —— 布局容器组件（Layout/Header/Content/Footer/Sider）
import { Component } from '../../core/Component.js';
import { h } from '../../core/utils.js';

/** 根布局容器：可包含 Header/Content/Footer/Sider */
export class Layout extends Component {
  render() {
    const { hasSider = false, className = '', children } = this.props;
    const classes = ['layout', hasSider && 'layout--has-sider', className];
    // 关键布局属性走 inline style，确保即使无 CSS 也能生效
    const style = {
      display: 'flex',
      flex: 'auto',
      flexDirection: hasSider ? 'row' : 'column',
      minHeight: 0,
    };
    const kids = Array.isArray(children) ? children : [children];
    return h('section', { class: classes, style }, ...kids);
  }
}

/** 顶栏 */
export class Header extends Component {
  render() {
    const { className = '', children } = this.props;
    return h('header', {
      class: ['layout__header', className],
      style: { flex: '0 0 auto' },
    }, ...(Array.isArray(children) ? children : [children]));
  }
}

/** 主内容区 */
export class Content extends Component {
  render() {
    const { className = '', children } = this.props;
    return h('main', {
      class: ['layout__content', className],
      style: { flex: 'auto' },
    }, ...(Array.isArray(children) ? children : [children]));
  }
}

/** 页脚 */
export class Footer extends Component {
  render() {
    const { className = '', children } = this.props;
    return h('footer', {
      class: ['layout__footer', className],
      style: { flex: '0 0 auto' },
    }, ...(Array.isArray(children) ? children : [children]));
  }
}

/** 侧边栏：支持 width/collapsible/collapsed/onCollapse */
export class Sider extends Component {
  initialState() {
    return { collapsed: !!this.props.collapsed };
  }

  /** 当前是否折叠：受控优先（外部传入 collapsed 时使用），否则用内部 state */
  getCollapsed() {
    return this.props.collapsed != null ? !!this.props.collapsed : this.state.collapsed;
  }

  /** 切换折叠状态并触发 onCollapse 回调 */
  toggle() {
    const next = !this.getCollapsed();
    this.setState({ collapsed: next });
    this.props.onCollapse?.(next);
  }

  render() {
    const {
      width = 200, collapsedWidth = 80,
      collapsible = false, theme = 'dark',
      reverseArrow = false, className = '', children,
    } = this.props;

    const collapsed = this.getCollapsed();
    const realWidth = collapsed ? collapsedWidth : width;
    const classes = [
      'layout__sider',
      `layout__sider--${theme}`,
      collapsed && 'layout__sider--collapsed',
      collapsible && 'layout__sider--collapsible',
      className,
    ];

    const kids = [
      h('div', { class: 'layout__sider-children' },
        ...(Array.isArray(children) ? children : [children]),
      ),
    ];
    if (collapsible) {
      // 触发器：reverseArrow 时箭头方向取反
      const arrow = collapsed
        ? (reverseArrow ? '«' : '»')
        : (reverseArrow ? '»' : '«');
      kids.push(h('div', {
        class: ['layout__sider-trigger', collapsed && 'layout__sider-trigger--collapsed'],
        onClick: () => this.toggle(),
      }, arrow));
    }

    return h('aside', {
      class: classes,
      style: {
        flex: `0 0 ${realWidth}px`,
        maxWidth: `${realWidth}px`,
        minWidth: `${realWidth}px`,
        width: `${realWidth}px`,
      },
    }, ...kids);
  }
}

// 便于以 Layout.Header / Layout.Content / Layout.Footer / Layout.Sider 形式访问
Layout.Header = Header;
Layout.Content = Content;
Layout.Footer = Footer;
Layout.Sider = Sider;
