import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { getAllPosts, getPostBySlug } from "@/lib/posts";

// 方括号文件夹 = 动态路由:/posts/[slug] 会匹配 /posts/my-first-post 这样的 URL
// [slug] 的值通过 props.params 传进来,Next.js 16 里 params 是 Promise,必须 await

// 静态生成:构建时把每篇文章的 slug 告诉 Next.js,
// 这样 `next build` 会为每篇文章提前生成一个独立 HTML(而不是每次请求才渲染)
export function generateStaticParams() {
  return getAllPosts().map((post) => ({ slug: post.slug }));
}

// SEO:每个详情页的 <title> 和 <meta description> 都不一样,由这里按文章生成
// 与 generateStaticParams 一样,是 Next.js 约定的导出函数名
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return { title: "文章未找到" };
  return {
    title: post.title,
    description: post.description,
  };
}

// 页面组件是 async 函数:可以在组件里直接 await 数据(服务端组件的特性)
export default async function PostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getPostBySlug(slug);

  // 文章不存在 → 渲染 404 页面(notFound 是 Next.js 提供的专用函数)
  if (!post) notFound();

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      {/* 返回首页 */}
      <Link
        href="/"
        className="text-sm text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        ← 返回首页
      </Link>

      {/* 文章头部:标题 + 日期 + 标签 */}
      <header className="mt-6 mb-10 border-b border-black/[.08] pb-8 dark:border-white/[.145]">
        <h1 className="text-3xl font-bold tracking-tight">{post.title}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-zinc-500 dark:text-zinc-400">
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
        {/* 摘要:既是页面里的导语,也是搜索引擎结果里的描述 */}
        <p className="mt-4 text-zinc-600 dark:text-zinc-400">{post.description}</p>
      </header>

      {/* 正文:把 Markdown 字符串交给 ReactMarkdown 渲染成真正的 React 元素
          remarkGfm 开启 GitHub 风格语法(表格、删除线、任务列表)
          rehypeHighlight 给代码块加 hljs-xxx 类实现高亮
          (highlight.js 11.11+ 原生支持 ts/tsx,无需任何别名配置)
          article.prose 是排版插件提供的现成排版样式,dark:prose-invert 负责暗色模式 */}
      <article className="prose prose-zinc dark:prose-invert max-w-none">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeHighlight]}
        >
          {post.content}
        </ReactMarkdown>
      </article>
    </div>
  );
}
