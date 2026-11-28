import type { RoleItem } from '@/api/types'
import { defineMock, MockError } from '../adapter'
import { db } from '../db'
import { hitKeyword, paginate } from '../helper'

defineMock('GET', '/system/role/page', ({ query }) => {
  const roles = db.roles.all()
  const status = query.status
  const filtered = roles
    .filter((role) => {
      const statusMatch =
        status === undefined || status === '' || status === null
          ? true
          : Number(role.status) === Number(status)
      return statusMatch && hitKeyword([role.name, role.code, role.remark], query.keyword)
    })
    .sort((a, b) => a.sort - b.sort)

  return paginate(filtered, query)
})

defineMock('POST', '/system/role', ({ body }) => {
  const roles = db.roles.all()
  const payload = body as Partial<RoleItem>
  if (!payload.name) throw new MockError('角色名称不能为空', 400)
  if (!payload.code) throw new MockError('角色标识不能为空', 400)
  if (roles.some((role) => role.code === payload.code)) {
    throw new MockError('角色标识已存在', 400)
  }

  const created: RoleItem = {
    id: db.roles.nextId(roles),
    name: payload.name!,
    code: payload.code!,
    sort: Number(payload.sort) || roles.length + 1,
    status: (payload.status ?? 1) as RoleItem['status'],
    remark: payload.remark || '',
    menuIds: payload.menuIds || [],
  }
  roles.push(created)
  db.roles.save(roles)
  return created
})

defineMock('PUT', '/system/role/:id', ({ pathParams, body }) => {
  const roles = db.roles.all()
  const id = Number(pathParams.id)
  const index = roles.findIndex((role) => role.id === id)
  if (index === -1) throw new MockError('角色不存在', 404)

  const payload = body as Partial<RoleItem>
  if (payload.code && roles.some((role) => role.code === payload.code && role.id !== id)) {
    throw new MockError('角色标识已存在', 400)
  }
  if (roles[index].code === 'admin' && payload.status === 0) {
    throw new MockError('超级管理员角色不允许停用', 400)
  }

  roles[index] = { ...roles[index], ...payload, id }
  db.roles.save(roles)
  return roles[index]
})

defineMock('DELETE', '/system/role/:id', ({ pathParams }) => {
  const roles = db.roles.all()
  const id = Number(pathParams.id)
  if (id === 1) throw new MockError('超级管理员角色不允许删除', 400)

  const index = roles.findIndex((role) => role.id === id)
  if (index === -1) throw new MockError('角色不存在', 404)

  const usedBy = db.users.all().filter((user) => user.roleIds.includes(id))
  if (usedBy.length) {
    throw new MockError(`该角色已被 ${usedBy.length} 个用户使用，无法删除`, 400)
  }

  roles.splice(index, 1)
  db.roles.save(roles)
  return true
})

defineMock('GET', '/system/role/:id/menus', ({ pathParams }) => {
  const role = db.roles.all().find((item) => item.id === Number(pathParams.id))
  if (!role) throw new MockError('角色不存在', 404)
  return { menuIds: role.menuIds }
})

defineMock('PUT', '/system/role/:id/menus', ({ pathParams, body }) => {
  const roles = db.roles.all()
  const role = roles.find((item) => item.id === Number(pathParams.id))
  if (!role) throw new MockError('角色不存在', 404)

  role.menuIds = (body.menuIds as number[]) || []
  db.roles.save(roles)
  return true
})
