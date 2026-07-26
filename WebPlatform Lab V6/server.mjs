// server.mjs —— 支持 history 模式 SPA 的静态服务器
// 解决刷新页面 404 问题：所有未匹配静态文件的路径都回退到 index.html
// 用法：node server.mjs [port]  （默认 8000）
import { createServer } from 'http';
import { readFile, stat } from 'fs/promises';
import { extname, join, normalize } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const PORT = Number(process.argv[2]) || 8000;
const ROOT = __dirname;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.mjs':  'text/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
  '.ttf':  'font/ttf',
  '.wasm': 'application/wasm',
  '.map':  'application/json',
};

const STATIC_PREFIXES = ['/src/', '/assets/', '/node_modules/'];

createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  let pathname = decodeURIComponent(url.pathname);

  // 安全：阻止路径穿越
  if (pathname.includes('..')) {
    res.writeHead(403); res.end('Forbidden'); return;
  }

  // 静态资源前缀直接按文件返回
  const isStatic = STATIC_PREFIXES.some((p) => pathname.startsWith(p));

  // 兼容旧版相对路径：浏览器可能缓存了使用 ./src/app.js 等相对路径的旧 index.html，
  // 在子路由（如 /components/general）下会请求 /components/src/app.js。
  // 检测路径中是否包含静态前缀，若包含则从该前缀处截取并从根目录重新解析。
  let staticPrefixPos = -1;
  if (!isStatic) {
    for (const p of STATIC_PREFIXES) {
      const idx = pathname.indexOf(p);
      if (idx > 0) { staticPrefixPos = idx; break; }
    }
  }
  const staticExt = extname(pathname).toLowerCase();

  try {
    // 1. 静态资源（/src/、/assets/、/node_modules/ 开头）或包含这些前缀的路径
    if (isStatic || staticPrefixPos >= 0) {
      const staticPath = isStatic ? pathname : pathname.slice(staticPrefixPos);
      const filePath = normalize(join(ROOT, staticPath));
      try {
        const data = await readFile(filePath);
        const ct = MIME[extname(filePath)] || 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': ct, 'Cache-Control': 'no-cache' });
        res.end(data);
        return;
      } catch {
        // 静态资源文件不存在 → 返回 404，避免回退到 index.html 被当作 JS/CSS 执行
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end(`404 Not Found: ${staticPath}`);
        return;
      }
    }

    // 2. 非静态路径：尝试当作真实文件读取（如 /favicon.ico、/index.html、/robots.txt）
    if (pathname !== '/') {
      const filePath = normalize(join(ROOT, pathname));
      try {
        const s = await stat(filePath);
        if (s.isFile()) {
          const data = await readFile(filePath);
          const ct = MIME[extname(filePath)] || 'application/octet-stream';
          res.writeHead(200, { 'Content-Type': ct, 'Cache-Control': 'no-cache' });
          res.end(data);
          return;
        }
      } catch {
        // 不是真实文件 → 继续走 SPA 回退
      }
    }

    // 3. 防御：有静态资源扩展名（.js/.css/.json/.png...）但不存在的路径返回 404
    //    避免浏览器拿到 HTML 当 JS 模块执行，导致 "MIME 类型不匹配" 卡在加载界面
    if (staticExt && Object.prototype.hasOwnProperty.call(MIME, staticExt)) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(`404 Not Found: ${pathname}`);
      return;
    }

    // 4. SPA 回退：所有路由路径（/, /components/basic, /api-lab/...）都返回 index.html
    const indexHtml = await readFile(join(ROOT, 'index.html'), 'utf8');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
    res.end(indexHtml);
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(`Server Error: ${err.message}`);
  }
}).listen(PORT, () => {
  console.log(`\n  ▸ WebPlatform Lab 服务已启动`);
  console.log(`  ▸ 访问 http://127.0.0.1:${PORT}/`);
  console.log(`  ▸ history 模式 SPA 已启用，刷新任意路由不会 404\n`);
});
