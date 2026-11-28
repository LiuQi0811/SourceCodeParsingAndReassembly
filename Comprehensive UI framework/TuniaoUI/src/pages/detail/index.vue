<script lang="ts" setup>
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useI18n } from 'vue-i18n'
import { goods, gallery } from '@/data/mock'
import { useCartStore } from '@/stores/cart'
import { useThemeStore } from '@/stores/theme'

const theme = useThemeStore()
const { t } = useI18n()


const cart = useCartStore()

const actionSheetRef = ref<any>(null)
const popupRef = ref<any>(null)

const goodsId = ref<number>(1)
const current = computed(() => goods.find((item) => item.id === goodsId.value) || goods[0])

const detail = computed(() => current.value)
const showCoupon = ref(false)
const collected = ref(false)
const spec = ref('标准版')
const count = ref(1)

const stepIndexDemo = ref(1)
const collapseDemo = ref([0])

const params = computed(() => [
	{ label: t('detailPage.brand'), value: 'TuniaoUI' },
	{ label: t('detailPage.model'), value: 'TN-2026' },
	{ label: t('detailPage.material'), value: '航空铝合金' },
	{ label: t('detailPage.weight'), value: '320g' },
	{ label: t('detailPage.origin'), value: '中国 · 徐州' },
])

const coupons = computed(() => [
	{ value: 20, min: 199, cond: t('detailPage.couponCond', { min: 199 }) },
	{ value: 50, min: 399, cond: t('detailPage.couponCond', { min: 399 }) },
	{ value: 100, min: 699, cond: t('detailPage.couponCond', { min: 699 }) },
])

const paragraphs = [
	'采用一体化成型工艺，机身厚度仅 6.8mm，兼顾轻薄与结构强度，日常携带毫无负担。',
	'表面经过 12 道阳极氧化处理，耐磨抗指纹，长期使用依然保持细腻质感。',
	'内置智能温控芯片，连续高负载运行也能保持稳定性能输出，噪音低于 28dB。',
	'配套 TuniaoUI 全套设计规范，开发者可直接复用本项目中的组件与原子类，快速搭建同款商城页面。',
]

onLoad((query: any) => {
	const id = Number(query?.id)
	if (id && goods.some((item) => item.id === id)) goodsId.value = id
})

const specActions = computed(() => [
	{ text: '标准版', desc: `¥${detail.value.price} · ${t('detailPage.specStandardDesc')}`, value: '标准版' },
	{ text: '豪华版', desc: `¥${detail.value.price + 200} · ${t('detailPage.specDeluxeDesc')}`, value: '豪华版' },
	{ text: '尊享版', desc: `¥${detail.value.price + 500} · ${t('detailPage.specPremiumDesc')}`, value: '尊享版' },
])

function chooseSpec() {
	actionSheetRef.value?.show({
		title: t('detailPage.chooseSpec'),
		actions: specActions.value,
		cancelText: t('detailPage.cancel'),
		select: (index: number, value: string) => {
			const item = specActions.value[index]
			if (item) spec.value = item.text
			uni.showToast({ title: t('detailPage.selectedToast', { name: item?.text ?? value }), icon: 'none' })
			return true
		},
	})
}

function toggleCollect() {
	collected.value = !collected.value
	uni.showToast({ title: collected.value ? t('detailPage.collectOn') : t('detailPage.collectOff'), icon: 'none' })
}

function specExtra(name: string) {
	if (name === '豪华版') return 200
	if (name === '尊享版') return 500
	return 0
}

function currentCartItem() {
	return {
		id: detail.value.id,
		title: detail.value.name,
		price: detail.value.price + specExtra(spec.value),
		image: detail.value.image,
		tag: detail.value.tags?.[0] || '',
		variant: spec.value,
	}
}

function addCart() {
	cart.add(currentCartItem(), count.value)
	uni.showToast({ title: t('detailPage.addedCart', { spec: spec.value, n: count.value }), icon: 'success' })
}

function buyNow() {
	const key = cart.add(currentCartItem(), count.value)
	uni.navigateTo({ url: `/pages/checkout/index?keys=${encodeURIComponent(key)}` })
}

function toCart() {
	uni.navigateTo({ url: '/pages/cart/index' })
}

function copyLink() {
	uni.setClipboardData({
		data: `https://tuniao.cn/goods/${detail.value.id}`,
		success: () => uni.showToast({ title: t('detailPage.copied'), icon: 'none' }),
	})
}
</script>

<template>
	<view class="page" :style="theme.vars">
		<!-- 自定义导航栏 -->
		<tn-navbar fixed back-icon="left" home-icon="" :bg-color="theme.isDark ? '#0b1220' : '#ffffff'" :text-color="theme.isDark ? '#ffffff' : '#303133'" :bottom-shadow="true">
			<text class="nav-title">{{ t('detailPage.navTitle') }}</text>
			<template #right>
				<view class="nav-right">
					<tn-icon name="share" :size="36" color="tn-grey-dark" @click="copyLink" />
					<tn-badge value="6" type="danger" class="tn-ml-sm">
						<tn-icon name="cart" :size="36" color="tn-grey-dark" />
					</tn-badge>
				</view>
			</template>
		</tn-navbar>

		<!-- 图片相册 -->
		<view class="album">
			<tn-photo-album :data="gallery.slice(0, 3)" :column="3" img-mode="aspectFill" :preview="true" />
		</view>

		<!-- 价格信息 -->
		<view class="price-card">
			<view class="tn-flex tn-flex-center-between">
				<view class="tn-flex tn-flex-center-start">
					<text class="price-symbol">¥</text>
					<text class="price-value">{{ detail.price }}</text>
					<text class="price-origin">¥{{ detail.originPrice }}</text>
				</view>
				<tn-tag type="danger" shape="circle" size="sm">{{ t('detailPage.limited') }}</tn-tag>
			</view>
			<text class="goods-title">{{ detail.name }}</text>
			<text class="goods-subtitle">{{ detail.desc }}</text>

			<view class="tn-flex tn-flex-center-start tn-mt-sm">
				<tn-tag v-for="tag in detail.tags" :key="tag" size="sm" type="primary" class="tn-mr-xs">{{ tag }}</tn-tag>
				<text class="sales">{{ t('detailPage.sales', { n: detail.sales }) }}</text>
			</view>

			<view class="countdown-row">
				<view class="tn-flex tn-flex-center-start">
					<tn-icon name="fire" :size="30" color="tn-red" />
					<text class="countdown-label">{{ t('detailPage.seckill') }}</text>
				</view>
				<tn-count-down :time="6 * 3600" separator-mode="en" text-color="tn-red" size="sm" />
			</view>
		</view>

		<!-- 优惠券入口 -->
		<view class="cell-card" @click="showCoupon = true">
			<view class="tn-flex tn-flex-center-start">
				<tn-icon name="coupon" :size="34" color="tn-orange" />
				<text class="cell-title">{{ t('detailPage.coupon') }}</text>
			</view>
			<view class="tn-flex tn-flex-center-start">
				<tn-tag type="danger" size="sm" :plain="true">{{ t('detailPage.couponRule', { min: 199, value: 20 }) }}</tn-tag>
				<tn-icon name="right" :size="28" color="tn-grey" />
			</view>
		</view>

		<!-- 规格选择（命令式 ActionSheet） -->
		<view class="cell-card" @click="chooseSpec">
			<text class="cell-title">{{ t('detailPage.selectedSpec') }}</text>
			<view class="tn-flex tn-flex-center-start">
				<text class="cell-value">{{ t('detailPage.specCount', { spec, n: count }) }}</text>
				<tn-icon name="right" :size="28" color="tn-grey" />
			</view>
		</view>

		<!-- 物流信息 -->
		<view class="block-card">
			<text class="block-title">{{ t('detailPage.logistics') }}</text>
			<tn-steps v-model="stepIndexDemo" mode="dotIcon" class="tn-mt-sm">
				<tn-steps-item :title="t('detailPage.stepOrdered')" icon="cart" active-icon="cart-fill" />
				<tn-steps-item :title="t('detailPage.stepShipped')" icon="send" active-icon="send-fill" />
				<tn-steps-item :title="t('detailPage.stepReceived')" icon="check" active-icon="check" />
				<tn-steps-item :title="t('detailPage.stepReview')" icon="comment" active-icon="comment-fill" />
			</tn-steps>
			<text class="tn-text-sm tn-gray_text tn-mt-sm">{{ t('detailPage.shippingNote') }}</text>
		</view>

		<!-- 商品参数折叠 -->
		<view class="block-card">
			<text class="block-title">{{ t('detailPage.productInfo') }}</text>
			<tn-collapse v-model="collapseDemo" :accordion="false" class="tn-mt-sm">
				<tn-collapse-item :title="t('detailPage.params')">
					<view class="param-row" v-for="(row, i) in params" :key="i">
						<text class="param-label">{{ row.label }}</text>
						<text class="param-value">{{ row.value }}</text>
					</view>
				</tn-collapse-item>
				<tn-collapse-item :title="t('detailPage.afterSale')">
					<view class="paragraph">{{ t('detailPage.afterSaleText') }}</view>
				</tn-collapse-item>
				<tn-collapse-item :title="t('detailPage.delivery')">
					<view class="paragraph">{{ t('detailPage.deliveryText') }}</view>
				</tn-collapse-item>
			</tn-collapse>
		</view>

		<!-- 图文详情 -->
		<view class="block-card">
			<text class="block-title">{{ t('detailPage.gallery') }}</text>
			<tn-read-more :height="360" :expand-text="t('detailPage.expand')" :fold-text="t('detailPage.collapse')" class="tn-mt-sm" tip-color="tn-blue">
				<view class="paragraph" v-for="(p, i) in paragraphs" :key="i">{{ p }}</view>
				<image :src="gallery[3]" class="detail-image" mode="widthFix" />
			</tn-read-more>
		</view>

		<!-- 优惠券弹窗 -->
		<tn-popup v-model="showCoupon" :close-btn="true" :safe-area-inset-bottom="true" :radius="24">
			<view class="popup-inner">
				<text class="popup-title">{{ t('detailPage.couponTitle') }}</text>
				<view v-for="c in coupons" :key="c.value" class="coupon-item">
					<view class="coupon-left">
						<text class="coupon-value">¥{{ c.value }}</text>
						<text class="coupon-cond">{{ c.cond }}</text>
					</view>
					<tn-button size="sm" type="danger" shape="round" @click="showCoupon = false">{{ t('detailPage.claim') }}</tn-button>
				</view>
			</view>
		</tn-popup>

		<!-- 命令式 ActionSheet -->
		<tn-action-sheet ref="actionSheetRef" />

		<!-- 固定底部操作栏 -->
		<view class="action-bar" :style="{ backgroundColor: theme.isDark ? '#101827' : '#ffffff' }">
			<view class="action-icon" @click="toggleCollect">
				<tn-icon :name="collected ? 'star-fill' : 'star'" :size="38" :color="collected ? 'tn-red' : 'tn-grey-dark'" />
				<text class="action-text">{{ collected ? t('detailPage.collected') : t('detailPage.collect') }}</text>
			</view>
			<view class="action-icon" @click="copyLink">
				<tn-icon name="share" :size="38" color="tn-grey-dark" />
				<text class="action-text">{{ t('detailPage.share') }}</text>
			</view>
			<view class="action-icon" @click="toCart">
				<tn-badge v-if="cart.totalCount" :value="cart.totalCount" type="danger">
					<tn-icon name="cart" :size="38" color="tn-grey-dark" />
				</tn-badge>
				<tn-icon v-else name="cart" :size="38" color="tn-grey-dark" />
				<text class="action-text">{{ t('detailPage.cart') }}</text>
			</view>
			<tn-button :plain="true" type="warning" width="28%" @click="addCart">{{ t('detailPage.addCart') }}</tn-button>
			<tn-button type="danger" width="28%" @click="buyNow">{{ t('detailPage.buyNow') }}</tn-button>
		</view>

		<view class="bottom-space" />
	</view>
</template>

<style lang="scss" scoped>
.page {
	background-color: var(--demo-soft);
}

.nav-title {
	font-size: 30rpx;
	font-weight: 600;
}

.nav-right {
	display: flex;
	align-items: center;
}

.album {
	padding: 16rpx 24rpx 0;
	background-color: var(--demo-surface);
}

.price-card {
	margin: 16rpx 24rpx 0;
	padding: 24rpx;
	background: linear-gradient(135deg, #ffffff 0%, #f2fbff 100%);
	border-radius: 20rpx;
	display: flex;
	flex-direction: column;
}

.price-symbol {
	font-size: 26rpx;
	font-weight: 700;
	color: #ff444f;
}

.price-value {
	font-size: 48rpx;
	font-weight: 700;
	color: #ff444f;
	line-height: 1;
}

.price-origin {
	margin-left: 12rpx;
	font-size: 24rpx;
	color: var(--demo-faint);
	text-decoration: line-through;
}

.goods-title {
	margin-top: 14rpx;
	font-size: 30rpx;
	font-weight: 600;
	color: var(--demo-text);
}

.goods-subtitle {
	margin-top: 8rpx;
	font-size: 24rpx;
	color: var(--demo-faint);
}

.sales {
	margin-left: 12rpx;
	font-size: 22rpx;
	color: var(--demo-faint);
}

.countdown-row {
	margin-top: 20rpx;
	padding-top: 18rpx;
	border-top: 1rpx dashed #e6e9ef;
	display: flex;
	align-items: center;
	justify-content: space-between;
}

.countdown-label {
	margin-left: 8rpx;
	font-size: 24rpx;
	font-weight: 600;
	color: #ff444f;
}

.cell-card {
	margin: 16rpx 24rpx 0;
	padding: 26rpx 24rpx;
	background-color: var(--demo-surface);
	border-radius: 16rpx;
	display: flex;
	align-items: center;
	justify-content: space-between;
}

.cell-title {
	margin-left: 8rpx;
	font-size: 26rpx;
	color: var(--demo-text);
}

.cell-value {
	margin-right: 8rpx;
	font-size: 24rpx;
	color: var(--demo-faint);
}

.block-card {
	margin: 16rpx 24rpx 0;
	padding: 26rpx 24rpx;
	background-color: var(--demo-surface);
	border-radius: 16rpx;
}

.block-title {
	font-size: 28rpx;
	font-weight: 600;
	color: var(--demo-text);
}

.param-row {
	display: flex;
	padding: 12rpx 0;
	border-bottom: 1rpx solid #f2f4f8;
}

.param-label {
	width: 160rpx;
	font-size: 24rpx;
	color: var(--demo-faint);
}

.param-value {
	flex: 1;
	font-size: 24rpx;
	color: var(--demo-text);
}

.paragraph {
	font-size: 24rpx;
	line-height: 1.9;
	color: var(--demo-muted);
	padding: 8rpx 0;
}

.detail-image {
	width: 100%;
	margin-top: 12rpx;
	border-radius: 14rpx;
}

.popup-inner {
	padding: 40rpx 32rpx 32rpx;
}

.popup-title {
	font-size: 30rpx;
	font-weight: 600;
	color: var(--demo-text);
}

.coupon-item {
	margin-top: 24rpx;
	padding: 20rpx 24rpx;
	display: flex;
	align-items: center;
	justify-content: space-between;
	background-color: #fff3f3;
	border-radius: 16rpx;
}

.coupon-left {
	display: flex;
	align-items: baseline;
}

.coupon-value {
	font-size: 40rpx;
	font-weight: 700;
	color: #ff444f;
}

.coupon-cond {
	margin-left: 12rpx;
	font-size: 22rpx;
	color: var(--demo-faint);
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
	background-color: var(--demo-surface);
	box-shadow: 0 -6rpx 24rpx rgba(0, 0, 0, 0.06);
}

.action-icon {
	display: flex;
	flex-direction: column;
	align-items: center;
}

.action-text {
	font-size: 20rpx;
	color: var(--demo-muted);
}

.bottom-space {
	height: 240rpx;
}
</style>
