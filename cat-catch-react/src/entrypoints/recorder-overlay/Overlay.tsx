import { useEffect, useState } from 'react';

type Phase = 'ready' | 'recording' | 'complete' | 'error';

interface CompletePayload {
  url: string;
  filename: string;
  size: number;
}

/**
 * 屏幕录制浮层 —— 替代原 recorder2.js 的 Shadow DOM UI
 * 通过 window.postMessage 与 MAIN world 的 recorder2.js 录制逻辑通信
 * inline style 隔离页面 CSS,不依赖 tailwind
 */
export function Overlay() {
  const [phase, setPhase] = useState<Phase>('ready');
  const [error, setError] = useState('');
  const [result, setResult] = useState<CompletePayload | null>(null);
  const [videoBits, setVideoBits] = useState(5000000);
  const [audioBits, setAudioBits] = useState(128000);
  const [minimized, setMinimized] = useState(false);

  const post = (action: string, payload: Record<string, unknown> = {}) =>
    window.postMessage({ action, ...payload }, '*');

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.source !== window) return;
      const d = e.data;
      if (!d || d.source !== 'catCatchRecorder2') return;
      switch (d.action) {
        case 'catCatchRecorder2.state':
          setPhase(d.recording ? 'recording' : 'ready');
          break;
        case 'catCatchRecorder2.complete':
          setResult({ url: d.url, filename: d.filename, size: d.size });
          setPhase('complete');
          break;
        case 'catCatchRecorder2.error':
          setError(d.message || '未知错误');
          setPhase('error');
          break;
      }
    };
    window.addEventListener('message', onMsg);
    // 查询当前状态
    post('catCatchRecorder2.getState');
    return () => window.removeEventListener('message', onMsg);
  }, []);

  const start = () => {
    setError('');
    setResult(null);
    setPhase('recording');
    post('catCatchRecorder2.start', { videoBits, audioBits });
  };
  const stop = () => post('catCatchRecorder2.stop');
  const close = () => {
    post('catCatchRecorder2.close');
    window.postMessage({ action: 'catCatchCloseScript', script: 'recorder2.js' }, '*');
  };
  const download = () => {
    if (!result) return;
    const a = document.createElement('a');
    a.href = result.url;
    a.download = result.filename;
    a.click();
  };

  const cardStyle: React.CSSProperties = {
    position: 'fixed',
    bottom: '20px',
    right: '20px',
    zIndex: 2147483647,
    background: 'rgb(17 17 17 / 0.95)',
    backdropFilter: 'blur(12px)',
    color: '#fff',
    borderRadius: '12px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    fontSize: '13px',
    overflow: 'hidden',
    border: '1px solid rgba(255,255,255,0.1)',
    width: minimized ? 'auto' : '280px',
  };
  const headerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 14px',
    borderBottom: minimized ? 'none' : '1px solid rgba(255,255,255,0.08)',
    cursor: 'pointer',
    userSelect: 'none',
  };
  const dotStyle: React.CSSProperties = {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background: phase === 'recording' ? '#ef4444' : phase === 'complete' ? '#22c55e' : phase === 'error' ? '#f59e0b' : '#3b82f6',
    flex: 'none',
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
    background: variant === 'primary' ? '#3b82f6' : variant === 'danger' ? '#ef4444' : 'rgba(255,255,255,0.08)',
    color: '#fff',
  });
  const selectStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: '6px',
    color: '#fff',
    padding: '4px 6px',
    fontSize: '12px',
  };
  const labelStyle: React.CSSProperties = { color: 'rgba(255,255,255,0.6)', fontSize: '11px' };

  return (
    <div style={cardStyle}>
      <div style={headerStyle} onClick={() => setMinimized((m) => !m)}>
        <span style={dotStyle} />
        <span style={{ fontWeight: 600 }}>
          {phase === 'recording' ? '录制中...' : phase === 'complete' ? '录制完成' : phase === 'error' ? '错误' : '屏幕录制'}
        </span>
        <span style={{ marginLeft: 'auto', opacity: 0.5 }}>{minimized ? '▲' : '▼'}</span>
      </div>
      {!minimized && (
        <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {phase === 'recording' ? (
            <button style={btnStyle('danger')} onClick={stop}>停止录制</button>
          ) : (
            <>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span style={labelStyle}>视频</span>
                <select style={selectStyle} value={videoBits} onChange={(e) => setVideoBits(Number(e.target.value))}>
                  <option value={2500000}>2.5 Mbps</option>
                  <option value={5000000}>5 Mbps</option>
                  <option value={8000000}>8 Mbps</option>
                  <option value={16000000}>16 Mbps</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span style={labelStyle}>音频</span>
                <select style={selectStyle} value={audioBits} onChange={(e) => setAudioBits(Number(e.target.value))}>
                  <option value={128000}>128 kbps</option>
                  <option value={256000}>256 kbps</option>
                </select>
              </div>
              <button style={btnStyle('primary')} onClick={start}>开始录制</button>
            </>
          )}
          {phase === 'complete' && result && (
            <div style={{ display: 'flex', gap: '8px' }}>
              <a href={result.url} target="_blank" rel="noreferrer" style={{ ...btnStyle('ghost'), textAlign: 'center', textDecoration: 'none' }}>预览</a>
              <button style={btnStyle('primary')} onClick={download}>下载</button>
            </div>
          )}
          {phase === 'error' && (
            <div style={{ color: '#f59e0b', fontSize: '12px' }}>{error}</div>
          )}
          <button style={{ ...btnStyle('ghost'), marginTop: 4 }} onClick={close}>关闭</button>
        </div>
      )}
    </div>
  );
}
