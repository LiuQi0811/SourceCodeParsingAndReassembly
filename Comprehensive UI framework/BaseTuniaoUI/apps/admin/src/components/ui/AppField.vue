<script lang="ts" setup>
import { computed } from 'vue'
import { useAppStore } from '@/store/modules/app'

withDefaults(
  defineProps<{
    label: string
    required?: boolean
    error?: string
    /** 标签宽度(px)，仅桌面端横向布局生效 */
    labelWidth?: number
  }>(),
  {
    required: false,
    error: '',
    labelWidth: 84,
  }
)

const app = useAppStore()
const isMobile = computed(() => app.isMobile)
</script>

<template>
  <view class="app-field" :class="{ 'is-mobile': isMobile }">
    <view class="field-label" :style="isMobile ? {} : { width: `${labelWidth}px` }">
      <text v-if="required" class="field-required">*</text>
      <text class="label-text">{{ label }}</text>
    </view>
    <view class="field-control">
      <slot />
      <text v-if="error" class="field-error">{{ error }}</text>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.app-field {
  flex-direction: row;
  align-items: flex-start;
  gap: 10px;
  padding: 9px 0;
}

.is-mobile {
  flex-direction: column;
  align-items: stretch;
  gap: 6px;
  padding: 8px 0;
}

.field-label {
  flex-direction: row;
  align-items: center;
  min-height: 36px;
  flex: none;
}

.is-mobile .field-label {
  min-height: auto;
}

.field-required {
  color: var(--app-danger);
  margin-right: 2px;
  font-size: var(--app-font);
  line-height: 1;
}

.label-text {
  font-size: var(--app-font);
  color: var(--app-text-2);
}

.field-control {
  flex: 1;
  min-width: 0;
}

.field-error {
  font-size: var(--app-font-xs);
  color: var(--app-danger);
  margin-top: 4px;
}
</style>
