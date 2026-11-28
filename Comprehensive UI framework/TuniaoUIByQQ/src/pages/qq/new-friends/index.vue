<script lang="ts" setup>
	import {
		acceptFriendRequest,
		handledRequests,
		pendingFriendCount,
		pendingRequests,
		qqStore,
		rejectFriendRequest,
	} from '@/qq/store'
	import { goChatByConversation, goNewGroup } from '@/qq/router'
	import type { QQFriendRequest } from '@/qq/types'

	function onAccept(request: QQFriendRequest) {
		const convId = acceptFriendRequest(request.id)
		if (!convId) return
		uni.showToast({ title: `已添加 ${request.user.name} 为好友`, icon: 'none' })
	}

	function onReject(request: QQFriendRequest) {
		rejectFriendRequest(request.id)
		uni.showToast({ title: '已拒绝该申请', icon: 'none' })
	}

	function onChat(request: QQFriendRequest) {
		const conv = qqStore.conversations.find(
			(c) => c.type === 'single' && c.targetId === request.user.id
		)
		if (conv) goChatByConversation(conv.id)
	}

	function onSearchAdd() {
		uni.showToast({ title: '演示：输入 QQ 号 / 手机号添加好友', icon: 'none' })
	}
</script>

<template>
	<view class="qq-page friends-page">
		<qq-navbar title="新的朋友" bg="#F7F8FA">
			<template #right>
				<view class="friends-add" @tap="onSearchAdd">
					<tn-icon name="my-add" size="17px" color="#12B7F5" />
					<text class="friends-add__text">添加</text>
				</view>
			</template>
		</qq-navbar>

		<view class="friends-summary">
			<view class="friends-summary__icon">
				<tn-icon name="my-add" size="20px" color="#12B7F5" />
			</view>
			<view class="friends-summary__main">
				<text class="friends-summary__title">好友申请</text>
				<text class="friends-summary__desc">
					{{ pendingFriendCount ? `${pendingFriendCount} 条待处理，同意后即可开始聊天` : '暂无待处理申请' }}
				</text>
			</view>
			<view class="friends-summary__action" @tap="goNewGroup">
				<tn-icon name="team" size="16px" color="#8E54E9" />
				<text class="friends-summary__action-text">建群</text>
			</view>
		</view>

		<view class="friends-section">
			<view class="friends-section__head">
				<text class="friends-section__title">待处理</text>
				<text class="friends-section__count">{{ pendingRequests.length }}</text>
			</view>

			<view v-if="pendingRequests.length" class="friends-card">
				<view v-for="request in pendingRequests" :key="request.id" class="request">
					<qq-avatar
						:name="request.user.name"
						:from="request.user.avatarFrom"
						:to="request.user.avatarTo"
						:size="46"
					/>
					<view class="request__main">
						<view class="request__name-row">
							<text class="request__name">{{ request.user.name }}</text>
							<text class="request__time">{{ request.time }}</text>
						</view>
						<text class="request__meta">{{ request.source }}</text>
						<text v-if="request.message" class="request__message">{{ request.message }}</text>
					</view>
					<view class="request__actions">
						<view class="request__btn request__btn--primary" @tap="onAccept(request)">同意</view>
						<view class="request__btn" @tap="onReject(request)">拒绝</view>
					</view>
				</view>
			</view>

			<view v-else class="friends-empty">
				<tn-icon name="success-circle" size="26px" color="#C3C7CF" />
				<text class="friends-empty__text">申请都处理完了，去建个群聊吧</text>
			</view>
		</view>

		<view v-if="handledRequests.length" class="friends-section">
			<view class="friends-section__head">
				<text class="friends-section__title">已处理</text>
				<text class="friends-section__count">{{ handledRequests.length }}</text>
			</view>
			<view class="friends-card">
				<view v-for="request in handledRequests" :key="request.id" class="request">
					<qq-avatar
						:name="request.user.name"
						:from="request.user.avatarFrom"
						:to="request.user.avatarTo"
						:size="46"
					/>
					<view class="request__main">
						<text class="request__name">{{ request.user.name }}</text>
						<text class="request__meta">{{ request.source }}</text>
					</view>
					<view
						v-if="request.status === 'accepted'"
						class="request__status request__status--link"
						@tap="onChat(request)"
					>
						<text>发消息</text>
						<tn-icon name="right" size="12px" color="#12B7F5" />
					</view>
					<text v-else class="request__status">已拒绝</text>
				</view>
			</view>
		</view>

		<view class="friends-tip">
			<text class="friends-tip__text">同意后会加入「联系人」，并自动生成一条聊天会话</text>
		</view>
	</view>
</template>

<style lang="scss" scoped>
	.friends-page {
		min-height: 100vh;
		background-color: var(--qq-card-2);
		box-sizing: border-box;
		padding-bottom: 28px;
	}

	.friends-add {
		display: flex;
		align-items: center;
		gap: 2px;
		padding: 4px 10px;
		border-radius: 14px;
		background-color: rgba(18, 183, 245, 0.1);
	}

	.friends-add__text {
		font-size: 12px;
		color: #12b7f5;
	}

	.friends-summary {
		display: flex;
		align-items: center;
		margin: 6px 12px 0;
		padding: 14px;
		border-radius: 14px;
		background: linear-gradient(135deg, var(--qq-blue-light) 0%, var(--qq-card-2) 100%);
	}

	.friends-summary__icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 38px;
		height: 38px;
		border-radius: 12px;
		background-color: var(--qq-card);
		box-shadow: 0 4px 10px rgba(18, 183, 245, 0.12);
	}

	.friends-summary__main {
		flex: 1;
		min-width: 0;
		margin-left: 11px;
	}

	.friends-summary__title {
		display: block;
		font-size: 14px;
		font-weight: 600;
		color: var(--qq-text);
	}

	.friends-summary__desc {
		display: block;
		margin-top: 3px;
		font-size: 11.5px;
		color: var(--qq-text-3);
	}

	.friends-summary__action {
		display: flex;
		align-items: center;
		gap: 2px;
		padding: 5px 9px;
		border-radius: 12px;
		background-color: var(--qq-card);
	}

	.friends-summary__action-text {
		font-size: 11.5px;
		color: #6b46c1;
	}

	.friends-section {
		margin: 16px 12px 0;
	}

	.friends-section__head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0 4px 8px;
	}

	.friends-section__title {
		font-size: 12.5px;
		font-weight: 600;
		color: var(--qq-text-2);
	}

	.friends-section__count {
		font-size: 11px;
		color: var(--qq-text-3);
	}

	.friends-card {
		overflow: hidden;
		border-radius: 14px;
		background-color: var(--qq-card);
	}

	.request {
		display: flex;
		align-items: center;
		padding: 13px 12px;
		border-bottom: 1px solid var(--qq-line);
	}

	.request:last-child {
		border-bottom: none;
	}

	.request__main {
		flex: 1;
		min-width: 0;
		margin-left: 11px;
	}

	.request__name-row {
		display: flex;
		align-items: baseline;
		gap: 6px;
	}

	.request__name {
		font-size: 14px;
		font-weight: 600;
		color: var(--qq-text);
	}

	.request__time {
		font-size: 10px;
		color: var(--qq-text-4);
	}

	.request__meta {
		display: block;
		margin-top: 3px;
		font-size: 11px;
		color: var(--qq-text-3);
	}

	.request__message {
		margin-top: 3px;
		font-size: 11.5px;
		line-height: 1.45;
		color: var(--qq-text-2);
		overflow: hidden;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
	}

	.request__actions {
		display: flex;
		flex-direction: column;
		gap: 7px;
		margin-left: 8px;
		flex-shrink: 0;
	}

	.request__btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 50px;
		height: 26px;
		border-radius: 13px;
		background-color: var(--qq-bg);
		font-size: 11.5px;
		color: var(--qq-text-2);
	}

	.request__btn--primary {
		background: linear-gradient(135deg, #36c6ff 0%, #12b7f5 100%);
		color: #ffffff;
		font-weight: 500;
		box-shadow: 0 4px 10px rgba(18, 183, 245, 0.24);
	}

	.request__status {
		flex-shrink: 0;
		margin-left: 8px;
		font-size: 11.5px;
		color: var(--qq-text-3);
	}

	.request__status--link {
		display: flex;
		align-items: center;
		gap: 1px;
		padding: 5px 9px;
		border-radius: 12px;
		background-color: rgba(18, 183, 245, 0.1);
		color: #12b7f5;
	}

	.friends-empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
		padding: 28px 12px;
		border-radius: 14px;
		background-color: var(--qq-card);
	}

	.friends-empty__text {
		font-size: 12px;
		color: var(--qq-text-3);
	}

	.friends-tip {
		display: flex;
		justify-content: center;
		margin-top: 18px;
	}

	.friends-tip__text {
		font-size: 11px;
		color: var(--qq-text-4);
	}
</style>
