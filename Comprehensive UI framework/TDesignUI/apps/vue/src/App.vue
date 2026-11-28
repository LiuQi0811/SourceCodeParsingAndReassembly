<script setup lang="ts">
import { APP_SPEC, ROUTES } from '@tdesignui/core';
</script>

<template>
  <div class="shell">
    <header class="nav">
      <div class="brand">{{ APP_SPEC.product }}</div>
      <nav class="links">
        <router-link v-for="route in ROUTES" :key="route.key" :to="route.path" class="link">
          {{ route.navLabel }}
        </router-link>
      </nav>
      <span class="badge">Vue 版</span>
    </header>

    <main class="main">
      <router-view />
    </main>
  </div>
</template>

<style scoped>
.shell {
  min-height: 100vh;
  background: #f5f7fa;
}

.nav {
  display: flex;
  align-items: center;
  gap: 24px;
  padding: 0 24px;
  height: 56px;
  background: #fff;
  border-bottom: 1px solid #e7e7e7;
  position: sticky;
  top: 0;
  z-index: 10;
}

.brand {
  font-weight: 600;
  font-size: 16px;
  color: #1f2329;
}

.links {
  display: flex;
  gap: 4px;
  flex: 1;
}

.link {
  padding: 6px 12px;
  border-radius: 4px;
  font-size: 14px;
  color: #646a73;
  text-decoration: none;
  transition: all 0.2s ease;
}

.link:hover {
  color: #0052d9;
  background: #f2f3f5;
}

.link.router-link-active {
  color: #0052d9;
  background: #ecf2fe;
  font-weight: 500;
}

.badge {
  font-size: 12px;
  color: #0052d9;
  background: #ecf2fe;
  border-radius: 10px;
  padding: 2px 10px;
}

.main {
  padding: 24px;
}
</style>
