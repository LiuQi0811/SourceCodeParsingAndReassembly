import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, del, get, post, put } from '@/utils/request'
import { appConfig, STORAGE_PREFIX } from '@/config'
import { createDemoPage } from '@btn/deco/demo'

/** 用内存 Map 模拟 uni 的同步存储，让 Mock 层跑在无宿主环境里 */
const memory = new Map<string, string>()

const uniStub = {
  getStorageSync: (key: string) => memory.get(key) ?? '',
  setStorageSync: (key: string, value: string) => memory.set(key, value),
  removeStorageSync: (key: string) => memory.delete(key),
  clearStorageSync: () => memory.clear(),
  showLoading: vi.fn(),
  hideLoading: vi.fn(),
  showToast: vi.fn(),
  $emit: vi.fn(),
  $on: vi.fn(),
  $off: vi.fn(),
  reLaunch: vi.fn(),
}

vi.stubGlobal('uni', uniStub)

const toastCalls = () =>
  uniStub.showToast.mock.calls.map((call) => (call[0] as { title: string }).title)

/** 断言请求必然失败，并拿到 ApiError 便于后续比对 */
const failure = async (task: Promise<unknown>): Promise<ApiError> => {
  try {
    await task
  } catch (error) {
    return error as ApiError
  }
  throw new Error('期望请求失败，但请求成功了')
}

beforeEach(() => {
  memory.clear()
  uniStub.showLoading.mockClear()
  uniStub.hideLoading.mockClear()
  uniStub.showToast.mockClear()
  uniStub.$emit.mockClear()
})

describe('request + mock 契约', () => {
  it('默认走 Mock（VITE_USE_MOCK 未配置时兜底为 true）', () => {
    expect(appConfig.useMock).toBe(true)
  })

  it('登录成功返回 token 与 profile（页面/store 负责落盘）', async () => {
    const result = await post<{ token: string; profile: { perms: string[]; menus: unknown[] } }>(
      '/auth/login',
      { username: 'admin', password: '123456' }
    )
    expect(result.token).toMatch(/^mock-token\./)
    expect(result.profile.perms).toContain('*:*:*')
    expect(result.profile.menus.length).toBeGreaterThan(0)
    // 请求层不写登录态，token 落盘由 user store 负责
    expect(memory.has(STORAGE_PREFIX + appConfig.tokenKey)).toBe(false)
  })

  it('带上 token 后可拉取 profile', async () => {
    const login = await post<{ token: string }>('/auth/login', {
      username: 'chenmo',
      password: '123456',
    })
    memory.set(STORAGE_PREFIX + appConfig.tokenKey, login.token)
    const profile = await get<{ nickname: string; roleIds: number[] }>('/auth/profile')
    expect(profile.nickname).toBeTruthy()
    expect(Array.isArray(profile.roleIds)).toBe(true)
  })

  it('密码错误抛 ApiError(400)，并 toast 业务提示', async () => {
    const error = await failure(post('/auth/login', { username: 'admin', password: 'wrong' }))
    expect(error).toBeInstanceOf(ApiError)
    expect(error.code).toBe(400)
    expect(toastCalls()).toContain('账号或密码错误')
  })

  it('缺少账号密码时抛 ApiError(400)', async () => {
    const error = await failure(post('/auth/login', {}))
    expect(error.code).toBe(400)
    expect(error.message).toBe('请输入账号和密码')
  })

  it('未登录访问 profile 抛 401，清理凭证并广播 auth:expired', async () => {
    const error = await failure(get('/auth/profile'))
    expect(error.code).toBe(401)
    expect(uniStub.$emit).toHaveBeenCalledWith('auth:expired')
    expect(memory.size).toBe(0)
    expect(toastCalls()).toContain('登录状态已失效，请重新登录')
  })

  it('未定义的 Mock 接口返回 404 并提示路径', async () => {
    const error = await failure(get('/not/exist'))
    expect(error.code).toBe(404)
    expect(toastCalls().some((title) => title.includes('/not/exist'))).toBe(true)
  })

  it('showError=false 时不弹业务错误提示', async () => {
    const error = await failure(
      post('/auth/login', { username: 'admin', password: 'wrong' }, { showError: false })
    )
    expect(error.code).toBe(400)
    expect(uniStub.showToast).not.toHaveBeenCalled()
  })

  it('loading=true 时成对调用 showLoading / hideLoading', async () => {
    await post('/auth/login', { username: 'admin', password: '123456' }, { loading: true })
    expect(uniStub.showLoading).toHaveBeenCalledTimes(1)
    expect(uniStub.hideLoading).toHaveBeenCalledTimes(1)
  })

  it('上传图片接口回显 base64 地址与字节数', async () => {
    const dataUrl = `data:image/png;base64,${'A'.repeat(4000)}`
    const result = await post<{ url: string; size: number; inline: boolean }>('/upload', {
      name: 'cover.png',
      dataUrl,
    })
    expect(result.url).toBe(dataUrl)
    expect(result.inline).toBe(true)
    expect(result.size).toBe(3000)
  })

  it('非图片 dataUrl 被 Mock 拒绝(400)', async () => {
    const error = await failure(
      post('/upload', { dataUrl: 'data:text/plain;base64,QQ==' }, { showError: false })
    )
    expect(error.code).toBe(400)
    expect(error.message).toContain('仅支持')
  })

  it('装修多页面：新建、存草稿、发布、读取与删除', async () => {
    const before = await get<{ pages: { id: string; isHome: boolean }[] }>('/deco/pages')
    expect(before.pages).toHaveLength(1)
    expect(before.pages[0].isHome).toBe(true)

    const created = await post<{ id: string; isHome: boolean }>('/deco/pages', { title: '活动页' })
    expect(created.isHome).toBe(false)

    const draft = await get<{ page: { components: unknown[] } | null }>(
      `/deco/pages/${created.id}/draft`
    )
    expect(draft.page?.components).toHaveLength(0)

    const page = { ...createDemoPage(), title: '活动页' }
    await put(`/deco/pages/${created.id}/draft`, { page })
    const published = await put<{ publishedAt: string }>(`/deco/pages/${created.id}/publish`, {
      page,
    })
    expect(published.publishedAt).toBeTruthy()

    const readBack = await get<{ page: { title: string } | null }>(`/deco/pages/${created.id}`)
    expect(readBack.page?.title).toBe('活动页')

    // 首页快捷接口仍可用：发布首页后 C 端按 /deco/home 读到
    await put('/deco/home', { page: createDemoPage() })
    const home = await get<{ page: { title: string } | null }>('/deco/home')
    expect(home.page?.title).toBe('图鸟商城')

    await del(`/deco/pages/${created.id}`)
    const after = await get<{ pages: unknown[] }>('/deco/pages')
    expect(after.pages).toHaveLength(1)
  })

  it('首页不允许删除(400)', async () => {
    const error = await failure(del('/deco/pages/home', undefined, { showError: false }))
    expect(error.code).toBe(400)
    expect(error.message).toContain('首页不允许删除')
  })
})
