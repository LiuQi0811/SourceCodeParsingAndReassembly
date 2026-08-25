/**
 * chrome.* API 类型化封装
 * 还原原项目 G 全局对象 + chrome.storage / tabs / webRequest 等调用
 */

/** 当前活动 tab id,异步获取 */
export async function getCurrentTabId(): Promise<number> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.id ?? -1;
}

/** 是否为移动端 UA(还原 G.isMobile) */
export const isMobile: boolean = /Mobile|Android|iPhone|iPad/i.test(
  navigator.userAgent,
);

/**
 * chrome.storage 同步读取
 * - chrome.storage.sync 用于扩展级配置
 * - chrome.storage.session / local 用于运行时缓存
 */
export async function getStorage<T = Record<string, unknown>>(
  area: 'sync' | 'local' | 'session' = 'sync',
): Promise<T> {
  return (await chrome.storage[area].get(null)) as T;
}

export async function setStorage(
  items: Record<string, unknown>,
  area: 'sync' | 'local' | 'session' = 'sync',
): Promise<void> {
  await chrome.storage[area].set(items);
}

/** 向当前/指定 tab 发送消息(还原原 chrome.tabs.sendMessage) */
export async function sendMessageToTab<T = unknown>(
  tabId: number,
  message: unknown,
): Promise<T | undefined> {
  try {
    return await chrome.tabs.sendMessage(tabId, message);
  } catch {
    return undefined;
  }
}

/** 向 background 发送消息(还原原 chrome.runtime.sendMessage) */
export async function sendRuntimeMessage<T = unknown>(
  message: unknown,
): Promise<T | undefined> {
  try {
    return await chrome.runtime.sendMessage(chrome.runtime.id, message);
  } catch {
    return undefined;
  }
}
