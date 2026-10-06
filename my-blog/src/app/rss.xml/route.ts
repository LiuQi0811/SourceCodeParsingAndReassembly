import { getAllPosts } from "@/lib/posts";
import { siteUrl } from "@/lib/site";

// RSS 订阅:app/rss.xml/route.ts 是文件约定,
// 导出的 GET 函数会在 /rss.xml 路径上返回整个 RSS 文档(XML 文本)
// 没用到请求信息,构建时会和 sitemap.xml 一样被优化成静态文件
// (Next.js 16 的 Route Handler 默认动态渲染,这里显式声明按静态生成)
export const dynamic = "force-static";

// XML 转义:标题/描述里的 & < > " ' 会破坏 XML 结构,必须先换成实体
function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export async function GET() {
  const posts = getAllPosts();

  // 每个 <item> 对应一篇文章:标题/链接/发布时间(RFC 822 格式)/摘要
  const items = posts
    .map((post) => {
      const url = `${siteUrl}/posts/${post.slug}`;
      return `    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${url}</link>
      <guid>${url}</guid>
      <pubDate>${new Date(post.date).toUTCString()}</pubDate>
      <description>${escapeXml(post.description)}</description>
    </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>我的博客</title>
    <link>${siteUrl}</link>
    <description>一个用 Next.js + React + TypeScript 构建的个人博客</description>
    <language>zh-CN</language>
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
  });
}
