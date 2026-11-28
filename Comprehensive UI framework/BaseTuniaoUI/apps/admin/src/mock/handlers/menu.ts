import type { MenuItem } from '@/api/types'
import { collectTreeIds, listToTree } from '@/utils/tree'
import { defineMock, MockError } from '../adapter'
import { db } from '../db'

defineMock('GET', '/system/menu/tree', () => {
  return listToTree(db.menus.all())
})

defineMock('POST', '/system/menu', ({ body }) => {
  const menus = db.menus.all()
  const payload = body as Partial<MenuItem>
  if (!payload.name) throw new MockError('菜单名称不能为空', 400)

  const created: MenuItem = {
    id: db.menus.nextId(menus),
    parentId: Number(payload.parentId) || 0,
    name: payload.name!,
    type: payload.type || 'menu',
    path: payload.path || '',
    icon: payload.icon || '',
    perms: payload.perms || '',
    sort: Number(payload.sort) || menus.length + 1,
    visible: payload.visible ?? true,
    status: (payload.status ?? 1) as MenuItem['status'],
  }

  menus.push(created)
  db.menus.save(menus)
  return created
})

defineMock('PUT', '/system/menu/:id', ({ pathParams, body }) => {
  const menus = db.menus.all()
  const id = Number(pathParams.id)
  const index = menus.findIndex((menu) => menu.id === id)
  if (index === -1) throw new MockError('菜单不存在', 404)

  const payload = body as Partial<MenuItem>
  if (payload.parentId === id) throw new MockError('上级菜单不能选择自己', 400)

  menus[index] = { ...menus[index], ...payload, id }
  db.menus.save(menus)
  return menus[index]
})

defineMock('DELETE', '/system/menu/:id', ({ pathParams }) => {
  const menus = db.menus.all()
  const id = Number(pathParams.id)
  const target = menus.find((menu) => menu.id === id)
  if (!target) throw new MockError('菜单不存在', 404)

  // 级联删除子菜单与按钮，避免出现孤儿节点
  const tree = listToTree(menus)
  const node = tree.find((item) => item.id === id)
  const removeIds = node ? collectTreeIds(node) : [id]

  db.menus.save(menus.filter((menu) => !removeIds.includes(menu.id)))
  return true
})
