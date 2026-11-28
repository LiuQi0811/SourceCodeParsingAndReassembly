/**
 * 表单校验的通用规则与执行器
 * 规则是纯数据，页面只声明「哪个字段、必填与否、什么格式」，
 * 由 validateForm 统一按顺序短路，返回第一条错误，保证错误提示唯一、稳定
 */
export type FormRule<T> = {
  /** 待校验字段 */
  field: keyof T & string
  /** 字段中文名，用于拼默认提示 */
  label: string
  /** 必填：空串、空数组、null/undefined 都算未填 */
  required?: boolean
  /** 自定义必填提示，默认「请填写{label}」 */
  requiredMessage?: string
  /** 格式校验，仅在字段有值时校验 */
  pattern?: RegExp
  /** 自定义格式错误提示，默认「{label}格式不正确」 */
  invalidMessage?: string
  /** 最大长度 */
  maxLength?: number
  /** 跨字段校验：返回空串表示通过，返回文案即错误 */
  validate?: (value: unknown, form: T) => string
}

export interface ValidateResult {
  valid: boolean
  message: string
  /** 未通过时指向第一个出错的字段 */
  field?: string
}

/** 国内手机号 */
export const PHONE_PATTERN = /^1[3-9]\d{9}$/
/** 邮箱（够用即可，不追求 RFC 全集） */
export const EMAIL_PATTERN = /^[\w.-]+@[\w-]+(\.[\w-]+)+$/

export const isEmptyValue = (value: unknown): boolean => {
  if (value === null || value === undefined) return true
  if (typeof value === 'string') return value.trim() === ''
  if (Array.isArray(value)) return value.length === 0
  return false
}

export const isValidPhone = (value: string): boolean => PHONE_PATTERN.test(value.trim())

export const isValidEmail = (value: string): boolean => EMAIL_PATTERN.test(value.trim())

/** 按规则顺序校验，命中第一条错误就返回，避免一堆提示同时冒出来 */
export function validateForm<T extends object>(form: T, rules: FormRule<T>[] = []): ValidateResult {
  for (const rule of rules) {
    const value = (form as Record<string, unknown>)[rule.field]

    if (rule.required && isEmptyValue(value)) {
      return {
        valid: false,
        message: rule.requiredMessage || `请填写${rule.label}`,
        field: rule.field,
      }
    }

    // 跨字段校验放在「空值跳过」之前：某些字段是否必填取决于其它字段（如按钮才需要权限标识）
    if (rule.validate) {
      const message = rule.validate(value, form)
      if (message) return { valid: false, message, field: rule.field }
    }

    if (isEmptyValue(value)) continue

    if (typeof value === 'string' && rule.maxLength && value.trim().length > rule.maxLength) {
      return {
        valid: false,
        message: `${rule.label}不能超过 ${rule.maxLength} 个字符`,
        field: rule.field,
      }
    }

    if (rule.pattern && typeof value === 'string' && !rule.pattern.test(value.trim())) {
      return {
        valid: false,
        message: rule.invalidMessage || `${rule.label}格式不正确`,
        field: rule.field,
      }
    }
  }

  return { valid: true, message: '' }
}
