<script lang="ts" setup>
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { appConfig } from '@/config'
import { useUserStore } from '@/store/modules/user'
import { currentRoute, navigateTo } from '@/utils/navigate'
import AppIcon from '@/components/ui/AppIcon.vue'

withDefaults(
  defineProps<{
    /** 收起状态只显示图标 */
    collapsed?: boolean
    /** 移动端抽屉中使用 */
    drawer?: boolean
  }>(),
  {
    collapsed: false,
    drawer: false,
  }
)

const emit = defineEmits<{
  (e: 'navigate'): void
}>()

const user = useUserStore()
const { t } = useI18n()
const activePath = ref(currentRoute())

const menus = computed(() => user.menus)

const isActive = (path?: string): boolean => !!path && path === activePath.value

const go = (path?: string) => {
  if (!path) return
  activePath.value = path
  navigateTo(path)
  emit('navigate')
}
</script>

<template>
  <view class="side-menu" :class="{ 'is-collapsed': collapsed, 'is-drawer': drawer }">
    <view class="brand">
      <view class="brand-logo">
        <app-icon name="logo-tuniao" :size="18" color="#ffffff" />
      </view>
      <view v-if="!collapsed" class="brand-text">
        <text class="brand-name">{{ appConfig.appName }}</text>
        <text class="brand-desc">Tuniao Admin Base</text>
      </view>
    </view>

    <scroll-view scroll-y class="menu-scroll">
      <view v-for="item in menus" :key="item.id" class="menu-group">
        <template v-if="item.type === 'catalog'">
          <text v-if="!collapsed" class="group-title">{{ item.name }}</text>
          <view
            v-for="child in item.children || []"
            :key="child.id"
            class="menu-item"
            :class="{ 'is-active': isActive(child.path) }"
            @tap="go(child.path)"
          >
            <app-icon
              :name="child.icon || 'circle'"
              :size="16"
              :color="isActive(child.path) ? 'var(--app-primary)' : 'var(--app-text-3)'"
            />
            <text v-if="!collapsed" class="item-text">{{ child.name }}</text>
          </view>
        </template>

        <view
          v-else
          class="menu-item"
          :class="{ 'is-active': isActive(item.path) }"
          @tap="go(item.path)"
        >
          <app-icon
            :name="item.icon || 'circle'"
            :size="16"
            :color="isActive(item.path) ? 'var(--app-primary)' : 'var(--app-text-3)'"
          />
          <text v-if="!collapsed" class="item-text">{{ item.name }}</text>
        </view>
      </view>

      <view v-if="!menus.length" class="menu-empty">
        <app-icon name="empty-permission" :size="26" color="#c8d0dc" />
        <text class="menu-empty-text">{{ t('layout.noMenu') }}</text>
      </view>
    </scroll-view>

    <view v-if="!collapsed" class="side-footer">
      <text class="footer-tip">{{ user.roleNames }}</text>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.side-menu {
  width: 100%;
  height: 100%;
  background: var(--app-card);
  border-right: 1px solid var(--app-border);
}

.brand {
  flex-direction: row;
  align-items: center;
  gap: 10px;
  padding: 16px 16px 14px;
}

.brand-logo {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  background: linear-gradient(135deg, var(--app-primary), var(--app-primary-active));
  align-items: center;
  justify-content: center;
  flex: none;
}

.brand-text {
  gap: 2px;
  overflow: hidden;
}

.brand-name {
  font-size: var(--app-font-lg);
  font-weight: 600;
  color: var(--app-text);
  white-space: nowrap;
}

.brand-desc {
  font-size: 11px;
  color: var(--app-text-3);
  white-space: nowrap;
}

.is-collapsed .brand {
  justify-content: center;
  padding: 16px 0 14px;
}

.menu-scroll {
  flex: 1;
  padding: 0 10px;
}

.menu-group {
  gap: 2px;
}

.group-title {
  font-size: var(--app-font-xs);
  color: var(--app-text-3);
  padding: 14px 8px 6px;
  letter-spacing: 1px;
}

.menu-item {
  flex-direction: row;
  align-items: center;
  gap: 10px;
  height: 40px;
  padding: 0 10px;
  border-radius: var(--app-radius-sm);
  transition: background-color 0.15s;
}

.menu-item:hover {
  background: #f5f8fc;
}

.is-active {
  background: var(--app-primary-weak);
}

.is-collapsed .menu-item {
  justify-content: center;
  padding: 0;
}

.item-text {
  font-size: var(--app-font);
  color: var(--app-text-2);
  white-space: nowrap;
}

.is-active .item-text {
  color: var(--app-primary);
  font-weight: 600;
}

.menu-empty {
  align-items: center;
  gap: 8px;
  padding: 40px 0;
}

.menu-empty-text {
  font-size: var(--app-font-xs);
  color: var(--app-text-3);
}

.side-footer {
  padding: 12px 16px;
  border-top: 1px solid var(--app-border-2);
}

.footer-tip {
  font-size: var(--app-font-xs);
  color: var(--app-text-3);
}
</style>
