import { del, get, post, put } from '@/utils/request'
import type { PageResult } from '@/types/http'
import type { DictDataItem, DictTypeItem, StatusValue } from './types'

export interface DictTypeQuery {
  pageNum: number
  pageSize: number
  keyword?: string
  status?: StatusValue | ''
}

export interface DictDataQuery {
  pageNum: number
  pageSize: number
  typeCode: string
  keyword?: string
  status?: StatusValue | ''
}

export const dictApi = {
  /** 字典类型 */
  typePage: (query: DictTypeQuery) =>
    get<PageResult<DictTypeItem>>('/system/dict/type/page', query as Record<string, any>),
  typeCreate: (data: Partial<DictTypeItem>) => post<DictTypeItem>('/system/dict/type', { ...data }),
  typeUpdate: (id: number, data: Partial<DictTypeItem>) =>
    put<DictTypeItem>(`/system/dict/type/${id}`, { ...data }),
  typeRemove: (id: number) => del<boolean>(`/system/dict/type/${id}`),

  /** 字典数据 */
  dataPage: (query: DictDataQuery) =>
    get<PageResult<DictDataItem>>('/system/dict/data/page', query as Record<string, any>),
  dataCreate: (data: Partial<DictDataItem>) => post<DictDataItem>('/system/dict/data', { ...data }),
  dataUpdate: (id: number, data: Partial<DictDataItem>) =>
    put<DictDataItem>(`/system/dict/data/${id}`, { ...data }),
  dataRemove: (id: number) => del<boolean>(`/system/dict/data/${id}`),
}
