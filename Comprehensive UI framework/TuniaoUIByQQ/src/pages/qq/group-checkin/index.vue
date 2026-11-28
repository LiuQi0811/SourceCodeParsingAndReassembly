<script lang="ts" setup>
	import { computed, ref } from 'vue'
	import { onLoad } from '@dcloudio/uni-app'
	import { checkInGroup, findConversation, findUser, groupCheckinOf, sendGroupCard } from '@/qq/store'
	import { goChatByConversation } from '@/qq/router'

	const convId = ref('c3')
	const conv = computed(() => findConversation(convId.value))
	const state = computed(() => groupCheckinOf(convId.value))
	const pop = ref(false)

	onLoad((options: any) => {
		convId.value = options?.id || 'c3'
	})

	const dateText = computed(() => {
		const d = new Date()
		const week = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][d.getDay()]
		return `${d.getMonth() + 1} 月 ${d.getDate()} 日 · ${week}`
	})

	const weekDays = computed(() => {
		const today = (new Date().getDay() + 6) % 7
		return ['一', '二', '三', '四', '五', '六', '日'].map((label, index) => ({
			label,
			today: index === today,
			done: index < today || (index === today && state.value.checked),
	}))
	})

	const rankRows = computed(() =>
		state.value.board.slice(0, 10).map((entry, index) => ({
			...entry,
			rank: index + 1,
			user: findUser(entry.userId),
			isMe: entry.userId === 'me',
		}))
	)

	function doCheckin() {
		if (state.value.checked) {
			uni.showToast({ title: '今天已经签到过了', icon: 'none' })
			return
		}
		if (!checkInGroup(convId.value)) return
		pop.value = true
		uni.showToast({ title: `签到成功，已连续 ${state.value.streak} 天`, icon: 'none' })
		setTimeout(() => {
			pop.value = false
		}, 700)
	}

	function shareCheckin() {
		sendGroupCard(convId.value, {
			kind: 'checkin',
			refId: convId.value,
			title: `${conv.value?.name || '群聊'} · 今日打卡`,
			sub: `连续 ${state.value.streak} 天 · 今日 ${state.value.todayCount} 人已签到`,
			badge: '群签到',
		})
		uni.showModal({
			title: '已发送到群聊',
			content: '现在去群聊看看这张签到卡片吗？',
			confirmText: '去看看',
			cancelText: '留在本页',
			success: (res) => {
				if (res.confirm) setTimeout(() => goChatByConversation(convId.value), 220)
			},
		})
	}
</script>

<template>
	<view class="qq-page checkin-page">
		<qq-navbar title="群签到" bg="#F7F8FA" />

		<!-- 签到主卡 -->
		<view class="checkin-hero">
			<view class="checkin-hero__deco checkin-hero__deco--a" />
			<view class="checkin-hero__deco checkin-hero__deco--b" />
			<view class="checkin-hero__top">
				<text class="checkin-hero__eyebrow">群签到 · {{ conv ? conv.name : '群聊' }}</text>
				<text class="checkin-hero__date">{{ dateText }}</text>
			</view>

			<view class="checkin-main">
				<view class="checkin-ring" :class="{ 'checkin-ring--pop': pop }">
					<text class="checkin-ring__num">{{ state.streak }}</text>
					<text class="checkin-ring__unit">天</text>
					<text class="checkin-ring__label">连续签到</text>
				</view>
				<view class="checkin-main__right">
					<view
						class="checkin-btn"
						:class="{ 'checkin-btn--checked': state.checked }"
						@tap="doCheckin"
					>
						<tn-icon :name="state.checked ? 'check' : 'success-circle'" size="16px" color="#4776E6" />
						<text class="checkin-btn__text">{{ state.checked ? '今日已签到' : '立即签到' }}</text>
					</view>
					<text class="checkin-main__tip">
						{{ state.checked ? '明天再来，保持连续签到' : '签到 +1 天，解锁群勋章' }}
					</text>
					<text v-if="state.checked" class="checkin-main__time">签到于 {{ state.time }}</text>
				</view>
			</view>

			<view class="checkin-stats">
				<view class="checkin-stat">
					<text class="checkin-stat__num">{{ state.todayCount }}</text>
					<text class="checkin-stat__label">今日已签</text>
				</view>
				<view class="checkin-stat__line" />
				<view class="checkin-stat">
					<text class="checkin-stat__num">{{ state.total }}</text>
					<text class="checkin-stat__label">我的累计</text>
				</view>
				<view class="checkin-stat__line" />
				<view class="checkin-stat">
					<text class="checkin-stat__num">{{ state.streak }}</text>
					<text class="checkin-stat__label">连续天数</text>
				</view>
			</view>
		</view>

		<view class="checkin-share" @tap="shareCheckin">
			<tn-icon name="share-triangle" size="13px" color="#12B7F5" />
			<text>分享今日打卡到群聊</text>
		</view>

		<!-- 本周 -->
		<view class="checkin-card">
			<view class="checkin-card__head">
				<text class="checkin-card__title">本周签到</text>
				<text class="checkin-card__sub">坚持每天来群里打个卡</text>
			</view>
			<view class="week-row">
				<view v-for="day in weekDays" :key="day.label" class="week-day">
					<view
						class="week-day__dot"
						:class="{ 'week-day__dot--done': day.done, 'week-day__dot--today': day.today }"
					>
						<tn-icon v-if="day.done" name="check" size="12px" color="#FFFFFF" />
						<text v-else class="week-day__dot-text">{{ day.today ? '今' : '' }}</text>
					</view>
					<text class="week-day__label" :class="{ 'week-day__label--today': day.today }">周{{ day.label }}</text>
				</view>
			</view>
		</view>

		<!-- 排行榜 -->
		<view class="checkin-card">
			<view class="checkin-card__head">
				<text class="checkin-card__title">今日签到榜</text>
				<text class="checkin-card__sub">按签到时间排序</text>
			</view>
			<view class="rank-list">
				<view
					v-for="row in rankRows"
					:key="row.userId + row.rank"
					class="rank-row"
					:class="{ 'rank-row--me': row.isMe }"
				>
					<view class="rank-no" :class="'rank-no--' + row.rank">
						<text>{{ row.rank }}</text>
					</view>
					<qq-avatar
						:name="row.user.name"
						:from="row.isMe ? '#12B7F5' : row.user.avatarFrom"
						:to="row.isMe ? '#4776E6' : row.user.avatarTo"
						:size="30"
					/>
					<view class="rank-main">
						<text class="rank-name">
							{{ row.user.name }}
							<text v-if="row.isMe" class="rank-me">我</text>
						</text>
						<text class="rank-sub">连续签到 {{ row.streak }} 天</text>
					</view>
					<text class="rank-time">{{ row.time }}</text>
				</view>
			</view>
			<text v-if="!state.checked" class="rank-tip">签到后你会出现在榜单里</text>
		</view>

		<text class="checkin-footer">群签到为本地演示数据 · 每天可签到一次</text>
	</view>
</template>

<style lang="scss" scoped>
	.checkin-page {
		min-height: 100vh;
		box-sizing: border-box;
		padding-bottom: calc(28px + env(safe-area-inset-bottom));
		background-color: var(--qq-card-2);
	}

	.checkin-hero {
		position: relative;
		margin: 6px 12px 0;
		padding: 16px;
		border-radius: 18px;
		background: linear-gradient(135deg, #ff9f1c 0%, #ff7a45 58%, #fa5151 120%);
		overflow: hidden;
	}

	.checkin-hero__deco {
		position: absolute;
		border-radius: 50%;
		background-color: rgba(255, 255, 255, 0.12);
	}

	.checkin-hero__deco--a {
		right: -36px;
		top: -58px;
		width: 140px;
		height: 140px;
	}

	.checkin-hero__deco--b {
		left: -46px;
		bottom: -70px;
		width: 130px;
		height: 130px;
		background-color: rgba(255, 255, 255, 0.08);
	}

	.checkin-hero__top {
		position: relative;
		z-index: 1;
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.checkin-hero__eyebrow {
		font-size: 10.5px;
		color: rgba(255, 255, 255, 0.78);
	}

	.checkin-hero__date {
		font-size: 10.5px;
		color: rgba(255, 255, 255, 0.9);
	}

	.checkin-main {
		position: relative;
		z-index: 1;
		display: flex;
		align-items: center;
		margin-top: 14px;
	}

	.checkin-ring {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		width: 96px;
		height: 96px;
		border-radius: 50%;
		border: 1.5px dashed rgba(255, 255, 255, 0.6);
		background-color: rgba(255, 255, 255, 0.12);
	}

	.checkin-ring--pop {
		animation: ring-pop 0.65s ease;
	}

	@keyframes ring-pop {
		0% {
			transform: scale(0.86);
		}
		40% {
			transform: scale(1.06);
		}
		100% {
			transform: scale(1);
		}
	}

	.checkin-ring__num {
		font-size: 30px;
		font-weight: 700;
		line-height: 1;
		color: #ffffff;
	}

	.checkin-ring__unit {
		margin-top: 1px;
		font-size: 10px;
		color: rgba(255, 255, 255, 0.86);
	}

	.checkin-ring__label {
		margin-top: 5px;
		font-size: 9.5px;
		color: rgba(255, 255, 255, 0.72);
	}

	.checkin-main__right {
		flex: 1;
		min-width: 0;
		margin-left: 18px;
	}

	.checkin-btn {
		display: inline-flex;
		align-items: center;
		height: 36px;
		padding: 0 16px;
		border-radius: 18px;
		background-color: #ffffff;
		box-shadow: 0 6px 14px rgba(120, 40, 0, 0.18);
	}

	.checkin-btn--checked {
		background-color: rgba(255, 255, 255, 0.88);
	}

	.checkin-btn__text {
		margin-left: 5px;
		font-size: 12.5px;
		font-weight: 600;
		color: #4776e6;
	}

	.checkin-main__tip {
		display: block;
		margin-top: 8px;
		font-size: 10px;
		color: rgba(255, 255, 255, 0.8);
	}

	.checkin-main__time {
		display: block;
		margin-top: 3px;
		font-size: 9.5px;
		color: rgba(255, 255, 255, 0.62);
	}

	.checkin-stats {
		position: relative;
		z-index: 1;
		display: flex;
		align-items: center;
		margin-top: 16px;
		padding-top: 13px;
		border-top: 1px solid rgba(255, 255, 255, 0.16);
	}

	.checkin-stat {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
	}

	.checkin-stat__num {
		font-size: 17px;
		font-weight: 700;
		color: #ffffff;
	}

	.checkin-stat__label {
		margin-top: 3px;
		font-size: 9.5px;
		color: rgba(255, 255, 255, 0.72);
	}

	.checkin-stat__line {
		width: 1px;
		height: 22px;
		background-color: rgba(255, 255, 255, 0.18);
	}

	.checkin-share {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 5px;
		height: 34px;
		margin: 10px auto 0;
		padding: 0 16px;
		width: fit-content;
		border-radius: 17px;
		background-color: var(--qq-card);
		border: 1px solid var(--qq-line);
		font-size: 11.5px;
		font-weight: 500;
		color: #12b7f5;
	}

	.checkin-card {
		margin: 10px 12px 0;
		padding: 14px;
		border-radius: 14px;
		background-color: var(--qq-card);
	}

	.checkin-card__head {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.checkin-card__title {
		font-size: 14px;
		font-weight: 600;
		color: var(--qq-text);
	}

	.checkin-card__sub {
		font-size: 9.5px;
		color: var(--qq-text-3);
	}

	.week-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-top: 14px;
	}

	.week-day {
		display: flex;
		flex-direction: column;
		align-items: center;
	}

	.week-day__dot {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		border-radius: 50%;
		border: 1px solid var(--qq-line);
		background-color: var(--qq-card-2);
	}

	.week-day__dot--done {
		border-color: transparent;
		background: linear-gradient(135deg, #ffb03a, #ff7a45);
	}

	.week-day__dot--today {
		box-shadow: 0 0 0 3px rgba(255, 159, 28, 0.16);
	}

	.week-day__dot-text {
		font-size: 10px;
		font-weight: 600;
		color: #ff9f1c;
	}

	.week-day__label {
		margin-top: 6px;
		font-size: 9.5px;
		color: var(--qq-text-3);
	}

	.week-day__label--today {
		font-weight: 600;
		color: #ff9f1c;
	}

	.rank-list {
		margin-top: 6px;
	}

	.rank-row {
		display: flex;
		align-items: center;
		padding: 9px 0;
		border-bottom: 1px solid var(--qq-line);
	}

	.rank-row:last-child {
		border-bottom: none;
	}

	.rank-row--me {
		margin: 0 -6px;
		padding-left: 6px;
		padding-right: 6px;
		border-radius: 9px;
		border-bottom-color: transparent;
		background-color: var(--qq-blue-light);
	}

	.rank-no {
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		width: 18px;
		height: 18px;
		margin-right: 9px;
		border-radius: 6px;
		background-color: var(--qq-card-2);
		font-size: 10px;
		font-weight: 600;
		color: var(--qq-text-3);
	}

	.rank-no--1 {
		background: linear-gradient(135deg, #ffd76e, #ff9f1c);
		color: #7a4300;
	}

	.rank-no--2 {
		background: linear-gradient(135deg, #d7e2f0, #aebfd4);
		color: #43546b;
	}

	.rank-no--3 {
		background: linear-gradient(135deg, #f3d3b6, #d0a078);
		color: #6a4527;
	}

	.rank-main {
		flex: 1;
		min-width: 0;
		margin-left: 9px;
	}

	.rank-name {
		font-size: 12.5px;
		font-weight: 500;
		color: var(--qq-text);
	}

	.rank-me {
		margin-left: 4px;
		padding: 0 3px;
		border-radius: 3px;
		background-color: rgba(18, 183, 245, 0.14);
		font-size: 8.5px;
		font-weight: 600;
		color: #12b7f5;
	}

	.rank-sub {
		display: block;
		margin-top: 2px;
		font-size: 9.5px;
		color: var(--qq-text-3);
	}

	.rank-time {
		flex-shrink: 0;
		font-size: 10px;
		color: var(--qq-text-3);
	}

	.rank-tip {
		display: block;
		margin-top: 8px;
		text-align: center;
		font-size: 9.5px;
		color: var(--qq-text-4);
	}

	.checkin-footer {
		display: block;
		padding: 18px 0 6px;
		text-align: center;
		font-size: 10px;
		color: var(--qq-text-4);
	}
</style>
