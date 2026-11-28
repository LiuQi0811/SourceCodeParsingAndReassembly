<script lang="ts" setup>
import { computed } from 'vue'

type TagType = 'primary' | 'success' | 'warning' | 'danger' | 'info'

const props = withDefaults(
  defineProps<{
    type?: TagType
    size?: 'sm' | 'md'
    plain?: boolean
  }>(),
  {
    type: 'primary',
    size: 'sm',
    plain: true,
  }
)

const cls = computed(() => [
  `tag-${props.type}`,
  `tag-size-${props.size}`,
  { 'is-plain': props.plain },
])
</script>

<template>
  <view class="app-tag" :class="cls">
    <text class="tag-text"><slot /></text>
  </view>
</template>

<style lang="scss" scoped>
.app-tag {
  display: inline-flex;
  flex-direction: row;
  align-items: center;
  border-radius: 4px;
  border: 1px solid transparent;
}

.tag-size-sm {
  height: 20px;
  padding: 0 7px;
  font-size: var(--app-font-xs);
}
.tag-size-md {
  height: 26px;
  padding: 0 10px;
  font-size: var(--app-font-sm);
}

.tag-text {
  line-height: 1;
}

.tag-primary {
  color: var(--app-primary);
  background: var(--app-primary-weak);
  border-color: transparent;
}
.tag-success {
  color: var(--app-success);
  background: var(--app-success-weak);
}
.tag-warning {
  color: #c77700;
  background: var(--app-warning-weak);
}
.tag-danger {
  color: var(--app-danger);
  background: var(--app-danger-weak);
}
.tag-info {
  color: var(--app-info);
  background: var(--app-info-weak);
}

.is-plain {
  background: transparent;
  &.tag-primary {
    border-color: rgba(1, 190, 255, 0.4);
  }
  &.tag-success {
    border-color: rgba(24, 181, 102, 0.4);
  }
  &.tag-warning {
    border-color: rgba(255, 149, 0, 0.4);
  }
  &.tag-danger {
    border-color: rgba(245, 69, 92, 0.4);
  }
  &.tag-info {
    border-color: rgba(138, 148, 166, 0.4);
  }
}
</style>
