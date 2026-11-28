import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

/** 内存 Map 扮演 uni 本地存储，保证 store 初值读取与写入可断言 */
const memory = new Map<string, string>()

vi.stubGlobal('uni', {
  getStorageSync: (key: string) => memory.get(key) ?? '',
  setStorageSync: (key: string, value: string) => void memory.set(key, value),
  removeStorageSync: (key: string) => void memory.delete(key),
  clearStorageSync: () => memory.clear(),
})

async function createAppStore() {
  vi.resetModules()
  const { useAppStore } = await import('./app')
  setActivePinia(createPinia())
  return useAppStore()
}

beforeEach(() => {
  memory.clear()
})

describe('app store 主题外观', () => {
  it('默认浅色 + 天青 + 标准密度 + 标准圆角', async () => {
    const app = await createAppStore()
    expect(app.theme).toBe('light')
    expect(app.accent).toBe('sky')
    expect(app.density).toBe('normal')
    expect(app.radius).toBe('default')
    expect(app.themeClass).toBe('theme-light accent-sky density-normal radius-default')
  })

  it('切换外观后写入本地存储（JSON 字符串）', async () => {
    const app = await createAppStore()
    app.setTheme('dark')
    app.setAccent('violet')

    expect(app.themeClass).toBe('theme-dark accent-violet density-normal radius-default')
    expect(memory.get('BTN_theme')).toBe(JSON.stringify('dark'))
    expect(memory.get('BTN_accent')).toBe(JSON.stringify('violet'))
  })

  it('启动时读取已保存的外观', async () => {
    memory.set('BTN_theme', JSON.stringify('dark'))
    memory.set('BTN_accent', JSON.stringify('green'))
    memory.set('BTN_density', JSON.stringify('compact'))
    memory.set('BTN_radius', JSON.stringify('large'))
    const app = await createAppStore()

    expect(app.theme).toBe('dark')
    expect(app.accent).toBe('green')
    expect(app.density).toBe('compact')
    expect(app.radius).toBe('large')
    expect(app.themeClass).toBe('theme-dark accent-green density-compact radius-large')
  })

  it('非法或损坏的配置回落到默认值', async () => {
    memory.set('BTN_theme', JSON.stringify('blue'))
    memory.set('BTN_accent', 'not-json-violet')
    memory.set('BTN_density', JSON.stringify('tiny'))
    memory.set('BTN_radius', 'broken')
    const app = await createAppStore()

    expect(app.theme).toBe('light')
    expect(app.accent).toBe('sky')
    expect(app.density).toBe('normal')
    expect(app.radius).toBe('default')
  })

  it('密度与圆角切换写入本地存储', async () => {
    const app = await createAppStore()
    app.setDensity('compact')
    app.setRadius('small')

    expect(app.themeClass).toBe('theme-light accent-sky density-compact radius-small')
    expect(memory.get('BTN_density')).toBe(JSON.stringify('compact'))
    expect(memory.get('BTN_radius')).toBe(JSON.stringify('small'))
  })

  it('setRadius / setDensity 拒绝非法档位', async () => {
    const app = await createAppStore()
    app.setDensity('huge' as never)
    app.setRadius('round' as never)

    expect(app.density).toBe('normal')
    expect(app.radius).toBe('default')
  })

  it('toggleTheme 在明暗之间往返', async () => {
    const app = await createAppStore()
    app.toggleTheme()
    expect(app.theme).toBe('dark')
    app.toggleTheme()
    expect(app.theme).toBe('light')
    expect(memory.get('BTN_theme')).toBe(JSON.stringify('light'))
  })

  it('setAccent 拒绝未登记的品牌色', async () => {
    const app = await createAppStore()
    app.setAccent('pink' as never)
    expect(app.accent).toBe('sky')
  })
})
