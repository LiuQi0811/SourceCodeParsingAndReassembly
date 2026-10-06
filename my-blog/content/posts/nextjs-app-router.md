---
title: Next.js App Router 入门：文件即路由
date: 2026-09-05
tags: [Next.js, 入门]
description: 在 App Router 里，文件夹和文件名就是路由规则，不需要任何配置文件。
---

Next.js 13 之后推荐的 **App Router** 用一套"约定大于配置"的规则来定义路由。

## 文件即路由

| 文件 | 对应网址 |
| --- | --- |
| `src/app/page.tsx` | `/` |
| `src/app/about/page.tsx` | `/about` |
| `src/app/posts/[slug]/page.tsx` | `/posts/任意值` |

- 文件夹名 = URL 路径的一段
- `page.tsx` = 这个路径渲染的页面
- `layout.tsx` = 这一段共用的布局

## 动态路由

带方括号的文件夹是**动态路由**，可以匹配任意值：

```tsx
// src/app/posts/[slug]/page.tsx
export default async function PostPage({
  params,
}: PageProps<"/posts/[slug]">) {
  const { slug } = await params;
  // 用 slug 查询文章并渲染
}
```

> 注意：`params` 是 Promise，需要 `await`——这是 Next.js 15 之后的变化。

## 小结

只要记住"文件即路由"，App Router 就没什么魔法了。
