<script lang="ts" setup>
import { ref } from 'vue'
import { scrollListData } from '@/data/mock'

const colors = ['red', 'purplered', 'purple', 'bluepurple', 'aquablue', 'blue', 'indigo', 'cyan', 'teal', 'green']

const listValue = ref(0)
</script>

<template>
	<view class="page">
		<view class="page-header">
			<text class="page-header__title">布局与原子类</text>
			<text class="page-header__desc">
				@tuniao/tn-style 提供 616 个原子类：flex 排布、宽高比例、内外间距、圆角、阴影、边框、文本截断、色板与渐变，全部可跨端使用
			</text>
		</view>

		<demo-block title="tn-flex 弹性布局" desc="一套组合式 class：方向 + 主轴 + 交叉轴，无需写 scoped 样式" code="<view class=&quot;tn-flex tn-flex-center-between&quot;>...</view>">
			<view class="flex-box tn-flex tn-flex-center-between">
				<text>tn-flex-center-between</text>
				<text class="tn-gray_text">主轴两端 / 交叉轴居中</text>
			</view>
			<view class="flex-box tn-flex tn-flex-column tn-flex-center-center section-gap">
				<text>tn-flex-column + tn-flex-center-center</text>
				<text class="tn-gray_text">纵向排列并居中</text>
			</view>
			<view class="flex-box tn-flex tn-flex-wrap tn-flex-start-start section-gap">
				<view v-for="i in 6" :key="i" class="flex-chip">{{ i }}</view>
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
					<view class="grid-cell tn-w-1-3 tn-orange_bg">1-3</view>
					<view class="grid-cell tn-w-2-3 tn-bluepurple_bg">2-3</view>
				</view>
			</view>
		</demo-block>

		<demo-block title="间距 / 圆角 / 阴影" desc="间距只有 0 / xs / sm（默认）/ lg / xl 五档，统一走 --tn-pm-size-* 变量" code="<view class=&quot;tn-p-lg tn-radius tn-shadow-lg&quot; />">
			<view class="tn-flex tn-flex-start-start">
				<view class="box tn-p-xs">p-xs</view>
				<view class="box tn-p-sm tn-ml-sm">p-sm</view>
				<view class="box tn-p-lg tn-ml-sm tn-radius">p-lg + radius</view>
			</view>
			<view class="tn-flex tn-flex-start-start section-gap">
				<view class="box tn-p-lg tn-round tn-shadow-sm">tn-round</view>
				<view class="box tn-p-lg tn-ml-sm tn-radius tn-shadow">shadow</view>
				<view class="box tn-p-lg tn-ml-sm tn-radius tn-shadow-lg">shadow-lg</view>
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
					<text class="color-cell__text">{{ c }}</text>
				</view>
			</view>
			<view class="tn-demo-row section-gap">
				<view class="chip tn-type-primary_bg tn-white_text">primary</view>
				<view class="chip tn-type-success_bg tn-white_text">success</view>
				<view class="chip tn-type-warning_bg tn-white_text">warning</view>
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
				<view v-for="n in 8" :key="n" class="gradient-cell" :class="[`tn-gradient-bg__cool-${n}`]">{{ n }}</view>
			</view>
			<view class="tn-demo-row section-gap">
				<view class="gradient-item tn-gradient-bg__blue">blue</view>
				<view class="gradient-item tn-gradient-bg__purple-light">purple-light</view>
				<view class="gradient-item tn-gradient-bg__teal-single">teal-single</view>
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

		<demo-block title="TnSticky 吸顶容器" desc="滚动时自动吸附到顶部，offsetTop 可避让自定义导航栏" code="<tn-sticky :offset-top=&quot;0&quot;>...</tn-sticky>">
			<tn-sticky :offset-top="0">
				<view class="sticky-bar">滚动页面，这一行会吸顶</view>
			</tn-sticky>
			<view class="sticky-body">
				<text v-for="i in 8" :key="i" class="sticky-line">占位内容 {{ i }}</text>
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

.section-gap {
	margin-top: 20rpx;
}

.flex-box {
	padding: 20rpx;
	border-radius: 16rpx;
	background-color: #f7f9fc;
}

.flex-chip {
	width: 96rpx;
	height: 64rpx;
	margin: 0 12rpx 12rpx 0;
	display: flex;
	align-items: center;
	justify-content: center;
	background-color: #eaf7ff;
	color: #01beff;
	border-radius: 12rpx;
	font-size: 24rpx;
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

.box {
	background-color: #f2f4f8;
	border-radius: 12rpx;
	font-size: 22rpx;
	color: #606266;
}

.text-demo {
	display: flex;
	flex-direction: column;
}

.text-ellipsis {
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
	color: #ffffff;
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
	color: #ffffff;
	font-size: 22rpx;
}

.gradient-item {
	flex: 1;
	height: 88rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	border-radius: 12rpx;
	color: #ffffff;
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
