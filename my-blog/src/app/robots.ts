import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

// robots.ts 同样是文件约定:构建时自动生成 /robots.txt
// 告诉搜索引擎可以抓取全站,并指明 sitemap 位置
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
