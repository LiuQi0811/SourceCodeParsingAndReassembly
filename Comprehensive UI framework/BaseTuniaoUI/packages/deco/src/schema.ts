/**
 * 装修协议 v1
 *
 * 约束：协议只描述「放什么组件、组件里有什么」，不描述渲染细节；
 * 后台编辑器、后台预览、小程序端都读同一份 JSON，渲染统一走 DecoRenderer。
 * 组件的元数据、默认值与必填规则登记在 registry.ts，新增组件先加类型，
 * 再在注册表登记一条定义，最后为后台预览与小程序端补渲染块。
 */

import { getDecoComponentDefinition, type DecoListField, type DecoSimpleField } from './registry'

export const DECO_VERSION = 1

export type DecoComponentType = 'banner' | 'notice' | 'nav' | 'goods'

export interface DecoBase {
  /** 组件实例 id，编辑器增删与排序靠它定位，不可重复 */
  id: string
  type: DecoComponentType
  /** 上下留白，默认 12（px） */
  gap?: number
}

export interface DecoBannerItem {
  id: string
  /** 图片地址，留空时渲染为品牌色渐变占位块 */
  image?: string
  title?: string
  /** 点击跳转的小程序路径或 H5 路径 */
  link?: string
}

export interface DecoBanner extends DecoBase {
  type: 'banner'
  /** 高度（px），默认 160 */
  height?: number
  /** 圆角（px），默认 12 */
  radius?: number
  items: DecoBannerItem[]
}

export interface DecoNotice extends DecoBase {
  type: 'notice'
  text: string
  /** 左侧标签文案，默认「公告」 */
  tag?: string
  link?: string
}

export interface DecoNavItem {
  id: string
  text: string
  /** 图标字体类名或图片地址，一期可留空只显示文字 */
  icon?: string
  link?: string
}

export interface DecoNav extends DecoBase {
  type: 'nav'
  /** 每行列数，默认 4，最多 5 */
  columns?: number
  items: DecoNavItem[]
}

export interface DecoGoodsItem {
  id: string
  name: string
  /** 单位：元 */
  price: number
  cover?: string
  tag?: string
  link?: string
}

export interface DecoGoods extends DecoBase {
  type: 'goods'
  title?: string
  /** 每行列数，默认 2 */
  columns?: number
  items: DecoGoodsItem[]
}

export type DecoComponent = DecoBanner | DecoNotice | DecoNav | DecoGoods

export interface DecoPage {
  version: typeof DECO_VERSION
  /** 页面标题，小程序导航栏可用 */
  title?: string
  /** 品牌主色，渲染器内部渐变与价格色取它 */
  primary?: string
  components: DecoComponent[]
}

export interface DecoValidateResult {
  valid: boolean
  message: string
}

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim() !== ''

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)

const validateSimpleField = (
  field: DecoSimpleField,
  value: unknown,
  where: string
): string | null => {
  const missing =
    value === undefined || value === null || (typeof value === 'string' && value.trim() === '')
  if (missing) {
    return field.required ? `${where}：缺少${field.name}` : null
  }

  if (field.kind === 'number') {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return `${where}：${field.name}必须是数字`
    }
    if (field.min !== undefined && value < field.min) {
      return `${where}：${field.name}不能小于 ${field.min}`
    }
    if (field.max !== undefined && value > field.max) {
      return `${where}：${field.name}不能大于 ${field.max}`
    }
    return null
  }

  if (field.kind === 'select') {
    if (typeof value !== 'string' && typeof value !== 'number') {
      return `${where}：${field.name}取值不合法`
    }
    if (field.options?.some((option) => option.value === value)) return null
    return `${where}：${field.name}取值不在可选范围`
  }

  if (typeof value !== 'string') {
    return `${where}：${field.name}必须是文本`
  }
  return null
}

const validateListField = (field: DecoListField, value: unknown, where: string): string | null => {
  if (!Array.isArray(value)) return `${where}：${field.name}必须是数组`
  const minItems = field.minItems ?? 0
  if (value.length < minItems) {
    return `${where}：${field.name}至少需要 ${minItems} 项`
  }
  if (field.maxItems !== undefined && value.length > field.maxItems) {
    return `${where}：${field.name}最多 ${field.maxItems} 项`
  }

  const itemIds = new Set<string>()
  for (let index = 0; index < value.length; index += 1) {
    const item = value[index]
    const itemWhere = `${where}的${field.name}第 ${index + 1} 项`
    if (!isRecord(item)) return `${itemWhere}不是对象`
    if (!isNonEmptyString(item.id)) return `${itemWhere}缺少 id`
    if (itemIds.has(item.id)) return `${itemWhere}的 id 重复：${item.id}`
    itemIds.add(item.id)

    for (const itemField of field.itemFields) {
      const message = validateSimpleField(itemField, item[itemField.key], itemWhere)
      if (message) return message
    }
  }
  return null
}

/** 运行期校验：装修 JSON 来自后端/本地草稿，渲染前必须过一遍，避免脏数据把页面打崩 */
export function validateDecoPage(page: unknown): DecoValidateResult {
  if (!page || typeof page !== 'object') return { valid: false, message: '装修数据不是对象' }

  const data = page as Partial<DecoPage>
  if (data.version !== DECO_VERSION) {
    return { valid: false, message: `装修版本必须是 ${DECO_VERSION}` }
  }
  if (!Array.isArray(data.components)) return { valid: false, message: 'components 必须是数组' }

  const ids = new Set<string>()
  for (const item of data.components) {
    if (!isRecord(item)) return { valid: false, message: '组件项不是对象' }
    if (!isNonEmptyString(item.id)) return { valid: false, message: '组件缺少 id' }
    if (ids.has(item.id)) return { valid: false, message: `组件 id 重复：${item.id}` }
    ids.add(item.id)

    if (item.gap !== undefined) {
      if (typeof item.gap !== 'number' || !Number.isFinite(item.gap) || item.gap < 0) {
        return {
          valid: false,
          message: `组件 ${item.id} 的上下间距必须是非负数字`,
        }
      }
    }

    const definition = getDecoComponentDefinition(String(item.type))
    if (!definition) {
      return { valid: false, message: `未知组件类型：${String(item.type)}` }
    }

    const where = `${definition.name} ${item.id}`
    for (const field of definition.fields) {
      const message =
        field.kind === 'list'
          ? validateListField(field, item[field.key], where)
          : validateSimpleField(field, item[field.key], where)
      if (message) return { valid: false, message }
    }
  }

  return { valid: true, message: '' }
}
