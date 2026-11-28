import { useAppStore } from '@/store/modules/app'
import { isPagePath, isRegisteredPage } from '@/config/routes'

/** 当前页面完整路径，如 /pages/system/user/index */
export const currentRoute = (): string => {
  const pages = getCurrentPages()
  if (!pages.length) return ''
  return `/${pages[pages.length - 1].route}`
}

/**
 * 页面跳转
 * - 移动端：navigateTo，保留返回能力
 * - 桌面端：reLaunch，避免反复点菜单把页面栈撑满
 */
export const navigateTo = (url: string): void => {
  if (!url) return
  if (currentRoute() === url) return

  // 菜单里配了 pages.json 未注册的路径时，给一次明确提示，避免「点了没反应」
  if (isPagePath(url) && !isRegisteredPage(url)) {
    uni.showToast({ title: `页面未在 pages.json 注册：${url}`, icon: 'none' })
    return
  }

  const app = useAppStore()
  if (app.isMobile) {
    uni.navigateTo({ url })
  } else {
    uni.reLaunch({ url })
  }
}

/** 关闭当前页面并返回上一页，没有上一页时回工作台 */
export const navigateBack = (): void => {
  const pages = getCurrentPages()
  if (pages.length > 1) {
    uni.navigateBack()
  } else {
    uni.reLaunch({ url: '/pages/home/index' })
  }
}
