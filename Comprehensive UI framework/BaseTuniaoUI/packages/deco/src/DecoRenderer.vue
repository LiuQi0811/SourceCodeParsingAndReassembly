<template>
  <view class="deco-renderer">
    <view
      v-for="item in props.page.components"
      :key="item.id"
      :style="{ marginTop: `${item.gap ?? 12}px` }"
    >
      <BannerBlock
        v-if="item.type === 'banner'"
        :items="item.items"
        :height="item.height"
        :radius="item.radius"
        :primary="props.page.primary"
        @jump="emit('jump', $event)"
      />
      <NoticeBlock
        v-else-if="item.type === 'notice'"
        :text="item.text"
        :tag="item.tag"
        :link="item.link"
        @jump="emit('jump', $event)"
      />
      <NavBlock
        v-else-if="item.type === 'nav'"
        :items="item.items"
        :columns="item.columns"
        @jump="emit('jump', $event)"
      />
      <GoodsBlock
        v-else-if="item.type === 'goods'"
        :items="item.items"
        :title="item.title"
        :columns="item.columns"
        :primary="props.page.primary"
        @jump="emit('jump', $event)"
      />
    </view>
  </view>
  <view v-if="props.page.components.length === 0" class="deco-empty">
    <text class="empty-text">页面还没有装修内容</text>
  </view>
</template>

<script lang="ts" setup>
import type { DecoPage } from './schema'
import BannerBlock from './blocks/BannerBlock.vue'
import NoticeBlock from './blocks/NoticeBlock.vue'
import NavBlock from './blocks/NavBlock.vue'
import GoodsBlock from './blocks/GoodsBlock.vue'

const props = defineProps<{ page: DecoPage }>()
const emit = defineEmits<{ (e: 'jump', link?: string): void }>()
</script>

<style lang="scss" scoped>
.deco-renderer {
  padding: 12px;
}

.deco-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 200px;
}

.empty-text {
  font-size: 13px;
  color: #98a2b3;
}
</style>
