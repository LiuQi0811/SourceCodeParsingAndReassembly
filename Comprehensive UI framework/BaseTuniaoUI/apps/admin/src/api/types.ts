/** 通用状态：0 停用 / 1 启用 */
export type StatusValue = 0 | 1

export interface UserItem {
  id: number
  username: string
  nickname: string
  deptId: number
  deptName: string
  roleIds: number[]
  roleNames: string
  phone: string
  email: string
  status: StatusValue
  createTime: string
  avatar?: string
}

export interface RoleItem {
  id: number
  name: string
  code: string
  sort: number
  status: StatusValue
  remark: string
  menuIds: number[]
}

export type MenuType = 'catalog' | 'menu' | 'button'

export interface MenuItem {
  id: number
  parentId: number
  name: string
  type: MenuType
  path: string
  icon: string
  perms: string
  sort: number
  visible: boolean
  status: StatusValue
  children?: MenuItem[]
}

export interface DeptItem {
  id: number
  parentId: number
  name: string
  leader: string
  phone: string
  sort: number
  status: StatusValue
  children?: DeptItem[]
}

export interface DictTypeItem {
  id: number
  name: string
  code: string
  status: StatusValue
  remark: string
  createTime: string
}

export interface DictDataItem {
  id: number
  typeCode: string
  label: string
  value: string
  sort: number
  status: StatusValue
  tagType: '' | 'primary' | 'success' | 'warning' | 'danger'
}

export interface LogItem {
  id: number
  username: string
  module: string
  action: string
  method: string
  ip: string
  status: StatusValue
  costMs: number
  createTime: string
  params: string
}

export interface LoginForm {
  username: string
  password: string
}

export interface UserProfile {
  id: number
  username: string
  nickname: string
  avatar: string
  deptName: string
  roleNames: string
  /** 当前账号拥有的角色 id，用于判断「刚被改动的角色是否影响自己」 */
  roleIds: number[]
  perms: string[]
  menus: MenuItem[]
}

export interface LoginResult {
  token: string
  profile: UserProfile
}

export interface DashboardSummary {
  userTotal: number
  roleTotal: number
  todayLogin: number
  logTotal: number
  trend: { label: string; value: number }[]
  recent: LogItem[]
}

/** 分页查询通用参数 */
export interface ListQuery {
  pageNum: number
  pageSize: number
  keyword?: string
  status?: StatusValue | ''
}
