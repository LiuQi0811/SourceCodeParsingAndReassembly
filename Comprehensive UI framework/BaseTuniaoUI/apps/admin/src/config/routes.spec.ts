import { describe, expect, it } from 'vitest'
import { REGISTERED_PAGES, isPagePath, isRegisteredPage } from '@/config/routes'

describe('routes 单一来源', () => {
  it('已注册路径直接命中', () => {
    expect(isRegisteredPage('/pages/system/user/index')).toBe(true)
    expect(isRegisteredPage('/pages/home/index')).toBe(true)
    expect(isRegisteredPage('/pages/login/index')).toBe(true)
  })

  it('归一化：缺前导斜杠、带查询串、带尾斜杠都算同一页面', () => {
    expect(isRegisteredPage('pages/system/role/index')).toBe(true)
    expect(isRegisteredPage('/pages/system/role/index?tab=auth')).toBe(true)
    expect(isRegisteredPage('/pages/system/role/index?tab=auth#anchor')).toBe(true)
    expect(isRegisteredPage('  /pages/system/role/index/  ')).toBe(true)
  })

  it('未注册路径、目录路径、空值都不算页面', () => {
    expect(isRegisteredPage('/pages/system/unknown/index')).toBe(false)
    expect(isRegisteredPage('/pages/system/dict')).toBe(false)
    expect(isRegisteredPage('')).toBe(false)
    expect(isRegisteredPage('/')).toBe(false)
  })

  it('isPagePath 只认 /pages/ 开头的路径', () => {
    expect(isPagePath('/pages/home/index')).toBe(true)
    expect(isPagePath('pages/home/index')).toBe(true)
    expect(isPagePath('/pages/home/index?x=1')).toBe(true)
    expect(isPagePath('/system')).toBe(false)
    expect(isPagePath('https://example.com/a')).toBe(false)
    expect(isPagePath('')).toBe(false)
  })

  it('注册清单无重复且全部是页面路径', () => {
    expect(new Set(REGISTERED_PAGES).size).toBe(REGISTERED_PAGES.length)
    REGISTERED_PAGES.forEach((path) => {
      expect(isPagePath(path)).toBe(true)
      expect(isRegisteredPage(path)).toBe(true)
    })
  })
})
