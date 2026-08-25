import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { useMediaStore } from '@stores/media';
import '@assets/styles/global.css';

// 监听 background 发来的 popupAddData,增量更新 popup 端 media store
// popup 与 background 是独立的 JS 上下文,zustand store 不共享,
// 只能通过消息增量同步 + 启动时从 chrome.storage 全量加载。
chrome.runtime.onMessage.addListener((msg, _sender, _sendResponse) => {
  if (chrome.runtime.lastError) return;
  if (msg?.Message === 'popupAddData' && msg.data) {
    useMediaStore.getState().push(msg.data);
  }
  return;
});

const container = document.getElementById('root');
if (!container) throw new Error('#root not found');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
