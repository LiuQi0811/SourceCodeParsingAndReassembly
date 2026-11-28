import { beforeEach, describe, expect, it, vi } from 'vitest'
import { localizeMockData, localizeMockMessage } from './i18n'
import { storage } from '@/utils/storage'
import { get, post } from '@/utils/request'
import type { DeptItem, LogItem, MenuItem, UserItem } from '@/api/types'

const memory = new Map<string, string>()

const uniStub = {
  getStorageSync: (key: string) => memory.get(key) ?? '',
  setStorageSync: (key: string, value: string) => memory.set(key, value),
  removeStorageSync: (key: string) => memory.delete(key),
  clearStorageSync: () => memory.clear(),
  showLoading: vi.fn(),
  hideLoading: vi.fn(),
  showToast: vi.fn(),
  $emit: vi.fn(),
  $on: vi.fn(),
  $off: vi.fn(),
  reLaunch: vi.fn(),
}

vi.stubGlobal('uni', uniStub)

const useLocale = (locale: 'zh-CN' | 'en-US') => storage.set('locale', locale)

beforeEach(() => {
  memory.clear()
  uniStub.showLoading.mockClear()
  uniStub.hideLoading.mockClear()
  uniStub.showToast.mockClear()
  uniStub.$emit.mockClear()
})

describe('Mock 业务数据本地化', () => {
  it('中文环境原样返回，且不额外拷贝', () => {
    useLocale('zh-CN')
    const menus: MenuItem[] = [{ id: 1, parentId: 0, name: '工作台', type: 'menu' } as MenuItem]
    expect(localizeMockData(menus)).toBe(menus)
    expect(menus[0].name).toBe('工作台')
  })

  it('英文环境翻译菜单树，权限码与路径保持原样', () => {
    useLocale('en-US')
    const tree: MenuItem[] = [
      {
        id: 2,
        parentId: 0,
        name: '系统管理',
        type: 'catalog',
        path: '/system',
        perms: '',
        children: [
          {
            id: 3,
            parentId: 2,
            name: '用户管理',
            type: 'menu',
            path: '/pages/system/user/index',
            perms: 'system:user:list',
          } as MenuItem,
        ],
      } as MenuItem,
    ]
    const result = localizeMockData(tree)
    expect(result[0].name).toBe('System')
    expect(result[0].children?.[0].name).toBe('Users')
    expect(result[0].children?.[0].path).toBe('/pages/system/user/index')
    expect(result[0].children?.[0].perms).toBe('system:user:list')
    // 原数组不受影响
    expect(tree[0].name).toBe('系统管理')
  })

  it('用户列表翻译部门名与角色名，账号与昵称不动', () => {
    useLocale('en-US')
    const users: UserItem[] = [
      {
        id: 2,
        username: 'chenmo',
        nickname: '陈默',
        deptId: 2,
        deptName: '技术研发部',
        roleIds: [2],
        roleNames: '系统管理员',
        phone: '13800000002',
        email: 'chenmo@tuniao.com',
        status: 1,
        createTime: '2025-04-08 09:15:22',
      },
    ]
    const result = localizeMockData(users)
    expect(result[0].deptName).toBe('R&D Department')
    expect(result[0].roleNames).toBe('System Admin')
    expect(result[0].nickname).toBe('陈默')
    expect(result[0].username).toBe('chenmo')
  })

  it('多个角色用逗号拼接，未分配角色保持可读', () => {
    useLocale('en-US')
    expect(
      localizeMockData({ roleNames: '超级管理员、运维人员' } as Record<string, string>).roleNames
    ).toBe('Super Admin, Operator')
    expect(localizeMockData({ roleNames: '' }).roleNames).toBe('')
  })

  it('部门树翻译部门名，负责人姓名保持原样', () => {
    useLocale('en-US')
    const depts: DeptItem[] = [
      {
        id: 1,
        parentId: 0,
        name: '图鸟科技',
        leader: '刘奇',
        phone: '',
        sort: 1,
        status: 1,
      } as DeptItem,
    ]
    const result = localizeMockData(depts)
    expect(result[0].name).toBe('Tuniao Tech')
    expect(result[0].leader).toBe('刘奇')
  })

  it('字典标签与说明翻译', () => {
    useLocale('en-US')
    const result = localizeMockData([
      {
        id: 3,
        typeCode: 'sys_common_status',
        label: '启用',
        value: '1',
        sort: 1,
        status: 1,
        tagType: 'success',
      },
      { id: 1, name: '通用状态', code: 'sys_common_status', remark: '启用 / 停用状态', status: 1 },
    ])
    expect(result[0].label).toBe('Enabled')
    expect(result[1].name).toBe('Common Status')
    expect(result[1].remark).toBe('Enabled / disabled status')
  })

  it('日志模块与动作翻译，操作人账号保持原样', () => {
    useLocale('en-US')
    const logs: LogItem[] = [
      {
        id: 1001,
        username: 'chenmo',
        module: '用户管理',
        action: '新增',
        method: 'POST',
        ip: '10.0.8.66',
        status: 1,
        costMs: 30,
        createTime: '2025-11-26 21:00:00',
        params: '{}',
      },
    ]
    const result = localizeMockData(logs)
    expect(result[0].module).toBe('Users')
    expect(result[0].action).toBe('Create')
    expect(result[0].username).toBe('chenmo')
    expect(result[0].method).toBe('POST')
  })

  it('种子表里没有的文案（用户自己输入的名称）保持原文', () => {
    useLocale('en-US')
    const result = localizeMockData([{ id: 9, name: '报表中心', label: '自定义标签' }])
    expect(result[0].name).toBe('报表中心')
    expect(result[0].label).toBe('自定义标签')
  })

  it('真实请求链路：切英文后 menu/tree 返回英文菜单名', async () => {
    await get<MenuItem[]>('/system/menu/tree')
    useLocale('en-US')
    const data = await get<MenuItem[]>('/system/menu/tree')
    expect(data[0].name).toBe('Dashboard')
    expect(data.some((item) => item.name === 'System')).toBe(true)
  })

  it('业务错误提示在英文环境翻译，中文环境保持原文', () => {
    expect(localizeMockMessage('账号已存在')).toBe('账号已存在')

    useLocale('en-US')
    expect(localizeMockMessage('账号已存在')).toBe('Username already exists')
    expect(localizeMockMessage('该账号已被停用，请联系管理员')).toBe(
      'This account is disabled, please contact the administrator'
    )
    expect(localizeMockMessage('该角色已被 3 个用户使用，无法删除')).toBe(
      'This role is assigned to 3 user(s) and cannot be deleted'
    )
    // 开发期提示不翻译，方便排查
    expect(localizeMockMessage('Mock 接口未定义：GET /x')).toBe('Mock 接口未定义：GET /x')
  })

  it('真实请求链路：英文环境下重复账号拿到的 msg 是英文', async () => {
    useLocale('en-US')
    const failure = await post('/system/user', { username: 'admin', nickname: 'Dup' }).catch(
      (error: Error) => error
    )
    expect((failure as Error).message).toBe('Username already exists')
  })
})
