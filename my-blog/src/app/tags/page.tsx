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
