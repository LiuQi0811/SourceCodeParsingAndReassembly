import { storage } from '@/utils/storage'

/**
 * Mock 业务数据的英文层
 *
 * 种子数据本身只存中文（它同时是新增/编辑后的真实数据），这里的职责是：
 * 当前语言是 en-US 时，把接口返回体拷一份，按「中文原值 → 英文译文」查表翻译后再吐给页面。
 * 之所以不把译文存进 db：一旦写回，切回中文就会看到英文，数据也就被污染了。
 * 表里查不到的文案（用户自己输入的菜单名、角色名等）原样保留。
 */

const NAME_MAP: Record<string, string> = {
  // 菜单
  工作台: 'Dashboard',
  系统管理: 'System',
  用户管理: 'Users',
  角色管理: 'Roles',
  菜单管理: 'Menus',
  部门管理: 'Departments',
  字典管理: 'Dictionaries',
  操作日志: 'Operation Logs',
  小程序运营: 'Mini Program',
  页面装修: 'Page Builder',
  保存草稿: 'Save Draft',
  发布页面: 'Publish Page',
  用户新增: 'User Add',
  用户编辑: 'User Edit',
  用户删除: 'User Delete',
  角色新增: 'Role Add',
  角色编辑: 'Role Edit',
  角色删除: 'Role Delete',
  菜单授权: 'Menu Authorization',
  菜单新增: 'Menu Add',
  菜单编辑: 'Menu Edit',
  菜单删除: 'Menu Delete',
  部门新增: 'Department Add',
  部门编辑: 'Department Edit',
  部门删除: 'Department Delete',
  字典新增: 'Dictionary Add',
  字典编辑: 'Dictionary Edit',
  字典删除: 'Dictionary Delete',
  日志导出: 'Log Export',
  // 部门
  图鸟科技: 'Tuniao Tech',
  技术研发部: 'R&D Department',
  前端组: 'Frontend Team',
  后端组: 'Backend Team',
  产品设计部: 'Product Design',
  运营中心: 'Operations Center',
  // 角色
  超级管理员: 'Super Admin',
  系统管理员: 'System Admin',
  运维人员: 'Operator',
  访客: 'Guest',
  // 字典类型
  用户性别: 'User Gender',
  通用状态: 'Common Status',
  通知类型: 'Notice Type',
  操作类型: 'Operation Type',
}

const DEPT_MAP: Record<string, string> = {
  图鸟科技: 'Tuniao Tech',
  技术研发部: 'R&D Department',
  前端组: 'Frontend Team',
  后端组: 'Backend Team',
  产品设计部: 'Product Design',
  运营中心: 'Operations Center',
}

const ROLE_MAP: Record<string, string> = {
  超级管理员: 'Super Admin',
  系统管理员: 'System Admin',
  运维人员: 'Operator',
  访客: 'Guest',
}

const REMARK_MAP: Record<string, string> = {
  // 角色说明
  拥有全部菜单与按钮权限: 'Full menu and button permissions',
  '可维护用户、角色与字典': 'Manage users, roles and dictionaries',
  只读查看日志与菜单: 'Read-only access to logs and menus',
  仅可查看工作台: 'Dashboard only',
  // 字典类型说明
  用户性别列表: 'Gender options',
  '启用 / 停用状态': 'Enabled / disabled status',
  站内通知分类: 'In-app notice categories',
  '日志操作分类（已停用）': 'Operation categories (disabled)',
}

const DICT_LABEL_MAP: Record<string, string> = {
  男: 'Male',
  女: 'Female',
  启用: 'Enabled',
  停用: 'Disabled',
  系统公告: 'System Notice',
  版本更新: 'Version Update',
  新增: 'Create',
  修改: 'Update',
  删除: 'Delete',
}

const LOG_MODULE_MAP: Record<string, string> = {
  用户管理: 'Users',
  角色管理: 'Roles',
  菜单管理: 'Menus',
  字典管理: 'Dictionaries',
  部门管理: 'Departments',
  登录认证: 'Sign-in',
}

const LOG_ACTION_MAP: Record<string, string> = {
  新增: 'Create',
  修改: 'Update',
  删除: 'Delete',
  查询: 'Query',
  导出: 'Export',
  登录: 'Sign-in',
}

const translate = (map: Record<string, string>, value: string): string => map[value] ?? value

/** 角色名是「、」拼起来的，英文换成逗号；未分配角色单独处理 */
const translateRoleNames = (value: string): string => {
  if (!value) return value
  return value
    .split('、')
    .map((name) => translate(ROLE_MAP, name))
    .join(', ')
}

/** 只翻译这几个字段，其余（账号、昵称、手机号、路径、权限码）保持原样 */
const FIELD_TRANSLATORS: Record<string, (value: string) => string> = {
  name: (value) => translate(NAME_MAP, value),
  deptName: (value) => translate(DEPT_MAP, value),
  roleNames: translateRoleNames,
  label: (value) => translate(DICT_LABEL_MAP, value),
  remark: (value) => translate(REMARK_MAP, value),
  module: (value) => translate(LOG_MODULE_MAP, value),
  action: (value) => translate(LOG_ACTION_MAP, value),
}

/** 深拷贝 + 翻译：返回新对象，绝不改写 db 里的原始数据 */
const localizeNode = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(localizeNode)
  if (value && typeof value === 'object') {
    const result: Record<string, unknown> = {}
    Object.entries(value as Record<string, unknown>).forEach(([key, item]) => {
      if (typeof item === 'string' && FIELD_TRANSLATORS[key]) {
        result[key] = FIELD_TRANSLATORS[key](item)
      } else {
        result[key] = localizeNode(item)
      }
    })
    return result
  }
  return value
}

const isEnglish = (): boolean => storage.get<string>('locale', 'zh-CN') === 'en-US'

/** Mock 抛出的业务错误提示：真实后端会按 Accept-Language 返回，这里给 Mock 补一份英文 */
const MESSAGE_MAP: Record<string, string> = {
  用户不存在: 'User not found',
  '该账号已被停用，请联系管理员': 'This account is disabled, please contact the administrator',
  账号不能为空: 'Username is required',
  账号已存在: 'Username already exists',
  账号或密码错误: 'Incorrect username or password',
  请输入账号和密码: 'Username and password are required',
  登录状态已失效: 'Login session expired',
  超级管理员账号不允许停用: 'The super admin account cannot be disabled',
  超级管理员账号不允许删除: 'The super admin account cannot be deleted',
  部门名称不能为空: 'Department name is required',
  部门不存在: 'Department not found',
  上级部门不能选择自己: 'A department cannot be its own parent',
  '存在下级部门，请先删除下级部门': 'Delete the sub-departments first',
  '该部门下存在用户，无法删除': 'This department still has users',
  角色名称不能为空: 'Role name is required',
  角色标识不能为空: 'Role key is required',
  角色标识已存在: 'Role key already exists',
  角色不存在: 'Role not found',
  超级管理员角色不允许停用: 'The super admin role cannot be disabled',
  超级管理员角色不允许删除: 'The super admin role cannot be deleted',
  菜单名称不能为空: 'Menu name is required',
  菜单不存在: 'Menu not found',
  上级菜单不能选择自己: 'A menu cannot be its own parent',
  字典名称不能为空: 'Dictionary name is required',
  字典编码不能为空: 'Dictionary code is required',
  字典编码已存在: 'Dictionary code already exists',
  字典类型不存在: 'Dictionary type not found',
  请先选择字典类型: 'Select a dictionary type first',
  字典标签不能为空: 'Dictionary label is required',
  字典数据不存在: 'Dictionary entry not found',
  '这是一个故意抛出的演示错误，用于验证统一错误提示':
    'A demo error for verifying the unified error toast',
}

/** 「该角色已被 N 个用户使用，无法删除」这类带变量的提示单独匹配 */
const ROLE_IN_USE = /^该角色已被 (\d+) 个用户使用，无法删除$/

/**
 * 翻译 Mock 的业务错误提示
 * 未登记的文案原样返回（Mock 接口未定义等开发期提示保留中文，方便排查）
 */
export const localizeMockMessage = (message: string): string => {
  if (!isEnglish() || !message) return message
  const matched = message.match(ROLE_IN_USE)
  if (matched) return `This role is assigned to ${matched[1]} user(s) and cannot be deleted`
  return translate(MESSAGE_MAP, message)
}

/** 中文环境直接返回原引用，不产生任何拷贝开销 */
export const localizeMockData = <T>(data: T): T => {
  if (!isEnglish() || data === null || data === undefined) return data
  return localizeNode(data) as T
}
