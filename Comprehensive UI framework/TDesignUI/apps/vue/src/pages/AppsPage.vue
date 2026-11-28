<script lang="ts" setup>
import {
  ALL,
  CATEGORY_OPTIONS,
  STATUS_OPTIONS,
  appListStore,
  statusLabel,
  statusTheme,
  type AppCategory,
  type AppStatus,
} from '@tdesignui/core';

// 列表状态机来自 core 的共享单例：新建页写入后，这里订阅会立刻收到新快照
const store = appListStore;
const snapshot = ref(store.get());
const stop = store.subscribe((next) => {
  snapshot.value = next;
});
onUnmounted(stop);

const categoryText = (value: string) => (value === ALL ? '全部分类' : value);
const statusText = (value: string) =>
  value === ALL ? '全部状态' : statusLabel(value as AppStatus);

const pickCategory = (value: string) => store.setCategory(value as AppCategory | typeof ALL);
const pickStatus = (value: string) => store.setStatus(value as AppStatus | typeof ALL);

function handleCurrentChange(current: number) {
  store.setPage(current);
}
</script>

<template>
  <div class="tds-page">
    <header class="tds-hero--left">
      <h1>应用列表</h1>
      <p>数据、筛选、分页、状态文案全部来自 @tdesignui/core，Vue 只负责渲染</p>
    </header>

    <div class="tds-stack--wide">
      <t-card :bordered="true" title="概览">
        <t-space align="center" size="16px">
          <t-tag theme="primary" variant="light">共 {{ snapshot.totalItems }} 个应用</t-tag>
          <t-tag theme="success" variant="light">已上线 {{ snapshot.summary.online }}</t-tag>
          <t-tag theme="warning" variant="light">构建中 {{ snapshot.summary.building }}</t-tag>
          <t-tag theme="default" variant="light">已下线 {{ snapshot.summary.offline }}</t-tag>
          <t-tag variant="outline">匹配结果 {{ snapshot.result.total }}</t-tag>
        </t-space>
      </t-card>

      <t-card :bordered="true" title="筛选">
        <t-space direction="vertical" size="16px" style="width: 100%">
          <t-input
            :value="snapshot.filter.keyword"
            placeholder="搜索应用名 / 编号 / 负责人"
            clearable
            @change="store.setKeyword"
          />

          <t-space align="center" size="8px" break-line>
            <span class="tds-filter-label">分类</span>
            <t-tag
              v-for="item in CATEGORY_OPTIONS"
              :key="item"
              :theme="snapshot.filter.category === item ? 'primary' : 'default'"
              :variant="snapshot.filter.category === item ? 'light' : 'outline'"
              class="tds-pickable"
              @click="pickCategory(item)"
            >
              {{ categoryText(item) }}
            </t-tag>
          </t-space>

          <t-space align="center" size="8px" break-line>
            <span class="tds-filter-label">状态</span>
            <t-tag
              v-for="item in STATUS_OPTIONS"
              :key="item"
              :theme="snapshot.filter.status === item ? 'primary' : 'default'"
              :variant="snapshot.filter.status === item ? 'light' : 'outline'"
              class="tds-pickable"
              @click="pickStatus(item)"
            >
              {{ statusText(item) }}
            </t-tag>
          </t-space>

          <t-space align="center">
            <t-button theme="default" variant="outline" @click="store.reset()">重置条件</t-button>
            <span class="tds-hint">
              当前：{{ snapshot.filter.keyword || '不限关键词' }} ·
              {{ categoryText(snapshot.filter.category) }} ·
              {{ statusText(snapshot.filter.status) }}
            </span>
          </t-space>
        </t-space>
      </t-card>

      <t-card :bordered="true" title="列表">
        <div v-if="snapshot.result.total === 0" class="tds-empty">
          <t-empty description="没有匹配的应用，试试放宽筛选条件" />
        </div>

        <div v-else class="tds-grid">
          <div v-for="row in snapshot.result.rows" :key="row.id" class="tds-item">
            <div class="tds-item-head">
              <span class="tds-item-name">{{ row.name }}</span>
              <t-tag :theme="statusTheme(row.status)" variant="light">
                {{ statusLabel(row.status) }}
              </t-tag>
            </div>
            <div class="tds-item-meta">
              <span>{{ row.id }}</span>
              <span>{{ row.category }}</span>
              <span>负责人 {{ row.owner }}</span>
              <span>更新 {{ row.updatedAt }}</span>
            </div>
          </div>
        </div>

        <t-divider />
        <div class="tds-footer">
          <span class="tds-hint">
            第 {{ snapshot.page }} / {{ snapshot.result.totalPages }} 页，每页
            {{ snapshot.pageSize }} 条
          </span>
          <t-pagination
            :current="snapshot.page"
            :total="snapshot.result.total"
            :page-size="snapshot.pageSize"
            @current-change="handleCurrentChange"
          />
        </div>
      </t-card>
    </div>
  </div>
</template>
