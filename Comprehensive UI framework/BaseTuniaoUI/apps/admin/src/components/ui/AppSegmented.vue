<script lang="ts" setup>
import type { OptionItem } from '@/types/http'

withDefaults(
  defineProps<{
    modelValue: string | number
    options: OptionItem<string | number>[]
  }>(),
  {
    modelValue: '',
    options: () => [],
  }
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: string | number): void
  (e: 'change', value: string | number): void
}>()

const select = (value: string | number) => {
  emit('update:modelValue', value)
  emit('change', value)
}
</script>

<template>
  <view class="app-segmented">
    <view
      v-for="option in options"
      :key="String(option.value)"
      class="seg-item"
      :class="{ 'is-active': option.value === modelValue }"
      @tap="select(option.value)"
    >
      <text class="seg-text">{{ option.label }}</text>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.app-segmented {
  flex-direction: row;
  align-items: center;
  background: var(--app-bg-2);
  border-radius: var(--app-radius-sm);
  padding: 3px;
  gap: 2px;
  align-self: flex-start;
}

.seg-item {
  height: 30px;
  padding: 0 16px;
  border-radius: 5px;
  align-items: center;
  justify-content: center;
  transition: background-color 0.15s;
}

.is-active {
  background: var(--app-card);
  box-shadow: 0 1px 4px rgba(17, 31, 45, 0.08);
}

.seg-text {
  font-size: var(--app-font-sm);
  color: var(--app-text-2);
  white-space: nowrap;
}

.is-active .seg-text {
  color: var(--app-primary);
  font-weight: 600;
}
</style>
