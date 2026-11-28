/* 页面跳转统一封装：Tab 页用 reLaunch，避免页面栈无限增长 */
import { openConversationWith } from './store'

export const TAB_PATHS = {
	message: '/pages/qq/message/index',
	contact: '/pages/qq/contact/index',
	channel: '/pages/qq/channel/index',
	dynamic: '/pages/qq/dynamic/index',
	mine: '/pages/qq/mine/index',
} as const

export type QQTabName = keyof typeof TAB_PATHS

export function goTab(name: QQTabName) {
	uni.reLaunch({ url: TAB_PATHS[name] })
}

export function goPage(url: string) {
	uni.navigateTo({ url })
}

export function goChatByConversation(convId: string) {
	uni.navigateTo({ url: `/pages/qq/chat/index?id=${convId}` })
}

/** 从联系人资料卡发起聊天 */
export function goChatWithUser(userId: string) {
	const convId = openConversationWith(userId)
	uni.navigateTo({ url: `/pages/qq/chat/index?id=${convId}` })
}

export function goUserDetail(userId: string) {
	uni.navigateTo({ url: `/pages/qq/contact-detail/index?id=${userId}` })
}

export function goSearch() {
	uni.navigateTo({ url: '/pages/qq/search/index' })
}

export function goSettings() {
	uni.navigateTo({ url: '/pages/qq/settings/index' })
}

export function goScan() {
	uni.navigateTo({ url: '/pages/qq/scan/index' })
}

export function goNewGroup() {
	uni.navigateTo({ url: '/pages/qq/new-group/index' })
}

export function goNewFriends() {
	uni.navigateTo({ url: '/pages/qq/new-friends/index' })
}

export function goGroupInfo(convId: string) {
	uni.navigateTo({ url: `/pages/qq/group-info/index?id=${convId}` })
}

export function goMembers(convId: string, manage = false) {
	uni.navigateTo({ url: `/pages/qq/members/index?id=${convId}${manage ? '&manage=1' : ''}` })
}

export function goGroupManage(convId: string) {
	uni.navigateTo({ url: `/pages/qq/group-manage/index?id=${convId}` })
}

export function goGroupFiles(convId: string) {
	uni.navigateTo({ url: `/pages/qq/group-files/index?id=${convId}` })
}

export function goGroupTodo(convId: string) {
	uni.navigateTo({ url: `/pages/qq/group-todo/index?id=${convId}` })
}

export function goGroupVote(convId: string) {
	uni.navigateTo({ url: `/pages/qq/group-vote/index?id=${convId}` })
}

export function goGroupAlbum(convId: string) {
	uni.navigateTo({ url: `/pages/qq/group-album/index?id=${convId}` })
}

export function goGroupCheckin(convId: string) {
	uni.navigateTo({ url: `/pages/qq/group-checkin/index?id=${convId}` })
}

export function goCall(convId: string, mode: 'voice' | 'video') {
	uni.navigateTo({ url: `/pages/qq/call/index?id=${convId}&mode=${mode}` })
}

export function goNotice(convId: string) {
	uni.navigateTo({ url: `/pages/qq/notice/index?id=${convId}` })
}

export function goChatHistory(convId: string) {
	uni.navigateTo({ url: `/pages/qq/chat-history/index?id=${convId}` })
}

export function goFavorites() {
	uni.navigateTo({ url: '/pages/qq/favorites/index' })
}

export function goZone(userId: string) {
	uni.navigateTo({ url: `/pages/qq/zone/index?id=${userId}` })
}

/** 返回上一页，没有页面栈时回消息首页 */
export function goBack(fallback: string = TAB_PATHS.message) {
	const pages = getCurrentPages()
	if (pages.length > 1) {
		uni.navigateBack({ delta: 1 })
	} else {
		uni.reLaunch({ url: fallback })
	}
}
