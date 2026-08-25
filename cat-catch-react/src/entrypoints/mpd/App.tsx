import { useEffect, useMemo, useState, useCallback } from 'react';
import {
  Film,
  Music,
  Play,
  Loader2,
  AlertCircle,
  ExternalLink,
  FileText,
} from 'lucide-react';
import { Button } from '@components/ui/Button';
import {
  parseMPD,
  fetchMPD,
  isDRM,
  playlistToM3u8,
  formatVideoOption,
  formatAudioOption,
  type MpdParsedManifest,
  type MpdPlaylist,
  type MpdDrmInfo,
} from '@lib/mpd-parser';
import { secToTime } from '@lib/function';

/**
 * MPD(DASH) 解析器
 * 1:1 还原原 mpd.html + js/mpd.js(186 行)的交互
 *
 * 依赖 src/public/lib/mpd-parser.min.js(原 lib/mpd-parser.min.js)
 * 通过 mpd/index.html 的 <script src="/lib/mpd-parser.min.js"> 全局注入 window.mpdParser
 *
 * 流程:
 *   1. URL 输入 / ?url= 参数自动解析
 *   2. fetchMPD -> parseMPD -> 渲染视频/音频码率列表 + 切片列表
 *   3. videoToM3u8/audioToM3u8: 把选中的码率转成 m3u8 文本
 *      chrome.tabs.create({ url: `m3u8.html?getMpdId=${currentTabId}` })
 *   4. m3u8 页通过 sendMessage('getM3u8') 拉取本页面缓存的 m3u8Content / mediaInfo
 */
type Phase = 'input' | 'main' | 'error';

interface AudioKey {
  group: string;
  index: number;
  playlist: MpdPlaylist;
}

export default function App() {
  const params = useMemo(() => new URLSearchParams(location.search), []);
  const [url, setUrl] = useState(params.get('url') ?? '');
  const [referer, setReferer] = useState(params.get('referer') ?? '');
  const [phase, setPhase] = useState<Phase>('input');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [drmInfo, setDrmInfo] = useState<MpdDrmInfo[]>([]);

  const [mpd, setMpd] = useState<MpdParsedManifest | null>(null);
  const [videoIndex, setVideoIndex] = useState(0);
  const [audioIndex, setAudioIndex] = useState(0);
  const [segmentList, setSegmentList] = useState<string>('');

  // 给 m3u8 页面回读的临时缓存(还原 mpd.js 的 m3u8Content / mediaInfo)
  const [m3u8Content, setM3u8Content] = useState('');
  const [mediaInfo, setMediaInfo] = useState('');

  // ===== 监听 m3u8 页面的 getM3u8 请求(还原 mpd.js chrome.runtime.onMessage) =====
  useEffect(() => {
    const listener = (
      msg: unknown,
      _sender: chrome.runtime.MessageSender,
      sendResponse: (resp?: unknown) => void,
    ) => {
      if (msg === 'getM3u8') {
        sendResponse({ m3u8Content, mediaInfo });
        return true;
      }
      return false;
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, [m3u8Content, mediaInfo]);

  // ===== 自动解析 url 参数 =====
  useEffect(() => {
    if (params.get('url')) {
      void parse(params.get('url')!);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ===== 解析 MPD =====
  const parse = useCallback(
    async (targetUrl?: string) => {
      const u = targetUrl?.trim() ?? url.trim();
      if (!u) return;
      setLoading(true);
      setError('');
      setDrmInfo([]);
      try {
        const text = await fetchMPD(u, referer ? { referer } : undefined);
        const parsed = parseMPD(text, u);
        setMpd(parsed);
        // DRM 检测
        const drm = isDRM(text);
        setDrmInfo(drm);
        setUrl(u);
        setPhase(drm.length ? 'error' : 'main');
        // 默认显示第一个视频码率
        if (parsed.playlists.length > 0) {
          setVideoIndex(0);
          showSegment('video', 0, parsed);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setPhase('error');
      } finally {
        setLoading(false);
      }
    },
    [url, referer],
  );

  // ===== 显示某个码率的切片列表(还原 mpd.js showSegment) =====
  const showSegment = useCallback(
    (type: 'video' | 'audio', index: number, manifest?: MpdParsedManifest) => {
      const m = manifest ?? mpd;
      if (!m) return;
      let playlist: MpdPlaylist | undefined;
      if (type === 'video') {
        playlist = m.playlists[index];
      } else {
        const audioGroups = m.mediaGroups?.AUDIO?.audio ?? {};
        for (const groupName of Object.keys(audioGroups)) {
          const list = audioGroups[groupName]?.playlists ?? [];
          for (let i = 0; i < list.length; i++) {
            const key = `${groupName}$-bmmmd-$${i}`;
            if (key === `${audioIndex}` || i === index) {
              playlist = list[i];
              break;
            }
          }
        }
        // index 直接传时遍历查找(简化版)
        if (!playlist) {
          for (const groupName of Object.keys(audioGroups)) {
            const list = audioGroups[groupName]?.playlists ?? [];
            if (index < list.length) {
              playlist = list[index];
              break;
            }
          }
        }
      }
      if (!playlist) return;
      const lines = playlist.segments.map((s) => s.resolvedUri).join('\n\n');
      setSegmentList(lines + '\n');
    },
    [mpd, audioIndex],
  );

  // ===== 转换为 m3u8 并打开 m3u8.html(还原 mpd.js videoToM3u8/audioToM3u8) =====
  const convertToM3u8 = useCallback(
    async (type: 'video' | 'audio') => {
      if (!mpd) return;
      let playlist: MpdPlaylist | undefined;
      let info = '';
      if (type === 'video') {
        playlist = mpd.playlists[videoIndex];
        if (playlist) info = `video: ${formatVideoOption(playlist, videoIndex)}`;
      } else {
        const audioGroups = mpd.mediaGroups?.AUDIO?.audio ?? {};
        const entries = Object.entries(audioGroups);
        for (const [groupName, group] of entries) {
          if (audioIndex < group.playlists.length) {
            playlist = group.playlists[audioIndex];
            if (playlist) info = `audio: ${formatAudioOption(groupName, playlist)}`;
            break;
          }
        }
      }
      if (!playlist) return;
      const m3u8 = playlistToM3u8(playlist);
      setM3u8Content(m3u8);
      setMediaInfo(info);
      // 取当前 tab id,以 ?getMpdId 形式打开 m3u8 页面
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) return;
      await chrome.tabs.create({ url: `m3u8.html?getMpdId=${tab.id}` });
    },
    [mpd, videoIndex, audioIndex],
  );

  // 拼接音频码率列表(还原 mpd.js 遍历 mediaGroups.AUDIO.audio)
  const audioEntries = useMemo<AudioKey[]>(() => {
    if (!mpd?.mediaGroups?.AUDIO?.audio) return [];
    const out: AudioKey[] = [];
    for (const [group, entry] of Object.entries(mpd.mediaGroups.AUDIO.audio)) {
      entry.playlists.forEach((pl, idx) => out.push({ group, index: idx, playlist: pl }));
    }
    return out;
  }, [mpd]);

  const totalSegments = useMemo(() => {
    if (segmentList) {
      const matches = segmentList.match(/\S+/g);
      return matches ? matches.length : 0;
    }
    return 0;
  }, [segmentList]);

  const currentInitSegment = useMemo(() => {
    if (!mpd) return '';
    let playlist: MpdPlaylist | undefined;
    if (phase === 'main' && mpd.playlists[videoIndex]) {
      playlist = mpd.playlists[videoIndex];
    }
    return playlist?.segments[0]?.map?.resolvedUri ?? '';
  }, [mpd, videoIndex, phase]);

  return (
    <div className="min-h-screen bg-[var(--color-surface-dim] text-[var(--color-text]">
      <header className="border-b border-[var(--color-border] bg-[var(--color-surface] px-6 py-3">
        <h1 className="text-lg font-semibold flex items-center gap-2">
          <Film className="w-5 h-5 text-[var(--color-primary]" />
          MPD 解析器
        </h1>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-4">
        {loading && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-[--radius-md] bg-[var(--color-surface] border border-[var(--color-border] text-sm">
            <Loader2 className="w-4 h-4 animate-spin text-[var(--color-primary]" />
            解析中...
          </div>
        )}

        {error && phase === 'error' && !loading && (
          <div className="space-y-3">
            <div className="flex items-start gap-2 px-3 py-2 rounded-[--radius-md] bg-[var(--color-danger]/10 text-[var(--color-danger] text-sm">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span className="flex-1">{error || '解析失败'}</span>
            </div>
            {drmInfo.length > 0 && (
              <div className="bg-[var(--color-surface] rounded-[--radius-md] border border-[var(--color-border] p-3 space-y-2">
                <div className="text-sm font-semibold text-[var(--color-warning]">
                  检测到 DRM 加密
                </div>
                {drmInfo.map((drm, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="text-xs font-medium">{drm.encryptionType}</div>
                    <input
                      readOnly
                      value={drm.pssh}
                      className="w-full px-2 py-1 text-xs font-mono bg-[var(--color-surface-dim] border border-[var(--color-border] rounded"
                    />
                  </div>
                ))}
              </div>
            )}
            <Button variant="outline" onClick={() => setPhase('input')}>
              返回
            </Button>
          </div>
        )}

        {phase === 'input' && !loading && (
          <div className="space-y-3">
            <div>
              <label className="text-xs text-[var(--color-text-muted]">MPD URL</label>
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && void parse()}
                placeholder="粘贴 .mpd URL"
                className="w-full mt-1 px-3 py-2 rounded-[--radius-md] border border-[var(--color-border] bg-[var(--color-surface] text-sm focus:outline-none focus:border-[var(--color-primary]"
              />
            </div>
            <div>
              <label className="text-xs text-[var(--color-text-muted]">Referer(可选)</label>
              <input
                value={referer}
                onChange={(e) => setReferer(e.target.value)}
                placeholder="https://example.com/"
                className="w-full mt-1 px-3 py-2 rounded-[--radius-md] border border-[var(--color-border] bg-[var(--color-surface] text-sm focus:outline-none focus:border-[var(--color-primary]"
              />
            </div>
            <Button variant="primary" onClick={() => void parse()} disabled={loading || !url.trim()}>
              <Play className="w-4 h-4" />
              解析
            </Button>
          </div>
        )}

        {phase === 'main' && mpd && (
          <div className="space-y-4">
            {/* MPD URL 信息 */}
            <div className="bg-[var(--color-surface] rounded-[--radius-md] border border-[var(--color-border] p-3 space-y-1">
              <div className="text-xs text-[var(--color-text-muted]">MPD URL</div>
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-[var(--color-primary] break-all hover:underline flex items-start gap-1"
              >
                <ExternalLink className="w-3 h-3 mt-0.5 shrink-0" />
                {url}
              </a>
            </div>

            {/* 初始化片段 */}
            {currentInitSegment && (
              <div className="bg-[var(--color-surface] rounded-[--radius-md] border border-[var(--color-border] p-3 space-y-1">
                <div className="text-xs text-[var(--color-text-muted]">initialization</div>
                <input
                  readOnly
                  spellCheck={false}
                  value={currentInitSegment}
                  className="w-full px-2 py-1 text-xs font-mono bg-[var(--color-surface-dim] border border-[var(--color-border] rounded"
                />
              </div>
            )}

            {/* 信息条 */}
            <div className="flex items-center gap-4 px-3 py-2 bg-[var(--color-surface] rounded-[--radius-md] border border-[var(--color-border] text-sm">
              <span>
                共 <strong>{totalSegments}</strong> 切片
              </span>
              <span className="text-[var(--color-text-muted]">|</span>
              <span>时长 {secToTime(mpd.duration)}</span>
            </div>

            {/* 切片列表 */}
            <div className="bg-[var(--color-surface] rounded-[--radius-md] border border-[var(--color-border] p-3">
              <textarea
                value={segmentList}
                readOnly
                spellCheck={false}
                className="w-full h-48 px-2 py-1 text-xs font-mono bg-[var(--color-surface-dim] border border-[var(--color-border] rounded resize-y"
              />
            </div>

            {/* 视频码率列表 */}
            <div className="bg-[var(--color-surface] rounded-[--radius-md] border border-[var(--color-border] p-3 space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Film className="w-4 h-4 text-[var(--color-primary]" />
                视频码率
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={videoIndex}
                  onChange={(e) => {
                    const idx = Number(e.target.value);
                    setVideoIndex(idx);
                    showSegment('video', idx);
                  }}
                  className="flex-1 px-2 py-1.5 text-sm bg-[var(--color-surface-dim] border border-[var(--color-border] rounded"
                >
                  {mpd.playlists.map((pl, idx) => (
                    <option key={idx} value={idx}>
                      {formatVideoOption(pl, idx)}
                    </option>
                  ))}
                </select>
                <Button variant="outline" size="sm" onClick={() => showSegment('video', videoIndex)}>
                  提取切片
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => void convertToM3u8('video')}
                  title="把当前码率转换为 m3u8 并在 m3u8 页面下载"
                >
                  <FileText className="w-3.5 h-3.5" />
                  转 M3U8
                </Button>
              </div>
            </div>

            {/* 音频码率列表 */}
            {audioEntries.length > 0 && (
              <div className="bg-[var(--color-surface] rounded-[--radius-md] border border-[var(--color-border] p-3 space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Music className="w-4 h-4 text-[var(--color-primary]" />
                  音频码率
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={audioIndex}
                    onChange={(e) => {
                      const idx = Number(e.target.value);
                      setAudioIndex(idx);
                      showSegment('audio', idx);
                    }}
                    className="flex-1 px-2 py-1.5 text-sm bg-[var(--color-surface-dim] border border-[var(--color-border] rounded"
                  >
                    {audioEntries.map((entry, idx) => (
                      <option key={idx} value={idx}>
                        {formatAudioOption(entry.group, entry.playlist)}
                      </option>
                    ))}
                  </select>
                  <Button variant="outline" size="sm" onClick={() => showSegment('audio', audioIndex)}>
                    提取切片
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => void convertToM3u8('audio')}
                    title="把当前音频码率转换为 m3u8 并在 m3u8 页面下载"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    转 M3U8
                  </Button>
                </div>
              </div>
            )}

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                onClick={() => {
                  setPhase('input');
                  setMpd(null);
                  setSegmentList('');
                  setM3u8Content('');
                  setMediaInfo('');
                }}
              >
                重新解析
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
