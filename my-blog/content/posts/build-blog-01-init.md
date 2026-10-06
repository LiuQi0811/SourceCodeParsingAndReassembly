---
title: 从零搭建博客(01/11):初始化 Next.js + TypeScript 项目
date: 2026-09-21
description: 第一篇:用 create-next-app 创建项目,理解自动生成的目录结构和配置文件,跑起开发服务器。
tags: [从零搭建]
---

这是"从零搭建博客"系列的第一篇。跟着这 11 篇做,你会亲手搭出一个完整的博客网站——就是你正在阅读的这个站。

系列目录:[01 初始化](/posts/build-blog-01-init) | [02 数据层](/posts/build-blog-02-data-layer) | [03 站点骨架](/posts/build-blog-03-layout-theme) | [04 首页](/posts/build-blog-04-homepage) | [05 详情页](/posts/build-blog-05-post-detail) | [06 标签系统](/posts/build-blog-06-tags) | [07 关于与 404](/posts/build-blog-07-about-404) | [08 SEO](/posts/build-blog-08-seo) | [09 RSS](/posts/build-blog-09-rss) | [10 代码高亮](/posts/build-blog-10-highlight) | [11 部署](/posts/build-blog-11-build-deploy)

## 本篇目标

- 用官方脚手架创建项目,一份"开箱即配好 TypeScript + Tailwind CSS"的底子
- 看懂每个自动生成的文件是干什么的
- 跑起开发服务器

## 1. 动手创建

先确认 Node 版本(Next.js 16 需要 Node 18+):

```bash
node -v
```

然后创建项目:

```bash
npx create-next-app@latest my-blog
```

安装过程会问几个问题,全部按下面选:

| 问题 | 选择 | 为什么 |
|---|---|---|
| TypeScript? | **Yes** | 类型系统帮我们在写代码时就发现错误 |
| ESLint? | **Yes** | 代码风格和质量检查 |
| Tailwind CSS? | **Yes** | 原子化 CSS,不用写单独的样式文件 |
| `src/` directory? | **Yes** | 源码集中在一起,根目录保持干净 |
| App Router? | **Yes** | Next.js 推荐的路由方式,本系列全用它 |
| Turbopack? | **Yes** | 更快的开发服务器和构建 |

## 2. 生成了什么

进入目录 `cd my-blog`,结构长这样:

```text
my-blog/
├── content/          ← (后面自己创建)放 Markdown 文章
├── public/           ← 静态资源(svg 图标等)
├── src/
│   └── app/          ← 所有页面和布局(路由就按文件夹结构生成)
│       ├── layout.tsx   根布局:全站共有的 <html> 骨架
│       ├── page.tsx     首页(对应 URL /)
│       └── globals.css  全局样式
├── package.json      ← 依赖清单和 npm scripts
├── next.config.ts    ← Next.js 配置
├── tsconfig.json     ← TypeScript 配置
└── postcss.config.mjs← Tailwind 依赖的 PostCSS 配置
```

`package.json` 里最重要的四条命令:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint"
  }
}
```

- `dev`:本地开发,改代码即时生效
- `build`:生产构建(第 11 篇的主角)
- `start`:运行构建产物(模拟线上)
- `lint`:代码检查

`tsconfig.json` 里有这一行,允许写 `@/lib/posts` 代替 `../../lib/posts` 这样的相对路径:

```json
{
  "paths": {
    "@/*": ["./src/*"]
  }
}
```

## 3. 启动验证

```bash
npm run dev
```

打开 http://localhost:3000,看到 Next.js 欢迎页就成功了。

## 本篇要点

- 脚手架生成的不是"垃圾代码",而是配好 TypeScript、Tailwind、ESLint 的可用底子
- App Router 的核心规则:**文件夹 = URL 路径**。`src/app/about/page.tsx` 就自动是 `/about` 页
- `layout.tsx` 是全站共享的外壳,后面我们会往里放导航和页脚

下一篇:给博客建数据层——文章不用数据库,直接用 Markdown 文件。[去第二篇 →](/posts/build-blog-02-data-layer)
