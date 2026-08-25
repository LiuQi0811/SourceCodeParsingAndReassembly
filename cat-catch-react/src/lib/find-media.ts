/**
 * 嗅探辅助函数 - 1:1 还原原 js/background.js 的辅助函数
 * - operatorCheck / CheckExtension / CheckType
 * - fileNameParse / getResponseHeadersValue / getRequestHeaders
 * - SetIcon / mobileUserAgent / isSpecialPage / clearRedundant
 */
import { useSettingsStore } from '@stores/settings';
import { useMediaStore } from '@stores/media';
import { useRuntimeStore } from '@stores/runtime';
import type { Operator } from '@lib/config';

const reFilename = /filename="?([^"]+)"?/;

/** 操作符检查(还原 background.js 第 845-873 行) */
export function operatorCheck(
  size: number | undefined,
  obj: {
    operator: Operator;
    size: number | string;
    unit?: string;
    min?: number;
    max?: number;
  },
): boolean {
  const unitNumber: Record<string, number> = {
    B: 1,
    BYTE: 1,
    KB: 1024,
    MB: 1048576,
    GB: 1073741824,
  };
  const unit = obj.unit || 'B';
  const factor = unitNumber[unit] ?? 1;
  const targetSize = Number(obj.size) * factor;
  switch (obj.operator) {
    case '=':
      return size === targetSize;
    case '<':
      return (size ?? 0) < targetSize;
    case '>':
      return (size ?? 0) > targetSize;
    case '<=':
      return (size ?? 0) <= targetSize;
    case '>=':
      return (size ?? 0) >= targetSize;
    case '!=':
      return size !== targetSize;
    case '~':
      return (
        (obj.min ? (size ?? 0) >= obj.min * factor : true) &&
        (obj.max ? (size ?? 0) <= obj.max * factor : true)
      );
    default:
      return (size ?? 0) <= targetSize;
  }
}

/** 检查扩展名和大小(还原 background.js 第 881-889 行) */
export function CheckExtension(
  ext: string,
  size: number | undefined,
): boolean | 'break' {
  const G = useSettingsStore.getState();
  const rule = G.Ext.get(ext);
  if (!rule) return false;
  if (!rule.state) return 'break';
  if (rule.size !== 0 && size !== undefined && !operatorCheck(size, rule)) {
    return 'break';
  }
  return true;
}

/** 检查类型和大小(还原 background.js 第 897-905 行) */
export function CheckType(
  dataType: string,
  dataSize: number | undefined,
): boolean | 'break' {
  const G = useSettingsStore.getState();
  const typeInfo =
    G.Type.get(dataType.split('/')[0] + '/*') || G.Type.get(dataType);
  if (!typeInfo) return false;
  if (!typeInfo.state) return 'break';
  if (typeInfo.size !== 0 && dataSize !== undefined && !operatorCheck(dataSize, typeInfo)) {
    return 'break';
  }
  return true;
}

/** 获取文件名及扩展名(还原 background.js 第 912-917 行) */
export function fileNameParse(pathname: string): [string, string | undefined] {
  let fileName = '';
  try {
    fileName = decodeURI(pathname.split('/').pop() || '');
  } catch {
    fileName = pathname.split('/').pop() || '';
  }
  const parts = fileName.split('.');
  const ext = parts.length === 1 ? undefined : parts.pop()!.toLowerCase();
  return [fileName, ext];
}

interface ResponseHeaderInfo {
  size?: number;
  type?: string;
  attachment?: string;
}

/** 获取响应头信息(还原 background.js 第 924-943 行) */
export function getResponseHeadersValue(
  data: chrome.webRequest.WebResponseHeadersDetails,
): ResponseHeaderInfo {
  const header: ResponseHeaderInfo = {};
  if (!data.responseHeaders || data.responseHeaders.length === 0) return header;
  for (const item of data.responseHeaders) {
    const name = item.name.toLowerCase();
    if (name === 'content-length') {
      if (header.size === undefined) header.size = parseInt(item.value ?? '0', 10);
    } else if (name === 'content-type') {
      header.type = ((item.value ?? '').split(';')[0] ?? '').toLowerCase();
    } else if (name === 'content-disposition') {
      header.attachment = item.value;
    } else if (name === 'content-range') {
      const size = (item.value ?? '').split('/')[1];
      if (size !== '*' && size !== undefined) {
        header.size = parseInt(size, 10);
      }
    }
  }
  return header;
}

/** 直接包含的请求头名(还原 background.js 第 950-963 行) */
const DIRECT_INCLUDE_HEADERS = new Set([
  'referer', 'origin', 'cookie', 'authorization', 'auth', 'token', 'key',
  'access-token', 'api-key', 'app-token', 'authtoken', 'session-id',
]);
const X_AUTH_KEYWORD_REG = /(auth|token|sign|key|ticket|session)/;

/** 获取请求头(还原 background.js 第 965-982 行) */
export function getRequestHeaders(
  data: { allRequestHeaders?: Array<{ name: string; value?: string }> | Record<string, string> },
): Record<string, string> | false {
  if (!data?.allRequestHeaders) return false;
  const header: Record<string, string> = {};
  if (Array.isArray(data.allRequestHeaders)) {
    for (const item of data.allRequestHeaders) {
      if (!item.name || !item.value) continue;
      const lowerName = item.name.toLowerCase();
      if (DIRECT_INCLUDE_HEADERS.has(lowerName)) {
        header[lowerName] = item.value;
        continue;
      }
      if (lowerName.startsWith('x-') && X_AUTH_KEYWORD_REG.test(lowerName)) {
        header[lowerName] = item.value;
      }
    }
  } else {
    for (const [name, value] of Object.entries(data.allRequestHeaders)) {
      const lowerName = name.toLowerCase();
      if (
        DIRECT_INCLUDE_HEADERS.has(lowerName) ||
        (lowerName.startsWith('x-') && X_AUTH_KEYWORD_REG.test(lowerName))
      ) {
        header[lowerName] = value;
      }
    }
  }
  return Object.keys(header).length > 0 ? header : false;
}

/** 解析 content-disposition(还原 background.js 第 182-188 行的附件逻辑) */
export function parseAttachmentFilename(attachment: string): [string, string | undefined] | null {
  const match = reFilename.exec(attachment);
  if (!match || !match[1]) return null;
  let decoded = '';
  try {
    decoded = decodeURIComponent(match[1]);
  } catch {
    decoded = match[1];
  }
  return fileNameParse(decoded);
}

/** 设置扩展图标徽章(还原 background.js 第 984-993 行) */
export function SetIcon(obj?: { number?: number; tabId?: number }): void {
  const G = useSettingsStore.getState();
  const tabId = obj?.tabId ?? G.tabId;
  if (!obj || obj.number === 0 || obj.number === undefined) {
    chrome.action.setBadgeText({ text: '', tabId });
    return;
  }
  if (G.options.badgeNumber) {
    const text = obj.number > 999 ? '999+' : String(obj.number);
    chrome.action.setBadgeText({ text, tabId });
  }
}

/** 模拟手机端 UA(还原 background.js 第 996-1024 行) */
export function mobileUserAgent(tabId: number, change = false): void {
  const settings = useSettingsStore.getState();
  const area = chrome.storage.session ?? chrome.storage.local;
  if (change) {
    settings.addFeatMobileTab(tabId);
    const nextSet = useSettingsStore.getState().featMobileTabId;
    void area.set({ featMobileTabId: Array.from(nextSet) });
    chrome.declarativeNetRequest.updateSessionRules({
      removeRuleIds: [tabId],
      addRules: [
        {
          id: tabId,
          action: {
            type: 'modifyHeaders' as chrome.declarativeNetRequest.RuleActionType,
            requestHeaders: [
              {
                header: 'User-Agent',
                operation: 'set' as chrome.declarativeNetRequest.HeaderOperation,
                value: settings.options.MobileUserAgent,
              },
            ],
          },
          condition: {
            tabIds: [tabId],
            resourceTypes: Object.values(
              chrome.declarativeNetRequest.ResourceType,
            ) as chrome.declarativeNetRequest.ResourceType[],
          },
        },
      ],
    });
    return;
  }
  settings.removeFeatMobileTab(tabId);
  const nextSet = useSettingsStore.getState().featMobileTabId;
  void area.set({ featMobileTabId: Array.from(nextSet) });
  chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: [tabId] });
}

/** 判断特殊页面(还原 background.js 第 1027-1030 行) */
export function isSpecialPage(url?: string): boolean {
  if (!url || url === 'null') return true;
  return !(
    url.startsWith('http://') ||
    url.startsWith('https://') ||
    url.startsWith('blob:')
  );
}

/** 清理冗余数据(还原 background.js 第 1035-1104 行) */
export function clearRedundant(): void {
  const G = useSettingsStore.getState();
  chrome.tabs.query({}, (tabs) => {
    const allTabId = new Set(tabs.map((t) => t.id));
    const media = useMediaStore.getState();
    const runtime = useRuntimeStore.getState();

    // 1. 清理 cacheData 中已关闭 tab 的数据
    let cacheChanged = false;
    const nextBuckets = new Map(media.buckets);
    for (const key of nextBuckets.keys()) {
      if (!allTabId.has(key)) {
        nextBuckets.delete(key);
        cacheChanged = true;
      }
    }
    if (cacheChanged) {
      useMediaStore.setState({ buckets: nextBuckets });
      void media.persist();
    }

    // 2. 清理 urlMap
    const nextUrlMap = new Map(runtime.urlMap);
    let urlMapChanged = false;
    for (const key of nextUrlMap.keys()) {
      if (!allTabId.has(key)) {
        nextUrlMap.delete(key);
        urlMapChanged = true;
      }
    }
    if (urlMapChanged) useRuntimeStore.setState({ urlMap: nextUrlMap });

    // 3. 清理脚本
    const nextScriptList = new Map(G.scriptList);
    let scriptChanged = false;
    for (const [name, entry] of nextScriptList) {
      const nextTabId = new Set(entry.tabId);
      let entryChanged = false;
      for (const tid of entry.tabId) {
        if (!allTabId.has(tid)) {
          nextTabId.delete(tid);
          entryChanged = true;
        }
      }
      if (entryChanged) {
        nextScriptList.set(name, { ...entry, tabId: nextTabId });
        scriptChanged = true;
      }
    }
    if (scriptChanged) useSettingsStore.setState({ scriptList: nextScriptList });

    if (!G.initLocalComplete) return;

    // 4. 清理 declarativeNetRequest(模拟手机)
    chrome.declarativeNetRequest.getSessionRules((rules) => {
      let mobileFlag = false;
      const tabsToRemove: number[] = [];
      for (const item of rules) {
        if (item.condition.tabIds) {
          if (!item.condition.tabIds.some((id: number) => allTabId.has(id))) {
            mobileFlag = true;
            item.condition.tabIds.forEach((id: number) => tabsToRemove.push(id));
            chrome.declarativeNetRequest.updateSessionRules({
              removeRuleIds: [item.id],
            });
          }
        } else if (item.id === 1) {
          chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: [1] });
        }
      }
      if (mobileFlag) {
        const settings = useSettingsStore.getState();
        const nextMobile = new Set(settings.featMobileTabId);
        for (const id of tabsToRemove) nextMobile.delete(id);
        useSettingsStore.setState({ featMobileTabId: nextMobile });
        const area = chrome.storage.session ?? chrome.storage.local;
        void area.set({ featMobileTabId: Array.from(nextMobile) });
      }
    });

    // 5. 清理自动下载
    let autoDownFlag = false;
    const nextAuto = new Set(G.featAutoDownTabId);
    for (const tid of G.featAutoDownTabId) {
      if (!allTabId.has(tid)) {
        nextAuto.delete(tid);
        autoDownFlag = true;
      }
    }
    if (autoDownFlag) {
      useSettingsStore.setState({ featAutoDownTabId: nextAuto });
      const area = chrome.storage.session ?? chrome.storage.local;
      void area.set({ featAutoDownTabId: Array.from(nextAuto) });
    }

    // 6. 清理 blockUrlSet / damnUrlSet
    const nextBlock = new Set([...G.blockUrlSet].filter((x) => allTabId.has(x)));
    const nextDamn = new Set([...G.damnUrlSet].filter((x) => allTabId.has(x)));
    useSettingsStore.setState({
      blockUrlSet: nextBlock,
      damnUrlSet: nextDamn,
    });

    // 7. requestHeaders 过大时清理
    if (runtime.requestHeaders.size >= 10240) {
      runtime.requestHeaders.clear();
    }
  });
}
