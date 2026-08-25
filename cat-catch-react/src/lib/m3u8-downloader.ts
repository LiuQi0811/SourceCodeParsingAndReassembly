/**
 * M3U8 并发下载器
 * 1:1 还原原 js/m3u8.downloader.js 的 Downloader 类
 *
 * 设计要点(保留原行为):
 * - 事件系统 on/emit/off,事件名含 'start'/'itemProgress'/'rawBuffer'/'pipe:*'/
 *   'processedBuffer'/'completed'/'allCompleted'/'sequentialPush'/'stop'/
 *   'retry'/'downloadError'/'error'
 * - pipeline 管线 use(fn, name),每个 fn 形如 (buffer, fragment) => buffer
 * - 并发控制:start() 开启 thread 个 downloader(),每个 finally 再取下一条
 * - sequentialPush:按 fragment.index 顺序推送 buffer(保证合并顺序)
 * - range(start, end):切片范围,重排 index
 * - byteRange:添加 Range 请求头
 * - 重试:autoRetry + MAX_RETRIES + 500*retryCount 延迟
 * - 流式:fragment.fileStream 存在则 write,否则攒 chunks 合并
 * - stop(index):AbortController 中断,无 index 停所有
 */
export interface DecryptData {
  method: string; // 'AES-128' | 'SAMPLE-AES' | 'NONE' | ...
  key?: Uint8Array;
  iv?: Uint8Array;
  keyFormat?: string;
  uri?: string;
  keyId?: string;
}

export interface Fragment {
  url: string;
  index: number;
  duration?: number;
  /** [start, end) 半开区间,转 Range 头时 end-1 */
  byteRange?: [number, number];
  initSegment?: { url: string; byteRange?: [number, number] };
  encrypted?: boolean;
  decryptdata?: DecryptData;
  contentType?: string;
  retryCount?: number;
  /** 流式下载输出流,存在则 write 不攒 chunks */
  fileStream?: { write: (chunk: Uint8Array) => void };
  cc?: number;
  /** 透传字段(hls.js / 调用方可附加任意属性) */
  [key: string]: unknown;
}

export type DownloaderState = 'waiting' | 'running' | 'done' | 'abort';
type EventHandler = (...args: unknown[]) => void;
interface PipelineStep {
  fn: (buffer: ArrayBuffer, fragment: Fragment) => ArrayBuffer | Promise<ArrayBuffer>;
  name: string;
}

export class Downloader {
  MAX_RETRIES = 3;

  private _fragments: Fragment[] = [];
  allFragments: Fragment[];
  thread: number;
  private events: Record<string, EventHandler[]> = {};
  private pipeline: PipelineStep[] = [];
  autoRetry = false;

  index = 0;
  private buffer: (ArrayBuffer | undefined)[] = [];
  state: DownloaderState = 'waiting';
  success = 0;
  errorIndexes = new Set<number>();
  buffersize = 0;
  duration = 0;
  private pushIndex = 0;
  private controller: (AbortController | null | undefined)[] = [];
  running = 0;

  constructor(fragments: Fragment[] = [], thread = 6) {
    this.fragments = fragments;
    this.allFragments = fragments;
    this.thread = thread;
    this.init();
  }

  /** 初始化所有变量(还原 init()) */
  init(): void {
    this.index = 0;
    this.buffer = [];
    this.state = 'waiting';
    this.success = 0;
    this.errorIndexes = new Set();
    this.buffersize = 0;
    this.duration = 0;
    this.pushIndex = 0;
    this.controller = [];
    this.running = 0;
  }

  on(eventName: string, callBack: EventHandler): void {
    if (this.events[eventName]) {
      this.events[eventName].push(callBack);
    } else {
      this.events[eventName] = [callBack];
    }
  }

  emit(eventName: string, ...args: unknown[]): void {
    if (this.events[eventName]) {
      for (const cb of this.events[eventName]) {
        cb(...args);
      }
    }
  }

  off(eventName: string, callBack?: EventHandler): void {
    if (!this.events[eventName]) return;
    if (callBack) {
      this.events[eventName] = this.events[eventName].filter((cb) => cb !== callBack);
    } else {
      delete this.events[eventName];
    }
  }

  /** 注册处理步骤 (buffer, fragment) => buffer,支持链式 */
  use(
    fn: (buffer: ArrayBuffer, fragment: Fragment) => ArrayBuffer | Promise<ArrayBuffer>,
    name = '',
  ): this {
    this.pipeline.push({ fn, name });
    return this;
  }

  removeProcessor(target: string | PipelineStep['fn']): void {
    if (typeof target === 'string') {
      this.pipeline = this.pipeline.filter((p) => p.name !== target);
    } else {
      this.pipeline = this.pipeline.filter((p) => p.fn !== target);
    }
  }

  findPipeline(name: string): boolean {
    return this.pipeline.some((p) => p.name === name);
  }

  /** 停止下载,无 index 停所有线程 */
  stop(index?: number): void {
    if (index !== undefined) {
      this.controller[index]?.abort();
      return;
    }
    for (const controller of this.controller) {
      controller?.abort();
    }
    this.state = 'abort';
  }

  isErrorItem(fragment: Fragment): boolean {
    return this.errorIndexes.has(fragment.index);
  }

  get errorItem(): Fragment[] {
    return [...this.errorIndexes]
      .map((i) => this._fragments[i])
      .filter((f): f is Fragment => f !== undefined);
  }

  /** 按 fragment.index 顺序推送已完成的 buffer */
  sequentialPush(): void {
    if (!this.events['sequentialPush']) return;
    for (; this.pushIndex < this._fragments.length; this.pushIndex++) {
      const buf = this.buffer[this.pushIndex];
      if (buf) {
        this.emit('sequentialPush', buf);
        delete this.buffer[this.pushIndex];
        continue;
      }
      break;
    }
  }

  /** 限定下载范围,start/end 含义与原版一致 */
  range(start = 0, end = this._fragments.length): boolean {
    if (start > end) {
      this.emit('error', 'start > end');
      return false;
    }
    if (end > this._fragments.length) {
      this.emit('error', 'end > total');
      return false;
    }
    if (start >= this._fragments.length) {
      this.emit('error', 'start >= total');
      return false;
    }
    if (start !== 0 || end !== this._fragments.length) {
      this.fragments = this._fragments.slice(start, end);
      this.fragments.forEach((fragment, index) => {
        fragment.index = index;
      });
    }
    if (this._fragments.length === 0) {
      this.emit('error', 'List is empty');
      return false;
    }
    return true;
  }

  get total(): number {
    return this._fragments.length;
  }

  get totalDuration(): number {
    return this._fragments.reduce((total, f) => total + (f.duration ?? 0), 0);
  }

  set fragments(fragments: Fragment[]) {
    // 增加 index 参数,多线程异步下载按 index 顺序保存
    this._fragments = fragments.map((fragment, index) => ({ ...fragment, index }));
  }

  get fragments(): Fragment[] {
    return this._fragments;
  }

  /** #EXT-X-MAP 初始化片段 url */
  get mapTag(): string {
    const first = this._fragments[0];
    if (first?.initSegment?.url) {
      return first.initSegment.url;
    }
    return '';
  }

  push(fragment: Fragment): void {
    fragment.index = this._fragments.length;
    this._fragments.push(fragment);
  }

  /** 下载单个切片,input=null 时从队列取下一条 */
  downloader(input: Fragment | number | null = null): void {
    if (this.state === 'abort') return;
    const directDownload = input !== null;

    if (!directDownload && !this._fragments[this.index]) return;

    // 解析出目标 fragment(窄化为 Fragment,避免联合类型属性访问问题)
    let frag: Fragment;
    if (typeof input === 'number') {
      const f = this._fragments[input];
      if (!f) return;
      frag = f;
    } else if (input) {
      frag = input;
    } else {
      const f = this._fragments[this.index++];
      if (!f) return;
      frag = f;
    }

    this.state = 'running';
    this.running++;

    const controller = new AbortController();
    this.controller[frag.index] = controller;
    const options: RequestInit = { signal: controller.signal };

    this.emit('start', frag, options);

    // byteRange -> Range 头
    if (frag.byteRange && frag.byteRange.length === 2) {
      options.headers = {
        ...(options.headers as Record<string, string> | undefined),
        Range: `bytes=${frag.byteRange[0]}-${frag.byteRange[1] - 1}`,
      };
    }

    fetch(frag.url, options)
      .then((response) => {
        if (!response.ok) {
          throw new Error(String(response.status));
        }
        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error('Response body is not readable');
        }
        const contentLength = parseInt(response.headers.get('content-length') ?? '', 10) || 0;
        frag.contentType = response.headers.get('content-type') ?? 'null';
        let receivedLength = 0;
        const chunks: Uint8Array[] = [];
        const pump = async (): Promise<ArrayBuffer> => {
          for (;;) {
            const { value, done } = await reader.read();
            if (done) break;
            if (value) {
              if (frag.fileStream) {
                frag.fileStream.write(new Uint8Array(value));
              } else {
                chunks.push(value);
              }
              receivedLength += value.length;
              this.emit('itemProgress', frag, false, receivedLength, contentLength, value);
            }
          }
          if (frag.fileStream) {
            return new ArrayBuffer();
          }
          const allChunks = new Uint8Array(receivedLength);
          let position = 0;
          for (const chunk of chunks) {
            allChunks.set(chunk, position);
            position += chunk.length;
          }
          this.emit('itemProgress', frag, true);
          return allChunks.buffer;
        };
        return pump();
      })
      .then(async (buffer) => {
        this.emit('rawBuffer', buffer, frag);
        let buf: ArrayBuffer = buffer;
        for (const { fn, name } of this.pipeline) {
          buf = await fn(buf, frag);
          this.emit(name ? `pipe:${name}` : 'processedBuffer', buf, frag);
        }
        return buf;
      })
      .then((buffer) => {
        this.buffer[frag.index] = buffer;
        this.success++;
        this.buffersize += buffer.byteLength;
        this.duration += frag.duration ?? 0;
        this.errorIndexes.delete(frag.index);
        this.sequentialPush();
        this.emit('completed', buffer, frag);
        if (this.success === this._fragments.length) {
          this.state = 'done';
          this.emit('allCompleted', this.buffer, this._fragments);
        }
      })
      .catch((error: unknown) => {
        console.log(error);
        if (error instanceof Error && error.name === 'AbortError') {
          this.emit('stop', frag, error);
          return;
        }
        if (this.autoRetry) {
          frag.retryCount = (frag.retryCount ?? 0) + 1;
          if (frag.retryCount <= this.MAX_RETRIES) {
            this.emit('retry', frag, error);
            setTimeout(() => this.downloader(frag), 500 * frag.retryCount);
            return;
          }
        }
        this.emit('downloadError', frag, error);
        this.errorIndexes.add(frag.index);
      })
      .finally(() => {
        if (this.controller[frag.index] === controller) {
          this.controller[frag.index] = null;
        }
        this.running--;
        if (!directDownload && this.index < this._fragments.length) {
          this.downloader();
        }
      });
  }

  /** 开始下载,start/end 为切片范围 */
  start(start = 0, end = this._fragments.length): void {
    if (this.state === 'running') {
      this.emit('error', 'state running');
      return;
    }
    if (!this.range(start, end)) return;
    this.init();
    for (let i = 0; i < this.thread && i < this._fragments.length; i++) {
      this.downloader();
    }
  }

  /** 销毁,清空所有状态 */
  destroy(): void {
    this.stop();
    this._fragments = [];
    this.allFragments = [];
    this.thread = 6;
    this.events = {};
    this.pipeline = [];
    this.init();
  }
}
