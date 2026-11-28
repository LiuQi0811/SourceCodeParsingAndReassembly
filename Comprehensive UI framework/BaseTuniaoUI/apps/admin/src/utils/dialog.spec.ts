import { beforeEach, describe, expect, it, vi } from 'vitest'
import { confirmDelete } from './dialog'
import { setLocale } from '@/locales'

const memory = new Map<string, string>()

const uniStub = {
  getStorageSync: (key: string) => memory.get(key) ?? '',
  setStorageSync: (key: string, value: string) => memory.set(key, value),
  removeStorageSync: (key: string) => memory.delete(key),
  clearStorageSync: () => memory.clear(),
  showModal: vi.fn(),
  showToast: vi.fn(),
}

vi.stubGlobal('uni', uniStub)

const modalOptions = () => uniStub.showModal.mock.calls[0][0] as Record<string, string>

beforeEach(() => {
  memory.clear()
  uniStub.showModal.mockClear()
  uniStub.showToast.mockClear()
})

describe('confirmDelete', () => {
  it('中文环境显式传取消键文案，避免 uni 内置的 Cancel', () => {
    setLocale('zh-CN')
    confirmDelete({ title: '删除用户', content: '确认删除？', onConfirm: () => undefined })

    expect(modalOptions().cancelText).toBe('取消')
    expect(modalOptions().confirmText).toBe('删除')
    expect(modalOptions().confirmColor).toBe('#f5455c')
  })

  it('英文环境两个按钮都走当前语言', () => {
    setLocale('en-US')
    confirmDelete({ title: 'Delete user', content: 'Are you sure?', onConfirm: () => undefined })

    expect(modalOptions().cancelText).toBe('Cancel')
    expect(modalOptions().confirmText).toBe('Delete')
  })

  it('确认后执行回调，失败时回落到 toast', async () => {
    setLocale('zh-CN')
    const onConfirm = vi.fn(() => Promise.reject(new Error('接口异常')))
    confirmDelete({ title: '删除用户', content: '确认删除？', onConfirm })

    const options = modalOptions() as unknown as { success: (res: { confirm: boolean }) => void }
    options.success({ confirm: true })
    // 回调是异步失败，等一轮宏任务再看 toast
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(uniStub.showToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: '接口异常', icon: 'none' })
    )
  })

  it('取消时不执行回调', () => {
    setLocale('zh-CN')
    const onConfirm = vi.fn()
    confirmDelete({ title: '删除用户', content: '确认删除？', onConfirm })

    const options = modalOptions() as unknown as { success: (res: { confirm: boolean }) => void }
    options.success({ confirm: false })
    expect(onConfirm).not.toHaveBeenCalled()
  })
})
