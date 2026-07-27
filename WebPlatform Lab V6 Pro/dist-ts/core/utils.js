// =====================================================================
// utils.ts —— 通用工具函数（DOM、类型判定、ID、防抖节流、格式化等）
// 演示 MDN：DOM API、URL/URLSearchParams、Performance、Intl
// =====================================================================
/**
 * 创建 DOM 元素或实例化组件的工厂函数，类 JSX 写法。
 * 当 tag 是 Component 子类时，实例化并把后续参数作为 props.children。
 * 当 tag 是字符串时，创建对应 DOM 元素并挂载 children。
 */
export function h(tag, props = {}, ...children) {
    // 组件类：实例化并返回其 render() 节点
    if (typeof tag === 'function') {
        const flatChildren = children.flat().filter((c) => c != null && c !== false && c !== true);
        // 当可变参数为空时，回退到 props.children（兼容 h(Comp, { children: ... }) 写法）。
        const effectiveChildren = flatChildren.length > 0
            ? flatChildren
            : (props && props.children != null ? [].concat(props.children) : []);
        const instance = new tag({
            ...(props || {}),
            children: effectiveChildren.length === 1 ? effectiveChildren[0] : effectiveChildren,
        });
        const node = instance.render();
        // 通过 h() 创建的组件实例必须被 attach，否则 _mounted 永远为 false，
        // setState 触发的 _rerender 会被跳过。
        if (instance && !instance._mounted && instance.el) {
            instance._attach();
        }
        return node;
    }
    // SVG 标签集合：需要用 createElementNS 创建，否则浏览器不渲染
    const SVG_TAGS = new Set([
        'svg', 'path', 'circle', 'rect', 'line', 'polyline', 'polygon',
        'ellipse', 'g', 'defs', 'use', 'linearGradient', 'radialGradient', 'stop', 'text', 'tspan',
        'mask', 'pattern', 'filter', 'feGaussianBlur', 'feOffset', 'feMerge', 'feMergeNode',
        'clipPath', 'image', 'foreignObject', 'symbol', 'marker', 'title', 'desc',
    ]);
    const el = SVG_TAGS.has(tag)
        ? document.createElementNS('http://www.w3.org/2000/svg', tag)
        : document.createElement(tag);
    for (const [key, value] of Object.entries(props || {})) {
        if (value == null || value === false)
            continue;
        if (key === 'class' || key === 'className') {
            const cls = Array.isArray(value) ? value.filter(Boolean).join(' ') : value;
            // SVG 元素的 className 是 SVGAnimatedString，直接赋值字符串在部分浏览器会失败
            if (typeof window !== 'undefined' && window.SVGElement && el instanceof window.SVGElement) {
                el.setAttribute('class', cls);
            }
            else {
                el.className = cls;
            }
        }
        else if (key === 'style' && typeof value === 'object') {
            Object.assign(el.style, value);
        }
        else if (key === 'dataset' && typeof value === 'object') {
            Object.assign(el.dataset, value);
        }
        else if (key.startsWith('on') && typeof value === 'function') {
            el.addEventListener(key.slice(2).toLowerCase(), value);
        }
        else if (key === 'html') {
            el.innerHTML = value;
        }
        else if (key in el && key !== 'list' && typeof el[key] !== 'function') {
            try {
                el[key] = value;
            }
            catch {
                el.setAttribute(key, value);
            }
        }
        else {
            el.setAttribute(key, value);
        }
    }
    for (const child of children.flat()) {
        if (child == null || child === false || child === true)
            continue;
        el.append(child.nodeType ? child : document.createTextNode(String(child)));
    }
    return el;
}
/**
 * 实例化组件并挂载到父节点（用于需要在父组件中持有子组件引用的场景）
 * 返回组件实例。
 */
export function mountComponent(ComponentClass, props, parent) {
    const instance = new ComponentClass(props);
    instance.mount(parent);
    return instance;
}
/** 清空元素 */
export function empty(el) {
    while (el.firstChild)
        el.removeChild(el.firstChild);
    return el;
}
/** 选择器简写 */
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
/** 类型判定 */
export const is = {
    func: (v) => typeof v === 'function',
    obj: (v) => v !== null && typeof v === 'object',
    arr: (v) => Array.isArray(v),
    str: (v) => typeof v === 'string',
    num: (v) => typeof v === 'number' && !Number.isNaN(v),
    promise: (v) => v != null && typeof v.then === 'function',
};
/** 生成唯一 ID（演示 crypto.randomUUID / 兜底） */
export function uid(prefix = 'id') {
    if (typeof globalThis.crypto?.randomUUID === 'function') {
        return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
    }
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
/** 防抖 */
export function debounce(fn, wait = 200) {
    let t;
    const wrapped = ((...args) => {
        if (t)
            clearTimeout(t);
        t = setTimeout(() => fn(...args), wait);
    });
    wrapped.cancel = () => { if (t)
        clearTimeout(t); };
    return wrapped;
}
/** 节流 */
export function throttle(fn, wait = 200) {
    let last = 0;
    let timer = null;
    return ((...args) => {
        const now = Date.now();
        const remain = wait - (now - last);
        if (remain <= 0) {
            if (timer) {
                clearTimeout(timer);
                timer = null;
            }
            last = now;
            fn(...args);
        }
        else if (!timer) {
            timer = setTimeout(() => {
                last = Date.now();
                timer = null;
                fn(...args);
            }, remain);
        }
    });
}
/** 深拷贝（结构化克隆，演示 structuredClone / JSON 兜底） */
export function deepClone(obj) {
    if (typeof structuredClone === 'function') {
        try {
            return structuredClone(obj);
        }
        catch { /* fallthrough */ }
    }
    return JSON.parse(JSON.stringify(obj));
}
/** 浅比较两个对象是否相等 */
export function shallowEqual(a, b) {
    if (a === b)
        return true;
    if (!is.obj(a) || !is.obj(b))
        return false;
    const ka = Object.keys(a);
    const kb = Object.keys(b);
    if (ka.length !== kb.length)
        return false;
    return ka.every((k) => Object.is(a[k], b[k]));
}
/** 格式化时间戳 */
export function formatTime(date = new Date()) {
    const d = date instanceof Date ? date : new Date(date);
    // 演示 Intl.DateTimeFormat
    return new Intl.DateTimeFormat('zh-CN', {
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    }).format(d);
}
/** 格式化毫秒耗时 */
export function formatDuration(ms) {
    if (ms < 1)
        return `${(ms * 1000).toFixed(0)}μs`;
    if (ms < 1000)
        return `${ms.toFixed(2)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
}
/** 简易 HTML 转义 */
export function escapeHTML(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
}
/** 简易代码高亮（演示正则 + 模板） */
export function highlightCode(code) {
    const escaped = escapeHTML(code);
    return escaped
        .replace(/(\/\/[^\n]*)/g, '<span class="tok-com">$1</span>')
        .replace(/\b(const|let|var|function|class|extends|return|if|else|for|while|new|await|async|import|export|from|this|null|undefined|true|false)\b/g, '<span class="tok-key">$1</span>')
        .replace(/(['"`])([^'"`\n]*?)\1/g, '<span class="tok-str">$1$2$1</span>')
        .replace(/\b(\d+(?:\.\d+)?)\b/g, '<span class="tok-num">$1</span>');
}
/** 解析查询字符串（演示 URLSearchParams） */
export function parseQuery(search) {
    const sp = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
    const result = {};
    for (const [k, v] of sp.entries())
        result[k] = v;
    return result;
}
/** 序列化为查询字符串 */
export function stringifyQuery(obj) {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(obj)) {
        if (v != null)
            sp.set(k, String(v));
    }
    const s = sp.toString();
    return s ? `?${s}` : '';
}
/** 简单 fetch 封装（演示 Fetch + AbortController） */
export async function request(url, options = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeout ?? 8000);
    try {
        const resp = await fetch(url, { ...options, signal: controller.signal });
        if (!resp.ok)
            throw new Error(`HTTP ${resp.status} ${resp.statusText}`);
        const ct = resp.headers.get('content-type') || '';
        return ct.includes('application/json') ? resp.json() : resp.text();
    }
    finally {
        clearTimeout(timeout);
    }
}
export function errInfo(err) {
    if (err == null)
        return { name: 'Error', message: String(err) };
    if (err instanceof Error)
        return { name: err.name || 'Error', message: err.message || String(err) };
    if (typeof err === 'object' && 'name' in err && 'message' in err) {
        return err;
    }
    return { name: 'Error', message: String(err) };
}
/** 安全执行 localStorage / sessionStorage（演示 try/catch + Storage API） */
export const storage = {
    local: makeStorageAdapter('localStorage'),
    session: makeStorageAdapter('sessionStorage'),
};
function makeStorageAdapter(type) {
    const store = window[type];
    return {
        get(key, fallback = null) {
            try {
                const v = store.getItem(key);
                return v == null ? fallback : JSON.parse(v);
            }
            catch {
                return fallback;
            }
        },
        set(key, value) {
            try {
                store.setItem(key, JSON.stringify(value));
                return true;
            }
            catch {
                return false;
            }
        },
        remove(key) { try {
            store.removeItem(key);
        }
        catch { /* noop */ } },
        clear() { try {
            store.clear();
        }
        catch { /* noop */ } },
        keys() { try {
            return Object.keys(store);
        }
        catch {
            return [];
        } },
    };
}
export const cookie = {
    get(name) {
        const match = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/([.$?*|{}()[\]\\/+^])/g, '\\$1') + '=([^;]*)'));
        return match ? decodeURIComponent(match[1]) : null;
    },
    set(name, value, { days = 7, path = '/', sameSite = 'Lax' } = {}) {
        const expires = new Date(Date.now() + days * 864e5).toUTCString();
        document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=${path}; SameSite=${sameSite}`;
    },
    remove(name, path = '/') {
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=${path}`;
    },
};
/** 复制到剪贴板（演示 Clipboard API + 兜底） */
export async function copyText(text) {
    if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
    }
    // 兜底：execCommand
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try {
        document.execCommand('copy');
        return true;
    }
    catch {
        return false;
    }
    finally {
        ta.remove();
    }
}
/** 简单事件总线挂载点（用于全局广播） */
export function onUnload(fn) {
    window.addEventListener('unload', fn, { once: true });
}
//# sourceMappingURL=utils.js.map