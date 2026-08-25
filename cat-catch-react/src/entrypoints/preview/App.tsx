import { useEffect, useRef, useState, useCallback } from 'react';
import { sendRuntimeMessage } from '@lib/chrome';
import { Button } from '@components/ui/Button';
import { Slider } from '@components/ui/Slider';
import * as Tooltip from '@radix-ui/react-tooltip';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  PictureInPicture2,
  Download,
  RotateCcw,
  RotateCw,
  Camera,
  Repeat2,
} from 'lucide-react';

interface VideoState {
  time: number; // 进度百分比 0-100
  currentTime: number;
  duration: number;
  volume: number; // 0-1
  count: number;
  src: string[];
  paused: boolean;
  loop: boolean;
  speed: number;
  muted: boolean;
  type: string;
  videoStatus: number[];
}

// "选择页面"下拉项(还原原 popup.html #videoTabIndex,见 js/media-control.js)
interface VideoTab {
  id: number;
  title: string;
  favIconUrl?: string;
}

/**
 * 视频预览/控制 —— 双模式
 * - ?url= 直接播放 URL(扩展内 video 元素,本地控制)
 * - ?tabId= 控制页面 video 元素(轮询 getVideoState + sendMessage)
 * 还原原 preview.html + js/preview.js + content-script 视频控制
 */
export default function App() {
  const params = new URLSearchParams(location.search);
  const url = params.get('url');
  const initialTabId = Number(params.get('tabId') || 0);
  const mode: 'local' | 'remote' = url ? 'local' : 'remote';

  const videoRef = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<VideoState | null>(null);
  const [index, setIndex] = useState(0);
  const [seeking, setSeeking] = useState(false);
  const [dragTime, setDragTime] = useState(0);
  // "选择页面":remote 模式下当前控制的 tab(可切换,初始为 URL 的 tabId)
  const [activeTabId, setActiveTabId] = useState<number>(initialTabId);
  // "选择页面"下拉列表(还原原 popup.html #videoTabIndex 选项)
  const [videoTabs, setVideoTabs] = useState<VideoTab[]>([]);

  // === remote 模式:轮询 getVideoState(切 tabId 后重新轮询) ===
  useEffect(() => {
    if (mode !== 'remote' || activeTabId <= 0) return;
    let active = true;
    const poll = async () => {
      // content-script 在页面端,直接给 activeTabId 发消息读取 video 状态
      try {
        const res = (await chrome.tabs.sendMessage(activeTabId, {
          Message: 'getVideoState',
          index,
        })) as VideoState | undefined;
        if (active && res) setState(res);
      } catch {
        /* tab 已关闭 / 无 content script */
      }
    };
    poll();
    const timer = window.setInterval(poll, 500);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [mode, index, activeTabId]);

  // === remote 模式:加载"选择页面"下拉列表(还原 media-control.js updateVideoTagOptions) ===
  useEffect(() => {
    if (mode !== 'remote') return;
    let active = true;
    const load = async () => {
      const res = await sendRuntimeMessage<VideoTab[]>({ Message: 'getVideoTabs' });
      if (active && res) {
        setVideoTabs(res);
        // 当前 tabId 不在列表里且列表非空,自动切到第一个有 video 的 tab
        if (!res.some((t) => t.id === activeTabId) && res.length > 0 && res[0]) {
          setActiveTabId(res[0].id);
        }
      }
    };
    load();
    // 每 3 秒刷新一次 tab 列表(还原原项目 setInterval(updateVideoTagOptions, 1000))
    const timer = window.setInterval(load, 3000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [mode, activeTabId]);

  // === local 模式:绑定 video 事件同步状态 ===
  useEffect(() => {
    if (mode !== 'local') return;
    const v = videoRef.current;
    if (!v) return;
    const sync = () => {
      if (seeking) return;
      setState({
        time: (v.currentTime / (v.duration || 1)) * 100,
        currentTime: v.currentTime,
        duration: v.duration || 0,
        volume: v.volume,
        count: 1,
        src: [url!],
        paused: v.paused,
        loop: v.loop,
        speed: v.playbackRate,
        muted: v.muted,
        type: 'video',
        videoStatus: [v.paused ? 1 : 0],
      });
    };
    const events = ['timeupdate', 'loadedmetadata', 'play', 'pause', 'volumechange', 'ratechange', 'ended'];
    events.forEach((e) => v.addEventListener(e, sync));
    sync();
    return () => events.forEach((e) => v.removeEventListener(e, sync));
  }, [mode, url, seeking]);

  // === 控制指令 ===
  const sendRemote = useCallback(
    (msg: Record<string, unknown>) =>
      void chrome.tabs.sendMessage(activeTabId, { ...msg, index }),
    [activeTabId, index],
  );
  const togglePlay = useCallback(() => {
    if (mode === 'local') {
      const v = videoRef.current;
      if (!v) return;
      v.paused ? void v.play() : v.pause();
    } else {
      sendRemote({ Message: 'play' });
    }
  }, [mode, sendRemote]);
  const toggleMuted = useCallback(() => {
    if (mode === 'local') {
      const v = videoRef.current;
      if (v) v.muted = !v.muted;
    } else {
      sendRemote({ Message: 'muted' });
    }
  }, [mode, sendRemote]);
  const seek = useCallback(
    (pct: number) => {
      if (mode === 'local') {
        const v = videoRef.current;
        if (v && v.duration) v.currentTime = (pct / 100) * v.duration;
      } else {
        sendRemote({ Message: 'seek', time: pct });
      }
    },
    [mode, sendRemote],
  );
  const setVolume = useCallback(
    (vol: number) => {
      if (mode === 'local') {
        const v = videoRef.current;
        if (v) {
          v.volume = vol;
          if (vol > 0 && v.muted) v.muted = false;
        }
      } else {
        sendRemote({ Message: 'volume', volume: vol });
      }
    },
    [mode, sendRemote],
  );
  const setSpeed = useCallback(
    (speed: number) => {
      if (mode === 'local') {
        const v = videoRef.current;
        if (v) v.playbackRate = speed;
      } else {
        sendRemote({ Message: 'speed', speed });
      }
    },
    [mode, sendRemote],
  );
  const skip = useCallback(
    (delta: number) => {
      if (mode === 'local') {
        const v = videoRef.current;
        if (v) v.currentTime = Math.max(0, Math.min(v.duration, v.currentTime + delta));
      } else {
        const v = state;
        if (v) sendRemote({ Message: 'seek', time: ((v.currentTime + delta) / (v.duration || 1)) * 100 });
      }
    },
    [mode, sendRemote, state],
  );
  const togglePiP = useCallback(() => {
    if (mode === 'local') {
      const v = videoRef.current as unknown as HTMLVideoElement | null;
      if (!v) return;
      if (document.pictureInPictureElement) void document.exitPictureInPicture();
      else void v.requestPictureInPicture();
    } else {
      sendRemote({ Message: 'pip' });
    }
  }, [mode, sendRemote]);
  const toggleFullscreen = useCallback(() => {
    const el = mode === 'local' ? videoRef.current : null;
    if (document.fullscreenElement) void document.exitFullscreen();
    else if (el) void el.requestFullscreen();
    else sendRemote({ Message: 'fullScreen' });
  }, [mode, sendRemote]);
  const download = useCallback(() => {
    const src = state?.src?.[0] ?? url;
    if (!src) return;
    void chrome.downloads.download({ url: src });
  }, [state, url]);

  // 循环播放(还原原 preview.js loop)
  const toggleLoop = useCallback(() => {
    if (mode === 'local') {
      const v = videoRef.current;
      if (v) v.loop = !v.loop;
    } else {
      sendRemote({ Message: 'loop' });
    }
  }, [mode, sendRemote]);

  // 截图(还原原 preview.js screenshot,canvas 抓帧下载 PNG)
  const screenshot = useCallback(() => {
    if (mode === 'local') {
      const v = videoRef.current;
      if (!v || !v.videoWidth) return;
      const canvas = document.createElement('canvas');
      canvas.width = v.videoWidth;
      canvas.height = v.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(v, 0, 0);
      canvas.toBlob((blob) => {
        if (!blob) return;
        const blobUrl = URL.createObjectURL(blob);
        void chrome.downloads.download({
          url: blobUrl,
          filename: `cat-catch-screenshot-${Date.now()}.png`,
        });
      }, 'image/png');
    } else {
      sendRemote({ Message: 'screenshot' });
    }
  }, [mode, sendRemote]);

  if (!state && mode === 'remote') {
    return (
      <div className="min-h-screen flex items-center justify-center text-[var(--color-text-muted] bg-[var(--color-surface]">
        等待视频元素...
      </div>
    );
  }
  // local 模式:video 元素始终渲染(避免 state 初始化时重建 video 导致视频重新加载)
  // state=null 时显示"加载中",state 有值后显示完整控制栏,video 元素复用同一 DOM 节点
  if (!state && mode === 'local') {
    return (
      <Tooltip.Provider delayDuration={300}>
        <div className="min-h-screen bg-black text-white flex flex-col">
          <div className="flex-1 flex items-center justify-center relative">
            <video
              key="main-video"
              ref={videoRef}
              src={url!}
              autoPlay
              playsInline
              preload="auto"
              crossOrigin="anonymous"
              className="max-h-[75vh] max-w-full"
              onClick={togglePlay}
            />
          </div>
          <div className="border-t border-white/10 bg-black/90 backdrop-blur px-4 py-3 text-center text-white/60">
            加载中...
          </div>
        </div>
      </Tooltip.Provider>
    );
  }

  // TS narrowing:local/remote null 分支已 return,此处 state 非 null
  if (!state) return null;

  const fmtTime = (s: number) => {
    if (!isFinite(s)) return '00:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  return (
    <Tooltip.Provider delayDuration={300}>
      <div className="min-h-screen bg-black text-white flex flex-col">
        {/* 视频区 */}
        <div className="flex-1 flex items-center justify-center relative">
          {mode === 'local' ? (
            <video
              key="main-video"
              ref={videoRef}
              src={url!}
              autoPlay
              playsInline
              preload="auto"
              crossOrigin="anonymous"
              className="max-h-[75vh] max-w-full"
              onClick={togglePlay}
            />
          ) : state.src[0] ? (
            <video
              src={state.src[0]}
              controls
              autoPlay
              className="max-h-[75vh] max-w-full"
            />
          ) : (
            <p className="text-white/60">未找到视频元素</p>
          )}
        </div>

        {/* 控制栏 */}
        <div className="border-t border-white/10 bg-black/90 backdrop-blur px-4 py-3 space-y-2">
          {/* 进度条 */}
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono text-white/70 w-12 text-right">
              {fmtTime(state.currentTime)}
            </span>
            <Slider
              value={[seeking ? dragTime : state.time]}
              min={0}
              max={100}
              step={0.1}
              onValueChange={(v) => setDragTime(v[0] ?? 0)}
              onValueCommit={(v) => {
                setSeeking(false);
                seek(v[0] ?? 0);
              }}
              onPointerDown={() => setSeeking(true)}
              className="flex-1"
            />
            <span className="text-xs font-mono text-white/70 w-12">
              {fmtTime(state.duration)}
            </span>
          </div>

          {/* 按钮组 */}
          <div className="flex items-center gap-1">
            {/* "选择页面":remote 模式下切换控制的 tab(还原原 popup.html #videoTabIndex) */}
            {mode === 'remote' && (
              <select
                value={activeTabId}
                onChange={(e) => {
                  setActiveTabId(Number(e.target.value));
                  setIndex(0);
                  setState(null);
                }}
                className="bg-white/10 rounded px-2 py-1 text-xs text-white border border-white/20 focus:outline-none focus:border-white/40 mr-1 max-w-[200px] truncate"
                title="选择页面"
              >
                {videoTabs.length === 0 ? (
                  <option value={activeTabId}>未检测到有媒体的网页</option>
                ) : (
                  videoTabs.map((t) => (
                    <option key={t.id} value={t.id} className="bg-neutral-900">
                      {t.title || `Tab ${t.id}`}
                    </option>
                  ))
                )}
              </select>
            )}
            {/* 选择媒体(count > 1 时显示,还原原 preview 选择媒体) */}
            {state.count > 1 && (
              <select
                value={index}
                onChange={(e) => setIndex(Number(e.target.value))}
                className="bg-white/10 rounded px-2 py-1 text-xs text-white border border-white/20 focus:outline-none focus:border-white/40 mr-1"
              >
                {Array.from({ length: state.count }, (_, i) => (
                  <option key={i} value={i} className="bg-neutral-900">
                    媒体 {i + 1}
                  </option>
                ))}
              </select>
            )}
            <CtrlButton tip="后退 10 秒" onClick={() => skip(-10)}>
              <RotateCcw className="w-4 h-4" />
            </CtrlButton>
            <CtrlButton tip={state.paused ? '播放' : '暂停'} onClick={togglePlay} variant="primary">
              {state.paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
            </CtrlButton>
            <CtrlButton tip="前进 10 秒" onClick={() => skip(10)}>
              <RotateCw className="w-4 h-4" />
            </CtrlButton>

            <CtrlButton tip={state.muted ? '取消静音' : '静音'} onClick={toggleMuted}>
              {state.muted || state.volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </CtrlButton>
            <Slider
              value={[state.muted ? 0 : state.volume * 100]}
              max={100}
              step={1}
              onValueChange={(v) => setVolume((v[0] ?? 0) / 100)}
              className="w-20"
            />

            <div className="flex-1" />

            {/* 速度 */}
            <select
              value={state.speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
              className="bg-white/10 rounded px-2 py-1 text-xs text-white border border-white/20 focus:outline-none focus:border-white/40"
            >
              {[0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4].map((s) => (
                <option key={s} value={s} className="bg-neutral-900">
                  {s}x
                </option>
              ))}
            </select>

            <CtrlButton tip="循环" onClick={toggleLoop} variant={state.loop ? 'primary' : 'ghost'}>
              <Repeat2 className="w-4 h-4" />
            </CtrlButton>
            <CtrlButton tip="截图" onClick={screenshot}>
              <Camera className="w-4 h-4" />
            </CtrlButton>
            <CtrlButton tip="画中画" onClick={togglePiP}>
              <PictureInPicture2 className="w-4 h-4" />
            </CtrlButton>
            <CtrlButton tip="全屏" onClick={toggleFullscreen}>
              <Maximize className="w-4 h-4" />
            </CtrlButton>
            <CtrlButton tip="下载" onClick={download}>
              <Download className="w-4 h-4" />
            </CtrlButton>
          </div>
        </div>
      </div>
    </Tooltip.Provider>
  );
}

function CtrlButton({
  tip,
  onClick,
  children,
  variant = 'ghost',
}: {
  tip: string;
  onClick: () => void;
  children: React.ReactNode;
  variant?: 'ghost' | 'primary';
}) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <Button variant={variant} size="icon" onClick={onClick} className="text-white hover:bg-white/10">
          {children}
        </Button>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content className="rounded bg-white/90 text-black px-2 py-1 text-xs z-50 shadow">
          {tip}
          <Tooltip.Arrow className="fill-white" />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}
