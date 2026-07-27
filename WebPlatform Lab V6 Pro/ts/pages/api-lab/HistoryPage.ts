// HistoryPage.ts —— History API 实验室
// 演示 MDN：History.pushState/replaceState、popstate、length、state、scrollRestoration
import { Page } from '../../core/Component.js';
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Input } from '../../components/ui/Input.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';
import type { Props, State } from '../../core/types.js';

export interface HistoryPageProps extends Props {}

export interface HistoryLog {
  type: string;
  content: string;
  time: string;
}

export interface CustomState {
  visit: number;
  label: string;
}

export interface HistoryPageState extends State {
  logs: HistoryLog[];
  historyLength: number;
  currentState: any;
  customState: CustomState;
  pathInput: string;
  stateInput: string;
}

export class HistoryPage extends Page {
  declare props: HistoryPageProps;
  declare state: HistoryPageState;
  _onPopState: ((e: PopStateEvent) => void) | null = null;

  initialState(): HistoryPageState {
    return {
      logs: [],
      historyLength: window.history.length,
      currentState: window.history.state,
      customState: { visit: 0, label: '初始' },
      pathInput: '/about',
      stateInput: '{"from":"history-lab"}',
    };
  }

  componentDidMount(): void {
    this._onPopState = (e: PopStateEvent) => {
      this._addLog('pop', `popstate  state=${JSON.stringify(e.state)}  scrollY=${window.scrollY}`);
      this.setState({ currentState: e.state, historyLength: window.history.length });
    };
    window.addEventListener('popstate', this._onPopState);
    this._addLog('info', 'History 实验室已就绪。下方操作会真实写入 window.history');
  }

  componentWillUnmount(): void {
    if (this._onPopState) {
      window.removeEventListener('popstate', this._onPopState);
    }
  }

  _addLog(type: string, content: string): void {
    this.setState({
      logs: [...this.state.logs, { type, content, time: formatTime() }].slice(-40),
      historyLength: window.history.length,
    });
  }

  _parseState(raw: string): any {
    try { return JSON.parse(raw); }
    catch { return raw; }
  }

  _btn(label: string, opts: Props): Node {
    const btn = new Button({ ...opts, children: label, onClick: opts.onClick });
    this.registerChild(btn);
    return btn.render() as Node;
  }

  renderPage(): Node | string | (Node | string)[] {
    const pathInput = new Input({
      value: this.state.pathInput, size: 'sm', style: { width: '200px' },
      onChange: (v: string) => { this.state.pathInput = v; },
    });
    this.registerChild(pathInput);

    const stateInput = new Input({
      value: this.state.stateInput, size: 'sm', style: { width: '260px' },
      onChange: (v: string) => { this.state.stateInput = v; },
    });
    this.registerChild(stateInput);

    return [
      h('h2', { class: 'section-title' }, 'History API 实验室'),

      h(Alert, {
        type: 'info',
        message: 'window.history 对象',
        description: 'pushState / replaceState 不会触发 popstate，只有浏览器前进后退按钮（或 history.back/forward/go）才会触发。下方日志会实时展示。',
      }),

      // 状态概览
      h('div', { class: 'feature-grid mt-lg' },
        h(Card, { title: 'history.length' },
          h('div', { class: 'api-metric' }, String(this.state.historyLength)),
          h('p', { class: 'fs-sm text-tertiary mt-sm' }, '当前会话历史栈长度'),
        ),
        h(Card, { title: 'history.state' },
          h('pre', { class: 'code-block', style: { maxHeight: '120px' } },
            JSON.stringify(this.state.currentState, null, 2) || 'null'),
        ),
        h(Card, { title: 'scrollRestoration' },
          h('div', { class: 'flex items-center gap-sm' },
            h(Tag, { color: window.history.scrollRestoration === 'manual' ? 'warning' : 'success' },
              window.history.scrollRestoration || 'unknown'),
            this._btn('切换', {
              size: 'sm',
              onClick: () => {
                const next = window.history.scrollRestoration === 'manual' ? 'auto' : 'manual';
                window.history.scrollRestoration = next;
                this._addLog('info', `scrollRestoration 已切换为 ${next}`);
                this.setState({});
              },
            }),
          ),
          h('p', { class: 'fs-sm text-tertiary mt-sm' }, '控制前进/后退时是否自动恢复滚动位置'),
        ),
      ),

      // 命令演示
      h('div', { class: 'router-demo mt-lg' },
        h('div', {},
          h(Card, { title: 'pushState(state, "", path)' },
            h('div', { class: 'flex flex-col gap-sm' },
              h('div', { class: 'flex items-center gap-sm' },
                h('span', { class: 'fs-sm text-secondary', style: { width: '50px' } }, 'path'),
                pathInput.render(),
              ),
              h('div', { class: 'flex items-center gap-sm' },
                h('span', { class: 'fs-sm text-secondary', style: { width: '50px' } }, 'state'),
                stateInput.render(),
              ),
              h('div', { class: 'flex gap-sm' },
                this._btn('pushState', { type: 'primary', onClick: () => {
                  try {
                    window.history.pushState(this._parseState(this.state.stateInput), '', this.state.pathInput);
                    this._addLog('push', `pushState(${this.state.pathInput})`);
                    this.setState({ currentState: window.history.state });
                  } catch (err: any) { this._addLog('error', err.message); }
                }}),
                this._btn('replaceState', { onClick: () => {
                  try {
                    window.history.replaceState(this._parseState(this.state.stateInput), '', this.state.pathInput);
                    this._addLog('push', `replaceState(${this.state.pathInput})`);
                    this.setState({ currentState: window.history.state });
                  } catch (err: any) { this._addLog('error', err.message); }
                }}),
              ),
            ),
          ),

          h(Card, { title: '导航命令', extra: '触发 popstate' },
            h('div', { class: 'flex flex-wrap gap-sm' },
              this._btn('history.back()', { onClick: () => window.history.back() }),
              this._btn('history.forward()', { onClick: () => window.history.forward() }),
              this._btn('history.go(-1)', { onClick: () => window.history.go(-1) }),
              this._btn('history.go(1)', { onClick: () => window.history.go(1) }),
              this._btn('history.go(0) 刷新', { danger: true, onClick: () => window.history.go(0) }),
            ),
          ),
        ),

        // 日志
        h('div', {},
          h(Card, { title: '事件日志', extra: h('span', { class: 'fs-sm text-tertiary' }, 'popstate 监听') }),
          h('div', { class: 'log-panel', id: 'history-log' },
            ...this.state.logs.map((log: HistoryLog) => h('div', { class: 'log-panel__line' },
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
