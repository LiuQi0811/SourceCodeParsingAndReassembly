/**
 * 全局配置
 * 通过 .env 文件切换环境，无需改代码：
 *   VITE_USE_MOCK   true 走内置 Mock，false 走真实接口
 *   VITE_API_BASE   真实接口域名前缀
 */
interface AppConfig {
  /** 系统名称 */
  appName: string
  /** 接口前缀 */
  baseURL: string
  /** 是否使用内置 Mock 数据 */
  useMock: boolean
  /** 请求超时时间(ms) */
  timeout: number
  /** Token 在本地存储中的 key */
  tokenKey: string
  /** 默认分页条数 */
  pageSize: number
  /** 移动端断点(px) */
  mobileBreakpoint: number
}

const env = import.meta.env as Record<string, string | undefined>

const boolValue = (value: string | undefined, fallback: boolean): boolean => {
  if (value === undefined || value === '') return fallback
  return value === 'true' || value === '1'
}

export const appConfig: AppConfig = {
  appName: env.VITE_APP_TITLE || '图鸟系统管理',
  baseURL: env.VITE_API_BASE || 'https://api.tuniao.example.com',
  useMock: boolValue(env.VITE_USE_MOCK, true),
  timeout: 15000,
  tokenKey: 'BTN_ACCESS_TOKEN',
  pageSize: 10,
  mobileBreakpoint: 768,
}

/** 本地存储统一前缀 */
export const STORAGE_PREFIX = 'BTN_'
