// =====================================================================
// utils.js —— 通用工具函数（DOM、类型判定、ID、防抖节流、格式化等）
// 演示 MDN：DOM API、URL/URLSearchParams、Performance、Intl
// =====================================================================

/**
 * 创建 DOM 元素或实例化组件的工厂函数，类 JSX 写法。
 * 当 tag 是 Component 子类时，实例化并把后续参数作为 props.children。
 * 当 tag 是字符串时，创建对应 DOM 元素并挂载 children。
 *
 * 实例复用机制（消除闪屏的核心）：
 * 当父组件 _rerender 时会设置 _recycleContext，h() 检测到后
 * 从旧子组件池中按顺序查找同类型实例复用（更新 props + _rerender），
 * 而不是每次 new 新实例。这样任何 setState 触发的 rerender 都不会
 * 重建已存在的组件 DOM，彻底消除闪屏/光标丢失/拖拽中断等问题。
 */

// 当前正在 rerender 的父组件实例（模块级，供 h() 访问）
let _recycleContext = null;

/** 供 Component._rerender 设置/清除复用上下文 */
export function _setRecycleContext(ctx) { _recycleContext = ctx; }
export function _getRecycleContext() { return _recycleContext; }

/**
 * 复用比较：判断新旧 props 是否"语义等价"，相等则可跳过 _rerender。
 *
 * 比较规则（按 key 逐一比较）：
 *  - 基本/引用类型用 Object.is（与 React 浅比较一致）
 *  - 函数类型（on* 回调）：永远视为相等。
 *    原因：父组件每次 render 都会创建新的闭包函数（捕获最新 state），
 *    引用必然不同；但回调内部读取的是最新 state（闭包捕获），
 *    不 rerender 也不会读到旧 state。跳过 rerender 可消除"闭包引用变化
 *    导致所有子组件无意义 rerender"的闪屏。
 *    注意：若回调依赖 props（如 onClick 用 props.id），子组件仍需
 *    rerender 才能拿到新 id——但这种情况下 props.id 也会变，
 *    浅比较会触发 rerender，函数相等不影响判断。
 *  - 数组/对象：按引用比较（与 React 一致）。
 *    children 数组每次 render 通常是新引用，会触发 rerender；
 *    这是预期的（children 内容确实可能变了）。
 *  - 跳过 'children' key 的比较：children 通过 h() 的可变参数传入，
 *    每次都是新数组引用，但内容可能完全相同（如同一组 Tag）。
 *    跳过 children 比较可让"父组件 rerender 但 children 内容未变"时
 *    跳过子组件 rerender。子组件 render() 会重新读取 props.children，
 *    内容未变则 _patchInPlace 不会改 DOM。
 */
export function _propsEqual(a, b) {
  if (a === b) return true;
  if (!is.obj(a) || !is.obj(b)) return false;
  // 收集所有 key（含 children 但稍后跳过）
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) {
    if (k === 'children') continue; // 跳过 children
    const av = a[k];
    const bv = b[k];
    if (typeof av === 'function' && typeof bv === 'function') continue; // 函数视为相等
    if (!Object.is(av, bv)) return false;
  }
  return true;
}

export function h(tag, props = {}, ...children) {
  // 组件类：实例化并返回其 render() 节点
  if (typeof tag === 'function') {
    // [DEBUG] 临时计数器 + 调用栈
    if (typeof global !== 'undefined') {
      global.__hCallCount = global.__hCallCount || {};
      const name = tag.name || 'Anon';
      global.__hCallCount[name] = (global.__hCallCount[name] || 0) + 1;
      // [DEBUG] 记录 Tag 调用的上下文
      if (name === 'Tag' && global.__debugTagCtx) {
        const ctxName = _recycleContext ? _recycleContext.constructor.name : 'null';
        const inPool = _recycleContext && _recycleContext._recyclePool;
        global.__tagCtxLog.push(`#${global.__hCallCount.Tag} ctx=${ctxName} inPool=${!!inPool}`);
      }
    }
    const flatChildren = children.flat().filter((c) => c != null && c !== false && c !== true);
    // 当可变参数为空时，回退到 props.children（兼容 h(Comp, { children: ... }) 写法）。
    const effectiveChildren = flatChildren.length > 0
      ? flatChildren
      : (props && props.children != null ? [].concat(props.children) : []);
    const mergedProps = { ...(props || {}), children: effectiveChildren.length === 1 ? effectiveChildren[0] : effectiveChildren };

    // 尝试复用旧实例（父组件 rerender 上下文中）
    // 按类型查找未使用的旧实例，用 _recycleUsed Set 标记已用索引，
    // 避免类型不匹配时消耗索引导致后续 registerChild 无法复用
    if (_recycleContext && _recycleContext._recyclePool) {
      const pool = _recycleContext._recyclePool;
      const used = _recycleContext._recycleUsed;
      for (let i = 0; i < pool.length; i++) {
        if (used && used.has(i)) continue;
        const old = pool[i];
        if (old && old.constructor === tag && !old._destroyed) {
          if (used) used.add(i);
          const parent = _recycleContext;
          parent._children.push(old);
          // props 浅比较：完全相同则跳过 _rerender，
          // 这是消除"父组件 setState → 所有子组件都 rerender"导致闪屏的关键。
          // 注意 children 是数组，shallowEqual 会按引用比较；
          // 多数情况下父组件 rerender 时 children 数组是新引用，
          // 但若父组件确实没改 children（如纯状态切换），这里能命中跳过。
          // 此外对 onChange 等闭包：父组件每次 rerender 都新建闭包，
          // 引用必然不同 → 仍会 rerender（这是预期的，闭包捕获了新 state）。
          // 为消除"闭包引用变化但语义未变"导致的无效 rerender，
          // 跳过对以 on 开头的回调属性的浅比较（视为可能稳定）。
          if (_propsEqual(old.props, mergedProps)) {
            const placeholder = document.createComment('reuse');
            placeholder._reusedRef = old.el;
            return placeholder;
          }
          // 子类可自定义 shouldComponentUpdate 做更细粒度判断
          // （如 Pagination 检测 nextProps.current === state.current 时跳过）
          if (typeof old.shouldComponentUpdate === 'function'
              && !old.shouldComponentUpdate(mergedProps, old.state)) {
            // 跳过 rerender，但仍更新 props 引用（闭包已捕获新 state）
            old.props = mergedProps;
            const placeholder = document.createComment('reuse');
            placeholder._reusedRef = old.el;
            return placeholder;
          }
          // 复用：更新 props 并让旧实例 rerender（原地修补，不移动 DOM）
          old.props = mergedProps;
          _recycleContext = null; // 旧实例 rerender 时会设置自己的 context
          old._rerender(); // _rerender 现在用 _patchInPlace，old.el 引用不变
          _recycleContext = parent;
          // 关键：不返回 old.el 本身（否则 h 父元素会 append 它导致移动），
          // 而是返回一个带 _reusedRef 的占位注释，让父级 _patchChildren
          // 识别后保留 old.el 在原位。
          const placeholder = document.createComment('reuse');
          placeholder._reusedRef = old.el;
          return placeholder;
        }
      }
    }

    // 无可复用实例：新建
    const instance = new tag(mergedProps);
    // 设置 context = 新实例，让其 render() 内部的 h() 创建的子组件注册到本实例
    const parent = _recycleContext;
    _recycleContext = instance;
    const node = instance.render();
    _recycleContext = parent;
    if (instance && !instance._mounted && instance.el) {
      instance._attach();
    }
    // 注册到父组件 _children，以便下次 rerender 复用
    if (parent && parent !== instance) {
      parent._children.push(instance);
    }
    return node;
  }

  // SVG 标签集合：需要用 createElementNS 创建，否则浏览器不渲染
  const SVG_TAGS = new Set(['svg', 'path', 'circle', 'rect', 'line', 'polyline', 'polygon',
    'ellipse', 'g', 'defs', 'use', 'linearGradient', 'radialGradient', 'stop', 'text', 'tspan',
    'mask', 'pattern', 'filter', 'feGaussianBlur', 'feOffset', 'feMerge', 'feMergeNode',
    'clipPath', 'image', 'foreignObject', 'symbol', 'marker', 'title', 'desc']);
  const el = SVG_TAGS.has(tag)
    ? document.createElementNS('http://www.w3.org/2000/svg', tag)
    : document.createElement(tag);
  for (const [key, value] of Object.entries(props || {})) {
    if (value == null || value === false) continue;
    if (key === 'class' || key === 'className') {
      const cls = Array.isArray(value) ? value.filter(Boolean).join(' ') : value;
      // SVG 元素的 className 是 SVGAnimatedString，直接赋值字符串在部分浏览器会失败
      if (typeof window !== 'undefined' && window.SVGElement && el instanceof window.SVGElement) {
        el.setAttribute('class', cls);
      } else {
        el.className = cls;
      }
    } else if (key === 'style' && typeof value === 'object') {
      Object.assign(el.style, value);
    } else if (key === 'dataset' && typeof value === 'object') {
      Object.assign(el.dataset, value);
    } else if (key.startsWith('on') && typeof value === 'function') {
      // 用属性赋值而非 addEventListener：_patchInPlace 复制属性时会自动替换旧 handler，
      // 避免 rerender 后旧 DOM 上残留过期事件处理器。
      const type = key.slice(2).toLowerCase();
      try { el['on' + type] = value; } catch { el.addEventListener(type, value); }
    } else if (key === 'html') {
      el.innerHTML = value;
    } else if (key in el && key !== 'list' && typeof el[key] !== 'function') {
      try { el[key] = value; } catch { el.setAttribute(key, value); }
    } else {
      el.setAttribute(key, value);
    }
  }
  for (const child of children.flat()) {
    if (child == null || child === false || child === true) continue;
    // 复用组件的 el 已在 DOM 中（isConnected 为 true）。
    // 直接 append 会导致它从原位置被移动到新临时节点，
    // 破坏 _patchChildren 的引用匹配 → DOM 重建 → 闪屏。
    // 用占位注释替换，_patchChildren 会识别 _reusedRef 保留原位。
    if (child.nodeType === 1 && child.isConnected) {
      const placeholder = document.createComment('reuse');
      placeholder._reusedRef = child;
      el.appendChild(placeholder);
    } else {
      el.append(child.nodeType ? child : document.createTextNode(String(child)));
    }
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
  while (el.firstChild) el.removeChild(el.firstChild);
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
  promise: (v) => v && is.func(v.then),
};

/** 生成唯一 ID（演示 crypto.randomUUID / 兜底） */
export function uid(prefix = 'id') {
  if (globalThis.crypto?.randomUUID) return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** 防抖 */
export function debounce(fn, wait = 200) {
  let t;
  const wrapped = (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
  wrapped.cancel = () => clearTimeout(t);
  return wrapped;
}

/** 节流 */
export function throttle(fn, wait = 200) {
  let last = 0; let timer = null;
  return (...args) => {
    const now = Date.now();
    const remain = wait - (now - last);
    if (remain <= 0) {
      clearTimeout(timer); timer = null;
      last = now; fn(...args);
    } else if (!timer) {
      timer = setTimeout(() => { last = Date.now(); timer = null; fn(...args); }, remain);
    }
  };
}

/** 深拷贝（结构化克隆，演示 structuredClone / JSON 兜底） */
export function deepClone(obj) {
  if (typeof structuredClone === 'function') {
    try { return structuredClone(obj); } catch { /* fallthrough */ }
  }
  return JSON.parse(JSON.stringify(obj));
}

/** 浅比较两个对象是否相等 */
export function shallowEqual(a, b) {
  if (a === b) return true;
  if (!is.obj(a) || !is.obj(b)) return false;
  const ka = Object.keys(a); const kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
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
  if (ms < 1) return `${(ms * 1000).toFixed(0)}μs`;
  if (ms < 1000) return `${ms.toFixed(2)}ms`;
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
  for (const [k, v] of sp.entries()) result[k] = v;
  return result;
}

/** 序列化为查询字符串 */
export function stringifyQuery(obj) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(obj)) {
    if (v != null) sp.set(k, String(v));
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
    if (!resp.ok) throw new Error(`HTTP ${resp.status} ${resp.statusText}`);
    const ct = resp.headers.get('content-type') || '';
    return ct.includes('application/json') ? resp.json() : resp.text();
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * 规范化错误对象：把任意 rejection 值转为带 name/message 的对象。
 * 用于 catch 块中安全访问 err.name / err.message，
 * 避免promise reject 了一个 undefined / null / 字符串时报 "Cannot read properties of undefined (reading 'name')"。
 */
export function errInfo(err) {
  if (err == null) return { name: 'Error', message: String(err) };
  if (err instanceof Error) return { name: err.name || 'Error', message: err.message || String(err) };
  if (typeof err === 'object' && 'name' in err && 'message' in err) return err;
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
      } catch { return fallback; }
    },
    set(key, value) {
      try { store.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
    },
    remove(key) { try { store.removeItem(key); } catch { /* noop */ } },
    clear() { try { store.clear(); } catch { /* noop */ } },
    keys() { try { return Object.keys(store); } catch { return []; } },
  };
}

/** Cookie 工具（演示 document.cookie） */
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
  ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
  document.body.appendChild(ta); ta.select();
  try { document.execCommand('copy'); return true; }
  catch { return false; }
  finally { ta.remove(); }
}

/** 简单事件总线挂载点（用于全局广播） */
export function onUnload(fn) {
  window.addEventListener('unload', fn, { once: true });
}
