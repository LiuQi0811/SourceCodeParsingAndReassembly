<script setup lang="ts">
import dayjs from 'dayjs'
import { useI18n } from 'vue-i18n'
import { useOrdersStore } from '@/stores/orders'
import { useThemeStore } from '@/stores/theme'

const { t } = useI18n()
const theme = useThemeStore()
const ordersStore = useOrdersStore()

function formatDate(timestamp: number) {
	return dayjs(timestamp).format('YYYY-MM-DD HH:mm')
}

function browse() {
	uni.switchTab({ url: '/pages/template/index' })
}

function removeOrder(id: string) {
	uni.showModal({
		title: t('ordersPage.deleteTitle'),
		content: t('ordersPage.deleteDesc'),
		success: ({ confirm }) => {
			if (confirm) ordersStore.remove(id)
		},
	})
}

function clearOrders() {
	if (!ordersStore.orders.length) return
	uni.showModal({
		title: t('ordersPage.clearTitle'),
		content: t('ordersPage.clearDesc'),
		success: ({ confirm }) => {
			if (confirm) ordersStore.clear()
		},
	})
}
</script>

<template>
	<view class="page" :style="theme.vars">
		<view class="page-head">
			<view class="page-head__row">
				<view>
					<text class="page-head__eyebrow">ORDERS</text>
					<text class="page-head__title">{{ t('ordersPage.title') }}</text>
				</view>
				<text v-if="ordersStore.orders.length" class="page-head__clear" @click="clearOrders">{{ t('ordersPage.clear') }}</text>
			</view>
			<text class="page-head__desc">{{ t('ordersPage.desc') }}</text>
		</view>

		<view v-if="ordersStore.orders.length" class="stats">
			<view class="stat">
				<text class="stat__value">{{ ordersStore.totalCount }}</text>
				<text class="stat__label">{{ t('ordersPage.orderCount', ordersStore.totalCount) }}</text>
			</view>
			<view class="stat">
				<text class="stat__value stat__value--primary">¥{{ ordersStore.orders.reduce((sum, item) => sum + Number(item.amount), 0).toFixed(2) }}</text>
				<text class="stat__label">{{ t('ordersPage.totalPaid') }}</text>
			</view>
		</view>

		<view v-if="ordersStore.orders.length" class="order-list">
			<view v-for="order in ordersStore.orders" :key="order.id" class="order-card">
				<view class="order-card__head">
					<view class="order-card__no">
						<text class="order-card__label">{{ t('ordersPage.orderNo') }}</text>
						<text class="order-card__value">{{ order.orderNo }}</text>
					</view>
					<view class="status">
						<view class="status__dot"></view>
						<text>{{ t('ordersPage.paid') }}</text>
					</view>
				</view>

				<view class="order-card__items">
					<view v-for="item in order.items" :key="`${order.id}-${item.id}-${item.variant || ''}`" class="order-item">
						<view class="order-item__thumb">
							<text>{{ item.title.slice(0, 1) }}</text>
						</view>
						<view class="order-item__body">
							<text class="order-item__title">{{ item.title }}</text>
							<text v-if="item.variant" class="order-item__variant">{{ item.variant }}</text>
						</view>
						<text class="order-item__price">¥{{ (item.price * item.count).toFixed(2) }}</text>
					</view>
				</view>

				<view class="order-card__meta">
					<text>{{ formatDate(order.createdAt) }}</text>
					<text>{{ t(`checkoutPage.${order.delivery}`) }} · {{ t(`checkoutPage.${order.payment}`) }}</text>
				</view>

				<view class="order-card__foot">
					<text class="order-card__total">{{ t('ordersPage.total') }}<text class="order-card__amount">¥{{ order.amount }}</text></text>
					<view class="order-card__actions">
						<text class="order-card__delete" @click="removeOrder(order.id)">{{ t('ordersPage.delete') }}</text>
						<tn-button size="small" shape="round" type="primary" @click="browse">{{ t('ordersPage.shop') }}</tn-button>
					</view>
				</view>
			</view>
		</view>

		<view v-else class="empty">
			<view class="empty__icon">
				<tn-icon name="order" :size="54" color="tn-white" />
			</view>
			<text class="empty__title">{{ t('ordersPage.emptyTitle') }}</text>
			<text class="empty__desc">{{ t('ordersPage.emptyDesc') }}</text>
			<tn-button shape="round" type="primary" class="empty__btn" @click="browse">{{ t('ordersPage.browse') }}</tn-button>
		</view>
	</view>
</template>

<style lang="scss" scoped>
.page {
	min-height: 100vh;
	padding: 28rpx 24rpx 80rpx;
	background-color: var(--demo-bg);
	box-sizing: border-box;
}

.page-head {
	padding: 8rpx 4rpx 24rpx;
}

.page-head__row {
	display: flex;
	align-items: flex-end;
	justify-content: space-between;
}

.page-head__eyebrow {
	display: block;
	font-size: 22rpx;
	letter-spacing: 4rpx;
	color: var(--demo-faint);
	font-weight: 700;
}

.page-head__title {
	display: block;
	margin-top: 6rpx;
	font-size: 42rpx;
	font-weight: 800;
	color: var(--demo-ink);
}

.page-head__desc {
	display: block;
	margin-top: 12rpx;
	font-size: 25rpx;
	line-height: 1.6;
	color: var(--demo-muted);
}

.page-head__clear {
	font-size: 24rpx;
	color: var(--demo-faint);
	padding: 8rpx 4rpx;
}

.stats {
	display: flex;
	gap: 20rpx;
	margin-bottom: 22rpx;
}

.stat {
	flex: 1;
	padding: 24rpx 26rpx;
	border-radius: 24rpx;
	background: var(--demo-surface);
	border: 1rpx solid var(--demo-line);
	box-shadow: var(--demo-shadow);
}

.stat__value {
	display: block;
	font-size: 40rpx;
	font-weight: 800;
	color: var(--demo-ink);
}

.stat__value--primary {
	color: var(--demo-primary);
}

.stat__label {
	display: block;
	margin-top: 6rpx;
	font-size: 22rpx;
	color: var(--demo-faint);
}

.order-list {
	display: flex;
	flex-direction: column;
	gap: 22rpx;
}

.order-card {
	padding: 26rpx;
	border-radius: 26rpx;
	background: var(--demo-surface);
	border: 1rpx solid var(--demo-line);
	box-shadow: var(--demo-shadow);
}

.order-card__head {
	display: flex;
	align-items: flex-start;
	justify-content: space-between;
	gap: 16rpx;
	padding-bottom: 20rpx;
	border-bottom: 1rpx solid var(--demo-line-soft);
}

.order-card__label {
	display: block;
	font-size: 21rpx;
	color: var(--demo-faint);
}

.order-card__value {
	display: block;
	margin-top: 4rpx;
	font-size: 26rpx;
	font-weight: 700;
	color: var(--demo-ink);
	letter-spacing: 1rpx;
}

.status {
	display: flex;
	align-items: center;
	gap: 8rpx;
	padding: 8rpx 18rpx;
	border-radius: 999rpx;
	background: rgba(34, 197, 94, 0.12);
	border: 1rpx solid rgba(34, 197, 94, 0.35);
	font-size: 22rpx;
	color: #22c55e;
	white-space: nowrap;
}

.status__dot {
	width: 10rpx;
	height: 10rpx;
	border-radius: 50%;
	background: #22c55e;
}

.order-card__items {
	padding: 18rpx 0 12rpx;
	display: flex;
	flex-direction: column;
	gap: 16rpx;
}

.order-item {
	display: flex;
	align-items: center;
	gap: 16rpx;
}

.order-item__thumb {
	width: 72rpx;
	height: 72rpx;
	border-radius: 16rpx;
	background: linear-gradient(135deg, var(--demo-primary), var(--demo-purple));
	display: flex;
	align-items: center;
	justify-content: center;
	color: #ffffff;
	font-size: 28rpx;
	font-weight: 700;
	flex-shrink: 0;
}

.order-item__body {
	flex: 1;
	min-width: 0;
}

.order-item__title {
	display: block;
	font-size: 26rpx;
	font-weight: 600;
	color: var(--demo-text);
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.order-item__variant {
	display: block;
	margin-top: 4rpx;
	font-size: 21rpx;
	color: var(--demo-faint);
}

.order-item__price {
	font-size: 26rpx;
	font-weight: 700;
	color: var(--demo-ink);
}

.order-card__meta {
	display: flex;
	justify-content: space-between;
	gap: 16rpx;
	font-size: 21rpx;
	color: var(--demo-faint);
	padding: 8rpx 0 18rpx;
	border-bottom: 1rpx solid var(--demo-line-soft);
}

.order-card__foot {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 16rpx;
	padding-top: 18rpx;
}

.order-card__total {
	font-size: 23rpx;
	color: var(--demo-muted);
}

.order-card__amount {
	margin-left: 8rpx;
	font-size: 30rpx;
	font-weight: 800;
	color: var(--demo-ink);
}

.order-card__actions {
	display: flex;
	align-items: center;
	gap: 18rpx;
}

.order-card__delete {
	font-size: 24rpx;
	color: var(--demo-primary);
	padding: 8rpx 4rpx;
}

.empty {
	margin-top: 40rpx;
	padding: 56rpx 32rpx;
	border-radius: 28rpx;
	background: var(--demo-surface);
	border: 1rpx solid var(--demo-line);
	box-shadow: var(--demo-shadow);
	display: flex;
	flex-direction: column;
	align-items: center;
}

.empty__icon {
	width: 108rpx;
	height: 108rpx;
	border-radius: 32rpx;
	background: linear-gradient(135deg, var(--demo-primary), var(--demo-purple));
	display: flex;
	align-items: center;
	justify-content: center;
}

.empty__title {
	margin-top: 22rpx;
	font-size: 32rpx;
	font-weight: 800;
	color: var(--demo-ink);
}

.empty__desc {
	margin-top: 10rpx;
	font-size: 24rpx;
	line-height: 1.6;
	color: var(--demo-muted);
	text-align: center;
}

.empty__btn {
	margin-top: 28rpx;
	padding: 0 54rpx;
}
</style>
