import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useCrudForm } from './useCrudForm'

interface Form {
  name: string
  sort: number
}

interface Row {
  id: number
  name: string
  sort: number
}

const toast = vi.fn()
vi.stubGlobal('uni', { showToast: toast })

const setup = (overrides: Partial<Parameters<typeof useCrudForm<Form, Row>>[0]> = {}) => {
  const create = vi.fn(async () => undefined)
  const update = vi.fn(async () => undefined)
  const onSaved = vi.fn()
  const crud = useCrudForm<Form, Row>({
    empty: () => ({ name: '', sort: 1 }),
    defaults: () => ({ sort: 2 }),
    fill: (row) => ({ name: row.name, sort: row.sort }),
    rules: [{ field: 'name', label: '名称', required: true, requiredMessage: '请输入名称' }],
    create,
    update,
    title: (row) => (row ? '编辑条目' : '新增条目'),
    onSaved,
    ...overrides,
  })
  return { ...crud, create, update, onSaved }
}

beforeEach(() => {
  toast.mockClear()
})

describe('useCrudForm', () => {
  it('新建时合并默认值与上下文预设', () => {
    const crud = setup()
    crud.openCreate({ name: '预设名称' })

    expect(crud.visible.value).toBe(true)
    expect(crud.editing.value).toBeNull()
    expect(crud.form.value).toEqual({ name: '预设名称', sort: 2 })
    expect(crud.title.value).toBe('新增条目')
  })

  it('编辑时按 fill 映射行数据并给出标题', () => {
    const crud = setup()
    crud.openEdit({ id: 7, name: '旧名称', sort: 3, extra: 'ignored' } as Row)

    expect(crud.editing.value?.id).toBe(7)
    expect(crud.form.value).toEqual({ name: '旧名称', sort: 3 })
    expect(crud.title.value).toBe('编辑条目')
  })

  it('校验不通过时不调用接口，错误写入 error', async () => {
    const crud = setup()
    crud.openCreate()

    const result = await crud.submit()

    expect(result).toBe(false)
    expect(crud.error.value).toBe('请输入名称')
    expect(crud.create).not.toHaveBeenCalled()
    expect(crud.visible.value).toBe(true)
  })

  it('新增成功后 toast、关闭弹窗并回调 onSaved', async () => {
    const crud = setup()
    crud.openCreate()
    crud.form.value.name = '新条目'

    const result = await crud.submit()

    expect(result).toBe(true)
    expect(crud.create).toHaveBeenCalledWith({ name: '新条目', sort: 2 })
    expect(toast).toHaveBeenCalledWith({ title: '新增成功', icon: 'success' })
    expect(crud.visible.value).toBe(false)
    expect(crud.onSaved).toHaveBeenCalledWith('create')
    expect(crud.submitting.value).toBe(false)
  })

  it('编辑走 update 并带上行 id', async () => {
    const crud = setup()
    crud.openEdit({ id: 3, name: '条目', sort: 1 })
    crud.form.value.name = '改名'

    await crud.submit()

    expect(crud.update).toHaveBeenCalledWith(3, { name: '改名', sort: 1 })
    expect(crud.create).not.toHaveBeenCalled()
    expect(toast).toHaveBeenCalledWith({ title: '修改成功', icon: 'success' })
    expect(crud.onSaved).toHaveBeenCalledWith('update')
  })

  it('提交前可用 payload 整理接口结构', async () => {
    const crud = setup({
      payload: (form) => ({ ...form, name: form.name.trim() }),
    })
    crud.openCreate()
    crud.form.value.name = '  去空格  '

    await crud.submit()

    expect(crud.create).toHaveBeenCalledWith({ name: '去空格', sort: 2 })
  })

  it('接口失败时保留弹窗并把错误展示出来', async () => {
    const crud = setup({
      create: vi.fn(async () => {
        throw new Error('账号已存在')
      }),
    })
    crud.openCreate()
    crud.form.value.name = '重复'

    const result = await crud.submit()

    expect(result).toBe(false)
    expect(crud.error.value).toBe('账号已存在')
    expect(crud.visible.value).toBe(true)
    expect(crud.submitting.value).toBe(false)
  })

  it('提交期间 submitting 为 true，结束后复位', async () => {
    let resolveCreate: () => void = () => undefined
    const crud = setup({
      create: vi.fn(
        () =>
          new Promise<void>((resolve) => {
            resolveCreate = resolve
          })
      ),
    })
    crud.openCreate()
    crud.form.value.name = '慢请求'

    const pending = crud.submit()
    expect(crud.submitting.value).toBe(true)

    resolveCreate()
    await pending
    expect(crud.submitting.value).toBe(false)
  })
})
