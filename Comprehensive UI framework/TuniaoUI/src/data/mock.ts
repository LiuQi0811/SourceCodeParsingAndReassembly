/**
 * 示例数据集中管理，页面只负责渲染，方便替换成接口数据
 */

export interface BannerItem {
	id: number
	image: string
	title: string
	desc: string
}

export const banners: BannerItem[] = [
	{ id: 1, image: '/static/demo/banner-1.jpg', title: '全组件演示', desc: '一次看完 56 个组件' },
	{ id: 2, image: '/static/demo/banner-2.jpg', title: '配色体系', desc: '19 种主色 × 4 档深浅' },
	{ id: 3, image: '/static/demo/banner-3.jpg', title: '图标体系', desc: '838 个内置图标' },
]

export interface GoodsItem {
	id: number
	name: string
	desc: string
	price: number
	originPrice: number
	image: string
	tags: string[]
	sales: number
}

export const goods: GoodsItem[] = [
	{
		id: 1,
		name: '图鸟 UI 全量源码授权',
		desc: 'uni-app / Vue3 / TypeScript 三端通用组件库',
		price: 199,
		originPrice: 399,
		image: '/static/demo/goods-1.jpg',
		tags: ['源码', '商用授权'],
		sales: 1286,
	},
	{
		id: 2,
		name: 'Table 主题模板套装',
		desc: '含 12 套页面模板，直接改数据即可上线',
		price: 99,
		originPrice: 199,
		image: '/static/demo/goods-2.jpg',
		tags: ['模板', '开箱即用'],
		sales: 862,
	},
	{
		id: 3,
		name: '图标扩展包',
		desc: '在 838 个图标基础上继续扩充业务图标',
		price: 39,
		originPrice: 69,
		image: '/static/demo/goods-3.jpg',
		tags: ['图标', '持续更新'],
		sales: 431,
	},
]

export const gallery = [
	'/static/demo/goods-1.jpg',
	'/static/demo/goods-2.jpg',
	'/static/demo/goods-3.jpg',
	'/static/demo/banner-1.jpg',
	'/static/demo/banner-2.jpg',
	'/static/demo/banner-3.jpg',
]

/** 瀑布流数据：字段完全由业务自定义，组件只负责分两列排布 */
export const waterFallData = [
	{ id: 1, title: '基础组件', color: 'tn-blue', icon: 'cube', height: 160 },
	{ id: 2, title: '表单校验', color: 'tn-purple', icon: 'edit-form', height: 220 },
	{ id: 3, title: '反馈交互', color: 'tn-orange', icon: 'message', height: 200 },
	{ id: 4, title: '导航布局', color: 'tn-green', icon: 'menu', height: 150 },
	{ id: 5, title: '数据展示', color: 'tn-aquablue', icon: 'charts-column', height: 240 },
	{ id: 6, title: '主题定制', color: 'tn-red', icon: 'creative', height: 180 },
	{ id: 7, title: '多语言', color: 'tn-teal', icon: 'english', height: 210 },
	{ id: 8, title: '实战模板', color: 'tn-grey', icon: 'image-text', height: 170 },
]

/** 索引列表数据：key + title + data，渲染交给默认插槽 */
export const contacts = [
	{
		key: 'A',
		title: 'A',
		data: [
			{ name: '安其拉', phone: '138****1024', avatarIcon: 'girl', color: 'tn-purple' },
			{ name: '阿轲', phone: '139****2048', avatarIcon: 'girl', color: 'tn-red' },
		],
	},
	{
		key: 'L',
		title: 'L',
		data: [
			{ name: '鲁班七号', phone: '137****4096', avatarIcon: 'boy', color: 'tn-orange' },
			{ name: '李白', phone: '136****8192', avatarIcon: 'boy', color: 'tn-blue' },
			{ name: '廉颇', phone: '135****1638', avatarIcon: 'boy', color: 'tn-green' },
		],
	},
	{
		key: 'Z',
		title: 'Z',
		data: [
			{ name: '诸葛亮', phone: '134****3276', avatarIcon: 'boy', color: 'tn-aquablue' },
			{ name: '庄周', phone: '133****6553', avatarIcon: 'boy', color: 'tn-teal' },
		],
	},
]

/** 通知栏滚动文案 */
export const noticeList = [
	'TuniaoUI 1.0.23 已发布，新增 6 个组件',
	'全量安装与按需引入都支持，文档见 README',
	'主题色只需覆盖 --tn-color-primary 系列变量',
]

/** 滚动列表数据 */
export const scrollListData = [
	{ id: 1, title: '首页', icon: 'home', desc: '进入组件总览' },
	{ id: 2, title: '表单', icon: 'edit-form', desc: '校验 / 重置 / 联动' },
	{ id: 3, title: '反馈', icon: 'message', desc: '模态 / 通知 / 弹层' },
	{ id: 4, title: '导航', icon: 'menu', desc: 'Tabbar / Tabs / Steps' },
	{ id: 5, title: '数据', icon: 'charts-column', desc: '日历 / 瀑布流 / 相册' },
	{ id: 6, title: '主题', icon: 'creative', desc: '色板 / 图标 / 多语言' },
]

