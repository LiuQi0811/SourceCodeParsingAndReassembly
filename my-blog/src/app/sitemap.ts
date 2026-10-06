import type { MetadataRoute } from "next";
import { getAllPosts, getAllTags } from "@/lib/posts";
import { siteUrl } from "@/lib/site";

// sitemap.ts 是 Next.js 的文件约定:构建时会自动生成 /sitemap.xml
// 供 Google、Bing 等搜索引擎抓取,告诉它们网站有哪些页面
export default function sitemap(): MetadataRoute.Sitemap {
  // 固定页面
  const staticPages: MetadataRoute.Sitemap = [
    { url: siteUrl, changeFrequency: "daily", priority: 1 },
    { url: `${siteUrl}/tags`, changeFrequency: "weekly", priority: 0.5 },
    { url: `${siteUrl}/about`, changeFrequency: "monthly", priority: 0.3 },
  ];

  // 每篇文章一个条目,更新时间用文章日期
  const postPages: MetadataRoute.Sitemap = getAllPosts().map((post) => ({
    url: `${siteUrl}/posts/${post.slug}`,
    lastModified: post.date,
    changeFrequency: "monthly",
    priority: 0.8,
  }));

  // 每个标签筛选页一个条目
  const tagPages: MetadataRoute.Sitemap = getAllTags().map((tag) => ({
    url: `${siteUrl}/tags/${encodeURIComponent(tag)}`,
    changeFrequency: "weekly",
    priority: 0.4,
  }));

  return [...staticPages, ...postPages, ...tagPages];
}
