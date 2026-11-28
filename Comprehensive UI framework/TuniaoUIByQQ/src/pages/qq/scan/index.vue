<script lang="ts" setup>
	import { computed, ref } from 'vue'
	import { onLoad } from '@dcloudio/uni-app'
	import { goBack } from '@/qq/router'

	const statusBarHeight = ref(0)
	const torchOn = ref(false)
	const scanning = ref(false)

	onLoad(() => {
		try {
			statusBarHeight.value = uni.getSystemInfoSync().statusBarHeight || 0
		} catch (e) {
			statusBarHeight.value = 0
		}
	})
	const topPad = computed(() => (statusBarHeight.value ? `${statusBarHeight.value}px` : '10px'))

	function onScanTap() {
		if (scanning.value) return
		scanning.value = true
		setTimeout(() => {
			scanning.value = false
			uni.showModal({
				title: '扫描成功',
				content: '识别到「TuniaoUI 组件库」小程序码，是否打开？',
				confirmText: '打开',
				success: (res) => {
					if (res.confirm) {
						uni.showToast({ title: '演示：打开 TuniaoUI 文档', icon: 'none' })
					}
				},
			})
		}, 1400)
	}

	function onAlbum() {
		uni.showToast({ title: '演示：从相册选择二维码', icon: 'none' })
	}

	function onMyCode() {
		uni.showToast({ title: '演示：展示我的二维码', icon: 'none' })
	}

	function onTorch() {
		torchOn.value = !torchOn.value
	}

	function onClose() {
		goBack()
	}
</script>

<template>
	<view class="scan-page">
		<!-- 模拟相机画面 -->
		<image class="scan-bg" src="/static/qq/m3.jpg" mode="aspectFill" />
		<view class="scan-mask" />
		<view v-if="torchOn" class="scan-torch" />

		<!-- 顶部 -->
		<view class="scan-top" :style="{ paddingTop: topPad }">
			<view class="scan-top__btn" @tap="onClose">
				<tn-icon name="close" size="20px" color="tn-white" />
			</view>
			<text class="scan-top__title">扫一扫</text>
			<view class="scan-top__btn" @tap="onTorch">
				<tn-icon name="light-fill" size="20px" :color="torchOn ? '#FFD666' : 'tn-white'" />
			</view>
		</view>

		<!-- 扫描框 -->
		<view class="scan-frame-wrap">
			<view class="scan-frame" @tap="onScanTap">
				<view class="scan-corner scan-corner--tl" />
				<view class="scan-corner scan-corner--tr" />
				<view class="scan-corner scan-corner--bl" />
				<view class="scan-corner scan-corner--br" />
				<view class="scan-line" :class="{ 'scan-line--slow': scanning }" />
			</view>
			<text class="scan-tip">将二维码放入框内，即可自动扫描</text>
			<view class="scan-subtip" @tap="onAlbum">
				<tn-icon name="image" size="13px" color="tn-white" />
				<text class="scan-subtip__text">从相册选择</text>
			</view>
		</view>

		<!-- 底部操作 -->
		<view class="scan-bottom">
			<view class="scan-action" @tap="onAlbum">
				<view class="scan-action__icon">
					<tn-icon name="image" size="22px" color="tn-white" />
				</view>
				<text class="scan-action__label">相册</text>
			</view>
			<view class="scan-action" @tap="onMyCode">
				<view class="scan-action__icon">
					<tn-icon name="qr-code" size="22px" color="tn-white" />
				</view>
				<text class="scan-action__label">我的二维码</text>
			</view>
			<view class="scan-action" @tap="onTorch">
				<view class="scan-action__icon" :class="{ 'scan-action__icon--on': torchOn }">
					<tn-icon name="light" size="22px" color="tn-white" />
				</view>
				<text class="scan-action__label">闪光灯</text>
			</view>
		</view>
	</view>
</template>

<style lang="scss" scoped>
	.scan-page {
		position: relative;
		width: 100%;
		max-width: 430px;
		margin: 0 auto;
		height: 100vh;
		background-color: #0b0e12;
		overflow: hidden;
	}

	.scan-bg {
		position: absolute;
		left: 0;
		top: 0;
		width: 100%;
		height: 100%;
		filter: brightness(0.5) saturate(0.8) blur(1.5px);
	}

	.scan-mask {
		position: absolute;
		left: 0;
		top: 0;
		width: 100%;
		height: 100%;
		background: radial-gradient(circle at 50% 42%, rgba(0, 0, 0, 0) 0%, rgba(0, 0, 0, 0.72) 68%);
	}

	.scan-torch {
		position: absolute;
		left: 50%;
		top: 40%;
		transform: translate(-50%, -50%);
		width: 340px;
		height: 340px;
		border-radius: 50%;
		background: radial-gradient(circle, rgba(255, 240, 200, 0.28) 0%, rgba(255, 240, 200, 0) 70%);
		pointer-events: none;
	}

	.scan-top {
		position: relative;
		z-index: 2;
		display: flex;
		align-items: center;
		padding: 6px 14px;
	}

	.scan-top__btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		border-radius: 50%;
		background-color: rgba(255, 255, 255, 0.14);
	}

	.scan-top__title {
		flex: 1;
		text-align: center;
		font-size: 16px;
		font-weight: 600;
		color: #ffffff;
	}

	.scan-frame-wrap {
		position: relative;
		z-index: 2;
		display: flex;
		flex-direction: column;
		align-items: center;
		padding-top: 92px;
	}

	.scan-frame {
		position: relative;
		width: 244px;
		height: 244px;
		border-radius: 12px;
		overflow: hidden;
	}

	.scan-corner {
		position: absolute;
		width: 26px;
		height: 26px;
		border-color: #4fd8ff;
		border-style: solid;
		border-width: 0;
	}

	.scan-corner--tl {
		left: 0;
		top: 0;
		border-left-width: 3px;
		border-top-width: 3px;
		border-top-left-radius: 8px;
	}

	.scan-corner--tr {
		right: 0;
		top: 0;
		border-right-width: 3px;
		border-top-width: 3px;
		border-top-right-radius: 8px;
	}

	.scan-corner--bl {
		left: 0;
		bottom: 0;
		border-left-width: 3px;
		border-bottom-width: 3px;
		border-bottom-left-radius: 8px;
	}

	.scan-corner--br {
		right: 0;
		bottom: 0;
		border-right-width: 3px;
		border-bottom-width: 3px;
		border-bottom-right-radius: 8px;
	}

	.scan-line {
		position: absolute;
		left: 8px;
		right: 8px;
		top: 0;
		height: 2px;
		border-radius: 2px;
		background: linear-gradient(90deg, rgba(79, 216, 255, 0), #4fd8ff, rgba(79, 216, 255, 0));
		box-shadow: 0 0 10px rgba(79, 216, 255, 0.8);
		animation: scan-move 2.2s infinite ease-in-out;
	}

	.scan-line--slow {
		animation-duration: 1.2s;
	}

	@keyframes scan-move {
		0% { top: 8px; opacity: 0.2; }
		50% { top: 232px; opacity: 1; }
		100% { top: 8px; opacity: 0.2; }
	}

	.scan-tip {
		margin-top: 22px;
		font-size: 12px;
		color: rgba(255, 255, 255, 0.85);
	}

	.scan-subtip {
		display: flex;
		align-items: center;
		gap: 4px;
		margin-top: 10px;
		padding: 4px 10px;
		border-radius: 12px;
		background-color: rgba(255, 255, 255, 0.14);
	}

	.scan-subtip__text {
		font-size: 11px;
		color: rgba(255, 255, 255, 0.8);
	}

	.scan-bottom {
		position: absolute;
		left: 0;
		right: 0;
		bottom: calc(28px + env(safe-area-inset-bottom));
		z-index: 2;
		display: flex;
		justify-content: space-around;
		padding: 0 26px;
	}

	.scan-action {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
	}

	.scan-action__icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 48px;
		height: 48px;
		border-radius: 50%;
		background-color: rgba(255, 255, 255, 0.16);
		backdrop-filter: blur(6px);
	}

	.scan-action__icon--on {
		background-color: rgba(255, 214, 102, 0.4);
	}

	.scan-action__label {
		font-size: 11px;
		color: rgba(255, 255, 255, 0.86);
	}
</style>
