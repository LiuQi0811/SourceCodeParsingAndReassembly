<script lang="ts" setup>
	import { unreadTotal } from '@/qq/store'
	import { goTab, type QQTabName } from '@/qq/router'

	const props = defineProps<{ active: QQTabName }>()

	const items: { name: QQTabName; label: string; icon: string }[] = [
		{ name: 'message', label: '消息', icon: 'chat' },
		{ name: 'contact', label: '联系人', icon: 'contact' },
		{ name: 'channel', label: '频道', icon: 'channel' },
		{ name: 'dynamic', label: '动态', icon: 'dynamic' },
		{ name: 'mine', label: '我的', icon: 'mine' },
	]

	function onTap(name: QQTabName) {
		if (name === props.active) return
		goTab(name)
	}
</script>

<template>
	<view class="qq-tabbar">
		<view
			v-for="item in items"
			:key="item.name"
			class="qq-tabbar__item"
			:class="{ 'qq-tabbar__item--active': item.name === active }"
			@tap="onTap(item.name)"
		>
			<view class="qq-tabbar__icon">
				<qq-tab-icon :name="item.icon" :active="item.name === active" :size="25" />
				<view
					v-if="item.name === 'message' && unreadTotal > 0"
					class="qq-badge qq-tabbar__badge"
				>
					{{ unreadTotal > 99 ? '99+' : unreadTotal }}
				</view>
			</view>
			<text class="qq-tabbar__label">{{ item.label }}</text>
		</view>
	</view>
</template>

<style lang="scss" scoped>
	.qq-tabbar {
		position: fixed;
		left: 50%;
		transform: translateX(-50%);
		bottom: 0;
		z-index: 60;
		display: flex;
		align-items: center;
		width: 100%;
		max-width: 430px;
		height: calc(54px + env(safe-area-inset-bottom));
		padding-bottom: env(safe-area-inset-bottom);
		background-color: var(--qq-card-glass);
		border-top: 1px solid var(--qq-line);
		backdrop-filter: blur(12px);
	}

	.qq-tabbar__item {
		position: relative;
		display: flex;
		flex: 1;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 54px;
		gap: 3px;
	}

	.qq-tabbar__icon {
		position: relative;
	}

	.qq-tabbar__badge {
		position: absolute;
		top: -6px;
		left: 16px;
		transform: scale(0.86);
		transform-origin: left top;
	}

	.qq-tabbar__label {
		font-size: 10px;
		line-height: 1;
		color: var(--qq-text-2);
	}

	.qq-tabbar__item--active .qq-tabbar__label {
		color: #12b7f5;
		font-weight: 600;
	}
</style>
