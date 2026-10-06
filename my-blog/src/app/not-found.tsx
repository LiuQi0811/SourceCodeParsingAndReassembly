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
