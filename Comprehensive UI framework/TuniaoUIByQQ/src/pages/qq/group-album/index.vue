<script lang="ts" setup>
	import { computed, ref } from 'vue'
	import { onLoad } from '@dcloudio/uni-app'
	import {
	addPhotoToAlbum,
	createGroupAlbum,
	findConversation,
	groupAlbumsOf,
} from '@/qq/store'
	import type { QQGroupAlbum } from '@/qq/types'

	const convId = ref('c3')
	const conv = computed(() => findConversation(convId.value))
	const albums = computed(() => groupAlbumsOf(convId.value))
	const activeId = ref('')

	const createShow = ref(false)
	const albumName = ref('')
	const coverOptions = ['/static/qq/m1.jpg', '/static/qq/m4.jpg', '/static/qq/m5.jpg', '/static/qq/m6.jpg']
	const selectedCover = ref(coverOptions[0])

	onLoad((options: any) => {
		convId.value = options?.id || 'c3'
		if (albums.value.length) activeId.value = albums.value[0].id
	})

	const active = computed(() => albums.value.find((a) => a.id === activeId.value) || albums.value[0])

	const totalPhotos = computed(() => albums.value.reduce((sum, a) => sum + a.photos.length, 0))

	const heroPhotos = computed(() => {
		const list: string[] = []
		albums.value.forEach((a) => {
			if (a.photos[0] && list.length < 3) list.push(a.photos[0])
		})
		return list
	})

	function selectAlbum(album: QQGroupAlbum) {
		activeId.value = album.id
	}

	function previewPhoto(index: number) {
		if (!active.value?.photos.length) return
		uni.previewImage({
			current: active.value.photos[index],
			urls: active.value.photos,
		})
	}

	function addPhoto() {
		if (!active.value) {
			uni.showToast({ title: '请先新建相册', icon: 'none' })
			return
		}
		const pool = ['/static/qq/m2.jpg', '/static/qq/m3.jpg', '/static/qq/m5.jpg', '/static/qq/m6.jpg']
		const photo = pool[active.value.photos.length % pool.length]
		addPhotoToAlbum(active.value.id, photo)
		uni.showToast({ title: '已添加演示照片', icon: 'none' })
	}

	function openCreate() {
		albumName.value = ''
		selectedCover.value = coverOptions[0]
		createShow.value = true
	}

	function closeCreate() {
		createShow.value = false
	}

	function saveAlbum() {
		if (!albumName.value.trim()) {
			uni.showToast({ title: '请填写相册名称', icon: 'none' })
			return
		}
		const album = createGroupAlbum(convId.value, albumName.value, [selectedCover.value])
		if (!album) return
		activeId.value = album.id
		createShow.value = false
		uni.showToast({ title: '相册已创建', icon: 'none' })
	}
</script>

<template>
	<view class="qq-page album-page">
		<qq-navbar title="群相册" bg="#F7F8FA">
			<template #right>
				<view class="album-hd" @tap="openCreate">
					<tn-icon name="add" size="22px" color="tn-grey-dark" />
				</view>
			</template>
		</qq-navbar>

		<!-- 相册汇总 -->
		<view class="album-hero">
			<view class="album-hero__deco" />
			<view class="album-hero__main">
				<text class="album-hero__eyebrow">群相册 · {{ conv ? conv.name : '群聊' }}</text>
				<text class="album-hero__title">{{ albums.length }} 个相册</text>
				<text class="album-hero__sub">共 {{ totalPhotos }} 张照片，记录群里的每个瞬间</text>
			</view>
			<view class="album-hero__stack">
				<image
					v-for="(photo, index) in heroPhotos"
					:key="photo + index"
					class="album-hero__pic"
					:class="'album-hero__pic--' + (index + 1)"
					:src="photo"
					mode="aspectFill"
				/>
				<view v-if="!heroPhotos.length" class="album-hero__empty">
					<tn-icon name="image" size="22px" color="rgba(255,255,255,0.7)" />
				</view>
			</view>
		</view>

		<!-- 相册切换 -->
		<scroll-view class="album-scroll" scroll-x>
			<view class="album-row">
				<view
					v-for="album in albums"
					:key="album.id"
					class="album-card"
					:class="{ 'album-card--active': activeId === album.id }"
					@tap="selectAlbum(album)"
				>
					<image v-if="album.photos[0]" class="album-card__cover" :src="album.photos[0]" mode="aspectFill" />
					<view v-else class="album-card__cover album-card__cover--empty">
						<tn-icon name="image" size="19px" color="#9AA0A8" />
					</view>
					<view class="album-card__mask" />
					<text class="album-card__name">{{ album.name }}</text>
					<text class="album-card__count">{{ album.photos.length }} 张</text>
				</view>
				<view class="album-card album-card--new" @tap="openCreate">
					<view class="album-card__new">
						<tn-icon name="add" size="18px" color="#9AA0A8" />
						<text class="album-card__new-text">新建相册</text>
					</view>
				</view>
			</view>
		</scroll-view>

		<!-- 当前相册照片 -->
		<view v-if="active" class="album-gallery">
			<view class="album-gallery__head">
				<view class="album-gallery__title-row">
					<text class="album-gallery__title">{{ active.name }}</text>
					<text class="album-gallery__count">{{ active.photos.length }} 张照片</text>
				</view>
				<text class="album-gallery__meta">创建于 {{ active.createdAt }}</text>
			</view>

			<view class="album-grid">
				<view
					v-for="(photo, index) in active.photos"
					:key="photo + index"
					class="album-tile"
					@tap="previewPhoto(index)"
				>
					<image class="album-tile__img" :src="photo" mode="aspectFill" />
				</view>
				<view class="album-tile album-tile--add" @tap="addPhoto">
					<tn-icon name="add" size="20px" color="#9AA0A8" />
					<text class="album-tile__add-text">添加照片</text>
				</view>
			</view>
			<text class="album-gallery__tip">点击照片查看大图 · 「添加照片」为本地演示</text>
		</view>

		<qq-empty
			v-else
			icon="image"
			title="还没有相册"
			sub="创建一个相册，把群里的照片收在一起"
			action-text="新建相册"
			@action="openCreate"
		/>

		<text class="album-footer">群相册为本地演示数据</text>

		<!-- 新建相册 -->
		<view v-if="createShow" class="album-mask" @tap="closeCreate">
			<view class="album-sheet" @tap.stop>
				<view class="album-sheet__head">
					<text class="album-sheet__title">新建群相册</text>
					<view class="album-sheet__close" @tap="closeCreate">
						<tn-icon name="close" size="15px" color="#9AA0A8" />
					</view>
				</view>

				<text class="album-sheet__label">相册名称</text>
				<input
					v-model="albumName"
					class="album-sheet__input"
					maxlength="16"
					placeholder="例如：团建合影"
					confirm-type="done"
				/>

				<text class="album-sheet__label">选择封面</text>
				<view class="album-sheet__covers">
					<view
						v-for="cover in coverOptions"
						:key="cover"
						class="album-sheet__cover"
						:class="{ 'album-sheet__cover--active': selectedCover === cover }"
						@tap="selectedCover = cover"
					>
						<image class="album-sheet__cover-img" :src="cover" mode="aspectFill" />
						<view v-if="selectedCover === cover" class="album-sheet__check">
							<tn-icon name="check" size="12px" color="#FFFFFF" />
						</view>
					</view>
				</view>

				<view class="album-sheet__submit" @tap="saveAlbum">
					<text>创建相册</text>
				</view>
				<text class="album-sheet__tip">演示会以所选封面初始化相册，可继续添加照片</text>
			</view>
		</view>
	</view>
</template>

<style lang="scss" scoped>
	.album-page {
		min-height: 100vh;
		box-sizing: border-box;
		padding-bottom: calc(28px + env(safe-area-inset-bottom));
		background-color: var(--qq-card-2);
	}

	.album-hd {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 34px;
		height: 34px;
	}

	.album-hero {
		position: relative;
		display: flex;
		align-items: center;
		margin: 6px 12px 0;
		padding: 18px 16px;
		border-radius: 16px;
		background: linear-gradient(135deg, #1b2b4b 0%, #2d5fa8 58%, #12b7f5 130%);
		overflow: hidden;
	}

	.album-hero__deco {
		position: absolute;
		right: -40px;
		top: -60px;
		width: 150px;
		height: 150px;
		border-radius: 50%;
		background-color: rgba(255, 255, 255, 0.07);
	}

	.album-hero__main {
		position: relative;
		z-index: 1;
		flex: 1;
		min-width: 0;
	}

	.album-hero__eyebrow {
		display: block;
		font-size: 10.5px;
		color: rgba(255, 255, 255, 0.66);
	}

	.album-hero__title {
		display: block;
		margin-top: 6px;
		font-size: 23px;
		font-weight: 700;
		color: #ffffff;
	}

	.album-hero__sub {
		display: block;
		margin-top: 6px;
		font-size: 10.5px;
		color: rgba(255, 255, 255, 0.7);
	}

	.album-hero__stack {
		position: relative;
		width: 92px;
		height: 72px;
		flex-shrink: 0;
	}

	.album-hero__pic {
		position: absolute;
		width: 56px;
		height: 56px;
		border-radius: 8px;
		border: 2px solid rgba(255, 255, 255, 0.82);
		box-shadow: 0 6px 14px rgba(0, 0, 0, 0.22);
	}

	.album-hero__pic--1 {
		left: 0;
		top: 6px;
		transform: rotate(-8deg);
	}

	.album-hero__pic--2 {
		left: 20px;
		top: 0;
		z-index: 2;
		transform: rotate(2deg);
	}

	.album-hero__pic--3 {
		left: 38px;
		top: 10px;
		transform: rotate(9deg);
	}

	.album-hero__empty {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 60px;
		height: 60px;
		margin: 4px 0 0 16px;
		border-radius: 10px;
		border: 1px dashed rgba(255, 255, 255, 0.35);
	}

	.album-scroll {
		margin-top: 12px;
		white-space: nowrap;
	}

	.album-row {
		display: inline-flex;
		align-items: stretch;
		padding: 0 12px;
	}

	.album-card {
		position: relative;
		flex-shrink: 0;
		width: 112px;
		height: 88px;
		margin-right: 9px;
		border-radius: 12px;
		overflow: hidden;
		border: 1.5px solid transparent;
	}

	.album-card--active {
		border-color: #12b7f5;
	}

	.album-card__cover {
		width: 100%;
		height: 100%;
		display: block;
	}

	.album-card__cover--empty {
		display: flex;
		align-items: center;
		justify-content: center;
		background-color: var(--qq-card);
	}

	.album-card__mask {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;
		height: 52px;
		background: linear-gradient(180deg, rgba(0, 0, 0, 0) 0%, rgba(0, 0, 0, 0.66) 100%);
	}

	.album-card__name {
		position: absolute;
		left: 8px;
	right: 8px;
		bottom: 17px;
		font-size: 11.5px;
		font-weight: 600;
		color: #ffffff;
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
	}

	.album-card__count {
		position: absolute;
		left: 8px;
		bottom: 5px;
		font-size: 9px;
		color: rgba(255, 255, 255, 0.76);
	}

	.album-card--new {
		display: flex;
		align-items: center;
		justify-content: center;
		background-color: var(--qq-card);
		border: 1px dashed var(--qq-line-strong);
	}

	.album-card__new {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 5px;
	}

	.album-card__new-text {
		font-size: 10.5px;
		color: var(--qq-text-3);
	}

	.album-gallery {
		margin: 14px 12px 0;
	}

	.album-gallery__head {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
	}

	.album-gallery__title-row {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.album-gallery__title {
		font-size: 15px;
		font-weight: 600;
		color: var(--qq-text);
	}

	.album-gallery__count {
		font-size: 10px;
		color: var(--qq-text-3);
	}

	.album-gallery__meta {
		font-size: 9.5px;
		color: var(--qq-text-4);
	}

	.album-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 7px;
		margin-top: 10px;
	}

	.album-tile {
		position: relative;
		aspect-ratio: 1;
		border-radius: 9px;
		overflow: hidden;
		background-color: var(--qq-card);
	}

	.album-tile__img {
		width: 100%;
		height: 100%;
		display: block;
	}

	.album-tile--add {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 5px;
		border: 1px dashed var(--qq-line-strong);
		background-color: transparent;
	}

	.album-tile__add-text {
		font-size: 9.5px;
		color: var(--qq-text-3);
	}

	.album-gallery__tip {
		display: block;
		margin-top: 9px;
		font-size: 9.5px;
		color: var(--qq-text-4);
	}

	.album-empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 58px 24px 0;
	}

	.album-empty__icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 64px;
		height: 64px;
		border-radius: 50%;
		background-color: var(--qq-card);
	}

	.album-empty__text {
		margin-top: 14px;
		font-size: 14px;
		color: var(--qq-text-2);
	}

	.album-empty__sub {
		margin-top: 6px;
		font-size: 11.5px;
		color: var(--qq-text-3);
	}

	.album-empty__btn {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 34px;
		margin-top: 18px;
		padding: 0 18px;
		border-radius: 17px;
		background-color: var(--qq-blue-light);
		color: #12b7f5;
		font-size: 12.5px;
		font-weight: 600;
	}

	.album-footer {
		display: block;
		padding: 18px 0 6px;
		text-align: center;
		font-size: 10px;
		color: var(--qq-text-4);
	}

	.album-mask {
		position: fixed;
		left: 0;
		right: 0;
		top: 0;
		bottom: 0;
		z-index: 60;
		display: flex;
		align-items: flex-end;
		justify-content: center;
		background-color: rgba(0, 0, 0, 0.42);
	}

	.album-sheet {
		width: 100%;
		max-width: 430px;
		box-sizing: border-box;
		padding: 18px 16px calc(20px + env(safe-area-inset-bottom));
		border-radius: 18px 18px 0 0;
		background-color: var(--qq-card);
	}

	.album-sheet__head {
		display: flex;
		align-items: center;
	}

	.album-sheet__title {
		flex: 1;
		font-size: 16px;
		font-weight: 600;
		color: var(--qq-text);
	}

	.album-sheet__close {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
	}

	.album-sheet__label {
		display: block;
		margin-top: 15px;
		font-size: 11.5px;
		color: var(--qq-text-3);
	}

	.album-sheet__input {
		width: 100%;
		height: 40px;
		box-sizing: border-box;
		margin-top: 8px;
		padding: 0 11px;
		border-radius: 9px;
		background-color: var(--qq-card-2);
		font-size: 13px;
		color: var(--qq-text);
	}

	.album-sheet__covers {
		display: flex;
		gap: 8px;
		margin-top: 8px;
	}

	.album-sheet__cover {
		position: relative;
		width: 72px;
		height: 56px;
		border-radius: 8px;
		overflow: hidden;
		border: 2px solid transparent;
	}

	.album-sheet__cover--active {
		border-color: #12b7f5;
	}

	.album-sheet__cover-img {
		width: 100%;
		height: 100%;
		display: block;
	}

	.album-sheet__check {
		position: absolute;
		right: 3px;
		bottom: 3px;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 17px;
		height: 17px;
		border-radius: 50%;
		background-color: #12b7f5;
	}

	.album-sheet__submit {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 44px;
		margin-top: 20px;
		border-radius: 12px;
		background: linear-gradient(135deg, #18c0ff 0%, #0a9ed8 100%);
		color: #ffffff;
		font-size: 15px;
		font-weight: 600;
	}

	.album-sheet__tip {
		display: block;
		margin-top: 10px;
		text-align: center;
		font-size: 10px;
		color: var(--qq-text-4);
	}
</style>
