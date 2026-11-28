<script lang="ts" setup>
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import AppIcon from './AppIcon.vue'

const props = withDefaults(
  defineProps<{
    modelValue?: string | number
    placeholder?: string
    /** 是否为密码框 */
    password?: boolean
    /** 输入类型：text / number / digit */
    type?: 'text' | 'number' | 'digit'
    /** 多行文本 */
    textarea?: boolean
    disabled?: boolean
    maxlength?: number
    prefixIcon?: string
    clearable?: boolean
    autoHeight?: boolean
    /** 多行文本行高(px)，仅 textarea 生效 */
    minHeight?: number
  }>(),
  {
    modelValue: '',
    placeholder: '',
    password: false,
    type: 'text',
    textarea: false,
    disabled: false,
    maxlength: -1,
    prefixIcon: '',
    clearable: false,
    autoHeight: true,
    minHeight: 84,
  }
)

const { t } = useI18n()
const placeholderText = computed(() => props.placeholder || t('common.input'))

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'input', value: string): void
  (e: 'confirm', value: string): void
  (e: 'clear'): void
}>()

const focused = ref(false)

const displayValue = computed(() =>
  props.modelValue === null || props.modelValue === undefined ? '' : String(props.modelValue)
)

const onInput = (event: any) => {
  const value = String(event.detail.value ?? '')
  emit('update:modelValue', value)
  emit('input', value)
}

const onConfirm = (event: any) => {
  emit('confirm', String(event.detail.value ?? ''))
}

const clear = () => {
  emit('update:modelValue', '')
  emit('input', '')
  emit('clear')
}
</script>

<template>
  <view
    class="app-input"
    :class="{
      'is-focus': focused,
      'is-disabled': disabled,
      'is-textarea': textarea,
    }"
    :style="textarea ? { minHeight: `${minHeight}px` } : {}"
  >
    <app-icon
      v-if="prefixIcon"
      :name="prefixIcon"
      :size="15"
      color="#a2abb9"
      class="input-prefix"
    />
    <textarea
      v-if="textarea"
      class="input-el input-textarea"
      :value="displayValue"
      :placeholder="placeholderText"
      :disabled="disabled"
      :maxlength="maxlength"
      :auto-height="autoHeight"
      placeholder-class="app-input-placeholder"
      @input="onInput"
      @focus="focused = true"
      @blur="focused = false"
    />
    <input
      v-else
      class="input-el"
      :value="displayValue"
      :type="type"
      :password="password"
      :placeholder="placeholderText"
      :disabled="disabled"
      :maxlength="maxlength"
      placeholder-class="app-input-placeholder"
      @input="onInput"
      @confirm="onConfirm"
      @focus="focused = true"
      @blur="focused = false"
    />
    <view v-if="clearable && displayValue && !disabled" class="input-clear" @tap="clear">
      <app-icon name="close-circle" :size="14" color="#c5ccd6" />
    </view>
    <slot name="suffix" />
  </view>
</template>

<style lang="scss" scoped>
.app-input {
  flex-direction: row;
  align-items: center;
  background: var(--app-card);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius-sm);
  padding: 0 10px;
  min-height: 36px;
  transition: border-color 0.15s;
}

.is-focus {
  border-color: var(--app-primary);
  box-shadow: 0 0 0 2px rgba(1, 190, 255, 0.12);
}

.is-disabled {
  background: var(--app-bg-2);
}

.is-textarea {
  align-items: flex-start;
  padding: 8px 10px;
}

.input-el {
  flex: 1;
  min-width: 0;
  height: 34px;
  font-size: var(--app-font);
  color: var(--app-text);
  background: transparent;
  border: none;
  outline: none;
}

.input-textarea {
  height: 100%;
  line-height: 1.6;
  padding: 0;
}

.input-prefix {
  margin-right: 6px;
}

.input-clear {
  padding: 4px;
  margin-left: 4px;
}
</style>
