<script lang="ts" setup>
	import { computed, ref } from 'vue'
	import { onLoad } from '@dcloudio/uni-app'
	import { addMoment, qqStore } from '@/qq/store'
	import { goZone } from '@/qq/router'

	const statusBarHeight = ref(0)
	onLoad((options: any) => {
		try {
			statusBarHeight.value = uni.getSystemInfoSync().statusBarHeight || 0
		} catch (e) {
			statusBarHeight.value = 0
		}
		if (options?.publish === '1') openPublish()
	})
	const topPad = computed(() => (statusBarHeight.value ? `${statusBarHeight.value}px` : '8px'))

	const myMomentCount = computed(() => qqStore.moments.filter((m) => m.userId === 'me').length)

	const filter = ref<'all' | 'friend' | 'photo'>('all')
	const filters = [
		{ key: 'all', label: '全部' },
		{ key: 'friend', label: '好友' },
		{ key: 'photo', label: '图片' },
	] as const

	const feed = computed(() => {
		if (filter.value === 'photo') return qqStore.moments.filter((m) => m.images.length > 0)
		if (filter.value === 'friend')
			return qqStore.moments.filter((m) => qqStore.contacts.some((c) => c.id === m.userId))
		return qqStore.moments
	})

	/* ---------- 发布动态 ---------- */

	const DEMO_IMAGES = [
		'/static/qq/m1.jpg',
		'/static/qq/m2.jpg',
		'/static/qq/m3.jpg',
		'/static/qq/m4.jpg',
		'/static/qq/m5.jpg',
		'/static/qq/m6.jpg',
	]

	const publishOpen = ref(false)
	const publishText = ref('')
	const selectedImages = ref<string[]>([])
	const withLocation = ref(true)

	const canPublish = computed(
		() => publishText.value.trim().length > 0 || selectedImages.value.length > 0
	)

	function openPublish() {
		publishOpen.value = true
		publishText.value = ''
		selectedImages.value = []
		withLocation.value = true
	}

	function closePublish() {
		publishOpen.value = false
	}

	function isSelected(path: string) {
		return selectedImages.value.includes(path)
	}

	function toggleImage(path: string) {
		if (isSelected(path)) {
			selectedImages.value = selectedImages.value.filter((item) => item !== path)
			return
		}
		if (selectedImages.value.length >= 4) {
			uni.showToast({ title: '最多选择 4 张图片', icon: 'none' })
			return
		}
		selectedImages.value.push(path)
	}

	function doPublish() {
		if (!canPublish.value) return
		addMoment(
			publishText.value,
			selectedImages.value,
			withLocation.value ? '江苏 · 徐州' : undefined
		)
		closePublish()
		filter.value = 'all'
		uni.showToast({ title: '已发布到 QQ 空间', icon: 'none' })
	}
</script>

<template>
	<view class="qq-page qq-page--tab">
		<!-- 顶部 -->
		<view class="dynamic-header">
			<view :style="{ height: topPad }" />
			<view class="dynamic-header__bar">
				<text class="dynamic-header__title">动态</text>
				<view class="dynamic-header__actions">
					<view class="dynamic-header__icon" @tap="openPublish">
						<tn-icon name="camera" size="19px" color="tn-grey-dark" />
					</view>
					<view class="dynamic-header__icon">
						<tn-icon name="message" size="19px" color="tn-grey-dark" />
					</view>
				</view>
			</view>
		</view>

		<!-- 我的空间卡片 -->
		<view class="zone-hero" @tap="goZone('me')">
			<view class="zone-hero__glow zone-hero__glow--one" />
			<view class="zone-hero__glow zone-hero__glow--two" />
			<view class="zone-hero__content">
				<view class="zone-hero__user">
					<qq-avatar
						:name="qqStore.user.name"
						:from="qqStore.user.avatarFrom"
						:to="qqStore.user.avatarTo"
						:size="48"
					/>
					<view class="zone-hero__meta">
						<text class="zone-hero__name">{{ qqStore.user.name }} 的空间</text>
						<text class="zone-hero__desc">记录生活 · 分享此刻</text>
					</view>
				</view>
				<view class="zone-hero__stats">
					<view class="zone-hero__stat">
						<text class="zone-hero__stat-value">128</text>
						<text class="zone-hero__stat-label">访客</text>
					</view>
					<view class="zone-hero__stat">
						<text class="zone-hero__stat-value">{{ myMomentCount }}</text>
						<text class="zone-hero__stat-label">说说</text>
					</view>
					<view class="zone-hero__stat">
						<text class="zone-hero__stat-value">36</text>
						<text class="zone-hero__stat-label">相册</text>
					</view>
					<view class="zone-hero__enter">
						<text class="zone-hero__enter-text">进入空间</text>
						<tn-icon name="right" size="12px" color="tn-white" />
					</view>
				</view>
			</view>
		</view>

		<!-- 筛选 -->
		<view class="dynamic-filter">
			<view
				v-for="item in filters"
				:key="item.key"
				class="dynamic-filter__item"
				:class="{ 'dynamic-filter__item--active': filter === item.key }"
				@tap="filter = item.key"
			>
				{{ item.label }}
			</view>
			<text class="dynamic-filter__count">{{ feed.length }} 条动态</text>
		</view>

		<!-- 动态流 -->
		<view class="dynamic-feed">
			<qq-moment-card
				v-for="moment in feed"
				:key="moment.id"
				:moment="moment"
			/>
			<view v-if="!feed.length" class="dynamic-empty">
				<tn-empty mode="comment" show-tips>
					<template #tips>这里还没有动态</template>
				</tn-empty>
			</view>
			<view class="dynamic-footer">已经到底啦 · 数据来自本地演示</view>
		</view>

		<qq-tabbar active="dynamic" />

		<!-- 发布动态面板 -->
		<view v-if="publishOpen" class="publish-mask" @tap="closePublish">
			<view class="publish-sheet" @tap.stop>
				<view class="publish-head">
					<text class="publish-head__cancel" @tap="closePublish">取消</text>
					<text class="publish-head__title">发表动态</text>
					<view
						class="publish-head__btn"
						:class="{ 'publish-head__btn--disabled': !canPublish }"
						@tap="doPublish"
					>
						发表
					</view>
				</view>

				<textarea
					v-model="publishText"
					class="publish-text"
					placeholder="这一刻的想法…"
					placeholder-class="publish-text__placeholder"
					:maxlength="200"
					auto-height
				/>

				<view class="publish-images">
					<scroll-view scroll-x class="publish-images__scroll">
						<view class="publish-images__row">
							<view
								v-for="img in DEMO_IMAGES"
								:key="img"
								class="publish-image"
								@tap="toggleImage(img)"
							>
								<image class="publish-image__img" :src="img" mode="aspectFill" />
								<view v-if="isSelected(img)" class="publish-image__check">
									<tn-icon name="check" size="12px" color="tn-white" />
								</view>
							</view>
						</view>
					</scroll-view>
					<text class="publish-images__count">已选 {{ selectedImages.length }}/4</text>
				</view>

				<view class="publish-meta">
					<view class="publish-meta__row" @tap="withLocation = !withLocation">
						<tn-icon name="location" size="16px" color="#12B7F5" />
						<text class="publish-meta__label">所在位置</text>
						<text class="publish-meta__value">
							{{ withLocation ? '江苏 · 徐州' : '不显示' }}
						</text>
						<tn-icon name="right" size="13px" color="#C9CDD4" />
					</view>
					<view class="publish-meta__tip">演示用图，点选即可作为动态配图</view>
				</view>
			</view>
		</view>
	</view>
</template>

<style lang="scss" scoped>
	.dynamic-header {
		position: sticky;
		top: 0;
		z-index: 20;
		background-color: var(--qq-card-2);
	}

	.dynamic-header__bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		height: 44px;
		padding: 0 14px;
	}

	.dynamic-header__title {
		font-size: 19px;
		font-weight: 700;
		color: var(--qq-text);
	}

	.dynamic-header__actions {
		display: flex;
		gap: 4px;
	}

	.dynamic-header__icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		border-radius: 50%;
	}

	.zone-hero {
		position: relative;
		margin: 4px 12px 0;
		padding: 16px;
		border-radius: 14px;
		background: linear-gradient(120deg, #1aa7ec 0%, #0a83c4 55%, #0a6aa1 100%);
		overflow: hidden;
		box-shadow: 0 10px 22px rgba(10, 131, 196, 0.25);
	}

	.zone-hero__glow {
		position: absolute;
		border-radius: 50%;
		background-color: rgba(255, 255, 255, 0.14);
	}

	.zone-hero__glow--one {
		right: -30px;
		top: -40px;
		width: 140px;
		height: 140px;
	}

	.zone-hero__glow--two {
		right: 40px;
		bottom: -50px;
		width: 110px;
		height: 110px;
		background-color: rgba(255, 255, 255, 0.08);
	}

	.zone-hero__content {
		position: relative;
		z-index: 1;
	}

	.zone-hero__user {
		display: flex;
		align-items: center;
	}

	.zone-hero__meta {
		margin-left: 12px;
	}

	.zone-hero__name {
		font-size: 16px;
		font-weight: 600;
		color: #ffffff;
	}

	.zone-hero__desc {
		display: block;
		margin-top: 4px;
		font-size: 11.5px;
		color: rgba(255, 255, 255, 0.72);
	}

	.zone-hero__stats {
		display: flex;
		align-items: flex-end;
		gap: 22px;
		margin-top: 16px;
	}

	.zone-hero__stat {
		display: flex;
		flex-direction: column;
	}

	.zone-hero__stat-value {
		font-size: 17px;
		font-weight: 600;
		color: #ffffff;
		line-height: 1;
	}

	.zone-hero__stat-label {
		margin-top: 4px;
		font-size: 10.5px;
		color: rgba(255, 255, 255, 0.7);
	}

	.zone-hero__enter {
		display: flex;
		align-items: center;
		gap: 2px;
		margin-left: auto;
		padding: 5px 10px;
		border-radius: 14px;
		background-color: rgba(255, 255, 255, 0.2);
		border: 1px solid rgba(255, 255, 255, 0.24);
	}

	.zone-hero__enter-text {
		font-size: 11px;
		color: #ffffff;
	}

	.dynamic-filter {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 12px 14px 8px;
	}

	.dynamic-filter__item {
		padding: 4px 12px;
		border-radius: 13px;
		background-color: var(--qq-card);
		font-size: 12px;
		color: var(--qq-text-2);
	}

	.dynamic-filter__item--active {
		background-color: var(--qq-blue-light);
		color: #12b7f5;
		font-weight: 600;
	}

	.dynamic-filter__count {
		margin-left: auto;
		font-size: 10.5px;
		color: var(--qq-text-3);
	}

	.dynamic-feed {
		padding: 0 12px;
	}

	.dynamic-empty {
		padding: 40px 0;
		background-color: var(--qq-card);
		border-radius: 12px;
	}

	.dynamic-footer {
		padding: 6px 0 16px;
		text-align: center;
		font-size: 11px;
		color: var(--qq-text-3);
	}

	/* 发布动态 */
	.publish-mask {
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
		background-color: rgba(0, 0, 0, 0.34);
	}

	.publish-sheet {
		padding: 10px 14px calc(14px + env(safe-area-inset-bottom));
		border-radius: 16px 16px 0 0;
		background-color: var(--qq-card);
	}

	.publish-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 4px 0 10px;
	}

	.publish-head__cancel {
		font-size: 13px;
		color: var(--qq-text-2);
	}

	.publish-head__title {
		font-size: 15px;
		font-weight: 600;
		color: var(--qq-text);
	}

	.publish-head__btn {
		padding: 6px 14px;
		border-radius: 15px;
		background: linear-gradient(135deg, #36c6ff 0%, #12b7f5 100%);
		font-size: 12.5px;
		color: #ffffff;
	}

	.publish-head__btn--disabled {
		background: var(--qq-bg);
		color: var(--qq-text-3);
	}

	.publish-text {
		display: block;
		width: 100%;
		min-height: 86px;
		box-sizing: border-box;
		font-size: 14px;
		line-height: 1.6;
		color: var(--qq-text);
	}

	.publish-text__placeholder {
		color: var(--qq-text-4);
	}

	.publish-images {
		margin-top: 6px;
	}

	.publish-images__scroll {
		width: 100%;
		white-space: nowrap;
	}

	.publish-images__row {
		display: flex;
		gap: 8px;
	}

	.publish-image {
		position: relative;
		flex-shrink: 0;
		width: 66px;
		height: 66px;
		border-radius: 8px;
		overflow: hidden;
		background-color: var(--qq-card-2);
	}

	.publish-image__img {
		display: block;
		width: 100%;
		height: 100%;
	}

	.publish-image__check {
		position: absolute;
		right: 4px;
		top: 4px;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 18px;
		height: 18px;
		border-radius: 50%;
		border: 1px solid rgba(255, 255, 255, 0.8);
		background-color: #12b7f5;
	}

	.publish-images__count {
		display: block;
		margin-top: 6px;
		font-size: 10.5px;
		color: var(--qq-text-3);
	}

	.publish-meta {
		margin-top: 10px;
		padding-top: 8px;
		border-top: 1px solid var(--qq-line);
	}

	.publish-meta__row {
		display: flex;
		align-items: center;
		gap: 5px;
		height: 38px;
	}

	.publish-meta__label {
		font-size: 12.5px;
		color: var(--qq-text);
	}

	.publish-meta__value {
		margin-left: auto;
		font-size: 12px;
		color: var(--qq-text-3);
	}

	.publish-meta__tip {
		margin-top: 2px;
		font-size: 10.5px;
		color: var(--qq-text-4);
	}
</style>
