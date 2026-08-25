import { useEffect, useState } from 'react';

export type RecorderMode = 'video' | 'screen' | 'webrtc';

type Phase = 'ready' | 'recording' | 'complete' | 'error';

interface VideoItem {
  src: string;
  index: number;
}
interface TrackItem {
  label: string;
  index: number;
}
interface CompletePayload {
  url: string;
  filename: string;
  size?: number;
}

/**
 * 各 mode 对应的 MAIN world 脚本配置
 * - source: postMessage 通信时使用的 source 字段
 * - title:  浮层标题文案
 * - script: 关闭时通过 catCatchCloseScript 通知的脚本名
 */
const MODE_CONFIG: Record<RecorderMode, { source: string; title: string; script: string }> = {
  video: { source: 'catCatchRecorder', title: '视频录制', script: 'recorder.js' },
  screen: { source: 'catCatchRecorder2', title: '屏幕录制', script: 'recorder2.js' },
  webrtc: { source: 'catCatchWebRTC', title: 'WebRTC 录制', script: 'webrtc.js' },
};

const MIME_OPTIONS = [
  { value: 'video/webm;codecs=vp9,opus', label: 'webm vp9' },
  { value: 'video/webm;codecs=vp8,opus', label: 'webm vp8' },
  { value: 'video/webm;codecs=h264,opus', label: 'webm h264' },
  { value: 'video/webm;codecs=h264', label: 'webm h264 (无音频)' },
  { value: 'video/webm', label: 'webm' },
  { value: 'video/mp4', label: 'mp4' },
];

/**
 * 统一录制浮层 —— 替代 recorder.js / recorder2.js / webrtc.js 的 Shadow DOM UI
 * 通过 window.postMessage 与 MAIN world 录制脚本通信,source 字段区分脚本
 * inline style 隔离页面 CSS,不依赖 tailwind(模拟 radix-ui 暗色主题)
 *
 * 卡片本身不使用 position: fixed,由外层容器(content script 创建的 flex 容器)
 * 统一控制位置,以支持多 mode 同时挂载时自然垂直堆叠
 */
export function RecorderOverlay({ mode, onClose }: { mode: RecorderMode; onClose?: () => void }) {
  const cfg = MODE_CONFIG[mode];
  const source = cfg.source;

  const [phase, setPhase] = useState<Phase>('ready');
  const [error, setError] = useState('');
  const [result, setResult] = useState<CompletePayload | null>(null);
  const [minimized, setMinimized] = useState(false);

  // 共享:码率
  const [videoBits, setVideoBits] = useState(5000000);
  const [audioBits, setAudioBits] = useState(128000);

  // video mode 状态
  const [videoList, setVideoList] = useState<VideoItem[]>([]);
  const [videoIndex, setVideoIndex] = useState(0);
  const [mimeType, setMimeType] = useState('video/webm;codecs=vp9,opus');
  const [frameRate, setFrameRate] = useState(0);
  const [ffmpeg, setFFmpeg] = useState(false);
  const [autoSave1, setAutoSave1] = useState(false);

  // webrtc mode 状态
  const [videoTracks, setVideoTracks] = useState<TrackItem[]>([]);
  const [audioTracks, setAudioTracks] = useState<TrackItem[]>([]);
  const [videoTrack, setVideoTrack] = useState(-1);
  const [audioTrack, setAudioTrack] = useState(-1);
  const [time, setTime] = useState('');

  const post = (action: string, payload: Record<string, unknown> = {}) =>
    window.postMessage({ action, ...payload }, '*');

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.source !== window) return;
      const d = e.data as Record<string, unknown> | null;
      if (!d || d.source !== source) return;
      const action = d.action as string | undefined;
      if (!action) return;
      switch (action) {
        case `${source}.state`:
          setPhase(d.recording ? 'recording' : 'ready');
          break;
        case `${source}.complete`: {
          const payload: CompletePayload = {
            url: String(d.url ?? ''),
            filename: String(d.filename ?? 'recording'),
          };
          if (typeof d.size === 'number') payload.size = d.size;
          setResult(payload);
          setPhase('complete');
          break;
        }
        case `${source}.error`:
          setError(String(d.message ?? '未知错误'));
          setPhase('error');
          break;
        case `${source}.videoList`:
          if (mode === 'video') {
            const list = (d.list as VideoItem[] | undefined) ?? [];
            setVideoList(list);
            setVideoIndex(list.length ? list[0]?.index ?? 0 : 0);
          }
          break;
        case `${source}.tracks`:
          if (mode === 'webrtc') {
            const v = (d.video as TrackItem[] | undefined) ?? [];
            const a = (d.audio as TrackItem[] | undefined) ?? [];
            setVideoTracks(v);
            setAudioTracks(a);
            setVideoTrack(v.length ? v[0]?.index ?? -1 : -1);
            setAudioTrack(a.length ? a[0]?.index ?? -1 : -1);
          }
          break;
        case `${source}.time`:
          if (mode === 'webrtc') setTime(String(d.time ?? ''));
          break;
      }
    };
    window.addEventListener('message', onMsg);
    // 主动查询当前状态
    post(`${source}.getState`);
    if (mode === 'video') post(`${source}.getVideo`);
    return () => window.removeEventListener('message', onMsg);
  }, [mode, source]);

  const start = () => {
    setError('');
    setResult(null);
    setPhase('recording');
    if (mode === 'video') {
      post(`${source}.start`, {
        videoIndex,
        mimeType,
        videoBits,
        audioBits,
        frameRate,
        ffmpeg,
        autoSave1,
      });
    } else if (mode === 'screen') {
      post(`${source}.start`, { videoBits, audioBits });
    } else {
      post(`${source}.start`, {
        videoTrack,
        audioTrack,
        mimeType,
        videoBits,
        audioBits,
        autoSave1,
      });
    }
  };
  const stop = () => post(`${source}.stop`);
  const save = () => post(`${source}.save`);
  const refreshVideos = () => post(`${source}.getVideo`);
  const close = () => {
    // 调试:确认 close 被触发 + 消息发出
    console.log('[cat-catch] RecorderOverlay close()', { mode, source, script: cfg.script });
    // 1) 通知 MAIN world 脚本停止 MediaRecorder + 清理
    post(`${source}.close`);
    // 2) 通知 content script 卸载浮层 + 通知 background 关闭脚本
    window.postMessage({ action: 'catCatchCloseScript', script: cfg.script }, '*');
    // 3) 直接调用 content script 的 unmount(React prop,最可靠,不依赖 postMessage 往返)
    onClose?.();
  };
  const download = () => {
    if (!result) return;
    const a = document.createElement('a');
    a.href = result.url;
    a.download = result.filename;
    a.click();
  };

  // ===== inline styles(暗色 radix-ui 风格) =====
  const cardStyle: React.CSSProperties = {
    background: 'rgb(17 17 17 / 0.95)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    color: '#fff',
    borderRadius: '12px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    fontSize: '13px',
    overflow: 'hidden',
    border: '1px solid rgba(255,255,255,0.1)',
    width: minimized ? 'auto' : '300px',
    pointerEvents: 'auto',
  };
  const headerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 14px',
    borderBottom: minimized ? 'none' : '1px solid rgba(255,255,255,0.08)',
    userSelect: 'none',
  };
  // 标题区(可点击折叠/展开)
  const titleAreaStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flex: 1,
    minWidth: 0,
    cursor: 'pointer',
  };
  // 右上角 X 关闭按钮(始终可见)
  const closeXStyle: React.CSSProperties = {
    flex: 'none',
    width: '22px',
    height: '22px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '6px',
    border: 'none',
    background: 'rgba(255,255,255,0.06)',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '14px',
    lineHeight: 1,
    transition: 'background 0.15s',
  };
  // 折叠箭头
  const toggleStyle: React.CSSProperties = {
    flex: 'none',
    opacity: 0.6,
    cursor: 'pointer',
    padding: '0 4px',
  };
  // 底部"关闭"按钮容器(始终可见)
  const footerStyle: React.CSSProperties = {
    padding: '8px 14px',
    borderTop: minimized ? 'none' : '1px solid rgba(255,255,255,0.08)',
  };
  const dotStyle: React.CSSProperties = {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background:
      phase === 'recording'
        ? '#ef4444'
        : phase === 'complete'
          ? '#22c55e'
          : phase === 'error'
            ? '#f59e0b'
            : '#3b82f6',
    flex: 'none',
    boxShadow: phase === 'recording' ? '0 0 8px #ef4444' : 'none',
  };
  const btnStyle = (variant: 'primary' | 'ghost' | 'danger'): React.CSSProperties => ({
    flex: 1,
    padding: '8px 0',
    borderRadius: '8px',
    border: 'none',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 500,
    transition: 'opacity 0.15s',
    background:
      variant === 'primary'
        ? '#3b82f6'
        : variant === 'danger'
          ? '#ef4444'
          : 'rgba(255,255,255,0.08)',
    color: '#fff',
  });
  const selectStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: '6px',
    color: '#fff',
    padding: '5px 8px',
    fontSize: '12px',
    flex: 1,
    minWidth: 0,
    maxWidth: '180px',
    outline: 'none',
  };
  const labelStyle: React.CSSProperties = {
    color: 'rgba(255,255,255,0.6)',
    fontSize: '11px',
    minWidth: '32px',
    flex: 'none',
  };
  const rowStyle: React.CSSProperties = {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
  };
  const checkboxRowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    color: 'rgba(255,255,255,0.8)',
    fontSize: '12px',
    cursor: 'pointer',
  };
  const checkboxStyle: React.CSSProperties = {
    accentColor: '#3b82f6',
  };
  const titleText =
    phase === 'recording'
      ? `${cfg.title} · 录制中`
      : phase === 'complete'
        ? `${cfg.title} · 完成`
        : phase === 'error'
          ? `${cfg.title} · 错误`
          : cfg.title;

  return (
    <div style={cardStyle}>
      <div style={headerStyle}>
        <div
          style={titleAreaStyle}
          onClick={() => setMinimized((m) => !m)}
          title={minimized ? '展开' : '折叠'}
        >
          <span style={dotStyle} />
          <span style={{ fontWeight: 600 }}>{titleText}</span>
          {mode === 'webrtc' && time && (
            <span style={{ marginLeft: '4px', opacity: 0.7, fontVariantNumeric: 'tabular-nums' }}>
              {time}
            </span>
          )}
          <span style={toggleStyle}>{minimized ? '▲' : '▼'}</span>
        </div>
        {/* 右上角 X 关闭按钮:始终可见,所有 phase + minimized 状态都能关闭 */}
        <button
          type="button"
          style={closeXStyle}
          onClick={(e) => {
            // 阻止冒泡到 titleArea,避免触发折叠
            e.stopPropagation();
            close();
          }}
          title="关闭"
          aria-label="关闭"
        >
          ✕
        </button>
      </div>
      {!minimized && (
        <div
          style={{
            padding: '12px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}
        >
          {phase === 'recording' ? (
            <>
              <button style={btnStyle('danger')} onClick={stop}>
                停止录制
              </button>
              {mode === 'webrtc' && (
                <button style={btnStyle('ghost')} onClick={save}>
                  保存当前片段
                </button>
              )}
            </>
          ) : (
            <>
              {mode === 'video' && (
                <>
                  <div style={rowStyle}>
                    <span style={labelStyle}>视频</span>
                    <select
                      style={selectStyle}
                      value={videoIndex}
                      onChange={(e) => setVideoIndex(Number(e.target.value))}
                    >
                      {videoList.length === 0 && <option value={0}>未检测到视频</option>}
                      {videoList.map((v) => (
                        <option key={v.index} value={v.index}>
                          {v.src}
                        </option>
                      ))}
                    </select>
                    <button
                      style={{
                        ...btnStyle('ghost'),
                        flex: 'none',
                        padding: '5px 10px',
                      }}
                      onClick={refreshVideos}
                    >
                      刷新
                    </button>
                  </div>
                  <div style={rowStyle}>
                    <span style={labelStyle}>编码</span>
                    <select
                      style={selectStyle}
                      value={mimeType}
                      onChange={(e) => setMimeType(e.target.value)}
                    >
                      {MIME_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div style={rowStyle}>
                    <span style={labelStyle}>码率</span>
                    <select
                      style={selectStyle}
                      value={videoBits}
                      onChange={(e) => setVideoBits(Number(e.target.value))}
                    >
                      <option value={2500000}>2.5 Mbps</option>
                      <option value={5000000}>5 Mbps</option>
                      <option value={8000000}>8 Mbps</option>
                      <option value={16000000}>16 Mbps</option>
                    </select>
                    <select
                      style={selectStyle}
                      value={audioBits}
                      onChange={(e) => setAudioBits(Number(e.target.value))}
                    >
                      <option value={128000}>128 kbps</option>
                      <option value={256000}>256 kbps</option>
                    </select>
                  </div>
                  <div style={rowStyle}>
                    <span style={labelStyle}>帧率</span>
                    <select
                      style={selectStyle}
                      value={frameRate}
                      onChange={(e) => setFrameRate(Number(e.target.value))}
                    >
                      <option value={0}>自动帧率</option>
                      <option value={25}>25 FPS</option>
                      <option value={30}>30 FPS</option>
                      <option value={60}>60 FPS</option>
                      <option value={120}>120 FPS</option>
                    </select>
                  </div>
                  <label style={checkboxRowStyle}>
                    <input
                      type="checkbox"
                      style={checkboxStyle}
                      checked={ffmpeg}
                      onChange={(e) => setFFmpeg(e.target.checked)}
                    />
                    使用 ffmpeg 转码
                  </label>
                  <label style={checkboxRowStyle}>
                    <input
                      type="checkbox"
                      style={checkboxStyle}
                      checked={autoSave1}
                      onChange={(e) => setAutoSave1(e.target.checked)}
                    />
                    1 小时保存一次
                  </label>
                </>
              )}
              {mode === 'screen' && (
                <>
                  <div style={rowStyle}>
                    <span style={labelStyle}>码率</span>
                    <select
                      style={selectStyle}
                      value={videoBits}
                      onChange={(e) => setVideoBits(Number(e.target.value))}
                    >
                      <option value={2500000}>2.5 Mbps</option>
                      <option value={5000000}>5 Mbps</option>
                      <option value={8000000}>8 Mbps</option>
                      <option value={16000000}>16 Mbps</option>
                    </select>
                    <select
                      style={selectStyle}
                      value={audioBits}
                      onChange={(e) => setAudioBits(Number(e.target.value))}
                    >
                      <option value={128000}>128 kbps</option>
                      <option value={256000}>256 kbps</option>
                    </select>
                  </div>
                </>
              )}
              {mode === 'webrtc' && (
                <>
                  <div style={rowStyle}>
                    <span style={labelStyle}>视频</span>
                    <select
                      style={selectStyle}
                      value={videoTrack}
                      onChange={(e) => setVideoTrack(Number(e.target.value))}
                    >
                      <option value={-1}>不录制视频</option>
                      {videoTracks.map((t) => (
                        <option key={t.index} value={t.index}>
                          {t.label || `视频 ${t.index + 1}`}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div style={rowStyle}>
                    <span style={labelStyle}>音频</span>
                    <select
                      style={selectStyle}
                      value={audioTrack}
                      onChange={(e) => setAudioTrack(Number(e.target.value))}
                    >
                      <option value={-1}>不录制音频</option>
                      {audioTracks.map((t) => (
                        <option key={t.index} value={t.index}>
                          {t.label || `音频 ${t.index + 1}`}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div style={rowStyle}>
                    <span style={labelStyle}>编码</span>
                    <select
                      style={selectStyle}
                      value={mimeType}
                      onChange={(e) => setMimeType(e.target.value)}
                    >
                      {MIME_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div style={rowStyle}>
                    <span style={labelStyle}>码率</span>
                    <select
                      style={selectStyle}
                      value={videoBits}
                      onChange={(e) => setVideoBits(Number(e.target.value))}
                    >
                      <option value={2500000}>2.5 Mbps</option>
                      <option value={5000000}>5 Mbps</option>
                      <option value={8000000}>8 Mbps</option>
                      <option value={16000000}>16 Mbps</option>
                    </select>
                    <select
                      style={selectStyle}
                      value={audioBits}
                      onChange={(e) => setAudioBits(Number(e.target.value))}
                    >
                      <option value={128000}>128 kbps</option>
                      <option value={256000}>256 kbps</option>
                    </select>
                  </div>
                  <label style={checkboxRowStyle}>
                    <input
                      type="checkbox"
                      style={checkboxStyle}
                      checked={autoSave1}
                      onChange={(e) => setAutoSave1(e.target.checked)}
                    />
                    1 小时保存一次
                  </label>
                </>
              )}
              <button style={btnStyle('primary')} onClick={start}>
                开始录制
              </button>
            </>
          )}
          {phase === 'complete' && result && (
            <div style={{ display: 'flex', gap: '8px' }}>
              <a
                href={result.url}
                target="_blank"
                rel="noreferrer"
                style={{
                  ...btnStyle('ghost'),
                  textAlign: 'center',
                  textDecoration: 'none',
                }}
              >
                预览
              </a>
              <button style={btnStyle('primary')} onClick={download}>
                下载
              </button>
            </div>
          )}
          {phase === 'error' && (
            <div style={{ color: '#f59e0b', fontSize: '12px', lineHeight: 1.4 }}>{error}</div>
          )}
        </div>
      )}
      {/* 底部"关闭"按钮:始终可见(所有 phase + minimized 状态) */}
      <div style={footerStyle}>
        <button style={btnStyle('ghost')} onClick={close} title="关闭">
          关闭
        </button>
      </div>
    </div>
  );
}
