/**
 * 装修组件注册表
 *
 * 这里是组件能力的唯一元数据源：后台的新增按钮、属性面板、列表摘要、默认值，
 * 以及发布前校验都读这份定义。新增组件时先登记一条定义，再分别为后台预览与
 * 小程序端补充对应的渲染块即可，不再需要在多处散落维护默认值与必填规则。
 */

import type {
  DecoBanner,
  DecoComponent,
  DecoComponentType,
  DecoGoods,
  DecoNav,
  DecoNotice,
} from './schema'

export type DecoFieldKind = 'text' | 'textarea' | 'number' | 'image' | 'select'

export interface DecoFieldOption {
  labelKey: string
  value: string | number
}

interface DecoFieldBase {
  /** 组件对象上的字段名 */
  key: string
  /** 运行期校验提示里使用的中文名称 */
  name: string
  /** 后台属性面板的 i18n 文案 key */
  labelKey: string
  /** 输入框占位文案的 i18n key */
  placeholderKey?: string
}

export interface DecoSimpleField extends DecoFieldBase {
  kind: DecoFieldKind
  required?: boolean
  /** number 字段的最小值 */
  min?: number
  /** number 字段的最大值 */
  max?: number
  /** select 字段的候选值 */
  options?: DecoFieldOption[]
}

export interface DecoListField extends DecoFieldBase {
  kind: 'list'
  addLabelKey: string
  minItems?: number
  maxItems?: number
  /** 列表项内部字段，只允许简单字段，避免无限嵌套 */
  itemFields: DecoSimpleField[]
  /** 生成一条新的列表项，id 由调用方提供的 id 工厂生成 */
  createItem: (ctx: DecoCreateContext) => Record<string, unknown>
}

export type DecoPropertyField = DecoSimpleField | DecoListField

export interface DecoCreateContext {
  id: (prefix: string) => string
  t: (key: string) => string
}

export type DecoTranslate = (key: string, params?: Record<string, unknown>) => string

export interface DecoComponentDefinition {
  type: DecoComponentType
  /** 中文名称，仅用于运行期校验提示 */
  name: string
  /** 新增按钮与组件列表使用的 i18n key */
  labelKey: string
  fields: DecoPropertyField[]
  summary: (component: DecoComponent, t: DecoTranslate) => string
  create: (ctx: DecoCreateContext) => DecoComponent
}

const bannerDefinition: DecoComponentDefinition = {
  type: 'banner',
  name: '轮播',
  labelKey: 'deco.addBanner',
  fields: [
    {
      key: 'height',
      name: '轮播高度',
      labelKey: 'deco.bannerHeight',
      kind: 'number',
      min: 80,
      max: 320,
    },
    {
      key: 'radius',
      name: '圆角',
      labelKey: 'deco.bannerRadius',
      kind: 'number',
      min: 0,
      max: 40,
    },
    {
      key: 'items',
      name: '轮播图',
      labelKey: 'deco.slides',
      addLabelKey: 'deco.addSlide',
      kind: 'list',
      minItems: 1,
      maxItems: 8,
      itemFields: [
        {
          key: 'title',
          name: '标题文字',
          labelKey: 'deco.slideTitle',
          kind: 'text',
        },
        {
          key: 'image',
          name: '轮播图片',
          labelKey: 'deco.slideImage',
          kind: 'image',
        },
        {
          key: 'link',
          name: '跳转路径',
          labelKey: 'deco.slideLink',
          placeholderKey: 'deco.linkPlaceholder',
          kind: 'text',
        },
      ],
      createItem: ({ id, t }) => ({
        id: id('slide'),
        title: t('deco.slideDefault'),
      }),
    },
  ],
  summary: (component, t) =>
    t('deco.summarySlides', {
      n: (component as DecoBanner).items?.length ?? 0,
    }),
  create: ({ id, t }) => ({
    id: id('banner'),
    type: 'banner',
    height: 170,
    radius: 14,
    items: [{ id: id('slide'), title: t('deco.slideDefault') }],
  }),
}

const noticeDefinition: DecoComponentDefinition = {
  type: 'notice',
  name: '公告',
  labelKey: 'deco.addNotice',
  fields: [
    { key: 'tag', name: '标签', labelKey: 'deco.noticeTag', kind: 'text' },
    {
      key: 'text',
      name: '公告内容',
      labelKey: 'deco.noticeText',
      kind: 'textarea',
      required: true,
    },
    {
      key: 'link',
      name: '跳转路径',
      labelKey: 'deco.noticeLink',
      placeholderKey: 'deco.linkPlaceholder',
      kind: 'text',
    },
  ],
  summary: (component) => (component as DecoNotice).text,
  create: ({ id, t }) => ({
    id: id('notice'),
    type: 'notice',
    tag: t('deco.addNotice'),
    text: t('deco.noticeDefault'),
  }),
}

const navDefinition: DecoComponentDefinition = {
  type: 'nav',
  name: '宫格导航',
  labelKey: 'deco.addNav',
  fields: [
    {
      key: 'columns',
      name: '每行列数',
      labelKey: 'deco.navColumns',
      kind: 'number',
      min: 1,
      max: 5,
    },
    {
      key: 'items',
      name: '入口',
      labelKey: 'deco.navItems',
      addLabelKey: 'deco.addNav',
      kind: 'list',
      minItems: 1,
      maxItems: 10,
      itemFields: [
        {
          key: 'text',
          name: '文案',
          labelKey: 'deco.navText',
          kind: 'text',
          required: true,
        },
        {
          key: 'icon',
          name: '图标文字',
          labelKey: 'deco.navIcon',
          kind: 'text',
        },
        {
          key: 'link',
          name: '跳转路径',
          labelKey: 'deco.navLink',
          placeholderKey: 'deco.linkPlaceholder',
          kind: 'text',
        },
      ],
      createItem: ({ id, t }) => ({
        id: id('navitem'),
        text: t('deco.navDefault'),
      }),
    },
  ],
  summary: (component, t) => {
    const item = component as DecoNav
    return t('deco.summaryNav', {
      n: item.items?.length ?? 0,
      columns: item.columns ?? 4,
    })
  },
  create: ({ id, t }) => ({
    id: id('nav'),
    type: 'nav',
    columns: 4,
    items: [
      { id: id('navitem'), text: t('deco.navDefault') },
      { id: id('navitem'), text: t('deco.navDefault') },
    ],
  }),
}

const goodsDefinition: DecoComponentDefinition = {
  type: 'goods',
  name: '商品列表',
  labelKey: 'deco.addGoods',
  fields: [
    {
      key: 'title',
      name: '板块标题',
      labelKey: 'deco.goodsTitle',
      kind: 'text',
    },
    {
      key: 'columns',
      name: '每行列数',
      labelKey: 'deco.goodsColumns',
      kind: 'number',
      min: 1,
      max: 3,
    },
    {
      key: 'items',
      name: '商品',
      labelKey: 'deco.goodsItems',
      addLabelKey: 'deco.addGoods',
      kind: 'list',
      minItems: 1,
      maxItems: 20,
      itemFields: [
        {
          key: 'name',
          name: '商品名称',
          labelKey: 'deco.goodsName',
          kind: 'text',
          required: true,
        },
        {
          key: 'cover',
          name: '商品图',
          labelKey: 'deco.goodsCover',
          kind: 'image',
        },
        {
          key: 'price',
          name: '价格',
          labelKey: 'deco.goodsPrice',
          kind: 'number',
          required: true,
          min: 0,
        },
        { key: 'tag', name: '角标', labelKey: 'deco.goodsTag', kind: 'text' },
        {
          key: 'link',
          name: '跳转路径',
          labelKey: 'deco.goodsLink',
          placeholderKey: 'deco.linkPlaceholder',
          kind: 'text',
        },
      ],
      createItem: ({ id, t }) => ({
        id: id('good'),
        name: t('deco.goodsDefaultName'),
        price: 99,
      }),
    },
  ],
  summary: (component, t) =>
    t('deco.summaryGoods', { n: (component as DecoGoods).items?.length ?? 0 }),
  create: ({ id, t }) => ({
    id: id('goods'),
    type: 'goods',
    title: t('deco.goodsDefaultTitle'),
    columns: 2,
    items: [{ id: id('good'), name: t('deco.goodsDefaultName'), price: 99 }],
  }),
}

/** 登记顺序就是后台新增按钮与组件搜索的展示顺序 */
export const DECO_COMPONENT_REGISTRY: DecoComponentDefinition[] = [
  bannerDefinition,
  noticeDefinition,
  navDefinition,
  goodsDefinition,
]

export const getDecoComponentDefinition = (type: string): DecoComponentDefinition | undefined =>
  DECO_COMPONENT_REGISTRY.find((item) => item.type === type)

export const createDecoComponent = (
  type: DecoComponentType,
  ctx: DecoCreateContext
): DecoComponent | null => {
  const definition = getDecoComponentDefinition(type)
  return definition ? definition.create(ctx) : null
}
