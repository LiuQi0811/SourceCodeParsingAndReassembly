<script lang="ts" setup>
	import { computed, ref } from 'vue'
	import { onLoad } from '@dcloudio/uni-app'
	import {
		markConversationRead,
		qqStore,
		removeConversation,
		sortedConversations,
		toggleMute,
		togglePin,
	} from '@/qq/store'
	import { goChatByConversation, goNewGroup, goScan, goSearch, goTab } from '@/qq/router'
	import type { QQConversation } from '@/qq/types'

	const statusBarHeight = ref(0)
	const showActions = ref(false)
	const swipeOpenId = ref('')

	onLoad(() => {
		try {
			statusBarHeight.value = uni.getSystemInfoSync().statusBarHeight || 0
		} catch (e) {
			statusBarHeight.value = 0
		}
	})

	const topPad = computed(() => (statusBarHeight.value ? `${statusBarHeight.value}px` : '8px'))
	const list = sortedConversations

	function openChat(conv: QQConversation) {
		// 左滑操作条展开时，点击只负责收起，不进入会话
		if (swipeOpenId.value) return
		markConversationRead(conv.id)
		goChatByConversation(conv.id)
	}

	function onSwipeClose(id: string) {
		if (swipeOpenId.value === id) swipeOpenId.value = ''
	}

	function swipeOptions(conv: QQConversation) {
		return [
			{
				text: conv.pinned ? '取消置顶' : '置顶',
				bg: '#12B7F5',
				color: '#ffffff',
				icon: 'home-totop',
			},
			{
				text: conv.muted ? '取消免打扰' : '免打扰',
				bg: '#E9ECF0',
				color: '#41454C',
				icon: conv.muted ? 'notice' : 'notice-no',
			},
			{ text: '删除', bg: '#FA5151', color: '#ffffff', icon: 'delete' },
		]
	}

	function onSwipe(option: any, conv: QQConversation) {
		const text = option?.text || ''
		if (text === '删除') {
			removeConversation(conv.id)
			uni.showToast({ title: '已删除该会话', icon: 'none' })
			return
		}
		if (text.includes('置顶')) {
			togglePin(conv.id)
			uni.showToast({ title: conv.pinned ? '已取消置顶' : '已置顶', icon: 'none' })
			return
		}
		if (text.includes('免打扰')) toggleMute(conv.id)
	}

	function onAction(key: string) {
		showActions.value = false
		if (key === 'group') return goNewGroup()
		if (key === 'scan') return goScan()
		if (key === 'channel') return goTab('channel')
		if (key === 'search') return goSearch()
	}

	const actions = [
		{ key: 'group', label: '发起群聊', icon: 'team', color: '#12B7F5' },
		{ key: 'search', label: '加好友', icon: 'search', color: '#FF9F1C' },
		{ key: 'scan', label: '扫一扫', icon: 'scan', color: '#32C48D' },
		{ key: 'channel', label: '逛频道', icon: 'discover-planet', color: '#8E54E9' },
	]
</script>

<template>
	<view class="qq-page qq-page--tab">
		<!-- 顶部：头像 / 搜索 / 加号 -->
		<view class="msg-header">
			<view :style="{ height: topPad }" />
			<view class="msg-header__bar">
				<view @tap="goTab('mine')">
					<qq-avatar
						:name="qqStore.user.name"
						:from="qqStore.user.avatarFrom"
						:to="qqStore.user.avatarTo"
						:size="32"
						:online="true"
					/>
				</view>
				<view class="msg-header__search" @tap="goSearch">
					<tn-icon name="search" size="14px" color="tn-grey" />
					<text class="msg-header__search-text">搜索</text>
					<tn-icon name="microphone" size="15px" color="tn-grey" />
				</view>
				<view class="msg-header__add" @tap="showActions = true">
					<tn-icon name="add" size="19px" color="tn-white" />
				</view>
			</view>
		</view>

		<!-- 会话列表 -->
		<view class="msg-list">
			<view v-for="conv in list" :key="conv.id" class="msg-list__item">
				<qq-swipe
					:options="swipeOptions(conv)"
					@select="onSwipe($event, conv)"
					@open="swipeOpenId = conv.id"
					@close="onSwipeClose(conv.id)"
				>
					<view class="conv" :class="{ 'conv--pinned': conv.pinned }" @tap="openChat(conv)">
						<qq-avatar
							:name="conv.name"
							:from="conv.avatarFrom"
							:to="conv.avatarTo"
							:text="conv.avatarText"
							:group="conv.type === 'group'"
							:online="!!conv.online"
							:size="46"
						/>
						<view class="conv__main">
							<view class="conv__top">
								<view class="conv__name-row">
									<text class="conv__name">{{ conv.name }}</text>
									<text v-if="conv.type === 'group'" class="qq-chip">{{ conv.members }}人</text>
									<tn-icon
										v-if="conv.muted"
										name="notice-no"
										size="12px"
										color="#A6AAB2"
									/>
								</view>
								<text class="conv__time">{{ conv.time }}</text>
							</view>
							<view class="conv__bottom">
								<view class="conv__preview-wrap">
									<text v-if="conv.draft" class="conv__draft">[草稿]</text>
									<text
										class="conv__preview"
										:class="{ 'conv__preview--unread': conv.unread > 0 }"
									>
										{{ conv.lastMessage }}
									</text>
								</view>
								<view class="conv__right">
									<view v-if="conv.pinned" class="conv__pin">
										<tn-icon name="home-totop" size="12px" color="#12B7F5" />
									</view>
									<view
										v-if="conv.unread > 0"
										class="qq-badge"
										:class="{ 'qq-badge--dot': conv.muted }"
									>
										{{ conv.muted ? '' : conv.unread > 99 ? '99+' : conv.unread }}
									</view>
								</view>
							</view>
						</view>
					</view>
				</qq-swipe>
			</view>

			<view v-if="!list.length" class="msg-empty">
				<tn-empty mode="message" show-tips>
					<template #tips>还没有会话，去联系人页打个招呼吧</template>
				</tn-empty>
			</view>

			<view v-else class="msg-footer">左滑会话可置顶 / 免打扰 / 删除</view>
		</view>

		<!-- 加号菜单 -->
		<view v-if="showActions" class="action-mask" @tap="showActions = false">
			<view class="action-sheet" @tap.stop>
				<view class="action-sheet__grid">
					<view
						v-for="action in actions"
						:key="action.key"
						class="action-sheet__item"
						@tap="onAction(action.key)"
					>
						<view class="action-sheet__icon" :style="{ backgroundColor: action.color }">
							<tn-icon :name="action.icon" size="22px" color="tn-white" />
						</view>
						<text class="action-sheet__label">{{ action.label }}</text>
					</view>
				</view>
				<view class="action-sheet__cancel" @tap="showActions = false">取消</view>
			</view>
		</view>

		<qq-tabbar active="message" />
	</view>
</template>

<style lang="scss" scoped>
	.msg-header {
		position: sticky;
		top: 0;
		z-index: 20;
		background: linear-gradient(180deg, var(--qq-card) 0%, var(--qq-card-2) 100%);
	}

	.msg-header__bar {
		display: flex;
		align-items: center;
		gap: 10px;
		height: 48px;
		padding: 0 14px 8px;
	}

	.msg-header__search {
		flex: 1;
		display: flex;
		align-items: center;
		gap: 5px;
		height: 32px;
		padding: 0 10px;
		border-radius: 16px;
		background-color: var(--qq-bg);
	}

	.msg-header__search-text {
		flex: 1;
		font-size: 12.5px;
		color: var(--qq-text-3);
	}

	.msg-header__add {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		border-radius: 50%;
		background: linear-gradient(135deg, #18c0ff, #0a9ed8);
		box-shadow: 0 4px 10px rgba(18, 183, 245, 0.25);
	}

	.msg-list {
		padding-top: 6px;
	}

	.conv {
		display: flex;
		align-items: center;
		padding: 12px 14px;
		background-color: var(--qq-card);
	}

	.conv--pinned {
		background-color: var(--qq-card-2);
	}

	.conv__main {
		flex: 1;
		min-width: 0;
		margin-left: 11px;
	}

	.conv__top {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.conv__name-row {
		display: flex;
		align-items: center;
		gap: 4px;
		min-width: 0;
	}

	.conv__name {
		font-size: 15px;
		font-weight: 600;
		color: var(--qq-text);
		max-width: 180px;
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
	}

	.conv__time {
		flex-shrink: 0;
		margin-left: 8px;
		font-size: 10.5px;
		color: var(--qq-text-3);
	}

	.conv__bottom {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-top: 5px;
	}

	.conv__preview-wrap {
		flex: 1;
		min-width: 0;
		display: flex;
		align-items: center;
	}

	.conv__draft {
		flex-shrink: 0;
		font-size: 12px;
		color: #fa5151;
		margin-right: 3px;
	}

	.conv__preview {
		min-width: 0;
		font-size: 12.5px;
		color: var(--qq-text-3);
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
	}

	.conv__preview--unread {
		color: #5d626b;
	}

	.conv__right {
		display: flex;
		align-items: center;
		gap: 6px;
		flex-shrink: 0;
		margin-left: 8px;
	}

	.conv__pin {
		display: flex;
		align-items: center;
	}

	.msg-footer {
		padding: 18px 0 calc(18px + env(safe-area-inset-bottom));
		text-align: center;
		font-size: 11px;
		color: var(--qq-text-3);
	}

	.msg-empty {
		padding: 60px 0;
	}

	/* 加号菜单 */
	.action-mask {
		position: fixed;
		left: 0;
		right: 0;
		top: 0;
		bottom: 0;
		z-index: 80;
		background-color: rgba(0, 0, 0, 0.42);
		display: flex;
		align-items: flex-end;
		justify-content: center;
	}

	.action-sheet {
		width: 100%;
		max-width: 430px;
		padding: 8px 12px calc(12px + env(safe-area-inset-bottom));
		border-radius: 16px 16px 0 0;
		background-color: var(--qq-card-2);
		animation: sheet-up 0.22s ease;
	}

	@keyframes sheet-up {
		from {
			transform: translateY(100%);
		}
		to {
			transform: translateY(0);
		}
	}

	.action-sheet__grid {
		display: flex;
		background-color: var(--qq-card);
		border-radius: 12px;
		padding: 16px 8px;
	}

	.action-sheet__item {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
	}

	.action-sheet__icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 46px;
		height: 46px;
		border-radius: 12px;
	}

	.action-sheet__label {
		font-size: 11.5px;
		color: var(--qq-text-2);
	}

	.action-sheet__cancel {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 48px;
		margin-top: 8px;
		border-radius: 12px;
		background-color: var(--qq-card);
		font-size: 15px;
		font-weight: 500;
		color: var(--qq-text);
	}
</style>
