<script lang="ts" setup>
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useThemeStore } from '@/stores/theme'

const theme = useThemeStore()


const faqIndex = ref([0])
const statusBarHeight = ref(0)

onLoad(() => {
	statusBarHeight.value = uni.getSystemInfoSync().statusBarHeight || 0
})

const user = {
	name: '图鸟开发者',
	desc: 'TuniaoUI 全知识点示例工程',
	level: 'VIP 4',
	points: 1280,
	follow: 36,
	fans: 128,
	coupon: 5,
}

const quickActions = [
	{ icon: 'order', text: '业务闭环', color: 'tn-blue', url: '/pages/business/index', tab: false },
	{ icon: 'location', text: '收货地址', color: 'tn-orange', url: '/pages/form/index', tab: false },
	{ icon: 'coupon', text: '优惠券', color: 'tn-red', url: '/pages/detail/index?id=1', tab: false },
	{ icon: 'service', text: '联系客服', color: 'tn-green', url: '/pages/feedback/index', tab: false },
]

interface MineCell {
	icon: string
	title: string
	value: string
	url: string
	tab: boolean
	badge?: string
}

const cells: MineCell[] = [
	{ icon: 'order', title: '我的订单', value: '本地订单记录', url: '/pages-sub/orders/index', tab: false },
	{ icon: 'location', title: '收货地址', value: '江苏省 徐州市', url: '/pages/form/index', tab: false },
	{ icon: 'image-text', title: '我的收藏', value: '12 件商品', url: '/pages/data/index', tab: false },
	{ icon: 'code', title: '进阶 API', value: '类型 / 拦截 / 事件', url: '/pages/advanced/index', tab: false },
	{ icon: 'set', title: '偏好设置', value: '主题 / 语言', url: '/pages/theme/index', tab: true },
	{ icon: 'help', title: '关于项目', value: 'v1.0.0', url: '/pages/components/index', tab: true },
]

const faqs = [
	{
		title: '如何修改主题色？',
		content: 'TuniaoUI 的所有颜色都来自 CSS 变量 --tn-color-primary 与 --tn-color-primary-rgb。在任意容器上通过 :style 覆盖这两个变量，子组件会自动跟随变色，无需重新编译。示例见「主题与规范」页的换肤演示。',
	},
	{
		title: '为什么组件没有样式？',
		content: '需要在 App.vue 中引入原子类与主题样式：@tuniao/tn-style/dist/uniapp/index.css。若只在单个页面里引，TabBar 等其他页面会丢失样式。',
	},
	{
		title: '命令式组件怎么用？',
		content: 'TnModal / TnNotify / TnActionSheet 通过模板 ref 调用：const ref = ref(); ref.value.showModal({...})。confirm / cancel 返回 false 可阻止关闭。',
	},
	{
		title: '如何按需引入组件？',
		content: 'import { TnButton } from "@tuniao/tnui-vue3-uniapp"，再显式 app.component("TnButton", TnButton)。不要直接 app.use(默认导出)：组件内部 name 取自文件名，会被注册成 tabs 而不是 tn-tabs。详细原因见模块总览页「全量注册」说明。',
	},
]

const stack = [
	{ name: 'uni-app', version: '3.0.0-4020920240930001' },
	{ name: 'Vue', version: '3.4.21' },
	{ name: 'Vite', version: '5.x' },
	{ name: 'TypeScript', version: '5.x' },
	{ name: 'Sass', version: '1.x' },
	{ name: '@tuniao/tnui-vue3-uniapp', version: '1.0.23' },
	{ name: '@tuniao/tn-style', version: '1.0.20' },
	{ name: '@tuniao/tn-icon', version: '1.11.0' },
	{ name: 'vue-i18n', version: '11.4.23' },
	{ name: 'pinia', version: '2.1.7' },
]

const checkpoints = [
	'55 个组件模块全部注册并给出示例',
	'CSS 变量换肤 + 21 色板 + 16 组渐变',
	'838 个内置图标可检索 / 复制',
	'表单 validateField / 自定义 validator / 重置',
	'类型化实例 TnFormInstance / TnModalInstance',
	'beforeBack / beforeHome / Tabs beforeSwitch 拦截',
	'NoticeBar 纵向滚动 / SwipeAction open & select',
	'Tabbar 凸起 bulge / 角标 badge / 禁用 disabled',
	'命令式 Modal / Notify / ActionSheet',
	'Picker 单列 / 多列 / 级联三态',
	'日历 date / multi / range 三模式',
	'瀑布流 / 索引列表 / 轮播插槽',
	'vue-i18n 中英切换并持久化',
	'组件内置文案（Picker / ActionSheet / Loadmore / Empty）随语言切换',
	'subPackages 真实分包 + base64 图标字体本地化',
	'颜色命名规则：type 用语义，color 用调色板',
	'条件编译 H5 / MP-WEIXIN 差异 + 小程序检查清单',
	'实战模板：商城列表 + 商品详情',
	'TabBar 多页签路由与页面地图',
	'Pinia setup store：user / cart 两个独立 store',
	'uni.request 封装：token 注入 / 业务码 / 401 兜底',
	'订单分页 + onReachBottom 上拉加载 + onPullDownRefresh',
	'uni.login 登录态、购物车持久化与本地缓存恢复',
]

function go(url: string, tab?: boolean) {
	if (tab) uni.switchTab({ url })
	else uni.navigateTo({ url })
}

function onCell(item: any) {
	uni.showToast({ title: item.title, icon: 'none' })
	go(item.url, item.tab)
}

function onStat(name: string) {
	uni.showToast({ title: `查看${name}`, icon: 'none' })
}

function copyVersion() {
	uni.setClipboardData({
		data: 'TuniaoUI 1.0.23 / uni-app 3.0.0-4020920240930001',
		success: () => uni.showToast({ title: '版本信息已复制', icon: 'none' }),
	})
}
</script>

<template>
	<view class="page" :style="theme.vars">
		<!-- 用户信息 -->
		<view class="profile" :style="{ paddingTop: statusBarHeight ? `${statusBarHeight + 22}px` : '44rpx' }">
			<view class="profile-top">
				<tn-avatar icon="girl" bg-color="tn-white" :icon-config="{ color: '#4b7dff', size: 48 }" :size="120" shape="circle" />
				<view class="profile-info">
					<view class="tn-flex tn-flex-center-start">
						<text class="profile-name">{{ user.name }}</text>
						<tn-tag type="warning" size="sm" shape="circle" class="tn-ml-xs">{{ user.level }}</tn-tag>
					</view>
					<text class="profile-desc">{{ user.desc }}</text>
				</view>
				<tn-icon name="set" :size="40" color="#ffffff" @click="go('/pages/theme/index', true)" />
			</view>

			<view class="profile-stats">
				<view class="profile-stat" @click="onStat('积分')">
					<text class="profile-stat__value">{{ user.points }}</text>
					<text class="profile-stat__label">积分</text>
				</view>
				<view class="profile-stat">
					<text class="profile-stat__value">{{ user.follow }}</text>
					<text class="profile-stat__label">关注</text>
				</view>
				<view class="profile-stat">
					<text class="profile-stat__value">{{ user.fans }}</text>
					<text class="profile-stat__label">粉丝</text>
				</view>
				<view class="profile-stat">
					<text class="profile-stat__value">{{ user.coupon }}</text>
					<text class="profile-stat__label">优惠券</text>
				</view>
			</view>
		</view>

		<!-- 快捷入口 -->
		<view class="quick-card">
			<view v-for="item in quickActions" :key="item.text" class="quick-item" @click="go(item.url, item.tab)">
				<view class="quick-icon" :class="[`tn-${String(item.color).replace('tn-', '')}_bg`]">
					<tn-icon :name="item.icon" :size="32" color="#ffffff" />
				</view>
				<text class="quick-text">{{ item.text }}</text>
			</view>
		</view>

		<!-- 功能列表 -->
		<view class="cell-group">
			<view v-for="item in cells" :key="item.title" class="cell-row" @click="onCell(item)">
				<view class="tn-flex tn-flex-center-start">
					<tn-icon :name="item.icon" :size="34" color="tn-blue" />
					<text class="cell-title">{{ item.title }}</text>
					<tn-badge v-if="item.badge" :value="item.badge" type="danger" class="tn-ml-xs" />
				</view>
				<view class="tn-flex tn-flex-center-start">
					<text class="cell-value">{{ item.value }}</text>
					<tn-icon name="right" :size="28" color="tn-grey" />
				</view>
			</view>
		</view>

		<!-- 常见问题 -->
		<view class="block-card">
			<text class="block-title">常见问题</text>
			<tn-collapse v-model="faqIndex" :accordion="false" class="tn-mt-sm">
				<tn-collapse-item v-for="faq in faqs" :key="faq.title" :title="faq.title">
					<view class="faq-content">{{ faq.content }}</view>
				</tn-collapse-item>
			</tn-collapse>
		</view>

		<!-- 技术栈 -->
		<view class="block-card">
			<text class="block-title">技术栈与依赖</text>
			<view class="stack-grid">
				<view v-for="s in stack" :key="s.name" class="stack-item">
					<text class="stack-name">{{ s.name }}</text>
					<text class="stack-version">{{ s.version }}</text>
				</view>
			</view>
		</view>

		<!-- 知识点清单 -->
		<view class="block-card">
			<text class="block-title">知识点覆盖清单</text>
			<view class="check-list">
				<view v-for="(c, i) in checkpoints" :key="i" class="check-item">
					<tn-icon name="check" :size="26" color="tn-green" />
					<text class="check-text">{{ c }}</text>
				</view>
			</view>
		</view>

		<!-- 版本信息 -->
		<view class="version-card" @click="copyVersion">
			<tn-icon name="tips" :size="34" color="tn-grey" />
			<text class="version-text">TuniaoUI 全知识点示例 · v1.0.0</text>
			<text class="version-sub">uni-app 3.0 · Vue 3.4 · Vite 5 · TS · Sass</text>
		</view>

		<tn-footer
			:fixed="false"
			:navigator="[
				{ title: '组件总览', url: '/pages/components/index' },
				{ title: '主题规范', url: '/pages/theme/index' },
				{ title: '实战模板', url: '/pages/template/index' },
			]"
			content="Made with TuniaoUI · 仅用于学习与演示"
		/>
	</view>
</template>

<style lang="scss" scoped>
.page {
	background-color: var(--demo-bg);
	min-height: 100vh;
	padding-bottom: 20rpx;
}

.profile {
	padding: 44rpx 28rpx 40rpx;
	background: linear-gradient(145deg, #0b1220 0%, #172554 58%, #1e40af 100%);
	border-radius: 0 0 36rpx 36rpx;
	box-shadow: 0 16rpx 40rpx rgba(15, 23, 42, 0.16);
}

.profile-top {
	display: flex;
	align-items: center;
}

.profile-info {
	flex: 1;
	margin-left: 22rpx;
}

.profile-name {
	font-size: 34rpx;
	font-weight: 700;
	color: #ffffff;
}

.profile-desc {
	display: block;
	margin-top: 8rpx;
	font-size: 22rpx;
	color: rgba(255, 255, 255, 0.85);
}

.profile-stats {
	margin-top: 32rpx;
	display: flex;
	padding-top: 24rpx;
	border-top: 1rpx solid rgba(255, 255, 255, 0.18);
}

.profile-stat {
	flex: 1;
	display: flex;
	flex-direction: column;
	align-items: center;
}

.profile-stat__value {
	font-size: 32rpx;
	font-weight: 700;
	color: #ffffff;
}

.profile-stat__label {
	margin-top: 4rpx;
	font-size: 20rpx;
	color: rgba(255, 255, 255, 0.8);
}

.quick-card {
	margin: -26rpx 24rpx 0;
	padding: 26rpx 8rpx;
	display: flex;
	background-color: var(--demo-surface);
	border: 1rpx solid var(--demo-line);
	border-radius: 22rpx;
	box-shadow: 0 12rpx 30rpx rgba(15, 23, 42, 0.07);
	position: relative;
	z-index: 2;
}

.quick-item {
	width: 25%;
	display: flex;
	flex-direction: column;
	align-items: center;
}

.quick-icon {
	width: 72rpx;
	height: 72rpx;
	border-radius: 18rpx;
	display: flex;
	align-items: center;
	justify-content: center;
}

.quick-text {
	margin-top: 10rpx;
	font-size: 22rpx;
	color: var(--demo-muted);
}

.cell-group {
	margin: 18rpx 24rpx 0;
	background-color: var(--demo-surface);
	border: 1rpx solid var(--demo-line);
	border-radius: 22rpx;
	overflow: hidden;
	box-shadow: 0 10rpx 26rpx rgba(15, 23, 42, 0.04);
}

.cell-row {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 26rpx 24rpx;
	border-bottom: 1rpx solid #f2f4f8;
}

.cell-title {
	margin-left: 12rpx;
	font-size: 26rpx;
	color: var(--demo-text);
}

.cell-value {
	margin-right: 8rpx;
	font-size: 22rpx;
	color: var(--demo-faint);
}

.block-card {
	margin: 18rpx 24rpx 0;
	padding: 26rpx 24rpx;
	background-color: var(--demo-surface);
	border: 1rpx solid var(--demo-line);
	border-radius: 22rpx;
	box-shadow: 0 10rpx 26rpx rgba(15, 23, 42, 0.04);
}

.block-title {
	font-size: 28rpx;
	font-weight: 600;
	color: var(--demo-text);
}

.faq-content {
	font-size: 24rpx;
	line-height: 1.9;
	color: var(--demo-muted);
}

.stack-grid {
	margin-top: 16rpx;
	display: flex;
	flex-wrap: wrap;
}

.stack-item {
	width: calc(33.33% - 12rpx);
	margin: 6rpx;
	padding: 16rpx 12rpx;
	box-sizing: border-box;
	background-color: var(--demo-soft);
	border-radius: 12rpx;
	display: flex;
	flex-direction: column;
}

.stack-name {
	font-size: 20rpx;
	font-weight: 600;
	color: var(--demo-text);
}

.stack-version {
	margin-top: 4rpx;
	font-size: 18rpx;
	color: var(--demo-faint);
}

.check-list {
	margin-top: 12rpx;
}

.check-item {
	display: flex;
	align-items: center;
	padding: 10rpx 0;
}

.check-text {
	margin-left: 10rpx;
	font-size: 23rpx;
	color: var(--demo-muted);
}

.version-card {
	margin: 20rpx 24rpx 0;
	padding: 28rpx 24rpx;
	display: flex;
	flex-direction: column;
	align-items: center;
	background-color: var(--demo-surface);
	border: 1rpx solid var(--demo-line);
	border-radius: 22rpx;
	box-shadow: 0 10rpx 26rpx rgba(15, 23, 42, 0.04);
}

.version-text {
	margin-top: 10rpx;
	font-size: 24rpx;
	color: var(--demo-muted);
}

.version-sub {
	margin-top: 6rpx;
	font-size: 20rpx;
	color: var(--demo-faint);
}
</style>
