import { createSSRApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
// 全量注册：把组件库导出的所有 TnXxx 组件注册为全局组件
import * as TnUI from '@tuniao/tnui-vue3-uniapp'
import i18n from './i18n'

export function createApp() {
	const app = createSSRApp(App)

	// 知识点：Pinia 状态管理（user / cart 两个 store）
	app.use(createPinia())

	// 知识点 1：全量注册组件。
	// 说明：包内组件的 name 取自 SFC 文件名（如 tabs），若直接 app.use(install)
	// 会注册成 tabs 而非 tn-tabs，因此这里按导出名逐个大写注册（TnButton -> tn-button）。
	Object.keys(TnUI).forEach((key) => {
		if (!/^Tn[A-Z]/.test(key)) return
		const component = (TnUI as Record<string, any>)[key]
		if (!component || typeof component !== 'object') return
		// 带 install 方法的即为组件（withInstall / withNoopInstall 均会注入）
		if (typeof component.install !== 'function') return
		const tagName = key.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()
		app.component(tagName, component)
	})

	// 知识点 2：第三方能力 vue-i18n 多语言
	app.use(i18n)

	return {
		app,
	}
}
