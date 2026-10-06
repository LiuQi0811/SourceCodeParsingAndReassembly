---
title: 从零搭建博客(08/11):SEO 三件套——元数据、sitemap 与 robots
date: 2026-09-28
description: 第八篇:升级 layout 元数据(标题模板 + metadataBase),用文件约定自动生成 sitemap.xml 和 robots.txt。
tags: [从零搭建]
---

系列目录:[01 初始化](/posts/build-blog-01-init) | [02 数据层](/posts/build-blog-02-data-layer) | [03 站点骨架](/posts/build-blog-03-layout-theme) | [04 首页](/posts/build-blog-04-homepage) | [05 详情页](/posts/build-blog-05-post-detail) | [06 标签系统](/posts/build-blog-06-tags) | [07 关于与 404](/posts/build-blog-07-about-404) | [08 SEO](/posts/build-blog-08-seo) | [09 RSS](/posts/build-blog-09-rss) | [10 代码高亮](/posts/build-blog-10-highlight) | [11 部署](/posts/build-blog-11-build-deploy)

## 本篇目标

- 每个页面都有正确的 `<title>` 和 `<meta description>`(前面几篇已完成,这里补最后一块:全站模板)
- 自动生成 `/sitemap.xml`(告诉搜索引擎有哪些页面)和 `/robots.txt`(告诉搜索引擎抓取规则)

## 1. 站点地址统一管理 `src/lib/site.ts`

```ts
// 站点地址统一放这里:sitemap、SEO 元数据都用它拼完整 URL
// 部署时在环境变量里设置 NEXT_PUBLIC_SITE_URL(如 https://www.example.com),
// 本地开发不设置就用默认值
export const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
```

把地址抽成常量的原因:sitemap、robots、后面第 9 篇的 RSS 都要拼完整 URL,统一从一个地方读,部署时改环境变量就行,**不改代码**。

## 2. 升级根布局元数据 `src/app/layout.tsx`

把第 3 篇写的 `metadata` 升级成:

```tsx
import { siteUrl } from "@/lib/site";
// ...其他 import 不变

export const metadata: Metadata = {
  // metadataBase:站点首页地址,用来解析相对路径的资源链接
  metadataBase: new URL(siteUrl),
  title: {
    default: "我的博客", // 没有自己标题的页面(如首页)用它
    template: "%s | 我的博客", // 子页面标题自动拼接:"xxx | 我的博客"
  },
  description: "一个用 Next.js + React + TypeScript 构建的个人博客",
};
```

`title.template` 的收益:第 5 篇的 `generateMetadata` 只返回了 `title: post.title`,渲染出来的实际是**"我的第一篇博客:为什么要开始写 | 我的博客"**——站名自动拼上,子页面不用重复写。

## 3. 站点地图 `src/app/sitemap.ts`

```ts
import type { MetadataRoute } from "next";
import { getAllPosts, getAllTags } from "@/lib/posts";
import { siteUrl } from "@/lib/site";

// sitemap.ts 是 Next.js 的文件约定:构建时会自动生成 /sitemap.xml
// 供 Google、Bing 等搜索引擎抓取,告诉它们网站有哪些页面
export default function sitemap(): MetadataRoute.Sitemap {
  // 固定页面
  const staticPages: MetadataRoute.Sitemap = [
    { url: siteUrl, changeFrequency: "daily", priority: 1 },
    { url: `${siteUrl}/tags`, changeFrequency: "weekly", priority: 0.5 },
    { url: `${siteUrl}/about`, changeFrequency: "monthly", priority: 0.3 },
  ];

  // 每篇文章一个条目,更新时间用文章日期
  const postPages: MetadataRoute.Sitemap = getAllPosts().map((post) => ({
    url: `${siteUrl}/posts/${post.slug}`,
    lastModified: post.date,
    changeFrequency: "monthly",
    priority: 0.8,
  }));

  // 每个标签筛选页一个条目
  const tagPages: MetadataRoute.Sitemap = getAllTags().map((tag) => ({
    url: `${siteUrl}/tags/${encodeURIComponent(tag)}`,
    changeFrequency: "weekly",
    priority: 0.4,
  }));

  return [...staticPages, ...postPages, ...tagPages];
}
```

注意第 6 篇的坑在这里同样适用:标签 URL 也用了 `encodeURIComponent`。

## 4. 抓取规则 `src/app/robots.ts`

```ts
import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

// robots.ts 同样是文件约定:构建时自动生成 /robots.txt
// 告诉搜索引擎可以抓取全站,并指明 sitemap 位置
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
```

## 本篇要点

- `sitemap.ts` / `robots.ts` 和 `page.tsx`、`layout.tsx`、`not-found.tsx` 一样,都是 **Next.js 文件约定**:放对文件名,框架自动识别。零配置、零路由声明
- 类型 `MetadataRoute.Sitemap` / `MetadataRoute.Robots` 会约束条目字段,拼错字段名直接编译报错——TypeScript 在文件约定里同样生效
- 这两个文件在构建时执行,生成的是**静态 XML / 文本**,不占运行时开销

## 验证

`npm run dev` 后访问:

- `/sitemap.xml`:能看到所有文章和标签的 URL
- `/robots.txt`:能看到 Allow 规则和 Sitemap 地址
- 打开任意文章页查看网页源码,`<title>` 末尾自动带上了 "| 我的博客"

下一篇:给博客加上 RSS 订阅——用一个"路由处理器"从零手写 XML。[去第九篇 →](/posts/build-blog-09-rss)
