import { useCallback, useEffect, useState } from 'react';
import { ChevronRight, ChevronDown, Code2, Link, FileText, AlertCircle, Expand, Shrink } from 'lucide-react';
import { Button } from '@components/ui/Button';
import { cn } from '@lib/utils';

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

interface TreeNode {
  key: string;
  value: JsonValue;
  path: string;
}

export default function App() {
  const params = new URLSearchParams(location.search);
  const [text, setText] = useState(params.get('json') || '');
  const [jsonUrl, setJsonUrl] = useState(params.get('url') || '');
  const [data, setData] = useState<JsonValue | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showInput, setShowInput] = useState(true);
  const [collapsedPaths, setCollapsedPaths] = useState<Set<string>>(new Set());

  /** 解析 JSON 文本并渲染 */
  const parse = useCallback((raw: string) => {
    setError(null);
    if (!raw.trim()) {
      setData(null);
      return;
    }
    try {
      const parsed = JSON.parse(raw) as JsonValue;
      setData(parsed);
      setCollapsedPaths(new Set());
      setShowInput(false);
    } catch (e) {
      setError((e as Error).message);
      setData(null);
    }
  }, []);

  /** 从 URL 加载 JSON */
  const loadFromUrl = async () => {
    if (!jsonUrl) return;
    setError(null);
    try {
      const res = await fetch(jsonUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const raw = await res.text();
      setText(raw);
      parse(raw);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  // 启动时若带 url 参数自动加载
  useEffect(() => {
    if (jsonUrl) void loadFromUrl();
    else if (text) parse(text);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** 切换节点折叠状态 */
  const toggle = (path: string) => {
    setCollapsedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  /** 全部展开 */
  const expandAll = () => setCollapsedPaths(new Set());
  /** 全部收起(只保留根级) */
  const collapseAll = () => {
    if (!data || typeof data !== 'object') return;
    const paths = new Set<string>();
    const walk = (v: JsonValue, p: string) => {
      if (Array.isArray(v)) {
        paths.add(p);
        v.forEach((item, i) => walk(item, `${p}/${i}`));
      } else if (v && typeof v === 'object') {
        paths.add(p);
        for (const k of Object.keys(v)) walk((v as any)[k], `${p}/${k}`);
      }
    };
    walk(data, '');
    paths.delete('');
    setCollapsedPaths(paths);
  };

  return (
    <div className="min-h-screen bg-[var(--color-surface-dim] text-[var(--color-text]">
      <header className="border-b border-[var(--color-border] bg-[var(--color-surface] px-6 py-3 flex items-center justify-between">
        <h1 className="text-lg font-semibold flex items-center gap-2">
          <Code2 className="w-5 h-5" /> JSON 查看器
        </h1>
        {data !== null && (
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={expandAll} title="展开所有节点">
              <Expand className="w-4 h-4 mr-1" /> 展开
            </Button>
            <Button variant="ghost" size="sm" onClick={collapseAll} title="收起所有节点">
              <Shrink className="w-4 h-4 mr-1" /> 收起
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowInput((v) => !v)}>
              <FileText className="w-4 h-4 mr-1" /> {showInput ? '隐藏输入' : '编辑'}
            </Button>
          </div>
        )}
      </header>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-4">
        {/* 输入区 */}
        {showInput && (
          <section className="bg-[var(--color-surface] rounded-[--radius-lg] border border-[var(--color-border] p-4 space-y-3">
            <div>
              <label className="text-xs text-[var(--color-text-muted]">JSON 文本</label>
              <textarea
                value={text}
                spellCheck={false}
                onChange={(e) => setText(e.target.value)}
                placeholder='{"example": "在此粘贴 JSON"}'
                rows={8}
                className="mt-1 w-full px-3 py-2 text-xs font-mono border border-[var(--color-border] rounded-[--radius-sm] bg-[var(--color-surface] resize-y"
              />
            </div>
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <label className="text-xs text-[var(--color-text-muted]">JSON URL</label>
                <input
                  type="text"
                  value={jsonUrl}
                  onChange={(e) => setJsonUrl(e.target.value)}
                  placeholder="https://example.com/data.json"
                  className="mt-1 w-full px-3 py-2 text-xs font-mono border border-[var(--color-border] rounded-[--radius-sm] bg-[var(--color-surface]"
                />
              </div>
              <Button variant="outline" size="sm" onClick={loadFromUrl} disabled={!jsonUrl}>
                <Link className="w-4 h-4 mr-1" /> 加载
              </Button>
            </div>
            <div className="flex justify-end">
              <Button variant="primary" size="sm" onClick={() => parse(text)} disabled={!text.trim()}>
                格式化
              </Button>
            </div>
          </section>
        )}

        {/* 错误提示 */}
        {error && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-[--radius-sm] bg-red-500/10 border border-red-500/30 text-sm text-red-600">
            <AlertCircle className="w-4 h-4" /> {error}
          </div>
        )}

        {/* JSON 树 */}
        {data !== null && (
          <section className="bg-[var(--color-surface] rounded-[--radius-lg] border border-[var(--color-border] p-4 overflow-auto">
            <pre className="text-xs font-mono leading-relaxed">
              <JsonNode
                node={{ key: '', value: data, path: '' }}
                collapsedPaths={collapsedPaths}
                onToggle={toggle}
                isRoot
              />
            </pre>
          </section>
        )}

        {data === null && !error && !showInput && (
          <div className="text-center py-12 text-[var(--color-text-muted] text-sm">
            等待 JSON 数据...
          </div>
        )}
      </div>
    </div>
  );
}

/** JSON 值类型对应的颜色 */
function valueColor(v: JsonValue): string {
  if (v === null) return 'text-purple-500';
  if (typeof v === 'boolean') return 'text-amber-600';
  if (typeof v === 'number') return 'text-blue-600';
  if (typeof v === 'string') return 'text-green-600';
  return '';
}

/** 渲染单个值(叶子节点) */
function renderValue(v: JsonValue): string {
  if (v === null) return 'null';
  if (typeof v === 'string') return JSON.stringify(v);
  return String(v);
}

/** 子节点数量提示 */
function childCount(v: JsonValue): string {
  if (Array.isArray(v)) return `${v.length} 项`;
  if (v && typeof v === 'object') return `${Object.keys(v).length} 项`;
  return '';
}

function JsonNode({
  node,
  collapsedPaths,
  onToggle,
  isRoot,
}: {
  node: TreeNode;
  collapsedPaths: Set<string>;
  onToggle: (path: string) => void;
  isRoot?: boolean;
}) {
  const { key, value, path } = node;
  const collapsed = collapsedPaths.has(path);
  const isObject = value !== null && typeof value === 'object';
  const isArray = Array.isArray(value);

  // 叶子节点
  if (!isObject) {
    return (
      <div className="flex">
        {!isRoot && (
          <span className="text-[var(--color-text-muted]">
            <span className="text-rose-600">{JSON.stringify(key)}</span>
            <span className="text-[var(--color-text-muted]">: </span>
          </span>
        )}
        <span className={valueColor(value)}>{renderValue(value)}</span>
      </div>
    );
  }

  // 对象/数组节点
  const entries: [string, JsonValue][] = isArray
    ? (value as JsonValue[]).map((v, i) => [String(i), v])
    : Object.entries(value as { [k: string]: JsonValue });

  return (
    <div>
      <div className="flex items-start">
        {!isRoot && (
          <span className="text-[var(--color-text-muted]">
            <span className="text-rose-600">{JSON.stringify(key)}</span>
            <span className="text-[var(--color-text-muted]">: </span>
          </span>
        )}
        <button
          type="button"
          onClick={() => onToggle(path)}
          className="inline-flex items-center gap-1 hover:bg-[var(--color-surface-dim] rounded px-1"
        >
          {collapsed ? (
            <ChevronRight className="w-3 h-3" />
          ) : (
            <ChevronDown className="w-3 h-3" />
          )}
          <span className="text-[var(--color-text-muted]">
            {isArray ? '[' : '{'}
            {collapsed && (
              <span className="text-[var(--color-text-muted] mx-1">
                {isArray ? ']' : '}'}
              </span>
            )}
            {!collapsed && childCount(value) && (
              <span className="text-[10px] text-[var(--color-text-muted] ml-1">
                {childCount(value)}
              </span>
            )}
          </span>
        </button>
      </div>

      {!collapsed && (
        <>
          <div className="pl-4 border-l border-[var(--color-border] ml-1">
            {entries.map(([k, v]) => (
              <JsonNode
                key={k}
                node={{ key: k, value: v, path: `${path}/${k}` }}
                collapsedPaths={collapsedPaths}
                onToggle={onToggle}
              />
            ))}
          </div>
          <div className="text-[var(--color-text-muted]">
            {isArray ? ']' : '}'}
          </div>
        </>
      )}
    </div>
  );
}
