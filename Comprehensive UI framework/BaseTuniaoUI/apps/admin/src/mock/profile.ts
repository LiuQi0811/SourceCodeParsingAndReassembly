import { listToTree } from '@/utils/tree'
import type { UserProfile } from '@/api/types'
import { MockError } from './adapter'
import { db } from './db'

/** 根据用户 id 组装登录态信息：资料 + 菜单树 + 按钮权限 */
export const buildProfile = (userId: number): UserProfile => {
  const user = db.users.all().find((item) => item.id === userId)
  if (!user) throw new MockError('用户不存在', 404)
  if (user.status === 0) throw new MockError('该账号已被停用，请联系管理员', 403)

  const roles = db.roles.all().filter((role) => user.roleIds.includes(role.id))
  const menus = db.menus.all()
  const isAdmin = roles.some((role) => role.code === 'admin')

  const grantedIds = isAdmin
    ? menus.map((menu) => menu.id)
    : Array.from(new Set(roles.flatMap((role) => role.menuIds)))

  const visibleMenus = menus.filter(
    (menu) =>
      grantedIds.includes(menu.id) && menu.type !== 'button' && menu.status === 1 && menu.visible
  )

  const perms = isAdmin
    ? ['*:*:*']
    : menus
        .filter((menu) => grantedIds.includes(menu.id) && menu.type === 'button' && menu.perms)
        .map((menu) => menu.perms)

  return {
    id: user.id,
    username: user.username,
    nickname: user.nickname,
    avatar: user.avatar || '',
    deptName: user.deptName,
    roleNames: roles.map((role) => role.name).join('、') || '未分配角色',
    roleIds: roles.map((role) => role.id),
    perms,
    menus: listToTree(visibleMenus),
  }
}
