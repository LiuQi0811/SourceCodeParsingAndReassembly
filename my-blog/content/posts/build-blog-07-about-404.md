---
title: 从零搭建博客(07/11):关于页与自定义 404
date: 2026-09-27
description: 第七篇:两个最简单的页面——静态关于页和自定义 404 页,顺便理清 notFound() 的工作机制。
tags: [从零搭建]
---

系列目录:[01 初始化](/posts/build-blog-01-init) | [02 数据层](/posts/build-blog-02-data-layer) | [03 站点骨架](/posts/build-blog-03-layout-theme) | [04 首页](/posts/build-blog-04-homepage) | [05 详情页](/posts/build-blog-05-post-detail) | [06 标签系统](/posts/build-blog-06-tags) | [07 关于与 404](/posts/build-blog-07-about-404) | [08 SEO](/posts/build-blog-08-seo) | [09 RSS](/posts/build-blog-09-rss) | [10 代码高亮](/posts/build-blog-10-highlight) | [11 部署](/posts/build-blog-11-build-deploy)

## 本篇目标

- 补齐导航里的"关于"页
- 把 Next.js 默认样式的 404 换成自己的

## 1. 关于页 `src/app/about/page.tsx`

```tsx
import type { Metadata } from "next";
import Link from "next/link";

// 关于页:纯静态页面,没有动态数据,直接导出固定的 Metadata
export const metadata: Metadata = {
  title: "关于",
  description: "关于本站和我自己",
};

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-3xl font-bold tracking-tight">关于</h1>

      <div className="mt-8 flex flex-col gap-4 leading-7 text-zinc-600 dark:text-zinc-400">
        <p>
          你好,欢迎来到我的博客。这里记录我在 Web
          开发路上的学习笔记和踩坑经验。
        </p>
        <p>
          这个网站本身就是一个学习项目:它用
          Next.js + React + TypeScript + Tailwind CSS
          从零搭建,所有文章以 Markdown 文件的形式存放在代码仓库里,构建时生成纯静态页面。
        </p>
        <p>如果你对某篇文章有想法,欢迎交流。</p>
      </div>

      {/* 回到文章列表 */}
      <Link
        href="/"
        className="mt-10 inline-block text-sm text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        ← 去看文章
      </Link>
    </div>
  );
}
```

关于页没有动态数据,所以 `metadata` 用 `export const`(普通对象)而不是第 5 篇那种 `generateMetadata`(异步函数)。记住这个分工:

- **页面内容固定** → `export const metadata`
- **标题/描述依赖路由参数** → `generateMetadata`

## 2. 自定义 404 页 `src/app/not-found.tsx`

```tsx
import Link from "next/link";

// 404 页面:详情页/标签页里 notFound() 触发时会渲染这里
// (不写这个文件也会 404,只是用 Next.js 默认样式)
export default function NotFound() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-3xl font-bold tracking-tight">404</h1>
      <p className="mt-4 leading-7 text-zinc-600 dark:text-zinc-400">
        这个页面不存在,可能文章已被删除或链接有误。
      </p>
      <Link
        href="/"
        className="mt-8 inline-block text-sm text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        ← 回首页
      </Link>
    </div>
  );
}
```

**文件名 `not-found.tsx` 是文件约定**:放在 `app/` 根下就是全站 404。第 5、6 篇里调用 `notFound()` 的地方,渲染的就是这个组件。

顺带理清 404 的两条来路:

- **路由不存在**(如 `/foobar`):Next.js 直接用 `not-found.tsx` 渲染
- **路由存在但数据不存在**(如 `/posts/abc`):页面代码里 `notFound()` 主动触发

两条路最终都汇到同一个组件,所以只需要设计一份 404 页面。

## 本篇要点

- 静态页面是最简单也最典型的 Next.js 页面:组件 + 固定 metadata,完事
- `not-found.tsx` 和 `page.tsx` 一样是文件约定,放在 `app/` 根目录作用全站

## 验证

`npm run dev`:导航点"关于"看到新页面;访问 `/abc` 这种不存在的路径,和 `/posts/abc` 这种文章不存在的路径,看到的都是我们的自定义 404(而不是 Next.js 默认的那个)。

至此博客的所有"看得见的页面"都齐了。下一篇:让搜索引擎更好地认识这个站——SEO 三件套。[去第八篇 →](/posts/build-blog-08-seo)
