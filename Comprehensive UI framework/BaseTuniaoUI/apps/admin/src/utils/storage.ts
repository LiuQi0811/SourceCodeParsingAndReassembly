import { STORAGE_PREFIX } from '@/config'

/**
 * 带前缀的本地存储封装
 * 统一走 JSON 序列化，避免各端对对象存储的差异
 */
export const storage = {
  get<T>(key: string, fallback: T | null = null): T | null {
    try {
      const raw = uni.getStorageSync(STORAGE_PREFIX + key)
      if (raw === '' || raw === undefined || raw === null) return fallback
      if (typeof raw === 'string') {
        try {
          return JSON.parse(raw) as T
        } catch (e) {
          return raw as unknown as T
        }
      }
      return raw as T
    } catch (e) {
      return fallback
    }
  },

  set(key: string, value: unknown): void {
    try {
      uni.setStorageSync(STORAGE_PREFIX + key, JSON.stringify(value))
    } catch (e) {
      console.error('[storage] set failed', key, e)
    }
  },

  remove(key: string): void {
    try {
      uni.removeStorageSync(STORAGE_PREFIX + key)
    } catch (e) {
      console.error('[storage] remove failed', key, e)
    }
  },

  clear(): void {
    try {
      uni.clearStorageSync()
    } catch (e) {
      console.error('[storage] clear failed', e)
    }
  },
}
