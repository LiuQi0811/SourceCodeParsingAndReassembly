<script lang="ts" setup>
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { cartKey, useCartStore } from '@/stores/cart'
import { request } from '@/utils/request'
import { useThemeStore } from '@/stores/theme'

const theme = useThemeStore()


interface Address {
	id: string
	name: string
	phone: string
	detail: string
}

interface Coupon {
	value: number
	min: number
}

const cart = useCartStore()

const selectedKeys = ref<string[]>([])
const address = ref<Address>({
	id: 'home',
	name: '图鸟体验官',
	phone: '138****8888',
	detail: '江苏省徐州市云龙区 · 图鸟科技园 3 号楼 1201',
})
const addresses: Address[] = [
	address.value,
	{
		id: 'office',
		name: '林小满',
		phone: '139****6600',
		detail: '上海市浦东新区 · 张江科学城 2 号楼 806',
	},
]
const coupons: Coupon[] = [
	{ value: 20, min: 199 },
	{ value: 50, min: 399 },
	{ value: 100, min: 699 },
]
const selectedCoupon = ref<Coupon | null>(null)
const delivery = ref<'express' | 'pickup'>('express')
const payment = ref<'wechat' | 'balance'>('wechat')
const remark = ref('')
const submitting = ref(false)
const successOpen = ref(false)
const orderNo = ref('')
const paidAmount = ref('0.00')
const paidCount = ref(0)

const addressSheetRef = ref<any>(null)
const couponSheetRef = ref<any>(null)

onLoad((query: any) => {
	const raw = typeof query?.keys === 'string' ? query.keys : ''
	let decoded = raw
	try {
		decoded = decodeURIComponent(raw)
	} catch {
		decoded = raw
	}
	selectedKeys.value = decoded.split('|').filter(Boolean)
	if (!selectedKeys.value.length) selectedKeys.value = cart.items.map((item) => cartKey(item))
})

const items = computed(() =>
	cart.items
		.filter((item) => selectedKeys.value.includes(cartKey(item)))
		.map((item) => ({ ...item, key: cartKey(item), subtotal: (item.price * item.count).toFixed(2) })),
)
const totalCount = computed(() => items.value.reduce((sum, item) => sum + item.count, 0))
const goodsTotal = computed(() => items.value.reduce((sum, item) => sum + item.price * item.count, 0))
const discount = computed(() => {
	if (!selectedCoupon.value) return 0
	return goodsTotal.value >= selectedCoupon.value.min ? selectedCoupon.value.value : 0
})
const expressFee = computed(() => (goodsTotal.value >= 99 ? 0 : 8))
const freight = computed(() => {
	if (delivery.value === 'pickup') return 0
	return expressFee.value
})
const payable = computed(() => Math.max(0, goodsTotal.value - discount.value + freight.value).toFixed(2))
const couponText = computed(() => {
	if (!selectedCoupon.value) return '选择优惠券'
	return `满 ${selectedCoupon.value.min} 减 ${selectedCoupon.value.value}`
})

function chooseAddress() {
	addressSheetRef.value?.show({
		title: '选择收货地址',
		actions: addresses.map((item) => ({
			text: `${item.name}  ${item.phone}`,
			desc: item.detail,
			value: item.id,
		})),
		select: (index: number) => {
			const next = addresses[index]
			if (next) address.value = next
			return true
		},
	})
}

function chooseCoupon() {
	const actions = [
		{ text: '不使用优惠券', desc: '按原价结算', value: 'none' },
		...coupons.map((item) => ({
			text: `满 ${item.min} 减 ${item.value}`,
			desc: goodsTotal.value >= item.min ? '当前订单可用' : `还差 ¥${(item.min - goodsTotal.value).toFixed(2)}`,
			value: String(item.value),
			disabled: goodsTotal.value < item.min,
		})),
	]
	couponSheetRef.value?.show({
		title: '选择优惠券',
		actions,
		select: (index: number, value: string) => {
			if (index === 0 || value === 'none') {
				selectedCoupon.value = null
				return true
			}
			const picked = coupons.find((item) => String(item.value) === value)
			if (picked && goodsTotal.value >= picked.min) selectedCoupon.value = picked
			return true
		},
	})
}

async function submitOrder() {
	if (!items.value.length) {
		uni.showToast({ title: '订单中没有商品', icon: 'none' })
		return
	}
	if (submitting.value) return
	submitting.value = true
	try {
		const result = await request<{ orderNo: string }>({
			url: '/orders',
			method: 'POST',
			data: {
				items: items.value.map((item) => ({ id: item.id, variant: item.variant, count: item.count })),
				addressId: address.value.id,
				delivery: delivery.value,
				payment: payment.value,
				coupon: selectedCoupon.value?.value || 0,
				remark: remark.value,
				amount: payable.value,
			},
			auth: false,
			delay: 700,
			mock: () => ({ orderNo: `TN${Date.now().toString().slice(-12)}` }),
		})
		paidAmount.value = payable.value
		paidCount.value = totalCount.value
		orderNo.value = result.orderNo
		const keys = [...selectedKeys.value]
		keys.forEach((key) => cart.removeKey(key))
		selectedKeys.value = []
		successOpen.value = true
	} catch (error: any) {
		uni.showToast({ title: error?.message || '提交订单失败，请重试', icon: 'none' })
	} finally {
		submitting.value = false
	}
}

function backToMall() {
	successOpen.value = false
	uni.switchTab({ url: '/pages/template/index' })
}

function viewOrder() {
	successOpen.value = false
	uni.navigateTo({ url: '/pages/business/index' })
}
</script>

<template>
	<view class="page" :style="theme.vars">
		<view class="page-head">
			<text class="page-head__eyebrow">CHECKOUT</text>
			<text class="page-head__title">确认订单</text>
			<text class="page-head__desc">地址、配送、优惠券与支付方式都在这一页闭环</text>
		</view>

		<view v-if="items.length" class="checkout-body">
			<view class="card address-card" @click="chooseAddress">
				<view class="address-card__icon">
					<tn-icon name="location" :size="30" color="tn-white" />
				</view>
				<view class="address-card__body">
					<view class="address-card__top">
						<text class="address-card__name">{{ address.name }}</text>
						<text class="address-card__phone">{{ address.phone }}</text>
						<tn-tag type="primary" size="sm" shape="round">默认</tn-tag>
					</view>
					<text class="address-card__detail">{{ address.detail }}</text>
				</view>
				<tn-icon name="right" :size="26" color="tn-grey" />
			</view>

			<view class="card">
				<view class="section-head">
					<text class="section-head__title">商品清单</text>
					<text class="section-head__extra">{{ totalCount }} 件</text>
				</view>
				<view v-for="item in items" :key="item.key" class="order-line">
					<image class="order-line__img" :src="item.image" mode="aspectFill" />
					<view class="order-line__body">
						<text class="order-line__title">{{ item.title }}</text>
						<text v-if="item.variant" class="order-line__variant">{{ item.variant }}</text>
						<view class="order-line__bottom">
							<text class="order-line__price">¥{{ item.price }}</text>
							<text class="order-line__count">x{{ item.count }}</text>
						</view>
					</view>
					<text class="order-line__subtotal">¥{{ item.subtotal }}</text>
				</view>
			</view>

			<view class="card">
				<view class="section-head">
					<text class="section-head__title">配送方式</text>
				</view>
				<view class="option-list">
					<view
						v-for="option in [
							{ value: 'express', title: '快递配送', desc: '预计 2-3 天送达' },
							{ value: 'pickup', title: '到店自提', desc: '徐州图鸟科技园 · 今日可提' },
						]"
						:key="option.value"
						class="option"
						:class="{ 'option--active': delivery === option.value }"
						@click="delivery = option.value as 'express' | 'pickup'"
					>
						<view class="option__radio">
							<tn-icon v-if="delivery === option.value" name="check" :size="20" color="tn-white" />
						</view>
						<view class="option__body">
							<text class="option__title">{{ option.title }}</text>
							<text class="option__desc">{{ option.desc }}</text>
						</view>
						<text class="option__extra">{{ option.value === 'express' ? (expressFee === 0 ? '免运费' : `¥${expressFee}`) : '免运费' }}</text>
					</view>
				</view>
			</view>

			<view class="card">
				<view class="link-row" @click="chooseCoupon">
					<view class="link-row__left">
						<tn-icon name="coupon" :size="28" color="tn-orange" />
						<text class="link-row__title">优惠券</text>
					</view>
					<view class="link-row__right">
						<text class="link-row__value" :class="{ 'link-row__value--active': selectedCoupon }">{{ couponText }}</text>
						<tn-icon name="right" :size="24" color="tn-grey" />
					</view>
				</view>

				<view class="section-head section-head--gap">
					<text class="section-head__title">支付方式</text>
				</view>
				<view class="option-list">
					<view
						v-for="option in [
							{ value: 'wechat', title: '微信支付', desc: '推荐使用，安全快捷' },
							{ value: 'balance', title: '余额支付', desc: '演示余额 ¥ 1,280.00' },
						]"
						:key="option.value"
						class="option"
						:class="{ 'option--active': payment === option.value }"
						@click="payment = option.value as 'wechat' | 'balance'"
					>
						<view class="option__radio">
							<tn-icon v-if="payment === option.value" name="check" :size="20" color="tn-white" />
						</view>
						<view class="option__body">
							<text class="option__title">{{ option.title }}</text>
							<text class="option__desc">{{ option.desc }}</text>
						</view>
					</view>
				</view>
			</view>

			<view class="card">
				<view class="section-head">
					<text class="section-head__title">订单备注</text>
				</view>
				<tn-input v-model="remark" placeholder="选填，例如：工作日送货 / 需要发票" />
			</view>

			<view class="card summary-card">
				<view class="summary-row">
					<text>商品金额</text>
					<text>¥{{ goodsTotal.toFixed(2) }}</text>
				</view>
				<view class="summary-row">
					<text>优惠券</text>
					<text class="summary-row__discount">-¥{{ discount.toFixed(2) }}</text>
				</view>
				<view class="summary-row">
					<text>运费</text>
					<text>{{ freight ? `¥${freight.toFixed(2)}` : '免运费' }}</text>
				</view>
				<view class="summary-row summary-row--total">
					<text>应付合计</text>
					<text>¥{{ payable }}</text>
				</view>
			</view>

			<text class="checkout-tip">演示订单走 request mock，提交后会从购物车移除已购商品。</text>
		</view>

		<view v-else-if="!successOpen" class="empty-card">
			<tn-empty mode="cart" />
			<tn-button type="primary" shape="round" class="empty-card__btn" @click="backToMall">返回商城</tn-button>
		</view>
	</view>

	<view v-if="items.length" class="submit-bar">
		<view class="submit-bar__total">
			<text class="submit-bar__count">共 {{ totalCount }} 件</text>
			<view class="submit-bar__amount">
				<text class="submit-bar__label">应付</text>
				<text class="submit-bar__value">¥{{ payable }}</text>
			</view>
		</view>
		<tn-button type="primary" shape="round" :loading="submitting" class="submit-bar__btn" @click="submitOrder">提交订单</tn-button>
	</view>

	<tn-action-sheet ref="addressSheetRef" />
	<tn-action-sheet ref="couponSheetRef" />
	<tn-popup
		v-model="successOpen"
		open-direction="center"
		:width="620"
		:radius="28"
		:overlay-closeable="false"
	>
		<view class="success-card">
			<view class="success-card__icon">
				<tn-icon name="check" :size="52" color="tn-white" />
			</view>
			<text class="success-card__title">支付成功</text>
			<text class="success-card__desc">订单已提交，仓库正在准备你的商品</text>
			<view class="success-card__meta">
				<text>订单号 {{ orderNo }}</text>
				<text>{{ paidCount }} 件 · 实付 ¥{{ paidAmount }}</text>
			</view>
			<tn-button type="primary" shape="round" class="success-card__btn" @click="backToMall">返回商城</tn-button>
			<tn-button plain shape="round" class="success-card__btn" @click="viewOrder">查看订单</tn-button>
		</view>
	</tn-popup>
</template>

<style lang="scss" scoped>
.page {
	min-height: 100vh;
	padding: 28rpx 24rpx 190rpx;
	background-color: var(--demo-bg);
	box-sizing: border-box;
}

.page-head {
	padding: 8rpx 4rpx 24rpx;
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
	letter-spacing: 1rpx;
}

.page-head__desc {
	display: block;
	margin-top: 8rpx;
	font-size: 23rpx;
	color: var(--demo-muted);
}

.card {
	margin-bottom: 24rpx;
	padding: 28rpx 24rpx;
	border-radius: 28rpx;
	background-color: var(--demo-surface);
	box-shadow: 0 12rpx 36rpx rgba(36, 48, 68, 0.06);
}

.address-card {
	display: flex;
	align-items: center;
	padding: 26rpx 24rpx;
}

.address-card__icon {
	display: flex;
	align-items: center;
	justify-content: center;
	width: 76rpx;
	height: 76rpx;
	border-radius: 22rpx;
	background: linear-gradient(135deg, #4b7dff, #6f9bff);
	flex-shrink: 0;
}

.address-card__body {
	flex: 1;
	min-width: 0;
	margin-left: 20rpx;
}

.address-card__top {
	display: flex;
	align-items: center;
}

.address-card__name {
	font-size: 29rpx;
	font-weight: 800;
	color: var(--demo-ink);
}

.address-card__phone {
	margin-left: 14rpx;
	font-size: 24rpx;
	color: var(--demo-muted);
}

.address-card__top :deep(.tn-tag) {
	margin-left: 12rpx;
}

.address-card__detail {
	display: block;
	margin-top: 8rpx;
	font-size: 23rpx;
	color: var(--demo-muted);
	line-height: 1.5;
}

.section-head {
	display: flex;
	align-items: center;
	justify-content: space-between;
	margin-bottom: 22rpx;
}

.section-head--gap {
	margin-top: 26rpx;
}

.section-head__title {
	font-size: 27rpx;
	font-weight: 800;
	color: var(--demo-ink);
}

.section-head__extra {
	font-size: 22rpx;
	color: var(--demo-faint);
}

.order-line {
	display: flex;
	align-items: center;
	padding: 18rpx 0;
	border-top: 1rpx solid #f1f4f9;
}

.order-line:first-of-type {
	border-top: 0;
	padding-top: 0;
}

.order-line__img {
	width: 112rpx;
	height: 112rpx;
	border-radius: 16rpx;
	flex-shrink: 0;
	background-color: var(--demo-line-soft);
}

.order-line__body {
	flex: 1;
	min-width: 0;
	margin-left: 18rpx;
}

.order-line__title {
	display: block;
	font-size: 26rpx;
	font-weight: 700;
	color: var(--demo-ink);
	line-height: 1.4;
}

.order-line__variant {
	display: inline-block;
	margin-top: 6rpx;
	padding: 4rpx 10rpx;
	border-radius: 8rpx;
	background-color: var(--demo-primary-soft);
	font-size: 20rpx;
	color: #4b7dff;
}

.order-line__bottom {
	display: flex;
	align-items: center;
	margin-top: 8rpx;
}

.order-line__price {
	font-size: 28rpx;
	font-weight: 800;
	color: var(--demo-orange);
}

.order-line__count {
	margin-left: 14rpx;
	font-size: 22rpx;
	color: var(--demo-faint);
}

.order-line__subtotal {
	margin-left: 18rpx;
	font-size: 26rpx;
	font-weight: 800;
	color: var(--demo-ink);
}

.option-list {
	margin-top: 2rpx;
}

.option {
	display: flex;
	align-items: center;
	padding: 20rpx 18rpx;
	border: 1rpx solid #edf1f7;
	border-radius: 18rpx;
	background-color: var(--demo-soft);
}

.option + .option {
	margin-top: 14rpx;
}

.option--active {
	border-color: #bcd0ff;
	background-color: var(--demo-primary-soft);
}

.option__radio {
	display: flex;
	align-items: center;
	justify-content: center;
	width: 36rpx;
	height: 36rpx;
	border: 2rpx solid #d8e0ec;
	border-radius: 50%;
	background-color: var(--demo-surface);
	flex-shrink: 0;
}

.option--active .option__radio {
	border-color: #4b7dff;
	background-color: #4b7dff;
}

.option__body {
	flex: 1;
	min-width: 0;
	margin-left: 16rpx;
}

.option__title {
	display: block;
	font-size: 25rpx;
	font-weight: 700;
	color: var(--demo-ink);
}

.option__desc {
	display: block;
	margin-top: 4rpx;
	font-size: 21rpx;
	color: var(--demo-muted);
}

.option__extra {
	margin-left: 12rpx;
	font-size: 22rpx;
	color: var(--demo-muted);
}

.link-row {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 6rpx 0;
}

.link-row__left {
	display: flex;
	align-items: center;
}

.link-row__title {
	margin-left: 12rpx;
	font-size: 26rpx;
	font-weight: 700;
	color: var(--demo-ink);
}

.link-row__right {
	display: flex;
	align-items: center;
}

.link-row__value {
	margin-right: 8rpx;
	font-size: 23rpx;
	color: var(--demo-muted);
}

.link-row__value--active {
	color: var(--demo-orange);
	font-weight: 700;
}

.summary-card {
	margin-bottom: 10rpx;
}

.summary-row {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 8rpx 0;
	font-size: 24rpx;
	color: var(--demo-muted);
}

.summary-row__discount {
	color: var(--demo-orange);
}

.summary-row--total {
	margin-top: 12rpx;
	padding-top: 20rpx;
	border-top: 1rpx solid #f1f4f9;
	font-size: 27rpx;
	font-weight: 800;
	color: var(--demo-ink);
}

.summary-row--total text:last-child {
	font-size: 34rpx;
	color: var(--demo-orange);
}

.checkout-tip {
	display: block;
	padding: 0 8rpx;
	font-size: 21rpx;
	color: var(--demo-faint);
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

.submit-bar {
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

.submit-bar__total {
	flex: 1;
}

.submit-bar__count {
	display: block;
	font-size: 21rpx;
	color: var(--demo-faint);
}

.submit-bar__amount {
	display: flex;
	align-items: baseline;
	margin-top: 2rpx;
}

.submit-bar__label {
	font-size: 22rpx;
	color: var(--demo-muted);
}

.submit-bar__value {
	margin-left: 6rpx;
	font-size: 38rpx;
	font-weight: 800;
	color: var(--demo-orange);
}

.submit-bar__btn {
	width: 240rpx;
	flex-shrink: 0;
}

.success-card {
	display: flex;
	flex-direction: column;
	align-items: center;
	padding: 40rpx 36rpx 32rpx;
}

.success-card__icon {
	display: flex;
	align-items: center;
	justify-content: center;
	width: 104rpx;
	height: 104rpx;
	border-radius: 50%;
	background: linear-gradient(135deg, #2fc27f, #53d99b);
	box-shadow: 0 14rpx 30rpx rgba(47, 194, 127, 0.24);
}

.success-card__title {
	margin-top: 22rpx;
	font-size: 36rpx;
	font-weight: 800;
	color: var(--demo-ink);
}

.success-card__desc {
	margin-top: 8rpx;
	font-size: 22rpx;
	color: var(--demo-muted);
	text-align: center;
}

.success-card__meta {
	width: 100%;
	margin-top: 24rpx;
	padding: 20rpx;
	border-radius: 18rpx;
	background-color: var(--demo-soft);
}

.success-card__meta text {
	display: block;
	font-size: 21rpx;
	color: var(--demo-muted);
	line-height: 1.7;
	text-align: center;
}

.success-card__btn {
	width: 100%;
	margin-top: 18rpx;
}
</style>
