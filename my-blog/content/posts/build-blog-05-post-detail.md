---
title: 从零搭建博客(05/11):文章详情页——动态路由与 Markdown 渲染
date: 2026-09-25
description: 第五篇:创建 /posts/[slug] 动态路由,用 generateStaticParams 静态生成每一篇文章,用 react-markdown 渲染正文。
tags: [从零搭建]
---

系列目录:[01 初始化](/posts/build-blog-01-init) | [02 数据层](/posts/build-blog-02-data-layer) | [03 站点骨架](/posts/build-blog-03-layout-theme) | [04 首页](/posts/build-blog-04-homepage) | [05 详情页](/posts/build-blog-05-post-detail) | [06 标签系统](/posts/build-blog-06-tags) | [07 关于与 404](/posts/build-blog-07-about-404) | [08 SEO](/posts/build-blog-08-seo) | [09 RSS](/posts/build-blog-09-rss) | [10 代码高亮](/posts/build-blog-10-highlight) | [11 部署](/posts/build-blog-11-build-deploy)

## 本篇目标

- 一个页面模板渲染所有文章:`/posts/my-first-post`、`/posts/tailwind-intro`……
- 正文从 Markdown 字符串渲染成真正的 HTML 元素

## 1. 安装依赖

```bash
npm install react-markdown remark-gfm @tailwindcss/typography
```

- `react-markdown`:把 Markdown 渲染成 React 组件
- `remark-gfm`:支持 GitHub 风格语法(表格、删除线、任务列表)
- `@tailwindcss/typography`:给文章内容提供一整套现成排版(标题大小、行距、代码块样式)

在 `src/app/globals.css` 的 `@import "tailwindcss";` 下面加一行,启用排版插件:

```css
@import "tailwindcss";

/* 排版插件:给 article.prose 里的 Markdown 元素(标题/列表/代码块…)提供现成样式 */
@plugin "@tailwindcss/typography";
```

## 2. 创建动态路由

新建文件夹和文件:**`src/app/posts/[slug]/page.tsx`**(注意目录名是方括号 `[slug]`)。

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { getAllPosts, getPostBySlug } from "@/lib/posts";

// 方括号文件夹 = 动态路由:/posts/[slug] 会匹配 /posts/my-first-post 这样的 URL
// [slug] 的值通过 props.params 传进来,Next.js 16 里 params 是 Promise,必须 await

// 静态生成:构建时把每篇文章的 slug 告诉 Next.js,
// 这样 `next build` 会为每篇文章提前生成一个独立 HTML(而不是每次请求才渲染)
export function generateStaticParams() {
  return getAllPosts().map((post) => ({ slug: post.slug }));
}

// SEO:每个详情页的 <title> 和 <meta description> 都不一样,由这里按文章生成
// 与 generateStaticParams 一样,是 Next.js 约定的导出函数名
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return { title: "文章未找到" };
  return {
    title: post.title,
    description: post.description,
  };
}

// 页面组件是 async 函数:可以在组件里直接 await 数据(服务端组件的特性)
export default async function PostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getPostBySlug(slug);

  // 文章不存在 → 渲染 404 页面(notFound 是 Next.js 提供的专用函数)
  if (!post) notFound();

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      {/* 返回首页 */}
      <Link
        href="/"
        className="text-sm text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        ← 返回首页
      </Link>

      {/* 文章头部:标题 + 日期 + 标签 */}
      <header className="mt-6 mb-10 border-b border-black/[.08] pb-8 dark:border-white/[.145]">
        <h1 className="text-3xl font-bold tracking-tight">{post.title}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-zinc-500 dark:text-zinc-400">
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
        {/* 摘要:既是页面里的导语,也是搜索引擎结果里的描述 */}
        <p className="mt-4 text-zinc-600 dark:text-zinc-400">{post.description}</p>
      </header>

      {/* 正文:把 Markdown 字符串交给 ReactMarkdown 渲染成真正的 React 元素
          remarkGfm 开启 GitHub 风格语法(表格、删除线、任务列表)
          article.prose 是排版插件提供的现成排版样式,dark:prose-invert 负责暗色模式 */}
      <article className="prose prose-zinc dark:prose-invert max-w-none">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{post.content}</ReactMarkdown>
      </article>
    </div>
  );
}
```

## 本篇要点

**四个 Next.js 约定的导出,各司其职:**

| 导出 | 作用 | 什么时候执行 |
|---|---|---|
| `generateStaticParams()` | 列出所有合法的 slug | 构建时 |
| `generateMetadata()` | 按文章生成 `<title>`/`<meta>` | 构建时 |
| 默认导出的页面组件 | 渲染文章内容 | 构建时(输出静态 HTML) |
| `notFound()` | slug 不存在时渲染 404 | 请求时兜底 |

**两个新手最容易踩的坑:**

- **`params` 是 Promise**:Next.js 15 起,`params` 必须写 `const { slug } = await params;`,忘了 `await` 拿到的是 Promise 对象,取值全是 undefined
- **prose 类是排版的关键**:`<article className="prose ...">` 套住 Markdown 输出,`@tailwindcss/typography` 才会给标题、段落、代码块套样式;不加它,Markdown 渲染出来是没有样式的裸 HTML

## 验证

`npm run dev`,从首页点任意文章标题:应该看到标题、日期、标签、正文;随便访问一个不存在的路径如 `/posts/abc`,会看到 404。

跑一次 `npm run build`,输出里会看到:

```text
└   /posts/[slug]
  ├ ● /posts/my-first-post
  ├ ● /posts/tailwind-intro
  ...
```

`●` 表示每篇文章都被构建成了一个独立 HTML 文件——这就是静态生成(SSG)。

下一篇:标签系统,以及一个真实踩过的坑:中文标签的 404 问题。[去第六篇 →](/posts/build-blog-06-tags)
