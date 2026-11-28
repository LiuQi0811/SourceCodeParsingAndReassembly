<script lang="ts" setup>
	import { computed, ref } from 'vue'
	import { onLoad } from '@dcloudio/uni-app'
	import { qqStore, pendingFriendCount, totalContacts } from '@/qq/store'
	import { goNewFriends, goNewGroup, goSearch, goTab, goUserDetail } from '@/qq/router'
	import type { QQUser } from '@/qq/types'

	const statusBarHeight = ref(0)
	const windowHeight = ref(700)

	onLoad(() => {
		try {
			const sys = uni.getSystemInfoSync()
			statusBarHeight.value = sys.statusBarHeight || 0
			windowHeight.value = sys.windowHeight || 700
		} catch (e) {
			statusBarHeight.value = 0
		}
	})

	const topPad = computed(() => (statusBarHeight.value ? statusBarHeight.value : 8))
	const activeTag = ref('')

	const allTags = computed(() =>
		Array.from(
			new Set(qqStore.contacts.flatMap((contact) => contact.tags || []))
		)
	)

	const visibleContacts = computed(() => {
		if (!activeTag.value) return qqStore.contacts
		return qqStore.contacts.filter((contact) => contact.tags?.includes(activeTag.value))
	})

	/** 索引列表高度 = 可视高度 - 顶部总占用（标题栏 + 搜索 + 快捷入口 + 分组标题 + 标签行 + Tabbar） */
	const listHeight = computed(() => {
		const reserved = topPad.value + 44 + 40 + 99 + 35 + 38 + 54 + 10
		return Math.max(320, windowHeight.value - reserved)
	})

	// 组件需要的是 { 字母: { title, data } } 结构，这样右侧索引栏才是字母
	const indexedData = computed(() => {
		const map: Record<string, { title: string; data: QQUser[] }> = {}
		visibleContacts.value.forEach((contact) => {
			const key = contact.index || '#'
			if (!map[key]) map[key] = { title: key, data: [] }
			map[key].data.push(contact)
		})
		return Object.keys(map)
			.sort()
			.reduce((acc, key) => {
				acc[key] = map[key]
				return acc
			}, {} as Record<string, { title: string; data: QQUser[] }>)
	})

	const quickEntries = computed(() => [
		{ key: 'new', label: '新朋友', icon: 'my-add', color: '#12B7F5', badge: pendingFriendCount.value },
		{ key: 'group', label: '群聊', icon: 'team', color: '#32C48D', badge: 0 },
		{ key: 'channel', label: '频道', icon: 'discover-planet', color: '#8E54E9', badge: 0 },
		{ key: 'official', label: '公众号', icon: 'message', color: '#FF9F1C', badge: 2 },
	])

	function onQuick(key: string) {
		if (key === 'new') return goNewFriends()
		if (key === 'group') return goNewGroup()
		if (key === 'channel') return goTab('channel')
		uni.showToast({ title: '演示：公众号列表', icon: 'none' })
	}

	function openUser(user: QQUser) {
		goUserDetail(user.id)
	}
</script>

<template>
	<view class="qq-page qq-page--tab contact-page">
		<!-- 顶部标题 -->
		<view class="contact-header">
			<view :style="{ height: `${topPad}px` }" />
			<view class="contact-header__bar">
				<text class="contact-header__title">联系人</text>
				<view class="contact-header__actions">
					<view class="contact-header__icon" @tap="goSearch">
						<tn-icon name="search" size="19px" color="tn-grey-dark" />
					</view>
					<view class="contact-header__icon" @tap="goNewGroup">
						<tn-icon name="add" size="21px" color="tn-grey-dark" />
					</view>
				</view>
			</view>
			<view class="contact-search" @tap="goSearch">
				<tn-icon name="search" size="14px" color="tn-grey" />
				<text class="contact-search__text">搜索好友、群聊、聊天记录</text>
			</view>
		</view>

		<!-- 快捷入口 -->
		<view class="quick-card">
			<view
				v-for="entry in quickEntries"
				:key="entry.key"
				class="quick-card__item"
				@tap="onQuick(entry.key)"
			>
				<view class="quick-card__icon" :style="{ backgroundColor: `${entry.color}18` }">
					<tn-icon :name="entry.icon" size="22px" :color="entry.color" />
					<view v-if="entry.badge" class="qq-badge quick-card__badge">{{ entry.badge }}</view>
				</view>
				<text class="quick-card__label">{{ entry.label }}</text>
			</view>
		</view>

		<!-- 好友列表（字母索引） -->
		<view class="contact-list">
			<view class="contact-list__title">
				<text class="contact-list__label">我的好友</text>
				<text class="contact-list__count">
					{{ activeTag ? `${visibleContacts.length} / ${totalContacts} 位` : `共 ${totalContacts} 位` }}
				</text>
			</view>

			<scroll-view class="contact-tags" scroll-x :show-scrollbar="false">
				<view class="contact-tags__inner">
					<view
						class="contact-tag"
						:class="{ 'contact-tag--active': !activeTag }"
						@tap="activeTag = ''"
					>
						全部
					</view>
					<view
						v-for="tag in allTags"
						:key="tag"
						class="contact-tag"
						:class="{ 'contact-tag--active': activeTag === tag }"
						@tap="activeTag = activeTag === tag ? '' : tag"
					>
						{{ tag }}
					</view>
				</view>
			</scroll-view>

			<tn-index-list
				v-if="visibleContacts.length"
				:data="indexedData"
				:height="listHeight"
				:sticky-offset-top="0"
				title-bg-color="#F7F8FA"
				show-keys-list
			>
				<template #default="{ data }">
					<view class="friend" @tap="openUser(data)">
						<qq-avatar
							:name="data.name"
							:from="data.avatarFrom"
							:to="data.avatarTo"
							:size="42"
							:online="!!data.online"
						/>
						<view class="friend__main">
							<view class="friend__name-row">
								<text class="friend__name">{{ data.remark || data.name }}</text>
								<text v-if="data.vip" class="qq-vip">SVIP</text>
							</view>
							<text class="friend__desc">{{ data.signature }}</text>
						</view>
						<tn-icon name="right" size="14px" color="#C9CDD4" />
					</view>
				</template>
			</tn-index-list>
			<view v-else class="contact-empty">
				<text class="contact-empty__title">这个标签下还没有好友</text>
				<text class="contact-empty__desc">换一个标签，或点「全部」查看所有联系人</text>
			</view>
		</view>

		<qq-tabbar active="contact" />
	</view>
</template>

<style lang="scss" scoped>
	.contact-page {
		display: flex;
		flex-direction: column;
		height: 100vh;
		box-sizing: border-box;
		overflow: hidden;
	}

	.contact-header {
		flex-shrink: 0;
		z-index: 20;
		background-color: var(--qq-card-2);
	}

	.contact-header__bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		height: 44px;
		padding: 0 14px;
	}

	.contact-header__title {
		font-size: 19px;
		font-weight: 700;
		color: var(--qq-text);
	}

	.contact-header__actions {
		display: flex;
		align-items: center;
		gap: 4px;
	}

	.contact-header__icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		border-radius: 50%;
	}

	.contact-search {
		display: flex;
		align-items: center;
		gap: 5px;
		height: 32px;
		margin: 0 14px 8px;
		padding: 0 10px;
		border-radius: 16px;
		background-color: var(--qq-card);
	}

	.contact-search__text {
		font-size: 12.5px;
		color: var(--qq-text-3);
	}

	.quick-card {
		flex-shrink: 0;
		display: flex;
		margin: 4px 12px 0;
		padding: 14px 4px;
		background-color: var(--qq-card);
		border-radius: 12px;
	}

	.quick-card__item {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 7px;
	}

	.quick-card__icon {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 44px;
		height: 44px;
		border-radius: 12px;
	}

	.quick-card__badge {
		position: absolute;
		top: -5px;
		right: -5px;
		transform: scale(0.9);
	}

	.quick-card__label {
		font-size: 11.5px;
		line-height: 1;
		color: var(--qq-text-2);
	}

	.contact-list {
		flex: 1;
		display: flex;
		flex-direction: column;
		min-height: 0;
		margin: 10px 12px 8px;
		background-color: var(--qq-card);
		border-radius: 12px;
		overflow: hidden;
	}

	/* 修正组件右侧索引栏：贴卡片内缘、居中、避开箭头 */
	.contact-list :deep(.tn-index-list__key-list) {
		right: 4px;
		transform: translateY(-50%);
		padding: 4px 2px;
		border-radius: 8px;
		background-color: rgba(18, 183, 245, 0.08);
	}

	.contact-list :deep(.tn-index-list__key-list-value) {
		padding: 2px 0;
		font-size: 10.5px;
		line-height: 1.2;
		color: var(--qq-text-3);
	}

	.contact-list__title {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 12px 14px 8px;
	}

	.contact-list__label {
		font-size: 13px;
		font-weight: 600;
		color: var(--qq-text);
	}

	.contact-list__count {
		font-size: 11px;
		color: var(--qq-text-3);
	}

	.contact-tags {
		flex-shrink: 0;
		width: 100%;
		height: 34px;
		margin-bottom: 4px;
		white-space: nowrap;
	}

	.contact-tags__inner {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 0 14px;
	}

	.contact-tag {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		height: 24px;
		padding: 0 10px;
		border-radius: 12px;
		background-color: var(--qq-card-2);
		box-sizing: border-box;
		flex-shrink: 0;
		white-space: nowrap;
		font-size: 10.5px;
		color: var(--qq-text-3);
	}

	.contact-tag--active {
		background-color: rgba(18, 183, 245, 0.12);
		color: #12b7f5;
		font-weight: 600;
	}

	.contact-empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 6px;
		height: 180px;
		color: var(--qq-text-2);
	}

	.contact-empty__title {
		font-size: 13px;
		font-weight: 600;
	}

	.contact-empty__desc {
		font-size: 11.5px;
		color: var(--qq-text-3);
	}

	.friend {
		display: flex;
		align-items: center;
		padding: 9px 34px 9px 14px;
		background-color: var(--qq-card);
	}

	.friend__main {
		flex: 1;
		min-width: 0;
		margin-left: 10px;
	}

	.friend__name-row {
		display: flex;
		align-items: center;
	}

	.friend__name {
		font-size: 14px;
		font-weight: 500;
		color: var(--qq-text);
	}

	.friend__desc {
		display: block;
		margin-top: 3px;
		font-size: 11.5px;
		color: var(--qq-text-3);
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
	}
</style>
