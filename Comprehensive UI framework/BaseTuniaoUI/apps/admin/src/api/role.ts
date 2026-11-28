import { del, get, post, put } from '@/utils/request'
import type { PageResult } from '@/types/http'
import type { RoleItem, StatusValue } from './types'

export interface RoleQuery {
  pageNum: number
  pageSize: number
  keyword?: string
  status?: StatusValue | ''
}

export type RolePayload = Pick<RoleItem, 'name' | 'code' | 'sort' | 'status' | 'remark'>

export const roleApi = {
  page: (query: RoleQuery) =>
    get<PageResult<RoleItem>>('/system/role/page', query as Record<string, any>),
  create: (data: RolePayload) => post<RoleItem>('/system/role', { ...data }),
  update: (id: number, data: RolePayload) => put<RoleItem>(`/system/role/${id}`, { ...data }),
  remove: (id: number) => del<boolean>(`/system/role/${id}`),
  /** 获取角色已授权的菜单 id 集合 */
  getMenuIds: (id: number) => get<{ menuIds: number[] }>(`/system/role/${id}/menus`),
  /** 保存角色菜单授权 */
  updateMenuIds: (id: number, menuIds: number[]) =>
    put<boolean>(`/system/role/${id}/menus`, { menuIds }),
}
