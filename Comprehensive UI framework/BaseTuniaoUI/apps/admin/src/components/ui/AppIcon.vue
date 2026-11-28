<script lang="ts" setup>
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    /** 图鸟图标名称，如 home / my / set */
    name: string
    /** 图标尺寸，单位 px */
    size?: number
    /** 颜色，支持十六进制与图鸟内置色 */
    color?: string
    bold?: boolean
  }>(),
  {
    size: 16,
    color: '',
    bold: false,
  }
)

/**
 * 直接用 tn-icon 字体渲染，不再依赖 @tuniao/tnui-vue3-uniapp 的 icon 组件：
 * - 图标字形来自 @tuniao/tn-icon/dist/index.css（已在 App.vue 引入）
 * - 尺寸固定 px，避免 rpx 在桌面 H5 被放大
 */
const style = computed(() => ({
  fontSize: `${props.size}px`,
  color: props.color || 'inherit',
  fontWeight: props.bold ? 700 : 400,
}))
</script>

<template>
  <view class="app-icon" :style="style">
    <text class="app-icon-glyph" :class="`tn-icon-${name}`" />
  </view>
</template>

<style lang="scss" scoped>
.app-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  flex: none;
}

.app-icon-glyph {
  display: inline-block;
  line-height: 1;
}
</style>
