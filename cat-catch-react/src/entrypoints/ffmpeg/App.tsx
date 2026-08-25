import { useState } from 'react';
import { useSettingsStore } from '@stores/settings';
import { Button } from '@components/ui/Button';
import { RefreshCw, ExternalLink } from 'lucide-react';

/**
 * 在线 FFmpeg 页面 —— 内嵌 FFmpeg 在线服务(还原原 popup.html go="ffmpegURL")
 * background 的 catCatchFFmpeg 消息会与此在线服务通信(payload.Message='ffmpeg')
 * 原项目通过 popup 直接跳转在线 URL,新框架整合为扩展内 iframe 页面
 */
export default function App() {
  const ffmpegUrl = useSettingsStore((s) => s.ffmpegConfig.url);
  const [url, setUrl] = useState(ffmpegUrl);
  const [iframeKey, setIframeKey] = useState(0);

  const refresh = () => setIframeKey((k) => k + 1);
  const openExternal = () => window.open(url, '_blank');
  const applyUrl = () => {
    setUrl(url.trim());
    refresh();
  };

  return (
    <div className="min-h-screen flex flex-col bg-white text-neutral-900">
      {/* 工具栏 */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-neutral-200 bg-white">
        <h1 className="text-sm font-medium mr-2">在线 FFmpeg</h1>
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') applyUrl();
          }}
          className="flex-1 px-3 py-1.5 text-sm rounded border border-neutral-300 focus:outline-none focus:border-blue-500"
          placeholder="FFmpeg 在线服务 URL"
        />
        <Button variant="ghost" size="icon" title="刷新" onClick={refresh}>
          <RefreshCw className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="icon" title="新标签打开" onClick={openExternal}>
          <ExternalLink className="w-4 h-4" />
        </Button>
      </div>
      {/* iframe 内嵌在线 FFmpeg */}
      {url ? (
        <iframe
          key={iframeKey}
          src={url}
          className="flex-1 border-0 w-full"
          title="在线 FFmpeg"
          allow="clipboard-read; clipboard-write; fullscreen"
        />
      ) : (
        <div className="flex-1 flex items-center justify-center text-neutral-400">
          请输入 FFmpeg 在线服务 URL
        </div>
      )}
    </div>
  );
}
