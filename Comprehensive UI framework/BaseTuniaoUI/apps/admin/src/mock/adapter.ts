import type { ApiResponse } from '@/types/http'
import { localizeMockData, localizeMockMessage } from './i18n'

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE'

export interface MockContext {
  url: string
  method: HttpMethod
  /** 路径参数，如 /system/user/:id 中的 id */
  pathParams: Record<string, string>
  /** 查询参数 */
  query: Record<string, any>
  /** 请求体 */
  body: Record<string, any>
  /** 请求头（装修 Mock 用它区分多个小程序应用） */
  headers: Record<string, string>
}

type MockHandler = (ctx: MockContext) => unknown | Promise<unknown>

interface MockRoute {
  method: HttpMethod
  segments: string[]
  handler: MockHandler
}

/** Mock 业务异常：用于返回非 0 的业务错误码 */
export class MockError extends Error {
  code: number

  constructor(msg: string, code = 500) {
    super(msg)
    this.name = 'MockError'
    this.code = code
  }
}

const routes: MockRoute[] = []

const splitUrl = (url: string): string[] => {
  const path = url.split('?')[0].split('#')[0]
  return path.split('/').filter((s) => s !== '')
}

/**
 * 注册一个 Mock 接口
 * 支持 :id 形式的路径参数
 */
export const defineMock = (method: HttpMethod, url: string, handler: MockHandler): void => {
  routes.push({
    method,
    segments: splitUrl(url),
    handler,
  })
}

const matchRoute = (
  method: HttpMethod,
  url: string
): { route: MockRoute; pathParams: Record<string, string> } | null => {
  const segments = splitUrl(url)
  for (const route of routes) {
    if (route.method !== method) continue
    if (route.segments.length !== segments.length) continue
    const pathParams: Record<string, string> = {}
    let matched = true
    for (let i = 0; i < route.segments.length; i++) {
      const pattern = route.segments[i]
      const actual = segments[i]
      if (pattern.startsWith(':')) {
        pathParams[pattern.slice(1)] = actual
      } else if (pattern !== actual) {
        matched = false
        break
      }
    }
    if (matched) return { route, pathParams }
  }
  return null
}

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * 执行 Mock 请求，返回统一响应结构
 * 使用 mock 时与真实接口保持完全一致的调用体验
 */
export const mockRequest = async <T>(
  method: HttpMethod,
  url: string,
  query: Record<string, any> = {},
  body: Record<string, any> = {},
  headers: Record<string, string> = {}
): Promise<ApiResponse<T>> => {
  const matched = matchRoute(method, url)
  // 模拟网络耗时，便于观察 loading / 骨架屏
  await delay(140 + Math.floor(Math.random() * 180))

  if (!matched) {
    return {
      code: 404,
      msg: `Mock 接口未定义：${method} ${url}`,
      data: null as unknown as T,
    }
  }

  try {
    const result = await matched.route.handler({
      url,
      method,
      pathParams: matched.pathParams,
      query,
      body,
      headers,
    })
    return {
      code: 0,
      msg: 'ok',
      data: localizeMockData(result) as T,
    }
  } catch (error) {
    const err = error as MockError
    return {
      code: err.code || 500,
      msg: localizeMockMessage(err.message || 'Mock 处理异常'),
      data: null as unknown as T,
    }
  }
}
