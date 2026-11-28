import { createI18n } from 'vue-i18n'
import zhHans from './locales/zh-Hans'
import en from './locales/en'

/**
 * 知识点：第三方能力 vue-i18n
 * - legacy: false 使用 Composition API 模式，页面里通过 useI18n() 取值
 * - globalInjection: true 允许模板里直接使用 $t('xxx')
 * - 切换语言后所有 t('xxx') 立即刷新
 */
const i18n = createI18n({
	legacy: false,
	globalInjection: true,
	locale: 'zh-Hans',
	fallbackLocale: 'zh-Hans',
	messages: {
		'zh-Hans': zhHans,
		en,
	},
})

export const localeOptions = [
	{ label: '简体中文', value: 'zh-Hans' },
	{ label: 'English', value: 'en' },
]

/** 切换语言并写入本地缓存，下次启动由 App.vue 还原 */
export function setLocale(locale: string) {
	i18n.global.locale.value = locale as 'zh-Hans' | 'en'
	uni.setStorageSync('tn-demo-locale', locale)
}

export default i18n
