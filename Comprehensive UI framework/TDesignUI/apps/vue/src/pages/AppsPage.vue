<script lang="ts" setup>
import {
  ALL,
  CATEGORY_OPTIONS,
  STATUS_OPTIONS,
  createAppListStore,
  statusLabel,
  statusTheme,
  type AppCategory,
  type AppStatus,
} from '@tdesignui/core';

// 列表状态机来自 core：筛选、分页、统计全部在 core 算完，这里只做渲染
const store = createAppListStore();
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
  <div class="page">
    <header class="hero">
      <h1>应用列表</h1>
      <p>数据、筛选、分页、状态文案全部来自 @tdesignui/core，Vue 只负责渲染</p>
    </header>

    <div class="stack">
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
            <span class="filter-label">分类</span>
            <t-tag
              v-for="item in CATEGORY_OPTIONS"
              :key="item"
              :theme="snapshot.filter.category === item ? 'primary' : 'default'"
              :variant="snapshot.filter.category === item ? 'light' : 'outline'"
              class="pickable"
              @click="pickCategory(item)"
            >
              {{ categoryText(item) }}
            </t-tag>
          </t-space>

          <t-space align="center" size="8px" break-line>
            <span class="filter-label">状态</span>
            <t-tag
              v-for="item in STATUS_OPTIONS"
              :key="item"
              :theme="snapshot.filter.status === item ? 'primary' : 'default'"
              :variant="snapshot.filter.status === item ? 'light' : 'outline'"
              class="pickable"
              @click="pickStatus(item)"
            >
              {{ statusText(item) }}
            </t-tag>
          </t-space>

          <t-space align="center">
            <t-button theme="default" variant="outline" @click="store.reset()">重置条件</t-button>
            <span class="hint">
              当前：{{ snapshot.filter.keyword || '不限关键词' }} ·
              {{ categoryText(snapshot.filter.category) }} · {{ statusText(snapshot.filter.status) }}
            </span>
          </t-space>
        </t-space>
      </t-card>

      <t-card :bordered="true" title="列表">
        <div v-if="snapshot.result.total === 0" class="empty">
          <t-empty description="没有匹配的应用，试试放宽筛选条件" />
        </div>

        <div v-else class="grid">
          <div v-for="row in snapshot.result.rows" :key="row.id" class="item">
            <div class="item-head">
              <span class="item-name">{{ row.name }}</span>
              <t-tag :theme="statusTheme(row.status)" variant="light">
                {{ statusLabel(row.status) }}
              </t-tag>
            </div>
            <div class="item-meta">
              <span>{{ row.id }}</span>
              <span>{{ row.category }}</span>
              <span>负责人 {{ row.owner }}</span>
              <span>更新 {{ row.updatedAt }}</span>
            </div>
          </div>
        </div>

        <t-divider />
        <div class="footer">
          <span class="hint">
            第 {{ snapshot.page }} / {{ snapshot.result.totalPages }} 页，每页 {{ snapshot.pageSize }} 条
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

<style scoped>
.page {
  padding: 12px 0 32px;
}

.hero {
  max-width: 960px;
  margin: 0 auto 24px;
}

.hero h1 {
  margin: 0 0 8px;
  font-size: 24px;
  color: #1f2329;
}

.hero p {
  margin: 0;
  color: #646a73;
  font-size: 14px;
}

.stack {
  max-width: 960px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.filter-label {
  font-size: 13px;
  color: #8f959e;
}

.pickable {
  cursor: pointer;
}

.hint {
  font-size: 13px;
  color: #8f959e;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 12px;
}

.item {
  border: 1px solid #e7e7e7;
  border-radius: 6px;
  padding: 12px 14px;
  background: #fff;
  transition: all 0.2s ease;
}

.item:hover {
  border-color: #0052d9;
  box-shadow: 0 2px 8px rgba(0, 82, 217, 0.12);
}

.item-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}

.item-name {
  font-size: 15px;
  font-weight: 500;
  color: #1f2329;
}

.item-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 12px;
  font-size: 12px;
  color: #8f959e;
}

.empty {
  padding: 24px 0;
}

.footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}
</style>
