import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

const ORDERS_KEY = 'tn-demo-orders'

export interface OrderItem {
	id: number
	title: string
	price: number
	count: number
	variant?: string
}

export interface OrderRecord {
	id: string
	orderNo: string
	items: OrderItem[]
	amount: string
	delivery: string
	payment: string
	createdAt: number
	status: 'paid'
}

export const useOrdersStore = defineStore('orders', () => {
	const cached = uni.getStorageSync(ORDERS_KEY) as OrderRecord[] | ''
	const orders = ref<OrderRecord[]>(Array.isArray(cached) ? cached : [])

	const totalCount = computed(() => orders.value.length)

	function persist() {
		uni.setStorageSync(ORDERS_KEY, JSON.parse(JSON.stringify(orders.value)))
	}

	function add(record: Omit<OrderRecord, 'id' | 'createdAt' | 'status'>) {
		const createdAt = Date.now()
		orders.value.unshift({
			...record,
			id: `${createdAt}-${Math.random().toString(36).slice(2, 8)}`,
			createdAt,
			status: 'paid',
		})
		persist()
	}

	function remove(id: string) {
		orders.value = orders.value.filter((item) => item.id !== id)
		persist()
	}

	function clear() {
		orders.value = []
		persist()
	}

	return { orders, totalCount, add, remove, clear }
})
