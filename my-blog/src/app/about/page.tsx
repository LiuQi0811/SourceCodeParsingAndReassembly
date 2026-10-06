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
