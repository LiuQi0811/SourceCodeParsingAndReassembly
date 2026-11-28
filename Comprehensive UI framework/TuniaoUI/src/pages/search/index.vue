<script lang="ts" setup>
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { goods, type GoodsItem } from '@/data/mock'
import { useCartStore } from '@/stores/cart'
import { useThemeStore } from '@/stores/theme'

const theme = useThemeStore()


const HISTORY_KEY = 'tn-demo-search-history'

const sortOptions = [
	{ label: '综合', value: 'default' },
	{ label: '销量', value: 'sales' },
	{ label: '价格升', value: 'priceAsc' },
	{ label: '价格降', value: 'priceDesc' },
] as const
type SortKey = (typeof sortOptions)[number]['value']

const priceOptions = [
	{ label: '不限', value: 'all' },
	{ label: '¥0-99', value: '0-99' },
	{ label: '¥100-199', value: '100-199' },
	{ label: '¥200+', value: '200+' },
] as const
type PriceKey = (typeof priceOptions)[number]['value']

const hotKeywords = ['源码', '模板', '图标', '组件', '表单', '跨端']
const categories = ['全部', '源码', '模板', '图标', '组件', '文档', '插件']

const cart = useCartStore()
const keyword = ref('')
const category = ref('全部')
const priceBand = ref<PriceKey>('all')
const sort = ref<SortKey>('default')
const history = ref<string[]>([])

onLoad((query: any) => {
	const raw = typeof query?.keyword === 'string' ? query.keyword : ''
	if (raw) {
		try {
			keyword.value = decodeURIComponent(raw)
		} catch {
			keyword.value = raw
		}
	}
	const cached = uni.getStorageSync(HISTORY_KEY) as string[] | ''
	if (Array.isArray(cached)) history.value = cached
	if (keyword.value.trim()) remember(keyword.value)
})

const results = computed(() => {
	const kw = keyword.value.trim().toLowerCase()
	let list = goods.filter((item) => {
		const text = `${item.name} ${item.desc} ${item.tags.join(' ')}`.toLowerCase()
		return !kw || text.includes(kw)
	})

	if (category.value !== '全部') {
		list = list.filter((item) => item.tags.includes(category.value))
	}

	if (priceBand.value === '0-99') list = list.filter((item) => item.price < 100)
	else if (priceBand.value === '100-199') list = list.filter((item) => item.price >= 100 && item.price < 200)
	else if (priceBand.value === '200+') list = list.filter((item) => item.price >= 200)

	if (sort.value === 'sales') list = [...list].sort((a, b) => b.sales - a.sales)
	else if (sort.value === 'priceAsc') list = [...list].sort((a, b) => a.price - b.price)
	else if (sort.value === 'priceDesc') list = [...list].sort((a, b) => b.price - a.price)

	return list
})

const resultLabel = computed(() => {
	const kw = keyword.value.trim()
	return kw ? `“${kw}” 的搜索结果` : '全部商品'
})
const filterActive = computed(
	() => category.value !== '全部' || priceBand.value !== 'all' || sort.value !== 'default',
)

function remember(word: string) {
	const value = word.trim()
	if (!value) return
	history.value = [value, ...history.value.filter((item) => item !== value)].slice(0, 8)
	uni.setStorageSync(HISTORY_KEY, history.value)
}

function onSearch() {
	remember(keyword.value)
	uni.hideKeyboard()
}

function useKeyword(word: string) {
	keyword.value = word
	remember(word)
	uni.hideKeyboard()
}

function clearKeyword() {
	keyword.value = ''
}

function setSort(value: SortKey) {
	sort.value = value
}

function setPrice(value: PriceKey) {
	priceBand.value = value
}

function resetFilters() {
	category.value = '全部'
	priceBand.value = 'all'
	sort.value = 'default'
}

function resetAll() {
	clearKeyword()
	resetFilters()
}

function clearHistory() {
	history.value = []
	uni.removeStorageSync(HISTORY_KEY)
	uni.showToast({ title: '搜索历史已清空', icon: 'none' })
}

function removeHistory(word: string) {
	history.value = history.value.filter((item) => item !== word)
	uni.setStorageSync(HISTORY_KEY, history.value)
}

function toDetail(item: GoodsItem) {
	uni.navigateTo({ url: `/pages/detail/index?id=${item.id}` })
}

function addCart(item: GoodsItem) {
	cart.add({
		id: item.id,
		title: item.name,
		price: item.price,
		image: item.image,
		tag: item.tags[0] || '',
	})
	uni.showToast({ title: '已加入购物车', icon: 'success' })
}

function goCart() {
	uni.navigateTo({ url: '/pages/cart/index' })
}
</script>

<template>
	<view class="page" :style="theme.vars">
		<view class="hero">
			<view class="hero__top">
				<view>
					<text class="hero__eyebrow">SEARCH & FILTER</text>
					<text class="hero__title">{{ keyword ? `“${keyword}”` : '发现好物' }}</text>
				</view>
				<view class="hero__cart" @click="goCart">
					<tn-badge v-if="cart.totalCount" :value="cart.totalCount" type="danger">
						<tn-icon name="cart" :size="32" color="#ffffff" />
					</tn-badge>
					<tn-icon v-else name="cart" :size="32" color="#ffffff" />
					<text class="hero__cart-text">购物车</text>
				</view>
			</view>
			<text class="hero__desc">关键词、分类、价格三层筛选即时生效，结果可直接加购或进入详情</text>
		</view>

		<view class="search-card">
			<view class="search-line">
				<view class="search-line__box">
					<tn-search-box v-model="keyword" shape="round" placeholder="搜索商品、模板、源码" :search-button="false" @search="onSearch" />
				</view>
				<text class="search-line__btn" @click="onSearch">搜索</text>
			</view>
			<view v-if="keyword" class="keyword-line">
				<text class="keyword-line__tip">当前关键词</text>
				<view class="keyword-pill">
					<text>{{ keyword }}</text>
					<view class="keyword-pill__close" @click="clearKeyword">
						<tn-icon name="close" :size="20" color="#2f6bff" />
					</view>
				</view>
			</view>

			<view class="chip-block">
				<text class="chip-block__label">热门</text>
				<view class="chip-wrap">
					<text v-for="word in hotKeywords" :key="word" class="chip chip--hot" @click="useKeyword(word)">{{ word }}</text>
				</view>
			</view>

			<view v-if="history.length" class="history-block">
				<view class="history-head">
					<text class="chip-block__label">搜索历史</text>
					<text class="history-head__clear" @click="clearHistory">清空</text>
				</view>
				<view class="chip-wrap">
					<view v-for="word in history" :key="word" class="history-chip" @click="useKeyword(word)">
						<text class="history-chip__text">{{ word }}</text>
						<view class="history-chip__close" @click.stop="removeHistory(word)">
							<tn-icon name="close" :size="18" color="#9aa6b8" />
						</view>
					</view>
				</view>
			</view>
		</view>

		<view class="filter-card">
			<view class="filter-row">
				<text class="filter-label">排序</text>
				<view class="chip-wrap">
					<text
						v-for="option in sortOptions"
						:key="option.value"
						class="chip"
						:class="{ 'chip--active': sort === option.value }"
						@click="setSort(option.value)"
					>
						{{ option.label }}
					</text>
				</view>
			</view>
			<view class="filter-row">
				<text class="filter-label">分类</text>
				<view class="chip-wrap">
					<text
						v-for="item in categories"
						:key="item"
						class="chip"
						:class="{ 'chip--active': category === item }"
						@click="category = item"
					>
						{{ item }}
					</text>
				</view>
			</view>
			<view class="filter-row">
				<text class="filter-label">价格</text>
				<view class="chip-wrap">
					<text
						v-for="option in priceOptions"
						:key="option.value"
						class="chip"
						:class="{ 'chip--active': priceBand === option.value }"
						@click="setPrice(option.value)"
					>
						{{ option.label }}
					</text>
				</view>
			</view>
		</view>

		<view class="result-head">
			<view class="result-head__left">
				<text class="result-head__title">{{ resultLabel }}</text>
				<text class="result-head__count">{{ results.length }} 件</text>
			</view>
			<text v-if="filterActive" class="result-head__reset" @click="resetFilters">重置筛选</text>
		</view>

		<view v-if="results.length" class="result-list">
			<view v-for="item in results" :key="item.id" class="goods-row" @click="toDetail(item)">
				<image class="goods-row__image" :src="item.image" mode="aspectFill" />
				<view class="goods-row__body">
					<view class="goods-row__head">
						<text class="goods-row__title">{{ item.name }}</text>
						<text class="goods-row__cat">{{ item.tags[0] }}</text>
					</view>
					<text class="goods-row__desc">{{ item.desc }}</text>
					<view class="goods-row__tags">
						<text v-for="tag in item.tags.slice(1)" :key="tag" class="tag-pill">{{ tag }}</text>
					</view>
					<view class="goods-row__bottom">
						<view class="goods-row__price-wrap">
							<text class="goods-row__price">¥{{ item.price }}</text>
							<text class="goods-row__origin">¥{{ item.originPrice }}</text>
							<text class="goods-row__sales">已售 {{ item.sales }}</text>
						</view>
						<view class="goods-row__add" @click.stop="addCart(item)">
							<tn-icon name="cart" :size="26" color="#ffffff" />
						</view>
					</view>
				</view>
			</view>
		</view>

		<view v-else class="empty-card">
			<tn-empty mode="search" />
			<text class="empty-card__desc">试试更短的关键词，或清空分类与价格条件</text>
			<tn-button type="primary" shape="round" class="empty-card__btn" @click="resetAll">清空条件</tn-button>
		</view>

		<view class="tip">搜索历史只保存在本机，最多保留 8 条；筛选结果由前端计算，接入接口时可替换成服务端查询。</view>
	</view>
</template>

<style lang="scss" scoped>
.page {
	min-height: 100vh;
	padding-bottom: 48rpx;
	background-color: var(--demo-bg);
}

.hero {
	padding: 34rpx 30rpx 72rpx;
	background: linear-gradient(145deg, #0b1220 0%, #172554 58%, #1e40af 100%);
	border-radius: 0 0 36rpx 36rpx;
	box-shadow: 0 16rpx 40rpx rgba(15, 23, 42, 0.16);
}

.hero__top {
	display: flex;
	align-items: flex-start;
	justify-content: space-between;
}

.hero__eyebrow {
	display: block;
	font-size: 18rpx;
	font-weight: 700;
	letter-spacing: 4rpx;
	color: #67e8f9;
}

.hero__title {
	display: block;
	max-width: 470rpx;
	margin-top: 10rpx;
	font-size: 42rpx;
	font-weight: 800;
	line-height: 1.25;
	letter-spacing: -1rpx;
	color: #ffffff;
	overflow: hidden;
	white-space: nowrap;
	text-overflow: ellipsis;
}

.hero__desc {
	display: block;
	margin-top: 12rpx;
	font-size: 22rpx;
	line-height: 1.65;
	color: rgba(226, 232, 240, 0.76);
}

.hero__cart {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	width: 92rpx;
	height: 92rpx;
	border: 1rpx solid rgba(255, 255, 255, 0.18);
	border-radius: 22rpx;
	background-color: rgba(255, 255, 255, 0.08);
}

.hero__cart-text {
	margin-top: 2rpx;
	font-size: 18rpx;
	color: rgba(255, 255, 255, 0.82);
}

.search-card {
	position: relative;
	margin: -42rpx 24rpx 0;
	padding: 24rpx;
	background-color: var(--demo-surface);
	border: 1rpx solid var(--demo-line);
	border-radius: 24rpx;
	box-shadow: 0 10rpx 30rpx rgba(15, 23, 42, 0.06);
}

.search-line {
	display: flex;
	align-items: center;
}

.search-line__box {
	flex: 1;
	min-width: 0;
}

.search-line__btn {
	display: flex;
	align-items: center;
	justify-content: center;
	width: 96rpx;
	height: 64rpx;
	margin-left: 14rpx;
	border-radius: 32rpx;
	background: linear-gradient(135deg, #2f6bff, #01befe);
	font-size: 24rpx;
	font-weight: 600;
	color: #ffffff;
}

.keyword-line {
	display: flex;
	align-items: center;
	margin-top: 16rpx;
}

.keyword-line__tip {
	font-size: 20rpx;
	color: var(--demo-faint);
}

.keyword-pill {
	display: flex;
	align-items: center;
	margin-left: 10rpx;
	padding: 6rpx 12rpx 6rpx 16rpx;
	border-radius: 20rpx;
	background-color: var(--demo-primary-soft);
}

.keyword-pill text {
	max-width: 360rpx;
	font-size: 22rpx;
	color: var(--demo-primary);
	overflow: hidden;
	white-space: nowrap;
	text-overflow: ellipsis;
}

.keyword-pill__close {
	display: flex;
	align-items: center;
	justify-content: center;
	padding-left: 6rpx;
}

.chip-block {
	margin-top: 20rpx;
}

.chip-block__label {
	display: block;
	font-size: 22rpx;
	font-weight: 600;
	color: var(--demo-muted);
}

.chip-wrap {
	display: flex;
	flex-wrap: wrap;
	margin-top: 2rpx;
}

.chip {
	margin: 10rpx 12rpx 0 0;
	padding: 10rpx 18rpx;
	border: 1rpx solid var(--demo-line);
	border-radius: 24rpx;
	background-color: var(--demo-soft);
	font-size: 21rpx;
	color: var(--demo-muted);
}

.chip--hot {
	border-color: #ffe2c8;
	background-color: #fff8ef;
	color: #d97706;
}

.chip--active {
	border-color: var(--demo-primary-line);
	background-color: var(--demo-primary-soft);
	font-weight: 600;
	color: var(--demo-primary);
}

.history-block {
	margin-top: 18rpx;
	padding-top: 18rpx;
	border-top: 1rpx solid #f0f3f8;
}

.history-head {
	display: flex;
	align-items: center;
	justify-content: space-between;
}

.history-head__clear {
	font-size: 20rpx;
	color: var(--demo-faint);
}

.history-chip {
	display: flex;
	align-items: center;
	margin: 10rpx 12rpx 0 0;
	padding: 8rpx 10rpx 8rpx 16rpx;
	border-radius: 24rpx;
	background-color: var(--demo-soft);
}

.history-chip__text {
	max-width: 220rpx;
	font-size: 21rpx;
	color: var(--demo-muted);
	overflow: hidden;
	white-space: nowrap;
	text-overflow: ellipsis;
}

.history-chip__close {
	display: flex;
	align-items: center;
	justify-content: center;
	padding-left: 6rpx;
}

.filter-card {
	margin: 18rpx 24rpx 0;
	padding: 8rpx 24rpx 18rpx;
	background-color: var(--demo-surface);
	border: 1rpx solid var(--demo-line);
	border-radius: 24rpx;
	box-shadow: 0 8rpx 24rpx rgba(15, 23, 42, 0.04);
}

.filter-row {
	display: flex;
	align-items: flex-start;
	padding-top: 16rpx;
}

.filter-row:first-child {
	margin-top: 4rpx;
}

.filter-label {
	width: 72rpx;
	padding-top: 14rpx;
	font-size: 21rpx;
	font-weight: 600;
	color: var(--demo-faint);
}

.filter-row .chip-wrap {
	flex: 1;
	margin-top: 0;
}

.result-head {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 28rpx 30rpx 14rpx;
}

.result-head__left {
	display: flex;
	align-items: baseline;
}

.result-head__title {
	font-size: 30rpx;
	font-weight: 700;
	color: var(--demo-ink);
}

.result-head__count {
	margin-left: 12rpx;
	font-size: 20rpx;
	color: var(--demo-faint);
}

.result-head__reset {
	font-size: 21rpx;
	color: var(--demo-primary);
}

.result-list {
	padding: 0 24rpx;
}

.goods-row {
	display: flex;
	margin-bottom: 16rpx;
	padding: 18rpx;
	background-color: var(--demo-surface);
	border: 1rpx solid var(--demo-line);
	border-radius: 22rpx;
	box-shadow: 0 6rpx 20rpx rgba(15, 23, 42, 0.04);
}

.goods-row__image {
	width: 176rpx;
	height: 176rpx;
	border-radius: 16rpx;
	background-color: var(--demo-line-soft);
}

.goods-row__body {
	flex: 1;
	min-width: 0;
	margin-left: 18rpx;
	display: flex;
	flex-direction: column;
}

.goods-row__head {
	display: flex;
	align-items: center;
	justify-content: space-between;
}

.goods-row__title {
	flex: 1;
	margin-right: 10rpx;
	font-size: 27rpx;
	font-weight: 600;
	color: var(--demo-ink);
	overflow: hidden;
	white-space: nowrap;
	text-overflow: ellipsis;
}

.goods-row__cat {
	flex-shrink: 0;
	padding: 4rpx 12rpx;
	border-radius: 8rpx;
	background-color: var(--demo-primary-soft);
	font-size: 18rpx;
	line-height: 1.4;
	color: var(--demo-primary);
}

.goods-row__desc {
	margin-top: 6rpx;
	font-size: 21rpx;
	line-height: 1.5;
	color: var(--demo-faint);
	overflow: hidden;
	white-space: nowrap;
	text-overflow: ellipsis;
}

.goods-row__tags {
	display: flex;
	flex-wrap: wrap;
	margin-top: 8rpx;
}

.tag-pill {
	margin-right: 8rpx;
	padding: 3rpx 10rpx;
	border-radius: 8rpx;
	background-color: var(--demo-soft);
	font-size: 18rpx;
	color: var(--demo-muted);
}

.goods-row__bottom {
	display: flex;
	align-items: flex-end;
	justify-content: space-between;
	margin-top: 12rpx;
}

.goods-row__price-wrap {
	display: flex;
	align-items: baseline;
}

.goods-row__price {
	font-size: 30rpx;
	font-weight: 700;
	color: #ff444f;
}

.goods-row__origin {
	margin-left: 8rpx;
	font-size: 19rpx;
	color: var(--demo-faint);
	text-decoration: line-through;
}

.goods-row__sales {
	margin-left: 12rpx;
	font-size: 19rpx;
	color: var(--demo-faint);
}

.goods-row__add {
	display: flex;
	align-items: center;
	justify-content: center;
	width: 58rpx;
	height: 58rpx;
	border-radius: 50%;
	background: linear-gradient(135deg, #2f6bff, #01befe);
	box-shadow: 0 4rpx 12rpx rgba(47, 107, 255, 0.28);
}

.empty-card {
	margin: 0 24rpx;
	padding: 36rpx 24rpx;
	display: flex;
	flex-direction: column;
	align-items: center;
	background-color: var(--demo-surface);
	border: 1rpx solid var(--demo-line);
	border-radius: 24rpx;
}

.empty-card__desc {
	margin-top: 8rpx;
	font-size: 21rpx;
	color: var(--demo-faint);
	text-align: center;
}

.empty-card__btn {
	width: 260rpx;
	margin-top: 22rpx;
}

.tip {
	margin: 20rpx 32rpx 0;
	font-size: 20rpx;
	line-height: 1.6;
	color: var(--demo-faint);
}
</style>
