import { createRouter, createWebHistory } from 'vue-router';
import { ROUTES } from '@tdesignui/core';
import HomePage from './pages/HomePage.vue';
import AppsPage from './pages/AppsPage.vue';

// 路径来自 core 的路由表，组件在这里映射 —— 两端共享路径，各自选择实现
const components: Record<string, unknown> = {
  home: HomePage,
  apps: AppsPage,
};

export const router = createRouter({
  history: createWebHistory(),
  routes: ROUTES.map((route) => ({
    path: route.path,
    name: route.key,
    component: components[route.key] as never,
    meta: { title: route.title },
  })),
});
