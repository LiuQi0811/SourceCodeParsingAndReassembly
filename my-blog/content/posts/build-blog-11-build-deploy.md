---
title: 从零搭建博客(11/11):生产构建与部署上线
date: 2026-10-01
description: 第十一篇(完结):读懂 next build 的输出,跑生产服务器,部署到 Vercel 或自有服务器,以及日常写新文章的流程。
tags: [从零搭建]
---

系列目录:[01 初始化](/posts/build-blog-01-init) | [02 数据层](/posts/build-blog-02-data-layer) | [03 站点骨架](/posts/build-blog-03-layout-theme) | [04 首页](/posts/build-blog-04-homepage) | [05 详情页](/posts/build-blog-05-post-detail) | [06 标签系统](/posts/build-blog-06-tags) | [07 关于与 404](/posts/build-blog-07-about-404) | [08 SEO](/posts/build-blog-08-seo) | [09 RSS](/posts/build-blog-09-rss) | [10 代码高亮](/posts/build-blog-10-highlight) | [11 部署](/posts/build-blog-11-build-deploy)

## 本篇目标

- 读懂构建产物,确认全站静态化
- 把博客部署上线

## 1. 上线前的三道检查

```bash
npm run lint     # 代码质量
npm run build    # 类型检查 + 生产构建
npm run start    # 本地跑生产版本,最后过一遍所有页面
```

`npm run build` 的输出值得逐行读懂,以这个项目为例:

```text
Route (app)
┌ ○ /                    ← ○ 静态:构建期生成纯 HTML
├ ○ /about
├   /posts/[slug]
│ ├ ● /posts/my-first-post   ← ● SSG:generateStaticParams 生成的静态页
│ └ ● ...
├ ○ /robots.txt
├ ○ /rss.xml             ← 第 9 篇的 force-static 在这里生效
├ ○ /sitemap.xml
└   /tags/[tag]
  ├ ● /tags/CSS
  └ ● ...
```

**没有一个 `ƒ`(动态渲染)**——整个站点构建完就是一堆静态文件,访问速度和安全性都拉满。

## 2. 部署到 Vercel(推荐,免费)

1. 把代码推到 GitHub(仓库里至少要有一次 commit)
2. 打开 [vercel.com](https://vercel.com),Import 对应的 GitHub 仓库
3. **添加环境变量**:`NEXT_PUBLIC_SITE_URL = https://你的域名`——第 8、9 篇的 sitemap、robots、RSS 全靠它拼正确 URL
4. Deploy,一分钟后就能通过 `xxx.vercel.app` 访问,绑自己的域名即可

此后每次 `git push`,Vercel 自动重新构建发布。

## 3. 部署到自有服务器

```bash
npm ci        # 按 lock 文件精确安装
npm run build
npm run start # 默认 3000 端口
```

生产建议用 PM2 守护进程 + Nginx 反向代理:

```bash
npm install -g pm2
pm2 start npm --name blog -- start   # 后台常驻 + 崩溃自动重启
```

记得同样设置环境变量 `NEXT_PUBLIC_SITE_URL` 再构建。

## 4. 日常怎么写文章

整个项目的日常使用简单到只有两步:

1. 在 `content/posts/` 新建一个 `.md` 文件,写好 frontmatter(title / date / description / tags)
2. `git push`(或重新构建)

首页、标签页、文章详情、sitemap、RSS 全部自动更新——这就是第 2 篇"数据层解耦"的回报:**加内容永远不用碰代码**。

## 系列回顾

你已经从空目录走到了生产可用的博客:

| 篇 | 成果 |
|---|---|
| 01 | 项目底子:TypeScript + Tailwind + App Router |
| 02 | 数据层:Markdown 文件即数据库 |
| 03 | 站点骨架:布局、导航、暗色模式 |
| 04 | 首页:文章列表 + 可复用卡片组件 |
| 05 | 详情页:动态路由 + 静态生成 + Markdown 渲染 |
| 06 | 标签系统:索引 + 筛选(附中文标签 404 坑) |
| 07 | 关于页 + 自定义 404 |
| 08 | SEO:元数据模板、sitemap、robots |
| 09 | RSS:Route Handler 从零手写 |
| 10 | 代码高亮:构建期上色 |
| 11 | 构建部署上线(本篇) |

这套架构(静态生成 + 文件存储 + 内容与代码解耦)足够支撑一个长期更新的个人技术博客。往后如果想加评论(Giscus)、统计、站内搜索,都能在这个底子上自然生长。

祝写作愉快。有任何一步卡住,回到对应那一篇再走一遍就好。
