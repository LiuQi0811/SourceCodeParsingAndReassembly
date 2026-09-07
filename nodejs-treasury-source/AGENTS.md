# AGENTS.md

## 项目概览

「Node.js 宝典秘籍」：一个纯 TypeScript + CSS3 构建的 Node.js 核心 API 文档型 Web 应用。内容覆盖模块系统、fs、path、http、events、stream、buffer、异步编程、process、工具模块、crypto、child_process、全局对象、TypeScript 最佳实践、LTS 新特性、net/dgram、并发模型（worker_threads/cluster）、readline、zlib/assert/dns/perf_hooks/AsyncLocalStorage，共 21 章、约 97 个 API。

- **技术栈**: Vite 7 + TypeScript（strict）+ 纯 CSS3（无 UI 框架），Express 承载开发/生产服务
- **渲染模式**: Hash 路由 SPA（`#/`、`#/:chapterId`、`#/:chapterId/:apiId`），内容数据内置在前端
- **零前端运行时依赖**: 语法高亮、搜索、终端模拟均为自研实现（`src/lib`、`src/ui`）

## 目录结构

```
├── scripts/            # 构建与启动脚本（dev.sh 含 1200s 自动回收 watchdog）
├── server/             # Express 服务
│   ├── routes/index.ts # API 路由（/api/health、/api/hello、/api/data）
│   ├── server.ts       # 服务入口（开发=Vite 中间件，生产=静态文件）
│   └── vite.ts         # Vite 中间件集成
├── src/
│   ├── index.ts        # 前端入口（import main）
│   ├── main.ts         # 应用装配：布局 + 路由 + 搜索 + 侧边栏
│   ├── index.css       # 全站样式（CSS3 变量 / 磷光绿终端主题）
│   ├── types.ts        # 内容数据模型（ChapterDoc/ApiDoc/ParamDoc/SearchItem）
│   ├── data/           # ★ 章节内容（ch01~ch20）+ index.ts 注册表 + helpers.ts
│   ├── lib/
│   │   ├── highlight.ts  # 零依赖语法高亮（ts/bash/json，token 类名 tk-*）
│   │   ├── router.ts     # hash 路由解析
│   │   └── search.ts     # 搜索索引与打分（标题>签名>描述>haystack）
│   └── ui/
│       ├── layout.ts   # 顶栏/侧边栏/主区骨架 + 抽屉 + 返回顶部
│       ├── sidebar.ts  # 导航渲染（激活态展开 API 列表）
│       ├── content.ts  # 章节页渲染（参数表/示例/细节/配置/上一章下一章）
│       ├── home.ts     # 首页（hero 终端 + 章节卡片）
│       ├── codeblock.ts# 代码块（高亮/复制/终端模拟 replayOutput）
│       └── search.ts   # 搜索下拉（键盘导航 + / 或 Ctrl+K 聚焦）
├── index.html          # 入口 HTML（字体走 fonts.googleapis.cn）
├── DESIGN.md           # 设计规范（磷光绿终端风格 tokens）
└── .coze               # 构建与运行配置（勿改）
```

## 常用命令

```bash
pnpm dev          # 开发（ equivalently: bash ./scripts/dev.sh，端口读 DEPLOY_RUN_PORT）
pnpm build        # 生产构建
pnpm start        # 生产启动
pnpm ts-check     # TypeScript 类型检查
pnpm lint --quiet # ESLint 检查
```

验证一律通过 test_run 工具执行（静态检查 + 接口冒烟）。

## 内容编辑指南（最常见的改动）

新增/修改 API 文档只需改 `src/data/`：

1. 在对应章节文件（如 `ch03-fs.ts`）中用 helpers 组装：
   `api(id, title, signature, desc, params, examples, details, config?, since?)`
   - `p(name, type, required, desc)` 构造参数行
   - `ex(title, code, output?, note?)` / `bash(...)` / `json(...)` 构造示例
2. `id` 章节内唯一，会用于路由 `#/fs/<apiId>` 与锚点 `api-<apiId>`
3. 新章节：新建 `chNN-*.ts` 并在 `src/data/index.ts` 的 `chapters` 数组注册

### 内容文件转义规则（CRITICAL）

示例代码存放在模板字符串中，写入时必须转义：

- 代码中的反引号 → `` \` ``；插值 `${...}` → `\${...}`
- 希望在示例中**显示**的转义符要双写，如进度条 `\r` → 写成 `\\r`
- 禁止出现真实换行以外的控制字符

## 编码规范

- TypeScript `strict` + `noUnusedLocals/Parameters`：禁止隐式 any / `as any`，事件对象、catch 错误需先收窄；未使用变量/导入会直接导致 ts-check 失败
- 类型仅导入时使用 `import type { ... }`
- 样式只写原生 CSS3，颜色/字体一律取 `index.css` 中的 CSS 变量（勿硬编码）
- 面向用户的文案与代码注释使用中文；代码内标点一律半角
- UI 图标用内联 SVG（无 emoji）

## 陷阱与经验

- `scripts/dev.sh` 有 1200s 自动停止 watchdog：服务探活失败时先检查端口 5000 是否监听，再重启 `COZE_LOG_DIR=/app/work/logs/bypass bash ./scripts/dev.sh`
- 端口检测用 `ss -lptn 'sport = :5000'`，勿用 lsof
- 搜索索引字段为 `haystack`（SearchItem 契约见 `src/types.ts`），改名需同步 search.ts
- 终端模拟的输出存于 outputbox 的 `data-output` 属性（已做 HTML 属性转义），重放逻辑在 `codeblock.ts#replayOutput`，用 `runToken` 防止并发重放串台
