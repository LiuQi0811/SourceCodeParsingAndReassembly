import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { appConfig } from '@/config'
import { storage } from '@/utils/storage'
import { hasPagePermission, hasPermission } from '@/utils/permission'
import { authApi } from '@/api/auth'
import type { LoginForm, MenuItem, UserProfile } from '@/api/types'

/**
 * 登录态与权限
 * token、用户资料、菜单树、按钮权限码全部集中在这里
 */
export const useUserStore = defineStore('user', () => {
  const token = ref(storage.get<string>(appConfig.tokenKey, '') || '')
  const profile = ref<UserProfile | null>(storage.get<UserProfile>('profile'))

  const isLogin = computed(() => !!token.value)
  const menus = computed<MenuItem[]>(() => profile.value?.menus || [])
  const perms = computed<string[]>(() => profile.value?.perms || [])
  const nickname = computed(() => profile.value?.nickname || '未登录')
  const roleNames = computed(() => profile.value?.roleNames || '')
  const roleIds = computed<number[]>(() => profile.value?.roleIds || [])
  const avatarText = computed(() => (profile.value?.nickname || 'U').slice(0, 1))

  const applyProfile = (data: UserProfile): void => {
    profile.value = data
    storage.set('profile', data)
  }

  const login = async (form: LoginForm): Promise<void> => {
    const result = await authApi.login(form)
    token.value = result.token
    storage.set(appConfig.tokenKey, result.token)
    applyProfile(result.profile)
  }

  const fetchProfile = async (silent = false): Promise<UserProfile> => {
    const data = await authApi.profile({ showError: !silent })
    applyProfile(data)
    return data
  }

  /**
   * 刷新当前账号的权限数据
   * 角色授权、菜单增删后调用，让侧边栏菜单、按钮权限、页面校验立刻生效
   * silent = true 时静默失败（页面启动时补拉，不打断用户）
   */
  const refreshProfile = async (silent = false): Promise<void> => {
    if (!token.value) return
    await fetchProfile(silent)
  }

  const logout = async (silent = false): Promise<void> => {
    if (!silent) {
      try {
        await authApi.logout()
      } catch (e) {
        // 退出失败不影响本地清理
      }
    }
    token.value = ''
    profile.value = null
    storage.remove(appConfig.tokenKey)
    storage.remove('profile')
  }

  /** 按钮级权限判断 */
  const hasPerm = (code?: string): boolean => hasPermission(perms.value, code)

  /** 页面级权限判断：路径是否在授权菜单内 */
  const hasPage = (path: string): boolean => {
    if (!path) return true
    if (!profile.value) return false
    return hasPagePermission(menus.value, path)
  }

  const currentRoutePath = (): string => {
    const pages = getCurrentPages()
    if (!pages.length) return ''
    return `/${pages[pages.length - 1].route}`
  }

  // Token 失效时由请求层广播，这里统一清理并跳转登录页
  uni.$on('auth:expired', () => {
    token.value = ''
    profile.value = null
    if (currentRoutePath() !== '/pages/login/index') {
      uni.reLaunch({ url: '/pages/login/index' })
    }
  })

  return {
    token,
    profile,
    isLogin,
    menus,
    perms,
    nickname,
    roleNames,
    roleIds,
    avatarText,
    login,
    fetchProfile,
    refreshProfile,
    logout,
    hasPerm,
    hasPage,
    currentRoutePath,
  }
})
