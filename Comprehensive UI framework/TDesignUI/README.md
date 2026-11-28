# TDesign UI（Vue / React 双端 monorepo）

同一套 TDesign 设计，Vue 3 与 React 19 两个独立应用，共用一份与框架无关的领域逻辑。

## 结构

```
TDesignUI/
├── package.json            npm workspaces 根（不放任何框架依赖）
├── tsconfig.base.json      两端共享的编译配置
├── apps/
│   ├── vue/                Vue 3.5 + Vite 8 + TDesign Vue Next   → 端口 5180
│   └── react/              React 19 + Vite 7 + TDesign React      → 端口 5190
└── packages/
    └── core/               纯 TS：常量、类型、框架无关 store（禁止 import 任何框架）
```

## 命令

```bash
npm install                       # 根目录一次装完两个 app
npm run dev:vue                   # 只起 Vue 端 → http://localhost:5180
npm run dev:react                 # 只起 React 端 → http://localhost:5190
npm run build:all                 # 两端分别构建
npm run typecheck                 # 两端各跑一次 tsc --noEmit
npm run ls:vite                   # 查看每个 app 实际解析到的 vite 版本
```

两个终端同时开着 `dev:vue` 与 `dev:react` 可并行运行。

## 共享状态怎么用

`packages/core` 提供框架无关的 `createCounter()`（`get` / `increment` / `reset` / `subscribe`）。
两端各自订阅，视图各自响应，业务逻辑只有一份：

```ts
// Vue：订阅写进 ref，卸载时退订
const counter = createCounter();
const count = ref(counter.get());
const stop = counter.subscribe((value) => (count.value = value));
onUnmounted(stop);
```

```tsx
// React：订阅即派发 setState，useEffect 的返回值就是退订函数
const counter = useMemo(() => createCounter(), []);
const [count, setCount] = useState(counter.get());
useEffect(() => counter.subscribe(setCount), [counter]);
```

`formatCount` 这类文案也归 core，避免两端各写一份字符串导致走样。

## 页面与路由

路由表在 core（`ROUTES`），两端各自把路径映射到自己的组件，所以 URL 完全一致、指向同一个业务概念：

```ts
// packages/core/src/routes.ts
export const ROUTES = [
  { key: 'home', path: '/', title: '首页', navLabel: '首页' },
  { key: 'apps', path: '/apps', title: '应用列表', navLabel: '应用列表' },
];
```

- Vue：`apps/vue/src/router.ts` 用 vue-router 4，`App.vue` 是壳（顶部导航 + `<router-view />`）
- React：`apps/react/src/App.tsx` 用 react-router-dom 7，壳是 `<NavLink>` + `<Routes>`

第二个页面「应用列表」的全部业务规则在 `packages/core/src/apps.ts`：目录数据、`filterApps`、`paginate`、`summarizeApps`、状态文案与 tag 主题，以及 `createAppListStore()` 状态机（筛选条件 + 页码 + 派生结果，订阅一次拿到完整快照）。两端只负责把快照画出来，没有任何一行筛选或分页代码重复。

## 双壳重复率实测（第 2 个页面完成时）

| 部分 | 行数 | 重复情况 |
|---|---|---|
| core（index / counter / routes / apps） | 243 | 单一来源 |
| Vue 壳（App / router / main / 两个页面） | 389 | 模板结构与 React 近似，语法必须两套 |
| React 壳（App / main / 两个页面 tsx） | 256 | 同上 |
| React 样式（styles.css） | 168 | **全量重复**：Vue 端写在 SFC 的 scoped style 里 |

结论：业务逻辑重复为 0（筛选、分页、统计、文案、路由表都在 core）；剩下的重复只有样式和模板/JSX 结构。样式是下一块值得下沉的部分。

## 待办

- 把两端共用的视觉规范抽成 `packages/theme`（一份 CSS + 设计 token，两端各自 import），消掉上表 168 行 ×2 的重复。
- Vue 端 `typecheck` 目前是 `tsc --noEmit`，不校验 `.vue` 模板；`vue-tsc` 与当前 TypeScript 7 尚不兼容，模板层类型错误暂时靠 `vite build` 与浏览器发现。
- 部署到静态站点要配 history fallback（把 `/apps` 这类路径回落到 `index.html`），`vite preview` 已内置该行为。

## 依赖版本隔离

两端刻意使用不同的 Vite 大版本，理由：React 侧只能用 `@vitejs/plugin-react@5`（v6 需要 `@babel/core@8`，与现有依赖冲突），而 v5 的 peer 只到 Vite 7；Vue 侧用 Vite 8 才能配 `@vitejs/plugin-vue@6`。

| 包 | apps/vue | apps/react |
|---|---|---|
| vite | 8.4.0 | 7.3.8 |
| 框架插件 | `@vitejs/plugin-vue` 6 | `@vitejs/plugin-react` 5 |
| 组件库 | `tdesign-vue-next` | `tdesign-react` |

npm workspaces 会把版本不同的包**嵌套**到各自 `apps/*/node_modules`，因此互不污染。改动依赖后请用 `npm run ls:vite` 复核。

## 约定

- `packages/core` 只能写纯 TS。出现 `import ... from 'vue'` / `'react'` / `'tdesign-*'` 就说明边界破了。
- `subscribe` 返回的退订函数必须返回 `void`（不能返回 `boolean`），否则无法直接当作 React 的 effect cleanup。
- `tsconfig` 不要写 `baseUrl`：本项目使用 TypeScript 7，该选项已被移除，`paths` 直接相对 tsconfig 解析。
- 端口写死并开启 `strictPort`，冲突时直接报错，避免静默顺延到别的端口而打开错的页面。
- 新增第三个框架（如 Tuniao）按 `apps/<name>` + 自己的 `vite.config.ts` 加，根配置不用动。

## 环境备注

pnpm 在本机解析 `tdesign-vue-next` + `tdesign-react` 依赖图时会空转（CPU 持续 100%、体积不增长，实测两次均卡死），因此工作区用 npm workspaces 而非 pnpm。若将来换到别的机器，pnpm 的隔离性更强，可以迁回。
