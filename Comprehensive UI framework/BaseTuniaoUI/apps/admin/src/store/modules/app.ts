import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { appConfig } from '@/config'
import { storage } from '@/utils/storage'

export type DeviceType = 'mobile' | 'tablet' | 'desktop'
export type ThemeMode = 'light' | 'dark'
export type AccentKey = 'sky' | 'green' | 'violet' | 'orange'
export type DensityMode = 'normal' | 'compact'
export type RadiusMode = 'small' | 'default' | 'large'

/** 可选品牌色，name 用于设置面板展示 */
export const ACCENTS: { key: AccentKey; name: string; color: string }[] = [
  { key: 'sky', name: '天青', color: '#01beff' },
  { key: 'green', name: '松绿', color: '#00b96b' },
  { key: 'violet', name: '黛紫', color: '#7a5af8' },
  { key: 'orange', name: '赤橙', color: '#ff7a45' },
]

const THEME_KEY = 'theme'
const ACCENT_KEY = 'accent'
const DENSITY_KEY = 'density'
const RADIUS_KEY = 'radius'

const readTheme = (): ThemeMode =>
  storage.get<ThemeMode>(THEME_KEY, 'light') === 'dark' ? 'dark' : 'light'

const readAccent = (): AccentKey => {
  const saved = storage.get<AccentKey>(ACCENT_KEY, 'sky')
  return ACCENTS.some((item) => item.key === saved) ? (saved as AccentKey) : 'sky'
}

const readDensity = (): DensityMode =>
  storage.get<DensityMode>(DENSITY_KEY, 'normal') === 'compact' ? 'compact' : 'normal'

const readRadius = (): RadiusMode => {
  const saved = storage.get<string>(RADIUS_KEY, 'default')
  return saved === 'small' || saved === 'large' ? saved : 'default'
}

/**
 * 应用级状态：屏幕尺寸、设备形态、侧边栏与移动端抽屉、主题外观
 * 所有布局组件都从这里读取响应式状态，保证三端表现一致
 */
export const useAppStore = defineStore('app', () => {
  const windowWidth = ref(375)
  const sidebarCollapsed = ref(false)
  const drawerVisible = ref(false)
  const theme = ref<ThemeMode>(readTheme())
  const accent = ref<AccentKey>(readAccent())
  const density = ref<DensityMode>(readDensity())
  const radius = ref<RadiusMode>(readRadius())
  let listening = false

  /** 页面根节点绑定的主题 class，子节点通过 CSS 变量继承 */
  const themeClass = computed(
    () =>
      `theme-${theme.value} accent-${accent.value} density-${density.value} radius-${radius.value}`
  )

  const device = computed<DeviceType>(() => {
    if (windowWidth.value < appConfig.mobileBreakpoint) return 'mobile'
    if (windowWidth.value < 1200) return 'tablet'
    return 'desktop'
  })

  const isMobile = computed(() => device.value === 'mobile')
  const isTablet = computed(() => device.value === 'tablet')
  const isDesktop = computed(() => device.value === 'desktop')

  const updateWidth = (): void => {
    try {
      const info = uni.getSystemInfoSync()
      if (info.windowWidth) windowWidth.value = info.windowWidth
    } catch (e) {
      // 忽略获取失败的极端情况，保持上一次宽度
    }
    // 切回桌面时收起抽屉，避免遮罩残留
    if (windowWidth.value >= appConfig.mobileBreakpoint) drawerVisible.value = false
  }

  const initResponsive = (): void => {
    updateWidth()
    if (listening) return
    listening = true

    // #ifdef H5
    window.addEventListener('resize', updateWidth)
    // #endif

    // #ifndef H5
    uni.onWindowResize((res: any) => {
      const width = res?.size?.windowWidth || res?.windowWidth
      if (width) windowWidth.value = width
      if (windowWidth.value >= appConfig.mobileBreakpoint) drawerVisible.value = false
    })
    // #endif
  }

  const toggleSidebar = (): void => {
    if (isMobile.value) {
      drawerVisible.value = !drawerVisible.value
    } else {
      sidebarCollapsed.value = !sidebarCollapsed.value
    }
  }

  const closeDrawer = (): void => {
    drawerVisible.value = false
  }

  const setTheme = (value: ThemeMode): void => {
    theme.value = value
    storage.set(THEME_KEY, value)
  }

  const setAccent = (value: AccentKey): void => {
    accent.value = ACCENTS.some((item) => item.key === value) ? value : 'sky'
    storage.set(ACCENT_KEY, accent.value)
  }

  const setDensity = (value: DensityMode): void => {
    density.value = value === 'compact' ? 'compact' : 'normal'
    storage.set(DENSITY_KEY, density.value)
  }

  const setRadius = (value: RadiusMode): void => {
    radius.value = ['small', 'default', 'large'].includes(value) ? value : 'default'
    storage.set(RADIUS_KEY, radius.value)
  }

  const toggleTheme = (): void => {
    setTheme(theme.value === 'dark' ? 'light' : 'dark')
  }

  return {
    windowWidth,
    device,
    isMobile,
    isTablet,
    isDesktop,
    sidebarCollapsed,
    drawerVisible,
    theme,
    accent,
    density,
    radius,
    themeClass,
    initResponsive,
    toggleSidebar,
    closeDrawer,
    setTheme,
    setAccent,
    setDensity,
    setRadius,
    toggleTheme,
  }
})
