// =====================================================================
// WebNotificationsPushDeepPage.js —— Web Notifications & Push API 深度实验室
// 演示 Notifications API + Push API 全套能力，是浏览器原生消息推送体系：
//   1. Notifications API 基础与权限 —— Notification 构造器、requestPermission、
//      permission/maxActions 静态属性、permissionchange、HTTPS 要求
//   2. Notification options 全字段深潜 —— title/body/dir/lang/icon/badge/image/
//      tag/data/silent/requireInteraction/vibrate/renotify/actions/sticky
//   3. Notification 事件与 Service Worker 通知 —— onclick/onshow/onerror/onclose、
//      registration.showNotification、onnotificationclick、notificationclose、
//      getNotifications、SW 通知 vs window 通知
//   4. Notification actions 操作按钮 —— actions 数组、event.action、event.reply、
//      event.waitUntil、maxActions 上限、桌面/Android 差异
//   5. Push API 订阅流程 —— navigator.serviceWorker.ready、pushManager.subscribe、
//      userVisibleOnly、applicationServerKey、PushSubscription、unsubscribe、permissionState
//   6. VAPID 与推送加密 —— VAPID 协议、密钥对、JWT(ES256)、aud/sub/exp、
//      aes128gcm(RFC 8291)、keys.p256dh + keys.auth 派生密钥
//   7. Service Worker push 事件处理 —— onpush、PushMessageData、waitUntil、
//      pushsubscriptionchange、notificationclick、完整处理流程
//   8. 完整推送系统架构与陷阱 —— 端到端流程图、FCM/APNs/Mozilla 推送服务、
//      Safari 16.4+ 限制、payload 4KB、降级方案、隐私、调试、Background Sync 协同
// 说明：jsdom 无 Notification/PushManager 真实实现，按钮点击仅记日志说明，
//       不会抛异常；真实浏览器（HTTPS 或 localhost）可查看完整效果。
// =====================================================================
import { Page } from '../../core/Component.js';
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';
export class WebNotificationsPushDeepPage extends Page {
    _dynamicStyles;
    _inited;
    initialState() {
        return {
            logs: [],
            capsSummary: '',
            basicInfo: '', // Card 1：Notifications API 基础与权限
            optionsInfo: '', // Card 2：Notification options 全字段深潜
            eventsInfo: '', // Card 3：Notification 事件与 Service Worker 通知
            actionsInfo: '', // Card 4：Notification actions 操作按钮
            subscribeInfo: '', // Card 5：Push API 订阅流程
            vapidInfo: '', // Card 6：VAPID 与推送加密
            pushEventInfo: '', // Card 7：Service Worker push 事件处理
            architectureInfo: '', // Card 8：完整推送系统架构与陷阱
        };
    }
    componentDidMount() {
        if (this._inited)
            return;
        this._inited = true;
        this._dynamicStyles = [];
        const f = this._flags();
        const c = (ok) => ok ? '✓' : '✗';
        const parts = [
            `Notification ${c(f.notification)}`,
            `PushManager ${c(f.pushManager)}`,
            `serviceWorker ${c(f.serviceWorker)}`,
            `permission=${f.permission}`,
            `maxActions=${f.maxActions === null ? 'N/A' : f.maxActions}`,
            `supportedContentEncodings ${f.contentEncodings ? '✓' : '✗'}`,
        ];
        const summary = f.notification
            ? `Web Notifications & Push 能力检测：${parts.join(' · ')}。jsdom 无 Notification/PushManager 真实实现，按钮点击仅记日志说明，不会抛异常；真实浏览器（HTTPS 或 localhost）可查看完整效果。`
            : '当前环境不支持 Notifications API（typeof Notification === "undefined"）；所有按钮点击仅记日志说明，不会抛异常。';
        this.setState({ capsSummary: summary });
        this._addLog(f.notification ? 'info' : 'warn', `能力检测：${parts.join('，')}`);
        if (!f.pushManager)
            this._addLog('warn', 'PushManager 不可用（需 HTTPS + 现代浏览器）');
        if (!f.serviceWorker)
            this._addLog('warn', 'serviceWorker 不可用（SW 是 Push 的前置依赖）');
        if (f.notification && f.permission === 'denied')
            this._addLog('warn', '通知权限已被拒绝，requestPermission 不会再弹窗');
        this._injectBaseStyles();
    }
    componentWillUnmount() {
        for (const style of this._dynamicStyles) {
            try {
                style.parentNode && style.parentNode.removeChild(style);
            }
            catch { /* noop */ }
        }
        this._dynamicStyles = [];
    }
    // —— 辅助方法 ——
    _addLog(type, content) {
        this.setState({ logs: [...this.state.logs, { type, content, time: formatTime() }].slice(-40) });
    }
    _btn(label, opts) {
        const btn = new Button({ ...opts, children: label, onClick: opts.onClick });
        this.registerChild(btn);
        return btn.render();
    }
    _caps(items) {
        return items.map(([label, ok]) => h(Tag, { color: ok ? 'success' : 'error' }, `${label} ${ok ? '✓' : '✗'}`));
    }
    _injectStyle(id, css) {
        const existing = document.getElementById(id);
        if (existing)
            existing.remove();
        const style = document.createElement('style');
        style.id = id;
        style.textContent = css;
        document.head.appendChild(style);
        this._dynamicStyles.push(style);
    }
    _injectBaseStyles() {
        this._injectStyle('np-base', `
      .np-demo {
        padding: 16px;
        background: #f8fafc;
        border: 1px solid #cbd5e1;
        border-radius: 8px;
        margin-top: 10px;
      }
      .np-permission-badge {
        display: inline-block;
        padding: 2px 8px;
        border-radius: 12px;
        font-size: 11px;
        font-weight: 600;
        margin: 2px;
      }
      .np-permission-badge--granted { background: #dcfce7; color: #166534; }
      .np-permission-badge--denied { background: #fee2e2; color: #991b1b; }
      .np-permission-badge--default { background: #fef9c3; color: #854d0e; }
      .np-permission-badge--unsupported { background: #f1f5f9; color: #475569; }
      .np-flow {
        background: #f8fafc;
        border: 1px solid #cbd5e1;
        border-radius: 8px;
        padding: 12px;
        margin-top: 10px;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .np-flow-step {
        background: #fff;
        border: 1px solid #cbd5e1;
        border-radius: 6px;
        padding: 8px 12px;
        font-size: 12px;
        display: flex;
        align-items: center;
        gap: 8px;
        line-height: 1.4;
      }
      .np-flow-step--client { border-left: 4px solid #3b82f6; }
      .np-flow-step--server { border-left: 4px solid #ef4444; }
      .np-flow-step--push { border-left: 4px solid #8b5cf6; }
      .np-flow-step--sw { border-left: 4px solid #10b981; }
      .np-flow-step-num {
        background: #1e293b;
        color: #fff;
        width: 22px;
        height: 22px;
        border-radius: 50%;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 11px;
        font-weight: 700;
        flex-shrink: 0;
      }
      .np-flow-arrow {
        text-align: center;
        color: #64748b;
        font-size: 14px;
        line-height: 1;
        padding: 1px 0;
      }
      .np-flow-arrow--cross { color: #ef4444; font-weight: 700; }
      .np-action-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
        gap: 6px;
        margin-top: 8px;
      }
      .np-action-cell {
        background: #f1f5f9;
        border: 1px solid #cbd5e1;
        border-radius: 6px;
        padding: 6px 8px;
        font-size: 11px;
      }
      .np-output {
        background: #0f172a;
        color: #e2e8f0;
        border-radius: 4px;
        padding: 8px;
        font-family: monospace;
        font-size: 11px;
        white-space: pre-wrap;
        word-break: break-all;
        margin-top: 8px;
      }
      .np-permission-row {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-top: 8px;
      }
    `);
    }
    _flags() {
        const hasNotification = typeof Notification !== 'undefined';
        const hasPushManager = typeof PushManager !== 'undefined';
        const hasServiceWorker = typeof navigator !== 'undefined' && 'serviceWorker' in navigator;
        const hasSWObj = typeof navigator !== 'undefined' && !!navigator.serviceWorker;
        let permission = 'unsupported';
        try {
            permission = hasNotification ? Notification.permission : 'unsupported';
        }
        catch { /* noop */ }
        let maxActions = null;
        try {
            maxActions = hasNotification && 'maxActions' in Notification ? Notification.maxActions : null;
        }
        catch { /* noop */ }
        let contentEncodings = null;
        try {
            contentEncodings = hasPushManager && 'supportedContentEncodings' in PushManager
                ? PushManager.supportedContentEncodings
                : null;
        }
        catch { /* noop */ }
        return {
            notification: hasNotification,
            pushManager: hasPushManager,
            serviceWorker: hasServiceWorker,
            swObj: hasSWObj,
            permission,
            maxActions,
            contentEncodings,
        };
    }
    // ===================== Card 1：Notifications API 基础与权限 =====================
    _runBasicDemo() {
        const f = this._flags();
        if (f.notification) {
            if (Notification.permission === 'granted') {
                try {
                    const n = new Notification('基础测试通知', { body: 'Notifications API 基础演示', tag: 'np-basic' });
                    n.onclick = () => { try {
                        n.close();
                    }
                    catch { /* noop */ } };
                    this._addLog('info', '已弹出基础测试通知（permission=granted）');
                }
                catch (e) {
                    this._addLog('warn', `通知创建失败：${e.message}`);
                }
            }
            else {
                this._addLog('warn', `Notification 权限为 ${Notification.permission}，未实际弹窗（需用户授权）`);
            }
        }
        else {
            this._addLog('warn', 'Notification API 不可用（jsdom 无实现），仅展示文档');
        }
        const info = [
            '===== Notifications API 基础与权限 =====',
            '',
            '【Notification 构造器】',
            '  new Notification(title, options)',
            '  // title: 字符串，通知主标题（必填）',
            '  // options: 通知选项对象（可选，详见 Card 2）',
            '',
            '  // 示例',
            '  const n = new Notification("收到新消息", {',
            '    body: "张三：你好，明天见？",',
            '    icon: "/icon.png",',
            '    tag: "msg-1",',
            '  });',
            '',
            '【Notification.requestPermission() 请求权限】',
            '  // Promise 形式（推荐）',
            '  Notification.requestPermission().then((permission: any) => {',
            '    console.log(permission); // "granted" | "denied" | "default"',
            '  });',
            '',
            '  // 回调形式（旧版，已废弃但仍支持）',
            '  Notification.requestPermission((permission: any) => {',
            '    console.log(permission);',
            '  });',
            '',
            '  // async/await',
            '  async function ask() {',
            '    const perm = await Notification.requestPermission();',
            '    if (perm === "granted") { /* 可发通知 */ }',
            '  }',
            '',
            '【权限状态三态】',
            '  "default"  用户未选择（需调用 requestPermission 询问）',
            '  "granted"  用户已授权',
            '  "denied"   用户已拒绝（再次 requestPermission 不会弹窗，直接返回 denied）',
            '',
            '【Notification.permission 静态属性：当前权限】',
            '  console.log(Notification.permission); // "default" | "granted" | "denied"',
            '  // 不要在页面加载时立即弹窗请求，应等用户交互后再请求',
            '',
            '【Notification.maxActions 静态属性：操作按钮上限】',
            '  console.log(Notification.maxActions); // 2（Chrome），其他浏览器可能 undefined',
            '  // 用于检测当前浏览器支持的 actions 数量上限',
            '  // 注意：仅 Chrome/Android 实现，Firefox/Safari 无此属性',
            '',
            '【permissionchange 事件（Permissions API）】',
            '  // Notifications API 本身无 permissionchange 事件',
            '  // 通过 navigator.permissions 查询通知权限变化',
            '  navigator.permissions.query({ name: "notifications" }).then((status: any) => {',
            '    status.onchange = () => {',
            '      console.log("权限变化为：", status.state); // "granted" | "denied" | "prompt"',
            '    };',
            '  });',
            '  // 注意：Permissions API 用 "prompt" 等价 Notification 的 "default"',
            '',
            '【安全要求：必须 HTTPS 或 localhost】',
            '  - Notifications API 仅在安全上下文（HTTPS）或 localhost/127.0.0.1 可用',
            '  - http://localhost:8080 ✓',
            '  - https://example.com ✓',
            '  - http://example.com ✗（Notification 为 undefined）',
            '  - 检测：window.isSecureContext 返回布尔值',
            '',
            '【用户激活要求】',
            '  - 调用 requestPermission() 应在用户交互（click/tap/keydown）回调中触发',
            '  - 部分浏览器要求 showNotification / new Notification 也需用户激活',
            '  - 滥用：页面加载时自动弹权限请求会被浏览器拦截并警告',
            '  - 最佳实践：在「订阅推送」按钮点击事件中请求权限',
            '',
            '【权限请求最佳实践】',
            '  // 1. 先检查当前权限',
            '  if (Notification.permission === "granted") {',
            '    // 直接发通知',
            '  } else if (Notification.permission !== "denied") {',
            '    // 2. 在用户点击按钮时请求',
            '    btn.addEventListener("click", async () => {',
            '      const perm = await Notification.requestPermission();',
            '      if (perm === "granted") { /* 发通知 */ }',
            '    });',
            '  }',
            '',
            '【检测支持】',
            '  if (!("Notification" in window)) {',
            '    console.log("浏览器不支持 Notifications API");',
            '  }',
            '  // 或 typeof Notification !== "undefined"',
            '',
            '【浏览器支持】',
            `  Notification: ${f.notification ? '✓' : '✗'}`,
            `  Notification.permission: ${f.permission}`,
            `  Notification.maxActions: ${f.maxActions === null ? 'N/A' : f.maxActions}`,
            '  - 桌面 Chrome/Edge/Firefox：完整支持',
            '  - Safari：macOS Safari 7+ 支持（iOS Safari 16.4+ 支持 Web Push）',
            '  - 移动端：Android Chrome 支持，iOS 需 16.4+ 添加到主屏幕',
            '',
            '【常见陷阱】',
            '  1. 非 HTTPS 环境 Notification 为 undefined，需 typeof 检测',
            '  2. denied 状态下 requestPermission 不会再次弹窗',
            '  3. iOS 需先「添加到主屏幕」才能接收通知',
            '  4. Service Worker 通知与 window 通知行为不同（见 Card 3）',
            '  5. 部分浏览器要求用户激活后才允许 requestPermission',
            '  6. new Notification() 在 Service Worker 中不可用，需用 showNotification',
        ].join('\n');
        this.setState({ basicInfo: info });
        this._addLog('info', `基础权限演示完成；notification=${f.notification}/${f.permission}`);
    }
    _renderCard1() {
        const s = this.state;
        const f = this._flags();
        const permClass = f.permission === 'granted' ? 'np-permission-badge--granted'
            : f.permission === 'denied' ? 'np-permission-badge--denied'
                : f.permission === 'default' ? 'np-permission-badge--default'
                    : 'np-permission-badge--unsupported';
        const codeExample = [
            '// 请求权限 + 创建通知',
            'async function notify(title, options) {',
            '  if (!("Notification" in window)) return;',
            '  if (Notification.permission === "granted") {',
            '    new Notification(title, options);',
            '  } else if (Notification.permission !== "denied") {',
            '    const perm = await Notification.requestPermission();',
            '    if (perm === "granted") new Notification(title, options);',
            '  }',
            '}',
        ].join('\n');
        const card = new Card({
            title: '1. Notifications API 基础与权限 —— 构造器与权限三态',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([
                ['Notification', f.notification],
                ['maxActions', f.maxActions !== null],
            ]), h(Tag, { color: 'primary' }, 'Notifications API')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'Notification 构造器 new Notification(title, options) 创建通知；options 含 body/dir/icon/badge/image/tag/data/silent/requireInteraction/vibrate/renotify/actions/sticky 全字段。Notification.requestPermission() 返回 Promise（或回调）解析为 granted/denied/default。Notification.permission 静态属性读当前权限，Notification.maxActions 检测操作按钮上限。permissionchange 通过 Permissions API 监听。必须 HTTPS 或 localhost；用户激活要求：应在用户交互回调中请求权限。'),
                h('div', { class: 'np-permission-row' }, h('span', { class: `np-permission-badge ${permClass}` }, `当前权限：${f.permission}`), h('span', { class: 'np-permission-badge np-permission-badge--unsupported' }, `maxActions：${f.maxActions === null ? 'N/A' : f.maxActions}`)),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('运行基础权限演示', { type: 'primary', size: 'sm', onClick: () => this._runBasicDemo() })),
                h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
                h('pre', { class: 'code-block', style: { maxHeight: '220px', overflow: 'auto' } }, h('code', {}, codeExample)),
                h('div', { class: 'fs-sm text-secondary' }, '完整参考：'),
                h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } }, h('code', {}, s.basicInfo || '（点击按钮查看 Notifications API 基础与权限完整用法）')),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // ===================== Card 2：Notification options 全字段深潜 =====================
    _runOptionsDemo() {
        const f = this._flags();
        if (f.notification) {
            if (Notification.permission === 'granted') {
                try {
                    const n = new Notification('Options 全字段演示', {
                        body: '副标题：body 字段\n支持换行',
                        dir: 'ltr',
                        lang: 'zh-CN',
                        tag: 'np-options',
                        data: { ts: Date.now() },
                        requireInteraction: true,
                    });
                    n.onclick = () => { try {
                        n.close();
                    }
                    catch { /* noop */ } };
                    this._addLog('info', '已弹出 options 全字段测试通知');
                }
                catch (e) {
                    this._addLog('warn', `通知创建失败：${e.message}`);
                }
            }
            else {
                this._addLog('warn', `Notification 权限为 ${Notification.permission}，未实际弹窗`);
            }
        }
        else {
            this._addLog('warn', 'Notification API 不可用（jsdom 无实现），仅展示文档');
        }
        const info = [
            '===== Notification options 全字段深潜 =====',
            '',
            '【title：主标题（构造器第一参数）】',
            '  new Notification("主标题", options)',
            '  // 必填字符串，显示在通知顶部最醒目位置',
            '',
            '【body：副标题/正文】',
            '  body: "副标题内容"',
            '  body: "第一行\\n第二行"   // 支持换行符',
            '  // 显示在 title 下方，字号较小',
            '',
            '【dir：文字方向】',
            '  dir: "auto"   // 默认，浏览器自动判断',
            '  dir: "ltr"    // 从左到右（中文/英文）',
            '  dir: "rtl"    // 从右到左（阿拉伯文/希伯来文）',
            '',
            '【lang：BCP 47 语言标签】',
            '  lang: "zh-CN"   // 简体中文',
            '  lang: "en-US"   // 美国英语',
            '  lang: "ja-JP"   // 日语',
            '  // 用于屏幕阅读器发音与字体回退',
            '',
            '【icon：大图标（建议 192x192 PNG）】',
            '  icon: "/icon-192.png"',
            '  icon: "/avatar.png"',
            '  // 显示在通知左侧的主图标，建议 PNG 透明背景',
            '  // 尺寸建议 192x192 或 256x256',
            '',
            '【badge：状态栏小图标（Android 72x72 单色）】',
            '  badge: "/badge-72.png"',
            '  // Android 状态栏小图标，单色白色 PNG',
            '  // 尺寸建议 72x72，仅 Android Chrome 显示',
            '  // 桌面浏览器忽略此字段',
            '',
            '【image：大图预览】',
            '  image: "/preview.jpg"',
            '  // 通知内嵌大图预览（如照片缩略图）',
            '  // Chrome 支持，Firefox/Safari 支持有限',
            '  // 建议尺寸 432x244（16:9）',
            '',
            '【tag：通知标识符（同 tag 新通知替换旧通知）】',
            '  tag: "email-1"',
            '  // 同 tag 的新通知会替换旧通知（不堆积）',
            '  // 配合 renotify: true 可让替换时再次提醒',
            '  // 典型场景：聊天消息更新（同会话只保留最新）',
            '',
            '【data：任意可序列化数据（structuredClone）】',
            '  data: { url: "/inbox/1", userId: 123 }',
            '  data: [1, 2, 3]',
            '  data: "any-string"',
            '  // 结构化克隆算法，可传对象/数组/原始值',
            '  // 不可传函数/DOM 节点/循环引用',
            '  // 在 notificationclick 中通过 event.notification.data 读取',
            '',
            '【silent：静默不发声】',
            '  silent: true   // 不播放声音/不震动',
            '  silent: false  // 默认，播放系统通知音',
            '',
            '【requireInteraction：不自动关闭需用户操作】',
            '  requireInteraction: true',
            '  // 通知不会自动消失，需用户手动点击/关闭',
            '  // 适合重要通知（如来电、闹钟）',
            '  // 桌面 Chrome 支持，Android 不支持（系统限制）',
            '',
            '【vibrate：震动模式】',
            '  vibrate: [200, 100, 200]',
            '  // [震动 200ms, 停 100ms, 震动 200ms]',
            '  vibrate: [500]   // 单次震动 500ms',
            '  // 仅 Android 支持，桌面忽略',
            '  // 与 navigator.vibrate() 格式一致',
            '',
            '【renotify：同 tag 新通知再次提醒】',
            '  renotify: true',
            '  // 配合 tag 使用：同 tag 的新通知替换时再次提醒用户',
            '  // 默认 false：同 tag 替换不再次提醒',
            '  // 仅 Chrome/Android 支持',
            '',
            '【actions：操作按钮数组（最多 2 个，仅 Android/Chrome 支持）】',
            '  actions: [',
            '    { action: "reply", title: "回复", icon: "/reply.png" },',
            '    { action: "archive", title: "归档" }',
            '  ]',
            '  // action: 字符串标识符（在 notificationclick 中读取）',
            '  // title: 按钮显示文字',
            '  // icon: 按钮图标（可选，建议 24x24 PNG）',
            '  // 限制：最多 2 个，仅 Service Worker 通知支持',
            '  // 详见 Card 4',
            '',
            '【sticky：通知固定不可清除（实验性）】',
            '  sticky: true',
            '  // 通知固定在通知中心，用户不可手动清除',
            '  // 仅 Firefox 支持，其他浏览器忽略',
            '',
            '【完整 options 示例】',
            '  new Notification("新邮件", {',
            '    body: "来自张三的邮件",',
            '    dir: "ltr",',
            '    lang: "zh-CN",',
            '    icon: "/icon-192.png",',
            '    badge: "/badge-72.png",',
            '    image: "/preview.jpg",',
            '    tag: "email-1",',
            '    data: { url: "/inbox/1" },',
            '    silent: false,',
            '    requireInteraction: true,',
            '    vibrate: [200, 100, 200],',
            '    renotify: true,',
            '    actions: [',
            '      { action: "reply", title: "回复", icon: "/reply.png" },',
            '      { action: "archive", title: "归档" }',
            '    ]',
            '  });',
            '',
            '【浏览器支持矩阵】',
            '  title/body/icon/tag/data/silent/requireInteraction：所有现代浏览器',
            '  badge/vibrate/renotify：仅 Android Chrome',
            '  image：Chrome/Edge 支持，Firefox 部分支持，Safari 不支持',
            '  actions：仅 Service Worker 通知 + Chrome/Android（见 Card 4）',
            '  sticky：仅 Firefox',
            '  dir/lang：所有浏览器（但实际渲染依赖系统）',
            '',
            '【常见陷阱】',
            '  1. data 不可含函数/DOM 节点（structuredClone 限制）',
            '  2. actions 在 window Notification 中无效，必须用 showNotification',
            '  3. requireInteraction 在 Android 不生效（系统自动管理）',
            '  4. badge/icon 路径必须是同源或 CORS 允许的 URL',
            '  5. icon 图片加载失败时显示默认图标，不报错',
            '  6. vibrate 在桌面浏览器静默忽略，不报错',
        ].join('\n');
        this.setState({ optionsInfo: info });
        this._addLog('info', 'options 全字段演示完成');
    }
    _renderCard2() {
        const s = this.state;
        const f = this._flags();
        const codeExample = [
            'new Notification("新邮件", {',
            '  body: "来自张三的邮件",',
            '  dir: "ltr",',
            '  lang: "zh-CN",',
            '  icon: "/icon-192.png",',
            '  badge: "/badge-72.png",',
            '  image: "/preview.jpg",',
            '  tag: "email-1",',
            '  data: { url: "/inbox/1" },',
            '  silent: false,',
            '  requireInteraction: true,',
            '  vibrate: [200, 100, 200],',
            '  renotify: true,',
            '  actions: [',
            '    { action: "reply", title: "回复", icon: "/reply.png" },',
            '    { action: "archive", title: "归档" }',
            '  ]',
            '});',
        ].join('\n');
        const card = new Card({
            title: '2. Notification options 全字段深潜 —— 14 个字段详解',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([['Notification', f.notification]]), h(Tag, { color: 'primary' }, 'options')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'title 主标题、body 副标题（支持换行）、dir: auto|ltr|rtl 文字方向、lang BCP 47 语言标签、icon 大图标（192x192 PNG）、badge 状态栏小图标（Android 72x72 单色）、image 大图预览、tag 通知标识符（同 tag 新通知替换旧通知）、data 任意可序列化数据（structuredClone）、silent 静默不发声、requireInteraction 不自动关闭需用户操作、vibrate 震动模式 [200,100,200]、renotify 同 tag 新通知再次提醒、actions 操作按钮数组（最多 2 个，仅 Android/Chrome）、sticky 固定不可清除（Firefox）。'),
                h('div', { class: 'np-action-grid' }, h('div', { class: 'np-action-cell' }, 'title 必填'), h('div', { class: 'np-action-cell' }, 'body 副标题'), h('div', { class: 'np-action-cell' }, 'dir 方向'), h('div', { class: 'np-action-cell' }, 'lang 语言'), h('div', { class: 'np-action-cell' }, 'icon 大图标'), h('div', { class: 'np-action-cell' }, 'badge 小图标'), h('div', { class: 'np-action-cell' }, 'image 大图'), h('div', { class: 'np-action-cell' }, 'tag 标识符'), h('div', { class: 'np-action-cell' }, 'data 数据'), h('div', { class: 'np-action-cell' }, 'silent 静默'), h('div', { class: 'np-action-cell' }, 'requireInteraction'), h('div', { class: 'np-action-cell' }, 'vibrate 震动'), h('div', { class: 'np-action-cell' }, 'renotify 再提醒'), h('div', { class: 'np-action-cell' }, 'actions 按钮')),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('运行 options 演示', { type: 'primary', size: 'sm', onClick: () => this._runOptionsDemo() })),
                h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
                h('pre', { class: 'code-block', style: { maxHeight: '320px', overflow: 'auto' } }, h('code', {}, codeExample)),
                h('div', { class: 'fs-sm text-secondary' }, '完整参考：'),
                h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } }, h('code', {}, s.optionsInfo || '（点击按钮查看 options 全字段完整深潜）')),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // ===================== Card 3：Notification 事件与 Service Worker 通知 =====================
    _runEventsDemo() {
        const f = this._flags();
        if (f.notification) {
            this._addLog('info', 'Notification 事件需在真实浏览器观察（onclick/onshow/onerror/onclose）');
            if (Notification.permission === 'granted') {
                try {
                    const n = new Notification('事件演示', { body: '观察 onclick/onclose 事件', tag: 'np-events' });
                    n.onshow = () => this._addLog('info', 'notification onshow 触发');
                    n.onclick = () => { this._addLog('info', 'notification onclick 触发'); try {
                        n.close();
                    }
                    catch { /* noop */ } };
                    n.onerror = () => this._addLog('warn', 'notification onerror 触发');
                    n.onclose = () => this._addLog('info', 'notification onclose 触发');
                }
                catch (e) {
                    this._addLog('warn', `通知创建失败：${e.message}`);
                }
            }
            else {
                this._addLog('warn', `Notification 权限为 ${Notification.permission}，未实际弹窗`);
            }
        }
        else {
            this._addLog('warn', 'Notification API 不可用（jsdom 无实现），仅展示文档');
        }
        const info = [
            '===== Notification 事件与 Service Worker 通知 =====',
            '',
            '【window Notification 实例事件（4 个）】',
            '  const n = new Notification("标题", { body: "内容" });',
            '  n.onclick   = (e: any) => { console.log("点击"); };   // 用户点击通知',
            '  n.onshow    = (e: any) => { console.log("显示"); };   // 通知显示',
            '  n.onerror   = (e: any) => { console.log("错误"); };   // 通知出错',
            '  n.onclose   = (e: any) => { console.log("关闭"); };   // 通知关闭',
            '',
            '  // 或用 addEventListener',
            '  n.addEventListener($1, (e: any) => { /* ... */ });',
            '  n.addEventListener($1, (e: any) => { /* ... */ });',
            '  n.addEventListener($1, (e: any) => { /* ... */ });',
            '  n.addEventListener($1, (e: any) => { /* ... */ });',
            '',
            '【onclick 典型用法：聚焦窗口 + 关闭通知】',
            '  const n = new Notification("新消息", { body: "点击查看" });',
            '  n.onclick = () => {',
            '    window.focus();       // 聚焦当前窗口',
            '    n.close();            // 关闭通知',
            '    // 可跳转到对应页面',
            '    location.href = "/inbox";',
            '  };',
            '',
            '【Service Worker 中创建通知：registration.showNotification()】',
            '  // main.js 获取 registration',
            '  navigator.serviceWorker.ready.then((reg: any) => {',
            '    reg.showNotification("标题", {',
            '      body: "内容",',
            '      actions: [{ action: "open", title: "打开" }],  // SW 支持 actions',
            '      tag: "sw-1",',
            '    });',
            '  });',
            '',
            '  // sw.js 中可直接用 self.registration',
            '  self.registration.showNotification("推送通知", {',
            '    body: "来自 Service Worker",',
            '    requireInteraction: true,',
            '  });',
            '',
            '【ServiceWorkerGlobalScope.onnotificationclick 点击事件】',
            '  // sw.js',
            '  self.addEventListener($1, (event: any) => {',
            '    const { action, notification } = event;',
            '    notification.close();   // 点击后关闭通知',
            '',
            '    // 打开页面或聚焦已有标签',
            '    event.waitUntil(',
            '      clients.matchAll({ type: "window" }).then((clientList: any) => {',
            '        for (const client of clientList) {',
            '          if (client.url.includes("/inbox") && "focus" in client) {',
            '            return client.focus();   // 聚焦已有标签',
            '          }',
            '        }',
            '        return clients.openWindow("/inbox");  // 打开新标签',
            '      })',
            '    );',
            '  });',
            '',
            '【notificationclose 关闭事件】',
            '  self.addEventListener($1, (event: any) => {',
            '    console.log("通知被关闭", event.notification.tag);',
            '    // 可上报分析数据',
            '  });',
            '',
            '【getNotifications({ tag }) 获取已有通知】',
            '  // 获取当前 SW 注册的所有通知',
            '  const notifications = await registration.getNotifications();',
            '  notifications.forEach((n: any) => n.close());  // 关闭所有',
            '',
            '  // 按 tag 获取',
            '  const list = await registration.getNotifications({ tag: "email-1" });',
            '  // 可用于避免重复通知、更新已有通知',
            '',
            '【SW 通知 vs window 通知区别】',
            '  特性              window Notification        SW showNotification',
            '  ─────────────────────────────────────────────────────────────',
            '  创建方式          new Notification()          registration.showNotification()',
            '  actions 支持      ✗ 不支持                    ✓ 支持（Android/Chrome）',
            '  后台/页面关闭时   ✗ 不可用                    ✓ 可触发（SW 后台运行）',
            '  push 事件触发     ✗ 不可用                    ✓ 必须（push 事件中调用）',
            '  事件处理          实例 onclick/onshow 等      notificationclick/close 事件',
            '  页面可见性要求    需页面可见或最近活跃         无要求（SW 独立运行）',
            '  生命周期          与页面绑定，页面关闭失效     与 SW 绑定，独立于页面',
            '',
            '【完整 SW 通知处理模板】',
            '  // sw.js',
            '  self.addEventListener($1, (e: any) => self.skipWaiting());',
            '  self.addEventListener($1, (e: any) => e.waitUntil(clients.claim()));',
            '',
            '  self.addEventListener($1, (event: any) => {',
            '    const { action, notification } = event;',
            '    const data = notification.data || {}',
            '    notification.close();',
            '    const targetUrl = data.url || "/";',
            '    event.waitUntil(',
            '      clients.matchAll({ type: "window", includeUncontrolled: true })',
            '        .then((list: any) => {',
            '          for (const c of list) {',
            '            if (c.url.includes(targetUrl) && "focus" in c) return c.focus();',
            '          }',
            '          return clients.openWindow(targetUrl);',
            '        })',
            '    );',
            '  });',
            '',
            '  self.addEventListener($1, (event: any) => {',
            '    // 上报关闭事件',
            '  });',
            '',
            '【浏览器支持】',
            '  window Notification 事件：所有现代浏览器',
            '  SW showNotification：Chrome 42+/Firefox 46+/Safari 16.4+（桌面）',
            '  notificationclick/close：所有支持 SW 通知的浏览器',
            '  getNotifications：Chrome 45+/Firefox 46+',
            '',
            '【常见陷阱】',
            '  1. new Notification() 在 SW 中不可用，必须用 showNotification',
            '  2. window Notification 事件在页面关闭后不再触发',
            '  3. notificationclick 中必须 event.waitUntil() 否则 SW 可能被中止',
            '  4. clients.matchAll 需 includeUncontrolled: true 才能匹配非控制标签',
            '  5. iOS Safari 16.4+ 需添加到主屏幕才支持 SW 通知',
            '  6. showNotification 返回 Promise，但需 await 确保显示',
        ].join('\n');
        this.setState({ eventsInfo: info });
        this._addLog('info', '事件与 SW 通知演示完成');
    }
    _renderCard3() {
        const s = this.state;
        const f = this._flags();
        const codeExample = [
            '// main.js —— window 通知事件',
            'const n = new Notification("标题", { body: "内容" });',
            'n.onclick = () => { window.focus(); n.close(); };',
            'n.onshow = () => console.log("显示");',
            'n.onerror = (e: any) => console.error(e);',
            'n.onclose = () => console.log("关闭");',
            '',
            '// sw.js —— Service Worker 通知（支持 actions）',
            'self.registration.showNotification("标题", {',
            '  body: "内容",',
            '  actions: [{ action: "open", title: "打开" }]',
            '});',
            'self.addEventListener($1, (event: any) => {',
            '  event.notification.close();',
            '  event.waitUntil(clients.openWindow("/"));',
            '});',
        ].join('\n');
        const card = new Card({
            title: '3. Notification 事件与 Service Worker 通知 —— onclick/showNotification',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([
                ['Notification', f.notification],
                ['serviceWorker', f.serviceWorker],
            ]), h(Tag, { color: 'primary' }, 'SW 通知')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'new Notification() 创建的通知实例事件 onclick/onshow/onerror/onclose。Service Worker 中 registration.showNotification(title, options) 创建通知（更强大支持 actions）。ServiceWorkerGlobalScope.onnotificationclick 点击事件（可打开页面/聚焦标签/执行操作），notificationclose 关闭事件。getNotifications({ tag }) 获取已有通知。SW 通知 vs window 通知：SW 支持 actions、可在后台/关闭页面时触发、独立于页面生命周期。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('运行事件演示', { type: 'primary', size: 'sm', onClick: () => this._runEventsDemo() })),
                h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
                h('pre', { class: 'code-block', style: { maxHeight: '320px', overflow: 'auto' } }, h('code', {}, codeExample)),
                h('div', { class: 'fs-sm text-secondary' }, '完整参考：'),
                h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } }, h('code', {}, s.eventsInfo || '（点击按钮查看 Notification 事件与 SW 通知完整用法）')),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // ===================== Card 4：Notification actions 操作按钮 =====================
    _runActionsDemo() {
        const f = this._flags();
        if (f.notification) {
            this._addLog('info', 'actions 按钮需 SW showNotification，window Notification 不支持');
            this._addLog('warn', `maxActions=${f.maxActions === null ? 'N/A' : f.maxActions}，仅 Chrome/Android 实际显示按钮`);
        }
        else {
            this._addLog('warn', 'Notification API 不可用（jsdom 无实现），仅展示文档');
        }
        const info = [
            '===== Notification actions 操作按钮 =====',
            '',
            '【options.actions 数组定义操作按钮】',
            '  registration.showNotification("新评论", {',
            '    body: "张三评论了你的文章",',
            '    actions: [',
            '      { action: "reply", title: "回复", icon: "/reply.png" },',
            '      { action: "archive", title: "归档" }',
            '    ],',
            '    data: { commentId: 123 }',
            '  });',
            '',
            '  // action 字段说明：',
            '  //   action: 字符串标识符（在 notificationclick 中通过 event.action 读取）',
            '  //   title:  按钮显示文字（必填）',
            '  //   icon:   按钮图标 URL（可选，建议 24x24 PNG 透明背景）',
            '',
            '【event.action 点击的 action 标识】',
            '  self.addEventListener($1, (event: any) => {',
            '    const { action, notification } = event;',
            '    const { data } = notification;',
            '',
            '    switch (action) {',
            '      case "reply":',
            '        // 处理回复',
            '        break;',
            '      case "archive":',
            '        // 处理归档',
            '        break;',
            '      default:',
            '        // action 为空字符串表示点击了通知主体（非按钮）',
            '        break;',
            '    }',
            '    notification.close();',
            '  });',
            '',
            '【event.notification.data 自定义数据】',
            '  // 在 showNotification 时通过 data 字段传入',
            '  reg.showNotification("通知", {',
            '    data: { url: "/page/1", userId: 42, meta: { type: "msg" } }',
            '  });',
            '',
            '  // 在 notificationclick 中读取',
            '  self.addEventListener($1, (event: any) => {',
            '    const data = event.notification.data;  // { url, userId, meta }',
            '    event.waitUntil(clients.openWindow(data.url));',
            '  });',
            '',
            '【event.waitUntil(promise) 保持 SW 活跃】',
            '  // SW 在事件回调结束后可能被中止',
            '  // waitUntil 告诉浏览器「等我这个 Promise 完成再中止」',
            '  self.addEventListener($1, (event: any) => {',
            '    event.waitUntil(',
            '      fetch("/api/mark-read", { method: "POST" })',
            '        .then(() => clients.openWindow("/inbox"))',
            '    );',
            '  });',
            '',
            '【event.reply 回复输入（Android quick reply）】',
            '  // Android Chrome 支持 quick reply 输入框',
            '  // 需在 actions 中设置 type: "text"',
            '  reg.showNotification("新消息", {',
            '    actions: [{',
            '      action: "reply",',
            '      title: "回复",',
            '      icon: "/reply.png",',
            '      type: "text",         // 启用文本输入',
            '      placeholder: "输入回复..."',
            '    }]',
            '  });',
            '',
            '  self.addEventListener($1, (event: any) => {',
            '    if (event.action === "reply") {',
            '      const replyText = event.reply;  // 用户输入的文本',
            '      event.waitUntil(',
            '        fetch("/api/reply", {',
            '          method: "POST",',
            '          body: JSON.stringify({ text: replyText })',
            '        })',
            '      );',
            '    }',
            '    event.notification.close();',
            '  });',
            '',
            '【actions 限制】',
            '  1. 最多 2 个按钮（Notification.maxActions 检测上限，通常为 2）',
            '  2. 仅 Service Worker 通知（showNotification）支持',
            '     → new Notification() 的 actions 字段被忽略',
            '  3. 桌面 Chrome 支持有限：不显示按钮，需点击通知主体',
            '     → 点击主体时 event.action 为空字符串',
            '  4. Android Chrome 完整支持按钮显示与点击',
            '  5. Firefox/Safari 不支持 actions（按钮不显示）',
            '  6. type: "text" quick reply 仅 Android Chrome 支持',
            '',
            '【Notification.maxActions 检测上限】',
            '  if ("Notification" in window && "maxActions" in Notification) {',
            '    console.log("最大按钮数：", Notification.maxActions);  // 通常 2',
            '  }',
            '  // 用于决定是否显示 actions（maxActions < 1 时不显示）',
            '',
            '【完整 actions 处理示例】',
            '  // sw.js',
            '  self.addEventListener($1, (event: any) => {',
            '    const payload = event.data.json();',
            '    event.waitUntil(',
            '      self.registration.showNotification(payload.title, {',
            '        body: payload.body,',
            '        actions: [',
            '          { action: "reply", title: "回复", type: "text", placeholder: "回复..." },',
            '          { action: "mark-read", title: "已读" }',
            '        ],',
            '        data: { id: payload.id }',
            '      })',
            '    );',
            '  });',
            '',
            '  self.addEventListener($1, (event: any) => {',
            '    const { action, notification, reply } = event;',
            '    const { id } = notification.data;',
            '    notification.close();',
            '',
            '    if (action === "reply" && reply) {',
            '      event.waitUntil(fetch("/api/reply", {',
            '        method: "POST", body: JSON.stringify({ id, text: reply })',
            '      }));',
            '    } else if (action === "mark-read") {',
            '      event.waitUntil(fetch(`/api/read/${id}`, { method: "POST" }));',
            '    } else {',
            '      event.waitUntil(clients.openWindow(`/msg/${id}`));',
            '    }',
            '  });',
            '',
            '【浏览器支持矩阵】',
            '  actions 显示：Android Chrome ✓ / 桌面 Chrome 部分 / Firefox ✗ / Safari ✗',
            '  type: "text" quick reply：仅 Android Chrome',
            '  event.reply：仅 Android Chrome',
            '  Notification.maxActions：Chrome/Edge（Firefox/Safari 无此属性）',
            '',
            '【常见陷阱】',
            '  1. actions 超过 2 个时浏览器只取前 2 个（不报错）',
            '  2. 桌面 Chrome 点击通知主体 event.action 为空字符串，非按钮 action',
            '  3. event.reply 仅在 type: "text" 且 Android 时有值',
            '  4. waitUntil 中 Promise reject 不会重新触发事件',
            '  5. notification.close() 后 notificationclick 不再触发',
            '  6. icon 加载失败显示文字按钮，不报错',
        ].join('\n');
        this.setState({ actionsInfo: info });
        this._addLog('info', 'actions 演示完成');
    }
    _renderCard4() {
        const s = this.state;
        const f = this._flags();
        const codeExample = [
            '// sw.js —— actions 处理',
            'self.registration.showNotification("新评论", {',
            '  actions: [',
            '    { action: "reply", title: "回复", icon: "/reply.png" },',
            '    { action: "archive", title: "归档" }',
            '  ],',
            '  data: { commentId: 123 }',
            '});',
            'self.addEventListener($1, (event: any) => {',
            '  const { action, notification } = event;',
            '  const { data } = notification;',
            '  if (action === "reply") {',
            '    fetch("/api/reply", { method: "POST", body: event.reply });',
            '  }',
            '  notification.close();',
            '  event.waitUntil(clients.openWindow(`/comment/${data.commentId}`));',
            '});',
        ].join('\n');
        const card = new Card({
            title: '4. Notification actions 操作按钮 —— 交互按钮与 quick reply',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([
                ['serviceWorker', f.serviceWorker],
                ['maxActions', f.maxActions !== null],
            ]), h(Tag, { color: 'primary' }, 'actions')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'options.actions: [{ action: "reply", title: "回复", icon: "reply.png" }, { action: "archive", title: "归档" }]。event.action 点击的 action 标识，event.notification.data 自定义数据，event.waitUntil(promise) 保持 SW 活跃，event.reply 回复输入（Android quick reply，需 type: "text"）。actions 限制：最多 2 个、仅 Service Worker 通知支持、桌面 Chrome 支持有限（无按钮，需点击通知主体）、Notification.maxActions 检测上限。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('运行 actions 演示', { type: 'primary', size: 'sm', onClick: () => this._runActionsDemo() })),
                h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
                h('pre', { class: 'code-block', style: { maxHeight: '320px', overflow: 'auto' } }, h('code', {}, codeExample)),
                h('div', { class: 'fs-sm text-secondary' }, '完整参考：'),
                h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } }, h('code', {}, s.actionsInfo || '（点击按钮查看 actions 操作按钮完整用法）')),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // ===================== Card 5：Push API 订阅流程 =====================
    _runSubscribeDemo() {
        const f = this._flags();
        if (f.pushManager && f.serviceWorker) {
            this._addLog('info', 'PushManager 可用，可在真实浏览器执行 subscribe（需 VAPID 公钥）');
            this._addLog('warn', '订阅需用户授权 + HTTPS + VAPID 公钥，本环境仅展示文档');
        }
        else {
            this._addLog('warn', 'PushManager/serviceWorker 不可用（jsdom 无实现），仅展示文档');
        }
        const info = [
            '===== Push API 订阅流程 =====',
            '',
            '【navigator.serviceWorker.ready 等待 SW 激活】',
            '  // Push 订阅必须基于已激活的 Service Worker',
            '  const registration = await navigator.serviceWorker.ready;',
            '  // ready 返回 Promise，解析为已激活的 ServiceWorkerRegistration',
            '  // 若 SW 未注册/未激活，Promise 会一直 pending',
            '',
            '【registration.pushManager.subscribe() 订阅推送】',
            '  const subscription = await registration.pushManager.subscribe({',
            '    userVisibleOnly: true,                  // 必须：每次推送都显示通知',
            '    applicationServerKey: <VAPID_PUBLIC_KEY>  // VAPID 公钥（Base64URL）',
            '  });',
            '',
            '【userVisibleOnly: true 必须显示通知（隐私要求）】',
            '  // userVisibleOnly: true 承诺每次推送都显示通知',
            '  // 防止「隐形推送」侵犯用户隐私',
            '  // 设为 false 浏览器会拒绝订阅（Chrome 48+ 强制）',
            '  // 若需后台静默处理，改用 Periodic Background Sync 或 Silent Push（实验性）',
            '',
            '【applicationServerKey VAPID 公钥（Base64URL 编码）】',
            '  // 应用服务器的 VAPID 公钥，用于标识推送来源',
            '  // 格式：Base64URL 编码的 65 字节 P-256 公钥',
            '',
            '  // 从服务器获取公钥（应为 Uint8Array）',
            '  const response = await fetch("/api/vapid-public-key");',
            '  const vapidKey = await response.arrayBuffer();',
            '  const keyBytes = new Uint8Array(vapidKey);',
            '',
            '  // 或从 Base64URL 字符串转换',
            '  function urlBase64ToUint8Array(base64Url) {',
            '    const padding = "=".repeat((4 - base64Url.length % 4) % 4);',
            '    const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");',
            '    const raw = atob(base64);',
            '    return Uint8Array.from(raw, (c: any) => c.charCodeAt(0));',
            '  }',
            '',
            '  const subscription = await reg.pushManager.subscribe({',
            '    userVisibleOnly: true,',
            '    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY_STR)',
            '  });',
            '',
            '【PushSubscription 对象】',
            '  subscription = {',
            '    endpoint: "https://fcm.googleapis.com/fcm/send/...",  // 推送服务 URL',
            '    expirationTime: null,   // 订阅过期时间（null = 永不过期）',
            '    keys: {',
            '      p256dh: "BNa...",     // ECDH P-256 公钥（Base64URL）',
            '      auth: "xR..."         // 认证密钥（Base64URL，16 字节）',
            '    },',
            '    subscriptionId: "..."   // 旧版（已废弃，用 endpoint 末尾 ID）',
            '  }',
            '',
            '  // endpoint：推送服务 URL（FCM/Mozilla/Apple），服务器向此 URL 发 POST',
            '  // keys.p256dh：客户端 ECDH 公钥，用于派生加密密钥',
            '  // keys.auth：认证密钥，用于加密密钥派生',
            '  // expirationTime：订阅过期时间戳，null 表示永不过期',
            '',
            '【发送 subscription 到应用服务器存储】',
            '  await fetch("/api/subscribe", {',
            '    method: "POST",',
            '    headers: { "Content-Type": "application/json" },',
            '    body: JSON.stringify(subscription)',
            '  });',
            '  // 服务器存储 endpoint + keys，后续推送时使用',
            '',
            '【unsubscribe() 取消订阅】',
            '  const subscription = await reg.pushManager.getSubscription();',
            '  if (subscription) {',
            '    const ok = await subscription.unsubscribe();',
            '    if (ok) {',
            '      await fetch("/api/unsubscribe", {',
            '        method: "POST",',
            '        body: JSON.stringify({ endpoint: subscription.endpoint })',
            '      });',
            '    }',
            '  }',
            '',
            '【permissionState() 检查权限】',
            '  // 检查推送权限状态（不弹窗）',
            '  const state = await reg.pushManager.permissionState({',
            '    userVisibleOnly: true',
            '  });',
            '  // "granted" | "denied" | "prompt"',
            '',
            '【getSubscription() 获取已有订阅】',
            '  const sub = await reg.pushManager.getSubscription();',
            '  if (sub) {',
            '    console.log("已订阅", sub.endpoint);',
            '  } else {',
            '    console.log("未订阅");',
            '  }',
            '',
            '【完整订阅流程】',
            '  async function subscribeUser() {',
            '    // 1. 检查支持',
            '    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {',
            '      throw new Error("Push 不支持");',
            '    }',
            '',
            '    // 2. 请求通知权限',
            '    const permission = await Notification.requestPermission();',
            '    if (permission !== "granted") {',
            '      throw new Error("通知权限被拒绝");',
            '    }',
            '',
            '    // 3. 等待 SW 激活',
            '    const reg = await navigator.serviceWorker.ready;',
            '',
            '    // 4. 检查已有订阅',
            '    let sub = await reg.pushManager.getSubscription();',
            '    if (sub) return sub;',
            '',
            '    // 5. 获取 VAPID 公钥并订阅',
            '    const res = await fetch("/api/vapid-public-key");',
            '    const key = await res.arrayBuffer();',
            '    sub = await reg.pushManager.subscribe({',
            '      userVisibleOnly: true,',
            '      applicationServerKey: new Uint8Array(key)',
            '    });',
            '',
            '    // 6. 发送到服务器存储',
            '    await fetch("/api/subscribe", {',
            '      method: "POST",',
            '      headers: { "Content-Type": "application/json" },',
            '      body: JSON.stringify(sub)',
            '    });',
            '',
            '    return sub;',
            '  }',
            '',
            '【浏览器支持】',
            '  PushManager：Chrome 42+/Firefox 44+/Safari 16.4+（桌面）',
            '  iOS Safari：16.4+ 需添加到主屏幕',
            '  applicationServerKey：所有支持 Push 的浏览器',
            '  userVisibleOnly：Chrome 强制 true，Firefox 允许 false（已废弃）',
            '',
            '【常见陷阱】',
            '  1. applicationServerKey 必须是 Uint8Array，非字符串',
            '  2. userVisibleOnly: false 在 Chrome 会抛异常（强制 true）',
            '  3. 订阅可能因浏览器策略自动过期（expirationTime 非 null）',
            '  4. 同一 SW + 同一 applicationServerKey 多次 subscribe 返回相同订阅',
            '  5. 用户清除站点数据后订阅失效，需重新订阅并更新服务器',
            '  6. iOS 需添加到主屏幕 + 用户手动允许通知才能订阅',
        ].join('\n');
        this.setState({ subscribeInfo: info });
        this._addLog('info', '订阅流程演示完成');
    }
    _renderCard5() {
        const s = this.state;
        const f = this._flags();
        const codeExample = [
            'async function subscribe() {',
            '  const reg = await navigator.serviceWorker.ready;',
            '  const sub = await reg.pushManager.subscribe({',
            '    userVisibleOnly: true,',
            '    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)',
            '  });',
            '  await fetch("/api/subscribe", {',
            '    method: "POST",',
            '    body: JSON.stringify(sub)',
            '  });',
            '  console.log(sub.endpoint);',
            '  console.log(sub.keys.p256dh);',
            '  console.log(sub.keys.auth);',
            '}',
        ].join('\n');
        const card = new Card({
            title: '5. Push API 订阅流程 —— subscribe / PushSubscription',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([
                ['PushManager', f.pushManager],
                ['serviceWorker', f.serviceWorker],
            ]), h(Tag, { color: 'primary' }, 'Push API')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'navigator.serviceWorker.ready 等待 SW 激活。registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: VAPID 公钥 })。userVisibleOnly: true 必须显示通知（隐私要求）。applicationServerKey VAPID 公钥（Base64URL 编码）。PushSubscription 对象含 endpoint（推送服务 URL）、keys.p256dh/keys.auth（加密密钥）、expirationTime 订阅过期时间。unsubscribe() 取消订阅，permissionState() 检查权限，getSubscription() 获取已有订阅。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('运行订阅演示', { type: 'primary', size: 'sm', onClick: () => this._runSubscribeDemo() })),
                h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
                h('pre', { class: 'code-block', style: { maxHeight: '260px', overflow: 'auto' } }, h('code', {}, codeExample)),
                h('div', { class: 'fs-sm text-secondary' }, '完整参考：'),
                h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } }, h('code', {}, s.subscribeInfo || '（点击按钮查看 Push API 订阅流程完整用法）')),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // ===================== Card 6：VAPID 与推送加密 =====================
    _runVapidDemo() {
        const f = this._flags();
        this._addLog('info', `supportedContentEncodings=${f.contentEncodings ? JSON.stringify(f.contentEncodings) : 'N/A'}`);
        if (!f.pushManager) {
            this._addLog('warn', 'PushManager 不可用，VAPID 加密文档仅供学习');
        }
        const info = [
            '===== VAPID 与推送加密 =====',
            '',
            '【VAPID（Voluntary Application Server Identification）协议】',
            '  // VAPID 让应用服务器向推送服务自证身份',
            '  // 1. 应用服务器生成一对 ECDSA P-256 密钥',
            '  // 2. 公钥通过 applicationServerKey 传给浏览器 subscribe()',
            '  // 3. 推送时服务器用私钥签 JWT，附在 Authorization 头',
            '  // 4. 推送服务用公钥验签，确认来源合法',
            '',
            '【生成密钥对（Web Push CLI / p256ecdh）】',
            '  # 方式 1：web-push 库（Node.js）',
            '  npx web-push generate-vapid-keys',
            '  # 输出：',
            '  # Public Key:  BNa...",',
            '  # Private Key: zP..."',
            '',
            '  # 方式 2：openssl 命令行',
            '  openssl ecparam -genkey -name prime256v1 -out vapid_private.pem',
            '  openssl ec -in vapid_private.pem -pubout -out vapid_public.pem',
            '',
            '  # 方式 3：浏览器 DevTools 控制台（仅演示）',
            '  const keyPair = await crypto.subtle.generateKey(',
            '    { name: "ECDSA", namedCurve: "P-256" },',
            '    true,',
            '    ["sign", "verify"]',
            '  );',
            '',
            '【applicationServerKey 公钥传给 subscribe()】',
            '  // 公钥需转为 Base64URL 再传给浏览器',
            '  // subscribe() 接收 Uint8Array 格式',
            '  const sub = await reg.pushManager.subscribe({',
            '    userVisibleOnly: true,',
            '    applicationServerKey: urlBase64ToUint8Array(PUBLIC_KEY_BASE64URL)',
            '  });',
            '',
            '  // 转换函数',
            '  function urlBase64ToUint8Array(base64Url) {',
            '    const padding = "=".repeat((4 - base64Url.length % 4) % 4);',
            '    const base64 = (base64Url + padding)',
            '      .replace(/-/g, "+").replace(/_/g, "/");',
            '    const raw = atob(base64);',
            '    return Uint8Array.from(raw, (c: any) => c.charCodeAt(0));',
            '  }',
            '',
            '【推送服务器 HTTP 请求头】',
            '  POST <endpoint> HTTP/1.1',
            '  Host: fcm.googleapis.com',
            '  Authorization: vapid t=<JWT>,k=<P256_PUBLIC_KEY_BASE64URL>',
            '  Content-Encoding: aes128gcm',
            '  Content-Type: application/octet-stream',
            '  Content-Length: <encrypted_payload_length>',
            '',
            '  <encrypted_payload>',
            '',
            '【JWT 签名（ES256 算法）】',
            '  // JWT 结构：header.payload.signature',
            '  // header: {"typ":"JWT","alg":"ES256"}',
            '  // payload: { aud, exp, sub }',
            '',
            '  // Node.js 示例（web-push 库自动处理）',
            '  const jwt = await signJWT({',
            '    aud: "https://fcm.googleapis.com",  // 受众',
            '    exp: Math.floor(Date.now() / 1000) + 43200,  // 12 小时后过期',
            '    sub: "mailto:admin@example.com"  // 联系邮箱',
            '  }, VAPID_PRIVATE_KEY, { algorithm: "ES256" });',
            '',
            '【aud 受众（推送服务域名）】',
            '  // aud 必须是推送服务的域名（从 endpoint URL 提取）',
            '  // Chrome FCM：https://fcm.googleapis.com',
            '  // Firefox Mozilla：https://updates.push.services.mozilla.com',
            '  // Safari APNs：https://api.push.apple.com',
            '',
            '  const endpoint = subscription.endpoint;',
            '  const audience = new URL(endpoint).origin;',
            '  // aud = audience',
            '',
            '【sub 联系邮箱 mailto:】',
            '  sub: "mailto:admin@example.com"',
            '  // 推送服务在滥用时联系应用服务器管理员',
            '  // 必须是 mailto: URL 格式',
            '',
            '【exp 过期时间（≤24h）】',
            '  // JWT 过期时间，从签发起不超过 24 小时',
            '  exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60   // 12 小时',
            '  // 超过 24h 推送服务会拒绝',
            '  // 建议每次推送前重新签 JWT',
            '',
            '【端到端加密 aes128gcm（RFC 8291）】',
            '  // 推送内容用 aes128gcm 加密，推送服务无法解密',
            '  // 加密流程：',
            '  //   1. 从 subscription.keys.p256dh（客户端公钥）+ subscription.keys.auth（认证密钥）',
            '  //      用 ECDH + HKDF 派生内容加密密钥（CEK）和 nonce',
            '  //   2. 用 CEK + nonce + aes128gcm 加密 payload',
            '  //   3. 加密后的字节流 + 加密头信息组成最终请求体',
            '',
            '  // Node.js 示例（web-push 库封装）',
            '  const webpush = require("web-push");',
            '  await webpush.sendNotification(subscription, JSON.stringify(payload), {',
            '    vapidDetails: {',
            '      subject: "mailto:admin@example.com",',
            '      publicKey: VAPID_PUBLIC_KEY,',
            '      privateKey: VAPID_PRIVATE_KEY',
            '    }',
            '  });',
            '  // 库自动：JWT 签名 + aes128gcm 加密 + HTTP POST',
            '',
            '【keys.p256dh + keys.auth 派生密钥】',
            '  // 客户端 subscribe() 时生成 ECDH P-256 密钥对',
            '  //   p256dh = 客户端公钥（Base64URL）',
            '  //   auth = 随机 16 字节认证密钥（Base64URL）',
            '  // 服务器用：',
            '  //   1. 自己的 ECDH 私钥 + p256dh → 共享密钥（ECDH）',
            '  //   2. 共享密钥 + auth → HKDF 派生 CEK 与 nonce',
            '  //   3. CEK + nonce → aes128gcm 加密 payload',
            '',
            '【Payload 加密后才发送到 endpoint】',
            '  // 明文 payload → JSON 字符串 → UTF-8 字节 → aes128gcm 加密',
            '  // → 加密字节流 + 头 → POST 到 endpoint',
            '  // 推送服务只看到密文，浏览器 SW 用密钥解密',
            '',
            '【VAPID vs FCM Server Key（旧方案）】',
            '  // 旧方案：Chrome 用 FCM Server Key（Authorization: key=...）',
            '  // 新方案：VAPID（跨浏览器统一，Authorization: vapid t=...,k=...）',
            '  // FCM Server Key 已废弃，新项目应只用 VAPID',
            '',
            '【浏览器支持】',
            '  VAPID：Chrome 52+/Firefox 49+/Safari 16.4+',
            '  aes128gcm（RFC 8291）：所有现代浏览器（Chrome 70+/Firefox 75+）',
            '  旧 aes128gcm 替代 aesgcm128/aesgcm 已废弃',
            `  supportedContentEncodings: ${f.contentEncodings ? JSON.stringify(f.contentEncodings) : 'N/A'}`,
            '',
            '【常见陷阱】',
            '  1. VAPID 公钥/私钥必须成对生成，不可混用',
            '  2. applicationServerKey 必须与 VAPID 私钥对应，否则订阅失败',
            '  3. JWT exp 超 24h 被推送服务拒绝',
            '  4. aud 必须是 endpoint 域名，不能用应用服务器域名',
            '  5. payload 超 4KB（部分浏览器限制不同）被推送服务拒绝',
            '  6. 不同浏览器推送服务不同，但 VAPID 统一处理',
        ].join('\n');
        this.setState({ vapidInfo: info });
        this._addLog('info', 'VAPID 与加密演示完成');
    }
    _renderCard6() {
        const s = this.state;
        const f = this._flags();
        const codeExample = [
            '// Node.js 推送服务器（web-push 库）',
            'const webpush = require("web-push");',
            'webpush.setVapidDetails(',
            '  "mailto:admin@example.com",',
            '  VAPID_PUBLIC_KEY,',
            '  VAPID_PRIVATE_KEY',
            ');',
            'await webpush.sendNotification(subscription, JSON.stringify(payload), {',
            '  TTL: 60 * 60, // 1 小时',
            '});',
            '// 内部：JWT(ES256) + aes128gcm 加密 + POST endpoint',
            '// Authorization: vapid t=<JWT>,k=<P256_PUBLIC_KEY>',
        ].join('\n');
        const card = new Card({
            title: '6. VAPID 与推送加密 —— 身份认证与端到端加密',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([
                ['PushManager', f.pushManager],
                ['contentEncodings', !!f.contentEncodings],
            ]), h(Tag, { color: 'primary' }, 'VAPID')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'VAPID（Voluntary Application Server Identification）协议：生成 ECDSA P-256 密钥对，applicationServerKey 公钥传给 subscribe()。推送服务器 HTTP 请求头 Authorization: vapid t=JWT,k=P256_PUBLIC_KEY。JWT 签名（ES256 算法），aud 受众（推送服务域名）、sub 联系邮箱 mailto:、exp 过期时间（≤24h）。端到端加密 aes128gcm（RFC 8291），keys.p256dh + keys.auth 派生密钥，Payload 加密后才发送到 endpoint，推送服务无法解密。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('运行 VAPID 演示', { type: 'primary', size: 'sm', onClick: () => this._runVapidDemo() })),
                h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
                h('pre', { class: 'code-block', style: { maxHeight: '240px', overflow: 'auto' } }, h('code', {}, codeExample)),
                h('div', { class: 'fs-sm text-secondary' }, '完整参考：'),
                h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } }, h('code', {}, s.vapidInfo || '（点击按钮查看 VAPID 与推送加密完整深潜）')),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // ===================== Card 7：Service Worker push 事件处理 =====================
    _runPushEventDemo() {
        const f = this._flags();
        if (!f.serviceWorker) {
            this._addLog('warn', 'serviceWorker 不可用，push 事件文档仅供学习');
        }
        else {
            this._addLog('info', 'push 事件需真实推送服务触发，本环境仅展示文档');
        }
        const info = [
            '===== Service Worker push 事件处理 =====',
            '',
            '【ServiceWorkerGlobalScope.onpush 事件】',
            '  // sw.js',
            '  self.addEventListener($1, (event: any) => {',
            '    console.log("收到推送", event);',
            '    // event.data 包含推送内容',
            '    // event.waitUntil() 保持 SW 活跃直到通知显示',
            '  });',
            '',
            '【event.data PushMessageData 多种解析】',
            '  // PushMessageData 支持多种格式解析',
            '  self.addEventListener($1, (event: any) => {',
            '    let payload;',
            '    try {',
            '      payload = event.data.json();    // 解析为 JSON 对象',
            '    } catch {',
            '      payload = { title: "通知", body: event.data.text() };  // 文本',
            '    }',
            '    // 或按需选择：',
            '    // event.data.text()         // 字符串',
            '    // event.data.json()         // JSON 对象',
            '    // event.data.arrayBuffer() // ArrayBuffer（二进制）',
            '    // event.data.blob()         // Blob 对象',
            '    // event.data.blob()         // 可用于图片/二进制数据',
            '  });',
            '',
            '  // 注意：event.data 在无 payload 推送时为 null',
            '  // 需做空值检查',
            '',
            '【event.waitUntil(showNotification()) 必须显示通知】',
            '  // userVisibleOnly 要求：每次 push 必须显示通知',
            '  // 否则浏览器显示默认通知「此站点已更新」',
            '  self.addEventListener($1, (event: any) => {',
            '    const payload = event.data ? event.data.json() : {}',
            '    event.waitUntil(',
            '      self.registration.showNotification(payload.title || "通知", {',
            '        body: payload.body || ""',
            '      })',
            '    );',
            '  });',
            '',
            '  // waitUntil 确保 SW 在 showNotification 完成前不被中止',
            '  // 浏览器会等待 Promise resolve 后才休眠 SW',
            '',
            '【pushsubscriptionchange 订阅失效事件】',
            '  // 订阅可能因浏览器/推送服务策略失效',
            '  // 需重新订阅并更新服务器',
            '  self.addEventListener($1, (event: any) => {',
            '    event.waitUntil(',
            '      (async () => {',
            '        // 1. 重新订阅',
            '        const reg = await self.registration.pushManager.subscribe({',
            '          userVisibleOnly: true,',
            '          applicationServerKey: urlBase64ToUint8Array(VAPID_KEY)',
            '        });',
            '        // 2. 通知服务器更新订阅',
            '        await fetch("/api/subscribe", {',
            '          method: "POST",',
            '          body: JSON.stringify(subscription)',
            '        });',
            '      })()',
            '    );',
            '  });',
            '  // 注意：pushsubscriptionchange 在部分浏览器支持有限',
            '  // 建议在每次页面加载时检查订阅有效性',
            '',
            '【notificationclick 处理点击打开对应页面】',
            '  self.addEventListener($1, (event: any) => {',
            '    const data = event.notification.data || {}',
            '    event.notification.close();',
            '    const url = data.url || "/";',
            '    event.waitUntil(',
            '      clients.matchAll({ type: "window", includeUncontrolled: true })',
            '        .then((list: any) => {',
            '          for (const client of list) {',
            '            if (client.url.includes(url) && "focus" in client) {',
            '              return client.focus();',
            '            }',
            '          }',
            '          return clients.openWindow(url);',
            '        })',
            '    );',
            '  });',
            '',
            '【完整推送消息处理流程】',
            '  // 1. push 事件 → 解析 data',
            '  self.addEventListener($1, (event: any) => {',
            '    let payload = { title: "通知", body: "" }',
            '    if (event.data) {',
            '      try { payload = event.data.json(); }',
            '      catch { payload.body = event.data.text(); }',
            '    }',
            '',
            '    // 2. showNotification 显示通知',
            '    event.waitUntil(',
            '      self.registration.showNotification(payload.title, {',
            '        body: payload.body,',
            '        icon: payload.icon || "/icon.png",',
            '        data: { url: payload.url || "/", id: payload.id }',
            '      })',
            '    );',
            '  });',
            '',
            '  // 3. 用户点击 → notificationclick',
            '  self.addEventListener($1, (event: any) => {',
            '    const data = event.notification.data || {}',
            '    event.notification.close();',
            '',
            '    // 4. 打开/聚焦页面',
            '    event.waitUntil(',
            '      clients.matchAll({ type: "window", includeUncontrolled: true })',
            '        .then((list: any) => {',
            '          for (const c of list) {',
            '            if (c.url.includes(data.url) && "focus" in c) return c.focus();',
            '          }',
            '          return clients.openWindow(data.url);',
            '        })',
            '        // 5. 后台同步数据',
            '        .then(() => {',
            '          if (data.id) {',
            '            return fetch(`/api/mark-read/${data.id}`, { method: "POST" });',
            '          }',
            '        })',
            '    );',
            '  });',
            '',
            '【无 payload 推送处理】',
            '  // 部分推送服务可能发送空 body',
            '  self.addEventListener($1, (event: any) => {',
            '    let payload = { title: "新消息", body: "点击查看" };',
            '    if (event.data) {',
            '      payload = event.data.json();',
            '    }',
            '    event.waitUntil(',
            '      self.registration.showNotification(payload.title, { body: payload.body })',
            '    );',
            '  });',
            '',
            '【浏览器支持】',
            '  push 事件：Chrome 42+/Firefox 44+/Safari 16.4+',
            '  PushMessageData.json/text/arrayBuffer/blob：所有支持 Push 的浏览器',
            '  pushsubscriptionchange：支持有限（Chrome 不触发，Firefox 触发）',
            '  notificationclick：所有支持 SW 通知的浏览器',
            '',
            '【常见陷阱】',
            '  1. event.data 可能为 null（无 payload 推送），需做空值检查',
            '  2. 不调用 showNotification 浏览器显示默认通知',
            '  3. waitUntil 中 Promise reject 会让浏览器认为推送失败',
            '  4. pushsubscriptionchange 在 Chrome 不触发，需页面加载时主动检查',
            '  5. notificationclick 中不 close() 通知会残留',
            '  6. clients.matchAll 默认不返回非控制标签，需 includeUncontrolled: true',
        ].join('\n');
        this.setState({ pushEventInfo: info });
        this._addLog('info', 'push 事件演示完成');
    }
    _renderCard7() {
        const s = this.state;
        const f = this._flags();
        const codeExample = [
            '// sw.js —— push 事件处理',
            'self.addEventListener($1, (event: any) => {',
            '  let payload = { title: "通知", body: "" };',
            '  try { payload = event.data.json(); }',
            '  catch { payload.body = event.data.text(); }',
            '  event.waitUntil(',
            '    self.registration.showNotification(payload.title, {',
            '      body: payload.body,',
            '      data: payload',
            '    })',
            '  );',
            '});',
            'self.addEventListener($1, (event: any) => {',
            '  event.waitUntil(subscribeAndSendToServer());',
            '});',
        ].join('\n');
        const card = new Card({
            title: '7. Service Worker push 事件处理 —— onpush / waitUntil',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([['serviceWorker', f.serviceWorker]]), h(Tag, { color: 'primary' }, 'push 事件')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'ServiceWorkerGlobalScope.onpush 事件接收推送。event.data 是 PushMessageData，支持 .json()/.text()/.arrayBuffer()/.blob() 多种解析。event.waitUntil(showNotification()) 必须显示通知（userVisibleOnly 要求，否则浏览器显示默认通知）。pushsubscriptionchange 订阅失效事件（需重新订阅并更新服务器，Chrome 支持有限）。notificationclick 处理点击打开对应页面。完整流程：push 事件 → 解析 data → showNotification → 用户点击 → notificationclick → 打开/聚焦页面 → 后台同步数据。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('运行 push 事件演示', { type: 'primary', size: 'sm', onClick: () => this._runPushEventDemo() })),
                h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
                h('pre', { class: 'code-block', style: { maxHeight: '300px', overflow: 'auto' } }, h('code', {}, codeExample)),
                h('div', { class: 'fs-sm text-secondary' }, '完整参考：'),
                h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } }, h('code', {}, s.pushEventInfo || '（点击按钮查看 push 事件处理完整用法）')),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // ===================== Card 8：完整推送系统架构与陷阱 =====================
    _runArchitectureDemo() {
        const f = this._flags();
        this._addLog('info', '架构流程演示完成；含 9 步端到端流程 + 浏览器推送服务对照 + 陷阱清单');
        if (!f.pushManager) {
            this._addLog('warn', 'PushManager 不可用，架构图仅供学习');
        }
        const info = [
            '===== 完整推送系统架构与陷阱 =====',
            '',
            '【端到端流程（9 步）】',
            '  Step 1 [client]  用户点击订阅按钮',
            '                  → pushManager.subscribe({ userVisibleOnly, applicationServerKey })',
            '  Step 2 [client]  获取 PushSubscription（endpoint + keys.p256dh + keys.auth）',
            '  Step 3 [client]  POST subscription 到应用服务器 /api/subscribe',
            '  Step 4 [server]  服务器存储 subscription（数据库）',
            '  Step 5 [server]  触发推送（定时任务/事件触发）',
            '  Step 6 [server]  用 VAPID 私钥签 JWT + aes128gcm 加密 payload',
            '  Step 7 [server]  POST 加密 payload 到 endpoint（FCM/Mozilla/Apple 推送服务）',
            '  Step 8 [push]    推送服务转发到用户设备（通过设备长连接）',
            '  Step 9 [sw]      浏览器唤醒 Service Worker → push 事件 → showNotification',
            '                  → 用户点击 → notificationclick → 打开/聚焦页面',
            '',
            '【各浏览器推送服务对照】',
            '  Chrome/Edge  → FCM（Firebase Cloud Messaging）',
            '                 endpoint: https://fcm.googleapis.com/fcm/send/...',
            '                 需 Google 服务（中国大陆需翻墙或自建代理）',
            '',
            '  Firefox      → Mozilla Push Service',
            '                 endpoint: https://updates.push.services.mozilla.com/...',
            '                 全球可用',
            '',
            '  Safari       → APNs（Apple Push Notification service）',
            '                 endpoint: https://api.push.apple.com/...',
            '                 需 Apple Developer 账号（$99/年）+ APNs 证书',
            '                 macOS Safari 16.4+ / iOS Safari 16.4+ 支持 Web Push',
            '',
            '【陷阱清单】',
            '  1. 必须 HTTPS',
            '     - Notifications/Push API 仅在安全上下文可用',
            '     - localhost/127.0.0.1 例外（开发环境）',
            '',
            '  2. 订阅可能过期需 refresh',
            '     - expirationTime 非 null 时订阅会过期',
            '     - 浏览器/系统策略可能主动失效订阅',
            '     - 用户清除站点数据后订阅失效',
            '     - 建议：页面加载时 getSubscription() 检查，失效则重新订阅',
            '',
            '  3. 不同浏览器推送服务不同',
            '     - Chrome → FCM，Firefox → Mozilla，Safari → APNs',
            '     - 但 VAPID 统一身份认证，应用服务器代码无需区分',
            '     - 仅 endpoint URL 不同，POST 逻辑相同',
            '',
            '  4. Safari 16.4+ 才支持 Web Push 且需 APNs 证书',
            '     - macOS Safari 16.4+ 支持（需升级系统）',
            '     - iOS/iPadOS Safari 16.4+ 需添加到主屏幕',
            '     - 需 Apple Developer 账号 + 站点关联 APNs 证书',
            '     - Safari < 16.4 完全不支持 Web Push',
            '',
            '  5. 订阅 endpoint 不可跨用户复用',
            '     - 每个 endpoint 绑定唯一设备 + 浏览器',
            '     - 用户卸载/重装浏览器后 endpoint 失效',
            '     - 多设备用户需存储多个 subscription',
            '',
            '  6. payload 大小限制 4KB',
            '     - 大多数推送服务限制 payload ≤ 4078 字节（加密后）',
            '     - 超限被推送服务拒绝（413 Payload Too Large）',
            '     - 解决：推送只发通知 ID，客户端 fetch 拉取完整内容',
            '',
            '  7. TTL（Time To Live）推送存活时间',
            '     - HTTP 头 TTL: <seconds>，推送服务缓存时长',
            '     - 设备离线时推送服务暂存，TTL 过期丢弃',
            '     - TTL=0：实时推送，设备离线则丢弃',
            '     - 默认/最大通常 2419200 秒（28 天）',
            '',
            '【降级方案】',
            '  Safari < 16.4（不支持 Web Push）',
            '    → 用 APNs 原生 SDK（需 native app）',
            '    → 或用 Polling（页面打开时轮询服务器）',
            '    → 或用 WebSocket（页面打开时保持连接）',
            '',
            '  非 HTTPS 环境',
            '    → 用第三方推送服务（如 OneSignal/Firebase）',
            '    → OneSignal 提供 HTTPS 子域名托管',
            '',
            '  旧版浏览器',
            '    → Chrome < 42 用 GCM SDK（已废弃）',
            '    → Safari < 16.4 无降级（必须 native app）',
            '',
            '【隐私：userVisibleOnly 强制显示通知避免隐形推送】',
            '  - userVisibleOnly: true 强制每次推送都显示通知',
            '  - 防止应用服务器在用户不知情下唤醒 SW 收集数据',
            '  - Chrome 48+ 强制 true，false 抛异常',
            '  - Silent Push（实验性，需特殊权限）允许不显示通知',
            '    → 仅用于紧急安全通知（如账号被入侵）',
            '',
            '【调试技巧】',
            '  - chrome://gcm-internals/',
            '    → Chrome 内部页面，查看 GCM/FCM 推送状态',
            '    → 调试订阅/推送/送达问题',
            '',
            '  - chrome://serviceworker-internals/',
            '    → 查看/调试已注册的 Service Worker',
            '    → 手动触发 push 事件测试',
            '',
            '  - DevTools → Application → Service Workers',
            '    → 查看注册的 SW，可 push 模拟',
            '    → Unregister/Update/Inspect SW',
            '',
            '  - DevTools → Application → Push Messaging',
            '    → 查看订阅状态，模拟推送',
            '',
            '  - Firefox：about:debugging#/runtime/this-firefox',
            '    → 查看 SW，可手动触发 push',
            '',
            '  - 在线工具：web-push-codelab.glitch.me',
            '    → 浏览器内测试推送全流程',
            '',
            '【与 Background Sync / Periodic Background Sync 协同】',
            '  - Background Sync：用户联网时后台同步数据',
            '    → self.addEventListener($1, (e: any) => { ... })',
            '    → 适合「离线操作队列」场景',
            '',
            '  - Periodic Background Sync：周期性后台同步',
            '    → self.addEventListener($1, (e: any) => { ... })',
            '    → 需 register periodicSync，最小间隔由浏览器决定',
            '    → 适合「定期更新缓存」场景',
            '',
            '  - Push：服务器主动推送通知',
            '    → 适合「实时消息提醒」场景',
            '',
            '  - 三者协同：',
            '    → Push 触发通知 → 用户点击 → Background Sync 同步数据',
            '    → Periodic Sync 定期拉取 → 必要时本地通知（无 Push）',
            '',
            '【架构设计建议】',
            '  1. 订阅管理：服务器存储 subscription 时关联 userId + deviceInfo',
            '  2. 失效检测：推送失败（410 Gone）时删除 subscription',
            '  3. 多设备：同一用户多个 subscription，遍历推送',
            '  4. 频率控制：避免高频推送导致用户关闭通知权限',
            '  5. A/B 测试：payload 中带实验标识，统计打开率',
            '  6. 时区感知：定时推送考虑用户时区（payload 带 sendAt）',
            '',
            '【浏览器支持总览】',
            '  Notifications API：所有现代浏览器（HTTPS）',
            '  Push API：Chrome 42+/Firefox 44+/Safari 16.4+',
            '  VAPID：Chrome 52+/Firefox 49+/Safari 16.4+',
            '  iOS Web Push：16.4+ 需添加到主屏幕',
            '  Safari APNs 证书：需 Apple Developer 账号',
            '',
            '【资源】',
            '  - Notifications API 规范：https://notifications.spec.whatwg.org/',
            '  - Push API 规范：https://w3c.github.io/push-api/',
            '  - VAPID 规范（RFC 8292）：https://datatracker.ietf.org/doc/rfc8292/',
            '  - aes128gcm 加密（RFC 8291）：https://datatracker.ietf.org/doc/rfc8291/',
            '  - web-push 库（Node.js）：https://github.com/web-push-libs/web-push',
            '  - MDN Push API：https://developer.mozilla.org/docs/Web/API/Push_API',
            '  - web-push-codelab：https://web-push-codelab.glitch.me/',
        ].join('\n');
        this.setState({ architectureInfo: info });
        this._addLog('info', '架构与陷阱演示完成');
    }
    _renderCard8() {
        const s = this.state;
        const f = this._flags();
        const codeExample = [
            '端到端流程：',
            '  client subscribe → POST /api/subscribe → server store',
            '  → server trigger → VAPID sign + aes128gcm encrypt',
            '  → POST endpoint (FCM/APNs/Mozilla) → push service',
            '  → wake SW → push event → showNotification → user click',
            '  → notificationclick → open/focus page → background sync',
        ].join('\n');
        const card = new Card({
            title: '8. 完整推送系统架构与陷阱 —— 端到端流程图',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([
                ['PushManager', f.pushManager],
                ['serviceWorker', f.serviceWorker],
            ]), h(Tag, { color: 'primary' }, '架构')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, '端到端流程：用户订阅 → 发送 subscription 到应用服务器 → 服务器存储 → 触发推送 → 应用服务器用 VAPID 签名 + 加密 payload → 发送到推送服务（FCM/Mozilla/Apple）→ 推送服务转发到用户设备 → 浏览器唤醒 SW → push 事件 → showNotification。各浏览器推送服务：Chrome=FCM、Firefox=mozilla push、Safari=APNs 需 Apple Developer 账号。陷阱：必须 HTTPS/订阅可能过期需 refresh/Safari 16.4+ 才支持/订阅 endpoint 不可跨用户复用/payload 4KB 限制。降级：Safari < 16.4 用 APNs 原生 SDK。隐私：userVisibleOnly 强制显示通知。调试：chrome://gcm-internals/。与 Background Sync/Periodic Background Sync 协同。'),
                h('div', { class: 'fs-sm text-secondary' }, '端到端流程图：'),
                h('div', { class: 'np-flow' }, h('div', { class: 'np-flow-step np-flow-step--client' }, h('span', { class: 'np-flow-step-num' }, '1'), h('span', {}, '【client】用户点击订阅，pushManager.subscribe({ userVisibleOnly, applicationServerKey })')), h('div', { class: 'np-flow-arrow' }, '↓'), h('div', { class: 'np-flow-step np-flow-step--client' }, h('span', { class: 'np-flow-step-num' }, '2'), h('span', {}, '【client】获取 PushSubscription（endpoint + keys.p256dh + keys.auth）')), h('div', { class: 'np-flow-arrow' }, '↓'), h('div', { class: 'np-flow-step np-flow-step--client' }, h('span', { class: 'np-flow-step-num' }, '3'), h('span', {}, '【client】POST subscription 到应用服务器 /api/subscribe')), h('div', { class: 'np-flow-arrow' }, '↓'), h('div', { class: 'np-flow-step np-flow-step--server' }, h('span', { class: 'np-flow-step-num' }, '4'), h('span', {}, '【server】服务器存储 subscription（关联 userId + deviceInfo）')), h('div', { class: 'np-flow-arrow' }, '↓'), h('div', { class: 'np-flow-step np-flow-step--server' }, h('span', { class: 'np-flow-step-num' }, '5'), h('span', {}, '【server】触发推送（定时任务/事件触发，遍历多设备 subscription）')), h('div', { class: 'np-flow-arrow' }, '↓'), h('div', { class: 'np-flow-step np-flow-step--server' }, h('span', { class: 'np-flow-step-num' }, '6'), h('span', {}, '【server】VAPID 私钥签 JWT(ES256) + aes128gcm 加密 payload（≤4KB）')), h('div', { class: 'np-flow-arrow' }, '↓'), h('div', { class: 'np-flow-step np-flow-step--server' }, h('span', { class: 'np-flow-step-num' }, '7'), h('span', {}, '【server】POST 加密 payload 到 endpoint（Authorization: vapid t=JWT,k=KEY）')), h('div', { class: 'np-flow-arrow' }, '↓'), h('div', { class: 'np-flow-step np-flow-step--push' }, h('span', { class: 'np-flow-step-num' }, '8'), h('span', {}, '【push service】FCM/Mozilla/Apple 转发到用户设备（设备长连接）')), h('div', { class: 'np-flow-arrow' }, '↓'), h('div', { class: 'np-flow-step np-flow-step--sw' }, h('span', { class: 'np-flow-step-num' }, '9'), h('span', {}, '【SW】浏览器唤醒 Service Worker → push 事件 → showNotification → 用户点击 → notificationclick → 打开/聚焦页面'))),
                h('div', { class: 'flex items-center gap-sm flex-wrap mt-md' }, this._btn('运行架构演示', { type: 'primary', size: 'sm', onClick: () => this._runArchitectureDemo() })),
                h('div', { class: 'fs-sm text-secondary' }, '代码示例：'),
                h('pre', { class: 'code-block', style: { maxHeight: '180px', overflow: 'auto' } }, h('code', {}, codeExample)),
                h('div', { class: 'fs-sm text-secondary' }, '完整参考：'),
                h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } }, h('code', {}, s.architectureInfo || '（点击按钮查看完整推送系统架构与陷阱清单）')),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    _renderLogPanel() {
        const s = this.state;
        if (!s.logs || s.logs.length === 0)
            return null;
        return h(Card, { title: '运行日志' }, h('div', { class: 'log-list' }, ...s.logs.map((log) => h('div', { class: `log-item log-${log.type}` }, h('span', { class: 'log-time' }, log.time), h('span', { class: 'log-content' }, log.content)))));
    }
    renderPage() {
        const s = this.state;
        return [
            h('h2', { class: 'section-title' }, 'Web Notifications & Push API 通知与推送深度实验室'),
            h(Alert, {
                type: 'info',
                message: 'Notifications API + Push API —— 浏览器原生消息推送体系',
                description: '演示 Notifications API 基础与权限（Notification 构造器/requestPermission 三态/permission/maxActions 静态属性/permissionchange/HTTPS 要求/用户激活）、Notification options 全字段深潜（title/body/dir/lang/icon/badge/image/tag/data/silent/requireInteraction/vibrate/renotify/actions/sticky 14 字段）、Notification 事件与 Service Worker 通知（onclick/onshow/onerror/onclose/showNotification/notificationclick/notificationclose/getNotifications/SW vs window）、Notification actions 操作按钮（actions 数组/event.action/event.reply/event.waitUntil/maxActions 上限/桌面 Android 差异）、Push API 订阅流程（serviceWorker.ready/subscribe/userVisibleOnly/applicationServerKey/PushSubscription/unsubscribe/permissionState）、VAPID 与推送加密（VAPID 协议/密钥对/JWT ES256/aud/sub/exp/aes128gcm RFC 8291/keys.p256dh + keys.auth 派生）、Service Worker push 事件处理（onpush/PushMessageData/waitUntil/pushsubscriptionchange/notificationclick/完整流程）、完整推送系统架构与陷阱（9 步端到端流程图/FCM/APNs/Mozilla 推送服务/Safari 16.4+ 限制/payload 4KB/降级方案/隐私 userVisibleOnly/调试 chrome://gcm-internals//Background Sync 协同）。用 typeof 检测，jsdom 无 Notification/PushManager 真实实现但流程完整。',
            }),
            s.capsSummary !== '' ? h(Alert, { type: 'info', message: s.capsSummary }) : null,
            h('div', { class: 'feature-grid' }, this._renderCard1(), this._renderCard2(), this._renderCard3(), this._renderCard4(), this._renderCard5(), this._renderCard6(), this._renderCard7(), this._renderCard8()),
            this._renderLogPanel(),
        ];
    }
}
//# sourceMappingURL=WebNotificationsPushDeepPage.js.map