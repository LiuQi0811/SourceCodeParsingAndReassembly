<script lang="ts" setup>
	import { computed, ref } from 'vue'
	import { addComment, findUser, qqStore, toggleLike } from '@/qq/store'
	import type { QQMoment } from '@/qq/types'
	import { goUserDetail } from '@/qq/router'

	const props = defineProps<{ moment: QQMoment; showAll?: boolean }>()

	const author = computed(() => findUser(props.moment.userId))
	const showComments = ref(!!props.showAll)
	const draft = ref('')

	const visibleComments = computed(() =>
		showComments.value ? props.moment.comments : props.moment.comments.slice(0, 2)
	)

	function onLike() {
		toggleLike(props.moment.id)
	}

	function onSend() {
		addComment(props.moment.id, draft.value)
		draft.value = ''
		showComments.value = true
	}

	function previewImage(index: number) {
		uni.previewImage({
			urls: props.moment.images,
			current: index,
		})
	}

	function openAuthor() {
		if (props.moment.userId === 'me') return
		goUserDetail(props.moment.userId)
	}
</script>

<template>
	<view class="moment-card">
		<!-- 作者信息 -->
		<view class="moment-card__head">
			<view class="moment-card__author" @tap="openAuthor">
				<qq-avatar
					:name="author.name"
					:from="author.avatarFrom"
					:to="author.avatarTo"
					:text="author.avatarText"
					:size="40"
				/>
				<view class="moment-card__meta">
					<view class="qq-flex">
						<text class="moment-card__name">{{ author.name }}</text>
						<text v-if="author.vip" class="qq-vip">SVIP</text>
						<text v-if="author.online" class="moment-card__online">在线</text>
					</view>
					<text class="moment-card__time">{{ moment.time }}</text>
				</view>
			</view>
			<view class="moment-card__more">
				<tn-icon name="more-horizontal" size="18px" color="tn-grey" />
			</view>
		</view>

		<!-- 正文 -->
		<text class="moment-card__content">{{ moment.content }}</text>

		<!-- 配图 -->
		<view
			v-if="moment.images.length"
			class="moment-card__images"
			:class="{ single: moment.images.length === 1 }"
		>
			<image
				v-for="(img, index) in moment.images"
				:key="img"
				class="moment-card__image"
				:src="img"
				mode="aspectFill"
				@tap="previewImage(index)"
			/>
		</view>

		<!-- 位置 -->
		<view v-if="moment.location" class="moment-card__location">
			<tn-icon name="location" size="13px" color="tn-blue" />
			<text class="moment-card__location-text">{{ moment.location }}</text>
		</view>

		<!-- 操作栏 -->
		<view class="moment-card__actions">
			<view class="moment-card__action" :class="{ liked: moment.liked }" @tap="onLike">
				<tn-icon :name="moment.liked ? 'like-fill' : 'like'" size="17px" :color="moment.liked ? '#FA5151' : '#7C828C'" />
				<text class="moment-card__action-text">{{ moment.likes || '点赞' }}</text>
			</view>
			<view class="moment-card__action" @tap="showComments = !showComments">
				<tn-icon name="comment" size="17px" color="#7C828C" />
				<text class="moment-card__action-text">
					{{ moment.comments.length ? moment.comments.length : '评论' }}
				</text>
			</view>
			<view class="moment-card__action">
				<tn-icon name="share-triangle" size="17px" color="#7C828C" />
				<text class="moment-card__action-text">转发</text>
			</view>
		</view>

		<!-- 评论区 -->
		<view v-if="visibleComments.length" class="moment-card__comments">
			<view
				v-for="comment in visibleComments"
				:key="comment.id"
				class="moment-card__comment"
			>
				<text class="moment-card__comment-name">{{ findUser(comment.userId).name }}：</text>
				<text class="moment-card__comment-text">{{ comment.content }}</text>
			</view>
			<text
				v-if="!showComments && moment.comments.length > 2"
				class="moment-card__comment-more"
				@tap="showComments = true"
			>
				查看全部 {{ moment.comments.length }} 条评论
			</text>
		</view>

		<!-- 评论输入 -->
		<view v-if="showComments" class="moment-card__input">
			<input
				v-model="draft"
				class="moment-card__input-field"
				placeholder="说点什么…"
				placeholder-class="moment-card__placeholder"
				confirm-type="send"
				@confirm="onSend"
			/>
			<view
				class="moment-card__send"
				:class="{ 'moment-card__send--active': draft.trim().length }"
				@tap="onSend"
			>
				发送
			</view>
		</view>
	</view>
</template>

<style lang="scss" scoped>
	.moment-card {
		padding: 14px 14px 10px;
		background-color: var(--qq-card);
		border-radius: 12px;
		margin-bottom: 10px;
	}

	.moment-card__head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
	}

	.moment-card__author {
		display: flex;
		align-items: center;
	}

	.moment-card__meta {
		margin-left: 10px;
	}

	.moment-card__name {
		font-size: 14px;
		font-weight: 600;
		color: var(--qq-text);
	}

	.moment-card__online {
		margin-left: 6px;
		font-size: 9px;
		color: #12b7f5;
		background-color: var(--qq-blue-light);
		padding: 1px 4px;
		border-radius: 4px;
	}

	.moment-card__time {
		display: block;
		margin-top: 3px;
		font-size: 11px;
		color: var(--qq-text-3);
	}

	.moment-card__more {
		padding: 4px;
	}

	.moment-card__content {
		display: block;
		margin-top: 10px;
		font-size: 14.5px;
		line-height: 1.55;
		color: var(--qq-text);
		word-break: break-all;
	}

	.moment-card__images {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
		margin-top: 10px;
	}

	.moment-card__image {
		width: calc(33.33% - 3px);
		height: auto !important;
		aspect-ratio: 1;
		border-radius: 6px;
		background-color: var(--qq-bg);
	}

	.moment-card__images.single .moment-card__image {
		width: 100%;
		height: 220px !important;
	}

	.moment-card__location {
		display: inline-flex;
		align-items: center;
		margin-top: 9px;
		padding: 3px 8px;
		border-radius: 6px;
		background-color: var(--qq-card-2);
	}

	.moment-card__location-text {
		margin-left: 3px;
		font-size: 11px;
		color: #5b8fb9;
	}

	.moment-card__actions {
		display: flex;
		align-items: center;
		margin-top: 8px;
		padding-top: 4px;
	}

	.moment-card__action {
		display: flex;
		align-items: center;
		margin-right: 22px;
		padding: 4px 2px;
	}

	.moment-card__action-text {
		margin-left: 4px;
		font-size: 12px;
		color: var(--qq-text-2);
	}

	.moment-card__action.liked .moment-card__action-text {
		color: #fa5151;
	}

	.moment-card__comments {
		margin-top: 6px;
		padding: 8px 10px;
		border-radius: 8px;
		background-color: var(--qq-card-2);
	}

	.moment-card__comment {
		font-size: 12.5px;
		line-height: 1.7;
		color: var(--qq-text);
	}

	.moment-card__comment-name {
		color: #4f93bd;
	}

	.moment-card__comment-text {
		color: var(--qq-text);
	}

	.moment-card__comment-more {
		font-size: 11px;
		color: #4f93bd;
	}

	.moment-card__input {
		display: flex;
		align-items: center;
		margin-top: 8px;
		padding: 4px 4px 4px 10px;
		border-radius: 18px;
		background-color: var(--qq-bg);
	}

	.moment-card__input-field {
		flex: 1;
		font-size: 13px;
		height: 30px;
		color: var(--qq-text);
	}

	.moment-card__placeholder {
		color: var(--qq-text-3);
	}

	.moment-card__send {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 26px;
		padding: 0 12px;
		margin-left: 6px;
		border-radius: 13px;
		font-size: 12px;
		color: var(--qq-text-3);
	}

	.moment-card__send--active {
		background-color: #12b7f5;
		color: #ffffff;
	}
</style>
