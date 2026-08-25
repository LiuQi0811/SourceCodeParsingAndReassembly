/**
 * Background Service Worker
 * 1:1 还原原 js/background.js 核心逻辑
 *
 * - Service Worker 防终止(HeartBeat + getPlatformInfo)
 * - webRequest 监听(onSendHeaders / onResponseStarted / onErrorOccurred)
 * - alarms 定时清理 + 保存缓存
 * - onMessage 处理 pushData/getAllData/getData/clearData/clearRedundant/enable/
 *            getButtonState/mobileUserAgent/autoDown/script/scriptI18n/
 *            HeartBeat/addMedia/catCatchFFmpeg/catDown/send2local/aria2/invoke/mqtt/
 *            damnUrlHas/closeScript 等
 * - onMessageExternal 处理外部扩展 getData/getCurrentTabData
 * - onActivated / onFocusChanged / onUpdated / onCommitted / onRemoved / onCompleted
 * - commands + contextMenus(create + onClick 复用 runCommands)
 * - downloads.onChanged 处理图片下载失败兜底
 */
import { defineBackground } from 'wxt/utils/define-background';
import { useSettingsStore } from '@stores/settings';
import { useMediaStore, type MediaItem } from '@stores/media';
import { useRuntimeStore } from '@stores/runtime';
import {
  CheckExtension,
  CheckType,
  fileNameParse,
  getResponseHeadersValue,
  getRequestHeaders,
  SetIcon,
  mobileUserAgent,
  isSpecialPage,
  clearRedundant,
  parseAttachmentFilename,
} from '@lib/find-media';
import {
  isDamnUrl,
  isLockUrl,
  stringModify,
  filterFileName,
  send2local,
} from '@lib/function';
import { templates } from '@lib/template';
import type { TemplateContext } from '@lib/template';
import { i18n } from '@lib/i18n';

export default defineBackground(() => {
  // ===== 初始化 =====
  void (async () => {
    const s = useSettingsStore.getState();
    await Promise.all([s.loadFromSync(), s.loadFromLocal()]);
    await useMediaStore.getState().loadFromStorage();
    // SW 启动时确保右键菜单存在(还原原 init.js InitOptions 末尾 contextMenusInit 调用)
    contextMenusInit();
  })();

  // ===== onInstalled:安装/升级时重建右键菜单(还原原 background.js onInstalled) =====
  chrome.runtime.onInstalled.addListener(() => {
    contextMenusInit();
  });

  // ===== Service Worker 防终止(还原 background.js 1-28 行) =====
  chrome.webNavigation.onBeforeNavigate.addListener(() => undefined);
  chrome.webNavigation.onHistoryStateUpdated.addListener(() => undefined);

  chrome.runtime.onConnect.addListener((port) => {
    if (chrome.runtime.lastError || port.name !== 'HeartBeat') return;
    port.postMessage('HeartBeat');
    port.onMessage.addListener(() => undefined);
    const interval = setInterval(() => {
      clearInterval(interval);
      port.disconnect();
    }, 250000);
    port.onDisconnect.addListener(() => {
      if (chrome.runtime.lastError) return;
    });
  });

  // 每 25 秒唤醒一次 SW
  setInterval(() => chrome.runtime.getPlatformInfo(() => undefined), 25_000);

  // ===== webRequest 监听(还原 onSendHeaders / onResponseStarted / onErrorOccurred) =====
  chrome.webRequest.onSendHeaders.addListener(
    (data) => {
      const s = useSettingsStore.getState();
      if (s.initSyncComplete && !s.enable) return;
      if (data.requestHeaders) {
        const headers: Record<string, string> = {};
        for (const h of data.requestHeaders) headers[h.name] = h.value ?? '';
        useRuntimeStore.getState().setRequestHeaders(data.requestId, data.requestHeaders);
        (data as any).allRequestHeaders = data.requestHeaders;
      }
      try {
        void findMedia(data, true);
      } catch (e) {
        console.error(e);
      }
    },
    { urls: ['<all_urls>'] },
    ['requestHeaders', 'extraHeaders'],
  );

  chrome.webRequest.onResponseStarted.addListener(
    (data) => {
      try {
        const allHeaders = useRuntimeStore.getState().getRequestHeaders(data.requestId);
        if (allHeaders) {
          (data as any).allRequestHeaders = allHeaders;
          useRuntimeStore.getState().deleteRequestHeaders(data.requestId);
        }
        void findMedia(data);
      } catch (e) {
        console.error(e, data);
      }
    },
    { urls: ['<all_urls>'] },
    ['responseHeaders'],
  );

  chrome.webRequest.onErrorOccurred.addListener((data) => {
    useRuntimeStore.getState().deleteRequestHeaders(data.requestId);
    useRuntimeStore.getState().deleteBlackList(data.requestId);
  }, { urls: ['<all_urls>'] });

  // ===== alarms 定时任务(还原 alarms.onAlarm) =====
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'nowClear' || alarm.name === 'clear') {
      clearRedundant();
      return;
    }
    if (alarm.name === 'save') {
      void useMediaStore.getState().persist();
    }
  });

  // ===== onMessage(还原 background.js 第 342-585 行) =====
  chrome.runtime.onMessage.addListener((msg: any, sender, sendResponse) => {
    if (chrome.runtime.lastError) return;
    const s = useSettingsStore.getState();
    if (!s.initLocalComplete || !s.initSyncComplete) {
      sendResponse('error');
      return true;
    }
    const Message = msg?.Message;
    const tabId = msg?.tabId ?? s.tabId;

    // 从缓存中保存数据到本地
    if (Message === 'pushData') {
      void useMediaStore.getState().forcePersist();
      sendResponse('ok');
      return true;
    }

    // 获取所有数据
    if (Message === 'getAllData') {
      sendResponse(useMediaStore.getState().getAll());
      return true;
    }

    // 设置扩展图标数字
    if (Message === 'ClearIcon') {
      msg.type ? SetIcon({ tabId }) : SetIcon();
      sendResponse('ok');
      return true;
    }

    // 启用/禁用扩展
    if (Message === 'enable') {
      void s.setEnable(!s.enable);
      sendResponse(s.enable);
      return true;
    }

    // 按 requestId 数组获取数据
    if (Message === 'getData' && msg.requestId) {
      const ids = Array.isArray(msg.requestId) ? msg.requestId : [msg.requestId];
      const response = useMediaStore.getState().getByRequestIds(ids);
      sendResponse(response.length ? response : 'error');
      return true;
    }

    // 按 tabId 获取数据
    if (Message === 'getData') {
      sendResponse(useMediaStore.getState().getByTab(tabId));
      return true;
    }

    // 获取按钮状态
    if (Message === 'getButtonState') {
      const state: Record<string, boolean> = {
        MobileUserAgent: s.featMobileTabId.has(tabId),
        AutoDown: s.featAutoDownTabId.has(tabId),
        enable: s.enable,
      };
      s.scriptList.forEach((item) => {
        state[item.key] = item.tabId.has(tabId);
      });
      sendResponse(state);
      return true;
    }

    // 获取所有"有 video 的 tab"列表(还原原 popup.html #videoTabIndex 下拉数据源
    // 见 js/media-control.js updateVideoTagOptions)
    // 用于 preview 远程模式的"选择页面"下拉
    if (Message === 'getVideoTabs') {
      const collectTabs = async (tabs: chrome.tabs.Tab[]) => {
        const result: Array<{ id: number; title: string; favIconUrl?: string }> = [];
        await Promise.all(
          tabs.map(async (tab) => {
            if (!tab.id) return;
            try {
              // 用 webNavigation.getAllFrames 获取所有 frame(主 frame + iframe)
              // chrome.tabs.sendMessage 默认只收第一个 frame 的响应,
              // 视频可能在 iframe 内,需遍历所有 frame 才不漏
              const frames = await chrome.webNavigation.getAllFrames({ tabId: tab.id });
              let found = false;
              if (frames) {
                await Promise.all(
                  frames.map(async (f) => {
                    if (found) return;
                    try {
                      const st = await chrome.tabs.sendMessage(
                        tab.id!,
                        { Message: 'getVideoState', index: 0 },
                        { frameId: f.frameId },
                      );
                      if (st && (st as any).count > 0) {
                        found = true;
                        result.push({
                          id: tab.id!,
                          title: tab.title ?? '',
                          favIconUrl: tab.favIconUrl,
                        });
                      }
                    } catch {
                      /* frame 无 content script / 跨域,跳过 */
                    }
                  }),
                );
              }
            } catch {
              /* webNavigation 不可用,回退到只查主 frame */
              try {
                const st = await chrome.tabs.sendMessage(tab.id, {
                  Message: 'getVideoState',
                  index: 0,
                });
                if (st && (st as any).count > 0) {
                  result.push({
                    id: tab.id,
                    title: tab.title ?? '',
                    favIconUrl: tab.favIconUrl,
                  });
                }
              } catch {
                /* 跳过 */
              }
            }
          }),
        );
        return result;
      };
      chrome.tabs.query({}, async (tabs) => {
        sendResponse(await collectTabs(tabs));
      });
      return true;
    }

    // 模拟手机 UA
    if (Message === 'mobileUserAgent') {
      mobileUserAgent(tabId, !s.featMobileTabId.has(tabId));
      chrome.tabs.reload(tabId, { bypassCache: true });
      sendResponse('ok');
      return true;
    }

    // 自动下载开关
    if (Message === 'autoDown') {
      if (s.featAutoDownTabId.has(tabId)) {
        s.removeFeatAutoDownTab(tabId);
      } else {
        s.addFeatAutoDownTab(tabId);
      }
      sendResponse('ok');
      return true;
    }

    // 脚本注入或移除
    if (Message === 'script') {
      if (s.options.damn && s.damnUrlSet.has(tabId)) return;
      if (!s.scriptList.has(msg.script)) {
        sendResponse('error no exists');
        return false;
      }
      const entry = s.scriptList.get(msg.script)!;
      const refresh = msg.refresh ?? entry.refresh;
      if (entry.tabId.has(tabId)) {
        s.toggleScriptTab(msg.script, tabId);
        if (msg.script === 'search.js') {
          s.setDeepSearchClose(tabId);
        }
        if (refresh) chrome.tabs.reload(tabId, { bypassCache: true });
        sendResponse('ok');
        return true;
      }
      s.toggleScriptTab(msg.script, tabId);
      if (refresh) {
        chrome.tabs.reload(tabId, { bypassCache: true });
      } else {
        const files = [`catch-script/${msg.script}`];
        if (entry.i18n) files.unshift('catch-script/i18n.js');
        chrome.scripting.executeScript({
          target: { tabId, allFrames: entry.allFrames },
          files,
          injectImmediately: true,
          world: entry.world as 'MAIN' | 'ISOLATED',
        }).catch((e) => console.error('[cat-catch] script inject failed:', msg.script, e));
      }
      sendResponse('ok');
      return true;
    }

    // 脚本申请多语言
    if (Message === 'scriptI18n') {
      chrome.scripting.executeScript({
        target: { tabId, allFrames: true },
        files: ['catch-script/i18n.js'],
        injectImmediately: true,
        world: 'MAIN',
      });
      sendResponse('ok');
      return true;
    }

    // Heart Beat
    if (Message === 'HeartBeat') {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) useSettingsStore.getState().setTabId(tabs[0].id);
      });
      sendResponse('HeartBeat OK');
      return true;
    }

    // 清理数据
    if (Message === 'clearData') {
      const m = useMediaStore.getState();
      if (msg.type) {
        // 当前标签
        m.clearTab(tabId);
      } else {
        // 其他标签
        m.clearOtherTabs(tabId);
      }
      void m.persist();
      clearRedundant();
      sendResponse('OK');
      return true;
    }

    // 清理冗余数据
    if (Message === 'clearRedundant') {
      clearRedundant();
      sendResponse('OK');
      return true;
    }

    // 从 content/catch-script 传来的 addMedia
    if (Message === 'addMedia') {
      chrome.tabs.query({}, (tabs) => {
        let matchedTabId = -1;
        for (const t of tabs) {
          if (t.url === msg.href) {
            matchedTabId = t.id ?? -1;
            break;
          }
        }
        const data: any = {
          url: msg.url,
          tabId: matchedTabId === -1 ? -1 : matchedTabId,
          extraExt: msg.extraExt,
          mime: msg.mime,
          requestId: msg.requestId,
          requestHeaders: msg.requestHeaders,
          initiator: matchedTabId === -1 ? msg.href : undefined,
        };
        void findMedia(data, true, true);
      });
      sendResponse('ok');
      return true;
    }

    // ffmpeg 网页通信
    if (Message === 'catCatchFFmpeg') {
      const ffmpeg = useSettingsStore.getState().ffmpegConfig;
      const payload = {
        ...msg,
        Message: 'ffmpeg',
        tabId: msg.tabId ?? sender.tab?.id,
        version: ffmpeg.version,
      };
      chrome.tabs.query({ url: ffmpeg.url + '*' }, (tabs) => {
        if (chrome.runtime.lastError || !tabs.length) {
          chrome.tabs.create({ url: ffmpeg.url, active: msg.active ?? true }, (tab) => {
            if (chrome.runtime.lastError || !tab || !tab.id) return;
            ffmpeg.cacheData.push(payload);
            ffmpeg.tab = tab.id;
          });
          return;
        }
        const first = tabs[0];
        if (first?.status === 'complete' && first.id) {
          void chrome.tabs.sendMessage(first.id, payload);
        } else if (first?.id) {
          ffmpeg.tab = first.id;
          ffmpeg.cacheData.push(payload);
        }
      });
      sendResponse('ok');
      return true;
    }

    // === ffmpeg 转码结果(还原原 content-script.js 转发 + 下载) ===
    // 在线 ffmpeg 服务转码完成 → content.ts 发 catCatchFFmpegResult → background 下载
    if (Message === 'catCatchFFmpegResult') {
      if (msg.state === 'done' && msg.file) {
        // msg.file 是 blob: URL 或 data: URL,直接下载
        const title = (msg.title as string) || `cat-catch-ffmpeg-${Date.now()}`;
        const output = (msg.output as string) || 'mp4';
        chrome.downloads.download({
          url: msg.file as string,
          filename: `${title}.${output}`,
          saveAs: false,
        });
      }
      // 转发给发起者 tab(catch.js / m3u8.html / downloader.html 可能需要更新 UI)
      if (msg.tabId) {
        void chrome.tabs.sendMessage(msg.tabId as number, { Message: 'catCatchFFmpegResult', ...msg }).catch(() => {});
      }
      sendResponse('ok');
      return true;
    }

    // 携带请求头下载(还原原 popup.js catDownload -> createCatDownload)
    // popup 发送 catDown 消息;background 打开 downloader.html,通过 JSON 参数
    // 传递 url/name/requestHeaders,downloader 用 fetch(headers) 落盘
    if (Message === 'catDown') {
      const data = Array.isArray(msg.data) ? msg.data : [msg.data];
      const payload = data.map((d: Record<string, unknown>) => ({
        url: d.url,
        name: d.downFileName ?? d.name ?? '',
        requestHeaders: d.requestHeaders ?? {},
        requestId: d.requestId,
        tabId: d.tabId,
      }));
      chrome.tabs.create({
        url: `downloader.html?JSON=${encodeURIComponent(JSON.stringify(payload))}&autoClose=true`,
        active: true,
      });
      sendResponse('ok');
      return true;
    }

    // 发送数据到本地(send2local 自动 / send2localManual 手动触发)
    if (Message === 'send2local' && (s.options.send2local || s.options.send2localManual)) {
      try {
        void send2local(msg.action ?? 'catch', msg.data, msg.tabId);
      } catch (e) {
        console.error(e);
      }
      sendResponse('ok');
      return true;
    }

    // 发送到 Aria2(还原原 popup-utils.js aria2AddUri)
    if (Message === 'aria2' && s.options.enableAria2Rpc) {
      try {
        void aria2AddUri(msg.data);
      } catch (e) {
        console.error(e);
      }
      sendResponse('ok');
      return true;
    }

    // 调用本地程序(还原原 popup.js invoke:templates 渲染后导航)
    if (Message === 'invoke' && s.options.invoke) {
      try {
        const url = templates(s.options.invokeText, msg.data as TemplateContext);
        const targetTabId = msg.tabId ?? tabId;
        if (targetTabId > 0) {
          chrome.tabs.update(targetTabId, { url });
        } else {
          chrome.tabs.update({ url });
        }
      } catch (e) {
        console.error(e);
      }
      sendResponse('ok');
      return true;
    }

    // 发送到 MQTT(简化实现:SW 中无 mqtt.js 库,仅记录日志)
    if (Message === 'mqtt' && s.options.mqttEnable) {
      console.warn('[cat-catch] MQTT 发送需在 popup/preview 端调用(依赖 mqtt.js 库),background 已记录:', msg.data);
      sendResponse('ok');
      return true;
    }

    // damnUrl 查询
    if (Message === 'damnUrlHas') {
      sendResponse(s.damnUrlSet.has(tabId));
      return true;
    }

    // 关闭脚本
    if (Message === 'closeScript') {
      if (!msg.script || !s.scriptList.has(msg.script)) {
        sendResponse('error');
        return false;
      }
      s.toggleScriptTab(msg.script, tabId);
      sendResponse('ok');
      return true;
    }

    return;
  });

  // ===== onMessageExternal(还原 background.js 第 590-603 行) =====
  chrome.runtime.onMessageExternal.addListener((request, _sender, sendResponse) => {
    const s = useSettingsStore.getState();
    if (request.action === 'getData') {
      if (request.tabId) {
        sendResponse(useMediaStore.getState().getByTab(request.tabId) ?? null);
        return true;
      }
      sendResponse(useMediaStore.getState().getAll());
      return true;
    }
    if (request.action === 'getCurrentTabData') {
      const tabId = request.tabId ?? s.tabId;
      sendResponse(useMediaStore.getState().getByTab(tabId) ?? null);
      return true;
    }
    return;
  });

  // ===== 标签切换(还原 background.js 第 615-622 行) =====
  chrome.tabs.onActivated.addListener((activeInfo) => {
    useSettingsStore.getState().setTabId(activeInfo.tabId);
    const list = useMediaStore.getState().getByTab(activeInfo.tabId);
    SetIcon({ number: list.length, tabId: activeInfo.tabId });
  });

  // ===== 窗口切换(还原 background.js 第 625-634 行) =====
  chrome.windows.onFocusChanged.addListener((windowId) => {
    if (windowId === -1) return;
    chrome.tabs.query({ active: true, windowId }, (tabs) => {
      if (tabs[0]?.id) {
        useSettingsStore.getState().setTabId(tabs[0].id);
      } else {
        useSettingsStore.getState().setTabId(-1);
      }
    });
  });

  // ===== 标签更新(还原 background.js 第 641-672 行) =====
  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    const s = useSettingsStore.getState();
    if (isSpecialPage(tab.url) || tabId <= 0 || !s.initSyncComplete) return;

    // 自动清理 mode == 2
    if (changeInfo.status && changeInfo.status === 'loading' && s.options.autoClearMode === 2) {
      useRuntimeStore.getState().clearTabUrls(tabId);
      chrome.alarms.get('save', (alarm) => {
        if (!alarm) {
          useMediaStore.getState().clearTab(tabId);
          SetIcon({ tabId });
          chrome.alarms.create('save', { when: Date.now() + 1000 });
        }
      });
    }

    // 检查 blockUrl / damnUrl 列表
    if (changeInfo.url && tabId > 0) {
      if (s.blockUrl.length) {
        if (isLockUrl(changeInfo.url)) {
          s.addBlockUrlTab(tabId);
        } else {
          s.removeBlockUrlTab(tabId);
        }
      }
      if (isDamnUrl(changeInfo.url)) {
        s.addDamnUrlTab(tabId);
      } else {
        s.removeDamnUrlTab(tabId);
      }
    }

    // sidePanel 配置
    try {
      void chrome.sidePanel?.setOptions({
        tabId,
        path: `popup.html?tabId=${tabId}`,
      });
    } catch {
      /* sidePanel 可能在 SW 不可用 */
    }
  });

  // ===== webNavigation.onCommitted(还原 background.js 第 680-739 行) =====
  chrome.webNavigation.onCommitted.addListener((details) => {
    const s = useSettingsStore.getState();
    if (isSpecialPage(details.url) || details.tabId <= 0 || !s.initSyncComplete) return;

    if (details.frameId === 0) {
      // 主框架:重新检查 blockUrl/damn
      if (isLockUrl(details.url)) {
        s.addBlockUrlTab(details.tabId);
      } else {
        s.removeBlockUrlTab(details.tabId);
      }
      if (isDamnUrl(details.url)) {
        s.addDamnUrlTab(details.tabId);
      } else {
        s.removeDamnUrlTab(details.tabId);
      }
    }

    // 主框架 + 非 subframe/form_submit transition + autoClearMode == 1 -> 清空
    const skipTransitions = ['auto_subframe', 'manual_subframe', 'form_submit'];
    if (
      details.frameId === 0 &&
      !skipTransitions.includes(details.transitionType) &&
      s.options.autoClearMode === 1
    ) {
      useMediaStore.getState().clearTab(details.tabId);
      useRuntimeStore.getState().clearTabUrls(details.tabId);
      void useMediaStore.getState().persist();
      SetIcon({ tabId: details.tabId });
    }

    // chrome 102 以下不支持 scripting
    if (s.version < 102) return;

    // 深度搜索注入
    if (
      !s.blockUrlSet.has(details.tabId) &&
      s.options.deepSearch &&
      s.deepSearchTemporarilyClose !== details.tabId
    ) {
      s.toggleScriptTab('search.js', details.tabId);
      s.setDeepSearchClose(null);
    }

    // catch-script 注入
    s.scriptList.forEach((entry, script) => {
      if (!entry.tabId.has(details.tabId) || !entry.allFrames) return;
      const files = [`catch-script/${script}`];
      if (entry.i18n) files.unshift('catch-script/i18n.js');
      chrome.scripting.executeScript({
        target: { tabId: details.tabId, frameIds: [details.frameId] },
        files,
        injectImmediately: true,
        world: entry.world as 'MAIN' | 'ISOLATED',
      });
    });

    // 模拟手机 UA
    if (s.initLocalComplete && s.featMobileTabId.size > 0 && s.featMobileTabId.has(details.tabId)) {
      chrome.scripting.executeScript({
        args: [s.options.MobileUserAgent.toString()],
        target: { tabId: details.tabId, frameIds: [details.frameId] },
        func: function () {
          // @ts-ignore runtime injected
          Object.defineProperty(navigator, 'userAgent', {
            value: (arguments as unknown as [string])[0],
            writable: false,
          });
        },
        injectImmediately: true,
        world: 'MAIN',
      } as any);
    }
  });

  // ===== 标签关闭(还原 background.js 第 744-753 行) =====
  chrome.tabs.onRemoved.addListener((tabId) => {
    chrome.alarms.get('nowClear', (alarm) => {
      if (!alarm) {
        chrome.alarms.create('nowClear', { when: Date.now() + 1000 });
      }
    });
    const s = useSettingsStore.getState();
    if (s.initSyncComplete) {
      if (s.blockUrlSet.has(tabId)) s.removeBlockUrlTab(tabId);
      if (s.damnUrlSet.has(tabId)) s.removeDamnUrlTab(tabId);
    }
  });

  // ===== 页面加载完成:ffmpeg 数据回送(还原 background.js 第 832-842 行) =====
  chrome.webNavigation.onCompleted.addListener((details) => {
    const s = useSettingsStore.getState();
    if (s.ffmpegConfig.tab && details.tabId === s.ffmpegConfig.tab) {
      setTimeout(() => {
        const cache = s.ffmpegConfig.cacheData;
        for (const data of cache) {
          void chrome.tabs.sendMessage(details.tabId, data);
        }
        s.ffmpegConfig.cacheData.length = 0;
        s.ffmpegConfig.tab = 0;
      }, 500);
    }
  });

  // ===== 下载失败兜底:图片下载失败时改走 downloader(还原 background.js 第 804-812 行) =====
  chrome.downloads.onChanged.addListener((item) => {
    const s = useSettingsStore.getState();
    if (s.options.catDownload) {
      downDataImageSave = undefined;
      return;
    }
    const errorList = [
      'SERVER_BAD_CONTENT', 'SERVER_UNAUTHORIZED', 'SERVER_FORBIDDEN',
      'SERVER_UNREACHABLE', 'SERVER_CROSS_ORIGIN_REDIRECT', 'SERVER_FAILED',
      'NETWORK_FAILED',
    ];
    if (item.error && item.error.current && errorList.includes(item.error.current) && downDataImageSave) {
      const data = {
        requestHeaders: { referer: downDataImageSave.pageUrl ?? '' },
        requestId: s.tabId,
        url: downDataImageSave.srcUrl ?? '',
      };
      chrome.tabs.create({
        url: `downloader.html?JSON=${encodeURIComponent(JSON.stringify(data))}&autoClose=true`,
        active: false,
      });
      downDataImageSave = undefined;
    }
  });

  // ===== 右键菜单创建(还原原 init.js L385-431 contextMenusInit) =====
  // 简化:父菜单始终可见(原项目用 visible 参数控制)
  function contextMenusInit(): void {
    if (!chrome.contextMenus) return;
    chrome.contextMenus.removeAll(() => {
      if (chrome.runtime.lastError) return;
      chrome.contextMenus.create({
        id: 'cat-catch',
        title: i18n('catCatch'),
        contexts: ['page', 'image'],
      });
      chrome.contextMenus.create({
        id: 'image-save',
        parentId: 'cat-catch',
        title: i18n('save'),
        contexts: ['image'],
      });
      chrome.contextMenus.create({
        id: 'enable',
        parentId: 'cat-catch',
        title: `${i18n('enable')} / ${i18n('disable')}`,
        contexts: ['page', 'image'],
      });
      chrome.contextMenus.create({
        id: 'preview',
        parentId: 'cat-catch',
        title: i18n('preview'),
        contexts: ['page', 'image'],
      });
      chrome.contextMenus.create({
        id: 'deepSearch',
        parentId: 'cat-catch',
        title: i18n('deepSearch'),
        contexts: ['page', 'image'],
      });
      chrome.contextMenus.create({
        id: 'catch',
        parentId: 'cat-catch',
        title: i18n('cacheCapture'),
        contexts: ['page', 'image'],
      });
      chrome.contextMenus.create({
        id: 'auto_down',
        parentId: 'cat-catch',
        title: i18n('autoDownload'),
        contexts: ['page', 'image'],
      });
    });
  }

  // ===== Aria2 RPC 发送(还原原 popup-utils.js aria2AddUri) =====
  async function aria2AddUri(data: any): Promise<any> {
    const opts = useSettingsStore.getState().options;
    const json: Record<string, unknown> = {
      jsonrpc: '2.0',
      id: 'cat-catch-' + (data?.requestId || Date.now()),
      method: 'aria2.addUri',
      params: [] as unknown[],
    };
    const params: unknown[] = json.params as unknown[];
    if (opts.aria2RpcToken) {
      params.push(`token:${opts.aria2RpcToken}`);
    }
    const options: Record<string, unknown> = {};
    if (data?.downFileName) {
      options.out = data.downFileName;
    }
    if (opts.aria2RpcDir) {
      options.dir = opts.aria2RpcDir;
    }
    if (opts.enableAria2RpcReferer) {
      const headers: string[] = [];
      headers.push('User-Agent: ' + (opts.userAgent || navigator.userAgent));
      if (data?.requestHeaders?.referer) {
        headers.push('Referer: ' + data.requestHeaders.referer);
      }
      if (data?.cookie) {
        headers.push('Cookie: ' + data.cookie);
      }
      if (data?.requestHeaders?.authorization) {
        headers.push('Authorization: ' + data.requestHeaders.authorization);
      }
      options.header = headers;
    }
    params.push([data?.url], options);
    const res = await fetch(opts.aria2Rpc, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify(json),
    });
    return await res.json();
  }

  // ===== 右键菜单与快捷键复用(还原 background.js 第 756-803 行) =====
  function runCommands(command: string, data?: any): void {
    const s = useSettingsStore.getState();
    const tabId = s.tabId;
    switch (command) {
      case 'auto_down': {
        if (s.featAutoDownTabId.has(tabId)) {
          s.removeFeatAutoDownTab(tabId);
        } else {
          s.addFeatAutoDownTab(tabId);
        }
        break;
      }
      case 'catch': {
        s.toggleScriptTab('catch.js', tabId);
        chrome.tabs.reload(tabId, { bypassCache: true });
        break;
      }
      case 'm3u8':
        void chrome.tabs.create({ url: 'm3u8.html' });
        break;
      case 'clear': {
        useMediaStore.getState().clearTab(tabId);
        void useMediaStore.getState().persist();
        clearRedundant();
        SetIcon({ tabId });
        break;
      }
      case 'enable':
        void s.setEnable(!s.enable);
        break;
      case 'reboot':
        chrome.runtime.reload();
        break;
      case 'deepSearch': {
        const entry = s.scriptList.get('search.js');
        if (entry?.tabId.has(tabId)) {
          s.toggleScriptTab('search.js', tabId);
          s.setDeepSearchClose(tabId);
          chrome.tabs.reload(tabId, { bypassCache: true });
        } else {
          s.toggleScriptTab('search.js', tabId);
          chrome.tabs.reload(tabId, { bypassCache: true });
        }
        break;
      }
      case 'preview':
        void chrome.tabs.create({ url: `preview.html?tabId=${tabId}` });
        break;
      case 'image-save':
        if (data?.srcUrl) {
          chrome.downloads.download(
            { url: data.srcUrl, saveAs: s.options.saveAs },
            () => {
              if (chrome.runtime.lastError) {
                console.error(chrome.runtime.lastError);
                return;
              }
              downDataImageSave = data;
            },
          );
        }
        break;
    }
  }

  chrome.commands?.onCommand.addListener((command) => runCommands(command));
  chrome.contextMenus?.onClicked.addListener((info, _tab) =>
    runCommands(String(info.menuItemId), info),
  );

  // ===== 图片下载失败兜底用的临时变量 =====
  let downDataImageSave: { srcUrl?: string; pageUrl?: string } | undefined;

  // ============================================================================
  // findMedia —— 完整还原原 background.js 第 95-322 行的核心嗅探逻辑
  // ============================================================================
  async function findMedia(
    data: chrome.webRequest.WebRequestDetails & {
      allRequestHeaders?: Array<{ name: string; value?: string }> | Record<string, string>;
      header?: { size?: number; type?: string; attachment?: string };
      extraExt?: string;
      mime?: string;
      getTime?: number;
      cookie?: string;
      requestHeaders?: Array<{ name: string; value?: string }> | Record<string, string> | false;
    },
    isRegex = false,
    filter = false,
    timer = false,
  ): Promise<void> {
    const s = useSettingsStore.getState();
    const m = useMediaStore.getState();
    const r = useRuntimeStore.getState();

    // SW 唤醒后等待初始化完成
    if (!s.initSyncComplete || !s.initLocalComplete || s.tabId === -1 || !m.initialized) {
      if (timer) return;
      setTimeout(() => void findMedia(data, isRegex, filter, true), 500);
      return;
    }

    // 避免抓取列表(damnUrlSet)
    if (s.options.damn && data.tabId !== undefined && s.damnUrlSet.has(data.tabId)) {
      return;
    }

    // 全局禁用 / 屏蔽 / OPTIONS
    const blockUrlFlag = data.tabId && data.tabId > 0 && s.blockUrlSet.has(data.tabId);
    if (!s.enable || (s.blockUrlWhite ? !blockUrlFlag : blockUrlFlag) || (data as any).method === 'OPTIONS') {
      return;
    }

    (data as any).getTime = Date.now();

    // 正则黑名单(非 isRegex 调用时检查)
    if (!isRegex && data.requestId && r.hasBlackList(data.requestId)) {
      r.deleteBlackList(data.requestId);
      return;
    }

    // 屏蔽特殊页面
    const initiator = (data as any).initiator as string | undefined;
    if (initiator !== 'null' && initiator !== undefined && isSpecialPage(initiator)) return;
    if (s.isFirefox) {
      const originUrl = (data as any).originUrl as string | undefined;
      if (originUrl && isSpecialPage(originUrl)) return;
    }
    if (!data.url || isSpecialPage(data.url)) return;

    const urlParsing = new URL(data.url);
    let [name, ext] = fileNameParse(urlParsing.pathname);

    // ===== 正则匹配分支 =====
    if (isRegex && !filter) {
      for (const rule of s.Regex) {
        if (!rule.state) continue;
        rule.regex.lastIndex = 0;
        const result = rule.regex.exec(data.url);
        if (result === null) continue;
        if (rule.blackList) {
          useRuntimeStore.getState().addBlackList(data.requestId ?? String(Date.now()));
          return;
        }
        (data as any).extraExt = rule.ext ? rule.ext : undefined;
        if (result.length === 1) {
          void findMedia(data, true, true);
          return;
        }
        const shifted = result.slice(1).map((str) => decodeURIComponent(str));
        const first = shifted[0];
        if (first && !first.startsWith('https://') && !first.startsWith('http://')) {
          shifted[0] = urlParsing.protocol + '//' + data.url;
        }
        data.url = shifted.join('');
        void findMedia(data, true, true);
        return;
      }
      return;
    }

    // ===== 非正则匹配分支:基于 Ext/Type/附件/media 类型 =====
    if (!isRegex) {
      (data as any).header = getResponseHeadersValue(data as any);
      const header = (data as any).header as { size?: number; type?: string; attachment?: string };

      // 检查扩展名
      if (!filter && ext !== undefined) {
        filter = CheckExtension(ext, header.size) as boolean;
        if (filter === ('break' as any)) return;
      }
      // 检查类型
      if (!filter && header.type !== undefined) {
        filter = CheckType(header.type, header.size) as boolean;
        if (filter === ('break' as any)) return;
      }
      // 检查附件
      if (!filter && header.attachment !== undefined) {
        const parsed = parseAttachmentFilename(header.attachment);
        if (parsed) {
          [name, ext] = parsed;
          filter = CheckExtension(ext ?? '', 0) as boolean;
          if (filter === ('break' as any)) return;
        }
      }
      // media 类型资源直接通过
      if ((data as any).type === 'media') {
        filter = true;
      }
    }

    if (!filter) return;

    // tabId == -1 时使用当前激活 tab
    if (data.tabId === -1 || data.tabId === undefined) {
      data.tabId = s.tabId;
    }
    const finalTabId = data.tabId;

    // 缓存超限清空
    const currentList = useMediaStore.getState().getByTab(finalTabId);
    if (currentList.length > s.options.maxLength) {
      useMediaStore.getState().clearTab(finalTabId);
      void useMediaStore.getState().persist();
      return;
    }

    // URL 查重(基于 tabId 分桶,超 500 清空)
    if (s.options.checkDuplicates && currentList.length <= 500) {
      if (useRuntimeStore.getState().hasUrl(finalTabId, data.url)) {
        return;
      }
      useRuntimeStore.getState().addUrl(finalTabId, data.url);
    }

    // ===== 获取 webInfo + 写入 store + 发送到 popup/本地 =====
    chrome.tabs.get(finalTabId, (webInfo) => {
      if (chrome.runtime.lastError) return;

      // getRequestHeaders 返回 Record<string, string> | false,false 统一归一化为 undefined
      const requestHeaders: Record<string, string> | undefined = getRequestHeaders(data) || undefined;
      let cookie: string | undefined;
      if (requestHeaders?.cookie) {
        cookie = requestHeaders.cookie;
        delete requestHeaders.cookie;
      }
      (data as any).requestHeaders = requestHeaders;

      const info: MediaItem = {
        name,
        url: data.url,
        size: (data as any).header?.size,
        ext,
        type: (data as any).mime ?? (data as any).header?.type,
        tabId: finalTabId,
        isRegex,
        requestId: data.requestId ?? Date.now().toString(),
        initiator: (data as any).initiator,
        requestHeaders,
        cookie,
        getTime: (data as any).getTime,
      };

      // 不存在扩展时使用 type
      if (info.ext === undefined && info.type !== undefined) {
        info.ext = info.type.split('/')[1];
      }
      // 正则匹配的备注扩展
      if ((data as any).extraExt) {
        info.ext = (data as any).extraExt;
      }
      // initiator / referer 互补
      if (info.initiator === undefined || info.initiator === 'null') {
        info.initiator = requestHeaders?.referer ?? webInfo?.url;
      }
      // 装载页面信息
      info.title = webInfo?.title ?? 'NULL';
      info.favIconUrl = webInfo?.favIconUrl;
      info.webUrl = webInfo?.url;

      // 二次检查黑名单
      if (!isRegex && data.requestId && useRuntimeStore.getState().hasBlackList(data.requestId)) {
        useRuntimeStore.getState().deleteBlackList(data.requestId);
        return;
      }

      // 发送到 popup 并处理自动下载
      chrome.runtime.sendMessage({ Message: 'popupAddData', data: info }, () => {
        if (chrome.runtime.lastError) return;
        const st = useSettingsStore.getState();
        const downloadsState = (chrome.downloads as any)?.State;
        if (
          st.featAutoDownTabId.size > 0 &&
          st.featAutoDownTabId.has(info.tabId) &&
          downloadsState
        ) {
          try {
            const title = !info.title || info.title === 'NULL'
              ? 'CatCatch/'
              : stringModify(info.title) + '/';
            let fileName: string;
            if (st.options.TitleName) {
              fileName = filterFileName(
                templates(st.options.downFileName, info as unknown as TemplateContext),
              );
            } else {
              const baseName = !info.name
                ? stringModify(info.title ?? 'NULL') + '.' + (info.ext ?? '')
                : decodeURIComponent(stringModify(info.name));
              fileName = title + baseName;
            }
            void chrome.downloads.download({ url: info.url, filename: fileName });
          } catch {
            /* 吞掉自动下载错误 */
          }
        }
      });

      // 发送到本地
      if (s.options.send2local) {
        try {
          void send2local('catch', { ...info, requestHeaders: (data as any).allRequestHeaders }, info.tabId);
        } catch (e) {
          console.error(e);
        }
      }

      // 写入 store
      useMediaStore.getState().push(info);

      // 防抖持久化
      void save(finalTabId);
    });
  }

  // ============================================================================
  // save(tabId) —— 持久化 + 设置图标(还原 background.js 第 324-337 行)
  // ============================================================================
  async function save(tabId: number): Promise<void> {
    const r = useRuntimeStore.getState();
    if (r.debounceTimer) clearTimeout(r.debounceTimer);

    const list = useMediaStore.getState().getByTab(tabId);
    // 单 tab 数据超过 99 条不写 storage(避免 quota)
    if (list.length <= 99) {
      void useMediaStore.getState().persist();
    }
    SetIcon({ number: list.length, tabId });
    useRuntimeStore.getState().setDebounce(undefined, 0, Date.now());
  }
});
