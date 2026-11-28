<script lang="ts" setup>
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useI18n } from 'vue-i18n'
import { appConfig } from '@/config'
import { dashboardApi } from '@/api/dashboard'
import type { DashboardSummary, LogItem } from '@/api/types'
import { useUserStore } from '@/store/modules/user'
import { navigateTo } from '@/utils/navigate'
import AppLayout from '@/components/layout/AppLayout.vue'
import AppCard from '@/components/ui/AppCard.vue'
import AppIcon from '@/components/ui/AppIcon.vue'

const user = useUserStore()
const { t, locale } = useI18n()

const loading = ref(true)
const summary = ref<DashboardSummary | null>(null)

const today = computed(() => {
  const date = new Date()
  if (locale.value === 'en-US') {
    const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    return `${weekdays[date.getDay()]}, ${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`
  }
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  return `${date.getFullYear()} 年 ${date.getMonth() + 1} 月 ${date.getDate()} 日 ${weekdays[date.getDay()]}`
})

const kpis = computed(() => [
  {
    key: 'user',
    label: t('home.userTotal'),
    value: summary.value?.userTotal ?? 0,
    icon: 'my',
    color: 'var(--app-primary)',
    bg: 'var(--app-primary-weak)',
    tip: t('home.userTotalTip'),
  },
  {
    key: 'role',
    label: t('home.roleTotal'),
    value: summary.value?.roleTotal ?? 0,
    icon: 'group-circle',
    color: '#18a566',
    bg: 'rgba(24,181,102,0.12)',
    tip: t('home.roleTotalTip'),
  },
  {
    key: 'login',
    label: t('home.todayLogin'),
    value: summary.value?.todayLogin ?? 0,
    icon: 'login',
    color: '#ff9500',
    bg: 'rgba(255,149,0,0.12)',
    tip: t('home.todayLoginTip'),
  },
  {
    key: 'log',
    label: t('home.logTotal'),
    value: summary.value?.logTotal ?? 0,
    icon: 'record',
    color: '#7c6cf5',
    bg: 'rgba(124,108,245,0.12)',
    tip: t('home.logTotalTip'),
  },
])

const trend = computed(() => summary.value?.trend || [])
const maxTrend = computed(() => Math.max(1, ...trend.value.map((item) => item.value)))

const barHeight = (value: number): string => `${Math.round((value / maxTrend.value) * 100)}%`

const quickEntries = computed(() => [
  {
    label: t('home.userEntry'),
    desc: t('home.userEntryDesc'),
    icon: 'my',
    path: '/pages/system/user/index',
    perm: 'system:user:list',
    color: '#01beff',
  },
  {
    label: t('home.roleEntry'),
    desc: t('home.roleEntryDesc'),
    icon: 'group-circle',
    path: '/pages/system/role/index',
    perm: 'system:role:list',
    color: '#18a566',
  },
  {
    label: t('home.menuEntry'),
    desc: t('home.menuEntryDesc'),
    icon: 'menu-list',
    path: '/pages/system/menu/index',
    perm: 'system:menu:list',
    color: '#ff9500',
  },
  {
    label: t('home.logEntry'),
    desc: t('home.logEntryDesc'),
    icon: 'record',
    path: '/pages/system/log/index',
    perm: 'system:log:list',
    color: '#7c6cf5',
  },
])

const visibleEntries = computed(() => quickEntries.value.filter((item) => user.hasPerm(item.perm)))

const recent = computed<LogItem[]>(() => summary.value?.recent || [])

const dataSource = computed(() => (appConfig.useMock ? t('home.mockSource') : appConfig.baseURL))

const loadSummary = async () => {
  loading.value = true
  try {
    summary.value = await dashboardApi.summary()
  } finally {
    loading.value = false
  }
}

onLoad(() => {
  loadSummary()
})
</script>

<template>
  <app-layout
    :title="t('home.title')"
    :breadcrumb="[t('home.title')]"
    :subtitle="t('home.subtitle')"
  >
    <!-- KPI -->
    <view class="kpi-grid">
      <view v-for="item in kpis" :key="item.key" class="kpi-card">
        <view class="kpi-icon" :style="{ background: item.bg }">
          <app-icon :name="item.icon" :size="20" :color="item.color" />
        </view>
        <view class="kpi-body">
          <text class="kpi-label">{{ item.label }}</text>
          <text class="kpi-value">{{ loading ? '--' : item.value }}</text>
          <text class="kpi-tip">{{ item.tip }}</text>
        </view>
      </view>
    </view>

    <view class="main-grid">
      <!-- 趋势 -->
      <app-card :title="t('home.trendTitle')" :subtitle="t('home.trendSubtitle')">
        <view v-if="loading" class="chart-skeleton">
          <view v-for="i in 7" :key="i" class="sk-column" />
        </view>
        <view v-else class="chart">
          <view v-for="item in trend" :key="item.label" class="chart-col">
            <text class="chart-value">{{ item.value }}</text>
            <view class="chart-track">
              <view class="chart-bar" :style="{ height: barHeight(item.value) }" />
            </view>
            <text class="chart-label">{{ item.label }}</text>
          </view>
        </view>
      </app-card>

      <!-- 快捷入口 -->
      <app-card :title="t('home.quickTitle')" :subtitle="t('home.quickSubtitle')">
        <view class="entry-grid">
          <view
            v-for="entry in visibleEntries"
            :key="entry.path"
            class="entry-item"
            @tap="navigateTo(entry.path)"
          >
            <view class="entry-icon" :style="{ color: entry.color }">
              <app-icon :name="entry.icon" :size="19" :color="entry.color" />
            </view>
            <view class="entry-meta">
              <text class="entry-label">{{ entry.label }}</text>
              <text class="entry-desc">{{ entry.desc }}</text>
            </view>
          </view>
          <view v-if="!visibleEntries.length" class="entry-empty">
            <text>{{ t('home.quickEmpty') }}</text>
          </view>
        </view>
      </app-card>
    </view>

    <!-- 最近操作 -->
    <app-card :title="t('home.recentTitle')" :subtitle="t('home.recentSubtitle')">
      <view v-if="loading" class="log-skeleton">
        <view v-for="i in 4" :key="i" class="sk-row" />
      </view>
      <view v-else-if="!recent.length" class="log-empty">
        <text>{{ t('home.recentEmpty') }}</text>
      </view>
      <view v-else class="recent-list">
        <view v-for="item in recent" :key="item.id" class="recent-item">
          <view class="recent-avatar">{{ item.username.slice(0, 1).toUpperCase() }}</view>
          <view class="recent-main">
            <text class="recent-title">
              {{
                t('home.recentDone', {
                  username: item.username,
                  module: item.module,
                  action: item.action,
                })
              }}
            </text>
            <text class="recent-sub">
              {{ item.ip }} · {{ item.createTime }} · {{ item.costMs }}ms
            </text>
          </view>
          <view class="recent-status" :class="item.status === 1 ? 'is-ok' : 'is-fail'">
            {{ item.status === 1 ? t('home.success') : t('home.fail') }}
          </view>
        </view>
      </view>
    </app-card>

    <!-- 系统信息 -->
    <app-card :title="t('home.infoTitle')" :subtitle="t('home.infoSubtitle')">
      <view class="info-grid">
        <view class="info-row">
          <text class="info-label">{{ t('home.infoName') }}</text>
          <text class="info-value">{{ appConfig.appName }}</text>
        </view>
        <view class="info-row">
          <text class="info-label">{{ t('home.infoStack') }}</text>
          <text class="info-value">uni-app 3 + Vue 3.4 + TypeScript</text>
        </view>
        <view class="info-row">
          <text class="info-label">{{ t('home.infoUi') }}</text>
          <text class="info-value">图鸟 TuniaoUI 1.0.23</text>
        </view>
        <view class="info-row">
          <text class="info-label">{{ t('home.infoSource') }}</text>
          <text class="info-value">{{ dataSource }}</text>
        </view>
        <view class="info-row">
          <text class="info-label">{{ t('home.infoAccount') }}</text>
          <text class="info-value">{{ user.nickname }} · {{ user.roleNames }}</text>
        </view>
        <view class="info-row">
          <text class="info-label">{{ t('home.serverTime') }}</text>
          <text class="info-value">{{ today }}</text>
        </view>
      </view>
    </app-card>
  </app-layout>
</template>

<style lang="scss" scoped>
/* KPI */
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
}

.kpi-card {
  flex-direction: row;
  align-items: center;
  gap: 14px;
  background: var(--app-card);
  border-radius: var(--app-radius);
  padding: 18px 16px;
  box-shadow: var(--app-shadow);
}

.kpi-icon {
  width: 46px;
  height: 46px;
  border-radius: 12px;
  align-items: center;
  justify-content: center;
  flex: none;
}

.kpi-body {
  gap: 2px;
  min-width: 0;
}

.kpi-label {
  font-size: var(--app-font-sm);
  color: var(--app-text-3);
}

.kpi-value {
  font-size: 26px;
  font-weight: 700;
  color: var(--app-text);
  line-height: 1.2;
}

.kpi-tip {
  font-size: 11px;
  color: var(--app-text-3);
}

/* 主区域 */
.main-grid {
  display: grid;
  grid-template-columns: 1.6fr 1fr;
  gap: 16px;
  align-items: stretch;
}

/* 趋势图 */
.chart {
  flex-direction: row;
  align-items: flex-end;
  gap: 10px;
  height: 190px;
  padding-top: 8px;
}

.chart-col {
  flex: 1;
  align-items: center;
  height: 100%;
  justify-content: flex-end;
  gap: 6px;
}

.chart-value {
  font-size: var(--app-font-xs);
  color: var(--app-text-2);
}

.chart-track {
  flex: 1;
  width: 100%;
  max-width: 34px;
  background: var(--app-bg-2);
  border-radius: 6px;
  justify-content: flex-end;
  overflow: hidden;
}

.chart-bar {
  width: 100%;
  min-height: 6px;
  border-radius: 6px;
  background: linear-gradient(180deg, var(--app-primary-hover), var(--app-primary));
  transition: height 0.4s ease;
}

.chart-label {
  font-size: 11px;
  color: var(--app-text-3);
}

.chart-skeleton {
  flex-direction: row;
  align-items: flex-end;
  gap: 10px;
  height: 190px;
}

.sk-column {
  flex: 1;
  height: 60%;
  border-radius: 6px;
  background: var(--app-bg-2);
  animation: sk-pulse 1.4s ease infinite;
}

/* 快捷入口 */
.entry-grid {
  gap: 10px;
}

.entry-item {
  flex-direction: row;
  align-items: center;
  gap: 12px;
  padding: 11px 12px;
  border-radius: var(--app-radius-sm);
  border: 1px solid var(--app-border-2);
  background: var(--app-card);
}

.entry-item:hover {
  border-color: rgba(var(--app-primary-rgb), 0.4);
  background: var(--app-primary-weak-2);
}

.entry-icon {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: var(--app-card);
  align-items: center;
  justify-content: center;
  flex: none;
  border: 1px solid var(--app-border-2);
}

.entry-meta {
  gap: 2px;
}

.entry-label {
  font-size: var(--app-font);
  color: var(--app-text);
  font-weight: 500;
}

.entry-desc {
  font-size: 11px;
  color: var(--app-text-3);
}

.entry-empty {
  padding: 24px 0;
  align-items: center;
  font-size: var(--app-font-sm);
  color: var(--app-text-3);
}

/* 最近操作 */
.recent-list {
  gap: 2px;
}

.recent-item {
  flex-direction: row;
  align-items: center;
  gap: 12px;
  padding: 10px 4px;
  border-bottom: 1px solid var(--app-border-2);
}

.recent-item:last-child {
  border-bottom: none;
}

.recent-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--app-primary-weak);
  color: var(--app-primary);
  font-size: var(--app-font-sm);
  font-weight: 600;
  align-items: center;
  justify-content: center;
  flex: none;
}

.recent-main {
  flex: 1;
  min-width: 0;
  gap: 2px;
}

.recent-title {
  font-size: var(--app-font);
  color: var(--app-text-2);
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.recent-sub {
  font-size: 11px;
  color: var(--app-text-3);
}

.recent-status {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 4px;
  flex: none;
}

.is-ok {
  color: var(--app-success);
  background: var(--app-success-weak);
}

.is-fail {
  color: var(--app-danger);
  background: var(--app-danger-weak);
}

.log-skeleton {
  gap: 12px;
}

.sk-row {
  height: 36px;
  border-radius: 8px;
  background: var(--app-bg-2);
  animation: sk-pulse 1.4s ease infinite;
}

.log-empty {
  padding: 26px 0;
  align-items: center;
  color: var(--app-text-3);
  font-size: var(--app-font-sm);
}

/* 系统信息 */
.info-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px 24px;
}

.info-row {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px dashed var(--app-border-2);
  gap: 12px;
}

.info-label {
  font-size: var(--app-font-sm);
  color: var(--app-text-3);
  flex: none;
}

.info-value {
  font-size: var(--app-font-sm);
  color: var(--app-text-2);
  text-align: right;
  flex: 1;
}

@keyframes sk-pulse {
  50% {
    opacity: 0.5;
  }
}

/* 响应式 */
@media (max-width: 1199px) {
  .kpi-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  .main-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 767px) {
  .kpi-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 10px;
  }
  .kpi-card {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
    padding: 14px;
  }
  .kpi-icon {
    width: 38px;
    height: 38px;
  }
  .kpi-value {
    font-size: 22px;
  }
  .info-grid {
    grid-template-columns: 1fr;
  }
  .chart {
    height: 160px;
    gap: 6px;
  }
}
</style>
