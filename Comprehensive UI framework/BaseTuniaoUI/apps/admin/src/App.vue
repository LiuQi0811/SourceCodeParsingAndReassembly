<script lang="ts" setup>
import { onLaunch } from '@dcloudio/uni-app'
import { useAppStore } from '@/store/modules/app'

onLaunch(() => {
  // 初始化响应式尺寸监听，布局与组件统一从这里读取设备形态
  useAppStore().initResponsive()
})
</script>

<style lang="scss">
/* 框架设计令牌与基础样式（颜色、字号、工具类） */
@use './styles/index.scss';
/* 图鸟 UI 全局样式 + 图标字体字形 */
@import '@tuniao/tn-style/dist/uniapp/index.css';
@import '@tuniao/tn-icon/dist/index.css';
</style>

<style lang="scss">
/* 必须单独成块并排在库样式之后：用本地字体覆盖 CDN 的 @font-face */
@use './styles/icon-font.scss';
</style>
