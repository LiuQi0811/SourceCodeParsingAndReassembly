<template>
  <swiper
    class="deco-banner"
    :style="{ height: `${props.height}px`, borderRadius: `${props.radius}px` }"
    :indicator-dots="props.items.length > 1"
    indicator-color="rgba(255,255,255,0.4)"
    indicator-active-color="#ffffff"
    :autoplay="props.items.length > 1"
    :circular="true"
    :interval="3500"
  >
    <swiper-item v-for="item in props.items" :key="item.id" @click="emit('jump', item.link)">
      <image v-if="item.image" class="banner-image" :src="item.image" mode="aspectFill" />
      <view
        v-else
        class="banner-image banner-fallback"
        :style="{ background: `linear-gradient(120deg, ${props.primary}, rgba(1,190,255,0.55))` }"
      >
        <text class="fallback-title">{{ item.title || '装修位' }}</text>
      </view>
    </swiper-item>
  </swiper>
</template>

<script lang="ts" setup>
import type { DecoBannerItem } from '../schema'

const props = withDefaults(
  defineProps<{
    items: DecoBannerItem[]
    height?: number
    radius?: number
    primary?: string
  }>(),
  { height: 160, radius: 12, primary: '#01beff' }
)

const emit = defineEmits<{ (e: 'jump', link?: string): void }>()
</script>

<style lang="scss" scoped>
.deco-banner {
  width: 100%;
  overflow: hidden;
}

.banner-image {
  width: 100%;
  height: 100%;
}

.banner-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
}

.fallback-title {
  font-size: 16px;
  font-weight: 600;
  color: #ffffff;
  letter-spacing: 1px;
}
</style>
