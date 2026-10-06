---
title: 从零搭建博客(04/11):首页——文章列表与卡片组件
date: 2026-09-24
description: 第四篇:写一个带类型标注的可复用文章卡片组件,用它渲染首页列表,理解 props 类型检查和列表渲染。
tags: [从零搭建]
---

系列目录:[01 初始化](/posts/build-blog-01-init) | [02 数据层](/posts/build-blog-02-data-layer) | [03 站点骨架](/posts/build-blog-03-layout-theme) | [04 首页](/posts/build-blog-04-homepage) | [05 详情页](/posts/build-blog-05-post-detail) | [06 标签系统](/posts/build-blog-06-tags) | [07 关于与 404](/posts/build-blog-07-about-404) | [08 SEO](/posts/build-blog-08-seo) | [09 RSS](/posts/build-blog-09-rss) | [10 代码高亮](/posts/build-blog-10-highlight) | [11 部署](/posts/build-blog-11-build-deploy)

## 本篇目标

- 先做一个"文章卡片"组件(首页、标签页都复用它)
- 用它把首页的文章列表渲染出来

## 1. 文章卡片 `src/components/post-card.tsx`

```tsx
import Link from "next/link";
import type { Post } from "@/lib/posts";

// 文章卡片:首页、标签页都会用到的可复用组件
// props 直接标注 TS 类型——父组件传错字段名,编辑器立刻标红
export default function PostCard({ post }: { post: Post }) {
  return (
    <article className="flex flex-col gap-2 border-b border-black/[.08] pb-8 dark:border-white/[.145]">
      {/* 第一行:日期 + 标签 */}
      <div className="flex flex-wrap items-center gap-3 text-sm text-zinc-500 dark:text-zinc-400">
        {/* time 标签带 dateTime 属性,对搜索引擎更友好 */}
        <time dateTime={post.date}>{post.date}</time>
        <span aria-hidden="true">·</span>
        <div className="flex gap-2">
          {post.tags.map((tag) => (
            <Link
              key={tag}
              href={`/tags/${encodeURIComponent(tag)}`}
              className="rounded-full bg-black/[.04] px-2.5 py-0.5 text-xs transition-colors hover:bg-black/[.08] dark:bg-white/[.08] dark:hover:bg-white/[.15]"
            >
              {tag}
            </Link>
          ))}
        </div>
      </div>
      {/* 第二行:标题,点击进入详情页 */}
      <h3 className="text-lg font-semibold tracking-tight">
        <Link
          href={`/posts/${post.slug}`}
          className="transition-colors hover:text-zinc-600 dark:hover:text-zinc-300"
        >
          {post.title}
        </Link>
      </h3>
      {/* 第三行:摘要 */}
      <p className="leading-7 text-zinc-600 dark:text-zinc-400">
        {post.description}
      </p>
    </article>
  );
}
```

看两个细节:

- **`{ post }: { post: Post }`**:这一行就是组件的"合同"。传个不存在的字段(比如 `post: PostCard` 拼错)编辑器立刻标红;不传 `post` 直接编译报错
- **`encodeURIComponent(tag)`**:标签可能是中文(比如"随笔"),拼 URL 前必须编码成 `%E9%9A%8F%E7%AC%94`,否则部分环境会出问题。这个伏笔在第 6 篇会真正展开

## 2. 首页 `src/app/page.tsx`

整份替换为:

```tsx
import { getAllPosts } from "@/lib/posts";
import PostCard from "@/components/post-card";

// 首页:自我介绍 + 最新文章列表
// getAllPosts() 在构建时于服务端执行,页面输出为纯静态 HTML
export default function Home() {
  const posts = getAllPosts();

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-16">
      {/* 顶部自我介绍区 */}
      <section>
        <h1 className="text-3xl font-semibold tracking-tight">我的博客</h1>
        <p className="mt-4 text-lg leading-8 text-zinc-600 dark:text-zinc-400">
          记录学习与思考,主要写前端:Next.js、React、TypeScript、Tailwind
          CSS。
        </p>
      </section>

      {/* 文章列表区 */}
      <section className="mt-12">
        <h2 className="text-xl font-semibold tracking-tight">最新文章</h2>
        <div className="mt-6 flex flex-col gap-8">
          {posts.map((post) => (
            <PostCard key={post.slug} post={post} />
          ))}
        </div>
      </section>
    </div>
  );
}
```

## 本篇要点

- `page.tsx` 里直接调 `getAllPosts()`,**不用任何 useEffect / 状态管理**——这是服务端组件:数据在构建时就拿到了,浏览器收到的是渲染好的 HTML
- 列表渲染用 `map`,每个卡片必须有唯一的 `key`(React 用它追踪列表项),slug 天然唯一,直接当 key
- 组件拆出来的收益马上会兑现:第 6 篇的标签页一行 `<PostCard post={post} />` 就得到一模一样的卡片

## 验证

`npm run dev` 打开首页:能看到自我介绍和按日期排序的文章列表(如果你照第 2 篇建了文章的话);点卡片标题会去 `/posts/xxx`——先别点,那个页面下一篇就写。

下一篇:文章详情页,本系列第一个"动态路由"。[去第五篇 →](/posts/build-blog-05-post-detail)
