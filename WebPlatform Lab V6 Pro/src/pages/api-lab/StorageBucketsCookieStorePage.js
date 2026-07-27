// =====================================================================
// StorageBucketsCookieStorePage.js —— Storage Buckets 与 CookieStore 深入 实验室
// 演示 MDN：
//   1. Storage Buckets API —— navigator.storage.openBucket(name)/openBucket({name,expires})、
//      StorageBucket { name, index, caches, indexedDB, quota, keys }、deleteBucket(name)、buckets()/keys()；每个桶独立 quota/expires，隔离不同特性存储。
//   2. StorageBucket quota 与过期 —— bucket.quota.requestQuota({quota})、bucket.estimate()、bucket.persist()/persisted()、bucket.expires、bucket.setExpires(ts)；过期策略与持久化。
//   3. CookieStore API 深入 —— window/WorkerGlobalScope.cookieStore；get/getAll/set/delete；
//      Cookie 结构 { name, value, domain, path, expires, secure, httpOnly, sameSite, partitioned }；对比 document.cookie（异步/结构化/可在 SW 使用）。
//   4. CookieChangeEvent 与监听 —— cookieStore.addEventListener('change', e => e.changed/e.deleted)；
//      changed=新增/修改，deleted=过期/删除；httpOnly cookie 的可见性差异；监听器随页面卸载移除。
//   5. CookieStoreManager 与 ServiceWorker 订阅 —— registration.cookies.subscribe/getSubscriptions/unsubscribe；SW 内 cookiechange 事件（页面关闭仍可监听）；与 Window change 事件对比。
//   6. 分区 Cookie 与跨站存储协同 —— CHIPS Partitioned cookie + Storage Buckets + Storage Access API 组合；决策矩阵（1st-party / 嵌入式 / 按特性缓存 / 联邦登录）；推荐策略。
// 说明：Storage Buckets API（openBucket）为 Chrome 119+，CookieStore 为 Chrome 87+，CookieChangeEvent / CookieStoreManager 同期支持；jsdom 中均不可用。
//       integration_test.mjs 给 cookieStore 提供基础 polyfill，但 CookieChangeEvent / CookieStoreManager / openBucket 无 polyfill。所有调用前做能力检测，不可用仅记日志，绝不抛异常。
// =====================================================================
import { Page } from '../../core/Component.js';
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';

export class StorageBucketsCookieStorePage extends Page {
  // —— 初始 state ——
  initialState() {
    return {
      logs: [],
      capsSummary: '',
      bucketsInfo: '',       // Card 1：Storage Buckets API 存储桶
      quotaInfo: '',         // Card 2：StorageBucket quota 与过期
      cookieInfo: '',        // Card 3：CookieStore API 深入
      changeEventInfo: '',   // Card 4：CookieChangeEvent 与监听
      managerInfo: '',       // Card 5：CookieStoreManager 与 ServiceWorker 订阅
      strategyInfo: '',      // Card 6：分区 Cookie 与跨站存储协同
    };
  }

  // —— 生命周期 ——
  componentDidMount() {
    // ★★★ 关键守卫：必须存在！否则 setState => rerender => componentDidMount 死循环导致 OOM
    if (this._inited) return;
    this._inited = true;

    // 一次性初始化各实例引用（componentWillUnmount 中释放）
    this._buckets = [];                 // Card 1/2 创建的 StorageBucket 引用
    this._cookieChangeHandler = null;   // Card 4 cookieStore 'change' 监听器
    this._swSubscription = null;        // Card 5 模拟的 SW 订阅信息（不真正订阅）

    // 一次性能力检测：Storage Buckets + CookieStore 全家桶
    const caps = this._caps();
    const parts = [
      `openBucket ${caps.openBucket ? '✓' : '✗'}`,
      `deleteBucket ${caps.deleteBucket ? '✓' : '✗'}`,
      `buckets() ${caps.bucketsList ? '✓' : '✗'}`,
      `cookieStore ${caps.cookieStore ? '✓' : '✗'}`,
      `CookieChangeEvent ${caps.cookieChangeEvent ? '✓' : '✗'}`,
      `CookieStoreManager ${caps.cookieStoreManager ? '✓' : '✗'}`,
      `requestStorageAccess ${caps.requestStorageAccess ? '✓' : '✗'}`,
    ];
    const anyAvailable = caps.openBucket || caps.cookieStore;
    const summary = anyAvailable
      ? `Storage Buckets + CookieStore 能力检测：${parts.join(' · ')}。jsdom 中 openBucket / CookieChangeEvent / CookieStoreManager 通常不可用；integration_test polyfill 了 cookieStore 基础 set/get/getAll/delete，但事件与桶 API 无 polyfill。可执行的演示将以真实 API 运行，缺失 API 仅记日志说明。`
      : '当前环境不支持 Storage Buckets / CookieStore（typeof 均为 "undefined"）；所有按钮点击将仅记日志说明，不会抛异常。在真实浏览器（Chrome 119+）中打开可完整演示。';

    this.setState({ capsSummary: summary });
    this._addLog(anyAvailable ? 'info' : 'warn', `能力检测：${parts.join('，')}`);
    if (!caps.openBucket) this._addLog('warn', 'navigator.storage.openBucket 不可用（Chrome 119+，jsdom 无此方法）');
    if (!caps.cookieChangeEvent) this._addLog('warn', 'CookieChangeEvent 不可用（jsdom 无此构造器，polyfill 未覆盖事件）');
    if (!caps.cookieStoreManager) this._addLog('warn', 'CookieStoreManager 不可用（需 ServiceWorker 注册，jsdom 无）');

    // 自动注册 cookieStore change 监听（若可用）—— Card 4 演示的基础
    if (caps.cookieStore && caps.cookieChangeEvent) {
      this._registerCookieChange();
    }
  }

  componentWillUnmount() {
    // 1. 关闭所有创建的 StorageBucket（delete 或释放引用）
    for (const b of this._buckets || []) {
      try { if (b && typeof b.delete === 'function') b.delete().catch(() => {}); } catch { /* noop */ }
    }
    this._buckets = [];
    // 2. 移除 cookieStore change 监听器
    try {
      if (this._cookieChangeHandler) {
        const cs = this._cs();
        if (cs && typeof cs.removeEventListener === 'function') cs.removeEventListener('change', this._cookieChangeHandler);
        this._cookieChangeHandler = null;
      }
    } catch { /* noop */ }
    // 3. 释放 SW 订阅信息（mock，无需真正 unsubscribe）
    this._swSubscription = null;
  }

  // —— 日志 / 按钮辅助 ——

  _addLog(type, content) {
    this.setState({ logs: [...this.state.logs, { type, content, time: formatTime() }].slice(-40) });
  }

  _btn(label, opts) {
    const btn = new Button({ ...opts, children: label, onClick: opts.onClick });
    this.registerChild(btn);
    return btn.render();
  }

  // —— 同步能力检测（render 时调用，开销可忽略）——
  _caps() {
    const hasNav = typeof navigator !== 'undefined';
    const storage = hasNav && navigator.storage ? navigator.storage : null;
    return {
      openBucket: !!(storage && typeof storage.openBucket === 'function'),
      deleteBucket: !!(storage && typeof storage.deleteBucket === 'function'),
      bucketsList: !!(storage && (typeof storage.buckets === 'function' || typeof storage.keys === 'function')),
      cookieStore: typeof cookieStore !== 'undefined',
      cookieChangeEvent: typeof CookieChangeEvent !== 'undefined',
      cookieStoreManager: false, // 异步检测，初始 false（_checkSWManager 中更新）
      requestStorageAccess: typeof document !== 'undefined' && typeof document.requestStorageAccess === 'function',
    };
  }

  // 获取 cookieStore 引用（统一兜底）
  _cs() {
    if (typeof cookieStore !== 'undefined') return cookieStore;
    if (typeof window !== 'undefined' && window.cookieStore) return window.cookieStore;
    return null;
  }

  // =================== Card 1：Storage Buckets API 存储桶 ===================

  _showBucketsCaps() {
    const caps = this._caps();
    this.setState({ bucketsInfo:
      '===== Storage Buckets API 能力检测 =====\n\n' +
      `  navigator.storage.openBucket  : ${caps.openBucket ? 'function（可用）' : 'undefined（不可用）'}\n` +
      `  navigator.storage.deleteBucket: ${caps.deleteBucket ? 'function（可用）' : 'undefined（不可用）'}\n` +
      `  navigator.storage.buckets()   : ${caps.bucketsList ? 'function（可用）' : 'undefined（不可用）'}\n\n` +
      "API 表面：openBucket('media-cache') → Promise<StorageBucket>；deleteBucket(name) → Promise<void>；buckets() → Promise<StorageBucket[]>\n\n" +
      'StorageBucket 属性：.name / .index（ContentIndex）/ .caches（CacheStorage）/ .indexedDB（IDBFactory）/ .quota（StorageQuota）/ .keys（StorageBucketManager）\n\n' +
      '隔离语义：每个桶独立 quota / expires / IndexedDB / CacheStorage，互不影响（如 media-cache 50MB 临时 / user-data 200MB 持久）。' });
    this._addLog('compare', `Storage Buckets 检测：openBucket=${caps.openBucket}, deleteBucket=${caps.deleteBucket}, buckets()=${caps.bucketsList}`);
  }

  async _createAndListBuckets() {
    const caps = this._caps();
    if (!caps.openBucket) {
      this.setState({ bucketsInfo:
        "Storage Buckets 用法（不可用，仅说明）：\n\n" +
        "const bucket = await navigator.storage.openBucket('media-cache');  // bucket.name/.index/.caches/.indexedDB/.quota/.keys\n" +
        "const list = await navigator.storage.buckets();  // → StorageBucket[]\n" +
        "await navigator.storage.deleteBucket('media-cache');\n\n" +
        '用例：不同特性分桶隔离配额，避免一个特性耗尽全局存储。' });
      this._addLog('warn', 'openBucket 不可用（jsdom 无，Chrome 119+），已记录用法');
      return;
    }
    try {
      const name = 'api-lab-bucket-' + Date.now();
      const bucket = await navigator.storage.openBucket(name);
      this._buckets.push(bucket);
      const has = (k) => `${k}=${typeof bucket[k] !== 'undefined' ? '有' : '无'}`;
      const props = [`name=${bucket.name}`, has('index'), has('caches'), has('indexedDB'), has('quota'), has('keys')];
      let listStr = '（buckets() 不可用）';
      if (caps.bucketsList) {
        try {
          const list = await (navigator.storage.buckets ? navigator.storage.buckets() : navigator.storage.keys());
          listStr = `[${list.map((b) => (b && b.name ? b.name : String(b))).join(', ')}]`;
        } catch (e) { listStr = `列举失败：${e.message}`; }
      }
      this.setState({ bucketsInfo:
        `真实创建 StorageBucket：\n  navigator.storage.openBucket('${name}') → StorageBucket\n` +
        `  桶属性：${props.join('，')}\n\n` +
        `所有桶列表：${listStr}\n\n` +
        '说明：bucket.indexedDB / caches 是独立的 IDBFactory / CacheStorage，按桶隔离；桶配额与过期独立于全局 StorageManager。' });
      this._addLog('bucket', `真实创建桶 '${name}'：${props.join('，')}`);
    } catch (err) {
      this._addLog('warn', `创建 StorageBucket 失败：${err.name} - ${err.message}`);
    }
  }

  _demoIsolation() {
    const caps = this._caps();
    if (!caps.openBucket) {
      this.setState({ bucketsInfo:
        'StorageBucket 隔离演示（不可用，仅说明）：\n\n' +
        "const media = await navigator.storage.openBucket('media-cache');\n" +
        "const user  = await navigator.storage.openBucket('user-data');\n" +
        "media.indexedDB.open('media-db');   // 仅在 media 桶内\n" +
        "user.indexedDB.open('media-db');    // 在 user 桶内独立存在，不冲突\n\n" +
        '隔离保证：同名 IDB/Cache 在不同桶内互不可见；一桶耗尽配额不影响其他桶；删除桶时其内部数据一并清除。' });
      this._addLog('warn', 'openBucket 不可用，已记录桶隔离说明');
      return;
    }
    this.setState({ bucketsInfo:
      'StorageBucket 隔离语义：每个桶拥有独立的 indexedDB（IDBFactory）、caches（CacheStorage）、index（ContentIndex）、quota（StorageQuota）。\n\n' +
      '隔离效果：两个桶内 open 同名 IDB 互不可见、互不影响；一桶耗尽配额不影响其他桶；deleteBucket(name) 桶内所有 IDB/Cache 一并清除。\n\n' +
      '请点击「创建桶 + 列举」真实创建桶，再对比 bucket.indexedDB 与全局 indexedDB。' });
    this._addLog('isolation', '已展示 StorageBucket 隔离语义（独立 IDB / Cache / quota）');
  }

  async _deleteBucket() {
    const caps = this._caps();
    if (!caps.deleteBucket) {
      this._addLog('warn', 'deleteBucket 不可用（Chrome 119+）');
      this.setState({ bucketsInfo:
        "deleteBucket 用法（不可用）：await navigator.storage.deleteBucket('media-cache') → Promise<void>\n" +
        '删除后桶内所有 IDB / Cache / 配额记录一并清除，不可恢复。' });
      return;
    }
    try {
      const last = this._buckets[this._buckets.length - 1];
      const name = last && last.name ? last.name : null;
      if (!name) { this._addLog('warn', '无可删除的桶（请先点击「创建桶 + 列举」）'); return; }
      await navigator.storage.deleteBucket(name);
      this._addLog('bucket', `deleteBucket('${name}') 完成，桶内 IDB/Cache 已清除`);
      this.setState({ bucketsInfo:
        `已删除桶 '${name}'：await navigator.storage.deleteBucket('${name}')\n` +
        '删除效果：桶内所有 IndexedDB / CacheStorage / 配额记录一并清除，不可恢复。' });
      this._buckets = this._buckets.filter((b) => !(b && b.name === name));
    } catch (err) {
      this._addLog('warn', `deleteBucket 失败：${err.name} - ${err.message}`);
    }
  }

  _renderCard1() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '1. Storage Buckets API 存储桶',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.openBucket ? 'success' : 'error' }, caps.openBucket ? 'openBucket ✓' : 'openBucket ✗'),
        h(Tag, { color: caps.deleteBucket ? 'success' : 'error' }, caps.deleteBucket ? 'deleteBucket ✓' : 'deleteBucket ✗'),
        h(Tag, { color: 'primary' }, '分桶隔离')),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'navigator.storage.openBucket(name) 返回 Promise<StorageBucket>，每个桶有独立的 .name / .index（ContentIndex）/ .caches（CacheStorage）/ .indexedDB（IDBFactory）/ .quota（StorageQuota）/ .keys（StorageBucketManager）。deleteBucket(name) 删除桶及其全部数据；buckets() 列举所有桶。不同特性分桶隔离配额与过期（如 media-cache 50MB 临时 / user-data 200MB 持久），互不影响。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('能力检测', { type: 'primary', size: 'sm', onClick: () => this._showBucketsCaps() }),
          this._btn('创建桶 + 列举', { size: 'sm', disabled: !caps.openBucket, onClick: () => this._createAndListBuckets() }),
          this._btn('隔离演示', { size: 'sm', onClick: () => this._demoIsolation() }),
          this._btn('删除桶', { danger: true, size: 'sm', disabled: !caps.deleteBucket, onClick: () => this._deleteBucket() })),
        h('div', { class: 'fs-sm text-secondary' }, 'Storage Buckets 状态 / 用法：'),
        h('pre', { class: 'code-block', style: { maxHeight: '280px', overflow: 'auto' } }, h('code', {}, s.bucketsInfo || '（点击「能力检测」或「创建桶 + 列举」）')),
        h(Alert, { type: 'info', message: 'Storage Buckets 提供按特性隔离的存储', description: '不同于全局 IndexedDB / CacheStorage 共享同一配额池，Storage Buckets 让每个特性拥有独立配额、过期与 IDB/Cache 命名空间。Chrome 119+ 支持（origin trial），jsdom 不可用。' }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 2：StorageBucket quota 与过期 ===================

  _checkQuotaApi() {
    const caps = this._caps();
    if (!caps.openBucket) {
      this.setState({ quotaInfo:
        'StorageBucket quota / 过期 API（不可用，仅说明）：\n\n' +
        "const bucket = await navigator.storage.openBucket('media-cache');\n" +
        '  bucket.quota.requestQuota({ quota: 100*1024*1024 })  // → Promise<StorageBucketQuota>\n' +
        '  await bucket.estimate()  // → { usage, quota }；await bucket.persist() → boolean；await bucket.persisted() → boolean\n' +
        '  bucket.expires → timestamp(ms)；await bucket.setExpires(ts) 设置过期\n\n' +
        '注：openBucket 时可传入 { name, expires } 一次性指定过期。' });
      this._addLog('warn', 'openBucket 不可用，已记录 quota / 过期 API 说明');
      return;
    }
    const last = this._buckets[this._buckets.length - 1];
    const hasBucket = !!last;
    const info = hasBucket
      ? `当前桶 '${last.name}' 的 quota / 过期 API 表面：\n` +
        `  typeof bucket.quota = ${typeof last.quota}\n` +
        `  requestQuota = ${last.quota && typeof last.quota.requestQuota === 'function' ? 'function' : 'undefined'}\n` +
        `  estimate = ${typeof last.estimate === 'function' ? 'function' : 'undefined'}\n` +
        `  persist = ${typeof last.persist === 'function' ? 'function' : 'undefined'}\n` +
        `  persisted = ${typeof last.persisted === 'function' ? 'function' : 'undefined'}\n` +
        `  bucket.expires = ${last.expires !== undefined ? last.expires : 'undefined'}\n` +
        `  setExpires = ${typeof last.setExpires === 'function' ? 'function' : 'undefined'}\n`
      : '请先点击 Card 1 的「创建桶 + 列举」创建一个桶。';
    this.setState({ quotaInfo: info });
    this._addLog('quota', `检测 StorageBucket quota API（hasBucket=${hasBucket}）`);
  }

  async _setQuotaAndExpiry() {
    const caps = this._caps();
    if (!caps.openBucket) { this._addLog('warn', 'openBucket 不可用，无法设置 quota + 过期'); return; }
    const bucket = this._buckets[this._buckets.length - 1];
    if (!bucket) { this._addLog('warn', '请先点击 Card 1 的「创建桶 + 列举」创建一个桶'); return; }
    try {
      const lines = [];
      if (bucket.quota && typeof bucket.quota.requestQuota === 'function') {
        try {
          const r = await bucket.quota.requestQuota({ quota: 100 * 1024 * 1024 });
          lines.push(`bucket.quota.requestQuota({ quota: 100MB }) → ${JSON.stringify(r)}`);
        } catch (e) { lines.push(`requestQuota 失败：${e.message}`); }
      } else { lines.push('bucket.quota.requestQuota 不可用'); }
      const expires = Date.now() + 60 * 60 * 1000;
      if (typeof bucket.setExpires === 'function') {
        try { await bucket.setExpires(expires); lines.push(`bucket.setExpires(${expires}) → 1 小时后过期`); }
        catch (e) { lines.push(`setExpires 失败：${e.message}`); }
      } else { lines.push('bucket.setExpires 不可用（需在 openBucket({ name, expires }) 时指定）'); }
      if (typeof bucket.estimate === 'function') {
        try {
          const est = await bucket.estimate();
          lines.push(`bucket.estimate() → usage=${est.usage != null ? (est.usage / 1048576).toFixed(2) : '?'}MB, quota=${est.quota != null ? (est.quota / 1048576).toFixed(2) : '?'}MB`);
        } catch (e) { lines.push(`estimate 失败：${e.message}`); }
      }
      this.setState({ quotaInfo:
        `设置 quota + 过期 + estimate：\n  ${lines.join('\n  ')}\n\n用例：临时媒体缓存 openBucket({ name:'media', expires })；持久用户数据 openBucket('user-data') + bucket.persist()` });
      this._addLog('quota', `已设置桶 '${bucket.name}' 的 quota + 过期 + estimate`);
    } catch (err) {
      this._addLog('warn', `设置 quota/过期失败：${err.name} - ${err.message}`);
    }
  }

  async _bucketEstimate() {
    const caps = this._caps();
    if (!caps.openBucket) { this._addLog('warn', 'openBucket 不可用'); return; }
    const bucket = this._buckets[this._buckets.length - 1];
    if (!bucket) { this._addLog('warn', '请先创建桶'); return; }
    try {
      if (typeof bucket.estimate !== 'function') { this._addLog('warn', 'bucket.estimate 不可用'); return; }
      const est = await bucket.estimate();
      const usageMB = est.usage != null ? (est.usage / 1048576).toFixed(2) : '?';
      const quotaMB = est.quota != null ? (est.quota / 1048576).toFixed(2) : '?';
      this.setState({ quotaInfo:
        `bucket.estimate() →\n  usage = ${est.usage} 字节（${usageMB} MB）\n  quota = ${est.quota} 字节（${quotaMB} MB）\n\n说明：estimate 返回桶内当前 usage 与 quota，独立于全局 navigator.storage.estimate()。` });
      this._addLog('estimate', `bucket.estimate: usage=${usageMB}MB, quota=${quotaMB}MB`);
    } catch (err) {
      this._addLog('warn', `estimate 失败：${err.name} - ${err.message}`);
    }
  }

  async _bucketPersist() {
    const caps = this._caps();
    if (!caps.openBucket) { this._addLog('warn', 'openBucket 不可用'); return; }
    const bucket = this._buckets[this._buckets.length - 1];
    if (!bucket) { this._addLog('warn', '请先创建桶'); return; }
    try {
      const lines = [];
      if (typeof bucket.persisted === 'function') {
        try { const p = await bucket.persisted(); lines.push(`bucket.persisted() → ${p}`); } catch (e) { lines.push(`persisted 失败：${e.message}`); }
      }
      if (typeof bucket.persist === 'function') {
        try { const ok = await bucket.persist(); lines.push(`bucket.persist() → ${ok ? '已批准持久化' : '被拒绝'}`); } catch (e) { lines.push(`persist 失败：${e.message}`); }
      }
      this.setState({ quotaInfo:
        `bucket.persist / persisted：\n  ${lines.join('\n  ')}\n\n说明：\n  - persist() 请求将桶标记为持久化（避免浏览器自动驱逐）\n  - persisted() 查询当前持久化状态\n  - 持久化桶不会因磁盘压力被 evict，适合不可重建的用户数据\n  - 非持久化桶可能在磁盘压力下被浏览器驱逐（含 expires 到期）` });
      this._addLog('persist', `bucket persist/persisted：${lines.join('；')}`);
    } catch (err) {
      this._addLog('warn', `persist/persisted 失败：${err.name} - ${err.message}`);
    }
  }

  _renderCard2() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '2. StorageBucket quota 与过期',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.openBucket ? 'success' : 'error' }, caps.openBucket ? '可用 ✓' : '不可用'),
        h(Tag, { color: 'primary' }, 'requestQuota / expires'),
        h(Tag, { color: 'warning' }, '持久化策略')),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'bucket.quota.requestQuota({ quota }) 请求桶配额；bucket.estimate() 返回 { usage, quota }；bucket.persist()/persisted() 请求/查询持久化；bucket.expires（openBucket({ name, expires }) 指定）与 bucket.setExpires(ts) 设置过期。过期后浏览器可驱逐桶数据；持久化桶不被驱逐。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('检测 quota API', { type: 'primary', size: 'sm', onClick: () => this._checkQuotaApi() }),
          this._btn('设置 quota + 过期', { size: 'sm', disabled: !caps.openBucket, onClick: () => this._setQuotaAndExpiry() }),
          this._btn('estimate()', { size: 'sm', disabled: !caps.openBucket, onClick: () => this._bucketEstimate() }),
          this._btn('persist/persisted', { size: 'sm', disabled: !caps.openBucket, onClick: () => this._bucketPersist() })),
        h('div', { class: 'fs-sm text-secondary' }, 'quota / 过期状态：'),
        h('pre', { class: 'code-block', style: { maxHeight: '280px', overflow: 'auto' } }, h('code', {}, s.quotaInfo || '（点击「检测 quota API」或「设置 quota + 过期」）')),
        h(Alert, { type: 'warning', message: '过期与持久化是互补的存储策略', description: 'expires 用于「定时驱逐」（如 1 小时后清除媒体缓存）；persisted 用于「禁止驱逐」（如永久用户数据）。二者组合：临时桶 expires + !persisted（可驱逐）、持久桶 !expires + persisted（不驱逐）。' }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 3：CookieStore API 深入 ===================

  async _setFullCookie() {
    const caps = this._caps();
    if (!caps.cookieStore) {
      this.setState({ cookieInfo:
        'cookieStore.set 用法（不可用，仅说明）：\n\n' +
        "await cookieStore.set({ name:'session', value:'abc123',\n" +
        "  domain:'example.com', path:'/', expires: Date.now()+3600*1000,\n" +
        "  secure:true, httpOnly:false, sameSite:'lax',  // 'strict'|'lax'|'none'\n" +
        "  partitioned:true  // CHIPS 分区 cookie });" });
      this._addLog('warn', 'cookieStore 不可用，已记录 set 用法');
      return;
    }
    try {
      const cs = this._cs();
      const value = 'val-' + Math.random().toString(36).slice(2, 8);
      const opts = { name: 'api-lab-cookie', value, path: '/', sameSite: 'lax', expires: new Date(Date.now() + 5 * 60 * 1000) };
      await cs.set(opts);
      this.setState({ cookieInfo:
        `cookieStore.set 完整选项：\n  await cookieStore.set(${JSON.stringify(opts, null, 2)})\n\n` +
        'Cookie 选项：name/value（必填）；domain/path（作用域）；expires(timestamp) / max-age(秒)；secure（仅 HTTPS）；httpOnly（JS 不可读，防 XSS）；sameSite（strict|lax|none，CSRF 防护）；partitioned（CHIPS 分区 cookie，按顶级站点隔离）。' });
      this._addLog('cookie', `cookieStore.set：name=api-lab-cookie, value=${value}, sameSite=lax`);
    } catch (err) {
      this._addLog('warn', `cookieStore.set 失败：${err.name} - ${err.message}`);
    }
  }

  async _cookieGetAll() {
    const caps = this._caps();
    if (!caps.cookieStore) { this._addLog('warn', 'cookieStore 不可用'); return; }
    try {
      const cs = this._cs();
      const all = await cs.getAll();
      const lines = all.map((c) =>
        `  ${c.name}=${c.value} | domain=${c.domain || '-'} path=${c.path || '-'} ` +
        `secure=${c.secure || false} httpOnly=${c.httpOnly || false} ` +
        `sameSite=${c.sameSite || '-'} partitioned=${c.partitioned || false}`);
      this.setState({ cookieInfo:
        `cookieStore.getAll() → ${all.length} 条：\n${lines.join('\n') || '  （空）'}\n\n` +
        'Cookie 对象属性：name, value, domain, path, expires(timestamp), secure, httpOnly, sameSite, partitioned' });
      this._addLog('cookie', `getAll → ${all.length} 条 cookie`);
    } catch (err) {
      this._addLog('warn', `getAll 失败：${err.name} - ${err.message}`);
    }
  }

  async _cookieDelete() {
    const caps = this._caps();
    if (!caps.cookieStore) { this._addLog('warn', 'cookieStore 不可用'); return; }
    try {
      const cs = this._cs();
      await cs.delete({ name: 'api-lab-cookie', path: '/' });
      this._addLog('cookie', "cookieStore.delete({ name:'api-lab-cookie', path:'/' }) 已调用");
      this.setState({ cookieInfo:
        "cookieStore.delete 用法：\n  await cookieStore.delete('name')  // 简写\n" +
        "  await cookieStore.delete({ name, domain, path, partitioned })  // 完整选项\n\n" +
        'delete 会触发 CookieChangeEvent（deleted 数组），见 Card 4。\n' +
        'partitioned cookie 删除时需带 partitioned:true 才能匹配。' });
    } catch (err) {
      this._addLog('warn', `delete 失败：${err.name} - ${err.message}`);
    }
  }

  _compareDocCookie() {
    const caps = this._caps();
    const docCookie = typeof document !== 'undefined' ? typeof document.cookie : 'undefined';
    this.setState({ cookieInfo:
      '===== cookieStore vs document.cookie 对比 =====\n\n' +
      '特性             | document.cookie         | cookieStore\n' +
      '-----------------|-------------------------|---------------------------\n' +
      '同步/异步         | 同步（字符串读写）      | 异步（Promise）\n' +
      '数据结构          | 字符串 "k=v; k2=v2"     | 结构化 Cookie 对象\n' +
      '读取作用域        | 仅当前作用域            | get({ name, url, path })\n' +
      'httpOnly 可读     | 否                      | 否（但 change 事件可见）\n' +
      'ServiceWorker    | 不可用（无 document）   | 可用（WorkerGlobalScope）\n' +
      '事件通知          | 无（需轮询）            | CookieChangeEvent\n' +
      'partitioned      | 不可见                  | 可读写（partitioned:true）\n\n' +
      `当前环境：typeof document.cookie = ${docCookie}；typeof cookieStore = ${caps.cookieStore ? 'object' : 'undefined'}\n\n` +
      '结论：cookieStore 是 document.cookie 的现代化替代，异步、结构化、可在 SW 使用、支持事件。' });
    this._addLog('compare', `对比 cookieStore vs document.cookie（document.cookie=${docCookie}）`);
  }

  _renderCard3() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '3. CookieStore API 深入',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.cookieStore ? 'success' : 'error' }, caps.cookieStore ? 'cookieStore ✓' : 'cookieStore ✗'),
        h(Tag, { color: 'primary' }, 'set / get / getAll / delete'),
        h(Tag, { color: 'warning' }, '结构化 Cookie')),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'window.cookieStore（Window）/ WorkerGlobalScope.cookieStore（ServiceWorker）：get(name) / get({ name, url, path }) 返回 Promise<Cookie>；getAll() / getAll({ name }) 返回 Promise<Cookie[]>；set({ name, value, domain, path, expires, max-age, secure, httpOnly, sameSite, partitioned }) 返回 Promise；delete(name) / delete({ name, domain, path, partitioned })。Cookie 对象含 name/value/domain/path/expires/secure/httpOnly/sameSite/partitioned。相比 document.cookie：异步、结构化、可在 SW 使用、支持事件。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('设置完整 cookie', { type: 'primary', size: 'sm', disabled: !caps.cookieStore, onClick: () => this._setFullCookie() }),
          this._btn('get / getAll', { size: 'sm', disabled: !caps.cookieStore, onClick: () => this._cookieGetAll() }),
          this._btn('delete', { danger: true, size: 'sm', disabled: !caps.cookieStore, onClick: () => this._cookieDelete() }),
          this._btn('对比 document.cookie', { size: 'sm', onClick: () => this._compareDocCookie() })),
        h('div', { class: 'fs-sm text-secondary' }, 'CookieStore 状态：'),
        h('pre', { class: 'code-block', style: { maxHeight: '280px', overflow: 'auto' } }, h('code', {}, s.cookieInfo || '（点击「设置完整 cookie」或「get / getAll」）')),
        h(Alert, { type: 'info', message: 'cookieStore 是 document.cookie 的现代化替代', description: '异步 Promise、结构化 Cookie 对象、支持 httpOnly/sameSite/partitioned、可在 ServiceWorker 使用、配合 CookieChangeEvent 实时感知变更。Chrome 87+，需安全上下文（HTTPS/localhost）。' }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 4：CookieChangeEvent 与监听 ===================

  _registerCookieChange() {
    const caps = this._caps();
    if (!caps.cookieStore || !caps.cookieChangeEvent) {
      this.setState({ changeEventInfo:
        'CookieChangeEvent 用法（不可用，仅说明）：\n\n' +
        "cookieStore.addEventListener('change', (event) => {\n" +
        '  event.changed;  // Cookie[] —— 新增/修改的 cookie\n' +
        '  event.deleted;  // Cookie[] —— 过期/删除的 cookie\n' +
        '});\n\n' +
        '每项是完整 Cookie 对象（含 name/value/domain/path/...）。httpOnly cookie 对 get 不可见，但部分实现在 change 事件中包含。监听器随页面卸载移除（componentWillUnmount 中 removeEventListener）。' });
      this._addLog('warn', 'CookieChangeEvent 不可用（jsdom 无，polyfill 未覆盖事件）');
      return;
    }
    if (this._cookieChangeHandler) { this._addLog('info', 'cookieStore change 监听已存在，无需重复注册'); return; }
    try {
      const cs = this._cs();
      let count = 0;
      this._cookieChangeHandler = (event) => {
        count += 1;
        const changed = (event.changed || []).map((c) => `${c.name}=${c.value}`);
        const deleted = (event.deleted || []).map((c) => c.name);
        this._addLog('change', `CookieChangeEvent #${count}：changed=[${changed.join(',') || '空'}]，deleted=[${deleted.join(',') || '空'}]`);
      };
      cs.addEventListener('change', this._cookieChangeHandler);
      this.setState({ changeEventInfo:
        "已注册 cookieStore 'change' 监听：\n  cookieStore.addEventListener('change', handler)\n  handler(event) { event.changed; event.deleted; }\n\n点击「触发 set+delete」会修改 cookie 并触发事件，查看事件日志。" });
      this._addLog('change', "cookieStore 'change' 监听已注册");
    } catch (err) {
      this._addLog('warn', `注册 change 监听失败：${err.name} - ${err.message}`);
    }
  }

  async _triggerChangeEvents() {
    const caps = this._caps();
    if (!caps.cookieStore) { this._addLog('warn', 'cookieStore 不可用'); return; }
    try {
      const cs = this._cs();
      await cs.set({ name: 'change-demo', value: 'set-' + Date.now(), path: '/', expires: new Date(Date.now() + 60000) });
      this._addLog('change', "set cookie 'change-demo' —— 应触发 changed 事件");
      await cs.delete({ name: 'change-demo', path: '/' });
      this._addLog('change', "delete cookie 'change-demo' —— 应触发 deleted 事件");
      const hasListener = !!this._cookieChangeHandler;
      const note = hasListener
        ? '查看事件日志中的 CookieChangeEvent 记录。'
        : 'CookieChangeEvent 不可用（jsdom 无此构造器），无法捕获事件；真实浏览器中会收到回调。';
      this.setState({ changeEventInfo:
        `已触发 set + delete cookie（监听器${hasListener ? '已注册' : '未注册'}）：\n` +
        "  1) cookieStore.set({ name:'change-demo', expires:+60s }) → changed=[change-demo]\n" +
        "  2) cookieStore.delete({ name:'change-demo' })            → deleted=[change-demo]\n\n" +
        note + '\n\nhttpOnly 可见性：httpOnly cookie 对 cookieStore.get 不可见，但部分实现在 change 事件中会包含 httpOnly 变更。' });
    } catch (err) {
      this._addLog('warn', `触发 change 事件失败：${err.name} - ${err.message}`);
    }
  }

  _explainEvent() {
    this.setState({ changeEventInfo:
      '===== CookieChangeEvent 详解 =====\n\n' +
      'CookieChangeEvent 继承自 Event，额外属性：event.changed: Cookie[]（新增/修改，set 触发）；event.deleted: Cookie[]（过期/删除，delete/过期触发）。每项含 name/value/domain/path/expires/secure/httpOnly/sameSite/partitioned。\n\n' +
      '触发范围：Window 上下文 → 当前页面作用域内所有 cookie 变更（含其他标签页）；ServiceWorker 上下文 → SW 控制范围 cookie 变更（需 CookieStoreManager 订阅，见 Card 5）。\n\n' +
      'httpOnly cookie 可见性：cookieStore.get/getAll —— httpOnly 不可见（与 document.cookie 一致）；CookieChangeEvent.changed/.deleted —— 部分实现会包含 httpOnly 变更（规范允许实现差异）。\n\n' +
      '监听器生命周期：页面卸载时移除（componentWillUnmount 中 removeEventListener）；SW 中需 CookieStoreManager 订阅才能在无页面时收到 cookiechange 事件。' });
    this._addLog('change', '已展示 CookieChangeEvent 详解（changed/deleted/httpOnly/作用域）');
  }

  _renderCard4() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '4. CookieChangeEvent 与监听',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.cookieChangeEvent ? 'success' : 'error' }, caps.cookieChangeEvent ? 'CookieChangeEvent ✓' : '不可用'),
        h(Tag, { color: caps.cookieStore ? 'success' : 'error' }, caps.cookieStore ? 'cookieStore ✓' : 'cookieStore ✗'),
        h(Tag, { color: 'primary' }, 'changed / deleted')),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'cookieStore.addEventListener("change", e => { e.changed; e.deleted }) 监听 cookie 变更：changed 是新增/修改的 Cookie[]，deleted 是过期/删除的 Cookie[]，每项含完整属性。事件在当前作用域所有 cookie 变更时触发。httpOnly cookie 对 get 不可见，但部分实现在 change 事件中包含。监听器在 componentWillUnmount 中移除。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('注册 change 监听', { type: 'primary', size: 'sm', disabled: !caps.cookieStore, onClick: () => this._registerCookieChange() }),
          this._btn('触发 set+delete', { size: 'sm', disabled: !caps.cookieStore, onClick: () => this._triggerChangeEvents() }),
          this._btn('事件详解', { size: 'sm', onClick: () => this._explainEvent() })),
        h('div', { class: 'fs-sm text-secondary' }, 'CookieChangeEvent 状态：'),
        h('pre', { class: 'code-block', style: { maxHeight: '280px', overflow: 'auto' } }, h('code', {}, s.changeEventInfo || '（点击「注册 change 监听」或「触发 set+delete」）')),
        h(Alert, { type: 'info', message: 'CookieChangeEvent 是结构化的 cookie 变更通知', description: '相比轮询 document.cookie，CookieChangeEvent 实时推送 changed/deleted 数组，每项是完整 Cookie 对象。jsdom 与 polyfill 均不实现此事件，需真实浏览器（Chrome 87+）。' }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 5：CookieStoreManager 与 ServiceWorker 订阅 ===================

  async _checkSWManager() {
    const hasSW = typeof navigator !== 'undefined' && navigator.serviceWorker;
    if (!hasSW) {
      this.setState({ managerInfo:
        'CookieStoreManager 用法（ServiceWorker 不可用，仅说明）：\n\n' +
        "const reg = await navigator.serviceWorker.register('/sw.js');\n" +
        'const manager = reg.cookies;  // → CookieStoreManager\n' +
        "await manager.subscribe([{ name:'auth', url:'https://example.com/' }]);  // 订阅\n" +
        'const subs = await manager.getSubscriptions();  // → subscription[]\n' +
        'await manager.unsubscribe(subs);  // 取消订阅\n\n' +
        '订阅后 SW 即使无页面打开也会收到 cookiechange 事件。' });
      this._addLog('warn', 'navigator.serviceWorker 不可用（jsdom 无），已记录 CookieStoreManager 用法');
      return;
    }
    try {
      const reg = await navigator.serviceWorker.ready;
      const manager = reg && reg.cookies;
      if (!manager) {
        this.setState({ managerInfo:
          'ServiceWorker 已注册但 registration.cookies 不可用：\n  await navigator.serviceWorker.ready → registration\n  registration.cookies = undefined（需 Chrome 87+ 并启用 cookieStore）\n\nCookieStoreManager 方法：subscribe([{name,url}]) / getSubscriptions() / unsubscribe([{name,url}])' });
        this._addLog('warn', 'registration.cookies 不可用');
        return;
      }
      const f = (n) => `${n}=${typeof manager[n] === 'function' ? 'function' : 'undefined'}`;
      const methods = [f('subscribe'), f('getSubscriptions'), f('unsubscribe')];
      this.setState({ managerInfo:
        `检测到 CookieStoreManager：\n  registration.cookies → CookieStoreManager\n  方法：${methods.join('，')}\n\n点击「订阅流程演示」执行 subscribe → getSubscriptions → unsubscribe。` });
      this._addLog('manager', `registration.cookies 可用：${methods.join('，')}`);
    } catch (err) {
      this._addLog('warn', `检测 CookieStoreManager 失败：${err.name} - ${err.message}`);
    }
  }

  async _demoSubscribeFlow() {
    const hasSW = typeof navigator !== 'undefined' && navigator.serviceWorker;
    if (!hasSW) {
      this._addLog('warn', 'ServiceWorker 不可用，无法演示订阅流程');
      this.setState({ managerInfo:
        '订阅流程（不可用，仅说明）：\n\n' +
        "const reg = await navigator.serviceWorker.register('/sw.js');\n" +
        'const manager = reg.cookies;  // → CookieStoreManager\n' +
        "await manager.subscribe([{ name:'auth', url:'https://example.com/' }]);  // 订阅\n" +
        'const subs = await manager.getSubscriptions();  // 查询 → [{ name, url }]\n' +
        'await manager.unsubscribe(subs);  // 取消订阅（传同一数组）\n\n' +
        '订阅后 SW 在 sw.js 内 self.addEventListener("cookiechange", e => {...}) 接收事件（即使无页面打开也会唤醒 SW）。' });
      this._swSubscription = [{ name: 'auth', url: 'https://example.com/' }];
      this._addLog('manager', `模拟订阅（无 SW）：${JSON.stringify(this._swSubscription)}`);
      return;
    }
    try {
      const reg = await navigator.serviceWorker.ready;
      const manager = reg && reg.cookies;
      if (!manager) { this._addLog('warn', 'registration.cookies 不可用'); return; }
      const sub = [{ name: 'auth', url: location.origin + '/' }];
      await manager.subscribe(sub);
      this._swSubscription = sub;
      const subs = await manager.getSubscriptions();
      await manager.unsubscribe(sub);
      this.setState({ managerInfo:
        `订阅流程执行完成：\n  subscribe(${JSON.stringify(sub)})\n  getSubscriptions() → ${JSON.stringify(subs)}\n  unsubscribe(${JSON.stringify(sub)})\n\nSW 内 cookiechange 事件：\n  self.addEventListener("cookiechange", (e) => { e.changed; e.deleted; });\n  （即使无页面打开，SW 也会被唤醒接收事件）` });
      this._addLog('manager', `订阅流程完成：subscribe → getSubscriptions(${subs.length}) → unsubscribe`);
    } catch (err) {
      this._addLog('warn', `订阅流程失败：${err.name} - ${err.message}`);
    }
  }

  _compareSWWindow() {
    this.setState({ managerInfo:
      '===== SW cookiechange vs Window change 事件对比 =====\n\n' +
      '维度       | Window change              | SW cookiechange\n' +
      '-----------|----------------------------|-----------------------------\n' +
      '注册位置    | 页面 cookieStore.addEvtLnr | SW self.addEvtLnr\n' +
      '触发条件    | 页面打开时 cookie 变更     | 订阅的 cookie 变更（无页面也触发）\n' +
      '订阅机制    | 无（自动收本作用域）       | 需 CookieStoreManager.subscribe\n' +
      '事件类型    | CookieChangeEvent          | ExtendableCookieChangeEvent\n' +
      '唤醒 SW     | 不适用                     | 是（即使 SW 未运行也会唤醒）\n' +
      '用例       | 页面内 cookie 同步 UI      | auth 变更重新拉取 / 失效缓存\n\n' +
      '典型场景：用户在另一标签页登出 → auth cookie 失效 → SW cookiechange 唤醒 → 清缓存/通知客户端；session cookie 过期 → SW cookiechange → 跳转登录页。' });
    this._addLog('compare', '已展示 SW cookiechange vs Window change 对比');
  }

  _renderCard5() {
    const s = this.state;
    const card = new Card({
      title: '5. CookieStoreManager 与 ServiceWorker 订阅',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: 'primary' }, 'registration.cookies'),
        h(Tag, { color: 'warning' }, 'subscribe / getSubscriptions'),
        h(Tag, { color: 'info' }, 'SW cookiechange')),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'serviceWorkerRegistration.cookies 返回 CookieStoreManager：.subscribe([{ name, url }]) 订阅 cookie 变更，.getSubscriptions() 查询订阅，.unsubscribe([...]) 取消。订阅后 SW 即使无页面打开也会收到 cookiechange 事件（ExtendableCookieChangeEvent，含 changed/deleted）。用例：auth cookie 变更时重新拉取数据、session 过期时清缓存。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('检测 registration.cookies', { type: 'primary', size: 'sm', onClick: () => this._checkSWManager() }),
          this._btn('订阅流程演示', { size: 'sm', onClick: () => this._demoSubscribeFlow() }),
          this._btn('SW vs Window 对比', { size: 'sm', onClick: () => this._compareSWWindow() })),
        h('div', { class: 'fs-sm text-secondary' }, 'CookieStoreManager 状态：'),
        h('pre', { class: 'code-block', style: { maxHeight: '280px', overflow: 'auto' } }, h('code', {}, s.managerInfo || '（点击「检测 registration.cookies」或「订阅流程演示」）')),
        h(Alert, { type: 'info', message: 'CookieStoreManager 让 SW 在无页面时也能响应 cookie 变更', description: '不同于 Window 的 change 事件需页面打开，CookieStoreManager.subscribe 后浏览器会唤醒 SW 触发 cookiechange 事件，适合后台同步、缓存失效等场景。需 HTTPS + 已注册 SW。' }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 6：分区 Cookie 与跨站存储协同 ===================

  _showDecisionMatrix() {
    this.setState({ strategyInfo:
      '===== 分区 Cookie + Storage Buckets + Storage Access 决策矩阵 =====\n\n' +
      '场景                | Cookie 策略          | 存储策略             | 访问 API\n' +
      '--------------------|----------------------|----------------------|-------------------------\n' +
      '1st-party 数据       | 普通 cookie          | localStorage / IDB  | 直接访问\n' +
      '3rd-party 嵌入式状态 | Partitioned (CHIPS)  | partitioned storage | 直接访问（分区隔离）\n' +
      '按特性缓存           | 无 cookie            | Storage Bucket      | openBucket(name)\n' +
      '联邦登录             | FedCM + 普通 cookie  | Storage Access API  | requestStorageAccess()\n\n' +
      '三套机制互补：\n' +
      '  - CHIPS Partitioned cookie：第三方 iframe 内 cookie 按顶级站点分区，可读但不跨站追踪\n' +
      '  - Storage Buckets：按特性隔离配额与过期（不解决跨站，解决特性隔离）\n' +
      '  - Storage Access API：第三方 iframe 请求访问其未分区的一方存储（需用户授权）' });
    this._addLog('strategy', '已展示分区 Cookie + Storage Buckets + Storage Access 决策矩阵');
  }

  _recommendScenarios() {
    const scenarios = [
      { name: '1st-party 购物车', recommend: '普通 cookie（session-id） + localStorage（cart items）', reason: '同源直接访问，无需分区' },
      { name: '嵌入式 widget 偏好', recommend: 'Partitioned cookie（widget-prefs） + partitioned localStorage', reason: 'CHIPS 按顶级站点分区，第三方 iframe 可读但不跨站追踪' },
      { name: '媒体缓存', recommend: "Storage Bucket（name='media-cache', expires=1h, !persisted）", reason: '按特性隔离配额 50MB，1 小时后自动驱逐' },
      { name: '联邦 SSO', recommend: 'FedCM 登录 + Storage Access API 访问一方存储', reason: 'FedCM 处理身份联合，requestStorageAccess 授权 iframe 访问未分区存储' },
    ];
    const lines = scenarios.map((sc, i) => `场景 ${i + 1}：${sc.name}\n  推荐：${sc.recommend}\n  原因：${sc.reason}`);
    this.setState({ strategyInfo:
      '===== 4 场景推荐策略 =====\n\n' + lines.join('\n\n') +
      '\n\n关键 API：cookieStore.set({ ..., partitioned: true }) CHIPS 分区 cookie；cookieStore.get({ name, partitioned: true }) 读取分区；navigator.storage.openBucket(\'media-cache\') 按特性分桶；document.requestStorageAccess() 请求一方存储访问。' });
    this._addLog('strategy', `已生成 4 场景推荐策略：${scenarios.map((sc) => sc.name).join(' / ')}`);
  }

  _explainComposition() {
    const caps = this._caps();
    this.setState({ strategyInfo:
      '===== CHIPS + Storage Buckets + Storage Access 组合 =====\n\n' +
      '1. CHIPS Partitioned Cookie：Set-Cookie: widget-prefs=v1; SameSite=Lax; Secure; Partitioned\n' +
      '   - 按「顶级站点 + 域」分区存储，第三方 iframe 内可读；cookieStore.set({ ..., partitioned: true }) / get({ name, partitioned: true })\n' +
      `   - 当前环境 requestStorageAccess：${caps.requestStorageAccess ? '可用' : '不可用'}\n\n` +
      '2. Storage Buckets（按特性隔离）：navigator.storage.openBucket(\'media-cache\') → 独立 quota/expires/IDB/Cache\n' +
      '   - 不解决跨站，解决「不同特性共享全局配额」问题；可与 partitioned storage 并存（桶内仍是同源）\n\n' +
      '3. Storage Access API（跨站访问一方存储）：const granted = await document.requestStorageAccess();\n' +
      '   - 第三方 iframe 请求访问其未分区的一方 cookie/localStorage/IDB；需用户授权（首次）/ 站点许可；FedCM 登录后可简化\n' +
      '   - 与 CHIPS 互补：CHIPS 是「分区写入」，Storage Access 是「访问未分区」\n\n' +
      '组合决策：1st-party → 普通 cookie + localStorage；3rd-party 嵌入态 → partitioned；按特性缓存 → Storage Bucket；联邦登录 → FedCM + Storage Access API。' });
    this._addLog('strategy', `已展示 CHIPS + Storage Buckets + Storage Access 组合（requestStorageAccess=${caps.requestStorageAccess}）`);
  }

  _renderCard6() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '6. 分区 Cookie 与跨站存储协同',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.requestStorageAccess ? 'success' : 'error' }, caps.requestStorageAccess ? 'StorageAccess ✓' : 'StorageAccess ✗'),
        h(Tag, { color: caps.openBucket ? 'success' : 'error' }, caps.openBucket ? 'Buckets ✓' : 'Buckets ✗'),
        h(Tag, { color: 'primary' }, 'CHIPS')),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'CHIPS Partitioned cookie（Set-Cookie: ...; Partitioned）按顶级站点分区，第三方 iframe 可读但不跨站追踪；cookieStore.get({ partitioned: true })。Storage Buckets 提供按特性配额隔离（不解决跨站）。Storage Access API（document.requestStorageAccess）授权第三方 iframe 访问未分区一方存储。三者互补：1st-party 用普通 cookie + localStorage，嵌入态用 partitioned，按特性缓存用 Bucket，联邦登录用 FedCM + Storage Access。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('决策矩阵', { type: 'primary', size: 'sm', onClick: () => this._showDecisionMatrix() }),
          this._btn('4 场景推荐', { size: 'sm', onClick: () => this._recommendScenarios() }),
          this._btn('CHIPS + 组合说明', { size: 'sm', onClick: () => this._explainComposition() })),
        h('div', { class: 'fs-sm text-secondary' }, '跨站存储策略：'),
        h('pre', { class: 'code-block', style: { maxHeight: '320px', overflow: 'auto' } }, h('code', {}, s.strategyInfo || '（点击「决策矩阵」或「4 场景推荐」）')),
        h(Alert, { type: 'warning', message: '隐私沙盒：三套机制解决不同维度问题', description: 'CHIPS 解决「第三方 cookie 跨站追踪」（分区写入）；Storage Buckets 解决「特性间配额争用」（分桶隔离）；Storage Access API 解决「第三方访问一方存储」（授权访问）。不可互相替代，组合使用。' }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== 日志面板 ===================

  _renderLogPanel() {
    const s = this.state;
    return h('div', { class: 'log-panel' },
      h('div', { class: 'log-panel__header' },
        '事件日志',
        h(Tag, { color: 'primary' }, `${s.logs.length} 条`),
      ),
      s.logs.length === 0
        ? h('div', { class: 'log-panel__empty' }, '（暂无日志）')
        : s.logs.map((log) => h('div', { class: 'log-panel__line' },
            h('span', { class: 'log-panel__time' }, log.time),
            h('span', { class: `log-panel__tag log-panel__tag--${log.type}` }, log.type),
            h('span', { class: 'log-panel__content' }, log.content),
          )),
    );
  }

  // =================== 整页渲染 ===================

  render() {
    const s = this.state;
    return h('div', { class: 'api-lab-page storage-buckets-cookie-store-page' },
      h('h2', { class: 'section-title' }, 'Storage Buckets 与 CookieStore 深入 实验室'),
      h('p', { class: 'fs-sm text-secondary mb-md' },
        '本页深入演示 Storage Buckets API（分桶隔离 quota/过期/IDB/Cache）、CookieStore API（结构化 cookie 读写）、CookieChangeEvent（变更监听）、CookieStoreManager（SW 订阅）以及分区 Cookie + Storage Buckets + Storage Access API 的协同决策。'),
      s.capsSummary !== '' ? h(Alert, { type: 'info', message: s.capsSummary }) : null,
      this._renderCard1(),
      this._renderCard2(),
      this._renderCard3(),
      this._renderCard4(),
      this._renderCard5(),
      this._renderCard6(),
      this._renderLogPanel(),
    );
  }
}
