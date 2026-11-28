<script lang="ts" setup>
	import { ref } from 'vue'
	import { onLoad } from '@dcloudio/uni-app'
	import { goBack } from '@/qq/router'

	const props = withDefaults(
		defineProps<{
			title?: string
			subtitle?: string
			showBack?: boolean
			bg?: string
			color?: string
			border?: boolean
		}>(),
		{
			title: '',
			subtitle: '',
			showBack: true,
			bg: '#F7F8FA',
			color: '#181818',
			border: true,
		}
	)

	const statusBarHeight = ref(0)

	onLoad(() => {
		try {
			statusBarHeight.value = uni.getSystemInfoSync().statusBarHeight || 0
		} catch (e) {
			statusBarHeight.value = 0
		}
	})

	function onBack() {
		goBack()
	}
</script>

<template>
	<view
		class="qq-navbar"
		:class="{ 'qq-navbar--border': border }"
		:style="{ backgroundColor: bg }"
	>
		<!-- 状态栏占位 -->
		<view :style="{ height: `${statusBarHeight}px` }" />
		<view class="qq-navbar__bar">
			<view class="qq-navbar__side" @tap="onBack">
				<view v-if="showBack" class="qq-navbar__back">
					<tn-icon name="left" size="20px" :color="color" />
				</view>
				<slot name="left" />
			</view>

			<view class="qq-navbar__center">
				<text class="qq-navbar__title" :style="{ color: color }">{{ title }}</text>
				<text v-if="subtitle" class="qq-navbar__subtitle" :style="{ color: color }">
					{{ subtitle }}
				</text>
			</view>

			<view class="qq-navbar__side qq-navbar__side--right">
				<slot name="right" />
			</view>
		</view>
	</view>
</template>

<style lang="scss" scoped>
	.qq-navbar {
		position: relative;
		width: 100%;
	}

	.qq-navbar--border::after {
		content: '';
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;
		height: 1px;
		background-color: rgba(0, 0, 0, 0.05);
		transform: scaleY(0.6);
	}

	.qq-navbar__bar {
		position: relative;
		display: flex;
		align-items: center;
		height: 44px;
		padding: 0 10px;
	}

	.qq-navbar__side {
		display: flex;
		align-items: center;
		min-width: 64px;
		height: 100%;
	}

	.qq-navbar__side--right {
		justify-content: flex-end;
		margin-left: auto;
	}

	.qq-navbar__back {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 30px;
		height: 30px;
		border-radius: 50%;
	}

	.qq-navbar__center {
		position: absolute;
		left: 50%;
		top: 50%;
		transform: translate(-50%, -50%);
		display: flex;
		flex-direction: column;
		align-items: center;
		max-width: 60%;
	}

	.qq-navbar__title {
		font-size: 16px;
		font-weight: 600;
		line-height: 1.2;
		max-width: 100%;
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
	}

	.qq-navbar__subtitle {
		margin-top: 1px;
		font-size: 10px;
		opacity: 0.6;
		line-height: 1.2;
	}
</style>
