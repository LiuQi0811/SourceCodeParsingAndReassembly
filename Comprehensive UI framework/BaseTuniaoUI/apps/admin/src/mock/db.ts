import { storage } from '@/utils/storage'
import { deptSeed, dictDataSeed, dictTypeSeed, logSeed, menuSeed, roleSeed, userSeed } from './data'

/**
 * Mock 数据表
 * 首次访问写入种子数据，之后所有读写都落到本地存储，
 * 因此刷新页面后新增/修改/删除的结果依然保留。
 * 想恢复初始数据：清空浏览器存储，或在控制台执行 localStorage.clear()
 */
class MockTable<T extends { id: number }> {
  private readonly key: string
  private readonly seed: T[]

  constructor(key: string, seed: T[]) {
    this.key = `mock_${key}`
    this.seed = seed
  }

  all(): T[] {
    const cached = storage.get<T[]>(this.key)
    if (Array.isArray(cached) && cached.length > 0) return cached
    this.save(this.seed)
    return JSON.parse(JSON.stringify(this.seed)) as T[]
  }

  save(list: T[]): void {
    storage.set(this.key, list)
  }

  reset(): void {
    this.save(this.seed)
  }

  /** 把种子里新增、但缓存里还没有的记录补进去（按 id 判定），已有记录不动 */
  mergeSeed(): void {
    const cached = storage.get<T[]>(this.key)
    if (!Array.isArray(cached) || cached.length === 0) {
      this.reset()
      return
    }
    const existingIds = new Set(cached.map((item) => item.id))
    const missing = this.seed.filter((item) => !existingIds.has(item.id))
    if (missing.length === 0) return
    this.save([...cached, ...missing])
  }

  nextId(list?: T[]): number {
    const data = list || this.all()
    return data.reduce((max, item) => Math.max(max, item.id), 0) + 1
  }
}

export const db = {
  users: new MockTable('users', userSeed),
  roles: new MockTable('roles', roleSeed),
  menus: new MockTable('menus', menuSeed),
  depts: new MockTable('depts', deptSeed),
  dictTypes: new MockTable('dict_types', dictTypeSeed),
  dictData: new MockTable('dict_data', dictDataSeed),
  logs: new MockTable('logs', logSeed),
}

/** 恢复全部演示数据到初始状态 */
export const resetMockData = (): void => {
  Object.values(db).forEach((table) => table.reset())
}

/**
 * 种子版本号：种子数据有结构性新增（新菜单、新角色等）时加一，
 * 老浏览器缓存会按 id 补进新增记录，不用清 localStorage。
 */
const SEED_VERSION = 2
const SEED_VERSION_KEY = 'mock_seed_version'

export const syncMockData = (): void => {
  const version = storage.get<number>(SEED_VERSION_KEY, 0)
  if (version === SEED_VERSION) return
  Object.values(db).forEach((table) => table.mergeSeed())
  storage.set(SEED_VERSION_KEY, SEED_VERSION)
}
