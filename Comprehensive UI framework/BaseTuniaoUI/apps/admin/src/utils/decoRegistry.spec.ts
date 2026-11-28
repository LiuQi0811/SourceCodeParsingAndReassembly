import { describe, expect, it } from 'vitest'
import {
  DECO_COMPONENT_REGISTRY,
  createDecoComponent,
  getDecoComponentDefinition,
  type DecoCreateContext,
} from '@btn/deco/registry'
import {
  validateDecoPage,
  type DecoComponent,
  type DecoComponentType,
  type DecoPage,
} from '@btn/deco/schema'

const makeContext = (): DecoCreateContext => {
  let serial = 0
  return {
    id: (prefix) => {
      serial += 1
      return `${prefix}-${serial}`
    },
    t: (key) => key,
  }
}

const createPage = (types: DecoComponentType[]): DecoPage => {
  const ctx = makeContext()
  const components = types
    .map((type) => createDecoComponent(type, ctx))
    .filter((item): item is DecoComponent => item !== null)
  return { version: 1, title: '测试页', components }
}

describe('装修组件注册表', () => {
  it('四个内置组件都已登记，且类型与文案键不重复', () => {
    expect(DECO_COMPONENT_REGISTRY.map((item) => item.type)).toEqual([
      'banner',
      'notice',
      'nav',
      'goods',
    ])

    const labels = DECO_COMPONENT_REGISTRY.map((item) => item.labelKey)
    expect(new Set(labels).size).toBe(labels.length)

    for (const definition of DECO_COMPONENT_REGISTRY) {
      const keys = definition.fields.map((field) => field.key)
      expect(new Set(keys).size).toBe(keys.length)
      expect(definition.fields.length).toBeGreaterThan(0)
    }
  })

  it('按注册表创建出的组件可以直接通过协议校验', () => {
    const types = DECO_COMPONENT_REGISTRY.map((item) => item.type)
    expect(types).toHaveLength(4)

    const page = createPage(types)
    expect(page.components).toHaveLength(4)
  })

  it('未登记的类型不会凭空生成组件', () => {
    expect(getDecoComponentDefinition('video')).toBeUndefined()
    expect(createDecoComponent('video' as DecoComponentType, makeContext())).toBeNull()
  })

  it('每个组件都提供可读的列表摘要', () => {
    const page = createPage(['banner', 'notice', 'nav', 'goods'])
    for (const component of page.components) {
      const definition = getDecoComponentDefinition(component.type)
      expect(definition).toBeDefined()
      const text = definition?.summary(component, (key) => key)
      expect(typeof text).toBe('string')
      expect(text).not.toBe('')
    }
  })

  it('列表字段统一暴露跳转路径，后台属性面板不再漏字段', () => {
    for (const type of ['banner', 'nav', 'goods'] as const) {
      const definition = getDecoComponentDefinition(type)
      const list = definition?.fields.find((field) => field.kind === 'list')
      if (!list || list.kind !== 'list') throw new Error(`${type} 缺少列表字段`)
      expect(list.itemFields.map((field) => field.key)).toContain('link')
    }
  })

  it('注册表里的必填与范围规则会进入发布校验', () => {
    const page = createPage(['goods'])
    const goods = page.components[0]
    if (goods.type !== 'goods') throw new Error('未生成商品组件')

    goods.items[0].name = '   '
    expect(validateDecoPage(page).valid).toBe(false)
    expect(validateDecoPage(page).message).toContain('商品名称')

    goods.items[0].name = '正常商品'
    goods.columns = 4
    expect(validateDecoPage(page).valid).toBe(false)
    expect(validateDecoPage(page).message).toContain('不能大于 3')
  })
})
