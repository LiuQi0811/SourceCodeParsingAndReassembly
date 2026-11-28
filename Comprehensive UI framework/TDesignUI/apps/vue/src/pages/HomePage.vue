<script lang="ts" setup>
// ref / computed / onUnmounted 由 unplugin-auto-import 自动注入，无需手动 import
import { APP_SPEC, createCounter, formatCount } from '@tdesignui/core';

const name = ref('TDesign');
const dark = ref(false);
const tags = ref(['Vue 3', 'Vite', 'TypeScript', 'TDesign']);

// 计数器来自 packages/core，与 React 端共用同一份实现
const counter = createCounter();
const count = ref(counter.get());
const stopCount = counter.subscribe((value) => {
  count.value = value;
});
onUnmounted(stopCount);

const greeting = computed(() => (name.value ? `你好，${name.value}！` : '请输入名字'));
</script>

<template>
  <div class="tds-page" :class="{ 'tds-page--dark': dark }">
    <header class="tds-hero">
      <h1>{{ APP_SPEC.product }}</h1>
      <p>{{ APP_SPEC.tagline }} · Vue 版</p>
    </header>

    <div class="tds-stack">
      <t-card title="基础交互" :bordered="true" hover-shadow>
        <t-space direction="vertical" size="16px" style="width: 100%">
          <t-input v-model="name" label="名字" placeholder="输入你的名字" clearable />
          <t-space align="center">
            <t-button theme="primary" @click="counter.increment()">点我 +1</t-button>
            <t-button theme="default" variant="outline" @click="counter.increment(5)"
              >一次 +5</t-button
            >
            <t-button theme="default" variant="text" @click="counter.reset()">重置</t-button>
            <t-tag theme="primary" variant="light">{{ formatCount(count) }}</t-tag>
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
    </div>
  </div>
</template>
