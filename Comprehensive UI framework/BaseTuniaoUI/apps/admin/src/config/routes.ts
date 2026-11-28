/**
 * 已注册页面的单一来源
 *
 * 与 src/pages.json 的 pages 列表保持一致：
 * 在 pages.json 新增/删除页面后，务必同步这里，菜单管理用它做路径校验。
 */
export const REGISTERED_PAGES = [
  '/pages/login/index',
  '/pages/home/index',
  '/pages/system/user/index',
  '/pages/system/role/index',
  '/pages/system/menu/index',
  '/pages/system/dept/index',
  '/pages/system/dict/index',
  '/pages/system/log/index',
  '/pages/operation/deco/index',
] as const

/** 归一化路径：补前导斜杠、去掉查询串与末尾多余斜杠 */
const normalize = (path: string): string => {
  const value = (path || '').trim().split('?')[0].replace(/\/+$/, '')
  if (!value) return ''
  return value.startsWith('/') ? value : `/${value}`
}

/** 是否为已注册的页面路由（仅对 type=menu 的路径有意义） */
export const isRegisteredPage = (path: string): boolean => {
  const value = normalize(path)
  if (!value) return false
  return (REGISTERED_PAGES as readonly string[]).includes(value)
}

/** 是否为页面级路径（以 /pages/ 开头），目录（如 /system）不算页面 */
export const isPagePath = (path: string): boolean => normalize(path).startsWith('/pages/')
