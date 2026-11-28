import { createI18n } from 'vue-i18n'
import zhCN from './zh-CN'
import enUS from './en-US'
import { storage } from '@/utils/storage'

export type LocaleKey = 'zh-CN' | 'en-US'

/** 可选语言，key 与 vue-i18n 的 locale / 本地存储值一致 */
export const LOCALES: { key: LocaleKey; label: string }[] = [
  { key: 'zh-CN', label: '简体中文' },
  { key: 'en-US', label: 'English' },
]

const LOCALE_KEY = 'locale'

const readLocale = (): LocaleKey =>
  storage.get<string>(LOCALE_KEY, 'zh-CN') === 'en-US' ? 'en-US' : 'zh-CN'

export const i18n = createI18n({
  legacy: false,
  locale: readLocale(),
  fallbackLocale: 'zh-CN',
  messages: {
    'zh-CN': zhCN,
    'en-US': enUS,
  },
})

export const getLocale = (): LocaleKey => i18n.global.locale.value as LocaleKey

/** 切换语言并持久化；组件里的文案会在下次页面初始化时生效 */
export const setLocale = (locale: LocaleKey): void => {
  i18n.global.locale.value = locale
  storage.set(LOCALE_KEY, locale)
}
