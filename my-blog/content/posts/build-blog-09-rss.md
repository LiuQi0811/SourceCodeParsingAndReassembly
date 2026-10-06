---
title: 从零搭建博客(09/11):给博客加上 RSS 订阅
date: 2026-09-29
description: 第九篇:用 Route Handler 从零手写一个 RSS 订阅源,处理 XML 转义、日期格式和 force-static 静态化,并在页脚放入口。
tags: [从零搭建]
---

系列目录:[01 初始化](/posts/build-blog-01-init) | [02 数据层](/posts/build-blog-02-data-layer) | [03 站点骨架](/posts/build-blog-03-layout-theme) | [04 首页](/posts/build-blog-04-homepage) | [05 详情页](/posts/build-blog-05-post-detail) | [06 标签系统](/posts/build-blog-06-tags) | [07 关于与 404](/posts/build-blog-07-about-404) | [08 SEO](/posts/build-blog-08-seo) | [09 RSS](/posts/build-blog-09-rss) | [10 代码高亮](/posts/build-blog-10-highlight) | [11 部署](/posts/build-blog-11-build-deploy)

## 本篇目标

- 输出 `/rss.xml`:RSS 阅读器可订阅的文章列表
- 学会 Next.js 的另一种文件约定:**Route Handler**(路由处理器),适合返回非 HTML 内容(XML、JSON、文本)

## 1. RSS 路由 `src/app/rss.xml/route.ts`

注意这个文件的组织方式和页面不同:`app/rss.xml/` 目录(名字就是最终路径)+ `route.tsx` 里的 `GET` 函数。

```ts
import { getAllPosts } from "@/lib/posts";
import { siteUrl } from "@/lib/site";

// RSS 订阅:app/rss.xml/route.ts 是文件约定,
// 导出的 GET 函数会在 /rss.xml 路径上返回整个 RSS 文档(XML 文本)
// 没用到请求信息,构建时会和 sitemap.xml 一样被优化成静态文件
// (Next.js 16 的 Route Handler 默认动态渲染,这里显式声明按静态生成)
export const dynamic = "force-static";

// XML 转义:标题/描述里的 & < > " ' 会破坏 XML 结构,必须先换成实体
function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export async function GET() {
  const posts = getAllPosts();

  // 每个 <item> 对应一篇文章:标题/链接/发布时间(RFC 822 格式)/摘要
  const items = posts
    .map((post) => {
      const url = `${siteUrl}/posts/${post.slug}`;
      return `    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${url}</link>
      <guid>${url}</guid>
      <pubDate>${new Date(post.date).toUTCString()}</pubDate>
      <description>${escapeXml(post.description)}</description>
    </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>我的博客</title>
    <link>${siteUrl}</link>
    <description>一个用 Next.js + React + TypeScript 构建的个人博客</description>
    <language>zh-CN</language>
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
  });
}
```

## 2. 让订阅源可被发现:改两处

**① 根布局 `metadata` 里加 `alternates`**(完整位置在 `description` 之后):

```tsx
  alternates: {
    // 告诉浏览器/搜索引擎本站有 RSS 订阅源,
    // 会在每个页面的 <head> 里生成 <link rel="alternate" type="application/rss+xml" ...>
    types: { "application/rss+xml": "/rss.xml" },
  },
```

有了这个 `<link>`,浏览器和 RSS 阅读器就能自动发现订阅入口,不用用户手输地址。

**② 页脚加一个 RSS 入口**(把第 3 篇页脚右侧那行 `<p>` 换成):

```tsx
<div className="flex items-center gap-4">
  <p>用 Next.js + React + TypeScript 构建</p>
  {/* RSS 订阅入口:xml 文件不是站内页面,用普通 <a> 即可(不需要 next/link) */}
  <a
    href="/rss.xml"
    className="transition-colors hover:text-foreground"
    title="RSS 订阅"
  >
    RSS
  </a>
</div>
```

注意这里故意用了普通 `<a>` 而不是 `next/link`:Link 用于站内页面跳转(客户端导航),`/rss.xml` 是一个 XML 文件,浏览器直接下载/展示即可。

## 本篇要点

- **Route Handler vs Page**:`page.tsx` 返回页面 UI,`route.ts` 返回任意响应(XML/JSON/纯文本)。这是给站点加"非页面端点"的标准姿势
- **`force-static`**:Next.js 16 的 Route Handler 默认动态渲染(每次请求现算)。我们的 RSS 内容在构建时就完全确定,加这一行让它变成构建期生成的静态文件,和 sitemap 一样快
- **`escapeXml` 不能省**:标题里只要出现一个 `&`,整个 XML 就解析失败。转义要在拼接前做,`siteUrl`/`slug` 是我们自己控制的字符串可以不转,文章标题和摘要必须转
- **`toUTCString()`**:RSS 规范(RFC 822)要求的日期格式,如 `Thu, 25 Sep 2026 00:00:00 GMT`

## 验证

`npm run dev` 打开 `/rss.xml`:能看到 XML,每篇文章一个 `<item>`。把地址丢进任意 RSS 阅读器(或浏览器插件)就能订阅。查看首页源码,`<head>` 里应能搜到 `rel="alternate"` 的 RSS 声明。

下一篇:最后一个功能——代码高亮,让教程文章里的代码更好读。[去第十篇 →](/posts/build-blog-10-highlight)
