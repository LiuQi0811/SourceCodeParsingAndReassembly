<script lang="ts" setup>
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { cartKey, useCartStore } from '@/stores/cart'
import { useThemeStore } from '@/stores/theme'

const theme = useThemeStore()


const cart = useCartStore()

const selectedKeys = ref<string[]>([])
const initialized = ref(false)

/** 新进购物车的商品默认勾选；返回本页时保留用户已有的勾选状态 */
onShow(() => {
	const keys = cart.items.map((item) => cartKey(item))
	if (!initialized.value) {
		selectedKeys.value = keys
		initialized.value = true
		return
	}
	selectedKeys.value = selectedKeys.value.filter((key) => keys.includes(key))
	const added = keys.filter((key) => !selectedKeys.value.includes(key))
	if (added.length) selectedKeys.value = [...selectedKeys.value, ...added]
})

const allSelected = computed(
	() => cart.items.length > 0 && cart.items.every((item) => selectedKeys.value.includes(cartKey(item))),
)
const selectedLines = computed(() => cart.lines.filter((line) => selectedKeys.value.includes(line.key)))
const selectedCount = computed(() => selectedLines.value.reduce((sum, line) => sum + line.count, 0))
const selectedTotal = computed(() =>
	selectedLines.value.reduce((sum, line) => sum + line.price * line.count, 0).toFixed(2),
)

function toggleSelect(key: string) {
	if (selectedKeys.value.includes(key)) {
		selectedKeys.value = selectedKeys.value.filter((item) => item !== key)
		return
	}
	selectedKeys.value = [...selectedKeys.value, key]
}

function toggleAll() {
	selectedKeys.value = allSelected.value ? [] : cart.items.map((item) => cartKey(item))
}

function onSwipe(option: any, key: string) {
	if (!option || option.text !== '删除') return
	cart.removeKey(key)
	selectedKeys.value = selectedKeys.value.filter((item) => item !== key)
	uni.showToast({ title: '已移除商品', icon: 'none' })
}

function goShopping() {
	uni.switchTab({ url: '/pages/template/index' })
}

function checkout() {
	if (!selectedLines.value.length) {
		uni.showToast({ title: '请先勾选商品', icon: 'none' })
		return
	}
	const keys = selectedLines.value.map((line) => line.key).join('|')
	uni.navigateTo({ url: `/pages/checkout/index?keys=${encodeURIComponent(keys)}` })
}
</script>

<template>
	<view class="page" :style="theme.vars">
		<view class="cart-head">
			<view>
				<text class="cart-head__eyebrow">CART</text>
				<text class="cart-head__title">购物车</text>
				<text class="cart-head__desc">勾选商品后统一结算，本地缓存自动恢复</text>
			</view>
			<tn-tag type="primary" size="sm" shape="round">{{ cart.totalCount }} 件</tn-tag>
		</view>

		<view v-if="cart.items.length" class="cart-list">
			<tn-swipe-action-item
				v-for="line in cart.lines"
				:key="line.key"
				:options="[{ text: '删除', bgColor: 'tn-red', textColor: 'tn-white', icon: 'delete' }]"
				@click="onSwipe($event, line.key)"
			>
				<view class="cart-line">
					<view class="cart-check" :class="{ 'cart-check--active': selectedKeys.includes(line.key) }" @click="toggleSelect(line.key)">
						<tn-icon v-if="selectedKeys.includes(line.key)" name="check" :size="22" color="tn-white" />
					</view>
					<image class="cart-line__img" :src="line.image" mode="aspectFill" />
					<view class="cart-line__body">
						<text class="cart-line__title">{{ line.title }}</text>
						<text v-if="line.variant" class="cart-line__variant">{{ line.variant }}</text>
						<view class="cart-line__bottom">
							<text class="cart-line__price">¥{{ line.price }}</text>
							<view class="cart-step">
								<view class="cart-step__btn" @click.stop="cart.decreaseKey(line.key)">
									<tn-icon name="reduce" :size="20" color="tn-grey-dark" />
								</view>
								<text class="cart-step__value">{{ line.count }}</text>
								<view class="cart-step__btn" @click.stop="cart.increaseKey(line.key)">
									<tn-icon name="add" :size="20" color="tn-grey-dark" />
								</view>
							</view>
						</view>
					</view>
				</view>
			</tn-swipe-action-item>
		</view>

		<view v-else class="empty-card">
			<tn-empty mode="cart" />
			<tn-button type="primary" shape="round" class="empty-card__btn" @click="goShopping">去逛逛</tn-button>
		</view>

		<view class="cart-tip">左滑商品可删除；数量减到 1 后再减会自动移除。</view>
	</view>

	<view v-if="cart.items.length" class="checkout-bar">
		<view class="checkout-bar__select" @click="toggleAll">
			<view class="cart-check" :class="{ 'cart-check--active': allSelected }">
				<tn-icon v-if="allSelected" name="check" :size="22" color="tn-white" />
			</view>
			<text class="checkout-bar__select-text">全选</text>
		</view>
		<view class="checkout-bar__total">
			<text class="checkout-bar__count">已选 {{ selectedCount }} 件</text>
			<view class="checkout-bar__amount">
				<text class="checkout-bar__label">合计</text>
				<text class="checkout-bar__value">¥{{ selectedTotal }}</text>
			</view>
		</view>
		<tn-button type="primary" shape="round" class="checkout-bar__btn" @click="checkout">去结算</tn-button>
	</view>
</template>

<style lang="scss" scoped>
.page {
	min-height: 100vh;
	padding: 28rpx 24rpx 190rpx;
	background-color: var(--demo-bg);
	box-sizing: border-box;
}

.cart-head {
	display: flex;
	align-items: flex-start;
	justify-content: space-between;
	margin-bottom: 24rpx;
	padding: 8rpx 4rpx;
}

.cart-head__eyebrow {
	display: block;
	font-size: 22rpx;
	letter-spacing: 4rpx;
	color: var(--demo-faint);
	font-weight: 700;
}

.cart-head__title {
	display: block;
	margin-top: 6rpx;
	font-size: 42rpx;
	font-weight: 800;
	color: var(--demo-ink);
	letter-spacing: 1rpx;
}

.cart-head__desc {
	display: block;
	margin-top: 8rpx;
	font-size: 23rpx;
	color: var(--demo-muted);
}

.cart-list {
	overflow: hidden;
	border-radius: 28rpx;
	background-color: var(--demo-surface);
	box-shadow: 0 12rpx 36rpx rgba(36, 48, 68, 0.06);
}

.cart-line {
	display: flex;
	align-items: center;
	padding: 26rpx 24rpx;
	background-color: var(--demo-surface);
}

.cart-check {
	display: flex;
	align-items: center;
	justify-content: center;
	width: 40rpx;
	height: 40rpx;
	margin-right: 18rpx;
	border: 2rpx solid #d8e0ec;
	border-radius: 50%;
	background-color: var(--demo-surface);
	transition: all 0.18s ease;
	box-sizing: border-box;
}

.cart-check--active {
	border-color: #4b7dff;
	background-color: #4b7dff;
}

.cart-line__img {
	width: 136rpx;
	height: 136rpx;
	border-radius: 18rpx;
	flex-shrink: 0;
	background-color: var(--demo-line-soft);
}

.cart-line__body {
	flex: 1;
	min-width: 0;
	margin-left: 20rpx;
}

.cart-line__title {
	display: block;
	font-size: 27rpx;
	font-weight: 700;
	color: var(--demo-ink);
	line-height: 1.45;
}

.cart-line__variant {
	display: inline-block;
	margin-top: 8rpx;
	padding: 4rpx 12rpx;
	border-radius: 8rpx;
	background-color: var(--demo-primary-soft);
	font-size: 21rpx;
	color: #4b7dff;
}

.cart-line__bottom {
	display: flex;
	align-items: center;
	justify-content: space-between;
	margin-top: 16rpx;
}

.cart-line__price {
	font-size: 32rpx;
	font-weight: 800;
	color: var(--demo-orange);
}

.cart-step {
	display: flex;
	align-items: center;
	overflow: hidden;
	border: 1rpx solid #e6ebf3;
	border-radius: 12rpx;
}

.cart-step__btn {
	display: flex;
	align-items: center;
	justify-content: center;
	width: 56rpx;
	height: 48rpx;
	background-color: var(--demo-soft);
}

.cart-step__value {
	min-width: 52rpx;
	font-size: 24rpx;
	font-weight: 700;
	color: var(--demo-ink);
	text-align: center;
}

.empty-card {
	display: flex;
	flex-direction: column;
	align-items: center;
	padding: 30rpx 20rpx 56rpx;
	border-radius: 28rpx;
	background-color: var(--demo-surface);
	box-shadow: 0 12rpx 36rpx rgba(36, 48, 68, 0.06);
}

.empty-card__btn {
	margin-top: 28rpx;
	min-width: 220rpx;
}

.cart-tip {
	margin-top: 22rpx;
	padding: 0 10rpx;
	font-size: 22rpx;
	color: var(--demo-faint);
	text-align: center;
}

.checkout-bar {
	position: fixed;
	left: 0;
	right: 0;
	bottom: 0;
	z-index: 20;
	display: flex;
	align-items: center;
	padding: 20rpx 24rpx calc(20rpx + env(safe-area-inset-bottom));
	background-color: var(--demo-surface);
	box-shadow: 0 -12rpx 36rpx rgba(36, 48, 68, 0.1);
}

.checkout-bar__select {
	display: flex;
	align-items: center;
}

.checkout-bar__select-text {
	margin-left: 10rpx;
	font-size: 24rpx;
	color: var(--demo-muted);
}

.checkout-bar__total {
	flex: 1;
	margin-left: 18rpx;
}

.checkout-bar__count {
	display: block;
	font-size: 21rpx;
	color: var(--demo-faint);
}

.checkout-bar__amount {
	display: flex;
	align-items: baseline;
	margin-top: 2rpx;
}

.checkout-bar__label {
	font-size: 22rpx;
	color: var(--demo-muted);
}

.checkout-bar__value {
	margin-left: 6rpx;
	font-size: 38rpx;
	font-weight: 800;
	color: var(--demo-orange);
}

.checkout-bar__btn {
	width: 220rpx;
	flex-shrink: 0;
}
</style>
