// =====================================================================
// AdvancedStoragePage.js —— 高级存储与文件系统 API 实验室
// 演示 MDN：
//   1. OPFS —— navigator.storage.getDirectory()、getFileHandle / removeEntry、
//      createWritable → write / close、getFile().text()、createSyncAccessHandle（仅 Worker）。
//   2. Web Locks —— navigator.locks.request(name, {mode, ifAvailable, steal, signal} as any, cb)、
//      Lock {name, mode}、Promise settle 后释放、locks.query() → {held, pending}。
//   3. Storage Buckets + StorageManager —— storageBuckets.openOrCreate({quota, durability, persisted})、
//      bucket.getQuota / setQuota / delete、storage.estimate() / persist() / persisted()。
//   4. IndexedDB 深入 —— transaction(mode)、complete/error/abort、createObjectStore / createIndex、
//      openCursor / continue、IDBKeyRange.bound、onversionchange / onblocked（Promise 包装）。
//   5. Cache API + Cookie Store —— caches.open、put/match/keys/delete、response.clone()、
//      cookieStore.set/get/getAll/delete、CookieChangeEvent.changed/deleted。
// 说明：OPFS / Web Locks / Storage Buckets 在 jsdom 中不可用；所有调用前做能力检测，不可用时记日志。
// =====================================================================
import { Page } from '../../core/Component.js';
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';
import type { Props, State } from '../../core/types.js';

const IDB_DB_NAME = 'advanced-storage-demo';
const IDB_STORE = 'users';
const IDB_VERSION = 1;
const OPFS_FILE = 'opfs-demo.txt';
const LOCK_NAME = 'my-lock';
const CACHE_NAME = 'advanced-storage-cache-v1';
const COOKIE_NAME = 'adv-storage-cookie';

export interface AdvancedStoragePageProps extends Props {}

export interface AdvancedStoragePageState extends State {}

export class AdvancedStoragePage extends Page {
  declare props: AdvancedStoragePageProps;
  declare state: AdvancedStoragePageState;
  _activeLocks: any = null;
  _cookieChangeHandler: any = null;
  _idbDb: any = null;
  _inited: boolean = false;
  _locksAbort: any = null;
  initialState(): AdvancedStoragePageState {
    const hasNav = typeof navigator !== 'undefined';
    const hasStorage = hasNav && !!navigator.storage;
    return {
      logs: [],
      opfsSupported: hasStorage && typeof navigator.storage.getDirectory === 'function',
      locksSupported: hasNav && !!navigator.locks,
      bucketsSupported: hasNav && !!navigator.storageBuckets,
      storageManagerSupported: hasStorage && typeof navigator.storage.estimate === 'function',
      idbSupported: typeof indexedDB !== 'undefined',
      cacheSupported: typeof caches !== 'undefined',
      cookieStoreSupported:
        (typeof cookieStore !== 'undefined') ||
        (typeof window !== 'undefined' && !!window.cookieStore),
      // 运行时状态
      opfsContent: '',
      locksHeld: 0,
      locksPending: 0,
      estimate: null,
      persisted: null,
      idbUsers: [],
      idbCount: 0,
      cacheItems: [],
      cookieList: [],
      cookieEvents: 0,
    };
  }

  componentDidMount(): void {
    // ★★★ 关键守卫：必须存在！否则 setState => rerender => componentDidMount 死循环导致 OOM
    if (this._inited) return;
    this._inited = true;

    // 资源引用（componentWillUnmount 时清理）
    this._idbDb = null;                 // IDBDatabase 连接
    this._cookieChangeHandler = null;   // cookieStore change 监听器
    this._activeLocks = 0;              // 当前持有的锁 callback 计数
    this._locksAbort = null;            // 用于中止等待中的锁请求

    // 为等待中的 Web Locks 请求提供 AbortSignal（释放页面时中止）
    if (typeof AbortController !== 'undefined') {
      this._locksAbort = new AbortController();
    }

    const s = this.state;
    this._addLog('info', '页面已就绪，能力检测：' +
      `OPFS=${s.opfsSupported ? '✓' : '✗'}，` +
      `WebLocks=${s.locksSupported ? '✓' : '✗'}，` +
      `StorageBuckets=${s.bucketsSupported ? '✓' : '✗'}，` +
      `StorageManager=${s.storageManagerSupported ? '✓' : '✗'}，` +
      `IndexedDB=${s.idbSupported ? '✓' : '✗'}，` +
      `Cache=${s.cacheSupported ? '✓' : '✗'}，` +
      `CookieStore=${s.cookieStoreSupported ? '✓' : '✗'}`);

    // 注册 cookieStore change 监听（若可用）
    if (s.cookieStoreSupported) {
      try {
        const cs = this._cs();
        this._cookieChangeHandler = (e: any) => {
          const changed = (e.changed || []).map((c: any) => c.name);
          const deleted = (e.deleted || []).map((c: any) => c.name);
          this.setState((st: any) => ({ cookieEvents: st.cookieEvents + 1 }));
          this._addLog('pull',
            `CookieChangeEvent：changed=[${changed.join(',') || '空'}]，deleted=[${deleted.join(',') || '空'}]`);
        };
        cs.addEventListener('change', this._cookieChangeHandler);
        this._addLog('info', 'cookieStore "change" 监听已注册');
      } catch (err: any) {
        this._addLog('err', `cookieStore change 监听注册失败：${err.message}`);
      }
    }
  }

  componentWillUnmount(): void {
    // 1. 关闭 IndexedDB 连接（db.close）
    try {
      if (this._idbDb) {
        try { this._idbDb.close(); } catch { /* noop */ }
        this._idbDb = null;
      }
    } catch { /* noop */ }

    // 2. 释放 Web Locks：中止所有等待中的锁请求；
    //    已持有的锁在 callback 的 Promise settle 后自动释放（无法强制释放 exclusive 锁）。
    try {
      if (this._locksAbort) {
        try { this._locksAbort.abort(); } catch { /* noop */ }
        this._locksAbort = null;
      }
    } catch { /* noop */ }

    // 3. 移除 cookieStore change 监听
    try {
      if (this._cookieChangeHandler) {
        const cs = this._cs();
        if (cs) cs.removeEventListener('change', this._cookieChangeHandler);
        this._cookieChangeHandler = null;
      }
    } catch { /* noop */ }
  }

  _addLog(type: any, content: any) {
    this.setState({ logs: [...this.state.logs, { type, content, time: formatTime() }].slice(-40) });
  }

  _btn(label: any, opts: any) {
    const btn = new Button({ ...opts, children: label, onClick: opts.onClick });
    this.registerChild(btn);
    return btn.render();
  }

  _renderLogPanel() {
    const s = this.state;
    return h('div', { class: 'log-panel' },
      h('div', { class: 'log-panel__header' }, '事件日志'),
      s.logs.length === 0
        ? h('div', { class: 'log-panel__empty' }, '（暂无日志）')
        : s.logs.map((log: any) => h('div', { class: 'log-panel__line' },
            h('span', { class: 'log-panel__time' }, log.time),
            h('span', { class: `log-panel__tag log-panel__tag--${log.type}` }, log.type),
            h('span', { class: 'log-panel__content' }, log.content),
          )),
    );
  }

  // =================== Card 1：Origin Private File System (OPFS) ===================

  async _opfsDemo() {
    if (!this.state.opfsSupported) { this._addLog('err', 'OPFS 不可用（navigator.storage.getDirectory 缺失）'); return; }
    try {
      // 获取 OPFS 根目录（对用户不可见、性能高）
      const root = await navigator.storage.getDirectory();
      this._addLog('push', 'navigator.storage.getDirectory() → OPFS 根目录已获取');

      // 创建文件句柄（create:true 表示不存在则创建）
      const fileHandle = await (root as any).getFileHandle(OPFS_FILE, { create: true });
      this._addLog('push', `getFileHandle('${OPFS_FILE}', {create:true}) → 文件句柄已获取`);

      // 异步写入：createWritable → write → close（主线程用异步接口）
      const writable = await fileHandle.createWritable();
      const content =
        `OPFS demo @ ${formatTime()}\n` +
        `随机数: ${Math.random().toString(36).slice(2, 10)}\n` +
        `写入字节数: ${Math.floor(Math.random() * 1000)}`;
      await writable.write(content);
      await writable.close();
      this._addLog('push', `createWritable().write(${content.length} 字节).close() 完成`);

      // 读取验证：getFile().text()
      const file = await fileHandle.getFile();
      const text = await file.text();
      this.setState({ opfsContent: text });
      this._addLog('pull', `getFile().text() 读取成功（${text.length} 字节）`);

      // 删除文件
      await (root as any).removeEntry(OPFS_FILE);
      this._addLog('info', `removeEntry('${OPFS_FILE}') 已删除`);

      this._addLog('info',
        'OPFS 对用户不可见；Worker 内 createSyncAccessHandle 同步读写性能远超 File System Access API，主线程用 createWritable 异步写入');
    } catch (err: any) {
      this._addLog('err', `OPFS 演示失败：${err.message}`);
    }
  }

  _renderOPFSCard() {
    const s = this.state;
    return h(Card, {
      title: 'Card 1 · Origin Private File System (OPFS)',
      extra: h(Tag, { color: s.opfsSupported ? 'primary' : 'error' },
        s.opfsSupported ? '实验性' : '不可用'),
    },
      h('p', { class: 'fs-sm text-secondary' },
        'navigator.storage.getDirectory() 返回 OPFS 根目录（对用户不可见、性能高）。' +
        'getFileHandle/createWritable/getFile().text()/removeEntry 全流程；Worker 内可用 createSyncAccessHandle 同步访问。'),
      h('div', { class: 'flex items-center gap-sm flex-wrap mt-md' },
        this._btn('运行 OPFS 完整演示', { type: 'primary', size: 'sm', onClick: () => this._opfsDemo(), disabled: !s.opfsSupported }),
        s.opfsContent
          ? h(Tag, { color: 'success' }, `已读 ${s.opfsContent.length} 字节`)
          : h(Tag, { color: 'default' }, '未读取'),
      ),
      s.opfsContent
        ? h('pre', { class: 'code-block mt-md' }, s.opfsContent)
        : null,
      h('pre', { class: 'code-block mt-md' },
`const root = await navigator.storage.getDirectory();
const fh = await (root as any).getFileHandle('demo.txt', { create: true });
const w = await fh.createWritable();
await w.write('hello OPFS'); await w.close();
await (await fh.getFile()).text();     // 读取
await (root as any).removeEntry('demo.txt');    // 删除
// Worker 同步：const sh = await fh.createSyncAccessHandle();`),
    );
  }

  // =================== Card 2：Web Locks API ===================

  _locksQuery() {
    if (!this.state.locksSupported) { this._addLog('err', 'navigator.locks 不可用'); return; }
    navigator.locks.query().then((snapshot: any) => {
      const held = (snapshot.held || []).map((l: any) => `${l.name}(${l.mode})`);
      const pending = (snapshot.pending || []).map((l: any) => `${l.name}(${l.mode})`);
      this.setState({ locksHeld: held.length, locksPending: pending.length });
      this._addLog('pull',
        `query() → held=[${held.join(',') || '空'}]，` +
        `pending=[${pending.join(',') || '空'}]`);
    }).catch((err: any) => {
      this._addLog('err', `locks.query 失败：${err.message}`);
    });
  }

  _locksExclusiveHold() {
    if (!this.state.locksSupported) { this._addLog('err', 'navigator.locks 不可用'); return; }
    this._activeLocks++;
    const start = Date.now();
    const opts: any = { mode: 'exclusive' };
    if (this._locksAbort) (opts as any).signal = this._locksAbort.signal;
    navigator.locks.request(LOCK_NAME, opts, async (lock: any) => {
      if (!lock) {
        this._activeLocks--;
        this._addLog('warn', 'exclusive 锁 callback 收到 null（未获取到，可能被中止）');
        return;
      }
      this._addLog('push',
        `持有 exclusive 锁 → name=${lock.name}, mode=${lock.mode}，将保持 3 秒`);
      // 同时发起第二个相同 name 的请求，展示它等待
      setTimeout(() => this._locksExclusiveWait(), 200);
      await new Promise((r: any) => setTimeout(r, 3000));
      const dur = ((Date.now() - start) / 1000).toFixed(2);
      this._addLog('info', `exclusive 锁释放（持有 ${dur}s）`);
      this._activeLocks--;
      this._locksQuery();
    }).catch((err: any) => {
      this._activeLocks--;
      this._addLog('err', `locks.request(exclusive) 失败：${err.name || err.message}`);
    });
  }

  _locksExclusiveWait() {
    if (!this.state.locksSupported) return;
    this._activeLocks++;
    const start = Date.now();
    const opts: any = { mode: 'exclusive' };
    if (this._locksAbort) (opts as any).signal = this._locksAbort.signal;
    navigator.locks.request(LOCK_NAME, opts, async (lock: any) => {
      if (!lock) { this._activeLocks--; return; }
      const waited = ((Date.now() - start) / 1000).toFixed(2);
      this._addLog('pull',
        `第二个 exclusive 请求终于获取到锁（等待 ${waited}s），name=${lock.name}`);
      await new Promise((r: any) => setTimeout(r, 500));
      this._addLog('info', '第二个 exclusive 锁释放');
      this._activeLocks--;
    }).catch((err: any) => {
      this._activeLocks--;
      this._addLog('err', `第二个 locks.request 失败：${err.name || err.message}`);
    });
  }

  _locksSharedMultiple() {
    if (!this.state.locksSupported) { this._addLog('err', 'navigator.locks 不可用'); return; }
    const sharedName = LOCK_NAME + '-shared';
    let acquired = 0;
    // 同时发起 3 个 shared 锁请求，应能同时持有
    for (let i = 1; i <= 3; i++) {
      const idx = i;
      this._activeLocks++;
      const opts: any = { mode: 'shared' };
      if (this._locksAbort) (opts as any).signal = this._locksAbort.signal;
      navigator.locks.request(sharedName, opts, async (lock: any) => {
        if (!lock) { this._activeLocks--; return; }
        acquired++;
        this._addLog('push',
          `shared 锁#${idx} 获取成功 → name=${lock.name}, mode=${lock.mode}（同时持有 ${acquired} 个）`);
        await new Promise((r: any) => setTimeout(r, 2000));
        this._addLog('info', `shared 锁#${idx} 释放`);
        this._activeLocks--;
      }).catch(() => { this._activeLocks--; });
    }
    this._addLog('info', `已发起 3 个 shared 模式锁请求（name=${sharedName}），应可同时持有`);
  }

  _locksIfAvailable() {
    if (!this.state.locksSupported) { this._addLog('err', 'navigator.locks 不可用'); return; }
    this._activeLocks++;
    navigator.locks.request(LOCK_NAME + '-ifavail',
      { mode: 'exclusive', ifAvailable: true },
      async (lock: any) => {
        if (!lock) {
          this._activeLocks--;
          this._addLog('pull', 'ifAvailable:true → 锁被占用，callback 收到 null（未等待）');
          return;
        }
        this._addLog('push', 'ifAvailable:true → 立即获取到锁，未等待');
        await new Promise((r: any) => setTimeout(r, 500));
        this._addLog('info', 'ifAvailable 锁释放');
        this._activeLocks--;
      },
    ).catch((err: any) => {
      this._activeLocks--;
      this._addLog('err', `ifAvailable locks.request 失败：${err.message}`);
    });
  }

  _renderLocksCard() {
    const s = this.state;
    return h(Card, {
      title: 'Card 2 · Web Locks API',
      extra: h(Tag, { color: s.locksSupported ? 'success' : 'error' },
        s.locksSupported ? '稳定' : '不可用'),
    },
      h('p', { class: 'fs-sm text-secondary' },
        'navigator.locks.request(name, {mode, ifAvailable, steal, signal} as any, cb) 协调同源跨标签页锁。' +
        'exclusive 互斥/shared 可并发；callback Promise settle 后自动释放；locks.query() 返回 {held, pending}。'),
      h('div', { class: 'flex items-center gap-sm flex-wrap mt-md' },
        this._btn('持有 exclusive 锁 3s', { type: 'primary', size: 'sm', onClick: () => this._locksExclusiveHold(), disabled: !s.locksSupported }),
        this._btn('查询 locks.query()', { size: 'sm', onClick: () => this._locksQuery(), disabled: !s.locksSupported }),
        this._btn('发起 3 个 shared 锁', { size: 'sm', onClick: () => this._locksSharedMultiple(), disabled: !s.locksSupported }),
        this._btn('ifAvailable 演示', { size: 'sm', onClick: () => this._locksIfAvailable(), disabled: !s.locksSupported }),
        h(Tag, { color: 'primary' }, `held: ${s.locksHeld}`),
        h(Tag, { color: 'warning' }, `pending: ${s.locksPending}`),
      ),
      h('pre', { class: 'code-block mt-md' },
`await navigator.locks.request('my-lock', { mode: 'exclusive' } as any, async (lock) => {
  // lock.name / lock.mode；Promise settle 后释放
  await doWork();
});
const snap = await navigator.locks.query();
// snap.held: [{name, clientId, mode}]；snap.pending: [...]`),
    );
  }

  // =================== Card 3：Storage Buckets API + StorageManager ===================

  async _bucketsDemo() {
    if (!this.state.bucketsSupported) { this._addLog('err', 'navigator.storageBuckets 不可用（ES2024/新，仅较新 Chromium）'); return; }
    try {
      // openOrCreate：不存在则创建
      const bucket = await navigator.storageBuckets.openOrCreate('demo-bucket', {
        quota: 1024 * 1024 * 10,     // 10 MB
        durability: 'strict',        // 'strict' | 'relaxed'
        persisted: false,
      });
      this._addLog('push',
        "storageBuckets.openOrCreate('demo-bucket', {quota:10MB, durability:'strict'}) → 已创建/打开");

      // 查询 quota
      if (typeof bucket.getQuota === 'function') {
        try {
          const quota = await bucket.getQuota();
          this._addLog('pull', `bucket.getQuota() → ${quota} 字节`);
        } catch (e: any) {
          this._addLog('warn', `bucket.getQuota 失败：${e.message}`);
        }
      }

      // 设置 quota
      if (typeof bucket.setQuota === 'function') {
        try {
          await bucket.setQuota(1024 * 1024 * 20);
          this._addLog('info', 'bucket.setQuota(20MB) 已调用');
        } catch (e: any) {
          this._addLog('warn', `bucket.setQuota 失败：${e.message}`);
        }
      }

      // 删除 bucket
      if (typeof bucket.delete === 'function') {
        try {
          await bucket.delete();
          this._addLog('info', 'bucket.delete() 已删除');
        } catch (e: any) {
          this._addLog('warn', `bucket.delete 失败：${e.message}`);
        }
      }
      this._addLog('info',
        '提示：IndexedDB / Cache / Service Worker 可绑定到特定 bucket（通过 bucket 目录隔离）');
    } catch (err: any) {
      this._addLog('err', `Storage Buckets 演示失败：${err.message}`);
    }
  }

  async _estimateDemo() {
    if (!this.state.storageManagerSupported) { this._addLog('err', 'navigator.storage.estimate 不可用'); return; }
    try {
      const est = await navigator.storage.estimate();
      this.setState({ estimate: est });
      const quotaMB = est.quota ? (est.quota / 1048576).toFixed(2) : '?';
      const usageMB = est.usage ? (est.usage / 1048576).toFixed(2) : '?';
      const details = est.usageDetails
        ? (Object as any).entries(est.usageDetails)
            .map(([k, v]: any) => `${k}:${(v / 1048576).toFixed(2)}MB`).join(', ')
        : '(无 usageDetails)';
      this._addLog('pull',
        `estimate() → quota=${quotaMB}MB, usage=${usageMB}MB, usageDetails={${details}}`);
    } catch (err: any) {
      this._addLog('err', `estimate 失败：${err.message}`);
    }
  }

  async _persistQuery() {
    if (!this.state.storageManagerSupported || typeof navigator.storage.persisted !== 'function') { this._addLog('err', 'navigator.storage.persisted 不可用'); return; }
    try {
      const persisted = await navigator.storage.persisted();
      this.setState({ persisted });
      this._addLog('pull', `persisted() → ${persisted ? '已持久化' : '未持久化'}`);
    } catch (err: any) {
      this._addLog('err', `persisted 查询失败：${err.message}`);
    }
  }

  async _persistRequest() {
    if (!this.state.storageManagerSupported || typeof navigator.storage.persist !== 'function') { this._addLog('err', 'navigator.storage.persist 不可用'); return; }
    try {
      const ok = await navigator.storage.persist();
      this.setState({ persisted: ok });
      this._addLog(ok ? 'push' : 'warn',
        `persist() → ${ok ? '请求被批准，已持久化' : '请求被拒绝（需用户授权或站点被频繁使用）'}`);
    } catch (err: any) {
      this._addLog('err', `persist 请求失败：${err.message}`);
    }
  }

  _renderBucketsCard() {
    const s = this.state;
    const est = s.estimate || {};
    const quotaMB = est.quota ? (est.quota / 1048576).toFixed(2) : '—';
    const usageMB = est.usage ? (est.usage / 1048576).toFixed(2) : '—';
    return h(Card, {
      title: 'Card 3 · Storage Buckets API + StorageManager',
      extra: h(Tag, { color: s.bucketsSupported ? 'primary' : 'error' },
        s.bucketsSupported ? '实验性' : '不可用'),
    },
      h('p', { class: 'fs-sm text-secondary' },
        'storageBuckets.openOrCreate({quota, durability, persisted}) 创建独立存储桶；bucket.getQuota/setQuota/delete 管理配额。' +
        'storage.estimate() 返回 {quota, usage, usageDetails}；persist()/persisted() 请求/查询持久化。'),
      h('div', { class: 'flex items-center gap-sm flex-wrap mt-md' },
        this._btn('创建/删除 bucket', { type: 'primary', size: 'sm', onClick: () => this._bucketsDemo(), disabled: !s.bucketsSupported }),
        this._btn('storage.estimate()', { size: 'sm', onClick: () => this._estimateDemo(), disabled: !s.storageManagerSupported }),
        this._btn('查询 persisted()', { size: 'sm', onClick: () => this._persistQuery(), disabled: !s.storageManagerSupported }),
        this._btn('请求 persist()', { size: 'sm', onClick: () => this._persistRequest(), disabled: !s.storageManagerSupported }),
      ),
      h('div', { class: 'flex items-center gap-sm flex-wrap mt-md' },
        h(Tag, { color: 'primary' }, `quota: ${quotaMB} MB`),
        h(Tag, { color: 'success' }, `usage: ${usageMB} MB`),
        s.persisted !== null
          ? h(Tag, { color: s.persisted ? 'success' : 'warning' },
              `persisted: ${s.persisted ? '是' : '否'}`)
          : null,
      ),
      h('pre', { class: 'code-block mt-md' },
`const bucket = await navigator.storageBuckets.openOrCreate('logs', {
  quota: 10*1024*1024, durability: 'strict', persisted: true,
});
await bucket.setQuota(20*1024*1024);
const { quota, usage, usageDetails } = await navigator.storage.estimate();
const ok = await navigator.storage.persist();  // 请求持久化`),
    );
  }

  // =================== Card 4：IndexedDB 深入 — 游标、索引、事务 ===================

  _idbOpen(version: any) {
    return new Promise((resolve: any, reject: any) => {
      const req = indexedDB.open(IDB_DB_NAME, version);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          const store = db.createObjectStore(IDB_STORE, {
            keyPath: 'id', autoIncrement: true,
          });
          store.createIndex('byEmail', 'email', { unique: true });
          store.createIndex('byAge', 'age', { unique: false });
          this._addLog('push',
            `onupgradeneeded：createObjectStore('${IDB_STORE}', {keyPath:'id', autoIncrement:true})` +
            ` + createIndex('byEmail',{unique:true}) + createIndex('byAge')`);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
      req.onblocked = () =>
        this._addLog('warn', 'IDB open 被阻塞（onblocked），可能有旧连接未关闭');
    });
  }

  _idbReq(req: any) {
    return new Promise((resolve: any, reject: any) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async _idbSetup() {
    if (!this.state.idbSupported) { this._addLog('err', 'indexedDB 不可用'); return; }
    try {
      // 关闭旧连接
      if (this._idbDb) {
        try { this._idbDb.close(); } catch { /* noop */ }
        this._idbDb = null;
      }
      // 删除旧库以重新演示（versionchange 事务）
      try {
        await new Promise((r: any) => {
          const dreq = indexedDB.deleteDatabase(IDB_DB_NAME);
          dreq.onsuccess = () => r();
          dreq.onerror = () => r();
          dreq.onblocked = () => r();
        });
      } catch { /* noop */ }

      const db = await this._idbOpen(IDB_VERSION);
      this._idbDb = db;
      (db as any).onversionchange = () => {
        this._addLog('warn', 'onversionchange：其他标签页正在升级数据库，本连接将关闭');
        try { (db as any).close(); } catch { /* noop */ }
        this._idbDb = null;
      };
      this._addLog('push',
        `数据库 '${IDB_DB_NAME}' v${IDB_VERSION} 已打开，含仓库 '${IDB_STORE}'`);

      // 插入 5 条用户数据（name/email/age）
      const users = [
        { name: 'Alice', email: 'alice@demo.dev', age: 22 },
        { name: 'Bob', email: 'bob@demo.dev', age: 28 },
        { name: 'Carol', email: 'carol@demo.dev', age: 35 },
        { name: 'Dave', email: 'dave@demo.dev', age: 19 },
        { name: 'Eve', email: 'eve@demo.dev', age: 41 },
      ];
      await this._idbInsertUsers(users);
    } catch (err: any) {
      this._addLog('err', `IDB 初始化失败：${err.message}`);
    }
  }

  // readwrite 事务插入多条，演示 oncomplete / onerror / onabort
  _idbInsertUsers(users: any) {
    return new Promise((resolve: any, reject: any) => {
      if (!this._idbDb) { reject(new Error('数据库未打开')); return; }
      const tx = this._idbDb.transaction(IDB_STORE, 'readwrite');
      const store = tx.objectStore(IDB_STORE);
      for (const u of users) store.add(u);
      tx.oncomplete = () => {
        this._addLog('push', `事务 oncomplete：已插入 ${users.length} 条用户`);
        resolve();
      };
      tx.onerror = () => {
        this._addLog('err', `事务 onerror：${tx.error?.message || '未知错误'}`);
        reject(tx.error);
      };
      tx.onabort = () => {
        this._addLog('warn', '事务 onabort（已回滚）');
        reject(new Error('transaction aborted'));
      };
    });
  }

  // 游标遍历所有用户（readonly 事务），正确处理 cursor 为 null
  async _idbCursorAll() {
    if (!this._idbDb) { this._addLog('warn', '请先点击「初始化数据库」'); return; }
    try {
      const tx = this._idbDb.transaction(IDB_STORE, 'readonly');
      const store = tx.objectStore(IDB_STORE);
      const result: any[] = [];
      await new Promise((resolve: any, reject: any) => {
        const req = store.openCursor();
        req.onsuccess = (e: any) => {
          const cursor = e.target.result;
          if (!cursor) { resolve(); return; }   // ★ cursor 为 null 表示遍历结束
          result.push(cursor.value);
          cursor.continue();
        };
        req.onerror = () => reject(req.error);
      });
      this.setState({ idbUsers: result, idbCount: result.length });
      this._addLog('pull',
        `游标遍历完成 → ${result.length} 条：` +
        `[${result.map((u) => `#${u.id}:${u.name}`).join(', ')}]`);
    } catch (err: any) {
      this._addLog('err', `游标遍历失败：${err.message}`);
    }
  }

  async _idbIndexGetByEmail() {
    if (!this._idbDb) { this._addLog('warn', '请先点击「初始化数据库」'); return; }
    try {
      const tx = this._idbDb.transaction(IDB_STORE, 'readonly');
      const idx = tx.objectStore(IDB_STORE).index('byEmail');
      const user = await this._idbReq(idx.get('bob@demo.dev'));
      if (!user) {
        this._addLog('warn', "index('byEmail').get('bob@demo.dev') → 未找到");
      } else {
        this._addLog('pull',
          `index('byEmail').get('bob@demo.dev') → #${(user as any).id} ${(user as any).name}, age=${(user as any).age}`);
      }
    } catch (err: any) {
      this._addLog('err', `索引查询失败：${err.message}`);
    }
  }

  // IDBKeyRange.bound(20, 30) 查询 age 在 20-30 之间的用户（通过 byAge 索引）
  async _idbKeyRangeAge() {
    if (!this._idbDb) { this._addLog('warn', '请先点击「初始化数据库」'); return; }
    try {
      const tx = this._idbDb.transaction(IDB_STORE, 'readonly');
      const idx = tx.objectStore(IDB_STORE).index('byAge');
      const range = IDBKeyRange.bound(20, 30);   // 20 ≤ age ≤ 30
      const result = await this._idbReq(idx.getAll(range));
      this._addLog('pull',
        `index('byAge').getAll(IDBKeyRange.bound(20,30)) → ${(result as any).length} 条：` +
        `[${(result as any).map((u: any) => `${u.name}(${u.age})`).join(', ')}]`);
    } catch (err: any) {
      this._addLog('err', `IDBKeyRange 查询失败：${err.message}`);
    }
  }

  _renderIndexedDBCard() {
    const s = this.state;
    return h(Card, {
      title: 'Card 4 · IndexedDB 深入 — 游标、索引、事务',
      extra: h(Tag, { color: s.idbSupported ? 'success' : 'error' },
        s.idbSupported ? '稳定' : '不可用'),
    },
      h('p', { class: 'fs-sm text-secondary' },
        '事务 readonly/readwrite/versionchange；createObjectStore({keyPath, autoIncrement})；createIndex({unique, multiEntry})；' +
        '游标 openCursor/continue（null 即结束）；IDBKeyRange.only/lowerBound/upperBound/bound 范围查询（Promise 包装）。'),
      h('div', { class: 'flex items-center gap-sm flex-wrap mt-md' },
        this._btn('初始化数据库 + 插 5 条', { type: 'primary', size: 'sm', onClick: () => this._idbSetup(), disabled: !s.idbSupported }),
        this._btn('游标遍历全部', { size: 'sm', onClick: () => this._idbCursorAll(), disabled: !s.idbSupported }),
        this._btn('索引 byEmail 查 Bob', { size: 'sm', onClick: () => this._idbIndexGetByEmail(), disabled: !s.idbSupported }),
        this._btn('IDBKeyRange age 20-30', { size: 'sm', onClick: () => this._idbKeyRangeAge(), disabled: !s.idbSupported }),
        h(Tag, { color: 'primary' }, `users: ${s.idbCount}`),
      ),
      s.idbUsers.length > 0
        ? h('div', { class: 'mt-md fs-sm text-secondary', style: { maxHeight: '120px', overflow: 'auto' } },
            ...s.idbUsers.map((u: any) =>
              h('div', {}, `#${u.id}  ${u.name}  <${u.email}>  age=${u.age}`)),
          )
        : null,
      h('pre', { class: 'code-block mt-md' },
`const store = db.createObjectStore('users', { keyPath: 'id', autoIncrement: true });
store.createIndex('byEmail', 'email', { unique: true });
store.createIndex('byAge', 'age');
// 游标遍历（null 即结束）
const req = store.openCursor();
req.onsuccess = (e) => { const c = e.target.result; if (!c) return; c.continue(); };
// 索引 + 范围：IDBKeyRange.bound(20, 30)
const list = await req(store.index('byAge').getAll(range));
// 事务事件：tx.oncomplete / onerror / onabort`),
    );
  }

  // =================== Card 5：Cache API 高级 + Cookie Store 深入 ===================

  async _cacheDemo() {
    if (!this.state.cacheSupported) { this._addLog('err', 'caches API 不可用'); return; }
    try {
      const cache = await caches.open(CACHE_NAME);
      this._addLog('push', `caches.open('${CACHE_NAME}') → Cache 对象已获取`);

      // put：自定义 request/response（response 是 stream，需 clone 后再 put）
      const key = new Request('https://demo.local/advanced-storage-' + Date.now());
      const resp = new Response(
        JSON.stringify({ hello: 'cache', t: Date.now() }),
        { headers: { 'Content-Type': 'application/json' } },
      );
      await cache.put(key, resp.clone());   // ★ clone 因 stream 只能读一次
      this._addLog('push', 'cache.put(request, response.clone()) 已写入');

      // match 验证（options: ignoreSearch/ignoreMethod/ignoreVary 可选）
      const matched = await cache.match(key);
      if (matched) {
        const text = await matched.text();
        this._addLog('pull', `cache.match → 命中，body=${text}`);
      } else {
        this._addLog('warn', 'cache.match → 未命中');
      }

      // keys 列出所有 Request
      const keys = await (cache as any).keys();
      this.setState({ cacheItems: keys.map((r: any) => r.url) });
      this._addLog('pull', `(cache as any).keys() → ${keys.length} 条 Request`);

      // delete 清理
      await cache.delete(key);
      this._addLog('info', 'cache.delete(request) 已删除该条');
      const keys2 = await (cache as any).keys();
      this.setState({ cacheItems: keys2.map((r: any) => r.url) });
      this._addLog('info', `删除后 (cache as any).keys() → ${keys2.length} 条`);
    } catch (err: any) {
      this._addLog('err', `Cache 演示失败：${err.message}`);
    }
  }

  // 获取 cookieStore 引用（统一兜底）
  _cs() {
    return (typeof window !== 'undefined' && window.cookieStore) || cookieStore;
  }

  async _cookieSet() {
    if (!this.state.cookieStoreSupported) {
      this._addLog('err', 'cookieStore 不可用（需 HTTPS/localhost 安全上下文）');
      return;
    }
    try {
      const value = 'val-' + Math.random().toString(36).slice(2, 8);
      await this._cs().set(({
        name: COOKIE_NAME, value, path: '/',
        sameSite: 'lax', secure: true,
        expires: new Date((Date.now() + 5 * 60 * 1000 as any)),
      } as any));
      this._addLog('push',
        `cookieStore.set({name:'${COOKIE_NAME}', value:'${value}', sameSite:'lax', secure:true, expires:+5min})`);
    } catch (err: any) {
      this._addLog('err', `cookieStore.set 失败：${err.message}`);
    }
  }

  async _cookieGet() {
    if (!this.state.cookieStoreSupported) {
      this._addLog('err', 'cookieStore 不可用'); return;
    }
    try {
      const c = await this._cs().get(COOKIE_NAME);
      if (!c) {
        this._addLog('warn', `cookieStore.get('${COOKIE_NAME}') → 未找到`);
      } else {
        this._addLog('pull',
          `cookieStore.get → name=${c.name}, value=${c.value}, domain=${c.domain}, path=${c.path}`);
      }
    } catch (err: any) {
      this._addLog('err', `cookieStore.get 失败：${err.message}`);
    }
  }

  async _cookieGetAll() {
    if (!this.state.cookieStoreSupported) {
      this._addLog('err', 'cookieStore 不可用'); return;
    }
    try {
      const all = await this._cs().getAll();
      this.setState({ cookieList: all });
      this._addLog('pull',
        `cookieStore.getAll() → ${all.length} 条：[${all.map((c) => c.name).join(', ') || '空'}]`);
    } catch (err: any) {
      this._addLog('err', `cookieStore.getAll 失败：${err.message}`);
    }
  }

  async _cookieDelete() {
    if (!this.state.cookieStoreSupported) {
      this._addLog('err', 'cookieStore 不可用'); return;
    }
    try {
      await this._cs().delete(COOKIE_NAME);
      this._addLog('info', `cookieStore.delete('${COOKIE_NAME}') 已调用（change 事件将随后触发）`);
    } catch (err: any) {
      this._addLog('err', `cookieStore.delete 失败：${err.message}`);
    }
  }

  _renderCacheCookieCard() {
    const s = this.state;
    const bothOk = s.cacheSupported && s.cookieStoreSupported;
    return h(Card, {
      title: 'Card 5 · Cache API 高级 + Cookie Store 深入',
      extra: h(Tag, { color: bothOk ? 'success' : 'warning' },
        bothOk ? '稳定' : '部分可用'),
    },
      h('p', { class: 'fs-sm text-secondary' },
        'Cache：caches.open、put/add/addAll、match/matchAll/keys/delete（ignoreSearch/ignoreMethod/ignoreVary）；response.clone()（stream 只能读一次）。' +
        'Cookie Store：set/get/getAll/delete + change 事件（CookieChangeEvent.changed/deleted）。'),
      h('div', { class: 'mt-md' },
        h('div', { class: 'fs-sm fw-medium mb-xs' }, 'Cache API'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('put/match/keys/delete', { type: 'primary', size: 'sm', onClick: () => this._cacheDemo(), disabled: !s.cacheSupported }),
          h(Tag, { color: 'default' }, `cache 条目: ${s.cacheItems.length}`),
        ),
      ),
      h('div', { class: 'mt-md' },
        h('div', { class: 'fs-sm fw-medium mb-xs' }, 'Cookie Store API'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('set cookie', { type: 'primary', size: 'sm', onClick: () => this._cookieSet(), disabled: !s.cookieStoreSupported }),
          this._btn('get', { size: 'sm', onClick: () => this._cookieGet(), disabled: !s.cookieStoreSupported }),
          this._btn('getAll', { size: 'sm', onClick: () => this._cookieGetAll(), disabled: !s.cookieStoreSupported }),
          this._btn('delete', { size: 'sm', danger: true, onClick: () => this._cookieDelete(), disabled: !s.cookieStoreSupported }),
          h(Tag, { color: 'primary' }, `change 事件: ${s.cookieEvents}`),
        ),
      ),
      s.cookieList.length > 0
        ? h('div', { class: 'fs-sm text-tertiary mt-md' },
            `当前 cookie：${s.cookieList.map((c: any) => `${c.name}=${c.value}`).join('; ') || '(空)'}`)
        : null,
      h('pre', { class: 'code-block mt-md' },
`const cache = await caches.open('v1');
await cache.put(req, resp.clone());   // ★ clone（stream 只能读一次）
const r = await cache.match(req, { ignoreSearch: true });
await cache.delete(req, { ignoreMethod: true });
const keys = await (cache as any).keys();
await cookieStore.set({ name, value, sameSite: 'lax', secure: true });
cookieStore.addEventListener('change', (e: any) => { e.changed; e.deleted; });`),
    );
  }

  // =================== 整页渲染 ===================

  renderPage(): Node | string | (Node | string)[] {
    return [
      h('h2', { class: 'section-title' }, '高级存储与文件系统 API 实验室'),

      h(Alert, {
        type: 'info',
        message: 'OPFS · Web Locks · Storage Buckets · StorageManager · IndexedDB · Cache API · Cookie Store',
        description: '本页演示浏览器「高级持久化与协调」相关 API。OPFS/Web Locks/Storage Buckets 在 jsdom 中不可用，IndexedDB 部分支持；所有调用前都会做能力检测，不可用时记日志说明。',
      }),

      h('div', { class: 'grid grid-2 gap-md' },
        this._renderOPFSCard(),
        this._renderLocksCard(),
      ),
      h('div', { class: 'grid grid-2 gap-md mt-md' },
        this._renderBucketsCard(),
        this._renderIndexedDBCard(),
      ),
      h('div', { class: 'mt-md' }, this._renderCacheCookieCard()),

      h(Alert, {
        type: 'warning',
        message: '兼容性提示',
        description: 'OPFS：Chromium 102+/Firefox 111+/Safari 15.2+；Web Locks：Chromium 69+/Firefox 96+/Safari 15.4+；Storage Buckets API：仅 Chromium 123+（实验性）；StorageManager.estimate/persist：现代浏览器支持，persist 需用户授权或高频使用；IndexedDB：全浏览器支持；Cache API：需 HTTPS，SW 上下文或支持 caches 的页面；Cookie Store API：Chromium 87+/Firefox 142+（需安全上下文）。',
      }),

      this._renderLogPanel(),
    ];
  }
}
