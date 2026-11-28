<script lang="ts" setup>
	defineProps<{
		icon?: string
		title?: string
		sub?: string
		actionText?: string
		compact?: boolean
	}>()

	const emit = defineEmits<{ action: [] }>()
</script>

<template>
	<view class="qq-empty" :class="{ 'qq-empty--compact': compact }">
		<view class="qq-empty__icon">
			<tn-icon :name="icon || 'success-circle'" size="27px" color="#C9CDD4" />
		</view>
		<text class="qq-empty__title">{{ title || '暂无内容' }}</text>
		<text v-if="sub" class="qq-empty__sub">{{ sub }}</text>
		<view v-if="actionText" class="qq-empty__btn" @tap="emit('action')">
			<text>{{ actionText }}</text>
		</view>
	</view>
</template>

<style lang="scss" scoped>
	.qq-empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 56px 24px 0;
	}

	.qq-empty--compact {
		padding: 30px 24px 26px;

		.qq-empty__icon {
			width: 54px;
			height: 54px;
		}
	}

	.qq-empty__icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 64px;
		height: 64px;
		border-radius: 50%;
		background-color: var(--qq-card);
		box-shadow: 0 4px 14px rgba(20, 30, 40, 0.04);
	}

	.qq-empty__title {
		margin-top: 14px;
		font-size: 14px;
		color: var(--qq-text-2);
		text-align: center;
	}

	.qq-empty__sub {
		margin-top: 6px;
		font-size: 11.5px;
		line-height: 1.5;
		color: var(--qq-text-3);
		text-align: center;
	}

	.qq-empty__btn {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 34px;
		margin-top: 18px;
		padding: 0 18px;
		border-radius: 17px;
		background-color: var(--qq-blue-light);
		font-size: 12.5px;
		font-weight: 600;
		color: #12b7f5;
	}
</style>
