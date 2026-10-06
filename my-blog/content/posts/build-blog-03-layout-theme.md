---
title: 从零搭建博客(03/11):站点骨架——布局、导航与暗色模式
date: 2026-09-23
description: 第三篇:改造根布局,做出导航和页脚,实现跟随系统 + 手动切换 + 记忆偏好的暗色模式,并解释防闪烁脚本。
tags: [从零搭建]
---

系列目录:[01 初始化](/posts/build-blog-01-init) | [02 数据层](/posts/build-blog-02-data-layer) | [03 站点骨架](/posts/build-blog-03-layout-theme) | [04 首页](/posts/build-blog-04-homepage) | [05 详情页](/posts/build-blog-05-post-detail) | [06 标签系统](/posts/build-blog-06-tags) | [07 关于与 404](/posts/build-blog-07-about-404) | [08 SEO](/posts/build-blog-08-seo) | [09 RSS](/posts/build-blog-09-rss) | [10 代码高亮](/posts/build-blog-10-highlight) | [11 部署](/posts/build-blog-11-build-deploy)

## 本篇目标

- 根布局放导航 + 页脚,所有页面自动共享
- 实现暗色模式:跟随系统偏好、可手动切换、刷新后记住选择、不闪屏

> 提示:本篇结束时导航里"标签 / 关于"点进去还是 404,页面要在后面几篇才创建,属于正常现象。

## 1. 全局样式 `src/app/globals.css`

整份替换为:

```css
@import "tailwindcss";

/* 让 dark: 变体跟随 <html> 上的 .dark 类,而不是系统偏好(手动主题切换的基础) */
@custom-variant dark (&:where(.dark, .dark *));

:root {
  --background: #ffffff;
  --foreground: #171717;
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
}

.dark {
  --background: #0a0a0a;
  --foreground: #ededed;
}

body {
  background: var(--background);
  color: var(--foreground);
  font-family: Arial, Helvetica, sans-serif;
}
```

关键一行是 `@custom-variant`:Tailwind 默认让 `dark:` 跟随**系统**偏好,我们改成跟随 `<html>` 上的 `.dark` **类**——这样用户手动切换才能生效。

## 2. 主题切换按钮 `src/components/theme-toggle.tsx`

这是本项目第一个客户端组件(要加 `"use client"`,因为它用到浏览器 API):

```tsx
"use client";

// 太阳图标(暗色模式下显示,点击切回亮色)
function SunIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  );
}

// 月亮图标(亮色模式下显示,点击切到暗色)
function MoonIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
    >
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </svg>
  );
}

// 主题切换按钮:本项目第一个客户端组件
// 思路:不用 React 状态记录主题,图标显示交给 CSS(跟着 <html> 的 dark 类走),
// 点击时直接读真实 DOM——代码更少,也没有"挂载后再同步状态"的水合问题
export default function ThemeToggle() {
  const toggleTheme = () => {
    // 读取 <html> 当前的真实主题,取反得到目标主题
    const next = !document.documentElement.classList.contains("dark");
    // 1. 切换 <html> 的 dark 类,所有 dark: 样式(包括下面两个图标)立即生效
    document.documentElement.classList.toggle("dark", next);
    // 2. 写入 localStorage,刷新后记住选择
    localStorage.setItem("theme", next ? "dark" : "light");
  };

  return (
    <button
      onClick={toggleTheme}
      aria-label="切换亮色/暗色模式"
      className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-600 transition-colors hover:bg-black/[.04] hover:text-foreground dark:text-zinc-400 dark:hover:bg-white/[.08]"
    >
      {/* 两个图标都渲染,由 CSS 决定显示哪个:
          亮色下显示月亮(dark:hidden),暗色下显示太阳(hidden dark:block) */}
      <span className="dark:hidden">
        <MoonIcon />
      </span>
      <span className="hidden dark:block">
        <SunIcon />
      </span>
    </button>
  );
}
```

**为什么不用 `useState` + `useEffect`?** 很多人会写成"用状态记住主题,挂载后读 localStorage 同步状态"。这有两个问题:服务端渲染时拿不到 localStorage,首屏容易报水合错误;而且新版 React 的 lint 规则明确禁止在 effect 里直接 `setState`。让 CSS 跟着 `.dark` 类走、点击时读写真实 DOM,是更简单也更稳的做法。

## 3. 导航 `src/components/header.tsx`

```tsx
import Link from "next/link";
import ThemeToggle from "./theme-toggle";

// 导航链接数据:统一放数组,以后想加页面只需要在这里加一行
const navLinks = [
  { href: "/", label: "首页" },
  { href: "/tags", label: "标签" },
  { href: "/about", label: "关于" },
];

export default function Header() {
  return (
    <header className="sticky top-0 z-10 border-b border-black/[.08] bg-background/80 backdrop-blur dark:border-white/[.145]">
      <div className="mx-auto flex h-14 w-full max-w-3xl items-center justify-between px-4">
        {/* 网站名,点击回首页 */}
        <Link href="/" className="text-lg font-semibold tracking-tight">
          我的博客
        </Link>
        <div className="flex items-center gap-6">
          <nav className="flex items-center gap-6 text-sm">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-zinc-600 transition-colors hover:text-foreground dark:text-zinc-400"
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
```

站内跳转一律用 `next/link` 的 `Link` 而不是 `<a>`:它带预取和客户端导航,点起来不整页刷新。

## 4. 页脚 `src/components/footer.tsx`

```tsx
export default function Footer() {
  return (
    <footer className="border-t border-black/[.08] dark:border-white/[.145]">
      <div className="mx-auto flex w-full max-w-3xl flex-col items-center justify-between gap-2 px-4 py-6 text-sm text-zinc-600 dark:text-zinc-400 sm:flex-row">
        <p>© {new Date().getFullYear()} 我的博客</p>
        <p>用 Next.js + React + TypeScript 构建</p>
      </div>
    </footer>
  );
}
```

## 5. 组装根布局 `src/app/layout.tsx`

```tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Header from "@/components/header";
import Footer from "@/components/footer";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "我的博客",
  description: "一个用 Next.js + React + TypeScript 构建的个人博客",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="zh-CN"
      // 内联脚本会在水合前修改 html 的 class,这里关闭校验避免误报
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col font-sans">
        {/* 首屏主题脚本:在页面渲染前根据 localStorage / 系统偏好给 <html> 加 dark 类,防止刷新时闪一下白屏 */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem("theme")==="dark"||(localStorage.getItem("theme")===null&&window.matchMedia("(prefers-color-scheme: dark)").matches)){document.documentElement.classList.add("dark")}}catch(e){}`,
          }}
        />
        <Header />
        <main className="flex flex-1 flex-col">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
```

三个关键点:

- **防闪烁脚本**:一段内联 `<script>` 在页面渲染**之前**同步执行——有存过偏好就用偏好,没有就跟随系统偏好。没有它,暗色用户每次刷新都会先闪一下白屏
- **`suppressHydrationWarning`**:脚本改了 `<html>` 的 class,和服务端渲染结果不一致;加这个属性告诉 React"这里不同步是故意的",避免误报
- **布局只写一次**:放进 `layout.tsx` 的东西(导航、页脚)在所有页面共享,页面之间切换时**不会重新渲染**

## 验证

`npm run dev` 打开 http://localhost:3000:能看到导航和页脚;点右上角按钮切换亮暗主题;切换后刷新,主题保持不变;页面不闪白屏。

下一篇:把数据层的文章渲染成首页的文章列表。[去第四篇 →](/posts/build-blog-04-homepage)
