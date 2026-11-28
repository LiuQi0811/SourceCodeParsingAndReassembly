<script lang="ts" setup>
	import { computed, ref } from 'vue'
	import { onLoad } from '@dcloudio/uni-app'
	import { logout, qqStore, totalContacts } from '@/qq/store'
	import { goFavorites, goScan, goSettings, goZone, TAB_PATHS } from '@/qq/router'

	const statusBarHeight = ref(0)
	onLoad(() => {
		try {
			statusBarHeight.value = uni.getSystemInfoSync().statusBarHeight || 0
		} catch (e) {
			statusBarHeight.value = 0
		}
	})
	const topPad = computed(() => (statusBarHeight.value ? `${statusBarHeight.value}px` : '8px'))

	const gridItems = [
		{ key: 'wallet', label: '我的钱包', icon: 'money', color: '#FF9F1C' },
		{ key: 'favor', label: '我的收藏', icon: 'star', color: '#F5576C' },
		{ key: 'file', label: '我的文件', icon: 'folder', color: '#4776E6' },
		{ key: 'dress', label: '个性装扮', icon: 'theme', color: '#8E54E9' },
		{ key: 'zone', label: 'QQ空间', icon: 'moments', color: '#12B7F5' },
		{ key: 'game', label: '游戏中心', icon: 'game', color: '#32C48D' },
		{ key: 'album', label: '我的相册', icon: 'image', color: '#F6A623' },
		{ key: 'draft', label: '草稿箱', icon: 'edit-write', color: '#7C828C' },
	]

	const listItems = [
		{ key: 'settings', label: '设置', icon: 'menu-set', color: '#12B7F5' },
		{ key: 'help', label: '帮助与反馈', icon: 'help-question', color: '#32C48D' },
		{ key: 'about', label: '关于 QQ', icon: 'service', color: '#8E54E9' },
	]

	function onGrid(key: string) {
		if (key === 'zone' || key === 'album') return goZone('me')
		if (key === 'favor') return goFavorites()
		uni.showToast({ title: `演示：打开${gridItems.find((i) => i.key === key)?.label}`, icon: 'none' })
	}

	function onList(key: string) {
		if (key === 'settings') return goSettings()
		if (key === 'help') return uni.showToast({ title: '演示：帮助与反馈', icon: 'none' })
		uni.showToast({ title: 'QQ 9.0 原型 · 基于 TuniaoUI', icon: 'none' })
	}

	function onVip() {
		uni.showToast({ title: '演示：开通 SVIP', icon: 'none' })
	}

	function onLogout() {
		uni.showModal({
			title: '退出登录',
			content: '确定要退出当前账号吗？',
			success: (res) => {
				if (!res.confirm) return
				logout()
				uni.reLaunch({ url: '/pages/qq/login/index' })
			},
		})
	}
</script>

<template>
	<view class="qq-page qq-page--tab mine-page">
		<!-- 顶部个人信息 -->
		<view class="mine-hero">
			<view :style="{ height: `${topPad}px` }" />
			<view class="mine-hero__glow mine-hero__glow--one" />
			<view class="mine-hero__glow mine-hero__glow--two" />

			<view class="mine-hero__bar">
				<view class="mine-hero__spacer" />
				<view class="mine-hero__actions">
					<view class="mine-hero__icon" @tap="goScan">
						<tn-icon name="qr-code-circle" size="20px" color="tn-white" />
					</view>
					<view class="mine-hero__icon" @tap="goSettings">
						<tn-icon name="menu-set" size="20px" color="tn-white" />
					</view>
				</view>
			</view>

			<view class="mine-hero__profile">
				<qq-avatar
					:name="qqStore.user.name"
					:from="qqStore.user.avatarFrom"
					:to="qqStore.user.avatarTo"
					:size="64"
				/>
				<view class="mine-hero__info">
					<view class="mine-hero__name-row">
						<text class="mine-hero__name">{{ qqStore.user.name }}</text>
						<text class="mine-hero__level">Lv.{{ qqStore.user.level }}</text>
						<text v-if="qqStore.user.vip" class="qq-vip">SVIP</text>
					</view>
					<text class="mine-hero__qq">QQ号 {{ qqStore.user.qq }}</text>
					<view class="mine-hero__status">
						<view class="mine-hero__dot" />
						<text class="mine-hero__status-text">在线 · {{ qqStore.user.region }}</text>
					</view>
				</view>
			</view>

			<text class="mine-hero__sign">{{ qqStore.user.signature }}</text>
		</view>

		<!-- 数据卡片 -->
		<view class="mine-stats">
			<view class="mine-stats__item">
				<text class="mine-stats__value">{{ totalContacts }}</text>
				<text class="mine-stats__label">好友</text>
			</view>
			<view class="mine-stats__item">
				<text class="mine-stats__value">4</text>
				<text class="mine-stats__label">群聊</text>
			</view>
			<view class="mine-stats__item">
				<text class="mine-stats__value">36</text>
				<text class="mine-stats__label">相册</text>
			</view>
			<view class="mine-stats__item mine-stats__item--last">
				<text class="mine-stats__value">128</text>
				<text class="mine-stats__label">访客</text>
			</view>
		</view>

		<!-- SVIP 卡片 -->
		<view class="vip-card" @tap="onVip">
			<view class="vip-card__left">
				<text class="vip-card__logo">SVIP</text>
				<view class="vip-card__text">
					<text class="vip-card__title">超级会员 · 专享装扮</text>
					<text class="vip-card__desc">气泡 / 主题 / 字体，全部解锁</text>
				</view>
			</view>
			<view class="vip-card__button">去开通</view>
		</view>

		<!-- 功能宫格 -->
		<view class="mine-grid">
			<view
				v-for="item in gridItems"
				:key="item.key"
				class="mine-grid__item"
				@tap="onGrid(item.key)"
			>
				<view class="mine-grid__icon" :style="{ backgroundColor: `${item.color}16` }">
					<tn-icon :name="item.icon" size="23px" :color="item.color" />
				</view>
				<text class="mine-grid__label">{{ item.label }}</text>
			</view>
		</view>

		<!-- 设置列表 -->
		<view class="mine-list">
			<view
				v-for="(item, index) in listItems"
				:key="item.key"
				class="mine-list__item"
				:class="{ 'mine-list__item--border': index !== listItems.length - 1 }"
				@tap="onList(item.key)"
			>
				<view class="mine-list__icon" :style="{ backgroundColor: `${item.color}16` }">
					<tn-icon :name="item.icon" size="17px" :color="item.color" />
				</view>
				<text class="mine-list__label">{{ item.label }}</text>
				<tn-icon name="right" size="14px" color="#C9CDD4" />
			</view>
		</view>

		<view class="mine-logout" @tap="onLogout">
			<text class="mine-logout__text">退出登录</text>
		</view>

		<view class="mine-footer">
			<text class="mine-footer__text">QQ 9.0 交互原型 · Powered by TuniaoUI</text>
			<text class="mine-footer__version">v1.0.0 · 仅供学习演示</text>
		</view>

		<qq-tabbar active="mine" />
	</view>
</template>

<style lang="scss" scoped>
	.mine-page {
		background-color: var(--qq-bg);
	}

	/* 顶部蓝色主视觉，底部圆角收束 */
	.mine-page::before {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		height: 300px;
		background: linear-gradient(160deg, #0a83c4 0%, #12b7f5 58%, #46ccff 100%);
		border-radius: 0 0 22px 22px;
	}

	.mine-hero {
		position: relative;
		overflow: hidden;
		padding: 0 16px 20px;
	}

	.mine-hero__glow {
		position: absolute;
		border-radius: 50%;
		background-color: rgba(255, 255, 255, 0.14);
		pointer-events: none;
	}

	.mine-hero__glow--one {
		right: -50px;
		top: -60px;
		width: 190px;
		height: 190px;
	}

	.mine-hero__glow--two {
		left: -60px;
		bottom: -80px;
		width: 160px;
		height: 160px;
		background-color: rgba(255, 255, 255, 0.07);
	}

	.mine-hero__bar {
		position: relative;
		z-index: 1;
		display: flex;
		align-items: center;
		justify-content: flex-end;
		height: 40px;
	}

	.mine-hero__actions {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.mine-hero__icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		border-radius: 50%;
		background-color: rgba(255, 255, 255, 0.16);
	}

	.mine-hero__profile {
		position: relative;
		z-index: 1;
		display: flex;
		align-items: center;
		margin-top: 8px;
	}

	.mine-hero__info {
		flex: 1;
		min-width: 0;
		margin-left: 14px;
	}

	.mine-hero__name-row {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.mine-hero__name {
		font-size: 21px;
		font-weight: 700;
		color: #ffffff;
	}

	.mine-hero__level {
		padding: 2px 6px;
		border-radius: 4px;
		background-color: rgba(255, 255, 255, 0.2);
		font-size: 10px;
		color: #ffffff;
	}

	.mine-hero__qq {
		display: block;
		margin-top: 6px;
		font-size: 11.5px;
		color: rgba(255, 255, 255, 0.78);
	}

	.mine-hero__status {
		display: flex;
		align-items: center;
		gap: 4px;
		margin-top: 7px;
	}

	.mine-hero__dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background-color: #9ef0c9;
	}

	.mine-hero__status-text {
		font-size: 10.5px;
		color: rgba(255, 255, 255, 0.72);
	}

	.mine-hero__sign {
		position: relative;
		z-index: 1;
		display: block;
		margin-top: 14px;
		font-size: 12px;
		line-height: 1.5;
		color: rgba(255, 255, 255, 0.82);
	}

	/* 三列统计卡片，压在蓝色区底部 */
	.mine-stats {
		display: flex;
		margin: -14px 12px 0;
		padding: 14px 0;
		background-color: var(--qq-card);
		border-radius: 12px;
		box-shadow: 0 8px 20px rgba(30, 80, 110, 0.08);
		position: relative;
		z-index: 2;
	}

	.mine-stats__item {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		border-right: 1px solid var(--qq-line);
	}

	.mine-stats__item--last {
		border-right: none;
	}

	.mine-stats__value {
		font-size: 17px;
		font-weight: 700;
		color: var(--qq-text);
		line-height: 1.1;
	}

	.mine-stats__label {
		margin-top: 5px;
		font-size: 10.5px;
		color: var(--qq-text-3);
	}

	.vip-card {
		position: relative;
		z-index: 2;
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin: 10px 12px 0;
		padding: 12px 14px;
		border-radius: 12px;
		background: linear-gradient(115deg, #2c2b2f 0%, #403a2e 55%, #5b4527 100%);
		overflow: hidden;
	}

	.vip-card__left {
		display: flex;
		align-items: center;
		min-width: 0;
	}

	.vip-card__logo {
		font-size: 13px;
		font-weight: 800;
		color: #f7d078;
		letter-spacing: 0.5px;
		padding: 3px 7px;
		border-radius: 6px;
		background-color: rgba(247, 208, 120, 0.14);
		border: 1px solid rgba(247, 208, 120, 0.32);
		white-space: nowrap;
	}

	.vip-card__text {
		margin-left: 10px;
		min-width: 0;
	}

	.vip-card__title {
		display: block;
		font-size: 12.5px;
		font-weight: 600;
		color: #f3e1b6;
	}

	.vip-card__desc {
		display: block;
		margin-top: 3px;
		font-size: 10.5px;
		color: rgba(243, 225, 182, 0.55);
	}

	.vip-card__button {
		flex-shrink: 0;
		padding: 5px 12px;
		margin-left: 8px;
		border-radius: 14px;
		background: linear-gradient(135deg, #ffe2a1, #f0bb4d);
		color: #4a3410;
		font-size: 11px;
		font-weight: 600;
	}

	.mine-grid {
		display: flex;
		flex-wrap: wrap;
		margin: 10px 12px 0;
		padding: 8px 0 12px;
		background-color: var(--qq-card);
		border-radius: 12px;
	}

	.mine-grid__item {
		width: 25%;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 7px;
		padding: 10px 0 2px;
	}

	.mine-grid__icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 42px;
		height: 42px;
		border-radius: 11px;
	}

	.mine-grid__label {
		font-size: 11px;
		color: var(--qq-text-2);
	}

	.mine-list {
		margin: 10px 12px 0;
		background-color: var(--qq-card);
		border-radius: 12px;
		overflow: hidden;
	}

	.mine-list__item {
		display: flex;
		align-items: center;
		height: 50px;
		padding: 0 14px;
		position: relative;
	}

	.mine-list__item--border::after {
		content: '';
		position: absolute;
		left: 44px;
		right: 0;
		bottom: 0;
		height: 1px;
		background-color: var(--qq-bg);
		transform: scaleY(0.7);
	}

	.mine-list__icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 26px;
		height: 26px;
		border-radius: 7px;
	}

	.mine-list__label {
		flex: 1;
		margin-left: 10px;
		font-size: 13.5px;
		color: var(--qq-text);
	}

	.mine-logout {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 48px;
		margin: 10px 12px 0;
		background-color: var(--qq-card);
		border-radius: 12px;
	}

	.mine-logout__text {
		font-size: 13.5px;
		color: #fa5151;
	}

	.mine-footer {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
		padding: 16px 0 20px;
	}

	.mine-footer__text {
		font-size: 11px;
		color: var(--qq-text-3);
	}

	.mine-footer__version {
		font-size: 10px;
		color: var(--qq-text-4);
	}
</style>
