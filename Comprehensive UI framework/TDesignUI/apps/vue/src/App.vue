<script setup lang="ts">
// ref / computed 由 unplugin-auto-import 自动注入，无需手动 import
import { APP_SPEC } from '@tdesignui/core';

const name = ref('TDesign');
const count = ref(0);
const dark = ref(false);
const tags = ref(['Vue 3', 'Vite', 'TypeScript', 'TDesign']);

const greeting = computed(() => (name.value ? `你好，${name.value}！` : '请输入名字'));

function handleClick() {
  count.value += 1;
}
</script>

<template>
  <div class="page" :class="{ 'page--dark': dark }">
    <header class="hero">
      <h1>{{ APP_SPEC.product }}</h1>
      <p>{{ APP_SPEC.tagline }} · Vue 版</p>
    </header>

    <t-space direction="vertical" size="24px" style="width: 100%">
      <t-card title="基础交互" :bordered="true" hover-shadow>
        <t-space direction="vertical" size="16px" style="width: 100%">
          <t-input v-model="name" label="名字" placeholder="输入你的名字" clearable />
          <t-space align="center">
            <t-button theme="primary" @click="handleClick">点我 +1</t-button>
            <t-tag theme="primary" variant="light">当前点击：{{ count }} 次</t-tag>
          </t-space>
          <t-alert theme="success" :message="greeting" />
        </t-space>
      </t-card>

      <t-card title="主题与状态" :bordered="true">
        <t-space align="center" size="16px">
          <t-switch v-model="dark" />
          <span>深色模式</span>
        </t-space>
        <t-divider />
        <t-space>
          <t-tag v-for="tag in tags" :key="tag" variant="outline" theme="default">
            {{ tag }}
          </t-tag>
        </t-space>
      </t-card>
    </t-space>
  </div>
</template>

<style scoped>
.page {
  min-height: 100vh;
  padding: 48px 24px;
  box-sizing: border-box;
  background: #f5f7fa;
  transition: background 0.3s ease;
}

.page--dark {
  background: #1a1a1a;
}

.page--dark .hero h1,
.page--dark .hero p {
  color: #e8e8e8;
}

.hero {
  max-width: 720px;
  margin: 0 auto 32px;
  text-align: center;
}

.hero h1 {
  margin: 0 0 8px;
  font-size: 28px;
  color: #1f2329;
}

.hero p {
  margin: 0;
  color: #646a73;
}

.page :deep(.t-space),
.page > :deep(*) {
  max-width: 720px;
  margin: 0 auto;
}
</style>
