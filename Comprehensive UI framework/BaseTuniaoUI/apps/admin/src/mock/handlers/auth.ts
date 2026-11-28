import type { LoginForm, LoginResult } from '@/api/types'
import { defineMock, MockError } from '../adapter'
import { accountSeed } from '../data'
import { db } from '../db'
import { createToken, getCurrentUserId } from '../helper'
import { buildProfile } from '../profile'

defineMock('POST', '/auth/login', ({ body }) => {
  const form = body as unknown as LoginForm
  if (!form.username || !form.password) {
    throw new MockError('请输入账号和密码', 400)
  }

  const account = accountSeed[form.username]
  if (!account || account.password !== form.password) {
    throw new MockError('账号或密码错误', 400)
  }

  const user = db.users.all().find((item) => item.id === account.userId)
  if (!user) throw new MockError('用户不存在', 404)
  if (user.status === 0) throw new MockError('该账号已被停用，请联系管理员', 403)

  const result: LoginResult = {
    token: createToken(user.id),
    profile: buildProfile(user.id),
  }
  return result
})

defineMock('GET', '/auth/profile', () => {
  const userId = getCurrentUserId()
  if (!userId) throw new MockError('登录状态已失效', 401)
  return buildProfile(userId)
})

defineMock('POST', '/auth/logout', () => true)
