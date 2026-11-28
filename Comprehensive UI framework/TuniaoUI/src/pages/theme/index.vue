<script lang="ts" setup>
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useI18n } from 'vue-i18n'
import { tnIcons } from '@/data/icons'
import { localeOptions, setLocale } from '@/i18n'
import { useThemeStore } from '@/stores/theme'

const theme = useThemeStore()


const { t, locale } = useI18n()
const statusBarHeight = ref(0)

onLoad(() => {
	statusBarHeight.value = uni.getSystemInfoSync().statusBarHeight || 0
})

/* ---------------- 1. CSS 变量换肤 ---------------- */
const primaryPresets = [
	{ name: '图鸟蓝', value: '#01beff' },
	{ name: '紫罗兰', value: '#5f4fd9' },
	{ name: '薄荷绿', value: '#00d886' },
	{ name: '活力橙', value: '#ff7043' },
	{ name: '玫瑰红', value: '#ff444f' },
	{ name: '曜石黑', value: '#2f3542' },
]

const primaryColor = ref(primaryPresets[0].value)

function hexToRgb(hex: string) {
	const h = hex.replace('#', '')
	const r = parseInt(h.substring(0, 2), 16)
	const g = parseInt(h.substring(2, 4), 16)
	const b = parseInt(h.substring(4, 6), 16)
	return `${r},${g},${b}`
}

/** 关键：同时覆盖主色与 rgb 版本，组件里的 rgba(var(--tn-color-primary-rgb), .x) 才会一起变 */
const themeStyle = computed(() => ({
	'--tn-color-primary': primaryColor.value,
	'--tn-color-primary-rgb': hexToRgb(primaryColor.value),
}))

/* ---------------- 2. 色板 ---------------- */
const colors = [
	'red', 'purplered', 'purple', 'bluepurple', 'aquablue', 'blue', 'indigo', 'cyan',
	'teal', 'green', 'yellowgreen', 'lime', 'yellow', 'orangeyellow', 'orange',
	'orangered', 'brown', 'grey', 'gray', 'black',
]

/* ---------------- 3. 渐变 ---------------- */
const coolGradients = Array.from({ length: 16 }, (_, i) => i + 1)
const activeColor = ref('blue')
const activeGradient = ref(8)

function copyColor(color: string) {
	activeColor.value = color
	uni.setClipboardData({
		data: `tn-${color}_bg`,
		success: () => uni.showToast({ title: `已复制 tn-${color}_bg`, icon: 'none' }),
	})
}

function copyGradient(n: number) {
	activeGradient.value = n
	uni.setClipboardData({
		data: `tn-gradient-bg__cool-${n}`,
		success: () => uni.showToast({ title: `已复制 cool-${n}`, icon: 'none' }),
	})
}

/* ---------------- 4. 图标检索 ---------------- */
const iconKeyword = ref('')
const iconPageSize = ref(120)

const filteredIcons = computed(() => {
	const kw = iconKeyword.value.trim().toLowerCase()
	if (!kw) return tnIcons
	return tnIcons.filter((name) => name.includes(kw))
})
const visibleIcons = computed(() => filteredIcons.value.slice(0, iconPageSize.value))
const hasMoreIcons = computed(() => visibleIcons.value.length < filteredIcons.value.length)

function loadMoreIcons() {
	iconPageSize.value += 120
}

function copyIcon(name: string) {
	uni.setClipboardData({
		data: `<tn-icon name="${name}" />`,
		success: () => uni.showToast({ title: '已复制图标名', icon: 'none' }),
	})
}

/* ---------------- 5. 多语言 ---------------- */
const langIndex = computed(() => localeOptions.findIndex((o) => o.value === locale.value))

function switchLang(index: number) {
	setLocale(localeOptions[index].value)
}

/* ---------------- 6. 条件编译 ---------------- */
let platform = '其他平台'
// #ifdef H5
platform = 'H5（浏览器）'
// #endif
// #ifdef MP-WEIXIN
platform = '微信小程序'
// #endif
// #ifdef APP-PLUS
platform = 'App（Android / iOS）'
// #endif
</script>

<template>
	<view class="page" :style="[{ paddingTop: statusBarHeight ? `${statusBarHeight + 12}px` : '24rpx' }, theme.vars]">
		<view class="page-header">
			<text class="page-header__eyebrow">DESIGN SYSTEM</text>
			<text class="page-header__title">{{ t('themePage.title') }}</text>
			<text class="page-header__desc">
				{{ t('themePage.desc') }}
			</text>
		</view>

		<!-- 外观模式 -->
		<view class="appearance-card">
			<view class="appearance-copy">
				<text class="appearance-eyebrow">APPEARANCE</text>
				<text class="appearance-title">{{ t('themePage.appearance') }}</text>
				<text class="appearance-desc">{{ t('themePage.appearanceDesc') }}</text>
			</view>
			<view class="appearance-switch" :class="{ 'appearance-switch--dark': theme.isDark }" @click="theme.toggle()">
				<tn-icon :name="theme.isDark ? 'moon-fill' : 'wea-sun'" :size="34" :color="theme.isDark ? '#67e8f9' : '#2f6bff'" />
			</view>
			<view class="appearance-options">
				<view class="appearance-option" :class="{ 'appearance-option--active': !theme.isDark }" @click="theme.setMode('light')">
					<tn-icon name="wea-sun" :size="26" :color="!theme.isDark ? '#2f6bff' : '#748199'" />
					<text>{{ t('themePage.light') }}</text>
				</view>
				<view class="appearance-option" :class="{ 'appearance-option--active': theme.isDark }" @click="theme.setMode('dark')">
					<tn-icon name="moon-fill" :size="24" :color="theme.isDark ? '#67e8f9' : '#748199'" />
					<text>{{ t('themePage.dark') }}</text>
				</view>
			</view>
		</view>

		<!-- 换肤 -->
		<demo-block
			title="CSS 变量换肤"
			desc="组件内部颜色全部走 --tn-color-* 变量。改 2 个变量即可全局换肤，不用重新编译 sass"
			code=":style=&quot;{ '--tn-color-primary': color, '--tn-color-primary-rgb': rgb }&quot;"
		>
			<view
				class="theme-scope"
				:class="{ 'theme-scope--dark': theme.isDark }"
				:style="[
					themeStyle,
					theme.vars,
					{ backgroundColor: theme.isDark ? '#0d1625' : '#f4f7fb' },
				]"
			>
				<view class="tn-demo-row">
					<tn-button type="primary" icon="check">主色按钮</tn-button>
					<tn-button type="primary" plain>朴素</tn-button>
					<tn-tag type="primary">标签</tn-tag>
					<tn-switch :model-value="true" />
					<tn-badge value="12" type="primary" />
				</view>
				<view class="tn-demo-row section-gap">
					<tn-line-progress :percent="68" show-percent />
				</view>
				<view class="tn-demo-row section-gap">
					<tn-avatar icon="ai" bg-color="var(--tn-color-primary)" :size="44" />
					<tn-loading show mode="circle" color="var(--tn-color-primary)" :size="36" />
				</view>
			</view>

			<view class="preset-row section-gap">
				<view
					v-for="item in primaryPresets"
					:key="item.value"
					class="preset"
					:class="{ 'preset--active': primaryColor === item.value }"
					:style="{ backgroundColor: item.value }"
					@click="primaryColor = item.value"
				>
					<tn-icon v-if="primaryColor === item.value" name="check" :size="26" color="#ffffff" />
				</view>
			</view>
			<text class="tn-gray_text tn-mt-sm">当前主色：{{ primaryColor }}，rgb：{{ hexToRgb(primaryColor) }}</text>
		</demo-block>

		<!-- 色板 -->
		<demo-block
			title="21 种内置色板"
			desc="命名规则 tn-{颜色}_{属性}；点击色块会复制对应的背景类，下面再对比 light / dark / disabled 三档"
			code="<text class=&quot;tn-red_text&quot;>  <view class=&quot;tn-blue_light_bg&quot;>"
		>
			<view class="palette-grid">
				<view
					v-for="color in colors"
					:key="color"
					class="palette-cell"
					:class="{ 'palette-cell--active': activeColor === color }"
					@click="copyColor(color)"
				>
					<view class="palette-cell__block" :class="[`tn-${color}_bg`]" />
					<text class="palette-cell__name">{{ color }}</text>
				</view>
			</view>
			<text class="tn-gray_text tn-mt-sm">已选色板：tn-{{ activeColor }}_bg</text>

			<view class="tn-mt-sm">
				<view v-for="color in ['blue', 'purple', 'green', 'orange']" :key="color" class="tn-demo-row tn-mt-xs">
					<tn-tag :bg-color="`tn-${color}-light`" :text-color="`tn-${color}-dark`">light</tn-tag>
					<tn-tag :bg-color="`tn-${color}`" text-color="tn-white">{{ color }}</tn-tag>
					<tn-tag :bg-color="`tn-${color}-dark`" text-color="tn-white">dark</tn-tag>
					<tn-tag :bg-color="`tn-${color}-disabled`" text-color="tn-white">disabled</tn-tag>
				</view>
			</view>
		</demo-block>

		<!-- 渐变 -->
		<demo-block
			title="渐变库"
			desc="cool-1 ~ cool-16 通用渐变，以及 tn-gradient-bg__{颜色} 双色渐变；点击渐变会复制对应类名"
			code="<view class=&quot;tn-gradient-bg__cool-8&quot; />"
		>
			<view class="gradient-grid">
				<view
					v-for="n in coolGradients"
					:key="n"
					class="gradient-cell"
					:class="[`tn-gradient-bg__cool-${n}`, { 'gradient-cell--active': activeGradient === n }]"
					@click="copyGradient(n)"
				>
					<text class="gradient-cell__text">cool-{{ n }}</text>
				</view>
			</view>
			<text class="tn-gray_text tn-mt-sm">已选渐变：tn-gradient-bg__cool-{{ activeGradient }}</text>
		</demo-block>

		<!-- 图标 -->
		<demo-block
			:title="`图标库（${tnIcons.length} 个）`"
			code-key="icon-library"
			desc="支持关键字过滤，点击任意图标会把 &lt;tn-icon&gt; 用法复制到剪贴板"
			code="<tn-icon name=&quot;home&quot; :size=&quot;40&quot; color=&quot;tn-blue&quot; />"
		>
			<tn-search-box v-model="iconKeyword" placeholder="搜索图标名，如 home、cart、arrow" @change="iconPageSize = 120" />

			<text class="tn-gray_text tn-mt-sm">共 {{ filteredIcons.length }} 个匹配结果，已展示 {{ visibleIcons.length }} 个</text>

			<view class="icon-grid">
				<view v-for="name in visibleIcons" :key="name" class="icon-item" @click="copyIcon(name)">
					<tn-icon :name="name" :size="38" color="tn-blue" />
					<text class="icon-item__name">{{ name }}</text>
				</view>
			</view>

			<view v-if="hasMoreIcons" class="tn-flex tn-flex-center-center tn-mt-sm">
				<tn-button size="sm" plain @click="loadMoreIcons">加载更多</tn-button>
			</view>
		</demo-block>

		<!-- 多语言 -->
		<demo-block
			title="vue-i18n 多语言"
			desc="语言包在 src/i18n/locales，切换后写入本地缓存；组件文案可配合 t() 输出"
			code="const { t, locale } = useI18n(); setLocale('en')"
		>
			<tn-switch-tab
				:tabs="localeOptions.map((o) => o.label)"
				:model-value="langIndex"
				active-bg-color="tn-purple"
				active-text-color="tn-white"
				@change="switchLang"
			/>

			<view class="i18n-card section-gap">
				<text class="i18n-card__title">{{ t('app.name') }}</text>
				<text class="i18n-card__desc">{{ t('app.desc') }}</text>
				<text class="i18n-card__slogan">{{ t('app.slogan') }}</text>
			</view>

			<view class="tn-demo-row section-gap">
				<tn-button type="primary">{{ t('common.confirm') }}</tn-button>
				<tn-button plain>{{ t('common.cancel') }}</tn-button>
				<tn-button text>{{ t('common.more') }}</tn-button>
			</view>
		</demo-block>

		<!-- 条件编译 -->
		<demo-block
			title="条件编译"
			desc="用条件编译指令在编译期裁剪平台代码，JS / 模板 / 样式均支持；当前编译平台：{{ platform }}"
			code="条件编译：H5 专属代码写在 ifdef H5 与 endif 之间，小程序写 MP-WEIXIN"
		>
			<view class="compile-card">
				<text class="compile-card__label">当前运行平台</text>
				<text class="compile-card__value">{{ platform }}</text>
			</view>

			<!-- #ifdef H5 -->
			<view class="compile-h5">
				<tn-icon name="global" :size="28" color="tn-blue" />
				<text class="tn-ml-xs">这段内容只在 H5 编译时出现</text>
			</view>
			<!-- #endif -->

			<!-- #ifdef MP-WEIXIN -->
			<view class="compile-mp">
				<text>这段内容只在微信小程序编译时出现</text>
			</view>
			<!-- #endif -->
		</demo-block>

		<!-- 设计变量 -->
		<demo-block
			title="设计变量（Design Token）"
			desc="间距、圆角、边框、阴影全部由 --tn-* 变量控制，改一个值整套组件同步变化"
			code="--tn-pm-size-sm / --tn-border-radius / --tn-shadow"
		>
			<view class="token-row">
				<view class="token-item">
					<text class="token-item__label">xs</text>
					<view class="token-bar" style="width: 24rpx" />
				</view>
				<view class="token-item">
					<text class="token-item__label">sm</text>
					<view class="token-bar" style="width: 40rpx" />
				</view>
				<view class="token-item">
					<text class="token-item__label">lg</text>
					<view class="token-bar" style="width: 80rpx" />
				</view>
				<view class="token-item">
					<text class="token-item__label">xl</text>
					<view class="token-bar" style="width: 120rpx" />
				</view>
			</view>

			<view class="tn-demo-row section-gap">
				<view class="radius-item tn-radius-sm">radius-sm</view>
				<view class="radius-item tn-radius">radius</view>
				<view class="radius-item tn-radius-round">round</view>
			</view>
			<view class="tn-demo-row section-gap">
				<view class="radius-item tn-shadow-sm">shadow-sm</view>
				<view class="radius-item tn-shadow">shadow</view>
				<view class="radius-item tn-shadow-lg">shadow-lg</view>
			</view>
		</demo-block>

		<view class="tip">换肤只影响当前容器的子元素；如果要全局生效，把 themeStyle 绑到页面根节点即可</view>
	</view>
</template>

<style lang="scss" scoped>
.page {
	padding-top: 24rpx;
}

.appearance-card {
	position: relative;
	display: flex;
	align-items: center;
	gap: 24rpx;
	margin: 0 24rpx 24rpx;
	padding: 28rpx 28rpx 94rpx;
	border: 1rpx solid var(--demo-line);
	border-radius: 28rpx;
	background-color: var(--demo-surface);
	box-shadow: var(--demo-shadow);
	overflow: hidden;
}

.appearance-copy {
	flex: 1;
	min-width: 0;
}

.appearance-eyebrow {
	display: block;
	font-size: 18rpx;
	font-weight: 700;
	letter-spacing: 3rpx;
	color: var(--demo-faint);
}

.appearance-title {
	display: block;
	margin-top: 8rpx;
	font-size: 32rpx;
	font-weight: 700;
	color: var(--demo-ink);
}

.appearance-desc {
	display: block;
	margin-top: 8rpx;
	font-size: 23rpx;
	line-height: 1.6;
	color: var(--demo-muted);
}

.appearance-switch {
	display: flex;
	align-items: center;
	justify-content: center;
	width: 92rpx;
	height: 92rpx;
	border: 1rpx solid var(--demo-primary-line);
	border-radius: 50%;
	background-color: var(--demo-primary-soft);
	transition: transform 0.2s ease;
}

.appearance-switch--dark {
	transform: rotate(-16deg);
}

.appearance-options {
	position: absolute;
	right: 24rpx;
	bottom: 22rpx;
	left: 24rpx;
	display: flex;
	gap: 8rpx;
	padding: 6rpx;
	border-radius: 999rpx;
	background-color: var(--demo-soft);
}

.appearance-option {
	flex: 1;
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 8rpx;
	padding: 12rpx 0;
	border-radius: 999rpx;
	font-size: 23rpx;
	color: var(--demo-muted);
}

.appearance-option--active {
	background-color: var(--demo-surface);
	box-shadow: 0 4rpx 12rpx rgba(15, 23, 42, 0.08);
	font-weight: 600;
	color: var(--demo-ink);
}

/* #ifdef H5 */
.appearance-card {
	background-image: radial-gradient(circle at 88% 12%, rgba(47, 107, 255, 0.14), transparent 42%);
}
/* #endif */

.page-header {
	margin: 0 24rpx 24rpx;
	padding: 30rpx 32rpx;
	border-radius: 28rpx;
	background: linear-gradient(145deg, #0b1220 0%, #172554 58%, #312e81 100%);
	box-shadow: 0 16rpx 40rpx rgba(15, 23, 42, 0.16);
}

.page-header__eyebrow {
	display: block;
	font-size: 18rpx;
	font-weight: 600;
	letter-spacing: 3rpx;
	color: #c4b5fd;
}

.page-header__title {
	display: block;
	margin-top: 8rpx;
	font-size: 36rpx;
	font-weight: 800;
	letter-spacing: -1rpx;
	color: #ffffff;
}

.page-header__desc {
	display: block;
	margin-top: 10rpx;
	font-size: 23rpx;
	line-height: 1.65;
	color: rgba(226, 232, 240, 0.76);
}

.section-gap {
	margin-top: 20rpx;
}

.theme-scope {
	padding: 20rpx;
	border-radius: 16rpx;
	background-color: var(--demo-soft);
}

/* 小程序下插槽内容对页面级 CSS 变量继承不稳定，暗色时补一个显式底色 */
.theme-scope--dark {
	background-color: #0d1625;
}

.theme-scope :deep(.tn-button--plain) {
	color: var(--demo-ink);
}

.preset-row {
	display: flex;
	gap: 18rpx;
}

.preset {
	width: 64rpx;
	height: 64rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	border-radius: 50%;
	border: 4rpx solid #ffffff;
	box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.12);
}

.preset--active {
	border-color: var(--demo-text);
}

.palette-grid {
	display: flex;
	flex-wrap: wrap;
	gap: 12rpx;
}

.palette-cell {
	box-sizing: border-box;
	width: 78rpx;
	display: flex;
	flex-direction: column;
	align-items: center;
	padding: 4rpx;
	border: 2rpx solid transparent;
	border-radius: 12rpx;
}

.palette-cell--active {
	border-color: #5f4fd9;
	background-color: var(--demo-purple-soft);
}

.palette-cell__block {
	width: 100%;
	height: 56rpx;
	border-radius: 10rpx;
}

.palette-cell__name {
	margin-top: 6rpx;
	font-size: 18rpx;
	color: var(--demo-faint);
	text-align: center;
	word-break: break-all;
}

.gradient-grid {
	display: flex;
	flex-wrap: wrap;
	gap: 12rpx;
}

.gradient-cell {
	box-sizing: border-box;
	width: 22%;
	height: 96rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	border: 3rpx solid transparent;
	border-radius: 12rpx;
}

.gradient-cell--active {
	border-color: #5f4fd9;
}

.gradient-cell__text {
	font-size: 18rpx;
	color: #ffffff;
}

.icon-grid {
	display: flex;
	flex-wrap: wrap;
	gap: 10rpx;
	margin-top: 16rpx;
}

.icon-item {
	width: 22%;
	display: flex;
	flex-direction: column;
	align-items: center;
	padding: 16rpx 6rpx;
	border-radius: 12rpx;
	background-color: var(--demo-soft);
}

.icon-item__name {
	margin-top: 8rpx;
	font-size: 18rpx;
	color: var(--demo-faint);
	text-align: center;
	word-break: break-all;
}

.i18n-card {
	padding: 24rpx;
	border-radius: 16rpx;
	background: linear-gradient(135deg, rgba(95, 79, 217, 0.08), rgba(1, 190, 255, 0.08));
}

.i18n-card__title {
	display: block;
	font-size: 32rpx;
	font-weight: 600;
}

.i18n-card__desc {
	display: block;
	margin-top: 8rpx;
	font-size: 24rpx;
	color: var(--demo-muted);
}

.i18n-card__slogan {
	display: block;
	margin-top: 12rpx;
	font-size: 22rpx;
	color: var(--demo-faint);
}

.compile-card {
	padding: 20rpx 24rpx;
	border-radius: 12rpx;
	background-color: var(--demo-soft);
	display: flex;
	justify-content: space-between;
	align-items: center;
}

.compile-card__label {
	font-size: 24rpx;
	color: var(--demo-faint);
}

.compile-card__value {
	font-size: 26rpx;
	font-weight: 600;
	color: #01beff;
}

.compile-h5,
.compile-mp {
	margin-top: 16rpx;
	display: flex;
	align-items: center;
	font-size: 24rpx;
	color: var(--demo-muted);
}

.token-row {
	display: flex;
	flex-direction: column;
	gap: 14rpx;
}

.token-item {
	display: flex;
	align-items: center;
}

.token-item__label {
	width: 60rpx;
	font-size: 22rpx;
	color: var(--demo-faint);
}

.token-bar {
	height: 20rpx;
	border-radius: 10rpx;
	background: linear-gradient(90deg, #01beff, #5f4fd9);
}

.radius-item {
	flex: 1;
	height: 88rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	background-color: var(--demo-surface);
	font-size: 20rpx;
	color: var(--demo-muted);
	border-radius: 12rpx;
}

.tip {
	margin: 8rpx 32rpx 40rpx;
	font-size: 22rpx;
	color: var(--demo-faint);
}
</style>
