import { del, get, post, put } from '@/utils/request'
import type { DeptItem } from './types'

export type DeptPayload = Pick<
  DeptItem,
  'parentId' | 'name' | 'leader' | 'phone' | 'sort' | 'status'
>

export const deptApi = {
  tree: () => get<DeptItem[]>('/system/dept/tree'),
  create: (data: Partial<DeptItem>) => post<DeptItem>('/system/dept', { ...data }),
  update: (id: number, data: Partial<DeptItem>) => put<DeptItem>(`/system/dept/${id}`, { ...data }),
  remove: (id: number) => del<boolean>(`/system/dept/${id}`),
}
