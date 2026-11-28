<script setup lang="ts">
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { getPageSource } from '../../utils/page-source'

const route = ref('')
const source = ref('')

onLoad((options) => {
	const requested = typeof options?.path === 'string' ? options.path : 'pages/feedback/index'
	route.value = decodeURIComponent(requested)
	source.value = getPageSource(route.value)
})

function back() {
	uni.navigateBack({
		fail: () => uni.switchTab({ url: '/pages/index/index' }),
	})
}

function copyAll() {
	if (!source.value) return
	uni.setClipboardData({
		data: source.value,
		success: () => uni.showToast({ title: '完整源码已复制', icon: 'none' }),
		fail: () => uni.showToast({ title: '复制失败，请长按选择', icon: 'none' }),
	})
}
</script>

<template>
	<view class="source-page">
		<view class="source-head">
			<view>
				<text class="source-eyebrow">FULL SOURCE</text>
				<text class="source-title">完整源码</text>
				<text class="source-route">{{ route }}</text>
			</view>
			<view class="source-actions">
				<tn-button size="sm" type="primary" @click="copyAll">复制全文</tn-button>
				<tn-button size="sm" plain @click="back">返回</tn-button>
			</view>
		</view>

		<view class="source-meta">
			<text>{{ source ? `${source.split('\n').length} 行 · ${(source.length / 1024).toFixed(1)} KB` : '未找到源码' }}</text>
			<text>左右滑动看长行，上下滑动看全文</text>
		</view>

		<scroll-view class="source-scroll" scroll-x scroll-y :show-scrollbar="true">
			<text class="source-code">{{ source || '当前路由没有登记完整源码。' }}</text>
		</scroll-view>
	</view>
</template>

<style lang="scss" scoped>
.source-page {
	box-sizing: border-box;
	min-height: 100vh;
	padding: 24rpx 24rpx calc(32rpx + env(safe-area-inset-bottom));
	background: #f4f7fb;
}

.source-head {
	display: flex;
	align-items: flex-start;
	justify-content: space-between;
	gap: 20rpx;
	padding: 28rpx;
	background: #ffffff;
	border: 1rpx solid #e8eef7;
	border-radius: 24rpx;
	box-shadow: 0 12rpx 32rpx rgba(15, 23, 42, 0.05);
}

.source-eyebrow {
	display: block;
	font-size: 20rpx;
	font-weight: 600;
	letter-spacing: 2rpx;
	color: #2f6bff;
}

.source-title {
	display: block;
	margin-top: 8rpx;
	font-size: 34rpx;
	font-weight: 700;
	color: #0f172a;
}

.source-route {
	display: block;
	margin-top: 10rpx;
	font-size: 24rpx;
	line-height: 1.5;
	color: #64748b;
}

.source-actions {
	flex-shrink: 0;
	display: flex;
	flex-wrap: wrap;
	gap: 12rpx;
}

.source-meta {
	display: flex;
	justify-content: space-between;
	gap: 16rpx;
	margin: 16rpx 4rpx;
	font-size: 22rpx;
	color: #94a3b8;
}

.source-scroll {
	box-sizing: border-box;
	width: 100%;
	height: 68vh;
	padding: 24rpx;
	background: #0f172a;
	border-radius: 24rpx;
}

.source-code {
	display: inline-block;
	min-width: 100%;
	color: #cbd5e1;
	font-size: 24rpx;
	line-height: 1.8;
	white-space: pre;
	word-break: normal;
	font-family: Menlo, Consolas, 'Courier New', monospace;
}
</style>
