# TDesign UI（Vue / React 双端 monorepo）

同一套 TDesign 设计，Vue 3 与 React 19 两个独立应用，共用一份与框架无关的领域逻辑。

## 结构

```
TDesignUI/
├── package.json            npm workspaces 根（不放任何框架依赖）
├── tsconfig.base.json      两端共享的编译配置
├── vitest.config.ts        core 单测入口（node 环境，只跑 packages/*/src/*.test.ts）
├── eslint.config.js        一份 flat config 管 Vue / React / core 三类代码
├── .prettierrc.json        格式规范（printWidth 100 / 单引号 / 尾逗号）
├── .github/workflows/      CI：lint → test → typecheck → build
├── apps/
│   ├── vue/                Vue 3.5 + Vite 8 + TDesign Vue Next   → 端口 5180
│   └── react/              React 19 + Vite 7 + TDesign React      → 端口 5190
└── packages/
    ├── core/                纯 TS：常量、领域模型、校验规则、框架无关 store（禁止 import 任何框架）
    └── theme/               纯 CSS：设计 token + 布局样式，两端 import 同一份
```

## 命令

```bash
npm install                       # 根目录一次装完两个 app
npm run dev:vue                   # 只起 Vue 端 → http://localhost:5180
npm run dev:react                 # 只起 React 端 → http://localhost:5190
npm run build:all                 # 两端分别构建
npm run typecheck                 # 两端各跑一次 tsc --noEmit
npm test                          # 跑 core 单测（vitest，92 个用例）
npm run test:watch                # 单测监听模式
npm run lint                      # ESLint（Vue / React / TS 全量）
npm run lint:fix                  # ESLint 自动修可修的
npm run format                    # Prettier 写回
npm run format:check              # Prettier 只检查（CI 用）
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
  { key: 'create', path: '/create', title: '新建应用', navLabel: '新建应用' },
];
```

- Vue：`apps/vue/src/router.ts` 用 vue-router 4，`App.vue` 是壳（顶部导航 + `<router-view />`）
- React：`apps/react/src/App.tsx` 用 react-router-dom 7，壳是 `<NavLink>` + `<Routes>`

三个页面的业务规则全部在 core，两端只负责渲染：

| 页面     | 业务逻辑所在              | 两端各做什么                          |
| -------- | ------------------------- | ------------------------------------- |
| 首页     | `counter.ts`              | 订阅计数、渲染按钮与输入              |
| 应用列表 | `apps.ts`                 | 订阅快照、渲染筛选/网格/分页          |
| 新建应用 | `app-form.ts` + `apps.ts` | 把错误贴到输入框、提交后调用 `addApp` |

## 共享单例：跨页面写入立刻可见

`core` 导出 `appListStore`（`createAppListStore()` 的单例）。列表页与新建页 import 的是**同一个对象**：

```ts
// 新建页
const item = appListStore.addApp(toAppInput(draft));

// 列表页（订阅同一个 store）
useEffect(() => appListStore.subscribe(setSnapshot), []);
```

所以「新建应用」提交后，切回列表页（或列表页正开着）会直接看到新条目，不需要事件总线或全局 state 库。`createAppListStore()` 仍然保留，方便测试里造独立实例。

## 表单校验怎么共享

`packages/core/src/app-form.ts` 只做三件事，且都是纯函数：

- `validateAppDraft(draft, existingNames)` → 返回字段级错误对象（`{ name, owner, category, status }` 里哪几个有错、错在哪）
- `isDraftValid(errors)` → 是否通过
- `toAppInput(draft)` → 校验通过后转成领域输入（顺手 trim）

规则写在 core 里，所以两端的错误文案、长度限制、重名判定（忽略首尾空格与大小写）**不可能不一致**。页面只决定「错误什么时候显示」：本项目是点过提交后才显示，之后每次修改实时重算。

## 样式怎么共享

样式不再写在两端各自的文件里，而是收进 `packages/theme`，两端在入口 import 同一份：

```ts
// apps/vue/src/main.ts 与 apps/react/src/main.tsx 完全一样
import '@tdesignui/theme/styles.css';
```

- `packages/theme/src/tokens.css` — 设计 token（颜色 / 间距 / 圆角 / 字号 / 阴影），全量走 CSS 变量 `--tds-*`
- `packages/theme/src/layout.css` — 外壳与页面布局
- `packages/theme/src/index.css` — 入口，先 token 再布局

类名统一 `tds-` 前缀（`tds-shell` / `tds-nav` / `tds-item` …），避免和 TDesign 自己的 `t-*` 类名撞上。页面里只保留框架特有的东西：Vue 是模板，React 是 JSX，**没有任何一端再持有 CSS**。

改一个颜色只动 `tokens.css`，两版同时变。

## 主题怎么切换（浅色 / 深色）

深色主题没有各写一套，而是复用 TDesign 自己的开关：在 `<html>` 上设置 `theme-mode` 属性。TDesign 两端组件库的 CSS 里本来就是 `:root[theme-mode='dark']` 这一组变量，我们把自己的 `--tds-*` 暗色覆盖写在**同一个选择器**下，于是切一次属性，自建界面和组件库同时变。

```css
:root {
  --tds-color-bg: #f5f7fa; /* …浅色 */
}
:root[theme-mode='dark'] {
  --tds-color-bg: #181818; /* …深色 */
}
```

状态本身也放 core（`packages/core/src/theme.ts`）：`themeStore` 单例 + `toggle/set/get/subscribe`，外加一个 `applyTheme()`，它是全项目唯一碰 DOM 的地方 —— 用结构类型而不是 DOM 类型实现，core 的测试在 Node 里也能跑。

两端壳（`App.vue` / `App.tsx`）只做三件事：

```ts
// Vue
const theme = ref(themeStore.get());
themeStore.subscribe((next) => {
  theme.value = next;
  applyTheme(next);
});

// React
const [theme, setTheme] = useState(themeStore.get());
useEffect(() => themeStore.subscribe(setTheme), []);
useEffect(() => applyTheme(theme), [theme]);
```

导航栏右侧一个 `Switch` + 当前主题文案。切换后首页、列表页、新建页、表格、卡片、输入框一起变 —— 因为这些组件全部读 token 或 TDesign 变量，没有一处写死颜色。

`index.html` 里预置了 `<html theme-mode="light">` 和 `<meta name="color-scheme" content="light dark">`，避免首屏闪白。

## 主题偏好怎么记住

刷新不该丢掉用户的选择，所以 core 里给了三样东西（仍然不碰框架、不依赖 DOM lib）：

- `resolveStorage()` —— 从 `globalThis` 取 `localStorage`，取不到返回 `null`
- `readStoredTheme(storage)` / `persistTheme(theme, storage)` —— 读写 `tds-theme`，非法值当没存过；读写在 `try/catch` 里，隐私模式、配额写满都不影响切换
- `resolveSystemTheme()` / `resolveInitialTheme(storage)` —— 没存过就跟随系统 `prefers-color-scheme`，读不到或抛错回退浅色

单例创建时就用 `resolveInitialTheme()`：`createThemeStore()` 的 `set` / `toggle` 会自动写回存储，所以两端壳的代码**一句没改**，持久化是透明加上的。

还有一处细节：`index.html` 里加了一段首帧内联脚本，在 CSS 和 JS 加载前就把 `theme-mode` 定好。否则深色用户每次刷新都会先看到一帧白色 —— 这种闪白是纯 CSS 方案最容易漏掉的坑。

```html
<script>
  (function () {
    try {
      var saved = localStorage.getItem('tds-theme');
      var preferred =
        saved === 'dark' || saved === 'light'
          ? saved
          : matchMedia('(prefers-color-scheme: dark)').matches
            ? 'dark'
            : 'light';
      document.documentElement.setAttribute('theme-mode', preferred);
    } catch (e) {}
  })();
</script>
```

`main.ts` / `main.tsx` 里也有一句 `applyTheme(themeStore.get())`，作为 JS 侧的第二道保险。

## 双壳重复率实测（三个页面 + 主题 + 测试到位后）

| 部分                                                       | 行数 | 重复情况                            |
| ---------------------------------------------------------- | ---- | ----------------------------------- |
| core（index / counter / routes / apps / app-form / theme） | 555  | 单一来源                            |
| core 单测（5 个 test 文件，92 个用例）                     | 582  | 只测 core，两端共用                 |
| theme（tokens / layout / index）                           | 240  | 单一来源                            |
| Vue 壳（App / router / main / 三个页面）                   | 381  | 模板结构与 React 近似，语法必须两套 |
| React 壳（App / main / 三个页面 tsx）                      | 408  | 同上                                |

结论：业务逻辑、校验规则、主题状态机与持久化、样式、路由表五项重复为 **0**；两端壳合计 789 行，全是「模板 vs JSX」的语法差异 + 各页面组合方式。共享部分（core + theme）795 行 + 582 行测试，是同一份真相只写一次的直接成本。

## 代码规范与 CI

一份根级 `eslint.config.js`（flat config）同时管三类代码，不需要每个 app 各配一遍：

| 范围                        | 规则来源                                                                                                           |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| 全仓库                      | `@eslint/js` recommended + `typescript-eslint` recommended                                                         |
| `apps/vue/**`               | `eslint-plugin-vue` flat/recommended，并为 `unplugin-auto-import` 注入的 `ref`/`computed`/`onUnmounted` 等声明全局 |
| `apps/react/**`             | `eslint-plugin-react-hooks` recommended（hooks 规则）                                                              |
| `packages/**`、`*.config.*` | TypeScript + Node 全局                                                                                             |

`eslint-config-prettier` 放在最后，关掉所有与 Prettier 冲突的格式规则 —— 格式只由 Prettier 负责，ESLint 只管代码问题。`auto-imports.d.ts` / `components.d.ts` 是插件生成的，已在 ignore 列表里。

CI 在 `.github/workflows/ci.yml`，五步：

```
npm ci → npm run lint → npm test → npm run typecheck → npm run build:all
```

注意：当前目录是上游仓库 `D:\SourceCodeParsingAndReassembly` 的子目录，这份 workflow 若要真正跑起来，需移到仓库根的 `.github/workflows/`，并给 `run` 步骤加 `working-directory: Comprehensive UI framework/TDesignUI`、给 setup-node 加 `cache-dependency-path`。文件里已写明这点。

## 待办

- 列表 CRUD 补齐：`removeApp` + 卡片删除按钮 + 二次确认，core 补测试。
- Vue 端 `typecheck` 目前是 `tsc --noEmit`，不校验 `.vue` 模板；`vue-tsc` 与当前 TypeScript 7 尚不兼容，模板层类型错误暂时靠 `vite build` 与浏览器发现。
- 部署到静态站点要配 history fallback（把 `/apps`、`/create` 这类路径回落到 `index.html`），`vite preview` 已内置该行为。

## 依赖版本隔离

两端刻意使用不同的 Vite 大版本，理由：React 侧只能用 `@vitejs/plugin-react@5`（v6 需要 `@babel/core@8`，与现有依赖冲突），而 v5 的 peer 只到 Vite 7；Vue 侧用 Vite 8 才能配 `@vitejs/plugin-vue@6`。

| 包       | apps/vue               | apps/react               |
| -------- | ---------------------- | ------------------------ |
| vite     | 8.4.0                  | 7.3.8                    |
| 框架插件 | `@vitejs/plugin-vue` 6 | `@vitejs/plugin-react` 5 |
| 组件库   | `tdesign-vue-next`     | `tdesign-react`          |

npm workspaces 会把版本不同的包**嵌套**到各自 `apps/*/node_modules`，因此互不污染。改动依赖后请用 `npm run ls:vite` 复核。

## 约定

- `packages/core` 只能写纯 TS。出现 `import ... from 'vue'` / `'react'` / `'tdesign-*'` 就说明边界破了。
- `packages/theme` 只能写纯 CSS。两端都不许再出现页面级样式文件，类名一律 `tds-` 前缀。
- 改 core 的任何逻辑都要同步补测试并 `npm test` 跑通；core 是两端共用的，坏在这两版一起坏。
- 校验类逻辑一律写成纯函数（输入 → 错误对象），不要在页面里写 `if (name.length < 2)` 这类判定。
- 提交前跑一遍 `npm run lint && npm run format:check && npm test`；格式不一致不让进仓库，避免 review 里出现纯格式化 diff。
- `subscribe` 返回的退订函数必须返回 `void`（不能返回 `boolean`），否则无法直接当作 React 的 effect cleanup。
- `tsconfig` 不要写 `baseUrl`：本项目使用 TypeScript 7，该选项已被移除，`paths` 直接相对 tsconfig 解析。
- 端口写死并开启 `strictPort`，冲突时直接报错，避免静默顺延到别的端口而打开错的页面。
- 新增第三个框架（如 Tuniao）按 `apps/<name>` + 自己的 `vite.config.ts` 加，根配置不用动。

## 环境备注

pnpm 在本机解析 `tdesign-vue-next` + `tdesign-react` 依赖图时会空转（CPU 持续 100%、体积不增长，实测两次均卡死），因此工作区用 npm workspaces 而非 pnpm。若将来换到别的机器，pnpm 的隔离性更强，可以迁回。
