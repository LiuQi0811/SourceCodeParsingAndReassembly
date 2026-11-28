<script lang="ts" setup>
	import { computed, ref } from 'vue'
	import { onLoad } from '@dcloudio/uni-app'
	import { qqStore } from '@/qq/store'
	import { goBack, goChatByConversation, goUserDetail } from '@/qq/router'
	import type { QQConversation, QQUser } from '@/qq/types'

	const keyword = ref('')
	const history = ref<string[]>(['林嘉禾', '产品设计组', '咖啡'])
	const hotList = ref([
		{ text: 'TuniaoUI 组件库', hot: true },
		{ text: '周末看展', hot: true },
		{ text: '前端小分队', hot: false },
		{ text: 'SVIP 个性装扮', hot: false },
		{ text: '徐州天气', hot: false },
		{ text: '摄影研究所频道', hot: false },
	])

	onLoad(() => {
		// 搜索页自动聚焦在 H5 端由 input 的 focus 属性处理
	})

	const trimmed = computed(() => keyword.value.trim())

	const userResults = computed<QQUser[]>(() => {
		if (!trimmed.value) return []
		const key = trimmed.value.toLowerCase()
		return qqStore.contacts.filter(
			(u) =>
				u.name.toLowerCase().includes(key) ||
				u.qq.includes(key) ||
				(u.signature || '').toLowerCase().includes(key)
		)
	})

	const convResults = computed<QQConversation[]>(() => {
		if (!trimmed.value) return []
		const key = trimmed.value.toLowerCase()
		return qqStore.conversations.filter(
			(c) => c.name.toLowerCase().includes(key) || c.lastMessage.toLowerCase().includes(key)
		)
	})

	const hasResult = computed(() => userResults.value.length + convResults.value.length > 0)

	function applyHot(text: string) {
		keyword.value = text
	}

	function clearHistory() {
		history.value = []
	}

	function openUser(user: QQUser) {
		if (trimmed.value) {
			history.value = [trimmed.value, ...history.value.filter((h) => h !== trimmed.value)].slice(0, 6)
		}
		goUserDetail(user.id)
	}

	function openConv(conv: QQConversation) {
		if (trimmed.value) {
			history.value = [trimmed.value, ...history.value.filter((h) => h !== trimmed.value)].slice(0, 6)
		}
		goChatByConversation(conv.id)
	}

	function onCancel() {
		goBack()
	}
</script>

<template>
	<view class="qq-page search-page">
		<!-- 搜索头部 -->
		<view class="search-header">
			<view class="search-bar">
				<view class="search-bar__back" @tap="onCancel">
					<tn-icon name="left" size="20px" color="tn-grey-dark" />
				</view>
				<view class="search-field">
					<tn-icon name="search" size="15px" color="tn-grey" />
					<input
						v-model="keyword"
						class="search-input"
						:focus="true"
						placeholder="搜索联系人、群聊、聊天记录"
						placeholder-class="search-placeholder"
						confirm-type="search"
					/>
					<view v-if="keyword" class="search-clear" @tap="keyword = ''">
						<tn-icon name="close-circle" size="15px" color="#C9CDD4" />
					</view>
				</view>
				<text class="search-cancel" @tap="onCancel">取消</text>
			</view>
		</view>

		<!-- 结果 -->
		<view v-if="trimmed" class="search-results">
			<view v-if="userResults.length" class="search-section">
				<view class="search-section__title">联系人</view>
				<view class="result-card">
					<view
						v-for="user in userResults"
						:key="user.id"
						class="result-row"
						@tap="openUser(user)"
					>
						<qq-avatar
							:name="user.name"
							:from="user.avatarFrom"
							:to="user.avatarTo"
							:size="40"
							:online="!!user.online"
						/>
						<view class="result-row__main">
							<text class="result-row__name">{{ user.name }}</text>
							<text class="result-row__desc">QQ {{ user.qq }} · {{ user.signature }}</text>
						</view>
						<tn-icon name="right" size="13px" color="#C9CDD4" />
					</view>
				</view>
			</view>

			<view v-if="convResults.length" class="search-section">
				<view class="search-section__title">聊天记录</view>
				<view class="result-card">
					<view
						v-for="conv in convResults"
						:key="conv.id"
						class="result-row"
						@tap="openConv(conv)"
					>
						<qq-avatar
							:name="conv.name"
							:from="conv.avatarFrom"
							:to="conv.avatarTo"
							:group="conv.type === 'group'"
							:size="40"
						/>
						<view class="result-row__main">
							<text class="result-row__name">{{ conv.name }}</text>
							<text class="result-row__desc">{{ conv.lastMessage }}</text>
						</view>
						<text class="result-row__time">{{ conv.time }}</text>
					</view>
				</view>
			</view>

			<view v-if="!hasResult" class="search-empty">
				<tn-empty mode="search" show-tips>
					<template #tips>没有找到「{{ trimmed }}」相关内容</template>
				</tn-empty>
			</view>
		</view>

		<!-- 空态：历史 / 热门 -->
		<view v-else class="search-home">
			<view v-if="history.length" class="search-block">
				<view class="search-block__head">
					<text class="search-block__title">搜索历史</text>
					<view class="search-block__action" @tap="clearHistory">
						<tn-icon name="delete" size="15px" color="#A6AAB2" />
					</view>
				</view>
				<view class="history-tags">
					<view
						v-for="item in history"
						:key="item"
						class="history-tag"
						@tap="applyHot(item)"
					>
						{{ item }}
					</view>
				</view>
			</view>

			<view class="search-block">
				<view class="search-block__head">
					<text class="search-block__title">热门搜索</text>
					<text class="search-block__hint">实时热度</text>
				</view>
				<view class="hot-list">
					<view
						v-for="(item, index) in hotList"
						:key="item.text"
						class="hot-row"
						@tap="applyHot(item.text)"
					>
						<text
							class="hot-row__index"
							:class="{
								'hot-row__index--top': index < 3,
								'hot-row__index--first': index === 0,
							}"
						>
							{{ index + 1 }}
						</text>
						<text class="hot-row__text">{{ item.text }}</text>
						<text v-if="item.hot" class="hot-row__flag">热</text>
					</view>
				</view>
			</view>
		</view>
	</view>
</template>

<style lang="scss" scoped>
	.search-page {
		background-color: var(--qq-bg);
		padding-bottom: 20px;
	}

	.search-header {
		position: sticky;
		top: 0;
		z-index: 20;
		padding: 6px 12px 8px;
		background-color: var(--qq-card);
	}

	.search-bar {
		display: flex;
		align-items: center;
		gap: 6px;
		height: 44px;
	}

	.search-bar__back {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 26px;
		height: 30px;
	}

	.search-field {
		flex: 1;
		display: flex;
		align-items: center;
		gap: 5px;
		height: 34px;
		padding: 0 10px;
		border-radius: 17px;
		background-color: var(--qq-bg);
	}

	.search-input {
		flex: 1;
		height: 100%;
		font-size: 13px;
		color: var(--qq-text);
	}

	.search-placeholder {
		color: var(--qq-text-3);
		font-size: 12.5px;
	}

	.search-clear {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 22px;
		height: 22px;
	}

	.search-cancel {
		font-size: 13px;
		color: #12b7f5;
	}

	.search-results {
		padding: 10px 12px 0;
	}

	.search-section {
		margin-bottom: 12px;
	}

	.search-section__title {
		padding: 4px 4px 8px;
		font-size: 11.5px;
		color: var(--qq-text-3);
	}

	.result-card {
		background-color: var(--qq-card);
		border-radius: 12px;
		overflow: hidden;
	}

	.result-row {
		display: flex;
		align-items: center;
		padding: 10px 12px;
		border-bottom: 1px solid var(--qq-line);
	}

	.result-row:last-child {
		border-bottom: none;
	}

	.result-row__main {
		flex: 1;
		min-width: 0;
		margin-left: 10px;
	}

	.result-row__name {
		font-size: 14px;
		font-weight: 500;
		color: var(--qq-text);
	}

	.result-row__desc {
		display: block;
		margin-top: 3px;
		font-size: 11.5px;
		color: var(--qq-text-3);
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
	}

	.result-row__time {
		margin-left: 8px;
		font-size: 10.5px;
		color: var(--qq-text-3);
	}

	.search-empty {
		padding: 60px 0;
	}

	.search-home {
		padding: 10px 12px 0;
	}

	.search-block {
		margin-bottom: 12px;
		padding: 12px 14px;
		background-color: var(--qq-card);
		border-radius: 12px;
	}

	.search-block__head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 10px;
	}

	.search-block__title {
		font-size: 13px;
		font-weight: 600;
		color: var(--qq-text);
	}

	.search-block__action {
		padding: 2px;
	}

	.search-block__hint {
		font-size: 10.5px;
		color: var(--qq-text-4);
	}

	.history-tags {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}

	.history-tag {
		max-width: 100%;
		padding: 6px 12px;
		border-radius: 15px;
		background-color: var(--qq-card-2);
		font-size: 11.5px;
		color: var(--qq-text-2);
	}

	.hot-list {
		display: flex;
		flex-direction: column;
	}

	.hot-row {
		display: flex;
		align-items: center;
		height: 38px;
	}

	.hot-row__index {
		width: 20px;
		font-size: 12px;
		font-weight: 600;
		color: var(--qq-text-4);
	}

	.hot-row__index--top {
		color: #ff8a3d;
	}

	.hot-row__index--first {
		color: #fa5151;
	}

	.hot-row__text {
		flex: 1;
		font-size: 13px;
		color: var(--qq-text);
	}

	.hot-row__flag {
		padding: 1px 5px;
		border-radius: 4px;
		background-color: #ffece6;
		color: #ff7043;
		font-size: 9px;
	}
</style>
