<script lang="ts" setup>
	import { computed, ref } from 'vue'
	import { onLoad, onShow } from '@dcloudio/uni-app'
	import {
		findConversation,
		groupMetaOf,
		qqStore,
		removeGroupMember,
		setGroupAdmin,
	} from '@/qq/store'
	import { goUserDetail } from '@/qq/router'
	import type { QQUser } from '@/qq/types'

	const convId = ref('')
	const keyword = ref('')
	const manageMode = ref(false)
	const sheetRow = ref<MemberRow | null>(null)

	onLoad((options: any) => {
		convId.value = options?.id || 'c3'
		manageMode.value = options?.manage === '1'
	})

	onShow(() => {
		const pages = getCurrentPages()
		const current = pages[pages.length - 1] as any
		const id = current?.options?.id
		if (id) convId.value = id
	})

	const conv = computed(() => findConversation(convId.value))
	const total = computed(() => conv.value?.members || 128)
	const meta = computed(() => groupMetaOf(convId.value))

	interface MemberRow {
		user: QQUser
		role: 'owner' | 'admin' | 'member'
		title?: string
	}

	function contactUser(id: string): QQUser | undefined {
		if (id === 'me') return qqStore.user
		return qqStore.contacts.find((u) => u.id === id)
	}

	/** 演示群成员：群主 林嘉禾、管理员取群管理状态，其余取通讯录好友 */
	const roster = computed<MemberRow[]>(() => {
		const rows: MemberRow[] = []
		const add = (id: string, role: MemberRow['role']) => {
			if (meta.value.removed.includes(id)) return
			if (meta.value.admins.includes(id)) role = 'admin'
			else if (role === 'admin') role = 'member'
			const user = contactUser(id)
			if (user) rows.push({ user, role })
		}
		add('u_linjiahe', 'owner')
		;[ 'u_suwan', 'u_chenyu' ].forEach((id) => add(id, 'admin'))
		;[
			'me',
			'u_xujiashu',
			'u_zhengyinuo',
			'u_yansiyuan',
			'u_lizhixia',
			'u_fangyuan',
			'u_liangxingye',
			'u_songqinghe',
			'u_wangyan',
			'u_yangman',
			'u_zhouyuning',
			'u_zhangke',
		].forEach((id) => add(id, 'member'))
		return rows.slice(0, Math.max(1, Math.min(total.value, rows.length)))
	})

	const filtered = computed(() => {
		const kw = keyword.value.trim()
		if (!kw) return roster.value
		return roster.value.filter((row) => row.user.name.includes(kw))
	})

	const ownerRows = computed(() => filtered.value.filter((r) => r.role === 'owner'))
	const adminRows = computed(() => filtered.value.filter((r) => r.role === 'admin'))
	const memberRows = computed(() => filtered.value.filter((r) => r.role === 'member'))

	function roleLabel(role: MemberRow['role']) {
		if (role === 'owner') return '群主'
		if (role === 'admin') return '管理员'
		return ''
	}

	function openMember(row: MemberRow) {
		if (manageMode.value) {
			sheetRow.value = row
			return
		}
		if (row.user.id === 'me') {
			uni.showToast({ title: '这是你自己', icon: 'none' })
			return
		}
		goUserDetail(row.user.id)
	}

	function toggleManage() {
		manageMode.value = !manageMode.value
		if (!manageMode.value) sheetRow.value = null
	}

	function closeSheet() {
		sheetRow.value = null
	}

	function sheetViewProfile() {
		if (!sheetRow.value) return
		const id = sheetRow.value.user.id
		closeSheet()
		if (id === 'me') {
			uni.showToast({ title: '这是你自己', icon: 'none' })
			return
		}
		goUserDetail(id)
	}

	function sheetToggleAdmin() {
		const row = sheetRow.value
		if (!row) return
		const next = row.role !== 'admin'
		setGroupAdmin(convId.value, row.user.id, next)
		closeSheet()
		uni.showToast({ title: next ? '已设为管理员' : '已取消管理员', icon: 'none' })
	}

	function sheetRemove() {
		const row = sheetRow.value
		if (!row) return
		uni.showModal({
			title: '移出群聊',
			content: `确定将「${row.user.name}」移出本群吗？`,
			confirmText: '移出',
			confirmColor: '#FA5151',
			success: (res) => {
				if (!res.confirm) return
				removeGroupMember(convId.value, row.user.id)
				closeSheet()
				uni.showToast({ title: '已移出群聊', icon: 'none' })
			},
		})
	}

	function onInvite() {
		uni.showToast({ title: '演示：邀请好友加入群聊', icon: 'none' })
	}
</script>

<template>
	<view class="qq-page members-page" :class="{ 'members-page--manage': manageMode }">
		<qq-navbar title="群成员" bg="#F7F8FA">
			<template #right>
				<view class="members-hd" @tap="toggleManage">
					<text class="members-hd__text">{{ manageMode ? '完成' : '管理' }}</text>
				</view>
			</template>
		</qq-navbar>

		<view class="members-head">
			<view class="members-head__text">
				<text class="members-head__count">共 {{ total }} 人</text>
				<text v-if="total > roster.length" class="members-head__tips">演示只展示部分成员</text>
				<text v-if="manageMode" class="members-head__tips members-head__tips--manage">管理模式：点击成员可设为管理员或移出群聊</text>
			</view>
			<view class="members-head__invite" @tap="onInvite">
				<tn-icon name="my-add" size="15px" color="#12B7F5" />
				<text class="members-head__invite-text">邀请</text>
			</view>
		</view>

		<view class="members-search">
			<tn-icon name="search" size="16px" color="#9AA0A8" />
			<input
				v-model="keyword"
				class="members-search__input"
				placeholder="搜索群成员"
				confirm-type="search"
			/>
		</view>

		<view v-if="ownerRows.length" class="members-card">
			<view class="members-card__title">群主</view>
			<view
				v-for="row in ownerRows"
				:key="row.user.id"
				class="member-row"
				@tap="openMember(row)"
			>
				<qq-avatar
					:name="row.user.name"
					:from="row.user.avatarFrom"
					:to="row.user.avatarTo"
					:size="42"
					:online="!!row.user.online"
				/>
				<view class="member-row__main">
					<text class="member-row__name">{{ row.user.name }}</text>
					<text class="member-row__sub">{{ row.user.signature }}</text>
				</view>
				<text class="member-row__role member-row__role--owner">群主</text>
				<tn-icon v-if="manageMode" class="member-row__more" name="more-horizontal" size="16px" color="#9AA0A8" />
			</view>
		</view>

		<view v-if="adminRows.length" class="members-card">
			<view class="members-card__title">管理员</view>
			<view
				v-for="row in adminRows"
				:key="row.user.id"
				class="member-row"
				@tap="openMember(row)"
			>
				<qq-avatar
					:name="row.user.name"
					:from="row.user.avatarFrom"
					:to="row.user.avatarTo"
					:size="42"
					:online="!!row.user.online"
				/>
				<view class="member-row__main">
					<text class="member-row__name">{{ row.user.name }}</text>
					<text class="member-row__sub">{{ row.user.signature }}</text>
				</view>
				<text class="member-row__role">管理员</text>
				<tn-icon v-if="manageMode" class="member-row__more" name="more-horizontal" size="16px" color="#9AA0A8" />
			</view>
		</view>

		<view v-if="memberRows.length" class="members-card">
			<view class="members-card__title">群成员</view>
			<view
				v-for="row in memberRows"
				:key="row.user.id"
				class="member-row"
				@tap="openMember(row)"
			>
				<qq-avatar
					:name="row.user.name"
					:from="row.user.avatarFrom"
					:to="row.user.avatarTo"
					:size="42"
					:online="!!row.user.online"
				/>
				<view class="member-row__main">
					<text class="member-row__name">
						{{ row.user.name }}
						<text v-if="row.user.id === 'me'" class="member-row__me">我</text>
					</text>
					<text class="member-row__sub">{{ row.user.signature }}</text>
				</view>
				<text class="member-row__role member-row__role--none">{{ roleLabel(row.role) }}</text>
				<tn-icon v-if="manageMode" class="member-row__more" name="more-horizontal" size="16px" color="#9AA0A8" />
			</view>
		</view>

		<qq-empty v-if="!filtered.length" icon="search" :title="`没有找到「${keyword}」`" sub="换个昵称或备注试试" compact />

		<text class="members-footer">群成员数据为本地演示</text>

		<!-- 成员管理操作面板 -->
		<view v-if="sheetRow" class="mbs-mask" @tap="closeSheet">
			<view class="mbs" @tap.stop>
				<view class="mbs-head">
					<qq-avatar
						:name="sheetRow.user.name"
						:from="sheetRow.user.avatarFrom"
						:to="sheetRow.user.avatarTo"
						:size="46"
					/>
					<view class="mbs-head__main">
						<text class="mbs-head__name">{{ sheetRow.user.name }}</text>
						<text class="mbs-head__sub">
							{{ sheetRow.role === 'owner' ? '群主' : sheetRow.role === 'admin' ? '管理员' : '群成员' }}
							· {{ conv?.name }}
						</text>
					</view>
				</view>

				<view class="mbs-actions">
					<view class="mbs-action" @tap="sheetViewProfile">
						<tn-icon name="my-simple" size="17px" color="#12B7F5" />
						<text class="mbs-action__text">查看资料</text>
					</view>
					<view v-if="sheetRow.role !== 'owner'" class="mbs-action" @tap="sheetToggleAdmin">
						<tn-icon name="level" size="17px" color="#FF9F1C" />
						<text class="mbs-action__text">{{ sheetRow.role === 'admin' ? '取消管理员' : '设为管理员' }}</text>
					</view>
					<view
						v-if="sheetRow.role !== 'owner' && sheetRow.user.id !== 'me'"
						class="mbs-action"
						@tap="sheetRemove"
					>
						<tn-icon name="reduce-circle" size="17px" color="#FA5151" />
						<text class="mbs-action__text mbs-action__text--danger">移出群聊</text>
					</view>
				</view>

				<view class="mbs-cancel" @tap="closeSheet">
					<text class="mbs-cancel__text">取消</text>
				</view>
			</view>
		</view>
	</view>
</template>

<style lang="scss" scoped>
	.members-page {
		min-height: 100vh;
		box-sizing: border-box;
		padding-bottom: 26px;
		background-color: var(--qq-card-2);
	}

	.members-head {
		display: flex;
		align-items: center;
		padding: 8px 16px 10px;
	}

	.members-head__text {
		flex: 1;
		min-width: 0;
	}

	.members-head__count {
		display: block;
		font-size: 15px;
		font-weight: 600;
		color: var(--qq-text);
	}

	.members-head__tips {
		display: block;
		margin-top: 3px;
		font-size: 10.5px;
		color: var(--qq-text-3);
	}

	.members-head__invite {
		display: flex;
		align-items: center;
		gap: 3px;
		height: 28px;
		padding: 0 12px;
		border-radius: 14px;
		background-color: rgba(18, 183, 245, 0.1);
	}

	.members-head__invite-text {
		font-size: 11.5px;
		color: #12b7f5;
	}

	.members-search {
		display: flex;
		align-items: center;
		height: 36px;
		margin: 0 12px 4px;
		padding: 0 12px;
		border-radius: 10px;
		background-color: var(--qq-card);
	}

	.members-search__input {
		flex: 1;
		height: 100%;
		margin-left: 8px;
		font-size: 13px;
		color: var(--qq-text);
	}

	.members-card {
		margin: 10px 12px 0;
		padding: 4px 14px;
		border-radius: 12px;
		background-color: var(--qq-card);
	}

	.members-card__title {
		padding: 10px 0 6px;
		font-size: 11px;
		color: var(--qq-text-3);
	}

	.member-row {
		display: flex;
		align-items: center;
		padding: 9px 0;
		border-bottom: 1px solid var(--qq-line);
	}

	.member-row:last-child {
		border-bottom: none;
	}

	.member-row__main {
		flex: 1;
		min-width: 0;
		margin-left: 11px;
	}

	.member-row__name {
		display: block;
		font-size: 14px;
		font-weight: 500;
		color: var(--qq-text);
	}

	.member-row__me {
		margin-left: 5px;
		font-size: 9px;
		color: #12b7f5;
	}

	.member-row__sub {
		display: block;
		margin-top: 3px;
		font-size: 11px;
		color: var(--qq-text-3);
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
	}

	.member-row__role {
		flex-shrink: 0;
		padding: 2px 6px;
		border-radius: 4px;
		background-color: var(--qq-bg);
		font-size: 9.5px;
		color: var(--qq-text-2);
	}

	.member-row__role--owner {
		background-color: rgba(255, 159, 28, 0.1);
		color: #ff9f1c;
	}

	.member-row__role--none {
		background-color: transparent;
	}

	.members-empty {
		padding: 46px 0;
		text-align: center;
	}

	.members-empty__text {
		font-size: 12.5px;
		color: var(--qq-text-3);
	}

	.members-footer {
		display: block;
		margin-top: 18px;
		text-align: center;
		font-size: 10.5px;
		color: var(--qq-text-4);
	}

	.members-hd__text {
		font-size: 13px;
		color: #12b7f5;
	}

	.members-head__tips--manage {
		color: #12b7f5;
	}

	.member-row__more {
		margin-left: 6px;
	}

	.mbs-mask {
		position: fixed;
		inset: 0;
		z-index: 999;
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
		background-color: rgba(0, 0, 0, 0.4);
	}

	.mbs {
		width: 100%;
		max-width: 430px;
		margin: 0 auto;
		padding: 16px 12px calc(12px + env(safe-area-inset-bottom));
		border-radius: 16px 16px 0 0;
		background-color: var(--qq-bg);
	}

	.mbs-head {
		display: flex;
		align-items: center;
		padding: 2px 6px 14px;
	}

	.mbs-head__main {
		display: flex;
		flex-direction: column;
		gap: 4px;
		margin-left: 12px;
	}

	.mbs-head__name {
		font-size: 15px;
		font-weight: 600;
		color: var(--qq-text);
	}

	.mbs-head__sub {
		font-size: 11px;
		color: var(--qq-text-3);
	}

	.mbs-actions {
		border-radius: 12px;
		background-color: var(--qq-card);
		overflow: hidden;
	}

	.mbs-action {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 14px 16px;
		border-bottom: 1px solid var(--qq-line);
	}

	.mbs-action:last-child {
		border-bottom: none;
	}

	.mbs-action__text {
		font-size: 13.5px;
		color: var(--qq-text);
	}

	.mbs-action__text--danger {
		color: #fa5151;
	}

	.mbs-cancel {
		margin-top: 8px;
		padding: 13px 0;
		border-radius: 12px;
		background-color: var(--qq-card);
		text-align: center;
	}

	.mbs-cancel__text {
		font-size: 13.5px;
		color: var(--qq-text-2);
	}
</style>
