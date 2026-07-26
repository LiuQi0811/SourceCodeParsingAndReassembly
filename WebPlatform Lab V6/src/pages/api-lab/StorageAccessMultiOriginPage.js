// =====================================================================
// StorageAccessMultiOriginPage.js —— 存储访问与多源隔离实验室
// 演示 MDN：
//   1. Storage Access API —— document.requestStorageAccess / hasStorageAccess /
//      Document.requestStorageAccessFor —— 跨源存储访问（第三方 cookie/storage）
//   2. Storage Buckets API —— navigator.storageBuckets.open / create / keys /
//      delete，StorageBucket.estimate / persist / persisted / setExpiration
//   3. StorageManager —— navigator.storage.estimate / persist / persisted /
//      getDirectory —— 持久化与配额、Origin Private File System
//   4. Cookie Store API —— cookieStore.get / set / delete / getAll，change 事件
//   5. First-Party Sets / Related Website Sets + Partitioned Cookies (CHIPS)
//   6. User-Agent Client Hints —— navigator.userAgentData.brands / mobile /
//      platform / getHighEntropyValues —— 替代 navigator.userAgent 解析
// 说明：所有 API 调用前做 typeof 能力检测，不可用时仅记日志（_addLog('warn', ...)），
//       绝不抛异常。jsdom/Node 中相关 API 多为 undefined，需真实浏览器 + HTTPS 演示。
// =====================================================================
import { Page } from '../../core/Component.js';
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';

// Card 5 演示用的 Related Website Sets 声明 JSON 示例
const RWS_JSON_EXAMPLE = {
  primary: 'https://example.com',
  associatedSites: ['https://associate1.com', 'https://associate2.com'],
  rationaleBySite: {
    'https://associate1.com': 'Login',
    'https://associate2.com': 'Payment',
  },
};

export class StorageAccessMultiOriginPage extends Page {
  // —— 初始 state ——
  initialState() {
    return {
      logs: [],
      capsSummary: '',
      // Card 1：Storage Access API
      storageAccessInfo: '',
      // Card 2：Storage Buckets API
      bucketsInfo: '',
      // Card 3：StorageManager
      storageManagerInfo: '',
      // Card 4：Cookie Store API
      cookieStoreInfo: '',
      // Card 5：First-Party Sets + Partitioned Cookies
      fpsInfo: '',
      // Card 6：User-Agent Client Hints
      uaInfo: '',
    };
  }

  // —— 生命周期 ——
  componentDidMount() {
    // ★★★ 关键守卫：必须存在！否则 setState => rerender => componentDidMount 死循环导致 OOM
    if (this._inited) return;
    this._inited = true;

    // 一次性初始化各实例引用（componentWillUnmount 中释放）
    this._bucket = null;            // Card 2 当前打开/创建的 StorageBucket
    this._bucketKeys = [];          // Card 2 已知桶名列表
    this._cookieListenerOn = false; // Card 4 cookieStore change 事件监听开关
    this._cookieChangeHandler = null;

    // 一次性能力检测：存储访问与多源隔离全家桶
    const hasDocRSA = typeof document !== 'undefined' && typeof document.requestStorageAccess === 'function';
    const hasDocHSA = typeof document !== 'undefined' && typeof document.hasStorageAccess === 'function';
    const hasRSAFor = typeof document !== 'undefined' && typeof document.requestStorageAccessFor === 'function';
    const hasBuckets = typeof navigator !== 'undefined' && !!navigator.storageBuckets && typeof navigator.storageBuckets.open === 'function';
    const hasStorage = typeof navigator !== 'undefined' && !!navigator.storage && typeof navigator.storage.estimate === 'function';
    const hasPersist = hasStorage && typeof navigator.storage.persist === 'function';
    const hasPersisted = hasStorage && typeof navigator.storage.persisted === 'function';
    const hasDirectory = hasStorage && typeof navigator.storage.getDirectory === 'function';
    const hasCookieStore = (typeof cookieStore !== 'undefined' && typeof cookieStore.get === 'function') ||
      (typeof window !== 'undefined' && !!window.cookieStore && typeof window.cookieStore.get === 'function');
    const hasUAData = typeof navigator !== 'undefined' && !!navigator.userAgentData && typeof navigator.userAgentData.getHighEntropyValues === 'function';

    const parts = [
      `requestStorageAccess ${hasDocRSA ? '✓' : '✗'}`,
      `hasStorageAccess ${hasDocHSA ? '✓' : '✗'}`,
      `requestStorageAccessFor ${hasRSAFor ? '✓' : '✗'}`,
      `storageBuckets ${hasBuckets ? '✓' : '✗'}`,
      `navigator.storage ${hasStorage ? '✓' : '✗'}`,
      `persist/persisted ${hasPersist && hasPersisted ? '✓' : '✗'}`,
      `getDirectory(OPFS) ${hasDirectory ? '✓' : '✗'}`,
      `cookieStore ${hasCookieStore ? '✓' : '✗'}`,
      `userAgentData ${hasUAData ? '✓' : '✗'}`,
    ];

    const any = hasDocRSA || hasDocHSA || hasRSAFor || hasBuckets || hasStorage || hasCookieStore || hasUAData;
    const summary = any
      ? `存储访问与多源隔离能力检测：${parts.join(' · ')}。当前环境部分 API 可用；requestStorageAccess / storageBuckets / cookieStore / userAgentData 通常需要真实浏览器 + HTTPS 才能完整演示。`
      : `存储访问与多源隔离能力检测：${parts.join(' · ')}。当前环境（jsdom/Node）几乎所有相关 API 均为 undefined；所有按钮点击将仅记日志说明，不会抛异常。在真实浏览器（HTTPS）中打开可完整演示。`;

    this.setState({ capsSummary: summary });
    this._addLog(any ? 'info' : 'warn', `能力检测：${parts.join('，')}`);
    if (!hasDocRSA) this._addLog('warn', 'document.requestStorageAccess 不可用（需嵌入 iframe + 用户手势 + HTTPS）');
    if (!hasBuckets) this._addLog('warn', 'navigator.storageBuckets 不可用（Storage Buckets API 较新，jsdom 不支持）');
    if (!hasStorage) this._addLog('warn', 'navigator.storage 不可用（jsdom 未实现 StorageManager）');
    if (!hasCookieStore) this._addLog('warn', 'cookieStore 不可用（需 HTTPS 安全上下文，jsdom 不支持）');
    if (!hasUAData) this._addLog('warn', 'navigator.userAgentData 不可用（jsdom 未实现 User-Agent Client Hints）');
  }

  componentWillUnmount() {
    // 释放 StorageBucket 引用，并移除 cookieStore change 监听
    this._bucket = null;
    this._bucketKeys = [];
    if (this._cookieChangeHandler) {
      try {
        const cs = (typeof cookieStore !== 'undefined' && cookieStore) || (typeof window !== 'undefined' && window.cookieStore);
        if (cs && typeof cs.removeEventListener === 'function') cs.removeEventListener('change', this._cookieChangeHandler);
      } catch { /* noop */ }
    }
    this._cookieChangeHandler = null;
    this._cookieListenerOn = false;
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
    const hasDocRSA = typeof document !== 'undefined' && typeof document.requestStorageAccess === 'function';
    const hasDocHSA = typeof document !== 'undefined' && typeof document.hasStorageAccess === 'function';
    const hasRSAFor = typeof document !== 'undefined' && typeof document.requestStorageAccessFor === 'function';
    const hasBuckets = typeof navigator !== 'undefined' && !!navigator.storageBuckets && typeof navigator.storageBuckets.open === 'function';
    const hasStorage = typeof navigator !== 'undefined' && !!navigator.storage && typeof navigator.storage.estimate === 'function';
    const hasCookieStore = (typeof cookieStore !== 'undefined' && typeof cookieStore.get === 'function') ||
      (typeof window !== 'undefined' && !!window.cookieStore && typeof window.cookieStore.get === 'function');
    const hasUAData = typeof navigator !== 'undefined' && !!navigator.userAgentData && typeof navigator.userAgentData.getHighEntropyValues === 'function';
    return {
      docRsa: hasDocRSA, docHsa: hasDocHSA, rsaFor: hasRSAFor,
      buckets: hasBuckets, storage: hasStorage,
      cookieStore: hasCookieStore, uaData: hasUAData,
    };
  }

  // =================== Card 1：Storage Access API ===================

  // document.hasStorageAccess() → Promise<boolean>：检测当前文档是否已有第三方存储访问权
  async _checkStorageAccess() {
    if (!this._caps().docHsa) {
      this._addLog('warn', 'document.hasStorageAccess 不可用（需嵌入 iframe + HTTPS，jsdom 不支持）');
      this.setState({ storageAccessInfo: 'document.hasStorageAccess 不可用。\n测试环境不支持，需真实浏览器 + HTTPS + 嵌入 iframe 才能演示。' });
      return;
    }
    try {
      this._addLog('hsa', '调用 document.hasStorageAccess()…');
      const has = await document.hasStorageAccess();   // → Promise<boolean>
      this.setState({ storageAccessInfo: `document.hasStorageAccess() → Promise<boolean>\n结果：hasStorageAccess = ${has}\n说明：true=当前文档已获访问第一方（顶级上下文）存储权限；false=尚未请求或被拒绝。仅嵌入跨源 iframe 场景下有意义。` });
      this._addLog('hsa', `hasStorageAccess() = ${has}`);
    } catch (err) {
      this._addLog('warn', `hasStorageAccess 失败：${err.name} - ${err.message}`);
      this.setState({ storageAccessInfo: `hasStorageAccess 失败：${err.name} - ${err.message}` });
    }
  }

  // document.requestStorageAccess() → Promise<void>：请求第三方存储访问（需用户手势）
  async _requestStorageAccess() {
    if (!this._caps().docRsa) {
      this._addLog('warn', 'document.requestStorageAccess 不可用（需嵌入 iframe + 用户手势 + HTTPS）');
      this.setState({ storageAccessInfo: 'document.requestStorageAccess 不可用。\n测试环境不支持，需真实浏览器 + HTTPS + 嵌入 iframe + 用户手势才能演示。' });
      return;
    }
    try {
      this._addLog('rsa', '调用 document.requestStorageAccess()（需用户手势触发）…');
      await document.requestStorageAccess();          // → Promise<void>，resolve 即已授权
      const has = this._caps().docHsa ? await document.hasStorageAccess() : '(hasStorageAccess 不可用)';
      this.setState({ storageAccessInfo: `document.requestStorageAccess() → Promise<void>\n请求结果：已 resolve（用户已授权或之前已授权）；再次 hasStorageAccess() = ${has}\n说明：首次调用弹权限提示；用户激活（点击等手势）是前提；授权后 iframe 可读写其第一方 cookie/storage。权限策略需 Permissions-Policy: storage-access 允许。` });
      this._addLog('rsa', 'requestStorageAccess 已授权（resolve）');
    } catch (err) {
      this._addLog('warn', `requestStorageAccess 被拒绝或失败：${err.name} - ${err.message}`);
      this.setState({ storageAccessInfo: `requestStorageAccess 被拒绝：${err.name} - ${err.message}\n（常见原因：无用户手势、权限策略禁用、未在 FPS 集合内）` });
    }
  }

  // Document.requestStorageAccessFor(origin) → Promise<void>：顶级上下文请求特定源存储访问
  async _requestStorageAccessFor() {
    if (!this._caps().rsaFor) {
      this._addLog('warn', 'Document.requestStorageAccessFor 不可用（较新 API，需 First-Party Sets + HTTPS）');
      this.setState({ storageAccessInfo: `Document.requestStorageAccessFor(origin) → Promise<void>\n当前环境不可用。\n说明：顶级上下文（非 iframe）请求特定源的存储访问，需配合 Related Website Sets。origin 参数形如 'https://associate.example'；测试环境不支持，需真实浏览器 + HTTPS + RWS 声明才能演示。` });
      return;
    }
    try {
      const origin = 'https://associate.example';
      this._addLog('rsaFor', `调用 document.requestStorageAccessFor('${origin}')…`);
      await document.requestStorageAccessFor(origin);  // → Promise<void>
      this.setState({ storageAccessInfo: `document.requestStorageAccessFor('${origin}') → Promise<void>\n请求结果：已 resolve（顶级上下文已获得该源的存储访问）\n说明：与 requestStorageAccess 区别——后者由嵌入 iframe 调用，前者由顶级页面调用，用于 RWS 集合内网站共享登录态。需目标源在 /.well-known/related-website-sets.json 中声明。` });
      this._addLog('rsaFor', `requestStorageAccessFor('${origin}') 已授权`);
    } catch (err) {
      this._addLog('warn', `requestStorageAccessFor 失败：${err.name} - ${err.message}`);
      this.setState({ storageAccessInfo: `requestStorageAccessFor 失败：${err.name} - ${err.message}` });
    }
  }

  _renderCard1() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '1. Storage Access API（跨源存储访问）',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.docRsa || caps.docHsa ? 'success' : 'error' }, caps.docRsa || caps.docHsa ? 'StorageAccess ✓' : '不可用'),
        h(Tag, { color: 'primary' }, 'requestStorageAccess'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'document.requestStorageAccess() → Promise<void> 请求访问嵌入 iframe 的第三方 cookie/storage（需用户手势，首次会弹权限提示，resolve 即已授权）；document.hasStorageAccess() → Promise<boolean> 检测当前文档是否已有存储访问权限；Document.requestStorageAccessFor(origin) → Promise<void> 顶级上下文请求特定源的存储访问（需 Related Website Sets）。权限策略：Permissions-Policy: storage-access。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('hasStorageAccess', { type: 'primary', size: 'sm', disabled: !caps.docHsa, onClick: () => this._checkStorageAccess() }),
          this._btn('requestStorageAccess', { type: 'primary', size: 'sm', disabled: !caps.docRsa, onClick: () => this._requestStorageAccess() }),
          this._btn('requestStorageAccessFor', { size: 'sm', disabled: !caps.rsaFor, onClick: () => this._requestStorageAccessFor() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, 'Storage Access 检测 / 请求结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '220px', overflow: 'auto' } },
          h('code', {}, s.storageAccessInfo || '（点击 hasStorageAccess / requestStorageAccess / requestStorageAccessFor）')),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法：'),
        h('pre', { class: 'code-block', style: { maxHeight: '130px', overflow: 'auto' } },
          h('code', {},
`// 嵌入跨源 iframe 内部调用
const has = await document.hasStorageAccess();   // boolean
if (!has) await document.requestStorageAccess(); // 必须在用户手势回调中
// 顶级上下文（配合 Related Website Sets）
await document.requestStorageAccessFor('https://associate.example');`)),
        h(Alert, {
          type: 'info',
          message: 'requestStorageAccess 需用户手势 + 权限策略',
          description: '调用必须在用户激活（click 等）回调中；iframe 父级需通过 Permissions-Policy: storage-access 授权；未在 Related Website Sets 内的源通常会被拒绝。jsdom/Node 中相关 API 为 undefined，需真实浏览器（HTTPS）才能完整运行。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 2：Storage Buckets API ===================

  // navigator.storageBuckets.create(name, options) → Promise<StorageBucket>
  async _createBucket() {
    if (!this._caps().buckets) {
      this._addLog('warn', 'navigator.storageBuckets 不可用（Storage Buckets API 较新，jsdom 不支持）');
      this.setState({ bucketsInfo: 'navigator.storageBuckets 不可用。\n测试环境不支持，需真实浏览器（Chrome 较新版本）+ HTTPS 才能演示。' });
      return;
    }
    try {
      const name = 'important-data';
      this._addLog('bucket', `navigator.storageBuckets.create('${name}', { durability, persist })…`);
      const bucket = await navigator.storageBuckets.create(name, {
        durability: 'strict',   // 'strict' | 'relaxed'，strict 保证重启不丢
        quota: 1024 * 1024 * 5, // 5MB
        persist: true,          // 持久化，不被自动清除
        expiration: 0,          // 0 表示不过期（ms）
      });
      this._bucket = bucket;
      if (!this._bucketKeys.includes(name)) this._bucketKeys.push(name);
      this.setState({ bucketsInfo: `navigator.storageBuckets.create('${name}', options) → Promise<StorageBucket> ✓\noptions = { durability: 'strict', quota: 5MB, persist: true, expiration: 0 }\nbucket.index = ${bucket.index}（IndexedDB 数据库前缀）；bucket.caches = ${bucket.caches}（Cache API 命名空间）\n说明：durability 'strict' 重启不丢数据；persist:true 不被自动清除；expiration 单位 ms，0=不过期。` });
      this._addLog('bucket', `create('${name}') 成功：index=${bucket.index}，persist=true`);
    } catch (err) {
      this._addLog('warn', `create bucket 失败：${err.name} - ${err.message}`);
      this.setState({ bucketsInfo: `create bucket 失败：${err.name} - ${err.message}` });
    }
  }

  // navigator.storageBuckets.open(name, options) → Promise<StorageBucket>（不存在则创建）
  async _openBucket() {
    if (!this._caps().buckets) {
      this._addLog('warn', 'navigator.storageBuckets 不可用');
      this.setState({ bucketsInfo: 'navigator.storageBuckets 不可用。\n测试环境不支持，需真实浏览器 + HTTPS 才能演示。' });
      return;
    }
    try {
      const name = 'temp-cache';
      this._addLog('bucket', `navigator.storageBuckets.open('${name}', { persist: false })…`);
      const bucket = await navigator.storageBuckets.open(name, {
        durability: 'relaxed',  // relaxed 性能优先，可能丢少量最近写入
        persist: false,          // 临时数据，可被浏览器清除
      });
      this._bucket = bucket;
      if (!this._bucketKeys.includes(name)) this._bucketKeys.push(name);
      this.setState({ bucketsInfo: `navigator.storageBuckets.open('${name}', options) → Promise<StorageBucket> ✓\noptions = { durability: 'relaxed', persist: false }\nbucket.index = ${bucket.index}；bucket.caches = ${bucket.caches}\n说明：open 与 create 区别——open 在桶已存在时直接打开（忽略 options），不存在时按 options 创建；create 在桶已存在时抛错。` });
      this._addLog('bucket', `open('${name}') 成功：index=${bucket.index}，persist=false`);
    } catch (err) {
      this._addLog('warn', `open bucket 失败：${err.name} - ${err.message}`);
      this.setState({ bucketsInfo: `open bucket 失败：${err.name} - ${err.message}` });
    }
  }

  // navigator.storageBuckets.keys() → Promise<string[]>
  async _listBuckets() {
    if (!this._caps().buckets) {
      this._addLog('warn', 'navigator.storageBuckets 不可用');
      this.setState({ bucketsInfo: 'navigator.storageBuckets 不可用。\n测试环境不支持，需真实浏览器 + HTTPS 才能演示。' });
      return;
    }
    try {
      const keys = await navigator.storageBuckets.keys();   // → string[]
      this._bucketKeys = keys;
      this.setState({ bucketsInfo: `navigator.storageBuckets.keys() → Promise<string[]>\n结果：keys = ${JSON.stringify(keys)}\n说明：返回当前源下所有存储桶名称；新建的桶会出现在列表中。` });
      this._addLog('bucket', `keys() = ${JSON.stringify(keys)}`);
    } catch (err) {
      this._addLog('warn', `keys 失败：${err.name} - ${err.message}`);
      this.setState({ bucketsInfo: `keys 失败：${err.name} - ${err.message}` });
    }
  }

  // navigator.storageBuckets.delete(name) → Promise<void>
  async _deleteBucket() {
    if (!this._caps().buckets) {
      this._addLog('warn', 'navigator.storageBuckets 不可用');
      this.setState({ bucketsInfo: 'navigator.storageBuckets 不可用。\n测试环境不支持，需真实浏览器 + HTTPS 才能演示。' });
      return;
    }
    try {
      const name = 'temp-cache';
      this._addLog('bucket', `navigator.storageBuckets.delete('${name}')…`);
      await navigator.storageBuckets.delete(name);          // → Promise<void>
      this._bucketKeys = this._bucketKeys.filter((k) => k !== name);
      if (this._bucket && this._bucket.name === name) this._bucket = null;
      this.setState({ bucketsInfo: `navigator.storageBuckets.delete('${name}') → Promise<void> ✓\n已删除桶 '${name}'，桶内 IndexedDB / Cache 数据一并清除。\n剩余桶：${JSON.stringify(this._bucketKeys)}` });
      this._addLog('bucket', `delete('${name}') 成功`);
    } catch (err) {
      this._addLog('warn', `delete bucket 失败：${err.name} - ${err.message}`);
      this.setState({ bucketsInfo: `delete bucket 失败：${err.name} - ${err.message}` });
    }
  }

  // bucket.estimate() / persist() / persisted() / setExpiration / getExpiration
  async _inspectBucket() {
    if (!this._caps().buckets) {
      this._addLog('warn', 'navigator.storageBuckets 不可用');
      this.setState({ bucketsInfo: 'navigator.storageBuckets 不可用。\n测试环境不支持，需真实浏览器 + HTTPS 才能演示。' });
      return;
    }
    if (!this._bucket) {
      this._addLog('warn', '请先点击「create 桶」或「open 桶」');
      return;
    }
    try {
      const b = this._bucket;
      const est = await b.estimate();          // → { usage, quota }
      const persisted = typeof b.persisted === 'function' ? await b.persisted() : '(persisted 不可用)';
      const exp = typeof b.getExpiration === 'function' ? await b.getExpiration() : '(getExpiration 不可用)';
      let setExpLine = '';
      if (typeof b.setExpiration === 'function') {
        try {
          await b.setExpiration(24 * 60 * 60 * 1000);   // 24h，单位 ms
          setExpLine = `\nbucket.setExpiration(24h) ✓ → getExpiration() = ${await b.getExpiration()}`;
        } catch (e) {
          setExpLine = `\nbucket.setExpiration 失败：${e.message}`;
        }
      }
      this.setState({ bucketsInfo: `StorageBucket 内省：\nbucket.estimate() = ${JSON.stringify(est)}（usage / quota，字节）\nbucket.persisted() = ${persisted}\nbucket.getExpiration() = ${exp}（ms，0=不过期）${setExpLine}\nbucket.index = ${b.index}（IndexedDB 前缀）\n说明：persist() 请求持久化（需用户授权或站点已安装）；setExpiration(ms) 设置过期时间，到期后桶被自动清除。` });
      this._addLog('bucket', `inspect：estimate=${JSON.stringify(est)}，persisted=${persisted}`);
    } catch (err) {
      this._addLog('warn', `inspect bucket 失败：${err.name} - ${err.message}`);
      this.setState({ bucketsInfo: `inspect bucket 失败：${err.name} - ${err.message}` });
    }
  }

  _renderCard2() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '2. Storage Buckets API（存储桶）',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.buckets ? 'success' : 'error' }, caps.buckets ? 'storageBuckets ✓' : '不可用'),
        h(Tag, { color: 'primary' }, 'open / create / keys / delete'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'navigator.storageBuckets.open(name, options) 打开（不存在则创建）存储桶；create(name, options) 创建（已存在则抛错）；keys() 列出所有桶名；delete(name) 删除桶。options：{ durability: "strict"|"relaxed", quota, persist: boolean, expiration }。StorageBucket 拥有 .index（IndexedDB 前缀）、.caches（Cache API 命名空间）、estimate()、persist()/persisted()、setExpiration(ms)/getExpiration()。用于区分重要数据（持久）和临时数据（可清除）。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('create 桶', { type: 'primary', size: 'sm', disabled: !caps.buckets, onClick: () => this._createBucket() }),
          this._btn('open 桶', { type: 'primary', size: 'sm', disabled: !caps.buckets, onClick: () => this._openBucket() }),
          this._btn('keys 列表', { size: 'sm', disabled: !caps.buckets, onClick: () => this._listBuckets() }),
          this._btn('delete 桶', { danger: true, size: 'sm', disabled: !caps.buckets, onClick: () => this._deleteBucket() }),
          this._btn('inspect 桶', { size: 'sm', disabled: !caps.buckets, onClick: () => this._inspectBucket() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, 'Storage Bucket 状态：'),
        h('pre', { class: 'code-block', style: { maxHeight: '220px', overflow: 'auto' } },
          h('code', {}, s.bucketsInfo || '（点击 create 桶 / open 桶 / keys 列表 / delete 桶 / inspect 桶）')),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法：'),
        h('pre', { class: 'code-block', style: { maxHeight: '130px', overflow: 'auto' } },
          h('code', {},
`// 重要数据：持久 + strict
const important = await navigator.storageBuckets.create('important', {
  durability: 'strict', persist: true, expiration: 0,
});
// 临时数据：可清除 + relaxed
const temp = await navigator.storageBuckets.open('temp', { persist: false });
await temp.setExpiration(24 * 60 * 60 * 1000); // 24h 后自动清除
await navigator.storageBuckets.delete('temp');`)),
        h(Alert, {
          type: 'info',
          message: 'Storage Buckets 用于隔离不同重要性的数据',
          description: '传统 IndexedDB / Cache 共享一个源的配额，浏览器低磁盘时可能整体清除。Storage Buckets 让你为重要数据（持久 + strict）和临时数据（relaxed + 可过期）分别建桶，清除策略互不影响。jsdom 未实现，需真实浏览器（较新 Chrome）演示。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 3：StorageManager estimate + persist ===================

  // navigator.storage.estimate() → Promise<{ usage, quota, usageDetails, quotaDetails }>
  async _estimateStorage() {
    if (!this._caps().storage) {
      this._addLog('warn', 'navigator.storage 不可用（jsdom 未实现 StorageManager）');
      this.setState({ storageManagerInfo: 'navigator.storage 不可用。\n测试环境不支持，需真实浏览器 + HTTPS 才能演示。' });
      return;
    }
    try {
      this._addLog('estimate', '调用 navigator.storage.estimate()…');
      const est = await navigator.storage.estimate();   // → { usage, quota, usageDetails?, quotaDetails? }
      const usageMB = (est.usage / 1024 / 1024).toFixed(3);
      const quotaMB = (est.quota / 1024 / 1024).toFixed(1);
      const usageDetails = est.usageDetails ? JSON.stringify(est.usageDetails) : '(无 usageDetails)';
      const quotaDetails = est.quotaDetails ? JSON.stringify(est.quotaDetails) : '(无 quotaDetails)';
      this.setState({ storageManagerInfo: `navigator.storage.estimate() → Promise<{ usage, quota, usageDetails?, quotaDetails? }>\nusage = ${est.usage} 字节（${usageMB} MB）；quota = ${est.quota} 字节（${quotaMB} MB）\nusageDetails = ${usageDetails}（caches / indexedDB / serviceWorkerRegistrations 等分类用量）\nquotaDetails = ${quotaDetails}（maxSessionScopedQuota 等会话级配额）\n说明：usage / quota 单位字节；usageDetails 拆分各存储类型用量。` });
      this._addLog('estimate', `estimate：usage=${usageMB}MB，quota=${quotaMB}MB`);
    } catch (err) {
      this._addLog('warn', `estimate 失败：${err.name} - ${err.message}`);
      this.setState({ storageManagerInfo: `estimate 失败：${err.name} - ${err.message}` });
    }
  }

  // navigator.storage.persist() → Promise<boolean>：请求持久化（不被自动清除）
  async _persistStorage() {
    if (!this._caps().storage || typeof navigator.storage.persist !== 'function') {
      this._addLog('warn', 'navigator.storage.persist 不可用');
      this.setState({ storageManagerInfo: 'navigator.storage.persist 不可用。\n测试环境不支持，需真实浏览器 + HTTPS 才能演示。' });
      return;
    }
    try {
      this._addLog('persist', '调用 navigator.storage.persist()…');
      const ok = await navigator.storage.persist();   // → boolean
      this.setState({ storageManagerInfo: `navigator.storage.persist() → Promise<boolean>\n结果：persist = ${ok}\n说明：true=已持久化（站点数据不会被浏览器自动清除）；false=被拒绝（用户未授权或站点未安装为 PWA）。持久化后浏览器低磁盘时不会清除该源数据。` });
      this._addLog('persist', `persist() = ${ok}`);
    } catch (err) {
      this._addLog('warn', `persist 失败：${err.name} - ${err.message}`);
      this.setState({ storageManagerInfo: `persist 失败：${err.name} - ${err.message}` });
    }
  }

  // navigator.storage.persisted() → Promise<boolean>：检测是否已持久化
  async _checkPersisted() {
    if (!this._caps().storage || typeof navigator.storage.persisted !== 'function') {
      this._addLog('warn', 'navigator.storage.persisted 不可用');
      this.setState({ storageManagerInfo: 'navigator.storage.persisted 不可用。\n测试环境不支持，需真实浏览器 + HTTPS 才能演示。' });
      return;
    }
    try {
      this._addLog('persisted', '调用 navigator.storage.persisted()…');
      const persisted = await navigator.storage.persisted();   // → boolean
      this.setState({ storageManagerInfo: `navigator.storage.persisted() → Promise<boolean>\n结果：persisted = ${persisted}\n说明：true=该源数据已持久化，不会被浏览器自动清除；false=仍为"尽力而为"存储，低磁盘时可能被清除。` });
      this._addLog('persisted', `persisted() = ${persisted}`);
    } catch (err) {
      this._addLog('warn', `persisted 失败：${err.name} - ${err.message}`);
      this.setState({ storageManagerInfo: `persisted 失败：${err.name} - ${err.message}` });
    }
  }

  // navigator.storage.getDirectory() → Promise<FileSystemDirectoryHandle>（OPFS 根目录）
  async _getDirectory() {
    if (!this._caps().storage || typeof navigator.storage.getDirectory !== 'function') {
      this._addLog('warn', 'navigator.storage.getDirectory 不可用（OPFS 需较新浏览器 + HTTPS）');
      this.setState({ storageManagerInfo: 'navigator.storage.getDirectory 不可用。\nOrigin Private File System (OPFS) 测试环境不支持，需真实浏览器 + HTTPS 才能演示。' });
      return;
    }
    try {
      this._addLog('opfs', '调用 navigator.storage.getDirectory()…');
      const root = await navigator.storage.getDirectory();   // → FileSystemDirectoryHandle
      let entries = [];
      for await (const [name, handle] of root.entries()) {
        entries.push(`${name}（${handle.kind}）`);
        if (entries.length >= 5) break;
      }
      this.setState({ storageManagerInfo: `navigator.storage.getDirectory() → Promise<FileSystemDirectoryHandle> ✓\nOPFS 根目录 kind = ${root.kind}，name = ${root.name}\n前 5 个条目：\n${entries.length ? entries.map((e) => '  • ' + e).join('\n') : '  （空，尚未写入文件）'}\n说明：OPFS 是页面私有、高性能的虚拟文件系统，写入对用户不可见；通过 root.getFileHandle / removeEntry 等操作文件。` });
      this._addLog('opfs', `getDirectory() 成功：root=${root.name}，条目数≥${entries.length}`);
    } catch (err) {
      this._addLog('warn', `getDirectory 失败：${err.name} - ${err.message}`);
      this.setState({ storageManagerInfo: `getDirectory 失败：${err.name} - ${err.message}` });
    }
  }

  _renderCard3() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '3. StorageManager（持久化与配额）',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.storage ? 'success' : 'error' }, caps.storage ? 'navigator.storage ✓' : '不可用'),
        h(Tag, { color: 'primary' }, 'estimate / persist / OPFS'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'navigator.storage（StorageManager）提供三组能力：(1) estimate() → Promise<{ usage, quota, usageDetails, quotaDetails }> 读取源存储用量与配额（字节），usageDetails 拆分 caches/indexedDB/serviceWorkerRegistrations；(2) persist() → Promise<boolean> 请求持久化（不被自动清除），persisted() → Promise<boolean> 检测是否已持久化；(3) getDirectory() → Promise<FileSystemDirectoryHandle> 获取 Origin Private File System (OPFS) 根目录，页面私有高性能文件系统。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('estimate', { type: 'primary', size: 'sm', disabled: !caps.storage, onClick: () => this._estimateStorage() }),
          this._btn('persist', { type: 'primary', size: 'sm', disabled: !caps.storage, onClick: () => this._persistStorage() }),
          this._btn('persisted', { size: 'sm', disabled: !caps.storage, onClick: () => this._checkPersisted() }),
          this._btn('getDirectory(OPFS)', { size: 'sm', disabled: !caps.storage, onClick: () => this._getDirectory() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, 'StorageManager 状态：'),
        h('pre', { class: 'code-block', style: { maxHeight: '220px', overflow: 'auto' } },
          h('code', {}, s.storageManagerInfo || '（点击 estimate / persist / persisted / getDirectory）')),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法：'),
        h('pre', { class: 'code-block', style: { maxHeight: '120px', overflow: 'auto' } },
          h('code', {},
`const { usage, quota } = await navigator.storage.estimate();
if (!(await navigator.storage.persisted())) await navigator.storage.persist();
// Origin Private File System
const root = await navigator.storage.getDirectory();
const fh = await root.getFileHandle('log.txt', { create: true });
const w = await fh.createWritable(); await w.write('hi'); await w.close();`)),
        h(Alert, {
          type: 'warning',
          message: 'persist() 不保证一定成功',
          description: '浏览器可能因用户未授权、站点未安装为 PWA、存储压力大等拒绝持久化请求，返回 false。OPFS（getDirectory）写入对用户不可见，适合缓存大文件、离线日志等场景，需较新浏览器 + HTTPS。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 4：Cookie Store API ===================

  _getCookieStore() {
    if (typeof cookieStore !== 'undefined' && cookieStore) return cookieStore;
    if (typeof window !== 'undefined' && window.cookieStore) return window.cookieStore;
    return null;
  }

  // cookieStore.set({ name, value, sameSite, partitioned, ... }) → Promise<void>
  async _setCookie() {
    const cs = this._getCookieStore();
    if (!cs || typeof cs.set !== 'function') {
      this._addLog('warn', 'cookieStore 不可用（需 HTTPS 安全上下文，jsdom 不支持）');
      this.setState({ cookieStoreInfo: 'cookieStore 不可用。\n测试环境不支持，需真实浏览器 + HTTPS 才能演示。' });
      return;
    }
    try {
      this._addLog('cookie', 'cookieStore.set 两个 cookie（普通 + Partitioned）…');
      await cs.set({ name: 'sample_token', value: 'abc123', path: '/', sameSite: 'lax', secure: true });
      try {
        await cs.set({ name: 'partitioned_token', value: 'chips-xyz', path: '/', sameSite: 'none', secure: true, partitioned: true });
      } catch (e) {
        this._addLog('warn', `set Partitioned cookie 失败：${e.message}（可能未在第三方上下文）`);
      }
      this.setState({ cookieStoreInfo: `cookieStore.set(options) → Promise<void> ✓\n已设置：sample_token=abc123（sameSite: lax, secure: true）\n已设置：partitioned_token=chips-xyz（sameSite: none, secure: true, partitioned: true）\noptions 字段：name, value, domain, path, expires, sameSite, secure, partitioned\n说明：partitioned:true 即 CHIPS，按 top-level site 分区存储；必须 Secure + SameSite=None。` });
      this._addLog('cookie', 'set 成功：sample_token + partitioned_token');
    } catch (err) {
      this._addLog('warn', `set cookie 失败：${err.name} - ${err.message}`);
      this.setState({ cookieStoreInfo: `set cookie 失败：${err.name} - ${err.message}` });
    }
  }

  // cookieStore.get(name) → Promise<CookieListItem | null>
  async _getCookie() {
    const cs = this._getCookieStore();
    if (!cs || typeof cs.get !== 'function') {
      this._addLog('warn', 'cookieStore 不可用');
      this.setState({ cookieStoreInfo: 'cookieStore 不可用。\n测试环境不支持，需真实浏览器 + HTTPS 才能演示。' });
      return;
    }
    try {
      this._addLog('cookie', `cookieStore.get('sample_token')…`);
      const c = await cs.get('sample_token');   // → { name, value, domain, path, ... } | null
      this.setState({ cookieStoreInfo: `cookieStore.get('sample_token') → Promise<CookieListItem | null>\n结果：${c ? JSON.stringify(c, null, 2) : 'null（未找到，可能已被清除或分区不同）'}\n说明：get(name) 返回单个 cookie；也可 get({ name, url }) 按条件查询。返回项含 name/value/domain/path/expires/sameSite/secure/partitioned。` });
      this._addLog('cookie', `get('sample_token') = ${c ? c.value : 'null'}`);
    } catch (err) {
      this._addLog('warn', `get cookie 失败：${err.name} - ${err.message}`);
      this.setState({ cookieStoreInfo: `get cookie 失败：${err.name} - ${err.message}` });
    }
  }

  // cookieStore.getAll(options?) → Promise<CookieListItem[]>
  async _getAllCookies() {
    const cs = this._getCookieStore();
    if (!cs || typeof cs.getAll !== 'function') {
      this._addLog('warn', 'cookieStore.getAll 不可用');
      this.setState({ cookieStoreInfo: 'cookieStore.getAll 不可用。\n测试环境不支持，需真实浏览器 + HTTPS 才能演示。' });
      return;
    }
    try {
      this._addLog('cookie', 'cookieStore.getAll()…');
      const list = await cs.getAll();   // → CookieListItem[]
      const preview = list.slice(0, 8).map((c) => `  • ${c.name}=${c.value}（sameSite:${c.sameSite || '?'}, partitioned:${!!c.partitioned}）`).join('\n');
      this.setState({ cookieStoreInfo: `cookieStore.getAll() → Promise<CookieListItem[]>\n共 ${list.length} 个 cookie，前 8 个：\n${preview || '  （空）'}\n说明：getAll(options?) 可按 name/url/domain 过滤；只能读取当前分区（top-level site）的 cookie。` });
      this._addLog('cookie', `getAll() 共 ${list.length} 个 cookie`);
    } catch (err) {
      this._addLog('warn', `getAll cookie 失败：${err.name} - ${err.message}`);
      this.setState({ cookieStoreInfo: `getAll cookie 失败：${err.name} - ${err.message}` });
    }
  }

  // cookieStore.delete(name) → Promise<void>
  async _deleteCookie() {
    const cs = this._getCookieStore();
    if (!cs || typeof cs.delete !== 'function') {
      this._addLog('warn', 'cookieStore.delete 不可用');
      this.setState({ cookieStoreInfo: 'cookieStore.delete 不可用。\n测试环境不支持，需真实浏览器 + HTTPS 才能演示。' });
      return;
    }
    try {
      this._addLog('cookie', `cookieStore.delete('sample_token')…`);
      await cs.delete('sample_token');   // → Promise<void>
      await cs.delete('partitioned_token').catch(() => {});
      this.setState({ cookieStoreInfo: `cookieStore.delete('sample_token') → Promise<void> ✓\n已删除 sample_token 与 partitioned_token\n说明：delete(name) 也可传 { name, domain, path, partitioned } 精确匹配；删除会触发 change 事件（见下方监听）。` });
      this._addLog('cookie', `delete('sample_token') 成功`);
    } catch (err) {
      this._addLog('warn', `delete cookie 失败：${err.name} - ${err.message}`);
      this.setState({ cookieStoreInfo: `delete cookie 失败：${err.name} - ${err.message}` });
    }
  }

  // cookieStore.addEventListener('change', cb) —— cookie 变化事件
  _toggleCookieListener() {
    const cs = this._getCookieStore();
    if (!cs || typeof cs.addEventListener !== 'function') {
      this._addLog('warn', 'cookieStore.addEventListener 不可用');
      this.setState({ cookieStoreInfo: 'cookieStore.change 事件不可用。\n测试环境不支持，需真实浏览器 + HTTPS 才能演示。' });
      return;
    }
    if (this._cookieListenerOn) {
      cs.removeEventListener('change', this._cookieChangeHandler);
      this._cookieListenerOn = false;
      this._cookieChangeHandler = null;
      this._addLog('cookie', '已关闭 cookieStore change 事件监听');
      this.setState({ cookieStoreInfo: 'cookieStore change 事件监听已关闭。\n再次点击可重新开启。' });
      return;
    }
    this._cookieChangeHandler = (ev) => {
      // ChangeEvent：ev.changed[] / ev.deleted[]，每项含 name/value/domain/path
      const changed = (ev.changed || []).map((c) => `${c.name}=${c.value}`);
      const deleted = (ev.deleted || []).map((c) => `${c.name}`);
      this._addLog('change', `cookie 变化：changed=[${changed.join(', ')}]，deleted=[${deleted.join(', ')}]`);
    };
    cs.addEventListener('change', this._cookieChangeHandler);
    this._cookieListenerOn = true;
    this._addLog('cookie', '已开启 cookieStore change 事件监听（set/delete 后将记日志）');
    this.setState({ cookieStoreInfo: `cookieStore.addEventListener('change', cb) —— 已开启 ✓\nChangeEvent 含 changed[] / deleted[]，每项含 name/value/domain/path。\n现在点击「set cookie」或「delete cookie」会触发 change 事件并记日志；再次点击本按钮可关闭监听。` });
  }

  _renderCard4() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '4. Cookie Store API（异步 Cookie 访问）',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.cookieStore ? 'success' : 'error' }, caps.cookieStore ? 'cookieStore ✓' : '不可用'),
        h(Tag, { color: 'primary' }, 'get / set / delete / change'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'cookieStore.get(name) / getAll(options) 异步读取 cookie；set({ name, value, domain, path, expires, sameSite, secure, partitioned }) 异步设置（partitioned:true 即 CHIPS 分区 cookie，需 Secure + SameSite=None）；delete(name) 异步删除；addEventListener("change", cb) 监听 cookie 变化，ChangeEvent 含 changed[]/deleted[]，每项含 name/value/domain/path。与 document.cookie 区别：异步、结构化、支持事件、支持 partitioned 属性。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('set cookie', { type: 'primary', size: 'sm', disabled: !caps.cookieStore, onClick: () => this._setCookie() }),
          this._btn('get cookie', { size: 'sm', disabled: !caps.cookieStore, onClick: () => this._getCookie() }),
          this._btn('getAll', { size: 'sm', disabled: !caps.cookieStore, onClick: () => this._getAllCookies() }),
          this._btn('delete cookie', { danger: true, size: 'sm', disabled: !caps.cookieStore, onClick: () => this._deleteCookie() }),
          this._btn(this._cookieListenerOn ? '关闭 change 监听' : '开启 change 监听', { size: 'sm', disabled: !caps.cookieStore, onClick: () => this._toggleCookieListener() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, 'Cookie Store 状态：'),
        h('pre', { class: 'code-block', style: { maxHeight: '220px', overflow: 'auto' } },
          h('code', {}, s.cookieStoreInfo || '（点击 set / get / getAll / delete / change 监听）')),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法：'),
        h('pre', { class: 'code-block', style: { maxHeight: '140px', overflow: 'auto' } },
          h('code', {},
`await cookieStore.set({ name: 't', value: '1', sameSite: 'lax', secure: true });
const c = await cookieStore.get('t');              // { name, value, ... }
const all = await cookieStore.getAll();
await cookieStore.delete('t');
// CHIPS 分区 cookie
await cookieStore.set({ name: 'p', value: '2', sameSite: 'none',
                        secure: true, partitioned: true });
// 变化事件
cookieStore.addEventListener('change', (e) => { e.changed; e.deleted; });`)),
        h(Alert, {
          type: 'info',
          message: 'cookieStore 需 HTTPS 安全上下文',
          description: 'cookieStore 只在安全上下文（HTTPS / localhost）可用；jsdom/Node 不支持。与 document.cookie 相比，cookieStore 异步、结构化、支持 change 事件、原生支持 partitioned（CHIPS）属性，是现代 cookie 管理的推荐方式。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 5：First-Party Sets + Partitioned Cookies ===================

  // 展示 Related Website Sets 声明 JSON 格式
  _showRwsJson() {
    this._addLog('fps', '展示 Related Website Sets 声明 JSON（/.well-known/related-website-sets.json）');
    this.setState({ fpsInfo: `Related Website Sets（RWS，原名 First-Party Sets）声明 JSON\n部署位置：主域的 /.well-known/related-website-sets.json\n\n示例：\n${JSON.stringify(RWS_JSON_EXAMPLE, null, 2)}\n\n字段说明：primary=主域（canonical）；associatedSites=关联站点（必须声明 rationaleBySite）；rationaleBySite=每个关联站点用途（Login/Payment 等）；其他可选 serviceSites / uncheckedCandidateSites\n\n配合方式：顶级页面调用 document.requestStorageAccessFor('https://associate1.com')；集合内站点可放宽 SameSite 限制，共享登录态。` });
  }

  // 展示 CHIPS（Partitioned Cookies）示例
  _showChipsExample() {
    this._addLog('chips', '展示 CHIPS Partitioned Cookie Set-Cookie 示例');
    this.setState({ fpsInfo: `CHIPS（Partitioned Cookies）—— 分区 Cookie\nSet-Cookie 响应头示例：\n  Set-Cookie: partitioned_token=chips-xyz; Path=/; Secure; SameSite=None; Partitioned\n\n关键属性：Partitioned（按 top-level site 隔离）/ Secure（必须）/ SameSite=None（必须，第三方上下文）\n\n分区机制：每个 top-level site 有独立 cookie jar；同一第三方在 A.com 与 B.com 嵌入时 cookie 互不可见；document.cookie 只能读取当前分区的 cookie；cookieStore.get 同样只读当前分区。\n\n目的：解决第三方 cookie 被跨站追踪问题，保留第三方功能同时隔离身份。` });
  }

  // 对比 SameSite 策略
  _compareSameSite() {
    this._addLog('samesite', '对比 SameSite 策略：Strict / Lax / None + FPS 放宽');
    this.setState({ fpsInfo: `SameSite 策略对比（Cookie 属性）\n──────────────────────────────────────────────────────\nSameSite=Strict：仅同源请求携带 cookie；跨站链接、第三方嵌入完全不携带。最安全，但影响跨站跳转登录态。\n\nSameSite=Lax（默认）：同源请求携带；顶级导航（GET）携带；POST/iframe/fetch 跨站不携带。平衡安全与可用性。\n\nSameSite=None; Secure：所有跨站请求携带（含 iframe/fetch）；必须 Secure（HTTPS）。第三方 cookie 默认方案，被隐私沙盒逐步限制。\n\nFirst-Party Sets 内放宽：RWS 集合内站点声明为同一"第一方"，可放宽 SameSite 限制，配合 requestStorageAccessFor 共享登录态；浏览器仍按"第一方"对待，无需 SameSite=None。\n\n推荐组合：重要登录态 SameSite=Lax；嵌入第三方功能 CHIPS；关联网站共享 RWS + requestStorageAccessFor。` });
  }

  _renderCard5() {
    const s = this.state;
    const card = new Card({
      title: '5. First-Party Sets + Partitioned Cookies',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: 'primary' }, 'RWS / CHIPS'),
        h(Tag, { color: 'primary' }, 'SameSite 策略'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'First-Party Sets / Related Website Sets（RWS）：多个关联域名通过 /.well-known/related-website-sets.json 声明为同一"第一方"集合，配合 document.requestStorageAccessFor 共享登录态，集合内可放宽 SameSite 限制。Partitioned Cookies（CHIPS）：Set-Cookie 加 Partitioned; Secure; SameSite=None，按 top-level site 分区存储，每个顶级站点有独立 cookie jar，解决第三方 cookie 被追踪问题，document.cookie 只能读取当前分区。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('RWS JSON 格式', { type: 'primary', size: 'sm', onClick: () => this._showRwsJson() }),
          this._btn('CHIPS 示例', { type: 'primary', size: 'sm', onClick: () => this._showChipsExample() }),
          this._btn('SameSite 对比', { size: 'sm', onClick: () => this._compareSameSite() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, 'RWS / CHIPS / SameSite 说明：'),
        h('pre', { class: 'code-block', style: { maxHeight: '320px', overflow: 'auto' } },
          h('code', {}, s.fpsInfo || '（点击 RWS JSON 格式 / CHIPS 示例 / SameSite 对比）')),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法（HTTP 头 + JS）：'),
        h('pre', { class: 'code-block', style: { maxHeight: '140px', overflow: 'auto' } },
          h('code', {},
`# HTTP 响应头设置 CHIPS 分区 cookie
Set-Cookie: partitioned_token=chips-xyz; Path=/; Secure; SameSite=None; Partitioned

# /.well-known/related-website-sets.json（部署在主域）
{ "primary": "https://example.com",
  "associatedSites": ["https://associate1.com"],
  "rationaleBySite": { "https://associate1.com": "Login" } }

// JS：顶级页面请求关联源存储访问（需 RWS）
await document.requestStorageAccessFor('https://associate1.com');`)),
        h(Alert, {
          type: 'info',
          message: 'CHIPS 与 RWS 是隐私沙盒的两条互补路径',
          description: 'CHIPS 让第三方 cookie 按 top-level site 分区，保留功能但隔离身份；RWS 让真正关联的站点声明为同一第一方，可共享登录态。两者配合 requestStorageAccess / requestStorageAccessFor，是替代裸第三方 cookie 的现代方案。本卡片为纯说明性演示，按钮点击只展示格式说明，不调用浏览器 API。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 6：User-Agent Client Hints ===================

  // navigator.userAgentData.brands / mobile / platform —— 低熵信息
  _showUaBasic() {
    if (!this._caps().uaData) {
      this._addLog('warn', 'navigator.userAgentData 不可用（jsdom 未实现 User-Agent Client Hints）');
      this.setState({ uaInfo: `navigator.userAgentData 不可用。测试环境不支持，需真实浏览器（较新 Chrome/Edge）才能演示。\n\n预期字段：\n  userAgentData.brands   —— [{ brand, version }]，浏览器品牌列表\n  userAgentData.mobile   —— boolean，是否移动端\n  userAgentData.platform —— 'Windows'|'macOS'|'Linux'|'Android'|'iOS'\n  userAgentData.getHighEntropyValues(hints) —— 高熵信息（见右侧按钮）` });
      return;
    }
    try {
      const ua = navigator.userAgentData;
      const brands = JSON.stringify(ua.brands);     // [{ brand, version }]
      this._addLog('ua', `userAgentData：brands=${brands}，mobile=${ua.mobile}，platform=${ua.platform}`);
      this.setState({ uaInfo: `navigator.userAgentData（UserAgentData 对象）\nbrands   = ${brands}\nmobile   = ${ua.mobile}（是否移动端）\nplatform = ${ua.platform}（'Windows'|'macOS'|'Linux'|'Android'|'iOS'）\n\n说明：brands 为浏览器品牌列表（含主要品牌与 CH 兼容标记）；这三项为"低熵"信息，无需异步请求，直接同步读取。替代 navigator.userAgent 字符串解析，更结构化、更隐私友好。` });
    } catch (err) {
      this._addLog('warn', `读取 userAgentData 失败：${err.name} - ${err.message}`);
      this.setState({ uaInfo: `读取失败：${err.name} - ${err.message}` });
    }
  }

  // userAgentData.getHighEntropyValues(hints) → Promise<{...}> —— 高熵信息
  async _getHighEntropy() {
    if (!this._caps().uaData) {
      this._addLog('warn', 'navigator.userAgentData.getHighEntropyValues 不可用');
      this.setState({ uaInfo: `navigator.userAgentData.getHighEntropyValues 不可用。测试环境不支持，需真实浏览器（较新 Chrome/Edge）才能演示。\n\n预期返回：\n  architecture    —— 'x86'|'arm' 等\n  bitness         —— '32'|'64'\n  model           —— 设备型号（移动端）\n  platformVersion —— '15.0.0' 等操作系统版本\n  uaFullVersion   —— 完整浏览器版本\n  fullVersionList —— [{ brand, version }] 完整品牌列表` });
      return;
    }
    try {
      this._addLog('ua', '调用 userAgentData.getHighEntropyValues([...])…');
      const hev = await navigator.userAgentData.getHighEntropyValues([
        'architecture', 'bitness', 'model', 'platformVersion',
        'uaFullVersion', 'fullVersionList',
      ]);
      this.setState({ uaInfo: `userAgentData.getHighEntropyValues(hints) → Promise<object>\n请求 hints = ['architecture', 'bitness', 'model', 'platformVersion', 'uaFullVersion', 'fullVersionList']\n结果：\n${JSON.stringify(hev, null, 2)}\n\n说明：高熵值需异步请求（避免被动指纹）；architecture='x86'/'arm'；bitness='32'/'64'；platformVersion=操作系统版本；uaFullVersion=完整浏览器版本；fullVersionList=所有品牌完整版本（含 Chromium 标记）。` });
      this._addLog('ua', `getHighEntropyValues：architecture=${hev.architecture}，platformVersion=${hev.platformVersion}`);
    } catch (err) {
      this._addLog('warn', `getHighEntropyValues 失败：${err.name} - ${err.message}`);
      this.setState({ uaInfo: `getHighEntropyValues 失败：${err.name} - ${err.message}` });
    }
  }

  _renderCard6() {
    const s = this.state;
    const caps = this._caps();
    const card = new Card({
      title: '6. User-Agent Client Hints',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: caps.uaData ? 'success' : 'error' }, caps.uaData ? 'userAgentData ✓' : '不可用'),
        h(Tag, { color: 'primary' }, 'brands / getHighEntropyValues'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'navigator.userAgentData（UserAgentData 对象）替代 navigator.userAgent 字符串解析。低熵信息同步读取：brands（[{ brand, version }] 浏览器品牌列表）、mobile（boolean）、platform（"Windows"|"macOS"|"Linux"|"Android"|"iOS"）。高熵信息通过 getHighEntropyValues(hints) → Promise 异步获取：architecture、bitness、model、platformVersion、uaFullVersion、fullVersionList。高熵值需主动请求以减少被动指纹。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('低熵 brands/mobile/platform', { type: 'primary', size: 'sm', disabled: !caps.uaData, onClick: () => this._showUaBasic() }),
          this._btn('getHighEntropyValues', { type: 'primary', size: 'sm', disabled: !caps.uaData, onClick: () => this._getHighEntropy() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, 'User-Agent Client Hints 信息：'),
        h('pre', { class: 'code-block', style: { maxHeight: '260px', overflow: 'auto' } },
          h('code', {}, s.uaInfo || '（点击 低熵信息 / getHighEntropyValues）')),
        h('div', { class: 'fs-sm text-secondary mt-sm' }, '参考用法：'),
        h('pre', { class: 'code-block', style: { maxHeight: '120px', overflow: 'auto' } },
          h('code', {},
`// 低熵：同步读取
const { brands, mobile, platform } = navigator.userAgentData;
// 高熵：异步请求（按需索取，减少指纹）
const hev = await navigator.userAgentData.getHighEntropyValues([
  'architecture', 'bitness', 'platformVersion', 'uaFullVersion',
]);
// 也可通过 HTTP 头：Sec-CH-UA / Sec-CH-UA-Platform / Sec-CH-UA-Mobile
// 服务器按 Accept-CH 声明需要的提示`)),
        h(Alert, {
          type: 'info',
          message: 'User-Agent Client Hints 替代 userAgent 字符串解析',
          description: 'navigator.userAgent 历史包袱重且易被伪造、难解析。User-Agent Client Hints 提供结构化字段，低熵信息同步可读，高熵信息按需异步请求（减少被动指纹）。jsdom 未实现，需真实浏览器（较新 Chrome/Edge）演示；Firefox/Safari 支持程度不一。',
        }),
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
    return h('div', { class: 'page api-lab-page' },
      h('h2', { class: 'section-title' }, '存储访问与多源隔离实验室'),
      h('p', { class: 'fs-sm text-secondary mb-md' },
        '存储访问与多源隔离是现代浏览器隐私模型的核心。本页演示 Storage Access API、Storage Buckets、StorageManager、Cookie Store API、First-Party Sets + CHIPS、User-Agent Client Hints。'),
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
