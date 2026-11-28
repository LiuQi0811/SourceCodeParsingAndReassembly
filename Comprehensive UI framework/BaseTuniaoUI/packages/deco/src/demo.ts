import { DECO_VERSION, type DecoPage } from './schema'

/** 装修一期的示例页面：后台编辑器首次进入、小程序端拿不到接口数据时都用它 */
export const createDemoPage = (): DecoPage => ({
  version: DECO_VERSION,
  title: '图鸟商城',
  primary: '#01beff',
  components: [
    {
      id: 'banner-1',
      type: 'banner',
      height: 170,
      radius: 14,
      items: [
        { id: 'b1', title: '新品首发 · 全场 8 折' },
        { id: 'b2', title: '会员日 · 积分翻倍' },
        { id: 'b3', title: '爆款清单 · 限时直降' },
      ],
    },
    {
      id: 'notice-1',
      type: 'notice',
      tag: '公告',
      text: '春节期间物流时效说明，点击查看详情',
    },
    {
      id: 'nav-1',
      type: 'nav',
      columns: 4,
      items: [
        { id: 'n1', text: '新品', icon: '新' },
        { id: 'n2', text: '分类', icon: '类' },
        { id: 'n3', text: '会员', icon: '会' },
        { id: 'n4', text: '客服', icon: '客' },
      ],
    },
    {
      id: 'goods-1',
      type: 'goods',
      title: '为你推荐',
      columns: 2,
      items: [
        { id: 'g1', name: '轻量羽绒服 冬季保暖', price: 399, tag: '新品' },
        { id: 'g2', name: '羊毛围巾 燕麦色', price: 129 },
        { id: 'g3', name: '保温杯 500ml', price: 89, tag: '热卖' },
        { id: 'g4', name: '桌面暖风机', price: 199 },
      ],
    },
  ],
})
