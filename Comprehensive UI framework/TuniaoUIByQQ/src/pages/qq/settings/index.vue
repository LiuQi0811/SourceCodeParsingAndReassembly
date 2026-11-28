<script lang="ts" setup>
	import { ref } from 'vue'
	import { applyTheme, logout, qqStore } from '@/qq/store'
	import { clearPersistedState } from '@/qq/persist'
	import { goBack } from '@/qq/router'

	const verify = ref(true)
	const fontIndex = ref(1)

	function onExit() {
		uni.showModal({
			title: '退出登录',
			content: '退出后需要重新登录才能继续使用',
			success: (res) => {
				if (!res.confirm) return
				logout()
				uni.reLaunch({ url: '/pages/qq/login/index' })
			},
		})
	}

	function toast(title: string) {
		uni.showToast({ title, icon: 'none' })
	}

	function onFont() {
		fontIndex.value = (fontIndex.value + 1) % 3
		toast(`演示：字体大小切换为 ${['小', '标准', '大'][fontIndex.value]}`)
	}

	function onDark() {
		applyTheme()
	}

	function onResetDemo() {
		uni.showModal({
			title: '重置演示数据',
			content: '将清空本地保存的聊天、群互动、动态等进度，恢复到初始演示状态；登录状态会保留。',
			confirmText: '重置',
			confirmColor: '#FA5151',
			cancelText: '取消',
			success: (res) => {
				if (!res.confirm) return
				clearPersistedState()
				qqStore.setting.dark = false
				uni.removeStorageSync('qq-demo-dark')
				applyTheme()
				uni.showToast({ title: '已重置，即将刷新', icon: 'none' })
				setTimeout(() => {
					// #ifdef H5
					window.location.hash = '#/pages/qq/message/index'
					window.location.reload()
					// #endif
					// #ifndef H5
					uni.reLaunch({ url: '/pages/qq/message/index' })
					// #endif
				}, 500)
			},
		})
	}
</script>

<template>
	<view class="qq-page settings-page">
		<qq-navbar title="设置" bg="#F7F8FA" />

		<!-- 账号与安全 -->
		<view class="settings-group">
			<view class="settings-group__title">账号</view>
			<view class="settings-cell" @tap="toast('演示：账号与安全')">
				<view class="settings-cell__icon settings-cell__icon--blue">
					<tn-icon name="safe" size="17px" color="#12B7F5" />
				</view>
				<text class="settings-cell__label">账号与安全</text>
				<text class="settings-cell__value">已保护</text>
				<tn-icon name="right" size="13px" color="#C9CDD4" />
			</view>
			<view class="settings-cell" @tap="toast('演示：手机号管理')">
				<view class="settings-cell__icon settings-cell__icon--green">
					<tn-icon name="iphone" size="17px" color="#32C48D" />
				</view>
				<text class="settings-cell__label">手机号</text>
				<text class="settings-cell__value">138****8888</text>
				<tn-icon name="right" size="13px" color="#C9CDD4" />
			</view>
			<view class="settings-cell settings-cell--last" @tap="toast('演示：登录设备管理')">
				<view class="settings-cell__icon settings-cell__icon--purple">
					<tn-icon name="lock" size="17px" color="#8E54E9" />
				</view>
				<text class="settings-cell__label">登录设备管理</text>
				<text class="settings-cell__value">2 台设备</text>
				<tn-icon name="right" size="13px" color="#C9CDD4" />
			</view>
		</view>

		<!-- 消息通知 -->
		<view class="settings-group">
			<view class="settings-group__title">消息通知</view>
			<view class="settings-cell">
				<text class="settings-cell__label settings-cell__label--plain">新消息通知</text>
				<view class="settings-cell__switch">
					<tn-switch v-model="qqStore.setting.notify" active-color="tn-blue" />
				</view>
			</view>
			<view class="settings-cell">
				<text class="settings-cell__label settings-cell__label--plain">声音提醒</text>
				<view class="settings-cell__switch">
					<tn-switch v-model="qqStore.setting.sound" active-color="tn-blue" />
				</view>
			</view>
			<view class="settings-cell">
				<text class="settings-cell__label settings-cell__label--plain">震动提醒</text>
				<view class="settings-cell__switch">
					<tn-switch v-model="qqStore.setting.vibrate" active-color="tn-blue" />
				</view>
			</view>
			<view class="settings-cell settings-cell--last">
				<text class="settings-cell__label settings-cell__label--plain">回车发送消息</text>
				<view class="settings-cell__switch">
					<tn-switch v-model="qqStore.setting.enterSend" active-color="tn-blue" />
				</view>
			</view>
		</view>

		<!-- 隐私 -->
		<view class="settings-group">
			<view class="settings-group__title">隐私</view>
			<view class="settings-cell">
				<text class="settings-cell__label settings-cell__label--plain">加我为好友时需要验证</text>
				<view class="settings-cell__switch">
					<tn-switch v-model="verify" active-color="tn-blue" />
				</view>
			</view>
			<view class="settings-cell" @tap="toast('演示：动态权限设置')">
				<text class="settings-cell__label settings-cell__label--plain">动态权限</text>
				<text class="settings-cell__value">好友可见</text>
				<tn-icon name="right" size="13px" color="#C9CDD4" />
			</view>
			<view class="settings-cell settings-cell--last" @tap="toast('演示：黑名单管理')">
				<text class="settings-cell__label settings-cell__label--plain">黑名单</text>
				<text class="settings-cell__value">0 人</text>
				<tn-icon name="right" size="13px" color="#C9CDD4" />
			</view>
		</view>

		<!-- 通用 -->
		<view class="settings-group">
			<view class="settings-group__title">通用</view>
			<view class="settings-cell">
				<text class="settings-cell__label settings-cell__label--plain">深色模式</text>
				<view class="settings-cell__switch">
					<tn-switch v-model="qqStore.setting.dark" active-color="tn-blue" @change="onDark" />
				</view>
			</view>
			<view class="settings-cell" @tap="onFont">
				<text class="settings-cell__label settings-cell__label--plain">字体大小</text>
				<text class="settings-cell__value">{{ ['小', '标准', '大'][fontIndex] }}</text>
				<tn-icon name="right" size="13px" color="#C9CDD4" />
			</view>
			<view class="settings-cell" @tap="toast('演示：聊天背景设置')">
				<text class="settings-cell__label settings-cell__label--plain">聊天背景</text>
				<tn-icon name="right" size="13px" color="#C9CDD4" />
			</view>
			<view class="settings-cell settings-cell--last" @tap="toast('演示：清理缓存')">
				<text class="settings-cell__label settings-cell__label--plain">存储空间</text>
				<text class="settings-cell__value">1.2 GB</text>
				<tn-icon name="right" size="13px" color="#C9CDD4" />
			</view>
		</view>

		<!-- 演示数据 -->
		<view class="settings-group">
			<view class="settings-group__title">演示数据</view>
			<view class="settings-cell">
				<text class="settings-cell__label settings-cell__label--plain">演示进度</text>
				<text class="settings-cell__value">自动保存到本地</text>
			</view>
			<view class="settings-cell settings-cell--last" @tap="onResetDemo">
				<text class="settings-cell__label settings-cell__label--danger">重置演示数据</text>
				<text class="settings-cell__value">恢复初始状态</text>
				<tn-icon name="right" size="13px" color="#C9CDD4" />
			</view>
		</view>

		<!-- 关于 -->
		<view class="settings-group">
			<view class="settings-group__title">关于</view>
			<view class="settings-cell" @tap="toast('TuniaoUI · QQ 交互原型 v1.0.0')">
				<text class="settings-cell__label settings-cell__label--plain">关于 QQ</text>
				<text class="settings-cell__value">9.0.0</text>
				<tn-icon name="right" size="13px" color="#C9CDD4" />
			</view>
			<view class="settings-cell settings-cell--last" @tap="toast('演示：帮助与反馈')">
				<text class="settings-cell__label settings-cell__label--plain">帮助与反馈</text>
				<tn-icon name="right" size="13px" color="#C9CDD4" />
			</view>
		</view>

		<view class="settings-exit" @tap="onExit">
			<text class="settings-exit__text">退出登录</text>
		</view>

		<view class="settings-footer">TuniaoUI · QQ UI Demo</view>
	</view>
</template>

<style lang="scss" scoped>
	.settings-page {
		padding-bottom: 24px;
	}

	.settings-group {
		margin: 10px 12px 0;
		background-color: var(--qq-card);
		border-radius: 12px;
		overflow: hidden;
	}

	.settings-group__title {
		padding: 8px 14px 7px;
		background-color: var(--qq-card-2);
		font-size: 11px;
		color: var(--qq-text-3);
		letter-spacing: 0.2px;
	}

	.settings-cell {
		display: flex;
		align-items: center;
		min-height: 46px;
		padding: 0 14px;
		position: relative;
	}

	.settings-cell::after {
		content: '';
		position: absolute;
		left: 14px;
		right: 0;
		bottom: 0;
		height: 1px;
		background-color: var(--qq-bg);
		transform: scaleY(0.7);
	}

	.settings-cell--last::after {
		display: none;
	}

	.settings-cell__icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 26px;
		height: 26px;
		border-radius: 7px;
		margin-right: 10px;
	}

	.settings-cell__icon--blue {
		background-color: rgba(18, 183, 245, 0.1);
	}

	.settings-cell__icon--green {
		background-color: rgba(50, 196, 141, 0.1);
	}

	.settings-cell__icon--purple {
		background-color: rgba(142, 84, 233, 0.1);
	}

	.settings-cell__label {
		flex: 1;
		min-width: 0;
		font-size: 13.5px;
		color: var(--qq-text);
	}

	.settings-cell__label--plain {
		flex: 1;
	}

	.settings-cell__label--danger {
		color: #fa5151;
		font-weight: 500;
	}

	.settings-cell__value {
		margin-right: 4px;
		font-size: 12px;
		color: var(--qq-text-3);
	}

	.settings-cell__switch {
		margin-left: auto;
	}

	.settings-exit {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 48px;
		margin: 12px 12px 0;
		background-color: var(--qq-card);
		border-radius: 12px;
	}

	.settings-exit__text {
		font-size: 13.5px;
		color: #fa5151;
	}

	.settings-footer {
		padding: 20px 0;
		text-align: center;
		font-size: 10.5px;
		color: var(--qq-text-4);
	}
</style>
