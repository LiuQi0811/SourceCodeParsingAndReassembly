<script lang="ts" setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAppStore } from '@/store/modules/app'
import AppIcon from './AppIcon.vue'
import AppButton from './AppButton.vue'

const props = withDefaults(
  defineProps<{
    visible: boolean
    title?: string
    /** 弹窗宽度(px)，移动端自动撑满 */
    width?: number
    confirmText?: string
    cancelText?: string
    showFooter?: boolean
    showCancel?: boolean
    loading?: boolean
    closeOnMask?: boolean
  }>(),
  {
    title: '',
    width: 560,
    confirmText: '',
    cancelText: '',
    showFooter: true,
    showCancel: true,
    loading: false,
    closeOnMask: true,
  }
)

const { t } = useI18n()

/** 未显式传入文案时走语言包，切换语言后自动跟着变 */
const titleText = computed(() => props.title || t('common.tip'))
const confirmTextValue = computed(() => props.confirmText || t('common.confirm'))
const cancelTextValue = computed(() => props.cancelText || t('common.cancel'))

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'confirm'): void
  (e: 'cancel'): void
  (e: 'close'): void
}>()

const app = useAppStore()

const panelStyle = computed(() => {
  if (app.isMobile) return {}
  return { width: `${props.width}px` }
})

const close = () => {
  emit('update:visible', false)
  emit('close')
}

const onMask = () => {
  if (props.closeOnMask) close()
}

const onCancel = () => {
  emit('cancel')
  close()
}

const onConfirm = () => {
  emit('confirm')
}
</script>

<template>
  <view v-if="visible" class="dialog-root">
    <view class="dialog-mask" @tap="onMask" />
    <view class="dialog-panel" :class="{ 'is-mobile': app.isMobile }" :style="panelStyle">
      <view class="dialog-head">
        <text class="dialog-title">{{ titleText }}</text>
        <view class="dialog-close" @tap="close">
          <app-icon name="close" :size="16" color="#98a2b3" />
        </view>
      </view>

      <view class="dialog-body">
        <slot />
      </view>

      <view v-if="showFooter" class="dialog-footer">
        <slot name="footer">
          <app-button v-if="showCancel" type="default" @click="onCancel">
            {{ cancelTextValue }}
          </app-button>
          <app-button :loading="loading" @click="onConfirm">{{ confirmTextValue }}</app-button>
        </slot>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.dialog-root {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 1500;
  align-items: center;
  justify-content: center;
}

.dialog-mask {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  background: rgba(17, 31, 45, 0.45);
}

.dialog-panel {
  position: relative;
  background: var(--app-card);
  border-radius: var(--app-radius-lg);
  box-shadow: var(--app-shadow-lg);
  max-width: 92vw;
  max-height: 88vh;
  animation: dialog-in 0.18s ease-out;
}

.dialog-head {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  padding: 18px 20px 12px;
}

.dialog-title {
  font-size: var(--app-font-lg);
  font-weight: 600;
  color: var(--app-text);
}

.dialog-close {
  padding: 4px;
  margin-right: -4px;
}

.dialog-body {
  padding: 4px 20px 8px;
  max-height: 62vh;
  overflow-y: auto;
}

.is-mobile .dialog-body {
  max-height: 66vh;
}

.dialog-footer {
  flex-direction: row;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  padding: 12px 20px 18px;
  border-top: 1px solid var(--app-border-2);
  margin-top: 6px;
}

.is-mobile .dialog-footer {
  justify-content: space-between;
}

@keyframes dialog-in {
  from {
    transform: translateY(8px) scale(0.98);
  }
  to {
    transform: translateY(0) scale(1);
  }
}
</style>
