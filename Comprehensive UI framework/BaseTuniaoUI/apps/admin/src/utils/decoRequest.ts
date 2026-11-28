import { request, ApiError, type RequestOptions } from '@/utils/request'
import { appConfig } from '@/config'
import { getDecoToken } from '@/utils/decoAuth'

/**
 * 装修专用请求通道。
 * - VITE_DECO_API_BASE 为空：继续走内置 Mock（默认，单测 / E2E 不受影响）
 * - 配置后：装修 CRUD 与图片上传直连真实后端；token 由登录时单独换取
 */
const BASE = ((import.meta.env.VITE_DECO_API_BASE as string | undefined) || '').replace(/\/$/, '')

export const decoRequest = async <T>(options: RequestOptions): Promise<T> => {
  if (!BASE) return request<T>(options)

  const method = options.method || 'GET'
  const showError = options.showError !== false
  const token = getDecoToken()

  return new Promise<T>((resolve, reject) => {
    uni.request({
      url: BASE + options.url,
      method,
      data: method === 'GET' ? options.params || {} : options.data || {},
      timeout: appConfig.timeout,
      header: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      success: (res) => {
        const body = res.data as { code: number; msg: string; data: T } | undefined
        if (res.statusCode < 200 || res.statusCode >= 300 || !body) {
          if (showError) {
            uni.showToast({ title: `请求失败(${res.statusCode})`, icon: 'none' })
          }
          reject(new ApiError(`请求失败(${res.statusCode})`, res.statusCode))
          return
        }
        if (body.code === 0) {
          resolve(body.data)
          return
        }
        if (showError) uni.showToast({ title: body.msg || '请求失败', icon: 'none' })
        reject(new ApiError(body.msg || '请求失败', body.code))
      },
      fail: (error) => {
        if (showError) uni.showToast({ title: error.errMsg || '网络连接异常', icon: 'none' })
        reject(new ApiError(error.errMsg || '网络连接异常', 0))
      },
    })
  })
}

export const decoGet = <T>(url: string, params?: Record<string, any>): Promise<T> =>
  decoRequest<T>({ url, method: 'GET', params })

export const decoPost = <T>(
  url: string,
  data?: Record<string, any>,
  options?: Partial<RequestOptions>
): Promise<T> => decoRequest<T>({ url, method: 'POST', data, ...options })

export const decoPut = <T>(url: string, data?: Record<string, any>): Promise<T> =>
  decoRequest<T>({ url, method: 'PUT', data })

export const decoDel = <T>(url: string, params?: Record<string, any>): Promise<T> =>
  decoRequest<T>({ url, method: 'DELETE', params })
