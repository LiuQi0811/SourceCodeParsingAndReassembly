<script lang="ts" setup>
	import { computed, ref } from 'vue'
	import { onLoad } from '@dcloudio/uni-app'
	import {
		acceptFriendRequest,
		addFriend,
		deleteFriend,
		findUser,
		isContact,
		pendingRequestOf,
		qqStore,
		updateContactRemark,
		updateContactTags,
	} from '@/qq/store'
	import { goChatWithUser, goZone, TAB_PATHS } from '@/qq/router'
	import type { QQUser } from '@/qq/types'

	const userId = ref('me')
	const user = ref<QQUser>(qqStore.user)
	const isSelf = computed(() => userId.value === 'me')
	const isFriend = computed(() => isContact(userId.value))
	const pendingRequest = computed(() => pendingRequestOf(userId.value))

	const remarkOpen = ref(false)
	const remarkDraft = ref('')
	const tagOpen = ref(false)
	const tagDraft = ref<string[]>([])
	const customTag = ref('')

	const tagSuggestions = computed(() =>
		Array.from(
			new Set([
				...qqStore.contacts.flatMap((contact) => contact.tags || []),
				'同事',
				'同学',
				'客户',
				'家人',
			])
		)
	)

	onLoad((options: any) => {
		userId.value = options?.id || 'me'
		user.value = findUser(userId.value)
	})

	const groups = computed(() => qqStore.conversations.filter((c) => c.type === 'group'))

	function copyQQ() {
		uni.setClipboardData({
			data: user.value.qq,
			success: () => uni.showToast({ title: 'QQ 号已复制', icon: 'none' }),
		})
	}

	function onChat() {
		if (isSelf.value) {
			uni.reLaunch({ url: TAB_PATHS.mine })
			return
		}
		goChatWithUser(user.value.id)
	}

	function onCall(label: string) {
		uni.showToast({ title: `演示：发起${label}`, icon: 'none' })
	}

	function onMore() {
		if (isSelf.value) return
		const items = isFriend.value
			? ['设置备注', '管理标签', '举报该用户', '删除好友']
			: ['举报该用户']
		uni.showActionSheet({
			itemList: items,
			success: (res) => {
				if (!isFriend.value) {
					uni.showToast({ title: '已提交举报', icon: 'none' })
					return
				}
				if (res.tapIndex === 0) openRemark()
				else if (res.tapIndex === 1) openTags()
				else if (res.tapIndex === 2) uni.showToast({ title: '已提交举报', icon: 'none' })
				else if (res.tapIndex === 3) confirmDelete()
			},
		})
	}

	function openRemark() {
		if (!isFriend.value) return
		remarkDraft.value = user.value.remark || ''
		remarkOpen.value = true
	}

	function saveRemark() {
		updateContactRemark(userId.value, remarkDraft.value)
		remarkOpen.value = false
		uni.showToast({ title: remarkDraft.value.trim() ? '备注已保存' : '已恢复昵称', icon: 'none' })
	}

	function openTags() {
		if (!isFriend.value) return
		tagDraft.value = [...(user.value.tags || [])]
		customTag.value = ''
		tagOpen.value = true
	}

	function toggleTag(tag: string) {
		if (tagDraft.value.includes(tag)) {
			tagDraft.value = tagDraft.value.filter((item) => item !== tag)
		} else if (tagDraft.value.length < 8) {
			tagDraft.value = [...tagDraft.value, tag]
		} else {
			uni.showToast({ title: '最多选择 8 个标签', icon: 'none' })
		}
	}

	function addCustomTag() {
		const value = customTag.value.trim().slice(0, 10)
		if (!value) return
		if (tagDraft.value.includes(value)) {
			customTag.value = ''
			return
		}
		if (tagDraft.value.length >= 8) {
			uni.showToast({ title: '最多选择 8 个标签', icon: 'none' })
			return
		}
		tagDraft.value = [...tagDraft.value, value]
		customTag.value = ''
	}

	function saveTags() {
		updateContactTags(userId.value, tagDraft.value)
		tagOpen.value = false
		uni.showToast({ title: '标签已更新', icon: 'none' })
	}

	function confirmDelete() {
		const name = user.value.remark || user.value.name
		uni.showModal({
			title: '删除好友',
			content: `确定删除「${name}」吗？删除后会同时移除联系人关系和聊天会话，历史消息不再展示。`,
			confirmText: '删除',
			confirmColor: '#E5484D',
			success: (res) => {
				if (!res.confirm) return
				deleteFriend(userId.value)
				uni.showToast({ title: '已删除好友', icon: 'none' })
				setTimeout(() => {
					const pages = getCurrentPages()
					if (pages.length > 1) uni.navigateBack()
					else uni.reLaunch({ url: TAB_PATHS.contact })
				}, 400)
			},
		})
	}

	function onAddFriend() {
		if (pendingRequest.value) {
			uni.showModal({
				title: '好友申请',
				content: `同意「${user.value.name}」的好友申请？`,
				confirmText: '同意',
				success: (res) => {
					if (!res.confirm) return
					acceptFriendRequest(pendingRequest.value!.id)
					uni.showToast({ title: '已添加为好友', icon: 'none' })
				},
			})
			return
		}
		uni.showModal({
			title: '加好友',
			content: `向「${user.value.name}」发送好友申请？演示环境会自动通过。`,
			confirmText: '发送',
			success: (res) => {
				if (!res.confirm) return
				addFriend(userId.value)
				uni.showToast({ title: '好友申请已通过', icon: 'none' })
			},
		})
	}

	function openZone() {
		goZone(user.value.id)
	}
</script>

<template>
	<view class="qq-page detail-page">
		<!-- 渐变资料头部 -->
		<view
			class="detail-hero"
			:style="{ backgroundImage: `linear-gradient(150deg, ${user.avatarFrom} 0%, ${user.avatarTo} 60%, #0a83c4 100%)` }"
		>
			<qq-navbar bg="transparent" color="tn-white" :border="false" title="">
				<template #right>
					<view class="detail-hero__more" @tap="onMore">
						<tn-icon name="more-horizontal" size="20px" color="tn-white" />
					</view>
				</template>
			</qq-navbar>

			<view class="detail-hero__profile">
				<view class="detail-hero__avatar">
					<qq-avatar
						:name="user.name"
						:from="user.avatarFrom"
						:to="user.avatarTo"
						:size="82"
					/>
				</view>
				<view class="detail-hero__name-row">
					<text class="detail-hero__name">{{ user.remark || user.name }}</text>
					<text v-if="user.vip" class="detail-hero__vip">SVIP</text>
				</view>
				<text class="detail-hero__qq">QQ {{ user.qq }}</text>
				<view class="detail-hero__status">
					<view class="detail-hero__dot" :class="{ 'detail-hero__dot--on': user.online }" />
					<text class="detail-hero__status-text">{{ user.online ? '在线' : '离线' }} · {{ user.region }}</text>
				</view>
			</view>
		</view>

		<!-- 操作按钮 -->
		<view v-if="isFriend || isSelf" class="detail-actions">
			<view class="detail-action" @tap="onChat">
				<tn-icon name="message" size="20px" color="#12B7F5" />
				<text class="detail-action__label">{{ isSelf ? '我的空间' : '发消息' }}</text>
			</view>
			<view class="detail-action" @tap="onCall('语音通话')">
				<tn-icon name="phone" size="20px" color="#32C48D" />
				<text class="detail-action__label">语音</text>
			</view>
			<view class="detail-action" @tap="onCall('视频通话')">
				<tn-icon name="video" size="20px" color="#8E54E9" />
				<text class="detail-action__label">视频</text>
			</view>
		</view>
		<view v-else class="detail-actions detail-actions--single">
			<view class="detail-action" @tap="onAddFriend">
				<tn-icon name="my-add" size="20px" color="#12B7F5" />
				<text class="detail-action__label">{{ pendingRequest ? '同意好友' : '加好友' }}</text>
			</view>
			<view class="detail-action" @tap="onMore">
				<tn-icon name="more-horizontal" size="20px" color="#8A8F99" />
				<text class="detail-action__label">更多</text>
			</view>
		</view>

		<!-- 个性签名 -->
		<view class="detail-card">
			<view class="detail-card__head">
				<text class="detail-card__title">个性签名</text>
				<view v-if="isFriend && !isSelf" class="detail-edit" @tap="openTags">
					<tn-icon name="edit" size="13px" color="#12B7F5" />
					<text>编辑标签</text>
				</view>
			</view>
			<text class="detail-sign">{{ user.signature || '这个人很懒，什么都没有留下。' }}</text>
			<view v-if="user.tags?.length || (isFriend && !isSelf)" class="detail-tags">
				<text v-for="tag in user.tags" :key="tag" class="detail-tag"># {{ tag }}</text>
				<text v-if="isFriend && !isSelf" class="detail-tag detail-tag--add" @tap="openTags">+ 标签</text>
			</view>
		</view>

		<!-- 资料信息 -->
		<view class="detail-card">
			<view class="detail-row" @tap="copyQQ">
				<text class="detail-row__label">QQ 号</text>
				<text class="detail-row__value">{{ user.qq }}</text>
				<tn-icon name="right" size="13px" color="#C9CDD4" />
			</view>
			<view v-if="user.remark" class="detail-row">
				<text class="detail-row__label">备注</text>
				<text class="detail-row__value">{{ user.remark }}</text>
			</view>
			<view class="detail-row">
				<text class="detail-row__label">昵称</text>
				<text class="detail-row__value">{{ user.name }}</text>
			</view>
			<view class="detail-row">
				<text class="detail-row__label">性别</text>
				<text class="detail-row__value">{{ user.gender === 'female' ? '女' : '男' }}</text>
			</view>
			<view class="detail-row">
				<text class="detail-row__label">生日</text>
				<text class="detail-row__value">{{ user.birthday }}</text>
			</view>
			<view class="detail-row">
				<text class="detail-row__label">所在地</text>
				<text class="detail-row__value">{{ user.region }}</text>
			</view>
			<view class="detail-row detail-row--last">
				<text class="detail-row__label">QQ 等级</text>
				<view class="detail-row__level">
					<tn-icon name="level" size="14px" color="#FF9F1C" />
					<text class="detail-row__value">Lv.{{ user.level }}</text>
				</view>
			</view>
		</view>

		<!-- 共同群聊 -->
		<view class="detail-card">
			<view class="detail-card__head">
				<text class="detail-card__title">共同群聊</text>
				<text class="detail-card__count">{{ groups.length }} 个</text>
			</view>
			<view class="detail-groups">
				<view v-for="group in groups" :key="group.id" class="detail-group">
					<qq-avatar
						:name="group.name"
						:from="group.avatarFrom"
						:to="group.avatarTo"
						:group="true"
						:size="40"
					/>
					<text class="detail-group__name">{{ group.name }}</text>
				</view>
			</view>
			<view class="detail-zone" @tap="openZone">
				<tn-icon name="moments" size="16px" color="#12B7F5" />
				<text class="detail-zone__text">{{ isSelf ? '进入我的 QQ 空间' : `进入 ${user.name} 的空间` }}</text>
				<tn-icon name="right" size="13px" color="#C9CDD4" />
			</view>
		</view>

		<view class="detail-footer">资料仅用于界面演示</view>

		<!-- 设置备注 -->
		<view v-if="remarkOpen" class="detail-mask" @tap="remarkOpen = false">
			<view class="detail-sheet" @tap.stop>
				<view class="detail-sheet__head">
					<text class="detail-sheet__title">设置备注</text>
					<text class="detail-sheet__sub">留空会恢复对方的昵称</text>
				</view>
				<input
					v-model="remarkDraft"
					class="detail-sheet__input"
					placeholder="填写备注，最多 20 个字"
					:maxlength="20"
					confirm-type="done"
					@confirm="saveRemark"
				/>
				<view class="detail-sheet__actions">
					<view class="detail-sheet__btn" @tap="remarkOpen = false">取消</view>
					<view class="detail-sheet__btn detail-sheet__btn--primary" @tap="saveRemark">保存</view>
				</view>
			</view>
		</view>

		<!-- 管理标签 -->
		<view v-if="tagOpen" class="detail-mask" @tap="tagOpen = false">
			<view class="detail-sheet" @tap.stop>
				<view class="detail-sheet__head">
					<text class="detail-sheet__title">管理标签</text>
					<text class="detail-sheet__sub">最多 8 个，可用于联系人页筛选</text>
				</view>
				<scroll-view class="detail-tag-scroll" scroll-y>
					<view class="detail-tag-options">
						<view
							v-for="tag in tagSuggestions"
							:key="tag"
							class="detail-tag-option"
							:class="{ 'detail-tag-option--active': tagDraft.includes(tag) }"
							@tap="toggleTag(tag)"
						>
							<text>{{ tag }}</text>
						</view>
					</view>
				</scroll-view>
				<view class="detail-custom-row">
					<input
						v-model="customTag"
						class="detail-custom-input"
						placeholder="自定义标签"
						:maxlength="10"
						confirm-type="done"
						@confirm="addCustomTag"
					/>
					<view class="detail-custom-btn" @tap="addCustomTag">添加</view>
				</view>
				<view class="detail-sheet__actions">
					<view class="detail-sheet__btn" @tap="tagOpen = false">取消</view>
					<view class="detail-sheet__btn detail-sheet__btn--primary" @tap="saveTags">保存</view>
				</view>
			</view>
		</view>
	</view>
</template>

<style lang="scss" scoped>
	.detail-page {
		padding-bottom: 30px;
	}

	.detail-hero {
		position: relative;
		padding-bottom: 40px;
		overflow: hidden;
	}

	.detail-hero :deep(.qq-navbar) {
		position: relative;
		z-index: 3;
	}

	.detail-hero::after {
		content: '';
		position: absolute;
		right: -60px;
		top: -60px;
		width: 220px;
		height: 220px;
		border-radius: 50%;
		background-color: rgba(255, 255, 255, 0.12);
		pointer-events: none;
	}

	.detail-hero__more {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		border-radius: 50%;
		background-color: rgba(255, 255, 255, 0.16);
	}

	.detail-hero__profile {
		position: relative;
		z-index: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 4px 16px 0;
	}

	.detail-hero__avatar {
		padding: 3px;
		border-radius: 50%;
		background-color: rgba(255, 255, 255, 0.28);
	}

	.detail-hero__name-row {
		display: flex;
		align-items: center;
		gap: 6px;
		margin-top: 12px;
	}

	.detail-hero__name {
		font-size: 20px;
		font-weight: 700;
		color: #ffffff;
	}

	.detail-hero__vip {
		padding: 2px 5px;
		border-radius: 4px;
		background: linear-gradient(135deg, #ffe2a1, #f0bb4d);
		color: #4a3410;
		font-size: 9px;
		font-weight: 700;
	}

	.detail-hero__qq {
		margin-top: 6px;
		font-size: 12px;
		color: rgba(255, 255, 255, 0.8);
	}

	.detail-hero__status {
		display: flex;
		align-items: center;
		gap: 4px;
		margin-top: 6px;
	}

	.detail-hero__dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background-color: var(--qq-text-4);
	}

	.detail-hero__dot--on {
		background-color: #9ef0c9;
	}

	.detail-hero__status-text {
		font-size: 10.5px;
		color: rgba(255, 255, 255, 0.72);
	}

	/* 三个操作按钮 */
	.detail-actions {
		display: flex;
		margin: -26px 12px 0;
		padding: 14px 0;
		background-color: var(--qq-card);
		border-radius: 14px;
		box-shadow: 0 10px 24px rgba(20, 60, 90, 0.1);
		position: relative;
		z-index: 2;
	}

	.detail-action {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
		border-right: 1px solid var(--qq-line);
	}

	.detail-action:last-child {
		border-right: none;
	}

	.detail-action__label {
		font-size: 12px;
		color: var(--qq-text);
	}

	.detail-card {
		margin: 10px 12px 0;
		padding: 14px;
		background-color: var(--qq-card);
		border-radius: 12px;
	}

	.detail-card__title {
		font-size: 13px;
		font-weight: 600;
		color: var(--qq-text);
	}

	.detail-card__head {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.detail-card__count {
		font-size: 11px;
		color: var(--qq-text-3);
	}

	.detail-sign {
		display: block;
		margin-top: 8px;
		font-size: 12.5px;
		line-height: 1.6;
		color: var(--qq-text-2);
	}

	.detail-tags {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin-top: 10px;
	}

	.detail-tag {
		padding: 3px 8px;
		border-radius: 5px;
		background-color: var(--qq-card-2);
		color: #4f93bd;
		font-size: 10.5px;
	}

	.detail-row {
		display: flex;
		align-items: center;
		height: 40px;
		border-bottom: 1px solid var(--qq-line);
	}

	.detail-row--last {
		border-bottom: none;
	}

	.detail-row__label {
		width: 74px;
		font-size: 12px;
		color: var(--qq-text-3);
	}

	.detail-row__value {
		flex: 1;
		text-align: right;
		font-size: 12.5px;
		color: var(--qq-text);
	}

	.detail-row__level {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 3px;
	}

	.detail-groups {
		display: flex;
		gap: 18px;
		margin-top: 12px;
	}

	.detail-group {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
	}

	.detail-group__name {
		font-size: 10.5px;
		color: var(--qq-text-2);
	}

	.detail-zone {
		display: flex;
		align-items: center;
		gap: 6px;
		margin-top: 14px;
		padding-top: 12px;
		border-top: 1px solid var(--qq-line);
	}

	.detail-zone__text {
		flex: 1;
		font-size: 12.5px;
		color: var(--qq-text);
	}

	.detail-footer {
		padding: 16px 0;
		text-align: center;
		font-size: 11px;
		color: var(--qq-text-3);
	}

	.detail-actions--single .detail-action {
		border-right: none;
	}

	.detail-edit {
		display: flex;
		align-items: center;
		gap: 2px;
		font-size: 11px;
		color: #12b7f5;
	}

	.detail-tag--add {
		color: #12b7f5;
		background-color: rgba(18, 183, 245, 0.1);
	}

	.detail-mask {
		position: fixed;
		left: 0;
		right: 0;
		top: 0;
		bottom: 0;
		z-index: 90;
		display: flex;
		align-items: flex-end;
		justify-content: center;
		background-color: rgba(0, 0, 0, 0.42);
	}

	.detail-sheet {
		width: 100%;
		max-width: 430px;
		box-sizing: border-box;
		padding: 18px 16px calc(16px + env(safe-area-inset-bottom));
		border-radius: 16px 16px 0 0;
		background-color: var(--qq-card-2);
		animation: detail-sheet-up 0.22s ease;
	}

	@keyframes detail-sheet-up {
		from {
			transform: translateY(100%);
		}
		to {
			transform: translateY(0);
		}
	}

	.detail-sheet__head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		margin-bottom: 12px;
	}

	.detail-sheet__title {
		font-size: 16px;
		font-weight: 700;
		color: var(--qq-text);
	}

	.detail-sheet__sub {
		font-size: 10.5px;
		color: var(--qq-text-3);
	}

	.detail-sheet__input {
		height: 44px;
		padding: 0 12px;
		border-radius: 10px;
		background-color: var(--qq-card);
		font-size: 13px;
		color: var(--qq-text);
		box-sizing: border-box;
	}

	.detail-tag-scroll {
		height: 176px;
		border-radius: 10px;
		background-color: var(--qq-card);
	}

	.detail-tag-options {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		padding: 12px;
	}

	.detail-tag-option {
		padding: 5px 11px;
		border-radius: 14px;
		background-color: var(--qq-card-2);
	}

	.detail-tag-option text {
		font-size: 11.5px;
		color: var(--qq-text-2);
	}

	.detail-tag-option--active {
		background-color: rgba(18, 183, 245, 0.14);
	}

	.detail-tag-option--active text {
		color: #12b7f5;
		font-weight: 600;
	}

	.detail-custom-row {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-top: 10px;
	}

	.detail-custom-input {
		flex: 1;
		height: 38px;
		padding: 0 11px;
		border-radius: 9px;
		background-color: var(--qq-card);
		font-size: 12.5px;
		color: var(--qq-text);
		box-sizing: border-box;
	}

	.detail-custom-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 54px;
		height: 38px;
		border-radius: 9px;
		background-color: rgba(18, 183, 245, 0.12);
		font-size: 12px;
		color: #12b7f5;
	}

	.detail-sheet__actions {
		display: flex;
		gap: 10px;
		margin-top: 14px;
	}

	.detail-sheet__btn {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		height: 42px;
		border-radius: 10px;
		background-color: var(--qq-card);
		font-size: 14px;
		color: var(--qq-text-2);
	}

	.detail-sheet__btn--primary {
		background-color: #12b7f5;
		color: #ffffff;
		font-weight: 600;
	}
</style>
