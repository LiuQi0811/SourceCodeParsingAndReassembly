<script lang="ts" setup>
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    title?: string
    subtitle?: string
    /** 内边距，数字按 px 处理，也可直接传 CSS 简写 */
    padding?: number | string
    /** 是否显示阴影 */
    shadow?: boolean
  }>(),
  {
    title: '',
    subtitle: '',
    padding: 16,
    shadow: true,
  }
)

const bodyStyle = computed(() => ({
  padding: typeof props.padding === 'number' ? `${props.padding}px` : props.padding,
}))
</script>

<template>
  <view class="app-card" :class="{ 'no-shadow': !shadow }" :style="bodyStyle">
    <view v-if="title || $slots.extra" class="card-head">
      <view class="head-left">
        <text v-if="title" class="card-title">{{ title }}</text>
        <text v-if="subtitle" class="card-subtitle">{{ subtitle }}</text>
      </view>
      <view class="head-extra">
        <slot name="extra" />
      </view>
    </view>
    <slot />
  </view>
</template>

<style lang="scss" scoped>
.app-card {
  background: var(--app-card);
  border-radius: var(--app-radius);
  box-shadow: var(--app-shadow);
}

.no-shadow {
  box-shadow: none;
  border: 1px solid var(--app-border);
}

.card-head {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}

.head-left {
  flex-direction: column;
  gap: 4px;
}

.card-title {
  font-size: var(--app-font-lg);
  font-weight: 600;
  color: var(--app-text);
}

.card-subtitle {
  font-size: var(--app-font-xs);
  color: var(--app-text-3);
}

.head-extra {
  flex-direction: row;
  align-items: center;
  gap: 8px;
}
</style>
