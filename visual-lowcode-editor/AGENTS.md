# 项目上下文

## 项目概览

纯 TypeScript + CSS3 + HTML 实现的网页低代码编辑器 MVP。Vite 仅负责开发服务与生产打包，不使用 React、Vue、Svelte、jQuery 或其他 UI 框架。页面 Schema JSON 树是唯一业务数据源，面板通过自实现的 Proxy Store 订阅后增量更新 DOM。

## 技术栈

- **核心**：TypeScript 5 + 原生 DOM API + CSS3
- **构建**：Vite 7
- **持久化**：浏览器 localStorage
- **预览/导出**：iframe `srcdoc` 与单文件 HTML Blob 下载

## 目录结构

```text
src/
├── core/
│   ├── history.ts          # 快照栈：undo/redo 与事务式提交
│   ├── initial-schema.ts   # 默认页面 Schema
│   ├── registry.ts         # 8 类物料定义、默认属性、属性表单、渲染函数
│   ├── schema.ts           # JSON Schema、组件、样式与属性面板类型
│   ├── schema-utils.ts     # 节点查找、插入、删除、移动、校验
│   ├── store.ts            # 基于 Proxy 的迷你响应式 Store
│   └── uid.ts              # 组件 ID 生成
├── engine/
│   ├── dragdrop.ts         # Pointer 拖拽引擎、插入线、跨容器嵌套
│   └── renderer.ts         # Schema → DOM 渲染与 keyed reconciliation
├── features/
│   ├── export.ts           # 单文件、内联样式、零外部依赖 HTML 导出
│   ├── persistence.ts      # localStorage 自动保存、JSON 导入导出
│   └── preview.ts          # 干净 iframe 预览
├── panels/
│   ├── canvas.ts           # 画布、选中、悬浮、双击编辑
│   ├── inspector.ts        # 属性面板
│   ├── layers.ts           # 图层树与同级上下移动
│   ├── material.ts         # 物料面板
│   └── toolbar.ts          # 顶部工具栏与设备宽度切换
├── index.css               # 编辑器外壳与画布样式
├── index.ts                # 前端入口
└── main.ts                 # 应用组装、快捷键、Store/History 接线
```

## 常用命令

- 安装依赖：`pnpm install`
- 本地开发：`pnpm run dev`
- 生产构建：`pnpm run build`
- 类型检查：`pnpm run ts-check`
- ESLint：`pnpm run lint`
- 生产预览：`pnpm run start`

## 开发规范

- 仅使用 pnpm，禁止 npm/yarn。
- 不引入任何前端 UI 框架、jQuery 或运行时外部 CDN。
- 所有可编辑页面状态优先写入 `PageSchema.root`；临时 UI 状态才放入独立 UI Store。
- Schema 变更必须通过 `HistoryManager.run()` 或 `begin()/commit()` 包裹，确保撤销/重做覆盖添加、删除、移动、属性和文案修改。
- 新增物料时在 `core/registry.ts` 补全类型、默认 props/style、Inspector 字段和渲染函数；渲染结果必须可被 `engine/renderer.ts` 增量复用。
- 导出 HTML 时不得增加外部脚本、字体、样式或图片；图片默认使用内联 data URI。

### 类型与代码风格

- 启用 TypeScript `strict`、`noUnusedLocals`、`noUnusedParameters`。
- 禁止隐式 `any`、`as any` 和未使用导入。
- 事件对象、DOM 查询结果、catch 错误和外部文件解析结果必须显式收窄类型。
- DOM 事件使用原生 `addEventListener`；跨面板逻辑集中在 `main.ts` 接线，不在面板中散落全局状态同步。
