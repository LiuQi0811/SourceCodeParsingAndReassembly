<script lang="ts" setup>
/**
 * 自定义示例容器
 * 知识点：easycom 自动引入（目录名/文件名一致，页面里写 <demo-block> 即可，无需 import）
 * 交互：效果预览 / 源码 双视图，源码支持横向滑动与一键复制
 */
import { computed, onMounted, ref } from 'vue'
import * as LZString from 'lz-string'
import { demoCodePacked } from '@/utils/demo-code.generated'

const props = defineProps<{
	title?: string
	desc?: string
	/** 兜底的手写代码片段：优先展示构建期自动提取的完整示例 */
	code?: string
	/** 标题是动态插值时，用稳定 key 关联自动提取的源码 */
	codeKey?: string
}>()

function readRoute() {
	try {
		const pages = getCurrentPages()
		const current = pages[pages.length - 1] as { route?: string } | undefined
		return current?.route || ''
	} catch {
		return ''
	}
}

const route = ref(readRoute())
onMounted(() => {
	if (!route.value) route.value = readRoute()
})

/** 源码表按 LZ 压缩保存，首次切到源码视图时才解压，并复用结果 */
let demoCodes: Record<string, string> | null = null
function getDemoCodes(): Record<string, string> {
	if (demoCodes) return demoCodes
	try {
		const parsed = JSON.parse(LZString.decompressFromEncodedURIComponent(demoCodePacked) || '{}')
		demoCodes = parsed && typeof parsed === 'object' ? parsed : {}
	} catch {
		demoCodes = {}
	}
	return demoCodes || {}
}

const generatedCode = computed(() => {
	if (!route.value) return ''
	const key = props.codeKey || props.title || ''
	return getDemoCodes()[`${route.value}#${key}`] || ''
})

/** 构建器生成成功时优先用完整代码，抽取失败才退回旧的手写片段 */
const codeText = computed(() => generatedCode.value || props.code || '')
const isGenerated = computed(() => !!generatedCode.value)
const codeHint = computed(() => {
	if (!isGenerated.value) return '代表性用法片段 · 左右滑动'
	const lines = codeText.value.split('\n').length
	const size = (codeText.value.length / 1024).toFixed(1)
	return `完整示例 · ${lines} 行 / ${size} KB · 上下左右滑动`
})

/** 默认展示真实运行的效果，源码按需切换 */
const activeTab = ref<'preview' | 'code'>('preview')
const codeExpanded = ref(false)
const copyLabel = ref('复制')

function copyCode() {
	if (!codeText.value) return
	uni.setClipboardData({
		data: codeText.value,
		success: () => {
			copyLabel.value = '已复制'
			uni.showToast({ title: '源码已复制', icon: 'none' })
			setTimeout(() => (copyLabel.value = '复制'), 1500)
		},
		fail: () => {
			uni.showToast({ title: '复制失败，请长按选择', icon: 'none' })
		},
	})
}

/** 跳到当前页面的完整源码查看器（不是卡片里这段代表性片段） */
function openFullSource() {
	// 不额外 require 工具文件：小程序自定义组件里直接取当前页面栈最稳
	const pages = getCurrentPages()
	const current = pages[pages.length - 1] as { route?: string } | undefined
	const route = current?.route || ''
	if (!route) {
		uni.showToast({ title: '未获取到页面路由', icon: 'none' })
		return
	}
	uni.navigateTo({
		url: `/pages/source/index?path=${encodeURIComponent(route)}`,
	})
}
</script>

<template>
	<view class="demo-block">
		<view v-if="title || desc" class="demo-block__head">
			<view v-if="title" class="demo-block__title-row">
				<view class="demo-block__title">
					<view class="demo-block__bar" />
					<text>{{ title }}</text>
				</view>
				<text class="demo-block__tag">DEMO</text>
			</view>
			<text v-if="desc" class="demo-block__desc">{{ desc }}</text>
		</view>

		<view v-if="codeText" class="demo-block__tabs">
			<view
				class="demo-block__tab"
				:class="{ 'demo-block__tab--active': activeTab === 'preview' }"
				@click="activeTab = 'preview'"
			>
				<view class="demo-block__live-dot" />
				<text>效果预览</text>
			</view>
			<view
				class="demo-block__tab"
				:class="{ 'demo-block__tab--active': activeTab === 'code' }"
				@click="activeTab = 'code'"
			>
				<text>源码</text>
			</view>
			<text class="demo-block__full" @click="openFullSource">完整源码</text>
			<text class="demo-block__copy" @click="copyCode">{{ copyLabel }}</text>
		</view>

		<text v-if="codeText && activeTab === 'code'" class="demo-block__readonly">
			{{ isGenerated ? '本卡完整示例：模板 + 所需脚本 + 相关样式，可直接复制到页面运行' : '这段是代表性用法片段；点“完整源码”可查看当前页面全文' }}
		</text>

		<view v-if="!codeText || activeTab === 'preview'" class="demo-block__body">
			<slot />
		</view>

		<view v-if="codeText && activeTab === 'code'" class="demo-block__code-wrap">
			<view class="demo-block__code-bar">
				<view class="demo-block__code-dot demo-block__code-dot--red" />
				<view class="demo-block__code-dot demo-block__code-dot--amber" />
				<view class="demo-block__code-dot demo-block__code-dot--green" />
				<text class="demo-block__code-hint">{{ codeHint }}</text>
				<text class="demo-block__code-expand" @click="codeExpanded = !codeExpanded">
					{{ codeExpanded ? '收起' : '展开' }}
				</text>
			</view>
			<scroll-view
				class="demo-block__code-scroll"
				:class="{ 'demo-block__code-scroll--expanded': codeExpanded }"
				scroll-x
				scroll-y
				:show-scrollbar="false"
			>
				<text class="demo-block__code">{{ codeText }}</text>
			</scroll-view>
		</view>
	</view>
</template>

<style lang="scss" scoped>
.demo-block {
	margin: 0 28rpx 28rpx;
	background-color: #ffffff;
	border: 1rpx solid #e8eef7;
	border-radius: 28rpx;
	box-shadow: 0 12rpx 32rpx rgba(15, 23, 42, 0.05);
}

.demo-block__head {
	padding: 28rpx 28rpx 20rpx;
}

.demo-block__title-row {
	display: flex;
	align-items: center;
	justify-content: space-between;
}

.demo-block__title {
	display: flex;
	align-items: center;
	font-size: 30rpx;
	font-weight: 700;
	color: #0f172a;
}

.demo-block__bar {
	width: 6rpx;
	height: 28rpx;
	margin-right: 14rpx;
	border-radius: 8rpx;
	background: linear-gradient(180deg, #06b6d4 0%, #2f6bff 100%);
}

.demo-block__tag {
	padding: 4rpx 12rpx;
	border: 1rpx solid #e2e8f0;
	border-radius: 999rpx;
	font-size: 20rpx;
	font-weight: 600;
	letter-spacing: 1rpx;
	color: #94a3b8;
}

.demo-block__desc {
	display: block;
	margin-top: 12rpx;
	font-size: 26rpx;
	line-height: 1.7;
	color: #64748b;
}

.demo-block__tabs {
	display: flex;
	align-items: center;
	padding: 0 28rpx 22rpx;
}

.demo-block__tab {
	display: flex;
	align-items: center;
	gap: 8rpx;
	margin-right: 8rpx;
	padding: 8rpx 20rpx;
	border-radius: 999rpx;
	background-color: #f4f7fb;
	font-size: 22rpx;
	line-height: 1.4;
	color: #64748b;
}

.demo-block__live-dot {
	width: 10rpx;
	height: 10rpx;
	border-radius: 50%;
	background-color: #22c55e;
	box-shadow: 0 0 0 4rpx rgba(34, 197, 94, 0.14);
}

.demo-block__tab--active {
	background-color: #0f172a;
	font-weight: 600;
	color: #ffffff;
}

.demo-block__full {
	margin-left: auto;
	padding: 8rpx 16rpx;
	border-radius: 999rpx;
	background-color: #eef4ff;
	font-size: 20rpx;
	line-height: 1.4;
	color: #2f6bff;
}

.demo-block__copy {
	margin-left: 8rpx;
	padding: 8rpx 18rpx;
	border: 1rpx solid #e2e8f0;
	border-radius: 999rpx;
	font-size: 20rpx;
	line-height: 1.4;
	color: #2f6bff;
}

.demo-block__readonly {
	display: block;
	margin: -4rpx 28rpx 18rpx;
	font-size: 20rpx;
	line-height: 1.5;
	color: #64748b;
}

.demo-block__body {
	padding: 0 28rpx 28rpx;
}

.demo-block__code-wrap {
	margin: 0;
	background-color: #0f172a;
	border-top: 1rpx solid #1e293b;
	border-radius: 0 0 28rpx 28rpx;
	overflow: hidden;
}

.demo-block__code-bar {
	display: flex;
	align-items: center;
	padding: 14rpx 28rpx 0;
}

.demo-block__code-dot {
	width: 10rpx;
	height: 10rpx;
	margin-right: 8rpx;
	border-radius: 50%;
}

.demo-block__code-dot--red {
	background: #f87171;
}

.demo-block__code-dot--amber {
	background: #fbbf24;
}

.demo-block__code-dot--green {
	background: #34d399;
}

.demo-block__code-hint {
	margin-left: auto;
	font-size: 20rpx;
	letter-spacing: 1rpx;
	color: #64748b;
}

.demo-block__code-expand {
	margin-left: 16rpx;
	font-size: 20rpx;
	font-weight: 600;
	color: #67e8f9;
}

.demo-block__code-scroll {
	width: 100%;
	height: 520rpx;
}

.demo-block__code-scroll--expanded {
	height: 78vh;
	max-height: 1200rpx;
}

.demo-block__code {
	display: inline-block;
	box-sizing: border-box;
	min-width: 100%;
	padding: 16rpx 28rpx 24rpx;
	font-size: 24rpx;
	line-height: 1.8;
	color: #cbd5e1;
	white-space: pre;
	word-break: normal;
	font-family: Menlo, Consolas, 'Courier New', monospace;
}
</style>
