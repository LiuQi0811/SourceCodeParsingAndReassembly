---
title: 从零搭建博客(02/11):数据层——用 Markdown 文件管理文章
date: 2026-09-22
description: 第二篇:安装 gray-matter,定义 Post 类型,写好读取/查询文章的数据层,让内容和页面彻底解耦。
tags: [从零搭建]
---

系列目录:[01 初始化](/posts/build-blog-01-init) | [02 数据层](/posts/build-blog-02-data-layer) | [03 站点骨架](/posts/build-blog-03-layout-theme) | [04 首页](/posts/build-blog-04-homepage) | [05 详情页](/posts/build-blog-05-post-detail) | [06 标签系统](/posts/build-blog-06-tags) | [07 关于与 404](/posts/build-blog-07-about-404) | [08 SEO](/posts/build-blog-08-seo) | [09 RSS](/posts/build-blog-09-rss) | [10 代码高亮](/posts/build-blog-10-highlight) | [11 部署](/posts/build-blog-11-build-deploy)

## 本篇目标

- 文章用 Markdown 文件管理:写一篇新文章 = 加一个 `.md` 文件,不碰任何代码
- 写一个"数据层"模块 `src/lib/posts.ts`:页面从这里取文章,不直接碰文件系统

## 1. 安装解析库

```bash
npm install gray-matter
```

它负责把 Markdown 文件拆成两部分:**frontmatter**(文件开头的元信息)和**正文**。

> 小知识:gray-matter 自带 TypeScript 类型,不需要再装 `@types/gray-matter`(npm 上也不存在这个包)。

## 2. 约定文章格式

在项目根目录建 `content/posts/`,每篇文章一个 `.md` 文件,开头是 YAML 格式的元信息:

```markdown
---
title: 我的第一篇博客:为什么要开始写
date: 2026-08-15
description: 每一个博客的第一篇文章,总是关于"为什么我要开始写"。
tags: [随笔]
---

正文写在这里,支持标准 Markdown 语法。
```

文件名(去掉 `.md`)会作为文章的 URL 标识,即 `slug`。比如 `my-first-post.md` 对应 `/posts/my-first-post`。

## 3. 写数据层

创建 `src/lib/posts.ts`:

```ts
import fs from "fs";
import path from "path";
import matter from "gray-matter";

// 一篇文章的数据结构:TS 接口 = 数据形状的"合同"
export interface Post {
  slug: string; // URL 标识,来自文件名,如 "my-first-post"
  title: string;
  date: string; // 发表日期,格式 YYYY-MM-DD
  description: string;
  tags: string[];
  content: string; // Markdown 正文
}

// content/posts 目录的绝对路径
// process.cwd() = 运行命令时的项目根目录,开发和构建时都能正确工作
const postsDirectory = path.join(process.cwd(), "content", "posts");

// 把 gray-matter 解析出的"无类型数据"安全地转成 Post
// (解析外部数据时做类型校验,而不是拿到 any 到处用)
function toPost(slug: string, raw: string): Post {
  const { data, content } = matter(raw);
  // YAML 里不带引号的日期(如 date: 2026-09-01)会被解析成 Date 对象,统一转成 YYYY-MM-DD 字符串
  const date =
    data.date instanceof Date
      ? data.date.toISOString().slice(0, 10)
      : String(data.date ?? "1970-01-01");
  return {
    slug,
    title: typeof data.title === "string" ? data.title : slug,
    date,
    description: typeof data.description === "string" ? data.description : "",
    tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
    content,
  };
}

// 读取全部文章,按日期从新到旧排序
export function getAllPosts(): Post[] {
  const fileNames = fs
    .readdirSync(postsDirectory)
    .filter((name) => name.endsWith(".md"));
  const posts = fileNames.map((fileName) =>
    toPost(
      fileName.replace(/\.md$/, ""),
      fs.readFileSync(path.join(postsDirectory, fileName), "utf-8")
    )
  );
  // YYYY-MM-DD 格式的字符串直接比较大小,就是按日期排序
  return posts.sort((a, b) => (a.date < b.date ? 1 : -1));
}

// 按 slug 查一篇文章,找不到返回 undefined
export function getPostBySlug(slug: string): Post | undefined {
  return getAllPosts().find((post) => post.slug === slug);
}

// 全部标签去重后排序
export function getAllTags(): string[] {
  const tags = new Set<string>();
  for (const post of getAllPosts()) {
    for (const tag of post.tags) {
      tags.add(tag);
    }
  }
  return [...tags].sort();
}

// 按标签筛选文章(仍然保持新到旧)
export function getPostsByTag(tag: string): Post[] {
  return getAllPosts().filter((post) => post.tags.includes(tag));
}
```

## 本篇要点

- **`interface Post` 是"合同"**:TypeScript 保证传给页面的文章一定有这 6 个字段,拼错字段名会在写代码时直接标红,而不是运行时白屏
- **数据层只用 Node API**:`fs`、`path` 只能跑在服务端。这个文件不加 `"use client"`,它天然只在服务端执行——这也是 Next.js 服务端组件的好处
- **页面永远不直接读文件**:首页、标签页、RSS……全都调这 4 个函数。以后想换数据来源(比如接数据库),只改这一个文件

这一步没有可见效果,别急——下一篇开始把这些数据变成页面。

下一篇:给全站搭骨架:布局、导航、页脚,顺便实现亮暗主题切换。[去第三篇 →](/posts/build-blog-03-layout-theme)
