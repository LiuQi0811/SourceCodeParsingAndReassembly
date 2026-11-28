import { appConfig } from '@/config'
import { storage } from '@/utils/storage'
import type { PageResult } from '@/types/http'

export interface PageQueryParams {
  pageNum?: number | string
  pageSize?: number | string
}

/** 通用分页 */
export const paginate = <T>(list: T[], query: PageQueryParams): PageResult<T> => {
  const pageNum = Math.max(1, Number(query.pageNum) || 1)
  const pageSize = Math.max(1, Number(query.pageSize) || 10)
  const start = (pageNum - 1) * pageSize
  return {
    list: list.slice(start, start + pageSize),
    total: list.length,
    pageNum,
    pageSize,
  }
}

/** 关键字模糊匹配 */
export const hitKeyword = (
  fields: Array<string | number | undefined | null>,
  keyword?: string
): boolean => {
  if (!keyword) return true
  const kw = String(keyword).trim().toLowerCase()
  if (!kw) return true
  return fields.some((field) =>
    String(field ?? '')
      .toLowerCase()
      .includes(kw)
  )
}

export const createToken = (userId: number): string =>
  `mock-token.${userId}.${Date.now().toString(36)}`

/** 从本地 token 反解 userId，模拟真实后端的鉴权解析 */
export const getCurrentUserId = (): number => {
  const token = storage.get<string>(appConfig.tokenKey, '') || ''
  const match = token.match(/mock-token\.(\d+)\./)
  return match ? Number(match[1]) : 0
}
