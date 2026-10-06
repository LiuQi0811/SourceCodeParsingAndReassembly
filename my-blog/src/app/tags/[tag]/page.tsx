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
