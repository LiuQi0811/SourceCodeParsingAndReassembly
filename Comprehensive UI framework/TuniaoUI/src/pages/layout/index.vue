<script lang="ts" setup>
import { computed, ref } from 'vue'
import { scrollListData } from '@/data/mock'

const colors = ['red', 'purplered', 'purple', 'bluepurple', 'aquablue', 'blue', 'indigo', 'cyan', 'teal', 'green']
const lightColors = ['aquablue', 'indigo', 'cyan', 'teal', 'green', 'yellowgreen', 'lime', 'yellow', 'orangeyellow', 'orange', 'orangered', 'grey']

const listValue = ref(0)

/** ---------------- 布局实验室 ---------------- */
const flexDirection = ref<'row' | 'column'>('row')
const flexCross = ref('center')
const flexMain = ref('between')
const flexWrap = ref(false)
const flexGap = ref('16rpx')
const copied = ref(false)

const crossOptions = ['start', 'center', 'end', 'baseline', 'stretch']
const mainOptions = ['start', 'center', 'end', 'between', 'around']
const gapOptions = [
	{ label: '0', value: '0rpx' },
	{ label: 'xs', value: '10rpx' },
	{ label: 'sm', value: '20rpx' },
	{ label: 'lg', value: '40rpx' },
	{ label: 'xl', value: '50rpx' }
]

const presets = [
	{ label: '两端对齐', direction: 'row' as const, cross: 'center', main: 'between', wrap: false },
	{ label: '纵向居中', direction: 'column' as const, cross: 'center', main: 'center', wrap: false },
	{ label: '换行卡片', direction: 'row' as const, cross: 'start', main: 'start', wrap: true }
]

const flexClasses = computed(() => [
	'tn-flex',
	`tn-flex-${flexDirection.value}`,
	`tn-flex-${flexCross.value}-${flexMain.value}`,
	flexWrap.value ? 'tn-flex-wrap' : 'tn-flex-nowrap'
])

const flexCode = computed(() => `<view class="${flexClasses.value.join(' ')}">...</view>`)
const flexStyle = computed(() => ({ gap: flexGap.value }))

function applyPreset(preset: (typeof presets)[number]) {
	flexDirection.value = preset.direction
	flexCross.value = preset.cross
	flexMain.value = preset.main
	flexWrap.value = preset.wrap
}

function copyFlexCode() {
	uni.setClipboardData({
		data: flexCode.value,
		success: () => {
			copied.value = true
			setTimeout(() => (copied.value = false), 1500)
		}
	})
}

/** ---------------- 真实页面布局 ---------------- */
const layoutColumns = ref(2)
const showSidebar = ref(true)

const dashboardCards = [
	{ title: '今日订单', value: '1,286', hint: '较昨日 +12%' },
	{ title: '待发货', value: '86', hint: '其中 12 单加急' },
	{ title: '销售额', value: '¥ 48,920', hint: '目标完成 78%' },
	{ title: '新增用户', value: '1,024', hint: '转化率 6.8%' },
	{ title: '退款率', value: '2.1%', hint: '低于行业均值' },
	{ title: '库存预警', value: '17', hint: '建议今日补货' }
]

/** ---------------- 间距 / 圆角 / 阴影 ---------------- */
const spacingSteps = [
	{ label: 'xs', cls: 'tn-p-xs' },
	{ label: 'sm', cls: 'tn-p-sm' },
	{ label: 'lg', cls: 'tn-p-lg' },
	{ label: 'xl', cls: 'tn-p-xl' }
]

/** ---------------- 配色 ---------------- */
function colorTextClass(color: string) {
	return lightColors.includes(color) ? 'tn-black_text' : 'tn-white_text'
}

const coolGradients = Array.from({ length: 8 }, (_, index) => ({
	n: index + 1,
	dark: [4, 6, 7, 8].includes(index + 1)
}))

const gradientItems = [
	{ label: 'blue', cls: 'tn-gradient-bg__blue', dark: false },
	{ label: 'purple-light', cls: 'tn-gradient-bg__purple-light', dark: true },
	{ label: 'teal-single', cls: 'tn-gradient-bg__teal-single', dark: true }
]
</script>

<template>
	<view class="page">
		<view class="page-header">
			<text class="page-header__title">布局与原子类</text>
			<text class="page-header__desc">
				@tuniao/tn-style 提供数百个原子类：flex 排布、宽高比例、内外间距、圆角、阴影、边框、文本截断、色板与渐变，全部可跨端使用
			</text>
			<view class="header-chips">
				<text class="header-chip">布局实验室</text>
				<text class="header-chip">真实页面布局</text>
				<text class="header-chip">间距 / 圆角 / 阴影</text>
			</view>
		</view>

		<demo-block
			title="布局实验室"
			desc="切换方向、主轴、交叉轴、换行和间距，实时生成 tn-flex-* 类名；预设可以一键复原常用组合"
			code="<view class=&quot;tn-flex tn-flex-row tn-flex-center-between&quot;>...</view>"
		>
			<view class="preset-row">
				<view
					v-for="preset in presets"
					:key="preset.label"
					class="preset-chip"
					@click="applyPreset(preset)"
				>
					{{ preset.label }}
				</view>
			</view>

			<view class="lab-control">
				<text class="lab-label">方向</text>
				<view class="lab-options">
					<text class="lab-chip" :class="{ 'lab-chip--active': flexDirection === 'row' }" @click="flexDirection = 'row'">row</text>
					<text class="lab-chip" :class="{ 'lab-chip--active': flexDirection === 'column' }" @click="flexDirection = 'column'">column</text>
				</view>
			</view>

			<view class="lab-control">
				<text class="lab-label">交叉轴</text>
				<view class="lab-options">
					<text
						v-for="item in crossOptions"
						:key="item"
						class="lab-chip"
						:class="{ 'lab-chip--active': flexCross === item }"
						@click="flexCross = item"
					>
						{{ item }}
					</text>
				</view>
			</view>

			<view class="lab-control">
				<text class="lab-label">主轴</text>
				<view class="lab-options">
					<text
						v-for="item in mainOptions"
						:key="item"
						class="lab-chip"
						:class="{ 'lab-chip--active': flexMain === item }"
						@click="flexMain = item"
					>
						{{ item }}
					</text>
				</view>
			</view>

			<view class="lab-control">
				<text class="lab-label">间距 / 换行</text>
				<view class="lab-options">
					<text
						v-for="item in gapOptions"
						:key="item.label"
						class="lab-chip"
						:class="{ 'lab-chip--active': flexGap === item.value }"
						@click="flexGap = item.value"
					>
						{{ item.label }}
					</text>
					<text class="lab-chip" :class="{ 'lab-chip--active': flexWrap }" @click="flexWrap = !flexWrap">wrap</text>
				</view>
			</view>

			<view class="lab-preview">
				<view class="lab-canvas" :class="flexClasses" :style="flexStyle">
					<view v-for="i in 6" :key="i" class="lab-block" :class="{ 'lab-block--stretch': flexCross === 'stretch' }">
					区块 {{ i }}
				</view>
				</view>
			</view>

			<view class="lab-code">
				<text class="lab-code__text">{{ flexCode }}</text>
				<text class="lab-copy" @click="copyFlexCode">{{ copied ? '已复制' : '复制' }}</text>
			</view>
		</demo-block>

		<demo-block
			title="真实页面布局"
			desc="侧栏 + 主内容 + 卡片网格 + 固定底栏的组合布局；切换列数或显隐侧栏，观察内容区如何自适应"
			code="<view class=&quot;dash-body tn-flex&quot;>侧栏 + 主内容 + 卡片网格</view>"
		>
			<view class="layout-control">
				<text class="lab-label">内容列数</text>
				<view class="lab-options">
					<text
						v-for="n in 3"
						:key="n"
						class="lab-chip"
						:class="{ 'lab-chip--active': layoutColumns === n }"
						@click="layoutColumns = n"
					>
						{{ n }} 列
					</text>
				</view>
				<text class="lab-chip" :class="{ 'lab-chip--active': showSidebar }" @click="showSidebar = !showSidebar">
					{{ showSidebar ? '隐藏侧栏' : '显示侧栏' }}
				</text>
			</view>

			<view class="dashboard">
				<view class="dash-header">
					<view class="dash-brand">
						<view class="dash-logo">T</view>
						<text class="dash-title">工作台</text>
					</view>
					<text class="dash-date">2026 / 11 / 28</text>
				</view>

				<view class="dash-body">
					<view v-if="showSidebar" class="dash-side">
						<text class="dash-nav dash-nav--active">总览</text>
						<text class="dash-nav">订单</text>
						<text class="dash-nav">商品</text>
						<text class="dash-nav">客户</text>
					</view>

					<view class="dash-main">
						<view class="dash-toolbar">
							<text class="dash-toolbar__title">经营总览</text>
							<text class="dash-toolbar__meta">{{ layoutColumns }} 列布局</text>
						</view>

						<view class="dash-grid" :class="`dash-grid-${layoutColumns}`">
							<view v-for="card in dashboardCards" :key="card.title" class="dash-card">
								<text class="dash-card__title">{{ card.title }}</text>
								<text class="dash-card__value">{{ card.value }}</text>
								<text class="dash-card__hint">{{ card.hint }}</text>
							</view>
						</view>
					</view>
				</view>

				<view class="dash-footer">
					<text>数据更新于 10:20</text>
					<text class="dash-footer__action">导出报表</text>
				</view>
			</view>
		</demo-block>

		<demo-block title="宽度 / 高度比例" desc="tn-w-1-2、tn-w-1-3、tn-w-2-3 等栅格类，配合 gap 就能快速做响应式分栏" code="<view class=&quot;tn-w-1-3 tn-h-20&quot; />">
			<view class="grid-demo">
				<view class="grid-cell tn-w-full tn-blue_bg">tn-w-full</view>
				<view class="grid-row">
					<view class="grid-cell tn-w-1-2 tn-purple_bg">tn-w-1-2</view>
					<view class="grid-cell tn-w-1-2 tn-teal_bg">tn-w-1-2</view>
				</view>
				<view class="grid-row">
					<view class="grid-cell tn-w-1-3 tn-orange_bg">1 / 3</view>
					<view class="grid-cell tn-w-2-3 tn-bluepurple_bg">2 / 3</view>
				</view>
			</view>
		</demo-block>

		<demo-block title="间距 / 圆角 / 阴影" desc="间距只有 0 / xs / sm / lg / xl 五档，统一走 --tn-pm-size-* 变量；圆角与阴影用同尺寸卡片对比" code="<view class=&quot;tn-p-lg tn-radius tn-shadow-lg&quot; />">
			<view v-for="step in spacingSteps" :key="step.label" class="space-row">
				<text class="space-label">p-{{ step.label }}</text>
				<view class="space-stage">
					<view class="space-box" :class="step.cls"><view class="space-content">{{ step.label }}</view></view>
				</view>
			</view>

			<view class="effect-grid section-gap">
				<view class="effect-item">
					<view class="effect-tile tn-radius">radius</view>
					<text class="effect-caption">tn-radius</text>
				</view>
				<view class="effect-item">
					<view class="effect-tile tn-round">round</view>
					<text class="effect-caption">tn-round</text>
				</view>
				<view class="effect-item">
					<view class="effect-tile tn-radius tn-shadow-sm">sm</view>
					<text class="effect-caption">shadow-sm</text>
				</view>
				<view class="effect-item">
					<view class="effect-tile tn-radius tn-shadow">shadow</view>
					<text class="effect-caption">shadow</text>
				</view>
				<view class="effect-item">
					<view class="effect-tile tn-radius tn-shadow-lg">lg</view>
					<text class="effect-caption">shadow-lg</text>
				</view>
			</view>
		</demo-block>

		<demo-block title="文本与边框" desc="字号 / 字重 / 对齐 / 多行截断，边框可只保留某一条边" code="<text class=&quot;tn-text-xl tn-text-bold tn-text-ellipsis-2&quot;>...</text>">
			<view class="text-demo">
				<text class="tn-text-4xl tn-text-bold tn-blue_text">tn-text-4xl</text>
				<text class="tn-text-sm tn-gray_text tn-mt-xs">tn-text-sm + tn-gray_text</text>
				<text class="tn-text-ellipsis-2 tn-mt-sm text-ellipsis">
					两行截断：TuniaoUI 是一套基于 uni-app、Vue3 与 TypeScript 的跨端 UI 组件库，提供统一的设计语言、完整的配色体系与 838 个内置图标，一套代码同时运行在 H5、App 和小程序。
				</text>
				<view class="border-demo tn-mt-sm">
					<view class="tn-border-top tn-p-sm">tn-border-top</view>
					<view class="tn-border-bottom tn-border-dashed tn-p-sm">tn-border-bottom + dashed</view>
					<view class="tn-border-left tn-border-bold tn-pl-sm tn-mt-sm">tn-border-left + bold</view>
				</view>
			</view>
		</demo-block>

		<demo-block title="配色体系" desc="19 种主色 × 4 档（默认 / light / dark / disabled），命名规则 tn-{颜色}_{属性}；语义色用 tn-type-{type}_{属性}" code="<view class=&quot;tn-blue_bg&quot;> <text class=&quot;tn-blue_text&quot;>...">
			<view class="color-grid">
				<view v-for="c in colors" :key="c" class="color-cell" :class="[`tn-${c}_bg`]">
					<text class="color-cell__text" :class="colorTextClass(c)">{{ c }}</text>
				</view>
			</view>
			<view class="tn-demo-row section-gap">
				<view class="chip tn-type-primary_bg tn-white_text">primary</view>
				<view class="chip tn-type-success_bg tn-white_text">success</view>
				<view class="chip tn-type-warning_bg tn-black_text">warning</view>
				<view class="chip tn-type-danger_bg tn-white_text">danger</view>
				<view class="chip tn-type-info_bg tn-white_text">info</view>
			</view>
			<view class="tn-demo-row section-gap">
				<view class="chip tn-blue-light_bg tn-blue-dark_text">light</view>
				<view class="chip tn-blue_bg tn-white_text">默认</view>
				<view class="chip tn-blue-dark_bg tn-white_text">dark</view>
				<view class="chip tn-blue-disabled_bg tn-white_text">disabled</view>
			</view>
		</demo-block>

		<demo-block title="渐变配色" desc="tn-gradient-bg__{颜色}（双色）、__{颜色}-light、__{颜色}-single，以及 cool-1 ~ cool-16" code="<view class=&quot;tn-gradient-bg__cool-5&quot; />">
			<view class="gradient-row">
				<view
					v-for="item in coolGradients"
					:key="item.n"
					class="gradient-cell"
					:class="[`tn-gradient-bg__cool-${item.n}`, item.dark ? 'tn-black_text' : 'tn-white_text']"
				>
					{{ item.n }}
				</view>
			</view>
			<view class="tn-demo-row section-gap">
				<view
					v-for="item in gradientItems"
					:key="item.label"
					class="gradient-item"
					:class="[item.cls, item.dark ? 'tn-black_text' : 'tn-white_text']"
				>
					{{ item.label }}
				</view>
			</view>
		</demo-block>

		<demo-block title="TnListItem 列表项" desc="rightIcon / bottomBorder / radius / hoverClass，常用于设置类页面" code="<tn-list-item right-icon=&quot;right&quot; bottom-border>标题</tn-list-item>">
			<view class="list-wrap">
				<tn-list-item
					v-for="(item, index) in scrollListData"
					:key="item.id"
					:right-icon="'right'"
					:bottom-border="index !== scrollListData.length - 1"
					hover-class="tn-u-btn-hover"
					@click="listValue = index"
				>
					<view class="tn-flex tn-flex-center-start">
						<tn-icon :name="item.icon" :size="32" class="tn-blue_text" />
						<text class="list-text">{{ item.title }}</text>
						<text class="list-desc">{{ item.desc }}</text>
					</view>
				</tn-list-item>
			</view>
			<text class="tn-gray_text tn-mt-sm">当前点击：{{ scrollListData[listValue].title }}</text>
		</demo-block>

		<demo-block title="TnSticky 吸顶容器" desc="向下滚动页面，渐变条会吸附在导航栏下方；offsetTop 用来避让自定义导航栏" code="<tn-sticky :offset-top=&quot;44&quot;>...</tn-sticky>">
			<tn-sticky :offset-top="44">
				<view class="sticky-bar">继续向下滚动，这一行会吸顶</view>
			</tn-sticky>
			<view class="sticky-body">
				<text v-for="i in 14" :key="i" class="sticky-line">占位内容 {{ i }}</text>
			</view>
			<view class="sticky-tail">
				<text class="sticky-tail__text">继续滚动，观察渐变条吸附在导航栏下方</text>
			</view>
		</demo-block>

		<view class="tip">提示：自定义样式优先用 customStyle / customClass 属性，避免覆盖组件内部样式</view>
	</view>
</template>

<style lang="scss" scoped>
.page {
	padding-top: 24rpx;
}

.page-header {
	margin: 0 24rpx 24rpx;
	padding: 28rpx 32rpx;
	border-radius: 24rpx;
	background: linear-gradient(135deg, rgba(54, 70, 255, 0.1), rgba(45, 232, 189, 0.1));
}

.page-header__title {
	display: block;
	font-size: 36rpx;
	font-weight: 700;
}

.page-header__desc {
	display: block;
	margin-top: 10rpx;
	font-size: 24rpx;
	line-height: 1.6;
	color: #606266;
}

.header-chips {
	display: flex;
	flex-wrap: wrap;
	gap: 12rpx;
	margin-top: 18rpx;
}

.header-chip {
	padding: 8rpx 18rpx;
	border-radius: 999rpx;
	background-color: rgba(255, 255, 255, 0.7);
	color: #5f4fd9;
	font-size: 20rpx;
}

.section-gap {
	margin-top: 20rpx;
}

.preset-row {
	display: flex;
	flex-wrap: wrap;
	gap: 12rpx;
	margin-bottom: 18rpx;
}

.preset-chip {
	padding: 10rpx 22rpx;
	border: 1rpx solid #d9def0;
	border-radius: 999rpx;
	background-color: #ffffff;
	color: #5f4fd9;
	font-size: 22rpx;
}

.lab-control,
.layout-control {
	display: flex;
	align-items: flex-start;
	flex-wrap: wrap;
	gap: 12rpx;
	margin-bottom: 12rpx;
}

.lab-label {
	width: 140rpx;
	padding-top: 8rpx;
	font-size: 22rpx;
	color: #909399;
}

.lab-options {
	display: flex;
	flex: 1;
	flex-wrap: wrap;
	gap: 10rpx;
}

.lab-chip {
	padding: 8rpx 18rpx;
	border: 1rpx solid #e3e7f1;
	border-radius: 10rpx;
	background-color: #f7f8fc;
	color: #606266;
	font-size: 21rpx;
}

.lab-chip--active {
	border-color: #5f4fd9;
	background-color: #5f4fd9;
	color: #ffffff;
}

.lab-preview {
	margin-top: 18rpx;
	padding: 16rpx;
	border-radius: 14rpx;
	background-color: #f4f6fb;
}

.lab-canvas {
	min-height: 220rpx;
	padding: 16rpx;
	border: 1rpx dashed #c8d0e6;
	border-radius: 12rpx;
	background-color: #ffffff;
	overflow: hidden;
}

.lab-block {
	flex: 0 0 auto;
	width: 104rpx;
	height: 64rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	border-radius: 10rpx;
	background: linear-gradient(135deg, #6a7dff, #4bd3c5);
	color: #ffffff;
	font-size: 19rpx;
}

.lab-block--stretch {
	box-sizing: border-box;
	width: auto;
	height: auto;
	min-width: 104rpx;
	min-height: 64rpx;
	padding: 14rpx;
}

.lab-code {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 16rpx;
	margin-top: 14rpx;
	padding: 14rpx 18rpx;
	border-radius: 10rpx;
	background-color: #1f2333;
}

.lab-code__text {
	flex: 1;
	color: #dce2ff;
	font-size: 20rpx;
	word-break: break-all;
}

.lab-copy {
	flex: 0 0 auto;
	color: #7be0d6;
	font-size: 21rpx;
}

.dashboard {
	border: 1rpx solid #e5e9f2;
	border-radius: 16rpx;
	overflow: hidden;
	background-color: #ffffff;
	box-shadow: 0 10rpx 28rpx rgba(40, 50, 90, 0.08);
}

.dash-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 18rpx 22rpx;
	background: linear-gradient(90deg, #eef1ff, #e9fbf7);
	border-bottom: 1rpx solid #e5e9f2;
}

.dash-brand {
	display: flex;
	align-items: center;
	gap: 10rpx;
}

.dash-logo {
	width: 40rpx;
	height: 40rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	border-radius: 10rpx;
	background-color: #5f4fd9;
	color: #ffffff;
	font-size: 22rpx;
	font-weight: 700;
}

.dash-title {
	font-size: 24rpx;
	font-weight: 600;
	color: #303133;
}

.dash-date {
	font-size: 19rpx;
	color: #8a90a6;
}

.dash-body {
	display: flex;
	min-height: 420rpx;
}

.dash-side {
	flex: 0 0 128rpx;
	padding: 18rpx 12rpx;
	background-color: #f7f8fc;
	border-right: 1rpx solid #edf0f6;
}

.dash-nav {
	display: block;
	padding: 12rpx 10rpx;
	border-radius: 8rpx;
	color: #8a90a6;
	font-size: 19rpx;
}

.dash-nav--active {
	background-color: #e9e8ff;
	color: #5f4fd9;
	font-weight: 600;
}

.dash-main {
	flex: 1;
	min-width: 0;
	padding: 18rpx;
}

.dash-toolbar {
	display: flex;
	align-items: center;
	justify-content: space-between;
	margin-bottom: 14rpx;
}

.dash-toolbar__title {
	font-size: 24rpx;
	font-weight: 600;
	color: #303133;
}

.dash-toolbar__meta {
	font-size: 19rpx;
	color: #9aa1b5;
}

.dash-grid {
	display: flex;
	flex-wrap: wrap;
	gap: 12rpx;
}

.dash-grid-1 .dash-card {
	flex: 0 0 100%;
}

.dash-grid-2 .dash-card {
	flex: 0 0 calc(50% - 6rpx);
}

.dash-grid-3 .dash-card {
	flex: 0 0 calc(33.333% - 8rpx);
}

.dash-card {
	box-sizing: border-box;
	padding: 16rpx;
	border-radius: 10rpx;
	background-color: #f7f9ff;
	border: 1rpx solid #edf0fa;
}

.dash-card__title {
	display: block;
	font-size: 18rpx;
	color: #8a90a6;
}

.dash-card__value {
	display: block;
	margin-top: 6rpx;
	font-size: 28rpx;
	font-weight: 700;
	color: #303133;
}

.dash-card__hint {
	display: block;
	margin-top: 6rpx;
	font-size: 18rpx;
	color: #7a86a8;
}

.dash-footer {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 16rpx 22rpx;
	border-top: 1rpx solid #edf0f6;
	background-color: #fbfcff;
	font-size: 19rpx;
	color: #9aa1b5;
}

.dash-footer__action {
	color: #5f4fd9;
	font-weight: 600;
}

.grid-demo {
	display: flex;
	flex-direction: column;
	gap: 12rpx;
}

.grid-row {
	display: flex;
	gap: 12rpx;
}

.grid-cell {
	padding: 20rpx 0;
	text-align: center;
	font-size: 22rpx;
	color: #ffffff;
	border-radius: 12rpx;
}

.space-row {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 8rpx 0;
	border-bottom: 1rpx dashed #e9edf5;
}

.space-label {
	width: 90rpx;
	font-size: 20rpx;
	color: #8a90a6;
}

.space-stage {
	flex: 1;
	display: flex;
	justify-content: flex-end;
	padding: 8rpx 12rpx;
	border-radius: 10rpx;
	background-color: #f7f9fc;
}

.space-box {
	box-sizing: border-box;
	border-radius: 8rpx;
	background-color: #e9e8ff;
}

.space-content {
	width: 120rpx;
	height: 36rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	border-radius: 6rpx;
	background-color: #5f4fd9;
	color: #ffffff;
	font-size: 18rpx;
}

.effect-grid {
	display: flex;
	flex-wrap: wrap;
	gap: 22rpx;
	padding: 24rpx 18rpx;
	border-radius: 14rpx;
	background-color: #eef1f8;
}

.effect-item {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 10rpx;
}

.effect-tile {
	width: 112rpx;
	height: 112rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	background-color: #ffffff;
	color: #606266;
	font-size: 20rpx;
}

.effect-caption {
	font-size: 18rpx;
	color: #9aa1b5;
}

.text-demo {
	display: flex;
	flex-direction: column;
}

.text-ellipsis {
	width: 100%;
	color: #303133;
	line-height: 1.6;
}

.border-demo {
	border-radius: 12rpx;
	background-color: #f7f9fc;
}

.color-grid {
	display: flex;
	flex-wrap: wrap;
	gap: 12rpx;
}

.color-cell {
	width: 108rpx;
	height: 80rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	border-radius: 12rpx;
}

.color-cell__text {
	font-size: 20rpx;
}

.chip {
	padding: 14rpx 24rpx;
	border-radius: 12rpx;
	font-size: 22rpx;
}

.gradient-row {
	display: flex;
	gap: 10rpx;
}

.gradient-cell {
	flex: 1;
	height: 88rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	border-radius: 12rpx;
	font-size: 22rpx;
}

.gradient-item {
	flex: 1;
	height: 88rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	border-radius: 12rpx;
	font-size: 22rpx;
}

.list-wrap {
	margin: 0 -8rpx;
	border-radius: 16rpx;
	overflow: hidden;
}

.list-text {
	margin-left: 16rpx;
	font-size: 26rpx;
}

.list-desc {
	margin-left: 16rpx;
	font-size: 22rpx;
	color: #b0b3b8;
}

.sticky-tail {
	height: 600rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	margin-top: 12rpx;
	border-radius: 12rpx;
	background: linear-gradient(180deg, #f4f6ff, #eefbf8);
}

.sticky-tail__text {
	font-size: 20rpx;
	color: #9aa1b5;
}

.sticky-bar {
	padding: 18rpx 24rpx;
	background: linear-gradient(90deg, #01beff, #5f4fd9);
	color: #ffffff;
	font-size: 24rpx;
	border-radius: 12rpx;
}

.sticky-body {
	margin-top: 12rpx;
	padding: 8rpx 24rpx;
	background-color: #f7f9fc;
	border-radius: 12rpx;
}

.sticky-line {
	display: block;
	padding: 22rpx 0;
	border-bottom: 1rpx solid #eaedf2;
	font-size: 24rpx;
	color: #909399;
}

.tip {
	margin: 8rpx 32rpx 40rpx;
	font-size: 22rpx;
	color: #909399;
}
</style>
