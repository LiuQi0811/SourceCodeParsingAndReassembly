import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'

const CART_KEY = 'tn-demo-cart'

export interface CartItem {
	id: number
	title: string
	price: number
	image: string
	count: number
	/** 规格等附加信息；同一商品不同规格按 key 分开 */
	variant?: string
}

export interface GoodsItem {
	id: number
	title: string
	price: number
	image: string
	tag: string
	variant?: string
}

export function cartKey(item: Pick<CartItem, 'id' | 'variant'>) {
	return `${item.id}::${item.variant || ''}`
}

export const useCartStore = defineStore('cart', () => {
	const cached = uni.getStorageSync(CART_KEY) as CartItem[] | ''
	const items = ref<CartItem[]>(Array.isArray(cached) ? cached : [])

	const totalCount = computed(() => items.value.reduce((sum, item) => sum + item.count, 0))
	const totalPrice = computed(() => items.value.reduce((sum, item) => sum + item.price * item.count, 0))
	const totalText = computed(() => totalPrice.value.toFixed(2))
	const lines = computed(() =>
		items.value.map((item) => ({
			...item,
			key: cartKey(item),
			subtotal: (item.price * item.count).toFixed(2),
		})),
	)

	// 持久化：任何增删改都同步到本地缓存，冷启动可恢复
	watch(
		items,
		(value) => {
			uni.setStorageSync(CART_KEY, JSON.parse(JSON.stringify(value)))
		},
		{ deep: true },
	)

	function add(goods: GoodsItem, count = 1) {
		const key = cartKey(goods)
		const existed = items.value.find((item) => cartKey(item) === key)
		if (existed) {
			existed.count += count
			return key
		}
		items.value.push({
			id: goods.id,
			title: goods.title,
			price: goods.price,
			image: goods.image,
			count,
			variant: goods.variant,
		})
		return key
	}

	function updateCount(key: string, count: number) {
		const target = items.value.find((item) => cartKey(item) === key)
		if (!target) return
		if (count <= 0) {
			removeKey(key)
			return
		}
		target.count = count
	}

	function decreaseKey(key: string) {
		const target = items.value.find((item) => cartKey(item) === key)
		if (!target) return
		if (target.count <= 1) {
			removeKey(key)
			return
		}
		target.count -= 1
	}

	function increaseKey(key: string) {
		const target = items.value.find((item) => cartKey(item) === key)
		if (target) target.count += 1
	}

	function removeKey(key: string) {
		items.value = items.value.filter((item) => cartKey(item) !== key)
	}

	function decrease(id: number) {
		const target = items.value.find((item) => item.id === id)
		if (!target) return
		if (target.count <= 1) {
			remove(id)
			return
		}
		target.count -= 1
	}

	function increase(id: number) {
		const target = items.value.find((item) => item.id === id)
		if (target) target.count += 1
	}

	function remove(id: number) {
		items.value = items.value.filter((item) => item.id !== id)
	}

	function clear() {
		items.value = []
	}

	return {
		items,
		lines,
		totalCount,
		totalPrice,
		totalText,
		add,
		updateCount,
		decreaseKey,
		increaseKey,
		removeKey,
		decrease,
		increase,
		remove,
		clear,
	}
})
