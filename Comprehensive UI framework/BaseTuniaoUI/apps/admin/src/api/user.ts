import { del, get, post, put } from '@/utils/request'
import type { PageResult } from '@/types/http'
import type { StatusValue, UserItem } from './types'

export interface UserQuery {
  pageNum: number
  pageSize: number
  keyword?: string
  status?: StatusValue | ''
}

export type UserPayload = Pick<
  UserItem,
  'username' | 'nickname' | 'deptId' | 'roleIds' | 'phone' | 'email' | 'status'
>

export const userApi = {
  page: (query: UserQuery) =>
    get<PageResult<UserItem>>('/system/user/page', query as Record<string, any>),
  create: (data: UserPayload) => post<UserItem>('/system/user', { ...data }),
  update: (id: number, data: UserPayload) => put<UserItem>(`/system/user/${id}`, { ...data }),
  remove: (id: number) => del<boolean>(`/system/user/${id}`),
  setStatus: (id: number, status: StatusValue) =>
    put<UserItem>(`/system/user/${id}/status`, { status }),
}
