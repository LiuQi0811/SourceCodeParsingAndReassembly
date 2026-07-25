// RouterPage.js —— 路由示例页：演示编程式导航 + 日志面板
// 演示 MDN：History API、popstate、URLSearchParams、performance.now
import { Page } from '../core/Component.js';
import { h, formatTime, stringifyQuery } from '../core/utils.js';
import { Button } from '../components/ui/Button.js';
import { Card } from '../components/ui/Card.js';
import { Alert } from '../components/ui/Alert.js';
import { Input } from '../components/ui/Input.js';
import { eventBus, EVENTS } from '../core/EventBus.js';

export class RouterPage extends Page {
  initialState() {
    return { logs: [], userId: '5', queryKey: 'tab', queryValue: 'profile' };
  }

  componentDidMount() {
    // 监听路由事件，写入日志面板
    this._unsubBefore = eventBus.on(EVENTS.ROUTER_BEFORE, ({ to, from }) => {
      this._addLog('guard', `beforeEach  ${from?.path || '∅'} → ${to.path}`);
    });
    this._unsubAfter = eventBus.on(EVENTS.ROUTER_AFTER, ({ to, from }) => {
      this._addLog('push', `afterEach   ${from?.path || '∅'} → ${to.path}`);
    });
    // 监听 popstate
    this._onPopState = (e) => {
      this._addLog('pop', `popstate    state=${JSON.stringify(e.state)}`);
    };
    window.addEventListener('popstate', this._onPopState);

    this._addLog('info', '路由示例页已加载，尝试下方按钮触发导航');
  }

  componentWillUnmount() {
    this._unsubBefore?.();
    this._unsubAfter?.();
    window.removeEventListener('popstate', this._onPopState);
  }

  _addLog(type, content) {
    this.setState({
      logs: [...this.state.logs, { type, content, time: formatTime() }].slice(-50),
    });
  }

  _makeBtn(label, opts) {
    const btn = new Button({ ...opts, children: label, onClick: opts.onClick });
    this.registerChild(btn);
    return btn.render();
  }

  renderPage() {
    return [
      h('h2', { class: 'section-title' }, '路由示例'),
      h(Alert, { type: 'info', message: '所有跳转均通过 router.push() / replace() / go() 触发',
        description: '本页未使用任何 <a> 标签默认跳转。点击右侧日志面板可观察 beforeEach / afterEach 守卫与 popstate 事件。' }),

      h('div', { class: 'router-demo mt-lg' },
        h('div', {},
          // 基础导航
          h(Card, { title: '基础导航命令' },
            h('div', { class: 'flex flex-col gap-sm' },
              this._makeBtn('router.push("/about")', { type: 'primary', onClick: () => this.props.router.push('/about') }),
              this._makeBtn('router.replace("/router")', { onClick: () => this.props.router.replace('/router') }),
              h('div', { class: 'flex gap-sm' },
                this._makeBtn('router.back()', { onClick: () => this.props.router.back() }),
                this._makeBtn('router.forward()', { onClick: () => this.props.router.forward() }),
                this._makeBtn('router.go(-2)', { onClick: () => this.props.router.go(-2) }),
              ),
            ),
          ),

          // 动态参数
          h(Card, { title: '动态路由参数', extra: '/router/user/:id' }),
          h('div', { class: 'card mb-lg' },
            h('div', { class: 'card__body flex items-center gap-sm' },
              h('span', {}, '用户 ID：'),
              (() => {
                const input = new Input({
                  value: this.state.userId, size: 'sm', style: { width: '100px' },
                  onChange: (v) => this.state.userId = v,
                });
                this.registerChild(input);
                return input.render();
              })(),
              this._makeBtn('跳转用户详情', { type: 'primary', onClick: () => {
                this.props.router.push(`/router/user/${this.state.userId || 1}`);
              }}),
            ),
          ),

          // 查询参数
          h(Card, { title: '查询参数', extra: 'URLSearchParams' }),
          h('div', { class: 'card mb-lg' },
            h('div', { class: 'card__body flex flex-col gap-sm' },
              h('div', { class: 'flex items-center gap-sm' },
                h('span', { class: 'fs-sm text-secondary' }, 'key'),
                h('input', { class: 'input input--sm', value: this.state.queryKey, style: { width: '120px' },
                  oninput: (e) => this.state.queryKey = e.target.value }),
                h('span', { class: 'fs-sm text-secondary' }, 'value'),
                h('input', { class: 'input input--sm', value: this.state.queryValue, style: { width: '120px' },
                  oninput: (e) => this.state.queryValue = e.target.value }),
              ),
              this._makeBtn('携带 query 跳转', { type: 'primary', onClick: () => {
                this.props.router.push(`/router?${this.state.queryKey}=${this.state.queryValue}`);
              }}),
              h('div', { class: 'fs-sm text-tertiary' },
                '当前 query：', h('code', {}, JSON.stringify(this.props.router.currentQuery))),
            ),
          ),

          // 路由守卫
          h(Card, { title: '路由守卫演示' }),
          h('div', { class: 'card' },
            h('div', { class: 'card__body flex flex-col gap-sm' },
              h('p', { class: 'fs-sm text-secondary' },
                '点击下方按钮尝试访问受保护路由 /router/secret，会被 beforeEach 守卫拦截并重定向到 /about。'),
              this._makeBtn('访问受保护路由（将被拦截）', { danger: true, type: 'primary', onClick: () => {
                this.props.router.push('/router/secret');
              }}),
            ),
          ),
        ),

        // 日志面板
        h('div', {},
          h(Card, { title: '路由事件日志', extra: h('span', { class: 'fs-sm text-tertiary' }, '实时') }),
          h('div', { class: 'log-panel', id: 'router-log' },
            ...this.state.logs.map((log) => h('div', { class: 'log-panel__line' },
              h('span', { class: 'log-panel__time' }, log.time),
              h('span', { class: `log-panel__tag log-panel__tag--${log.type === 'info' ? 'push' : log.type}` }, log.type),
              h('span', {}, log.content),
            )),
          ),
        ),
      ),
    ];
  }
}
