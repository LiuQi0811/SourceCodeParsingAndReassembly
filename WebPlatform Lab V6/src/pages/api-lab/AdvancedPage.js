// AdvancedPage.js —— 高级 Web API 实验室
// 演示 MDN：WebSocket、IndexedDB、BroadcastChannel、Performance API、
//           Web Crypto（SubtleCrypto）、CompressionStream / TextEncoder
import { Page } from '../../core/Component.js';
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';
import { Input } from '../../components/ui/Input.js';

// WebSocket readyState 文本映射（0/1/2/3）
const WS_STATES = ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'];

// ArrayBuffer / 字节数组 → 十六进制字符串
function bufToHex(buf) {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export class AdvancedPage extends Page {
  initialState() {
    return {
      logs: [],
      wsState: '未连接',
      wsMessages: [],
      wsInput: '',
      bcInput: '',
      notes: [],
      noteTitle: '',
      noteContent: '',
      perfResults: [],
      cryptoInput: 'Hello, MDN!',
      cryptoHash: '',
      cryptoEncrypted: '',
      cryptoDecrypted: '',
      compressInput: '这是一段需要压缩的文本，用于演示 CompressionStream 与 TextEncoder/TextDecoder 的编解码能力。',
      compressResult: '',
    };
  }

  // —— 生命周期 ——
  componentDidMount() {
    // BroadcastChannel：跨标签页通信
    try {
      this._bc = new BroadcastChannel('mdn-lab-bc');
      this._bc.onmessage = (e) => {
        const { from, text } = e.data || {};
        this._addLog('bc', `收到广播（发送于 ${formatTime(new Date(from))}）：${text}`);
      };
      this._addLog('bc', 'BroadcastChannel 已就绪，另开标签页即可互通');
    } catch (err) {
      this._addLog('error', `BroadcastChannel 初始化失败：${err.message}`);
    }

    // 加载已有 IndexedDB 笔记
    this._loadNotes().catch((err) => this._addLog('error', `读取笔记失败：${err.message}`));

    // PerformanceObserver：监听 measure 条目
    try {
      this._perfObs = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          this._addLog('perf', `PerformanceObserver 捕获 measure「${entry.name}」= ${entry.duration.toFixed(2)}ms`);
        }
      });
      this._perfObs.observe({ entryTypes: ['measure'] });
    } catch (err) {
      this._addLog('error', `PerformanceObserver 不可用：${err.message}`);
    }
  }

  componentWillUnmount() {
    // 清理 WebSocket
    this._disconnectWs();
    // 清理 BroadcastChannel
    if (this._bc) {
      try { this._bc.close(); } catch { /* noop */ }
      this._bc = null;
    }
    // 清理 IndexedDB 连接
    if (this._db) {
      try { this._db.close(); } catch { /* noop */ }
      this._db = null;
    }
    // 清理 PerformanceObserver
    if (this._perfObs) {
      try { this._perfObs.disconnect(); } catch { /* noop */ }
      this._perfObs = null;
    }
  }

  // —— 日志辅助 ——
  _addLog(type, content) {
    this.setState({ logs: [...this.state.logs, { type, content, time: formatTime() }].slice(-40) });
  }

  // —— 按钮辅助 ——
  _btn(label, opts) {
    const btn = new Button({ ...opts, children: label, onClick: opts.onClick });
    this.registerChild(btn);
    return btn.render();
  }

  // =================== 1. WebSocket ===================
  async _connectWs() {
    if (this._ws && (this._ws.readyState === 0 || this._ws.readyState === 1)) {
      this._addLog('ws', 'WebSocket 已连接或正在连接中');
      return;
    }
    try {
      this._addLog('ws', '正在连接 wss://echo.websocket.events ...');
      this.setState({ wsState: 'CONNECTING' });
      const ws = new WebSocket('wss://echo.websocket.events');
      this._ws = ws;

      ws.onopen = () => {
        this.setState({ wsState: WS_STATES[ws.readyState] });
        this._addLog('ws', '连接已建立（onopen），readyState=OPEN');
      };
      ws.onmessage = (e) => {
        const text = e.data;
        this._addLog('ws', `收到回显（onmessage）：${text}`);
        this.setState({ wsMessages: [...this.state.wsMessages, { dir: 'in', text, time: formatTime() }].slice(-20) });
      };
      ws.onerror = () => {
        this._addLog('error', 'WebSocket 发生错误（onerror）');
      };
      ws.onclose = () => {
        this.setState({ wsState: WS_STATES[ws.readyState] || 'CLOSED' });
        this._addLog('ws', '连接已关闭（onclose）');
      };
    } catch (err) {
      this._addLog('error', `WebSocket 连接异常：${err.message}`);
    }
  }

  _disconnectWs() {
    if (this._ws) {
      try {
        // 先移除事件监听，避免 close 后触发多余日志
        this._ws.onopen = null;
        this._ws.onmessage = null;
        this._ws.onerror = null;
        this._ws.onclose = null;
        if (this._ws.readyState === 0 || this._ws.readyState === 1) {
          this._ws.close();
        }
      } catch { /* noop */ }
      this._ws = null;
      this.setState({ wsState: '未连接' });
    }
  }

  _sendWs(text) {
    if (!this._ws || this._ws.readyState !== 1) {
      this._addLog('error', '发送失败：WebSocket 未连接');
      return;
    }
    const msg = text || this.state.wsInput;
    if (!msg) return;
    this._ws.send(msg);
    this._addLog('ws', `已发送：${msg}`);
    this.setState({
      wsMessages: [...this.state.wsMessages, { dir: 'out', text: msg, time: formatTime() }].slice(-20),
      wsInput: '',
    });
  }

  // =================== 2. IndexedDB ===================
  // 打开/创建数据库 mdn-lab-db（version 1）
  _openDB() {
    return new Promise((resolve, reject) => {
      if (this._db) { resolve(this._db); return; }
      const req = indexedDB.open('mdn-lab-db', 1);
      // 首次创建或版本升级时创建 object store
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('notes')) {
          const store = db.createObjectStore('notes', { keyPath: 'id', autoIncrement: true });
          store.createIndex('createdAt', 'createdAt', { unique: false });
          this._addLog('db', 'onupgradeneeded：创建 object store「notes」');
        }
      };
      req.onsuccess = (e) => {
        this._db = e.target.result;
        this._addLog('db', 'onsuccess：数据库已打开');
        resolve(this._db);
      };
      req.onerror = (e) => {
        reject(new Error(`打开数据库失败：${e.target.error?.message || 'unknown'}`));
      };
    });
  }

  async _addNote() {
    const title = this.state.noteTitle.trim();
    const content = this.state.noteContent.trim();
    if (!title || !content) {
      this._addLog('error', '标题和内容不能为空');
      return;
    }
    try {
      const db = await this._openDB();
      const tx = db.transaction('notes', 'readwrite');
      const store = tx.objectStore('notes');
      const req = store.add({ title, content, createdAt: Date.now() });
      tx.oncomplete = () => {
        this._addLog('db', `oncomplete：已添加笔记「${title}」`);
        this.setState({ noteTitle: '', noteContent: '' });
        this._loadNotes();
      };
      tx.onerror = (e) => this._addLog('error', `事务失败：${e.target.error?.message}`);
      req.onerror = (e) => this._addLog('error', `添加失败：${e.target.error?.message}`);
    } catch (err) {
      this._addLog('error', `添加笔记异常：${err.message}`);
    }
  }

  async _loadNotes() {
    try {
      const db = await this._openDB();
      const tx = db.transaction('notes', 'readonly');
      const store = tx.objectStore('notes');
      // 使用 getAll 读取全部笔记
      const req = store.getAll();
      req.onsuccess = (e) => {
        const notes = e.target.result || [];
        this.setState({ notes });
        this._addLog('db', `查询完成：当前共 ${notes.length} 条笔记`);
      };
      req.onerror = (e) => this._addLog('error', `查询失败：${e.target.error?.message}`);
    } catch (err) {
      this._addLog('error', `读取笔记异常：${err.message}`);
    }
  }

  async _deleteNote(id) {
    try {
      const db = await this._openDB();
      const tx = db.transaction('notes', 'readwrite');
      const store = tx.objectStore('notes');
      const req = store.delete(id);
      tx.oncomplete = () => {
        this._addLog('db', `已删除笔记 id=${id}`);
        this._loadNotes();
      };
      req.onerror = (e) => this._addLog('error', `删除失败：${e.target.error?.message}`);
    } catch (err) {
      this._addLog('error', `删除笔记异常：${err.message}`);
    }
  }

  async _clearNotes() {
    try {
      const db = await this._openDB();
      const tx = db.transaction('notes', 'readwrite');
      const store = tx.objectStore('notes');
      const req = store.clear();
      tx.oncomplete = () => {
        this._addLog('db', '已清空 object store');
        this._loadNotes();
      };
      req.onerror = (e) => this._addLog('error', `清空失败：${e.target.error?.message}`);
    } catch (err) {
      this._addLog('error', `清空笔记异常：${err.message}`);
    }
  }

  // =================== 3. BroadcastChannel ===================
  _sendBc(text) {
    if (!this._bc) {
      this._addLog('error', 'BroadcastChannel 未就绪');
      return;
    }
    const msg = text || this.state.bcInput;
    if (!msg) return;
    // 演示发送 {from: timestamp, text: ...} 结构
    this._bc.postMessage({ from: Date.now(), text: msg });
    this._addLog('bc', `已广播：${msg}`);
    this.setState({ bcInput: '' });
  }

  // =================== 4. Performance API ===================
  _runPerfTest() {
    // 清除旧标记，避免重名
    try { performance.clearMarks(); performance.clearMeasures(); } catch { /* noop */ }

    // 用 performance.now() 测量一段耗时任务
    const t0 = performance.now();
    // 耗时任务：累加 + 素数判定
    let count = 0;
    for (let i = 2; i < 200000; i++) {
      let isPrime = true;
      const limit = Math.sqrt(i);
      for (let j = 2; j <= limit; j++) {
        if (i % j === 0) { isPrime = false; break; }
      }
      if (isPrime) count++;
    }
    const t1 = performance.now();
    const nowDuration = t1 - t0;

    // 用 mark + measure 计算区间耗时
    performance.mark('mark-start');
    let sum = 0;
    for (let i = 0; i < 500000; i++) sum += i;
    performance.mark('mark-end');
    performance.measure('累加耗时', 'mark-start', 'mark-end');

    // 收集所有 measure 条目
    const measures = performance.getEntriesByType('measure');
    const results = [
      { name: 'now() 素数循环', duration: nowDuration, count },
      ...measures.map((m) => ({ name: m.name, duration: m.duration, count: sum })),
    ];

    // performance.memory（Chrome only）
    if (performance.memory) {
      const mem = performance.memory;
      results.push({
        name: 'jsHeapSizeLimit',
        duration: (mem.jsHeapSizeLimit / 1048576).toFixed(1) + ' MB',
        count: 'heap limit',
      });
      results.push({
        name: 'usedJSHeapSize',
        duration: (mem.usedJSHeapSize / 1048576).toFixed(1) + ' MB',
        count: '已用堆',
      });
      this._addLog('perf', `performance.memory：已用 ${(mem.usedJSHeapSize / 1048576).toFixed(1)} MB / 上限 ${(mem.jsHeapSizeLimit / 1048576).toFixed(1)} MB`);
    } else {
      this._addLog('perf', 'performance.memory 不可用（仅 Chrome 支持）');
    }

    this._addLog('perf', `now() 测量耗时 ${nowDuration.toFixed(2)}ms，找到 ${count} 个素数`);
    this.setState({ perfResults: [...this.state.perfResults, ...results.map((r) => ({ ...r, time: formatTime() }))].slice(-20) });
  }

  // =================== 5. Web Crypto ===================
  async _computeHash() {
    try {
      const text = this.state.cryptoInput;
      const data = new TextEncoder().encode(text);
      // SHA-256 哈希
      const hashBuf = await crypto.subtle.digest('SHA-256', data);
      const hex = bufToHex(hashBuf);
      this.setState({ cryptoHash: hex });
      this._addLog('crypto', `SHA-256 哈希计算完成（${hex.length} 位十六进制）`);
    } catch (err) {
      this._addLog('error', `哈希计算失败：${err.message}`);
    }
  }

  async _runCrypto() {
    try {
      const text = this.state.cryptoInput;
      const encoder = new TextEncoder();
      const data = encoder.encode(text);

      // 生成 AES-GCM 密钥
      const key = await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt'],
      );

      // 生成随机 IV（12 字节）
      const iv = crypto.getRandomValues(new Uint8Array(12));

      // 加密
      const encryptedBuf = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        data,
      );
      const encryptedHex = bufToHex(encryptedBuf);

      // 解密
      const decryptedBuf = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        key,
        encryptedBuf,
      );
      const decrypted = new TextDecoder().decode(decryptedBuf);

      this.setState({
        cryptoEncrypted: encryptedHex,
        cryptoDecrypted: decrypted,
      });
      this._addLog('crypto', `AES-GCM 加解密完成，明文还原 ${decrypted === text ? '✓ 一致' : '✗ 不一致'}`);
    } catch (err) {
      this._addLog('error', `加解密失败：${err.message}`);
    }
  }

  _genRandom() {
    // 演示 crypto.getRandomValues 生成随机数
    const arr = crypto.getRandomValues(new Uint8Array(8));
    const hex = bufToHex(arr);
    this._addLog('crypto', `getRandomValues 生成 8 字节随机数：${hex}`);
  }

  // =================== 6. CompressionStream + TextEncoder ===================
  async _runCompress() {
    try {
      const text = this.state.compressInput;
      // TextEncoder 将字符串编码为 Uint8Array
      const encoder = new TextEncoder();
      const data = encoder.encode(text);
      const originalSize = data.byteLength;

      // 流式压缩：ReadableStream.pipeThrough(new CompressionStream('gzip'))
      const compressedStream = new ReadableStream({
        start(controller) {
          controller.enqueue(data);
          controller.close();
        },
      }).pipeThrough(new CompressionStream('gzip'));

      const reader = compressedStream.getReader();
      const chunks = [];
      let compressedSize = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        compressedSize += value.byteLength;
      }
      const compressed = new Uint8Array(compressedSize);
      let offset = 0;
      for (const chunk of chunks) {
        compressed.set(chunk, offset);
        offset += chunk.byteLength;
      }

      // 解压验证
      const decompressedStream = new ReadableStream({
        start(controller) {
          controller.enqueue(compressed);
          controller.close();
        },
      }).pipeThrough(new DecompressionStream('gzip'));

      const dReader = decompressedStream.getReader();
      const dChunks = [];
      while (true) {
        const { done, value } = await dReader.read();
        if (done) break;
        dChunks.push(value);
      }
      const decoder = new TextDecoder();
      let decompressed = '';
      for (const chunk of dChunks) decompressed += decoder.decode(chunk, { stream: true });
      decompressed += decoder.decode();

      const ratio = originalSize > 0 ? (compressedSize / originalSize * 100).toFixed(1) : '0';
      const ok = decompressed === text ? '✓ 一致' : '✗ 不一致';
      this.setState({
        compressResult: `原始 ${originalSize}B → 压缩 ${compressedSize}B（${ratio}%），解压还原：${ok}`,
      });
      this._addLog('compress', `gzip 压缩：${originalSize}B → ${compressedSize}B（${ratio}%），还原${ok}`);
    } catch (err) {
      this._addLog('error', `压缩失败：${err.message}`);
    }
  }

  // =================== 渲染 ===================
  renderPage() {
    // —— WebSocket 输入 ——
    const wsInput = new Input({
      value: this.state.wsInput, size: 'sm', style: { width: '220px' },
      placeholder: '输入要发送的消息',
      onPressEnter: () => this._sendWs(),
      onChange: (v) => this.state.wsInput = v,
    });
    this.registerChild(wsInput);

    // —— IndexedDB 笔记输入 ——
    const noteTitleInput = new Input({
      value: this.state.noteTitle, size: 'sm', style: { width: '160px' },
      placeholder: '笔记标题',
      onChange: (v) => this.state.noteTitle = v,
    });
    this.registerChild(noteTitleInput);

    const noteContentInput = new Input({
      value: this.state.noteContent, size: 'sm', multiline: true, rows: 2,
      placeholder: '笔记内容',
      onChange: (v) => this.state.noteContent = v,
    });
    this.registerChild(noteContentInput);

    // —— BroadcastChannel 输入 ——
    const bcInput = new Input({
      value: this.state.bcInput, size: 'sm', style: { width: '220px' },
      placeholder: '输入广播消息',
      onPressEnter: () => this._sendBc(),
      onChange: (v) => this.state.bcInput = v,
    });
    this.registerChild(bcInput);

    // —— Crypto 输入 ——
    const cryptoInput = new Input({
      value: this.state.cryptoInput, size: 'sm', style: { width: '320px' },
      onChange: (v) => this.state.cryptoInput = v,
    });
    this.registerChild(cryptoInput);

    // —— Compression 输入 ——
    const compressInput = new Input({
      value: this.state.compressInput, size: 'sm', multiline: true, rows: 2,
      onChange: (v) => this.state.compressInput = v,
    });
    this.registerChild(compressInput);

    return [
      h('h2', { class: 'section-title' }, '高级 Web API 实验室'),

      h(Alert, {
        type: 'info',
        message: 'WebSocket / IndexedDB / BroadcastChannel / Performance / SubtleCrypto / CompressionStream',
        description: '六大高级 Web API 综合演示。所有操作日志输出在页面底部日志面板，便于追踪事件流转。',
      }),

      // ============ 1. WebSocket ============
      h(Card, {
        title: '1. WebSocket（实时双向通信）',
        extra: h(Tag, { color: this.state.wsState === 'OPEN' ? 'success' : 'default' }, this.state.wsState),
      },
        h('div', { class: 'flex flex-col gap-sm' },
          h('p', { class: 'fs-sm text-secondary' },
            '连接公共 echo 服务器 wss://echo.websocket.events，发送消息会被原样回显。演示 onopen/onmessage/onerror/onclose 与 readyState（0/1/2/3）状态流转。'),
          h('div', { class: 'flex items-center gap-sm flex-wrap' },
            wsInput.render(),
            this._btn('连接', { type: 'primary', size: 'sm', onClick: () => this._connectWs() }),
            this._btn('发送', { type: 'primary', size: 'sm', onClick: () => this._sendWs() }),
            this._btn('关闭', { danger: true, size: 'sm', onClick: () => this._disconnectWs() }),
          ),
          h('div', { class: 'fs-sm text-tertiary' },
            `readyState 映射：0=CONNECTING  1=OPEN  2=CLOSING  3=CLOSED`,
          ),
          // 消息记录
          this.state.wsMessages.length === 0
            ? h('div', { class: 'fs-sm text-tertiary' }, '（暂无消息记录）')
            : h('div', { class: 'log-panel' },
              ...this.state.wsMessages.map((m) => h('div', { class: 'log-panel__line' },
                h('span', { class: 'log-panel__time' }, m.time),
                h('span', { class: `log-panel__tag log-panel__tag--${m.dir === 'out' ? 'push' : 'pop'}` }, m.dir === 'out' ? 'SEND' : 'RECV'),
                h('span', {}, m.text),
              )),
            ),
        ),
      ),

      // ============ 2. IndexedDB ============
      h(Card, {
        title: '2. IndexedDB（浏览器事务型数据库）',
        extra: h(Tag, { color: 'warning' }, `${this.state.notes.length} 条笔记`),
      },
        h('div', { class: 'flex flex-col gap-sm' },
          h('p', { class: 'fs-sm text-secondary' },
            '数据库 mdn-lab-db（v1），object store「notes」（keyPath: id，autoIncrement）。演示 onupgradeneeded/onsuccess/onerror/oncomplete 事件。'),
          h('div', { class: 'flex items-center gap-sm flex-wrap' },
            noteTitleInput.render(),
            this._btn('添加笔记', { type: 'primary', size: 'sm', onClick: () => this._addNote() }),
            this._btn('刷新列表', { size: 'sm', onClick: () => this._loadNotes() }),
            this._btn('清空 store', { danger: true, size: 'sm', onClick: () => this._clearNotes() }),
          ),
          noteContentInput.render(),
          // 笔记列表
          this.state.notes.length === 0
            ? h('div', { class: 'fs-sm text-tertiary' }, '（暂无笔记，添加一条试试）')
            : h('div', { class: 'flex flex-col gap-sm' },
              ...this.state.notes.map((note) => h('div', { class: 'flex items-center gap-sm' },
                h('span', { class: 'fs-sm text-secondary', style: { minWidth: '40px' } }, `#${note.id}`),
                h('div', { class: 'flex-1' },
                  h('div', { class: 'fw-medium fs-sm' }, note.title),
                  h('div', { class: 'fs-sm text-tertiary' }, note.content),
                ),
                h('span', { class: 'fs-sm text-tertiary' }, formatTime(new Date(note.createdAt))),
                h('button', {
                  type: 'button',
                  class: 'btn btn--sm btn--danger',
                  onClick: () => this._deleteNote(note.id),
                }, '×'),
              )),
            ),
        ),
      ),

      // ============ 3. BroadcastChannel ============
      h(Card, {
        title: '3. BroadcastChannel（跨标签页通信）',
        extra: h(Tag, { color: 'success' }, 'channel: mdn-lab-bc'),
      },
        h('div', { class: 'flex flex-col gap-sm' },
          h('p', { class: 'fs-sm text-secondary' },
            '创建名为 mdn-lab-bc 的广播频道，输入消息发送后，其他打开本页面的标签页会收到。消息结构：{ from: timestamp, text: ... }。'),
          h('div', { class: 'flex items-center gap-sm flex-wrap' },
            bcInput.render(),
            this._btn('广播消息', { type: 'primary', size: 'sm', onClick: () => this._sendBc() }),
          ),
          h('p', { class: 'fs-sm text-tertiary' },
            '提示：复制当前页面 URL 到新标签页打开，即可测试跨标签页消息收发。'),
        ),
      ),

      // ============ 4. Performance API ============
      h(Card, {
        title: '4. Performance API（性能监控）',
        extra: h(Tag, { color: 'primary' }, `${this.state.perfResults.length} 条测量`),
      },
        h('div', { class: 'flex flex-col gap-sm' },
          h('p', { class: 'fs-sm text-secondary' },
            '使用 performance.now() 测量耗时、mark() 打标记、measure() 计算区间、PerformanceObserver 监听 measure 条目。'),
          this._btn('运行性能测试', { type: 'primary', size: 'sm', onClick: () => this._runPerfTest() }),
          this.state.perfResults.length === 0
            ? h('div', { class: 'fs-sm text-tertiary' }, '（尚未运行测试）')
            : h('div', { class: 'flex flex-col gap-sm' },
              ...this.state.perfResults.map((r) => h('div', { class: 'api-metric' },
                h('span', { class: 'fs-sm text-secondary', style: { minWidth: '160px' } }, r.name),
                h('span', { class: 'fw-medium fs-sm' }, typeof r.duration === 'string' ? r.duration : `${r.duration.toFixed(2)}ms`),
                h('span', { class: 'fs-sm text-tertiary', style: { marginLeft: '12px' } }, String(r.count)),
              )),
            ),
        ),
      ),

      // ============ 5. Web Crypto ============
      h(Card, {
        title: '5. Web Crypto（SubtleCrypto 加密）',
        extra: h(Tag, { color: 'primary' }, 'SHA-256 / AES-GCM'),
      },
        h('div', { class: 'flex flex-col gap-sm' },
          h('p', { class: 'fs-sm text-secondary' },
            '演示 crypto.subtle.digest（SHA-256）、generateKey + encrypt/decrypt（AES-GCM）、getRandomValues。所有 subtle 方法返回 Promise。'),
          h('div', { class: 'flex items-center gap-sm flex-wrap' },
            cryptoInput.render(),
            this._btn('计算 SHA-256', { type: 'primary', size: 'sm', onClick: () => this._computeHash() }),
            this._btn('AES-GCM 加解密', { type: 'primary', size: 'sm', onClick: () => this._runCrypto() }),
            this._btn('生成随机数', { size: 'sm', onClick: () => this._genRandom() }),
          ),
          h('div', { class: 'fs-sm text-secondary' }, 'SHA-256 哈希：'),
          h('pre', { class: 'code-block' }, this.state.cryptoHash || '（点击「计算 SHA-256」）'),
          h('div', { class: 'fs-sm text-secondary mt-sm' }, 'AES-GCM 加密结果（十六进制）：'),
          h('pre', { class: 'code-block' }, this.state.cryptoEncrypted || '（点击「AES-GCM 加解密」）'),
          h('div', { class: 'fs-sm text-secondary mt-sm' }, `解密还原：${this.state.cryptoDecrypted || '—'}`),
        ),
      ),

      // ============ 6. CompressionStream + TextEncoder ============
      h(Card, {
        title: '6. CompressionStream + TextEncoder（编码与压缩）',
        extra: h(Tag, { color: 'warning' }, 'gzip'),
      },
        h('div', { class: 'flex flex-col gap-sm' },
          h('p', { class: 'fs-sm text-secondary' },
            'TextEncoder 将字符串编码为 Uint8Array，CompressionStream/DecompressionStream 进行 gzip 流式压缩/解压。'),
          compressInput.render(),
          this._btn('运行压缩测试', { type: 'primary', size: 'sm', onClick: () => this._runCompress() }),
          h('div', { class: 'fs-sm fw-medium' }, this.state.compressResult || '（点击「运行压缩测试」）'),
        ),
      ),

      // ============ 日志面板 ============
      h(Card, {
        title: '事件日志',
        extra: h(Tag, { color: 'primary' }, `${this.state.logs.length} 条`),
      },
        this.state.logs.length === 0
          ? h('div', { class: 'fs-sm text-tertiary' }, '（暂无日志）')
          : h('div', { class: 'log-panel' },
            ...this.state.logs.map((log) => h('div', { class: 'log-panel__line' },
              h('span', { class: 'log-panel__time' }, log.time),
              h('span', { class: `log-panel__tag log-panel__tag--${log.type}` }, log.type),
              h('span', {}, log.content),
            )),
          ),
      ),
    ];
  }
}
