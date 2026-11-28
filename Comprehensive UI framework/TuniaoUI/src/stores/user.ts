import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { request, TOKEN_KEY } from '@/utils/request'

const PROFILE_KEY = 'tn-demo-profile'

export interface UserProfile {
	nickname: string
	avatar: string
	level: string
	phone: string
}

interface LoginResult {
	token: string
	profile: UserProfile
}

export const useUserStore = defineStore('user', () => {
	const token = ref<string>((uni.getStorageSync(TOKEN_KEY) as string) || '')
	const profile = ref<UserProfile | null>((uni.getStorageSync(PROFILE_KEY) as UserProfile) || null)
	const logging = ref(false)

	const isLoggedIn = computed(() => Boolean(token.value))
	const maskedToken = computed(() => {
		if (!token.value) return '未签发'
		return `${token.value.slice(0, 10)}…${token.value.slice(-6)}`
	})

	function persist() {
		uni.setStorageSync(TOKEN_KEY, token.value)
		uni.setStorageSync(PROFILE_KEY, profile.value)
	}

	/** 用微信登录 code 换 token；示例走 mock，真实项目替换 request 即可 */
	async function login(code = 'mock-code') {
		logging.value = true
		try {
			const result = await request<LoginResult>({
				url: '/auth/login',
				method: 'POST',
				data: { code },
				auth: false,
				loading: true,
				mock: () => ({
					token: `mock-token-${Date.now().toString(36)}`,
					profile: {
						nickname: 'Tuniao 体验官',
						avatar: '/static/demo/goods-1.jpg',
						level: 'VIP 2',
						phone: '138****8888',
					},
				}),
			})
			token.value = result.token
			profile.value = result.profile
			persist()
			return result
		} finally {
			logging.value = false
		}
	}

	function logout() {
		token.value = ''
		profile.value = null
		uni.removeStorageSync(TOKEN_KEY)
		uni.removeStorageSync(PROFILE_KEY)
	}

	/** 模拟 token 失效，用于演示 401 统一拦截 */
	function expire() {
		token.value = ''
		profile.value = null
		uni.removeStorageSync(TOKEN_KEY)
		uni.removeStorageSync(PROFILE_KEY)
	}

	return {
		token,
		profile,
		logging,
		isLoggedIn,
		maskedToken,
		login,
		logout,
		expire,
	}
})
