/**
 * BaseTuniaoUI 装修后端（零依赖）
 * - 数据持久化到 apps/api/data/deco.json
 * - 图片按应用落盘到 apps/api/uploads/<tenantId>，并通过 /uploads/<tenantId>/<file> 对外提供
 * - 所有响应统一 { code, msg, data }，与后台 Mock / 小程序请求层保持一致
 */
import { createServer as createHttpServer } from 'node:http'
import { mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises'
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
const MAX_AUDIT = 100
const MAX_ASSETS = 200
const MAX_APPROVALS = 50
const BODY_LIMIT = 30 * 1024 * 1024
const TOKEN_SECRET = process.env.DECO_TOKEN_SECRET || 'btn-deco-dev-secret'
const TOKEN_TTL = 8 * 60 * 60 * 1000
const DEFAULT_TENANT_ID = process.env.DECO_DEFAULT_TENANT || 'btn-mall'
const DEFAULT_TENANT_NAME = process.env.DECO_DEFAULT_TENANT_NAME || '图鸟商城'
const DEFAULT_TENANT_APP_ID = process.env.DECO_DEFAULT_APP_ID || 'wx4cd3b6ba323e40ea'
const TENANT_HEADER = 'x-deco-tenant'
const TENANT_ID_PATTERN = /^[a-z0-9][a-z0-9-]{1,31}$/
const APP_ID_PATTERN = /^wx[a-z0-9]{16}$/

/** 演示账号，与后台 Mock 保持一致；生产环境应换数据库 + 真实密码哈希 */
const ACCOUNTS = [
  { username: 'admin', password: '123456', role: 'admin', deco: true },
  { username: 'chenmo', password: '123456', role: 'editor', deco: true },
  { username: 'zhouye', password: '123456', role: 'editor', deco: false },
]

/** 默认应用预置的可管理账号；admin 作为超级管理员自动拥有全部应用 */
const DEFAULT_TENANT_MEMBERS = ['chenmo']
const DECO_EDITOR_NAMES = ACCOUNTS.filter((item) => item.deco && item.role !== 'admin').map(
  (item) => item.username
)
const normalizeMembers = (value) => {
  const names = (Array.isArray(value) ? value : [])
    .map((item) => String(item || '').trim())
    .filter((item) => DECO_EDITOR_NAMES.includes(item))
  return [...new Set(names)]
}

const AUDIT_ACTIONS = new Set([
  'publish',
  'rollback',
  'page-create',
  'page-copy',
  'page-delete',
  'template-use',
  'approval-submit',
  'approval-approve',
  'approval-reject',
])

const APPROVAL_STATUSES = new Set(['pending', 'approved', 'rejected'])

const IMAGE_FILE_PATTERN = /\.(png|jpe?g|webp|gif)$/i

/** 素材元信息只存索引，文件本体在 uploads/<tenantId>/ 下 */
const normalizeAssets = (value) =>
  (Array.isArray(value) ? value : [])
    .filter(
      (item) =>
        item &&
        typeof item === 'object' &&
        String(item.id || '') &&
        String(item.url || '') &&
        (String(item.path || '') || String(item.fileName || ''))
    )
    .map((item) => {
      const fileName = path.basename(String(item.fileName || item.path || ''))
      return {
        id: String(item.id),
        url: String(item.url),
        path: String(item.path || `/uploads/${fileName}`),
        fileName,
        name: String(item.name || fileName),
        size: Number(item.size) || 0,
        createdAt: String(item.createdAt || now()),
        createdBy: String(item.createdBy || ''),
      }
    })
    .slice(0, MAX_ASSETS)

/** 老数据没有审计字段；只保留结构完整、动作已登记的历史记录 */
const normalizeAudit = (value) =>
  (Array.isArray(value) ? value : [])
    .filter(
      (item) =>
        item &&
        typeof item === 'object' &&
        String(item.id || '') &&
        AUDIT_ACTIONS.has(String(item.action || '')) &&
        String(item.actor || '') &&
        String(item.at || '')
    )
    .map((item) => ({
      id: String(item.id),
      actor: String(item.actor),
      role: String(item.role || ''),
      action: String(item.action),
      pageId: String(item.pageId || ''),
      pageTitle: String(item.pageTitle || ''),
      at: String(item.at),
    }))
    .slice(0, MAX_AUDIT)

/** 发布审批：保留提交时的页面快照，管理员通过后按该快照上线 */
const normalizeApprovals = (value) =>
  (Array.isArray(value) ? value : [])
    .filter(
      (item) =>
        item &&
        typeof item === 'object' &&
        String(item.id || '') &&
        String(item.pageId || '') &&
        APPROVAL_STATUSES.has(String(item.status || '')) &&
        item.page &&
        typeof item.page === 'object' &&
        item.page.version === 1 &&
        Array.isArray(item.page.components) &&
        String(item.submittedBy || '') &&
        String(item.submittedAt || '')
    )
    .map((item) => ({
      id: String(item.id),
      pageId: String(item.pageId),
      pageTitle: String(item.pageTitle || item.page?.title || ''),
      status: String(item.status),
      submittedBy: String(item.submittedBy),
      submittedAt: String(item.submittedAt),
      reviewedBy: String(item.reviewedBy || ''),
      reviewedAt: String(item.reviewedAt || ''),
      reason: String(item.reason || ''),
      page: clone(item.page),
    }))
    .slice(0, MAX_APPROVALS)

const now = () => new Date().toISOString()
const clone = (value) => JSON.parse(JSON.stringify(value))
const id = (prefix) => `${prefix}-${Date.now().toString(36)}${randomBytes(2).toString('hex')}`

const demoPage = (title = DEFAULT_TENANT_NAME) => ({
  version: 1,
  title,
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

const seedPages = (title = DEFAULT_TENANT_NAME) => {
  const home = demoPage(title)
  return [
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
  ]
}

const seedTemplates = (title = DEFAULT_TENANT_NAME) => {
  const home = demoPage(title)
  return [
    {
      id: 'tpl-demo',
      name: '电商首页模板',
      page: clone(home),
      createdAt: now(),
    },
  ]
}

const createTenantRecord = (tenantId, name, appId, pages, templates, members = []) => ({
  id: tenantId,
  name,
  appId,
  createdAt: now(),
  members: normalizeMembers(members),
  pages: pages || seedPages(name),
  templates: templates || seedTemplates(name),
  audit: [],
  assets: [],
  approvals: [],
})

const createState = () => ({
  version: 5,
  defaultTenantId: DEFAULT_TENANT_ID,
  tenants: [
    createTenantRecord(
      DEFAULT_TENANT_ID,
      DEFAULT_TENANT_NAME,
      DEFAULT_TENANT_APP_ID,
      undefined,
      undefined,
      DEFAULT_TENANT_MEMBERS
    ),
  ],
})

let state = null

/**
 * 兼容单应用老数据：老文件顶层是 { pages, templates }，
 * 迁移成默认租户，避免升级后历史装修数据丢失。
 */
const normalizeState = (raw) => {
  if (Array.isArray(raw?.tenants) && raw.tenants.length > 0) {
    const tenants = raw.tenants.map((tenant, index) => {
      const tenantId = TENANT_ID_PATTERN.test(String(tenant?.id || ''))
        ? String(tenant.id)
        : `app-${index + 1}`
      const name = String(tenant?.name || '').trim() || `小程序 ${index + 1}`
      const pages =
        Array.isArray(tenant?.pages) && tenant.pages.length ? tenant.pages : seedPages(name)
      pages.forEach((page) => {
        if (!Array.isArray(page.versions)) page.versions = []
      })
      const templates = Array.isArray(tenant?.templates) ? tenant.templates : seedTemplates(name)
      return {
        id: tenantId,
        name,
        appId: String(tenant?.appId || ''),
        createdAt: tenant?.createdAt || now(),
        members:
          tenant?.members === undefined
            ? normalizeMembers(tenantId === DEFAULT_TENANT_ID ? DEFAULT_TENANT_MEMBERS : [])
            : normalizeMembers(tenant.members),
        pages,
        templates,
        audit: normalizeAudit(tenant?.audit),
        assets: normalizeAssets(tenant?.assets),
        approvals: normalizeApprovals(tenant?.approvals),
      }
    })
    const ids = new Set(tenants.map((tenant) => tenant.id))
    const defaultTenantId = ids.has(String(raw.defaultTenantId || ''))
      ? String(raw.defaultTenantId)
      : tenants[0].id
    return { version: 5, defaultTenantId, tenants }
  }

  const legacyPages = Array.isArray(raw?.pages) && raw.pages.length ? raw.pages : seedPages()
  legacyPages.forEach((page) => {
    if (!Array.isArray(page.versions)) page.versions = []
  })
  const legacyTemplates = Array.isArray(raw?.templates) ? raw.templates : seedTemplates()
  return {
    version: 5,
    defaultTenantId: DEFAULT_TENANT_ID,
    tenants: [
      createTenantRecord(
        DEFAULT_TENANT_ID,
        DEFAULT_TENANT_NAME,
        DEFAULT_TENANT_APP_ID,
        legacyPages,
        legacyTemplates,
        DEFAULT_TENANT_MEMBERS
      ),
    ],
  }
}

/** 把升级前已经落盘、但还没有索引的上传文件补进素材库 */
const syncTenantAssets = async (tenant) => {
  const dir = path.join(UPLOAD_DIR, tenant.id)
  if (!existsSync(dir)) return
  let files = []
  try {
    files = await readdir(dir)
  } catch {
    return
  }
  const known = new Set((tenant.assets || []).map((item) => item.fileName))
  const incoming = files
    .filter((file) => IMAGE_FILE_PATTERN.test(file) && !known.has(file))
    .map((file) => {
      const filePath = path.join(dir, file)
      const stat = statSync(filePath)
      return { file, size: stat.size, mtime: stat.mtime }
    })
    .sort((a, b) => b.mtime.getTime() - a.mtime.getTime())

  const additions = incoming.map(({ file, size, mtime }) => {
    const assetPath = `/uploads/${tenant.id}/${file}`
    return {
      id: id('asset'),
      url: `http://localhost:${PORT}${assetPath}`,
      path: assetPath,
      fileName: file,
      name: file,
      size,
      createdAt: mtime.toISOString(),
      createdBy: 'legacy',
    }
  })
  tenant.assets = [...additions, ...(tenant.assets || [])].slice(0, MAX_ASSETS)
}

const loadState = async () => {
  await mkdir(DATA_DIR, { recursive: true })
  await mkdir(UPLOAD_DIR, { recursive: true })
  if (existsSync(DATA_FILE)) {
    try {
      state = normalizeState(JSON.parse(await readFile(DATA_FILE, 'utf8')))
    } catch (error) {
      console.warn('[api] 数据文件损坏，已重建示例数据', error)
      state = createState()
    }
  } else {
    state = createState()
  }
  await Promise.all(state.tenants.map((tenant) => syncTenantAssets(tenant)))
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

const readTenantId = (req) => String(req.headers[TENANT_HEADER] || '').trim()

const resolveTenant = (req) => {
  const tenantId = readTenantId(req) || state.defaultTenantId
  const tenant = state.tenants.find((item) => item.id === tenantId)
  if (!tenant) throw new HttpError(`装修应用不存在：${tenantId}`, 404)
  return tenant
}

const tenantSummary = (tenant) => ({
  id: tenant.id,
  name: tenant.name,
  appId: tenant.appId,
  createdAt: tenant.createdAt,
  members: tenant.members || [],
  pageCount: tenant.pages.length,
})

const canManageTenant = (claims, tenant) =>
  claims.role === 'admin' || (tenant.members || []).includes(claims.sub)

const assertTenantAccess = (claims, tenant) => {
  if (!canManageTenant(claims, tenant)) {
    throw new HttpError(`当前账号没有「${tenant.name}」的装修权限`, 403)
  }
  return tenant
}

/** 审计只记录业务操作，不记录草稿保存，避免每次保存都滚动日志 */
const recordAudit = (tenant, claims, action, target = {}) => {
  tenant.audit = [
    {
      id: id('log'),
      actor: claims.sub,
      role: claims.role,
      action,
      pageId: String(target.pageId || ''),
      pageTitle: String(target.pageTitle || ''),
      at: now(),
    },
    ...(tenant.audit || []),
  ].slice(0, MAX_AUDIT)
}

/**
 * 素材引用索引：草稿、线上、历史版本和模板都算引用。
 * 历史版本也算，避免删素材后回滚出现裂图。
 */
const collectAssetSources = (tenant) => {
  const sources = []
  const push = (type, sourceId, title, state, page) => {
    if (!page || typeof page !== 'object') return
    sources.push({ type, id: sourceId, title, state, content: JSON.stringify(page) })
  }
  for (const page of tenant.pages || []) {
    push('page', page.id, page.title, 'draft', page.draft)
    push('page', page.id, page.title, 'published', page.published)
    for (const version of page.versions || []) {
      push('page', `${page.id}:${version.id}`, page.title, 'history', version.page)
    }
  }
  for (const template of tenant.templates || []) {
    push('template', template.id, template.name, 'template', template.page)
  }
  for (const approval of tenant.approvals || []) {
    if (approval.status !== 'pending') continue
    push('approval', approval.id, approval.pageTitle, 'pending', approval.page)
  }
  return sources
}

const assetUsage = (asset, sources) => {
  const needle = asset.path || asset.url
  return sources
    .filter((source) => source.content.includes(needle))
    .map(({ content, ...source }) => source)
}

const assertMembers = (value) => {
  if (value === undefined) return undefined
  if (!Array.isArray(value)) throw new HttpError('应用成员必须是账号数组')
  return normalizeMembers(value)
}

const assertTenantId = (tenantId) => {
  if (!TENANT_ID_PATTERN.test(tenantId)) {
    throw new HttpError('应用标识只能是 2-32 位小写字母、数字或中划线')
  }
  if (state.tenants.some((item) => item.id === tenantId)) {
    throw new HttpError(`应用标识已存在：${tenantId}`, 409)
  }
  return tenantId
}

const assertAppId = (appId) => {
  if (!APP_ID_PATTERN.test(appId)) throw new HttpError('AppID 格式不正确，应以 wx 开头且共 18 位')
  return appId
}

const assertAppIdAvailable = (appId, exceptTenantId = '') => {
  assertAppId(appId)
  if (state.tenants.some((item) => item.appId === appId && item.id !== exceptTenantId)) {
    throw new HttpError(`AppID 已被其他小程序应用使用：${appId}`, 409)
  }
  return appId
}

const findPage = (tenant, pageId) => {
  const page = tenant.pages.find((item) => item.id === pageId)
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

const approvalSummary = (item) => ({
  id: item.id,
  pageId: item.pageId,
  pageTitle: item.pageTitle,
  status: item.status,
  submittedBy: item.submittedBy,
  submittedAt: item.submittedAt,
  reviewedBy: item.reviewedBy,
  reviewedAt: item.reviewedAt,
  reason: item.reason,
})

/** 管理员绕过审批直接发布 / 回滚时，关闭该页待审申请，避免之后通过旧快照把线上覆盖回去 */
const closePendingApprovals = (tenant, pageId, reason) => {
  for (const item of tenant.approvals || []) {
    if (item.pageId !== pageId || item.status !== 'pending') continue
    item.status = 'rejected'
    item.reviewedBy = 'system'
    item.reviewedAt = now()
    item.reason = reason
  }
}

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

const saveUpload = async (body, req, tenant, claims) => {
  const dataUrl = String(body.dataUrl || '')
  const matched = dataUrl.match(/^data:(image\/(png|jpeg|jpg|webp|gif));base64,(.+)$/)
  if (!matched) throw new HttpError('仅支持 png / jpeg / webp / gif 图片')
  if ((tenant.assets || []).length >= MAX_ASSETS) {
    throw new HttpError(`素材数量已达上限（${MAX_ASSETS} 个），请先清理未引用素材`)
  }

  const buffer = Buffer.from(matched[3], 'base64')
  if (buffer.length > 600 * 1024) throw new HttpError('图片不能超过 600KB')

  const ext = matched[2] === 'jpeg' || matched[2] === 'jpg' ? 'jpg' : matched[2]
  const fileName = `${Date.now().toString(36)}-${randomBytes(4).toString('hex')}.${ext}`
  const tenantDir = path.join(UPLOAD_DIR, tenant.id)
  await mkdir(tenantDir, { recursive: true })
  await writeFile(path.join(tenantDir, fileName), buffer)

  const host = req.headers.host || `localhost:${PORT}`
  const url = `http://${host}/uploads/${tenant.id}/${fileName}`
  const asset = {
    id: id('asset'),
    url,
    path: `/uploads/${tenant.id}/${fileName}`,
    fileName,
    name: sanitizeFileName(body.name || `image.${ext}`),
    size: buffer.length,
    createdAt: now(),
    createdBy: claims.sub,
  }
  tenant.assets = [asset, ...(tenant.assets || [])].slice(0, MAX_ASSETS)
  await saveState()

  return {
    url,
    name: asset.name,
    size: asset.size,
    inline: false,
    assetId: asset.id,
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
    const tenantDir =
      parts[2] && TENANT_ID_PATTERN.test(parts[1]) ? path.join(UPLOAD_DIR, parts[1]) : UPLOAD_DIR
    const fileName = path.basename(parts[2] || parts[1])
    const filePath = path.join(tenantDir, fileName)
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
      (item) =>
        item.username === String(body.username || '').trim() && item.password === body.password
    )
    if (!account) throw new HttpError('账号或密码错误', 401)
    if (!account.deco) throw new HttpError('当前账号没有装修编辑权限', 403)
    return ok(res, {
      token: signToken(account.username, account.role),
      expiresAt: new Date(Date.now() + TOKEN_TTL).toISOString(),
      username: account.username,
      role: account.role,
    })
  }

  if (url.pathname === '/upload' && req.method === 'POST') {
    const claims = requireAuth(req)
    const tenant = resolveTenant(req)
    assertTenantAccess(claims, tenant)
    const body = await readBody(req)
    return ok(res, await saveUpload(body, req, tenant, claims))
  }

  if (parts[0] !== 'deco') throw new HttpError('接口不存在', 404)

  // 应用（租户）管理：一个后台可以维护多个小程序，每个小程序的数据互相隔离
  if (parts[1] === 'tenants') {
    const claims = requireAuth(req)

    if (parts.length === 2 && req.method === 'GET') {
      const visible =
        claims.role === 'admin'
          ? state.tenants
          : state.tenants.filter((tenant) => canManageTenant(claims, tenant))
      const visibleDefaultId = visible.some((tenant) => tenant.id === state.defaultTenantId)
        ? state.defaultTenantId
        : visible[0]?.id || ''
      return ok(res, {
        defaultTenantId: visibleDefaultId,
        canManage: claims.role === 'admin',
        tenants: visible.map(tenantSummary),
      })
    }

    if (parts.length === 2 && req.method === 'POST') {
      if (claims.role !== 'admin') throw new HttpError('只有管理员可以新增小程序应用', 403)
      const body = await readBody(req)
      const name = String(body.name || '').trim()
      if (!name) throw new HttpError('请填写小程序名称')
      const appId = assertAppIdAvailable(String(body.appId || '').trim())
      const tenantId = assertTenantId(
        String(body.id || '').trim() || `app-${Date.now().toString(36)}`
      )
      const tenant = createTenantRecord(
        tenantId,
        name,
        appId,
        undefined,
        undefined,
        assertMembers(body.members) || []
      )
      state.tenants.push(tenant)
      await saveState()
      return ok(res, tenantSummary(tenant))
    }

    if (parts.length === 3 && req.method === 'PUT') {
      if (claims.role !== 'admin') throw new HttpError('只有管理员可以修改小程序应用', 403)
      const tenant = state.tenants.find((item) => item.id === parts[2])
      if (!tenant) throw new HttpError(`装修应用不存在：${parts[2]}`, 404)
      const body = await readBody(req)
      const name = String(body.name ?? tenant.name).trim()
      if (!name) throw new HttpError('请填写小程序名称')
      const appId = assertAppIdAvailable(String(body.appId ?? tenant.appId).trim(), tenant.id)
      const members = assertMembers(body.members)
      tenant.name = name
      tenant.appId = appId
      if (members !== undefined) tenant.members = members
      await saveState()
      return ok(res, tenantSummary(tenant))
    }

    if (parts.length === 3 && req.method === 'DELETE') {
      if (claims.role !== 'admin') throw new HttpError('只有管理员可以删除小程序应用', 403)
      const tenant = state.tenants.find((item) => item.id === parts[2])
      if (!tenant) throw new HttpError(`装修应用不存在：${parts[2]}`, 404)
      if (tenant.id === state.defaultTenantId) {
        throw new HttpError('默认小程序应用不能删除', 400)
      }
      state.tenants = state.tenants.filter((item) => item.id !== tenant.id)
      await saveState()
      await rm(path.join(UPLOAD_DIR, tenant.id), { recursive: true, force: true })
      return ok(res, { id: tenant.id })
    }

    throw new HttpError('方法不支持', 405)
  }

  // 可分配的应用成员账号；admin 自动拥有全部应用，不进入成员列表
  if (parts[1] === 'accounts' && parts.length === 2 && req.method === 'GET') {
    const claims = requireAuth(req)
    if (claims.role !== 'admin') throw new HttpError('只有管理员可以查看装修账号', 403)
    return ok(res, {
      accounts: ACCOUNTS.filter((item) => item.deco && item.role !== 'admin').map((item) => ({
        username: item.username,
        role: item.role,
      })),
    })
  }

  const isPublicPageDetail = req.method === 'GET' && parts[1] === 'pages' && parts.length === 3
  const isPublicGet =
    req.method === 'GET' &&
    (url.pathname === '/deco/home' || url.pathname === '/deco/published' || isPublicPageDetail)
  const claims = isPublicGet ? null : requireAuth(req)
  const tenant = resolveTenant(req)
  if (claims) assertTenantAccess(claims, tenant)
  const tenantPages = tenant.pages
  const tenantTemplates = tenant.templates

  if (parts[1] === 'audit' && parts.length === 2 && req.method === 'GET') {
    return ok(res, { records: tenant.audit || [] })
  }

  if (parts[1] === 'approvals') {
    if (parts.length === 2 && req.method === 'GET') {
      return ok(res, { approvals: (tenant.approvals || []).map(approvalSummary) })
    }

    if (parts.length === 4 && req.method === 'POST' && ['approve', 'reject'].includes(parts[3])) {
      if (claims.role !== 'admin') throw new HttpError('只有管理员可以审批发布申请', 403)
      const approval = (tenant.approvals || []).find((item) => item.id === parts[2])
      if (!approval) throw new HttpError('发布申请不存在或已被清理', 404)
      if (approval.status !== 'pending') throw new HttpError('该发布申请已处理', 409)

      if (parts[3] === 'approve') {
        const page = findPage(tenant, approval.pageId)
        const snapshot = clone(approval.page)
        recordVersion(page)
        page.draft = clone(snapshot)
        page.draftUpdatedAt = now()
        page.published = snapshot
        page.publishedAt = now()
        page.title = snapshot.title || approval.pageTitle || page.title
        approval.status = 'approved'
        approval.reviewedBy = claims.sub
        approval.reviewedAt = now()
        approval.reason = ''
        recordAudit(tenant, claims, 'approval-approve', {
          pageId: page.id,
          pageTitle: page.title,
        })
        await saveState()
        return ok(res, {
          publishedAt: page.publishedAt,
          approval: approvalSummary(approval),
        })
      }

      const body = await readBody(req)
      approval.status = 'rejected'
      approval.reviewedBy = claims.sub
      approval.reviewedAt = now()
      approval.reason = String(body.reason || '').trim() || '审批未通过'
      recordAudit(tenant, claims, 'approval-reject', {
        pageId: approval.pageId,
        pageTitle: approval.pageTitle,
      })
      await saveState()
      return ok(res, { approval: approvalSummary(approval) })
    }

    throw new HttpError('方法不支持', 405)
  }

  if (parts[1] === 'assets') {
    if (parts.length === 2 && req.method === 'GET') {
      const sources = collectAssetSources(tenant)
      const assets = (tenant.assets || []).map((asset) => {
        const usedBy = assetUsage(asset, sources)
        return {
          id: asset.id,
          url: asset.url,
          name: asset.name,
          size: asset.size,
          createdAt: asset.createdAt,
          createdBy: asset.createdBy,
          usageCount: usedBy.length,
          usedBy,
        }
      })
      return ok(res, { assets, limit: MAX_ASSETS })
    }
    if (parts.length === 3 && req.method === 'DELETE') {
      const asset = (tenant.assets || []).find((item) => item.id === parts[2])
      if (!asset) throw new HttpError('素材不存在', 404)
      const usedBy = assetUsage(asset, collectAssetSources(tenant))
      if (usedBy.length) {
        throw new HttpError(
          `素材仍被 ${usedBy.length} 处页面、历史版本、模板或待审申请引用，请先移除引用`,
          409
        )
      }
      tenant.assets = tenant.assets.filter((item) => item.id !== asset.id)
      await saveState()
      if (asset.fileName) {
        try {
          await rm(path.join(UPLOAD_DIR, tenant.id, asset.fileName), { force: true })
        } catch (error) {
          console.warn('[api] 素材文件删除失败', error)
        }
      }
      return ok(res, { id: asset.id })
    }
    throw new HttpError('方法不支持', 405)
  }

  // /deco/published 只返回已发布页面，避免把草稿页标题暴露给 C 端
  if (parts[1] === 'published' && parts.length === 2 && req.method === 'GET') {
    return ok(res, {
      pages: tenantPages
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
      const home = tenantPages.find((item) => item.isHome)
      return ok(res, { page: home?.published || null, publishedAt: home?.publishedAt || '' })
    }
    throw new HttpError('方法不支持', 405)
  }

  // /deco/pages
  if (parts[1] === 'pages' && parts.length === 2) {
    if (req.method === 'GET') return ok(res, { pages: tenantPages.map(summary) })
    if (req.method === 'POST') {
      if (tenantPages.length >= MAX_PAGES)
        throw new HttpError(`最多只能创建 ${MAX_PAGES} 个装修页面`)
      const body = await readBody(req)
      const title = String(body.title || '').trim() || `新页面 ${tenantPages.length}`
      const record = createPage(title, { version: 1, title, components: [] })
      tenantPages.push(record)
      recordAudit(tenant, claims, 'page-create', { pageId: record.id, pageTitle: title })
      await saveState()
      return ok(res, summary(record))
    }
    throw new HttpError('方法不支持', 405)
  }

  if (parts[1] === 'templates') {
    if (parts.length === 2) {
      if (req.method === 'GET') {
        return ok(res, {
          templates: tenantTemplates.map((item) => ({
            id: item.id,
            name: item.name,
            createdAt: item.createdAt,
          })),
        })
      }
      if (req.method === 'POST') {
        if (tenantTemplates.length >= MAX_TEMPLATES) {
          throw new HttpError(`最多只能保存 ${MAX_TEMPLATES} 个模板`)
        }
        const body = await readBody(req)
        assertPage(body.page)
        const page = clone(body.page)
        const name = String(body.name || '').trim() || `${page.title || '未命名'}模板`
        const record = { id: id('tpl'), name, page, createdAt: now() }
        tenantTemplates.unshift(record)
        await saveState()
        return ok(res, { id: record.id, name: record.name, createdAt: record.createdAt })
      }
      throw new HttpError('方法不支持', 405)
    }

    if (parts.length === 3 && req.method === 'DELETE') {
      const index = tenantTemplates.findIndex((item) => item.id === parts[2])
      if (index < 0) throw new HttpError('模板不存在', 404)
      tenantTemplates.splice(index, 1)
      await saveState()
      return ok(res, true)
    }

    if (parts.length === 4 && parts[3] === 'use' && req.method === 'POST') {
      if (tenantPages.length >= MAX_PAGES)
        throw new HttpError(`最多只能创建 ${MAX_PAGES} 个装修页面`)
      const template = tenantTemplates.find((item) => item.id === parts[2])
      if (!template) throw new HttpError('模板不存在', 404)
      const body = await readBody(req)
      const page = clone(template.page)
      const title = String(body.title || '').trim() || template.name
      page.title = title
      const record = createPage(title, page)
      tenantPages.push(record)
      recordAudit(tenant, claims, 'template-use', { pageId: record.id, pageTitle: title })
      await saveState()
      return ok(res, summary(record))
    }
    throw new HttpError('接口不存在', 404)
  }

  if (parts[1] === 'pages' && parts.length >= 3) {
    const page = findPage(tenant, parts[2])

    if (parts.length === 3) {
      if (req.method === 'GET')
        return ok(res, { page: page.published, publishedAt: page.publishedAt })
      if (req.method === 'DELETE') {
        if (page.isHome) throw new HttpError('首页不允许删除')
        tenant.pages = tenant.pages.filter((item) => item.id !== page.id)
        tenant.approvals = (tenant.approvals || []).filter((item) => item.pageId !== page.id)
        recordAudit(tenant, claims, 'page-delete', {
          pageId: page.id,
          pageTitle: page.title || page.draft?.title || page.published?.title,
        })
        await saveState()
        return ok(res, true)
      }
      throw new HttpError('方法不支持', 405)
    }

    if (parts[3] === 'approval' && req.method === 'POST') {
      if ((tenant.approvals || []).some((item) => item.pageId === page.id && item.status === 'pending')) {
        throw new HttpError('该页面已有待审核的发布申请，请等待管理员处理', 409)
      }
      const body = await readBody(req)
      const submitted = body.page ?? page.draft
      assertPage(submitted)
      const snapshot = clone(submitted)
      const approval = {
        id: id('apv'),
        pageId: page.id,
        pageTitle: String(snapshot.title || page.title || ''),
        status: 'pending',
        submittedBy: claims.sub,
        submittedAt: now(),
        reviewedBy: '',
        reviewedAt: '',
        reason: '',
        page: snapshot,
      }
      tenant.approvals = [approval, ...(tenant.approvals || [])].slice(0, MAX_APPROVALS)
      recordAudit(tenant, claims, 'approval-submit', {
        pageId: page.id,
        pageTitle: approval.pageTitle,
      })
      await saveState()
      return ok(res, approvalSummary(approval))
    }

    if (parts[3] === 'copy' && req.method === 'POST') {
      if (tenantPages.length >= MAX_PAGES)
        throw new HttpError(`最多只能创建 ${MAX_PAGES} 个装修页面`)
      const base = page.draft || page.published
      if (!base) throw new HttpError('当前页面还没有内容可复制')
      const body = await readBody(req)
      const copied = clone(base)
      const title = String(body.title || '').trim() || `${copied.title || page.title} 副本`
      copied.title = title
      const record = createPage(title, copied)
      tenantPages.push(record)
      recordAudit(tenant, claims, 'page-copy', { pageId: record.id, pageTitle: title })
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
      if (claims.role !== 'admin') {
        throw new HttpError('只有管理员可以直接发布，请先提交发布审核', 403)
      }
      const body = await readBody(req)
      assertPage(body.page)
      recordVersion(page)
      page.draft = body.page
      page.draftUpdatedAt = now()
      page.published = body.page
      page.publishedAt = now()
      page.title = body.page.title || page.title
      closePendingApprovals(tenant, page.id, '管理员已直接发布，申请自动关闭')
      recordAudit(tenant, claims, 'publish', {
        pageId: page.id,
        pageTitle: page.published.title || page.title,
      })
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
        closePendingApprovals(tenant, page.id, '管理员已直接回滚发布，申请自动关闭')
        recordAudit(tenant, claims, 'rollback', {
          pageId: page.id,
          pageTitle: snapshot.title || page.title,
        })
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
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Deco-Tenant')
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
