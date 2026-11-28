<script lang="ts" setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { resetMockData } from '@/mock/db'
import {
  ACCENTS,
  useAppStore,
  type AccentKey,
  type DensityMode,
  type RadiusMode,
  type ThemeMode,
} from '@/store/modules/app'
import { useUserStore } from '@/store/modules/user'
import { currentRoute } from '@/utils/navigate'
import { getLocale, LOCALES, setLocale, type LocaleKey } from '@/locales'
import SideMenu from './SideMenu.vue'
import AppIcon from '@/components/ui/AppIcon.vue'

const props = withDefaults(
  defineProps<{
    /** 页面标题，同时用于移动端顶部栏 */
    title?: string
    /** 面包屑，如 ['系统管理', '用户管理'] */
    breadcrumb?: string[]
    subtitle?: string
  }>(),
  {
    title: '',
    breadcrumb: () => [],
    subtitle: '',
  }
)

const app = useAppStore()
const user = useUserStore()
const { t } = useI18n()

const ready = ref(false)
const denied = ref(false)
const userMenuVisible = ref(false)
const themeVisible = ref(false)
const languageVisible = ref(false)
const locale = ref<LocaleKey>(getLocale())
const localeOptions = LOCALES.map((item) => ({ label: item.label, value: item.key }))

/** 启动时补拉 profile 只做一次，避免每次翻页都多一个请求 */
let profileSynced = false

const themeOptions = computed<{ label: string; value: ThemeMode }[]>(() => [
  { label: t('layout.light'), value: 'light' },
  { label: t('layout.dark'), value: 'dark' },
])

const densityOptions = computed<{ label: string; value: DensityMode }[]>(() => [
  { label: t('layout.densityNormal'), value: 'normal' },
  { label: t('layout.densityCompact'), value: 'compact' },
])

const radiusOptions = computed<{ label: string; value: RadiusMode }[]>(() => [
  { label: t('layout.radiusSmall'), value: 'small' },
  { label: t('layout.radiusDefault'), value: 'default' },
  { label: t('layout.radiusLarge'), value: 'large' },
])

/** 品牌色的展示名走语言包，色值仍来自 ACCENTS */
const accentName = (key: AccentKey): string => {
  const map: Record<AccentKey, string> = {
    sky: 'layout.accentSky',
    green: 'layout.accentGreen',
    violet: 'layout.accentViolet',
    orange: 'layout.accentOrange',
  }
  return t(map[key])
}

const openThemePanel = () => {
  userMenuVisible.value = false
  themeVisible.value = true
}

const openLanguagePanel = () => {
  userMenuVisible.value = false
  locale.value = getLocale()
  languageVisible.value = true
}

const onLocaleChange = (value: string | number) => {
  locale.value = value as LocaleKey
}

/** 语言切换后重开当前页，保证所有已渲染文案一次性换成新语言 */
const applyLocale = async () => {
  languageVisible.value = false
  setLocale(locale.value)
  // 菜单名、角色名等业务数据来自 profile，登录时按当时的语言落过盘，这里要按新语言重新拉一次
  await user.refreshProfile()
  uni.reLaunch({ url: currentRoute() })
}

const onThemeChange = (value: string | number) => {
  app.setTheme(value as ThemeMode)
}

const onAccentChange = (key: AccentKey) => {
  app.setAccent(key)
}

const onDensityChange = (value: string | number) => {
  app.setDensity(value as DensityMode)
}

const onRadiusChange = (value: string | number) => {
  app.setRadius(value as RadiusMode)
}

/** uni.showModal 只接受真实色值，这里按当前品牌色取值 */
const accentColor = computed(
  () => ACCENTS.find((item) => item.key === app.accent)?.color || '#01beff'
)

const isMobile = computed(() => app.isMobile)

const homeBreadcrumb = computed(() =>
  props.breadcrumb.length ? props.breadcrumb : [props.title || t('home.title')]
)

const bootstrap = async () => {
  app.initResponsive()

  if (!user.isLogin) {
    uni.reLaunch({ url: '/pages/login/index' })
    return
  }

  if (!user.profile) {
    try {
      await user.fetchProfile()
    } catch (e) {
      uni.reLaunch({ url: '/pages/login/index' })
      return
    }
  } else if (!profileSynced) {
    // 本地缓存的 profile 可能是旧菜单/旧权限（比如 Mock 种子新增了菜单），启动时静默补拉一次
    profileSynced = true
    try {
      await user.refreshProfile(true)
    } catch (e) {
      // 拉取失败就继续用缓存，不影响进入页面
    }
  }

  denied.value = !user.hasPage(currentRoute())
  ready.value = true
}

// 权限在运行中被刷新（如当前账号所属角色刚被重新授权）时，实时重算当前页是否可见
watch(
  () => [user.menus, user.perms],
  () => {
    if (!ready.value || !user.profile) return
    denied.value = !user.hasPage(currentRoute())
  },
  { deep: true }
)

const logout = () => {
  userMenuVisible.value = false
  uni.showModal({
    title: t('layout.logout'),
    content: t('layout.logoutContent'),
    confirmColor: accentColor.value,
    success: async (res) => {
      if (!res.confirm) return
      await user.logout()
      uni.reLaunch({ url: '/pages/login/index' })
    },
  })
}

const resetData = () => {
  userMenuVisible.value = false
  uni.showModal({
    title: t('layout.resetData'),
    content: t('layout.resetDataContent'),
    confirmColor: accentColor.value,
    success: async (res) => {
      if (!res.confirm) return
      resetMockData()
      uni.showToast({ title: t('layout.resetDone'), icon: 'success' })
      await user.fetchProfile()
      uni.reLaunch({ url: currentRoute() })
    },
  })
}

const refreshPage = () => {
  uni.reLaunch({ url: currentRoute() })
}

const toggleUserMenu = () => {
  userMenuVisible.value = !userMenuVisible.value
}

onMounted(bootstrap)
</script>

<template>
  <view class="app-layout" :class="app.themeClass">
    <!-- 桌面 / 平板：固定侧边栏 -->
    <view v-if="!isMobile" class="sidebar" :class="{ 'is-hidden': app.sidebarCollapsed }">
      <side-menu :collapsed="app.sidebarCollapsed" />
    </view>

    <!-- 移动端：抽屉菜单 -->
    <template v-if="isMobile">
      <view v-if="app.drawerVisible" class="drawer-mask" @tap="app.closeDrawer" />
      <view class="drawer" :class="{ 'is-open': app.drawerVisible }">
        <side-menu drawer @navigate="app.closeDrawer" />
      </view>
    </template>

    <view
      class="layout-main"
      :class="{
        'no-sidebar': isMobile || app.sidebarCollapsed,
      }"
    >
      <!-- 顶部栏 -->
      <view class="layout-header">
        <view class="header-left">
          <view class="header-icon-btn" @tap="app.toggleSidebar">
            <app-icon
              :name="isMobile ? 'menu' : app.sidebarCollapsed ? 'unfold' : 'fold'"
              :size="18"
              color="#4e5969"
            />
          </view>

          <template v-if="isMobile">
            <text class="header-title">{{ props.title }}</text>
          </template>
          <template v-else>
            <view class="breadcrumb">
              <app-icon name="home" :size="14" color="#98a2a3" />
              <template v-for="(item, index) in homeBreadcrumb" :key="item + index">
                <text class="breadcrumb-sep">/</text>
                <text
                  class="breadcrumb-item"
                  :class="{ 'is-last': index === homeBreadcrumb.length - 1 }"
                >
                  {{ item }}
                </text>
              </template>
            </view>
          </template>
        </view>

        <view class="header-right">
          <view v-if="!isMobile" class="header-icon-btn" @tap="refreshPage">
            <app-icon name="refresh" :size="17" color="#4e5969" />
          </view>

          <view class="user-chip" @tap="toggleUserMenu">
            <view class="avatar">{{ user.avatarText }}</view>
            <view v-if="!isMobile" class="user-meta">
              <text class="user-name">{{ user.nickname }}</text>
              <text class="user-role">{{ user.roleNames }}</text>
            </view>
            <app-icon name="down" :size="11" color="#98a2a3" />
          </view>

          <!-- 用户下拉 -->
          <template v-if="userMenuVisible">
            <view class="popover-mask" @tap="userMenuVisible = false" />
            <view class="user-popover">
              <view class="popover-head">
                <text class="popover-name">{{ user.nickname }}</text>
                <text class="popover-sub">{{ user.profile?.deptName }} · {{ user.roleNames }}</text>
              </view>
              <view class="popover-item" @tap="openThemePanel">
                <app-icon name="theme" :size="15" color="#4e5969" />
                <text class="popover-text">{{ t('layout.theme') }}</text>
              </view>
              <view class="popover-item" @tap="openLanguagePanel">
                <app-icon name="set" :size="15" color="#4e5969" />
                <text class="popover-text">{{ t('layout.language') }}</text>
              </view>
              <view class="popover-item" @tap="resetData">
                <app-icon name="refresh" :size="15" color="#4e5969" />
                <text class="popover-text">{{ t('layout.resetData') }}</text>
              </view>
              <view class="popover-item is-danger" @tap="logout">
                <app-icon name="logout" :size="15" color="#f5455c" />
                <text class="popover-text">{{ t('layout.logout') }}</text>
              </view>
            </view>
          </template>
        </view>
      </view>

      <!-- 内容区 -->
      <view class="layout-content">
        <view v-if="denied" class="denied-card">
          <app-icon name="empty-permission" :size="60" color="#c8d0dc" />
          <text class="denied-title">{{ t('layout.deniedTitle') }}</text>
          <text class="denied-desc">
            {{ t('layout.deniedDesc', { title: props.title }) }}
          </text>
          <view class="denied-action">
            <view class="denied-btn" @tap="refreshPage">{{ t('layout.reload') }}</view>
          </view>
        </view>

        <template v-else-if="ready">
          <view v-if="props.title || $slots.actions" class="page-bar">
            <view v-if="!isMobile" class="page-title-wrap">
              <text class="page-title">{{ props.title }}</text>
              <text v-if="subtitle" class="page-subtitle">{{ subtitle }}</text>
            </view>
            <view class="page-actions">
              <slot name="actions" />
            </view>
          </view>

          <slot />
        </template>

        <view v-else class="layout-loading">
          <view class="loading-dot" />
          <text class="loading-text">{{ t('common.loading') }}</text>
        </view>
      </view>
    </view>
    <!-- 主题外观 -->
    <app-dialog
      v-model:visible="themeVisible"
      :title="t('layout.theme')"
      :confirm-text="t('common.done')"
      :show-cancel="false"
      :width="460"
      @confirm="themeVisible = false"
    >
      <view class="theme-block">
        <text class="theme-label">{{ t('layout.appearance') }}</text>
        <app-segmented :model-value="app.theme" :options="themeOptions" @change="onThemeChange" />
      </view>

      <view class="theme-block">
        <text class="theme-label">{{ t('layout.accent') }}</text>
        <view class="swatch-row">
          <view
            v-for="item in ACCENTS"
            :key="item.key"
            class="swatch"
            :class="{ 'is-active': app.accent === item.key }"
            @tap="onAccentChange(item.key)"
          >
            <view class="swatch-dot" :style="{ background: item.color }" />
            <text class="swatch-name">{{ accentName(item.key) }}</text>
          </view>
        </view>
      </view>

      <view class="theme-block">
        <text class="theme-label">{{ t('layout.density') }}</text>
        <app-segmented
          :model-value="app.density"
          :options="densityOptions"
          @change="onDensityChange"
        />
      </view>

      <view class="theme-block">
        <text class="theme-label">{{ t('layout.radius') }}</text>
        <app-segmented
          :model-value="app.radius"
          :options="radiusOptions"
          @change="onRadiusChange"
        />
      </view>

      <text class="theme-tip">{{ t('layout.themeTip') }}</text>
    </app-dialog>

    <!-- 界面语言 -->
    <app-dialog
      v-model:visible="languageVisible"
      :title="t('layout.languageTitle')"
      :confirm-text="t('common.done')"
      :show-cancel="false"
      :width="460"
      @confirm="applyLocale"
    >
      <app-segmented :model-value="locale" :options="localeOptions" @change="onLocaleChange" />
      <text class="theme-tip">{{ t('layout.languageTip') }}</text>
    </app-dialog>
  </view>
</template>

<style lang="scss" scoped>
.app-layout {
  min-height: 100vh;
  background: var(--app-bg);
}

/* 侧边栏 */
.sidebar {
  position: fixed;
  top: 0;
  bottom: 0;
  left: 0;
  width: var(--app-sidebar-width);
  z-index: 110;
  transition: width 0.2s;
  overflow: hidden;
}

.sidebar.is-hidden {
  width: 0;
  border-right: none;
}

/* 移动端抽屉 */
.drawer-mask {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  background: rgba(17, 31, 45, 0.4);
  z-index: 120;
}

.drawer {
  position: fixed;
  top: 0;
  bottom: 0;
  left: 0;
  width: 240px;
  z-index: 130;
  transform: translateX(-100%);
  transition: transform 0.22s ease;
  box-shadow: var(--app-shadow-lg);
}

.drawer.is-open {
  transform: translateX(0);
}

/* 主区域 */
.layout-main {
  margin-left: var(--app-sidebar-width);
  min-height: 100vh;
  transition: margin-left 0.2s;
}

.layout-main.no-sidebar {
  margin-left: 0;
}

@media (min-width: 768px) and (max-width: 1199px) {
  .sidebar {
    width: 200px;
  }
  .layout-main {
    margin-left: 200px;
  }
  .layout-main.no-sidebar {
    margin-left: 0;
  }
}

/* 顶部栏 */
.layout-header {
  position: sticky;
  top: 0;
  z-index: 100;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  height: var(--app-header-height);
  padding: 0 16px;
  background: var(--app-header-bg);
  /* 不用 backdrop-filter：Chrome 会把带 backdrop-filter 的元素设为裁剪容器，
     导致头部内的下拉面板被裁掉 */
  border-bottom: 1px solid var(--app-border);
}

.header-left {
  flex-direction: row;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.header-right {
  flex-direction: row;
  align-items: center;
  gap: 6px;
  position: relative;
}

.header-icon-btn {
  width: 34px;
  height: 34px;
  border-radius: 8px;
  align-items: center;
  justify-content: center;
}

.header-icon-btn:hover {
  background: var(--app-bg-2);
}

.header-title {
  font-size: var(--app-font-lg);
  font-weight: 600;
  color: var(--app-text);
}

.breadcrumb {
  flex-direction: row;
  align-items: center;
  gap: 6px;
}

.breadcrumb-sep {
  color: #c3cad6;
  font-size: var(--app-font-xs);
}

.breadcrumb-item {
  font-size: var(--app-font-sm);
  color: var(--app-text-3);
}

.breadcrumb-item.is-last {
  color: var(--app-text);
  font-weight: 500;
}

/* 用户 */
.user-chip {
  flex-direction: row;
  align-items: center;
  gap: 8px;
  padding: 4px 10px 4px 4px;
  border-radius: 999px;
}

.user-chip:hover {
  background: var(--app-bg-2);
}

.avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--app-primary), var(--app-primary-active));
  color: #fff;
  font-size: var(--app-font-sm);
  align-items: center;
  justify-content: center;
  flex: none;
}

.user-meta {
  gap: 1px;
}

.user-name {
  font-size: var(--app-font-sm);
  color: var(--app-text);
  line-height: 1.2;
}

.user-role {
  font-size: 11px;
  color: var(--app-text-3);
  line-height: 1.2;
}

.popover-mask {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 140;
}

.user-popover {
  position: absolute;
  top: 44px;
  right: 0;
  width: 210px;
  background: var(--app-card);
  border-radius: var(--app-radius);
  box-shadow: var(--app-shadow-lg);
  z-index: 150;
  padding: 6px;
}

.popover-head {
  padding: 10px 10px 8px;
  border-bottom: 1px solid var(--app-border-2);
  margin-bottom: 4px;
  gap: 2px;
}

.popover-name {
  font-size: var(--app-font);
  font-weight: 600;
  color: var(--app-text);
}

.popover-sub {
  font-size: var(--app-font-xs);
  color: var(--app-text-3);
}

.popover-item {
  flex-direction: row;
  align-items: center;
  gap: 8px;
  padding: 9px 10px;
  border-radius: var(--app-radius-sm);
}

.popover-item:hover {
  background: var(--app-bg-2);
}

.popover-item.is-danger:hover {
  background: var(--app-danger-weak);
}

.popover-text {
  font-size: var(--app-font-sm);
  color: var(--app-text-2);
}

.popover-item.is-danger .popover-text {
  color: var(--app-danger);
}

/* 内容 */
.layout-content {
  padding: var(--app-content-padding);
  gap: 16px;
}

@media (max-width: 767px) {
  .layout-content {
    padding: 12px;
    gap: 12px;
  }
}

.page-bar {
  flex-direction: row;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.page-title-wrap {
  gap: 4px;
}

.page-title {
  font-size: var(--app-font-xl);
  font-weight: 600;
  color: var(--app-text);
  letter-spacing: 0.5px;
}

.page-subtitle {
  font-size: var(--app-font-sm);
  color: var(--app-text-3);
}

.page-actions {
  flex-direction: row;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

/* 无权限 */
.denied-card {
  align-items: center;
  justify-content: center;
  background: var(--app-card);
  border-radius: var(--app-radius);
  box-shadow: var(--app-shadow);
  padding: 60px 24px;
  gap: 10px;
}

.denied-title {
  font-size: var(--app-font-lg);
  font-weight: 600;
  color: var(--app-text);
}

.denied-desc {
  font-size: var(--app-font-sm);
  color: var(--app-text-3);
  text-align: center;
  max-width: 460px;
  line-height: 1.6;
}

.denied-action {
  margin-top: 6px;
}

.denied-btn {
  height: 34px;
  padding: 0 18px;
  border-radius: var(--app-radius-sm);
  background: var(--app-primary);
  color: #fff;
  font-size: var(--app-font-sm);
  align-items: center;
  justify-content: center;
}

/* 主题设置 */
.theme-block {
  gap: 10px;
  margin-bottom: 16px;
}

.theme-label {
  font-size: var(--app-font-sm);
  color: var(--app-text-3);
}

.swatch-row {
  flex-direction: row;
  flex-wrap: wrap;
  gap: 10px;
}

.swatch {
  flex-direction: row;
  align-items: center;
  gap: 7px;
  padding: 7px 12px 7px 8px;
  border-radius: var(--app-radius-sm);
  border: 1px solid var(--app-border);
  background: var(--app-card);
}

.swatch.is-active {
  border-color: var(--app-primary);
  background: var(--app-primary-weak);
}

.swatch-dot {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  flex: none;
}

.swatch-name {
  font-size: var(--app-font-sm);
  color: var(--app-text-2);
}

.swatch.is-active .swatch-name {
  color: var(--app-primary);
  font-weight: 600;
}

.theme-tip {
  font-size: var(--app-font-xs);
  color: var(--app-text-4);
}

/* 加载 */
.layout-loading {
  align-items: center;
  justify-content: center;
  padding: 80px 0;
  gap: 10px;
}

.loading-dot {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  border: 2px solid var(--app-primary-weak);
  border-top-color: var(--app-primary);
  animation: layout-spin 0.8s linear infinite;
}

.loading-text {
  font-size: var(--app-font-sm);
  color: var(--app-text-3);
}

@keyframes layout-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
