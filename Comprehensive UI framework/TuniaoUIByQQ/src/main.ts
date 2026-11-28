import { createSSRApp } from 'vue'
import App from './App.vue'
// 全量注册：把 TuniaoUI 导出的所有 TnXxx 组件注册为全局组件
import * as TnUI from '@tuniao/tnui-vue3-uniapp'

export function createApp() {
	const app = createSSRApp(App)

	// 包内组件的 name 取自 SFC 文件名（如 tabs），直接 app.use(install) 会注册成 tabs，
	// 因此这里按导出名逐个转成 kebab-case 标签注册（TnButton -> tn-button）
	Object.keys(TnUI).forEach((key) => {
		if (!/^Tn[A-Z]/.test(key)) return
		const component = (TnUI as Record<string, any>)[key]
		if (!component || typeof component !== 'object') return
		if (typeof component.install !== 'function') return
		const tagName = key.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()
		app.component(tagName, component)
	})

	return {
		app,
	}
}
