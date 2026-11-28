import { describe, expect, it } from 'vitest'
import { insertIndexToMoveIndex, moveItem, resolveInsertIndex } from './decoDrag'

describe('装修组件拖拽排序', () => {
  const rects = [
    { top: 0, height: 40 },
    { top: 48, height: 40 },
    { top: 96, height: 40 },
  ]

  it('根据指针位置计算插入点', () => {
    expect(resolveInsertIndex(-10, rects)).toBe(0)
    expect(resolveInsertIndex(19, rects)).toBe(0)
    expect(resolveInsertIndex(21, rects)).toBe(1)
    expect(resolveInsertIndex(90, rects)).toBe(2)
    expect(resolveInsertIndex(999, rects)).toBe(3)
  })

  it('向下拖动时插入位置换算为最终索引', () => {
    expect(insertIndexToMoveIndex(0, 3)).toBe(2)
    expect(insertIndexToMoveIndex(1, 0)).toBe(0)
    expect(insertIndexToMoveIndex(1, 1)).toBe(1)
    expect(insertIndexToMoveIndex(1, 2)).toBe(1)
  })

  it('移动元素且不修改原数组', () => {
    const source = ['a', 'b', 'c', 'd']
    expect(moveItem(source, 0, 2)).toEqual(['b', 'c', 'a', 'd'])
    expect(moveItem(source, 3, 0)).toEqual(['d', 'a', 'b', 'c'])
    expect(source).toEqual(['a', 'b', 'c', 'd'])
  })

  it('越界或原地移动时返回原数组', () => {
    const source = ['a', 'b']
    expect(moveItem(source, 0, 0)).toBe(source)
    expect(moveItem(source, -1, 1)).toBe(source)
    expect(moveItem(source, 0, 2)).toBe(source)
  })
})
