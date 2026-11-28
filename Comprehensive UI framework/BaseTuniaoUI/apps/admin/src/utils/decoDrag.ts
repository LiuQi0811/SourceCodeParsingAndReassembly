/**
 * 装修组件列表的拖拽排序计算。
 * 只做纯数据计算，DOM 事件绑定留在页面组件里，方便单测。
 */

export interface DragRect {
  top: number
  height: number
}

/** 根据鼠标/手指的 Y 坐标，算出应插入到第几个位置（0 ~ list.length） */
export const resolveInsertIndex = (pointerY: number, rects: DragRect[]): number => {
  for (let index = 0; index < rects.length; index += 1) {
    const rect = rects[index]
    if (pointerY < rect.top + rect.height / 2) return index
  }
  return rects.length
}

/** 把 from 位置的元素移动到最终第 to 个位置，返回新数组，不修改入参 */
export const moveItem = <T>(list: T[], from: number, to: number): T[] => {
  if (from < 0 || from >= list.length || to < 0 || to >= list.length || from === to) {
    return list
  }
  const next = list.slice()
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

/**
 * 把「插入位置」换算成「移动后的索引」。
 * 向下拖动时，插入位置在自身之后，移除原元素后索引要减 1。
 */
export const insertIndexToMoveIndex = (from: number, insertIndex: number): number =>
  insertIndex > from ? insertIndex - 1 : insertIndex
