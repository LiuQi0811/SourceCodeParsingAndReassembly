---
title: 从零搭建博客(10/11):代码高亮——让文章里的代码更好读
date: 2026-09-30
description: 第十篇:接入 rehype-highlight 实现代码块语法高亮,手写一套 GitHub Dark 配色,并避开一个会弄坏 ts 高亮的别名陷阱。
tags: [从零搭建]
---

系列目录:[01 初始化](/posts/build-blog-01-init) | [02 数据层](/posts/build-blog-02-data-layer) | [03 站点骨架](/posts/build-blog-03-layout-theme) | [04 首页](/posts/build-blog-04-homepage) | [05 详情页](/posts/build-blog-05-post-detail) | [06 标签系统](/posts/build-blog-06-tags) | [07 关于与 404](/posts/build-blog-07-about-404) | [08 SEO](/posts/build-blog-08-seo) | [09 RSS](/posts/build-blog-09-rss) | [10 代码高亮](/posts/build-blog-10-highlight) | [11 部署](/posts/build-blog-11-build-deploy)

## 本篇目标

文章里代码块的语法高亮:关键字、字符串、注释等不同颜色。高亮发生在**构建期**——浏览器拿到的 HTML 里就已经是带颜色类名的 `<span>`,不需要任何运行时脚本。

## 1. 安装插件

```bash
npm install rehype-highlight
```

## 2. 详情页接入 `src/app/posts/[slug]/page.tsx`

改动只有两处。顶部加 import:

```tsx
import rehypeHighlight from "rehype-highlight";
```

正文渲染的 ReactMarkdown 加一个 `rehypePlugins`:

```tsx
<article className="prose prose-zinc dark:prose-invert max-w-none">
  <ReactMarkdown
    remarkPlugins={[remarkGfm]}
    rehypePlugins={[rehypeHighlight]}
  >
    {post.content}
  </ReactMarkdown>
</article>
```

顺带区分两个插件体系(都是 react-markdown 的参数):

- **remark** 处理的是 Markdown 语法层(表格、删除线等)
- **rehype** 处理的是 HTML 层——高亮是往 HTML 元素上加类名,所以用 rehype

> **警告:不要照抄老教程里的 `aliases` 配置。** 网上很多教程会让你这样写:
>
> ```tsx
> rehypePlugins={[[rehypeHighlight, { aliases: { tsx: "ts" } }]]}
> ```
>
> 这是给**旧版** highlight.js 补漏的写法(它曾经不认识 tsx)。但 highlight.js 11.11 起原生自带 ts/tsx 语法,这句话现在只剩副作用:它会把内置的 `ts → typescript` 映射**覆盖**掉,结果所有 ` ```ts ` 代码块**静默不上色**——构建不报错、页面不报错、就是没有颜色,极难发现(这个站就真实踩过,排查了一整轮)。
>
> 一句话:**什么都不配,就是最正确的配置。**

## 3. 配色 `src/app/globals.css`

rehype-highlight 只负责打类名(`hljs-keyword`、`hljs-string`……),上色要自己写。在 `globals.css` 末尾追加:

```css
/* 代码高亮配色:highlight.js 的 GitHub Dark 调色板
   rehype-highlight 会给代码里的关键字/字符串/注释等打上 hljs-xxx 类,
   这里只负责"上色"。代码块在亮/暗两种站点主题下都是深色背景
   (prose 排版插件默认给 pre 深底浅字),所以只需要这一套颜色 */
.hljs-comment,
.hljs-quote {
  color: #8b949e; /* 注释:灰 */
}

.hljs-keyword,
.hljs-selector-tag,
.hljs-subst {
  color: #ff7b72; /* 关键字:红 */
}

.hljs-literal,
.hljs-number,
.hljs-built_in,
.hljs-type {
  color: #79c0ff; /* 数字/字面量/内置对象:蓝 */
}

.hljs-string,
.hljs-regexp,
.hljs-meta .hljs-string {
  color: #a5d6ff; /* 字符串:浅蓝 */
}

.hljs-title,
.hljs-title.class_,
.hljs-title.function_ {
  color: #d2a8ff; /* 函数/类名:紫 */
}

.hljs-attr,
.hljs-attribute,
.hljs-variable,
.hljs-template-variable {
  color: #ffa657; /* 属性/变量:橙 */
}

.hljs-section,
.hljs-name,
.hljs-selector-id,
.hljs-selector-class {
  color: #7ee787; /* HTML 标签名/选择器:绿 */
}

.hljs-emphasis {
  font-style: italic;
}

.hljs-strong {
  font-weight: 600;
}
```

为什么只写一套暗色?因为第 5 篇的 `prose` 排版插件给代码块的背景**本来就是深色的**(两种站点主题下都是),配套的自然只有深色配色。如果想让亮色模式下代码块是白底,需要连 `--tw-prose-pre-bg` 一起改,再把配色拆成亮暗两套——没必要,深色代码块在两种主题下都很好看。

## 本篇要点

- 高亮 = 插件打类名 + CSS 上色,两步分开,职责清晰
- highlight.js 11.11+ 原生支持 ts/tsx,rehype-highlight 开箱即用;老教程里的 `aliases: { tsx: "ts" }` 反而会弄坏 ts 的高亮,别抄
- 所有工作都在构建期完成:生成的静态 HTML 里就是 `<span class="hljs-keyword">const</span>` 这种带颜色的结构,零运行时开销

## 验证

`npm run dev` 打开一篇带代码块的文章(比如这篇!):代码块应为深色背景,关键字红色、字符串浅蓝、注释灰色——**你现在看到的这些彩色代码,就是本篇实现的效果**。

最后一篇:构建、部署,把博客送上生产。[去第十一篇 →](/posts/build-blog-11-build-deploy)
