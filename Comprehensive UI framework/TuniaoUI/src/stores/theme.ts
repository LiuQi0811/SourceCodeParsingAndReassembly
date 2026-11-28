import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

const STORAGE_KEY = 'tn-demo-theme'
const themeModes = ['light', 'dark'] as const
export type ThemeMode = (typeof themeModes)[number]

const lightVars: Record<string, string> = {
	'--demo-bg': '#f4f7fb',
	'--demo-surface': '#ffffff',
	'--demo-surface-raised': '#ffffff',
	'--demo-soft': '#f4f7fb',
	'--demo-soft-strong': '#eef2f8',
	'--demo-line': '#e8eef7',
	'--demo-line-soft': '#f0f3f8',
	'--demo-ink': '#0f172a',
	'--demo-text': '#303133',
	'--demo-muted': '#606266',
	'--demo-faint': '#909399',
	'--demo-primary': '#2f6bff',
	'--demo-primary-soft': '#edf5ff',
	'--demo-primary-line': '#c7ddff',
	'--demo-purple': '#5f4fd9',
	'--demo-purple-soft': '#f3f1ff',
	'--demo-orange': '#ff6b3d',
	'--demo-shadow': '0 12rpx 32rpx rgba(15, 23, 42, 0.05)',
	'--demo-code-bg': '#0f172a',
	'--demo-contrast': '#0f172a',
	'--demo-nav-bg': '#ffffff',
	'--demo-nav-fg': '#000000',
}

const darkVars: Record<string, string> = {
	'--demo-bg': '#070b14',
	'--demo-surface': '#101827',
	'--demo-surface-raised': '#132035',
	'--demo-soft': '#0d1625',
	'--demo-soft-strong': '#172338',
	'--demo-line': '#23324b',
	'--demo-line-soft': '#1a2740',
	'--demo-ink': '#f1f5f9',
	'--demo-text': '#dbe4f0',
	'--demo-muted': '#a8b3c4',
	'--demo-faint': '#748199',
	'--demo-primary': '#65a3ff',
	'--demo-primary-soft': '#12233f',
	'--demo-primary-line': '#29486f',
	'--demo-purple': '#a78bfa',
	'--demo-purple-soft': '#241f45',
	'--demo-orange': '#ff9a75',
	'--demo-shadow': '0 14rpx 34rpx rgba(0, 0, 0, 0.28)',
	'--demo-code-bg': '#0a111d',
	'--demo-contrast': '#1e3a8a',
	'--demo-nav-bg': '#0b1220',
	'--demo-nav-fg': '#ffffff',
}

export const useThemeStore = defineStore('theme', () => {
	const mode = ref<ThemeMode>('light')
	const initialized = ref(false)
	const isDark = computed(() => mode.value === 'dark')
	const vars = computed(() => (isDark.value ? darkVars : lightVars))

	function isThemeMode(value: unknown): value is ThemeMode {
		return value === 'light' || value === 'dark'
	}

	function applyChrome() {
		// #ifdef H5
		if (typeof document !== 'undefined') {
			document.documentElement.classList.toggle('theme-dark', isDark.value)
			document.documentElement.style.colorScheme = isDark.value ? 'dark' : 'light'
		}
		// #endif

		uni.setNavigationBarColor({
			frontColor: isDark.value ? '#ffffff' : '#000000',
			backgroundColor: isDark.value ? '#0b1220' : '#ffffff',
			animation: { duration: 220, timingFunc: 'easeIn' },
			fail: () => {},
		})

		uni.setTabBarStyle({
			color: isDark.value ? '#94a3b8' : '#909399',
			selectedColor: isDark.value ? '#67e8f9' : '#01beff',
			backgroundColor: isDark.value ? '#0b1220' : '#ffffff',
			borderStyle: isDark.value ? 'white' : 'black',
			fail: () => {},
		})

		// #ifdef MP-WEIXIN || APP-PLUS
		uni.setBackgroundColor({
			backgroundColor: isDark.value ? '#070b14' : '#f4f7fb',
			backgroundColorTop: isDark.value ? '#070b14' : '#f4f7fb',
			backgroundColorBottom: isDark.value ? '#070b14' : '#f4f7fb',
			fail: () => {},
		})
		// #endif
	}

	function setMode(next: ThemeMode, persist = true) {
		mode.value = isThemeMode(next) ? next : 'light'
		if (persist) uni.setStorageSync(STORAGE_KEY, mode.value)
		applyChrome()
	}

	function toggle() {
		setMode(isDark.value ? 'light' : 'dark')
	}

	function init() {
		if (initialized.value) {
			applyChrome()
			return
		}
		const cached = uni.getStorageSync(STORAGE_KEY)
		mode.value = isThemeMode(cached) ? cached : 'light'
		initialized.value = true
		applyChrome()
	}

	return {
		mode,
		isDark,
		vars,
		initialized,
		setMode,
		toggle,
		init,
		applyChrome,
	}
})
