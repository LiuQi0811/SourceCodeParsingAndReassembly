import { describe, expect, it } from 'vitest'
import { formatDate, formatDateTime, maskPhone, padZero } from '@/utils/format'

describe('padZero', () => {
  it('按位数补零', () => {
    expect(padZero(5)).toBe('05')
    expect(padZero(12)).toBe('12')
    expect(padZero(7, 3)).toBe('007')
    expect(padZero(1234)).toBe('1234')
  })
})

describe('formatDateTime', () => {
  it('输出 YYYY-MM-DD HH:mm:ss，月日时分秒个位数补零', () => {
    expect(formatDateTime(new Date(2026, 0, 5, 3, 4, 5))).toBe('2026-01-05 03:04:05')
  })

  it('不传参数时使用当前时间', () => {
    expect(formatDateTime()).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
  })
})

describe('formatDate', () => {
  it('只保留日期部分', () => {
    expect(formatDate('2026-11-27 09:12:33')).toBe('2026-11-27')
    expect(formatDate('2026-11-27')).toBe('2026-11-27')
  })

  it('空值返回空字符串', () => {
    expect(formatDate('')).toBe('')
  })
})

describe('maskPhone', () => {
  it('11 位手机号中间四位打码', () => {
    expect(maskPhone('13800138000')).toBe('138****8000')
  })

  it('不足 11 位原样返回，空值返回空字符串', () => {
    expect(maskPhone('1380013')).toBe('1380013')
    expect(maskPhone('')).toBe('')
  })
})
