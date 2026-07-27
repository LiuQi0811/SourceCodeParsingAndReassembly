// AboutPage.js —— 关于页：技术栈、设计模式、源码结构
import { Page } from '../core/Component.js';
import { h, escapeHTML } from '../core/utils.js';

const PATTERNS = [
  { name: '观察者模式', where: 'EventBus / Store 订阅 / Router popstate' },
  { name: '单例模式', where: 'router / store / eventBus 实例' },
  { name: '工厂模式', where: 'Message / Notification / confirm 工厂' },
  { name: '模板方法模式', where: 'Component 生命周期钩子' },
  { name: '策略模式', where: '路由 history/hash 策略、表单校验' },
  { name: '装饰器模式', where: 'beforeEach 守卫包装路由跳转' },
  { name: '适配器模式', where: 'storage 工具统一 local/session/Cookie' },
  { name: '命令模式', where: 'router.push / replace / go 命令' },
  { name: '多态', where: 'Button/Tag/Alert 继承 Component 各自实现 render' },
];

const TREE = `src/
├── core/                  # 框架核心层
│   ├── Component.js       # 组件基类（模板方法）
│   ├── Router.js          # History API 路由
│   ├── EventBus.js        # 事件总线（观察者）
│   ├── Store.js           # 状态管理（单例 + Proxy）
│   └── utils.js           # 工具函数
├── components/
│   ├── ui/                # 自研 UI 组件库
│   └── layout/            # 布局组件
├── pages/                 # 业务页面
│   └── api/               # API 实验室各模块
├── app.js                 # 应用入口
└── routes.js              # 路由配置
workers/                   # Web Worker
assets/                    # 静态资源（CSS / mock JSON）`;

export class AboutPage extends Page {
  renderPage() {
    return [
      h('h2', { class: 'section-title' }, '关于本项目'),
      h('div', { class: 'about-grid' },
        h('div', { class: 'card' },
          h('div', { class: 'card__head' }, h('span', {}, '技术栈')),
          h('div', { class: 'card__body' },
            h('ul', { class: 'flex flex-col gap-xs' },
              ...[
                '纯原生 HTML5 + CSS3 + ES2020+ JavaScript',
                '零第三方依赖，零打包工具',
                'ES Module 原生模块化',
                'History API 自研路由',
                'CSS 自定义属性实现主题系统',
                'OOP + 设计模式组织代码',
              ].map((t) => h('li', { class: 'flex items-center gap-sm' },
                h('span', { class: 'text-success' }, '✓'), h('span', {}, t))),
            ),
          ),
        ),
        h('div', { class: 'card' },
          h('div', { class: 'card__head' }, h('span', {}, '覆盖的 MDN Web API')),
          h('div', { class: 'card__body' },
            h('div', { class: 'flex flex-wrap gap-xs' },
              ...['History', 'popstate', 'Fetch', 'AbortController', 'localStorage', 'sessionStorage',
                  'Cookie', 'Canvas 2D', 'requestAnimationFrame', 'Web Workers', 'BigInt',
                  'IntersectionObserver', 'MutationObserver', 'ResizeObserver', 'Clipboard',
                  'Geolocation', 'Drag & Drop', 'Web Audio', 'Notification', 'CustomEvent',
                  'URL/URLSearchParams', 'Proxy', 'Intl', 'structuredClone', 'FileReader'].map((api) =>
                h('span', { class: 'tag tag--primary' }, api)),
            ),
          ),
        ),
      ),
      h('div', { class: 'card mt-lg' },
        h('div', { class: 'card__head' }, h('span', {}, '设计模式应用')),
        h('div', { class: 'card__body' },
          h('div', { class: 'pattern-list' },
            ...PATTERNS.map((p) => h('div', { class: 'pattern-chip' },
              h('strong', {}, p.name),
              h('div', { class: 'fs-sm text-tertiary mt-xs' }, p.where),
            )),
          ),
        ),
      ),
      h('div', { class: 'card mt-lg' },
        h('div', { class: 'card__head' }, h('span', {}, '源码目录结构')),
        h('div', { class: 'card__body' },
          h('pre', { class: 'code-block' }, TREE),
        ),
      ),
      h('div', { class: 'alert alert--info mt-lg' },
        h('span', { class: 'alert__icon' }, 'ℹ'),
        h('div', {},
          h('div', { class: 'fw-medium' }, '提示'),
          h('div', { class: 'fs-sm' }, '本项目所有页面跳转均通过 router.push() 编程式触发，未使用 <a> 标签的默认跳转行为。点击右上角「MDN」为外链，是少数使用 <a> 的场景。'),
        ),
      ),
    ];
  }
}
