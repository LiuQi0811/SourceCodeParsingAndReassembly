// 站点地址统一放这里:sitemap、SEO 元数据都用它拼完整 URL
// 部署时在环境变量里设置 NEXT_PUBLIC_SITE_URL(如 https://www.example.com),
// 本地开发不设置就用默认值
export const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
