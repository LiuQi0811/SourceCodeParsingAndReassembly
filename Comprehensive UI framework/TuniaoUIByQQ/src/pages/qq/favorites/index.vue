<script lang="ts" setup>
	import { computed, ref } from 'vue'

	type FavType = 'image' | 'file' | 'link' | 'text' | 'voice'

	interface Favorite {
		id: string
		type: FavType
		title: string
		desc?: string
		meta: string
		image?: string
		icon?: string
		color?: string
		domain?: string
		duration?: number
	}

	const filter = ref<'all' | FavType>('all')
	const playingId = ref('')

	const list = ref<Favorite[]>([
		{
			id: 'f1',
			type: 'image',
			title: '美术馆的新媒体装置',
			desc: '林嘉禾分享 · 周末一起去看展',
			meta: '昨天 18:20',
			image: '/static/qq/m2.jpg',
		},
		{
			id: 'f2',
			type: 'file',
			title: '需求评审-2024Q4.pdf',
			desc: '2.4 MB · 群文件',
			meta: '今天 11:02',
			icon: 'folder',
			color: '#4776E6',
		},
		{
			id: 'f3',
			type: 'link',
			title: 'iOS 26 全新设计语言解析：从毛玻璃到空间层级',
			desc: 'ifanr.com · 设计',
			meta: '昨天 09:12',
			icon: 'share-triangle',
			color: '#12B7F5',
			domain: 'ifanr.com',
		},
		{
			id: 'f4',
			type: 'voice',
			title: '林嘉禾的语音',
			desc: '记得把评审材料提前发群里',
			meta: '昨天 17:26',
			duration: 12,
		},
		{
			id: 'f5',
			type: 'image',
			title: '新成员报到',
			desc: '郑一诺分享 · 前端小分队',
			meta: '周二 10:10',
			image: '/static/qq/m5.jpg',
		},
		{
			id: 'f6',
			type: 'text',
			title: '周末去云龙湖露营，帐篷和灯串都带上了，谁来一起？',
			desc: '苏晚的说说',
			meta: '上周五 21:08',
			icon: 'moments',
			color: '#F6A623',
		},
		{
			id: 'f7',
			type: 'file',
			title: '接口联调说明.md',
			desc: '36 KB · 群文件',
			meta: '周一 09:12',
			icon: 'folder',
			color: '#FF9F1C',
		},
		{
			id: 'f8',
			type: 'link',
			title: 'uni-app x 与 Vue3 的组合式 API 实践',
			desc: 'uniapp.dcloud.net.cn · 文档',
			meta: '上周日 15:40',
			icon: 'share-triangle',
			color: '#8E54E9',
			domain: 'uniapp.dcloud.net.cn',
		},
	])

	const filters = [
		{ key: 'all', label: '全部' },
		{ key: 'image', label: '图片' },
		{ key: 'file', label: '文件' },
		{ key: 'link', label: '链接' },
		{ key: 'voice', label: '语音' },
	] as const

	const countOf = (key: string) => (key === 'all' ? list.value.length : list.value.filter((f) => f.type === key).length)

	const filtered = computed(() => (filter.value === 'all' ? list.value : list.value.filter((f) => f.type === filter.value)))

	const totalSize = '共 86.4 MB'

	function typeLabel(t: FavType) {
		return { image: '图片', file: '文件', link: '链接', text: '文字', voice: '语音' }[t]
	}

	function onOpen(fav: Favorite) {
		if (fav.type === 'image' && fav.image) {
			uni.previewImage({ urls: [fav.image], current: fav.image })
			return
			}
		if (fav.type === 'voice') {
			playingId.value = fav.id
			setTimeout(() => {
				if (playingId.value === fav.id) playingId.value = ''
			}, Math.max(1200, (fav.duration || 10) * 100))
			return
		}
		if (fav.type === 'file') {
			uni.showActionSheet({
				itemList: ['预览文件', '转发到聊天', '取消收藏'],
				success: (res) => {
					if (res.tapIndex === 2) remove(fav.id)
					else uni.showToast({ title: res.tapIndex === 0 ? '演示：预览文件' : '演示：转发到聊天', icon: 'none' })
				},
			})
			return
		}
		if (fav.type === 'link') {
			uni.showToast({ title: `演示：打开 ${fav.domain}`, icon: 'none' })
			return
		}
		uni.setClipboardData({
			data: fav.title,
			success: () => uni.showToast({ title: '文字已复制', icon: 'none' }),
		})
	}

	function remove(id: string) {
		list.value = list.value.filter((f) => f.id !== id)
		uni.showToast({ title: '已取消收藏', icon: 'none' })
	}

	function onSwipe(option: any, fav: Favorite) {
		if (option?.text === '删除') remove(fav.id)
	}

	function onManage() {
		uni.showToast({ title: '演示：批量管理收藏', icon: 'none' })
	}
</script>

<template>
	<view class="qq-page fav-page">
		<qq-navbar title="我的收藏" bg="#F7F8FA">
			<template #right>
				<view class="fav-hd" @tap="onManage">
					<text class="fav-hd__text">管理</text>
				</view>
			</template>
		</qq-navbar>

		<view class="fav-summary">
			<view class="fav-summary__main">
				<text class="fav-summary__title">收藏夹</text>
				<text class="fav-summary__sub">{{ countOf('all') }} 条收藏 · {{ totalSize }}</text>
			</view>
			<view class="fav-summary__icon">
				<tn-icon name="star" size="22px" color="#F5576C" />
			</view>
		</view>

		<view class="fav-filters">
			<view
				v-for="f in filters"
				:key="f.key"
				class="fav-filter"
				:class="{ 'fav-filter--on': filter === f.key }"
				@tap="filter = f.key"
			>
				<text class="fav-filter__label">{{ f.label }}</text>
				<text class="fav-filter__count">{{ countOf(f.key) }}</text>
			</view>
		</view>

		<view v-if="filtered.length" class="fav-list">
			<view v-for="fav in filtered" :key="fav.id" class="fav-item">
				<qq-swipe :options="[{ text: '删除', bg: '#FA5151' }]" @select="onSwipe($event, fav)">
					<view class="fav-card" @tap="onOpen(fav)">
						<image v-if="fav.type === 'image'" class="fav-card__thumb" :src="fav.image" mode="aspectFill" />
						<view
							v-else-if="fav.type === 'voice'"
							class="fav-card__icon fav-card__icon--voice"
							:class="{ 'fav-card__icon--playing': playingId === fav.id }"
						>
							<tn-icon name="microphone" size="18px" color="#12B7F5" />
							<view class="fav-wave">
								<view v-for="i in 5" :key="i" class="fav-wave__bar" :style="{ height: `${4 + ((i * 5) % 9)}px` }" />
							</view>
						</view>
						<view v-else class="fav-card__icon" :style="{ backgroundColor: `${fav.color}14` }">
							<tn-icon :name="fav.icon || 'star'" size="19px" :color="fav.color" />
						</view>

						<view class="fav-card__main">
							<text class="fav-card__title">{{ fav.title }}</text>
							<text v-if="fav.desc" class="fav-card__desc">{{ fav.desc }}</text>
							<view class="fav-card__meta">
								<text class="fav-card__type">{{ typeLabel(fav.type) }}</text>
								<text class="fav-card__time">{{ fav.meta }}</text>
							</view>
						</view>

						<text v-if="fav.type === 'voice'" class="fav-card__duration">{{ fav.duration }}″</text>
						<tn-icon v-else name="right" size="12px" color="#C2C6CC" />
					</view>
				</qq-swipe>
			</view>
		</view>

		<view v-else class="fav-empty">
			<tn-icon name="star" size="30px" color="#C2C6CC" />
			<text class="fav-empty__text">还没有这类收藏</text>
			<text class="fav-empty__desc">聊天里的图片、文件、链接都可以长按收藏</text>
		</view>

		<text class="fav-tip">左滑可取消收藏 · 收藏内容仅自己可见</text>
	</view>
</template>

<style lang="scss" scoped>
	.fav-page {
		min-height: 100vh;
		padding-bottom: 30px;
	}

	.fav-hd__text {
		font-size: 13px;
		color: var(--qq-text-3);
	}

	.fav-summary {
		display: flex;
		align-items: center;
		margin: 6px 12px 0;
		padding: 14px 16px;
		border-radius: 12px;
		background: linear-gradient(135deg, rgba(245, 87, 108, 0.1), rgba(255, 159, 28, 0.08));
	}

	.fav-summary__main {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.fav-summary__title {
		font-size: 16px;
		font-weight: 600;
		color: var(--qq-text);
	}

	.fav-summary__sub {
		font-size: 10.5px;
		color: var(--qq-text-3);
	}

	.fav-summary__icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 38px;
		height: 38px;
		border-radius: 10px;
		background-color: var(--qq-card);
	}

	.fav-filters {
		display: flex;
		gap: 6px;
		padding: 12px 12px 4px;
	}

	.fav-filter {
		display: flex;
		align-items: center;
		gap: 3px;
		padding: 5px 10px;
		border-radius: 12px;
		background-color: var(--qq-card);
		border: 1px solid transparent;
	}

	.fav-filter--on {
		background-color: rgba(18, 183, 245, 0.1);
		border-color: rgba(18, 183, 245, 0.35);
	}

	.fav-filter__label {
		font-size: 11px;
		color: var(--qq-text-3);
	}

	.fav-filter__count {
		font-size: 9px;
		color: var(--qq-text-4);
	}

	.fav-filter--on .fav-filter__label,
	.fav-filter--on .fav-filter__count {
		color: #12b7f5;
	}

	.fav-list {
		padding: 8px 12px 0;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.fav-item {
		border-radius: 12px;
		overflow: hidden;
		background-color: var(--qq-card);
	}

	.fav-card {
		display: flex;
		align-items: center;
		width: 100%;
		padding: 12px;
		border-radius: 0;
		background-color: var(--qq-card);
	}

	.fav-card__thumb {
		width: 64px;
		height: 64px;
		border-radius: 8px;
		flex-shrink: 0;
	}

	.fav-card__icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 64px;
		height: 64px;
		border-radius: 8px;
		flex-shrink: 0;
	}

	.fav-card__icon--voice {
		gap: 6px;
		flex-direction: column;
		background-color: rgba(18, 183, 245, 0.08);
	}

	.fav-card__icon--playing {
		animation: fav-pulse 1s ease-in-out infinite;
	}

	@keyframes fav-pulse {
		0%,
		100% {
			background-color: rgba(18, 183, 245, 0.08);
		}
		50% {
			background-color: rgba(18, 183, 245, 0.2);
		}
	}

	.fav-wave {
		display: flex;
		align-items: flex-end;
		gap: 2px;
		height: 12px;
	}

	.fav-wave__bar {
		width: 2px;
		border-radius: 1px;
		background-color: #12b7f5;
		opacity: 0.7;
	}

	.fav-card__main {
		flex: 1;
		min-width: 0;
		margin-left: 12px;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.fav-card__title {
		font-size: 13.5px;
		font-weight: 500;
		color: var(--qq-text);
		line-height: 1.45;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.fav-card__desc {
		font-size: 10.5px;
		color: var(--qq-text-3);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.fav-card__meta {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.fav-card__type {
		padding: 1px 5px;
		border-radius: 4px;
		background-color: var(--qq-card-2);
		font-size: 9px;
		color: var(--qq-text-4);
	}

	.fav-card__time {
		font-size: 9.5px;
		color: var(--qq-text-4);
	}

	.fav-card__duration {
		margin-left: 8px;
		font-size: 11px;
		color: var(--qq-text-3);
	}

	.fav-empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
		padding: 70px 24px 0;
	}

	.fav-empty__text {
		font-size: 13px;
		color: var(--qq-text-3);
	}

	.fav-empty__desc {
		font-size: 10px;
		color: var(--qq-text-4);
	}

	.fav-tip {
		display: block;
		margin-top: 16px;
		text-align: center;
		font-size: 9px;
		color: var(--qq-text-4);
	}
</style>
