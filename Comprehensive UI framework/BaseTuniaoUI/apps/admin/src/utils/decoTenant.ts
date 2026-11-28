import { storage } from '@/utils/storage'

/** 后台当前正在装修的小程序应用；请求层用它带 X-Deco-Tenant 头 */
const TENANT_KEY = 'DECO_TENANT'
export const DEFAULT_DECO_TENANT = 'btn-mall'

export const getDecoTenantId = (): string =>
  storage.get<string>(TENANT_KEY, DEFAULT_DECO_TENANT) || DEFAULT_DECO_TENANT

export const setDecoTenantId = (tenantId: string): void => {
  if (!tenantId) return
  storage.set(TENANT_KEY, tenantId)
}
