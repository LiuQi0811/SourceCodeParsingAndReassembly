/** 结算金额计算：抽成纯函数，页面与单元测试共用同一套规则 */
export type DeliveryMode = 'express' | 'pickup'

export interface Coupon {
	value: number
	min: number
}

export const FREE_SHIPPING_THRESHOLD = 99
export const EXPRESS_FEE = 8

export function expressFeeFor(goodsTotal: number) {
	return goodsTotal >= FREE_SHIPPING_THRESHOLD ? 0 : EXPRESS_FEE
}

export function freightFor(goodsTotal: number, delivery: DeliveryMode) {
	return delivery === 'pickup' ? 0 : expressFeeFor(goodsTotal)
}

export function discountFor(goodsTotal: number, coupon: Coupon | null) {
	if (!coupon) return 0
	return goodsTotal >= coupon.min ? coupon.value : 0
}

export function payableFor(goodsTotal: number, coupon: Coupon | null, delivery: DeliveryMode) {
	return Math.max(0, goodsTotal - discountFor(goodsTotal, coupon) + freightFor(goodsTotal, delivery)).toFixed(2)
}
