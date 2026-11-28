/* 演示数据持久化：把当前内存 store 快照到 localStorage，刷新后恢复；不接后端 */
import { watch } from 'vue'
import type { QQGroupAlbum, QQGroupCheckin, QQGroupMeta, QQGroupTodo, QQGroupVote } from './types'
import { qqStore } from './store'

const STORAGE_KEY = 'qq-demo-state'
const VERSION = 1
const SAVE_DELAY = 160

interface PersistedState {
	version: number
	savedAt: string
	contacts: typeof qqStore.contacts
	conversations: typeof qqStore.conversations
	messages: typeof qqStore.messages
	moments: typeof qqStore.moments
	channels: typeof qqStore.channels
	friendRequests: typeof qqStore.friendRequests
	groupMeta: Record<string, QQGroupMeta>
	groupTodos: QQGroupTodo[]
	groupVotes: QQGroupVote[]
	groupAlbums: QQGroupAlbum[]
	groupCheckins: Record<string, QQGroupCheckin>
	setting: {
		notify: boolean
		sound: boolean
		vibrate: boolean
		enterSend: boolean
	}
}

let started = false
let saveTimer: ReturnType<typeof setTimeout> | null = null
let restoring = false
// 重置后到页面刷新前暂停写入，避免把旧内存状态又写回本地
let paused = false

function makeSnapshot(): PersistedState {
	return {
		version: VERSION,
		savedAt: new Date().toISOString(),
		contacts: qqStore.contacts,
		conversations: qqStore.conversations,
		messages: qqStore.messages,
		moments: qqStore.moments,
		channels: qqStore.channels,
		friendRequests: qqStore.friendRequests,
		groupMeta: qqStore.groupMeta,
		groupTodos: qqStore.groupTodos,
		groupVotes: qqStore.groupVotes,
		groupAlbums: qqStore.groupAlbums,
		groupCheckins: qqStore.groupCheckins,
		setting: {
			notify: qqStore.setting.notify,
			sound: qqStore.setting.sound,
			vibrate: qqStore.setting.vibrate,
			enterSend: qqStore.setting.enterSend,
		},
	}
}

/** 立即写入本地快照（重置或离开页面前可主动调用） */
export function persistNow() {
	if (restoring || paused) return
	try {
		uni.setStorageSync(STORAGE_KEY, JSON.stringify(makeSnapshot()))
	} catch (e) {
		console.warn('[qq-demo] 保存演示数据失败', e)
	}
}

function schedulePersist() {
	if (restoring || paused || saveTimer) return
	saveTimer = setTimeout(() => {
		saveTimer = null
		persistNow()
	}, SAVE_DELAY)
}

function replaceArray<T>(target: T[], value: unknown) {
	if (!Array.isArray(value)) return
	target.splice(0, target.length, ...(value as T[]))
}

function restorePersistedState() {
	let saved: PersistedState | null = null
	try {
		const raw = uni.getStorageSync(STORAGE_KEY)
		saved = raw ? (JSON.parse(raw) as PersistedState) : null
	} catch (e) {
		console.warn('[qq-demo] 读取演示数据失败，使用初始 mock', e)
	}
	if (!saved || saved.version !== VERSION) return

	restoring = true
	try {
		replaceArray(qqStore.contacts, saved.contacts)
		replaceArray(qqStore.conversations, saved.conversations)
		replaceArray(qqStore.moments, saved.moments)
		replaceArray(qqStore.channels, saved.channels)
		replaceArray(qqStore.friendRequests, saved.friendRequests)
		replaceArray(qqStore.groupTodos, saved.groupTodos)
		replaceArray(qqStore.groupVotes, saved.groupVotes)
		replaceArray(qqStore.groupAlbums, saved.groupAlbums)

		if (saved.messages && typeof saved.messages === 'object') {
			Object.keys(qqStore.messages).forEach((key) => delete qqStore.messages[key])
			Object.assign(qqStore.messages, saved.messages)
		}

		if (saved.groupMeta && typeof saved.groupMeta === 'object') {
			Object.keys(qqStore.groupMeta).forEach((key) => delete qqStore.groupMeta[key])
			Object.assign(qqStore.groupMeta, saved.groupMeta)
		}

		if (saved.groupCheckins && typeof saved.groupCheckins === 'object') {
			Object.keys(qqStore.groupCheckins).forEach((key) => delete qqStore.groupCheckins[key])
			Object.assign(qqStore.groupCheckins, saved.groupCheckins)
		}

		if (saved.setting) {
			qqStore.setting.notify = !!saved.setting.notify
			qqStore.setting.sound = !!saved.setting.sound
			qqStore.setting.vibrate = !!saved.setting.vibrate
			qqStore.setting.enterSend = !!saved.setting.enterSend
		}
	} finally {
		restoring = false
	}
}

/**
 * App 启动时调用：先恢复快照，再开始监听。
 * 先恢复再 watch，避免初始 mock 覆盖掉已保存的演示进度。
 */
export function initPersistence() {
	if (started) return
	started = true
	restorePersistedState()
	watch(qqStore, schedulePersist, { deep: true })
}

/** 清空本地演示快照，不处理登录态与主题（由调用方决定是否一并重置） */
export function clearPersistedState() {
	paused = true
	if (saveTimer) {
		clearTimeout(saveTimer)
		saveTimer = null
	}
	try {
		uni.removeStorageSync(STORAGE_KEY)
	} catch (e) {
		/* ignore */
	}
}
