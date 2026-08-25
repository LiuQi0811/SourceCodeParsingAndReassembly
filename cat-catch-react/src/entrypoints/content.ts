/**
 * Content Script
 * 1:1 还原原 js/content-script.js
 * - 在 document_start 注入,all_frames
 * - 监听 chrome.runtime.onMessage,响应 popup 发出的视频控制指令
 *   getVideoState / speed / pip / fullScreen / loop / muted / volume ...
 */
import { defineContentScript } from 'wxt/utils/define-content-script';

export default defineContentScript({
  matches: ['https://*/*', 'http://*/*'],
  runAt: 'document_start',
  allFrames: true,
  main() {
    let videoObj: HTMLMediaElement[] = [];
    let videoSrc: string[] = [];

    chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
      if (chrome.runtime.lastError) return;

      // === 获取页面视频对象状态 ===
      if (msg.Message === 'getVideoState') {
        const newObj: HTMLMediaElement[] = [];
        const newSrc: string[] = [];
        document.querySelectorAll<HTMLMediaElement>('video, audio').forEach((el) => {
          if (el.currentSrc) {
            newObj.push(el);
            newSrc.push(el.currentSrc);
          }
        });
        document.querySelectorAll<HTMLIFrameElement>('iframe').forEach((iframe) => {
          if (!iframe.contentDocument) return;
          iframe.contentDocument
            .querySelectorAll<HTMLMediaElement>('video, audio')
            .forEach((el) => {
              if (el.currentSrc) {
                newObj.push(el);
                newSrc.push(el.currentSrc);
              }
            });
        });

        if (newObj.length > 0) {
          if (newObj.length !== videoObj.length || newSrc.toString() !== videoSrc.toString()) {
            videoObj = newObj;
            videoSrc = newSrc;
          }
          const idx = msg.index === -1 ? 0 : msg.index ?? 0;
          const v = videoObj[idx];
          if (!v) {
            sendResponse({ count: videoObj.length });
            return true;
          }
          const timePct = (v.currentTime / (v.duration || 1)) * 100;
          sendResponse({
            time: timePct,
            currentTime: v.currentTime,
            duration: v.duration,
            volume: v.volume,
            count: videoObj.length,
            src: videoSrc,
            paused: v.paused,
            loop: v.loop,
            speed: v.playbackRate,
            muted: v.muted,
            type: v.tagName.toLowerCase(),
            videoStatus: videoObj.map((el) => (el.paused ? 1 : 0)),
          });
          return true;
        }
        sendResponse({ count: 0 });
        return true;
      }

      // === 速度控制 ===
      if (msg.Message === 'speed') {
        const v = videoObj[msg.index];
        if (v && v.playbackRate !== undefined) v.playbackRate = msg.speed;
        return true;
      }

      // === 画中画 ===
      if (msg.Message === 'pip') {
        if (document.pictureInPictureElement) {
          try {
            void document.exitPictureInPicture();
            sendResponse({ state: false });
          } catch {
            /* ignore */
          }
          return true;
        }
        try {
          const v = videoObj[msg.index] as unknown as HTMLVideoElement | undefined;
          void v?.requestPictureInPicture();
          sendResponse({ state: true });
        } catch {
          /* ignore */
        }
        return true;
      }

      // === 全屏 ===
      if (msg.Message === 'fullScreen') {
        if (document.fullscreenElement) {
          try {
            void document.exitFullscreen();
            sendResponse({ state: false });
          } catch {
            /* ignore */
          }
          return true;
        }
        try {
          const v = videoObj[msg.index];
          void (v as unknown as HTMLElement | undefined)?.requestFullscreen();
          sendResponse({ state: true });
        } catch {
          /* ignore */
        }
        return true;
      }

      // === 播放/暂停 ===
      if (msg.Message === 'play') {
        const v = videoObj[msg.index];
        if (!v) return true;
        if (v.paused) {
          void v.play();
        } else {
          v.pause();
        }
        return true;
      }

      // === 静音切换 ===
      if (msg.Message === 'muted') {
        const v = videoObj[msg.index];
        if (v) v.muted = !v.muted;
        return true;
      }

      // === 音量 ===
      if (msg.Message === 'volume') {
        const v = videoObj[msg.index];
        if (v) {
          v.volume = msg.volume;
          if (msg.volume > 0 && v.muted) v.muted = false;
        }
        return true;
      }

      // === 跳转进度 ===
      if (msg.Message === 'seek') {
        const v = videoObj[msg.index];
        if (v) {
          try {
            v.currentTime = (msg.time / 100) * v.duration;
          } catch {
            /* ignore */
          }
        }
        return true;
      }

      // === 循环切换(还原原 content-script loop) ===
      if (msg.Message === 'loop') {
        const v = videoObj[msg.index];
        if (v) v.loop = !v.loop;
        return true;
      }

      // === 截图(canvas 抓帧 + a 标签下载 PNG) ===
      if (msg.Message === 'screenshot') {
        const v = videoObj[msg.index] as HTMLVideoElement | undefined;
        if (v && v.videoWidth) {
          const canvas = document.createElement('canvas');
          canvas.width = v.videoWidth;
          canvas.height = v.videoHeight;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(v, 0, 0);
            canvas.toBlob((blob) => {
              if (!blob) return;
              const blobUrl = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = blobUrl;
              a.download = `cat-catch-screenshot-${Date.now()}.png`;
              a.click();
              setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
            }, 'image/png');
          }
        }
        return true;
      }

      // === ffmpeg 合并(还原原 content-script.js L150-173) ===
      // background 发 {Message:'ffmpeg', files} → content script 转 postMessage 给页面(在线 ffmpeg 服务)
      if (msg.Message === 'ffmpeg') {
        if (!msg.files) {
          window.postMessage(msg);
          sendResponse('ok');
          return true;
        }
        msg.quantity ??= msg.files.length;
        for (const item of msg.files) {
          const data = { ...msg, ...item };
          data.type = item.type ?? 'video';
          if (data.data instanceof Blob) {
            window.postMessage(data);
          } else {
            fetch(data.data)
              .then((r) => r.blob())
              .then((blob) => {
                data.data = blob;
                window.postMessage(data);
              });
          }
        }
        sendResponse('ok');
        return true;
      }

      return;
    });

    // === 监听页面 postMessage(还原原 content-script.js L234-302) ===
    // 在线 ffmpeg 服务发 catCatchFFmpeg/catCatchFFmpegResult → 转发给 background
    window.addEventListener('message', (event) => {
      const action = ['catCatchAddMedia', 'catCatchAddKey', 'catCatchFFmpeg', 'catCatchFFmpegResult', 'catCatchCloseScript'];
      if (!event.data || !event.data.action || event.origin !== window.location.origin || !action.includes(event.data.action)) return;
      event.stopPropagation();
      event.stopImmediatePropagation();

      // catCatchFFmpeg:页面请求 ffmpeg 合并 → 转发给 background
      if (event.data.action === 'catCatchFFmpeg') {
        if (!event.data.use || !event.data.files || !Array.isArray(event.data.files) || event.data.files.length === 0) return;
        event.data.title = event.data.title ?? document.title ?? Date.now().toString();
        event.data.title = event.data.title.replaceAll('"', '').replaceAll("'", '').replaceAll(' ', '');
        const data = {
          Message: event.data.action,
          action: event.data.use,
          files: event.data.files,
          url: event.data.href ?? ((event.source as Window | null)?.location?.href ?? ''),
          ...event.data,
        };
        chrome.runtime.sendMessage(data);
      }

      // catCatchFFmpegResult:ffmpeg 转码完成 → 转发给 background 下载
      if (event.data.action === 'catCatchFFmpegResult') {
        if (!event.data.state || !event.data.tabId) return;
        chrome.runtime.sendMessage({ Message: 'catCatchFFmpegResult', ...event.data });
      }

      // catCatchCloseScript:页面请求关闭脚本 → 转发给 background
      if (event.data.action === 'catCatchCloseScript') {
        if (!event.data.script || !event.isTrusted) return;
        chrome.runtime.sendMessage({ Message: 'closeScript', ...event.data });
      }
    }, { capture: true });
  },
});
