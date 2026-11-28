/* 全局共享状态：单页应用内所有页面共享同一份内存数据，不依赖 Pinia */
import { computed, reactive } from 'vue'
import {
	channels,
	contacts,
	conversations,
	currentUser,
	friendRequests,
	messages,
	moments,
} from './data'
import { groupAlbums, groupTodos, groupVotes, initialCheckin } from './group-activity'
import type {
	QQChannel,
	QQConversation,
	QQFriendRequest,
	QQGroupAlbum,
	QQGroupCard,
	QQGroupCheckin,
	QQGroupMeta,
	QQGroupTodo,
	QQGroupVote,
	QQMoment,
	QQMessage,
	QQUser,
} from './types'

export const qqStore = reactive({
	loggedIn: false,
	user: currentUser,
	contacts,
	conversations,
	moments,
	channels,
	messages,
	friendRequests,
	setting: {
		notify: true,
		sound: true,
		vibrate: true,
		enterSend: true,
		dark: false,
	},
	// 会话是否处于“对方正在输入”状态
	typing: {} as Record<string, boolean>,
	// 从聊天记录页返回时要定位的消息
	focusConvId: '',
	focusMessageId: '',
	// 群管理状态（管理员 / 已移出成员 / 全员禁言 / 入群审批）
	groupMeta: {} as Record<string, QQGroupMeta>,
	// 群互动：待办 / 投票 / 相册 / 签到
	groupTodos,
	groupVotes,
	groupAlbums,
	groupCheckins: {} as Record<string, QQGroupCheckin>,
})

let seq = 0
const uid = (prefix: string) => `${prefix}-${Date.now()}-${++seq}`

const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`)
export const nowTime = () => {
	const d = new Date()
	return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** 未读消息总数（Tabbar 角标） */
export const unreadTotal = computed(() =>
	qqStore.conversations.reduce((sum, conv) => sum + Math.max(0, conv.unread), 0)
)

/** 置顶会话在前，其余保持原顺序 */
export const sortedConversations = computed(() =>
	[...qqStore.conversations].sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned))
)

export const totalContacts = computed(() => qqStore.contacts.length)

/** 待处理的好友申请数（联系人页角标） */
export const pendingFriendCount = computed(
	() => qqStore.friendRequests.filter((r) => r.status === 'pending').length
)

/** 按状态拆分：待处理 / 已处理 */
export const pendingRequests = computed<QQFriendRequest[]>(() =>
	qqStore.friendRequests.filter((r) => r.status === 'pending')
)

export const handledRequests = computed<QQFriendRequest[]>(() =>
	qqStore.friendRequests.filter((r) => r.status !== 'pending')
)

export function findUser(id: string): QQUser {
	if (id === 'me') return qqStore.user
	return qqStore.contacts.find((u) => u.id === id) || qqStore.user
}

export function findConversation(id: string): QQConversation | undefined {
	return qqStore.conversations.find((c) => c.id === id)
}

/** 取某个群的群管理状态，首次访问时初始化演示管理员 */
export function groupMetaOf(convId: string): QQGroupMeta {
	if (!qqStore.groupMeta[convId]) {
		qqStore.groupMeta[convId] = {
			admins: ['u_suwan', 'u_chenyu'],
			removed: [],
			allMuted: false,
			approval: false,
		}
	}
	return qqStore.groupMeta[convId]
}

export function setGroupAdmin(convId: string, userId: string, isAdmin: boolean) {
	const meta = groupMetaOf(convId)
	if (isAdmin) {
		if (!meta.admins.includes(userId)) meta.admins.push(userId)
	} else {
		meta.admins = meta.admins.filter((id) => id !== userId)
	}
}

export function removeGroupMember(convId: string, userId: string) {
	const meta = groupMetaOf(convId)
	if (!meta.removed.includes(userId)) meta.removed.push(userId)
	const conv = findConversation(convId)
	if (conv && conv.members && conv.members > 1) conv.members -= 1
}

export function renameGroup(convId: string, name: string) {
	const conv = findConversation(convId)
	const next = name.trim()
	if (conv && next) conv.name = next
}

export function setGroupAllMuted(convId: string, allMuted: boolean) {
	groupMetaOf(convId).allMuted = allMuted
}

export function setGroupApproval(convId: string, approval: boolean) {
	groupMetaOf(convId).approval = approval
}

/* ---------------- 群互动 ---------------- */

export function groupTodosOf(convId: string): QQGroupTodo[] {
	return qqStore.groupTodos.filter((t) => t.convId === convId)
}

export function addGroupTodo(convId: string, title: string, due: string) {
	const text = title.trim()
	if (!text) return null
	const todo: QQGroupTodo = {
		id: uid('todo'),
		convId,
		title: text,
		creatorId: 'me',
		due: due || '今天 18:00',
		done: false,
		joined: false,
		doneCount: 0,
		createdAt: '刚刚',
	}
	qqStore.groupTodos.unshift(todo)
	return todo
}

/** 我完成 / 取消完成某条待办 */
export function toggleGroupTodo(todoId: string) {
	const todo = qqStore.groupTodos.find((t) => t.id === todoId)
	if (!todo) return false
	todo.joined = !todo.joined
	todo.done = todo.joined
	todo.doneCount = Math.max(0, todo.doneCount + (todo.joined ? 1 : -1))
	return todo.joined
}

export function removeGroupTodo(todoId: string) {
	const index = qqStore.groupTodos.findIndex((t) => t.id === todoId)
	if (index > -1) qqStore.groupTodos.splice(index, 1)
}

export function groupVotesOf(convId: string): QQGroupVote[] {
	return qqStore.groupVotes.filter((v) => v.convId === convId)
}

export function groupAlbumsOf(convId: string): QQGroupAlbum[] {
	return qqStore.groupAlbums.filter((a) => a.convId === convId)
}

export function createGroupVote(
	convId: string,
	title: string,
	optionTexts: string[],
	deadline = '明天 18:00'
) {
	const text = title.trim()
	const options = optionTexts.map((o) => o.trim()).filter(Boolean)
	if (!text || options.length < 2) return null
	const vote: QQGroupVote = {
		id: uid('vote'),
		convId,
		title: text,
		options: options.map((o, i) => ({ id: `${uid('vo')}-${i}`, text: o, votes: 0 })),
		creatorId: 'me',
		createdAt: '刚刚',
		deadline,
		closed: false,
	}
	qqStore.groupVotes.unshift(vote)
	return vote
}

/** 投一票：每人只能投一次，已结束不可投 */
export function voteGroupPoll(voteId: string, optionId: string) {
	const vote = qqStore.groupVotes.find((v) => v.id === voteId)
	if (!vote || vote.closed || vote.myVote) return false
	const option = vote.options.find((o) => o.id === optionId)
	if (!option) return false
	option.votes += 1
	vote.myVote = optionId
	return true
}

export function closeGroupVote(voteId: string) {
	const vote = qqStore.groupVotes.find((v) => v.id === voteId)
	if (vote) vote.closed = true
}

export function createGroupAlbum(convId: string, name: string, photos: string[] = []) {
	const text = name.trim()
	if (!text) return null
	const album: QQGroupAlbum = {
		id: uid('album'),
		convId,
		name: text,
		photos: [...photos],
		creatorId: 'me',
		createdAt: '刚刚',
	}
	qqStore.groupAlbums.unshift(album)
	return album
}

export function addPhotoToAlbum(albumId: string, photo: string) {
	const album = qqStore.groupAlbums.find((a) => a.id === albumId)
	if (album && photo) album.photos.push(photo)
}

export function groupCheckinOf(convId: string): QQGroupCheckin {
	if (!qqStore.groupCheckins[convId]) {
		const seed = initialCheckin(convId)
		qqStore.groupCheckins[convId] = { ...seed, board: [...seed.board] }
	}
	return qqStore.groupCheckins[convId]
}

/** 群签到：同一会话一天只能签一次（演示用内存状态） */
export function checkInGroup(convId: string) {
	const state = groupCheckinOf(convId)
	if (state.checked) return false
	state.checked = true
	state.time = nowTime()
	state.streak += 1
	state.total += 1
	state.todayCount += 1
	state.board.unshift({ userId: 'me', time: state.time, streak: state.streak })
	return true
}

export function getMessages(convId: string): QQMessage[] {
	if (!qqStore.messages[convId]) qqStore.messages[convId] = []
	return qqStore.messages[convId]
}

/** 清空未读 */
export function markConversationRead(convId: string) {
	const conv = findConversation(convId)
	if (conv) conv.unread = 0
}

/** 从聊天记录页指定一条消息，回到聊天页后定位并高亮 */
export function setChatFocus(convId: string, msgId: string) {
	qqStore.focusConvId = convId
	qqStore.focusMessageId = msgId
}

export function takeChatFocus(convId: string): string {
	if (qqStore.focusConvId !== convId) return ''
	const id = qqStore.focusMessageId
	qqStore.focusConvId = ''
	qqStore.focusMessageId = ''
	return id
}

/** 会话草稿（存在 conversations 上，随本地快照一起持久化） */
export function conversationDraftOf(convId: string) {
	return findConversation(convId)?.draft || ''
}

export function setConversationDraft(convId: string, text: string) {
	const conv = findConversation(convId)
	if (!conv) return
	conv.draft = text
}

/** 群聊中 @ 我的消息（消息列表用 hasUnreadMention 结合未读数判断是否显示 @我 徽标） */
export function conversationMentionMessages(convId: string) {
	return (qqStore.messages[convId] || []).filter(
		(msg) => msg.mentionsMe && msg.senderId !== 'me'
	)
}

export function hasUnreadMention(conv: QQConversation) {
	if (conv.unread <= 0) return false
	return conversationMentionMessages(conv.id).length > 0
}

function previewOf(msg: QQMessage) {
	if (msg.type === 'image') return '[图片]'
	if (msg.type === 'voice') return `[语音] ${msg.duration || 0}"`
	if (msg.type === 'video') return `[视频] ${msg.text || ''}`.trim()
	if (msg.type === 'redpacket') return `[红包] ${msg.payment?.note || '恭喜发财'}`
	if (msg.type === 'transfer') return `[转账] ¥${(msg.payment?.amount || 0).toFixed(2)}`
	if (msg.type === 'group-card' && msg.card) {
		const label = msg.card.kind === 'todo' ? '群待办' : msg.card.kind === 'vote' ? '群投票' : '群签到'
		return `[${label}] ${msg.card.title}`
	}
	return msg.text || ''
}

/** 模拟自己消息的送达过程：发送中 → 已送达 → 单聊已读 */
function simulateDelivery(convId: string, msgId: string) {
	const findMessage = () => (qqStore.messages[convId] || []).find((item) => item.id === msgId)
	setTimeout(() => {
		const msg = findMessage()
		if (!msg || msg.status !== 'sending') return
		msg.status = 'sent'
		const conv = findConversation(convId)
		if (conv?.type !== 'single') return
		setTimeout(() => {
			const current = findMessage()
			if (current && current.status === 'sent') current.status = 'read'
		}, 900)
	}, 450)
}

/** 追加一条消息，并同步会话的最后一条与时间 */
export function appendMessage(convId: string, msg: QQMessage) {
	const list = getMessages(convId)
	if (msg.senderId === 'me' && msg.type !== 'system') msg.status = 'sending'
	list.push(msg)
	if (msg.senderId === 'me' && msg.type !== 'system') simulateDelivery(convId, msg.id)
	const conv = findConversation(convId)
	if (!conv) return msg
	const base = previewOf(msg)
	const sender =
		msg.senderId === 'me' ? qqStore.user.name : msg.senderName || findUser(msg.senderId).name
	conv.lastMessage = conv.type === 'group' && msg.senderId !== 'me' ? `${sender}：${base}` : base
	conv.time = nowTime()
	conv.unread = 0
	return msg
}

/** 用消息列表的最后一条刷新会话预览 */
function syncConversationPreview(convId: string) {
	const conv = findConversation(convId)
	if (!conv) return
	const list = getMessages(convId)
	const last = list[list.length - 1]
	if (!last) {
		conv.lastMessage = '开始聊天吧'
		return
	}
	const base = previewOf(last)
	const sender =
		last.senderId === 'me' ? qqStore.user.name : last.senderName || findUser(last.senderId).name
	conv.lastMessage =
		conv.type === 'group' && last.senderId !== 'me' && last.senderId !== 'system'
			? `${sender}：${base}`
			: base
}

/** 删除一条消息，并同步会话的最后一条预览 */
export function removeMessage(convId: string, msgId: string) {
	const list = getMessages(convId)
	const index = list.findIndex((m) => m.id === msgId)
	if (index === -1) return
	list.splice(index, 1)
	syncConversationPreview(convId)
}

/** 批量删除消息，返回实际删除的条数 */
export function removeMessages(convId: string, msgIds: string[]) {
	const list = getMessages(convId)
	const ids = new Set(msgIds)
	const before = list.length
	for (let i = list.length - 1; i >= 0; i--) {
		if (ids.has(list[i].id)) list.splice(i, 1)
	}
	const removed = before - list.length
	if (removed > 0) syncConversationPreview(convId)
	return removed
}

/**
 * 把多条消息转发到另一个会话。
 * 转发后以“我”的身份出现在目标会话，引用关系和 @ 状态不带走。
 */
export function forwardMessages(sourceConvId: string, msgIds: string[], targetConvId: string) {
	const sourceList = getMessages(sourceConvId)
	const targetConv = findConversation(targetConvId)
	const ids = new Set(msgIds)
	const selected = sourceList.filter((msg) => ids.has(msg.id) && msg.type !== 'system')
	for (const msg of selected) {
		const copy: QQMessage = {
			...msg,
			id: uid('msg'),
			convId: targetConvId,
			senderId: 'me',
			senderName: undefined,
			mentionsMe: false,
			quote: undefined,
			time: nowTime(),
		}
		if (msg.payment) {
			copy.payment = {
				...msg.payment,
				status: 'pending',
				toId: targetConv?.type === 'single' ? targetConv.targetId : undefined,
			}
		}
		appendMessage(targetConvId, copy)
	}
	return selected.length
}

/** 我发送文字消息 */
export function sendText(convId: string, text: string) {
	const content = text.trim()
	if (!content) return null
	const msg: QQMessage = {
		id: uid('msg'),
		convId,
		senderId: 'me',
		type: 'text',
		text: content,
		time: nowTime(),
	}
	return appendMessage(convId, msg)
}

/** 对方发来文字消息（mentionsMe 用于群聊 @ 提醒） */
export function receiveText(convId: string, senderId: string, text: string, mentionsMe = false) {
	const user = findUser(senderId)
	const msg: QQMessage = {
		id: uid('msg'),
		convId,
		senderId,
		senderName: user.name,
		type: 'text',
		text,
		time: nowTime(),
	}
	if (mentionsMe) msg.mentionsMe = true
	return appendMessage(convId, msg)
}

/** 我发一个红包 */
export function sendRedPacket(convId: string, amount: number, note: string) {
	const msg: QQMessage = {
		id: uid('msg'),
		convId,
		senderId: 'me',
		type: 'redpacket',
		text: note,
		payment: {
			amount: Math.max(0.01, Number(amount) || 0),
			note: note.trim() || '恭喜发财，大吉大利',
			status: 'pending',
		},
		time: nowTime(),
	}
	return appendMessage(convId, msg)
}

/** 我发一笔转账（仅单聊） */
export function sendTransfer(convId: string, amount: number, note: string) {
	const conv = findConversation(convId)
	const msg: QQMessage = {
		id: uid('msg'),
		convId,
		senderId: 'me',
		type: 'transfer',
		text: note,
		payment: {
			amount: Math.max(0.01, Number(amount) || 0),
			note: note.trim() || '转账',
			status: 'pending',
			toId: conv?.type === 'single' ? conv.targetId : undefined,
		},
		time: nowTime(),
	}
	return appendMessage(convId, msg)
}

/** 我发一条视频消息（本地演示，仅封面 + 模拟播放） */
export function sendVideoMessage(convId: string, cover: string, duration: number, label = '') {
	const msg: QQMessage = {
		id: uid('msg'),
		convId,
		senderId: 'me',
		type: 'video',
		video: cover,
		image: cover,
		duration,
		text: label,
		time: nowTime(),
	}
	return appendMessage(convId, msg)
}

/** 点开别人发来的红包 / 转账，标记为已领取 */
export function receivePayment(convId: string, msgId: string) {
	const msg = (qqStore.messages[convId] || []).find((item) => item.id === msgId)
	if (!msg || !msg.payment || msg.senderId === 'me') return false
	if (msg.payment.status === 'received') return false
	msg.payment.status = 'received'
	return true
}

/** 把群待办 / 群投票 / 群签到以卡片消息发到群聊 */
export function sendGroupCard(convId: string, card: QQGroupCard) {
	const msg: QQMessage = {
		id: uid('msg'),
		convId,
		senderId: 'me',
		type: 'group-card',
		card,
		time: nowTime(),
	}
	return appendMessage(convId, msg)
}

/** 置顶 / 取消置顶 */
export function togglePin(convId: string) {
	const conv = findConversation(convId)
	if (conv) conv.pinned = !conv.pinned
}

/** 免打扰开关 */
export function toggleMute(convId: string) {
	const conv = findConversation(convId)
	if (conv) conv.muted = !conv.muted
}

/** 删除会话（消息缓存保留，方便演示时重新进入） */
export function removeConversation(convId: string) {
	const index = qqStore.conversations.findIndex((c) => c.id === convId)
	if (index > -1) qqStore.conversations.splice(index, 1)
}

/** 和某个好友开启聊天（已有会话直接复用） */
export function openConversationWith(userId: string) {
	const exist = qqStore.conversations.find((c) => c.type === 'single' && c.targetId === userId)
	if (exist) return exist.id
	const user = findUser(userId)
	const conv: QQConversation = {
		id: uid('c'),
		type: 'single',
		targetId: userId,
		name: user.name,
		avatarFrom: user.avatarFrom,
		avatarTo: user.avatarTo,
		avatarText: user.avatarText,
		lastMessage: '开始聊天吧',
		time: nowTime(),
		unread: 0,
		online: user.online,
	}
	qqStore.conversations.unshift(conv)
	qqStore.messages[conv.id] = []
	return conv.id
}

/** 创建群聊，返回新会话 id */
export function createGroup(memberIds: string[]) {
	const members = memberIds.map((id) => findUser(id)).filter(Boolean)
	if (!members.length) return null
	const name =
		members.length <= 2
			? members.map((m) => m.name).join('、')
			: `${members[0].name}、${members[1].name}等${members.length}人`
	const conv: QQConversation = {
		id: uid('g'),
		type: 'group',
		targetId: uid('group'),
		name,
		avatarFrom: '#4776e6',
		avatarTo: '#8e54e9',
		lastMessage: `你邀请 ${members.map((m) => m.name).join('、')} 加入了群聊`,
		time: nowTime(),
		unread: 0,
		members: members.length + 1,
	}
	qqStore.conversations.unshift(conv)
	qqStore.messages[conv.id] = [
		{
			id: uid('msg'),
			convId: conv.id,
			senderId: 'system',
			type: 'system',
			text: `你邀请 ${members.map((m) => m.name).join('、')} 加入了群聊`,
			time: nowTime(),
		},
	]
	return conv.id
}

/** 同意好友申请：加入联系人列表，并生成一条会话 */
export function acceptFriendRequest(requestId: string) {
	const request = qqStore.friendRequests.find((r) => r.id === requestId)
	if (!request || request.status !== 'pending') return null
	request.status = 'accepted'
	if (!qqStore.contacts.some((c) => c.id === request.user.id)) {
		qqStore.contacts.push({ ...request.user })
	}
	const convId = openConversationWith(request.user.id)
	const text = '你们已经是好友了，开始聊天吧'
	getMessages(convId).push({
		id: uid('msg'),
		convId,
		senderId: 'system',
		type: 'system',
		text,
		time: nowTime(),
	})
	const conv = findConversation(convId)
	if (conv) {
		conv.lastMessage = text
		conv.time = nowTime()
	}
	return convId
}

/** 拒绝好友申请 */
export function rejectFriendRequest(requestId: string) {
	const request = qqStore.friendRequests.find((r) => r.id === requestId)
	if (!request || request.status !== 'pending') return
	request.status = 'rejected'
}

/** 点赞 / 取消点赞 */
export function toggleLike(momentId: string) {
	const moment = qqStore.moments.find((m) => m.id === momentId)
	if (!moment) return
	moment.liked = !moment.liked
	moment.likes += moment.liked ? 1 : -1
}

/** 评论动态 */
export function addComment(momentId: string, content: string) {
	const moment = qqStore.moments.find((m) => m.id === momentId)
	const text = content.trim()
	if (!moment || !text) return
	moment.comments.push({
		id: uid('mc'),
		userId: 'me',
		content: text,
		time: '刚刚',
	})
}

/** 发布一条自己的动态 */
export function addMoment(content: string, images: string[] = [], location?: string) {
	const text = content.trim()
	if (!text && !images.length) return null
	const moment: QQMoment = {
		id: uid('m'),
		userId: 'me',
		content: text,
		images: [...images],
		location,
		time: '刚刚',
		likes: 0,
		liked: false,
		comments: [],
	}
	qqStore.moments.unshift(moment)
	return moment
}

/** 频道加入 / 退出 */
export function toggleChannel(channel: QQChannel) {
	channel.joined = !channel.joined
}

export function momentsOfUser(userId: string): QQMoment[] {
	return qqStore.moments.filter((m) => m.userId === userId)
}

/** 登录态写入本地缓存，刷新页面仍保持登录 */
export function login() {
	qqStore.loggedIn = true
	uni.setStorageSync('qq-demo-logged-in', '1')
}

export function logout() {
	qqStore.loggedIn = false
	uni.removeStorageSync('qq-demo-logged-in')
}

export function restoreLoginState() {
	try {
		qqStore.loggedIn = uni.getStorageSync('qq-demo-logged-in') === '1'
	} catch (e) {
		qqStore.loggedIn = false
	}
}

/** 深色模式：切换 html 上的 qq-dark 并持久化（H5 专用，其它端静默跳过） */
export function applyTheme() {
	// #ifdef H5
	if (typeof document !== 'undefined') {
		document.documentElement.classList.toggle('qq-dark', qqStore.setting.dark)
	}
	// #endif
	try {
		uni.setStorageSync('qq-demo-dark', qqStore.setting.dark ? '1' : '0')
	} catch (e) {
		/* ignore */
	}
}

export function restoreTheme() {
	try {
		qqStore.setting.dark = uni.getStorageSync('qq-demo-dark') === '1'
	} catch (e) {
		qqStore.setting.dark = false
	}
	applyTheme()
}
