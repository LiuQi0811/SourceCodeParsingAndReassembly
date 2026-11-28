import { createApp } from 'vue';
import App from './App.vue';
import { router } from './router';

// 组件库样式 + 两端共用的设计 token / 布局样式
import 'tdesign-vue-next/es/style/index.css';
import '@tdesignui/theme/styles.css';

const app = createApp(App);
app.use(router);
app.mount('#app');
