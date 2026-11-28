import { createApp } from 'vue';
import { applyTheme, themeStore } from '@tdesignui/core';
import App from './App.vue';
import { router } from './router';

// 组件库样式 + 两端共用的设计 token / 布局样式
import 'tdesign-vue-next/es/style/index.css';
import '@tdesignui/theme/styles.css';

// 挂载前先应用已保存的主题，避免首屏闪白
applyTheme(themeStore.get());

const app = createApp(App);
app.use(router);
app.mount('#app');
