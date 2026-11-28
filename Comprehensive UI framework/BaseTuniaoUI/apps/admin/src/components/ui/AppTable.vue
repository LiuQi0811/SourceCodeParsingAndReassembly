<script lang="ts" setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAppStore } from '@/store/modules/app'
import AppEmpty from './AppEmpty.vue'
import type { TableColumn } from './types'

const props = withDefaults(
  defineProps<{
    columns: TableColumn[]
    data: Array<Record<string, any>>
    rowKey?: string
    loading?: boolean
    emptyText?: string
  }>(),
  {
    rowKey: 'id',
    loading: false,
    emptyText: '',
  }
)

/**
 * 单元格插槽约定：cell-{key}，作用域为 { row, value, index }
 * row 用 any 而不是 Record<string,any>，页面里才能把 row 直接传给强类型方法
 */
defineSlots<{
  [name: `cell-${string}`]: (props: { row: any; value?: any; index: number }) => any
}>()

const { t } = useI18n()
const app = useAppStore()
const emptyTextValue = computed(() => props.emptyText || t('common.noData'))
const isMobile = computed(() => app.isMobile)

const showSkeleton = computed(() => props.loading && props.data.length === 0)
const cardColumns = computed(() =>
  props.columns.filter((col) => col.key !== 'actions' && col.card !== false)
)
const hasActions = computed(() => props.columns.some((col) => col.key === 'actions'))

const cellStyle = (column: TableColumn) => {
  if (column.width) {
    const width = typeof column.width === 'number' ? `${column.width}px` : column.width
    return { width, flex: 'none' }
  }
  return { flex: '1' }
}

const formatCell = (value: unknown): string => {
  if (value === null || value === undefined || value === '') return '-'
  if (Array.isArray(value)) return value.length ? value.join('、') : '-'
  if (typeof value === 'boolean') return value ? t('common.yes') : t('common.no')
  return String(value)
}
</script>

<template>
  <view class="app-table">
    <!-- 桌面端：表格式 -->
    <view v-if="!isMobile" class="table-wrap">
      <view class="table-head">
        <view
          v-for="column in columns"
          :key="column.key"
          class="th"
          :class="`align-${column.align || 'left'}`"
          :style="cellStyle(column)"
        >
          <text>{{ column.title }}</text>
        </view>
      </view>

      <view v-if="showSkeleton" class="table-body">
        <view v-for="i in 5" :key="i" class="table-row">
          <view v-for="column in columns" :key="column.key" class="td" :style="cellStyle(column)">
            <view class="sk-bar" />
          </view>
        </view>
      </view>

      <view v-else-if="!data.length" class="table-empty">
        <app-empty :text="emptyTextValue" />
      </view>

      <view v-else class="table-body" :class="{ 'is-loading': loading }">
        <view
          v-for="(row, index) in data"
          :key="row[rowKey] ?? index"
          class="table-row"
          hover-class="table-row--hover"
        >
          <view
            v-for="column in columns"
            :key="column.key"
            class="td"
            :class="`align-${column.align || 'left'}`"
            :style="cellStyle(column)"
          >
            <slot :name="`cell-${column.key}`" :row="row" :value="row[column.key]" :index="index">
              <text class="cell-text" :class="{ 'is-ellipsis': column.ellipsis !== false }">
                {{ formatCell(row[column.key]) }}
              </text>
            </slot>
          </view>
        </view>
      </view>
    </view>

    <!-- 移动端：卡片式 -->
    <view v-else class="table-cards">
      <view v-if="showSkeleton" class="card-skeleton">
        <view v-for="i in 3" :key="i" class="data-card">
          <view class="sk-line" />
          <view class="sk-line short" />
        </view>
      </view>

      <app-empty v-else-if="!data.length" :text="emptyTextValue" />

      <template v-else>
        <view v-for="(row, index) in data" :key="row[rowKey] ?? index" class="data-card">
          <view v-for="column in cardColumns" :key="column.key" class="data-line">
            <text class="line-label">{{ column.title }}</text>
            <view class="line-value">
              <slot :name="`cell-${column.key}`" :row="row" :value="row[column.key]" :index="index">
                <text class="cell-text">{{ formatCell(row[column.key]) }}</text>
              </slot>
            </view>
          </view>

          <view v-if="hasActions" class="card-actions">
            <slot name="cell-actions" :row="row" :index="index" />
          </view>
        </view>
      </template>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.app-table {
  width: 100%;
}

.table-wrap {
  width: 100%;
  border: 1px solid var(--app-border-2);
  border-radius: var(--app-radius);
  overflow: hidden;
  background: var(--app-card);
}

.table-head {
  flex-direction: row;
  align-items: center;
  background: #f8fafc;
  border-bottom: 1px solid var(--app-border-2);
  min-height: 44px;
}

.th {
  padding: 0 14px;
  font-size: var(--app-font-sm);
  font-weight: 600;
  color: var(--app-text-2);
  justify-content: center;
  flex-direction: row;
  align-items: center;
}

.table-row {
  flex-direction: row;
  align-items: center;
  min-height: 52px;
  border-bottom: 1px solid var(--app-border-2);
  height: auto;
}

.table-row:last-child {
  border-bottom: none;
}

.table-row--hover {
  background: #f7fbff;
}

.table-body.is-loading {
  opacity: 0.6;
}

.td {
  padding: 10px 14px;
  flex-direction: row;
  align-items: center;
  min-width: 0;
}

.cell-text {
  font-size: var(--app-font);
  color: var(--app-text-2);
  line-height: 1.5;
}

.is-ellipsis {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.align-left {
  justify-content: flex-start;
}
.align-center {
  justify-content: center;
}
.align-right {
  justify-content: flex-end;
}
.th.align-left,
.th.align-center,
.th.align-right {
  justify-content: flex-start;
}
.th.align-center {
  justify-content: center;
}
.th.align-right {
  justify-content: flex-end;
}

.table-empty {
  padding: 34px 0;
  align-items: center;
}

/* 骨架屏 */
.sk-bar {
  height: 12px;
  width: 70%;
  border-radius: 6px;
  background: linear-gradient(90deg, #f0f3f7 25%, #e6ebf2 37%, #f0f3f7 63%);
  background-size: 400% 100%;
  animation: sk-shine 1.4s ease infinite;
}

@keyframes sk-shine {
  0% {
    background-position: 100% 50%;
  }
  100% {
    background-position: 0 50%;
  }
}

/* 移动端卡片 */
.table-cards {
  gap: 12px;
}

.data-card {
  background: var(--app-card);
  border-radius: var(--app-radius);
  padding: 14px;
  box-shadow: var(--app-shadow);
  gap: 8px;
}

.data-line {
  flex-direction: row;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.line-label {
  font-size: var(--app-font-sm);
  color: var(--app-text-3);
  flex: none;
  width: 84px;
}

.line-value {
  flex: 1;
  flex-direction: row;
  align-items: center;
  justify-content: flex-end;
  min-width: 0;
}

.card-actions {
  flex-direction: row;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
  padding-top: 10px;
  margin-top: 4px;
  border-top: 1px dashed var(--app-border);
}

.sk-line {
  height: 12px;
  border-radius: 6px;
  background: #eff2f7;
  margin-bottom: 8px;
}
.sk-line.short {
  width: 40%;
}
</style>
