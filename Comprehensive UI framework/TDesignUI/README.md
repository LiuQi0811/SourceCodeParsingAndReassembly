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
npm run ls:vite                   # 查看每个 app 实际解析到的 vite 版本
```

两个终端同时开着 `dev:vue` 与 `dev:react` 可并行运行。

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
- 端口写死并开启 `strictPort`，冲突时直接报错，避免静默顺延到别的端口而打开错的页面。
- 新增第三个框架（如 Tuniao）按 `apps/<name>` + 自己的 `vite.config.ts` 加，根配置不用动。

## 环境备注

pnpm 在本机解析 `tdesign-vue-next` + `tdesign-react` 依赖图时会空转（CPU 持续 100%、体积不增长，实测两次均卡死），因此工作区用 npm workspaces 而非 pnpm。若将来换到别的机器，pnpm 的隔离性更强，可以迁回。
