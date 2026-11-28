import { formatDateTime } from '@/utils/format'
import type { DictDataItem, DictTypeItem } from '@/api/types'
import { defineMock, MockError } from '../adapter'
import { db } from '../db'
import { hitKeyword, paginate } from '../helper'

/* -------------------------- 字典类型 -------------------------- */

defineMock('GET', '/system/dict/type/page', ({ query }) => {
  const types = db.dictTypes.all()
  const status = query.status
  const filtered = types
    .filter((type) => {
      const statusMatch =
        status === undefined || status === '' || status === null
          ? true
          : Number(type.status) === Number(status)
      return statusMatch && hitKeyword([type.name, type.code], query.keyword)
    })
    .sort((a, b) => a.id - b.id)
  return paginate(filtered, query)
})

defineMock('POST', '/system/dict/type', ({ body }) => {
  const types = db.dictTypes.all()
  const payload = body as Partial<DictTypeItem>
  if (!payload.name) throw new MockError('字典名称不能为空', 400)
  if (!payload.code) throw new MockError('字典编码不能为空', 400)
  if (types.some((type) => type.code === payload.code)) {
    throw new MockError('字典编码已存在', 400)
  }

  const created: DictTypeItem = {
    id: db.dictTypes.nextId(types),
    name: payload.name!,
    code: payload.code!,
    status: (payload.status ?? 1) as DictTypeItem['status'],
    remark: payload.remark || '',
    createTime: formatDateTime(),
  }
  types.push(created)
  db.dictTypes.save(types)
  return created
})

defineMock('PUT', '/system/dict/type/:id', ({ pathParams, body }) => {
  const types = db.dictTypes.all()
  const id = Number(pathParams.id)
  const index = types.findIndex((type) => type.id === id)
  if (index === -1) throw new MockError('字典类型不存在', 404)

  const payload = body as Partial<DictTypeItem>
  const oldCode = types[index].code
  if (payload.code && types.some((type) => type.code === payload.code && type.id !== id)) {
    throw new MockError('字典编码已存在', 400)
  }

  types[index] = { ...types[index], ...payload, id }

  // 编码变化时同步字典项
  if (payload.code && payload.code !== oldCode) {
    const data = db.dictData.all()
    data.forEach((item) => {
      if (item.typeCode === oldCode) item.typeCode = payload.code!
    })
    db.dictData.save(data)
  }

  db.dictTypes.save(types)
  return types[index]
})

defineMock('DELETE', '/system/dict/type/:id', ({ pathParams }) => {
  const types = db.dictTypes.all()
  const id = Number(pathParams.id)
  const target = types.find((type) => type.id === id)
  if (!target) throw new MockError('字典类型不存在', 404)

  db.dictTypes.save(types.filter((type) => type.id !== id))
  db.dictData.save(db.dictData.all().filter((item) => item.typeCode !== target.code))
  return true
})

/* -------------------------- 字典数据 -------------------------- */

defineMock('GET', '/system/dict/data/page', ({ query }) => {
  const data = db.dictData.all()
  const typeCode = query.typeCode as string
  const status = query.status
  const filtered = data
    .filter((item) => {
      if (typeCode && item.typeCode !== typeCode) return false
      const statusMatch =
        status === undefined || status === '' || status === null
          ? true
          : Number(item.status) === Number(status)
      return statusMatch && hitKeyword([item.label, item.value], query.keyword)
    })
    .sort((a, b) => a.sort - b.sort)
  return paginate(filtered, query)
})

defineMock('POST', '/system/dict/data', ({ body }) => {
  const data = db.dictData.all()
  const payload = body as Partial<DictDataItem>
  if (!payload.typeCode) throw new MockError('请先选择字典类型', 400)
  if (!payload.label) throw new MockError('字典标签不能为空', 400)

  const created: DictDataItem = {
    id: db.dictData.nextId(data),
    typeCode: payload.typeCode!,
    label: payload.label!,
    value: payload.value || String(payload.label),
    sort: Number(payload.sort) || data.length + 1,
    status: (payload.status ?? 1) as DictDataItem['status'],
    tagType: payload.tagType || '',
  }
  data.push(created)
  db.dictData.save(data)
  return created
})

defineMock('PUT', '/system/dict/data/:id', ({ pathParams, body }) => {
  const data = db.dictData.all()
  const id = Number(pathParams.id)
  const index = data.findIndex((item) => item.id === id)
  if (index === -1) throw new MockError('字典数据不存在', 404)

  data[index] = { ...data[index], ...(body as Partial<DictDataItem>), id }
  db.dictData.save(data)
  return data[index]
})

defineMock('DELETE', '/system/dict/data/:id', ({ pathParams }) => {
  const data = db.dictData.all()
  const id = Number(pathParams.id)
  if (!data.some((item) => item.id === id)) throw new MockError('字典数据不存在', 404)
  db.dictData.save(data.filter((item) => item.id !== id))
  return true
})
