import fs from "fs";
import path from "path";
import matter from "gray-matter";

// 一篇文章的数据结构:TS 接口 = 数据形状的"合同"
export interface Post {
  slug: string; // URL 标识,来自文件名,如 "my-first-post"
  title: string;
  date: string; // 发表日期,格式 YYYY-MM-DD
  description: string;
  tags: string[];
  content: string; // Markdown 正文
}

// content/posts 目录的绝对路径
// process.cwd() = 运行命令时的项目根目录,开发和构建时都能正确工作
const postsDirectory = path.join(process.cwd(), "content", "posts");

// 把 gray-matter 解析出的"无类型数据"安全地转成 Post
// (解析外部数据时做类型校验,而不是拿到 any 到处用)
function toPost(slug: string, raw: string): Post {
  const { data, content } = matter(raw);
  // YAML 里不带引号的日期(如 date: 2026-09-01)会被解析成 Date 对象,统一转成 YYYY-MM-DD 字符串
  const date =
    data.date instanceof Date
      ? data.date.toISOString().slice(0, 10)
      : String(data.date ?? "1970-01-01");
  return {
    slug,
    title: typeof data.title === "string" ? data.title : slug,
    date,
    description: typeof data.description === "string" ? data.description : "",
    tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
    content,
  };
}

// 读取全部文章,按日期从新到旧排序
export function getAllPosts(): Post[] {
  const fileNames = fs
    .readdirSync(postsDirectory)
    .filter((name) => name.endsWith(".md"));
  const posts = fileNames.map((fileName) =>
    toPost(
      fileName.replace(/\.md$/, ""),
      fs.readFileSync(path.join(postsDirectory, fileName), "utf-8")
    )
  );
  // YYYY-MM-DD 格式的字符串直接比较大小,就是按日期排序
  return posts.sort((a, b) => (a.date < b.date ? 1 : -1));
}

// 按 slug 查一篇文章,找不到返回 undefined
export function getPostBySlug(slug: string): Post | undefined {
  return getAllPosts().find((post) => post.slug === slug);
}

// 全部标签去重后排序
export function getAllTags(): string[] {
  const tags = new Set<string>();
  for (const post of getAllPosts()) {
    for (const tag of post.tags) {
      tags.add(tag);
    }
  }
  return [...tags].sort();
}

// 按标签筛选文章(仍然保持新到旧)
export function getPostsByTag(tag: string): Post[] {
  return getAllPosts().filter((post) => post.tags.includes(tag));
}
