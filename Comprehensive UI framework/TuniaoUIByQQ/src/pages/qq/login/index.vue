<script lang="ts" setup>
	import { ref } from 'vue'
	import { onLoad } from '@dcloudio/uni-app'
	import { login, qqStore, restoreLoginState } from '@/qq/store'
	import { TAB_PATHS } from '@/qq/router'

	const account = ref('1000123456')
	const password = ref('qq123456')
	const agreed = ref(true)
	const loading = ref(false)
	const showPassword = ref(false)

	onLoad(() => {
		restoreLoginState()
		if (qqStore.loggedIn) {
			uni.reLaunch({ url: TAB_PATHS.message })
		}
	})

	function onLogin() {
		if (!account.value.trim()) {
			uni.showToast({ title: '请输入 QQ 号', icon: 'none' })
			return
		}
		if (!password.value.trim()) {
			uni.showToast({ title: '请输入密码', icon: 'none' })
			return
		}
		if (!agreed.value) {
			uni.showToast({ title: '请先阅读并同意服务协议', icon: 'none' })
			return
		}
		loading.value = true
		setTimeout(() => {
			loading.value = false
			login()
			uni.reLaunch({ url: TAB_PATHS.message })
		}, 700)
	}

	function onMock(title: string) {
		uni.showToast({ title, icon: 'none' })
	}
</script>

<template>
	<view class="login-page">
		<view class="login-glow login-glow--one" />
		<view class="login-glow login-glow--two" />
		<view class="login-glow login-glow--three" />

		<view class="login-top">
			<view class="login-logo">
				<svg class="login-penguin" viewBox="0 0 64 64" width="62" height="62">
					<ellipse cx="32" cy="38" rx="18.5" ry="21" fill="#12202F" />
					<circle cx="32" cy="22" r="12.5" fill="#12202F" />
					<ellipse cx="32" cy="42" rx="10.5" ry="14.5" fill="#F7FBFF" />
					<circle cx="28.6" cy="21" r="4.8" fill="#F7FBFF" />
					<circle cx="35.4" cy="21" r="4.8" fill="#F7FBFF" />
					<circle cx="29.6" cy="20.4" r="1.7" fill="#12202F" />
					<circle cx="34.4" cy="20.4" r="1.7" fill="#12202F" />
					<path d="M32 24 L29.2 27.6 H34.8 Z" fill="#FFB02E" />
					<path d="M19.5 32 q12.5 4 25 0 l0 4.2 q-12.5 4 -25 0 z" fill="#FA5151" />
					<path d="M41.8 35.6 l4.2 6.2 -3.4 1.3 -3.2 -5.4 z" fill="#E8453F" />
					<ellipse cx="25.5" cy="57" rx="6" ry="3" fill="#FFB02E" />
					<ellipse cx="38.5" cy="57" rx="6" ry="3" fill="#FFB02E" />
				</svg>
			</view>
			<text class="login-title">QQ</text>
			<text class="login-sub">QQ 9.0 · 基于 TuniaoUI 的交互原型</text>
		</view>

		<view class="login-form">
			<view class="login-field">
				<tn-icon name="my-simple" size="18px" color="#12B7F5" />
				<input
					v-model="account"
					class="login-input"
					placeholder="QQ 号 / 手机号 / 邮箱"
					placeholder-class="login-placeholder"
					:maxlength="20"
				/>
			</view>
			<view class="login-field">
				<tn-icon name="lock" size="18px" color="#12B7F5" />
				<input
					v-model="password"
					class="login-input"
					placeholder="密码"
					placeholder-class="login-placeholder"
					:password="!showPassword"
					:maxlength="24"
					confirm-type="done"
					@confirm="onLogin"
				/>
				<view class="login-eye" @tap="showPassword = !showPassword">
					<tn-icon :name="showPassword ? 'eye-fill' : 'eye'" size="17px" color="#A6AAB2" />
				</view>
			</view>

			<view class="login-primary" :class="{ 'login-primary--loading': loading }" @tap="onLogin">
				<tn-loading v-if="loading" mode="circle" size="18px" color="tn-white" />
				<text v-else class="login-primary__text">登 录</text>
			</view>

			<view class="login-links">
				<text class="login-link" @tap="onMock('演示：新用户注册')">新用户注册</text>
				<view class="login-link__line" />
				<text class="login-link" @tap="onMock('演示：找回密码')">忘记密码</text>
			</view>

			<view class="login-agreement" @tap="agreed = !agreed">
				<view class="login-check" :class="{ 'login-check--on': agreed }">
					<tn-icon v-if="agreed" name="check" size="10px" color="#12B7F5" />
				</view>
				<text class="login-agreement__text">
					已阅读并同意《服务协议》与《隐私政策》
				</text>
			</view>
		</view>

		<view class="login-footer">
			<text class="login-footer__hint">演示账号已预填，点击登录即可进入</text>
			<text class="login-footer__version">TuniaoUI · QQ UI Demo</text>
		</view>
	</view>
</template>

<style lang="scss" scoped>
	.login-page {
		position: relative;
		width: 100%;
		max-width: 430px;
		min-height: 100vh;
		margin: 0 auto;
		padding: 0 24px;
		box-sizing: border-box;
		background: linear-gradient(160deg, #23c2ff 0%, #12a8e8 42%, #086fb0 100%);
		overflow: hidden;
		display: flex;
		flex-direction: column;
	}

	.login-glow {
		position: absolute;
		border-radius: 50%;
		background-color: rgba(255, 255, 255, 0.12);
	}

	.login-glow--one {
		right: -70px;
		top: -90px;
		width: 260px;
		height: 260px;
	}

	.login-glow--two {
		left: -90px;
		top: 220px;
		width: 220px;
		height: 220px;
		background-color: rgba(255, 255, 255, 0.07);
	}

	.login-glow--three {
		right: -40px;
		bottom: -80px;
		width: 240px;
		height: 240px;
		background-color: rgba(255, 255, 255, 0.05);
	}

	.login-top {
		position: relative;
		z-index: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		padding-top: 96px;
	}

	.login-logo {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 84px;
		height: 84px;
		border-radius: 50%;
		background-color: rgba(255, 255, 255, 0.18);
		border: 1.5px solid rgba(255, 255, 255, 0.3);
		box-shadow: 0 10px 26px rgba(4, 67, 104, 0.25);
	}

	.login-penguin {
		display: block;
		width: 62px;
		height: 62px;
	}

	.login-title {
		margin-top: 18px;
		font-size: 30px;
		font-weight: 800;
		letter-spacing: 4px;
		color: #ffffff;
	}

	.login-sub {
		margin-top: 8px;
		font-size: 11.5px;
		color: rgba(255, 255, 255, 0.72);
	}

	.login-form {
		position: relative;
		z-index: 1;
		margin-top: 34px;
	}

	.login-field {
		display: flex;
		align-items: center;
		height: 52px;
		padding: 0 14px;
		margin-bottom: 12px;
		border-radius: 14px;
		background-color: var(--qq-card);
		box-shadow: 0 8px 18px rgba(3, 56, 88, 0.12);
	}

	.login-input {
		flex: 1;
		height: 100%;
		margin-left: 10px;
		font-size: 14px;
		color: var(--qq-text);
	}

	.login-placeholder {
		color: var(--qq-text-3);
		font-size: 13px;
	}

	.login-eye {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 30px;
		height: 30px;
	}

	.login-primary {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 50px;
		margin-top: 20px;
		border-radius: 14px;
		background-color: var(--qq-card);
		box-shadow: 0 10px 22px rgba(3, 56, 88, 0.2);
	}

	.login-primary--loading {
		opacity: 0.9;
	}

	.login-primary__text {
		font-size: 16px;
		font-weight: 700;
		letter-spacing: 4px;
		color: #0a9ed8;
	}

	.login-links {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 12px;
		margin-top: 16px;
	}

	.login-link {
		font-size: 12px;
		color: rgba(255, 255, 255, 0.9);
	}

	.login-link__line {
		width: 1px;
		height: 10px;
		background-color: rgba(255, 255, 255, 0.35);
	}

	.login-agreement {
		display: flex;
		align-items: center;
		gap: 6px;
		justify-content: center;
		margin-top: 22px;
	}

	.login-check {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 15px;
		height: 15px;
		border-radius: 50%;
		border: 1px solid rgba(255, 255, 255, 0.5);
		background-color: transparent;
	}

	.login-check--on {
		background-color: rgba(255, 255, 255, 0.9);
		border-color: #ffffff;
	}

	.login-agreement__text {
		font-size: 10.5px;
		color: rgba(255, 255, 255, 0.72);
	}

	.login-footer {
		position: relative;
		z-index: 1;
		margin-top: auto;
		padding: 30px 0 calc(26px + env(safe-area-inset-bottom));
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
	}

	.login-footer__hint {
		font-size: 11px;
		color: rgba(255, 255, 255, 0.6);
	}

	.login-footer__version {
		font-size: 10px;
		color: rgba(255, 255, 255, 0.4);
	}
</style>
