<script lang="ts" setup>
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { chooseAndUploadImage, UploadError } from '@/api/upload'
import AppButton from '@/components/ui/AppButton.vue'
import AppInput from '@/components/ui/AppInput.vue'

const props = defineProps<{ modelValue?: string }>()
const emit = defineEmits<{ (e: 'update:modelValue', value: string): void }>()

const { t } = useI18n()
const uploading = ref(false)

const errorText = (error: unknown): string => {
  if (!(error instanceof UploadError)) return t('deco.uploadFailed')
  switch (error.code) {
    case 'too-large':
      return t('deco.imageTooLarge')
    case 'unsupported':
      return t('deco.imageUnsupported')
    default:
      return t('deco.uploadFailed')
  }
}

const choose = async () => {
  if (uploading.value) return
  uploading.value = true
  try {
    const result = await chooseAndUploadImage()
    if (result) emit('update:modelValue', result.url)
  } catch (error) {
    uni.showToast({ title: errorText(error), icon: 'none' })
  } finally {
    uploading.value = false
  }
}

const clear = () => emit('update:modelValue', '')
</script>

<template>
  <view class="image-picker">
    <view class="picker-row">
      <view class="thumb">
        <image
          v-if="props.modelValue"
          class="thumb-img"
          :src="props.modelValue"
          mode="aspectFill"
        />
        <text v-else class="thumb-empty">{{ t('deco.imageEmpty') }}</text>
      </view>
      <view class="picker-ops">
        <app-button size="sm" plain :loading="uploading" @click="choose">
          {{ props.modelValue ? t('deco.replaceImage') : t('deco.chooseImage') }}
        </app-button>
        <app-button v-if="props.modelValue" size="sm" type="text" icon="delete" @click="clear" />
      </view>
    </view>
    <app-input
      :model-value="props.modelValue || ''"
      :placeholder="t('deco.imageUrlPlaceholder')"
      @update:model-value="emit('update:modelValue', $event)"
    />
  </view>
</template>

<style lang="scss" scoped>
.image-picker {
  gap: 6px;
}

.picker-row {
  flex-direction: row;
  align-items: center;
  gap: 10px;
}

.thumb {
  width: 72px;
  height: 48px;
  align-items: center;
  justify-content: center;
  border: 1px dashed var(--app-border);
  border-radius: var(--app-radius-sm);
  background: var(--app-bg);
  overflow: hidden;
}

.thumb-img {
  width: 100%;
  height: 100%;
}

.thumb-empty {
  font-size: 11px;
  color: var(--app-text-3);
  text-align: center;
}

.picker-ops {
  flex: 1;
  flex-direction: row;
  align-items: center;
  gap: 4px;
}
</style>
