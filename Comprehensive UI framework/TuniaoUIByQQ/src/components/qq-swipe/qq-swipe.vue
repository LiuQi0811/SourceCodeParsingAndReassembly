<script lang="ts" setup>
	import { onBeforeUnmount, onMounted, ref } from 'vue'

	interface SwipeOption {
		text: string
		icon?: string
		bg?: string
		color?: string
	}

	const props = withDefaults(
		defineProps<{
			options?: SwipeOption[]
			actionWidth?: number
		}>(),
		{
			options: () => [],
			actionWidth: 64,
		}
	)

	const emit = defineEmits<{
		(e: 'select', option: SwipeOption): void
		(e: 'open'): void
		(e: 'close'): void
	}>()

	const offset = ref(0)
	let dragging = false
	let startX = 0
	let startY = 0
	let startOffset = 0
	let horizontal = false

	function actionsWidth() {
		return props.options.length * props.actionWidth
	}

	function pointOf(e: any) {
		if (e.touches && e.touches.length) return e.touches[0]
		if (e.changedTouches && e.changedTouches.length) return e.changedTouches[0]
		return e
	}

	function begin(e: any) {
		const p = pointOf(e)
		dragging = true
		startX = p.clientX
		startY = p.clientY
		startOffset = offset.value
		horizontal = false
	}

	function move(e: any) {
		if (!dragging) return
		const p = pointOf(e)
		const dx = p.clientX - startX
		const dy = p.clientY - startY
		if (!horizontal) {
			if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) {
				horizontal = true
			} else if (Math.abs(dy) > 8) {
				// 判定为纵向滚动，交还给页面
				dragging = false
				return
			}
		}
		if (!horizontal) return
		if (e.cancelable) e.preventDefault()
		const next = startOffset + dx
		offset.value = Math.max(-actionsWidth(), Math.min(0, next))
	}

	function finish() {
		if (!dragging) return
		dragging = false
		offset.value = offset.value < -actionsWidth() / 2 ? -actionsWidth() : 0
		emit(offset.value !== 0 ? 'open' : 'close')
	}

	function onDocMove(e: MouseEvent) {
		move(e)
	}

	function onDocUp() {
		finish()
		document.removeEventListener('mousemove', onDocMove)
		document.removeEventListener('mouseup', onDocUp)
	}

	function onMouseDown(e: MouseEvent) {
		begin(e)
		document.addEventListener('mousemove', onDocMove)
		document.addEventListener('mouseup', onDocUp)
	}

	const uid = `sw${Math.random().toString(36).slice(2, 8)}`
	let host: HTMLElement | null = null

	function bind(el: HTMLElement | null) {
		if (!el) return
		host = el
		el.addEventListener('touchstart', begin, { passive: true })
		el.addEventListener('touchmove', move, { passive: false })
		el.addEventListener('touchend', finish)
		el.addEventListener('touchcancel', finish)
		el.addEventListener('mousedown', onMouseDown)
		el.addEventListener('mouseup', finish)
	}

	onMounted(() => {
		bind(document.querySelector(`[data-qq-swipe="${uid}"]`) as HTMLElement | null)
	})

	onBeforeUnmount(() => {
		if (host) {
			host.removeEventListener('touchstart', begin)
			host.removeEventListener('touchmove', move)
			host.removeEventListener('touchend', finish)
			host.removeEventListener('touchcancel', finish)
			host.removeEventListener('mousedown', onMouseDown)
			host.removeEventListener('mouseup', finish)
		}
		document.removeEventListener('mousemove', onDocMove)
		document.removeEventListener('mouseup', onDocUp)
	})

	function close() {
		offset.value = 0
		emit('close')
	}

	function select(option: SwipeOption) {
		offset.value = 0
		emit('close')
		emit('select', option)
	}
</script>

<template>
	<view
		class="qq-swipe"
		:data-qq-swipe="uid"
	>
		<view class="qq-swipe__actions" :style="{ width: `${actionsWidth()}px` }">
			<view
				v-for="option in options"
				:key="option.text"
				class="qq-swipe__action"
				:style="{
					width: `${actionWidth}px`,
					backgroundColor: option.bg || '#EDEFF2',
					color: option.color || '#33363c',
				}"
				@tap.stop="select(option)"
			>
				<tn-icon v-if="option.icon" :name="option.icon" :size="`${18}px`" :color="option.color || '#33363c'" />
				<text class="qq-swipe__action-text">{{ option.text }}</text>
			</view>
		</view>

		<view
			class="qq-swipe__content"
			:style="{ transform: `translateX(${offset}px)` }"
			:class="{ 'qq-swipe__content--moving': dragging }"
		>
			<slot />
		</view>

		<view
			v-if="offset !== 0"
			class="qq-swipe__mask"
			:style="{ right: `${actionsWidth()}px` }"
			@tap="close"
		/>
	</view>
</template>

<style lang="scss" scoped>
	.qq-swipe {
		position: relative;
		overflow: hidden;
		background-color: var(--qq-card);
	}

	.qq-swipe__actions {
		position: absolute;
		top: 0;
		right: 0;
		height: 100%;
		display: flex;
	}

	.qq-swipe__action {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 4px;
		height: 100%;
	}

	.qq-swipe__action-text {
		font-size: 11.5px;
		line-height: 1;
	}

	.qq-swipe__content {
		position: relative;
		z-index: 2;
		width: 100%;
		transition: transform 0.18s ease-out;
	}

	.qq-swipe__content--moving {
		transition: none;
	}

	.qq-swipe__mask {
		position: absolute;
		inset: 0;
		z-index: 3;
	}
</style>
