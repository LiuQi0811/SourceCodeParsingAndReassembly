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
