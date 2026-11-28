import { trendSeed } from '../data'
import { defineMock, MockError } from '../adapter'
import { db } from '../db'
import { hitKeyword, paginate } from '../helper'

defineMock('GET', '/system/log/page', ({ query }) => {
  const logs = db.logs.all()
  const status = query.status
  const filtered = logs
    .filter((log) => {
      const statusMatch =
        status === undefined || status === '' || status === null
          ? true
          : Number(log.status) === Number(status)
      return (
        statusMatch && hitKeyword([log.username, log.module, log.action, log.ip], query.keyword)
      )
    })
    .sort((a, b) => b.createTime.localeCompare(a.createTime))
  return paginate(filtered, query)
})

defineMock('DELETE', '/system/log', () => {
  if (db.logs.all().length === 0) return true
  db.logs.save([])
  return true
})

defineMock('GET', '/dashboard/summary', () => {
  const users = db.users.all()
  const logs = db.logs.all()
  return {
    userTotal: users.length,
    roleTotal: db.roles.all().length,
    todayLogin: logs.filter((log) => log.action === '登录').length + 26,
    logTotal: logs.length,
    trend: trendSeed,
    recent: logs.slice(0, 6),
  }
})

defineMock('POST', '/system/log/error-demo', () => {
  throw new MockError('这是一个故意抛出的演示错误，用于验证统一错误提示', 400)
})
