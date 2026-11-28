import { get } from '@/utils/request'
import type { DashboardSummary } from './types'

export const dashboardApi = {
  summary: () => get<DashboardSummary>('/dashboard/summary'),
}
