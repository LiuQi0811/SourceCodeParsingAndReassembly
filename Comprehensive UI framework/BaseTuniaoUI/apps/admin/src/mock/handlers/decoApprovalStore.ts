import type { DecoPage } from '@btn/deco/schema'
import { storage } from '@/utils/storage'

const APPROVALS_KEY = 'deco_approvals'
const MAX_APPROVALS = 50

export type MockApprovalStatus = 'pending' | 'approved' | 'rejected'

export interface MockApprovalRecord {
  id: string
  pageId: string
  pageTitle: string
  status: MockApprovalStatus
  submittedBy: string
  submittedAt: string
  reviewedBy: string
  reviewedAt: string
  reason: string
  page: DecoPage
}

export interface MockApprovalSummary {
  id: string
  pageId: string
  pageTitle: string
  status: MockApprovalStatus
  submittedBy: string
  submittedAt: string
  reviewedBy: string
  reviewedAt: string
  reason: string
}

const now = (): string => new Date().toLocaleString()

const loadMap = (): Record<string, MockApprovalRecord[]> => {
  const cached = storage.get<Record<string, MockApprovalRecord[]>>(APPROVALS_KEY, {})
  if (!cached || typeof cached !== 'object' || Array.isArray(cached)) return {}
  return Object.fromEntries(
    Object.entries(cached).map(([tenant, value]) => [tenant, Array.isArray(value) ? value : []])
  )
}

const saveMap = (value: Record<string, MockApprovalRecord[]>): void =>
  storage.set(APPROVALS_KEY, value)

export const loadMockApprovals = (tenant: string): MockApprovalRecord[] => loadMap()[tenant] || []

export const saveMockApprovals = (tenant: string, list: MockApprovalRecord[]): void => {
  const map = loadMap()
  map[tenant] = list.slice(0, MAX_APPROVALS)
  saveMap(map)
}

export const createMockApproval = (
  tenant: string,
  input: { pageId: string; pageTitle: string; submittedBy: string; page: DecoPage }
): MockApprovalRecord => {
  const record: MockApprovalRecord = {
    id: `apv-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 4)}`,
    pageId: input.pageId,
    pageTitle: input.pageTitle,
    status: 'pending',
    submittedBy: input.submittedBy,
    submittedAt: now(),
    reviewedBy: '',
    reviewedAt: '',
    reason: '',
    page: JSON.parse(JSON.stringify(input.page)) as DecoPage,
  }
  saveMockApprovals(tenant, [record, ...loadMockApprovals(tenant)])
  return record
}

export const findMockApproval = (
  tenant: string,
  approvalId: string
): MockApprovalRecord | undefined =>
  loadMockApprovals(tenant).find((item) => item.id === approvalId)

export const updateMockApproval = (
  tenant: string,
  approvalId: string,
  patch: Partial<MockApprovalRecord>
): MockApprovalRecord | undefined => {
  let updated: MockApprovalRecord | undefined
  const list = loadMockApprovals(tenant).map((item) => {
    if (item.id !== approvalId) return item
    updated = { ...item, ...patch }
    return updated
  })
  saveMockApprovals(tenant, list)
  return updated
}

export const removeMockApprovalsForPage = (tenant: string, pageId: string): void => {
  saveMockApprovals(
    tenant,
    loadMockApprovals(tenant).filter((item) => item.pageId !== pageId)
  )
}

export const closeMockApprovalsForPage = (tenant: string, pageId: string, reason: string): void => {
  saveMockApprovals(
    tenant,
    loadMockApprovals(tenant).map((item) =>
      item.pageId === pageId && item.status === 'pending'
        ? {
            ...item,
            status: 'rejected',
            reviewedBy: 'system',
            reviewedAt: now(),
            reason,
          }
        : item
    )
  )
}

export const removeMockApprovals = (tenant: string): void => {
  const map = loadMap()
  if (!map[tenant]) return
  delete map[tenant]
  saveMap(map)
}

export const pendingApprovalSnapshots = (
  tenant: string
): Array<{ id: string; title: string; page: DecoPage }> =>
  loadMockApprovals(tenant)
    .filter((item) => item.status === 'pending')
    .map((item) => ({ id: item.id, title: item.pageTitle, page: item.page }))

export const approvalSummary = (item: MockApprovalRecord): MockApprovalSummary => ({
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
