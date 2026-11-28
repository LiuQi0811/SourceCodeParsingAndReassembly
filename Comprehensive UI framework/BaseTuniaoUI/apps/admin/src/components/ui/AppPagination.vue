<script lang="ts" setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAppStore } from '@/store/modules/app'
import AppIcon from './AppIcon.vue'

const props = withDefaults(
  defineProps<{
    total: number
    pageNum: number
    pageSize: number
    showTotal?: boolean
  }>(),
  {
    showTotal: true,
  }
)

const emit = defineEmits<{
  (e: 'change', page: number): void
}>()

const app = useAppStore()
const { t } = useI18n()
const isMobile = computed(() => app.isMobile)

const pageCount = computed(() => Math.max(1, Math.ceil(props.total / props.pageSize)))

/** 页码窗口：超过 7 页时中间用省略号 */
const pageList = computed<Array<number | string>>(() => {
  const count = pageCount.value
  const current = props.pageNum
  if (count <= 7) return Array.from({ length: count }, (_, i) => i + 1)
  if (current <= 4) return [1, 2, 3, 4, 5, '...', count]
  if (current >= count - 3) return [1, '...', count - 4, count - 3, count - 2, count - 1, count]
  return [1, '...', current - 1, current, current + 1, '...', count]
})

const go = (page: number) => {
  if (page < 1 || page > pageCount.value) return
  if (page === props.pageNum) return
  emit('change', page)
}
</script>

<template>
  <view class="app-pagination">
    <text v-if="showTotal && !isMobile" class="page-total">
      {{ t('common.total', { total }) }}
    </text>

    <view class="page-controls">
      <view class="page-btn" :class="{ 'is-disabled': pageNum <= 1 }" @tap="go(pageNum - 1)">
        <app-icon name="left" :size="13" color="#8a94a6" />
      </view>

      <template v-if="!isMobile">
        <view
          v-for="(page, index) in pageList"
          :key="String(page) + index"
          class="page-num"
          :class="{ 'is-active': page === pageNum, 'is-dots': page === '...' }"
          @tap="typeof page === 'number' && go(page)"
        >
          <text>{{ page }}</text>
        </view>
      </template>

      <text v-else class="page-simple">{{ pageNum }} / {{ pageCount }}</text>

      <view
        class="page-btn"
        :class="{ 'is-disabled': pageNum >= pageCount }"
        @tap="go(pageNum + 1)"
      >
        <app-icon name="right" :size="13" color="#8a94a6" />
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.app-pagination {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  padding-top: 14px;
}

.page-total {
  font-size: var(--app-font-sm);
  color: var(--app-text-3);
}

.page-controls {
  flex-direction: row;
  align-items: center;
  gap: 6px;
}

.page-btn {
  width: 30px;
  height: 30px;
  border-radius: var(--app-radius-sm);
  border: 1px solid var(--app-border);
  background: var(--app-card);
  align-items: center;
  justify-content: center;
}

.page-btn.is-disabled {
  opacity: 0.45;
}

.page-num {
  min-width: 30px;
  height: 30px;
  padding: 0 6px;
  border-radius: var(--app-radius-sm);
  border: 1px solid var(--app-border);
  background: var(--app-card);
  align-items: center;
  justify-content: center;
  font-size: var(--app-font-sm);
  color: var(--app-text-2);
}

.page-num.is-active {
  border-color: var(--app-primary);
  background: var(--app-primary);
  color: #fff;
  font-weight: 500;
}

.page-num.is-dots {
  border-color: transparent;
  background: transparent;
}

.page-simple {
  font-size: var(--app-font-sm);
  color: var(--app-text-2);
  padding: 0 8px;
}
</style>
