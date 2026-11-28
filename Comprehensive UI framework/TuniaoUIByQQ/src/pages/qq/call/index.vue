<script lang="ts" setup>
	import { computed, ref } from 'vue'
	import { onLoad, onUnload } from '@dcloudio/uni-app'
	import { findConversation, findUser, qqStore } from '@/qq/store'

	const convId = ref('')
	const mode = ref<'voice' | 'video'>('voice')
	const phase = ref<'calling' | 'connected'>('calling')
	const seconds = ref(0)
	const muted = ref(false)
	const speaker = ref(true)
	const cameraOn = ref(true)

	let answerTimer: ReturnType<typeof setTimeout> | null = null
	let tickTimer: ReturnType<typeof setInterval> | null = null

	onLoad((options: any) => {
		convId.value = options?.id || 'c1'
		mode.value = options?.mode === 'video' ? 'video' : 'voice'
		answerTimer = setTimeout(() => {
			phase.value = 'connected'
			tickTimer = setInterval(() => {
				seconds.value += 1
			}, 1000)
		}, 2200)
	})

	onUnload(() => {
		if (answerTimer) clearTimeout(answerTimer)
		if (tickTimer) clearInterval(tickTimer)
	})

	const conv = computed(() => findConversation(convId.value))

	const peer = computed(() => {
		if (!conv.value || conv.value.type === 'group') return null
		return findUser(conv.value.targetId)
	})

	const displayName = computed(() => {
		if (conv.value?.type === 'group') return conv.value.name
		return peer.value?.name || conv.value?.name || '好友'
	})

	const avatarFrom = computed(() => peer.value?.avatarFrom || '#12B7F5')
	const avatarTo = computed(() => peer.value?.avatarTo || '#0A83C4')

	const timeText = computed(() => {
		const m = Math.floor(seconds.value / 60)
		const s = seconds.value % 60
		return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`
	})

	const statusText = computed(() =>
		phase.value === 'calling'
			? mode.value === 'video'
				? '正在等待对方接受视频通话…'
				: '正在呼叫…'
			: timeText.value
	)

	function toggleMute() {
		muted.value = !muted.value
	}

	function toggleSpeaker() {
		speaker.value = !speaker.value
	}

	function toggleCamera() {
		cameraOn.value = !cameraOn.value
		uni.showToast({ title: cameraOn.value ? '已开启摄像头' : '已关闭摄像头', icon: 'none' })
	}

	function hangup() {
		uni.showToast({ title: '通话已结束', icon: 'none' })
		setTimeout(() => {
			const pages = getCurrentPages()
			if (pages.length > 1) uni.navigateBack({ delta: 1 })
			else uni.reLaunch({ url: '/pages/qq/message/index' })
		}, 350)
	}
</script>

<template>
	<view class="call-page" :class="mode === 'video' ? 'call-page--video' : 'call-page--voice'">
		<image v-if="mode === 'video'" class="call-bg" src="/static/qq/m3.jpg" mode="aspectFill" />
		<view class="call-shade" />

		<view class="call-top">
			<view class="call-top__mode">
				<text class="call-top__mode-text">{{ mode === 'video' ? '视频通话' : '语音通话' }}</text>
			</view>
		</view>

		<!-- 视频通话时右上角的小窗 -->
		<view v-if="mode === 'video'" class="call-self">
			<view v-if="cameraOn" class="call-self__box">
				<image class="call-self__img" src="/static/qq/m5.jpg" mode="aspectFill" />
				<text class="call-self__label">我</text>
			</view>
			<view v-else class="call-self__box call-self__box--off">
				<tn-icon name="video" size="18px" color="rgba(255,255,255,0.5)" />
				<text class="call-self__label">已关闭</text>
			</view>
		</view>

		<view class="call-body">
			<view class="call-avatar" :class="{ 'call-avatar--pulse': phase === 'calling' }">
				<qq-avatar :name="displayName" :from="avatarFrom" :to="avatarTo" :size="96" />
			</view>
			<text class="call-name">{{ displayName }}</text>
			<text class="call-status">{{ statusText }}</text>
		</view>

		<view class="call-actions">
			<view class="call-action" @tap="toggleMute">
				<view class="call-action__btn" :class="{ 'call-action__btn--on': muted }">
					<tn-icon name="microphone" size="22px" :color="muted ? '#12B7F5' : '#FFFFFF'" />
				</view>
				<text class="call-action__label">{{ muted ? '已静音' : '静音' }}</text>
			</view>

			<view class="call-action" @tap="hangup">
				<view class="call-action__btn call-action__btn--hangup">
					<tn-icon name="close" size="23px" color="#FFFFFF" />
				</view>
				<text class="call-action__label">挂断</text>
			</view>

			<view v-if="mode === 'voice'" class="call-action" @tap="toggleSpeaker">
				<view class="call-action__btn" :class="{ 'call-action__btn--on': speaker }">
					<tn-icon name="voice" size="22px" :color="speaker ? '#12B7F5' : '#FFFFFF'" />
				</view>
				<text class="call-action__label">免提</text>
			</view>
			<view v-else class="call-action" @tap="toggleCamera">
				<view class="call-action__btn" :class="{ 'call-action__btn--on': !cameraOn }">
					<tn-icon name="video" size="22px" :color="cameraOn ? '#FFFFFF' : '#12B7F5'" />
				</view>
				<text class="call-action__label">{{ cameraOn ? '摄像头' : '已关闭' }}</text>
			</view>
		</view>

		<text class="call-hint">演示通话 · 2 秒后自动接通</text>
	</view>
</template>

<style lang="scss" scoped>
	.call-page {
		position: relative;
		width: 100%;
		max-width: 430px;
		height: 100vh;
		margin: 0 auto;
		overflow: hidden;
		background: linear-gradient(165deg, #16273a 0%, #0d1620 55%, #070b10 100%);
	}

	.call-page--voice {
		background: linear-gradient(165deg, #1b3550 0%, #101c2a 52%, #080b10 100%);
	}

	.call-bg {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		filter: blur(3px) brightness(0.8);
		transform: scale(1.04);
		opacity: 0.9;
	}

	.call-shade {
		position: absolute;
		inset: 0;
		background: linear-gradient(180deg, rgba(6, 10, 14, 0.42) 0%, rgba(6, 10, 14, 0.12) 42%, rgba(4, 7, 10, 0.82) 100%);
	}

	.call-top {
		position: relative;
		z-index: 2;
		padding: 48px 22px 0;
	}

	.call-top__mode {
		display: flex;
		align-items: center;
		gap: 4px;
	}

	.call-top__mode-text {
		font-size: 11px;
		color: rgba(255, 255, 255, 0.62);
		letter-spacing: 0.4px;
	}
	.call-self {
		position: absolute;
		z-index: 3;
		right: 16px;
		top: 108px;
		width: 92px;
		height: 132px;
		border-radius: 12px;
		overflow: hidden;
		box-shadow: 0 10px 24px rgba(0, 0, 0, 0.35);
	}

	.call-self__box {
		position: relative;
		width: 100%;
		height: 100%;
		background-color: rgba(255, 255, 255, 0.08);
	}

	.call-self__box--off {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 6px;
	}

	.call-self__box--off .call-self__label {
		position: static;
		padding: 0;
		background-color: transparent;
		font-size: 9px;
	}

	.call-self__img {
		width: 100%;
		height: 100%;
		display: block;
	}

	.call-self__label {
		position: absolute;
		left: 7px;
		bottom: 6px;
		padding: 1px 6px;
		border-radius: 8px;
		background-color: rgba(0, 0, 0, 0.4);
		font-size: 9px;
		color: rgba(255, 255, 255, 0.85);
	}

	.call-body {
		position: relative;
		z-index: 2;
		display: flex;
		flex-direction: column;
		align-items: center;
		margin-top: 92px;
	}

	.call-avatar {
		border-radius: 50%;
		box-shadow: 0 0 0 10px rgba(255, 255, 255, 0.06), 0 18px 40px rgba(0, 0, 0, 0.35);
	}

	.call-avatar--pulse {
		animation: call-pulse 1.8s ease-in-out infinite;
	}

	@keyframes call-pulse {
		0% {
			box-shadow: 0 0 0 8px rgba(255, 255, 255, 0.05), 0 18px 40px rgba(0, 0, 0, 0.35);
		}
		60% {
			box-shadow: 0 0 0 22px rgba(255, 255, 255, 0.02), 0 18px 40px rgba(0, 0, 0, 0.35);
		}
		100% {
			box-shadow: 0 0 0 8px rgba(255, 255, 255, 0.05), 0 18px 40px rgba(0, 0, 0, 0.35);
		}
	}

	.call-name {
		margin-top: 20px;
		font-size: 22px;
		font-weight: 600;
		color: #ffffff;
		letter-spacing: 0.5px;
	}

	.call-status {
		margin-top: 8px;
		font-size: 12px;
		color: rgba(255, 255, 255, 0.6);
	}

	.call-actions {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 58px;
		z-index: 3;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 44px;
	}

	.call-action {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 10px;
	}

	.call-action__btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 60px;
		height: 60px;
		border-radius: 50%;
		background-color: rgba(255, 255, 255, 0.16);
		transition: background-color 0.2s ease;
	}

	.call-action__btn--on {
		background-color: rgba(255, 255, 255, 0.92);
	}

	.call-action__btn--hangup {
		background-color: #fa5151;
		box-shadow: 0 10px 26px rgba(250, 81, 81, 0.38);
	}

	.call-action__label {
		font-size: 10.5px;
		color: rgba(255, 255, 255, 0.72);
	}

	.call-hint {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 22px;
		z-index: 3;
		text-align: center;
		font-size: 9.5px;
		color: rgba(255, 255, 255, 0.35);
	}
</style>
