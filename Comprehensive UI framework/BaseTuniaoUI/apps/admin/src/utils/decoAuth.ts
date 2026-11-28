import { appConfig } from '@/config'
import { storage } from '@/utils/storage'

/**
 * 装修后端凭据
 * - 与后台主登录并行：Mock 登录成功后，用同一账号密码换一个装修后端 token
 * - 只有 VITE_DECO_API_BASE 配置时才启用；未配置时仍走 Mock
 */
const BASE = ((import.meta.env.VITE_DECO_API_BASE as string | undefined) || '').replace(/\/$/, '')
const TOKEN_KEY = 'DECO_TOKEN'

interface DecoLoginResult {
  token: string
  expiresAt: string
  username: string
}

export const hasRemoteDecoApi = (): boolean => BASE !== ''

export const getDecoToken = (): string => storage.get<string>(TOKEN_KEY, '') || ''

export const clearDecoToken = (): void => storage.remove(TOKEN_KEY)

/** 用后台账号密码换装修后端 token；失败时抛出错误，由调用方决定是否阻断 */
export const loginDeco = (username: string, password: string): Promise<DecoLoginResult> =>
  new Promise((resolve, reject) => {
    if (!BASE) {
      reject(new Error('未配置装修后端'))
      return
    }
    uni.request({
      url: `${BASE}/auth/deco-login`,
      method: 'POST',
      data: { username, password },
      timeout: appConfig.timeout,
      header: { 'Content-Type': 'application/json' },
      success: (res) => {
        const body = res.data as { code: number; msg: string; data: DecoLoginResult } | undefined
        if (res.statusCode < 200 || res.statusCode >= 300 || !body) {
          reject(new Error(`装修后端登录失败(${res.statusCode})`))
          return
        }
        if (body.code !== 0 || !body.data?.token) {
          reject(new Error(body.msg || '装修后端登录失败'))
          return
        }
        storage.set(TOKEN_KEY, body.data.token)
        resolve(body.data)
      },
      fail: (error) => reject(new Error(error.errMsg || '装修后端连接失败')),
    })
  })
