import { del, get } from '@/utils/request'
import type { PageResult } from '@/types/http'
import type { LogItem, StatusValue } from './types'

export interface LogQuery {
  pageNum: number
  pageSize: number
  keyword?: string
  status?: StatusValue | ''
}

export const logApi = {
  page: (query: LogQuery) =>
    get<PageResult<LogItem>>('/system/log/page', query as Record<string, any>),
  clear: () => del<boolean>('/system/log'),
}
