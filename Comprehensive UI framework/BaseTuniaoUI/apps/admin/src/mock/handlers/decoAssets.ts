import { MockError } from '../adapter'
import { storage } from '@/utils/storage'

const ASSETS_KEY = 'deco_assets'
const PAGE_KEYS: Record<string, string> = {
  pages: 'deco_pages',
  templates: 'deco_templates',
}
const DEFAULT_TENANT = 'btn-mall'
const MAX_ASSETS = 50

export interface MockAssetRecord {
  id: string
  url: string
  name: string
  size: number
  createdAt: string
  createdBy: string
}

export interface MockAssetUsage {
  type: 'page' | 'template'
  id: string
  title: string
  state: 'draft' | 'published' | 'history' | 'template'
}

export interface MockAssetSummary extends MockAssetRecord {
  usageCount: number
  usedBy: MockAssetUsage[]
}

const now = (): string => new Date().toLocaleString()
const assetId = (): string =>
  `asset-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 4)}`

const tenantOf = (ctx: { headers?: Record<string, string> }): string => {
  const headers = ctx.headers || {}
  const key = Object.keys(headers).find((item) => item.toLowerCase() === 'x-deco-tenant')
  return String((key ? headers[key] : '') || '').trim() || DEFAULT_TENANT
}

const loadMap = (): Record<string, MockAssetRecord[]> => {
  const cached = storage.get<Record<string, MockAssetRecord[]>>(ASSETS_KEY, {})
  if (!cached || typeof cached !== 'object' || Array.isArray(cached)) return {}
  return Object.fromEntries(
    Object.entries(cached).map(([tenant, value]) => [tenant, Array.isArray(value) ? value : []])
  )
}

const saveMap = (value: Record<string, MockAssetRecord[]>): void => storage.set(ASSETS_KEY, value)

const loadAssets = (tenant: string): MockAssetRecord[] => loadMap()[tenant] || []

const tenantKey = (base: string, tenant: string): string =>
  tenant === DEFAULT_TENANT ? base : `${base}:${tenant}`

const collectSources = (tenant: string) => {
  const sources: Array<{
    type: 'page' | 'template'
    id: string
    title: string
    state: MockAssetUsage['state']
    content: string
  }> = []

  const push = (
    type: 'page' | 'template',
    id: string,
    title: string,
    state: MockAssetUsage['state'],
    page: unknown
  ): void => {
    if (!page || typeof page !== 'object') return
    sources.push({ type, id, title, state, content: JSON.stringify(page) })
  }

  const pages =
    storage.get<
      Array<{
        id: string
        title: string
        draft?: unknown
        published?: unknown
        versions?: Array<{ id: string; page?: unknown }>
      }>
    >(tenantKey(PAGE_KEYS.pages, tenant), []) || []
  pages.forEach((page) => {
    push('page', page.id, page.title, 'draft', page.draft)
    push('page', page.id, page.title, 'published', page.published)
    ;(page.versions || []).forEach((version) => {
      push('page', `${page.id}:${version.id}`, page.title, 'history', version.page)
    })
  })

  const templates =
    storage.get<Array<{ id: string; name: string; page?: unknown }>>(
      tenantKey(PAGE_KEYS.templates, tenant),
      []
    ) || []
  templates.forEach((template) => {
    push('template', template.id, template.name, 'template', template.page)
  })

  return sources
}

const usageOf = (asset: MockAssetRecord, sources: ReturnType<typeof collectSources>) =>
  sources
    .filter((source) => source.content.includes(asset.url))
    .map(({ type, id, title, state }) => ({ type, id, title, state }))

export const registerMockAsset = (
  ctx: { headers?: Record<string, string> },
  input: { url: string; name: string; size: number }
): MockAssetRecord => {
  const tenant = tenantOf(ctx)
  const map = loadMap()
  const list = map[tenant] || []
  if (list.length >= MAX_ASSETS) {
    throw new MockError(`素材数量已达上限（${MAX_ASSETS} 个），请先清理未引用素材`, 400)
  }
  const profile = storage.get<{ nickname?: string }>('profile')
  const asset: MockAssetRecord = {
    id: assetId(),
    url: input.url,
    name: input.name,
    size: input.size,
    createdAt: now(),
    createdBy: profile?.nickname || 'admin',
  }
  map[tenant] = [asset, ...list]
  saveMap(map)
  return asset
}

export const listMockAssets = (ctx: { headers?: Record<string, string> }): MockAssetSummary[] => {
  const tenant = tenantOf(ctx)
  const sources = collectSources(tenant)
  return loadAssets(tenant).map((asset) => {
    const usedBy = usageOf(asset, sources)
    return { ...asset, usageCount: usedBy.length, usedBy }
  })
}

export const deleteMockAsset = (
  ctx: { headers?: Record<string, string> },
  assetIdValue: string
): { id: string } => {
  const tenant = tenantOf(ctx)
  const map = loadMap()
  const list = map[tenant] || []
  const asset = list.find((item) => item.id === assetIdValue)
  if (!asset) throw new MockError('素材不存在', 404)
  const usedBy = usageOf(asset, collectSources(tenant))
  if (usedBy.length) {
    throw new MockError(`素材仍被 ${usedBy.length} 处页面、历史版本或模板引用，请先移除引用`, 409)
  }
  map[tenant] = list.filter((item) => item.id !== asset.id)
  saveMap(map)
  return { id: asset.id }
}

export const removeMockAssets = (tenant: string): void => {
  const map = loadMap()
  if (!map[tenant]) return
  delete map[tenant]
  saveMap(map)
}
