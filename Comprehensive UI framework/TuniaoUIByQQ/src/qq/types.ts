/* QQ 原型的数据结构定义 */

export interface QQUser {
	id: string
	name: string
	qq: string
	avatarFrom: string
	avatarTo: string
	avatarText?: string
	index?: string
	remark?: string
	signature?: string
	online?: boolean
	vip?: boolean
	level?: number
	gender?: 'male' | 'female'
	region?: string
	birthday?: string
	tags?: string[]
}

export type QQConvType = 'single' | 'group' | 'service'

export interface QQConversation {
	id: string
	type: QQConvType
	targetId: string
	name: string
	avatarFrom: string
	avatarTo: string
	avatarText?: string
	lastMessage: string
	time: string
	unread: number
	pinned?: boolean
	muted?: boolean
	online?: boolean
	members?: number
	draft?: string
	/** 群公告 */
	notice?: string
	/** 群号 */
	groupNo?: string
}

export type QQMessageType =
	| 'text'
	| 'image'
	| 'voice'
	| 'file'
	| 'system'
	| 'group-card'
	| 'video'
	| 'redpacket'
	| 'transfer'

export type QQGroupCardKind = 'todo' | 'vote' | 'checkin'

/** 发到群聊里的群互动卡片（待办 / 投票 / 签到） */
export interface QQGroupCard {
	kind: QQGroupCardKind
	refId: string
	title: string
	sub: string
	badge?: string
}

/** 红包 / 转账的卡片状态 */
export interface QQPaymentInfo {
	amount: number
	note?: string
	status: 'pending' | 'received'
	/** 目标用户，群聊红包可为空 */
	toId?: string
}

export interface QQMessage {
	id: string
	convId: string
	senderId: string
	senderName?: string
	type: QQMessageType
	text?: string
	image?: string
	duration?: number
	card?: QQGroupCard
	payment?: QQPaymentInfo
	/** 视频消息封面 */
	video?: string
	/** 群聊中这条消息是否 @ 了我 */
	mentionsMe?: boolean
	time: string
	/** 引用回复的原消息摘要 */
	quote?: {
		name: string
		text: string
	}
}

export interface QQComment {
	id: string
	userId: string
	content: string
	time: string
}

export interface QQMoment {
	id: string
	userId: string
	content: string
	images: string[]
	location?: string
	time: string
	likes: number
	liked: boolean
	comments: QQComment[]
}

export interface QQChannel {
	id: string
	name: string
	desc: string
	members: string
	emoji: string
	from: string
	to: string
	joined?: boolean
}

/** 新的朋友申请 */
export interface QQFriendRequest {
	id: string
	user: QQUser
	source: string
	message?: string
	time: string
	status: 'pending' | 'accepted' | 'rejected'
}

/** 群管理状态（本地演示） */
export interface QQGroupMeta {
	/** 管理员用户 id（不含群主） */
	admins: string[]
	/** 已移出群聊的用户 id */
	removed: string[]
	/** 全员禁言 */
	allMuted: boolean
	/** 入群审批 */
	approval: boolean
}

/** 群待办 */
export interface QQGroupTodo {
	id: string
	convId: string
	title: string
	creatorId: string
	due: string
	done: boolean
	/** 我是否已完成 */
	joined: boolean
	/** 群内完成人数 */
	doneCount: number
	createdAt: string
}

/** 群投票选项 */
export interface QQGroupVoteOption {
	id: string
	text: string
	votes: number
}

/** 群投票 */
export interface QQGroupVote {
	id: string
	convId: string
	title: string
	desc?: string
	options: QQGroupVoteOption[]
	creatorId: string
	createdAt: string
	deadline: string
	closed: boolean
	/** 我投的选项 id */
	myVote?: string
}

/** 群相册 */
export interface QQGroupAlbum {
	id: string
	convId: string
	name: string
	photos: string[]
	creatorId: string
	createdAt: string
}

/** 群签到榜条目 */
export interface QQGroupCheckinEntry {
	userId: string
	time: string
	streak: number
}

/** 群签到状态（每个群一份） */
export interface QQGroupCheckin {
	convId: string
	checked: boolean
	time?: string
	streak: number
	total: number
	todayCount: number
	board: QQGroupCheckinEntry[]
}

