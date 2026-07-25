// =====================================================================
// UIExtensionsAPIPage.js —— UI 扩展与浏览器扩展 API 实验室
// 演示 Manifest V3 浏览器扩展 API（chrome.* / browser.* 命名空间）：
//   1. browser.sidePanel / chrome.sidePanel —— 声明式侧边栏
//      sidePanel.setOptions / setPanelBehavior / open / onOpened / onClosed
//      + manifest side_panel + action.default_popup 替代 + Chrome 114+
//   2. MV3 Service Worker 生命周期 —— chrome.runtime.onInstalled /
//      onStartup / alarms / keepalive（与 SW 持久化对比 + 5min 超时）
//   3. chrome.action 工具栏按钮 —— setIcon/setTitle/setPopup +
//      onClicked + enable/disable + Manifest V2 browser_action 弃用
//   4. chrome.commands 全局快捷键 + chrome.contextMenus 上下文菜单
//      commands manifest + onCommand + chrome.contextMenus.create/onClick
//   5. chrome.scripting 内容脚本注入 —— executeScript / insertCSS /
//      registerContentScripts + 与 MV2 tabs.executeScript 对比 + MAIN world
//   6. chrome.declarativeNetRequest 声明式网络规则 ——
//      updateDynamicRules / updateSessionRules / getMatchedRules +
//      rule_types request/block/redirect/modifyHeaders + 与 webRequest 对比
// 说明：本页聚焦浏览器扩展 API，不属于常规 Web API（仅扩展环境可用）。
//       所有特性调用前做 typeof 全局命名空间检测，不可用时仅记日志，
//       绝不抛异常。普通网页/chrome.* / browser.* 均为 undefined，
//       演示以代码片段 + manifest 示例形式展示真实扩展环境中的预期行为。
// =====================================================================
import { Page } from '../../core/Component.js';
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';

export class UIExtensionsAPIPage extends Page {
  // —— 初始 state ——
  initialState() {
    return {
      logs: [],
      capsSummary: '',
      // Card 1：browser.sidePanel
      sidePanelInfo: '',
      // Card 2：MV3 Service Worker 生命周期
      swLifecycleInfo: '',
      // Card 3：chrome.action 工具栏按钮
      actionInfo: '',
      // Card 4：commands + contextMenus
      commandsMenusInfo: '',
      // Card 5：chrome.scripting 内容脚本注入
      scriptingInfo: '',
      // Card 6：declarativeNetRequest 网络规则
      dnrInfo: '',
    };
  }

  // —— 生命周期 ——
  componentDidMount() {
    // ★★★ 关键守卫：必须存在！否则 setState => rerender => componentDidMount 死循环导致 OOM
    if (this._inited) return;
    this._inited = true;

    // 一次性初始化各实例引用（componentWillUnmount 中释放）
    this._createdContextMenuIds = []; // Card 4 模拟创建的菜单项 id（mock）
    this._registeredScriptIds = [];   // Card 5 模拟注册的 content script id（mock）
    this._dynamicRuleIds = [];        // Card 6 模拟添加的 dynamic rule id（mock）

    const caps = this._flags();
    const c = (ok) => ok ? '✓' : '✗';
    const parts = [
      `chrome ${c(caps.chrome)}`,
      `browser ${c(caps.browser)}`,
      `runtime ${c(caps.runtime)}`,
      `sidePanel ${c(caps.sidePanel)}`,
      `action ${c(caps.action)}`,
      `commands ${c(caps.commands)}`,
      `contextMenus ${c(caps.contextMenus)}`,
      `scripting ${c(caps.scripting)}`,
      `declarativeNetRequest ${c(caps.dnr)}`,
      `alarms ${c(caps.alarms)}`,
      `tabs ${c(caps.tabs)}`,
      `storage.local ${c(caps.storageLocal)}`,
    ];

    const any = caps.chrome || caps.browser;
    const summary = any
      ? `扩展 API 命名空间检测：${parts.join(' · ')}。当前环境检测到 chrome/browser 全局，但部分 API 可能仍需扩展上下文（manifest + 权限）才能调用。`
      : `扩展 API 命名空间检测：${parts.join(' · ')}。普通网页中 chrome.* / browser.* 均为 undefined（仅扩展运行时可用）；本页所有按钮点击将仅记日志说明 + 展示 manifest/代码示例，不会抛异常。安装到浏览器扩展环境时可完整演示。`;

    this.setState({ capsSummary: summary });
    this._addLog(any ? 'info' : 'warn', `能力检测：${parts.join('，')}`);
    if (!caps.sidePanel) this._addLog('warn', 'chrome.sidePanel 不可用（Chrome 114+ 扩展环境，需 manifest side_panel 权限）');
    if (!caps.scripting) this._addLog('warn', 'chrome.scripting 不可用（MV3 替代 tabs.executeScript，需 scripting 权限）');
    if (!caps.dnr) this._addLog('warn', 'chrome.declarativeNetRequest 不可用（MV3 替代 webRequest 阻塞，需 declarativeNetRequest 权限）');
  }

  componentWillUnmount() {
    // 清空 mock 创建的资源引用
    this._createdContextMenuIds = [];
    this._registeredScriptIds = [];
    this._dynamicRuleIds = [];
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

  // 返回 Tag 数组：items = [[label, ok], ...]，展示能力状态（✓/✗）
  _caps(items) {
    return items.map(([label, ok]) =>
      h(Tag, { color: ok ? 'success' : 'error' }, `${label} ${ok ? '✓' : '✗'}`));
  }

  // 返回布尔能力对象（供 capsSummary / 按钮 disabled 使用）
  _flags() {
    // chrome 命名空间：扩展环境下全局 chrome 可用；普通网页为 undefined
    let chromeNS = false;
    try { chromeNS = typeof chrome !== 'undefined' && !!chrome; } catch { chromeNS = false; }
    // browser 命名空间：Firefox/Edge 兼容命名空间（Promise-based）
    let browserNS = false;
    try { browserNS = typeof browser !== 'undefined' && !!browser; } catch { browserNS = false; }
    const get = (ns, ...path) => {
      try {
        let cur = ns === 'chrome' ? chrome : browser;
        for (const k of path) {
          if (!cur || typeof cur !== 'object') return false;
          cur = cur[k];
        }
        return !!cur;
      } catch { return false; }
    };
    const any = chromeNS || browserNS;
    return {
      chrome: chromeNS,
      browser: browserNS,
      runtime: any && (get('chrome', 'runtime') || get('browser', 'runtime')),
      sidePanel: any && (get('chrome', 'sidePanel') || get('browser', 'sidePanel')),
      action: any && (get('chrome', 'action') || get('browser', 'action')),
      commands: any && (get('chrome', 'commands') || get('browser', 'commands')),
      contextMenus: any && (get('chrome', 'contextMenus') || get('browser', 'contextMenus')),
      scripting: any && (get('chrome', 'scripting') || get('browser', 'scripting')),
      dnr: any && (get('chrome', 'declarativeNetRequest') || get('browser', 'declarativeNetRequest')),
      alarms: any && (get('chrome', 'alarms') || get('browser', 'alarms')),
      tabs: any && (get('chrome', 'tabs') || get('browser', 'tabs')),
      storageLocal: any && (get('chrome', 'storage', 'local') || get('browser', 'storage', 'local')),
    };
  }

  // =================== Card 1：browser.sidePanel ===================

  _demoSidePanel() {
    const f = this._flags();
    try {
      // 构造示例 manifest + side_panel 配置（不真实调用，仅展示）
      const manifestSample = {
        manifest_version: 3,
        name: 'Side Panel Demo',
        version: '1.0',
        permissions: ['sidePanel'],
        side_panel: {
          default_path: 'sidepanel.html',
        },
        action: {
          default_title: '点击切换侧边栏',
        },
        background: {
          service_worker: 'background.js',
          type: 'module',
        },
      };
      const bgCode =
`// background.js（MV3 Service Worker）
// 关键 API：chrome.sidePanel.setOptions / setPanelBehavior / open

// 1) 安装时：设置默认侧边栏页面
chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setOptions({
    enabled: true,
    path: 'sidepanel.html',         // 任意扩展内 HTML 页面
  });
  // setPanelBehavior({ openPanelOnActionClick: true })
  //   —— 让点击 action 按钮直接切换侧边栏（无需 popup）
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
    .catch((err) => console.error(err));
});

// 2) 监听 action 点击：打开/关闭侧边栏
chrome.action.onClicked.addListener(async (tab) => {
  // 程序化打开（设置当前 tab 的侧边栏）
  await chrome.sidePanel.open({ windowId: tab.windowId });
  // setOptions 也可按 tab 维度定制不同 path
  await chrome.sidePanel.setOptions({
    tabId: tab.id,
    path: tab.url.startsWith('https://github.com') ? 'github-panel.html' : 'sidepanel.html',
  });
});

// 3) 监听侧边栏打开/关闭事件
chrome.sidePanel.onOpened.addListener(({ windowId }) => {
  console.log('sidePanel opened, windowId=', windowId);
});
chrome.sidePanel.onClosed.addListener(({ windowId }) => {
  console.log('sidePanel closed, windowId=', windowId);
});`;
      this.setState({ sidePanelInfo:
        '===== browser.sidePanel / chrome.sidePanel API =====\n\n' +
        '核心 API：\n' +
        '  chrome.sidePanel.setOptions({ enabled, path, tabId? })     —— 设置侧边栏选项\n' +
        '  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick }) —— 配置点击行为\n' +
        '  chrome.sidePanel.open({ windowId })                        —— 程序化打开\n' +
        '  chrome.sidePanel.onOpened / onClosed                       —— 生命周期事件\n\n' +
        '关键差异 vs browser_action popup：\n' +
        '  · popup 关闭后即销毁 DOM/JS 状态；sidePanel 持久保留\n' +
        '  · sidePanel 占据整个浏览器侧栏区域，可与页面并排交互\n' +
        '  · sidePanel 可按 tab 维度切换不同 path（setOptions({ tabId, path })）\n\n' +
        `chrome.sidePanel 可用：${f.sidePanel ? '✓' : '✗'}（需扩展上下文 + Chrome 114+）\n\n` +
        '示例 manifest.json：\n' + JSON.stringify(manifestSample, null, 2) + '\n\n' +
        '示例 background.js：\n' + bgCode });
      this._addLog('sidePanel', `展示 sidePanel API + manifest + background 代码示例；available=${f.sidePanel}`);
    } catch (err) {
      this._addLog('warn', `sidePanel 演示失败：${err.name} - ${err.message}`);
    }
  }

  _explainSidePanelVsPopup() {
    this.setState({ sidePanelInfo:
      '===== sidePanel vs action.default_popup 决策矩阵 =====\n\n' +
      '特性             | sidePanel              | action.default_popup\n' +
      '-----------------|------------------------|----------------------\n' +
      'DOM 生命周期     | 持久（关闭后保留状态） | 临时（关闭即销毁）\n' +
      '可用区域         | 整个浏览器侧栏         | 工具栏按钮下方小窗口\n' +
      '与页面并排交互   | ✓ 支持                 | ✗ 不支持\n' +
      '按 tab 定制内容  | ✓ setOptions({ tabId })| ✗ 仅运行时 JS 动态切换\n' +
      '点击行为可配置   | ✓ openPanelOnActionClick| 固定弹出 popup\n' +
      'Chrome 版本      | 114+                   | 早期 MV2 即支持\n' +
      '权限             | sidePanel              | 无需权限\n' +
      '适合场景         | 笔记/翻译/AI 助手等    | 简单工具/快捷操作\n\n' +
      '===== 与 DevTools Panel 的区别 =====\n' +
      '  · DevTools Panel: chrome.devtools.panels.create —— 仅 DevTools 打开时可见\n' +
      '  · sidePanel: chrome.sidePanel —— 浏览器侧边栏独立可见，无需打开 DevTools\n\n' +
      '===== 注意事项 =====\n' +
      '  · sidePanel.html 是扩展内 HTML 页面，可使用所有扩展 API（chrome.runtime/tabs/storage 等）\n' +
      '  · open({ windowId }) 必须在用户手势上下文中调用（action.onClicked / commands.onCommand）\n' +
      '  · setOptions({ tabId, path }) 可让不同 tab 显示不同侧边栏内容\n' +
      '  · openPanelOnActionClick=true 时点击 action 按钮自动切换侧边栏开/关' });
    this._addLog('sidePanel', '已展示 sidePanel vs popup 决策矩阵');
  }

  _renderCard1() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '1. browser.sidePanel / chrome.sidePanel（声明式侧边栏）',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['sidePanel', f.sidePanel]]),
        h(Tag, { color: 'primary' }, 'Chrome 114+'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'chrome.sidePanel 提供 Manifest V3 持久化侧边栏能力：setOptions({ enabled, path, tabId? }) 设置侧边栏选项、setPanelBehavior({ openPanelOnActionClick }) 配置点击 action 按钮的行为、open({ windowId }) 程序化打开、onOpened/onClosed 生命周期事件。相比 action.default_popup，sidePanel DOM 状态持久、可与页面并排交互、可按 tab 维度切换不同 path。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('展示 sidePanel API 用法', { type: 'primary', size: 'sm', onClick: () => this._demoSidePanel() }),
          this._btn('sidePanel vs popup 对比', { size: 'sm', onClick: () => this._explainSidePanelVsPopup() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, 'sidePanel 演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '380px', overflow: 'auto' } },
          h('code', {}, s.sidePanelInfo || '（点击「展示 sidePanel API 用法」查看 manifest + background.js 示例）')),
        h(Alert, {
          type: 'warning',
          message: 'chrome.sidePanel 仅在浏览器扩展运行时可用（Chrome 114+，需 manifest permissions: ["sidePanel"]）',
          description: '普通网页中 typeof chrome === "undefined"，本页演示以代码片段 + manifest 示例形式展示。安装到扩展环境（chrome://extensions 加载 unpacked）后可完整调用。open({ windowId }) 必须在用户手势上下文中调用。',
        }),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 2：MV3 Service Worker 生命周期 ===================

  _demoSWLifecycle() {
    const f = this._flags();
    try {
      const manifestSample = {
        manifest_version: 3,
        background: {
          service_worker: 'background.js',
          'type': 'module', // ES Module 模式，可用 import
        },
      };
      const bgCode =
`// background.js —— MV3 Service Worker（不是持久 background page）
// 关键事件：onInstalled / onStartup / alarms / runtime.onMessage

// 1) 安装/更新时触发一次
chrome.runtime.onInstalled.addListener((details) => {
  console.log('reason:', details.reason); // "install" | "update" | "chrome_update" | "shared_module_update"
  if (details.reason === 'install') {
    chrome.storage.local.set({ installedAt: Date.now() });
  } else if (details.reason === 'update') {
    console.log('previousVersion:', details.previousVersion);
  }
});

// 2) 浏览器启动时触发（每次浏览器开启）
chrome.runtime.onStartup.addListener(() => {
  console.log('Browser started, SW re-initialized');
});

// 3) 周期性任务：使用 alarms API（不能用 setInterval，SW 会休眠）
chrome.alarms.create('keep-alive', { periodInMinutes: 0.5 }); // 最小 0.5min
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'keep-alive') {
    // 短任务：SW 重新唤醒执行，结束后再休眠
    console.log('alarm fired:', alarm.name);
  }
});

// 4) 消息通信：接收 content script / popup / options 的消息
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'GET_DATA') {
    chrome.storage.local.get(['data']).then((res) => {
      sendResponse({ data: res.data });
    });
    return true; // ★ 异步响应必须返回 true
  }
});

// ★ MV3 SW 生命周期关键点：
//   · 默认 30 秒无事件即终止，事件到达时重启
//   · 不能用 setInterval / setTimeout 长期持有定时器（SW 终止时丢失）
//   · 用 chrome.alarms 替代长期定时
//   · 长任务需在事件回调内完成或用 chrome.runtime.onMessage return true 异步响应
//   · Chrome 110+ SW 可调用 chrome.runtime.sendMessage 自我保活（不推荐）
//   · Service Worker 不能访问 DOM / window / localStorage（用 chrome.storage 替代）`;
      this.setState({ swLifecycleInfo:
        '===== MV3 Service Worker 生命周期 =====\n\n' +
        'Manifest 配置：\n' + JSON.stringify(manifestSample, null, 2) + '\n\n' +
        '示例 background.js：\n' + bgCode + '\n\n' +
        `chrome.runtime 可用：${f.runtime ? '✓' : '✗'}\n` +
        `chrome.alarms 可用：${f.alarms ? '✓' : '✗'}\n` +
        `chrome.storage.local 可用：${f.storageLocal ? '✓' : '✗'}\n\n` +
        '===== MV2 → MV3 迁移关键变化 =====\n' +
        '  · background.persistent=false 持久页面 → service_worker 模块\n' +
        '  · 不能用 DOM API（document/window/localStorage）\n' +
        '  · webRequest 阻塞模式废弃 → declarativeNetRequest\n' +
        '  · tabs.executeScript 弃用 → chrome.scripting.executeScript\n' +
        '  · browser_action/page_action 弃用 → 统一 chrome.action\n' +
        '  · 远程托管代码禁用（eval / <script src=外部URL>），所有代码必须打包' });
      this._addLog('sw', `展示 MV3 SW 生命周期 + 迁移要点；runtime=${f.runtime}, alarms=${f.alarms}`);
    } catch (err) {
      this._addLog('warn', `SW 生命周期演示失败：${err.name} - ${err.message}`);
    }
  }

  _renderCard2() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '2. MV3 Service Worker 生命周期',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['runtime', f.runtime], ['alarms', f.alarms], ['storage.local', f.storageLocal]]),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'MV3 把持久 background page 替换为事件驱动的 Service Worker：默认 30 秒无事件即终止，事件到达时重启。关键事件 chrome.runtime.onInstalled / onStartup / onMessage；周期性任务必须用 chrome.alarms（不能用 setInterval，SW 终止时定时器丢失）。SW 内不能访问 DOM/window/localStorage，需用 chrome.storage 替代。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('展示 MV3 SW 生命周期', { type: 'primary', size: 'sm', onClick: () => this._demoSWLifecycle() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, 'SW 生命周期演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '420px', overflow: 'auto' } },
          h('code', {}, s.swLifecycleInfo || '（点击按钮查看 MV3 SW 完整生命周期 + 迁移要点）')),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 3：chrome.action 工具栏按钮 ===================

  _demoActionAPI() {
    const f = this._flags();
    try {
      const manifestSample = {
        manifest_version: 3,
        action: {
          default_icon: {
            '16': 'icons/icon16.png',
            '32': 'icons/icon32.png',
            '48': 'icons/icon48.png',
            '128': 'icons/icon128.png',
          },
          default_title: '点击我',
          default_popup: 'popup.html',
        },
      };
      const bgCode =
`// background.js —— chrome.action 工具栏按钮
// ★ MV2 browser_action / page_action 已弃用，MV3 统一为 chrome.action

// 1) 监听 action 点击（无 popup 时才触发）
chrome.action.onClicked.addListener((tab) => {
  console.log('action clicked, tab:', tab.id, tab.url);
  // 例：注入 content script 或打开 sidePanel
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ['content.js'],
  });
});

// 2) 动态修改图标/标题/popup
async function updateActionForTab(tab) {
  const isHttps = tab.url?.startsWith('https://');
  await chrome.action.setIcon({
    tabId: tab.id,                  // 可按 tab 维度定制图标
    path: isHttps ? 'icons/secure.png' : 'icons/insecure.png',
  });
  await chrome.action.setTitle({
    tabId: tab.id,
    title: isHttps ? '安全连接' : '不安全连接',
  });
  // 设置/清除 popup（传空字符串清除）
  await chrome.action.setPopup({
    tabId: tab.id,
    popup: isHttps ? 'popup.html' : '',
  });
}

// 3) 禁用/启用按钮
chrome.action.disable(tabId);  // 灰显
chrome.action.enable(tabId);   // 恢复

// 4) 监听 tab 切换，更新按钮状态
chrome.tabs.onActivated.addListener((activeInfo) => {
  chrome.tabs.get(activeInfo.tabId, (tab) => updateActionForTab(tab));
});

// 5) badge（图标上的小数字标签）
chrome.action.setBadgeText({ text: '99+' });
chrome.action.setBadgeBackgroundColor({ color: '#ff0000' });
chrome.action.setBadgeTextColor({ color: '#ffffff' }); // Chrome 110+`;
      this.setState({ actionInfo:
        '===== chrome.action 工具栏按钮 API =====\n\n' +
        '核心 API：\n' +
        '  chrome.action.onClicked.addListener(cb)         —— 点击事件（无 popup 时触发）\n' +
        '  chrome.action.setIcon({ path, imageData, tabId })\n' +
        '  chrome.action.setTitle({ title, tabId })\n' +
        '  chrome.action.setPopup({ popup, tabId })        —— 设置/清除 popup\n' +
        '  chrome.action.setBadgeText({ text, tabId })     —— 图标角标文本\n' +
        '  chrome.action.setBadgeBackgroundColor({ color, tabId })\n' +
        '  chrome.action.setBadgeTextColor({ color, tabId }) —— Chrome 110+\n' +
        '  chrome.action.enable(tabId) / disable(tabId)\n\n' +
        'manifest 配置：\n' + JSON.stringify(manifestSample, null, 2) + '\n\n' +
        '示例 background.js：\n' + bgCode + '\n\n' +
        `chrome.action 可用：${f.action ? '✓' : '✗'}\n\n` +
        '===== MV2 → MV3 迁移要点 =====\n' +
        '  · chrome.browserAction.* → chrome.action.*\n' +
        '  · manifest "browser_action" / "page_action" → "action"\n' +
        '  · chrome.browserAction.onClicked → chrome.action.onClicked\n' +
        '  · 所有 setX 方法支持 tabId 参数，可按 tab 维度定制按钮\n' +
        '  · setBadgeTextColor 是 Chrome 110+ 新增（之前文字色固定）' });
      this._addLog('action', `展示 chrome.action API + 迁移要点；available=${f.action}`);
    } catch (err) {
      this._addLog('warn', `action 演示失败：${err.name} - ${err.message}`);
    }
  }

  _renderCard3() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '3. chrome.action 工具栏按钮（替代 MV2 browser_action）',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['action', f.action]]),
        h(Tag, { color: 'primary' }, 'MV3'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'chrome.action 是 MV3 统一的工具栏按钮 API（替代 MV2 的 browser_action / page_action）。支持 setIcon/setTitle/setPopup（均可按 tabId 维度定制）、setBadgeText/setBadgeBackgroundColor/setBadgeTextColor（角标）、enable/disable、onClicked 事件（无 popup 时触发）。所有 setX 方法返回 Promise（MV3 异步化）。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('展示 chrome.action API', { type: 'primary', size: 'sm', onClick: () => this._demoActionAPI() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, 'chrome.action 演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '420px', overflow: 'auto' } },
          h('code', {}, s.actionInfo || '（点击按钮查看 chrome.action 完整 API + 迁移要点）')),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 4：commands + contextMenus ===================

  _demoCommandsMenus() {
    const f = this._flags();
    try {
      const manifestSample = {
        manifest_version: 3,
        permissions: ['contextMenus'],
        commands: {
          '_execute_action': { suggested_key: { default: 'Ctrl+Shift+Y' } },
          'toggle-feature': {
            suggested_key: { default: 'Ctrl+Shift+F', mac: 'Command+Shift+F' },
            description: '切换功能开关',
          },
          'duplicate-tab': {
            suggested_key: { default: 'Alt+Shift+D' },
            description: '复制当前标签页',
          },
        },
      };
      const bgCode =
`// background.js —— commands 全局快捷键 + contextMenus 上下文菜单

// ===== 1. commands：全局快捷键（即使浏览器未聚焦也可触发） =====
chrome.commands.onCommand.addListener((command, tab) => {
  console.log('command:', command, 'tab:', tab?.id);
  if (command === 'toggle-feature') {
    chrome.storage.local.get(['featureOn']).then(({ featureOn }) => {
      chrome.storage.local.set({ featureOn: !featureOn });
    });
  } else if (command === 'duplicate-tab') {
    chrome.tabs.duplicate(tab.id);
  }
  // '_execute_action' / '_execute_browser_action' 是保留名：
  //   等同于点击 action 按钮，不触发 onCommand，直接打开 popup 或触发 onClicked
  // '_execute_side_panel'（Chrome 114+）：等同于点击 action 打开 sidePanel
});

// ===== 2. contextMenus：右键菜单 =====
chrome.runtime.onInstalled.addListener(() => {
  // 顶级菜单
  const parentId = chrome.contextMenus.create({
    id: 'parent-menu',
    title: '我的扩展菜单',
    contexts: ['page', 'selection', 'image', 'link'], // 何时显示
  });
  // 子菜单（指定 parentId）
  chrome.contextMenus.create({
    id: 'search-selection',
    parentId: parentId,
    title: '搜索 "%s"',  // %s 替换为选中文本
    contexts: ['selection'],
  });
  chrome.contextMenus.create({
    id: 'open-image',
    parentId: parentId,
    title: '在新标签打开图片',
    contexts: ['image'],
  });
  // 分隔线
  chrome.contextMenus.create({
    id: 'sep-1',
    parentId: parentId,
    type: 'separator',
    contexts: ['page'],
  });
  // 复选/单选菜单项
  chrome.contextMenus.create({
    id: 'check-option',
    parentId: parentId,
    type: 'checkbox',
    title: '启用某选项',
    checked: false,
    contexts: ['page'],
  });
});

// 监听菜单点击
chrome.contextMenus.onClicked.addListener((info, tab) => {
  console.log('menuItemId:', info.menuItemId);
  console.log('selectionText:', info.selectionText);
  console.log('srcUrl:', info.srcUrl);
  console.log('linkUrl:', info.linkUrl);
  console.log('checked:', info.checked); // checkbox/radio 状态

  if (info.menuItemId === 'search-selection') {
    chrome.tabs.create({
      url: 'https://www.google.com/search?q=' + encodeURIComponent(info.selectionText),
    });
  } else if (info.menuItemId === 'check-option') {
    chrome.storage.local.set({ optionEnabled: info.checked });
  }
});

// 动态更新菜单项（需先 create 时记录 id）
// chrome.contextMenus.update('search-selection', { title: '新的标题' });
// chrome.contextMenus.remove('search-selection');
// chrome.contextMenus.removeAll();`;
      this.setState({ commandsMenusInfo:
        '===== chrome.commands 全局快捷键 + chrome.contextMenus 右键菜单 =====\n\n' +
        'chrome.commands：\n' +
        '  chrome.commands.onCommand.addListener((command, tab) => {})\n' +
        '  manifest.commands 中定义命令名 + suggested_key + description\n' +
        '  特殊命令名：_execute_action / _execute_browser_action / _execute_side_panel\n\n' +
        'chrome.contextMenus：\n' +
        '  chrome.contextMenus.create({ id, title, contexts, parentId, type, checked })\n' +
        '  chrome.contextMenus.onClicked.addListener((info, tab) => {})\n' +
        '  chrome.contextMenus.update(id, props) / remove(id) / removeAll()\n' +
        '  type: "normal" | "checkbox" | "radio" | "separator"\n' +
        '  contexts: ["page", "selection", "image", "link", "video", "audio", "frame", ...]\n' +
        '  title 中 "%s" 替换为选中文本\n\n' +
        'manifest 配置：\n' + JSON.stringify(manifestSample, null, 2) + '\n\n' +
        '示例 background.js：\n' + bgCode + '\n\n' +
        `chrome.commands 可用：${f.commands ? '✓' : '✗'}\n` +
        `chrome.contextMenus 可用：${f.contextMenus ? '✓' : '✗'}（需 permissions: ["contextMenus"]）` });
      this._addLog('cmds', `展示 commands + contextMenus API；commands=${f.commands}, contextMenus=${f.contextMenus}`);
    } catch (err) {
      this._addLog('warn', `commands/menus 演示失败：${err.name} - ${err.message}`);
    }
  }

  _renderCard4() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '4. chrome.commands 全局快捷键 + chrome.contextMenus 右键菜单',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['commands', f.commands], ['contextMenus', f.contextMenus]]),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'chrome.commands 监听全局快捷键（onCommand 事件 + manifest commands 配置 + suggested_key + 特殊命令名 _execute_action/_execute_side_panel）；chrome.contextMenus 管理右键菜单（create/update/remove/removeAll + type: normal/checkbox/radio/separator + contexts: page/selection/image/link + title 中 "%s" 替换选中文本 + onClicked 事件）。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('展示 commands + contextMenus 用法', { type: 'primary', size: 'sm', onClick: () => this._demoCommandsMenus() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '460px', overflow: 'auto' } },
          h('code', {}, s.commandsMenusInfo || '（点击按钮查看 commands + contextMenus 完整示例）')),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 5：chrome.scripting 内容脚本注入 ===================

  _demoScriptingAPI() {
    const f = this._flags();
    try {
      const manifestSample = {
        manifest_version: 3,
        permissions: ['scripting', 'activeTab'],
        // 静态注册的 content scripts（manifest 中声明）
        content_scripts: [
          {
            matches: ['https://*.example.com/*'],
            js: ['content.js'],
            css: ['styles.css'],
            run_at: 'document_idle',
            world: 'ISOLATED', // 默认，隔离环境；'MAIN' 注入到页面主世界
          },
        ],
      };
      const bgCode =
`// background.js —— chrome.scripting 内容脚本注入
// ★ 替代 MV2 的 chrome.tabs.executeScript（已弃用）

// ===== 1. executeScript：注入并执行脚本 =====
chrome.action.onClicked.addListener(async (tab) => {
  // 方式 A：注入文件
  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id, allFrames: false }, // allFrames: 是否注入所有 iframe
    files: ['content-script.js'],
    // world: 'MAIN',           // 默认 ISOLATED，MAIN 注入到页面主世界可访问页面 JS 变量
    // injectImmediately: true, // 不等待 document_idle，立即注入
  });
  console.log('results:', results); // [{ frameId, result }]

  // 方式 B：注入函数（自动序列化，闭包变量需通过 args 传递）
  const titles = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (selector) => {
      const el = document.querySelector(selector);
      return el ? el.textContent : null;
    },
    args: ['h1'], // 函数参数（必须可序列化）
  });
  console.log('h1 text:', titles[0].result);
});

// ===== 2. insertCSS：注入样式 =====
await chrome.scripting.insertCSS({
  target: { tabId: tab.id },
  files: ['styles.css'],
  // origin: 'USER',  // 默认 AUTHOR（作者样式表），USER 优先级更高（用户样式表）
});

// 注入内联 CSS
await chrome.scripting.insertCSS({
  target: { tabId: tab.id },
  css: 'body { background: yellow !important; }',
});

// ===== 3. registerContentScripts：动态注册（持久化，重启后仍生效）=====
const scriptId = await chrome.scripting.registerContentScripts([{
  id: 'dynamic-script-' + Date.now(),
  matches: ['https://*.github.com/*'],
  js: ['github-script.js'],
  runAt: 'document_start',
  world: 'MAIN',
  allFrames: true,
}]);

// 查询已注册的脚本
const scripts = await chrome.scripting.getRegisteredContentScripts();
console.log('registered:', scripts.map(s => s.id));

// 更新已注册脚本
await chrome.scripting.updateContentScripts([{
  id: 'dynamic-script-xxx',
  js: ['new-script.js'],
}]);

// 注销
await chrome.scripting.unregisterContentScripts({ ids: ['dynamic-script-xxx'] });

// ===== 4. MV2 → MV3 迁移要点 =====
// chrome.tabs.executeScript(tabId, { file })        → chrome.scripting.executeScript({ target, files })
// chrome.tabs.executeScript(tabId, { code: '...' }) → chrome.scripting.executeScript({ target, func, args })
// chrome.tabs.insertCSS(tabId, { file })            → chrome.scripting.insertCSS({ target, files })
// 返回值：从回调 result 改为 Promise<InjectionResult[]>

// ===== 5. world: 'MAIN' vs 'ISOLATED' =====
// ISOLATED（默认）：独立 JS 环境，与页面 JS 隔离，可访问 DOM 但不能访问页面变量
//   适合：常规注入，避免冲突
// MAIN：注入到页面主世界，可读写页面 JS 变量/函数
//   适合：拦截/重写页面函数（如 fetch/XHR）、读取页面框架状态`;
      this.setState({ scriptingInfo:
        '===== chrome.scripting 内容脚本注入 =====\n\n' +
        '核心 API：\n' +
        '  chrome.scripting.executeScript({ target, files | func+args, world?, injectImmediately? })\n' +
        '  chrome.scripting.insertCSS({ target, files | css, origin? })\n' +
        '  chrome.scripting.registerContentScripts([{ id, matches, js, runAt, world, allFrames }])\n' +
        '  chrome.scripting.getRegisteredContentScripts({ ids? })\n' +
        '  chrome.scripting.updateContentScripts([{ id, js, ... }])\n' +
        '  chrome.scripting.unregisterContentScripts({ ids })\n\n' +
        'target 对象：\n' +
        '  { tabId, allFrames?: false, frameIds?: number[] }\n\n' +
        'world 取值：\n' +
        '  "ISOLATED"（默认）：隔离环境，访问 DOM 不访问页面 JS\n' +
        '  "MAIN"：注入到页面主世界，可读写页面变量/函数\n\n' +
        'manifest 配置：\n' + JSON.stringify(manifestSample, null, 2) + '\n\n' +
        '示例 background.js：\n' + bgCode + '\n\n' +
        `chrome.scripting 可用：${f.scripting ? '✓' : '✗'}（需 permissions: ["scripting"]）\n\n` +
        '权限模型：\n' +
        '  · activeTab：用户主动激活时临时获得当前 tab 注入权限（点击 action / 快捷键 / contextMenu）\n' +
        '  · scripting + host_permissions：可对匹配源任意 tab 注入\n' +
        '  · <all_urls>：所有页面（需用户授予）' });
      this._addLog('script', `展示 chrome.scripting API；available=${f.scripting}`);
    } catch (err) {
      this._addLog('warn', `scripting 演示失败：${err.name} - ${err.message}`);
    }
  }

  _renderCard5() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '5. chrome.scripting 内容脚本注入（替代 tabs.executeScript）',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['scripting', f.scripting]]),
        h(Tag, { color: 'primary' }, 'MV3'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'chrome.scripting 是 MV3 替代 MV2 tabs.executeScript/insertCSS 的新 API：executeScript({ target, files | func+args, world }) 注入并执行脚本（func 自动序列化，参数通过 args 传递）、insertCSS({ target, files | css, origin }) 注入样式、registerContentScripts/getRegisteredContentScripts/updateContentScripts/unregisterContentScripts 动态管理持久化 content script。world: "MAIN" 注入到页面主世界可访问页面 JS 变量，"ISOLATED"（默认）隔离环境。'),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('展示 chrome.scripting 用法', { type: 'primary', size: 'sm', onClick: () => this._demoScriptingAPI() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } },
          h('code', {}, s.scriptingInfo || '（点击按钮查看 chrome.scripting 完整 API + world 说明）')),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // =================== Card 6：declarativeNetRequest 网络规则 ===================

  _demoDnrAPI() {
    const f = this._flags();
    try {
      const manifestSample = {
        manifest_version: 3,
        permissions: ['declarativeNetRequest'],
        host_permissions: ['*://*/*'],
        // 静态规则集（打包在扩展内）
        declarative_net_request: {
          rule_resources: [{
            id: 'ruleset_1',
            enabled: true,
            path: 'rules/rules_1.json',
          }],
        },
      };
      const rulesJson =
`// rules/rules_1.json —— 静态规则集
[
  {
    "id": 1,
    "priority": 1,
    "action": { "type": "block" },
    "condition": {
      "urlFilter": "||doubleclick.net^",
      "resourceTypes": ["script", "image", "xmlhttprequest", "sub_frame"]
    }
  },
  {
    "id": 2,
    "priority": 1,
    "action": { "type": "redirect", "redirect": { "url": "https://example.com/safe" } },
    "condition": {
      "urlFilter": "||ads.example.com^",
      "resourceTypes": ["script"]
    }
  },
  {
    "id": 3,
    "priority": 2,
    "action": {
      "type": "modifyHeaders",
      "requestHeaders": [
        { "header": "Cookie", "operation": "remove" },
        { "header": "X-Custom", "operation": "set", "value": "injected" }
      ],
      "responseHeaders": [
        { "header": "Set-Cookie", "operation": "remove" }
      ]
    },
    "condition": {
      "urlFilter": "||tracker.example.com^",
      "resourceTypes": ["xmlhttprequest"]
    }
  },
  {
    "id": 4,
    "priority": 1,
    "action": { "type": "allow" },  // 允许（覆盖低优先级 block）
    "condition": {
      "requestDomains": ["trusted.example.com"],
      "resourceTypes": ["script"]
    }
  }
]`;
      const bgCode =
`// background.js —— 动态/会话规则管理

// ===== 1. 动态规则（持久化，跨浏览器重启保留）=====
const dynamicRules = [{
  id: 1001,
  priority: 1,
  action: { type: 'block' },
  condition: {
    urlFilter: '||newads.example.com^',
    resourceTypes: ['script', 'image'],
  },
}];
await chrome.declarativeNetRequest.updateDynamicRules({
  removeRuleIds: [1000],            // 先移除旧规则
  addRules: dynamicRules,
});

// ===== 2. 会话规则（仅当前会话有效，浏览器关闭后清除）=====
await chrome.declarativeNetRequest.updateSessionRules({
  addRules: [{
    id: 2001,
    priority: 1,
    action: { type: 'redirect', redirect: { extensionPath: '/blocked.html' } },
    condition: { urlFilter: '||malicious.example.com^', resourceTypes: ['main_frame'] },
  }],
});

// ===== 3. 查询已匹配规则（哪些规则拦截了请求）=====
const matchedRules = await chrome.declarativeNetRequest.getMatchedRules({
  tabId: tab.id,
  // minTimeStamp: Date.now() - 60000,
});
matchedRules.rulesMatchedInfo.forEach((info) => {
  console.log('ruleId:', info.rule.ruleId);
  console.log('rulesetId:', info.rule.rulesetId);
  console.log('request:', info.request);
});

// ===== 4. 查询动态/会话规则 =====
const dynamic = await chrome.declarativeNetRequest.getDynamicRules();
const session = await chrome.declarativeNetRequest.getSessionRules();

// ===== 5. 启用/禁用静态规则集 =====
await chrome.declarativeNetRequest.updateEnabledRulesets({
  enableRulesetIds: ['ruleset_1'],
  disableRulesetIds: ['ruleset_2'],
});
const enabled = await chrome.declarativeNetRequest.getEnabledRulesets();

// ===== 6. action.type 取值 =====
// 'block'              —— 阻止请求
// 'redirect'           —— 重定向（redirect.url / extensionPath / transform / regexSubstitution）
// 'modifyHeaders'      —— 修改请求/响应头（set/append/remove 操作）
// 'allow'              —— 允许（覆盖低优先级 block）
// 'allowAllRequests'   —— 允许整个请求链（主框架 + 子资源）

// ===== 7. 与 MV2 webRequest 阻塞模式对比 =====
// MV2: chrome.webRequest.onBeforeRequest.addListener(cb, filter, ['blocking'])
//   · 阻塞主线程，性能差
//   · 可动态决定 block/redirect
// MV3: declarativeNetRequest 静态/动态规则
//   · 浏览器原生评估规则，无需 SW 唤醒
//   · 性能更好，但灵活性降低（规则驱动而非代码驱动）
//   · SW 终止时仍生效（规则缓存到浏览器进程）`;
      this.setState({ dnrInfo:
        '===== chrome.declarativeNetRequest 声明式网络规则 =====\n\n' +
        '核心 API：\n' +
        '  updateDynamicRules({ removeRuleIds, addRules })          —— 动态规则（持久）\n' +
        '  updateSessionRules({ removeRuleIds, addRules })          —— 会话规则（临时）\n' +
        '  getMatchedRules({ tabId?, minTimeStamp? })               —— 查询已匹配规则\n' +
        '  getDynamicRules() / getSessionRules()                    —— 读取规则\n' +
        '  updateEnabledRulesets({ enableRulesetIds, disableRulesetIds })\n' +
        '  getEnabledRulesets()                                     —— 启用的静态规则集 id\n\n' +
        '规则结构：\n' +
        '  { id, priority, action: { type, ... }, condition: { urlFilter, resourceTypes, ... } }\n' +
        '  action.type: "block" | "redirect" | "modifyHeaders" | "allow" | "allowAllRequests"\n' +
        '  condition.resourceTypes: ["main_frame", "sub_frame", "script", "image", "xmlhttprequest", ...]\n' +
        '  condition.urlFilter 支持 ||domain^ / * / ^ 等 ABP 风格语法\n\n' +
        'manifest 配置：\n' + JSON.stringify(manifestSample, null, 2) + '\n\n' +
        '静态规则集 rules/rules_1.json：\n' + rulesJson + '\n\n' +
        '示例 background.js：\n' + bgCode + '\n\n' +
        `chrome.declarativeNetRequest 可用：${f.dnr ? '✓' : '✗'}（需 permissions: ["declarativeNetRequest"]）\n\n` +
        '权限限制：\n' +
        '  · 动态规则数量上限：5000 条（chrome.declarativeNetRequest.MAX_NUMBER_OF_DYNAMIC_AND_SESSION_RULES）\n' +
        '  · 静态规则集总条数上限：30000 条\n' +
        '  · 优先级 1-1000，越高越优先\n' +
        '  · modifyHeaders 受 host_permissions 限制（只能改匹配源的请求/响应头）' });
      this._addLog('dnr', `展示 declarativeNetRequest API + 静态规则集；available=${f.dnr}`);
    } catch (err) {
      this._addLog('warn', `declarativeNetRequest 演示失败：${err.name} - ${err.message}`);
    }
  }

  _renderCard6() {
    const s = this.state;
    const f = this._flags();
    const card = new Card({
      title: '6. chrome.declarativeNetRequest 声明式网络规则（替代 webRequest 阻塞）',
      extra: h('div', { class: 'flex gap-xs' },
        ...this._caps([['declarativeNetRequest', f.dnr]]),
        h(Tag, { color: 'primary' }, 'MV3'),
      ),
      children: [
        h('p', { class: 'fs-sm text-secondary' },
          'chrome.declarativeNetRequest 是 MV3 替代 MV2 webRequest 阻塞模式的声明式规则引擎：updateDynamicRules/updateSessionRules 管理动态/会话规则、getMatchedRules 查询匹配记录、updateEnabledRulesets 启用静态规则集。规则结构 { id, priority, action: { type: block/redirect/modifyHeaders/allow/allowAllRequests }, condition: { urlFilter, resourceTypes } }。浏览器原生评估，无需 SW 唤醒，性能优于 webRequest 阻塞。',
        ),
        h('div', { class: 'flex items-center gap-sm flex-wrap' },
          this._btn('展示 declarativeNetRequest 用法', { type: 'primary', size: 'sm', onClick: () => this._demoDnrAPI() }),
        ),
        h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
        h('pre', { class: 'code-block', style: { maxHeight: '540px', overflow: 'auto' } },
          h('code', {}, s.dnrInfo || '（点击按钮查看 declarativeNetRequest 完整规则示例）')),
      ],
    });
    this.registerChild(card);
    return card.render();
  }

  // —— 日志面板 ——
  _renderLogPanel() {
    const s = this.state;
    if (!s.logs || s.logs.length === 0) return null;
    return h(Card, { title: '运行日志' },
      h('div', { class: 'log-list' },
        ...s.logs.map((log) =>
          h('div', { class: `log-item log-${log.type}` },
            h('span', { class: 'log-time' }, log.time),
            h('span', { class: 'log-content' }, log.content),
          ),
        ),
      ),
    );
  }

  renderPage() {
    const s = this.state;
    return [
      h('h2', { class: 'section-title' }, 'UI 扩展与浏览器扩展 API 实验室'),

      h(Alert, {
        type: 'info',
        message: '浏览器扩展 API（chrome.* / browser.* 命名空间，MV3）',
        description: '演示 Manifest V3 浏览器扩展 API：chrome.sidePanel 声明式侧边栏（Chrome 114+）、MV3 Service Worker 生命周期（onInstalled/onStartup/alarms）、chrome.action 工具栏按钮（替代 MV2 browser_action）、chrome.commands 全局快捷键 + chrome.contextMenus 右键菜单、chrome.scripting 内容脚本注入（替代 tabs.executeScript，支持 MAIN world）、chrome.declarativeNetRequest 声明式网络规则（替代 webRequest 阻塞）。普通网页中 chrome.* / browser.* 均为 undefined，仅在扩展运行时可用；本页演示以代码片段 + manifest 示例形式展示。',
      }),

      s.capsSummary !== '' ? h(Alert, { type: 'info', message: s.capsSummary }) : null,

      this._renderCard1(),
      this._renderCard2(),
      this._renderCard3(),
      this._renderCard4(),
      this._renderCard5(),
      this._renderCard6(),

      this._renderLogPanel(),
    ];
  }
}
