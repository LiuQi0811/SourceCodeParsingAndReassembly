import { i18n } from '@/locales'

export interface ConfirmDeleteOptions {
  title: string
  content: string
  confirmText?: string
  /** 危险操作默认红色确认按钮 */
  confirmColor?: string
  onConfirm: () => void | Promise<void>
}

/**
 * 删除 / 危险操作二次确认
 * 统一确认按钮文案与颜色，并把异步失败兜到 toast，避免各页面各写一遍 showModal
 */
export function confirmDelete(options: ConfirmDeleteOptions): void {
  uni.showModal({
    title: options.title,
    content: options.content,
    confirmText: options.confirmText || i18n.global.t('common.remove'),
    // uni.showModal 的取消键默认跟浏览器语言走（中文页面里也会显示 "Cancel"），这里显式传
    cancelText: i18n.global.t('common.cancel'),
    confirmColor: options.confirmColor || '#f5455c',
    success: (res) => {
      if (!res.confirm) return
      Promise.resolve(options.onConfirm()).catch((e: Error) => {
        uni.showToast({
          title: e?.message || i18n.global.t('common.operationFailed'),
          icon: 'none',
        })
      })
    },
  })
}
