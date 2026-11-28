import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { applyTheme, themeStore } from '@tdesignui/core';
import App from './App';
// 组件库样式 + 两端共用的设计 token / 布局样式
import 'tdesign-react/es/style/index.css';
import '@tdesignui/theme/styles.css';

// 挂载前先应用已保存的主题，避免首屏闪白
applyTheme(themeStore.get());

const container = document.getElementById('root');
if (!container) {
  throw new Error('未找到 #root 挂载节点');
}

createRoot(container).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
