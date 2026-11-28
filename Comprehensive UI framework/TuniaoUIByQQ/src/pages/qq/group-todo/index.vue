<script lang="ts" setup>
	import { computed, ref } from 'vue'
	import { onLoad } from '@dcloudio/uni-app'
	import {
		addGroupTodo,
		findConversation,
		findUser,
		groupTodosOf,
		removeGroupTodo,
		sendGroupCard,
		toggleGroupTodo,
	} from '@/qq/store'
	import { goChatByConversation } from '@/qq/router'
	import type { QQGroupTodo } from '@/qq/types'

	const convId = ref('c3')
	const conv = computed(() => findConversation(convId.value))
	const todos = computed(() => groupTodosOf(convId.value))
	const filter = ref<'all' | 'todo' | 'done' | 'mine'>('all')
	const tabs = [
		{ key: 'all', label: '全部' },
		{ key: 'todo', label: '待完成' },
		{ key: 'done', label: '已完成' },
		{ key: 'mine', label: '我发起的' },
	] as const
	const createShow = ref(false)
	const loading = ref(true)
	const title = ref('')
	const dueOptions = ['今天 18:00', '明天 12:00', '周五 17:00']
	const due = ref(dueOptions[0])

	onLoad((options: any) => {
		convId.value = options?.id || 'c3'
		setTimeout(() => {
			loading.value = false
		}, 420)
	})

	const pendingCount = computed(() => todos.value.filter((t) => !t.joined).length)
	const doneCount = computed(() => todos.value.filter((t) => t.joined).length)
	const mineCount = computed(() => todos.value.filter((t) => t.creatorId === 'me').length)

	const shown = computed(() => {
		if (filter.value === 'todo') return todos.value.filter((t) => !t.joined)
		if (filter.value === 'done') return todos.value.filter((t) => t.joined)
		if (filter.value === 'mine') return todos.value.filter((t) => t.creatorId === 'me')
		return todos.value
	})

	const progressOf = (todo: QQGroupTodo) => {
		const total = conv.value?.members || 128
		return Math.min(100, Math.round((todo.doneCount / total) * 100))
	}

	const creatorName = (id: string) => (id === 'me' ? '我' : findUser(id).name)

	function selectFilter(key: string) {
		filter.value = key as typeof filter.value
	}

	function toggle(todo: QQGroupTodo) {
		const next = toggleGroupTodo(todo.id)
		uni.showToast({ title: next ? '已标记完成' : '已恢复为待完成', icon: 'none' })
	}

	function shareToChat(todo: QQGroupTodo) {
		sendGroupCard(convId.value, {
			kind: 'todo',
			refId: todo.id,
			title: todo.title,
			sub: `截止 ${todo.due} · ${todo.doneCount} 人已完成`,
			badge: '群待办',
		})
		uni.showModal({
			title: '已发送到群聊',
			content: '现在去群聊看看这张待办卡片吗？',
			confirmText: '去看看',
			cancelText: '留在本页',
			success: (res) => {
				if (res.confirm) setTimeout(() => goChatByConversation(convId.value), 220)
			},
		})
	}

	function openCreate() {
		title.value = ''
		due.value = dueOptions[0]
		createShow.value = true
	}

	function closeCreate() {
		createShow.value = false
	}

	function saveTodo() {
		if (!title.value.trim()) {
			uni.showToast({ title: '请填写待办内容', icon: 'none' })
			return
		}
		addGroupTodo(convId.value, title.value, due.value)
		createShow.value = false
		filter.value = 'all'
		uni.showToast({ title: '待办已发布', icon: 'none' })
	}

	function onMore(todo: QQGroupTodo) {
		uni.showActionSheet({
			itemList: ['删除待办'],
			success: (res) => {
				if (res.tapIndex !== 0) return
				removeGroupTodo(todo.id)
				uni.showToast({ title: '已删除待办', icon: 'none' })
			},
		})
	}

	const emptyText = computed(() => {
		if (filter.value === 'done') return '还没有完成的待办'
		if (filter.value === 'mine') return '我还没有发起过待办'
		if (filter.value === 'todo') return '当前没有待完成的待办'
		return '群里还没有待办'
	})
</script>

<template>
	<view class="qq-page todo-page">
		<qq-navbar title="群待办" bg="#F7F8FA">
			<template #right>
				<view class="todo-hd" @tap="openCreate">
					<tn-icon name="add" size="22px" color="tn-grey-dark" />
				</view>
			</template>
		</qq-navbar>

		<!-- 汇总 -->
		<view class="todo-hero">
			<view class="todo-hero__deco todo-hero__deco--a" />
			<view class="todo-hero__deco todo-hero__deco--b" />
			<view class="todo-hero__top">
				<view>
					<text class="todo-hero__eyebrow">群待办 · {{ conv ? conv.name : '群聊' }}</text>
					<text class="todo-hero__title">{{ pendingCount }} 项待完成</text>
				</view>
				<view class="todo-hero__icon">
					<tn-icon name="check" size="24px" color="#FFFFFF" />
				</view>
			</view>
			<view class="todo-hero__stats">
				<text class="todo-hero__stat">已完成 {{ doneCount }}</text>
				<text class="todo-hero__divider">·</text>
				<text class="todo-hero__stat">共 {{ todos.length }} 项</text>
				<text class="todo-hero__stat todo-hero__stat--right">我发起的 {{ mineCount }}</text>
			</view>
		</view>

		<!-- 筛选 -->
		<view class="todo-tabs">
			<view
				v-for="tab in tabs"
				:key="tab.key"
				class="todo-tab"
				:class="{ 'todo-tab--active': filter === tab.key }"
				@tap="selectFilter(tab.key)"
			>
				<text class="todo-tab__text">{{ tab.label }}</text>
			</view>
		</view>

		<!-- 列表 -->
		<qq-skeleton v-if="loading" variant="list" :rows="3" />
		<view v-else-if="shown.length" class="todo-list">
			<view
				v-for="todo in shown"
				:key="todo.id"
				class="todo-card"
				:class="{ 'todo-card--done': todo.joined }"
			>
				<view class="todo-card__check" :class="{ 'todo-card__check--on': todo.joined }" @tap="toggle(todo)">
					<tn-icon v-if="todo.joined" name="check" size="15px" color="#FFFFFF" />
				</view>
				<view class="todo-card__main">
					<view class="todo-card__top">
						<text class="todo-card__title">{{ todo.title }}</text>
						<view v-if="todo.creatorId === 'me'" class="todo-card__more" @tap="onMore(todo)">
							<tn-icon name="more-horizontal" size="17px" color="#9AA0A8" />
						</view>
					</view>
					<view class="todo-card__meta">
						<qq-avatar
							:name="creatorName(todo.creatorId)"
							:from="todo.creatorId === 'me' ? '#12B7F5' : findUser(todo.creatorId).avatarFrom"
							:to="todo.creatorId === 'me' ? '#4776E6' : findUser(todo.creatorId).avatarTo"
							:size="16"
						/>
						<text class="todo-card__meta-text">{{ creatorName(todo.creatorId) }} 发起</text>
						<text class="todo-card__dot">·</text>
						<text class="todo-card__due">截止 {{ todo.due }}</text>
					</view>
					<view class="todo-card__progress-row">
						<view class="todo-card__track">
							<view class="todo-card__bar" :style="{ width: `${progressOf(todo)}%` }" />
						</view>
						<text class="todo-card__count">{{ todo.doneCount }} 人已完成</text>
					</view>

					<view class="todo-card__share" @tap.stop="shareToChat(todo)">
						<tn-icon name="share-triangle" size="12px" color="#12B7F5" />
						<text>发到群聊</text>
					</view>
				</view>
			</view>
		</view>

		<!-- 空态 -->
		<qq-empty
			v-else
			icon="success-circle"
			:title="emptyText"
			sub="发起一个待办，让群里的事情有着落"
			action-text="发起待办"
			@action="openCreate"
		/>

		<text class="todo-footer">群待办为本地演示数据</text>

		<!-- 新建待办 -->
		<view v-if="createShow" class="todo-mask" @tap="closeCreate">
			<view class="todo-sheet" @tap.stop>
				<view class="todo-sheet__head">
					<text class="todo-sheet__title">发起群待办</text>
					<view class="todo-sheet__close" @tap="closeCreate">
						<tn-icon name="close" size="15px" color="#9AA0A8" />
					</view>
				</view>
				<text class="todo-sheet__label">待办内容</text>
				<textarea
					v-model="title"
					class="todo-sheet__input"
					maxlength="60"
					placeholder="例如：确认下周评审的最终排期"
					:adjust-position="true"
				/>
				<text class="todo-sheet__count">{{ title.length }} / 60</text>
				<text class="todo-sheet__label">截止时间</text>
				<view class="todo-sheet__dues">
					<view
						v-for="opt in dueOptions"
						:key="opt"
						class="todo-sheet__due"
						:class="{ 'todo-sheet__due--active': due === opt }"
						@tap="due = opt"
					>
						<text>{{ opt }}</text>
					</view>
				</view>
				<view class="todo-sheet__submit" @tap="saveTodo">
					<text>发布待办</text>
				</view>
				<text class="todo-sheet__tip">发布后会提醒群成员，可在列表中标记完成</text>
			</view>
		</view>
	</view>
</template>

<style lang="scss" scoped>
	.todo-page {
		min-height: 100vh;
		box-sizing: border-box;
		padding-bottom: calc(28px + env(safe-area-inset-bottom));
		background-color: var(--qq-card-2);
	}

	.todo-hd {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 34px;
		height: 34px;
	}

	.todo-hero {
		position: relative;
		margin: 6px 12px 0;
		padding: 16px;
		border-radius: 16px;
		background: linear-gradient(135deg, #12b7f5 0%, #4776e6 100%);
		overflow: hidden;
	}

	.todo-hero__deco {
		position: absolute;
		border-radius: 50%;
		background-color: rgba(255, 255, 255, 0.12);
	}

	.todo-hero__deco--a {
		right: -28px;
		top: -42px;
		width: 120px;
		height: 120px;
	}

	.todo-hero__deco--b {
		right: 36px;
		bottom: -52px;
		width: 86px;
		height: 86px;
		background-color: rgba(255, 255, 255, 0.08);
	}

	.todo-hero__top {
		position: relative;
		z-index: 1;
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
	}

	.todo-hero__eyebrow {
		display: block;
		font-size: 11px;
		color: rgba(255, 255, 255, 0.76);
	}

	.todo-hero__title {
		display: block;
		margin-top: 6px;
		font-size: 24px;
		font-weight: 700;
		color: #ffffff;
		letter-spacing: 0.5px;
	}

	.todo-hero__icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 44px;
		height: 44px;
		border-radius: 13px;
		background-color: rgba(255, 255, 255, 0.16);
	}

	.todo-hero__stats {
		position: relative;
		z-index: 1;
		display: flex;
		align-items: center;
		margin-top: 14px;
	}

	.todo-hero__stat {
		font-size: 11.5px;
		color: rgba(255, 255, 255, 0.88);
	}

	.todo-hero__stat--right {
		margin-left: auto;
	}

	.todo-hero__divider {
		margin: 0 6px;
		font-size: 11px;
		color: rgba(255, 255, 255, 0.55);
	}

	.todo-tabs {
		display: flex;
		align-items: center;
		gap: 8px;
		margin: 12px 12px 0;
	}

	.todo-tab {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 28px;
		padding: 0 13px;
		border-radius: 14px;
		background-color: var(--qq-card);
	}

	.todo-tab--active {
		background-color: var(--qq-blue-light);
	}

	.todo-tab__text {
		font-size: 11.5px;
		color: var(--qq-text-3);
	}

	.todo-tab--active .todo-tab__text {
		font-weight: 600;
		color: #12b7f5;
	}

	.todo-list {
		margin: 10px 12px 0;
	}

	.todo-card {
		display: flex;
		align-items: flex-start;
		margin-bottom: 9px;
		padding: 14px;
		border-radius: 14px;
		background-color: var(--qq-card);
	}

	.todo-card--done {
		opacity: 0.78;
	}

	.todo-card__check {
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		width: 22px;
		height: 22px;
		margin-top: 1px;
		border-radius: 50%;
		border: 1.5px solid var(--qq-line-strong);
		background-color: var(--qq-card);
	}

	.todo-card__check--on {
		border-color: #12b7f5;
		background-color: #12b7f5;
	}

	.todo-card__main {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-width: 0;
		margin-left: 11px;
	}

	.todo-card__top {
		display: flex;
		align-items: flex-start;
		gap: 6px;
	}

	.todo-card__title {
		flex: 1;
		font-size: 14px;
		font-weight: 500;
		line-height: 1.45;
		color: var(--qq-text);
	}

	.todo-card--done .todo-card__title {
		color: var(--qq-text-3);
		text-decoration: line-through;
	}

	.todo-card__more {
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		width: 22px;
		height: 22px;
	}

	.todo-card__meta {
		display: flex;
		align-items: center;
		margin-top: 8px;
	}

	.todo-card__meta-text,
	.todo-card__due,
	.todo-card__dot {
		font-size: 10.5px;
		color: var(--qq-text-3);
	}

	.todo-card__meta-text {
		margin-left: 5px;
	}

	.todo-card__dot {
		margin: 0 4px;
	}

	.todo-card__progress-row {
		display: flex;
		align-items: center;
		margin-top: 10px;
	}

	.todo-card__track {
		position: relative;
		flex: 1;
		height: 4px;
		border-radius: 2px;
		background-color: var(--qq-line);
		overflow: hidden;
	}

	.todo-card__bar {
		position: absolute;
		left: 0;
		top: 0;
		bottom: 0;
		border-radius: 2px;
		background: linear-gradient(90deg, #12b7f5, #4776e6);
		transition: width 0.35s ease;
	}

	.todo-card__count {
		flex-shrink: 0;
		margin-left: 9px;
		font-size: 10px;
		color: var(--qq-text-3);
	}

	.todo-card__share {
		display: flex;
		align-items: center;
		gap: 3px;
		margin-top: 8px;
		align-self: flex-end;
		padding: 3px 8px;
		border-radius: 10px;
		background-color: var(--qq-blue-light);
		font-size: 10px;
		font-weight: 500;
		color: #12b7f5;
	}

	.todo-empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 58px 24px 0;
	}

	.todo-empty__icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 64px;
		height: 64px;
		border-radius: 50%;
		background-color: var(--qq-card);
	}

	.todo-empty__text {
		margin-top: 14px;
		font-size: 14px;
		color: var(--qq-text-2);
	}

	.todo-empty__sub {
		margin-top: 6px;
		font-size: 11.5px;
		color: var(--qq-text-3);
	}

	.todo-empty__btn {
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

	.todo-footer {
		display: block;
		padding: 18px 0 6px;
		text-align: center;
		font-size: 10px;
		color: var(--qq-text-4);
	}

	.todo-mask {
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

	.todo-sheet {
		width: 100%;
		max-width: 430px;
		box-sizing: border-box;
		padding: 18px 16px calc(20px + env(safe-area-inset-bottom));
		border-radius: 18px 18px 0 0;
		background-color: var(--qq-card);
	}

	.todo-sheet__head {
		display: flex;
		align-items: center;
	}

	.todo-sheet__title {
		flex: 1;
		font-size: 16px;
		font-weight: 600;
		color: var(--qq-text);
	}

	.todo-sheet__close {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
	}

	.todo-sheet__label {
		display: block;
		margin-top: 16px;
		font-size: 11.5px;
		color: var(--qq-text-3);
	}

	.todo-sheet__input {
		width: 100%;
		height: 78px;
		box-sizing: border-box;
		margin-top: 8px;
		padding: 11px;
		border-radius: 10px;
		background-color: var(--qq-card-2);
		font-size: 13px;
		line-height: 1.5;
		color: var(--qq-text);
	}

	.todo-sheet__count {
		display: block;
		margin-top: 4px;
		text-align: right;
		font-size: 10px;
		color: var(--qq-text-4);
	}

	.todo-sheet__dues {
		display: flex;
		gap: 8px;
		margin-top: 8px;
	}

	.todo-sheet__due {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 30px;
		padding: 0 11px;
		border-radius: 8px;
		background-color: var(--qq-card-2);
		font-size: 11px;
		color: var(--qq-text-2);
	}

	.todo-sheet__due--active {
		background-color: var(--qq-blue-light);
		color: #12b7f5;
		font-weight: 600;
	}

	.todo-sheet__submit {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 44px;
		margin-top: 20px;
		border-radius: 12px;
		background: linear-gradient(135deg, #18c0ff 0%, #0a9ed8 100%);
		color: #ffffff;
		font-size: 15px;
		font-weight: 600;
	}

	.todo-sheet__tip {
		display: block;
		margin-top: 10px;
		text-align: center;
		font-size: 10px;
		color: var(--qq-text-4);
	}

	@media (max-width: 380px) {
		.todo-hero {
			margin: 6px 10px 0;
			padding: 13px;
		}

		.todo-hero__title {
			font-size: 21px;
		}

		.todo-tabs,
		.todo-list {
			margin-left: 10px;
			margin-right: 10px;
		}

		.todo-card {
			padding: 12px;
		}
	}
</style>
