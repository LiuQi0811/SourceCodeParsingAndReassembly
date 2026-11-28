import { get, post } from '@/utils/request'
import type { RequestOptions } from '@/utils/request'
import type { LoginForm, LoginResult, UserProfile } from './types'

export const authApi = {
  /** 账号密码登录 */
  login: (form: LoginForm) => post<LoginResult>('/auth/login', { ...form }),
  /** 获取当前登录用户信息（含菜单与按钮权限） */
  profile: (options?: Partial<RequestOptions>) =>
    get<UserProfile>('/auth/profile', undefined, options),
  /** 退出登录 */
  logout: () => post<boolean>('/auth/logout'),
}
