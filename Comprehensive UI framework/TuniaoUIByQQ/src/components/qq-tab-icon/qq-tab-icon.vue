<script lang="ts" setup>
	import { computed } from 'vue'

	const props = withDefaults(defineProps<{ name?: string; active?: boolean; size?: number }>(), {
		name: 'chat',
		active: false,
		size: 25,
	})

	interface IconDef {
		paths: string[]
		circles?: { cx: number; cy: number; r: number }[]
	}

	// H5 端使用内联 SVG 绘制底部 Tab 图标，保证五个图标的线条风格统一
	const ICONS: Record<string, IconDef> = {
		chat: {
			paths: [
				'M20.4 11.3c0 4-3.7 7.3-8.4 7.3-1.1 0-2.2-.2-3.2-.6L4.2 20.3l1.2-3.5C3.9 15.3 3.6 13.4 3.6 11.3C3.6 7.3 7.3 4 12 4s8.4 3.3 8.4 7.3z',
				'M8.6 10.6h6.8',
				'M8.6 13.6h4.2',
			],
		},
		contact: {
			paths: [
				'M6.4 4.2h10.4a2 2 0 0 1 2 2v11.6a2 2 0 0 1-2 2H6.4a2 2 0 0 1-2-2V6.2a2 2 0 0 1 2-2z',
				'M4.4 9h3.8',
				'M4.4 12.4h3.8',
				'M4.4 15.8h3.8',
			],
		},
		channel: {
			paths: [
				'M12 3.8a8.2 8.2 0 1 0 0 16.4 8.2 8.2 0 0 0 0-16.4z',
				'M10 8.4l5.2 3.6-5.2 3.6z',
			],
		},
		dynamic: {
			paths: [
				'M12 3.4l2 4.9 4.9 2-4.9 2-2 4.9-2-4.9-4.9-2 4.9-2z',
			],
			circles: [{ cx: 18.4, cy: 5.4, r: 1.1 }],
		},
		mine: {
			paths: [
				'M12 12.1a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
				'M4.8 20.2c0-3.9 3.2-6.3 7.2-6.3s7.2 2.4 7.2 6.3',
			],
		},
	}

	const icon = computed<IconDef>(() => ICONS[props.name] || ICONS.chat)
	const color = computed(() => (props.active ? '#12B7F5' : '#7C828C'))
	const bg = computed(() => (props.active ? '#E8F8FF' : 'transparent'))
</script>

<template>
	<view
		class="qq-tab-icon"
		:style="{ width: `${size}px`, height: `${size}px`, backgroundColor: bg }"
	>
		<svg
			:width="size"
			:height="size"
			viewBox="0 0 24 24"
			xmlns="http://www.w3.org/2000/svg"
		>
			<path
				v-for="(d, i) in icon.paths"
				:key="i"
				:d="d"
				:stroke="color"
				stroke-width="1.7"
				stroke-linecap="round"
				stroke-linejoin="round"
				fill="none"
			/>
			<circle
				v-for="(c, i) in icon.circles || []"
				:key="`c${i}`"
				:cx="c.cx"
				:cy="c.cy"
				:r="c.r"
				:fill="color"
			/>
		</svg>
	</view>
</template>

<style lang="scss" scoped>
	.qq-tab-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 50%;
		transition: background-color 0.2s ease;
	}
</style>
