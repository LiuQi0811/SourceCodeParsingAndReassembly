<script lang="ts" setup>
	import { computed, nextTick, onMounted, ref } from 'vue'
	import { onLoad, onReady, onUnload } from '@dcloudio/uni-app'
	import {
		appendMessage,
		findConversation,
		findUser,
		getMessages,
		groupMetaOf,
		markConversationRead,
		nowTime,
		qqStore,
		receiveText,
		removeMessage,
		sendText,
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
		{ label: '拍摄', icon: 'camera', color: '#32C48D' },
		{ label: '文件', icon: 'folder', color: '#4776E6' },
		{ label: '位置', icon: 'location', color: '#FF9F1C' },
		{ label: '红包', icon: 'lucky-money', color: '#F5576C' },
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

	onLoad((options: any) => {
		convId.value = options?.id || ''
		conv.value = findConversation(convId.value)
		if (!conv.value) {
			uni.showToast({ title: '会话不存在', icon: 'none' })
			return
		}
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
		if (conv.value) qqStore.typing[conv.value.id] = false
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
		const sent = sendText(conv.value.id, draft.value)
		if (sent && quote.value) sent.quote = { ...quote.value }
		quote.value = null
		draft.value = ''
		emojiOpen.value = false
		moreOpen.value = false
		messages.value = getMessages(conv.value.id)
		scrollToBottom()
		scheduleReply()
	}

	function scheduleReply() {
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
				receiveText(id, senderId, REPLIES[Math.floor(Math.random() * REPLIES.length)])
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
		uni.showToast({ title: `演示：${label}`, icon: 'none' })
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
		uni.previewImage({ urls: [url] })
	}

	function previewMessageImages(msg: QQMessage) {
		if (msg.image) uni.previewImage({ urls: [msg.image] })
	}

	function openProfile(senderId: string) {
		if (senderId === 'me') return
		goUserDetail(senderId)
	}

	function openGroupCard(card: QQGroupCard) {
		if (!conv.value) return
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

	function msgIdFromEvent(event: Event): string | null {
		const target = event.target as HTMLElement | null
		if (!target || typeof target.closest !== 'function') return null
		const row = target.closest('[data-msg]') as HTMLElement | null
		return row ? row.getAttribute('data-msg') : null
	}

	function handleContextMenu(event: MouseEvent) {
		const id = msgIdFromEvent(event)
		if (!id) return
		event.preventDefault()
		openMenu(id)
	}

	function handleTouchStart(event: TouchEvent) {
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
			:title="conv ? conv.name : '聊天'"
			:subtitle="subtitle"
			bg="#F7F8FA"
			:border="true"
		>
			<template #right>
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
				:class="{ 'chat-row--self': msg.senderId === 'me' }"
			>
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
						<text
							v-if="msg.senderId !== 'me' && conv?.type === 'group'"
							class="chat-sender"
						>
							{{ msg.senderName || findUser(msg.senderId).name }}
						</text>

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
					</view>
				</template>
			</view>

			<view v-if="conv && qqStore.typing[conv.id]" class="chat-typing">
				<view class="typing-dots"><view /><view /><view /></view>
				<text class="chat-typing__text">对方正在输入…</text>
			</view>

			<view class="chat-body__footer" />
		</scroll-view>

		<!-- 输入栏 -->
		<view class="chat-input" :class="{ 'chat-input--panel': emojiOpen || moreOpen }">
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
</style>
