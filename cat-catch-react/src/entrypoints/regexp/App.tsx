import { useEffect, useMemo, useState } from 'react';
import { Search, Plus, Check, X, AlertCircle } from 'lucide-react';
import { Button } from '@components/ui/Button';
import { useSettingsStore } from '@stores/settings';
import type { RegexRule } from '@lib/config';

/** flag 字符串 -> RegexRule['type'] */
function flagsToType(flags: string): RegexRule['type'] {
  const hasG = flags.includes('g');
  const hasI = flags.includes('i');
  if (hasG && hasI) return 'ig';
  if (hasG) return 'g';
  if (hasI) return 'i';
  return 'i';
}

/** RegexRule['type'] -> flag 字符串 */
function typeToFlags(t: RegexRule['type']): string {
  return t;
}

export default function App() {
  const Regex = useSettingsStore((s) => s.Regex);
  const setRegexRules = useSettingsStore((s) => s.setRegexRules);
  const persist = useSettingsStore((s) => s.persistOptions);

  const [url, setUrl] = useState('https://example.com/video.m3u8');
  const [pattern, setPattern] = useState('https://.*\\.m3u8');
  const [flags, setFlags] = useState('ig');
  const [ext, setExt] = useState('');
  const [blackList, setBlackList] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);

  useEffect(() => {
    void useSettingsStore.getState().loadFromSync();
  }, []);

  /** CompiledRegexRule -> RegexRule(还原图形) */
  const toRaw = (r: typeof Regex[number]): RegexRule => {
    const f = r.regex.flags;
    const type = (
      f.includes('g') && f.includes('i') ? 'ig'
      : f.includes('g') ? 'g'
      : f.includes('i') ? 'i'
      : ''
    ) as RegexRule['type'];
    return { type, regex: r.regex.source, ext: r.ext, blackList: r.blackList, state: r.state };
  };

  const { regex, matches, ok } = useMemo(() => {
    setError(null);
    if (!pattern) {
      return { regex: null, matches: [] as string[], ok: false };
    }
    try {
      const re = new RegExp(pattern, flags);
      if (re.global) {
        const list: string[] = [];
        let m: RegExpExecArray | null;
        while ((m = re.exec(url)) !== null) {
          list.push(m[0]);
          if (m.index === re.lastIndex) re.lastIndex++;
          if (list.length > 200) break;
        }
        return { regex: re, matches: list, ok: true };
      }
      const m = re.exec(url);
      return { regex: re, matches: m ? [m[0]] : [], ok: true };
    } catch (e) {
      setError((e as Error).message);
      return { regex: null, matches: [] as string[], ok: false };
    }
  }, [pattern, flags, url]);

  /** 高亮 URL 中匹配到的部分 */
  const highlightedUrl = useMemo(() => {
    if (!regex || matches.length === 0) return [{ text: url, hit: false }];
    const segments: Array<{ text: string; hit: boolean }> = [];
    let cursor = 0;
    if (regex.global) {
      const re = new RegExp(pattern, flags);
      let m: RegExpExecArray | null;
      while ((m = re.exec(url)) !== null) {
        if (m.index > cursor) {
          segments.push({ text: url.slice(cursor, m.index), hit: false });
        }
        segments.push({ text: m[0], hit: true });
        cursor = m.index + m[0].length;
        if (m.index === re.lastIndex) re.lastIndex++;
        if (segments.length > 400) break;
      }
      if (cursor < url.length) segments.push({ text: url.slice(cursor), hit: false });
    } else {
      const m = regex.exec(url);
      if (m) {
        if (m.index > 0) segments.push({ text: url.slice(0, m.index), hit: false });
        segments.push({ text: m[0], hit: true });
        if (m.index + m[0].length < url.length) {
          segments.push({ text: url.slice(m.index + m[0].length), hit: false });
        }
      }
    }
    return segments;
  }, [regex, pattern, flags, url, matches]);

  const handleSave = async () => {
    if (!pattern) return;
    const raw = Regex.map(toRaw);
    if (editingIdx !== null && editingIdx >= 0 && editingIdx < raw.length) {
      raw[editingIdx] = {
        type: flagsToType(flags),
        regex: pattern,
        ext,
        blackList,
        state: raw[editingIdx]?.state ?? false,
      };
    } else {
      raw.push({
        type: flagsToType(flags),
        regex: pattern,
        ext,
        blackList,
        state: false,
      });
    }
    setRegexRules(raw);
    await persist();
    setEditingIdx(null);
    alert(editingIdx !== null ? '已更新规则' : '已添加到正则规则,可在设置页启用');
  };

  const handleEdit = (idx: number) => {
    const rule = Regex[idx];
    if (!rule) return;
    setPattern(rule.regex.source);
    setFlags(typeToFlags(rule.regex.flags as unknown as RegexRule['type']));
    setExt(rule.ext ?? '');
    setBlackList(rule.blackList);
    setEditingIdx(idx);
  };

  const handleDelete = async (idx: number) => {
    if (!confirm('确定删除该规则?')) return;
    const raw = Regex.map(toRaw).filter((_, i) => i !== idx);
    setRegexRules(raw);
    await persist();
    if (editingIdx === idx) setEditingIdx(null);
  };

  return (
    <div className="min-h-screen bg-[var(--color-surface-dim] text-[var(--color-text]">
      <header className="border-b border-[var(--color-border] bg-[var(--color-surface] px-6 py-3">
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <Search className="w-5 h-5" /> 正则可视化编辑器
        </h1>
        <p className="text-xs text-[var(--color-text-muted] mt-0.5">
          测试 URL 与正则匹配,保存后写入设置页正则规则列表
        </p>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* 测试区 */}
        <section className="bg-[var(--color-surface] rounded-[--radius-lg] border border-[var(--color-border] p-4 space-y-3">
          <div>
            <label className="text-xs text-[var(--color-text-muted]">测试 URL</label>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="mt-1 w-full px-3 py-2 text-sm font-mono border border-[var(--color-border] rounded-[--radius-sm] bg-[var(--color-surface]"
              placeholder="https://example.com/video.m3u8"
            />
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-xs text-[var(--color-text-muted]">正则表达式</label>
              <input
                type="text"
                value={pattern}
                onChange={(e) => setPattern(e.target.value)}
                className="mt-1 w-full px-3 py-2 text-sm font-mono border border-[var(--color-border] rounded-[--radius-sm] bg-[var(--color-surface]"
                placeholder="https://.*\\.m3u8"
              />
            </div>
            <div className="w-20">
              <label className="text-xs text-[var(--color-text-muted]">flag</label>
              <input
                type="text"
                value={flags}
                maxLength={4}
                onChange={(e) => setFlags(e.target.value.replace(/[^gimsuy]/g, ''))}
                className="mt-1 w-full px-3 py-2 text-sm font-mono border border-[var(--color-border] rounded-[--radius-sm] bg-[var(--color-surface]"
              />
            </div>
          </div>

          {/* 匹配结果 */}
          <div className="rounded-[--radius-sm] bg-[var(--color-surface-dim] p-3 min-h-16">
            <div className="text-xs text-[var(--color-text-muted] mb-1.5">匹配结果</div>
            {error ? (
              <div className="flex items-center gap-2 text-xs text-red-500">
                <AlertCircle className="w-4 h-4" /> {error}
              </div>
            ) : ok && matches.length > 0 ? (
              <div className="space-y-1.5">
                <div className="text-xs text-green-600 flex items-center gap-1">
                  <Check className="w-4 h-4" /> 匹配成功({matches.length} 处)
                </div>
                <div className="text-xs font-mono break-all leading-relaxed">
                  {highlightedUrl.map((seg, i) => (
                    <span
                      key={i}
                      className={seg.hit ? 'bg-yellow-300/70 text-black rounded px-0.5' : ''}
                    >
                      {seg.text}
                    </span>
                  ))}
                </div>
                <div className="text-[11px] text-[var(--color-text-muted] mt-1">
                  {matches.slice(0, 8).map((m, i) => (
                    <code key={i} className="mr-2 inline-block bg-[var(--color-surface] px-1 rounded">
                      {m}
                    </code>
                  ))}
                  {matches.length > 8 && <span>... 共 {matches.length} 项</span>}
                </div>
              </div>
            ) : ok ? (
              <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted]">
                <X className="w-4 h-4" /> 无匹配
              </div>
            ) : (
              <div className="text-xs text-[var(--color-text-muted]">输入正则开始测试</div>
            )}
          </div>

          {/* 保存参数 */}
          <div className="flex flex-wrap items-end gap-3 pt-1">
            <div>
              <label className="text-xs text-[var(--color-text-muted]">扩展名(ext)</label>
              <input
                type="text"
                value={ext}
                onChange={(e) => setExt(e.target.value)}
                placeholder="m3u8"
                className="mt-1 w-24 px-2 py-1 text-xs font-mono border border-[var(--color-border] rounded-[--radius-sm] bg-[var(--color-surface]"
              />
            </div>
            <label className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted]">
              <input
                type="checkbox"
                checked={blackList}
                onChange={(e) => setBlackList(e.target.checked)}
              />
              黑名单(匹配后丢弃)
            </label>
            <Button variant="primary" size="sm" onClick={handleSave} disabled={!pattern}>
              <Plus className="w-4 h-4 mr-1" />
              {editingIdx !== null ? '更新规则' : '添加到规则'}
            </Button>
            {editingIdx !== null && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setEditingIdx(null);
                  setPattern('https://.*\\.m3u8');
                  setFlags('ig');
                  setExt('');
                  setBlackList(false);
                }}
              >
                取消编辑
              </Button>
            )}
          </div>
        </section>

        {/* 已有规则 */}
        <section className="bg-[var(--color-surface] rounded-[--radius-lg] border border-[var(--color-border] p-4 space-y-2">
          <h2 className="text-sm font-medium flex items-center justify-between">
            <span>已有规则({Regex.length})</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.open(chrome.runtime.getURL('options.html#regex'), '_blank')}
            >
              在设置页打开
            </Button>
          </h2>
          <div className="space-y-1">
            {Regex.length === 0 ? (
              <p className="text-xs text-[var(--color-text-muted] py-2">暂无规则</p>
            ) : (
              Regex.map((rule, idx) => (
                <div
                  key={idx}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded-[--radius-sm] ${
                    editingIdx === idx
                      ? 'bg-[var(--color-primary]/15 border border-[var(--color-primary]/40'
                      : 'bg-[var(--color-surface-dim]'
                  }`}
                >
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded ${
                      rule.blackList
                        ? 'bg-red-500/20 text-red-600'
                        : 'bg-green-500/20 text-green-600'
                    }`}
                  >
                    {rule.blackList ? '黑' : '白'}
                  </span>
                  <code
                    className="text-xs flex-1 truncate font-mono"
                    title={rule.regex.source}
                  >
                    /{rule.regex.source}/{rule.regex.flags}
                  </code>
                  {rule.ext && (
                    <span className="text-[10px] text-[var(--color-text-muted]">
                      ext={rule.ext}
                    </span>
                  )}
                  <Button variant="ghost" size="icon" title="编辑" onClick={() => handleEdit(idx)}>
                    ✎
                  </Button>
                  <Button variant="ghost" size="icon" title="删除" onClick={() => handleDelete(idx)}>
                    ✕
                  </Button>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
