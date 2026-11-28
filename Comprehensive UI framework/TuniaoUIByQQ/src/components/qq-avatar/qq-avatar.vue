<script lang="ts" setup>
	import { computed } from 'vue'

	const props = withDefaults(
		defineProps<{
			name?: string
			from?: string
			to?: string
			size?: number
			text?: string
			group?: boolean
			online?: boolean
			radius?: number
		}>(),
		{
			name: '',
			from: '#4facfe',
			to: '#00c6fb',
			size: 44,
			text: '',
			group: false,
			online: false,
			radius: 0,
		}
	)

	// 头像文字：优先外部指定，否则取昵称首字
	const initial = computed(() => props.text || (props.name ? props.name.slice(0, 1) : 'Q'))
	const shapeStyle = computed(() => ({
		width: `${props.size}px`,
		height: `${props.size}px`,
		borderRadius: props.radius ? `${props.radius}px` : '50%',
		backgroundImage: `linear-gradient(135deg, ${props.from} 0%, ${props.to} 100%)`,
		fontSize: `${Math.max(11, Math.round(props.size * 0.4))}px`,
	}))
	const badgeSize = computed(() => `${Math.max(12, Math.round(props.size * 0.34))}px`)
</script>

<template>
	<view class="qq-avatar" :style="shapeStyle">
		<text class="qq-avatar__text">{{ initial }}</text>
		<!-- 群头像左下角的群标识 -->
		<view v-if="group" class="qq-avatar__group" :style="{ width: badgeSize, height: badgeSize }">
			<tn-icon name="team" :size="`${Math.round(props.size * 0.18)}px`" color="tn-white" />
		</view>
		<!-- 在线状态点 -->
		<view v-if="online" class="qq-avatar__online" :style="{ width: `${Math.max(7, Math.round(props.size * 0.2))}px` }" />
	</view>
</template>

<style lang="scss" scoped>
	.qq-avatar {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		color: #ffffff;
		font-weight: 600;
		letter-spacing: 0.5px;
		box-shadow: inset 0 -6px 12px rgba(0, 0, 0, 0.08);
	}

	.qq-avatar__text {
		color: #ffffff;
		font-weight: 600;
		line-height: 1;
		text-shadow: 0 1px 2px rgba(0, 0, 0, 0.12);
	}

	.qq-avatar__group {
		position: absolute;
		left: -2px;
		bottom: -2px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 50%;
		background-color: #12b7f5;
		border: 1px solid #ffffff;
	}

	.qq-avatar__online {
		position: absolute;
		right: 1px;
		bottom: 1px;
		aspect-ratio: 1;
		border-radius: 50%;
		background-color: #32c48d;
		border: 1px solid #ffffff;
	}
</style>
