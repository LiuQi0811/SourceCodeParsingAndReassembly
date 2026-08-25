import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import PopupApp from '../popup/App';
import '@assets/styles/global.css';

// 侧边栏复用 popup 的 UI(原项目 side_panel.default_path 也是 popup.html)
const container = document.getElementById('root');
if (!container) throw new Error('#root not found');

createRoot(container).render(
  <StrictMode>
    <div className="!w-full !h-full">
      <PopupApp />
    </div>
  </StrictMode>,
);
