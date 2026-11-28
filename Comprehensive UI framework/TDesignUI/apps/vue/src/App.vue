<script setup lang="ts">
import { APP_SPEC, ROUTES, applyTheme, themeLabel, themeStore } from '@tdesignui/core';

// 主题状态来自 core 的共享单例，切一次全站生效（含 TDesign 组件）
const theme = ref(themeStore.get());
const isDark = computed(() => theme.value === 'dark');

const stopTheme = themeStore.subscribe((next) => {
  theme.value = next;
  applyTheme(next);
});

onMounted(() => applyTheme(theme.value));
onUnmounted(stopTheme);

function onThemeChange(value: boolean) {
  themeStore.set(value ? 'dark' : 'light');
}
</script>

<template>
  <div class="tds-shell">
    <header class="tds-nav">
      <div class="tds-brand">{{ APP_SPEC.product }}</div>
      <nav class="tds-links">
        <router-link
          v-for="route in ROUTES"
          :key="route.key"
          :to="route.path"
          class="tds-link"
          active-class="tds-link--active"
        >
          {{ route.navLabel }}
        </router-link>
      </nav>
      <span class="tds-theme-label">{{ themeLabel(theme) }}</span>
      <t-switch :value="isDark" @change="onThemeChange" />
      <span class="tds-badge">Vue 版</span>
    </header>

    <main class="tds-main">
      <router-view />
    </main>
  </div>
</template>
