<script lang="ts" setup>
	import { computed, ref } from 'vue'
	import { onLoad } from '@dcloudio/uni-app'
	import {
		closeGroupVote,
		createGroupVote,
		findConversation,
		findUser,
		groupVotesOf,
		sendGroupCard,
		voteGroupPoll,
	} from '@/qq/store'
	import { goChatByConversation } from '@/qq/router'
	import type { QQGroupVote, QQGroupVoteOption } from '@/qq/types'

	const convId = ref('c3')
	const conv = computed(() => findConversation(convId.value))
	const votes = computed(() => groupVotesOf(convId.value))
	const tab = ref<'active' | 'closed'>('active')
	const tabs = [
		{ key: 'active', label: '进行中' },
		{ key: 'closed', label: '已结束' },
	] as const

	const createShow = ref(false)
	const loading = ref(true)
	const title = ref('')
	const optionTexts = ref<string[]>(['', ''])
	const deadlineOptions = ['明天 18:00', '周五 20:00', '今天 22:00']
	const deadline = ref(deadlineOptions[0])

	onLoad((options: any) => {
		convId.value = options?.id || 'c3'
		setTimeout(() => {
			loading.value = false
		}, 420)
	})

	const activeVotes = computed(() => votes.value.filter((v) => !v.closed))
	const closedVotes = computed(() => votes.value.filter((v) => v.closed))
	const shown = computed(() => (tab.value === 'active' ? activeVotes.value : closedVotes.value))

	function selectTab(key: string) {
		tab.value = key as typeof tab.value
	}

	const totalOf = (vote: QQGroupVote) => vote.options.reduce((sum, o) => sum + o.votes, 0)

	const percentOf = (vote: QQGroupVote, option: QQGroupVoteOption) => {
		const total = totalOf(vote)
		if (!total) return 0
		return Math.round((option.votes / total) * 100)
	}

	const leadingId = (vote: QQGroupVote) => {
		let best = vote.options[0]
		vote.options.forEach((o) => {
			if (o.votes > best.votes) best = o
		})
		return best?.id
	}

	const creatorName = (id: string) => (id === 'me' ? '我' : findUser(id).name)

	function onVote(vote: QQGroupVote, option: QQGroupVoteOption) {
		if (vote.closed) {
			uni.showToast({ title: '投票已结束', icon: 'none' })
			return
		}
		if (vote.myVote) {
			uni.showToast({ title: '每人只能投一票', icon: 'none' })
			return
		}
		if (voteGroupPoll(vote.id, option.id)) {
			uni.showToast({ title: '投票成功', icon: 'none' })
		}
	}

	function openCreate() {
		title.value = ''
		optionTexts.value = ['', '']
		deadline.value = deadlineOptions[0]
		createShow.value = true
	}

	function closeCreate() {
		createShow.value = false
	}

	function addOption() {
		if (optionTexts.value.length >= 5) {
			uni.showToast({ title: '最多 5 个选项', icon: 'none' })
			return
		}
		optionTexts.value.push('')
	}

	function removeOption(index: number) {
		if (optionTexts.value.length <= 2) return
		optionTexts.value.splice(index, 1)
	}

	function saveVote() {
		if (!title.value.trim()) {
			uni.showToast({ title: '请填写投票主题', icon: 'none' })
			return
		}
		if (optionTexts.value.filter((o) => o.trim()).length < 2) {
			uni.showToast({ title: '至少填写 2 个选项', icon: 'none' })
			return
		}
		createGroupVote(convId.value, title.value, optionTexts.value, deadline.value)
		createShow.value = false
		tab.value = 'active'
		uni.showToast({ title: '投票已发起', icon: 'none' })
	}

	function endVote(vote: QQGroupVote) {
		uni.showModal({
			title: '结束投票',
			content: `确定结束「${vote.title}」吗？结束后不能再投票。`,
			confirmText: '结束',
			success: (res) => {
				if (!res.confirm) return
				closeGroupVote(vote.id)
				tab.value = 'closed'
				uni.showToast({ title: '投票已结束', icon: 'none' })
			},
		})
	}

	function shareToChat(vote: QQGroupVote) {
		sendGroupCard(convId.value, {
			kind: 'vote',
			refId: vote.id,
			title: vote.title,
			sub: `${vote.closed ? '已结束' : '截止 ' + vote.deadline} · ${totalOf(vote)} 人参与`,
			badge: '群投票',
		})
		uni.showModal({
			title: '已发送到群聊',
			content: '现在去群聊看看这张投票卡片吗？',
			confirmText: '去看看',
			cancelText: '留在本页',
			success: (res) => {
				if (res.confirm) setTimeout(() => goChatByConversation(convId.value), 220)
			},
		})
	}
</script>

<template>
	<view class="qq-page vote-page">
		<qq-navbar title="群投票" bg="#F7F8FA">
			<template #right>
				<view class="vote-hd" @tap="openCreate">
					<tn-icon name="add" size="22px" color="tn-grey-dark" />
				</view>
			</template>
		</qq-navbar>

		<view class="vote-hero">
			<view class="vote-hero__deco vote-hero__deco--a" />
			<view class="vote-hero__deco vote-hero__deco--b" />
			<view class="vote-hero__top">
				<view>
					<text class="vote-hero__eyebrow">群投票 · {{ conv ? conv.name : '群聊' }}</text>
					<text class="vote-hero__title">{{ activeVotes.length }} 个投票进行中</text>
				</view>
				<view class="vote-hero__icon">
					<tn-icon name="comment" size="24px" color="#FFFFFF" />
				</view>
			</view>
			<view class="vote-hero__stats">
				<text class="vote-hero__stat">累计 {{ votes.length }} 个投票</text>
				<text class="vote-hero__stat vote-hero__stat--right">已结束 {{ closedVotes.length }} 个</text>
			</view>
		</view>

		<view class="vote-tabs">
			<view
				v-for="item in tabs"
				:key="item.key"
				class="vote-tab"
				:class="{ 'vote-tab--active': tab === item.key }"
				@tap="selectTab(item.key)"
			>
				<text class="vote-tab__text">{{ item.label }}</text>
				<text class="vote-tab__count">{{ item.key === 'active' ? activeVotes.length : closedVotes.length }}</text>
			</view>
		</view>

		<qq-skeleton v-if="loading" variant="vote" :rows="2" />
		<view v-else-if="shown.length" class="vote-list">
			<view v-for="vote in shown" :key="vote.id" class="vote-card">
				<view class="vote-card__top">
					<view class="vote-card__status" :class="{ 'vote-card__status--closed': vote.closed }">
						<view class="vote-card__dot" />
						<text>{{ vote.closed ? '已结束' : '进行中' }}</text>
					</view>
					<text class="vote-card__deadline">{{ vote.closed ? '已截止' : '截止 ' + vote.deadline }}</text>
				</view>

				<text class="vote-card__title">{{ vote.title }}</text>
				<text v-if="vote.desc" class="vote-card__desc">{{ vote.desc }}</text>

				<view class="vote-card__meta">
					<qq-avatar
						:name="creatorName(vote.creatorId)"
						:from="vote.creatorId === 'me' ? '#8E54E9' : findUser(vote.creatorId).avatarFrom"
						:to="vote.creatorId === 'me' ? '#4776E6' : findUser(vote.creatorId).avatarTo"
						:size="16"
					/>
					<text class="vote-card__meta-text">{{ creatorName(vote.creatorId) }} 发起</text>
					<text class="vote-card__sep">·</text>
					<text class="vote-card__meta-text">{{ totalOf(vote) }} 人参与</text>
					<text v-if="vote.myVote" class="vote-card__voted">已投票</text>
				</view>

				<view class="vote-options">
					<view
						v-for="option in vote.options"
						:key="option.id"
						class="vote-opt"
						:class="{
							'vote-opt--chosen': vote.myVote === option.id,
							'vote-opt--leading': leadingId(vote) === option.id && (vote.closed || vote.myVote),
						}"
						@tap="onVote(vote, option)"
					>
						<view class="vote-opt__bar" :style="{ width: percentOf(vote, option) + '%' }" />
						<view class="vote-opt__main">
							<text class="vote-opt__text">{{ option.text }}</text>
							<view class="vote-opt__right">
								<text v-if="leadingId(vote) === option.id && vote.closed" class="vote-opt__lead">领先</text>
								<text class="vote-opt__percent">{{ percentOf(vote, option) }}%</text>
								<tn-icon
									v-if="vote.myVote === option.id"
									name="check"
									size="15px"
									color="#12B7F5"
								/>
							</view>
						</view>
					</view>
				</view>

				<view class="vote-card__foot">
					<text class="vote-card__foot-text">
						{{ vote.closed ? '投票已结束，结果仅供查看' : '点击选项投票，每人仅限一票' }}
					</text>
					<view class="vote-card__actions">
						<view class="vote-card__share" @tap.stop="shareToChat(vote)">
							<tn-icon name="share-triangle" size="11px" color="#12B7F5" />
							<text>发到群聊</text>
						</view>
						<view
							v-if="!vote.closed && vote.creatorId === 'me'"
							class="vote-card__end"
							@tap.stop="endVote(vote)"
						>
							<text>结束投票</text>
						</view>
					</view>
				</view>
			</view>
		</view>

		<qq-empty
			v-else
			icon="comment"
			:title="tab === 'active' ? '还没有进行中的投票' : '还没有已结束的投票'"
			sub="发起一个投票，听听大家的想法"
			action-text="发起投票"
			@action="openCreate"
		/>

		<text class="vote-footer">群投票为本地演示数据</text>

		<!-- 发起投票 -->
		<view v-if="createShow" class="vote-mask" @tap="closeCreate">
			<view class="vote-sheet" @tap.stop>
				<view class="vote-sheet__head">
					<text class="vote-sheet__title">发起群投票</text>
					<view class="vote-sheet__close" @tap="closeCreate">
						<tn-icon name="close" size="15px" color="#9AA0A8" />
					</view>
				</view>

				<text class="vote-sheet__label">投票主题</text>
				<input
					v-model="title"
					class="vote-sheet__input"
					maxlength="40"
					placeholder="例如：下期版本优先做哪个功能？"
					confirm-type="done"
				/>

				<text class="vote-sheet__label">选项（2 ~ 5 个）</text>
				<view v-for="(opt, index) in optionTexts" :key="index" class="vote-sheet__row">
					<view class="vote-sheet__index">{{ index + 1 }}</view>
					<input
						v-model="optionTexts[index]"
						class="vote-sheet__opt"
						maxlength="30"
						:placeholder="'选项 ' + (index + 1)"
						confirm-type="done"
					/>
					<view v-if="optionTexts.length > 2" class="vote-sheet__remove" @tap="removeOption(index)">
						<tn-icon name="close-circle" size="15px" color="#C9CDD4" />
					</view>
				</view>
				<view v-if="optionTexts.length < 5" class="vote-sheet__add" @tap="addOption">
					<tn-icon name="add-circle" size="15px" color="#12B7F5" />
					<text class="vote-sheet__add-text">添加选项</text>
				</view>

				<text class="vote-sheet__label">截止时间</text>
				<view class="vote-sheet__dues">
					<view
						v-for="opt in deadlineOptions"
						:key="opt"
						class="vote-sheet__due"
						:class="{ 'vote-sheet__due--active': deadline === opt }"
						@tap="deadline = opt"
					>
						<text>{{ opt }}</text>
					</view>
				</view>

				<view class="vote-sheet__submit" @tap="saveVote">
					<text>发布投票</text>
				</view>
				<text class="vote-sheet__tip">演示为单选投票，发布后可实时看到票数变化</text>
			</view>
		</view>
	</view>
</template>

<style lang="scss" scoped>
	.vote-page {
		min-height: 100vh;
		box-sizing: border-box;
		padding-bottom: calc(28px + env(safe-area-inset-bottom));
		background-color: var(--qq-card-2);
	}

	.vote-hd {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 34px;
		height: 34px;
	}

	.vote-hero {
		position: relative;
		margin: 6px 12px 0;
		padding: 16px;
		border-radius: 16px;
		background: linear-gradient(135deg, #7b5cf0 0%, #4776e6 100%);
		overflow: hidden;
	}

	.vote-hero__deco {
		position: absolute;
		border-radius: 50%;
		background-color: rgba(255, 255, 255, 0.1);
	}

	.vote-hero__deco--a {
		right: -34px;
		top: -50px;
		width: 132px;
		height: 132px;
	}

	.vote-hero__deco--b {
		right: 42px;
		bottom: -58px;
		width: 92px;
		height: 92px;
	}

	.vote-hero__top {
		position: relative;
		z-index: 1;
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
	}

	.vote-hero__eyebrow {
		display: block;
		font-size: 11px;
		color: rgba(255, 255, 255, 0.72);
	}

	.vote-hero__title {
		display: block;
		margin-top: 6px;
		font-size: 23px;
		font-weight: 700;
		color: #ffffff;
		letter-spacing: 0.3px;
	}

	.vote-hero__icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 44px;
		height: 44px;
		border-radius: 13px;
		background-color: rgba(255, 255, 255, 0.15);
	}

	.vote-hero__stats {
		position: relative;
		z-index: 1;
		display: flex;
		align-items: center;
		margin-top: 14px;
	}

	.vote-hero__stat {
		font-size: 11.5px;
		color: rgba(255, 255, 255, 0.82);
	}

	.vote-hero__stat--right {
		margin-left: auto;
	}

	.vote-tabs {
		display: flex;
		align-items: center;
		gap: 8px;
		margin: 12px 12px 0;
	}

	.vote-tab {
		display: flex;
		align-items: center;
		height: 29px;
		padding: 0 12px;
		border-radius: 14.5px;
		background-color: var(--qq-card);
	}

	.vote-tab--active {
		background-color: var(--qq-blue-light);
	}

	.vote-tab__text {
		font-size: 11.5px;
		color: var(--qq-text-3);
	}

	.vote-tab--active .vote-tab__text {
		font-weight: 600;
		color: #12b7f5;
	}

	.vote-tab__count {
		display: flex;
		align-items: center;
		justify-content: center;
		min-width: 15px;
		height: 15px;
		margin-left: 4px;
		padding: 0 4px;
		border-radius: 7.5px;
		background-color: rgba(154, 160, 168, 0.14);
		font-size: 9.5px;
		color: var(--qq-text-3);
	}

	.vote-tab--active .vote-tab__count {
		background-color: rgba(18, 183, 245, 0.14);
		color: #12b7f5;
	}

	.vote-list {
		margin: 10px 12px 0;
	}

	.vote-card {
		margin-bottom: 10px;
		padding: 14px;
		border-radius: 14px;
		background-color: var(--qq-card);
	}

	.vote-card__top {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.vote-card__status {
		display: flex;
		align-items: center;
		gap: 4px;
		font-size: 10px;
		font-weight: 600;
		color: #12b7f5;
	}

	.vote-card__dot {
		width: 5px;
		height: 5px;
		border-radius: 50%;
		background-color: #12b7f5;
	}

	.vote-card__status--closed {
		color: var(--qq-text-3);
	}

	.vote-card__status--closed .vote-card__dot {
		background-color: var(--qq-text-4);
	}

	.vote-card__deadline {
		font-size: 10px;
		color: var(--qq-text-3);
	}

	.vote-card__title {
		display: block;
		margin-top: 8px;
		font-size: 15px;
		font-weight: 600;
		line-height: 1.45;
		color: var(--qq-text);
	}

	.vote-card__desc {
		display: block;
		margin-top: 4px;
		font-size: 11px;
		line-height: 1.5;
		color: var(--qq-text-3);
	}

	.vote-card__meta {
		display: flex;
		align-items: center;
		margin-top: 10px;
	}

	.vote-card__meta-text,
	.vote-card__sep {
		font-size: 10px;
		color: var(--qq-text-3);
	}

	.vote-card__sep {
		margin: 0 4px;
	}

	.vote-card__voted {
		margin-left: auto;
		padding: 1px 6px;
		border-radius: 4px;
		background-color: var(--qq-blue-light);
		font-size: 9.5px;
		color: #12b7f5;
	}

	.vote-options {
		margin-top: 11px;
	}

	.vote-opt {
		position: relative;
		margin-bottom: 7px;
		border-radius: 9px;
		background-color: var(--qq-card-2);
		overflow: hidden;
	}

	.vote-opt__bar {
		position: absolute;
		left: 0;
		top: 0;
		bottom: 0;
		border-radius: 9px;
		background-color: rgba(18, 183, 245, 0.13);
		transition: width 0.4s ease;
	}

	.vote-opt--chosen {
		outline: 1px solid rgba(18, 183, 245, 0.6);
	}

	.vote-opt--chosen .vote-opt__bar {
		background-color: rgba(18, 183, 245, 0.2);
	}

	.vote-opt__main {
		position: relative;
		z-index: 1;
		display: flex;
		align-items: center;
		height: 38px;
		padding: 0 12px;
	}

	.vote-opt__text {
		flex: 1;
		min-width: 0;
		font-size: 12.5px;
		color: var(--qq-text);
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
	}

	.vote-opt--chosen .vote-opt__text {
		font-weight: 600;
		color: #12b7f5;
	}

	.vote-opt__right {
		display: flex;
		align-items: center;
		flex-shrink: 0;
		margin-left: 8px;
	}

	.vote-opt__percent {
		font-size: 10.5px;
		color: var(--qq-text-2);
	}

	.vote-opt__lead {
		margin-right: 5px;
		padding: 0 4px;
		border-radius: 3px;
		background-color: rgba(255, 159, 28, 0.12);
		font-size: 9px;
		color: #ff9f1c;
	}

	.vote-opt__right .tn-icon {
		margin-left: 5px;
	}

	.vote-card__foot {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-top: 10px;
	}

	.vote-card__foot-text {
		flex: 1;
		min-width: 0;
		font-size: 10px;
		color: var(--qq-text-3);
	}

	.vote-card__actions {
		display: flex;
		align-items: center;
		flex-shrink: 0;
		gap: 6px;
		margin-left: 8px;
	}

	.vote-card__share {
		display: flex;
		align-items: center;
		gap: 3px;
		height: 24px;
		padding: 0 8px;
		border-radius: 12px;
		background-color: var(--qq-blue-light);
		font-size: 10px;
		font-weight: 500;
		color: #12b7f5;
	}

	.vote-card__end {
		display: flex;
		align-items: center;
		height: 24px;
		padding: 0 9px;
		border-radius: 12px;
		background-color: var(--qq-card-2);
		font-size: 10.5px;
		color: var(--qq-red);
	}

	.vote-empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 58px 24px 0;
	}

	.vote-empty__icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 64px;
		height: 64px;
		border-radius: 50%;
		background-color: var(--qq-card);
	}

	.vote-empty__text {
		margin-top: 14px;
		font-size: 14px;
		color: var(--qq-text-2);
	}

	.vote-empty__sub {
		margin-top: 6px;
		font-size: 11.5px;
		color: var(--qq-text-3);
	}

	.vote-empty__btn {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 34px;
		margin-top: 18px;
		padding: 0 18px;
		border-radius: 17px;
		background-color: var(--qq-blue-light);
		color: #12b7f5;
		font-size: 12.5px;
		font-weight: 600;
	}

	.vote-footer {
		display: block;
		padding: 18px 0 6px;
		text-align: center;
		font-size: 10px;
		color: var(--qq-text-4);
	}

	.vote-mask {
		position: fixed;
		left: 0;
		right: 0;
		top: 0;
		bottom: 0;
		z-index: 60;
		display: flex;
		align-items: flex-end;
		justify-content: center;
		background-color: rgba(0, 0, 0, 0.42);
	}

	.vote-sheet {
		width: 100%;
		max-width: 430px;
		max-height: 84vh;
		box-sizing: border-box;
		padding: 18px 16px calc(20px + env(safe-area-inset-bottom));
		border-radius: 18px 18px 0 0;
		background-color: var(--qq-card);
		overflow-y: auto;
	}

	.vote-sheet__head {
		display: flex;
		align-items: center;
	}

	.vote-sheet__title {
		flex: 1;
		font-size: 16px;
		font-weight: 600;
		color: var(--qq-text);
	}

	.vote-sheet__close {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
	}

	.vote-sheet__label {
		display: block;
		margin-top: 15px;
		font-size: 11.5px;
		color: var(--qq-text-3);
	}

	.vote-sheet__input {
		width: 100%;
		height: 40px;
		box-sizing: border-box;
		margin-top: 8px;
		padding: 0 11px;
		border-radius: 9px;
		background-color: var(--qq-card-2);
		font-size: 13px;
		color: var(--qq-text);
	}

	.vote-sheet__row {
		display: flex;
		align-items: center;
		margin-top: 8px;
	}

	.vote-sheet__index {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 22px;
		height: 22px;
		margin-right: 8px;
		border-radius: 50%;
		background-color: var(--qq-blue-light);
		font-size: 10.5px;
		font-weight: 600;
		color: #12b7f5;
	}

	.vote-sheet__opt {
		flex: 1;
		height: 38px;
		box-sizing: border-box;
		padding: 0 11px;
		border-radius: 9px;
		background-color: var(--qq-card-2);
		font-size: 12.5px;
		color: var(--qq-text);
	}

	.vote-sheet__remove {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		margin-left: 6px;
	}

	.vote-sheet__add {
		display: flex;
		align-items: center;
		gap: 5px;
		margin-top: 9px;
		padding-left: 30px;
	}

	.vote-sheet__add-text {
		font-size: 11.5px;
		color: #12b7f5;
	}

	.vote-sheet__dues {
		display: flex;
		gap: 8px;
		margin-top: 8px;
	}

	.vote-sheet__due {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 30px;
		padding: 0 10px;
		border-radius: 8px;
		background-color: var(--qq-card-2);
		font-size: 11px;
		color: var(--qq-text-2);
	}

	.vote-sheet__due--active {
		background-color: var(--qq-blue-light);
		color: #12b7f5;
		font-weight: 600;
	}

	.vote-sheet__submit {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 44px;
		margin-top: 20px;
		border-radius: 12px;
		background: linear-gradient(135deg, #7b5cf0 0%, #4776e6 100%);
		color: #ffffff;
		font-size: 15px;
		font-weight: 600;
	}

	.vote-sheet__tip {
		display: block;
		margin-top: 10px;
		text-align: center;
		font-size: 10px;
		color: var(--qq-text-4);
	}

	@media (max-width: 380px) {
		.vote-hero {
			margin: 6px 10px 0;
			padding: 13px;
		}

		.vote-hero__title {
			font-size: 20px;
		}

		.vote-tabs,
		.vote-list {
			margin-left: 10px;
			margin-right: 10px;
		}

		.vote-card {
			padding: 13px 12px;
		}

		.vote-opt {
			min-height: 42px;
			padding: 8px 10px;
		}
	}
</style>
