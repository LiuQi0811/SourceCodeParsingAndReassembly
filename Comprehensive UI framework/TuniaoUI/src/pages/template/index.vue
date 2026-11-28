<script lang="ts" setup>
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { banners, goods, noticeList } from '@/data/mock'

const { t } = useI18n()

const navSearch = ref('')
const tabIndex = ref(0)
const tabNames = ['推荐', '新品', '热卖']

const currentGoods = computed(() => {
	if (tabIndex.value === 1) return [...goods].reverse()
	if (tabIndex.value === 2) return [...goods].sort((a, b) => b.sales - a.sales)
	return goods
})

const bannerIndex = ref(0)

const quickEntries = [
	{ icon: 'cube', text: '组件', color: 'tn-blue', url: '/pages/components/index', tab: true },
	{ icon: 'edit-form', text: '表单', color: 'tn-purple', url: '/pages/form/index' },
	{ icon: 'message', text: '反馈', color: 'tn-orange', url: '/pages/feedback/index' },
	{ icon: 'menu', text: '导航', color: 'tn-green', url: '/pages/nav/index' },
	{ icon: 'charts-column', text: '数据', color: 'tn-teal', url: '/pages/data/index' },
	{ icon: 'creative', text: '主题', color: 'tn-red', url: '/pages/theme/index', tab: true },
	{ icon: 'menu-grille', text: '布局', color: 'tn-aquablue', url: '/pages/layout/index' },
	{ icon: 'image-text', text: '模板', color: 'tn-grey', url: '/pages/template/index', tab: true },
]

function goEntry(item: any) {
	if (item.tab) {
		uni.switchTab({ url: item.url })
	} else {
		uni.navigateTo({ url: item.url })
	}
}

function toDetail(item: any) {
	uni.navigateTo({ url: `/pages/detail/index?id=${item.id}` })
}

function toSearch() {
	uni.showToast({ title: navSearch.value ? `搜索：${navSearch.value}` : '点击了搜索', icon: 'none' })
}

function addCart(item: any) {
	uni.showToast({ title: `已加入购物车：${item.name}`, icon: 'success' })
}

function onBannerChange(index: number) {
	bannerIndex.value = index
}

function onBannerClick(index: number) {
	toDetail(goods[index] || goods[0])
}

function toComponents() {
	uni.switchTab({ url: '/pages/components/index' })
}
</script>

<template>
	<view class="page">
		<!-- 自定义导航栏（页面配置了 navigationStyle: custom） -->
		<tn-navbar fixed bg-color="#ffffff" text-color="#303133" back-icon="" home-icon="" :bottom-shadow="true">
			<view class="nav-title">
				<tn-icon name="shop" :size="30" color="tn-blue" />
				<text class="nav-title__text">图鸟商城</text>
			</view>
			<template #right>
				<view class="nav-right">
					<tn-icon name="search" :size="34" color="tn-grey-dark" @click="toSearch" />
					<tn-badge value="3" type="danger" class="nav-badge">
						<tn-icon name="cart" :size="34" color="tn-grey-dark" />
					</tn-badge>
				</view>
			</template>
		</tn-navbar>

		<!-- 搜索框 -->
		<view class="search-area">
			<tn-search-box v-model="navSearch" shape="round" text-align="center" placeholder="搜索组件 / 模板 / 图标" :search-button="false" @search="toSearch" />
		</view>

		<!-- 轮播 -->
		<view class="banner">
			<tn-swiper
				:data="banners"
				:model-value="bannerIndex"
				height="340"
				autoplay
				loop
				indicator
				indicator-type="line"
				@update:model-value="onBannerChange"
				@item-click="onBannerClick"
			>
				<template #default="{ data }">
					<view class="banner-item">
						<image :src="data.image" class="banner-image" mode="aspectFill" />
						<view class="banner-text">
							<text class="banner-title">{{ data.title }}</text>
							<text class="banner-desc">{{ data.desc }}</text>
						</view>
					</view>
				</template>
			</tn-swiper>
		</view>

		<!-- 通知 -->
		<view class="notice">
			<tn-notice-bar :data="noticeList" bg-color="tn-orange-light" text-color="tn-orange-dark" left-icon="notice" left-icon-color="tn-orange" />
		</view>

		<!-- 快捷入口 -->
		<view class="quick-card">
			<view v-for="item in quickEntries" :key="item.text" class="quick-item" hover-class="tn-u-btn-hover" @click="goEntry(item)">
				<view class="quick-item__icon" :class="[`tn-${String(item.color).replace('tn-', '')}_bg`]">
					<tn-icon :name="item.icon" :size="34" color="#ffffff" />
				</view>
				<text class="quick-item__text">{{ item.text }}</text>
			</view>
		</view>

		<!-- 限时秒杀 -->
		<view class="seckill">
			<view class="seckill__head">
				<view class="tn-flex tn-flex-center-start">
					<tn-icon name="fire" :size="30" color="tn-red" />
					<text class="seckill__title">限时秒杀</text>
				</view>
				<view class="tn-flex tn-flex-center-start">
					<text class="seckill__label">距结束</text>
					<tn-count-down :time="2 * 3600 + 59 * 60" separator-mode="en" text-color="tn-blue" size="sm" class="tn-ml-xs" />
				</view>
			</view>
			<view class="seckill__body" @click="toDetail(goods[0])">
				<image :src="goods[0].image" class="seckill__image" mode="aspectFill" />
				<view class="seckill__info">
					<text class="seckill__name">{{ goods[0].name }}</text>
					<text class="seckill__desc">{{ goods[0].desc }}</text>
					<view class="tn-flex tn-flex-center-between tn-mt-xs">
						<view class="tn-flex tn-flex-center-start">
							<text class="price">¥{{ goods[0].price }}</text>
							<text class="origin-price">¥{{ goods[0].originPrice }}</text>
						</view>
						<tn-button size="sm" type="danger" shape="round" @click.stop="addCart(goods[0])">立即抢</tn-button>
					</view>
				</view>
			</view>
		</view>

		<!-- 商品列表 -->
		<view class="goods-section">
			<tn-tabs v-model="tabIndex" :bar="true" active-color="tn-blue" bar-color="tn-blue">
				<tn-tabs-item v-for="(name, index) in tabNames" :key="name" :name="index" :title="name" />
			</tn-tabs>

			<view class="goods-grid">
				<view v-for="item in currentGoods" :key="item.id" class="goods-card" @click="toDetail(item)">
					<image :src="item.image" class="goods-image" mode="aspectFill" />
					<view class="goods-info">
						<text class="goods-name">{{ item.name }}</text>
						<text class="goods-desc">{{ item.desc }}</text>
						<view class="goods-tags">
							<tn-tag v-for="tag in item.tags" :key="tag" size="sm" type="primary">{{ tag }}</tn-tag>
						</view>
						<view class="tn-flex tn-flex-center-between">
							<text class="goods-price">¥{{ item.price }}</text>
							<text class="goods-sales">已售 {{ item.sales }}</text>
						</view>
					</view>
				</view>
			</view>
		</view>

		<!-- 页脚信息 + 固定底部操作栏 -->
		<tn-footer
			:fixed="false"
			:navigator="[
				{ title: '组件总览', url: '/pages/components/index' },
				{ title: '主题色板', url: '/pages/theme/index' },
			]"
			content="TuniaoUI 实战模板 · 商品列表页（TabBar 页面）"
		/>

		<view class="action-bar">
			<view class="action-bar__btn" @click="addCart(goods[1])">
				<tn-icon name="service" :size="36" color="tn-grey-dark" />
				<text class="action-bar__text">客服</text>
			</view>
			<view class="action-bar__btn" @click="toComponents">
				<tn-icon name="cart" :size="36" color="tn-grey-dark" />
				<text class="action-bar__text">购物车</text>
			</view>
			<tn-button :plain="true" type="primary" width="30%" @click="toComponents">{{ t('template.addCart') }}</tn-button>
			<tn-button type="danger" width="30%" @click="toDetail(goods[2])">立即购买</tn-button>
		</view>

		<view class="page-bottom-space" />
	</view>
</template>

<style lang="scss" scoped>
.page {
}

.nav-title {
	display: flex;
	align-items: center;
}

.nav-title__text {
	margin-left: 10rpx;
	font-size: 30rpx;
	font-weight: 600;
}

.nav-right {
	display: flex;
	align-items: center;
}

.nav-badge {
	margin-left: 24rpx;
	display: flex;
	align-items: center;
}

.search-area {
	padding: 16rpx 24rpx;
	background-color: #ffffff;
}

.banner {
	margin: 16rpx 24rpx 0;
	overflow: hidden;
	border-radius: 20rpx;
}

.banner-item {
	position: relative;
	width: 100%;
	height: 100%;
}

.banner-image {
	width: 100%;
	height: 100%;
	border-radius: 20rpx;
}

.banner-text {
	position: absolute;
	left: 28rpx;
	bottom: 28rpx;
	display: flex;
	flex-direction: column;
}

.banner-title {
	font-size: 32rpx;
	font-weight: 700;
	color: #ffffff;
}

.banner-desc {
	margin-top: 6rpx;
	font-size: 22rpx;
	color: rgba(255, 255, 255, 0.88);
}

.notice {
	margin: 16rpx 24rpx 0;
	overflow: hidden;
	border-radius: 14rpx;
}

.quick-card {
	margin: 24rpx;
	padding: 24rpx 8rpx;
	display: flex;
	flex-wrap: wrap;
	background-color: #ffffff;
	border-radius: 20rpx;
	box-shadow: 0 6rpx 24rpx rgba(0, 0, 0, 0.05);
}

.quick-item {
	width: 25%;
	display: flex;
	flex-direction: column;
	align-items: center;
	padding: 12rpx 0;
}

.quick-item__icon {
	width: 76rpx;
	height: 76rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	border-radius: 20rpx;
}

.quick-item__text {
	margin-top: 10rpx;
	font-size: 22rpx;
	color: #606266;
}

.seckill {
	margin: 0 24rpx;
	padding: 24rpx;
	background-color: #ffffff;
	border-radius: 20rpx;
	box-shadow: 0 6rpx 24rpx rgba(0, 0, 0, 0.05);
}

.seckill__head {
	display: flex;
	align-items: center;
	justify-content: space-between;
	margin-bottom: 20rpx;
}

.seckill__title {
	margin-left: 8rpx;
	font-size: 28rpx;
	font-weight: 700;
	color: #ff444f;
}

.seckill__label {
	font-size: 22rpx;
	color: #909399;
}

.seckill__body {
	display: flex;
}

.seckill__image {
	width: 180rpx;
	height: 180rpx;
	border-radius: 14rpx;
}

.seckill__info {
	flex: 1;
	margin-left: 20rpx;
	display: flex;
	flex-direction: column;
	justify-content: space-between;
}

.seckill__name {
	font-size: 26rpx;
	font-weight: 600;
	color: #303133;
}

.seckill__desc {
	margin-top: 6rpx;
	font-size: 22rpx;
	color: #909399;
}

.price {
	font-size: 32rpx;
	font-weight: 700;
	color: #ff444f;
}

.origin-price {
	margin-left: 8rpx;
	font-size: 22rpx;
	color: #b0b3b8;
	text-decoration: line-through;
}

.goods-section {
	margin-top: 24rpx;
	background-color: #ffffff;
	border-radius: 20rpx 20rpx 0 0;
	overflow: hidden;
}

.goods-grid {
	display: flex;
	flex-wrap: wrap;
	padding: 8rpx 16rpx 16rpx;
}

.goods-card {
	width: 50%;
	padding: 8rpx;
	box-sizing: border-box;
}

.goods-card__inner {
	background-color: #f7f9fc;
	border-radius: 16rpx;
	overflow: hidden;
}

.goods-image {
	width: 100%;
	height: 300rpx;
	border-radius: 16rpx;
}

.goods-info {
	padding: 14rpx 6rpx 4rpx;
	display: flex;
	flex-direction: column;
}

.goods-name {
	font-size: 26rpx;
	font-weight: 600;
	color: #303133;
	overflow: hidden;
	white-space: nowrap;
	text-overflow: ellipsis;
}

.goods-desc {
	margin-top: 6rpx;
	font-size: 20rpx;
	color: #909399;
	overflow: hidden;
	white-space: nowrap;
	text-overflow: ellipsis;
}

.goods-tags {
	display: flex;
	flex-wrap: wrap;
	gap: 8rpx;
	margin: 10rpx 0;
}

.goods-price {
	font-size: 30rpx;
	font-weight: 700;
	color: #ff444f;
}

.goods-sales {
	font-size: 20rpx;
	color: #b0b3b8;
}

.action-bar {
	position: fixed;
	left: 0;
	right: 0;
	bottom: 0;
	z-index: 100;
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 14rpx 24rpx calc(14rpx + env(safe-area-inset-bottom));
	background-color: #ffffff;
	box-shadow: 0 -6rpx 24rpx rgba(0, 0, 0, 0.06);
}

.action-bar__btn {
	display: flex;
	flex-direction: column;
	align-items: center;
	margin-right: 20rpx;
}

.action-bar__text {
	font-size: 20rpx;
	color: #606266;
}

.page-bottom-space {
	height: 260rpx;
}
</style>
