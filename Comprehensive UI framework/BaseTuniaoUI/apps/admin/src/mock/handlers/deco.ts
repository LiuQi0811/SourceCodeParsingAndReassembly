import { DECO_VERSION, validateDecoPage, type DecoPage } from '@btn/deco/schema'
import { createDemoPage } from '@btn/deco/demo'
import { defineMock, MockError } from '../adapter'
import { storage } from '@/utils/storage'
import { deleteMockAsset, listMockAssets, removeMockAssets } from './decoAssets'
import {
  approvalSummary,
  closeMockApprovalsForPage,
  createMockApproval,
  findMockApproval,
  loadMockApprovals,
  removeMockApprovals,
  removeMockApprovalsForPage,
  updateMockApproval,
} from './decoApprovalStore'

const PAGES_KEY = 'deco_pages'
const PAGES_VERSION_KEY = 'deco_pages_version'
const PAGES_VERSION = 2
const TEMPLATES_KEY = 'deco_templates'
const TENANTS_KEY = 'deco_tenants'
const DEFAULT_TENANT = 'btn-mall'
const TENANT_ID_PATTERN = /^[a-z0-9][a-z0-9-]{1,31}$/
const APP_ID_PATTERN = /^wx[a-z0-9]{16}$/
const LEGACY_DRAFT_KEY = 'deco_home_draft'
const LEGACY_HOME_KEY = 'deco_home_published'
const MAX_PAGES = 20
const MAX_TEMPLATES = 20
const MAX_VERSIONS = 10
const MAX_AUDIT = 100
const DECO_ACCOUNTS = [{ username: 'chenmo', role: 'editor' }]
const DECO_EDITOR_NAMES = DECO_ACCOUNTS.map((item) => item.username)

interface AuditRecord {
  id: string
  actor: string
  role: string
  action:
    | 'publish'
    | 'rollback'
    | 'page-create'
    | 'page-copy'
    | 'page-delete'
    | 'template-use'
    | 'approval-submit'
    | 'approval-approve'
    | 'approval-reject'
  pageId: string
  pageTitle: string
  at: string
}

interface TenantRecord {
  id: string
  name: string
  appId: string
  createdAt: string
  members: string[]
  audit: AuditRecord[]
}

interface DraftRecord {
  page: DecoPage | null
  updatedAt: string
}

interface HomeRecord {
  page: DecoPage | null
  publishedAt: string
}

interface PageVersion {
  id: string
  title: string
  publishedAt: string
  page: DecoPage
}

interface PageRecord {
  id: string
  /** C 端访问路径，仅作展示与约定，不参与渲染 */
  path: string
  /** 首页由首个页面固定担任，不允许删除 */
  isHome: boolean
  title: string
  draft: DecoPage | null
  draftUpdatedAt: string
  published: DecoPage | null
  publishedAt: string
  /** 发布历史，保留最近 10 版，用于回滚 */
  versions: PageVersion[]
}

interface TemplateRecord {
  id: string
  name: string
  page: DecoPage
  createdAt: string
}

const now = (): string => new Date().toLocaleString()
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T
const currentProfile = (): { username?: string; nickname?: string; roleIds?: number[] } =>
  storage.get<{ username?: string; nickname?: string; roleIds?: number[] }>('profile') || {}
const isMockAdmin = (): boolean => Boolean(currentProfile().roleIds?.includes(1))
const assertMockAdmin = (message: string): void => {
  if (!isMockAdmin()) throw new MockError(message, 403)
}
const versionId = (): string =>
  `ver-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 4)}`
const auditId = (): string =>
  `log-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 4)}`

const blankPage = (title: string): DecoPage => ({
  version: DECO_VERSION,
  title,
  components: [],
})

/** 兼容老的单页存储：只有一份草稿 / 一份已发布 */
const migrateLegacy = (): PageRecord[] => {
  const draft = storage.get<DraftRecord>(LEGACY_DRAFT_KEY, { page: null, updatedAt: '' })
  const home = storage.get<HomeRecord>(LEGACY_HOME_KEY, { page: null, publishedAt: '' })
  const title = draft?.page?.title || home?.page?.title || '首页'
  // 从来没装修过时给一份示例草稿，编辑器打开就有内容可改
  const draftPage =
    draft?.page && validateDecoPage(draft.page).valid ? draft.page : createDemoPage()
  return [
    {
      id: 'home',
      path: 'pages/home/index',
      isHome: true,
      title,
      draft: draftPage,
      draftUpdatedAt: draft?.updatedAt || now(),
      published: home?.page ?? null,
      publishedAt: home?.publishedAt ?? '',
      versions: [],
    },
  ]
}

const tenantOf = (ctx: { headers?: Record<string, string> }): string => {
  const headers = ctx.headers || {}
  const key = Object.keys(headers).find((item) => item.toLowerCase() === 'x-deco-tenant')
  return String((key ? headers[key] : '') || '').trim() || DEFAULT_TENANT
}

const normalizeMembers = (value: unknown): string[] =>
  Array.from(
    new Set(
      (Array.isArray(value) ? value : [])
        .map((item) => String(item || '').trim())
        .filter((item) => DECO_EDITOR_NAMES.includes(item))
    )
  )

const loadTenants = (): TenantRecord[] => {
  const cached = storage.get<TenantRecord[]>(TENANTS_KEY)
  if (Array.isArray(cached) && cached.length > 0) {
    return cached.map((item) => ({
      ...item,
      members:
        item.members === undefined
          ? item.id === DEFAULT_TENANT
            ? ['chenmo']
            : []
          : normalizeMembers(item.members),
      audit: Array.isArray(item.audit) ? item.audit : [],
    }))
  }
  const seeded: TenantRecord[] = [
    {
      id: DEFAULT_TENANT,
      name: '图鸟商城',
      appId: 'wx4cd3b6ba323e40ea',
      createdAt: now(),
      members: ['chenmo'],
      audit: [],
    },
  ]
  storage.set(TENANTS_KEY, seeded)
  return seeded
}

const saveTenants = (list: TenantRecord[]): void => storage.set(TENANTS_KEY, list)

const recordAudit = (
  tenant: string,
  action: AuditRecord['action'],
  target: { pageId?: string; pageTitle?: string } = {}
): void => {
  const list = loadTenants()
  const owner = list.find((item) => item.id === tenant)
  if (!owner) return
  const profile = currentProfile()
  owner.audit = [
    {
      id: auditId(),
      actor: profile?.nickname || 'admin',
      role: '',
      action,
      pageId: String(target.pageId || ''),
      pageTitle: String(target.pageTitle || ''),
      at: now(),
    },
    ...(owner.audit || []),
  ].slice(0, MAX_AUDIT)
  saveTenants(list)
}

const tenantName = (tenant: string): string =>
  loadTenants().find((item) => item.id === tenant)?.name || `小程序 ${tenant}`

const pagesKey = (tenant: string): string =>
  tenant === DEFAULT_TENANT ? PAGES_KEY : `${PAGES_KEY}:${tenant}`
const pagesVersionKey = (tenant: string): string =>
  tenant === DEFAULT_TENANT ? PAGES_VERSION_KEY : `${PAGES_VERSION_KEY}:${tenant}`
const templatesKey = (tenant: string): string =>
  tenant === DEFAULT_TENANT ? TEMPLATES_KEY : `${TEMPLATES_KEY}:${tenant}`

const createSeedPages = (name: string): PageRecord[] => {
  const demo = createDemoPage()
  demo.title = name
  return [
    {
      id: 'home',
      path: 'pages/home/index',
      isHome: true,
      title: name,
      draft: demo,
      draftUpdatedAt: now(),
      published: clone(demo),
      publishedAt: now(),
      versions: [],
    },
  ]
}

const load = (tenant: string = DEFAULT_TENANT): PageRecord[] => {
  const key = pagesKey(tenant)
  const versionKey = pagesVersionKey(tenant)
  const cached = storage.get<PageRecord[]>(key)
  if (Array.isArray(cached) && cached.length > 0) {
    const pages = cached.map((item) => ({
      ...item,
      versions: Array.isArray(item.versions) ? item.versions : [],
    }))
    if (tenant !== DEFAULT_TENANT) return pages
    return normalize(pages, key, versionKey)
  }

  const seeded = tenant === DEFAULT_TENANT ? migrateLegacy() : createSeedPages(tenantName(tenant))
  storage.set(key, seeded)
  storage.set(versionKey, PAGES_VERSION)
  return seeded
}

/**
 * 老数据修复（只跑一次）：
 * 1. 早期迁移可能给首页留下「没草稿也没发布」的空记录，补一份示例草稿；
 * 2. 老记录没有 versions 字段，补成空数组。
 */
const normalize = (pages: PageRecord[], key: string, versionKey: string): PageRecord[] => {
  if ((storage.get<number>(versionKey, 0) ?? 0) >= PAGES_VERSION) return pages
  const home = pages.find((item) => item.isHome)
  if (home && !home.draft && !home.published) {
    const demo = createDemoPage()
    home.draft = demo
    home.draftUpdatedAt = now()
    home.title = demo.title || home.title
  }
  pages.forEach((item) => {
    if (!Array.isArray(item.versions)) item.versions = []
  })
  storage.set(key, pages)
  storage.set(versionKey, PAGES_VERSION)
  return pages
}

const save = (tenant: string, pages: PageRecord[]): void => storage.set(pagesKey(tenant), pages)

const loadTemplates = (tenant: string = DEFAULT_TENANT): TemplateRecord[] => {
  const key = templatesKey(tenant)
  const cached = storage.get<TemplateRecord[]>(key)
  if (Array.isArray(cached)) return cached
  const demo = createDemoPage()
  demo.title = tenantName(tenant)
  const seeded: TemplateRecord[] = [
    {
      id: 'tpl-demo',
      name: '电商首页模板',
      page: demo,
      createdAt: now(),
    },
  ]
  storage.set(key, seeded)
  return seeded
}

const saveTemplates = (tenant: string, list: TemplateRecord[]): void =>
  storage.set(templatesKey(tenant), list)

/** 发布前把上一版压进历史，最多留 10 版 */
const recordVersion = (target: PageRecord): void => {
  if (!target.published) return
  const snapshot: PageVersion = {
    id: versionId(),
    title: target.published.title || target.title,
    publishedAt: target.publishedAt,
    page: clone(target.published),
  }
  target.versions = [snapshot, ...(target.versions || [])].slice(0, MAX_VERSIONS)
}

const createPageRecord = (title: string, page: DecoPage): PageRecord => {
  const id = `page-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 4)}`
  return {
    id,
    path: `pages/home/index?pageId=${id}`,
    isHome: false,
    title,
    draft: page,
    draftUpdatedAt: now(),
    published: null,
    publishedAt: '',
    versions: [],
  }
}

const findPage = (tenant: string, id: string): PageRecord => {
  const target = load(tenant).find((item) => item.id === id)
  if (!target) throw new MockError(`装修页面不存在：${id}`, 404)
  return target
}

const tenantSummary = (tenant: TenantRecord) => ({
  id: tenant.id,
  name: tenant.name,
  appId: tenant.appId,
  createdAt: tenant.createdAt,
  members: normalizeMembers(tenant.members),
  pageCount: load(tenant.id).length,
})

const assertAppId = (appId: string): string => {
  if (!APP_ID_PATTERN.test(appId))
    throw new MockError('AppID 格式不正确，应以 wx 开头且共 18 位', 400)
  return appId
}

const assertAppIdAvailable = (appId: string, exceptTenantId = ''): string => {
  assertAppId(appId)
  if (loadTenants().some((item) => item.appId === appId && item.id !== exceptTenantId)) {
    throw new MockError(`AppID 已被其他小程序应用使用：${appId}`, 409)
  }
  return appId
}

defineMock('GET', '/deco/tenants', () => {
  const all = loadTenants()
  const admin = isMockAdmin()
  const username = String(currentProfile().username || '')
  const visible = admin ? all : all.filter((item) => item.members.includes(username))
  const defaultTenantId = visible.some((item) => item.id === DEFAULT_TENANT)
    ? DEFAULT_TENANT
    : visible[0]?.id || ''
  return {
    defaultTenantId,
    canManage: admin,
    tenants: visible.map(tenantSummary),
  }
})

defineMock('GET', '/deco/accounts', () => {
  assertMockAdmin('只有管理员可以查看装修账号')
  return { accounts: DECO_ACCOUNTS }
})

defineMock('GET', '/deco/audit', (ctx) => ({
  records: loadTenants().find((item) => item.id === tenantOf(ctx))?.audit || [],
}))

defineMock('GET', '/deco/approvals', (ctx) => ({
  approvals: loadMockApprovals(tenantOf(ctx)).map(approvalSummary),
}))

defineMock('GET', '/deco/assets', (ctx) => ({
  assets: listMockAssets(ctx),
  limit: 50,
}))

defineMock('DELETE', '/deco/assets/:id', (ctx) => deleteMockAsset(ctx, String(ctx.pathParams.id)))

defineMock('POST', '/deco/tenants', ({ body }) => {
  assertMockAdmin('只有管理员可以新增小程序应用')
  const tenants = loadTenants()
  const name = String(body.name || '').trim()
  if (!name) throw new MockError('请填写小程序名称', 400)
  const appId = assertAppIdAvailable(String(body.appId || '').trim())
  const tenantId =
    String(body.id || '').trim() ||
    `app-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 4)}`
  if (!TENANT_ID_PATTERN.test(tenantId)) {
    throw new MockError('应用标识只能是 2-32 位小写字母、数字或中划线', 400)
  }
  if (tenants.some((item) => item.id === tenantId)) {
    throw new MockError(`应用标识已存在：${tenantId}`, 409)
  }
  const tenant: TenantRecord = {
    id: tenantId,
    name,
    appId,
    createdAt: now(),
    members: normalizeMembers(body.members),
    audit: [],
  }
  saveTenants([...tenants, tenant])
  // 首次读取页面时再种入示例首页，避免创建应用时写太多存储
  storage.remove(pagesKey(tenantId))
  storage.remove(`${PAGES_VERSION_KEY}:${tenantId}`)
  storage.remove(templatesKey(tenantId))
  return tenantSummary(tenant)
})

defineMock('PUT', '/deco/tenants/:id', ({ pathParams, body }) => {
  assertMockAdmin('只有管理员可以修改小程序应用')
  const tenants = loadTenants()
  const target = tenants.find((item) => item.id === pathParams.id)
  if (!target) throw new MockError(`装修应用不存在：${pathParams.id}`, 404)
  const name = String(body.name ?? target.name).trim()
  if (!name) throw new MockError('请填写小程序名称', 400)
  const appId = assertAppIdAvailable(String(body.appId ?? target.appId).trim(), target.id)
  target.name = name
  target.appId = appId
  if (body.members !== undefined) target.members = normalizeMembers(body.members)
  saveTenants(tenants)
  return tenantSummary(target)
})

defineMock('DELETE', '/deco/tenants/:id', ({ pathParams }) => {
  assertMockAdmin('只有管理员可以删除小程序应用')
  const tenants = loadTenants()
  const target = tenants.find((item) => item.id === pathParams.id)
  if (!target) throw new MockError(`装修应用不存在：${pathParams.id}`, 404)
  if (target.id === DEFAULT_TENANT) throw new MockError('默认小程序应用不能删除', 400)
  saveTenants(tenants.filter((item) => item.id !== target.id))
  storage.remove(pagesKey(target.id))
  storage.remove(pagesVersionKey(target.id))
  storage.remove(templatesKey(target.id))
  removeMockAssets(target.id)
  removeMockApprovals(target.id)
  return { id: target.id }
})

const summary = (item: PageRecord) => ({
  id: item.id,
  title: item.draft?.title || item.published?.title || item.title,
  path: item.path,
  isHome: item.isHome,
  publishedAt: item.publishedAt,
  updatedAt: item.draftUpdatedAt,
})

const assertValid = (page: DecoPage, prefix: string): void => {
  const result = validateDecoPage(page)
  if (!result.valid) throw new MockError(`${prefix}：${result.message}`, 400)
}

/** 页面列表：第一条固定是首页 */
defineMock('GET', '/deco/pages', (ctx) => {
  const tenant = tenantOf(ctx)
  return { pages: load(tenant).map(summary) }
})

defineMock('POST', '/deco/pages', ({ body, ...ctx }) => {
  const tenant = tenantOf(ctx)
  const pages = load(tenant)
  if (pages.length >= MAX_PAGES) throw new MockError(`最多只能创建 ${MAX_PAGES} 个装修页面`, 400)

  const title = String(body.title || '').trim() || `新页面 ${pages.length}`
  const record = createPageRecord(title, blankPage(title))
  save(tenant, [...pages, record])
  recordAudit(tenant, 'page-create', { pageId: record.id, pageTitle: title })
  return summary(record)
})

/** 复制当前页：草稿深拷贝一份，独立成新页面（未发布、无历史版本） */
defineMock('POST', '/deco/pages/:id/copy', ({ pathParams, body, ...ctx }) => {
  const tenant = tenantOf(ctx)
  const pages = load(tenant)
  if (pages.length >= MAX_PAGES) throw new MockError(`最多只能创建 ${MAX_PAGES} 个装修页面`, 400)

  const target = pages.find((item) => item.id === pathParams.id)
  if (!target) throw new MockError('装修页面不存在', 404)
  const base = target.draft || target.published
  if (!base) throw new MockError('当前页面还没有内容可复制', 400)

  const page = clone(base)
  const title = String(body.title || '').trim() || `${page.title || target.title} 副本`
  page.title = title
  const record = createPageRecord(title, page)
  save(tenant, [...pages, record])
  recordAudit(tenant, 'page-copy', { pageId: record.id, pageTitle: title })
  return summary(record)
})

defineMock('GET', '/deco/pages/:id/versions', ({ pathParams, ...ctx }) => {
  const target = findPage(tenantOf(ctx), pathParams.id)
  return {
    versions: (target.versions || []).map((item) => ({
      id: item.id,
      title: item.title,
      publishedAt: item.publishedAt,
    })),
  }
})

/** 回滚到某个历史版本：把它当作一次新发布，当前版本继续留档 */
defineMock('POST', '/deco/pages/:id/versions/:versionId/rollback', ({ pathParams, ...ctx }) => {
  const tenant = tenantOf(ctx)
  const pages = load(tenant)
  const target = pages.find((item) => item.id === pathParams.id)
  if (!target) throw new MockError('装修页面不存在', 404)

  const version = (target.versions || []).find((item) => item.id === pathParams.versionId)
  if (!version) throw new MockError('历史版本不存在或已被清理', 404)

  const snapshot = clone(version.page)
  assertValid(snapshot, '历史版本数据不合法')

  target.versions = (target.versions || []).filter((item) => item.id !== version.id)
  recordVersion(target)

  const publishedAt = now()
  target.draft = snapshot
  target.draftUpdatedAt = publishedAt
  target.published = clone(snapshot)
  target.publishedAt = publishedAt
  target.title = snapshot.title || target.title
  save(tenant, pages)
  closeMockApprovalsForPage(tenant, target.id, '管理员已直接回滚发布，申请自动关闭')
  recordAudit(tenant, 'rollback', {
    pageId: target.id,
    pageTitle: target.published?.title || target.title,
  })
  return { publishedAt }
})

defineMock('POST', '/deco/approvals/:id/approve', ({ pathParams, ...ctx }) => {
  assertMockAdmin('只有管理员可以审批发布申请')
  const tenant = tenantOf(ctx)
  const approval = findMockApproval(tenant, pathParams.id)
  if (!approval) throw new MockError('发布申请不存在或已被清理', 404)
  if (approval.status !== 'pending') throw new MockError('该发布申请已处理', 409)

  const pages = load(tenant)
  const target = pages.find((item) => item.id === approval.pageId)
  if (!target) throw new MockError('对应装修页面已被删除', 404)

  const snapshot = clone(approval.page)
  assertValid(snapshot, '待审页面数据不合法')
  recordVersion(target)

  const publishedAt = now()
  target.draft = clone(snapshot)
  target.draftUpdatedAt = publishedAt
  target.published = snapshot
  target.publishedAt = publishedAt
  target.title = snapshot.title || approval.pageTitle || target.title
  save(tenant, pages)

  const reviewed = updateMockApproval(tenant, approval.id, {
    status: 'approved',
    reviewedBy: currentProfile().nickname || 'admin',
    reviewedAt: publishedAt,
    reason: '',
  })
  recordAudit(tenant, 'approval-approve', {
    pageId: target.id,
    pageTitle: target.title,
  })
  return {
    publishedAt,
    approval: reviewed ? approvalSummary(reviewed) : approvalSummary(approval),
  }
})

defineMock('POST', '/deco/approvals/:id/reject', ({ pathParams, body, ...ctx }) => {
  assertMockAdmin('只有管理员可以审批发布申请')
  const tenant = tenantOf(ctx)
  const approval = findMockApproval(tenant, pathParams.id)
  if (!approval) throw new MockError('发布申请不存在或已被清理', 404)
  if (approval.status !== 'pending') throw new MockError('该发布申请已处理', 409)

  const reviewed = updateMockApproval(tenant, approval.id, {
    status: 'rejected',
    reviewedBy: currentProfile().nickname || 'admin',
    reviewedAt: now(),
    reason: String(body.reason || '').trim() || '审批未通过',
  })
  recordAudit(tenant, 'approval-reject', {
    pageId: approval.pageId,
    pageTitle: approval.pageTitle,
  })
  return { approval: reviewed ? approvalSummary(reviewed) : approvalSummary(approval) }
})

defineMock('GET', '/deco/templates', (ctx) => {
  const tenant = tenantOf(ctx)
  return {
    templates: loadTemplates(tenant).map((item) => ({
      id: item.id,
      name: item.name,
      createdAt: item.createdAt,
    })),
  }
})

/** 把当前页存成模板 */
defineMock('POST', '/deco/templates', ({ body, ...ctx }) => {
  const tenant = tenantOf(ctx)
  const list = loadTemplates(tenant)
  if (list.length >= MAX_TEMPLATES) throw new MockError(`最多只能保存 ${MAX_TEMPLATES} 个模板`, 400)

  const page = body.page as DecoPage
  assertValid(page, '模板数据不合法')

  const name = String(body.name || '').trim() || `${page.title || '未命名'}模板`
  const record: TemplateRecord = {
    id: `tpl-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 4)}`,
    name,
    page: clone(page),
    createdAt: now(),
  }
  saveTemplates(tenant, [record, ...list])
  return { id: record.id, name: record.name, createdAt: record.createdAt }
})

defineMock('DELETE', '/deco/templates/:id', ({ pathParams, ...ctx }) => {
  const tenant = tenantOf(ctx)
  const list = loadTemplates(tenant)
  if (!list.some((item) => item.id === pathParams.id)) throw new MockError('模板不存在', 404)
  saveTemplates(
    tenant,
    list.filter((item) => item.id !== pathParams.id)
  )
  return true
})

/** 用模板新建页面：模板内容深拷贝成新页面的草稿 */
defineMock('POST', '/deco/templates/:id/use', ({ pathParams, body, ...ctx }) => {
  const tenant = tenantOf(ctx)
  const pages = load(tenant)
  if (pages.length >= MAX_PAGES) throw new MockError(`最多只能创建 ${MAX_PAGES} 个装修页面`, 400)

  const template = loadTemplates(tenant).find((item) => item.id === pathParams.id)
  if (!template) throw new MockError('模板不存在', 404)

  const page = clone(template.page)
  const title = String(body.title || '').trim() || `${template.name}`
  page.title = title
  const record = createPageRecord(title, page)
  save(tenant, [...pages, record])
  recordAudit(tenant, 'template-use', { pageId: record.id, pageTitle: title })
  return summary(record)
})

defineMock('DELETE', '/deco/pages/:id', ({ pathParams, ...ctx }) => {
  const tenant = tenantOf(ctx)
  const pages = load(tenant)
  const target = pages.find((item) => item.id === pathParams.id)
  if (!target) throw new MockError('装修页面不存在', 404)
  if (target.isHome) throw new MockError('首页不允许删除', 400)
  save(
    tenant,
    pages.filter((item) => item.id !== target.id)
  )
  removeMockApprovalsForPage(tenant, target.id)
  recordAudit(tenant, 'page-delete', {
    pageId: target.id,
    pageTitle: target.title || target.draft?.title || target.published?.title,
  })
  return true
})

defineMock('GET', '/deco/pages/:id/draft', ({ pathParams, ...ctx }) => {
  const target = findPage(tenantOf(ctx), pathParams.id)
  return { page: target.draft, updatedAt: target.draftUpdatedAt }
})

defineMock('PUT', '/deco/pages/:id/draft', ({ pathParams, body, ...ctx }) => {
  const tenant = tenantOf(ctx)
  const pages = load(tenant)
  const target = pages.find((item) => item.id === pathParams.id)
  if (!target) throw new MockError('装修页面不存在', 404)

  const page = body.page as DecoPage
  assertValid(page, '草稿不合法')

  const updatedAt = now()
  target.draft = page
  target.draftUpdatedAt = updatedAt
  target.title = page.title || target.title
  save(tenant, pages)
  return { updatedAt }
})

defineMock('POST', '/deco/pages/:id/approval', ({ pathParams, body, ...ctx }) => {
  const tenant = tenantOf(ctx)
  const target = findPage(tenant, pathParams.id)
  if (
    loadMockApprovals(tenant).some((item) => item.pageId === target.id && item.status === 'pending')
  ) {
    throw new MockError('该页面已有待审核的发布申请，请等待管理员处理', 409)
  }

  const page = (body.page || target.draft) as DecoPage
  assertValid(page, '提交审核数据不合法')
  const snapshot = clone(page)
  const approval = createMockApproval(tenant, {
    pageId: target.id,
    pageTitle: snapshot.title || target.title,
    submittedBy: currentProfile().nickname || 'admin',
    page: snapshot,
  })
  recordAudit(tenant, 'approval-submit', {
    pageId: target.id,
    pageTitle: approval.pageTitle,
  })
  return approvalSummary(approval)
})

defineMock('PUT', '/deco/pages/:id/publish', ({ pathParams, body, ...ctx }) => {
  assertMockAdmin('只有管理员可以直接发布，请先提交发布审核')
  const tenant = tenantOf(ctx)
  const pages = load(tenant)
  const target = pages.find((item) => item.id === pathParams.id)
  if (!target) throw new MockError('装修页面不存在', 404)

  const page = body.page as DecoPage
  assertValid(page, '发布数据不合法')

  recordVersion(target)

  const publishedAt = now()
  target.draft = page
  target.draftUpdatedAt = publishedAt
  target.published = page
  target.publishedAt = publishedAt
  target.title = page.title || target.title
  save(tenant, pages)
  closeMockApprovalsForPage(tenant, target.id, '管理员已直接发布，申请自动关闭')
  recordAudit(tenant, 'publish', {
    pageId: target.id,
    pageTitle: target.published?.title || target.title,
  })
  return { publishedAt }
})

/** C 端按页面 id 读取已发布数据 */
defineMock('GET', '/deco/pages/:id', ({ pathParams, ...ctx }) => {
  const target = findPage(tenantOf(ctx), pathParams.id)
  return { page: target.published, publishedAt: target.publishedAt }
})

/** 首页快捷接口：小程序默认读它，避免 C 端自己找 isHome */
defineMock('GET', '/deco/home', (ctx) => {
  const tenant = tenantOf(ctx)
  const pages = load(tenant)
  const home = pages.find((item) => item.isHome) ?? pages[0]
  return { page: home?.published ?? null, publishedAt: home?.publishedAt ?? '' }
})

/** 旧发布接口保留为「发布首页」别名 */
defineMock('PUT', '/deco/home', ({ body, ...ctx }) => {
  assertMockAdmin('只有管理员可以直接发布，请先提交发布审核')
  const tenant = tenantOf(ctx)
  const pages = load(tenant)
  const home = pages.find((item) => item.isHome) ?? pages[0]
  if (!home) throw new MockError('没有可发布的首页', 400)

  const page = body.page as DecoPage
  assertValid(page, '发布数据不合法')

  recordVersion(home)

  const publishedAt = now()
  home.draft = page
  home.draftUpdatedAt = publishedAt
  home.published = page
  home.publishedAt = publishedAt
  home.title = page.title || home.title
  save(tenant, pages)
  closeMockApprovalsForPage(tenant, home.id, '管理员已直接发布，申请自动关闭')
  recordAudit(tenant, 'publish', {
    pageId: home.id,
    pageTitle: home.published?.title || home.title,
  })
  return { publishedAt }
})
