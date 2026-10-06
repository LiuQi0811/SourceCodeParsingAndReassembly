import { getAllPosts } from "@/lib/posts";
import PostCard from "@/components/post-card";

// 首页:自我介绍 + 最新文章列表
// getAllPosts() 在构建时于服务端执行,页面输出为纯静态 HTML
export default function Home() {
  const posts = getAllPosts();

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-16">
      {/* 顶部自我介绍区 */}
      <section>
        <h1 className="text-3xl font-semibold tracking-tight">我的博客</h1>
        <p className="mt-4 text-lg leading-8 text-zinc-600 dark:text-zinc-400">
          记录学习与思考，主要写前端：Next.js、React、TypeScript、Tailwind
          CSS。
        </p>
      </section>

      {/* 文章列表区 */}
      <section className="mt-12">
        <h2 className="text-xl font-semibold tracking-tight">最新文章</h2>
        <div className="mt-6 flex flex-col gap-8">
          {posts.map((post) => (
            <PostCard key={post.slug} post={post} />
          ))}
        </div>
      </section>
    </div>
  );
}
