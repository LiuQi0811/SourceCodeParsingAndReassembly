<script lang="ts" setup>
	import { computed, ref } from 'vue'
	import { onLoad } from '@dcloudio/uni-app'
	import { findUser, qqStore } from '@/qq/store'
	import { goChatWithUser } from '@/qq/router'
	import type { QQMoment, QQUser } from '@/qq/types'

	const userId = ref('me')
	const user = ref<QQUser>(qqStore.user)
	const tab = ref<'feed' | 'album'>('feed')

	onLoad((options: any) => {
		userId.value = options?.id || 'me'
		user.value = findUser(userId.value)
	})

	const isSelf = computed(() => userId.value === 'me')

	const feed = computed<QQMoment[]>(() =>
		qqStore.moments.filter((m) => m.userId === userId.value)
	)

	const photos = computed(() =>
		qqStore.moments.filter((m) => m.userId === userId.value).flatMap((m) => m.images)
	)

	function onPublish() {
		uni.reLaunch({ url: '/pages/qq/dynamic/index?publish=1' })
	}

	function onMessage() {
		goChatWithUser(user.value.id)
	}

	function preview(index: number) {
		uni.previewImage({ urls: photos.value, current: index })
	}
</script>

<template>
	<view class="qq-page zone-page">
		<!-- 空间头部 -->
		<view
			class="zone-head"
			:style="{ backgroundImage: `linear-gradient(160deg, ${user.avatarFrom} 0%, ${user.avatarTo} 55%, #0a83c4 100%)` }"
		>
			<qq-navbar bg="transparent" color="tn-white" :border="false" title="QQ空间">
				<template #right>
					<view class="zone-head__icon">
						<tn-icon name="more-horizontal" size="20px" color="tn-white" />
					</view>
				</template>
			</qq-navbar>

			<view class="zone-head__profile">
				<qq-avatar
					:name="user.name"
					:from="user.avatarFrom"
					:to="user.avatarTo"
					:size="68"
				/>
				<view class="zone-head__info">
					<view class="zone-head__name-row">
						<text class="zone-head__name">{{ isSelf ? qqStore.user.name : user.name }}</text>
						<text v-if="user.vip" class="zone-head__vip">SVIP</text>
					</view>
					<text class="zone-head__desc">{{ user.signature }}</text>
				</view>
			</view>

			<view class="zone-head__stats">
				<view class="zone-stat">
					<text class="zone-stat__value">128</text>
					<text class="zone-stat__label">访客</text>
				</view>
				<view class="zone-stat">
					<text class="zone-stat__value">{{ feed.length }}</text>
					<text class="zone-stat__label">说说</text>
				</view>
				<view class="zone-stat">
					<text class="zone-stat__value">{{ photos.length }}</text>
					<text class="zone-stat__label">照片</text>
				</view>
				<view class="zone-head__action" @tap="isSelf ? onPublish() : onMessage()">
					{{ isSelf ? '发布说说' : '发消息' }}
				</view>
			</view>
		</view>

		<!-- Tab -->
		<view class="zone-tabs">
			<view
				class="zone-tab"
				:class="{ 'zone-tab--active': tab === 'feed' }"
				@tap="tab = 'feed'"
			>
				说说
			</view>
			<view
				class="zone-tab"
				:class="{ 'zone-tab--active': tab === 'album' }"
				@tap="tab = 'album'"
			>
				相册
			</view>
			<text class="zone-tabs__hint">{{ isSelf ? '我的空间' : `${user.name} 的空间` }}</text>
		</view>

		<!-- 说说 -->
		<view v-if="tab === 'feed'" class="zone-feed">
			<qq-moment-card
				v-for="moment in feed"
				:key="moment.id"
				:moment="moment"
				:show-all="true"
			/>
			<view v-if="!feed.length" class="zone-empty">
				<tn-empty mode="comment" show-tips>
					<template #tips>{{ isSelf ? '还没有发布说说' : 'TA 还没有发布说说' }}</template>
				</tn-empty>
			</view>
			<view class="zone-footer">空间内容为本地演示数据</view>
		</view>

		<!-- 相册 -->
		<view v-else class="zone-album">
			<view v-if="photos.length" class="album-grid">
				<image
					v-for="(photo, index) in photos"
					:key="photo + index"
					class="album-item"
					:src="photo"
					mode="aspectFill"
					@tap="preview(index)"
				/>
			</view>
			<view v-else class="zone-empty">
				<tn-empty mode="data" show-tips>
					<template #tips>相册还是空的</template>
				</tn-empty>
			</view>
			<view class="zone-footer">{{ photos.length }} 张照片</view>
		</view>
	</view>
</template>

<style lang="scss" scoped>
	.zone-page {
		padding-bottom: 24px;
	}

	.zone-head {
		position: relative;
		padding-bottom: 16px;
		overflow: hidden;
	}

	.zone-head :deep(.qq-navbar) {
		position: relative;
		z-index: 3;
	}

	.zone-head::after {
		content: '';
		position: absolute;
		right: -60px;
		top: -50px;
		width: 210px;
		height: 210px;
		border-radius: 50%;
		background-color: rgba(255, 255, 255, 0.12);
	}

	.zone-head__icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		border-radius: 50%;
		background-color: rgba(255, 255, 255, 0.16);
	}

	.zone-head__profile {
		position: relative;
		z-index: 2;
		display: flex;
		align-items: center;
		padding: 6px 16px 0;
	}

	.zone-head__info {
		flex: 1;
		min-width: 0;
		margin-left: 12px;
	}

	.zone-head__name-row {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.zone-head__name {
		font-size: 19px;
		font-weight: 700;
		color: #ffffff;
	}

	.zone-head__vip {
		padding: 2px 5px;
		border-radius: 4px;
		background: linear-gradient(135deg, #ffe2a1, #f0bb4d);
		color: #4a3410;
		font-size: 9px;
		font-weight: 700;
	}

	.zone-head__desc {
		display: block;
		margin-top: 5px;
		font-size: 11.5px;
		color: rgba(255, 255, 255, 0.78);
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
	}

	.zone-head__stats {
		position: relative;
		z-index: 2;
		display: flex;
		align-items: center;
		gap: 26px;
		padding: 16px 16px 0;
	}

	.zone-stat {
		display: flex;
		flex-direction: column;
	}

	.zone-stat__value {
		font-size: 16px;
		font-weight: 700;
		color: #ffffff;
		line-height: 1;
	}

	.zone-stat__label {
		margin-top: 4px;
		font-size: 10px;
		color: rgba(255, 255, 255, 0.7);
	}

	.zone-head__action {
		margin-left: auto;
		padding: 7px 14px;
		border-radius: 15px;
		background-color: rgba(255, 255, 255, 0.2);
		border: 1px solid rgba(255, 255, 255, 0.26);
		font-size: 11.5px;
		color: #ffffff;
	}

	.zone-tabs {
		display: flex;
		align-items: center;
		gap: 18px;
		padding: 12px 16px 10px;
		background-color: var(--qq-bg);
	}

	.zone-tab {
		position: relative;
		padding-bottom: 4px;
		font-size: 13.5px;
		color: var(--qq-text-2);
	}

	.zone-tab--active {
		font-size: 14.5px;
		font-weight: 600;
		color: var(--qq-text);
	}

	.zone-tab--active::after {
		content: '';
		position: absolute;
		left: 50%;
		transform: translateX(-50%);
		bottom: 0;
		width: 16px;
		height: 3px;
		border-radius: 2px;
		background: linear-gradient(90deg, #18c0ff, #0a9ed8);
	}

	.zone-tabs__hint {
		margin-left: auto;
		font-size: 10.5px;
		color: var(--qq-text-3);
	}

	.zone-feed {
		padding: 0 12px;
	}

	.zone-empty {
		padding: 50px 0;
		background-color: var(--qq-card);
		border-radius: 12px;
	}

	.zone-album {
		padding: 0 12px;
	}

	.album-grid {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
		padding: 6px;
		background-color: var(--qq-card);
		border-radius: 12px;
	}

	.album-item {
		width: calc(33.33% - 3px);
		aspect-ratio: 1;
		border-radius: 6px;
		background-color: var(--qq-bg);
	}

	.zone-footer {
		padding: 12px 0;
		text-align: center;
		font-size: 10.5px;
		color: var(--qq-text-4);
	}
</style>
