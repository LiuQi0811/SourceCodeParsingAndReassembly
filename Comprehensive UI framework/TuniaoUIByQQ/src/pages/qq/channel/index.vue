<script lang="ts" setup>
	import { computed, ref } from 'vue'
	import { onLoad } from '@dcloudio/uni-app'
	import { qqStore, toggleChannel } from '@/qq/store'
	import { goSearch } from '@/qq/router'

	const statusBarHeight = ref(0)
	onLoad(() => {
		try {
			statusBarHeight.value = uni.getSystemInfoSync().statusBarHeight || 0
		} catch (e) {
			statusBarHeight.value = 0
		}
	})
	const topPad = computed(() => (statusBarHeight.value ? `${statusBarHeight.value}px` : '8px'))

	const tab = ref<'recommend' | 'joined'>('recommend')

	const joinedChannels = computed(() => qqStore.channels.filter((c) => c.joined))
	const list = computed(() =>
		tab.value === 'joined' ? joinedChannels.value : qqStore.channels
	)

	function onJoin(channel: (typeof qqStore.channels)[number]) {
		toggleChannel(channel)
		uni.showToast({
			title: channel.joined ? `已加入「${channel.name}」` : `已退出「${channel.name}」`,
			icon: 'none',
		})
	}

	function openChannel(channel: (typeof qqStore.channels)[number]) {
		uni.showToast({ title: `演示：进入频道「${channel.name}」`, icon: 'none' })
	}
</script>

<template>
	<view class="qq-page qq-page--tab">
		<!-- 顶部 -->
		<view class="channel-header">
			<view :style="{ height: topPad }" />
			<view class="channel-header__bar">
				<text class="channel-header__title">频道</text>
				<view class="channel-header__actions">
					<view class="channel-header__icon" @tap="goSearch">
						<tn-icon name="search" size="19px" color="tn-grey-dark" />
					</view>
					<view class="channel-header__icon">
						<tn-icon name="add" size="21px" color="tn-grey-dark" />
					</view>
				</view>
			</view>
			<view class="channel-header__tabs">
				<view
					class="channel-tab"
					:class="{ 'channel-tab--active': tab === 'recommend' }"
					@tap="tab = 'recommend'"
				>
					<text class="channel-tab__text">推荐</text>
				</view>
				<view
					class="channel-tab"
					:class="{ 'channel-tab--active': tab === 'joined' }"
					@tap="tab = 'joined'"
				>
					<text class="channel-tab__text">我的频道</text>
				</view>
			</view>
		</view>

		<!-- 我的频道横滑 -->
		<view v-if="joinedChannels.length && tab === 'recommend'" class="my-channels">
			<view class="my-channels__title">
				<text class="my-channels__label">已加入的频道</text>
				<text class="my-channels__count">{{ joinedChannels.length }} 个</text>
			</view>
			<scroll-view class="my-channels__scroll" scroll-x :show-scrollbar="false">
				<view class="my-channels__row">
					<view
						v-for="channel in joinedChannels"
						:key="channel.id"
						class="my-channel"
						@tap="openChannel(channel)"
					>
						<view
							class="my-channel__cover"
							:style="{ backgroundImage: `linear-gradient(135deg, ${channel.from}, ${channel.to})` }"
						>
							<text class="my-channel__emoji">{{ channel.emoji }}</text>
						</view>
						<text class="my-channel__name">{{ channel.name }}</text>
					</view>
				</view>
			</scroll-view>
		</view>

		<!-- 频道列表 -->
		<view class="channel-list">
			<view
				v-for="channel in list"
				:key="channel.id"
				class="channel-card"
				@tap="openChannel(channel)"
			>
				<view
					class="channel-card__cover"
					:style="{ backgroundImage: `linear-gradient(135deg, ${channel.from}, ${channel.to})` }"
				>
					<text class="channel-card__emoji">{{ channel.emoji }}</text>
					<view class="channel-card__cover-glow" />
				</view>
				<view class="channel-card__body">
					<text class="channel-card__name">{{ channel.name }}</text>
					<text class="channel-card__desc">{{ channel.desc }}</text>
					<view class="channel-card__meta">
						<tn-icon name="team" size="12px" color="tn-grey" />
						<text class="channel-card__members">{{ channel.members }} 成员</text>
					</view>
				</view>
				<view
					class="channel-card__join"
					:class="{ 'channel-card__join--joined': channel.joined }"
					@tap.stop="onJoin(channel)"
				>
					{{ channel.joined ? '已加入' : '加入' }}
				</view>
			</view>

			<view v-if="!list.length" class="channel-empty">
				<tn-empty mode="list" show-tips>
					<template #tips>还没有加入频道，去推荐里逛逛</template>
				</tn-empty>
			</view>
		</view>

		<view class="channel-footer">频道内容为演示数据</view>

		<qq-tabbar active="channel" />
	</view>
</template>

<style lang="scss" scoped>
	.channel-header {
		position: sticky;
		top: 0;
		z-index: 20;
		background-color: var(--qq-card-2);
	}

	.channel-header__bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		height: 44px;
		padding: 0 14px;
	}

	.channel-header__title {
		font-size: 19px;
		font-weight: 700;
		color: var(--qq-text);
	}

	.channel-header__actions {
		display: flex;
		gap: 4px;
	}

	.channel-header__icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		border-radius: 50%;
	}

	.channel-header__tabs {
		display: flex;
		align-items: center;
		gap: 20px;
		padding: 0 16px 8px;
	}

	.channel-tab {
		position: relative;
		padding-bottom: 6px;
	}

	.channel-tab__text {
		font-size: 14px;
		color: var(--qq-text-2);
	}

	.channel-tab--active .channel-tab__text {
		font-size: 15px;
		font-weight: 600;
		color: var(--qq-text);
	}

	.channel-tab--active::after {
		content: '';
		position: absolute;
		left: 50%;
		transform: translateX(-50%);
		bottom: 0;
		width: 18px;
		height: 3px;
		border-radius: 2px;
		background: linear-gradient(90deg, #18c0ff, #0a9ed8);
	}

	.my-channels {
		margin: 4px 12px 0;
		padding: 12px 12px 6px;
		background-color: var(--qq-card);
		border-radius: 12px;
	}

	.my-channels__title {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.my-channels__label {
		font-size: 13px;
		font-weight: 600;
		color: var(--qq-text);
	}

	.my-channels__count {
		font-size: 11px;
		color: var(--qq-text-3);
	}

	.my-channels__scroll {
		margin-top: 10px;
		white-space: nowrap;
	}

	.my-channels__row {
		display: flex;
		gap: 14px;
	}

	.my-channel {
		display: flex;
		flex-direction: column;
		align-items: center;
		width: 56px;
		flex-shrink: 0;
	}

	.my-channel__cover {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 50px;
		height: 50px;
		border-radius: 12px;
	}

	.my-channel__emoji {
		font-size: 22px;
	}

	.my-channel__name {
		margin-top: 6px;
		font-size: 11px;
		color: var(--qq-text-2);
		width: 100%;
		text-align: center;
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
	}

	.channel-list {
		padding: 10px 12px 0;
	}

	.channel-card {
		display: flex;
		align-items: center;
		padding: 12px;
		margin-bottom: 10px;
		background-color: var(--qq-card);
		border-radius: 12px;
	}

	.channel-card__cover {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 78px;
		height: 78px;
		border-radius: 12px;
		overflow: hidden;
		flex-shrink: 0;
	}

	.channel-card__cover-glow {
		position: absolute;
		right: -20px;
	top: -20px;
		width: 60px;
		height: 60px;
		border-radius: 50%;
		background-color: rgba(255, 255, 255, 0.18);
	}

	.channel-card__emoji {
		font-size: 30px;
		z-index: 1;
	}

	.channel-card__body {
		flex: 1;
		min-width: 0;
		margin-left: 11px;
	}

	.channel-card__name {
		font-size: 15px;
		font-weight: 600;
		color: var(--qq-text);
	}

	.channel-card__desc {
		display: block;
		margin-top: 4px;
		font-size: 11.5px;
		line-height: 1.5;
		color: var(--qq-text-3);
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.channel-card__meta {
		display: flex;
		align-items: center;
		gap: 3px;
		margin-top: 6px;
	}

	.channel-card__members {
		font-size: 10.5px;
		color: var(--qq-text-3);
	}

	.channel-card__join {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		min-width: 54px;
		height: 28px;
		margin-left: 8px;
		padding: 0 10px;
		border-radius: 14px;
		background: linear-gradient(135deg, #18c0ff, #0a9ed8);
		color: #ffffff;
		font-size: 12px;
		font-weight: 500;
	}

	.channel-card__join--joined {
		background: var(--qq-bg);
		color: var(--qq-text-3);
		font-weight: 400;
	}

	.channel-empty {
		padding: 50px 0;
		background-color: var(--qq-card);
		border-radius: 12px;
	}

	.channel-footer {
		padding: 8px 0 16px;
		text-align: center;
		font-size: 11px;
		color: var(--qq-text-3);
	}
</style>
