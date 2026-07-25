# WebPlatform Lab

> 纯原生 JS + HTML + CSS 实现的 SPA，自研路由系统与类 Ant Design 组件库，覆盖 **178 个 Web API 深度页面**（W3C / WHATWG / TC39 / CSSWG / WebML / WICG 截至 2025-2026 标准）。

## 项目定位

借鉴 MDN Web 文档组织形式，用浏览器原生 API 自主实现：

- **路由系统**：基于 History API 的 push/replace/go/守卫/嵌套/动态参数，零依赖
- **组件库**：类 Ant Design 风格，Button / Card / Table / Modal / Form / Tabs / Tag 等纯原生 CSS 实现
- **状态管理**：自研 Store + EventBus，观察者模式
- **Web API 全景**：178 个深度页面，每页 8 卡规格（概述 / 核心 API / 实战 / 陷阱 / 浏览器支持 / 能力检测 / 日志面板）

## 技术栈

- 纯原生 HTML5 + CSS3 + ES2020+ JavaScript
- ES Module 原生模块化（浏览器直接加载，**零打包**）
- OOP 设计模式（观察者 / 单例 / 工厂 / 模板方法 / 策略 / 装饰器 / 命令）
- 无任何运行时第三方依赖（dev 仅有 jsdom 用于测试）

## 快速开始

```bash
# 1. 进入项目目录
cd webplatform-lab

# 2. 启动静态服务器（任选其一）
python3 -m http.server 8000
# 或
npx serve .
# 或
npx http-server -p 8000

# 3. 浏览器打开
# http://localhost:8000/
```

> ⚠️ 必须通过 HTTP 服务器访问，不能直接 file:// 打开（ES Module 限制）

## 目录结构

```
webplatform-lab/
├── index.html                  # 入口 HTML
├── package.json                # 项目元信息与脚本
├── src/
│   ├── app.js                  # 应用入口
│   ├── core/                   # 自研框架核心
│   │   ├── Component.js        #   组件基类（OOP）
│   │   ├── Router.js           #   路由系统（History API）
│   │   ├── Store.js            #   状态管理
│   │   ├── EventBus.js         #   事件总线
│   │   └── utils.js            #   工具函数
│   ├── components/
│   │   ├── layout/             # 布局组件（Header / Sidebar / Layout）
│   │   └── ui/                 # UI 组件库（15+ 组件）
│   ├── pages/
│   │   ├── HomePage.js         # 首页
│   │   ├── AboutPage.js        # 关于
│   │   └── api-lab/            # ★ 178 个 Web API 深度页面
│   └── routes.js               # 路由配置
├── assets/
│   ├── styles/                 # 全局样式
│   └── data/                   # mock 数据
└── .trae/                      # 测试脚本
    ├── import_check.cjs        #   import 解析检查
    ├── static_check.cjs        #   静态资源检查
    ├── integration_test.mjs    #   集成测试
    └── single_page_test.mjs    #   单页渲染测试
```

## 测试

```bash
npm run check:imports         # 检查所有 import 解析
npm run check:static          # 检查静态资源
npm run test:integration      # 集成测试（路由/守卫/Store/EventBus）
```

## 178 个 Web API 深度页面分类

| 分类 | 数量 | 示例 |
|------|------|------|
| 基础 API | 25 | History / Storage / Fetch / Canvas / Worker / Observer |
| 平台纵深 | 22 | Web Crypto / Performance API / Service Worker / SVG Deep |
| 中期深度 | 38 | File System Access / WebGPU / Privacy Sandbox / BuiltIn AI |
| CSS 深度 | 47 | Flexbox / Grid / Transforms 3D / View Transitions / Houdini |
| 最新标准 | 46 | WebTransport / WebNN / WebCodecs / Compute Pressure / Media Session / MathML Core |

## 浏览器兼容性

- 推荐：Chrome 120+ / Edge 120+ / Firefox 120+ / Safari 17+
- 部分高级 API（WebNN / WebTransport / WebCodecs 等）需最新版浏览器或启用 flag
- 每个深度页均有能力检测，不支持时自动降级为日志演示，**不会抛异常**

## 设计哲学

- **零依赖**：不依赖 React / Vue / jQuery / Lodash 等任何运行时库
- **可读性优先**：每一行代码都可被阅读、调试与学习
- **教育性**：演示 Web 原生能力与 OOP 设计模式如何协同构建现代 SPA
- **完整性**：覆盖 W3C / WHATWG / TC39 / CSSWG 截至 2025-2026 的活跃标准

## License

MIT
