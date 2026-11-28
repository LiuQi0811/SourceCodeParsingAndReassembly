// 应用列表领域：数据、筛选、分页、统计、文案全在这里，两端只负责渲染
import type { Unsubscribe } from './counter';

export type AppStatus = 'online' | 'offline' | 'building';
export type AppCategory = '电商' | '中台' | '工具' | '营销';
export const ALL = '全部' as const;
export type CategoryFilter = AppCategory | typeof ALL;
export type StatusFilter = AppStatus | typeof ALL;

export interface AppItem {
  id: string;
  name: string;
  owner: string;
  category: AppCategory;
  status: AppStatus;
  updatedAt: string;
}

export const APP_CATALOG: readonly AppItem[] = [
  { id: 'A-1001', name: '交易中台', owner: '张立', category: '中台', status: 'online', updatedAt: '2026-11-26' },
  { id: 'A-1002', name: '商品详情页', owner: '李雯', category: '电商', status: 'online', updatedAt: '2026-11-24' },
  { id: 'A-1003', name: '优惠券中心', owner: '王卓', category: '营销', status: 'building', updatedAt: '2026-11-27' },
  { id: 'A-1004', name: '订单履约台', owner: '赵敏', category: '电商', status: 'offline', updatedAt: '2026-11-12' },
  { id: 'A-1005', name: '权限管理控制台', owner: '陈屿', category: '中台', status: 'online', updatedAt: '2026-11-20' },
  { id: 'A-1006', name: '数据看板', owner: '孙可', category: '工具', status: 'online', updatedAt: '2026-11-25' },
  { id: 'A-1007', name: '活动落地页生成器', owner: '周然', category: '营销', status: 'building', updatedAt: '2026-11-28' },
  { id: 'A-1008', name: '接口调试工具', owner: '吴迪', category: '工具', status: 'offline', updatedAt: '2026-10-30' },
  { id: 'A-1009', name: '会员成长体系', owner: '郑岚', category: '营销', status: 'online', updatedAt: '2026-11-21' },
  { id: 'A-1010', name: '库存同步服务', owner: '冯真', category: '中台', status: 'offline', updatedAt: '2026-11-05' },
];

export const CATEGORY_OPTIONS: readonly CategoryFilter[] = [ALL, '电商', '中台', '工具', '营销'];
export const STATUS_OPTIONS: readonly StatusFilter[] = [ALL, 'online', 'offline', 'building'];

export interface AppFilter {
  keyword: string;
  category: CategoryFilter;
  status: StatusFilter;
}

export const DEFAULT_FILTER: AppFilter = {
  keyword: '',
  category: ALL,
  status: ALL,
};

export function statusLabel(status: AppStatus): string {
  const labels: Record<AppStatus, string> = {
    online: '已上线',
    offline: '已下线',
    building: '构建中',
  };
  return labels[status];
}

/** 供 TDesign Tag 的 theme 用：两端组件库接受同一组取值 */
export function statusTheme(status: AppStatus): 'success' | 'default' | 'warning' {
  const themes: Record<AppStatus, 'success' | 'default' | 'warning'> = {
    online: 'success',
    offline: 'default',
    building: 'warning',
  };
  return themes[status];
}

export function filterLabel(filter: StatusFilter): string {
  return filter === ALL ? '全部状态' : statusLabel(filter);
}

export function matchApp(item: AppItem, filter: AppFilter): boolean {
  const keyword = filter.keyword.trim().toLowerCase();
  const hitKeyword =
    keyword === '' ||
    item.name.toLowerCase().includes(keyword) ||
    item.id.toLowerCase().includes(keyword) ||
    item.owner.toLowerCase().includes(keyword);
  const hitCategory = filter.category === ALL || item.category === filter.category;
  const hitStatus = filter.status === ALL || item.status === filter.status;
  return hitKeyword && hitCategory && hitStatus;
}

export function filterApps(items: readonly AppItem[], filter: AppFilter): AppItem[] {
  return items.filter((item) => matchApp(item, filter));
}

export interface PageResult<T> {
  rows: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export function paginate<T>(items: readonly T[], page: number, pageSize: number): PageResult<T> {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  return {
    rows: items.slice(start, start + pageSize),
    page: safePage,
    pageSize,
    total,
    totalPages,
  };
}

export function summarizeApps(items: readonly AppItem[]): Record<AppStatus, number> {
  const summary: Record<AppStatus, number> = { online: 0, offline: 0, building: 0 };
  items.forEach((item) => {
    summary[item.status] += 1;
  });
  return summary;
}

export interface AppListSnapshot {
  filter: AppFilter;
  page: number;
  pageSize: number;
  result: PageResult<AppItem>;
  summary: Record<AppStatus, number>;
  totalItems: number;
}

export interface AppListStore {
  get: () => AppListSnapshot;
  subscribe: (listener: (snapshot: AppListSnapshot) => void) => Unsubscribe;
  setKeyword: (keyword: string) => void;
  setCategory: (category: CategoryFilter) => void;
  setStatus: (status: StatusFilter) => void;
  setPage: (page: number) => void;
  reset: () => void;
}

/**
 * 列表状态机：筛选条件、页码、派生结果都在这里算。
 * 两端只订阅快照，不重复实现筛选/分页/统计逻辑。
 */
export function createAppListStore(items: readonly AppItem[] = APP_CATALOG, pageSize = 4): AppListStore {
  let filter: AppFilter = { ...DEFAULT_FILTER };
  let page = 1;
  const listeners = new Set<(snapshot: AppListSnapshot) => void>();

  const build = (): AppListSnapshot => {
    const filtered = filterApps(items, filter);
    const result = paginate(filtered, page, pageSize);
    page = result.page;
    return {
      filter: { ...filter },
      page: result.page,
      pageSize,
      result,
      summary: summarizeApps(filtered),
      totalItems: items.length,
    };
  };

  let snapshot = build();
  const emit = () => {
    snapshot = build();
    listeners.forEach((listener) => listener(snapshot));
  };

  const resetPage = () => {
    page = 1;
  };

  return {
    get: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    setKeyword: (keyword) => {
      filter = { ...filter, keyword };
      resetPage();
      emit();
    },
    setCategory: (category) => {
      filter = { ...filter, category };
      resetPage();
      emit();
    },
    setStatus: (status) => {
      filter = { ...filter, status };
      resetPage();
      emit();
    },
    setPage: (next) => {
      page = next;
      emit();
    },
    reset: () => {
      filter = { ...DEFAULT_FILTER };
      resetPage();
      emit();
    },
  };
}
