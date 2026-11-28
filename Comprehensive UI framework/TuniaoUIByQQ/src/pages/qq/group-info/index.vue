<script lang="ts" setup>
	import { computed, ref } from 'vue'
	import { onLoad } from '@dcloudio/uni-app'
	import {
		findConversation,
		groupAlbumsOf,
		groupCheckinOf,
		groupMetaOf,
		groupTodosOf,
		groupVotesOf,
		qqStore,
		removeConversation,
	} from '@/qq/store'
	import {
		TAB_PATHS,
		goChatHistory,
		goGroupAlbum,
		goGroupCheckin,
		goGroupFiles,
		goGroupManage,
		goGroupTodo,
		goGroupVote,
		goMembers,
		goNotice,
		goUserDetail,
	} from '@/qq/router'

	const convId = ref('')

	onLoad((options: any) => {
		convId.value = options?.id || 'c3'
	})

	const conv = computed(() => findConversation(convId.value))
	const meta = computed(() => groupMetaOf(convId.value))

	const members = computed(() => qqStore.contacts.slice(0, 8))

	const memberTotal = computed(() => conv.value?.members || members.value.length + 1)

	const notice = computed(() => conv.value?.notice || '暂无群公告')

	const files = [
		{ name: '需求评审-2024Q4.pdf', size: '2.4 MB', time: '今天 11:02', icon: 'folder', color: '#4776E6' },
		{ name: '原型截图合集.zip', size: '18.6 MB', time: '昨天 18:20', icon: 'image', color: '#32C48D' },
	]

	const todoPending = computed(() => groupTodosOf(convId.value).filter((t) => !t.joined).length)
	const voteActive = computed(() => groupVotesOf(convId.value).filter((v) => !v.closed).length)
	const albumCount = computed(() => groupAlbumsOf(convId.value).length)
	const checkin = computed(() => groupCheckinOf(convId.value))

	function onTodo() {
		goGroupTodo(convId.value)
	}

	function onVote() {
		goGroupVote(convId.value)
	}

	function onAlbum() {
		goGroupAlbum(convId.value)
	}

	function onCheckin() {
		goGroupCheckin(convId.value)
	}

	function onInvite() {
		uni.showToast({ title: '演示：邀请好友加入群聊', icon: 'none' })
	}

	function onAllMembers() {
		goMembers(convId.value)
	}

	function onFile(name: string) {
		goGroupFiles(convId.value)
	}

	function onSearchHistory() {
		goChatHistory(convId.value)
	}

	function onNotice() {
		goNotice(convId.value)
	}

	function onGroupManage() {
		goGroupManage(convId.value)
	}

	function onNickname() {
		uni.showToast({ title: '演示：修改我在本群的昵称', icon: 'none' })
	}

	function onQuit() {
		if (!conv.value) return
		uni.showModal({
			title: '退出群聊',
			content: `确定退出「${conv.value.name}」吗？退出后将不再接收该群消息。`,
			confirmText: '退出',
			confirmColor: '#FA5151',
			cancelText: '取消',
			success: (res) => {
				if (!res.confirm) return
				removeConversation(convId.value)
				uni.showToast({ title: '已退出群聊', icon: 'none' })
				setTimeout(() => {
					uni.reLaunch({ url: TAB_PATHS.message })
				}, 600)
			},
		})
	}
</script>

<template>
	<view v-if="conv" class="qq-page group-page">
		<qq-navbar title="群聊信息" bg="#F7F8FA" />

		<!-- 群头部 -->
		<view class="group-head">
			<qq-avatar
				:name="conv.name"
				:from="conv.avatarFrom"
				:to="conv.avatarTo"
				:text="conv.name.slice(0, 1)"
				:size="56"
			/>
			<view class="group-head__main">
				<view class="group-head__name-row">
					<text class="group-head__name">{{ conv.name }}</text>
					<text v-if="conv.muted" class="group-head__muted">免打扰</text>
					<text v-if="meta.allMuted" class="group-head__muted group-head__muted--mute">全员禁言</text>
				</view>
				<text class="group-head__meta">
					{{ memberTotal }} 人<text v-if="conv.groupNo"> · 群号 {{ conv.groupNo }}</text>
				</text>
			</view>
			<view class="group-head__invite" @tap="onInvite">
				<tn-icon name="my-add" size="15px" color="#12B7F5" />
				<text class="group-head__invite-text">邀请</text>
			</view>
		</view>

		<!-- 群公告 -->
		<view class="group-card group-notice-card" @tap="onNotice">
			<view class="group-card__head">
				<tn-icon name="notice-fill" size="15px" color="#12B7F5" />
				<text class="group-card__title">群公告</text>
				<text class="group-card__extra">林嘉禾 · 今天 09:30</text>
				<tn-icon name="right" size="11px" color="#C2C6CC" />
			</view>
			<text class="group-notice">{{ notice }}</text>
		</view>

		<!-- 群成员 -->
		<view class="group-card">
			<view class="group-card__head">
				<text class="group-card__title">群成员</text>
				<view class="group-card__link" @tap="onAllMembers">
					<text>全部 {{ memberTotal }} 人</text>
					<tn-icon name="right" size="12px" color="#9AA0A8" />
				</view>
			</view>
			<view class="member-grid">
				<view class="member-grid__item" @tap="goUserDetail('me')">
					<qq-avatar
						:name="qqStore.user.name"
						:from="qqStore.user.avatarFrom"
						:to="qqStore.user.avatarTo"
						:size="44"
					/>
					<text class="member-grid__name">我</text>
				</view>
				<view
					v-for="member in members"
					:key="member.id"
					class="member-grid__item"
					@tap="goUserDetail(member.id)"
				>
					<qq-avatar
						:name="member.name"
						:from="member.avatarFrom"
						:to="member.avatarTo"
						:size="44"
					/>
					<text class="member-grid__name">{{ member.name }}</text>
				</view>
				<view class="member-grid__item" @tap="onInvite">
					<view class="member-grid__add">
						<tn-icon name="add" size="19px" color="#9AA0A8" />
					</view>
					<text class="member-grid__name">邀请</text>
				</view>
			</view>
		</view>

		<!-- 群文件 -->
		<view class="group-card">
			<view class="group-card__head">
				<text class="group-card__title">群文件</text>
				<view class="group-card__link" @tap="onFile('全部')">
					<text>全部文件</text>
					<tn-icon name="right" size="12px" color="#9AA0A8" />
				</view>
			</view>
			<view v-for="file in files" :key="file.name" class="group-file" @tap="onFile(file.name)">
				<view class="group-file__icon" :style="{ backgroundColor: `${file.color}16` }">
					<tn-icon :name="file.icon" size="17px" :color="file.color" />
				</view>
				<view class="group-file__main">
					<text class="group-file__name">{{ file.name }}</text>
					<text class="group-file__meta">{{ file.size }} · {{ file.time }}</text>
				</view>
				<tn-icon name="right" size="13px" color="#C9CDD4" />
			</view>
		</view>

		<!-- 群互动 -->
		<view class="group-card">
			<view class="group-card__head">
				<text class="group-card__title">群互动</text>
				<view class="group-card__link" @tap="onGroupManage">
					<text>群管理</text>
					<tn-icon name="right" size="12px" color="#9AA0A8" />
				</view>
			</view>
			<view class="group-inter">
				<view class="group-inter__item" @tap="onTodo">
					<view class="group-inter__icon group-inter__icon--blue">
						<tn-icon name="check" size="17px" color="#4776E6" />
						<text v-if="todoPending" class="group-inter__badge">{{ todoPending }}</text>
					</view>
					<text class="group-inter__label">群待办</text>
					<text class="group-inter__sub">{{ todoPending }} 项</text>
				</view>
				<view class="group-inter__item" @tap="onVote">
					<view class="group-inter__icon group-inter__icon--purple">
						<tn-icon name="comment" size="17px" color="#8E54E9" />
						<text v-if="voteActive" class="group-inter__badge group-inter__badge--purple">{{ voteActive }}</text>
					</view>
					<text class="group-inter__label">群投票</text>
					<text class="group-inter__sub">{{ voteActive }} 个进行中</text>
				</view>
				<view class="group-inter__item" @tap="onAlbum">
					<view class="group-inter__icon group-inter__icon--green">
						<tn-icon name="image" size="17px" color="#32C48D" />
					</view>
					<text class="group-inter__label">群相册</text>
					<text class="group-inter__sub">{{ albumCount }} 个相册</text>
				</view>
				<view class="group-inter__item" @tap="onCheckin">
					<view class="group-inter__icon group-inter__icon--orange">
						<tn-icon name="success-circle" size="17px" color="#FF9F1C" />
					</view>
					<text class="group-inter__label">群签到</text>
					<text class="group-inter__sub">{{ checkin.checked ? '今日已签到' : '今日待签到' }}</text>
				</view>
			</view>
		</view>

		<!-- 群设置 -->
		<view class="group-card">
			<view class="group-cell" @tap="onGroupManage">
				<text class="group-cell__label">群管理</text>
				<text v-if="meta.approval" class="group-cell__value">入群审批</text>
				<text v-if="meta.allMuted" class="group-cell__value">全员禁言</text>
				<tn-icon name="right" size="13px" color="#C9CDD4" />
			</view>
			<view class="group-cell">
				<text class="group-cell__label">消息免打扰</text>
				<tn-switch v-model="conv.muted" active-color="tn-blue" />
			</view>
			<view class="group-cell">
				<text class="group-cell__label">置顶聊天</text>
				<tn-switch v-model="conv.pinned" active-color="tn-blue" />
			</view>
			<view class="group-cell" @tap="onNickname">
				<text class="group-cell__label">我在本群的昵称</text>
				<text class="group-cell__value">{{ qqStore.user.name }}</text>
				<tn-icon name="right" size="13px" color="#C9CDD4" />
			</view>
			<view class="group-cell" @tap="onSearchHistory">
				<text class="group-cell__label">查找聊天记录</text>
				<tn-icon name="right" size="13px" color="#C9CDD4" />
			</view>
		</view>

		<view class="group-quit" @tap="onQuit">退出群聊</view>

		<view class="group-tip">群资料为演示数据 · 退出后该群会话会从消息列表移除</view>
	</view>
</template>

<style lang="scss" scoped>
	.group-page {
		min-height: 100vh;
		box-sizing: border-box;
		padding-bottom: 28px;
		background-color: var(--qq-card-2);
	}

	.group-head {
		display: flex;
		align-items: center;
		margin: 6px 12px 0;
		padding: 16px 14px;
		border-radius: 14px;
		background-color: var(--qq-card);
	}

	.group-head__main {
		flex: 1;
		min-width: 0;
		margin-left: 12px;
	}

	.group-head__name-row {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.group-head__name {
		font-size: 17px;
		font-weight: 600;
		color: var(--qq-text);
	}

	.group-head__muted {
		padding: 1px 5px;
		border-radius: 4px;
		background-color: var(--qq-bg);
		font-size: 9.5px;
		color: var(--qq-text-3);
	}

	.group-head__muted--mute {
		background-color: rgba(255, 159, 28, 0.1);
		color: #ff9f1c;
	}

	.group-head__meta {
		display: block;
		margin-top: 5px;
		font-size: 11.5px;
		color: var(--qq-text-3);
	}

	.group-head__invite {
		display: flex;
		align-items: center;
		gap: 2px;
		padding: 5px 10px;
		border-radius: 13px;
		background-color: rgba(18, 183, 245, 0.1);
	}

	.group-head__invite-text {
		font-size: 11.5px;
		color: #12b7f5;
	}

	.group-card {
		margin: 12px 12px 0;
		padding: 14px;
		border-radius: 14px;
		background-color: var(--qq-card);
	}

	.group-card__head {
		display: flex;
		align-items: center;
		gap: 5px;
	}

	.group-card__title {
		font-size: 13px;
		font-weight: 600;
		color: var(--qq-text);
	}

	.group-card__extra {
		margin-left: auto;
		font-size: 10.5px;
		color: var(--qq-text-3);
	}

	.group-card__link {
		display: flex;
		align-items: center;
		gap: 1px;
		margin-left: auto;
		font-size: 10.5px;
		color: var(--qq-text-3);
	}

	.group-notice {
		display: block;
		margin-top: 9px;
		padding: 9px 10px;
		border-radius: 8px;
		background-color: var(--qq-card-2);
		font-size: 12.5px;
		line-height: 1.6;
		color: var(--qq-text-2);
	}

	.member-grid {
		display: flex;
		flex-wrap: wrap;
		margin-top: 10px;
	}

	.member-grid__item {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 5px;
		width: 20%;
		margin-bottom: 12px;
	}

	.member-grid__name {
		max-width: 100%;
		font-size: 10px;
		color: var(--qq-text-2);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.member-grid__add {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 44px;
		height: 44px;
		border-radius: 11px;
		border: 1px dashed var(--qq-line-strong);
		background-color: var(--qq-card-2);
		box-sizing: border-box;
	}

	.group-file {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 10px 0;
		border-bottom: 1px solid var(--qq-line);
	}

	.group-file:last-child {
		border-bottom: none;
		padding-bottom: 2px;
	}

	.group-file__icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 36px;
		height: 36px;
		border-radius: 9px;
		flex-shrink: 0;
	}

	.group-file__main {
		flex: 1;
		min-width: 0;
	}

	.group-file__name {
		display: block;
		font-size: 12.5px;
		color: var(--qq-text);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.group-file__meta {
		display: block;
		margin-top: 3px;
		font-size: 10px;
		color: var(--qq-text-3);
	}

	.group-inter {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 6px;
		padding: 4px 0 12px;
	}

	.group-inter__item {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 9px 0 8px;
		border-radius: 10px;
		background-color: var(--qq-card-2);
	}

	.group-inter__icon {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		border-radius: 10px;
	}

	.group-inter__icon--blue {
		background-color: rgba(71, 118, 230, 0.1);
	}

	.group-inter__icon--purple {
		background-color: rgba(142, 84, 233, 0.1);
	}

	.group-inter__icon--green {
		background-color: rgba(50, 196, 141, 0.1);
	}

	.group-inter__icon--orange {
		background-color: rgba(255, 159, 28, 0.1);
	}

	.group-inter__badge {
		position: absolute;
		right: -4px;
		top: -5px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 14px;
		height: 14px;
		padding: 0 3px;
		border-radius: 7px;
		background-color: #fa5151;
		font-size: 8px;
		font-weight: 600;
		color: #ffffff;
	}

	.group-inter__badge--purple {
		background-color: #8e54e9;
	}

	.group-inter__label {
		margin-top: 6px;
		font-size: 11.5px;
		font-weight: 500;
		color: var(--qq-text);
	}

	.group-inter__sub {
		margin-top: 2px;
		font-size: 9px;
		color: var(--qq-text-3);
	}

	.group-cell {
		display: flex;
		align-items: center;
		gap: 8px;
		min-height: 46px;
		border-bottom: 1px solid var(--qq-line);
	}

	.group-cell:last-child {
		border-bottom: none;
	}

	.group-cell__label {
		flex: 1;
		min-width: 0;
		font-size: 13px;
		color: var(--qq-text);
	}

	.group-cell__value {
		font-size: 12px;
		color: var(--qq-text-3);
	}

	.group-quit {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 46px;
		margin: 16px 12px 0;
		border-radius: 12px;
		background-color: var(--qq-card);
		font-size: 14px;
		color: #fa5151;
	}

	.group-tip {
		margin-top: 12px;
		text-align: center;
		font-size: 10.5px;
		color: var(--qq-text-4);
	}
</style>
