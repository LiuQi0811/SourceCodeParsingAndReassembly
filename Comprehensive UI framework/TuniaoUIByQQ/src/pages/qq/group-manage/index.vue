<script lang="ts" setup>
	import { computed, ref } from 'vue'
	import { onLoad } from '@dcloudio/uni-app'
	import {
		findConversation,
		groupAlbumsOf,
		groupCheckinOf,
		groupMetaOf,
		groupTodosOf,
		groupVotesOf,
		qqStore,
		removeConversation,
		renameGroup,
	} from '@/qq/store'
	import {
		TAB_PATHS,
		goGroupAlbum,
		goGroupCheckin,
		goGroupFiles,
		goGroupTodo,
		goGroupVote,
		goMembers,
		goNotice,
	} from '@/qq/router'

	const convId = ref('c3')
	const renameShow = ref(false)
	const renameDraft = ref('')

	onLoad((options: any) => {
		convId.value = options?.id || 'c3'
		const conv = findConversation(convId.value)
		renameDraft.value = conv?.name || ''
	})

	const conv = computed(() => findConversation(convId.value))
	const meta = computed(() => groupMetaOf(convId.value))

	const adminRows = computed(() =>
		meta.value.admins.map((id) => qqStore.contacts.find((u) => u.id === id)).filter(Boolean)
	)

	const todoPending = computed(() => groupTodosOf(convId.value).filter((t) => !t.joined).length)
	const voteActive = computed(() => groupVotesOf(convId.value).filter((v) => !v.closed).length)
	const albumCount = computed(() => groupAlbumsOf(convId.value).length)
	const checkin = computed(() => groupCheckinOf(convId.value))

	function openTodo() {
		goGroupTodo(convId.value)
	}

	function openVote() {
		goGroupVote(convId.value)
	}

	function openAlbum() {
		goGroupAlbum(convId.value)
	}

	function openCheckin() {
		goGroupCheckin(convId.value)
	}

	function openRename() {
		renameDraft.value = conv.value?.name || ''
		renameShow.value = true
	}

	function closeRename() {
		renameShow.value = false
	}

	function saveRename() {
		const next = renameDraft.value.trim()
		if (!next) {
			uni.showToast({ title: '群名称不能为空', icon: 'none' })
			return
		}
		if (next.length > 20) {
			uni.showToast({ title: '群名称最多 20 个字', icon: 'none' })
			return
		}
		renameGroup(convId.value, next)
		renameShow.value = false
		uni.showToast({ title: '群名称已修改', icon: 'none' })
	}

	function onAvatar() {
		uni.showToast({ title: '演示：从相册选择群头像', icon: 'none' })
	}

	function goManageMembers() {
		goMembers(convId.value, true)
	}

	function onMutedChange(e: any) {
		const on = typeof e === 'boolean' ? e : !!e?.detail?.value
		uni.showToast({ title: on ? '已开启全员禁言' : '已解除全员禁言', icon: 'none' })
	}

	function onApprovalChange(e: any) {
		const on = typeof e === 'boolean' ? e : !!e?.detail?.value
		uni.showToast({ title: on ? '新成员入群需审批' : '已关闭入群审批', icon: 'none' })
	}

	function onTransfer() {
		uni.showModal({
			title: '转让群主',
			content: '演示：群主转让需要对方同意，当前仅展示入口。',
			showCancel: false,
			confirmText: '知道了',
		})
	}

	function onQuit() {
		if (!conv.value) return
		uni.showModal({
			title: '退出群聊',
			content: `确定退出「${conv.value.name}」吗？退出后将不再接收该群消息。`,
			confirmText: '退出',
			confirmColor: '#FA5151',
			success: (res) => {
				if (!res.confirm) return
				removeConversation(convId.value)
				uni.showToast({ title: '已退出群聊', icon: 'none' })
				setTimeout(() => uni.reLaunch({ url: TAB_PATHS.message }), 700)
			},
		})
	}
</script>

<template>
	<view class="qq-page gm-page">
		<qq-navbar title="群管理" bg="#F7F8FA" />

		<view class="gm-hero">
			<view class="gm-hero__avatar" @tap="onAvatar">
				<qq-avatar
					:name="conv ? conv.name : '群'"
					:from="conv ? conv.avatarFrom : '#12B7F5'"
					:to="conv ? conv.avatarTo : '#0A83C4'"
					:text="conv?.avatarText || '群'"
					:size="52"
					group
				/>
				<view class="gm-hero__camera">
					<tn-icon name="camera" size="11px" color="#FFFFFF" />
				</view>
			</view>
			<view class="gm-hero__main" @tap="openRename">
				<view class="gm-hero__row">
					<text class="gm-hero__name">{{ conv ? conv.name : '群聊' }}</text>
					<tn-icon name="right" size="12px" color="#9AA0A8" />
				</view>
				<text class="gm-hero__sub">群号 {{ conv?.groupNo || '884213906' }} · {{ conv?.members || 128 }} 人</text>
			</view>
		</view>

		<view class="gm-card">
			<view class="gm-switch">
				<view class="gm-switch__main">
					<text class="gm-switch__label">全员禁言</text>
					<text class="gm-switch__desc">开启后仅群主和管理员可发言</text>
				</view>
				<tn-switch v-model="meta.allMuted" active-color="tn-blue" @change="onMutedChange" />
			</view>
			<view class="gm-switch gm-switch--last">
				<view class="gm-switch__main">
					<text class="gm-switch__label">入群审批</text>
					<text class="gm-switch__desc">新成员加入需要管理员同意</text>
				</view>
				<tn-switch v-model="meta.approval" active-color="tn-blue" @change="onApprovalChange" />
			</view>
		</view>

		<view class="gm-card">
			<view class="gm-card__head">
				<text class="gm-card__title">群管理员</text>
				<view class="gm-card__link" @tap="goManageMembers">
					<text>管理</text>
					<tn-icon name="right" size="11px" color="#9AA0A8" />
				</view>
			</view>
			<view class="gm-admins">
				<view v-for="u in adminRows" :key="u.id" class="gm-admin">
					<qq-avatar :name="u.name" :from="u.avatarFrom" :to="u.avatarTo" :size="32" />
					<text class="gm-admin__name">{{ u.name }}</text>
				</view>
				<view class="gm-admin gm-admin--add" @tap="goManageMembers">
					<view class="gm-admin__plus">
						<tn-icon name="add" size="15px" color="#9AA0A8" />
					</view>
					<text class="gm-admin__name gm-admin__name--add">添加</text>
				</view>
			</view>
			<text class="gm-admins__tip">管理员可修改群公告、审批入群、移出成员</text>
		</view>

		<view class="gm-card gm-links">
			<view class="gm-link" @tap="goManageMembers">
				<view class="gm-link__icon gm-link__icon--blue"><tn-icon name="team" size="17px" color="#4776E6" /></view>
				<text class="gm-link__label">群成员管理</text>
				<text class="gm-link__value">{{ conv?.members || 128 }} 人</text>
				<tn-icon name="right" size="11px" color="#C2C6CC" />
			</view>
			<view class="gm-link" @tap="goNotice(convId)">
				<view class="gm-link__icon gm-link__icon--orange"><tn-icon name="notice-fill" size="17px" color="#FF9F1C" /></view>
				<text class="gm-link__label">群公告</text>
				<tn-icon name="right" size="11px" color="#C2C6CC" />
			</view>
			<view class="gm-link" @tap="goGroupFiles(convId)">
				<view class="gm-link__icon gm-link__icon--green"><tn-icon name="folder" size="17px" color="#32C48D" /></view>
				<text class="gm-link__label">群文件</text>
				<text class="gm-link__value">86.4 MB</text>
				<tn-icon name="right" size="11px" color="#C2C6CC" />
			</view>
			<view class="gm-link gm-link--last" @tap="onTransfer">
				<view class="gm-link__icon gm-link__icon--purple"><tn-icon name="level" size="17px" color="#8E54E9" /></view>
				<text class="gm-link__label">转让群主</text>
				<tn-icon name="right" size="11px" color="#C2C6CC" />
			</view>
		</view>

		<view class="gm-card gm-inter">
			<view class="gm-card__head">
				<text class="gm-card__title">群互动</text>
				<text class="gm-inter__hint">让群里热闹起来</text>
			</view>
			<view class="gm-inter__grid">
				<view class="gm-inter__item" @tap="openTodo">
					<view class="gm-inter__icon gm-inter__icon--blue">
						<tn-icon name="check" size="17px" color="#4776E6" />
						<text v-if="todoPending" class="gm-inter__badge">{{ todoPending }}</text>
					</view>
					<text class="gm-inter__label">群待办</text>
					<text class="gm-inter__sub">{{ todoPending }} 项待完成</text>
				</view>
				<view class="gm-inter__item" @tap="openVote">
					<view class="gm-inter__icon gm-inter__icon--purple">
						<tn-icon name="comment" size="17px" color="#8E54E9" />
						<text v-if="voteActive" class="gm-inter__badge gm-inter__badge--purple">{{ voteActive }}</text>
					</view>
					<text class="gm-inter__label">群投票</text>
					<text class="gm-inter__sub">{{ voteActive }} 个进行中</text>
				</view>
				<view class="gm-inter__item" @tap="openAlbum">
					<view class="gm-inter__icon gm-inter__icon--green">
						<tn-icon name="image" size="17px" color="#32C48D" />
					</view>
					<text class="gm-inter__label">群相册</text>
					<text class="gm-inter__sub">{{ albumCount }} 个相册</text>
				</view>
				<view class="gm-inter__item" @tap="openCheckin">
					<view class="gm-inter__icon gm-inter__icon--orange">
						<tn-icon name="success-circle" size="17px" color="#FF9F1C" />
					</view>
					<text class="gm-inter__label">群签到</text>
					<text class="gm-inter__sub">{{ checkin.checked ? '今日已签到' : '今日待签到' }}</text>
				</view>
			</view>
		</view>

		<view class="gm-danger" @tap="onQuit">
			<text class="gm-danger__text">退出群聊</text>
		</view>

		<text class="gm-footer">群管理操作为本地演示，不会影响真实群</text>

		<!-- 修改群名称弹窗 -->
		<view v-if="renameShow" class="gm-mask" @tap="closeRename">
			<view class="gm-dialog" @tap.stop>
				<text class="gm-dialog__title">修改群名称</text>
				<input
					v-model="renameDraft"
					class="gm-dialog__input"
					type="text"
					maxlength="20"
					placeholder="请输入群名称"
					confirm-type="done"
					@confirm="saveRename"
				/>
				<view class="gm-dialog__count">{{ renameDraft.length }} / 20</view>
				<view class="gm-dialog__actions">
					<view class="gm-dialog__btn" @tap="closeRename">
						<text class="gm-dialog__btn-text">取消</text>
					</view>
					<view class="gm-dialog__btn gm-dialog__btn--primary" @tap="saveRename">
						<text class="gm-dialog__btn-text gm-dialog__btn-text--primary">保存</text>
					</view>
				</view>
			</view>
		</view>
	</view>
</template>

<style lang="scss" scoped>
	.gm-page {
		min-height: 100vh;
		box-sizing: border-box;
		padding-bottom: 26px;
		background-color: var(--qq-card-2);
	}

	.gm-hero {
		display: flex;
		align-items: center;
		margin: 6px 12px 0;
		padding: 14px;
		border-radius: 12px;
		background-color: var(--qq-card);
	}

	.gm-hero__avatar {
		position: relative;
		flex-shrink: 0;
	}

	.gm-hero__camera {
		position: absolute;
		right: -3px;
		bottom: -3px;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 20px;
		height: 20px;
		border-radius: 50%;
		background-color: #12b7f5;
		border: 1.5px solid var(--qq-card);
	}

	.gm-hero__main {
		flex: 1;
		min-width: 0;
		margin-left: 14px;
	}

	.gm-hero__row {
		display: flex;
		align-items: center;
		gap: 4px;
	}

	.gm-hero__name {
		font-size: 17px;
		font-weight: 600;
		color: var(--qq-text);
	}

	.gm-hero__sub {
		display: block;
		margin-top: 4px;
		font-size: 10.5px;
		color: var(--qq-text-3);
	}

	.gm-card {
		margin: 10px 12px 0;
		padding: 4px 14px;
		border-radius: 12px;
		background-color: var(--qq-card);
	}

	.gm-switch {
		display: flex;
		align-items: center;
		padding: 12px 0;
		border-bottom: 1px solid var(--qq-line);
	}

	.gm-switch--last {
		border-bottom: none;
	}

	.gm-switch__main {
		flex: 1;
		min-width: 0;
	}

	.gm-switch__label {
		display: block;
		font-size: 13.5px;
		font-weight: 500;
		color: var(--qq-text);
	}

	.gm-switch__desc {
		display: block;
		margin-top: 3px;
		font-size: 10px;
		color: var(--qq-text-4);
	}

	.gm-card__head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 10px 0 4px;
	}

	.gm-card__title {
		font-size: 12px;
		color: var(--qq-text-3);
	}

	.gm-card__link {
		display: flex;
		align-items: center;
		gap: 2px;
		font-size: 10px;
		color: var(--qq-text-4);
	}

	.gm-admins {
		display: flex;
		flex-wrap: wrap;
		gap: 16px;
		padding: 8px 0 4px;
	}

	.gm-admin {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 5px;
	}

	.gm-admin__name {
		font-size: 10px;
		color: var(--qq-text-3);
	}

	.gm-admin__plus {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		border-radius: 50%;
		border: 1px dashed var(--qq-line-strong);
	}

	.gm-admin__name--add {
		color: var(--qq-text-4);
	}

	.gm-admins__tip {
		display: block;
		padding: 8px 0 10px;
		font-size: 9.5px;
		color: var(--qq-text-4);
	}

	.gm-links {
		padding: 0 14px;
	}

	.gm-link {
		display: flex;
		align-items: center;
		padding: 12px 0;
		border-bottom: 1px solid var(--qq-line);
	}

	.gm-link--last {
		border-bottom: none;
	}

	.gm-link__icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		border-radius: 7px;
		margin-right: 10px;
	}

	.gm-link__icon--blue {
		background-color: rgba(71, 118, 230, 0.1);
	}

	.gm-link__icon--orange {
		background-color: rgba(255, 159, 28, 0.1);
	}

	.gm-link__icon--green {
		background-color: rgba(50, 196, 141, 0.1);
	}

	.gm-link__icon--purple {
		background-color: rgba(142, 84, 233, 0.1);
	}

	.gm-link__label {
		flex: 1;
		font-size: 13px;
		color: var(--qq-text);
	}

	.gm-link__value {
		margin-right: 6px;
		font-size: 10px;
		color: var(--qq-text-4);
	}

	.gm-inter {
		padding-top: 12px;
		padding-bottom: 12px;
	}

	.gm-inter__hint {
		font-size: 9.5px;
		color: var(--qq-text-4);
	}

	.gm-inter__grid {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 4px;
		margin-top: 10px;
	}

	.gm-inter__item {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 8px 0 7px;
		border-radius: 10px;
		background-color: var(--qq-card-2);
	}

	.gm-inter__icon {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		border-radius: 10px;
	}

	.gm-inter__icon--blue {
		background-color: rgba(71, 118, 230, 0.1);
	}

	.gm-inter__icon--purple {
		background-color: rgba(142, 84, 233, 0.1);
	}

	.gm-inter__icon--green {
		background-color: rgba(50, 196, 141, 0.1);
	}

	.gm-inter__icon--orange {
		background-color: rgba(255, 159, 28, 0.1);
	}

	.gm-inter__badge {
		position: absolute;
		right: -4px;
		top: -5px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 14px;
		height: 14px;
		padding: 0 3px;
		border-radius: 7px;
		background-color: #fa5151;
		font-size: 8px;
		font-weight: 600;
		color: #ffffff;
	}

	.gm-inter__badge--purple {
		background-color: #8e54e9;
	}

	.gm-inter__label {
		margin-top: 6px;
		font-size: 11.5px;
		font-weight: 500;
		color: var(--qq-text);
	}

	.gm-inter__sub {
		margin-top: 2px;
		font-size: 9px;
		color: var(--qq-text-3);
	}

	.gm-danger {
		margin: 12px 12px 0;
		padding: 13px 0;
		border-radius: 12px;
		background-color: var(--qq-card);
		text-align: center;
	}

	.gm-danger__text {
		font-size: 13px;
		color: #fa5151;
	}

	.gm-footer {
		display: block;
		margin-top: 14px;
		text-align: center;
		font-size: 9.5px;
		color: var(--qq-text-4);
	}

	.gm-mask {
		position: fixed;
		inset: 0;
		z-index: 999;
		display: flex;
		align-items: center;
		justify-content: center;
		background-color: rgba(0, 0, 0, 0.45);
	}

	.gm-dialog {
		width: 280px;
		padding: 20px 18px 14px;
		border-radius: 14px;
		background-color: var(--qq-card);
	}

	.gm-dialog__title {
		display: block;
		font-size: 15px;
		font-weight: 600;
		color: var(--qq-text);
		text-align: center;
	}

	.gm-dialog__input {
		height: 38px;
		margin-top: 14px;
		padding: 0 10px;
		border-radius: 8px;
		background-color: var(--qq-card-2);
		font-size: 13px;
		color: var(--qq-text);
	}

	.gm-dialog__count {
		margin-top: 6px;
		text-align: right;
		font-size: 9.5px;
		color: var(--qq-text-4);
	}

	.gm-dialog__actions {
		display: flex;
		gap: 10px;
		margin-top: 14px;
	}

	.gm-dialog__btn {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		height: 36px;
		border-radius: 8px;
		background-color: var(--qq-card-2);
	}

	.gm-dialog__btn--primary {
		background-color: #12b7f5;
	}

	.gm-dialog__btn-text {
		font-size: 12.5px;
		color: var(--qq-text-2);
	}

	.gm-dialog__btn-text--primary {
		color: #ffffff;
		font-weight: 500;
	}
</style>
