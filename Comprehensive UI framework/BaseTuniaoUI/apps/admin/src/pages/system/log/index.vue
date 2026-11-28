<script lang="ts" setup>
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useI18n } from 'vue-i18n'
import { logApi } from '@/api/log'
import type { LogItem, StatusValue } from '@/api/types'
import type { TableColumn } from '@/components/ui/types'
import { useTableList } from '@/hooks/useTableList'
import { useUserStore } from '@/store/modules/user'
import AppLayout from '@/components/layout/AppLayout.vue'
import AppCard from '@/components/ui/AppCard.vue'
import AppInput from '@/components/ui/AppInput.vue'
import AppSelect from '@/components/ui/AppSelect.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppTable from '@/components/ui/AppTable.vue'
import AppPagination from '@/components/ui/AppPagination.vue'
import AppDialog from '@/components/ui/AppDialog.vue'
import AppTag from '@/components/ui/AppTag.vue'
import AppIcon from '@/components/ui/AppIcon.vue'

const user = useUserStore()
const { t } = useI18n()

const statusOptions = [
  { label: t('log.anyResult'), value: '' },
  { label: t('log.success'), value: 1 },
  { label: t('log.fail'), value: 0 },
]

const query = ref<{ keyword: string; status: StatusValue | '' }>({ keyword: '', status: '' })

const { list, total, loading, pageNum, pageSize, load, search, changePage } = useTableList<LogItem>(
  (params) =>
    logApi.page({
      pageNum: params.pageNum,
      pageSize: params.pageSize,
      keyword: query.value.keyword,
      status: query.value.status,
    })
)

const columns: TableColumn[] = [
  { key: 'username', title: t('log.colUser'), width: 120 },
  { key: 'module', title: t('log.colModule'), width: 120 },
  { key: 'action', title: t('log.colAction'), width: 90 },
  { key: 'method', title: t('log.colMethod'), width: 110, align: 'center', card: false },
  { key: 'status', title: t('log.colResult'), width: 80, align: 'center' },
  { key: 'costMs', title: t('log.colCost'), width: 80, align: 'right', card: false },
  { key: 'ip', title: 'IP', width: 140, card: false },
  { key: 'createTime', title: t('log.colTime'), width: 160 },
  { key: 'actions', title: t('common.actions'), width: 90, align: 'right' },
]

const methodTag = (method: string): 'primary' | 'success' | 'warning' | 'danger' => {
  if (method === 'GET') return 'success'
  if (method === 'POST') return 'primary'
  if (method === 'PUT') return 'warning'
  return 'danger'
}

const resetQuery = () => {
  query.value.keyword = ''
  query.value.status = ''
  search()
}

/* ------------------------------- 详情 ------------------------------- */

const detailVisible = ref(false)
const detail = ref<LogItem | null>(null)

const openDetail = (row: LogItem) => {
  detail.value = row
  detailVisible.value = true
}

const detailRows = computed(() => {
  if (!detail.value) return []
  return [
    { label: t('log.colUser'), value: detail.value.username },
    { label: t('log.colModule'), value: detail.value.module },
    { label: t('log.colAction'), value: detail.value.action },
    { label: t('log.colMethod'), value: detail.value.method },
    { label: 'IP', value: detail.value.ip },
    { label: t('log.colCost'), value: `${detail.value.costMs} ms` },
    {
      label: t('log.colResult'),
      value: detail.value.status === 1 ? t('log.success') : t('log.fail'),
    },
    { label: t('log.colTime'), value: detail.value.createTime },
  ]
})

const clearLogs = () => {
  uni.showModal({
    title: t('log.clearTitle'),
    content: t('log.clearContent'),
    confirmColor: '#f5455c',
    success: async (res) => {
      if (!res.confirm) return
      await logApi.clear()
      uni.showToast({ title: t('log.cleared'), icon: 'success' })
      search()
    },
  })
}

onLoad(() => {
  load()
})
</script>

<template>
  <app-layout
    :title="t('log.title')"
    :breadcrumb="[t('common.system'), t('log.title')]"
    :subtitle="t('log.subtitle')"
  >
    <template #actions>
      <app-button
        v-if="user.hasPerm('system:log:list')"
        type="default"
        icon="delete"
        @click="clearLogs"
      >
        {{ t('log.clear') }}
      </app-button>
    </template>

    <app-card padding="14">
      <view class="toolbar">
        <view class="toolbar-left">
          <app-input
            v-model="query.keyword"
            :placeholder="t('log.keyword')"
            prefix-icon="search"
            clearable
            class="toolbar-input"
            @confirm="search"
          />
          <app-select
            v-model="query.status"
            :options="statusOptions"
            :placeholder="t('log.anyResult')"
            class="toolbar-select"
            @change="search"
          />
          <app-button icon="search" @click="search">{{ t('common.query') }}</app-button>
          <app-button type="default" @click="resetQuery">{{ t('common.reset') }}</app-button>
        </view>
        <text class="toolbar-tip">{{ t('log.countTip', { count: total }) }}</text>
      </view>
    </app-card>

    <app-card padding="0 0 14px">
      <app-table :columns="columns" :data="list" :loading="loading" :empty-text="t('log.empty')">
        <template #cell-username="{ row }">
          <text class="strong-text">{{ row.username }}</text>
        </template>

        <template #cell-method="{ row }">
          <app-tag :type="methodTag(row.method)" size="sm">{{ row.method }}</app-tag>
        </template>

        <template #cell-status="{ row }">
          <app-tag :type="row.status === 1 ? 'success' : 'danger'" size="sm">
            {{ row.status === 1 ? t('log.success') : t('log.fail') }}
          </app-tag>
        </template>

        <template #cell-costMs="{ row }">
          <text class="mono-text">{{ row.costMs }}ms</text>
        </template>

        <template #cell-actions="{ row }">
          <view class="action-cell">
            <app-button type="text" size="sm" @click="openDetail(row)">
              {{ t('log.detail') }}
            </app-button>
          </view>
        </template>
      </app-table>

      <view class="table-footer">
        <app-pagination
          :total="total"
          :page-num="pageNum"
          :page-size="pageSize"
          @change="changePage"
        />
      </view>
    </app-card>

    <app-dialog
      v-model:visible="detailVisible"
      :title="t('log.detailTitle')"
      :width="600"
      :show-footer="true"
      :cancel-text="t('log.close')"
      :confirm-text="t('log.gotIt')"
    >
      <view v-if="detail" class="detail-wrap">
        <view class="detail-grid">
          <view v-for="item in detailRows" :key="item.label" class="detail-item">
            <text class="detail-label">{{ item.label }}</text>
            <text class="detail-value">{{ item.value }}</text>
          </view>
        </view>

        <view class="detail-block">
          <text class="detail-label">{{ t('log.params') }}</text>
          <view class="code-block">
            <text class="code-text">{{ detail.params }}</text>
          </view>
        </view>

        <view v-if="detail.status === 0" class="fail-tip">
          <app-icon name="warning" :size="13" color="#f5455c" />
          <text class="fail-text">{{ t('log.failTip') }}</text>
        </view>
      </view>
    </app-dialog>
  </app-layout>
</template>

<style lang="scss" scoped>
.toolbar {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.toolbar-left {
  flex-direction: row;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  flex: 1;
}

.toolbar-input {
  width: 240px;
}

.toolbar-select {
  width: 130px;
}

.toolbar-tip {
  font-size: var(--app-font-xs);
  color: var(--app-text-3);
}

.strong-text {
  font-size: var(--app-font);
  color: var(--app-text);
  font-weight: 500;
}

.mono-text {
  font-size: var(--app-font-sm);
  color: var(--app-text-3);
  font-family: Menlo, Consolas, monospace;
}

.action-cell {
  flex-direction: row;
  align-items: center;
  justify-content: flex-end;
}

.table-footer {
  padding: 0 16px;
}

/* 详情 */
.detail-wrap {
  gap: 14px;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px 18px;
}

.detail-item {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  padding: 6px 0;
  border-bottom: 1px dashed var(--app-border-2);
  gap: 10px;
}

.detail-label {
  font-size: var(--app-font-sm);
  color: var(--app-text-3);
  flex: none;
}

.detail-value {
  font-size: var(--app-font-sm);
  color: var(--app-text-2);
  text-align: right;
}

.detail-block {
  gap: 6px;
}

.code-block {
  background: #f7f9fc;
  border: 1px solid var(--app-border-2);
  border-radius: var(--app-radius-sm);
  padding: 10px 12px;
}

.code-text {
  font-size: var(--app-font-sm);
  color: var(--app-text-2);
  font-family: Menlo, Consolas, monospace;
  line-height: 1.6;
  word-break: break-all;
}

.fail-tip {
  flex-direction: row;
  align-items: center;
  gap: 6px;
  padding: 8px 10px;
  border-radius: var(--app-radius-sm);
  background: var(--app-danger-weak);
}

.fail-text {
  font-size: var(--app-font-sm);
  color: var(--app-danger);
  flex: 1;
}

@media (max-width: 767px) {
  .toolbar-input,
  .toolbar-select {
    width: 100%;
  }
  .table-footer {
    padding: 0;
  }
  .detail-grid {
    grid-template-columns: 1fr;
  }
}
</style>
