import { appConfig } from '@/config'
import { storage } from '@/utils/storage'
import { mockRequest } from '@/mock'
import type { ApiResponse } from '@/types/http'

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE'

export interface RequestOptions {
  url: string
  method?: HttpMethod
  /** 请求体（POST / PUT 使用） */
  data?: Record<string, any>
  /** 查询参数（GET 使用） */
  params?: Record<string, any>
  /** 额外请求头，Mock 与真实接口都会透传 */
  headers?: Record<string, string>
  /** 是否展示全局 loading */
  loading?: boolean
  /** 失败时是否自动 toast，默认 true */
  showError?: boolean
}

export class ApiError extends Error {
  code: number

  constructor(message: string, code = 500) {
    super(message)
    this.code = code
  }
}

let loadingCount = 0

const openLoading = (): void => {
  if (loadingCount === 0) {
    uni.showLoading({ title: '加载中', mask: true })
  }
  loadingCount += 1
}

const closeLoading = (): void => {
  loadingCount = Math.max(0, loadingCount - 1)
  if (loadingCount === 0) uni.hideLoading()
}

const getToken = (): string => storage.get<string>(appConfig.tokenKey, '') || ''

/** Token 失效：清理本地凭证并广播事件，由 user store 统一处理跳转 */
const handleUnauthorized = (): void => {
  storage.remove(appConfig.tokenKey)
  storage.remove('profile')
  uni.$emit('auth:expired')
}

const readAuthHeader = (): Record<string, string> => {
  const token = getToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

/** 真实接口请求：uni.request 的 Promise 封装 */
const realRequest = <T>(options: RequestOptions): Promise<ApiResponse<T>> => {
  const method = options.method || 'GET'
  return new Promise((resolve, reject) => {
    uni.request({
      url: appConfig.baseURL + options.url,
      method,
      data: method === 'GET' ? options.params || {} : options.data || {},
      timeout: appConfig.timeout,
      header: {
        'Content-Type': 'application/json',
        ...readAuthHeader(),
        ...(options.headers || {}),
        ...(options.data?.header || {}),
      },
      success: (res) => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new ApiError(`请求失败(${res.statusCode})`, res.statusCode))
          return
        }
        resolve(res.data as ApiResponse<T>)
      },
      fail: (err) => {
        reject(new ApiError(err.errMsg || '网络连接异常', 0))
      },
    })
  })
}

/**
 * 统一请求入口
 * - useMock = true 时走内置 Mock，接口地址与真实环境保持一致
 * - 真实环境直接请求 baseURL + url
 * 调用方拿到的永远是被剥掉外层 envelope 的业务数据
 */
export const request = async <T>(options: RequestOptions): Promise<T> => {
  const method = options.method || 'GET'
  const showError = options.showError !== false

  if (options.loading) openLoading()

  try {
    const response = appConfig.useMock
      ? await mockRequest<T>(
          method,
          options.url,
          options.params || {},
          options.data || {},
          options.headers || {}
        )
      : await realRequest<T>(options)

    if (response.code === 0) return response.data

    if (response.code === 401) {
      handleUnauthorized()
      uni.showToast({ title: '登录状态已失效，请重新登录', icon: 'none' })
      throw new ApiError(response.msg, 401)
    }

    if (showError) {
      uni.showToast({ title: response.msg || '请求失败', icon: 'none' })
    }
    throw new ApiError(response.msg || '请求失败', response.code)
  } catch (error) {
    // 网络异常与 HTTP 错误在这里统一提示，业务错误码已在上面提示过
    if (showError) {
      if (error instanceof ApiError) {
        if (error.code === 0) uni.showToast({ title: error.message, icon: 'none' })
      } else {
        const message = (error as Error)?.message || '请求失败'
        uni.showToast({ title: message, icon: 'none' })
      }
    }
    throw error
  } finally {
    if (options.loading) closeLoading()
  }
}

/** GET 快捷方法 */
export const get = <T>(
  url: string,
  params?: Record<string, any>,
  options?: Partial<RequestOptions>
): Promise<T> => request<T>({ url, method: 'GET', params, ...options })

/** POST 快捷方法 */
export const post = <T>(
  url: string,
  data?: Record<string, any>,
  options?: Partial<RequestOptions>
): Promise<T> => request<T>({ url, method: 'POST', data, ...options })

/** PUT 快捷方法 */
export const put = <T>(
  url: string,
  data?: Record<string, any>,
  options?: Partial<RequestOptions>
): Promise<T> => request<T>({ url, method: 'PUT', data, ...options })

/** DELETE 快捷方法 */
export const del = <T>(
  url: string,
  params?: Record<string, any>,
  options?: Partial<RequestOptions>
): Promise<T> => request<T>({ url, method: 'DELETE', params, ...options })
