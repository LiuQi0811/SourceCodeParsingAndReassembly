<script lang="ts" setup>
	import { computed, nextTick, onMounted, ref, watch } from 'vue'
	import { onLoad, onReady, onUnload } from '@dcloudio/uni-app'
	import {
		appendMessage,
		conversationDraftOf,
		conversationMentionMessages,
		findConversation,
		findUser,
		forwardMessages,
		getMessages,
		groupMetaOf,
		markConversationRead,
		nowTime,
		qqStore,
		receivePayment,
		receiveText,
		removeMessage,
		removeMessages,
		sendRedPacket,
		sendText,
		sendTransfer,
		sendVideoMessage,
		setConversationDraft,
		sortedConversations,
	} from '@/qq/store'
	import {
		goBack,
		goCall,
		goGroupCheckin,
		goGroupInfo,
		goGroupTodo,
		goGroupVote,
		goNotice,
		goUserDetail,
	} from '@/qq/router'
	import type { QQConversation, QQGroupCard, QQMessage } from '@/qq/types'

	const convId = ref('')
	const conv = ref<QQConversation | undefined>()
	const groupMuted = computed(() =>
		conv.value?.type === 'group' ? groupMetaOf(conv.value.id).allMuted : false
	)
	const draft = ref('')
	const emojiOpen = ref(false)
	const moreOpen = ref(false)
	const photoOpen = ref(false)
	const voiceMode = ref(false)
	const recording = ref(false)
	const playingId = ref('')
	let recordStart = 0
	let playTimer: ReturnType<typeof setTimeout> | null = null
	const scrollTarget = ref('')
	const messages = ref<QQMessage[]>([])
	const headerInset = ref(0)

	// 长按菜单 & 引用回复
	const menuOpen = ref(false)
	const menuMsg = ref<QQMessage | null>(null)
	const quote = ref<{ name: string; text: string } | null>(null)

	// 多选、批量删除与转发
	const multiMode = ref(false)
	const selectedIds = ref<string[]>([])
	const deleteConfirmOpen = ref(false)
	const forwardOpen = ref(false)
	const selectedCount = computed(() => selectedIds.value.length)
	const forwardTargets = computed(() =>
		sortedConversations.value.filter((item) => item.id !== convId.value)
	)
	const headerTitle = computed(() =>
		multiMode.value ? `已选择 ${selectedCount.value} 条` : conv.value?.name || '聊天'
	)

	// @ 我提醒
	const dismissedMentionId = ref('')
	const mentionMessages = computed(() =>
		conv.value?.type === 'group' ? conversationMentionMessages(conv.value.id) : []
	)
	const lastMention = computed(() => mentionMessages.value[mentionMessages.value.length - 1])
	const showMentionBanner = computed(
		() => !!lastMention.value && lastMention.value.id !== dismissedMentionId.value
	)
	const mentionSender = computed(() =>
		lastMention.value
			? lastMention.value.senderName || findUser(lastMention.value.senderId).name
			: ''
	)

	// 红包 / 转账
	const payKind = ref<'redpacket' | 'transfer' | ''>('')
	const payAmount = ref('')
	const payNote = ref('')
	const payCardMsg = ref<QQMessage | null>(null)
	const payOpened = ref(false)

	// 视频消息
	const videoMsg = ref<QQMessage | null>(null)
	const videoPlaying = ref(true)

	let pressTimer: ReturnType<typeof setTimeout> | null = null

	const menuSenderName = computed(() => {
		const msg = menuMsg.value
		if (!msg) return ''
		if (msg.senderId === 'me') return qqStore.user.name
		if (msg.senderId === 'system') return '系统消息'
		return msg.senderName || findUser(msg.senderId).name
	})

	const canQuote = computed(() => menuMsg.value?.type === 'text')
	const canRevoke = computed(() => menuMsg.value?.senderId === 'me')
	const canCopy = computed(() => menuMsg.value?.type === 'text' && !!menuMsg.value?.text)

	const menuPreview = computed(() => {
		const msg = menuMsg.value
		if (!msg) return ''
		if (msg.type === 'image') return '[图片]'
		if (msg.type === 'voice') return `[语音] ${msg.duration || 0}″`
		if (msg.type === 'video') return `[视频] ${msg.text || ''}`.trim()
		if (msg.type === 'redpacket') return `[红包] ${msg.payment?.note || '恭喜发财'}`
		if (msg.type === 'transfer') return `[转账] ¥${(msg.payment?.amount || 0).toFixed(2)}`
		return msg.text || ''
	})

	let replyTimer: ReturnType<typeof setTimeout> | null = null
	let typingTimer: ReturnType<typeof setTimeout> | null = null

	const EMOJIS = [
		'😀','😄','😁','😆','😊','🙂','😉','😍','🥰','😘','😜','🤪',
		'🤔','😐','😴','😮','🥱','😭','😂','🤣','😡','🥺','😎','🤓',
		'👍','👏','🙏','💪','🤝','✌️','🎉','❤️',
	]

	const moreActions = [
		{ label: '图片', icon: 'image', color: '#12B7F5' },
		{ label: '视频', icon: 'video', color: '#8E54E9' },
		{ label: '文件', icon: 'folder', color: '#4776E6' },
		{ label: '红包', icon: 'lucky-money', color: '#F5576C' },
		{ label: '转账', icon: 'transfer-circle', color: '#F0A020' },
		{ label: '拍摄', icon: 'camera', color: '#32C48D' },
		{ label: '位置', icon: 'location', color: '#FF9F1C' },
		{ label: '语音通话', icon: 'phone', color: '#8E54E9' },
		{ label: '视频通话', icon: 'video', color: '#0A9ED8' },
		{ label: '名片', icon: 'cardbag', color: '#7C828C' },
	]

	const REPLIES = [
		'收到～',
		'这个想法不错，我记一下。',
		'稍等，我看下日程。',
		'好呀，那就这么定了。',
		'哈哈哈哈，你也太逗了。',
		'我这边马上处理。',
		'嗯嗯，你说得对。',
		'晚点给你答复。',
	]

	const subtitle = computed(() => {
		if (!conv.value) return ''
		if (qqStore.typing[conv.value.id]) return '对方正在输入…'
		if (conv.value.type === 'group') return `${conv.value.members || 0} 人`
	 return conv.value.online ? '在线' : '离线'
	})

	const canSend = computed(() => draft.value.trim().length > 0)

	// 输入即存草稿，发送清空后消息列表里的「[草稿]」也会同步消失
	watch(draft, (value) => {
		if (conv.value) setConversationDraft(conv.value.id, value)
	})

	onLoad((options: any) => {
		convId.value = options?.id || ''
		conv.value = findConversation(convId.value)
		if (!conv.value) {
			uni.showToast({ title: '会话不存在', icon: 'none' })
			return
		}
		draft.value = conversationDraftOf(convId.value)
		markConversationRead(convId.value)
		messages.value = getMessages(convId.value)
		// 聊天页滚动区域自动滑动到底部
		nextTick(() => scrollToBottom())
	})

	onReady(() => {
		scrollToBottom()
	})

	onUnload(() => {
		if (replyTimer) clearTimeout(replyTimer)
		if (typingTimer) clearTimeout(typingTimer)
		if (conv.value) {
			setConversationDraft(conv.value.id, draft.value)
			qqStore.typing[conv.value.id] = false
		}
		unbindLongPress()
	})

	function scrollToBottom() {
		const last = messages.value[messages.value.length - 1]
		if (last) scrollTarget.value = ''
		nextTick(() => {
			if (last) scrollTarget.value = `msg-${last.id}`
		})
	}

	function blockedByMute() {
		if (!groupMuted.value) return false
		uni.showToast({ title: '全员禁言中，仅群主和管理员可发言', icon: 'none' })
		return true
	}

	function send() {
		if (!canSend.value || !conv.value) return
		if (blockedByMute()) return
		const askMention = /在吗|@/.test(draft.value)
		const sent = sendText(conv.value.id, draft.value)
		if (sent && quote.value) sent.quote = { ...quote.value }
		quote.value = null
		draft.value = ''
		emojiOpen.value = false
		moreOpen.value = false
		messages.value = getMessages(conv.value.id)
		scrollToBottom()
		scheduleReply(askMention)
	}

	function scheduleReply(mentionBack = false) {
		if (!conv.value) return
		const id = conv.value.id
		if (replyTimer) clearTimeout(replyTimer)
		replyTimer = setTimeout(() => {
			qqStore.typing[id] = true
			if (typingTimer) clearTimeout(typingTimer)
			typingTimer = setTimeout(() => {
				qqStore.typing[id] = false
				const target = findConversation(id)
				let senderId = 'u_linjiahe'
				if (target?.type === 'group') {
					senderId = 'u_xujiashu'
				} else if (target) {
					senderId = target.targetId
				}
				const isMention = mentionBack && target?.type === 'group'
				const reply = isMention
					? `@${qqStore.user.name} 我在，马上看一下。`
					: REPLIES[Math.floor(Math.random() * REPLIES.length)]
				receiveText(id, senderId, reply, isMention)
				messages.value = getMessages(id)
				nextTick(() => scrollToBottom())
			}, 1200)
		}, 700)
	}

	function insertEmoji(emoji: string) {
		draft.value += emoji
	}

	function toggleEmoji() {
		emojiOpen.value = !emojiOpen.value
		moreOpen.value = false
		nextTick(() => scrollToBottom())
	}

	function toggleMore() {
		moreOpen.value = !moreOpen.value
		emojiOpen.value = false
		nextTick(() => scrollToBottom())
	}

	const DEMO_PHOTOS = [
		'/static/qq/m1.jpg',
		'/static/qq/m2.jpg',
		'/static/qq/m3.jpg',
		'/static/qq/m4.jpg',
		'/static/qq/m5.jpg',
		'/static/qq/m6.jpg',
	]

	const DEMO_VIDEOS = [
		{ cover: '/static/qq/m4.jpg', duration: 15, label: '露营随手拍' },
		{ cover: '/static/qq/m3.jpg', duration: 23, label: '江边夜景' },
		{ cover: '/static/qq/m6.jpg', duration: 9, label: '海边落日' },
	]
	const videoPick = ref(0)

	function onMore(label: string) {
		if (blockedByMute()) return
		if (label === '图片') {
			photoOpen.value = true
			moreOpen.value = false
			return
		}
		if (label === '文件') {
			sendFile()
			return
		}
		if (label === '视频') {
			sendVideo()
			return
		}
		if (label === '红包' || label === '转账') {
			openPaySheet(label === '红包' ? 'redpacket' : 'transfer')
			return
		}
		uni.showToast({ title: `演示：${label}`, icon: 'none' })
	}

	function sendVideo() {
		if (!conv.value) return
		const item = DEMO_VIDEOS[videoPick.value % DEMO_VIDEOS.length]
		videoPick.value += 1
		sendVideoMessage(conv.value.id, item.cover, item.duration, item.label)
		messages.value = getMessages(conv.value.id)
		moreOpen.value = false
		emojiOpen.value = false
		scrollToBottom()
		scheduleReply()
		uni.showToast({ title: '已发送视频消息', icon: 'none' })
	}

	function openPaySheet(kind: 'redpacket' | 'transfer') {
		if (!conv.value) return
		if (kind === 'transfer' && conv.value.type !== 'single') {
			uni.showToast({ title: '群聊暂不支持转账，试试发红包', icon: 'none' })
			return
		}
		payKind.value = kind
		payAmount.value = kind === 'redpacket' ? '8.88' : '52.00'
		payNote.value = ''
		moreOpen.value = false
		emojiOpen.value = false
	}

	function closePaySheet() {
		payKind.value = ''
	}

	function confirmPay() {
		if (!conv.value || !payKind.value) return
		const amount = Number(payAmount.value)
		if (!Number.isFinite(amount) || amount <= 0) {
			uni.showToast({ title: '请输入正确的金额', icon: 'none' })
			return
		}
		if (payKind.value === 'redpacket') {
			sendRedPacket(conv.value.id, amount, payNote.value)
		} else {
			sendTransfer(conv.value.id, amount, payNote.value)
		}
		const sentKind = payKind.value
		payKind.value = ''
		messages.value = getMessages(conv.value.id)
		scrollToBottom()
		scheduleReply()
		uni.showToast({
			title: sentKind === 'redpacket' ? '红包已发送' : '转账已发送',
			icon: 'none',
		})
	}

	function openPayCard(msg: QQMessage) {
		if (multiMode.value || !msg.payment || !conv.value) return
		if (msg.senderId === 'me') {
			uni.showToast({
				title: msg.type === 'redpacket' ? '你发出的红包，等待领取' : '转账已发出，等待收款',
				icon: 'none',
			})
			return
		}
		payCardMsg.value = msg
		payOpened.value = msg.payment.status === 'received'
	}

	function closePayCard() {
		payCardMsg.value = null
		payOpened.value = false
	}

	function confirmPayCard() {
		if (!payCardMsg.value || !conv.value) return
		receivePayment(conv.value.id, payCardMsg.value.id)
		payOpened.value = true
		messages.value = getMessages(conv.value.id)
		uni.showToast({
			title: payCardMsg.value.type === 'redpacket' ? '红包已存入零钱' : '已确认收款',
			icon: 'none',
		})
	}

	function openVideo(msg: QQMessage) {
		if (multiMode.value) return
		videoMsg.value = msg
		videoPlaying.value = true
	}

	function closeVideo() {
		videoMsg.value = null
		videoPlaying.value = false
	}

	function toggleVideo() {
		videoPlaying.value = !videoPlaying.value
	}

	function videoClock(seconds = 0) {
		const total = Math.max(0, Math.round(seconds))
		const minute = Math.floor(total / 60)
		const second = String(total % 60).padStart(2, '0')
		return `${minute}:${second}`
	}

	function dismissMention() {
		if (lastMention.value) dismissedMentionId.value = lastMention.value.id
	}

	function jumpToMention() {
		const msg = lastMention.value
		if (!msg) return
		scrollTarget.value = ''
		nextTick(() => {
			scrollTarget.value = `msg-${msg.id}`
		})
	}

	function sendPhoto(path: string) {
		if (!conv.value) return
		appendMessage(conv.value.id, {
			id: `msg-img-${Date.now()}`,
			convId: conv.value.id,
			senderId: 'me',
			type: 'image',
			image: path,
			text: '[图片]',
			time: nowTime(),
		})
		messages.value = getMessages(conv.value.id)
		photoOpen.value = false
		moreOpen.value = false
		emojiOpen.value = false
		scrollToBottom()
		scheduleReply()
	}

	function sendFile() {
		if (!conv.value) return
		appendMessage(conv.value.id, {
			id: `msg-file-${Date.now()}`,
			convId: conv.value.id,
			senderId: 'me',
			type: 'file',
			text: '需求评审-2024Q4.pdf',
			time: nowTime(),
		})
		messages.value = getMessages(conv.value.id)
		moreOpen.value = false
		scrollToBottom()
		scheduleReply()
		uni.showToast({ title: '已发送文件', icon: 'none' })
	}

	function startRecord() {
		if (blockedByMute()) return
		recording.value = true
		recordStart = Date.now()
	}

	function endRecord() {
		if (!recording.value) return
		recording.value = false
		const duration = Math.round((Date.now() - (recordStart || Date.now())) / 1000)
		if (duration < 1) {
			uni.showToast({ title: '说话时间太短', icon: 'none' })
			return
		}
		if (!conv.value) return
		appendMessage(conv.value.id, {
			id: `msg-voice-${Date.now()}`,
			convId: conv.value.id,
			senderId: 'me',
			type: 'voice',
			duration,
			time: nowTime(),
		})
		messages.value = getMessages(conv.value.id)
		scrollToBottom()
		uni.showToast({ title: `已发送语音 ${duration}″`, icon: 'none' })
		scheduleReply()
	}

	function playVoice(msg: QQMessage) {
		if (multiMode.value) return
		if (playingId.value === msg.id) {
			playingId.value = ''
			if (playTimer) clearTimeout(playTimer)
			return
		}
		playingId.value = msg.id
		if (playTimer) clearTimeout(playTimer)
		playTimer = setTimeout(() => {
			playingId.value = ''
		}, Math.max(1.6, Math.min(6, msg.duration || 1)) * 1000)
	}

	function previewImage(url: string) {
		if (multiMode.value) return
		uni.previewImage({ urls: [url] })
	}

	function previewMessageImages(msg: QQMessage) {
		if (multiMode.value) return
		if (msg.image) uni.previewImage({ urls: [msg.image] })
	}

	function openProfile(senderId: string) {
		if (multiMode.value || senderId === 'me') return
		goUserDetail(senderId)
	}

	function openGroupCard(card: QQGroupCard) {
		if (multiMode.value || !conv.value) return
		if (card.kind === 'todo') return goGroupTodo(conv.value.id)
		if (card.kind === 'vote') return goGroupVote(conv.value.id)
		goGroupCheckin(conv.value.id)
	}

	function chatInfo() {
		if (conv.value?.type === 'group') return goGroupInfo(conv.value.id)
		uni.showToast({ title: '演示：聊天信息设置', icon: 'none' })
	}

	function openNotice() {
		if (conv.value?.type !== 'group') return
		goNotice(conv.value.id)
	}

	const groupNotice = computed(() => {
		if (conv.value?.type !== 'group') return ''
		return conv.value.notice || '暂无群公告'
	})

	/* ---------------- 长按菜单 ---------------- */

	function openMenu(msgId: string) {
		if (multiMode.value) return
		const msg = messages.value.find((m) => m.id === msgId)
		if (!msg || msg.type === 'system') return
		menuMsg.value = msg
		menuOpen.value = true
		emojiOpen.value = false
		moreOpen.value = false
	}

	function closeMenu() {
		menuOpen.value = false
	}

	function copyBySelection(text: string) {
		try {
			const area = document.createElement('textarea')
			area.value = text
			area.style.position = 'fixed'
			area.style.left = '-9999px'
			area.style.top = '0'
			area.setAttribute('readonly', '')
			document.body.appendChild(area)
			area.select()
			const ok = document.execCommand('copy')
			document.body.removeChild(area)
			return ok
		} catch (e) {
			return false
		}
	}

	function onCopy() {
		const text = menuMsg.value?.text || ''
		if (!text) {
			uni.showToast({ title: '该消息暂不支持复制', icon: 'none' })
			return
		}
		const finish = (copied: boolean) => {
			closeMenu()
			uni.showToast({ title: copied ? '已复制到剪贴板' : '复制失败，请长按选择文本', icon: 'none' })
		}
		const clipboard = navigator.clipboard
		if (clipboard && typeof clipboard.writeText === 'function') {
			clipboard
				.writeText(text)
				.then(() => finish(true))
				.catch(() => finish(copyBySelection(text)))
			return
		}
		finish(copyBySelection(text))
	}

	function onQuote() {
		const msg = menuMsg.value
		if (!msg || msg.type !== 'text' || !msg.text) return
		const name =
			msg.senderId === 'me' ? qqStore.user.name : msg.senderName || findUser(msg.senderId).name
		quote.value = { name, text: msg.text }
		closeMenu()
	}

	function onRevoke() {
		const msg = menuMsg.value
		if (!msg || !conv.value || msg.senderId !== 'me') return
		const id = conv.value.id
		const list = getMessages(id)
		const index = list.findIndex((m) => m.id === msg.id)
		removeMessage(id, msg.id)
		list.splice(Math.max(0, index), 0, {
			id: `msg-sys-${Date.now()}`,
			convId: id,
			senderId: 'system',
			type: 'system',
			text: '你撤回了一条消息',
			time: nowTime(),
		})
		messages.value = getMessages(id)
		closeMenu()
		scrollToBottom()
	}

	function onDeleteMessage() {
		const msg = menuMsg.value
		if (!msg || !conv.value) return
		removeMessage(conv.value.id, msg.id)
		messages.value = getMessages(conv.value.id)
		closeMenu()
		scrollToBottom()
	}

	/* ---------------- 多选 / 批量操作 ---------------- */

	function enterMulti() {
		const msg = menuMsg.value
		if (!msg) return
		multiMode.value = true
		selectedIds.value = [msg.id]
		menuOpen.value = false
		emojiOpen.value = false
		moreOpen.value = false
		photoOpen.value = false
	}

	function exitMulti() {
		multiMode.value = false
		selectedIds.value = []
		deleteConfirmOpen.value = false
		forwardOpen.value = false
	}

	function isSelected(msgId: string) {
		return selectedIds.value.includes(msgId)
	}

	function toggleSelect(msgId: string) {
		selectedIds.value = isSelected(msgId)
			? selectedIds.value.filter((id) => id !== msgId)
			: [...selectedIds.value, msgId]
	}

	function onRowTap(msgId: string) {
		if (!multiMode.value) return
		const msg = messages.value.find((item) => item.id === msgId)
		if (!msg || msg.type === 'system') return
		toggleSelect(msgId)
	}

	function openDeleteConfirm() {
		if (!selectedCount.value) return
		deleteConfirmOpen.value = true
	}

	function closeDeleteConfirm() {
		deleteConfirmOpen.value = false
	}

	function confirmDeleteSelected() {
		if (!conv.value || !selectedCount.value) return
		const count = removeMessages(conv.value.id, selectedIds.value)
		messages.value = getMessages(conv.value.id)
		deleteConfirmOpen.value = false
		multiMode.value = false
		selectedIds.value = []
		uni.showToast({ title: `已删除 ${count} 条消息`, icon: 'none' })
	}

	function openForwardPicker() {
		if (!selectedCount.value) return
		forwardOpen.value = true
	}

	function closeForwardPicker() {
		forwardOpen.value = false
	}

	function forwardTo(targetConvId: string) {
		if (!conv.value || !selectedCount.value) return
		const target = findConversation(targetConvId)
		const count = forwardMessages(conv.value.id, selectedIds.value, targetConvId)
		forwardOpen.value = false
		multiMode.value = false
		selectedIds.value = []
		uni.showToast({
			title: count ? `已转发 ${count} 条到 ${target?.name || '会话'}` : '没有可转发的消息',
			icon: 'none',
		})
	}

	function msgIdFromEvent(event: Event): string | null {
		const target = event.target as HTMLElement | null
		if (!target || typeof target.closest !== 'function') return null
		const row = target.closest('[data-msg]') as HTMLElement | null
		return row ? row.getAttribute('data-msg') : null
	}

	function handleContextMenu(event: MouseEvent) {
		if (multiMode.value) {
			event.preventDefault()
			return
		}
		const id = msgIdFromEvent(event)
		if (!id) return
		event.preventDefault()
		openMenu(id)
	}

	function handleTouchStart(event: TouchEvent) {
		if (multiMode.value) return
		const id = msgIdFromEvent(event)
		if (!id) return
		if (pressTimer) clearTimeout(pressTimer)
		pressTimer = setTimeout(() => openMenu(id), 480)
	}

	function clearPressTimer() {
		if (pressTimer) {
			clearTimeout(pressTimer)
			pressTimer = null
		}
	}

	onMounted(() => {
		document.addEventListener('contextmenu', handleContextMenu)
		document.addEventListener('touchstart', handleTouchStart, { passive: true })
		document.addEventListener('touchend', clearPressTimer)
		document.addEventListener('touchmove', clearPressTimer)
	})

	function unbindLongPress() {
		document.removeEventListener('contextmenu', handleContextMenu)
		document.removeEventListener('touchstart', handleTouchStart)
		document.removeEventListener('touchend', clearPressTimer)
		document.removeEventListener('touchmove', clearPressTimer)
		clearPressTimer()
	}

	function callVoice() {
		if (!conv.value) return
		goCall(conv.value.id, 'voice')
	}

	function callVideo() {
		if (!conv.value) return
		goCall(conv.value.id, 'video')
	}
</script>

<template>
	<view class="chat-page">
		<qq-navbar
			:title="headerTitle"
			:subtitle="multiMode ? '点击消息选择' : subtitle"
			bg="#F7F8FA"
			:border="true"
		>
			<template #right>
				<view v-if="multiMode" class="chat-hd-text" @tap="exitMulti">取消</view>
				<template v-else>
					<view class="chat-hd-icon" @tap="callVoice">
						<tn-icon name="phone" size="19px" color="tn-grey-dark" />
					</view>
					<view class="chat-hd-icon" @tap="callVideo">
						<tn-icon name="video" size="20px" color="tn-grey-dark" />
					</view>
					<view class="chat-hd-icon" @tap="chatInfo">
						<tn-icon name="more-horizontal" size="20px" color="tn-grey-dark" />
					</view>
				</template>
			</template>
		</qq-navbar>

		<!-- 全员禁言提示 -->
		<view v-if="groupMuted" class="chat-mute">
			<tn-icon name="notice-no" size="14px" color="#FF9F1C" />
			<text class="chat-mute__text">全员禁言中，仅群主和管理员可发言</text>
		</view>

		<!-- 群公告条 -->
		<view v-if="conv?.type === 'group'" class="chat-notice" @tap="openNotice">
			<tn-icon name="notice-fill" size="15px" color="#12B7F5" />
			<text class="chat-notice__tag">群公告</text>
			<text class="chat-notice__text">{{ groupNotice }}</text>
			<tn-icon name="right" size="12px" color="#9AA0A8" />
		</view>

		<!-- @ 我提醒 -->
		<view v-if="showMentionBanner && !multiMode" class="chat-mention" @tap="jumpToMention">
			<view class="chat-mention__icon">
				<text>@</text>
			</view>
			<view class="chat-mention__main">
				<text class="chat-mention__title">{{ mentionSender }} 在群聊中@了你</text>
				<text class="chat-mention__sub">点这里定位到消息</text>
			</view>
			<text class="chat-mention__close" @tap.stop="dismissMention">知道了</text>
		</view>

		<!-- 消息区 -->
		<scroll-view
		class="chat-body"
			scroll-y
			:scroll-into-view="scrollTarget"
			:scroll-with-animation="true"
		>
			<view class="chat-date">今天</view>

			<view
				v-for="msg in messages"
				:id="`msg-${msg.id}`"
				:key="msg.id"
				:data-msg="msg.id"
				class="chat-row"
				:class="{
					'chat-row--self': msg.senderId === 'me',
					'chat-row--mention': msg.mentionsMe,
					'chat-row--multi': multiMode && msg.type !== 'system',
					'chat-row--selected': multiMode && isSelected(msg.id),
				}"
				@tap="onRowTap(msg.id)"
			>
				<view
					v-if="multiMode && msg.type !== 'system'"
					class="chat-pick"
					:class="{ 'chat-pick--on': isSelected(msg.id) }"
				>
					<view class="chat-pick__dot" />
				</view>

				<!-- 系统提示 -->
				<view v-if="msg.type === 'system'" class="chat-system">
					<text class="chat-system__text">{{ msg.text }}</text>
				</view>

				<template v-else>
					<view class="chat-avatar" @tap="openProfile(msg.senderId)">
						<qq-avatar
							:name="msg.senderId === 'me' ? qqStore.user.name : findUser(msg.senderId).name"
							:from="msg.senderId === 'me' ? qqStore.user.avatarFrom : findUser(msg.senderId).avatarFrom"
							:to="msg.senderId === 'me' ? qqStore.user.avatarTo : findUser(msg.senderId).avatarTo"
							:size="36"
						/>
					</view>

					<view class="chat-content">
						<view
							v-if="msg.senderId !== 'me' && conv?.type === 'group'"
							class="chat-sender-row"
						>
							<text class="chat-sender">
								{{ msg.senderName || findUser(msg.senderId).name }}
							</text>
							<text v-if="msg.mentionsMe" class="chat-at-tag">@我</text>
						</view>

						<view
							v-if="msg.type === 'text'"
							class="chat-bubble"
							:class="msg.senderId === 'me' ? 'chat-bubble--self' : 'chat-bubble--other'"
						>
							<view
								v-if="msg.quote"
								class="chat-quote-block"
								:class="{ 'chat-quote-block--self': msg.senderId === 'me' }"
							>
								<text class="chat-quote-block__text">
									{{ msg.quote.name }}：{{ msg.quote.text }}
								</text>
							</view>
							<text class="chat-text">{{ msg.text }}</text>
						</view>

						<view
							v-else-if="msg.type === 'image'"
							class="chat-bubble chat-bubble--image"
							:class="msg.senderId === 'me' ? 'chat-bubble--self' : 'chat-bubble--other'"
							@tap="previewMessageImages(msg)"
						>
							<image class="chat-image" :src="msg.image" mode="aspectFill" />
						</view>

						<view
							v-else-if="msg.type === 'voice'"
							class="chat-bubble chat-bubble--voice"
							:class="[
								msg.senderId === 'me' ? 'chat-bubble--self' : 'chat-bubble--other',
								{ 'chat-bubble--playing': playingId === msg.id },
							]"
							:style="{ width: `${Math.min(210, 84 + (msg.duration || 0) * 6)}px` }"
							@tap="playVoice(msg)"
						>
							<tn-icon name="voice" size="16px" :color="msg.senderId === 'me' ? 'tn-white' : 'tn-grey-dark'" />
							<view class="voice-waves">
								<view v-for="i in 6" :key="i" class="voice-wave" :style="{ height: `${8 + (i % 3) * 4}px` }" />
							</view>
							<text class="voice-duration">{{ msg.duration }}″</text>
						</view>

						<view
							v-else-if="msg.type === 'file'"
							class="chat-bubble chat-bubble--other chat-file"
						>
							<tn-icon name="folder" size="20px" color="#4776E6" />
							<text class="chat-file__name">{{ msg.text }}</text>
						</view>

						<view
							v-else-if="msg.type === 'group-card' && msg.card"
							class="chat-group-card"
							:class="msg.senderId === 'me' ? 'chat-group-card--self' : 'chat-group-card--other'"
							@tap="openGroupCard(msg.card)"
						>
							<view class="gc-head">
								<view
									class="gc-icon"
									:class="`gc-icon--${msg.card.kind}`"
								>
									<tn-icon
										:name="msg.card.kind === 'todo' ? 'success-circle' : msg.card.kind === 'vote' ? 'comment' : 'check'"
										size="18px"
										color="#FFFFFF"
									/>
								</view>
								<view class="gc-main">
									<text class="gc-title">{{ msg.card.title }}</text>
									<text class="gc-sub">{{ msg.card.sub }}</text>
								</view>
								<tn-icon name="right" size="13px" color="#C9CDD4" />
							</view>
							<view class="gc-foot">
								<text class="gc-foot__badge">
									{{ msg.card.kind === 'todo' ? '群待办' : msg.card.kind === 'vote' ? '群投票' : '群签到' }}
								</text>
								<text class="gc-foot__hint">点击查看详情</text>
							</view>
						</view>

						<view
							v-else-if="msg.type === 'redpacket' || msg.type === 'transfer'"
							class="chat-pay"
							:class="[
								msg.senderId === 'me' ? 'chat-pay--self' : 'chat-pay--other',
								`chat-pay--${msg.type}`,
								{ 'chat-pay--done': msg.payment?.status === 'received' },
							]"
							@tap="openPayCard(msg)"
						>
							<view class="chat-pay__head">
								<view class="chat-pay__icon">
									<tn-icon
										:name="msg.type === 'redpacket' ? 'lucky-money' : 'transfer-circle'"
										size="22px"
										color="#FFFFFF"
									/>
								</view>
								<view class="chat-pay__main">
									<text class="chat-pay__title">
										{{ msg.type === 'redpacket'
											? (msg.payment?.note || '恭喜发财，大吉大利')
											: (msg.senderId === 'me'
												? `转账给 ${conv?.name || '好友'}`
												: `${msg.senderName || findUser(msg.senderId).name} 转账给你`) }}
									</text>
									<text class="chat-pay__note">
										{{ msg.type === 'redpacket' ? '点开领取红包' : '点开确认收款' }}
									</text>
								</view>
								<text class="chat-pay__amount">¥{{ (msg.payment?.amount || 0).toFixed(2) }}</text>
							</view>
							<view class="chat-pay__foot">
								<text>{{ msg.type === 'redpacket' ? '红包' : '转账' }}</text>
								<text>
									{{ msg.payment?.status === 'received'
										? (msg.type === 'redpacket' ? '已领取' : '已收款')
										: (msg.senderId === 'me' ? '等待对方领取' : '待领取') }}
								</text>
							</view>
						</view>

						<view
							v-else-if="msg.type === 'video'"
							class="chat-video-card"
							:class="msg.senderId === 'me' ? 'chat-video-card--self' : 'chat-video-card--other'"
							@tap="openVideo(msg)"
						>
							<image class="chat-video-card__cover" :src="msg.video || msg.image" mode="aspectFill" />
							<view class="chat-video-card__shade" />
							<view class="chat-video-card__play">
								<tn-icon name="play-fill" size="22px" color="#FFFFFF" />
							</view>
							<text class="chat-video-card__time">{{ videoClock(msg.duration) }}</text>
							<view class="chat-video-card__foot">
								<tn-icon name="video" size="13px" color="rgba(255,255,255,0.82)" />
								<text class="chat-video-card__label">{{ msg.text || '视频' }}</text>
							</view>
						</view>
					</view>
				</template>
			</view>

			<view v-if="conv && qqStore.typing[conv.id]" class="chat-typing">
				<view class="typing-dots"><view /><view /><view /></view>
				<text class="chat-typing__text">对方正在输入…</text>
			</view>

			<view class="chat-body__footer" />
		</scroll-view>

		<!-- 多选操作栏 -->
		<view v-if="multiMode" class="chat-multi">
			<view class="chat-multi__info">
				<text class="chat-multi__count">{{ selectedCount }}</text>
				<text class="chat-multi__label">条已选</text>
			</view>
			<view
				class="chat-multi__btn"
				:class="{ 'chat-multi__btn--disabled': !selectedCount }"
				@tap="openForwardPicker"
			>
				<tn-icon name="share" size="18px" color="#12B7F5" />
				<text>转发</text>
			</view>
			<view
				class="chat-multi__btn chat-multi__btn--danger"
				:class="{ 'chat-multi__btn--disabled': !selectedCount }"
				@tap="openDeleteConfirm"
			>
				<tn-icon name="delete" size="18px" color="#FA5151" />
				<text>删除</text>
			</view>
			<view class="chat-multi__cancel" @tap="exitMulti">取消</view>
		</view>

		<!-- 输入栏 -->
		<view v-else class="chat-input" :class="{ 'chat-input--panel': emojiOpen || moreOpen }">
			<view v-if="quote" class="chat-quote">
				<view class="chat-quote__bar" />
				<text class="chat-quote__text">回复 {{ quote.name }}：{{ quote.text }}</text>
				<view class="chat-quote__close" @tap="quote = null">
					<tn-icon name="close" size="14px" color="#9AA0A8" />
				</view>
			</view>
			<view class="chat-input__row">
				<view class="chat-input__icon" @tap="voiceMode = !voiceMode; emojiOpen = false; moreOpen = false">
					<tn-icon :name="voiceMode ? 'keyboard' : 'microphone'" size="23px" color="tn-grey-dark" />
				</view>

				<view v-if="!voiceMode" class="chat-input__field">
					<input
						v-model="draft"
						class="chat-input__input"
						:adjust-position="true"
						confirm-type="send"
						placeholder="输入消息…"
						@focus="emojiOpen = false; moreOpen = false; scrollToBottom()"
						@confirm="send"
					/>
				</view>
				<view
					v-else
					class="chat-input__voice"
					:class="{ 'chat-input__voice--active': recording }"
					@touchstart.prevent="startRecord"
					@touchend.prevent="endRecord"
					@touchcancel.prevent="endRecord"
				>
					按住 说话
				</view>

				<view class="chat-input__icon" @tap="toggleEmoji">
					<tn-icon name="emoji-general" size="23px" color="tn-grey-dark" />
				</view>

				<view v-if="canSend && !voiceMode" class="chat-send" @tap="send">
					<text class="chat-send__text">发送</text>
				</view>
				<view
					v-else-if="!voiceMode"
					class="chat-input__icon"
					@tap="toggleMore"
				>
					<tn-icon name="add-circle" size="24px" color="tn-grey-dark" />
				</view>
			</view>

			<!-- 表情面板 -->
			<view v-if="emojiOpen" class="chat-panel chat-emoji">
				<view class="chat-emoji__grid">
					<view
						v-for="emoji in EMOJIS"
						:key="emoji"
						class="chat-emoji__item"
						@tap="insertEmoji(emoji)"
					>
						{{ emoji }}
					</view>
				</view>
			</view>

			<!-- 更多面板 -->
			<view v-if="moreOpen" class="chat-panel chat-more">
				<view
					v-for="action in moreActions"
					:key="action.label"
					class="chat-more__item"
					@tap="onMore(action.label)"
				>
					<view class="chat-more__icon" :style="{ backgroundColor: `${action.color}14` }">
						<tn-icon :name="action.icon" size="22px" :color="action.color" />
					</view>
					<text class="chat-more__label">{{ action.label }}</text>
				</view>
			</view>
		</view>

		<!-- 录音遮罩 -->
		<view v-if="recording" class="record-mask">
			<view class="record-box">
				<view class="record-waves">
					<view v-for="i in 5" :key="i" class="record-wave" />
				</view>
				<text class="record-text">正在录音，松开发送</text>
			</view>
		</view>

		<!-- 相册选择 -->
		<view v-if="photoOpen" class="photo-mask" @tap="photoOpen = false">
			<view class="photo-sheet" @tap.stop>
				<view class="photo-head">
					<text class="photo-head__title">选择图片</text>
					<text class="photo-head__cancel" @tap="photoOpen = false">取消</text>
				</view>
				<view class="photo-grid">
					<view v-for="p in DEMO_PHOTOS" :key="p" class="photo-item" @tap="sendPhoto(p)">
						<image class="photo-item__img" :src="p" mode="aspectFill" />
					</view>
				</view>
				<text class="photo-tip">演示相册 · 点一张直接发送</text>
			</view>
		</view>

		<!-- 红包 / 转账金额面板 -->
		<view v-if="payKind" class="pay-mask" @tap="closePaySheet">
			<view class="pay-sheet" @tap.stop>
				<view class="pay-sheet__head">
					<text class="pay-sheet__title">{{ payKind === 'redpacket' ? '发红包' : '转账' }}</text>
					<text class="pay-sheet__cancel" @tap="closePaySheet">取消</text>
				</view>
				<view class="pay-sheet__amount" :class="`pay-sheet__amount--${payKind}`">
					<text class="pay-sheet__symbol">¥</text>
					<input
						v-model="payAmount"
						class="pay-sheet__input"
						type="digit"
						placeholder="0.00"
					/>
				</view>
				<view class="pay-sheet__quick">
					<text
						v-for="amount in ['5.20', '8.88', '18.88', '52.00']"
						:key="amount"
						class="pay-sheet__chip"
						@tap="payAmount = amount"
					>
						{{ amount }}
					</text>
				</view>
				<input
					v-model="payNote"
					class="pay-sheet__note"
					:placeholder="payKind === 'redpacket' ? '恭喜发财，大吉大利' : '添加转账说明'"
					maxlength="24"
				/>
				<view class="pay-sheet__submit" :class="`pay-sheet__submit--${payKind}`" @tap="confirmPay">
					{{ payKind === 'redpacket' ? '塞进红包并发送' : '确认转账' }}
				</view>
				<text class="pay-sheet__tip">
					{{ payKind === 'redpacket' ? '群聊红包 · 演示环境不产生真实资金' : '单聊转账 · 演示环境不产生真实资金' }}
				</text>
			</view>
		</view>

		<!-- 红包 / 转账详情 -->
		<view v-if="payCardMsg && payCardMsg.payment" class="pay-card-mask" @tap="closePayCard">
			<view
				class="pay-card-box"
				:class="[`pay-card-box--${payCardMsg.type}`, { 'pay-card-box--done': payOpened }]"
				@tap.stop
			>
				<view class="pay-card-avatar">
					<qq-avatar
						:name="payCardMsg.senderId === 'me' ? qqStore.user.name : findUser(payCardMsg.senderId).name"
						:from="payCardMsg.senderId === 'me' ? qqStore.user.avatarFrom : findUser(payCardMsg.senderId).avatarFrom"
						:to="payCardMsg.senderId === 'me' ? qqStore.user.avatarTo : findUser(payCardMsg.senderId).avatarTo"
						:size="52"
					/>
				</view>
				<text class="pay-card-from">
					{{ payCardMsg.senderId === 'me' ? qqStore.user.name : findUser(payCardMsg.senderId).name }}
					{{ payCardMsg.type === 'redpacket' ? '发出的红包' : '向你转账' }}
				</text>
				<view class="pay-card-number">
					<text class="pay-card-symbol">¥</text>
					<text class="pay-card-amount">{{ (payCardMsg.payment.amount || 0).toFixed(2) }}</text>
				</view>
				<text class="pay-card-note">{{ payCardMsg.payment.note }}</text>
				<view
					v-if="!payOpened"
					class="pay-card-open"
					:class="`pay-card-open--${payCardMsg.type}`"
					@tap="confirmPayCard"
				>
					{{ payCardMsg.type === 'redpacket' ? '开' : '确认收款' }}
				</view>
				<view v-else class="pay-card-done">
					<tn-icon name="success-circle-fill" size="17px" color="rgba(255,255,255,0.9)" />
					<text>{{ payCardMsg.type === 'redpacket' ? '已存入零钱' : '已收款' }}</text>
				</view>
				<text class="pay-card-close" @tap="closePayCard">关闭</text>
			</view>
		</view>

		<!-- 视频消息播放器 -->
		<view v-if="videoMsg" class="video-mask" @tap="closeVideo">
			<view class="video-player" @tap.stop>
				<image class="video-poster" :src="videoMsg.video || videoMsg.image" mode="aspectFill" />
				<view class="video-shade" />
				<view class="video-top">
					<text class="video-top__label">{{ videoMsg.text || '视频消息' }}</text>
					<view class="video-top__close" @tap="closeVideo">
						<tn-icon name="close" size="18px" color="#FFFFFF" />
					</view>
				</view>
				<view class="video-center" @tap="toggleVideo">
					<view class="video-center__btn">
						<tn-icon :name="videoPlaying ? 'stop' : 'play-fill'" size="30px" color="#FFFFFF" />
					</view>
				</view>
				<view class="video-bottom">
					<view class="video-progress">
						<view
							class="video-progress__fill"
							:style="{
								animationDuration: `${Math.max(3, videoMsg.duration || 10)}s`,
								animationPlayState: videoPlaying ? 'running' : 'paused',
							}"
						/>
					</view>
					<view class="video-meta">
						<text>0:00 / {{ videoClock(videoMsg.duration) }}</text>
						<text>演示播放器 · 无真实视频源</text>
					</view>
				</view>
			</view>
		</view>

		<!-- 消息长按菜单 -->
		<view v-if="menuOpen" class="chat-mask" @tap="closeMenu">
			<view class="chat-menu" @tap.stop>
				<view class="chat-menu__card">
					<view class="chat-menu__preview">
						<text class="chat-menu__who">{{ menuSenderName }}</text>
						<text class="chat-menu__snippet">{{ menuPreview }}</text>
					</view>
					<view v-if="canCopy" class="chat-menu__item" @tap="onCopy">复制</view>
					<view v-if="canQuote" class="chat-menu__item" @tap="onQuote">引用</view>
					<view class="chat-menu__item" @tap="enterMulti">多选</view>
					<view v-if="canRevoke" class="chat-menu__item chat-menu__item--danger" @tap="onRevoke">
						撤回
					</view>
					<view class="chat-menu__item chat-menu__item--danger" @tap="onDeleteMessage">删除</view>
				</view>
				<view class="chat-menu__card">
					<view class="chat-menu__item" @tap="closeMenu">取消</view>
				</view>
			</view>
		</view>

		<!-- 转发目标选择 -->
		<view v-if="forwardOpen" class="forward-mask" @tap="closeForwardPicker">
			<view class="forward-sheet" @tap.stop>
				<view class="forward-head">
					<text class="forward-head__title">转发给</text>
					<text class="forward-head__sub">已选 {{ selectedCount }} 条消息</text>
					<text class="forward-head__close" @tap="closeForwardPicker">关闭</text>
				</view>
				<scroll-view class="forward-list" scroll-y>
					<view
						v-for="target in forwardTargets"
						:key="target.id"
						class="forward-item"
						@tap="forwardTo(target.id)"
					>
						<qq-avatar
							:name="target.name"
							:from="target.avatarFrom"
							:to="target.avatarTo"
							:size="40"
						/>
						<view class="forward-item__main">
							<text class="forward-item__name">{{ target.name }}</text>
							<text class="forward-item__sub">{{ target.type === 'group' ? '群聊' : '好友' }} · {{ target.lastMessage }}</text>
						</view>
						<tn-icon name="right" size="14px" color="#C9CDD4" />
					</view>
					<view v-if="!forwardTargets.length" class="forward-empty">暂无可转发的会话</view>
				</scroll-view>
			</view>
		</view>

		<!-- 批量删除确认 -->
		<view v-if="deleteConfirmOpen" class="confirm-mask" @tap="closeDeleteConfirm">
			<view class="confirm-box" @tap.stop>
				<text class="confirm-box__title">删除 {{ selectedCount }} 条消息？</text>
				<text class="confirm-box__sub">删除后不可恢复，仅影响本地演示数据。</text>
				<view class="confirm-box__actions">
					<view class="confirm-box__btn" @tap="closeDeleteConfirm">取消</view>
					<view class="confirm-box__btn confirm-box__btn--danger" @tap="confirmDeleteSelected">删除</view>
				</view>
			</view>
		</view>
	</view>
</template>

<style lang="scss" scoped>
	.chat-page {
		display: flex;
		flex-direction: column;
		height: 100vh;
		width: 100%;
		max-width: 430px;
		margin: 0 auto;
		background-color: var(--qq-bg);
		overflow: hidden;
	}

	.chat-hd-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 30px;
		height: 30px;
	}

	.chat-mute {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 5px;
		padding: 7px 12px;
		background-color: var(--qq-card-2);
		border-bottom: 1px solid var(--qq-line);
	}

	.chat-mute__text {
		font-size: 11.5px;
		color: var(--qq-text-3);
	}

	.chat-notice {
		display: flex;
		align-items: center;
		gap: 5px;
		margin: 8px 12px 0;
		padding: 7px 10px;
		border-radius: 8px;
		background-color: var(--qq-blue-light);
	}

	.chat-notice__tag {
		flex-shrink: 0;
		font-size: 10.5px;
		font-weight: 600;
		color: #12b7f5;
	}

	.chat-notice__text {
		flex: 1;
		min-width: 0;
		font-size: 11.5px;
		color: var(--qq-text-2);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.chat-body {
		flex: 1;
		min-height: 0;
		padding: 10px 12px 0;
		box-sizing: border-box;
	}

	.chat-date {
		display: flex;
		justify-content: center;
		margin: 4px 0 12px;
	}

	.chat-date text {
		padding: 3px 8px;
		border-radius: 4px;
		background-color: rgba(0, 0, 0, 0.05);
		font-size: 10.5px;
		color: var(--qq-text-3);
	}

	.chat-row {
		display: flex;
		margin-bottom: 14px;
	}

	.chat-row--self {
		flex-direction: row-reverse;
	}

	.chat-avatar {
		align-self: flex-start;
	}

	.chat-content {
		max-width: 70%;
		margin-left: 9px;
	}

	.chat-row--self .chat-content {
		margin-left: 0;
		margin-right: 9px;
		display: flex;
		flex-direction: column;
		align-items: flex-end;
	}

	.chat-sender {
		display: block;
		margin-bottom: 3px;
		font-size: 10.5px;
		color: var(--qq-text-3);
	}

	.chat-bubble {
		position: relative;
		padding: 9px 12px;
		border-radius: 10px;
		font-size: 14px;
		line-height: 1.5;
		word-break: break-word;
	}

	.chat-bubble--other {
		background-color: var(--qq-card);
		color: var(--qq-text);
		border-top-left-radius: 4px;
	}

	.chat-bubble--self {
		background-color: #12b7f5;
		color: #ffffff;
		border-top-right-radius: 4px;
	}

	.chat-text {
		font-size: 14px;
		line-height: 1.5;
	}

	.chat-quote-block {
		max-width: 200px;
		margin-bottom: 5px;
		padding: 4px 7px;
		border-radius: 5px;
		background-color: rgba(0, 0, 0, 0.05);
	}

	.chat-quote-block--self {
		background-color: rgba(255, 255, 255, 0.2);
	}

	.chat-quote-block__text {
		font-size: 11px;
		line-height: 1.4;
		color: var(--qq-text-3);
	}

	.chat-quote-block--self .chat-quote-block__text {
		color: rgba(255, 255, 255, 0.86);
	}

	.chat-quote {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-bottom: 8px;
		padding: 6px 8px 6px 0;
		border-radius: 8px;
		background-color: var(--qq-card);
	}

	.chat-quote__bar {
		width: 3px;
		align-self: stretch;
		border-radius: 2px;
		background-color: #12b7f5;
	}

	.chat-quote__text {
		flex: 1;
		min-width: 0;
		font-size: 12px;
		color: var(--qq-text-2);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.chat-quote__close {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 22px;
		height: 22px;
		flex-shrink: 0;
	}

	.photo-mask {
		position: fixed;
		top: 0;
		bottom: 0;
		left: 50%;
		transform: translateX(-50%);
		width: 100%;
		max-width: 430px;
		z-index: 82;
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
		background-color: rgba(0, 0, 0, 0.34);
	}

	.photo-sheet {
		padding: 12px 14px calc(16px + env(safe-area-inset-bottom));
		border-radius: 16px 16px 0 0;
		background-color: var(--qq-card);
	}

	.photo-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding-bottom: 12px;
	}

	.photo-head__title {
		font-size: 15px;
		font-weight: 600;
		color: var(--qq-text);
	}

	.photo-head__cancel {
		font-size: 12.5px;
		color: var(--qq-text-2);
	}

	.photo-grid {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}

	.photo-item {
		width: calc(33.33% - 4px);
		aspect-ratio: 1;
		border-radius: 8px;
		overflow: hidden;
		background-color: var(--qq-card-2);
	}

	.photo-item__img {
		display: block;
		width: 100%;
		height: 100% !important;
	}

	.photo-tip {
		display: block;
		margin-top: 10px;
		font-size: 10.5px;
		color: var(--qq-text-3);
	}

	.chat-mask {
		position: fixed;
		top: 0;
		bottom: 0;
		left: 50%;
		transform: translateX(-50%);
		width: 100%;
		max-width: 430px;
		z-index: 80;
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
		background-color: rgba(0, 0, 0, 0.32);
	}

	.chat-menu {
		width: 100%;
		box-sizing: border-box;
		padding: 8px 10px calc(10px + env(safe-area-inset-bottom));
	}

	.chat-menu__card {
		margin-bottom: 8px;
		border-radius: 12px;
		overflow: hidden;
		background-color: var(--qq-card);
	}

	.chat-menu__preview {
		padding: 10px 14px;
		border-bottom: 1px solid var(--qq-line);
		background-color: var(--qq-card-2);
	}

	.chat-menu__who {
		display: block;
		font-size: 11px;
		color: var(--qq-text-3);
	}

	.chat-menu__snippet {
		display: block;
		margin-top: 2px;
		font-size: 12px;
		color: var(--qq-text-2);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.chat-menu__item {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 48px;
		border-bottom: 1px solid var(--qq-line);
		font-size: 15px;
		color: var(--qq-text);
	}

	.chat-menu__card .chat-menu__item:last-child {
		border-bottom: none;
	}

	.chat-menu__item--danger {
		color: #fa5151;
	}

	.chat-bubble--image {
		padding: 0;
		background-color: transparent;
		overflow: hidden;
	}

	.chat-image {
		display: block;
		width: 168px;
		height: 168px;
		border-radius: 10px;
		background-color: var(--qq-bg);
	}

	.chat-bubble--voice {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 9px 12px;
	}

	.voice-waves {
		display: flex;
		align-items: center;
		gap: 2px;
		flex: 1;
	}

	.voice-wave {
		width: 2px;
		border-radius: 1px;
		background-color: currentColor;
		opacity: 0.55;
	}

	.chat-bubble--self .voice-wave {
		background-color: var(--qq-card);
	}

	.chat-bubble--other .voice-wave {
		background-color: var(--qq-text-2);
	}

	.voice-duration {
		font-size: 11px;
		opacity: 0.8;
	}

	.chat-bubble--playing .voice-wave {
		animation: voice-beat 0.5s ease-in-out infinite alternate;
		opacity: 1;
	}

	@keyframes voice-beat {
		from {
			transform: scaleY(0.45);
		}
		to {
			transform: scaleY(1.25);
		}
	}

	.chat-file {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.chat-file__name {
		font-size: 13px;
		color: var(--qq-text);
	}

	/* 群互动卡片消息 */
	.chat-group-card {
		width: 232px;
		padding: 12px;
		border-radius: 12px;
		border: 1px solid var(--qq-line);
		background-color: var(--qq-card);
		box-shadow: 0 4px 12px rgba(20, 30, 40, 0.05);
		animation: qq-rise 0.3s ease-out both;
	}

	.chat-group-card:active {
		opacity: 0.86;
	}

	.chat-group-card--self {
		border-color: var(--qq-blue-light);
	}

	.gc-head {
		display: flex;
		align-items: flex-start;
		gap: 9px;
	}

	.gc-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		width: 34px;
		height: 34px;
		border-radius: 10px;
	}

	.gc-icon--todo {
		background: linear-gradient(135deg, #18c0ff, #4776e6);
	}

	.gc-icon--vote {
		background: linear-gradient(135deg, #7b5cf0, #4776e6);
	}

	.gc-icon--checkin {
		background: linear-gradient(135deg, #32c48d, #12b7f5);
	}

	.gc-main {
		flex: 1;
		min-width: 0;
	}

	.gc-title {
		display: block;
		font-size: 13px;
		font-weight: 600;
		line-height: 1.4;
		color: var(--qq-text);
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
	}

	.gc-sub {
		display: block;
		margin-top: 3px;
		font-size: 10.5px;
		line-height: 1.4;
		color: var(--qq-text-3);
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
	}

	.gc-foot {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-top: 10px;
		padding-top: 8px;
		border-top: 1px solid var(--qq-line);
	}

	.gc-foot__badge {
		padding: 2px 6px;
		border-radius: 4px;
		background-color: var(--qq-blue-light);
		font-size: 9.5px;
		font-weight: 600;
		color: #12b7f5;
	}

	.gc-foot__hint {
		font-size: 9.5px;
		color: var(--qq-text-4);
	}

	.chat-system {
		width: 100%;
		display: flex;
		justify-content: center;
	}

	.chat-system__text {
		padding: 4px 10px;
		border-radius: 5px;
		background-color: rgba(0, 0, 0, 0.04);
		font-size: 10.5px;
		color: var(--qq-text-3);
		line-height: 1.5;
	}

	.chat-typing {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 0 4px 10px 45px;
	}

	.typing-dots {
		display: flex;
		gap: 3px;
	}

	.typing-dots view {
		width: 4px;
		height: 4px;
		border-radius: 50%;
		background-color: var(--qq-text-4);
		animation: typing 1.2s infinite ease-in-out;
	}

	.typing-dots view:nth-child(2) {
		animation-delay: 0.2s;
	}

	.typing-dots view:nth-child(3) {
		animation-delay: 0.4s;
	}

	@keyframes typing {
		0%, 60%, 100% { opacity: 0.3; transform: translateY(0); }
		30% { opacity: 1; transform: translateY(-2px); }
	}

	.chat-typing__text {
		font-size: 10.5px;
		color: var(--qq-text-3);
	}

	.chat-body__footer {
		height: 8px;
	}

	/* 输入栏 */
	.chat-input {
		flex-shrink: 0;
		background-color: var(--qq-card-2);
		border-top: 1px solid var(--qq-line);
		padding: 8px 10px calc(8px + env(safe-area-inset-bottom));
	}

	.chat-input__row {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.chat-input__icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 34px;
		flex-shrink: 0;
	}

	.chat-input__field {
		flex: 1;
		display: flex;
		align-items: center;
		height: 36px;
		padding: 0 10px;
		border-radius: 8px;
		background-color: var(--qq-card);
	}

	.chat-input__input {
		width: 100%;
		height: 100%;
		font-size: 14px;
		color: var(--qq-text);
	}

	.chat-input__voice {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		height: 36px;
		border-radius: 8px;
		background-color: var(--qq-card);
		font-size: 13px;
		color: var(--qq-text-2);
	}

	.chat-input__voice--active {
		background-color: var(--qq-blue-light);
		color: #0a9ed8;
	}

	.chat-send {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		height: 32px;
		padding: 0 14px;
		border-radius: 8px;
		background: linear-gradient(135deg, #18c0ff, #0a9ed8);
	}

	.chat-send__text {
		font-size: 13px;
		font-weight: 600;
		color: #ffffff;
	}

	.chat-panel {
		margin-top: 8px;
		border-radius: 10px;
		background-color: var(--qq-card);
		overflow: hidden;
	}

	.chat-emoji {
		padding: 8px 6px;
	}

	.chat-emoji__grid {
		display: flex;
		flex-wrap: wrap;
	}

	.chat-emoji__item {
		width: 12.5%;
		height: 42px;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 22px;
	}

	.chat-more {
		padding: 12px 6px 14px;
	}

	.chat-more__item {
		width: 25%;
		float: left;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
		padding: 8px 0;
	}

	.chat-more__icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 46px;
		height: 46px;
		border-radius: 12px;
	}

	.chat-more__label {
		font-size: 10.5px;
		color: var(--qq-text-2);
	}

	.chat-more::after {
		content: '';
		display: block;
		clear: both;
	}

	.record-mask {
		position: fixed;
		left: 0;
		right: 0;
		top: 0;
		bottom: 0;
		z-index: 100;
		display: flex;
		align-items: center;
		justify-content: center;
		background-color: rgba(0, 0, 0, 0.3);
	}

	.record-box {
		width: 180px;
		padding: 26px 16px;
		border-radius: 16px;
		background-color: rgba(30, 34, 40, 0.92);
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 14px;
	}

	.record-waves {
		display: flex;
		align-items: center;
		gap: 4px;
	}

	.record-wave {
		width: 4px;
		height: 26px;
		border-radius: 3px;
		background: linear-gradient(180deg, #18c0ff, #0a9ed8);
		animation: record-wave 0.8s infinite ease-in-out;
	}

	.record-wave:nth-child(2) { animation-delay: 0.1s; }
	.record-wave:nth-child(3) { animation-delay: 0.2s; }
	.record-wave:nth-child(4) { animation-delay: 0.3s; }
	.record-wave:nth-child(5) { animation-delay: 0.4s; }

	@keyframes record-wave {
		0%, 100% { transform: scaleY(0.5); }
		50% { transform: scaleY(1.15); }
	}

	.record-text {
		font-size: 12px;
		color: #ffffff;
	}

	/* @ 我提醒 */
	.chat-mention {
		display: flex;
		align-items: center;
		gap: 8px;
		margin: 8px 12px 0;
		padding: 8px 10px;
		border-radius: 9px;
		border: 1px solid rgba(245, 87, 108, 0.22);
		background: rgba(245, 87, 108, 0.09);
		animation: card-in 0.28s ease-out both;
	}

	.chat-mention__icon {
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		width: 24px;
		height: 24px;
		border-radius: 8px;
		background: linear-gradient(135deg, #ff7a86, #f5576c);
		color: #ffffff;
		font-size: 14px;
		font-weight: 700;
	}

	.chat-mention__main {
		flex: 1;
		min-width: 0;
	}

	.chat-mention__title {
		display: block;
		font-size: 11.5px;
		font-weight: 600;
		color: #e8485a;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.chat-mention__sub {
		display: block;
		margin-top: 2px;
		font-size: 9.5px;
		color: var(--qq-text-3);
	}

	.chat-mention__close {
		flex-shrink: 0;
		padding: 3px 6px;
		border-radius: 5px;
		background: rgba(245, 87, 108, 0.12);
		font-size: 9.5px;
		color: #e8485a;
	}

	.chat-sender-row {
		display: flex;
		align-items: center;
		gap: 4px;
		margin-bottom: 3px;
	}

	.chat-at-tag {
		padding: 1px 4px;
		border-radius: 3px;
		background: rgba(245, 87, 108, 0.14);
		font-size: 8.5px;
		font-weight: 700;
		color: #f5576c;
		line-height: 1.2;
	}

	.chat-row--mention .chat-bubble--other {
		border: 1px solid rgba(245, 87, 108, 0.3);
		background: rgba(245, 87, 108, 0.09);
	}

	/* 红包 / 转账消息 */
	.chat-pay {
		position: relative;
		width: 236px;
		padding: 11px 12px 9px;
		border-radius: 12px;
		overflow: hidden;
		color: #ffffff;
		background: linear-gradient(135deg, #fb7a62, #e23b3b);
		box-shadow: 0 6px 16px rgba(226, 59, 59, 0.2);
		animation: card-in 0.3s ease-out both;
	}

	.chat-pay::after {
		content: '';
		position: absolute;
		right: -22px;
		top: -28px;
		width: 84px;
		height: 84px;
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.1);
	}

	.chat-pay--transfer {
		background: linear-gradient(135deg, #ffc15a, #f09b18);
		box-shadow: 0 6px 16px rgba(240, 155, 24, 0.2);
	}

	.chat-pay--done {
		filter: saturate(0.78);
		opacity: 0.9;
	}

	.chat-pay:active {
		opacity: 0.86;
	}

	.chat-pay__head {
		position: relative;
		z-index: 1;
		display: flex;
		align-items: center;
		gap: 9px;
	}

	.chat-pay__icon {
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		width: 36px;
		height: 36px;
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.18);
	}

	.chat-pay__main {
		flex: 1;
		min-width: 0;
	}

	.chat-pay__title {
		display: block;
		font-size: 12px;
		font-weight: 600;
		line-height: 1.35;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.chat-pay__note {
		display: block;
		margin-top: 2px;
		font-size: 9px;
		color: rgba(255, 255, 255, 0.72);
	}

	.chat-pay__amount {
		flex-shrink: 0;
		font-size: 16px;
		font-weight: 700;
		letter-spacing: -0.2px;
	}

	.chat-pay__foot {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-top: 9px;
		padding-top: 7px;
		border-top: 1px solid rgba(255, 255, 255, 0.18);
		font-size: 9px;
		color: rgba(255, 255, 255, 0.72);
	}

	/* 视频消息 */
	.chat-video-card {
		position: relative;
		width: 190px;
		height: 132px;
		border-radius: 10px;
		overflow: hidden;
		background: #15171b;
		box-shadow: 0 4px 14px rgba(20, 30, 40, 0.16);
		animation: card-in 0.3s ease-out both;
	}

	.chat-video-card--other {
		border-top-left-radius: 4px;
	}

	.chat-video-card--self {
		border-top-right-radius: 4px;
	}

	.chat-video-card:active {
		opacity: 0.88;
	}

	.chat-video-card__cover {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
	}

	.chat-video-card__shade {
		position: absolute;
		inset: 0;
		background: linear-gradient(180deg, rgba(0, 0, 0, 0.08), rgba(0, 0, 0, 0.18) 55%, rgba(0, 0, 0, 0.62));
	}

	.chat-video-card__play {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		display: flex;
		align-items: center;
		justify-content: center;
		width: 40px;
		height: 40px;
		border-radius: 50%;
		border: 1px solid rgba(255, 255, 255, 0.42);
		background: rgba(0, 0, 0, 0.36);
		backdrop-filter: blur(2px);
	}

	.chat-video-card__time {
		position: absolute;
		right: 7px;
		bottom: 26px;
		padding: 1px 5px;
		border-radius: 4px;
		background: rgba(0, 0, 0, 0.46);
		font-size: 9px;
		color: #ffffff;
	}

	.chat-video-card__foot {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 5px 7px;
	}

	.chat-video-card__label {
		font-size: 9.5px;
		color: rgba(255, 255, 255, 0.92);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	/* 红包 / 转账发送面板 */
	.pay-mask {
		position: fixed;
		top: 0;
		bottom: 0;
		left: 50%;
		transform: translateX(-50%);
		width: 100%;
		max-width: 430px;
		z-index: 84;
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
		background-color: rgba(0, 0, 0, 0.34);
	}

	.pay-sheet {
		padding: 14px 16px calc(18px + env(safe-area-inset-bottom));
		border-radius: 18px 18px 0 0;
		background-color: var(--qq-card);
		animation: sheet-up 0.24s ease-out both;
	}

	@keyframes card-in {
		from { transform: translateY(7px) scale(0.985); }
		to { transform: translateY(0) scale(1); }
	}

	@keyframes sheet-up {
		from { transform: translateY(24px); }
		to { transform: translateY(0); }
	}

	.pay-sheet__head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 16px;
	}

	.pay-sheet__title {
		font-size: 16px;
		font-weight: 600;
		color: var(--qq-text);
	}

	.pay-sheet__cancel {
		font-size: 12.5px;
		color: var(--qq-text-2);
	}

	.pay-sheet__amount {
		display: flex;
		align-items: center;
		gap: 7px;
		padding: 4px 0 12px;
		border-bottom: 1px solid var(--qq-line);
	}

	.pay-sheet__symbol {
		font-size: 21px;
		font-weight: 700;
		color: #e23b3b;
	}

	.pay-sheet__amount--transfer .pay-sheet__symbol {
		color: #f09b18;
	}

	.pay-sheet__input {
		flex: 1;
		height: 42px;
		font-size: 30px;
		font-weight: 700;
		color: var(--qq-text);
	}

	.pay-sheet__quick {
		display: flex;
		gap: 8px;
		margin: 12px 0;
	}

	.pay-sheet__chip {
		padding: 4px 10px;
		border-radius: 14px;
		background-color: var(--qq-card-2);
		font-size: 11px;
		color: var(--qq-text-2);
	}

	.pay-sheet__note {
		height: 40px;
		padding: 0 12px;
		border-radius: 9px;
		background-color: var(--qq-card-2);
		font-size: 12.5px;
		color: var(--qq-text);
	}

	.pay-sheet__submit {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 44px;
		margin-top: 14px;
		border-radius: 10px;
		background: linear-gradient(135deg, #fb7a62, #e23b3b);
		font-size: 14px;
		font-weight: 600;
		color: #ffffff;
	}

	.pay-sheet__submit--transfer {
		background: linear-gradient(135deg, #ffc15a, #f09b18);
	}

	.pay-sheet__submit:active {
		opacity: 0.86;
	}

	.pay-sheet__tip {
		display: block;
		margin-top: 9px;
		text-align: center;
		font-size: 9.5px;
		color: var(--qq-text-4);
	}

	/* 红包 / 转账详情 */
	.pay-card-mask {
		position: fixed;
		inset: 0;
		z-index: 95;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(10, 12, 16, 0.58);
		backdrop-filter: blur(3px);
	}

	.pay-card-box {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		width: 278px;
		padding: 24px 20px 18px;
		border-radius: 18px;
		overflow: hidden;
		color: #ffffff;
		background: linear-gradient(160deg, #f96851 0%, #df3333 60%, #c91f2b 100%);
		box-shadow: 0 18px 40px rgba(0, 0, 0, 0.28);
		animation: pay-pop 0.26s ease-out both;
	}

	.pay-card-box::after {
		content: '';
		position: absolute;
		left: -34px;
		top: -46px;
		width: 140px;
		height: 140px;
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.08);
	}

	.pay-card-box--transfer {
		background: linear-gradient(160deg, #ffc65b 0%, #f0a020 62%, #de8810 100%);
	}

	@keyframes pay-pop {
		from { transform: translateY(14px) scale(0.96); }
		to { transform: translateY(0) scale(1); }
	}

	.pay-card-avatar {
		position: relative;
		z-index: 1;
		padding: 2px;
		border-radius: 50%;
		border: 1px solid rgba(255, 255, 255, 0.4);
	}

	.pay-card-from {
		margin-top: 9px;
		font-size: 11px;
		color: rgba(255, 255, 255, 0.78);
	}

	.pay-card-number {
		display: flex;
		align-items: baseline;
		gap: 3px;
		margin-top: 10px;
	}

	.pay-card-symbol {
		font-size: 16px;
		font-weight: 600;
	}

	.pay-card-amount {
		font-size: 35px;
		font-weight: 700;
		letter-spacing: -0.6px;
	}

	.pay-card-note {
		margin-top: 5px;
		font-size: 11px;
		color: rgba(255, 255, 255, 0.8);
		text-align: center;
	}

	.pay-card-open {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 58px;
		height: 58px;
		margin-top: 18px;
		border-radius: 50%;
		background: #ffffff;
		box-shadow: 0 6px 16px rgba(0, 0, 0, 0.16);
		font-size: 22px;
		font-weight: 700;
		color: #d93333;
	}

	.pay-card-open--transfer {
		width: auto;
		height: 38px;
		padding: 0 22px;
		border-radius: 19px;
		font-size: 13px;
		font-weight: 600;
		color: #cc8412;
	}

	.pay-card-open:active {
		transform: scale(0.95);
	}

	.pay-card-done {
		display: flex;
		align-items: center;
		gap: 5px;
		margin-top: 18px;
		font-size: 11.5px;
		color: rgba(255, 255, 255, 0.9);
	}

	.pay-card-close {
		margin-top: 13px;
		font-size: 10px;
		color: rgba(255, 255, 255, 0.58);
	}

	/* 视频播放器 */
	.video-mask {
		position: fixed;
		inset: 0;
		z-index: 96;
		background: #000000;
	}

	.video-player {
		position: relative;
		width: 100%;
		max-width: 430px;
		height: 100%;
		margin: 0 auto;
		overflow: hidden;
		background: #000000;
	}

	.video-poster {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
	}

	.video-shade {
		position: absolute;
		inset: 0;
		background: linear-gradient(180deg, rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0.1) 35%, rgba(0, 0, 0, 0) 55%, rgba(0, 0, 0, 0.7));
	}

	.video-top {
		position: absolute;
		top: calc(16px + env(safe-area-inset-top));
		left: 14px;
		right: 14px;
		z-index: 3;
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.video-top__label {
		font-size: 13px;
		color: rgba(255, 255, 255, 0.9);
	}

	.video-top__close {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 34px;
		height: 34px;
		border-radius: 50%;
		background: rgba(0, 0, 0, 0.34);
	}

	.video-center {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.video-center__btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 62px;
		height: 62px;
		border-radius: 50%;
		border: 1px solid rgba(255, 255, 255, 0.42);
		background: rgba(0, 0, 0, 0.38);
		backdrop-filter: blur(3px);
	}

	.video-bottom {
		position: absolute;
		left: 18px;
		right: 18px;
		bottom: calc(34px + env(safe-area-inset-bottom));
		z-index: 3;
	}

	.video-progress {
		height: 3px;
		border-radius: 2px;
		overflow: hidden;
		background: rgba(255, 255, 255, 0.24);
	}

	.video-progress__fill {
		height: 100%;
		width: 0;
		border-radius: 2px;
		background: #ffffff;
		animation-name: video-fill;
		animation-timing-function: linear;
		animation-fill-mode: forwards;
	}

	@keyframes video-fill {
		from { width: 0; }
		to { width: 100%; }
	}

	.video-meta {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-top: 8px;
		font-size: 9.5px;
		color: rgba(255, 255, 255, 0.65);
	}

	/* G：多选、批量删除与转发 */
	.chat-hd-text {
		padding: 0 4px;
		font-size: 13px;
		color: #12b7f5;
	}

	.chat-row {
		position: relative;
	}

	.chat-row--multi {
		padding-left: 30px;
	}

	.chat-row--selected {
		border-radius: 10px;
		background-color: var(--qq-blue-light);
	}

	.chat-pick {
		position: absolute;
		left: 3px;
		top: 9px;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 18px;
		height: 18px;
		border-radius: 50%;
		border: 1.5px solid #c9cdd4;
		background-color: var(--qq-card);
		box-sizing: border-box;
	}

	.chat-pick--on {
		border-color: #12b7f5;
		background-color: #12b7f5;
	}

	.chat-pick__dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background-color: #ffffff;
		opacity: 0;
	}

	.chat-pick--on .chat-pick__dot {
		opacity: 1;
	}

	.chat-multi {
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 8px 12px calc(8px + env(safe-area-inset-bottom));
		border-top: 1px solid var(--qq-line);
		background-color: var(--qq-card);
	}

	.chat-multi__info {
		display: flex;
		align-items: baseline;
		gap: 3px;
		flex: 1;
		min-width: 0;
	}

	.chat-multi__count {
		font-size: 18px;
		font-weight: 700;
		color: #12b7f5;
	}

	.chat-multi__label {
		font-size: 11px;
		color: var(--qq-text-3);
	}

	.chat-multi__btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 3px;
		height: 34px;
		padding: 0 8px;
		border-radius: 8px;
		background-color: var(--qq-blue-light);
		font-size: 12px;
		color: #12b7f5;
	}

	.chat-multi__btn--danger {
		color: #fa5151;
		background-color: rgba(250, 81, 81, 0.08);
	}

	.chat-multi__btn--disabled {
		opacity: 0.42;
	}

	.chat-multi__cancel {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 34px;
		padding: 0 7px;
		font-size: 12px;
		color: var(--qq-text-2);
	}

	.forward-mask {
		position: fixed;
		top: 0;
		bottom: 0;
		left: 50%;
		transform: translateX(-50%);
		width: 100%;
		max-width: 430px;
		z-index: 84;
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
		background-color: rgba(0, 0, 0, 0.34);
	}

	.forward-sheet {
		max-height: 72vh;
		display: flex;
		flex-direction: column;
		padding: 12px 14px calc(12px + env(safe-area-inset-bottom));
		border-radius: 16px 16px 0 0;
		background-color: var(--qq-card);
	}

	.forward-head {
		display: flex;
		align-items: baseline;
		gap: 8px;
		padding-bottom: 10px;
		border-bottom: 1px solid var(--qq-line);
	}

	.forward-head__title {
		font-size: 15px;
		font-weight: 600;
		color: var(--qq-text);
	}

	.forward-head__sub {
		flex: 1;
		font-size: 11px;
		color: var(--qq-text-3);
	}

	.forward-head__close {
		font-size: 12px;
		color: var(--qq-text-2);
	}

	.forward-list {
		height: 48vh;
	}

	.forward-item {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 9px 2px;
		border-bottom: 1px solid var(--qq-line);
	}

	.forward-item:last-child {
		border-bottom: none;
	}

	.forward-item__main {
		flex: 1;
		min-width: 0;
	}

	.forward-item__name {
		display: block;
		font-size: 13px;
		font-weight: 500;
		color: var(--qq-text);
	}

	.forward-item__sub {
		display: block;
		margin-top: 2px;
		font-size: 10.5px;
		color: var(--qq-text-3);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.forward-empty {
		padding: 26px 0;
		text-align: center;
		font-size: 12px;
		color: var(--qq-text-3);
	}

	.confirm-mask {
		position: fixed;
		top: 0;
		bottom: 0;
		left: 50%;
		transform: translateX(-50%);
		width: 100%;
		max-width: 430px;
		z-index: 86;
		display: flex;
		align-items: center;
		justify-content: center;
		background-color: rgba(0, 0, 0, 0.4);
	}

	.confirm-box {
		width: 286px;
		padding: 20px 18px 0;
		border-radius: 14px;
		overflow: hidden;
		background-color: var(--qq-card);
		text-align: center;
	}

	.confirm-box__title {
		display: block;
		font-size: 16px;
		font-weight: 600;
		color: var(--qq-text);
	}

	.confirm-box__sub {
		display: block;
		margin-top: 8px;
		font-size: 11.5px;
		line-height: 1.5;
		color: var(--qq-text-3);
	}

	.confirm-box__actions {
		display: flex;
		margin: 18px -18px 0;
		border-top: 1px solid var(--qq-line);
	}

	.confirm-box__btn {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		height: 46px;
		font-size: 15px;
		color: var(--qq-text);
	}

	.confirm-box__btn:first-child {
		border-right: 1px solid var(--qq-line);
	}

	.confirm-box__btn--danger {
		color: #fa5151;
		font-weight: 500;
	}
</style>
