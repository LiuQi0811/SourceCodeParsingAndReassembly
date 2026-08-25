import { useEffect, useState } from 'react';
import { Download, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@components/ui/Button';
import { cn } from '@lib/utils';

/**
 * 猫抓下载器
 * 还原原 downloader.html + js/downloader.js
 * 当 Chrome 内置 download 失败时(catDown/catDownload),用 fetch(headers) + StreamSaver 落盘
 * 支持 url/name 直接参数,也支持 JSON= 参数(携带 requestHeaders)
 */
type Status = 'idle' | 'downloading' | 'done' | 'error';

interface DownItem {
  url: string;
  name?: string;
  requestHeaders?: Record<string, string>;
}

export default function App() {
  const params = new URLSearchParams(location.search);
  const autoClose = params.get('autoClose') === 'true';
  const [url, setUrl] = useState(params.get('url') || '');
  const [filename, setFilename] = useState(params.get('name') || '');
  const [requestHeaders, setRequestHeaders] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<Status>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');

  // 从 JSON= 参数解析携带请求头的下载任务(由 background catDown 触发)
  useEffect(() => {
    const json = params.get('JSON');
    if (!json) return;
    try {
      const items: DownItem[] = JSON.parse(json);
      if (items.length > 0 && items[0]) {
        const first = items[0];
        if (first.url) setUrl(first.url);
        if (first.name) setFilename(first.name);
        if (first.requestHeaders) setRequestHeaders(first.requestHeaders);
      }
    } catch {
      /* JSON 解析失败,忽略 */
    }
  }, []);

  const start = async () => {
    if (!url) return;
    setStatus('downloading');
    setProgress(0);
    setError('');
    try {
      const res = await fetch(url, { headers: requestHeaders });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const total = Number(res.headers.get('content-length')) || 0;
      const reader = res.body?.getReader();
      if (!reader) throw new Error('No body');
      const chunks: Uint8Array[] = [];
      let received = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          chunks.push(value);
          received += value.byteLength;
          if (total) setProgress(Math.round((received / total) * 100));
        }
      }
      const blob = new Blob(chunks as BlobPart[]);
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename || 'download';
      a.click();
      URL.revokeObjectURL(a.href);
      setStatus('done');
      if (autoClose) {
        setTimeout(() => window.close(), 1000);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus('error');
    }
  };

  return (
    <div className="min-h-screen bg-[var(--color-surface-dim] text-[var(--color-text] flex items-center justify-center p-6">
      <div className="w-full max-w-lg bg-[var(--color-surface] rounded-[--radius-lg] border border-[var(--color-border] p-6 space-y-4">
        <h1 className="text-lg font-semibold flex items-center gap-2">
          <Download className="w-5 h-5 text-[var(--color-primary]" />
          猫抓下载器
        </h1>

        <div className="space-y-2">
          <label className="text-xs text-[var(--color-text-muted]">URL</label>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="w-full px-3 py-2 rounded-[--radius-md] border border-[var(--color-border] bg-[var(--color-surface] text-sm focus:outline-none focus:border-[var(--color-primary]"
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs text-[var(--color-text-muted]">文件名</label>
          <input
            value={filename}
            onChange={(e) => setFilename(e.target.value)}
            className="w-full px-3 py-2 rounded-[--radius-md] border border-[var(--color-border] bg-[var(--color-surface] text-sm focus:outline-none focus:border-[var(--color-primary]"
          />
        </div>

        {status === 'downloading' && (
          <div className="space-y-1">
            <div className="h-2 bg-[var(--color-surface-dim] rounded-full overflow-hidden">
              <div
                className="h-full bg-[var(--color-primary] transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-[var(--color-text-muted] text-right">
              {progress}%
            </p>
          </div>
        )}

        {status === 'done' && (
          <div className="flex items-center gap-2 text-[var(--color-success] text-sm">
            <CheckCircle2 className="w-4 h-4" />
            下载完成
          </div>
        )}

        {status === 'error' && (
          <div className="flex items-center gap-2 text-[var(--color-danger] text-sm">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}

        <Button
          variant="primary"
          className="w-full"
          disabled={status === 'downloading' || !url}
          onClick={start}
        >
          {status === 'downloading' ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Download className="w-4 h-4" />
          )}
          {status === 'downloading' ? '下载中...' : '下载'}
        </Button>
      </div>
    </div>
  );
}
