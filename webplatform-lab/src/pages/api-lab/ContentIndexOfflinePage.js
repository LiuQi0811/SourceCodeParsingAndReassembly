// =====================================================================
// ContentIndexOfflinePage.js —— Content Indexing + 后台同步深度 实验室
// 演示 MDN：
//   1. Content Indexing API 内容索引 —— registration.index.add/delete/getAll
//        + ServiceWorker contentdelete 事件（e.id / e.reason）
//   2. Background Sync API 后台同步 —— registration.sync.register/getTags
//        + sync 事件 / event.waitUntil / event.tag / event.lastChance + 重试与回退策略
//   3. Periodic Background Sync API 周期性后台同步 —— registration.periodicSync
//        .register(tag, { minInterval }) / getTags / unregister + periodicsync 事件 + 权限/频率
//   4. Background Fetch API 后台获取 —— registration.backgroundFetch.fetch
//        + BackgroundFetchRegistration（id/uploadTotal/downloadTotal/uploaded/downloaded
//        /result/failureReason/recordsAvailable/onprogress/abort/match/matchAll）
//        + backgroundfetchsuccess/fail/abort/click 事件
//   5. 离线策略与 Cache Storage 协同 —— Content Indexing + Background Sync + Cache
//        + Periodic Sync + contentdelete 组合的离线优先 PWA 模式 + Cache 版本管理
//   6. 后台任务能力检测矩阵与降级 —— 全量能力检测 ✓/✗ 矩阵 + 降级策略 + 浏览器支持说明
// 说明：本页聚焦 Content Indexing 与 Background Sync/Periodic Sync/Fetch 深度用法，
//       与 ServiceWorkerPage（生命周期/fetch 拦截/Cache 策略）和 BackgroundServicesPage
//       （Push/Notification/Sync 基础）互补，不重复其基础内容。
//       所有 API 需 HTTPS + 活动 ServiceWorkerRegistration，jsdom 中 navigator.serviceWorker
//       已 mock（register 抛错），registration.* 系列将降级为说明；一切调用前做能力检测，
//       不可用仅记 _addLog('warn'/'info', ...)，绝不抛异常。
// =====================================================================
import { Page } from '../../core/Component.js';
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';

export class ContentIndexOfflinePage extends Page {
  // —— 初始 state ——
  initialState() {
    return {
      logs: [],
      capsSummary: '',
      // Card 1：Content Indexing API
      contentIndexInfo: '',
      // Card 2：Background Sync API 深度
      bgSyncInfo: '',
      // Card 3：Periodic Background Sync API
      periodicSyncInfo: '',
      // Card 4：Background Fetch API
      bgFetchInfo: '',
      // Card 5：离线策略与 Cache Storage 协同
      offlineStrategyInfo: '',
      // Card 6：能力检测矩阵与降级
      matrixInfo: '',
    };
  }

  // —— 生命周期 ——
  componentDidMount() {
    // ★★★ 关键守卫：必须存在！否则 setState => rerender => componentDidMount 死循环导致 OOM
    if (this._inited) return;
    this._inited = true;

    // 一次性初始化各实例引用（componentWillUnmount 中释放）
    this._registration = null;          // ServiceWorkerRegistration 引用（用于 .index/.sync 等）
    this._bgFetchReg = null;            // Card 4 BackgroundFetchRegistration 引用
    this._abortController = (typeof AbortController !== 'undefined')
      ? new AbortController() : null;
    this._contentDeleteHandler = null;  // contentdelete 事件句柄

    // 一次性能力检测：Content Indexing + 后台任务全家桶
    const hasSW = typeof navigator !== 'undefined' && 'serviceWorker' in navigator;
    const hasCaches = typeof caches !== 'undefined';
    const hasNotif = typeof Notification !== 'undefined';
    const hasSyncManager = typeof SyncManager !== 'undefined';
    const hasBgFetchMgr = typeof BackgroundFetchManager !== 'undefined';

    const parts = [];
    parts.push(`serviceWorker ${hasSW ? '✓' : '✗'}`);
    parts.push(`caches ${hasCaches ? '✓' : '✗'}`);
    parts.push(`Notification ${hasNotif ? '✓' : '✗'}`);
    parts.push(`SyncManager ${hasSyncManager ? '✓' : '✗'}`);
    parts.push(`BackgroundFetchManager ${hasBgFetchMgr ? '✓' : '✗'}`);

    const anyCap = hasSW || hasCaches;
    const summary = anyCap
      ? `Content Indexing + 后台任务能力检测：${parts.join(' · ')}。registration.index / registration.sync / registration.periodicSync / registration.backgroundFetch 均需活动 ServiceWorkerRegistration，jsdom 中 navigator.serviceWorker 已 mock（register 抛错），故全部降级为 API 形态说明。所有按钮调用前做能力检测，不可用仅记日志。`
      : `当前环境不支持 serviceWorker / caches（typeof 均为 "undefined"）；所有按钮点击仅记 API 形态说明，不会抛异常。在真实浏览器 + HTTPS 中打开可完整演示。`;

    this.setState({ capsSummary: summary });
    this._addLog('info', `能力检测：${parts.join('，')}`);
    if (!hasSW) this._addLog('warn', 'serviceWorker 不可用（jsdom 已 mock，register 抛错），registration.* 系列降级为说明');
    if (!hasSyncManager) this._addLog('warn', 'SyncManager 构造器不可用（registration.sync 在真实浏览器可用）');
    if (!hasBgFetchMgr) this._addLog('warn', 'BackgroundFetchManager 构造器不可用（registration.backgroundFetch 在 Chrome/Edge 可用）');
  }

  componentWillUnmount() {
    // 释放 BackgroundFetchRegistration（abort 中止后台获取）
    if (this._bgFetchReg && typeof this._bgFetchReg.abort === 'function') {
      try { this._bgFetchReg.abort(); } catch { /* noop */ }
    }
    this._bgFetchReg = null;
    // 移除 contentdelete 事件监听（若注册过）
    if (this._contentDeleteHandler && this._registration
      && typeof this._registration.removeEventListener === 'function') {
      try { this._registration.removeEventListener('contentdelete', this._contentDeleteHandler); }
      catch { /* noop */ }
    }
    // AbortController abort（中止可能的 fetch）
    if (this._abortController) {
      try { this._abortController.abort(); } catch { /* noop */ }
    }
    this._registration = null;
    this._contentDeleteHandler = null;
    this._abortController = null;
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

  // _caps(items)：传入 [{ name, ok }] 数组，返回 Tag 组件数组（✓/✗）
  _caps(items) {
    return items.map((it) =>
      h(Tag, { color: it.ok ? 'success' : 'error' }, `${it.name} ${it.ok ? '✓' : '✗'}`),
    );
  }

  // 统一获取 registration（jsdom 中 getRegistration 可能返回 undefined 或抛错）
  async _getRegistration() {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return null;
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      this._registration = reg || null;
      return reg || null;
    } catch (err) {
      this._addLog('warn', `getRegistration 失败（环境限制）：${err.message}`);
      return null;
    }
  }

  // =================== Card 1：Content Indexing API ===================

  async _checkContentIndex() {
    const reg = await this._getRegistration();
    if (!reg) {
      this._addLog('warn', '无 ServiceWorkerRegistration，无法访问 registration.index（需真实 SW + HTTPS）');
      this.setState({ contentIndexInfo:
        'Content Indexing API 不可用：无活动 ServiceWorkerRegistration。\n\n' +
        "前置条件：HTTPS 安全上下文 + 已注册激活的 SW；检测：registration && ('index' in registration)\n\n" +
        '说明：jsdom 中 navigator.serviceWorker 已 mock（register 抛错），无法获取真实 registration，\n' +
        '  本演示降级为 API 形态说明。在真实浏览器中注册 SW 后即可调用 registration.index.*。' });
      return;
    }
    const hasIndex = 'index' in reg;
    if (!hasIndex) {
      this._addLog('warn', "registration.index 不存在（Content Indexing API 不可用，需 Chrome/Edge 84+）");
      this.setState({ contentIndexInfo:
        "Content Indexing API 不可用：'index' in registration === false。\n\n" +
        '浏览器支持：Chrome/Edge 84+；Firefox/Safari 不支持。\n' +
        '说明：Content Indexing 让 PWA 注册离线内容到浏览器下载/库，用户无需导航到 PWA 即可发现。' });
      return;
    }
    try {
      const list = await reg.index.getAll();
      this._addLog('info', `index.getAll() => ${list.length} 条 ContentDescription`);
      this.setState({ contentIndexInfo:
        'Content Indexing API 可用：\n' +
        `  'index' in registration = true\n` +
        `  registration.index.getAll() => ${list.length} 条 ContentDescription\n\n` +
        'API 表面：\n' +
      '  registration.index → ContentIndex\n' +
      '  index.add({ id, url, title, description, icons, category }) → Promise<void>\n' +
      '  index.delete(id) → Promise<void>；index.getAll() → Promise<ContentDescription[]>\n' +
      '  category 取值：homepage | article | video | audio | note | ""\n\n' +
        '用途：使离线内容在浏览器下载/库中可发现，无需导航到 PWA。' });
    } catch (err) {
      this._addLog('warn', `index.getAll 失败：${err.message}`);
    }
  }

  _showSampleContent() {
    const sample = {
      id: 'article-' + Date.now(),
      url: '/articles/offline-guide',
      title: '离线指南',
      description: 'Content Indexing 演示：使离线内容在浏览器下载库中可发现',
      icons: [
        { src: '/icons/article-192.png', sizes: '192x192', type: 'image/png', label: 'Article Icon' },
        { src: '/icons/article-512.png', sizes: '512x512', type: 'image/png', label: 'Article Icon HD' },
      ],
      category: 'article',
    };
    this.setState({ contentIndexInfo:
      '示例 ContentDescription 对象（add 的参数）：\n\n' +
      JSON.stringify(sample, null, 2) +
      '\n\n字段说明：\n' +
      '  id —— 唯一标识（delete(id) 用此）；url —— 离线可访问 URL（需已缓存于 Cache Storage）\n' +
      '  title / description —— 浏览器下载/库显示的标题与描述\n' +
      '  icons —— 图标数组 [{ src, sizes, type, label }]；category —— homepage|article|video|audio|note|""\n\n' +
      '调用：await registration.index.add(sample);\n' +
      '效果：浏览器在下载/库中展示该内容，用户无需打开 PWA 即可发现离线内容。' });
    this._addLog('info', `构造示例 ContentDescription：id=${sample.id}, category=${sample.category}`);
  }

  _demoContentDeleteEvent() {
    this.setState({ contentIndexInfo:
      'contentdelete 事件（在 ServiceWorker 全局监听）：\n\n' +
      '// sw.js\n' +
      'self.addEventListener("contentdelete", (event) => {\n' +
      '  console.log("contentdelete:", event.id, event.reason);\n' +
      '  event.waitUntil(\n' +
      '    caches.open("content-v1").then((cache) => cache.delete(`/articles/${event.id}`))\n' +
      '  );\n' +
      '});\n\n' +
      '触发时机：用户从浏览器 UI（下载/库）删除已索引内容时浏览器派发。\n' +
      '事件属性：event.id —— 被删除内容 id（对应 add 时的 id）；event.reason —— 删除原因（如 "deleted"）\n\n' +
      '用途：用户在浏览器 UI 删除离线内容时，同步清理 Cache Storage 中的对应资源，\n' +
      '  保持索引与缓存一致。需在 SW 中用 event.waitUntil() 包裹清理逻辑以保持 SW 存活。' });
    this._addLog('info', '已展示 contentdelete 事件用法（在 ServiceWorker 全局监听）');
  }

  _renderCard1() {
    const s = this.state;
    const card = new Card({
      title: '1. Content Indexing API 内容索引',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: 'primary' }, 'registration.index'),
        ...this._caps([
          { name: 'ContentIndex', ok: typeof ContentIndex !== 'undefined' },
        ]),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '通过 ServiceWorkerRegistration.index 访问 ContentIndex。index.add({ id, url, title, description, icons, category }) 注册离线内容，index.delete(id) 删除，index.getAll() 列出。category 取 homepage/article/video/audio/note/""。ServiceWorker 中监听 contentdelete 事件（e.id / e.reason），用户从浏览器下载/库删除已索引内容时触发。用途：让离线内容在浏览器下载/库中可发现，无需导航到 PWA。前置：需活动 ServiceWorkerRegistration。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('检测 index 支持 + getAll', { type: 'primary', size: 'sm', onClick: () => this._checkContentIndex() }),
          this._btn('示例 ContentDescription', { size: 'sm', onClick: () => this._showSampleContent() }),
          this._btn('contentdelete 事件', { size: 'sm', onClick: () => this._demoContentDeleteEvent() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, 'Content Indexing 状态：'),
        h('pre', { class: 'code-block', style: { maxHeight: '280px', overflow: 'auto' } },
          h('code', {}, s.contentIndexInfo || '（点击「检测 index 支持」或对应演示按钮）')),
        h(Alert, {
          type: 'info',
          message: 'Content Indexing 让离线内容在浏览器原生 UI 中可发现',
          description: '与 Cache Storage 配合：先把资源缓存到 Cache，再 index.add() 注册元数据，浏览器下载/库会展示这些离线内容。用户删除时浏览器派发 contentdelete 事件，PWA 在 SW 中清理对应 Cache。浏览器支持：Chrome/Edge 84+，Firefox/Safari 不支持。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 2：Background Sync API 深度 ===================

  async _checkBgSync() {
    const reg = await this._getRegistration();
    if (!reg) {
      this._addLog('warn', '无 ServiceWorkerRegistration，无法访问 registration.sync');
      this.setState({ bgSyncInfo:
        'Background Sync API 不可用：无活动 ServiceWorkerRegistration。\n\n' +
        "检测：const hasSync = registration && 'sync' in registration;\n" +
        '浏览器支持：Chrome/Edge 全支持；Firefox/Safari 不支持。\n\n' +
        'API 表面：\n' +
        '  registration.sync → SyncManager\n' +
        "  sync.register('sync-tag-name') → Promise<void>  // 排队一个 sync 事件\n" +
        '  sync.getTags() → Promise<string[]>\n\n' +
        '说明：jsdom 无真实 registration，降级为 API 形态说明。' });
      return;
    }
    const hasSync = 'sync' in reg;
    if (!hasSync) {
      this._addLog('warn', "registration.sync 不存在（Background Sync 不可用，Chrome/Edge only）");
      this.setState({ bgSyncInfo:
        "Background Sync API 不可用：'sync' in registration === false。\n" +
        '浏览器支持：Chrome/Edge；Firefox/Safari 不支持。' });
      return;
    }
    try {
      const tag = 'offline-sync-' + Date.now();
      await reg.sync.register(tag);
      const tags = await reg.sync.getTags();
      this._addLog('info', `sync.register('${tag}') 完成，getTags() => [${tags.join(', ')}]`);
      this.setState({ bgSyncInfo:
        'Background Sync API 可用：\n' +
        `  'sync' in registration = true\n` +
        `  sync.register('${tag}') 完成\n` +
        `  sync.getTags() => [${tags.join(', ')}]\n\n` +
        '触发时机（浏览器决定，不可控）：\n' +
        '  1) 在线 → sync 事件立即触发；2) 离线 → 网络恢复时触发（即使 app 关闭，浏览器会唤醒 SW）\n' +
        '  3) event.waitUntil(promise) reject → 浏览器带 backoff 重试\n\n' +
        'SW 中监听：self.addEventListener("sync", (event) => { ... })' });
    } catch (err) {
      this._addLog('warn', `sync.register 失败（环境限制）：${err.message}`);
    }
  }

  _explainSyncRetry() {
    this.setState({ bgSyncInfo:
      'Background Sync 重试与生命周期策略：\n\n' +
      '// sw.js —— sync 事件处理\n' +
      "self.addEventListener('sync', (event) => {\n" +
      "  if (event.tag === 'sync-tag-name') {\n" +
      '    event.waitUntil(doSyncWork());  // ★ 必须 waitUntil，否则 SW 可能被立即终止\n' +
      '  }\n' +
      '});\n\n' +
      'async function doSyncWork() {\n' +
      '  try {\n' +
      '    const resp = await fetch("/api/sync", { method: "POST", body: ... });\n' +
      '    if (!resp.ok) throw new Error("non-ok");  // reject 触发重试\n' +
      '    // 成功：从 outbox 清除待发数据\n' +
      '  } catch (err) {\n' +
      '    if (event.lastChance) await persistToOutbox();  // ★ 最后一次重试，持久化防丢失\n' +
      '    throw err;  // reject → 浏览器带 backoff 重新派发 sync\n' +
      '  }\n' +
      '}\n\n' +
      '关键点：\n' +
      '  1. event.waitUntil(promise) ★★★ —— 保持 SW 存活直到完成，不调用 SW 可能被终止\n' +
      '  2. event.tag —— 标识任务（register 时传入），同 tag 只排队一个\n' +
      '  3. event.lastChance (boolean) —— true 表示最后一次重试，应持久化待发数据避免丢失\n' +
      '  4. waitUntil reject → 浏览器以指数 backoff 重试；app/页面关闭也会唤醒 SW\n\n' +
      '用途：离线发消息/表单提交、后台数据同步、断网重连自动上传。' });
    this._addLog('info', '已展示 Background Sync 重试策略与 event.waitUntil / lastChance 用法');
  }

  _renderCard2() {
    const s = this.state;
    const card = new Card({
      title: '2. Background Sync API 后台同步（深度）',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: 'primary' }, 'registration.sync'),
        ...this._caps([
          { name: 'SyncManager', ok: typeof SyncManager !== 'undefined' },
        ]),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'ServiceWorkerRegistration.sync 返回 SyncManager。sync.register(tag) 排队一个 sync 事件（在线立即触发，离线待网络恢复触发，即使 app 关闭浏览器也会唤醒 SW）；sync.getTags() 列出已注册标签。SW 中 self.addEventListener("sync", event) 监听，event.tag 标识任务，event.waitUntil(promise) ★★★ 保持 SW 存活直到完成（不调用 SW 可能被终止），event.lastChance 表示最后一次重试。waitUntil reject 时浏览器以指数 backoff 重试。浏览器支持：Chrome/Edge only（Firefox/Safari 不支持）。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('检测 sync + 注册 tag', { type: 'primary', size: 'sm', onClick: () => this._checkBgSync() }),
          this._btn('重试策略与 lastChance', { size: 'sm', onClick: () => this._explainSyncRetry() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, 'Background Sync 状态：'),
        h('pre', { class: 'code-block', style: { maxHeight: '320px', overflow: 'auto' } },
          h('code', {}, s.bgSyncInfo || '（点击「检测 sync」或「重试策略」按钮）')),
        h(Alert, {
          type: 'warning',
          message: 'event.waitUntil() 是 Background Sync 的生命线',
          description: '不调用 waitUntil，浏览器可能在 sync 任务完成前终止 SW。lastChance=true 时务必持久化待发数据，否则下次不再重试将永久丢失。Background Sync 仅 Chrome/Edge 支持，需配合降级策略（监听 online 事件 + 轮询）。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 3：Periodic Background Sync API ===================

  async _checkPeriodicSync() {
    const reg = await this._getRegistration();
    if (!reg) {
      this._addLog('warn', '无 ServiceWorkerRegistration，无法访问 registration.periodicSync');
      this.setState({ periodicSyncInfo:
        'Periodic Background Sync API 不可用：无活动 ServiceWorkerRegistration。\n\n' +
        "检测：const hasPeriodic = registration && 'periodicSync' in registration;\n" +
        '前置：需 PWA 安装 + 用户授权 + Chrome/Edge 80+\n\n' +
        'API 表面：\n' +
        '  registration.periodicSync → PeriodicSyncManager\n' +
        "  periodicSync.register('tag', { minInterval: 86400000 }) → Promise<void>\n" +
        "  periodicSync.getTags() → Promise<string[]>；periodicSync.unregister('tag') → Promise<void>\n\n" +
        '说明：minInterval 是请求的最小间隔（ms），实际频率由浏览器按站点参与度/电量/网络决定。' });
      return;
    }
    const hasPeriodic = 'periodicSync' in reg;
    if (!hasPeriodic) {
      this._addLog('warn', "registration.periodicSync 不存在（Periodic Sync 不可用，需 PWA 安装 + 授权）");
      this.setState({ periodicSyncInfo:
        "Periodic Background Sync API 不可用：'periodicSync' in registration === false。\n\n" +
        '前置：PWA 已安装 + 用户授权 periodic-background-sync 权限 + Chrome/Edge 80+\n' +
        '比 Background Sync 更严格：需安装 + 授权 + 站点参与度。' });
      return;
    }
    try {
      const tag = 'update-content';
      const minInterval = 24 * 60 * 60 * 1000; // 24h
      await reg.periodicSync.register(tag, { minInterval });
      const tags = await reg.periodicSync.getTags();
      this._addLog('info', `periodicSync.register('${tag}', { minInterval: 24h }) 完成，getTags() => [${tags.join(', ')}]`);
      this.setState({ periodicSyncInfo:
        'Periodic Background Sync API 可用：\n' +
        `  'periodicSync' in registration = true\n` +
        `  periodicSync.register('${tag}', { minInterval: ${minInterval} }) 完成\n` +
        `  periodicSync.getTags() => [${tags.join(', ')}]\n\n` +
        'minInterval：请求的最小间隔（ms），实际 12h+；浏览器按参与度/电量/网络决定真实频率' });
    } catch (err) {
      this._addLog('warn', `periodicSync.register 失败（环境限制）：${err.message}`);
    }
  }

  _explainPeriodicFreq() {
    this.setState({ periodicSyncInfo:
      'Periodic Background Sync 频率与权限：\n\n' +
      '// 主线程注册\n' +
      "const status = await navigator.permissions.query({ name: 'periodic-background-sync' });\n" +
      "if (status.state !== 'granted') return;  // 需用户授权 + PWA 已安装\n" +
      "await registration.periodicSync.register('update-content', {\n" +
      '  minInterval: 24 * 60 * 60 * 1000,  // 24h，最小请求间隔\n' +
      '});\n\n' +
      '// sw.js —— periodicsync 事件\n' +
      "self.addEventListener('periodicsync', (event) => {\n" +
      "  if (event.tag === 'update-content') event.waitUntil(updateContent());  // ★ waitUntil 保持 SW 存活\n" +
      '});\n\n' +
      '权限与频率说明：\n' +
      '  1. 权限：periodic-background-sync Permission Policy，需用户授权\n' +
      '  2. 安装：PWA 必须已安装（add to home screen）；minInterval 至少 12 小时\n' +
      '  3. 真实频率：浏览器按站点参与度/电量/网络综合决定，可能远大于 minInterval\n' +
      '  4. unregister：await registration.periodicSync.unregister("update-content")\n\n' +
      '与 Background Sync 区别：Sync 一次性（网络恢复即触发），Periodic Sync 周期性（按间隔重复）；\n' +
      '  Periodic Sync 更严格（需安装+授权+参与度），无 lastChance（不重试，下次周期再跑）\n\n' +
      '典型场景：新闻 app 每日刷新文章缓存、邮件 app 检查新邮件、播客 app 更新订阅。' });
    this._addLog('info', '已展示 Periodic Sync 权限/频率与 periodicsync 事件用法');
  }

  _renderCard3() {
    const s = this.state;
    const card = new Card({
      title: '3. Periodic Background Sync API 周期性后台同步',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: 'primary' }, 'registration.periodicSync'),
        ...this._caps([
          { name: 'PeriodicSyncManager', ok: typeof PeriodicSyncManager !== 'undefined' },
        ]),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'ServiceWorkerRegistration.periodicSync 返回 PeriodicSyncManager。periodicSync.register(tag, { minInterval }) 注册周期同步（minInterval 单位 ms，实践至少 12 小时，真实频率由浏览器按站点参与度/电量/网络决定）；periodicSync.getTags() 列出标签；periodicSync.unregister(tag) 注销。SW 中 self.addEventListener("periodicsync", event) 监听，event.waitUntil(promise) 保持 SW 存活。权限：periodic-background-sync Permission Policy，需 PWA 已安装 + 用户授权。比 Background Sync 更严格，无 lastChance（不重试）。典型场景：新闻刷新、邮件检查。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('检测 periodicSync + 注册', { type: 'primary', size: 'sm', onClick: () => this._checkPeriodicSync() }),
          this._btn('权限/频率/periodicsync 事件', { size: 'sm', onClick: () => this._explainPeriodicFreq() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, 'Periodic Background Sync 状态：'),
        h('pre', { class: 'code-block', style: { maxHeight: '320px', overflow: 'auto' } },
          h('code', {}, s.periodicSyncInfo || '（点击「检测 periodicSync」或「权限/频率」按钮）')),
        h(Alert, {
          type: 'warning',
          message: 'Periodic Sync 比 Background Sync 更严格',
          description: '需 PWA 已安装 + 用户授权 + 站点参与度，浏览器才会按间隔唤醒 SW。minInterval 只是请求的最小值，真实频率可能远大于此。无 lastChance（失败不重试，下个周期再跑）。降级策略：在 app 启动 + visibilitychange 时手动刷新。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 4：Background Fetch API ===================

  async _checkBgFetch() {
    const reg = await this._getRegistration();
    if (!reg) {
      this._addLog('warn', '无 ServiceWorkerRegistration，无法访问 registration.backgroundFetch');
      this.setState({ bgFetchInfo:
        'Background Fetch API 不可用：无活动 ServiceWorkerRegistration。\n\n' +
        "检测：const hasBgFetch = registration && 'backgroundFetch' in registration;\n" +
        '浏览器支持：Chrome/Edge 74+；Firefox/Safari 不支持。\n\n' +
        'API 表面（与 sync 独立的 BackgroundFetchManager）：\n' +
        '  registration.backgroundFetch → BackgroundFetchManager\n' +
        '  backgroundFetch.fetch(id, requests, { title, icons, downloadTotal })\n' +
        '    → Promise<BackgroundFetchRegistration>；requests: Request[] | URL[] | string[]\n' +
        '  backgroundFetch.get(id) / .getAll() → 查询已有 fetch 任务\n\n' +
        '用途：长时间下载（播客/视频），即使页面关闭也继续，浏览器通知栏显示进度。' });
      return;
    }
    const hasBgFetch = 'backgroundFetch' in reg;
    if (!hasBgFetch) {
      this._addLog('warn', "registration.backgroundFetch 不存在（Background Fetch 不可用，Chrome/Edge only）");
      this.setState({ bgFetchInfo:
        "Background Fetch API 不可用：'backgroundFetch' in registration === false。\n" +
        '浏览器支持：Chrome/Edge 74+；Firefox/Safari 不支持。' });
      return;
    }
    try {
      // 构造示例 fetch 调用（不真正发起，避免真实下载）
      const sampleId = 'podcast-ep-' + Date.now();
      const sampleRequests = [new Request('https://example.com/podcast/ep1.mp3'), 'https://example.com/podcast/ep2.mp3'];
      this._addLog('info', `构造示例 backgroundFetch.fetch('${sampleId}', [${sampleRequests.length} requests])`);
      this.setState({ bgFetchInfo:
        'Background Fetch API 可用：\n' +
        `  'backgroundFetch' in registration = true\n` +
        `  示例 id = ${sampleId}\n` +
        `  示例 requests = [${sampleRequests.map((r) => r.url || r).join(', ')}]\n\n` +
        '调用示例（真实浏览器中发起）：\n' +
        '  const bgFetchReg = await registration.backgroundFetch.fetch(\n' +
        `    '${sampleId}',\n` +
        '    [new Request("https://example.com/podcast/ep1.mp3"), "https://example.com/ep2.mp3"],\n' +
        '    { title: "播客下载", icons: [{ src: "/icon.png", sizes: "192x192", type: "image/png" }],\n' +
        '      downloadTotal: 50 * 1024 * 1024 }  // 预估总大小（字节，用于进度条）\n' +
        '  );\n  // → BackgroundFetchRegistration\n\n' +
        '注意：本演示不真正发起（避免真实下载），仅展示调用形态。' });
    } catch (err) {
      this._addLog('warn', `构造示例 backgroundFetch.fetch 失败：${err.message}`);
    }
  }

  _explainBgFetchObject() {
    this.setState({ bgFetchInfo:
      'BackgroundFetchRegistration 对象字段与事件：\n\n' +
      '属性（只读）：\n' +
      '  .id              —— fetch 任务 id（fetch 时传入）\n' +
      '  .uploadTotal     —— 上传总字节；.uploaded —— 已上传字节（实时）\n' +
      '  .downloadTotal   —— 下载总字节；.downloaded —— 已下载字节（实时）\n' +
      "  .result          —— '' | 'success' | 'failure'（完成后）\n" +
      "  .failureReason   —— '' | 'aborted' | 'bad-status' | 'fetch-error' | 'quota-exceeded'\n" +
      '  .recordsAvailable —— boolean（是否仍有记录可查）\n\n' +
      '事件 / 方法：\n' +
      '  .onprogress      —— 进度事件（可读取 uploaded/downloaded）\n' +
      '  .abort()         → Promise<boolean>  // 中止 fetch\n' +
      '  .match(request)  → Promise<BackgroundFetchRecord | undefined>；.matchAll() → Promise<[]>\n\n' +
      '// 主线程进度监听\n' +
      'bgFetchReg.onprogress = (event) => {\n' +
      '  const pct = (event.target.downloaded / event.target.downloadTotal) * 100;\n' +
      '  console.log(`下载进度: ${pct.toFixed(1)}%`);\n};\n\n' +
      '// sw.js —— Background Fetch 事件\n' +
      'self.addEventListener("backgroundfetchsuccess", (e) => e.waitUntil(updateUI({ title: "下载完成" })));\n' +
      'self.addEventListener("backgroundfetchfail", (e) => e.waitUntil(updateUI({ title: "下载失败" })));\n' +
      'self.addEventListener("backgroundfetchabort", (e) => console.log("用户中止下载", e.registrationId));\n' +
      'self.addEventListener("backgroundfetchclick", (e) => clients.openWindow("/downloads"));\n\n' +
      '用途：播客/视频/大文件后台下载，即使页面关闭也继续，浏览器通知栏显示进度与结果。' });
    this._addLog('info', '已展示 BackgroundFetchRegistration 字段、onprogress 与 SW 事件用法');
  }

  _renderCard4() {
    const s = this.state;
    const card = new Card({
      title: '4. Background Fetch API 后台获取',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: 'primary' }, 'registration.backgroundFetch'),
        ...this._caps([
          { name: 'BackgroundFetchManager', ok: typeof BackgroundFetchManager !== 'undefined' },
        ]),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'ServiceWorkerRegistration.backgroundFetch 返回 BackgroundFetchManager（与 sync 独立）。backgroundFetch.fetch(id, requests, { title, icons, downloadTotal, options }) 发起后台获取，requests 可为 Request[]/URL[]/string[]，返回 BackgroundFetchRegistration。Registration 含 .id/.uploadTotal/.downloadTotal/.uploaded/.downloaded（实时字节）、.result（success/failure）、.failureReason（aborted/bad-status/fetch-error/quota-exceeded）、.recordsAvailable、.onprogress 事件；方法 .abort()/.match(request)/.matchAll()。SW 中监听 backgroundfetchsuccess/fail/abort/click 事件。用途：播客/视频/大文件后台下载，页面关闭仍继续，浏览器通知栏显示进度。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('检测 backgroundFetch + 示例', { type: 'primary', size: 'sm', onClick: () => this._checkBgFetch() }),
          this._btn('Registration 字段/事件', { size: 'sm', onClick: () => this._explainBgFetchObject() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, 'Background Fetch 状态：'),
        h('pre', { class: 'code-block', style: { maxHeight: '340px', overflow: 'auto' } },
          h('code', {}, s.bgFetchInfo || '（点击「检测 backgroundFetch」或「Registration 字段」按钮）')),
        h(Alert, {
          type: 'info',
          message: 'Background Fetch 是长时间下载的后台任务',
          description: '与 Background Sync 不同：Sync 是"网络恢复时执行一次性任务"，Fetch 是"持续下载直到完成"。页面关闭后浏览器继续下载并在通知栏显示进度，完成后派发 backgroundfetchsuccess/fail 事件。仅 Chrome/Edge 支持，降级策略：用 fetch() + ReadableStream 进度（但页面必须保持打开）。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 5：离线策略与 Cache Storage 协同 ===================

  _showOfflineFlow() {
    this.setState({ offlineStrategyInfo:
      '离线优先 PWA 完整策略流程（Content Indexing + Background Sync + Cache + Periodic Sync 组合）：\n\n' +
      '===== 时序图（text-based）=====\n\n' +
      '  [用户在线访问]\n       │\n       ▼\n' +
      '  (1) Background Sync 触发 → fetch 新内容（联网时自动）\n       │\n       ▼\n' +
      '  (2) 存入 Cache Storage：caches.open("content-v1").put(req, resp)\n       │\n       ▼\n' +
      '  (3) Content Indexing 注册：registration.index.add({ id, url, title, ... })\n' +
      '      → 浏览器下载/库展示，离线可发现\n       │\n       ▼\n' +
      '  (4) Periodic Sync 每日刷新 → 重复 (1)-(3)\n       │\n       ▼\n' +
      '  [用户离线访问]\n       │\n       ▼\n' +
      '  (5) SW fetch 拦截 → 查 Cache → 命中返回 / 未命中回退网络 / 全失败回退离线页\n       │\n       ▼\n' +
      '  [用户在浏览器 UI 删除离线内容]\n       │\n       ▼\n' +
      '  (6) contentdelete 事件 → 清理 Cache Storage 中对应资源\n       │\n       ▼\n' +
      '  完成（索引与缓存保持一致）\n\n' +
      '===== 各步骤代码 =====\n\n' +
      '// (1)(2)(3) 在 sync 事件中：拉取 + 缓存 + 索引\n' +
      "self.addEventListener('sync', (event) => {\n" +
      "  if (event.tag === 'refresh-content') event.waitUntil(refreshAndIndex());\n" +
      '});\n' +
      'async function refreshAndIndex() {\n' +
      '  const resp = await fetch("/api/articles/latest");\n' +
      '  const cache = await caches.open("content-v1");\n' +
      '  await cache.put("/articles/latest", resp.clone());\n' +
      '  // Content Indexing 注册元数据（让离线内容在浏览器下载/库可发现）\n' +
      '  await self.registration.index.add({\n' +
      '    id: "latest-articles", url: "/articles/latest", title: "最新文章",\n' +
      '    description: "离线可读的最新文章", category: "article",\n' +
      '    icons: [{ src: "/icons/article.png", sizes: "192x192", type: "image/png" }],\n' +
      '  });\n' +
      '}\n\n' +
      '// (5) SW fetch 拦截：Cache → 网络 → 离线回退\n' +
      "self.addEventListener('fetch', (event) => {\n" +
      '  event.respondWith(\n' +
      '    caches.match(event.request).then((cached) =>\n' +
      '      cached || fetch(event.request).catch(() => caches.match("/offline.html"))\n' +
      '    )\n' +
      '  );\n' +
      '});\n\n' +
      '// (6) contentdelete 清理 Cache\n' +
      "self.addEventListener('contentdelete', (event) => {\n" +
      '  event.waitUntil(\n' +
      '    caches.open("content-v1").then((cache) => cache.delete(`/articles/${event.id}`))\n' +
      '  );\n' +
      '});' });
    this._addLog('info', '已展示离线优先 PWA 完整策略流程（时序图 + 代码）');
  }

  _explainCacheVersioning() {
    this.setState({ offlineStrategyInfo:
      'Cache Storage 版本管理策略（cache key v1/v2 + activate 清理旧版本）：\n\n' +
      '// 版本号常量（发布新版本时递增）\n' +
      "const CACHE_VERSION = 'v2';\n" +
      "const CACHE_NAME = `content-${CACHE_VERSION}`;\n" +
      "const PRECACHE = `precache-${CACHE_VERSION}`;\n\n" +
      '// install：预缓存关键资源（skipWaiting 立即激活新 SW）\n' +
      "self.addEventListener('install', (event) => {\n" +
      '  event.waitUntil(\n' +
      '    caches.open(PRECACHE).then((cache) =>\n' +
      '      cache.addAll(["/", "/offline.html", "/styles.css", "/app.js"]))\n' +
      '  );\n' +
      '  self.skipWaiting();\n' +
      '});\n\n' +
      '// activate：清理旧版本缓存（clients.claim 立即控制客户端）\n' +
      "self.addEventListener('activate', (event) => {\n" +
      '  event.waitUntil((async () => {\n' +
      '    const keys = await caches.keys();\n' +
      '    // 删除所有非当前版本的缓存\n' +
      `    await Promise.all(keys\n` +
      `      .filter((k) => k !== CACHE_NAME && k !== PRECACHE)\n` +
      '      .map((k) => caches.delete(k)));\n' +
      '    await self.clients.claim();\n' +
      '  })());\n' +
      '});\n\n' +
      '版本管理要点：\n' +
      '  1. CACHE_VERSION 递增 → 新版本 SW 安装时预缓存新资源\n' +
      '  2. activate 中 caches.keys() 过滤保留当前版本，删除其余（旧版本）\n' +
      '  3. skipWaiting + clients.claim 让新 SW 立即生效；Content Indexing 的 id 应含版本或在 activate 中重新 index.add()\n' +
      '  4. 失败回退：fetch 拦截中 caches.match("/offline.html") 兜底离线页\n\n' +
      '与 Background Sync 协同：sync 事件拉取新内容时写入当前版本 CACHE_NAME，\n' +
      '旧版本在 activate 中自动清理，避免缓存膨胀与版本错乱。' });
    this._addLog('info', '已展示 Cache 版本管理策略（v1/v2 + activate 清理）');
  }

  _renderCard5() {
    const s = this.state;
    const card = new Card({
      title: '5. 离线策略与 Cache Storage 协同',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: 'primary' }, 'Content Indexing + Sync + Cache'),
        h(Tag, { color: 'warning' }, '组合模式'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'Content Indexing + Background Sync + Cache Storage 组合实现离线优先 PWA：1) Background Sync 在联网时拉取新内容；2) 存入 Cache Storage（caches.open("content-v1").put(request, response)）；3) Content Indexing 注册已缓存内容使其在浏览器下载/库可发现；4) Periodic Sync 每日刷新重复 1-3；5) contentdelete 事件在用户删除索引内容时清理 Cache Storage 保持一致。SW fetch 拦截：Cache → 网络 → 离线回退页。Cache 版本管理：cache key v1/v2 + activate 清理旧版本。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('完整策略流程（时序图+代码）', { type: 'primary', size: 'sm', onClick: () => this._showOfflineFlow() }),
          this._btn('Cache 版本管理', { size: 'sm', onClick: () => this._explainCacheVersioning() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '离线策略组合：'),
        h('pre', { class: 'code-block', style: { maxHeight: '360px', overflow: 'auto' } },
          h('code', {}, s.offlineStrategyInfo || '（点击「完整策略流程」或「Cache 版本管理」按钮）')),
        h(Alert, {
          type: 'info',
          message: '离线优先 PWA = Content Indexing + Sync + Cache 三位一体',
          description: 'Content Indexing 让离线内容在浏览器原生 UI 可发现；Background Sync/Periodic Sync 负责后台刷新保持内容新鲜；Cache Storage 持久化资源；contentdelete 事件保持索引与缓存一致。Cache 版本管理（v1/v2 + activate 清理）避免膨胀与版本错乱。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 6：能力检测矩阵与降级 ===================

  _buildMatrix() {
    const hasSW = typeof navigator !== 'undefined' && 'serviceWorker' in navigator;
    const hasCaches = typeof caches !== 'undefined';
    // registration.* 需活动 SW，jsdom 中无真实 registration，按构造器/特性推断
    const hasContentIndex = typeof ContentIndex !== 'undefined';
    const hasSyncManager = typeof SyncManager !== 'undefined';
    const hasPeriodicSyncManager = typeof PeriodicSyncManager !== 'undefined';
    const hasBgFetchMgr = typeof BackgroundFetchManager !== 'undefined';

    const rows = [
      ['Content Indexing', "'index' in registration", hasContentIndex, '让离线内容在浏览器下载/库可发现'],
      ['Background Sync', "'sync' in registration", hasSyncManager, '网络恢复时一次性后台同步'],
      ['Periodic Background Sync', "'periodicSync' in registration + 权限", hasPeriodicSyncManager, '周期性后台同步（需安装+授权）'],
      ['Background Fetch', "'backgroundFetch' in registration", hasBgFetchMgr, '长时间后台下载'],
      ['Service Worker', "'serviceWorker' in navigator", hasSW, '拦截请求/离线缓存基础'],
      ['Cache Storage', "'caches' in window", hasCaches, '持久化 Response 资源'],
    ];

    const matrixText = rows.map(([name, check, ok, use]) =>
      `  ${ok ? '✓' : '✗'}  ${name.padEnd(24)} 检测：${check.padEnd(34)} 用途：${use}`,
    ).join('\n');

    // 推荐降级策略（基于可用能力）
    const degr = [];
    if (!hasSW) degr.push('无 Service Worker → 在线模式 + localStorage 缓存（无后台能力，app 关闭即停止）');
    else {
      if (!hasSyncManager) degr.push('有 SW 无 Background Sync → 监听 window.online + visibility 轮询同步');
      if (!hasPeriodicSyncManager) degr.push('无 Periodic Sync → app 启动 + visibilitychange 时手动刷新');
      if (!hasContentIndex) degr.push('无 Content Indexing → 在 app 内提供内容列表 UI（浏览器下载库不可见）');
      if (!hasBgFetchMgr) degr.push('无 Background Fetch → 用 fetch() + ReadableStream 进度事件（页面必须保持打开）');
    }
    if (!hasCaches) degr.push('无 Cache Storage → 用 IndexedDB 存储可序列化资源（无法缓存 Response）');

    const degrText = degr.length
      ? degr.map((d, i) => `  ${i + 1}. ${d}`).join('\n')
      : '  全部可用，无需降级。';

    this.setState({ matrixInfo:
      '===== 后台任务能力检测矩阵 =====\n\n' +
      matrixText +
      '\n\n===== 浏览器支持说明 =====\n\n' +
      '  Chrome/Edge：完整支持（SW + Cache + Sync + Index + Periodic Sync + Background Fetch）\n' +
      '  Firefox：部分支持（SW + Cache，无 Sync/Index/Periodic Sync/Background Fetch）\n' +
      '  Safari：部分支持（SW + Cache 自 17 起，无 Sync/Index 等）；jsdom：SW 已 mock、caches 部分可用，\n' +
      '        其余构造器多 undefined，全部降级为说明\n\n' +
      '===== 推荐降级策略（基于当前环境）=====\n\n' +
      degrText });
    this._addLog('info', `能力矩阵：SW=${hasSW}, Cache=${hasCaches}, Index=${hasContentIndex}, Sync=${hasSyncManager}, Periodic=${hasPeriodicSyncManager}, BgFetch=${hasBgFetchMgr}`);
  }

  _renderCard6() {
    const s = this.state;
    const card = new Card({
      title: '6. 后台任务能力检测矩阵与降级',
      extra: h('div', { class: 'flex gap-xs' },
        h(Tag, { color: 'primary' }, '检测矩阵'),
        h(Tag, { color: 'warning' }, '降级策略'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          '聚合检测：ContentIndex（index in registration）、Background Sync（sync in registration）、Periodic Background Sync（periodicSync in registration + 权限）、Background Fetch（backgroundFetch in registration）、Service Worker（serviceWorker in navigator）、Cache Storage（caches in window），输出 ✓/✗ 矩阵。降级策略：无 SW → localStorage 缓存；有 SW 无 Sync → online 事件 + visibility 轮询；无 Periodic Sync → 启动 + visibilitychange 刷新；无 Content Indexing → app 内内容列表 UI；无 Background Fetch → fetch() + 进度事件（页面须保持打开）。浏览器支持：Chrome/Edge 全；Firefox 部分（SW+Cache，无 Sync/Index）；Safari 部分（SW+Cache 17 起，无 Sync/Index）。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('构建检测矩阵 + 降级策略', { type: 'primary', size: 'sm', onClick: () => this._buildMatrix() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '能力矩阵与降级策略：'),
        h('pre', { class: 'code-block', style: { maxHeight: '360px', overflow: 'auto' } },
          h('code', {}, s.matrixInfo || '（点击「构建检测矩阵」按钮）')),
        h(Alert, {
          type: 'warning',
          message: '后台任务能力差异大，必须做特性检测 + 降级',
          description: 'Chrome/Edge 完整支持后台任务；Firefox/Safari 仅 SW + Cache。生产环境必须对每个 API 做 in 检测，不可用时降级到 online 事件轮询 / app 启动刷新 / app 内 UI 等方案，保证功能可用而非崩溃。Periodic Sync 最严格（需安装+授权+参与度），Sync 最宽松（仅需 SW）。Background Fetch 与 Sync 是独立 API，不可混用。',
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
    return h('div', { class: 'page api-lab-page content-index-offline-page' },
      h('h2', { class: 'section-title' }, 'Content Indexing + 后台同步深度 实验室'),
      h('p', { class: 'fs-sm text-secondary mb-md' },
        '演示 Content Indexing API（registration.index）与 Background Sync / Periodic Sync / Background Fetch 的深度用法，以及离线优先 PWA 的组合策略与能力降级。'),
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
