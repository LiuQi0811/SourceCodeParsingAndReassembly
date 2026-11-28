import { del, get, post, put } from '@/utils/request'
import type { MenuItem } from './types'

export const menuApi = {
  tree: () => get<MenuItem[]>('/system/menu/tree'),
  create: (data: Partial<MenuItem>) => post<MenuItem>('/system/menu', { ...data }),
  update: (id: number, data: Partial<MenuItem>) => put<MenuItem>(`/system/menu/${id}`, { ...data }),
  remove: (id: number) => del<boolean>(`/system/menu/${id}`),
}
