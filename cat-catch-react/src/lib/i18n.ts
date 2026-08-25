/**
 * i18n 辅助:还原 chrome.i18n.getMessage 调用
 * _locales 下的 messages.json 通过 WXT 的 public 目录加载
 * typeof chrome 判断:非扩展上下文(http 测试/SSR)下提供 fallback,避免渲染期抛错
 */
export function i18n(key: string, substitutions?: string | string[]): string {
  if (typeof chrome === 'undefined' || !chrome.i18n) return key;
  return chrome.i18n.getMessage(key, substitutions) || key;
}

/** 获取当前 UI 语言 */
export function getUILanguage(): string {
  if (typeof chrome === 'undefined' || !chrome.i18n) return navigator.language || 'en';
  return chrome.i18n.getUILanguage?.() || navigator.language || 'en';
}

/** 扩展当前版本号 */
export function getExtensionVersion(): string {
  if (typeof chrome === 'undefined' || !chrome.runtime) return '0.1.0';
  return chrome.runtime.getManifest().version;
}

/** 扩展名(从 manifest 的 __MSG_catCatch__ 解析后) */
export function getExtensionName(): string {
  if (typeof chrome === 'undefined' || !chrome.runtime) return '猫抓';
  return chrome.runtime.getManifest().name;
}
