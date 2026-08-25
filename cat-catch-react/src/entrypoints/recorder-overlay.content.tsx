/**
 * 录制浮层 content script
 * 监听三种 ready 信号,动态注入 React 浮层(支持多 mode 同时挂载)
 *
 * ready 信号 → mode 映射:
 * - catCatchRecorder2.ready → mode='screen' (recorder2.js)
 * - catCatchRecorder.ready  → mode='video'   (recorder.js)
 * - catCatchWebRTC.ready    → mode='webrtc'  (webrtc.js)
 *
 * 通过 window.postMessage 与 MAIN world 录制脚本通信(ISOLATED ↔ MAIN)
 * 多个 mode 同时挂载时,共享一个右下角 flex 容器,垂直堆叠
 */
import { defineContentScript } from 'wxt/utils/define-content-script';
import { createRoot } from 'react-dom/client';
import { RecorderOverlay, type RecorderMode } from './recorder-overlay/RecorderOverlay';

interface MountEntry {
  host: HTMLDivElement;
  root: ReturnType<typeof createRoot>;
}

// ready 信号 → mode
const READY_TO_MODE: Record<string, RecorderMode> = {
  'catCatchRecorder2.ready': 'screen',
  'catCatchRecorder.ready': 'video',
  'catCatchWebRTC.ready': 'webrtc',
};

// catCatchCloseScript 中的 script → mode
const SCRIPT_TO_MODE: Record<string, RecorderMode> = {
  'recorder2.js': 'screen',
  'recorder.js': 'video',
  'webrtc.js': 'webrtc',
};

export default defineContentScript({
  matches: ['https://*/*', 'http://*/*'],
  runAt: 'document_idle',
  world: 'ISOLATED',
  main() {
    const mounts = new Map<RecorderMode, MountEntry>();
    let container: HTMLDivElement | null = null;

    const ensureContainer = (): HTMLDivElement => {
      if (container && container.isConnected) return container;
      const el = document.createElement('div');
      el.id = 'cat-catch-recorder-container';
      el.style.position = 'fixed';
      el.style.bottom = '20px';
      el.style.right = '20px';
      el.style.zIndex = '2147483647';
      el.style.display = 'flex';
      el.style.flexDirection = 'column-reverse'; // 新挂载的浮层在最下方
      el.style.gap = '10px';
      el.style.pointerEvents = 'none'; // 容器不拦截事件,由卡片自己处理
      document.documentElement.appendChild(el);
      container = el;
      return el;
    };

    const ensureMount = (mode: RecorderMode) => {
      if (mounts.has(mode)) return; // 同 mode 已注入则跳过
      const c = ensureContainer();
      // 用 Shadow DOM 隔离页面 CSS
      const host = document.createElement('div');
      host.style.pointerEvents = 'none';
      const shadow = host.attachShadow({ mode: 'open' });
      // shadow root 内注入基础暗色样式(确保即使 inline style 失效,按钮也可见)
      const baseStyle = document.createElement('style');
      baseStyle.textContent = `
        :host { all: initial; }
        * { all: revert; box-sizing: border-box; font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
        div { display: block; }
        button {
          display: inline-block;
          background: rgba(255,255,255,0.08);
          color: #fff;
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 6px;
          padding: 10px 14px;
          font-size: 13px;
          cursor: pointer;
        }
        select, input {
          background: rgba(255,255,255,0.06);
          color: #fff;
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 6px;
          padding: 6px 10px;
          font-size: 13px;
        }
        option { background: #1a1a1a; color: #fff; }
        label, span, p { color: #fff; }
      `;
      shadow.appendChild(baseStyle);
      const mount = document.createElement('div');
      shadow.appendChild(mount);
      c.appendChild(host);
      const root = createRoot(mount);
      // 传入 onClose:直接调用 unmount,不依赖 postMessage 往返(最可靠)
      root.render(<RecorderOverlay mode={mode} onClose={() => unmount(mode)} />);
      mounts.set(mode, { host, root });
    };

    const unmount = (mode: RecorderMode) => {
      const entry = mounts.get(mode);
      if (!entry) return;
      try {
        entry.root.unmount();
      } catch {
        /* ignore */
      }
      if (entry.host.isConnected) entry.host.remove();
      mounts.delete(mode);
      // 容器空了就移除,保持 DOM 干净
      if (container && container.isConnected && mounts.size === 0) {
        container.remove();
        container = null;
      }
    };

    const onMessage = (e: MessageEvent) => {
      if (e.source !== window) return;
      const d = e.data as { action?: string; script?: string } | null;
      if (!d?.action) return;
      // ready 信号 → 注入对应 mode 浮层
      const mode = READY_TO_MODE[d.action];
      if (mode) {
        ensureMount(mode);
        return;
      }
      // close 信号 → 卸载对应 mode 浮层
      if (d.action === 'catCatchCloseScript' && d.script) {
        console.log('[cat-catch] recorder-overlay content received catCatchCloseScript', d.script);
        const m = SCRIPT_TO_MODE[d.script];
        if (m) unmount(m);
      }
    };
    window.addEventListener('message', onMessage);
  },
});
