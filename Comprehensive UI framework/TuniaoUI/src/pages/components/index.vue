<script lang="ts" setup>
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { tnIconCount } from '@/data/icons'

const statusBarHeight = ref(0)

onLoad(() => {
	statusBarHeight.value = uni.getSystemInfoSync().statusBarHeight || 0
})

interface Category {
	key: string
	title: string
	desc: string
	icon: string
	color: string
	url: string
	total: number
}

const categories: Category[] = [
	{ key: 'basic', title: '基础组件', desc: '按钮、图标、头像、徽标、标签、标题', icon: 'cube', color: 'tn-blue', url: '/pages/basic/index', total: 11 },
	{ key: 'layout', title: '布局与原子类', desc: 'Flex、宽高、间距、圆角、阴影、色板、渐变', icon: 'menu-grille', color: 'tn-aquablue', url: '/pages/layout/index', total: 9 },
	{ key: 'form', title: '表单组件', desc: '输入、选择、校验、键盘、上传', icon: 'edit-form', color: 'tn-purple', url: '/pages/form/index', total: 13 },
	{ key: 'feedback', title: '反馈组件', desc: '弹窗、通知、进度、加载、倒计时', icon: 'message', color: 'tn-orange', url: '/pages/feedback/index', total: 16 },
	{ key: 'nav', title: '导航组件', desc: '导航栏、标签页、步骤条、折叠面板', icon: 'menu', color: 'tn-green', url: '/pages/nav/index', total: 9 },
	{ key: 'data', title: '数据展示', desc: '日历、轮播、瀑布流、索引列表、吸顶', icon: 'charts-column', color: 'tn-teal', url: '/pages/data/index', total: 9 },
	{ key: 'theme', title: '主题与规范', desc: 'CSS 变量换肤、色板、渐变、图标库、i18n', icon: 'creative', color: 'tn-red', url: '/pages/theme/index', total: 5 },
	{ key: 'business', title: '业务闭环', desc: 'Pinia、请求封装、登录态、购物车、订单分页', icon: 'order', color: 'tn-orange', url: '/pages/business/index', total: 6 },
	{ key: 'cross', title: '跨端与系统 API', desc: '生命周期、网络监听、分享、扫码、定位、拨号', icon: 'phone', color: 'tn-blue', url: '/pages/cross-platform/index', total: 8 },
]

// 代码示例必须作为数据绑定输出：小程序 WXML 会把模板文本里的裸 `{` 当成插值语法而报错
const registerCodeLines = [
	'// main.ts —— 全量注册（本项目采用）',
	"import * as TnUI from '@tuniao/tnui-vue3-uniapp'",
	'Object.keys(TnUI).forEach((key) => {',
	"  const tag = key.replace(/Tn/, 'tn-').toLowerCase()",
	'  app.component(tag, TnUI[key])',
	'})',
	'',
	'// 单组件按需引入',
	"import { TnButton, TnIcon } from '@tuniao/tnui-vue3-uniapp'",
]

const tagExample = '<tn-xxx>'

interface CompItem {
	tag: string
	name: string
	note: string
	page: string
	tab?: boolean
	label?: string
}

const groups: { title: string; items: CompItem[] }[] = [
	{
		title: '基础组件（11）',
		items: [
			{ tag: 'tn-button', name: '按钮', note: 'type / size / shape / plain / loading', page: '/pages/basic/index' },
			{ tag: 'tn-icon', name: '图标', note: `图鸟图标库 ${tnIconCount} 个`, page: '/pages/theme/index' },
			{ tag: 'tn-avatar', name: '头像', note: 'size / shape / src', page: '/pages/basic/index' },
			{ tag: 'tn-avatar-group', name: '头像组', note: 'max 折叠 / 层叠排列', page: '/pages/basic/index' },
			{ tag: 'tn-badge', name: '徽标', note: 'value / type / dot / max', page: '/pages/basic/index' },
			{ tag: 'tn-tag', name: '标签', note: 'type / size / plain / shape', page: '/pages/basic/index' },
			{ tag: 'tn-title', name: '标题', note: 'left / right 插槽', page: '/pages/basic/index' },
			{ tag: 'tn-list-item', name: '列表项', note: 'rightIcon / bottomBorder / hoverClass', page: '/pages/layout/index' },
			{ tag: 'tn-number-box', name: '数字框', note: 'v-model / step / min / max', page: '/pages/form/index' },
			{ tag: 'tn-rate', name: '评分', note: 'count / allow-half / readonly', page: '/pages/form/index' },
			{ tag: 'tn-slider', name: '滑块', note: 'v-model / min / max / step', page: '/pages/form/index' },
		],
	},
	{
		title: '表单组件（13）',
		items: [
			{ tag: 'tn-form', name: '表单', note: 'rules / validate / resetFields', page: '/pages/form/index' },
			{ tag: 'tn-form-item', name: '表单项', note: 'label / prop / required', page: '/pages/form/index' },
			{ tag: 'tn-input', name: '输入框', note: 'v-model / type / clearable', page: '/pages/form/index' },
			{ tag: 'tn-checkbox', name: '复选框', note: 'label 作为选中值', page: '/pages/form/index' },
			{ tag: 'tn-checkbox-group', name: '复选框组', note: 'v-model 数组 / max 限选', page: '/pages/form/index' },
			{ tag: 'tn-radio', name: '单选框', note: 'label 作为选中值', page: '/pages/form/index' },
			{ tag: 'tn-radio-group', name: '单选框组', note: 'v-model 绑定 label', page: '/pages/form/index' },
			{ tag: 'tn-picker', name: '选择器', note: '单列 / 多列 / 级联', page: '/pages/form/index' },
			{ tag: 'tn-date-time-picker', name: '日期选择', note: '7 种 mode / format 跟随', page: '/pages/form/index' },
			{ tag: 'tn-region-picker', name: '省市区选择', note: 'v-model 字符串', page: '/pages/form/index' },
			{ tag: 'tn-keyboard', name: '数字键盘', note: '5 种 mode / carLang', page: '/pages/form/index' },
			{ tag: 'tn-image-upload', name: '图片上传', note: 'v-model url 数组 / 自定义上传', page: '/pages/form/index' },
			{ tag: 'tn-switch', name: '开关', note: 'v-model / disabled', page: '/pages/form/index' },
		],
	},
	{
		title: '反馈组件（16）',
		items: [
			{ tag: 'tn-modal', name: '模态框', note: '命令式 ref.showModal()', page: '/pages/feedback/index' },
			{ tag: 'tn-notify', name: '通知', note: '命令式 ref.show()', page: '/pages/feedback/index' },
			{ tag: 'tn-action-sheet', name: '动作面板', note: '命令式 ref.show()', page: '/pages/feedback/index' },
			{ tag: 'tn-popup', name: '弹出层', note: 'v-model / openDirection', page: '/pages/feedback/index' },
			{ tag: 'tn-overlay', name: '遮罩层', note: 'v-model:show / opacity', page: '/pages/feedback/index' },
			{ tag: 'tn-loading', name: '加载中', note: 'type / size / color', page: '/pages/feedback/index' },
			{ tag: 'tn-circle-progress', name: '环形进度', note: 'percent 属性', page: '/pages/feedback/index' },
			{ tag: 'tn-line-progress', name: '线形进度', note: 'percent / height', page: '/pages/feedback/index' },
			{ tag: 'tn-empty', name: '空状态', note: 'mode / #tips 插槽', page: '/pages/feedback/index' },
			{ tag: 'tn-loadmore', name: '加载更多', note: 'status: loading / nomore', page: '/pages/feedback/index' },
			{ tag: 'tn-read-more', name: '展开收起', note: 'height / expand / fold', page: '/pages/feedback/index' },
			{ tag: 'tn-count-down', name: '倒计时', note: 'time / separatorMode', page: '/pages/feedback/index' },
			{ tag: 'tn-count-to', name: '数字滚动', note: 'start / end / duration', page: '/pages/feedback/index' },
			{ tag: 'tn-count-scroll', name: '滚动数字', note: '用于大屏数字', page: '/pages/feedback/index' },
			{ tag: 'tn-notice-bar', name: '通知栏', note: '纵向 / 横向滚动', page: '/pages/feedback/index' },
			{ tag: 'tn-bubble-box', name: '气泡框', note: '#default 自定义内容', page: '/pages/feedback/index' },
		],
	},
	{
		title: '导航组件（9）',
		items: [
			{ tag: 'tn-navbar', name: '导航栏', note: '标题插槽 / #back / #right', page: '/pages/nav/index' },
			{ tag: 'tn-tabs', name: '标签页', note: 'v-model 与 item name 对应', page: '/pages/nav/index' },
			{ tag: 'tn-tabs-item', name: '标签页项', note: 'name / title', page: '/pages/nav/index' },
			{ tag: 'tn-tabbar', name: '底部导航', note: 'item: icon / activeIcon / bulge', page: '/pages/nav/index' },
			{ tag: 'tn-switch-tab', name: '分段选项卡', note: 'v-model / item 图标', page: '/pages/nav/index' },
			{ tag: 'tn-steps', name: '步骤条', note: 'mode: dot / number / dotIcon / icon', page: '/pages/nav/index' },
			{ tag: 'tn-collapse', name: '折叠面板', note: '手风琴 / number[] 多开', page: '/pages/nav/index' },
			{ tag: 'tn-subsection', name: '分段器', note: 'mode: default / button', page: '/pages/nav/index' },
			{ tag: 'tn-swipe-action', name: '滑动操作', note: 'options 数组 / 禁用项', page: '/pages/nav/index' },
		],
	},
	{
		title: '数据展示（9）',
		items: [
			{ tag: 'tn-calendar', name: '日历', note: 'mode: date / multi / range', page: '/pages/data/index' },
			{ tag: 'tn-week-calendar', name: '周历', note: 'customData 标记日期', page: '/pages/data/index' },
			{ tag: 'tn-swiper', name: '轮播', note: '3 种指示器 × 6 位置', page: '/pages/data/index' },
			{ tag: 'tn-photo-album', name: '相册', note: 'data / column / preview', page: '/pages/data/index' },
			{ tag: 'tn-lazy-load', name: '懒加载', note: '配合图片滚动加载', page: '/pages/data/index' },
			{ tag: 'tn-water-fall', name: '瀑布流', note: 'normal / calc 两种排布', page: '/pages/data/index' },
			{ tag: 'tn-scroll-list', name: '横向滚动', note: 'scroll-left / scroll-right', page: '/pages/data/index' },
			{ tag: 'tn-index-list', name: '索引列表', note: 'data:[{key,title,data}]', page: '/pages/data/index' },
			{ tag: 'tn-sticky', name: '吸顶容器', note: 'sticky-top', page: '/pages/layout/index' },
		],
	},
	{
		title: '其他（2）',
		items: [
			{ tag: 'tn-footer', name: '页脚', note: 'navigator 数组 / content', page: '/pages/mine/index', tab: true },
			{ tag: 'tn-search-box', name: '搜索框', note: 'v-model / shape / action', page: '/pages/template/index', tab: true },
		],
	},
]

// `<tag>` 不能直接写在模板文本里：小程序会把 `<` 当成标签起始
groups.forEach((group) => {
	group.items.forEach((item) => {
		item.label = `<${item.tag}>`
	})
})

const pageMap = [
	{ name: '首页', desc: 'Hero / 数据统计 / 快捷入口 / 通知', url: '/pages/index/index', tab: true },
	{ name: '基础组件', desc: 'Button / Icon / Avatar / Badge / Tag / Title', url: '/pages/basic/index', tab: false },
	{ name: '布局与原子类', desc: 'Flex / 宽高 / 间距 / 圆角 / 阴影 / 色板 / 渐变', url: '/pages/layout/index', tab: false },
	{ name: '表单', desc: 'Form 校验 / 输入 / 选择 / 键盘 / 上传', url: '/pages/form/index', tab: false },
	{ name: '反馈', desc: '命令式弹窗 / 进度 / 倒计时 / 通知栏', url: '/pages/feedback/index', tab: false },
	{ name: '导航', desc: 'Navbar / Tabs / Tabbar / Steps / Collapse', url: '/pages/nav/index', tab: false },
	{ name: '数据展示', desc: '日历 / 轮播 / 瀑布流 / 索引列表', url: '/pages/data/index', tab: false },
	{ name: '主题与规范', desc: '换肤 / 色板 / 渐变 / 图标库 / i18n', url: '/pages/theme/index', tab: true },
	{ name: '实战模板', desc: '商城列表页组合示例', url: '/pages/template/index', tab: true },
	{ name: '商品详情', desc: '相册 / 规格选择 / 优惠券 / 底部操作', url: '/pages/detail/index?id=1', tab: false },
	{ name: '购物车', desc: '勾选 / 全选 / 数量 / 左滑删除 / 合计', url: '/pages/cart/index', tab: false },
	{ name: '确认订单', desc: '地址 / 配送 / 优惠券 / 支付 / 下单结果', url: '/pages/checkout/index', tab: false },
	{ name: '搜索筛选', desc: '关键词 / 历史 / 分类 / 价格 / 排序 / 空态', url: '/pages/search/index', tab: false },
	{ name: '进阶 API', desc: '类型化实例 / validateField / 返回拦截 / 事件全集 / 组件文案 i18n', url: '/pages/advanced/index', tab: false },
	{ name: '跨端与系统 API', desc: '生命周期 / 网络监听 / 分享 / 扫码 / 定位 / easycom custom / hooks', url: '/pages/cross-platform/index', tab: false },
	{ name: '业务闭环', desc: 'Pinia / 请求封装 / 登录态 / 购物车 / 分页', url: '/pages/business/index', tab: false },
	{ name: '工程化（分包）', desc: '按需引入 / subPackages / 图标字体本地化 / 小程序清单', url: '/pages-sub/engineering/index', tab: false },
	{ name: '我的', desc: '个人中心 / FAQ / 依赖清单', url: '/pages/mine/index', tab: true },
]

function go(url: string, tab?: boolean) {
	if (tab) uni.switchTab({ url })
	else uni.navigateTo({ url })
}

function copyTag(tag: string) {
	uni.setClipboardData({
		data: `<${tag} />`,
		success: () => uni.showToast({ title: '标签已复制', icon: 'none' }),
	})
}
</script>

<template>
	<view class="page">
		<view class="page-header" :style="{ paddingTop: statusBarHeight ? `${statusBarHeight + 20}px` : '38rpx' }">
			<text class="page-header__eyebrow">COMPONENT INDEX</text>
			<text class="page-header__title">组件总览</text>
			<text class="page-header__desc">TuniaoUI 全量组件 + 知识点索引，点击任意条目跳转对应示例页</text>
			<view class="stats">
				<view class="stat">
					<text class="stat__value">55</text>
					<text class="stat__label">组件模块</text>
				</view>
				<view class="stat">
					<text class="stat__value">60+</text>
					<text class="stat__label">可用标签</text>
				</view>
				<view class="stat">
					<text class="stat__value">{{ tnIconCount }}</text>
					<text class="stat__label">内置图标</text>
				</view>
				<view class="stat">
					<text class="stat__value">21</text>
					<text class="stat__label">主题色</text>
				</view>
			</view>
		</view>

		<!-- 分类入口 -->
		<view class="category-grid">
			<view v-for="cat in categories" :key="cat.key" class="category-card" @click="go(cat.url, cat.key === 'theme')">
				<view class="category-card__icon" :class="[`tn-${String(cat.color).replace('tn-', '')}_bg`]">
					<tn-icon :name="cat.icon" :size="34" color="#ffffff" />
				</view>
				<text class="category-card__title">{{ cat.title }}</text>
				<text class="category-card__desc">{{ cat.desc }}</text>
				<text class="category-card__total">{{ cat.total }} 项示例 →</text>
			</view>
		</view>

		<!-- 全量注册说明 -->
		<view class="notice-card">
			<text class="notice-card__title">全量注册 vs 按需引入</text>
			<view class="notice-card__code-meta">
				<text>CODE</text>
				<text>左右滑动查看完整代码</text>
			</view>
			<scroll-view class="notice-card__code-scroll" scroll-x :show-scrollbar="false">
				<view class="notice-card__code">
					<text v-for="(line, index) in registerCodeLines" :key="index" class="code-line">{{ line }}</text>
				</view>
			</scroll-view>
			<text class="notice-card__tip">组件已在 main.ts 全局注册，模板里直接写 {{ tagExample }} 即可；也可按需 import 单个组件。</text>
		</view>

		<!-- 组件清单 -->
		<view v-for="group in groups" :key="group.title" class="group-card">
			<view class="group-head">
				<text class="group-title">{{ group.title }}</text>
				<text class="group-tip">点击复制标签</text>
			</view>
			<view v-for="item in group.items" :key="item.tag" class="comp-row">
				<view class="comp-main">
					<text class="comp-tag" @click.stop="copyTag(item.tag)">{{ item.label }}</text>
					<text class="comp-name">{{ item.name }}</text>
					<text class="comp-note">{{ item.note }}</text>
				</view>
				<view class="comp-go" @click="go(item.page, item.tab)">
					<tn-icon name="right" :size="28" color="tn-grey" />
				</view>
			</view>
		</view>

		<!-- 页面地图 -->
		<view class="group-card">
			<text class="group-title">示例页面地图</text>
			<view class="page-map">
				<view v-for="p in pageMap" :key="p.url" class="page-map__item" @click="go(p.url, p.tab)">
					<text class="page-map__name">{{ p.name }}</text>
					<text class="page-map__desc">{{ p.desc }}</text>
				</view>
			</view>
		</view>

		<tn-footer :fixed="false" :navigator="[{ title: '返回首页', url: '/pages/index/index' }, { title: '实战模板', url: '/pages/template/index' }]" content="组件总览 · 共 55 个组件模块" />
		<view class="bottom-space" />
	</view>
</template>

<style lang="scss" scoped>
.page {
	background-color: #f4f7fb;
	padding-bottom: 40rpx;
}

.page-header {
	padding: 38rpx 30rpx 38rpx;
	background: linear-gradient(145deg, #0b1220 0%, #172554 58%, #1e40af 100%);
	border-radius: 0 0 36rpx 36rpx;
	box-shadow: 0 16rpx 40rpx rgba(15, 23, 42, 0.16);
}

.page-header__eyebrow {
	display: block;
	font-size: 18rpx;
	font-weight: 600;
	letter-spacing: 3rpx;
	color: #67e8f9;
}

.page-header__title {
	display: block;
	margin-top: 10rpx;
	font-size: 42rpx;
	font-weight: 800;
	letter-spacing: -1rpx;
	color: #ffffff;
}

.page-header__desc {
	display: block;
	margin-top: 10rpx;
	font-size: 22rpx;
	line-height: 1.7;
	color: rgba(226, 232, 240, 0.76);
}

.stats {
	margin-top: 28rpx;
	padding-top: 24rpx;
	border-top: 1rpx solid rgba(255, 255, 255, 0.12);
	display: flex;
	justify-content: space-between;
}

.stat {
	width: 24%;
	display: flex;
	flex-direction: column;
	align-items: center;
}

.stat__value {
	font-size: 34rpx;
	font-weight: 700;
	color: #ffffff;
}

.stat__label {
	margin-top: 4rpx;
	font-size: 20rpx;
	color: rgba(255, 255, 255, 0.8);
}

.category-grid {
	display: flex;
	flex-wrap: wrap;
	padding: 8rpx 16rpx;
}

.category-card {
	width: calc(50% - 16rpx);
	margin: 8rpx;
	padding: 24rpx;
	box-sizing: border-box;
	background-color: #ffffff;
	border: 1rpx solid #e8eef7;
	border-radius: 24rpx;
	display: flex;
	flex-direction: column;
	box-shadow: 0 8rpx 24rpx rgba(15, 23, 42, 0.04);
}

.category-card__icon {
	width: 68rpx;
	height: 68rpx;
	border-radius: 18rpx;
	display: flex;
	align-items: center;
	justify-content: center;
}

.category-card__title {
	margin-top: 14rpx;
	font-size: 27rpx;
	font-weight: 600;
	color: #0f172a;
}

.category-card__desc {
	margin-top: 6rpx;
	font-size: 20rpx;
	line-height: 1.5;
	color: #909399;
}

.category-card__total {
	margin-top: 10rpx;
	font-size: 20rpx;
	font-weight: 600;
	color: #2f6bff;
}

.notice-card {
	margin: 16rpx 24rpx;
	padding: 24rpx;
	background-color: #ffffff;
	border: 1rpx solid #e8eef7;
	border-radius: 24rpx;
	box-shadow: 0 8rpx 24rpx rgba(15, 23, 42, 0.04);
}

.notice-card__title {
	font-size: 28rpx;
	font-weight: 600;
	color: #303133;
}

.notice-card__code-meta {
	display: flex;
	align-items: center;
	justify-content: space-between;
	margin-top: 14rpx;
}

.notice-card__code-meta text {
	font-size: 17rpx;
	letter-spacing: 1rpx;
	color: #94a3b8;
}

.notice-card__code-scroll {
	margin-top: 8rpx;
	border-radius: 14rpx;
	overflow: hidden;
}

.notice-card__code {
	display: inline-block;
	box-sizing: border-box;
	min-width: 100%;
	padding: 20rpx;
	background-color: #0f172a;
}

.code-line {
	display: block;
	font-size: 20rpx;
	line-height: 1.9;
	color: #8ee6ff;
	white-space: pre;
	font-family: Menlo, Consolas, monospace;
}

.notice-card__tip {
	display: block;
	margin-top: 14rpx;
	font-size: 22rpx;
	color: #909399;
}

.group-card {
	margin: 16rpx 24rpx 0;
	padding: 24rpx;
	background-color: #ffffff;
	border: 1rpx solid #e8eef7;
	border-radius: 24rpx;
	box-shadow: 0 8rpx 24rpx rgba(15, 23, 42, 0.04);
}

.group-head {
	display: flex;
	align-items: center;
	justify-content: space-between;
}

.group-title {
	font-size: 28rpx;
	font-weight: 600;
	color: #303133;
}

.group-tip {
	font-size: 20rpx;
	color: #b0b3b8;
}

.comp-row {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 18rpx 0;
	border-bottom: 1rpx solid #f2f4f8;
}

.comp-main {
	flex: 1;
	display: flex;
	flex-direction: column;
}

.comp-tag {
	align-self: flex-start;
	padding: 4rpx 10rpx;
	border-radius: 6rpx;
	background: #eef4ff;
	font-size: 22rpx;
	color: #2f6bff;
	font-family: Menlo, Consolas, monospace;
}

.comp-name {
	margin-top: 4rpx;
	font-size: 26rpx;
	font-weight: 500;
	color: #303133;
}

.comp-note {
	margin-top: 4rpx;
	font-size: 20rpx;
	color: #909399;
}

.comp-go {
	padding-left: 20rpx;
}

.page-map {
	margin-top: 14rpx;
	display: flex;
	flex-wrap: wrap;
}

.page-map__item {
	width: calc(50% - 12rpx);
	margin: 6rpx;
	padding: 16rpx;
	box-sizing: border-box;
	background-color: #f8fafc;
	border: 1rpx solid #eef2f8;
	border-radius: 14rpx;
	display: flex;
	flex-direction: column;
}

.page-map__name {
	font-size: 24rpx;
	font-weight: 600;
	color: #303133;
}

.page-map__desc {
	margin-top: 4rpx;
	font-size: 20rpx;
	color: #909399;
}

.bottom-space {
	height: 40rpx;
}
</style>
