import { describe, expect, it } from 'vitest'
import { findMenuBy, hasPagePermission, hasPermission } from '@/utils/permission'
import type { MenuItem } from '@/api/types'

const menu = (
  id: number,
  type: MenuItem['type'],
  path: string,
  children?: MenuItem[]
): MenuItem => ({
  id,
  parentId: 0,
  name: `menu-${id}`,
  type,
  path,
  icon: '',
  perms: '',
  sort: 0,
  visible: true,
  status: 1,
  children,
})

const menus: MenuItem[] = [
  menu(1, 'menu', '/pages/home/index'),
  menu(2, 'catalog', '/system', [
    menu(21, 'menu', '/pages/system/user/index', [
      menu(211, 'button', '', []),
      menu(212, 'menu', '/pages/system/user/detail/index'),
    ]),
    menu(22, 'catalog', '/system/role', [menu(221, 'menu', '/pages/system/role/index')]),
  ]),
]

describe('hasPagePermission', () => {
  it('命中深层菜单', () => {
    expect(hasPagePermission(menus, '/pages/system/user/index')).toBe(true)
    expect(hasPagePermission(menus, '/pages/system/user/detail/index')).toBe(true)
    expect(hasPagePermission(menus, '/pages/system/role/index')).toBe(true)
  })

  it('路径不在授权树内则拒绝', () => {
    expect(hasPagePermission(menus, '/pages/system/dict/index')).toBe(false)
    expect(hasPagePermission(menus, '/pages/system/user/index2')).toBe(false)
  })

  it('目录路径不算页面权限', () => {
    expect(hasPagePermission(menus, '/system')).toBe(false)
    expect(hasPagePermission(menus, '/system/role')).toBe(false)
  })

  it('空路径视为无需校验', () => {
    expect(hasPagePermission(menus, '')).toBe(true)
  })

  it('空菜单树一律拒绝非空路径', () => {
    expect(hasPagePermission([], '/pages/home/index')).toBe(false)
  })
})

describe('hasPermission', () => {
  it('超管通配 *:*:* 放行任意按钮权限', () => {
    expect(hasPermission(['*:*:*'], 'system:user:delete')).toBe(true)
  })

  it('精确匹配才放行', () => {
    expect(hasPermission(['system:user:add'], 'system:user:add')).toBe(true)
    expect(hasPermission(['system:user:add'], 'system:user:delete')).toBe(false)
  })

  it('未声明权限码时默认放行', () => {
    expect(hasPermission([], undefined)).toBe(true)
    expect(hasPermission([], '')).toBe(true)
  })

  it('空权限列表拒绝具体权限码', () => {
    expect(hasPermission([], 'system:user:add')).toBe(false)
  })
})

describe('findMenuBy', () => {
  it('找到即返回 true，找不到返回 false', () => {
    expect(findMenuBy(menus, (m) => m.id === 212)).toBe(true)
    expect(findMenuBy(menus, (m) => m.id === 999)).toBe(false)
  })
})
