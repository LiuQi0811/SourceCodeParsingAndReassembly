import type { DeptItem } from '@/api/types'
import { listToTree } from '@/utils/tree'
import { defineMock, MockError } from '../adapter'
import { db } from '../db'

defineMock('GET', '/system/dept/tree', () => listToTree(db.depts.all()))

defineMock('POST', '/system/dept', ({ body }) => {
  const depts = db.depts.all()
  const payload = body as Partial<DeptItem>
  if (!payload.name) throw new MockError('部门名称不能为空', 400)

  const created: DeptItem = {
    id: db.depts.nextId(depts),
    parentId: Number(payload.parentId) || 0,
    name: payload.name!,
    leader: payload.leader || '',
    phone: payload.phone || '',
    sort: Number(payload.sort) || depts.length + 1,
    status: (payload.status ?? 1) as DeptItem['status'],
  }

  depts.push(created)
  db.depts.save(depts)
  return created
})

defineMock('PUT', '/system/dept/:id', ({ pathParams, body }) => {
  const depts = db.depts.all()
  const id = Number(pathParams.id)
  const index = depts.findIndex((dept) => dept.id === id)
  if (index === -1) throw new MockError('部门不存在', 404)

  const payload = body as Partial<DeptItem>
  if (payload.parentId === id) throw new MockError('上级部门不能选择自己', 400)

  depts[index] = { ...depts[index], ...payload, id }
  db.depts.save(depts)
  return depts[index]
})

defineMock('DELETE', '/system/dept/:id', ({ pathParams }) => {
  const depts = db.depts.all()
  const id = Number(pathParams.id)
  if (!depts.some((dept) => dept.id === id)) throw new MockError('部门不存在', 404)

  const hasChildren = depts.some((dept) => dept.parentId === id)
  if (hasChildren) throw new MockError('存在下级部门，请先删除下级部门', 400)

  const hasUsers = db.users.all().some((user) => user.deptId === id)
  if (hasUsers) throw new MockError('该部门下存在用户，无法删除', 400)

  db.depts.save(depts.filter((dept) => dept.id !== id))
  return true
})
