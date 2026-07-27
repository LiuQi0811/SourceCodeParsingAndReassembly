// FetchPage.ts —— Fetch API 实验室：fetch / Response / AbortController / Headers / Stream
// 演示 MDN：fetch、Headers、Response、ReadableStream、AbortController/AbortSignal、performance.now
import { Page } from '../../core/Component.js';
import { h, formatTime, formatDuration } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Input } from '../../components/ui/Input.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';
import { message } from '../../components/ui/Message.js';
import type { Props, State } from '../../core/types.js';

export interface FetchPageProps extends Props {}

export interface FetchLog {
  type: string;
  content: string;
  time: string;
}

export interface HeaderItem {
  k: string;
  v: string;
}

export interface FetchPageState extends State {
  url: string;
  method: string;
  logs: FetchLog[];
  result: string;
  timing: number | null;
  status: number | null;
  headers: HeaderItem[];
  streamingText: string;
  abortableRunning: boolean;
}

export class FetchPage extends Page {
  declare props: FetchPageProps;
  declare state: FetchPageState;
  _abortControllers: Set<AbortController> = new Set<any>();

  initialState(): FetchPageState {
    return {
      url: '/assets/data/users.json',
      method: 'GET',
      logs: [],
      result: '',
      timing: null,
      status: null,
      headers: [],
      streamingText: '',
      abortableRunning: false,
    };
  }

  componentDidMount(): void {
    this._abortControllers = new Set<any>();
  }

  componentWillUnmount(): void {
    this._abortControllers?.forEach((c: any) => c.abort());
    this._abortControllers.clear();
  }

  _addLog(type: string, content: string): void {
    this.setState({
      logs: [...this.state.logs, { type, content, time: formatTime() }].slice(-30),
    });
  }

  _btn(label: string, opts: Props): Node {
    const btn = new Button({ ...opts, children: label, onClick: opts.onClick });
    this.registerChild(btn);
    return btn.render() as Node;
  }

  async _fetchBasic(): Promise<void> {
    const start = performance.now();
    this._addLog('push', `fetch ${this.state.method} ${this.state.url}`);
    try {
      const resp = await fetch(this.state.url, { method: this.state.method });
      const text = await resp.text();
      const elapsed = performance.now() - start;
      let parsed: string;
      try { parsed = JSON.stringify(JSON.parse(text), null, 2); }
      catch { parsed = text.slice(0, 2000); }
      const headers: HeaderItem[] = [];
      resp.headers.forEach((v: string, k: string) => headers.push({ k, v }));
      this.setState({
        result: parsed,
        timing: elapsed,
        status: resp.status,
        headers,
      });
      this._addLog('info', `完成 ${resp.status} 耗时 ${formatDuration(elapsed)}`);
      message.success(`请求成功 · ${resp.status}`);
    } catch (err: any) {
      this._addLog('error', err.message);
      message.error(err.message);
    }
  }

  async _fetchWithAbort(): Promise<void> {
    if (this.state.abortableRunning) {
      message.warning('已有请求进行中');
      return;
    }
    this.setState({ abortableRunning: true, streamingText: '' });
    const controller = new AbortController();
    this._abortControllers.add(controller);
    const start = performance.now();
    this._addLog('push', '启动可中止请求（signal = AbortController.signal）');
    try {
      const resp = await fetch('/assets/data/articles.json', { signal: controller.signal });
      // 演示 ReadableStream：逐块读取
      const reader = resp.body!.getReader();
      const decoder = new TextDecoder('utf-8');
      let received = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        received += decoder.decode(value, { stream: true });
        this.setState({ streamingText: received });
      }
      this._addLog('info', `流式读取完成，耗时 ${formatDuration(performance.now() - start)}`);
      message.success('流式读取完成');
    } catch (err: any) {
      if (err.name === 'AbortError') {
        this._addLog('error', '请求被 AbortController.abort() 中止');
        message.warning('请求已中止');
      } else {
        this._addLog('error', err.message);
        message.error(err.message);
      }
    } finally {
      this._abortControllers.delete(controller);
      this.setState({ abortableRunning: false });
    }
  }

  _abortAll(): void {
    this._abortControllers.forEach((c: any) => c.abort());
    this._addLog('error', `已中止 ${this._abortControllers.size} 个请求`);
  }

  async _fetchTimeout(): Promise<void> {
    // 用 AbortSignal.timeout 演示超时
    this._addLog('push', '启动 1ms 超时请求（AbortSignal.timeout）');
    try {
      await fetch('/assets/data/users.json', { signal: AbortSignal.timeout(1) });
    } catch (err: any) {
      if (err.name === 'TimeoutError') {
        this._addLog('error', `TimeoutError: ${err.message}`);
        message.warning('请求超时');
      } else {
        this._addLog('error', err.message);
      }
    }
  }

  renderPage(): Node | string | (Node | string)[] {
    const urlInput = new Input({
      value: this.state.url, style: { width: '320px' },
      onChange: (v: string) => { this.state.url = v; },
    });
    this.registerChild(urlInput);

    return [
      h('h2', { class: 'section-title' }, 'Fetch API 实验室'),

      h(Alert, {
        type: 'info',
        message: 'fetch() / Response / ReadableStream / AbortController',
        description: '展示 Headers 读取、状态码、流式读取（reader.read）、AbortController 中止、AbortSignal.timeout 超时控制。',
      }),

      // 基础 fetch
      h(Card, { title: '基础请求 + Headers / 状态码', extra: h(Tag, { color: 'primary' }, 'GET') },
        h('div', { class: 'flex flex-col gap-sm' },
          h('div', { class: 'flex items-center gap-sm flex-wrap' },
            h('span', { class: 'fs-sm text-secondary' }, 'URL'),
            urlInput.render(),
            this._btn('发起请求', { type: 'primary', size: 'sm', onClick: () => this._fetchBasic() }),
          ),
          this.state.status != null ? h('div', { class: 'flex items-center gap-md fs-sm' },
            h('span', {}, h('strong', {}, '状态：'), h(Tag, { color: this.state.status < 400 ? 'success' : 'error' }, String(this.state.status))),
            h('span', {}, h('strong', {}, '耗时：'), formatDuration(this.state.timing ?? 0)),
          ) : '',
          this.state.headers.length > 0 ? h('div', {},
            h('div', { class: 'fs-sm text-secondary mb-sm' }, '响应头：'),
            h('div', { class: 'log-panel' },
              ...this.state.headers.map((h_: HeaderItem) => h('div', { class: 'log-panel__line' },
                h('span', { class: 'log-panel__tag log-panel__tag--push' }, h_.k),
                h('span', {}, h_.v),
              )),
            ),
          ) : '',
          this.state.result ? h('pre', { class: 'code-block', style: { maxHeight: '260px' } }, this.state.result) : '',
        ),
      ),

      // 流式 + 中止
      h(Card, { title: 'ReadableStream 流式读取 + AbortController 中止', extra: h(Tag, { color: this.state.abortableRunning ? 'error' : 'default' }, this.state.abortableRunning ? '运行中' : '空闲') },
        h('div', { class: 'flex flex-col gap-sm' },
          h('div', { class: 'flex flex-wrap gap-sm' },
            this._btn('启动流式请求', { type: 'primary', size: 'sm', onClick: () => this._fetchWithAbort(), disabled: this.state.abortableRunning }),
            this._btn('abort() 中止', { danger: true, size: 'sm', onClick: () => this._abortAll(), disabled: !this.state.abortableRunning }),
            this._btn('AbortSignal.timeout(1)', { size: 'sm', onClick: () => this._fetchTimeout() }),
          ),
          this.state.streamingText ? h('div', {},
            h('div', { class: 'fs-sm text-secondary mb-sm' }, `流式接收中（${this.state.streamingText.length} bytes）：`),
            h('pre', { class: 'code-block', style: { maxHeight: '200px' } }, this.state.streamingText.slice(-2000)),
          ) : '',
        ),
      ),

      // 日志
      h(Card, { title: '请求日志', extra: h('span', { class: 'fs-sm text-tertiary' }, '实时') }),
      h('div', { class: 'log-panel' },
        ...this.state.logs.map((log: FetchLog) => h('div', { class: 'log-panel__line' },
          h('span', { class: 'log-panel__time' }, log.time),
          h('span', { class: `log-panel__tag log-panel__tag--${log.type === 'info' ? 'push' : log.type}` }, log.type),
          h('span', {}, log.content),
        )),
      ),
    ];
  }
}
