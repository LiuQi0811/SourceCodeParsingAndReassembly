import { computed, ref } from 'vue'
import type { Ref } from 'vue'
import { i18n } from '@/locales'
import { validateForm } from '@/utils/validate'
import type { FormRule } from '@/utils/validate'

export interface CrudFormOptions<T extends Record<string, any>, R extends { id: number }, P = T> {
  /** 新建时的空白表单 */
  empty: () => T
  /** 新建时按页面上下文补默认值（如默认部门、默认排序） */
  defaults?: () => Partial<T>
  /** 编辑时把行数据映射成表单模型，避免把行里的无关字段带进表单 */
  fill: (row: R) => T
  /** 校验规则，字段顺序即提示顺序 */
  rules?: FormRule<T>[]
  create: (payload: P) => Promise<unknown>
  update?: (id: number, payload: P) => Promise<unknown>
  /** 提交前把表单整理成接口需要的结构 */
  payload?: (form: T) => P
  /** 弹窗标题，默认「新增 / 编辑」 */
  title?: (editing: R | null) => string
  /** 保存成功后的收尾：刷新列表、刷新权限等 */
  onSaved?: (mode: 'create' | 'update') => void | Promise<void>
  successMessage?: { create?: string; update?: string }
}

/**
 * 管理页的新增 / 编辑弹窗通用逻辑
 * 把「打开弹窗 → 重置表单 → 校验 → 提交 → toast → 关闭 → 刷新」这条链路收敛成一处，
 * 页面只保留字段定义、规则和接口调用
 */
export function useCrudForm<T extends Record<string, any>, R extends { id: number }, P = T>(
  options: CrudFormOptions<T, R, P>
) {
  const visible = ref(false)
  const editing = ref(null) as Ref<R | null>
  const submitting = ref(false)
  const error = ref('')
  const form = ref(options.empty()) as Ref<T>

  const title = computed(() => {
    if (options.title) return options.title(editing.value)
    return editing.value ? '编辑' : '新增'
  })

  const resetError = (): void => {
    error.value = ''
  }

  /** 新建：可传入上下文预设，如上级节点、默认部门 */
  const openCreate = (preset?: Partial<T>): void => {
    editing.value = null
    resetError()
    form.value = { ...options.empty(), ...options.defaults?.(), ...preset }
    visible.value = true
  }

  const openEdit = (row: R): void => {
    editing.value = row
    resetError()
    form.value = options.fill(row)
    visible.value = true
  }

  const close = (): void => {
    visible.value = false
  }

  const submit = async (): Promise<boolean> => {
    resetError()
    const result = validateForm(form.value, options.rules)
    if (!result.valid) {
      error.value = result.message
      return false
    }

    submitting.value = true
    try {
      const data = (options.payload ? options.payload(form.value) : form.value) as P
      const mode: 'create' | 'update' = editing.value ? 'update' : 'create'

      if (editing.value) {
        if (!options.update) throw new Error('未提供编辑接口')
        await options.update(editing.value.id, data)
      } else {
        await options.create(data)
      }

      uni.showToast({
        title:
          mode === 'update'
            ? options.successMessage?.update || i18n.global.t('common.updateSuccess')
            : options.successMessage?.create || i18n.global.t('common.createSuccess'),
        icon: 'success',
      })
      visible.value = false
      await options.onSaved?.(mode)
      return true
    } catch (e) {
      error.value = (e as Error).message || '保存失败'
      return false
    } finally {
      submitting.value = false
    }
  }

  return {
    form,
    visible,
    editing,
    submitting,
    error,
    title,
    openCreate,
    openEdit,
    submit,
    close,
  }
}
