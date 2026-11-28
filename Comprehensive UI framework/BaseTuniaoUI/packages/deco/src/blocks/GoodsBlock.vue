<template>
  <view class="deco-goods">
    <view v-if="props.title" class="goods-header">
      <text class="goods-title">{{ props.title }}</text>
    </view>
    <view class="goods-grid">
      <view
        v-for="item in props.items"
        :key="item.id"
        class="goods-card"
        :style="{ width: `${100 / props.columns}%` }"
        @click="emit('jump', item.link)"
      >
        <image v-if="item.cover" class="goods-cover" :src="item.cover" mode="aspectFill" />
        <view v-else class="goods-cover goods-cover-fallback">
          <text class="cover-text">商品图</text>
        </view>
        <view class="goods-body">
          <text class="goods-name">{{ item.name }}</text>
          <view class="goods-footer">
            <text class="goods-price" :style="{ color: props.primary }">¥{{ item.price }}</text>
            <text v-if="item.tag" class="goods-tag">{{ item.tag }}</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script lang="ts" setup>
import type { DecoGoodsItem } from '../schema'

const props = withDefaults(
  defineProps<{
    items: DecoGoodsItem[]
    title?: string
    columns?: number
    primary?: string
  }>(),
  { title: '', columns: 2, primary: '#ff5a5f' }
)

const emit = defineEmits<{ (e: 'jump', link?: string): void }>()
</script>

<style lang="scss" scoped>
.deco-goods {
  padding: 12px;
  background: #ffffff;
  border-radius: 12px;
}

.goods-header {
  margin-bottom: 10px;
}

.goods-title {
  font-size: 15px;
  font-weight: 600;
  color: #1f2733;
}

.goods-grid {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  margin: 0 -4px;
}

.goods-card {
  padding: 0 4px 12px;
  box-sizing: border-box;
}

.goods-cover {
  width: 100%;
  height: 120px;
  border-radius: 8px;
  background: #f4f6fa;
}

.goods-cover-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
}

.cover-text {
  font-size: 12px;
  color: #b3bbc9;
}

.goods-body {
  padding-top: 6px;
}

.goods-name {
  display: block;
  font-size: 13px;
  color: #1f2733;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.goods-footer {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 6px;
  margin-top: 4px;
}

.goods-price {
  font-size: 14px;
  font-weight: 600;
}

.goods-tag {
  padding: 1px 6px;
  border-radius: 4px;
  background: #fff0f0;
  font-size: 10px;
  color: #ff5a5f;
}
</style>
