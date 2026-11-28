<template>
  <view class="deco-nav">
    <view
      v-for="item in props.items"
      :key="item.id"
      class="nav-item"
      :style="{ width: `${100 / props.columns}%` }"
      @click="emit('jump', item.link)"
    >
      <view v-if="item.icon" class="nav-icon">
        <text class="nav-icon-text">{{ item.icon }}</text>
      </view>
      <text class="nav-text">{{ item.text }}</text>
    </view>
  </view>
</template>

<script lang="ts" setup>
import type { DecoNavItem } from '../schema'

const props = withDefaults(
  defineProps<{
    items: DecoNavItem[]
    columns?: number
  }>(),
  { columns: 4 }
)

const emit = defineEmits<{ (e: 'jump', link?: string): void }>()
</script>

<style lang="scss" scoped>
.deco-nav {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  padding: 12px 4px;
  background: #ffffff;
  border-radius: 12px;
}

.nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 8px 0;
  box-sizing: border-box;
}

.nav-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 20px;
  background: rgba(1, 190, 255, 0.1);
}

.nav-icon-text {
  font-size: 16px;
  color: #01beff;
}

.nav-text {
  font-size: 12px;
  color: #4e5969;
}
</style>
