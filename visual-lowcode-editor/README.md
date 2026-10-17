# 网页低代码编辑器 MVP

纯 TypeScript、CSS3 与原生 HTML 实现的可视化页面搭建工具。Vite 仅承担开发服务和构建打包职责，项目不使用 React、Vue、Svelte、jQuery 或外部 CDN。

## 核心能力

- 8 种物料：容器、标题、段落文本、按钮、图片、分割线、输入框、链接。
- Pointer 事件拖拽：物料拖入、画布内排序、跨容器嵌套、插入位置指示线。
- 画布交互：选中框、组件类型标签、hover 高亮、Delete 删除、Escape 取消选中、双击编辑文本。
- 属性检查器：实时编辑文案、对齐、字号、字重、颜色、背景色、圆角、宽度、内外边距。
- 图层树：层级展示、点击选中、同级上移/下移。
- 命令式历史记录：Ctrl+Z 撤销，Ctrl+Shift+Z/Ctrl+Y 重做。
- iframe 干净预览、单文件 HTML 导出、localStorage 自动保存、Schema JSON 导入/导出。
- PC/平板/手机三档画布宽度切换。

## 快速开始

```bash
pnpm install
pnpm run dev
```

生产构建：

```bash
pnpm run build
pnpm run start
```

类型与代码检查：

```bash
pnpm run ts-check
pnpm run lint
```

## 架构

- `src/core`：Schema、物料注册表、Proxy Store、快照历史栈与树操作。
- `src/engine`：Schema 渲染、DOM 增量协调和 Pointer 拖拽引擎。
- `src/panels`：工具栏、物料、画布、图层、属性检查器。
- `src/features`：预览、HTML 导出、本地持久化与 JSON 导入导出。

## 数据模型

页面以 `PageSchema` JSON 树表示：根节点是页面容器，组件节点由 `id/type/props/style/children` 构成。所有业务变更都修改 Schema，并由订阅者增量同步 DOM；历史栈通过 Schema JSON 快照完成撤销和重做。

## 导出说明

导出的 HTML 为单个文件，页面样式直接内联到元素上；默认图片是内联 SVG data URI，不依赖外部字体、脚本、图片或样式文件，下载后可直接双击打开。
