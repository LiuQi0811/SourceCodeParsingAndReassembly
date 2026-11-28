import type { MenuItem } from '@/api/types'

/** 在菜单树里深度优先查找，命中即返回 true */
export const findMenuBy = (menus: MenuItem[], predicate: (menu: MenuItem) => boolean): boolean => {
  for (const menu of menus) {
    if (predicate(menu)) return true
    if (menu.children && menu.children.length && findMenuBy(menu.children, predicate)) {
      return true
    }
  }
  return false
}

/**
 * 页面级权限：路径是否出现在授权菜单树中
 * 只认 type=menu 的节点，目录（catalog）与按钮不算页面
 */
export const hasPagePermission = (menus: MenuItem[], path: string): boolean => {
  if (!path) return true
  return findMenuBy(menus, (menu) => menu.type === 'menu' && menu.path === path)
}

/** 按钮级权限：支持 *:*:* 超管通配 */
export const hasPermission = (perms: string[], code?: string): boolean => {
  if (!code) return true
  return perms.includes('*:*:*') || perms.includes(code)
}
