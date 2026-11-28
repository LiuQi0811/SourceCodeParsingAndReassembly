<script lang="ts" setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import AppIcon from './AppIcon.vue'

const props = withDefaults(
  defineProps<{
    text?: string
    icon?: string
  }>(),
  {
    text: '',
    icon: 'empty-data',
  }
)

const { t } = useI18n()
const textValue = computed(() => props.text || t('common.noData'))
</script>

<template>
  <view class="app-empty">
    <view class="empty-icon">
      <app-icon :name="icon" :size="34" color="#c8d0dc" />
    </view>
    <text class="empty-text">{{ textValue }}</text>
    <slot />
  </view>
</template>

<style lang="scss" scoped>
.app-empty {
  align-items: center;
  justify-content: center;
  padding: 8px 0;
}

.empty-icon {
  width: 68px;
  height: 68px;
  border-radius: 50%;
  background: var(--app-bg-2);
  align-items: center;
  justify-content: center;
  margin-bottom: 10px;
}

.empty-text {
  font-size: var(--app-font-sm);
  color: var(--app-text-3);
}
</style>
