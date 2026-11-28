<script setup lang="ts">
import { APP_SPEC, ROUTES } from '@tdesignui/core';
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
      <span class="tds-badge">Vue 版</span>
    </header>

    <main class="tds-main">
      <router-view />
    </main>
  </div>
</template>
