import { describe, expect, it } from 'vitest'
import {
	EXPRESS_FEE,
	FREE_SHIPPING_THRESHOLD,
	discountFor,
	expressFeeFor,
	freightFor,
	payableFor,
} from '../src/utils/pricing'

const coupon20 = { value: 20, min: 199 }
const coupon50 = { value: 50, min: 399 }

describe('结算金额规则', () => {
	it('满 99 免运费，未满收 8 元', () => {
		expect(expressFeeFor(0)).toBe(EXPRESS_FEE)
		expect(expressFeeFor(FREE_SHIPPING_THRESHOLD - 1)).toBe(EXPRESS_FEE)
		expect(expressFeeFor(FREE_SHIPPING_THRESHOLD)).toBe(0)
	})

	it('自提始终免运费', () => {
		expect(freightFor(39, 'pickup')).toBe(0)
		expect(freightFor(39, 'express')).toBe(EXPRESS_FEE)
	})

	it('优惠券达到门槛才抵扣', () => {
		expect(discountFor(198, coupon20)).toBe(0)
		expect(discountFor(199, coupon20)).toBe(20)
		expect(discountFor(398, coupon50)).toBe(0)
		expect(discountFor(399, coupon50)).toBe(50)
	})

	it('应付金额 = 商品小计 - 优惠 + 运费', () => {
		expect(payableFor(238, coupon20, 'express')).toBe('218.00')
		expect(payableFor(238, null, 'pickup')).toBe('238.00')
		expect(payableFor(39, coupon20, 'express')).toBe('47.00')
	})

	it('优惠超过商品金额时兜底为 0', () => {
		expect(payableFor(10, { value: 50, min: 0 }, 'pickup')).toBe('0.00')
	})
})
