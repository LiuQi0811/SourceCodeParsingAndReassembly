import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Header from "@/components/header";
import Footer from "@/components/footer";
import { siteUrl } from "@/lib/site";
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
  // metadataBase:站点首页地址,用来解析相对路径的资源链接
  metadataBase: new URL(siteUrl),
  title: {
    default: "我的博客", // 没有自己标题的页面(如首页)用它
    template: "%s | 我的博客", // 子页面标题自动拼接:"xxx | 我的博客"
  },
  description: "一个用 Next.js + React + TypeScript 构建的个人博客",
  alternates: {
    // 告诉浏览器/搜索引擎本站有 RSS 订阅源,
    // 会在每个页面的 <head> 里生成 <link rel="alternate" type="application/rss+xml" ...>
    types: { "application/rss+xml": "/rss.xml" },
  },
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
