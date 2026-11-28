<script lang="ts" setup>
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAppStore } from '@/store/modules/app'
import type { OptionItem } from '@/types/http'
import AppIcon from './AppIcon.vue'
import AppButton from './AppButton.vue'

type SelectValue = string | number

const props = withDefaults(
  defineProps<{
    modelValue: SelectValue | SelectValue[] | ''
    options: OptionItem<SelectValue>[]
    placeholder?: string
    title?: string
    multiple?: boolean
    disabled?: boolean
  }>(),
  {
    modelValue: '',
    options: () => [],
    placeholder: '',
    title: '',
    multiple: false,
    disabled: false,
  }
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: SelectValue | SelectValue[] | ''): void
  (e: 'change', value: SelectValue | SelectValue[] | ''): void
}>()

const app = useAppStore()
const { t } = useI18n()
const placeholderText = computed(() => props.placeholder || t('common.choose'))
const open = ref(false)
const tempValue = ref<SelectValue[]>([])

const isMobile = computed(() => app.isMobile)

const selectedValues = computed<SelectValue[]>(() => {
  if (props.multiple) {
    return Array.isArray(props.modelValue) ? props.modelValue : []
  }
  const value = props.modelValue
  return value === '' || value === null || value === undefined ? [] : [value as SelectValue]
})

const displayText = computed(() => {
  if (props.multiple) {
    if (!selectedValues.value.length) return placeholderText.value
    const labels = selectedValues.value
      .map((value) => props.options.find((opt) => opt.value === value)?.label)
      .filter(Boolean)
    return labels.length > 2 ? t('common.selected', { count: labels.length }) : labels.join('、')
  }
  const current = selectedValues.value[0]
  const option = props.options.find((opt) => opt.value === current)
  return option ? option.label : placeholderText.value
})

const isEmpty = computed(() => {
  if (props.multiple) return !selectedValues.value.length
  return props.modelValue === '' || props.modelValue === null || props.modelValue === undefined
})

const isSelected = (value: SelectValue): boolean => {
  if (props.multiple) return tempValue.value.includes(value)
  return selectedValues.value.includes(value)
}

const openPanel = () => {
  if (props.disabled) return
  tempValue.value = [...selectedValues.value]
  open.value = true
}

const close = () => {
  open.value = false
}

const onChoose = (option: OptionItem<SelectValue>) => {
  if (props.multiple) {
    const index = tempValue.value.indexOf(option.value)
    if (index === -1) tempValue.value.push(option.value)
    else tempValue.value.splice(index, 1)
    return
  }
  emit('update:modelValue', option.value)
  emit('change', option.value)
  close()
}

const confirmMultiple = () => {
  emit('update:modelValue', [...tempValue.value])
  emit('change', [...tempValue.value])
  close()
}

watch(
  () => props.modelValue,
  () => {
    if (!open.value) tempValue.value = [...selectedValues.value]
  }
)
</script>

<template>
  <view class="app-select">
    <view
      class="select-trigger"
      :class="{ 'is-empty': isEmpty, 'is-disabled': disabled }"
      @tap="openPanel"
    >
      <text class="select-text">{{ displayText }}</text>
      <app-icon name="down" :size="12" color="#98a2b3" />
    </view>

    <template v-if="open">
      <view class="select-mask" @tap="close" />
      <view class="select-panel" :class="{ 'is-sheet': isMobile }">
        <view class="panel-head">
          <text class="panel-title">{{ title || placeholderText }}</text>
          <view class="panel-close" @tap="close">
            <app-icon name="close" :size="15" color="#98a2b3" />
          </view>
        </view>
        <scroll-view scroll-y class="panel-body">
          <view
            v-for="option in options"
            :key="String(option.value)"
            class="option-row"
            :class="{ 'is-active': isSelected(option.value) }"
            @tap="onChoose(option)"
          >
            <text class="option-label">{{ option.label }}</text>
            <app-icon
              v-if="isSelected(option.value)"
              name="check"
              :size="14"
              color="var(--app-primary)"
            />
          </view>
          <view v-if="!options.length" class="panel-empty">
            <text>{{ t('common.noOptions') }}</text>
          </view>
        </scroll-view>
        <view v-if="multiple" class="panel-footer">
          <app-button size="md" block @click="confirmMultiple">
            {{ t('common.selectConfirm', { count: tempValue.length }) }}
          </app-button>
        </view>
      </view>
    </template>
  </view>
</template>

<style lang="scss" scoped>
.app-select {
  width: 100%;
}

.select-trigger {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  height: 36px;
  padding: 0 10px;
  background: var(--app-card);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-sm);
}

.select-text {
  flex: 1;
  font-size: var(--app-font);
  color: var(--app-text);
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.is-empty .select-text {
  color: #a2abb9;
}

.is-disabled {
  background: var(--app-bg-2);
  opacity: 0.7;
}

.select-mask {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  background: rgba(17, 31, 45, 0.35);
  z-index: 2100;
}

.select-panel {
  position: fixed;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 360px;
  max-height: 62vh;
  background: var(--app-card);
  border-radius: var(--app-radius);
  box-shadow: var(--app-shadow-lg);
  z-index: 2101;
  overflow: hidden;
}

/* 移动端：底部弹出 */
.is-sheet {
  top: auto;
  bottom: 0;
  left: 0;
  right: 0;
  width: 100%;
  max-height: 70vh;
  transform: none;
  border-radius: 16px 16px 0 0;
  padding-bottom: env(safe-area-inset-bottom);
}

.panel-head {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px 10px;
}

.panel-title {
  font-size: var(--app-font-lg);
  font-weight: 600;
  color: var(--app-text);
}

.panel-close {
  padding: 4px;
}

.panel-body {
  height: 260px;
  padding: 0 8px 8px;
}

.is-sheet .panel-body {
  height: 46vh;
}

.option-row {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  padding: 10px 8px;
  border-radius: var(--app-radius-sm);
}

.is-active {
  background: var(--app-primary-weak-2);
}

.option-label {
  font-size: var(--app-font);
  color: var(--app-text-2);
}

.is-active .option-label {
  color: var(--app-primary);
  font-weight: 500;
}

.panel-empty {
  padding: 24px 0;
  align-items: center;
  color: var(--app-text-3);
  font-size: var(--app-font-sm);
}

.panel-footer {
  padding: 8px 16px 14px;
  border-top: 1px solid var(--app-border-2);
}
</style>
