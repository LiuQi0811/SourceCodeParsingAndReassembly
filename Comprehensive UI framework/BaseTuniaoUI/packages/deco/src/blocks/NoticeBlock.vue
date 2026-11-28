<template>
  <view class="deco-notice" @click="emit('jump', props.link)">
    <view class="notice-tag">
      <text class="tag-text">{{ props.tag }}</text>
    </view>
    <text class="notice-text">{{ props.text }}</text>
    <text v-if="props.link" class="notice-arrow">›</text>
  </view>
</template>

<script lang="ts" setup>
const props = withDefaults(
  defineProps<{
    text: string
    tag?: string
    link?: string
  }>(),
  { tag: '公告', link: '' }
)

const emit = defineEmits<{ (e: 'jump', link?: string): void }>()
</script>

<style lang="scss" scoped>
.deco-notice {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  background: #ffffff;
  border-radius: 10px;
}

.notice-tag {
  flex: none;
  padding: 2px 8px;
  border-radius: 6px;
  background: rgba(1, 190, 255, 0.12);
}

.tag-text {
  font-size: 11px;
  color: #01beff;
}

.notice-text {
  flex: 1;
  font-size: 13px;
  color: #4e5969;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.notice-arrow {
  flex: none;
  font-size: 16px;
  color: #b3bbc9;
}
</style>
