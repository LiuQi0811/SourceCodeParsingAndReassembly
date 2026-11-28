/// <reference types="vite/client" />
/// <reference types="@dcloudio/types" />

declare module '*.vue' {
	import type { DefineComponent } from 'vue'
	const component: DefineComponent<{}, {}, any>
	export default component
}

declare const uni: UniApp.Uni
