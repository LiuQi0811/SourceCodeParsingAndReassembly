import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useOrdersStore } from '../src/stores/orders'

const storage = new Map<string, unknown>()

;(globalThis as any).uni = {
	getStorageSync: (key: string) => storage.get(key) ?? '',
	setStorageSync: (key: string, value: unknown) => storage.set(key, value),
}

const baseOrder = {
	orderNo: 'TN20261128001',
	items: [{ id: 101, title: '无线耳机', price: 199, count: 2 }],
	amount: '398.00',
	delivery: 'express',
	payment: 'wechat',
}

beforeEach(() => {
	storage.clear()
	setActivePinia(createPinia())
})

describe('订单记录 store', () => {
	it('新增订单后置顶并写入缓存', () => {
		const store = useOrdersStore()
		store.add(baseOrder)
		expect(store.totalCount).toBe(1)
		expect(store.orders[0].orderNo).toBe(baseOrder.orderNo)
		expect(store.orders[0].status).toBe('paid')
		expect(storage.get('tn-demo-orders')).toEqual(store.orders)
	})

	it('删除单笔订单只保留其余记录', () => {
		const store = useOrdersStore()
		store.add(baseOrder)
		store.add({ ...baseOrder, orderNo: 'TN20261128002' })
		store.remove(store.orders[0].id)
		expect(store.totalCount).toBe(1)
		expect(store.orders[0].orderNo).toBe(baseOrder.orderNo)
	})

	it('清空后缓存同步为空数组', () => {
		const store = useOrdersStore()
		store.add(baseOrder)
		store.clear()
		expect(store.orders).toEqual([])
		expect(storage.get('tn-demo-orders')).toEqual([])
	})

	it('冷启动从缓存恢复订单', () => {
		storage.set('tn-demo-orders', [{ ...baseOrder, id: '1', createdAt: 1, status: 'paid' }])
		const store = useOrdersStore()
		expect(store.totalCount).toBe(1)
		expect(store.orders[0].orderNo).toBe(baseOrder.orderNo)
	})
})
