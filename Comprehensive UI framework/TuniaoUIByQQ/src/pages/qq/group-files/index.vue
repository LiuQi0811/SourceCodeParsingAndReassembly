<script lang="ts" setup>
	import { computed, ref } from 'vue'
	import { onLoad } from '@dcloudio/uni-app'
	import { findConversation } from '@/qq/store'

	const convId = ref('')
	const keyword = ref('')

	onLoad((options: any) => {
		convId.value = options?.id || 'c3'
	})

	const conv = computed(() => findConversation(convId.value))

	interface GroupFile {
		name: string
		size: string
		time: string
		owner: string
		icon: string
		color: string
		kind: string
	}

	const files: GroupFile[] = [
		{
			name: '需求评审-2024Q4.pdf',
			size: '2.4 MB',
			time: '今天 11:02',
			owner: '林嘉禾',
			icon: 'folder',
			color: '#4776E6',
			kind: 'PDF',
		},
		{
			name: '原型截图合集.zip',
			size: '18.6 MB',
			time: '昨天 18:20',
			owner: '苏晚',
			icon: 'image',
			color: '#32C48D',
			kind: 'ZIP',
		},
		{
			name: '前端小分队-第46周周报.docx',
			size: '860 KB',
			time: '周三 20:15',
			owner: '陈屿',
			icon: 'folder',
			color: '#12B7F5',
			kind: 'DOCX',
		},
		{
			name: '设计规范-v2.sketch',
			size: '42.8 MB',
			time: '周二 16:40',
			owner: '苏晚',
			icon: 'image',
			color: '#8E54E9',
			kind: 'SKETCH',
		},
		{
			name: '接口联调说明.md',
			size: '36 KB',
			time: '周一 09:12',
			owner: '郑一诺',
			icon: 'folder',
			color: '#FF9F1C',
			kind: 'MD',
		},
		{
			name: '团建合照-云龙湖.jpg',
			size: '5.1 MB',
			time: '上周五 21:08',
			owner: '许嘉树',
			icon: 'image',
			color: '#FA5151',
			kind: 'JPG',
		},
	]

	const filtered = computed(() => {
		const kw = keyword.value.trim()
		if (!kw) return files
		return files.filter((f) => f.name.includes(kw) || f.kind.toLowerCase().includes(kw.toLowerCase()))
	})

	const totalSize = '86.4 MB'

	function onUpload() {
		uni.showToast({ title: '演示：从本地选择文件上传', icon: 'none' })
	}

	function onFile(file: GroupFile) {
		uni.showActionSheet({
			itemList: ['预览', '发送到聊天', '下载到本地'],
			success: (res) => {
				const label = ['预览', '发送到聊天', '下载到本地'][res.tapIndex] || '操作'
				uni.showToast({ title: `演示：${label} ${file.name}`, icon: 'none' })
			},
		})
	}
</script>

<template>
	<view class="qq-page files-page">
		<qq-navbar title="群文件" bg="#F7F8FA">
			<template #right>
				<view class="files-hd" @tap="onUpload">
					<tn-icon name="my-add" size="20px" color="tn-grey-dark" />
				</view>
			</template>
		</qq-navbar>

		<view class="files-summary">
			<view class="files-summary__icon">
				<tn-icon name="folder" size="22px" color="#4776E6" />
			</view>
			<view class="files-summary__main">
				<text class="files-summary__title">{{ conv ? conv.name : '群文件' }}</text>
				<text class="files-summary__meta">{{ files.length }} 个文件 · 共 {{ totalSize }}</text>
			</view>
			<view class="files-summary__upload" @tap="onUpload">
				<tn-icon name="add" size="13px" color="#12B7F5" />
				<text class="files-summary__upload-text">上传</text>
			</view>
		</view>

		<view class="files-search">
			<tn-icon name="search" size="16px" color="#9AA0A8" />
			<input
				v-model="keyword"
				class="files-search__input"
				placeholder="搜索文件名 / 类型"
				confirm-type="search"
			/>
		</view>

		<view v-if="filtered.length" class="files-card">
			<view
				v-for="file in filtered"
				:key="file.name"
				class="file-row"
				@tap="onFile(file)"
			>
				<view class="file-row__icon" :style="{ backgroundColor: `${file.color}16` }">
					<tn-icon :name="file.icon" size="18px" :color="file.color" />
				</view>
				<view class="file-row__main">
					<text class="file-row__name">{{ file.name }}</text>
					<text class="file-row__meta">{{ file.size }} · {{ file.time }} · {{ file.owner }}</text>
				</view>
				<tn-icon name="more-horizontal" size="16px" color="#C9CDD4" />
			</view>
		</view>

		<qq-empty v-else icon="search" :title="`没有找到「${keyword}」`" sub="换个文件名或发送人试试" compact />

		<text class="files-footer">群文件数据为本地演示</text>
	</view>
</template>

<style lang="scss" scoped>
	.files-page {
		min-height: 100vh;
		box-sizing: border-box;
		padding-bottom: 26px;
		background-color: var(--qq-card-2);
	}

	.files-hd {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
	}

	.files-summary {
		display: flex;
		align-items: center;
		margin: 6px 12px 0;
		padding: 14px;
		border-radius: 14px;
		background-color: var(--qq-card);
	}

	.files-summary__icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 42px;
		height: 42px;
		border-radius: 12px;
		background-color: rgba(71, 118, 230, 0.1);
	}

	.files-summary__main {
		flex: 1;
		min-width: 0;
		margin-left: 11px;
	}

	.files-summary__title {
		display: block;
		font-size: 15px;
		font-weight: 600;
		color: var(--qq-text);
	}

	.files-summary__meta {
		display: block;
		margin-top: 4px;
		font-size: 11px;
		color: var(--qq-text-3);
	}

	.files-summary__upload {
		display: flex;
		align-items: center;
		gap: 2px;
		height: 28px;
		padding: 0 11px;
		border-radius: 14px;
		background-color: rgba(18, 183, 245, 0.1);
	}

	.files-summary__upload-text {
		font-size: 11.5px;
		color: #12b7f5;
	}

	.files-search {
		display: flex;
		align-items: center;
		height: 36px;
		margin: 10px 12px 0;
		padding: 0 12px;
		border-radius: 10px;
		background-color: var(--qq-card);
	}

	.files-search__input {
		flex: 1;
		height: 100%;
		margin-left: 8px;
		font-size: 13px;
		color: var(--qq-text);
	}

	.files-card {
		margin: 10px 12px 0;
		padding: 2px 14px;
		border-radius: 12px;
		background-color: var(--qq-card);
	}

	.file-row {
		display: flex;
		align-items: center;
		padding: 11px 0;
		border-bottom: 1px solid var(--qq-line);
	}

	.file-row:last-child {
		border-bottom: none;
	}

	.file-row__icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 38px;
		height: 38px;
		border-radius: 9px;
		flex-shrink: 0;
	}

	.file-row__main {
		flex: 1;
		min-width: 0;
		margin-left: 11px;
	}

	.file-row__name {
		display: block;
		font-size: 13.5px;
		font-weight: 500;
		color: var(--qq-text);
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
	}

	.file-row__meta {
		display: block;
		margin-top: 4px;
		font-size: 10.5px;
		color: var(--qq-text-3);
	}

	.files-empty {
		padding: 50px 0;
		text-align: center;
	}

	.files-empty__text {
		font-size: 12.5px;
		color: var(--qq-text-3);
	}

	.files-footer {
		display: block;
		margin-top: 18px;
		text-align: center;
		font-size: 10.5px;
		color: var(--qq-text-4);
	}
</style>
