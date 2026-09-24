// 视频元数据解析 Edge Function
// 解析优先级：平台专用 API（Bilibili / YouTube / Vimeo）→ noembed 聚合 → HTML og:meta 兜底
// 全部为公开接口调用，无需凭证，规避浏览器 CORS 限制

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'

const TIMEOUT = 8000

interface MetaResult {
  title: string
  author: string
  thumbnail: string
  source: string
  duration?: number
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

// 图片 URL 规范化：协议相对路径补 https，B站图床 http 升级 https（避免混合内容被浏览器拦截）
function fixImageUrl(u: unknown): string {
  const s = String(u ?? '')
  if (!s) return ''
  if (s.startsWith('//')) return `https:${s}`
  if (s.startsWith('http://') && /hdslb\.com/i.test(s)) return s.replace(/^http:/, 'https:')
  return s
}

async function fetchJson(url: string, headers: Record<string, string>): Promise<any> {
  try {
    const resp = await fetch(url, { headers, signal: AbortSignal.timeout(TIMEOUT) })
    if (!resp.ok) return null
    return await resp.json()
  } catch (_e) {
    return null
  }
}

// ============ YouTube / Vimeo oEmbed ============
function fromOembed(raw: Record<string, unknown>, source: string): MetaResult {
  return {
    title: String(raw.title ?? ''),
    author: String(raw.author_name ?? raw.provider_name ?? ''),
    thumbnail: fixImageUrl(raw.thumbnail_url),
    source,
    duration: typeof raw.duration === 'number' ? raw.duration : undefined,
  }
}

// ============ Bilibili ============
const BILI_HEADERS = {
  'User-Agent': BROWSER_UA,
  'Referer': 'https://www.bilibili.com/',
}

// 展开短链（b23.tv 等）拿到真实地址
async function expandShortUrl(url: string): Promise<string> {
  if (!/b23\.tv|bili2233\.cn/i.test(url)) return url
  try {
    const resp = await fetch(url, {
      headers: { 'User-Agent': BROWSER_UA },
      redirect: 'follow',
      signal: AbortSignal.timeout(TIMEOUT),
    })
    await resp.body?.cancel()
    return resp.url || url
  } catch (_e) {
    return url
  }
}

async function resolveBilibili(url: string): Promise<MetaResult | null> {
  const expanded = await expandShortUrl(url)

  // ---- 番剧 / 影视（ep 或 ss 链接）----
  const epMatch = expanded.match(/\/ep(\d+)/i)
  const ssMatch = expanded.match(/\/ss(\d+)/i)
  if (epMatch || ssMatch) {
    const qs = epMatch ? `ep_id=${epMatch[1]}` : `season_id=${ssMatch[1]}`
    const data = await fetchJson(`https://api.bilibili.com/pgc/view/web/season?${qs}`, BILI_HEADERS)
    if (data?.code === 0 && data?.result) {
      const r = data.result
      const episodes: Record<string, unknown>[] = Array.isArray(r.episodes) ? r.episodes : []
      const ep = epMatch ? episodes.find((e) => String(e.id) === epMatch[1]) : undefined
      const seasonTitle = String(r.title ?? '')
      const epTitle = String(ep?.long_title || ep?.title || '')
      return {
        title: epTitle ? `${seasonTitle} - ${epTitle}` : seasonTitle,
        author: String(r.media_info?.title ?? '哔哩哔哩番剧'),
        thumbnail: fixImageUrl(ep?.cover ?? r.cover),
        source: 'Bilibili 番剧',
        duration: typeof ep?.duration === "number" ? Math.round(ep.duration / 1000) : undefined, // B站番剧 API 时长为毫秒，转为秒
      }
    }
  }

  // ---- 普通视频（BV 或 av 链接）----
  const bvMatch = expanded.match(/BV[0-9A-Za-z]{8,12}/)
  const avMatch = expanded.match(/\/av(\d+)/i)
  if (bvMatch || avMatch) {
    const qs = bvMatch ? `bvid=${bvMatch[0]}` : `aid=${avMatch[1]}`
    const data = await fetchJson(`https://api.bilibili.com/x/web-interface/view?${qs}`, BILI_HEADERS)
    if (data?.code === 0 && data?.data) {
      const d = data.data
      return {
        title: String(d.title ?? ''),
        author: String(d.owner?.name ?? ''),
        thumbnail: fixImageUrl(d.pic),
        source: 'Bilibili',
        duration: typeof d.duration === 'number' ? d.duration : undefined,
      }
    }
  }

  return null
}

// ============ 通用 HTML og:meta 兜底 ============
async function resolveHtmlMeta(url: string): Promise<MetaResult | null> {
  try {
    const resp = await fetch(url, {
      headers: { 'User-Agent': BROWSER_UA, 'Accept-Language': 'zh-CN,zh;q=0.9' },
      redirect: 'follow',
      signal: AbortSignal.timeout(10000),
    })
    if (!resp.ok) return null
    const html = (await resp.text()).slice(0, 200000)
    const doc = new DOMParser().parseFromString(html, 'text/html')

    const metaContent = (selectors: string[]): string => {
      for (const sel of selectors) {
        const v = doc.querySelector(sel)?.getAttribute('content')?.trim()
        if (v) return v
      }
      return ''
    }

    const title =
      metaContent(['meta[property="og:title"]', 'meta[name="og:title"]']) ||
      doc.querySelector('title')?.textContent?.trim() ||
      ''
    if (!title) return null

    const host = (() => {
      try {
        return new URL(resp.url).hostname.replace(/^www\./i, '')
      } catch (_e) {
        return ''
      }
    })()
    const siteName = metaContent(['meta[property="og:site_name"]', 'meta[name="application-name"]'])
    const author =
      metaContent(['meta[property="og:author"]', 'meta[name="author"]']) || siteName || host

    return {
      title: title.slice(0, 300),
      author,
      thumbnail: fixImageUrl(metaContent(['meta[property="og:image"]', 'meta[name="og:image"]'])),
      source: siteName || host || '网页',
    }
  } catch (_e) {
    return null
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { url } = await req.json()
    if (!url || typeof url !== 'string') {
      return json({ error: '缺少有效的 url 参数' }, 400)
    }
    const trimmed = url.trim()
    if (!/^https?:\/\//i.test(trimmed)) {
      return json({ error: '请输入以 http(s):// 开头的完整链接' }, 400)
    }

    let result: MetaResult | null = null

    // 1. 平台专用解析
    if (/bilibili\.com|b23\.tv|bili2233\.cn/i.test(trimmed)) {
      result = await resolveBilibili(trimmed)
    } else if (/youtube\.com|youtu\.be/i.test(trimmed)) {
      const data = await fetchJson(
        `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(trimmed)}`,
        { 'User-Agent': BROWSER_UA },
      )
      if (data?.title) result = fromOembed(data, 'YouTube')
    } else if (/vimeo\.com/i.test(trimmed)) {
      const data = await fetchJson(
        `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(trimmed)}`,
        { 'User-Agent': BROWSER_UA },
      )
      if (data?.title) result = fromOembed(data, 'Vimeo')
    }

    // 2. noembed 聚合（支持数百站点）
    if (!result) {
      const data = await fetchJson(
        `https://noembed.com/embed?dataType=json&url=${encodeURIComponent(trimmed)}`,
        { 'User-Agent': BROWSER_UA },
      )
      if (data?.title && !data?.error) {
        result = fromOembed(data, String(data.provider_name ?? '网页'))
      }
    }

    // 3. HTML og:meta 兜底（覆盖B站等未收录站点，即使专用 API 失效也能拿到标题）
    if (!result) {
      result = await resolveHtmlMeta(trimmed)
    }

    if (!result) {
      return json(
        { error: '无法解析该链接：站点可能不受支持或需要登录。命令仍可正常生成，可在本地 yt-dlp 中使用' },
        422,
      )
    }
    return json({ data: result })
  } catch (e) {
    return json({ error: `解析失败：${(e as Error).message}` }, 500)
  }
})
