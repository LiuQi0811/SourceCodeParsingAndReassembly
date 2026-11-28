<script lang="ts" setup>
import { computed, ref, watch } from 'vue'
import { onLoad, onReachBottom, onPullDownRefresh } from '@dcloudio/uni-app'
import { useCartStore, type GoodsItem } from '@/stores/cart'
import { useUserStore } from '@/stores/user'
import { request, RequestError, BusinessError } from '@/utils/request'

const cart = useCartStore()
const user = useUserStore()

const goodsList: GoodsItem[] = [
	{ id: 201, title: 'Tuniao 极简保温杯', price: 89, image: '/static/demo/goods-1.jpg', tag: '热卖' },
	{ id: 202, title: '蓝青渐变帆布袋', price: 49, image: '/static/demo/goods-2.jpg', tag: '新款' },
	{ id: 203, title: '桌面理线收纳盒', price: 39, image: '/static/demo/goods-3.jpg', tag: '包邮' },
]

interface OrderItem {
	id: string
	title: string
	amount: string
	status: string
	tagType: 'primary' | 'success' | 'warning' | 'danger' | 'info'
	time: string
}

const PAGE_SIZE = 5
const TOTAL = 17
const orders = ref<OrderItem[]>([])
const page = ref(0)
const loading = ref(false)
const hasMore = computed(() => orders.value.length < TOTAL)

const orderTitles = ['TuniaoUI 主题皮肤', '组件库年度授权', '图标字体扩展包', '小程序云开发套餐', '设计资源合集', '工程化咨询服务']
const orderStatus = [
	{ status: '待付款', tagType: 'warning' as const },
	{ status: '待发货', tagType: 'primary' as const },
	{ status: '已完成', tagType: 'success' as const },
	{ status: '退款中', tagType: 'danger' as const },
]

function makeOrders(pageNo: number): OrderItem[] {
	const start = (pageNo - 1) * PAGE_SIZE
	const size = Math.min(PAGE_SIZE, TOTAL - start)
	return Array.from({ length: size }, (_, index) => {
		const seq = start + index + 1
		const state = orderStatus[(seq - 1) % orderStatus.length]
		return {
			id: `TN${String(20260000 + seq)}`,
			title: orderTitles[(seq - 1) % orderTitles.length],
			amount: (59 + seq * 13.5).toFixed(2),
			status: state.status,
			tagType: state.tagType,
			time: `2026-11-${String(10 + (seq % 15)).padStart(2, '0')} 14:${String(20 + (seq % 30)).padStart(2, '0')}`,
		}
	})
}

async function loadOrders(reset = false) {
	if (loading.value) return
	if (!reset && !hasMore.value) {
		uni.showToast({ title: '没有更多订单了', icon: 'none' })
		return
	}
	loading.value = true
	const nextPage = reset ? 1 : page.value + 1
	try {
		const result = await request<{ list: OrderItem[]; total: number }>({
			url: `/orders?page=${nextPage}`,
			loading: false,
			mock: () => ({ list: makeOrders(nextPage), total: TOTAL }),
		})
		orders.value = reset ? result.list : [...orders.value, ...result.list]
		page.value = nextPage
	} catch (error) {
		uni.showToast({ title: '订单加载失败', icon: 'none' })
	} finally {
		loading.value = false
	}
}

onLoad(() => {
	loadOrders(true)
})

onReachBottom(() => {
	loadOrders()
})

onPullDownRefresh(async () => {
	await loadOrders(true)
	uni.stopPullDownRefresh()
	uni.showToast({ title: '已刷新', icon: 'none' })
})

async function handleLogin() {
	if (user.logging) return
	let code = 'mock-code'
	// #ifdef MP-WEIXIN
	code = await new Promise<string>((resolve) => {
		uni.login({
			success: (res) => resolve(res.code || 'mock-code'),
			fail: () => resolve('mock-code'),
		})
	})
	// #endif
	try {
		await user.login(code)
		uni.showToast({ title: '登录成功', icon: 'success' })
	} catch (error) {
		uni.showToast({ title: '登录失败，请重试', icon: 'none' })
	}
}

function addGoods(goods: GoodsItem) {
	cart.add(goods)
	uni.showToast({ title: '已加入购物车', icon: 'none' })
}

function goCart() {
	uni.navigateTo({ url: '/pages/cart/index' })
}

async function simulate401() {
	try {
		await request({
			url: '/orders',
			mock: () => {
				throw new RequestError('登录已过期', 401)
			},
		})
	} catch (error) {
		if (error instanceof RequestError && error.statusCode === 401) {
			user.expire()
			uni.showToast({ title: '401：已清空登录态', icon: 'none' })
			return
		}
		uni.showToast({ title: '模拟失败', icon: 'none' })
	}
}

/** ---------------- 请求封装进阶 ---------------- */
const requestProbe = ref('尚未测试进阶能力')

async function simulateEnvelope() {
	requestProbe.value = '请求中……'
	try {
		const data = await request<{ name: string; permissions: string[] }>({
			url: '/demo/envelope',
			mock: () => ({
				code: 0,
				data: { name: 'TuniaoUI', permissions: ['read', 'write'] },
				message: 'ok',
			}),
		})
		requestProbe.value = `code = 0 已解包：${data.name} / ${data.permissions.join('、')}`
	} catch (error) {
		requestProbe.value = `解包失败：${(error as Error).message}`
	}
}

async function simulateBusinessError() {
	requestProbe.value = '请求中……'
	try {
		await request({
			url: '/demo/biz',
			mock: () => ({ code: 5001, message: '库存不足，无法下单' }),
		})
		requestProbe.value = '没有触发业务错误'
	} catch (error) {
		if (error instanceof BusinessError) {
			requestProbe.value = `BusinessError：code = ${error.code}，${error.message}`
			return
		}
		requestProbe.value = `其他错误：${(error as Error).message}`
	}
}

async function simulateAbort() {
	// #ifdef H5
	requestProbe.value = '请求中……'
	const controller = new AbortController()
	const timer = setTimeout(() => controller.abort(), 120)
	try {
		await request({
			url: '/demo/slow',
			delay: 500,
			mock: () => ({ ok: true }),
			signal: controller.signal,
		})
		requestProbe.value = '没有被取消（异常）'
	} catch (error) {
		requestProbe.value =
			error instanceof RequestError && error.statusCode === -1
				? 'AbortController.signal 已取消请求'
				: `取消失败：${(error as Error).message}`
	} finally {
		clearTimeout(timer)
	}
	// #endif
	// #ifndef H5
	requestProbe.value = '小程序 / App 请直接调用 uni.request 返回的 RequestTask.abort()'
	// #endif
}

const points = [
	'Pinia setup store：user / cart 两个独立 store',
	'uni.request 统一封装：BASE_URL、token 注入、业务码、401 兜底',
	'uni.login 获取 code，换取 token 后写入本地缓存',
	'购物车 watch 深层监听 + setStorageSync 持久化',
	'onReachBottom 上拉分页、hasMore 守卫、onPullDownRefresh 重置',
	'tabBar 角标：uni.setTabBarBadge 可接购物车数量',
]

const pointItems = points.map((text, index) => ({
	no: String(index + 1).padStart(2, '0'),
	text,
}))

// 购物车数量同步到「我的」tabBar 角标，演示 uni.setTabBarBadge
watch(
	() => cart.totalCount,
	(count) => {
		if (count > 0) {
			uni.setTabBarBadge({ index: 4, text: String(count), fail: () => {} })
			return
		}
		uni.removeTabBarBadge({ index: 4, fail: () => {} })
	},
	{ immediate: true },
)
</script>

<template>
	<view class="biz">
		<view class="biz-hero">
			<view class="biz-hero__glow" />
			<text class="biz-hero__eyebrow">BUSINESS LOOP</text>
			<text class="biz-hero__title">从组件到业务闭环</text>
			<text class="biz-hero__desc">
				登录态、请求封装、购物车持久化、订单分页与刷新，一条链路走完。
			</text>
			<view class="biz-hero__chips">
				<text class="biz-chip">Pinia</text>
				<text class="biz-chip">Request</text>
				<text class="biz-chip">Auth</text>
				<text class="biz-chip">Pagination</text>
			</view>
		</view>

		<view class="panel">
			<view class="panel__head">
				<view class="panel__title-wrap">
					<text class="panel__eyebrow">ACCOUNT</text>
					<text class="panel__title">登录态</text>
				</view>
				<tn-tag :type="user.isLoggedIn ? 'success' : 'info'" size="sm">
					{{ user.isLoggedIn ? '已登录' : '未登录' }}
				</tn-tag>
			</view>

			<view v-if="!user.isLoggedIn" class="account">
				<view class="account__avatar account__avatar--empty">
					<tn-icon name="my" :size="30" color="#2f6bff" />
				</view>
				<view class="account__body">
					<text class="account__name">还没有登录</text>
					<text class="account__meta">uni.login 换 code，再由后端签发 token</text>
				</view>
				<tn-button type="primary" size="sm" shape="round" :loading="user.logging" @click="handleLogin">
					一键登录
				</tn-button>
			</view>

			<view v-else class="account">
				<tn-avatar :url="user.profile?.avatar || ''" :size="56" />
				<view class="account__body">
					<text class="account__name">{{ user.profile?.nickname || 'Tuniao 用户' }}</text>
					<text class="account__meta">{{ user.profile?.phone }} · {{ user.profile?.level }}</text>
				</view>
				<tn-button type="danger" size="sm" plain shape="round" @click="user.logout()">
					退出
				</tn-button>
			</view>

			<view class="token-box">
				<text class="token-box__label">TOKEN</text>
				<text class="token-box__value">{{ user.maskedToken }}</text>
			</view>

			<view class="inline-actions">
				<tn-button type="warning" size="sm" plain shape="round" @click="simulate401">
					模拟 401
				</tn-button>
				<text class="inline-actions__hint">401 会自动清空 token 并提示重新登录</text>
			</view>
		</view>

		<view class="panel">
			<view class="panel__head">
				<view class="panel__title-wrap">
					<text class="panel__eyebrow">REQUEST LAYER</text>
					<text class="panel__title">请求封装进阶</text>
				</view>
				<tn-tag type="primary" size="sm">timeout / retry</tn-tag>
			</view>

			<view class="request-probe">{{ requestProbe }}</view>
			<view class="inline-actions">
				<tn-button type="primary" size="sm" plain shape="round" @click="simulateEnvelope">业务码解包</tn-button>
				<tn-button type="warning" size="sm" plain shape="round" @click="simulateBusinessError">业务错误</tn-button>
				<tn-button type="info" size="sm" plain shape="round" @click="simulateAbort">取消请求</tn-button>
			</view>
			<text class="inline-actions__hint">
				真实请求支持 .env 基础地址、Bearer token、10s 超时、5xx / 408 指数退避重试、上传 / 下载进度；Mock 也会走同一套 code 解包。
			</text>
		</view>

		<view class="panel">
			<view class="panel__head">
				<view class="panel__title-wrap">
					<text class="panel__eyebrow">PINIA STORE</text>
					<text class="panel__title">购物车</text>
				</view>
				<tn-tag type="primary" size="sm">{{ cart.totalCount }} 件</tn-tag>
			</view>

			<view class="goods-strip">
				<view v-for="item in goodsList" :key="item.id" class="goods-card">
					<image class="goods-card__img" :src="item.image" mode="aspectFill" />
					<text class="goods-card__tag">{{ item.tag }}</text>
					<text class="goods-card__title">{{ item.title }}</text>
					<text class="goods-card__price">¥{{ item.price }}</text>
					<tn-button class="goods-card__btn" type="primary" size="sm" shape="round" @click="addGoods(item)">
						加入
					</tn-button>
				</view>
			</view>

			<view v-if="cart.lines.length" class="cart-lines">
				<view v-for="line in cart.lines" :key="line.id" class="cart-line">
					<image class="cart-line__img" :src="line.image" mode="aspectFill" />
					<view class="cart-line__body">
						<text class="cart-line__title">{{ line.title }}</text>
						<text class="cart-line__price">¥{{ line.price }} / 件</text>
					</view>
					<view class="stepper">
						<text class="stepper__btn" @click="cart.decrease(line.id)">−</text>
						<text class="stepper__value">{{ line.count }}</text>
						<text class="stepper__btn" @click="cart.increase(line.id)">＋</text>
					</view>
					<text class="cart-line__subtotal">¥{{ line.subtotal }}</text>
				</view>
			</view>
			<view v-else class="empty">
				<tn-icon name="cart" :size="34" color="#94a3b8" />
				<text class="empty__text">购物车还是空的，点上面的“加入”试试</text>
			</view>

			<view v-if="cart.lines.length" class="cart-total">
				<text class="cart-total__label">合计</text>
				<text class="cart-total__value">¥{{ cart.totalText }}</text>
				<tn-button type="primary" size="sm" shape="round" @click="goCart">去购物车</tn-button>
				<tn-button type="info" size="sm" plain shape="round" @click="cart.clear()">清空</tn-button>
			</view>

			<text class="panel__hint">watch(items) 深层监听 → setStorageSync 持久化，冷启动可恢复</text>
		</view>

		<view class="panel">
			<view class="panel__head">
				<view class="panel__title-wrap">
					<text class="panel__eyebrow">PAGINATION</text>
					<text class="panel__title">订单分页</text>
				</view>
				<tn-tag type="info" size="sm">已加载 {{ orders.length }} / {{ TOTAL }}</tn-tag>
			</view>

			<view class="order-list">
				<view v-for="order in orders" :key="order.id" class="order-card">
					<view class="order-card__top">
						<text class="order-card__no">{{ order.id }}</text>
						<tn-tag :type="order.tagType" size="sm">{{ order.status }}</tn-tag>
					</view>
					<text class="order-card__title">{{ order.title }}</text>
					<view class="order-card__bottom">
						<text class="order-card__time">{{ order.time }}</text>
						<text class="order-card__amount">¥{{ order.amount }}</text>
					</view>
				</view>
				<view v-if="!orders.length" class="empty">
					<tn-icon name="list" :size="34" color="#94a3b8" />
					<text class="empty__text">{{ loading ? '订单加载中…' : '订单为空，点击下方重新加载' }}</text>
				</view>
			</view>

			<view class="load-state" @click="loadOrders()">
				<text v-if="loading" class="load-state__text">加载中…</text>
				<text v-else-if="hasMore" class="load-state__text">上拉加载更多 · 点击也可触发</text>
				<text v-else class="load-state__text">没有更多了</text>
			</view>

			<text class="panel__hint">onReachBottom / onPullDownRefresh / page / hasMore 守卫</text>
		</view>

		<view class="panel panel--dark">
			<view class="panel__head">
				<view class="panel__title-wrap">
					<text class="panel__eyebrow panel__eyebrow--light">CHECKLIST</text>
					<text class="panel__title panel__title--light">这一页覆盖的知识点</text>
				</view>
			</view>
			<view v-for="point in pointItems" :key="point.text" class="point">
				<text class="point__index">{{ point.no }}</text>
				<text class="point__text">{{ point.text }}</text>
			</view>
		</view>
	</view>
</template>

<style lang="scss" scoped>
.biz {
	padding: 20rpx 0 48rpx;
}

.biz-hero {
	position: relative;
	margin: 0 28rpx 24rpx;
	padding: 34rpx 30rpx;
	border-radius: 32rpx;
	overflow: hidden;
	background: linear-gradient(145deg, #0b1220 0%, #172554 58%, #1e40af 100%);
	box-shadow: 0 20rpx 50rpx rgba(15, 23, 42, 0.2);
}

.biz-hero__glow {
	position: absolute;
	top: -160rpx;
	right: -100rpx;
	width: 340rpx;
	height: 340rpx;
	border-radius: 50%;
	background: radial-gradient(circle, rgba(34, 211, 238, 0.4) 0%, rgba(34, 211, 238, 0) 70%);
}

.biz-hero__eyebrow {
	position: relative;
	display: block;
	font-size: 18rpx;
	font-weight: 600;
	letter-spacing: 3rpx;
	color: #67e8f9;
}

.biz-hero__title {
	position: relative;
	display: block;
	margin-top: 12rpx;
	font-size: 44rpx;
	font-weight: 800;
	letter-spacing: -1rpx;
	color: #ffffff;
}

.biz-hero__desc {
	position: relative;
	display: block;
	margin-top: 12rpx;
	max-width: 560rpx;
	font-size: 23rpx;
	line-height: 1.7;
	color: rgba(226, 232, 240, 0.76);
}

.biz-hero__chips {
	position: relative;
	display: flex;
	flex-wrap: wrap;
	margin-top: 24rpx;
}

.biz-chip {
	margin-right: 12rpx;
	margin-bottom: 10rpx;
	padding: 8rpx 16rpx;
	border: 1rpx solid rgba(191, 219, 254, 0.22);
	border-radius: 999rpx;
	font-size: 19rpx;
	color: #bfdbfe;
	background: rgba(255, 255, 255, 0.06);
}

.panel {
	margin: 0 28rpx 24rpx;
	padding: 28rpx;
	background: #ffffff;
	border: 1rpx solid #e8eef7;
	border-radius: 28rpx;
	box-shadow: 0 10rpx 30rpx rgba(15, 23, 42, 0.04);
}

.panel--dark {
	background: linear-gradient(145deg, #0f172a 0%, #172554 100%);
	border-color: transparent;
}

.panel__head {
	display: flex;
	align-items: flex-start;
	justify-content: space-between;
	margin-bottom: 22rpx;
}

.panel__title-wrap {
	display: flex;
	flex-direction: column;
}

.panel__eyebrow {
	font-size: 18rpx;
	font-weight: 600;
	letter-spacing: 2rpx;
	color: #2f6bff;
}

.panel__eyebrow--light {
	color: #67e8f9;
}

.panel__title {
	display: block;
	margin-top: 4rpx;
	font-size: 32rpx;
	font-weight: 700;
	color: #0f172a;
}

.panel__title--light {
	color: #ffffff;
}

.panel__hint {
	display: block;
	margin-top: 18rpx;
	font-size: 19rpx;
	line-height: 1.6;
	color: #94a3b8;
}

.account {
	display: flex;
	align-items: center;
	padding: 20rpx;
	background: #f8fafc;
	border: 1rpx solid #eef2f8;
	border-radius: 20rpx;
}

.account__avatar {
	width: 56rpx;
	height: 56rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	border-radius: 50%;
	background: #eef4ff;
}

.account__body {
	flex: 1;
	margin-left: 16rpx;
	display: flex;
	flex-direction: column;
}

.account__name {
	font-size: 26rpx;
	font-weight: 600;
	color: #0f172a;
}

.account__meta {
	margin-top: 5rpx;
	font-size: 19rpx;
	color: #7b8794;
}

.token-box {
	display: flex;
	align-items: center;
	margin-top: 18rpx;
	padding: 16rpx 18rpx;
	border-radius: 14rpx;
	background: #0f172a;
}

.token-box__label {
	font-size: 18rpx;
	font-weight: 700;
	letter-spacing: 2rpx;
	color: #67e8f9;
}

.token-box__value {
	flex: 1;
	margin-left: 16rpx;
	font-size: 19rpx;
	letter-spacing: 1rpx;
	color: #cbd5e1;
}

.request-probe {
	margin-top: 18rpx;
	padding: 18rpx;
	border-radius: 14rpx;
	background: #f2f7ff;
	font-size: 22rpx;
	line-height: 1.6;
	color: #376b9e;
	word-break: break-all;
}

.inline-actions {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: 12rpx;
	margin-top: 18rpx;
}

.inline-actions__hint {
	flex: 1;
	min-width: 360rpx;
	margin-left: 0;
	font-size: 19rpx;
	line-height: 1.5;
	color: #94a3b8;
}

.goods-strip {
	display: flex;
}

.goods-card {
	position: relative;
	flex: 1;
	margin-right: 14rpx;
	padding: 12rpx;
	background: #f8fafc;
	border: 1rpx solid #eef2f8;
	border-radius: 18rpx;
	display: flex;
	flex-direction: column;
}

.goods-card:last-child {
	margin-right: 0;
}

.goods-card__img {
	width: 100%;
	height: 150rpx;
	border-radius: 12rpx;
}

.goods-card__tag {
	position: absolute;
	top: 20rpx;
	left: 20rpx;
	padding: 4rpx 10rpx;
	border-radius: 8rpx;
	font-size: 17rpx;
	color: #ffffff;
	background: rgba(15, 23, 42, 0.72);
}

.goods-card__title {
	display: -webkit-box;
	margin-top: 10rpx;
	font-size: 21rpx;
	line-height: 1.4;
	color: #0f172a;
	overflow: hidden;
	-webkit-box-orient: vertical;
	-webkit-line-clamp: 2;
}

.goods-card__price {
	margin-top: 4rpx;
	font-size: 22rpx;
	font-weight: 700;
	color: #f97316;
}

.goods-card__btn {
	margin-top: 10rpx;
}

.cart-lines {
	margin-top: 20rpx;
	padding-top: 4rpx;
	border-top: 1rpx solid #f0f4fa;
}

.cart-line {
	display: flex;
	align-items: center;
	padding: 18rpx 0;
	border-bottom: 1rpx solid #f0f4fa;
}

.cart-line:last-child {
	border-bottom: none;
}

.cart-line__img {
	width: 76rpx;
	height: 76rpx;
	border-radius: 12rpx;
}

.cart-line__body {
	flex: 1;
	margin-left: 14rpx;
	display: flex;
	flex-direction: column;
}

.cart-line__title {
	font-size: 22rpx;
	color: #0f172a;
}

.cart-line__price {
	margin-top: 3rpx;
	font-size: 18rpx;
	color: #94a3b8;
}

.stepper {
	display: flex;
	align-items: center;
}

.stepper__btn {
	width: 40rpx;
	height: 40rpx;
	line-height: 38rpx;
	text-align: center;
	border: 1rpx solid #e2e8f0;
	border-radius: 10rpx;
	font-size: 24rpx;
	color: #475569;
}

.stepper__value {
	width: 48rpx;
	text-align: center;
	font-size: 22rpx;
	color: #0f172a;
}

.cart-line__subtotal {
	width: 112rpx;
	text-align: right;
	font-size: 22rpx;
	font-weight: 600;
	color: #0f172a;
}

.cart-total {
	display: flex;
	align-items: center;
	margin-top: 18rpx;
	padding-top: 18rpx;
	border-top: 1rpx solid #f0f4fa;
}

.cart-total__label {
	font-size: 20rpx;
	color: #64748b;
}

.cart-total__value {
	flex: 1;
	margin-left: 10rpx;
	font-size: 30rpx;
	font-weight: 700;
	color: #f97316;
}

.empty {
	display: flex;
	flex-direction: column;
	align-items: center;
	padding: 36rpx 0 24rpx;
	border: 1rpx dashed #e2e8f0;
	border-radius: 18rpx;
	background: #fafcff;
}

.empty__text {
	margin-top: 10rpx;
	font-size: 21rpx;
	color: #94a3b8;
}

.order-card {
	margin-bottom: 14rpx;
	padding: 20rpx;
	background: #f8fafc;
	border: 1rpx solid #eef2f8;
	border-radius: 18rpx;
}

.order-card:last-child {
	margin-bottom: 0;
}

.order-card__top {
	display: flex;
	align-items: center;
	justify-content: space-between;
}

.order-card__no {
	font-size: 18rpx;
	letter-spacing: 1rpx;
	color: #94a3b8;
}

.order-card__title {
	display: block;
	margin-top: 10rpx;
	font-size: 24rpx;
	font-weight: 600;
	color: #0f172a;
}

.order-card__bottom {
	display: flex;
	align-items: center;
	justify-content: space-between;
	margin-top: 10rpx;
}

.order-card__time {
	font-size: 18rpx;
	color: #94a3b8;
}

.order-card__amount {
	font-size: 24rpx;
	font-weight: 700;
	color: #0f172a;
}

.load-state {
	display: flex;
	align-items: center;
	justify-content: center;
	margin-top: 18rpx;
	padding: 18rpx 0;
	border-radius: 14rpx;
	background: #f8fafc;
}

.load-state__text {
	font-size: 20rpx;
	color: #64748b;
}

.point {
	display: flex;
	align-items: flex-start;
	padding: 14rpx 0;
	border-bottom: 1rpx solid rgba(255, 255, 255, 0.08);
}

.point:last-child {
	border-bottom: none;
}

.point__index {
	width: 42rpx;
	font-size: 18rpx;
	font-weight: 700;
	letter-spacing: 1rpx;
	color: #67e8f9;
}

.point__text {
	flex: 1;
	font-size: 21rpx;
	line-height: 1.65;
	color: rgba(226, 232, 240, 0.82);
}
</style>
