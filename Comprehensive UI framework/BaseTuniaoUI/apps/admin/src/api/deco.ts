import { del, get, post, put } from '@/utils/request'
import type { DecoPage } from '@btn/deco'

export interface DecoDraftPayload {
  page: DecoPage | null
  updatedAt: string
}

export interface DecoPublishPayload {
  page: DecoPage | null
  publishedAt: string
}

export interface DecoPageSummary {
  id: string
  title: string
  /** C 端访问路径，仅作展示 */
  path: string
  isHome: boolean
  publishedAt: string
  updatedAt: string
}

export interface DecoVersionSummary {
  id: string
  title: string
  publishedAt: string
}

export interface DecoTemplateSummary {
  id: string
  name: string
  createdAt: string
}

/**
 * 装修接口契约（Mock 与真实后端保持一致）
 * GET    /deco/pages                 页面列表（第一条是首页）
 * POST   /deco/pages                 新建页面 { title }
 * POST   /deco/pages/:id/copy        复制当前页
 * DELETE /deco/pages/:id             删除页面（首页不可删）
 * GET    /deco/pages/:id/draft       读某页草稿
 * PUT    /deco/pages/:id/draft       保存某页草稿 { page }
 * PUT    /deco/pages/:id/publish     发布某页 { page }
 * GET    /deco/pages/:id              C 端读取某页已发布数据
 * GET    /deco/pages/:id/versions     发布历史（最近 10 版）
 * POST   /deco/pages/:id/versions/:versionId/rollback  回滚到历史版本
 * GET    /deco/templates             模板列表
 * POST   /deco/templates             存为模板 { name, page }
 * DELETE /deco/templates/:id         删除模板
 * POST   /deco/templates/:id/use     用模板新建页面 { title }
 * GET    /deco/home                  C 端读取首页（最近发布）
 */
export const decoApi = {
  pages: () => get<{ pages: DecoPageSummary[] }>('/deco/pages'),
  createPage: (title: string) => post<DecoPageSummary>('/deco/pages', { title }),
  copyPage: (id: string, title: string) =>
    post<DecoPageSummary>(`/deco/pages/${id}/copy`, { title }),
  removePage: (id: string) => del<boolean>(`/deco/pages/${id}`),
  draft: (id: string) => get<DecoDraftPayload>(`/deco/pages/${id}/draft`),
  saveDraft: (id: string, page: DecoPage) =>
    put<{ updatedAt: string }>(`/deco/pages/${id}/draft`, { page }),
  publish: (id: string, page: DecoPage) =>
    put<{ publishedAt: string }>(`/deco/pages/${id}/publish`, { page }),
  page: (id: string) => get<DecoPublishPayload>(`/deco/pages/${id}`),
  home: () => get<DecoPublishPayload>('/deco/home'),
  versions: (id: string) => get<{ versions: DecoVersionSummary[] }>(`/deco/pages/${id}/versions`),
  rollback: (id: string, versionId: string) =>
    post<{ publishedAt: string }>(`/deco/pages/${id}/versions/${versionId}/rollback`),
  templates: () => get<{ templates: DecoTemplateSummary[] }>('/deco/templates'),
  saveTemplate: (name: string, page: DecoPage) =>
    post<DecoTemplateSummary>('/deco/templates', { name, page }),
  removeTemplate: (id: string) => del<boolean>(`/deco/templates/${id}`),
  useTemplate: (id: string, title: string) =>
    post<DecoPageSummary>(`/deco/templates/${id}/use`, { title }),
}
