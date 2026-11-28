<script lang="ts" setup>
	withDefaults(
		defineProps<{
			rows?: number
			variant?: 'list' | 'vote'
		}>(),
		{
			rows: 3,
			variant: 'list',
		}
	)
</script>

<template>
	<view class="qq-skeleton">
		<view v-for="i in rows" :key="i" class="qq-skeleton__card">
			<view class="qq-skeleton__head">
				<view class="qq-skeleton__avatar" />
				<view class="qq-skeleton__head-main">
					<view class="qq-skeleton__bar qq-skeleton__bar--w72" />
					<view class="qq-skeleton__bar qq-skeleton__bar--w40 qq-skeleton__bar--thin" />
				</view>
			</view>
			<template v-if="variant === 'vote'">
				<view class="qq-skeleton__opt" />
				<view class="qq-skeleton__opt qq-skeleton__opt--short" />
			</template>
			<template v-else>
				<view class="qq-skeleton__bar qq-skeleton__bar--w90" />
				<view class="qq-skeleton__bar qq-skeleton__bar--w60" />
			</template>
		</view>
	</view>
</template>

<style lang="scss" scoped>
	.qq-skeleton {
		margin: 10px 12px 0;
	}

	.qq-skeleton__card {
		margin-bottom: 9px;
		padding: 14px;
		border-radius: 14px;
		background-color: var(--qq-card);
	}

	.qq-skeleton__head {
		display: flex;
		align-items: center;
	}

	.qq-skeleton__avatar {
		width: 34px;
		height: 34px;
		border-radius: 50%;
		background: linear-gradient(90deg, var(--qq-card-2) 25%, var(--qq-line) 37%, var(--qq-card-2) 63%);
		background-size: 400% 100%;
		animation: qq-shimmer 1.2s ease infinite;
	}

	.qq-skeleton__head-main {
		flex: 1;
		margin-left: 10px;
	}

	.qq-skeleton__bar,
	.qq-skeleton__opt {
		height: 10px;
		border-radius: 5px;
		background: linear-gradient(90deg, var(--qq-card-2) 25%, var(--qq-line) 37%, var(--qq-card-2) 63%);
		background-size: 400% 100%;
		animation: qq-shimmer 1.2s ease infinite;
	}

	.qq-skeleton__bar {
		margin-top: 8px;
	}

	.qq-skeleton__bar:first-child {
		margin-top: 0;
	}

	.qq-skeleton__bar--thin {
		height: 7px;
	}

	.qq-skeleton__bar--w72 {
		width: 72%;
	}

	.qq-skeleton__bar--w90 {
		width: 90%;
	}

	.qq-skeleton__bar--w60 {
		width: 60%;
	}

	.qq-skeleton__bar--w40 {
		width: 40%;
	}

	.qq-skeleton__opt {
		height: 34px;
		margin-top: 8px;
		border-radius: 9px;
	}

	.qq-skeleton__opt--short {
		width: 74%;
	}

	@keyframes qq-shimmer {
		0% {
			background-position: 100% 50%;
		}
		100% {
			background-position: 0 50%;
		}
	}
</style>
