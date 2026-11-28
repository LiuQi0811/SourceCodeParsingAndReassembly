<script lang="ts" setup>
	import { computed, ref } from 'vue'
	import { onLoad } from '@dcloudio/uni-app'
	import { findUser, qqStore } from '@/qq/store'
	import { goChatWithUser, goZone, TAB_PATHS } from '@/qq/router'
	import type { QQUser } from '@/qq/types'

	const userId = ref('me')
	const user = ref<QQUser>(qqStore.user)
	const isSelf = computed(() => userId.value === 'me')

	onLoad((options: any) => {
		userId.value = options?.id || 'me'
		user.value = findUser(userId.value)
	})

	const groups = computed(() => qqStore.conversations.filter((c) => c.type === 'group'))

	function copyQQ() {
		uni.setClipboardData({
			data: user.value.qq,
			success: () => uni.showToast({ title: 'QQ 号已复制', icon: 'none' }),
		})
	}

	function onChat() {
		if (isSelf.value) {
			uni.reLaunch({ url: TAB_PATHS.mine })
			return
		}
		goChatWithUser(user.value.id)
	}

	function onCall(label: string) {
		uni.showToast({ title: `演示：发起${label}`, icon: 'none' })
	}

	function onMore() {
		uni.showActionSheet({
			itemList: ['设置备注与标签', '举报该用户', '删除好友'],
			success: (res) => {
				uni.showToast({ title: `演示：${['设置备注', '已提交举报', '已删除好友'][res.tapIndex]}`, icon: 'none' })
			},
		})
	}

	function openZone() {
		goZone(user.value.id)
	}
</script>

<template>
	<view class="qq-page detail-page">
		<!-- 渐变资料头部 -->
		<view
			class="detail-hero"
			:style="{ backgroundImage: `linear-gradient(150deg, ${user.avatarFrom} 0%, ${user.avatarTo} 60%, #0a83c4 100%)` }"
		>
			<qq-navbar bg="transparent" color="tn-white" :border="false" title="">
				<template #right>
					<view class="detail-hero__more" @tap="onMore">
						<tn-icon name="more-horizontal" size="20px" color="tn-white" />
					</view>
				</template>
			</qq-navbar>

			<view class="detail-hero__profile">
				<view class="detail-hero__avatar">
					<qq-avatar
						:name="user.name"
						:from="user.avatarFrom"
						:to="user.avatarTo"
						:size="82"
					/>
				</view>
				<view class="detail-hero__name-row">
					<text class="detail-hero__name">{{ user.remark || user.name }}</text>
					<text v-if="user.vip" class="detail-hero__vip">SVIP</text>
				</view>
				<text class="detail-hero__qq">QQ {{ user.qq }}</text>
				<view class="detail-hero__status">
					<view class="detail-hero__dot" :class="{ 'detail-hero__dot--on': user.online }" />
					<text class="detail-hero__status-text">{{ user.online ? '在线' : '离线' }} · {{ user.region }}</text>
				</view>
			</view>
		</view>

		<!-- 操作按钮 -->
		<view class="detail-actions">
			<view class="detail-action" @tap="onChat">
				<tn-icon name="message" size="20px" color="#12B7F5" />
				<text class="detail-action__label">{{ isSelf ? '我的空间' : '发消息' }}</text>
			</view>
			<view class="detail-action" @tap="onCall('语音通话')">
				<tn-icon name="phone" size="20px" color="#32C48D" />
				<text class="detail-action__label">语音</text>
			</view>
			<view class="detail-action" @tap="onCall('视频通话')">
				<tn-icon name="video" size="20px" color="#8E54E9" />
				<text class="detail-action__label">视频</text>
			</view>
		</view>

		<!-- 个性签名 -->
		<view class="detail-card">
			<view class="detail-card__title">个性签名</view>
			<text class="detail-sign">{{ user.signature || '这个人很懒，什么都没有留下。' }}</text>
			<view v-if="user.tags?.length" class="detail-tags">
				<text v-for="tag in user.tags" :key="tag" class="detail-tag"># {{ tag }}</text>
			</view>
		</view>

		<!-- 资料信息 -->
		<view class="detail-card">
			<view class="detail-row" @tap="copyQQ">
				<text class="detail-row__label">QQ 号</text>
				<text class="detail-row__value">{{ user.qq }}</text>
				<tn-icon name="right" size="13px" color="#C9CDD4" />
			</view>
			<view class="detail-row">
				<text class="detail-row__label">昵称</text>
				<text class="detail-row__value">{{ user.name }}</text>
			</view>
			<view class="detail-row">
				<text class="detail-row__label">性别</text>
				<text class="detail-row__value">{{ user.gender === 'female' ? '女' : '男' }}</text>
			</view>
			<view class="detail-row">
				<text class="detail-row__label">生日</text>
				<text class="detail-row__value">{{ user.birthday }}</text>
			</view>
			<view class="detail-row">
				<text class="detail-row__label">所在地</text>
				<text class="detail-row__value">{{ user.region }}</text>
			</view>
			<view class="detail-row detail-row--last">
				<text class="detail-row__label">QQ 等级</text>
				<view class="detail-row__level">
					<tn-icon name="level" size="14px" color="#FF9F1C" />
					<text class="detail-row__value">Lv.{{ user.level }}</text>
				</view>
			</view>
		</view>

		<!-- 共同群聊 -->
		<view class="detail-card">
			<view class="detail-card__head">
				<text class="detail-card__title">共同群聊</text>
				<text class="detail-card__count">{{ groups.length }} 个</text>
			</view>
			<view class="detail-groups">
				<view v-for="group in groups" :key="group.id" class="detail-group">
					<qq-avatar
						:name="group.name"
						:from="group.avatarFrom"
						:to="group.avatarTo"
						:group="true"
						:size="40"
					/>
					<text class="detail-group__name">{{ group.name }}</text>
				</view>
			</view>
			<view class="detail-zone" @tap="openZone">
				<tn-icon name="moments" size="16px" color="#12B7F5" />
				<text class="detail-zone__text">{{ isSelf ? '进入我的 QQ 空间' : `进入 ${user.name} 的空间` }}</text>
				<tn-icon name="right" size="13px" color="#C9CDD4" />
			</view>
		</view>

		<view class="detail-footer">资料仅用于界面演示</view>
	</view>
</template>

<style lang="scss" scoped>
	.detail-page {
		padding-bottom: 30px;
	}

	.detail-hero {
		position: relative;
		padding-bottom: 40px;
		overflow: hidden;
	}

	.detail-hero :deep(.qq-navbar) {
		position: relative;
		z-index: 3;
	}

	.detail-hero::after {
		content: '';
		position: absolute;
		right: -60px;
		top: -60px;
		width: 220px;
		height: 220px;
		border-radius: 50%;
		background-color: rgba(255, 255, 255, 0.12);
		pointer-events: none;
	}

	.detail-hero__more {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		border-radius: 50%;
		background-color: rgba(255, 255, 255, 0.16);
	}

	.detail-hero__profile {
		position: relative;
		z-index: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 4px 16px 0;
	}

	.detail-hero__avatar {
		padding: 3px;
		border-radius: 50%;
		background-color: rgba(255, 255, 255, 0.28);
	}

	.detail-hero__name-row {
		display: flex;
		align-items: center;
		gap: 6px;
		margin-top: 12px;
	}

	.detail-hero__name {
		font-size: 20px;
		font-weight: 700;
		color: #ffffff;
	}

	.detail-hero__vip {
		padding: 2px 5px;
		border-radius: 4px;
		background: linear-gradient(135deg, #ffe2a1, #f0bb4d);
		color: #4a3410;
		font-size: 9px;
		font-weight: 700;
	}

	.detail-hero__qq {
		margin-top: 6px;
		font-size: 12px;
		color: rgba(255, 255, 255, 0.8);
	}

	.detail-hero__status {
		display: flex;
		align-items: center;
		gap: 4px;
		margin-top: 6px;
	}

	.detail-hero__dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background-color: var(--qq-text-4);
	}

	.detail-hero__dot--on {
		background-color: #9ef0c9;
	}

	.detail-hero__status-text {
		font-size: 10.5px;
		color: rgba(255, 255, 255, 0.72);
	}

	/* 三个操作按钮 */
	.detail-actions {
		display: flex;
		margin: -26px 12px 0;
		padding: 14px 0;
		background-color: var(--qq-card);
		border-radius: 14px;
		box-shadow: 0 10px 24px rgba(20, 60, 90, 0.1);
		position: relative;
		z-index: 2;
	}

	.detail-action {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
		border-right: 1px solid var(--qq-line);
	}

	.detail-action:last-child {
		border-right: none;
	}

	.detail-action__label {
		font-size: 12px;
		color: var(--qq-text);
	}

	.detail-card {
		margin: 10px 12px 0;
		padding: 14px;
		background-color: var(--qq-card);
		border-radius: 12px;
	}

	.detail-card__title {
		font-size: 13px;
		font-weight: 600;
		color: var(--qq-text);
	}

	.detail-card__head {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.detail-card__count {
		font-size: 11px;
		color: var(--qq-text-3);
	}

	.detail-sign {
		display: block;
		margin-top: 8px;
		font-size: 12.5px;
		line-height: 1.6;
		color: var(--qq-text-2);
	}

	.detail-tags {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin-top: 10px;
	}

	.detail-tag {
		padding: 3px 8px;
		border-radius: 5px;
		background-color: var(--qq-card-2);
		color: #4f93bd;
		font-size: 10.5px;
	}

	.detail-row {
		display: flex;
		align-items: center;
		height: 40px;
		border-bottom: 1px solid var(--qq-line);
	}

	.detail-row--last {
		border-bottom: none;
	}

	.detail-row__label {
		width: 74px;
		font-size: 12px;
		color: var(--qq-text-3);
	}

	.detail-row__value {
		flex: 1;
		text-align: right;
		font-size: 12.5px;
		color: var(--qq-text);
	}

	.detail-row__level {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 3px;
	}

	.detail-groups {
		display: flex;
		gap: 18px;
		margin-top: 12px;
	}

	.detail-group {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
	}

	.detail-group__name {
		font-size: 10.5px;
		color: var(--qq-text-2);
	}

	.detail-zone {
		display: flex;
		align-items: center;
		gap: 6px;
		margin-top: 14px;
		padding-top: 12px;
		border-top: 1px solid var(--qq-line);
	}

	.detail-zone__text {
		flex: 1;
		font-size: 12.5px;
		color: var(--qq-text);
	}

	.detail-footer {
		padding: 16px 0;
		text-align: center;
		font-size: 11px;
		color: var(--qq-text-3);
	}
</style>
