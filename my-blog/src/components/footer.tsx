export default function Footer() {
  return (
    <footer className="border-t border-black/[.08] dark:border-white/[.145]">
      <div className="mx-auto flex w-full max-w-3xl flex-col items-center justify-between gap-2 px-4 py-6 text-sm text-zinc-600 dark:text-zinc-400 sm:flex-row">
        <p>© {new Date().getFullYear()} 我的博客</p>
        <div className="flex items-center gap-4">
          <p>用 Next.js + React + TypeScript 构建</p>
          {/* RSS 订阅入口:xml 文件不是站内页面,用普通 <a> 即可(不需要 next/link) */}
          <a
            href="/rss.xml"
            className="transition-colors hover:text-foreground"
            title="RSS 订阅"
          >
            RSS
          </a>
        </div>
      </div>
    </footer>
  );
}
