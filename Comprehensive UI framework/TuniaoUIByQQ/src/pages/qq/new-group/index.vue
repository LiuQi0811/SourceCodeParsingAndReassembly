<script lang="ts" setup>
	import { computed, ref } from 'vue'
	import { onLoad } from '@dcloudio/uni-app'
	import { createGroup, qqStore } from '@/qq/store'
	import type { QQUser } from '@/qq/types'

	const keyword = ref('')
	const selectedIds = ref<string[]>([])
	const maxCount = 30

	const filtered = computed(() => {
		const key = keyword.value.trim().toLowerCase()
		if (!key) return qqStore.contacts
		return qqStore.contacts.filter((u) => u.name.toLowerCase().includes(key))
	})

	const selectedUsers = computed(() =>
		selectedIds.value.map((id) => qqStore.contacts.find((u) => u.id === id)).filter((u): u is QQUser => !!u)
	)

	function toggle(user: QQUser) {
		const index = selectedIds.value.indexOf(user.id)
		if (index > -1) {
			selectedIds.value.splice(index, 1)
			return
		}
		if (selectedIds.value.length >= maxCount) {
			uni.showToast({ title: `最多选择 ${maxCount} 人`, icon: 'none' })
			return
		}
		selectedIds.value.push(user.id)
	}

	function onDone() {
		if (!selectedIds.value.length) {
			uni.showToast({ title: '请至少选择一位好友', icon: 'none' })
			return
		}
		const convId = createGroup(selectedIds.value)
		if (!convId) return
		uni.redirectTo({ url: `/pages/qq/chat/index?id=${convId}` })
	}
</script>

<template>
	<view class="qq-page group-page">
		<qq-navbar title="创建群聊" bg="#F7F8FA">
			<template #right>
				<view class="group-done" :class="{ 'group-done--active': selectedIds.length }" @tap="onDone">
					完成{{ selectedIds.length ? `(${selectedIds.length})` : '' }}
				</view>
			</template>
		</qq-navbar>

		<!-- 搜索 -->
		<view class="group-search">
			<tn-icon name="search" size="14px" color="tn-grey" />
			<input
				v-model="keyword"
				class="group-search__input"
				placeholder="搜索好友"
				placeholder-class="group-placeholder"
			/>
		</view>

		<!-- 已选好友 -->
		<view v-if="selectedUsers.length" class="group-selected">
			<view class="group-selected__head">
				<text class="group-selected__title">已选择 {{ selectedIds.length }} 人</text>
				<text class="group-selected__clear" @tap="selectedIds = []">清空</text>
			</view>
			<view class="group-selected__list">
				<view
					v-for="user in selectedUsers"
					:key="user.id"
					class="group-selected__item"
					@tap="toggle(user)"
				>
					<qq-avatar :name="user.name" :from="user.avatarFrom" :to="user.avatarTo" :size="46" />
					<view class="group-selected__remove">
						<tn-icon name="close" size="8px" color="tn-white" />
					</view>
					<text class="group-selected__name">{{ user.name }}</text>
				</view>
			</view>
		</view>

		<!-- 好友列表 -->
		<view class="group-list">
			<view class="group-list__title">选择好友</view>
			<view
				v-for="user in filtered"
				:key="user.id"
				class="group-friend"
				@tap="toggle(user)"
			>
				<qq-avatar
					:name="user.name"
					:from="user.avatarFrom"
					:to="user.avatarTo"
					:size="44"
					:online="!!user.online"
				/>
				<view class="group-friend__main">
					<text class="group-friend__name">{{ user.name }}</text>
					<text class="group-friend__desc">{{ user.signature }}</text>
				</view>
				<view
					class="group-check"
					:class="{ 'group-check--on': selectedIds.includes(user.id) }"
				>
					<tn-icon v-if="selectedIds.includes(user.id)" name="check" size="12px" color="tn-white" />
				</view>
			</view>
			<view v-if="!filtered.length" class="group-empty">没有找到匹配的好友</view>
		</view>

		<view class="group-tip">创建后将自动进入群聊，可继续邀请好友</view>
	</view>
</template>

<style lang="scss" scoped>
	.group-page {
		padding-bottom: 24px;
	}

	.group-done {
		padding: 5px 12px;
		border-radius: 14px;
		background-color: var(--qq-card-2);
		color: var(--qq-text-3);
		font-size: 12.5px;
	}

	.group-done--active {
		background-color: var(--qq-blue-light);
		color: #12b7f5;
		font-weight: 600;
	}

	.group-search {
		display: flex;
		align-items: center;
		gap: 5px;
		height: 34px;
		margin: 8px 12px 0;
		padding: 0 10px;
		border-radius: 17px;
		background-color: var(--qq-card);
	}

	.group-search__input {
		flex: 1;
		height: 100%;
		font-size: 12.5px;
		color: var(--qq-text);
	}

	.group-placeholder {
		color: var(--qq-text-3);
		font-size: 12px;
	}

	.group-selected {
		padding: 12px 14px 4px;
		margin: 10px 12px 0;
		background-color: var(--qq-card);
		border-radius: 12px;
	}

	.group-selected__head {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.group-selected__title {
		font-size: 12px;
		color: var(--qq-text-2);
	}

	.group-selected__clear {
		font-size: 11px;
		color: #12b7f5;
	}

	.group-selected__list {
		display: flex;
		gap: 14px;
		margin-top: 10px;
		overflow-x: auto;
	}

	.group-selected__item {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 5px;
		flex-shrink: 0;
	}

	.group-selected__remove {
		position: absolute;
		top: -3px;
		right: -3px;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 16px;
		height: 16px;
		border-radius: 50%;
		background-color: rgba(250, 81, 81, 0.9);
		border: 1px solid #ffffff;
	}

	.group-selected__name {
		font-size: 10.5px;
		color: var(--qq-text-2);
	}

	.group-list {
		margin: 10px 12px 0;
		background-color: var(--qq-card);
		border-radius: 12px;
		overflow: hidden;
	}

	.group-list__title {
		padding: 12px 14px 6px;
		font-size: 12px;
		color: var(--qq-text-3);
	}

	.group-friend {
		display: flex;
		align-items: center;
		padding: 9px 14px;
	}

	.group-friend__main {
		flex: 1;
		min-width: 0;
		margin-left: 10px;
	}

	.group-friend__name {
		font-size: 14px;
		font-weight: 500;
		color: var(--qq-text);
	}

	.group-friend__desc {
		display: block;
		margin-top: 3px;
		font-size: 11px;
		color: var(--qq-text-3);
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
	}

	.group-check {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 20px;
		height: 20px;
		border-radius: 50%;
		border: 1.5px solid var(--qq-line-strong);
		background-color: var(--qq-card);
	}

	.group-check--on {
		background-color: #12b7f5;
		border-color: #12b7f5;
	}

	.group-empty {
		padding: 40px 0;
		text-align: center;
		font-size: 12px;
		color: var(--qq-text-3);
	}

	.group-tip {
		padding: 16px 0;
		text-align: center;
		font-size: 10.5px;
		color: var(--qq-text-4);
	}
</style>
