<script lang="ts" setup>
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    modelValue: string | number | boolean
    activeValue?: string | number | boolean
    inactiveValue?: string | number | boolean
    disabled?: boolean
    loading?: boolean
  }>(),
  {
    activeValue: true,
    inactiveValue: false,
    disabled: false,
    loading: false,
  }
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: string | number | boolean): void
  (e: 'change', value: string | number | boolean): void
}>()

const isActive = computed(() => props.modelValue === props.activeValue)

const toggle = () => {
  if (props.disabled || props.loading) return
  const next = isActive.value ? props.inactiveValue : props.activeValue
  emit('update:modelValue', next)
  emit('change', next)
}
</script>

<template>
  <view
    class="app-switch"
    :class="{ 'is-active': isActive, 'is-disabled': disabled || loading }"
    @tap="toggle"
  >
    <view class="switch-knob" :class="{ 'is-loading': loading }" />
  </view>
</template>

<style lang="scss" scoped>
.app-switch {
  width: 40px;
  height: 22px;
  border-radius: 999px;
  background-color: #d9dfe8;
  padding: 2px;
  flex-direction: row;
  align-items: center;
  transition: background-color 0.2s;
}

.is-active {
  background-color: var(--app-primary);
  justify-content: flex-end;
}

.is-disabled {
  opacity: 0.5;
}

.switch-knob {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background-color: #fff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.18);
  transition: transform 0.2s;
}

.is-loading {
  animation: switch-pulse 0.9s ease-in-out infinite;
}

@keyframes switch-pulse {
  50% {
    opacity: 0.5;
  }
}
</style>
