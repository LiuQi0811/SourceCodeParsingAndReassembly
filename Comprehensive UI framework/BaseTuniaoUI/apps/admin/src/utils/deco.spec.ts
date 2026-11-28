import { describe, expect, it } from 'vitest'
import { createDemoPage } from '@btn/deco/demo'
import { validateDecoPage } from '@btn/deco/schema'

describe('装修协议校验', () => {
  it('示例页面通过校验', () => {
    expect(validateDecoPage(createDemoPage())).toEqual({ valid: true, message: '' })
  })

  it('版本号不符时拒绝', () => {
    const page = { ...createDemoPage(), version: 99 }
    const result = validateDecoPage(page)
    expect(result.valid).toBe(false)
    expect(result.message).toContain('版本')
  })

  it('组件 id 重复时拒绝并指出重复值', () => {
    const page = createDemoPage()
    page.components[1].id = page.components[0].id
    const result = validateDecoPage(page)
    expect(result.valid).toBe(false)
    expect(result.message).toContain(page.components[0].id)
  })

  it('轮播没有图片时拒绝', () => {
    const page = createDemoPage()
    const banner = page.components.find((item) => item.type === 'banner')
    if (banner && banner.type === 'banner') banner.items = []
    expect(validateDecoPage(page).valid).toBe(false)
  })

  it('公告文案为空时拒绝', () => {
    const page = createDemoPage()
    const notice = page.components.find((item) => item.type === 'notice')
    if (notice && notice.type === 'notice') notice.text = '   '
    expect(validateDecoPage(page).valid).toBe(false)
  })

  it('宫格导航每行超过 5 个时拒绝', () => {
    const page = createDemoPage()
    const nav = page.components.find((item) => item.type === 'nav')
    if (nav && nav.type === 'nav') nav.columns = 6
    expect(validateDecoPage(page).valid).toBe(false)
  })

  it('未知组件类型时拒绝', () => {
    const page = createDemoPage()
    // 故意构造脏数据，模拟后端下发了渲染器不认识的组件
    page.components.push({ id: 'x', type: 'video' } as never)
    expect(validateDecoPage(page).valid).toBe(false)
  })
})
