<script lang="ts" setup>
import { computed } from 'vue'
import AppIcon from './AppIcon.vue'

type ButtonType = 'primary' | 'default' | 'success' | 'warning' | 'danger' | 'text'
type ButtonSize = 'sm' | 'md' | 'lg'

const props = withDefaults(
  defineProps<{
    type?: ButtonType
    size?: ButtonSize
    icon?: string
    loading?: boolean
    disabled?: boolean
    block?: boolean
    plain?: boolean
    round?: boolean
  }>(),
  {
    type: 'primary',
    size: 'md',
    icon: '',
    loading: false,
    disabled: false,
    block: false,
    plain: false,
    round: false,
  }
)

const emit = defineEmits<{
  (e: 'click'): void
}>()

const isDisabled = computed(() => props.disabled || props.loading)

const iconSize = computed(() => {
  if (props.size === 'sm') return 13
  if (props.size === 'lg') return 17
  return 15
})

const iconColor = computed(() => {
  if (props.type === 'text' || props.plain) {
    return props.type === 'text' ? 'var(--app-primary)' : ''
  }
  return '#ffffff'
})

const handleTap = () => {
  if (isDisabled.value) return
  emit('click')
}
</script>

<template>
  <view
    class="app-btn"
    :class="[
      `type-${type}`,
      `size-${size}`,
      {
        'is-plain': plain,
        'is-block': block,
        'is-round': round,
        'is-disabled': isDisabled,
      },
    ]"
    :hover-class="isDisabled ? 'none' : 'app-btn--hover'"
    @tap="handleTap"
  >
    <view v-if="loading" class="btn-spinner" :class="{ 'is-light': type !== 'text' && !plain }" />
    <app-icon v-else-if="icon" :name="icon" :size="iconSize" :color="iconColor" class="btn-icon" />
    <text class="btn-text"><slot /></text>
  </view>
</template>

<style lang="scss" scoped>
.app-btn {
  display: inline-flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  border-radius: var(--app-radius-sm);
  border: 1px solid transparent;
  transition:
    background-color 0.15s,
    border-color 0.15s,
    opacity 0.15s;
  user-select: none;
}

/* 尺寸 */
.size-sm {
  height: 30px;
  padding: 0 12px;
  font-size: var(--app-font-sm);
}
.size-md {
  height: 36px;
  padding: 0 16px;
  font-size: var(--app-font);
}
.size-lg {
  height: 44px;
  padding: 0 22px;
  font-size: var(--app-font-lg);
}

.btn-text {
  line-height: 1;
  white-space: nowrap;
}

.btn-icon {
  margin-right: 5px;
}

.is-block {
  width: 100%;
}

.is-round {
  border-radius: 999px;
}

/* 类型 */
.type-primary {
  background-color: var(--app-primary);
  color: #fff;
}
.type-success {
  background-color: var(--app-success);
  color: #fff;
}
.type-warning {
  background-color: var(--app-warning);
  color: #fff;
}
.type-danger {
  background-color: var(--app-danger);
  color: #fff;
}
.type-default {
  background-color: var(--app-card);
  border-color: var(--app-border);
  color: var(--app-text-2);
}
.type-text {
  background-color: transparent;
  color: var(--app-primary);
  padding: 0 6px;
}

.is-plain {
  background-color: transparent;
  &.type-primary {
    color: var(--app-primary);
    border-color: var(--app-primary);
    background-color: var(--app-primary-weak);
  }
  &.type-success {
    color: var(--app-success);
    border-color: var(--app-success);
  }
  &.type-warning {
    color: var(--app-warning);
    border-color: var(--app-warning);
  }
  &.type-danger {
    color: var(--app-danger);
    border-color: var(--app-danger);
  }
}

.is-disabled {
  opacity: 0.55;
}

.app-btn--hover {
  opacity: 0.85;
}

/* loading 圆环 */
.btn-spinner {
  width: 13px;
  height: 13px;
  margin-right: 6px;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.45);
  border-top-color: #fff;
  animation: btn-spin 0.7s linear infinite;
}
.btn-spinner.is-light {
  border-color: rgba(1, 190, 255, 0.3);
  border-top-color: var(--app-primary);
}

@keyframes btn-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
