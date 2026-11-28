/**
 * 装修协议 v1
 *
 * 约束：协议只描述「放什么组件、组件里有什么」，不描述渲染细节；
 * 后台编辑器、后台预览、小程序端都读同一份 JSON，渲染统一走 DecoRenderer。
 * 一期组件集固定为 banner / notice / nav / goods，新增组件要同时改 type、校验与渲染器。
 */

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
    if (!item || typeof item !== 'object') return { valid: false, message: '组件项不是对象' }
    const component = item as DecoComponent
    if (!isNonEmptyString(component.id)) return { valid: false, message: '组件缺少 id' }
    if (ids.has(component.id)) return { valid: false, message: `组件 id 重复：${component.id}` }
    ids.add(component.id)

    switch (component.type) {
      case 'banner':
        if (!Array.isArray(component.items) || component.items.length === 0) {
          return { valid: false, message: `轮播 ${component.id} 至少需要一张图` }
        }
        break
      case 'notice':
        if (!isNonEmptyString(component.text)) {
          return { valid: false, message: `公告 ${component.id} 缺少文案` }
        }
        break
      case 'nav':
        if (!Array.isArray(component.items) || component.items.length === 0) {
          return { valid: false, message: `宫格导航 ${component.id} 至少需要一个入口` }
        }
        if (component.columns && component.columns > 5) {
          return { valid: false, message: `宫格导航 ${component.id} 每行最多 5 个` }
        }
        break
      case 'goods':
        if (!Array.isArray(component.items) || component.items.length === 0) {
          return { valid: false, message: `商品列表 ${component.id} 至少需要一个商品` }
        }
        break
      default:
        return { valid: false, message: `未知组件类型：${String((component as DecoBase).type)}` }
    }
  }

  return { valid: true, message: '' }
}
