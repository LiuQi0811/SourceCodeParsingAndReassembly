<script lang="ts" setup>
	import { computed, ref } from 'vue'
	import { onLoad } from '@dcloudio/uni-app'
	import { findConversation, getMessages, setChatFocus } from '@/qq/store'
	import type { QQMessage } from '@/qq/types'

	const convId = ref('c3')
	const keyword = ref('')
	const type = ref<'all' | 'text' | 'image' | 'file' | 'voice' | 'system'>('all')

	onLoad((options: any) => {
		convId.value = options?.id || 'c3'
	})

	const conv = computed(() => findConversation(convId.value))

	type HistoryMessage = QQMessage & { day?: string }

	/** 演示用历史记录（聊天页只展示最近几条，这里补一段“更早”的记录便于搜索） */
	const archive: Record<string, HistoryMessage[]> = {
		c3: [
			{ id: 'h1', convId: 'c3', senderId: 'u_linjiahe', senderName: '林嘉禾', type: 'text', text: '周五的需求评审材料大家提前过一遍，重点看交互稿。', time: '18:40', day: '昨天' },
			{ id: 'h2', convId: 'c3', senderId: 'u_suwan', senderName: '苏晚', type: 'text', text: '设计稿 v3 已经更新，主要调整了消息页的层级和 tab 图标。', time: '17:26', day: '昨天' },
			{ id: 'h3', convId: 'c3', senderId: 'u_chenyu', senderName: '陈屿', type: 'file', text: '需求评审-初稿.pdf', time: '16:02', day: '昨天' },
			{ id: 'h4', convId: 'c3', senderId: 'u_xujiashu', senderName: '许嘉树', type: 'image', image: '/static/qq/m2.jpg', text: '', time: '15:48', day: '昨天' },
			{ id: 'h5', convId: 'c3', senderId: 'u_zhengyinuo', senderName: '郑一诺', type: 'text', text: '接口联调说明我放到群文件了，字段变更以文档为准。', time: '14:10', day: '昨天' },
			{ id: 'h6', convId: 'c3', senderId: 'u_linjiahe', senderName: '林嘉禾', type: 'text', text: '下周一开始灰度上线，先把消息未读联动的问题收敛掉。', time: '11:35', day: '周一' },
			{ id: 'h7', convId: 'c3', senderId: 'u_suwan', senderName: '苏晚', type: 'voice', duration: 18, text: '', time: '10:20', day: '周一' },
			{ id: 'h8', convId: 'c3', senderId: 'u_wangyan', senderName: '王砚', type: 'text', text: '会议室 A 周五下午被占用了，改到 3F 大会议室可以吗？', time: '09:48', day: '周一' },
			{ id: 'h9', convId: 'c3', senderId: 'u_linjiahe', senderName: '林嘉禾', type: 'text', text: '可以，评审时间不变，地点改 3F 会议室。', time: '09:52', day: '周一' },
		],
		c5: [
			{ id: 'h21', convId: 'c5', senderId: 'u_xujiashu', senderName: '许嘉树', type: 'text', text: '周报模板更新了，大家在群文件里取最新版。', time: '19:30', day: '昨天' },
			{ id: 'h22', convId: 'c5', senderId: 'u_zhengyinuo', senderName: '郑一诺', type: 'file', text: '前端小分队-第46周周报.docx', time: '18:22', day: '昨天' },
			{ id: 'h23', convId: 'c5', senderId: 'u_suwan', senderName: '苏晚', type: 'text', text: '新的 tabbar 图标已经切好，记得替换 svg。', time: '11:06', day: '周二' },
			{ id: 'h24', convId: 'c5', senderId: 'u_linjiahe', senderName: '林嘉禾', type: 'text', text: '设计稿评审通过了，按新规范下周上线灰度。', time: '10:18', day: '周二' },
		],
	}

	const allMessages = computed<HistoryMessage[]>(() => {
		const recent = getMessages(convId.value) as HistoryMessage[]
		const oldList = archive[convId.value] || []
		const old = oldList.filter((item) => !recent.some((msg) => msg.id === item.id))
		const historyIndex = new Map(oldList.map((item, index) => [item.id, index]))
		return [...old, ...recent].sort((a, b) => {
			const ai = historyIndex.get(a.id)
			const bi = historyIndex.get(b.id)
			return (ai === undefined ? Number.MAX_SAFE_INTEGER : ai) -
				(bi === undefined ? Number.MAX_SAFE_INTEGER : bi)
		})
	})

	const typeOptions = [
		{ key: 'all', label: '全部' },
		{ key: 'text', label: '文本' },
		{ key: 'image', label: '图片' },
		{ key: 'file', label: '文件' },
		{ key: 'voice', label: '语音' },
	] as const

	const typeCount = (key: string) =>
		key === 'all' ? allMessages.value.length : allMessages.value.filter((m) => m.type === key).length

	const kw = computed(() => keyword.value.trim())

	const results = computed(() => {
		let list = allMessages.value
		if (type.value !== 'all') list = list.filter((m) => m.type === type.value)
		if (kw.value) {
			list = list.filter((m) => searchLabel(m).toLowerCase().includes(kw.value.toLowerCase()))
		}
		return list
	})

	function typeName(m: HistoryMessage) {
		if (m.type === 'image') return '[图片]'
		if (m.type === 'voice') return `[语音] ${m.duration || 0}″`
		if (m.type === 'video') return `[视频] ${m.text || ''}`.trim()
		if (m.type === 'file') return `[文件] ${m.text || ''}`
		if (m.type === 'redpacket') return `[红包] ${m.payment?.note || '恭喜发财'}`
		if (m.type === 'transfer') return `[转账] ¥${(m.payment?.amount || 0).toFixed(2)}`
		if (m.type === 'group-card' && m.card) {
			const label =
				m.card.kind === 'todo' ? '群待办' : m.card.kind === 'vote' ? '群投票' : '群签到'
			return `[${label}] ${m.card.title}`
		}
		if (m.type === 'system') return '[系统消息]'
		return m.text || ''
	}

	function searchLabel(m: HistoryMessage) {
		return `${typeName(m)} ${m.text || ''}`.trim()
	}

	function parts(text: string) {
		const q = kw.value
		if (!q) return [{ text, hit: false }]
		const out: { text: string; hit: boolean }[] = []
		let rest = text
		while (rest) {
			const idx = rest.toLowerCase().indexOf(q.toLowerCase())
			if (idx < 0) {
				out.push({ text: rest, hit: false })
				break
			}
			if (idx > 0) out.push({ text: rest.slice(0, idx), hit: false })
			out.push({ text: rest.slice(idx, idx + q.length), hit: true })
			rest = rest.slice(idx + q.length)
		}
		return out
	}

	function onHot(word: string) {
		keyword.value = word
	}

	function onResult(m: HistoryMessage) {
		const list = getMessages(convId.value)
		if (!list.some((item) => item.id === m.id)) {
			// 更早的历史记录被点开时，按它在历史列表里的顺序补进当前会话
			const historyIndex = allMessages.value.findIndex((item) => item.id === m.id)
			let insertAt = list.length
			for (let i = 0; i < list.length; i++) {
				const currentIndex = allMessages.value.findIndex((item) => item.id === list[i].id)
				if (currentIndex > historyIndex) {
					insertAt = i
					break
				}
			}
			list.splice(insertAt, 0, { ...m })
		}
		setChatFocus(convId.value, m.id)
		const pages = getCurrentPages() as any[]
		const prev = pages[pages.length - 2]
		if (prev?.route?.includes('/pages/qq/chat/index')) {
			uni.navigateBack()
		} else {
			uni.redirectTo({ url: `/pages/qq/chat/index?id=${convId.value}` })
		}
	}
</script>

<template>
	<view class="qq-page history-page">
		<qq-navbar title="聊天记录" :subtitle="conv?.name || ''" bg="#F7F8FA" />

		<view class="history-search">
			<view class="history-search__box">
				<tn-icon name="search" size="15px" color="#9AA0A8" />
				<input
					v-model="keyword"
					class="history-search__input"
					type="text"
					placeholder="搜索聊天记录"
					placeholder-class="history-search__ph"
					confirm-type="search"
				/>
				<view v-if="keyword" class="history-search__clear" @tap="keyword = ''">
					<tn-icon name="close-circle" size="15px" color="#C2C6CC" />
				</view>
			</view>
		</view>

		<view class="history-types">
			<view
				v-for="opt in typeOptions"
				:key="opt.key"
				class="history-type"
				:class="{ 'history-type--on': type === opt.key }"
				@tap="type = opt.key"
			>
				<text class="history-type__label">{{ opt.label }}</text>
				<text class="history-type__count">{{ typeCount(opt.key) }}</text>
			</view>
		</view>

		<view v-if="!kw" class="history-hint">
			<view class="history-hint__icon">
				<tn-icon name="search" size="26px" color="#C2C6CC" />
			</view>
			<text class="history-hint__title">查找聊天记录</text>
			<text class="history-hint__desc">按关键词搜索文字、文件与图片描述，或按类型筛选</text>
			<view class="history-hot">
				<text class="history-hot__label">常用搜索</text>
				<view class="history-hot__tags">
					<text v-for="w in ['评审', '设计稿', '群文件', '上线', '会议室']" :key="w" class="history-hot__tag" @tap="onHot(w)">{{ w }}</text>
				</view>
			</view>
		</view>

		<view v-else class="history-results">
			<view class="history-results__head">
				<text class="history-results__title">“{{ kw }}” 的相关记录</text>
				<text class="history-results__count">{{ results.length }} 条</text>
			</view>

			<view v-if="results.length" class="history-list">
				<view v-for="m in results" :key="m.id" class="history-item" @tap="onResult(m)">
					<view class="history-item__top">
						<qq-avatar
							:name="m.senderName || (m.type === 'system' ? '系统' : '我')"
							:from="m.type === 'system' ? '#8A9099' : '#5B8DEF'"
							:to="m.type === 'system' ? '#6F757D' : '#3560D4'"
							:size="30"
						/>
						<text class="history-item__name">{{ m.senderName || (m.type === 'system' ? '系统消息' : '我') }}</text>
						<text class="history-item__time">{{ m.day ? `${m.day} ` : '' }}{{ m.time }}</text>
					</view>
					<view class="history-item__body">
						<template v-if="m.type === 'image'">
							<image class="history-item__thumb" :src="m.image" mode="aspectFill" />
							<text class="history-item__text">[图片]</text>
						</template>
						<template v-else-if="m.type === 'voice'">
							<tn-icon name="microphone" size="13px" color="#12B7F5" />
							<text class="history-item__text">[语音] {{ m.duration }}″</text>
						</template>
						<template v-else-if="m.type === 'file'">
							<tn-icon name="folder" size="13px" color="#4776E6" />
							<text class="history-item__text">{{ typeName(m) }}</text>
						</template>
						<template v-else-if="m.type === 'video'">
							<tn-icon name="video" size="13px" color="#8E54E9" />
							<text class="history-item__text">{{ typeName(m) }}</text>
						</template>
						<template v-else-if="m.type === 'redpacket' || m.type === 'transfer'">
							<tn-icon
								:name="m.type === 'redpacket' ? 'lucky-money' : 'transfer-circle'"
								size="13px"
								:color="m.type === 'redpacket' ? '#F5576C' : '#F0A020'"
							/>
							<text class="history-item__text">{{ typeName(m) }}</text>
						</template>
						<template v-else-if="m.type === 'group-card'">
							<tn-icon name="success-circle" size="13px" color="#12B7F5" />
							<text class="history-item__text">{{ typeName(m) }}</text>
						</template>
						<template v-else>
							<text class="history-item__text history-item__text--multi">
								<text v-for="(p, i) in parts(m.text || '')" :key="i" :class="{ 'history-hit': p.hit }">{{ p.text }}</text>
							</text>
						</template>
					</view>
					<text class="history-item__from">{{ conv?.name }}</text>
				</view>
			</view>

			<view v-else class="history-empty">
				<tn-icon name="search" size="30px" color="#C2C6CC" />
				<text class="history-empty__text">没有找到相关记录，换个关键词试试</text>
			</view>
		</view>
	</view>
</template>

<style lang="scss" scoped>
	.history-page {
		min-height: 100vh;
		padding-bottom: 24px;
	}

	.history-search {
		padding: 4px 12px 8px;
		background-color: var(--qq-bg);
	}

	.history-search__box {
		display: flex;
		align-items: center;
		height: 34px;
		padding: 0 10px;
		border-radius: 8px;
		background-color: var(--qq-card);
	}

	.history-search__input {
		flex: 1;
		height: 100%;
		margin-left: 6px;
		font-size: 13px;
		color: var(--qq-text);
	}

	.history-search__ph {
		font-size: 12px;
		color: var(--qq-text-4);
	}

	.history-search__clear {
		padding-left: 6px;
	}

	.history-types {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 0 12px 10px;
	}

	.history-type {
		display: flex;
		align-items: center;
		gap: 3px;
		padding: 4px 9px;
		border-radius: 11px;
		background-color: var(--qq-card);
		border: 1px solid transparent;
	}

	.history-type--on {
		background-color: rgba(18, 183, 245, 0.1);
		border-color: rgba(18, 183, 245, 0.35);
	}

	.history-type__label {
		font-size: 11px;
		color: var(--qq-text-3);
	}

	.history-type__count {
		font-size: 9px;
		color: var(--qq-text-4);
	}

	.history-type--on .history-type__label,
	.history-type--on .history-type__count {
		color: #12b7f5;
	}

	.history-hint {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 56px 24px 0;
	}

	.history-hint__icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 56px;
		height: 56px;
		border-radius: 50%;
		background-color: var(--qq-card);
	}

	.history-hint__title {
		margin-top: 12px;
		font-size: 14px;
		font-weight: 600;
		color: var(--qq-text);
	}

	.history-hint__desc {
		margin-top: 6px;
		font-size: 10.5px;
		color: var(--qq-text-4);
		text-align: center;
	}

	.history-hot {
		width: 100%;
		margin-top: 26px;
		padding: 14px;
		border-radius: 12px;
		background-color: var(--qq-card);
	}

	.history-hot__label {
		font-size: 11px;
		color: var(--qq-text-3);
	}

	.history-hot__tags {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin-top: 10px;
	}

	.history-hot__tag {
		padding: 5px 11px;
		border-radius: 12px;
		background-color: var(--qq-card-2);
		font-size: 11px;
		color: var(--qq-text-2);
	}

	.history-results {
		padding: 4px 12px 0;
	}

	.history-results__head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		padding: 2px 2px 8px;
	}

	.history-results__title {
		font-size: 11px;
		color: var(--qq-text-3);
	}

	.history-results__count {
		font-size: 10px;
		color: var(--qq-text-4);
	}

	.history-list {
		border-radius: 12px;
		background-color: var(--qq-card);
		overflow: hidden;
	}

	.history-item {
		padding: 12px 14px;
		border-bottom: 1px solid var(--qq-line);
	}

	.history-item:last-child {
		border-bottom: none;
	}

	.history-item__top {
		display: flex;
		align-items: center;
	}

	.history-item__name {
		margin-left: 8px;
		font-size: 12px;
		color: var(--qq-text-2);
	}

	.history-item__time {
		margin-left: auto;
		font-size: 9.5px;
		color: var(--qq-text-4);
	}

	.history-item__body {
		display: flex;
		align-items: center;
		gap: 6px;
		margin: 8px 0 0 38px;
	}

	.history-item__thumb {
		width: 44px;
		height: 44px;
		border-radius: 6px;
	}

	.history-item__text {
		font-size: 12.5px;
		line-height: 1.6;
		color: var(--qq-text-2);
		word-break: break-all;
	}

	.history-item__text--multi {
		display: block;
	}

	.history-hit {
		color: #12b7f5;
		font-weight: 600;
	}

	.history-item__from {
		display: block;
		margin: 6px 0 0 38px;
		font-size: 9px;
		color: var(--qq-text-4);
	}

	.history-empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 10px;
		padding: 60px 0;
	}

	.history-empty__text {
		font-size: 11px;
		color: var(--qq-text-4);
	}
</style>
