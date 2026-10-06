---
title: 从零搭建博客(06/11):标签系统——索引页与筛选页
date: 2026-09-26
description: 第六篇:做一个标签云索引页和按标签筛选文章的动态路由,并解决中文标签 URL 编码导致的 404 坑。
tags: [从零搭建]
---

系列目录:[01 初始化](/posts/build-blog-01-init) | [02 数据层](/posts/build-blog-02-data-layer) | [03 站点骨架](/posts/build-blog-03-layout-theme) | [04 首页](/posts/build-blog-04-homepage) | [05 详情页](/posts/build-blog-05-post-detail) | [06 标签系统](/posts/build-blog-06-tags) | [07 关于与 404](/posts/build-blog-07-about-404) | [08 SEO](/posts/build-blog-08-seo) | [09 RSS](/posts/build-blog-09-rss) | [10 代码高亮](/posts/build-blog-10-highlight) | [11 部署](/posts/build-blog-11-build-deploy)

## 本篇目标

- `/tags`:标签云,显示所有标签和每个标签下的文章数
- `/tags/[tag]`:按标签筛选文章(复用第 4 篇的 PostCard)

## 1. 标签索引页 `src/app/tags/page.tsx`

纯静态页面,直接导出固定的 `metadata` 对象即可:

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { getAllPosts, getAllTags } from "@/lib/posts";

// 标签索引页:展示全站所有标签和每个标签下的文章数
// 静态页面,直接导出 Metadata 对象即可(不需要按参数生成)
export const metadata: Metadata = {
  title: "标签",
  description: "按标签浏览全部文章",
};

export default function TagsPage() {
  const tags = getAllTags();
  const posts = getAllPosts();

  // 统计每个标签的文章数:把数组变成 { 标签: 数量 } 的映射
  const countMap = new Map<string, number>();
  for (const post of posts) {
    for (const tag of post.tags) {
      countMap.set(tag, (countMap.get(tag) ?? 0) + 1);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-3xl font-bold tracking-tight">标签</h1>
      <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
        共 {tags.length} 个标签
      </p>

      {/* 标签云:每个标签是一个圆形胶囊,点击进入筛选页
          标签可能是中文,拼 URL 时用 encodeURIComponent 编码,和 PostCard 保持一致 */}
      <div className="mt-8 flex flex-wrap gap-3">
        {tags.map((tag) => (
          <Link
            key={tag}
            href={`/tags/${encodeURIComponent(tag)}`}
            className="rounded-full bg-black/[.04] px-4 py-2 text-sm transition-colors hover:bg-black/[.08] dark:bg-white/[.08] dark:hover:bg-white/[.15]"
          >
            {tag}
            <span className="ml-2 text-xs text-zinc-500 dark:text-zinc-400">
              {countMap.get(tag)}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
```

## 2. 标签筛选页 `src/app/tags/[tag]/page.tsx`

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAllTags, getPostsByTag } from "@/lib/posts";
import PostCard from "@/components/post-card";

// 标签筛选页:/tags/入门 只显示带"入门"标签的文章
// 和详情页一样是动态路由,params 是 Promise,要 await

// 把 URL 里的参数安全地解码成真实标签名
// 标签可能是中文,链接里是编码后的形式(如 %E5%85%A5%E9%97%A8)
// decodeURIComponent 遇到非法编码(如手打的 "100%")会抛错,捕获后按 404 处理
function decodeTag(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    notFound();
  }
}

// 构建时为每个标签生成一个静态页面
// 注意:这里返回编码后的标签,因为请求 URL 就是编码形式,
// 返回原始中文会导致静态路由匹配不上(请求 /tags/%E5%85%A5%E9%97%A8 时 404)
export function generateStaticParams() {
  return getAllTags().map((tag) => ({ tag: encodeURIComponent(tag) }));
}

// SEO:标题里带上解码后的真实标签名
export async function generateMetadata({
  params,
}: {
  params: Promise<{ tag: string }>;
}): Promise<Metadata> {
  const { tag } = await params;
  const decoded = decodeTag(tag);
  return {
    title: `标签:${decoded}`,
    description: `所有关于「${decoded}」的文章`,
  };
}

export default async function TagPage({
  params,
}: {
  params: Promise<{ tag: string }>;
}) {
  const { tag } = await params;
  const decoded = decodeTag(tag);

  // URL 里的标签不存在 → 404(和详情页同一个处理思路)
  if (!getAllTags().includes(decoded)) notFound();

  const posts = getPostsByTag(decoded);

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      {/* 返回标签列表 */}
      <Link
        href="/tags"
        className="text-sm text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        ← 全部标签
      </Link>

      <h1 className="mt-6 text-3xl font-bold tracking-tight">{decoded}</h1>
      <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
        {posts.length} 篇文章
      </p>

      {/* 文章列表:直接复用首页的 PostCard 组件,保证全站卡片样式一致 */}
      <div className="mt-8 flex flex-col gap-8">
        {posts.map((post) => (
          <PostCard key={post.slug} post={post} />
        ))}
      </div>
    </div>
  );
}
```

## 本篇重点:一个真实踩过的坑

**中文标签会 404,而且现象很迷惑。** 我第一次写 `generateStaticParams` 时直接返回了原始中文标签:

```ts
// 错误写法:静态生成能成功,页面文件也生成了,但请求时 404
return getAllTags().map((tag) => ({ tag })); // tag = "入门"
```

坑在哪:**浏览器发出的请求 URL 是编码后的** `/tags/%E5%85%A5%E9%97%A8`,而静态页面是按原始"入门"注册的——编码的 URL 匹配不上,Next.js 转而现场渲染,此时 `params.tag` 拿到的是编码串 `%E5%85%A5%E9%97%A8`,拿它去 `getAllTags()` 里查自然查不到,`notFound()` 就触发了。英文标签(CSS、Tailwind)不受影响,所以测试英文标签全通过,一测中文就 404。

**修复就是代码里的两处配合:**

1. `generateStaticParams` 返回 **`encodeURIComponent` 编码后**的值 → 和请求 URL 对得上,静态匹配成功
2. 页面里用 **`decodeURIComponent` 解码**回真实标签名再查数据 → 渲染和 SEO 标题都正确

`decodeTag` 里的 try/catch 是防御:有人手打 `/tags/100%` 这种非法编码,`decodeURIComponent` 会直接抛异常,捕获后走 404,而不是让页面 500。

## 验证

`npm run dev` 打开 `/tags`:能看到所有标签带数量;点中文标签(如"随笔")进入筛选页,文章列表正常——**特别要测中文标签**,别只测英文的。

下一篇:补齐两个小页面:关于页和自定义 404。[去第七篇 →](/posts/build-blog-07-about-404)
