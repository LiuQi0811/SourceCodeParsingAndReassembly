<script lang="ts" setup>
	import { computed, ref } from 'vue'
	import { onLoad } from '@dcloudio/uni-app'
	import { findConversation } from '@/qq/store'

	const convId = ref('c3')
	const acknowledged = ref(false)
	const likes = ref(12)
	const liked = ref(false)

	onLoad((options: any) => {
		convId.value = options?.id || 'c3'
	})

	const conv = computed(() => findConversation(convId.value))

	const publisher = computed(() =>
		convId.value === 'c5'
			? { name: '许嘉树', role: '管理员', from: '#12B7F5', to: '#0A83C4' }
			: { name: '林嘉禾', role: '群主', from: '#FF6B6B', to: '#F5576C' }
	)

	const total = computed(() => conv.value?.members || 128)
	const baseRead = computed(() => Math.max(0, total.value - Math.ceil(total.value * 0.25)))
	const readCount = computed(() => baseRead.value + (acknowledged.value ? 1 : 0))
	const readPercent = computed(() => Math.round((readCount.value / total.value) * 100))

	const noticeText = computed(() => conv.value?.notice || '暂无群公告')

	function onEdit() {
		uni.showToast({ title: '演示：仅群主 / 管理员可编辑公告', icon: 'none' })
	}

	function toggleAck() {
		acknowledged.value = !acknowledged.value
		uni.showToast({ title: acknowledged.value ? '已标记为已知晓' : '已取消知晓', icon: 'none' })
	}

	function onLike() {
		liked.value = !liked.value
		likes.value += liked.value ? 1 : -1
	}

	function copyNotice() {
		uni.setClipboardData({
			data: noticeText.value,
			success: () => uni.showToast({ title: '公告已复制', icon: 'none' }),
		})
	}
</script>

<template>
	<view class="qq-page notice-page">
		<qq-navbar title="群公告" bg="#F7F8FA">
			<template #right>
				<view class="notice-hd" @tap="onEdit">
					<text class="notice-hd__text">编辑</text>
				</view>
			</template>
		</qq-navbar>

		<view class="notice-body">
			<view class="notice-card">
				<view class="notice-author">
					<qq-avatar :name="publisher.name" :from="publisher.from" :to="publisher.to" :size="38" />
					<view class="notice-author__main">
						<view class="notice-author__row">
							<text class="notice-author__name">{{ publisher.name }}</text>
							<text class="notice-author__role">{{ publisher.role }}</text>
						</view>
						<text class="notice-author__meta">{{ conv ? conv.name : '群聊' }} · 今天 09:30</text>
					</view>
					<view class="notice-author__tag">
						<tn-icon name="notice-fill" size="12px" color="#12B7F5" />
						<text class="notice-author__tag-text">公告</text>
					</view>
				</view>

				<text class="notice-text">{{ noticeText }}</text>

				<view class="notice-foot">
					<view class="notice-reaction" :class="{ 'notice-reaction--on': liked }" @tap="onLike">
						<text class="notice-reaction__emoji">👍</text>
						<text class="notice-reaction__num">{{ likes }}</text>
					</view>
					<view class="notice-foot__spacer" />
					<text class="notice-foot__copy" @tap="copyNotice">复制公告</text>
				</view>
			</view>

			<view class="notice-read">
				<view class="notice-read__top">
					<text class="notice-read__label">已读</text>
					<text class="notice-read__num">{{ readCount }} / {{ total }}</text>
				</view>
				<view class="notice-read__bar">
					<view class="notice-read__fill" :style="{ width: `${readPercent}%` }" />
				</view>
				<view class="notice-read__avatars">
					<view class="notice-read__avatar"><qq-avatar name="苏晚" from="#FF9A8B" to="#FF6A88" :size="24" /></view>
					<view class="notice-read__avatar"><qq-avatar name="陈屿" from="#5B8DEF" to="#3560D4" :size="24" /></view>
					<view class="notice-read__avatar"><qq-avatar name="郑一诺" from="#F2709C" to="#FF9472" :size="24" /></view>
					<view class="notice-read__avatar"><qq-avatar name="许嘉树" from="#32C48D" to="#0E9A6B" :size="24" /></view>
					<text class="notice-read__more">等 {{ readCount }} 人已读</text>
				</view>
			</view>

			<view class="notice-tip">
				<tn-icon name="safe" size="13px" color="#8A9099" />
				<text class="notice-tip__text">群公告仅本群成员可见，重要通知建议同时 @全体成员</text>
			</view>
		</view>

		<view class="notice-footer">
			<view class="notice-btn" :class="{ 'notice-btn--done': acknowledged }" @tap="toggleAck">
				<tn-icon :name="acknowledged ? 'check' : 'notice'" size="15px" :color="acknowledged ? '#8A9099' : '#FFFFFF'" />
				<text class="notice-btn__text">{{ acknowledged ? '已知晓' : '我已知晓' }}</text>
			</view>
		</view>
	</view>
</template>

<style lang="scss" scoped>
	.notice-page {
		padding-bottom: calc(78px + env(safe-area-inset-bottom));
	}

	.notice-hd__text {
		font-size: 13px;
		color: #12b7f5;
	}

	.notice-body {
		padding: 10px 12px 0;
	}

	.notice-card {
		padding: 16px;
		border-radius: 12px;
		background-color: var(--qq-card);
		box-shadow: 0 1px 2px rgba(20, 30, 40, 0.04);
	}

	.notice-author {
		display: flex;
		align-items: center;
	}

	.notice-author__main {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 3px;
		margin-left: 10px;
		min-width: 0;
	}

	.notice-author__row {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.notice-author__name {
		font-size: 14px;
		font-weight: 600;
		color: var(--qq-text);
	}

	.notice-author__role {
		padding: 1px 5px;
		border-radius: 4px;
		background-color: rgba(18, 183, 245, 0.1);
		font-size: 9px;
		color: #12b7f5;
	}

	.notice-author__meta {
		font-size: 10px;
		color: var(--qq-text-4);
	}

	.notice-author__tag {
		display: flex;
		align-items: center;
		gap: 3px;
		padding: 3px 7px;
		border-radius: 10px;
		background-color: rgba(18, 183, 245, 0.08);
	}

	.notice-author__tag-text {
		font-size: 9px;
		color: #12b7f5;
	}

	.notice-text {
		display: block;
		margin-top: 14px;
		font-size: 14px;
		line-height: 1.85;
		color: var(--qq-text-2);
		word-break: break-word;
		white-space: pre-wrap;
	}

	.notice-foot {
		display: flex;
		align-items: center;
		margin-top: 18px;
		padding-top: 12px;
		border-top: 1px solid var(--qq-line);
	}

	.notice-reaction {
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 4px 9px;
		border-radius: 12px;
		background-color: var(--qq-card-2);
		border: 1px solid transparent;
	}

	.notice-reaction--on {
		background-color: rgba(18, 183, 245, 0.1);
		border-color: rgba(18, 183, 245, 0.35);
	}

	.notice-reaction__emoji {
		font-size: 12px;
	}

	.notice-reaction__num {
		font-size: 11px;
		color: var(--qq-text-3);
	}

	.notice-reaction--on .notice-reaction__num {
		color: #12b7f5;
	}

	.notice-foot__spacer {
		flex: 1;
	}

	.notice-foot__copy {
		font-size: 11px;
		color: var(--qq-text-4);
	}

	.notice-read {
		margin-top: 10px;
		padding: 14px 16px;
		border-radius: 12px;
		background-color: var(--qq-card);
	}

	.notice-read__top {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
	}

	.notice-read__label {
		font-size: 11px;
		color: var(--qq-text-3);
	}

	.notice-read__num {
		font-size: 12px;
		font-weight: 600;
		color: var(--qq-text);
	}

	.notice-read__bar {
		margin-top: 8px;
		height: 4px;
		border-radius: 2px;
		background-color: var(--qq-card-2);
		overflow: hidden;
	}

	.notice-read__fill {
		height: 100%;
		border-radius: 2px;
		background: linear-gradient(90deg, #12b7f5, #4fc3ff);
		transition: width 0.25s ease;
	}

	.notice-read__avatars {
		display: flex;
		align-items: center;
		margin-top: 12px;
	}

	.notice-read__avatar {
		margin-right: -6px;
	}

	.notice-read__more {
		margin-left: 12px;
		font-size: 10px;
		color: var(--qq-text-4);
	}

	.notice-tip {
		display: flex;
		align-items: flex-start;
		gap: 5px;
		padding: 12px 4px 0;
	}

	.notice-tip__text {
		flex: 1;
		font-size: 10px;
		line-height: 1.6;
		color: var(--qq-text-4);
	}

	.notice-footer {
		position: fixed;
		left: 50%;
		transform: translateX(-50%);
		bottom: 0;
		width: 100%;
		max-width: 430px;
		padding: 10px 12px calc(10px + env(safe-area-inset-bottom));
		background-color: var(--qq-card-glass);
		border-top: 1px solid var(--qq-line);
		backdrop-filter: blur(12px);
	}

	.notice-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		height: 44px;
		border-radius: 10px;
		background-color: #12b7f5;
	}

	.notice-btn--done {
		background-color: var(--qq-card-2);
	}

	.notice-btn__text {
		font-size: 14px;
		font-weight: 500;
		color: #ffffff;
	}

	.notice-btn--done .notice-btn__text {
		color: var(--qq-text-4);
	}
</style>
