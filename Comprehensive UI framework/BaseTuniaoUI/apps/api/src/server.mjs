/**
 * BaseTuniaoUI 装修后端（零依赖）
 * - 数据持久化到 apps/api/data/deco.json
 * - 图片落盘到 apps/api/uploads，并通过 /uploads/<file> 对外提供
 * - 所有响应统一 { code, msg, data }，与后台 Mock / 小程序请求层保持一致
 */
import { createServer as createHttpServer } from 'node:http'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { existsSync, createReadStream, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomBytes, createHmac, timingSafeEqual } from 'node:crypto'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const DATA_DIR = process.env.API_DATA_DIR
  ? path.resolve(process.env.API_DATA_DIR)
  : path.join(ROOT, 'data')
const DATA_FILE = path.join(DATA_DIR, 'deco.json')
const UPLOAD_DIR = process.env.API_UPLOAD_DIR
  ? path.resolve(process.env.API_UPLOAD_DIR)
  : path.join(ROOT, 'uploads')
const MAX_PAGES = 20
const MAX_TEMPLATES = 20
const MAX_VERSIONS = 10
const BODY_LIMIT = 30 * 1024 * 1024
const TOKEN_SECRET = process.env.DECO_TOKEN_SECRET || 'btn-deco-dev-secret'
const TOKEN_TTL = 8 * 60 * 60 * 1000

/** 演示账号，与后台 Mock 保持一致；生产环境应换数据库 + 真实密码哈希 */
const ACCOUNTS = [
  { username: 'admin', password: '123456', role: 'admin', deco: true },
  { username: 'chenmo', password: '123456', role: 'editor', deco: false },
  { username: 'zhouye', password: '123456', role: 'editor', deco: false },
]

const now = () => new Date().toISOString()
const clone = (value) => JSON.parse(JSON.stringify(value))
const id = (prefix) => `${prefix}-${Date.now().toString(36)}${randomBytes(2).toString('hex')}`

const demoPage = () => ({
  version: 1,
  title: '图鸟商城',
  primary: '#01beff',
  components: [
    {
      id: 'banner-1',
      type: 'banner',
      height: 170,
      radius: 14,
      items: [
        { id: 'b1', title: '新品首发 · 全场 8 折' },
        { id: 'b2', title: '会员日 · 积分翻倍' },
        { id: 'b3', title: '爆款清单 · 限时直降' },
      ],
    },
    {
      id: 'notice-1',
      type: 'notice',
      tag: '公告',
      text: '春节期间物流时效说明，点击查看详情',
    },
    {
      id: 'nav-1',
      type: 'nav',
      columns: 4,
      items: [
        { id: 'n1', text: '新品', icon: '新' },
        { id: 'n2', text: '分类', icon: '类' },
        { id: 'n3', text: '会员', icon: '会' },
        { id: 'n4', text: '客服', icon: '客' },
      ],
    },
    {
      id: 'goods-1',
      type: 'goods',
      title: '为你推荐',
      columns: 2,
      items: [
        { id: 'g1', name: '轻量羽绒服 冬季保暖', price: 399, tag: '新品' },
        { id: 'g2', name: '羊毛围巾 燕麦色', price: 129 },
        { id: 'g3', name: '保温杯 500ml', price: 89, tag: '热卖' },
        { id: 'g4', name: '桌面暖风机', price: 199 },
      ],
    },
  ],
})

const createState = () => {
  const home = demoPage()
  return {
    pages: [
      {
        id: 'home',
        path: 'pages/home/index',
        isHome: true,
        title: home.title,
        draft: home,
        draftUpdatedAt: now(),
        published: clone(home),
        publishedAt: now(),
        versions: [],
      },
    ],
    templates: [
      {
        id: 'tpl-demo',
        name: '电商首页模板',
        page: clone(home),
        createdAt: now(),
      },
    ],
  }
}

let state = null

const loadState = async () => {
  await mkdir(DATA_DIR, { recursive: true })
  await mkdir(UPLOAD_DIR, { recursive: true })
  if (existsSync(DATA_FILE)) {
    try {
      state = JSON.parse(await readFile(DATA_FILE, 'utf8'))
      if (!Array.isArray(state.pages) || state.pages.length === 0) state = createState()
      if (!Array.isArray(state.templates)) state.templates = []
    } catch (error) {
      console.warn('[api] 数据文件损坏，已重建示例数据', error)
      state = createState()
    }
  } else {
    state = createState()
  }
  state.pages.forEach((page) => {
    if (!Array.isArray(page.versions)) page.versions = []
  })
  await saveState()
}

let saving = Promise.resolve()
const saveState = () => {
  const snapshot = JSON.stringify(state, null, 2)
  saving = saving.then(async () => {
    const temp = `${DATA_FILE}.tmp`
    await writeFile(temp, snapshot, 'utf8')
    await rename(temp, DATA_FILE)
  })
  return saving
}

class HttpError extends Error {
  constructor(message, code = 400) {
    super(message)
    this.code = code
  }
}

const signToken = (username, role) => {
  const payload = Buffer.from(
    JSON.stringify({ sub: username, role, exp: Date.now() + TOKEN_TTL })
  ).toString('base64url')
  const signature = createHmac('sha256', TOKEN_SECRET).update(payload).digest('base64url')
  return `${payload}.${signature}`
}

const readAuth = (req) => {
  const header = String(req.headers.authorization || '')
  if (!header.startsWith('Bearer ')) return null
  return header.slice(7).trim()
}

const verifyToken = (token) => {
  if (!token || !token.includes('.')) return null
  const [payload, signature] = token.split('.')
  const expected = createHmac('sha256', TOKEN_SECRET).update(payload).digest('base64url')
  try {
    if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null
  } catch {
    return null
  }
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    if (!data?.sub || !data?.exp || data.exp < Date.now()) return null
    return data
  } catch {
    return null
  }
}

const requireAuth = (req) => {
  const claims = verifyToken(readAuth(req))
  if (!claims) throw new HttpError('未登录或登录已过期', 401)
  return claims
}

const findPage = (pageId) => {
  const page = state.pages.find((item) => item.id === pageId)
  if (!page) throw new HttpError(`装修页面不存在：${pageId}`, 404)
  return page
}

const summary = (item) => ({
  id: item.id,
  title: item.draft?.title || item.published?.title || item.title,
  path: item.path,
  isHome: item.isHome,
  publishedAt: item.publishedAt,
  updatedAt: item.draftUpdatedAt,
})

const recordVersion = (page) => {
  if (!page.published) return
  const snapshot = {
    id: id('ver'),
    title: page.published.title || page.title,
    publishedAt: page.publishedAt,
    page: clone(page.published),
  }
  page.versions = [snapshot, ...(page.versions || [])].slice(0, MAX_VERSIONS)
}

const createPage = (title, page) => {
  const pageId = id('page')
  return {
    id: pageId,
    path: `pages/home/index?pageId=${pageId}`,
    isHome: false,
    title,
    draft: page,
    draftUpdatedAt: now(),
    published: null,
    publishedAt: '',
    versions: [],
  }
}

const assertPage = (page) => {
  if (!page || typeof page !== 'object') throw new HttpError('装修数据不合法')
  if (page.version !== 1) throw new HttpError('装修数据版本不支持')
  if (!Array.isArray(page.components)) throw new HttpError('装修组件列表缺失')
}

const sanitizeFileName = (name) => path.basename(String(name || 'image')).replace(/[^\w.-]/g, '_')

const saveUpload = async (body, req) => {
  const dataUrl = String(body.dataUrl || '')
  const matched = dataUrl.match(/^data:(image\/(png|jpeg|jpg|webp|gif));base64,(.+)$/)
  if (!matched) throw new HttpError('仅支持 png / jpeg / webp / gif 图片')

  const buffer = Buffer.from(matched[3], 'base64')
  if (buffer.length > 600 * 1024) throw new HttpError('图片不能超过 600KB')

  const ext = matched[2] === 'jpeg' || matched[2] === 'jpg' ? 'jpg' : matched[2]
  const fileName = `${Date.now().toString(36)}-${randomBytes(4).toString('hex')}.${ext}`
  await writeFile(path.join(UPLOAD_DIR, fileName), buffer)

  const host = req.headers.host || `localhost:${PORT}`
  return {
    url: `http://${host}/uploads/${fileName}`,
    name: sanitizeFileName(body.name || `image.${ext}`),
    size: buffer.length,
    inline: false,
  }
}

const MIME = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
}

const send = (res, status, payload) => {
  const body = JSON.stringify(payload)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  })
  res.end(body)
}

const ok = (res, data) => send(res, 200, { code: 0, msg: 'ok', data })

const fail = (res, error) => {
  const code = error instanceof HttpError ? error.code : 500
  send(res, 200, { code, msg: error?.message || '服务异常', data: null })
}

const readBody = (req) =>
  new Promise((resolve, reject) => {
    let size = 0
    let raw = ''
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > BODY_LIMIT) {
        reject(new HttpError('请求体过大', 413))
        req.destroy()
        return
      }
      raw += chunk
    })
    req.on('end', () => {
      if (!raw) return resolve({})
      try {
        resolve(JSON.parse(raw))
      } catch {
        reject(new HttpError('请求体不是合法 JSON'))
      }
    })
    req.on('error', reject)
  })

const parseRoute = (pathname) => {
  const parts = pathname.split('/').filter(Boolean)
  return { parts }
}

const route = async (req, res, url) => {
  const { parts } = parseRoute(url.pathname)

  if (url.pathname === '/health') return ok(res, { status: 'up', time: now() })

  if (parts[0] === 'uploads' && parts[1]) {
    const filePath = path.join(UPLOAD_DIR, path.basename(parts[1]))
    if (!existsSync(filePath)) return send(res, 404, { code: 404, msg: '文件不存在', data: null })
    const stat = statSync(filePath)
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream',
      'Content-Length': stat.size,
      'Cache-Control': 'public, max-age=86400',
    })
    return createReadStream(filePath).pipe(res)
  }

  if (url.pathname === '/auth/deco-login' && req.method === 'POST') {
    const body = await readBody(req)
    const account = ACCOUNTS.find(
      (item) => item.username === String(body.username || '').trim() && item.password === body.password
    )
    if (!account) throw new HttpError('账号或密码错误', 401)
    if (!account.deco) throw new HttpError('当前账号没有装修编辑权限', 403)
    return ok(res, {
      token: signToken(account.username, account.role),
      expiresAt: new Date(Date.now() + TOKEN_TTL).toISOString(),
      username: account.username,
    })
  }

  if (url.pathname === '/upload' && req.method === 'POST') {
    requireAuth(req)
    const body = await readBody(req)
    return ok(res, await saveUpload(body, req))
  }

  if (parts[0] !== 'deco') throw new HttpError('接口不存在', 404)

  // C 端公开接口：首页、已发布页清单、指定页的已发布数据
  const isPublicPageDetail =
    req.method === 'GET' && parts[1] === 'pages' && parts.length === 3
  const isPublicGet =
    req.method === 'GET' &&
    (url.pathname === '/deco/home' ||
      url.pathname === '/deco/published' ||
      isPublicPageDetail)
  if (!isPublicGet) requireAuth(req)

  // /deco/published 只返回已发布页面，避免把草稿页标题暴露给 C 端
  if (parts[1] === 'published' && parts.length === 2 && req.method === 'GET') {
    return ok(res, {
      pages: state.pages
        .filter((item) => item.published)
        .map((item) => ({
          id: item.id,
          title: item.published.title || item.title,
          path: item.path,
          isHome: item.isHome,
          publishedAt: item.publishedAt,
        })),
    })
  }

  // /deco/home
  if (parts[1] === 'home' && parts.length === 2) {
    if (req.method === 'GET') {
      const home = state.pages.find((item) => item.isHome)
      return ok(res, { page: home?.published || null, publishedAt: home?.publishedAt || '' })
    }
    throw new HttpError('方法不支持', 405)
  }

  // /deco/pages
  if (parts[1] === 'pages' && parts.length === 2) {
    if (req.method === 'GET') return ok(res, { pages: state.pages.map(summary) })
    if (req.method === 'POST') {
      if (state.pages.length >= MAX_PAGES) throw new HttpError(`最多只能创建 ${MAX_PAGES} 个装修页面`)
      const body = await readBody(req)
      const title = String(body.title || '').trim() || `新页面 ${state.pages.length}`
      const record = createPage(title, { version: 1, title, components: [] })
      state.pages.push(record)
      await saveState()
      return ok(res, summary(record))
    }
    throw new HttpError('方法不支持', 405)
  }

  if (parts[1] === 'templates') {
    if (parts.length === 2) {
      if (req.method === 'GET') {
        return ok(res, {
          templates: state.templates.map((item) => ({
            id: item.id,
            name: item.name,
            createdAt: item.createdAt,
          })),
        })
      }
      if (req.method === 'POST') {
        if (state.templates.length >= MAX_TEMPLATES) {
          throw new HttpError(`最多只能保存 ${MAX_TEMPLATES} 个模板`)
        }
        const body = await readBody(req)
        assertPage(body.page)
        const page = clone(body.page)
        const name = String(body.name || '').trim() || `${page.title || '未命名'}模板`
        const record = { id: id('tpl'), name, page, createdAt: now() }
        state.templates.unshift(record)
        await saveState()
        return ok(res, { id: record.id, name: record.name, createdAt: record.createdAt })
      }
      throw new HttpError('方法不支持', 405)
    }

    if (parts.length === 3 && req.method === 'DELETE') {
      const index = state.templates.findIndex((item) => item.id === parts[2])
      if (index < 0) throw new HttpError('模板不存在', 404)
      state.templates.splice(index, 1)
      await saveState()
      return ok(res, true)
    }

    if (parts.length === 4 && parts[3] === 'use' && req.method === 'POST') {
      if (state.pages.length >= MAX_PAGES) throw new HttpError(`最多只能创建 ${MAX_PAGES} 个装修页面`)
      const template = state.templates.find((item) => item.id === parts[2])
      if (!template) throw new HttpError('模板不存在', 404)
      const body = await readBody(req)
      const page = clone(template.page)
      const title = String(body.title || '').trim() || template.name
      page.title = title
      const record = createPage(title, page)
      state.pages.push(record)
      await saveState()
      return ok(res, summary(record))
    }
    throw new HttpError('接口不存在', 404)
  }

  if (parts[1] === 'pages' && parts.length >= 3) {
    const page = findPage(parts[2])

    if (parts.length === 3) {
      if (req.method === 'GET') return ok(res, { page: page.published, publishedAt: page.publishedAt })
      if (req.method === 'DELETE') {
        if (page.isHome) throw new HttpError('首页不允许删除')
        state.pages = state.pages.filter((item) => item.id !== page.id)
        await saveState()
        return ok(res, true)
      }
      throw new HttpError('方法不支持', 405)
    }

    if (parts[3] === 'copy' && req.method === 'POST') {
      if (state.pages.length >= MAX_PAGES) throw new HttpError(`最多只能创建 ${MAX_PAGES} 个装修页面`)
      const base = page.draft || page.published
      if (!base) throw new HttpError('当前页面还没有内容可复制')
      const body = await readBody(req)
      const copied = clone(base)
      const title = String(body.title || '').trim() || `${copied.title || page.title} 副本`
      copied.title = title
      const record = createPage(title, copied)
      state.pages.push(record)
      await saveState()
      return ok(res, summary(record))
    }

    if (parts[3] === 'draft') {
      if (req.method === 'GET') {
        return ok(res, { page: page.draft, updatedAt: page.draftUpdatedAt })
      }
      if (req.method === 'PUT') {
        const body = await readBody(req)
        assertPage(body.page)
        page.draft = body.page
        page.draftUpdatedAt = now()
        page.title = body.page.title || page.title
        await saveState()
        return ok(res, { updatedAt: page.draftUpdatedAt })
      }
      throw new HttpError('方法不支持', 405)
    }

    if (parts[3] === 'publish' && req.method === 'PUT') {
      const body = await readBody(req)
      assertPage(body.page)
      recordVersion(page)
      page.draft = body.page
      page.draftUpdatedAt = now()
      page.published = body.page
      page.publishedAt = now()
      page.title = body.page.title || page.title
      await saveState()
      return ok(res, { publishedAt: page.publishedAt })
    }

    if (parts[3] === 'versions') {
      if (parts.length === 4 && req.method === 'GET') {
        return ok(res, {
          versions: (page.versions || []).map((item) => ({
            id: item.id,
            title: item.title,
            publishedAt: item.publishedAt,
          })),
        })
      }
      if (parts.length === 6 && parts[5] === 'rollback' && req.method === 'POST') {
        const version = (page.versions || []).find((item) => item.id === parts[4])
        if (!version) throw new HttpError('历史版本不存在或已被清理', 404)
        const snapshot = clone(version.page)
        page.versions = (page.versions || []).filter((item) => item.id !== version.id)
        recordVersion(page)
        page.draft = snapshot
        page.draftUpdatedAt = now()
        page.published = clone(snapshot)
        page.publishedAt = now()
        page.title = snapshot.title || page.title
        await saveState()
        return ok(res, { publishedAt: page.publishedAt })
      }
      throw new HttpError('方法不支持', 405)
    }
  }

  throw new HttpError('接口不存在', 404)
}

const PORT = Number(process.env.PORT || 3001)
const HOST = process.env.HOST || '0.0.0.0'

await loadState()

const server = createHttpServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization')
  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  try {
    await route(req, res, new URL(req.url, `http://${req.headers.host || `localhost:${PORT}`}`))
  } catch (error) {
    console.error('[api]', req.method, req.url, error?.message || error)
    fail(res, error)
  }
})

server.listen(PORT, HOST, () => {
  console.log(`[api] http://localhost:${PORT}  (HOST=${HOST})`)
})
