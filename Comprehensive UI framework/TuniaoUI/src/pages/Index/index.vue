<script lang="ts" setup>
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { onLoad, onShow, onPullDownRefresh } from '@dcloudio/uni-app'
import type { FooterNavigator } from '@tuniao/tnui-vue3-uniapp'
import { tnIconCount } from '@/data/icons'
import { noticeList } from '@/data/mock'
import { localeOptions, setLocale } from '@/i18n'

const { t, locale } = useI18n()

/** 自定义导航栏时用状态栏高度占位，避免 Hero 顶到刘海 */
const statusBarHeight = ref(0)

/** 知识点：页面生命周期 onLoad / onShow / onPullDownRefresh */
const launchTime = ref('')

onLoad(() => {
	const info = uni.getSystemInfoSync()
	statusBarHeight.value = info.statusBarHeight || 0
	launchTime.value = new Date().toLocaleTimeString()
})

onShow(() => {
	const cached = uni.getStorageSync('tn-demo-locale')
	if (cached && cached !== locale.value) {
		locale.value = cached
	}
})

onPullDownRefresh(() => {
	setTimeout(() => {
		uni.stopPullDownRefresh()
		uni.showToast({ title: '刷新完成', icon: 'none' })
	}, 600)
})

const stats = computed(() => [
	{ value: '55', label: '组件' },
	{ value: `${tnIconCount}`, label: '图标' },
	{ value: '21', label: '色板' },
	{ value: '16', label: '知识页' },
])

interface NavItem {
	title: string
	desc: string
	icon: string
	url: string
	color: string
	tab?: boolean
}

const navList: NavItem[] = [
	{ title: '基础组件', desc: 'Button / Icon / Avatar / Tag / Badge / Title', icon: 'cube', url: '/pages/basic/index', color: 'blue' },
	{ title: '布局与原子类', desc: 'tn-flex / 宽高 / 间距 / 圆角 / 阴影 / 文本截断', icon: 'menu-grille', url: '/pages/layout/index', color: 'aquablue' },
	{ title: '表单组件', desc: 'Input / Checkbox / Radio / Picker / 上传 / 校验', icon: 'edit-form', url: '/pages/form/index', color: 'purple' },
	{ title: '反馈组件', desc: 'Modal / Notify / Popup / 进度条 / 加载', icon: 'message', url: '/pages/feedback/index', color: 'orange' },
	{ title: '导航组件', desc: 'Navbar / Tabs / Tabbar / Steps / 滑动操作', icon: 'menu', url: '/pages/nav/index', color: 'green' },
	{ title: '数据展示', desc: 'Calendar / Swiper / 瀑布流 / 相册 / 索引列表', icon: 'charts-column', url: '/pages/data/index', color: 'teal' },
	{ title: '进阶 API', desc: 'validateField / beforeBack / beforeSwitch / 事件全集 / 内置文案 i18n', icon: 'code', url: '/pages/advanced/index', color: 'blue' },
	{ title: '跨端与系统 API', desc: '生命周期 / 网络监听 / 分享 / 扫码 / 定位 / 能力探测', icon: 'phone', url: '/pages/cross-platform/index', color: 'aquablue' },
	{ title: '业务闭环', desc: 'Pinia / 请求封装 / 登录态 / 购物车 / 分页 / 下拉刷新', icon: 'order', url: '/pages/business/index', color: 'orange' },
	{ title: '工程化 · 分包', desc: 'subPackages / 按需引入 / 图标字体本地化 / 小程序清单', icon: 'cube', url: '/pages-sub/engineering/index', color: 'aquablue' },
	{ title: '主题 · 图标 · 多语言', desc: 'CSS 变量换肤 / 838 图标检索 / vue-i18n', icon: 'creative', url: '/pages/theme/index', color: 'red', tab: true },
	{ title: '实战模板', desc: '商品详情页：导航 + 轮播 + 表单 + 弹层组合', icon: 'image-text', url: '/pages/template/index', color: 'grey', tab: true },
]

const primaryNav = navList.slice(0, 6)
const featureNav = navList.slice(6, 9)
const moreNav = navList.slice(9)
const featureKickers = ['TYPES · INTERCEPT', 'PLATFORM · API', 'STATE · REQUEST']

const footerNav: FooterNavigator[] = [
	{ title: '官方文档', url: 'https://vue3.tuniaokj.com' },
	{ title: 'GitHub', url: 'https://github.com/tuniaoTech/tuniaoui-rc-vue3-uniapp' },
]

function go(item: NavItem) {
	if (item.tab) {
		uni.switchTab({ url: item.url })
		return
	}
	uni.navigateTo({ url: item.url })
}

/** 顶部语言快捷切换，演示 i18n 与按钮文案联动 */
function quickSwitchLang() {
	const next = localeOptions.find((o) => o.value !== locale.value)
	if (next) setLocale(next.value)
}

const rateValue = ref(4)
</script>

<template>
	<view class="home" :style="{ paddingTop: statusBarHeight ? `${statusBarHeight}px` : '20rpx' }">
		<view class="hero">
			<view class="hero__orb hero__orb--one" />
			<view class="hero__orb hero__orb--two" />
			<view class="hero__top">
				<view class="hero__brand">
					<view class="hero__logo">
						<text>Tn</text>
					</view>
					<view class="hero__brand-copy">
						<text class="hero__brand-name">TuniaoUI</text>
						<text class="hero__brand-ver">1.0.23 · Nightly</text>
					</view>
				</view>
				<view class="hero__lang" @click="quickSwitchLang">
					<tn-icon name="english" :size="22" color="#dbeafe" />
					<text>{{ locale === 'zh-Hans' ? 'EN' : '中文' }}</text>
				</view>
			</view>

			<view class="hero__eyebrow">
				<view class="hero__eyebrow-dot" />
				<text>UNI-APP · VUE 3 · TYPESCRIPT</text>
			</view>

			<text class="hero__title">{{ t('home.heroTitle') }}</text>
			<text class="hero__desc">{{ t('home.heroDesc') }}</text>

			<view class="hero__actions">
				<tn-button
					type="primary"
					bg-color="#ffffff"
					text-color="#0f172a"
					shape="round"
					@click="go(navList[0])"
				>
					{{ t('home.start') }}
				</tn-button>
				<view class="hero__ghost" @click="go(navList[6])">
					<text>进阶 API</text>
					<tn-icon name="right" :size="20" color="#bfdbfe" />
				</view>
			</view>

			<view class="hero__stats">
				<view v-for="item in stats" :key="item.label" class="hero-stat">
					<text class="hero-stat__value">{{ item.value }}</text>
					<text class="hero-stat__label">{{ item.label }}</text>
				</view>
			</view>
		</view>

		<view class="notice" @click="go(navList[0])">
			<view class="notice__icon">
				<tn-icon name="notice" :size="26" color="#f97316" />
			</view>
			<text class="notice__text">{{ noticeList[0] }}</text>
			<tn-icon name="right" :size="18" color="#f97316" />
		</view>

		<view class="section-head">
			<view class="section-head__copy">
				<text class="section-head__eyebrow">EXPLORE</text>
				<text class="section-head__title">{{ t('home.map') }}</text>
			</view>
			<text class="section-head__meta">点击卡片进入</text>
		</view>

		<view class="nav-grid">
			<view
				v-for="item in primaryNav"
				:key="item.url"
				class="nav-card"
				hover-class="nav-card--hover"
				@click="go(item)"
			>
				<view class="nav-card__icon" :class="[`tn-${item.color}_bg`]">
					<tn-icon :name="item.icon" :size="32" color="#ffffff" />
				</view>
				<text class="nav-card__title">{{ item.title }}</text>
				<text class="nav-card__desc">{{ item.desc }}</text>
				<tn-icon class="nav-card__arrow" name="right" :size="18" color="#94a3b8" />
			</view>
		</view>

		<view class="section-head section-head--tight">
			<view class="section-head__copy">
				<text class="section-head__eyebrow">DEEP DIVE</text>
				<text class="section-head__title">重点专题</text>
				<view class="section-head__line" />
			</view>
		</view>

		<view class="feature-stack">
			<view
				v-for="(item, index) in featureNav"
				:key="item.url"
				class="feature-card"
				:class="`feature-card--${index + 1}`"
				hover-class="feature-card--hover"
				@click="go(item)"
			>
				<view class="feature-card__meta">
					<text class="feature-card__num">0{{ index + 1 }}</text>
					<text class="feature-card__label">{{ featureKickers[index] }}</text>
				</view>
				<text class="feature-card__title">{{ item.title }}</text>
				<text class="feature-card__desc">{{ item.desc }}</text>
				<view class="feature-card__link">
					<text>打开专题</text>
					<tn-icon name="right" :size="18" :color="index === 0 ? '#a5f3fc' : '#2f6bff'" />
				</view>
			</view>
		</view>

		<view class="section-head section-head--tight">
			<view class="section-head__copy">
				<text class="section-head__eyebrow">MORE</text>
				<text class="section-head__title">更多页面</text>
			</view>
		</view>

		<view class="more-list">
			<view v-for="item in moreNav" :key="item.url" class="more-row" @click="go(item)">
				<view class="more-row__icon">
					<tn-icon :name="item.icon" :size="30" color="#2f6bff" />
				</view>
				<view class="more-row__body">
					<text class="more-row__title">{{ item.title }}</text>
					<text class="more-row__desc">{{ item.desc }}</text>
				</view>
				<tn-icon name="right" :size="20" color="#94a3b8" />
			</view>
		</view>

		<demo-block
			title="组件速览"
			desc="全量注册 / 原子类 / 组件插槽 / 命令式弹窗 / CSS 变量换肤 / 多语言"
		>
			<view class="tn-demo-row">
				<tn-tag type="primary" size="sm">app.use 全量注册</tn-tag>
				<tn-tag type="success" size="sm">easycom 自动引入</tn-tag>
				<tn-tag type="warning" size="sm">v-model 双向绑定</tn-tag>
				<tn-tag type="danger" size="sm">ref.show() 命令式</tn-tag>
				<tn-tag type="info" size="sm">条件编译</tn-tag>
			</view>
			<view class="quick-row">
				<tn-avatar icon="girl" type="primary" :size="48" />
				<tn-avatar icon="boy" type="success" :size="48" />
				<tn-avatar url="/static/demo/goods-1.jpg" :size="48" />
				<tn-badge value="9" />
				<tn-rate v-model="rateValue" />
			</view>
		</demo-block>

		<tn-footer
			content="TuniaoUI · 全知识点示例工程"
			:fixed="false"
			:navigator="footerNav"
		/>
	</view>
</template>

<style lang="scss" scoped>
.home {
	padding: 20rpx 0 40rpx;
}

.hero {
	position: relative;
	margin: 0 28rpx 24rpx;
	padding: 34rpx 30rpx 28rpx;
	border-radius: 36rpx;
	overflow: hidden;
	background: linear-gradient(145deg, #0b1220 0%, #12203f 52%, #1d3a8a 100%);
	box-shadow: 0 24rpx 60rpx rgba(15, 23, 42, 0.22);
	color: #ffffff;
}

.hero__orb {
	position: absolute;
	width: 360rpx;
	height: 360rpx;
	border-radius: 50%;
	pointer-events: none;
}

.hero__orb--one {
	top: -180rpx;
	right: -120rpx;
	background: radial-gradient(circle, rgba(34, 211, 238, 0.45) 0%, rgba(34, 211, 238, 0) 68%);
}

.hero__orb--two {
	left: -160rpx;
	bottom: -220rpx;
	background: radial-gradient(circle, rgba(99, 102, 241, 0.42) 0%, rgba(99, 102, 241, 0) 70%);
}

.hero__top {
	position: relative;
	display: flex;
	align-items: center;
	justify-content: space-between;
}

.hero__brand {
	display: flex;
	align-items: center;
}

.hero__logo {
	width: 56rpx;
	height: 56rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	border: 1rpx solid rgba(255, 255, 255, 0.25);
	border-radius: 16rpx;
	background: rgba(255, 255, 255, 0.1);
	font-size: 24rpx;
	font-weight: 700;
	color: #e0f2fe;
}

.hero__brand-copy {
	margin-left: 14rpx;
	display: flex;
	flex-direction: column;
}

.hero__brand-name {
	font-size: 26rpx;
	font-weight: 700;
	letter-spacing: 1rpx;
}

.hero__brand-ver {
	margin-top: 2rpx;
	font-size: 18rpx;
	color: rgba(226, 232, 240, 0.6);
}

.hero__lang {
	display: flex;
	align-items: center;
	padding: 10rpx 18rpx;
	border: 1rpx solid rgba(255, 255, 255, 0.18);
	border-radius: 999rpx;
	background: rgba(255, 255, 255, 0.06);
}

.hero__lang text {
	margin-left: 8rpx;
	font-size: 20rpx;
	color: #dbeafe;
}

.hero__eyebrow {
	position: relative;
	display: flex;
	align-items: center;
	margin-top: 34rpx;
}

.hero__eyebrow-dot {
	width: 10rpx;
	height: 10rpx;
	margin-right: 12rpx;
	border-radius: 50%;
	background: #22d3ee;
	box-shadow: 0 0 16rpx rgba(34, 211, 238, 0.8);
}

.hero__eyebrow text {
	font-size: 18rpx;
	font-weight: 600;
	letter-spacing: 2rpx;
	color: rgba(186, 230, 253, 0.82);
}

.hero__title {
	position: relative;
	display: block;
	margin-top: 16rpx;
	font-size: 46rpx;
	font-weight: 800;
	line-height: 1.28;
	letter-spacing: -1rpx;
}

.hero__desc {
	position: relative;
	display: block;
	margin-top: 14rpx;
	max-width: 560rpx;
	font-size: 24rpx;
	line-height: 1.75;
	color: rgba(226, 232, 240, 0.78);
}

.hero__actions {
	position: relative;
	display: flex;
	align-items: center;
	margin-top: 30rpx;
}

.hero__ghost {
	display: flex;
	align-items: center;
	margin-left: 22rpx;
	padding: 14rpx 20rpx;
	border: 1rpx solid rgba(191, 219, 254, 0.24);
	border-radius: 999rpx;
}

.hero__ghost text {
	margin-right: 6rpx;
	font-size: 22rpx;
	color: #bfdbfe;
}

.hero__stats {
	position: relative;
	display: flex;
	margin-top: 32rpx;
	padding-top: 24rpx;
	border-top: 1rpx solid rgba(255, 255, 255, 0.12);
}

.hero-stat {
	flex: 1;
	display: flex;
	flex-direction: column;
}

.hero-stat__value {
	font-size: 34rpx;
	font-weight: 700;
	color: #ffffff;
}

.hero-stat__label {
	margin-top: 4rpx;
	font-size: 19rpx;
	color: rgba(203, 213, 225, 0.7);
}

.notice {
	display: flex;
	align-items: center;
	margin: 0 28rpx 24rpx;
	padding: 16rpx 20rpx;
	border: 1rpx solid #ffedd5;
	border-radius: 18rpx;
	background: #fff7ed;
}

.notice__icon {
	width: 44rpx;
	height: 44rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	border-radius: 12rpx;
	background: #ffedd5;
}

.notice__text {
	flex: 1;
	margin: 0 12rpx;
	font-size: 21rpx;
	line-height: 1.5;
	color: #c2410c;
	overflow: hidden;
	white-space: nowrap;
	text-overflow: ellipsis;
}

.section-head {
	display: flex;
	align-items: flex-end;
	justify-content: space-between;
	margin: 28rpx 30rpx 18rpx;
}

.section-head--tight {
	margin-top: 38rpx;
}

.section-head__copy {
	display: flex;
	flex-direction: column;
}

.section-head__eyebrow {
	font-size: 18rpx;
	font-weight: 600;
	letter-spacing: 2rpx;
	color: #2f6bff;
}

.section-head__title {
	display: block;
	margin-top: 4rpx;
	font-size: 32rpx;
	font-weight: 700;
	color: #0f172a;
}

.section-head__line {
	width: 44rpx;
	height: 4rpx;
	margin-top: 10rpx;
	border-radius: 4rpx;
	background: linear-gradient(90deg, #06b6d4, #2f6bff);
}

.section-head__meta {
	font-size: 21rpx;
	color: #94a3b8;
}

.nav-grid {
	display: flex;
	flex-wrap: wrap;
	padding: 0 20rpx;
}

.nav-card {
	position: relative;
	width: calc(50% - 16rpx);
	box-sizing: border-box;
	margin: 8rpx;
	padding: 24rpx;
	background: #ffffff;
	border: 1rpx solid #e8eef7;
	border-radius: 24rpx;
	box-shadow: 0 8rpx 24rpx rgba(15, 23, 42, 0.04);
}

.nav-card--hover {
	opacity: 0.9;
}

.nav-card__icon {
	width: 64rpx;
	height: 64rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	border-radius: 18rpx;
	box-shadow: 0 8rpx 18rpx rgba(47, 107, 255, 0.18);
}

.nav-card__title {
	display: block;
	margin-top: 19rpx;
	font-size: 27rpx;
	font-weight: 600;
	color: #0f172a;
}

.nav-card__desc {
	display: -webkit-box;
	margin-top: 7rpx;
	font-size: 20rpx;
	line-height: 1.55;
	color: #7b8794;
	overflow: hidden;
	-webkit-box-orient: vertical;
	-webkit-line-clamp: 2;
}

.nav-card__arrow {
	position: absolute;
	top: 26rpx;
	right: 22rpx;
}

.feature-stack {
	padding: 0 28rpx;
}

.feature-card {
	margin-bottom: 20rpx;
	padding: 28rpx;
	border-radius: 28rpx;
	border: 1rpx solid #e8eef7;
	background: #ffffff;
	box-shadow: 0 12rpx 32rpx rgba(15, 23, 42, 0.05);
}

.feature-card--hover {
	opacity: 0.92;
}

.feature-card--1 {
	border-color: transparent;
	background: linear-gradient(135deg, #111827 0%, #1e3a8a 100%);
	box-shadow: 0 18rpx 44rpx rgba(15, 23, 42, 0.2);
}

.feature-card--2 {
	background: linear-gradient(135deg, #eff6ff 0%, #e0f2fe 100%);
	border-color: #dbeafe;
}

.feature-card__meta {
	display: flex;
	align-items: center;
}

.feature-card__num {
	font-size: 18rpx;
	font-weight: 700;
	letter-spacing: 2rpx;
	color: #06b6d4;
}

.feature-card__label {
	margin-left: 12rpx;
	font-size: 18rpx;
	letter-spacing: 1rpx;
	color: #94a3b8;
}

.feature-card__title {
	display: block;
	margin-top: 10rpx;
	font-size: 32rpx;
	font-weight: 700;
	color: #0f172a;
}

.feature-card__desc {
	display: block;
	margin-top: 10rpx;
	font-size: 22rpx;
	line-height: 1.7;
	color: #64748b;
}

.feature-card__link {
	display: flex;
	align-items: center;
	margin-top: 20rpx;
	font-size: 21rpx;
	font-weight: 600;
	color: #2f6bff;
}

.feature-card__link text {
	margin-right: 6rpx;
}

.feature-card--1 .feature-card__num {
	color: #67e8f9;
}

.feature-card--1 .feature-card__label {
	color: rgba(203, 213, 225, 0.6);
}

.feature-card--1 .feature-card__title {
	color: #ffffff;
}

.feature-card--1 .feature-card__desc {
	color: rgba(226, 232, 240, 0.76);
}

.feature-card--1 .feature-card__link {
	color: #a5f3fc;
}

.more-list {
	margin: 0 28rpx;
	padding: 4rpx 24rpx;
	background: #ffffff;
	border: 1rpx solid #e8eef7;
	border-radius: 24rpx;
}

.more-row {
	display: flex;
	align-items: center;
	padding: 22rpx 0;
	border-bottom: 1rpx solid #f0f4fa;
}

.more-row:last-child {
	border-bottom: none;
}

.more-row__icon {
	width: 64rpx;
	height: 64rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	border-radius: 18rpx;
	background: #eef4ff;
}

.more-row__body {
	flex: 1;
	margin-left: 18rpx;
	display: flex;
	flex-direction: column;
}

.more-row__title {
	font-size: 26rpx;
	font-weight: 600;
	color: #0f172a;
}

.more-row__desc {
	margin-top: 5rpx;
	font-size: 20rpx;
	color: #7b8794;
}

.quick-row {
	display: flex;
	align-items: center;
	gap: 20rpx;
	margin-top: 24rpx;
}
</style>
