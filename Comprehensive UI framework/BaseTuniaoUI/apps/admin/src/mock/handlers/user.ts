import { formatDateTime } from '@/utils/format'
import type { UserItem } from '@/api/types'
import { defineMock, MockError } from '../adapter'
import { db } from '../db'
import { hitKeyword, paginate } from '../helper'

/** 补齐部门名与角色名，保持列表展示一致 */
const fillRelations = (payload: Partial<UserItem>): Partial<UserItem> => {
  const depts = db.depts.all()
  const roles = db.roles.all()
  const roleIds = payload.roleIds || []
  return {
    ...payload,
    deptName: depts.find((dept) => dept.id === payload.deptId)?.name || '',
    roleNames: roles
      .filter((role) => roleIds.includes(role.id))
      .map((role) => role.name)
      .join('、'),
  }
}

defineMock('GET', '/system/user/page', ({ query }) => {
  const users = db.users.all()
  const keyword = query.keyword as string
  const status = query.status

  const filtered = users
    .filter((user) => {
      const statusMatch =
        status === undefined || status === '' || status === null
          ? true
          : Number(user.status) === Number(status)
      return (
        statusMatch &&
        hitKeyword([user.username, user.nickname, user.phone, user.deptName], keyword)
      )
    })
    .sort((a, b) => b.createTime.localeCompare(a.createTime))

  return paginate(filtered, query)
})

defineMock('POST', '/system/user', ({ body }) => {
  const users = db.users.all()
  const payload = body as Partial<UserItem>

  if (!payload.username) throw new MockError('账号不能为空', 400)
  if (users.some((user) => user.username === payload.username)) {
    throw new MockError('账号已存在', 400)
  }

  const created: UserItem = {
    id: db.users.nextId(users),
    username: payload.username!,
    nickname: payload.nickname || payload.username!,
    deptId: Number(payload.deptId) || 0,
    deptName: '',
    roleIds: payload.roleIds || [],
    roleNames: '',
    phone: payload.phone || '',
    email: payload.email || '',
    status: (payload.status ?? 1) as UserItem['status'],
    createTime: formatDateTime(),
    ...fillRelations(payload),
  } as UserItem

  users.push(created)
  db.users.save(users)
  return created
})

defineMock('PUT', '/system/user/:id', ({ pathParams, body }) => {
  const users = db.users.all()
  const id = Number(pathParams.id)
  const index = users.findIndex((user) => user.id === id)
  if (index === -1) throw new MockError('用户不存在', 404)

  const payload = body as Partial<UserItem>
  if (
    payload.username &&
    users.some((user) => user.username === payload.username && user.id !== id)
  ) {
    throw new MockError('账号已存在', 400)
  }

  const updated: UserItem = {
    ...users[index],
    ...payload,
    id,
    ...fillRelations(payload),
  } as UserItem

  users[index] = updated
  db.users.save(users)
  return updated
})

defineMock('PUT', '/system/user/:id/status', ({ pathParams, body }) => {
  const users = db.users.all()
  const id = Number(pathParams.id)
  const target = users.find((user) => user.id === id)
  if (!target) throw new MockError('用户不存在', 404)
  if (id === 1 && Number(body.status) === 0) {
    throw new MockError('超级管理员账号不允许停用', 400)
  }
  target.status = Number(body.status) as UserItem['status']
  db.users.save(users)
  return target
})

defineMock('DELETE', '/system/user/:id', ({ pathParams }) => {
  const users = db.users.all()
  const id = Number(pathParams.id)
  if (id === 1) throw new MockError('超级管理员账号不允许删除', 400)
  const index = users.findIndex((user) => user.id === id)
  if (index === -1) throw new MockError('用户不存在', 404)
  users.splice(index, 1)
  db.users.save(users)
  return true
})
