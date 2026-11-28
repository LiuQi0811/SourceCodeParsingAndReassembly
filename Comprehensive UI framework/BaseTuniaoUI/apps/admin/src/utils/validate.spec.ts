import { describe, expect, it } from 'vitest'
import { EMAIL_PATTERN, PHONE_PATTERN, isEmptyValue, validateForm } from './validate'
import type { FormRule } from './validate'

interface Form {
  name: string
  phone: string
  email: string
  tags: string[]
}

const baseForm = (): Form => ({ name: '', phone: '', email: '', tags: [] })

describe('isEmptyValue', () => {
  it('空串与纯空格算未填', () => {
    expect(isEmptyValue('')).toBe(true)
    expect(isEmptyValue('   ')).toBe(true)
    expect(isEmptyValue(' a ')).toBe(false)
  })

  it('空数组、null、undefined 算未填，数字 0 不算', () => {
    expect(isEmptyValue([])).toBe(true)
    expect(isEmptyValue(null)).toBe(true)
    expect(isEmptyValue(undefined)).toBe(true)
    expect(isEmptyValue(0)).toBe(false)
  })
})

describe('validateForm', () => {
  it('空规则直接通过', () => {
    expect(validateForm(baseForm()).valid).toBe(true)
  })

  it('必填缺失时返回自定义提示并指向字段', () => {
    const rules: FormRule<Form>[] = [
      { field: 'name', label: '名称', required: true, requiredMessage: '请输入名称' },
    ]
    const result = validateForm(baseForm(), rules)
    expect(result.valid).toBe(false)
    expect(result.message).toBe('请输入名称')
    expect(result.field).toBe('name')
  })

  it('未给自定义提示时用「请填写{label}」', () => {
    const result = validateForm(baseForm(), [{ field: 'name', label: '字典名称', required: true }])
    expect(result.message).toBe('请填写字典名称')
  })

  it('只返回第一条错误，后面的规则短路', () => {
    const rules: FormRule<Form>[] = [
      { field: 'name', label: '名称', required: true },
      { field: 'phone', label: '手机号', required: true },
    ]
    const result = validateForm(baseForm(), rules)
    expect(result.field).toBe('name')
    expect(result.message).toBe('请填写名称')
  })

  it('选填字段为空时跳过格式校验', () => {
    const rules: FormRule<Form>[] = [
      {
        field: 'phone',
        label: '手机号',
        pattern: PHONE_PATTERN,
        invalidMessage: '手机号格式不正确',
      },
    ]
    expect(validateForm(baseForm(), rules).valid).toBe(true)
  })

  it('手机号格式错误时报错，正确时通过', () => {
    const rules: FormRule<Form>[] = [
      {
        field: 'phone',
        label: '手机号',
        pattern: PHONE_PATTERN,
        invalidMessage: '手机号格式不正确',
      },
    ]
    const form = { ...baseForm(), phone: '12345' }
    expect(validateForm(form, rules).message).toBe('手机号格式不正确')

    form.phone = '13800138000'
    expect(validateForm(form, rules).valid).toBe(true)
    // 前后空格不影响判断
    form.phone = ' 13800138000 '
    expect(validateForm(form, rules).valid).toBe(true)
  })

  it('邮箱格式按 EMAIL_PATTERN 校验', () => {
    const rules: FormRule<Form>[] = [{ field: 'email', label: '邮箱', pattern: EMAIL_PATTERN }]
    const form = { ...baseForm(), email: 'a@b' }
    expect(validateForm(form, rules).message).toBe('邮箱格式不正确')

    form.email = 'dev@tuniao.com'
    expect(validateForm(form, rules).valid).toBe(true)
  })

  it('超过最大长度时报错', () => {
    const rules: FormRule<Form>[] = [{ field: 'name', label: '名称', maxLength: 4 }]
    const form = { ...baseForm(), name: '12345' }
    expect(validateForm(form, rules).message).toBe('名称不能超过 4 个字符')
  })

  it('跨字段校验能读到整份表单', () => {
    interface MenuForm {
      type: 'menu' | 'button'
      path: string
      perms: string
    }
    const rules: FormRule<MenuForm>[] = [
      {
        field: 'path',
        label: '路由路径',
        validate: (_value, form) =>
          form.type === 'menu' && !form.path.trim() ? '菜单需要填写路由路径' : '',
      },
    ]
    expect(validateForm<MenuForm>({ type: 'menu', path: '', perms: '' }, rules).valid).toBe(false)
    expect(validateForm<MenuForm>({ type: 'button', path: '', perms: '' }, rules).valid).toBe(true)
  })
})
