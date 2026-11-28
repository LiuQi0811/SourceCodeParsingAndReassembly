import { describe, expect, it } from 'vitest'
import { collectTreeIds, findTreeNode, flattenTree, listToTree, type TreeNode } from '@/utils/tree'

interface Node extends TreeNode {
  id: number
  parentId: number
  name: string
  sort?: number
}

const flat = (): Node[] => [
  { id: 1, parentId: 0, name: '系统管理', sort: 2 },
  { id: 2, parentId: 0, name: '工作台', sort: 1 },
  { id: 3, parentId: 1, name: '用户管理', sort: 2 },
  { id: 4, parentId: 1, name: '角色管理', sort: 1 },
  { id: 5, parentId: 3, name: '用户新增', sort: 1 },
  { id: 9, parentId: 88, name: '孤儿节点', sort: 3 },
]

describe('listToTree', () => {
  it('按 parentId 组装父子并保留 rootId 判定', () => {
    const tree = listToTree(flat())
    expect(tree.map((n) => n.id)).toEqual([2, 1, 9])
    expect(tree[1].children!.map((n) => n.id)).toEqual([4, 3])
  })

  it('按 sort 升序排列（缺省 sort 视为 0）', () => {
    const tree = listToTree([
      { id: 1, parentId: 0, name: 'b', sort: 3 },
      { id: 2, parentId: 0, name: 'a', sort: 1 },
      { id: 3, parentId: 0, name: 'c' },
    ])
    expect(tree.map((n) => n.name)).toEqual(['c', 'a', 'b'])
  })

  it('叶子节点不保留空 children 字段', () => {
    const tree = listToTree([{ id: 1, parentId: 0, name: 'only' }])
    expect(tree[0]).not.toHaveProperty('children')
  })

  it('父节点不存在时按根节点处理，避免数据丢失', () => {
    const tree = listToTree([{ id: 1, parentId: 999, name: 'dangling' }])
    expect(tree).toHaveLength(1)
    expect(tree[0].name).toBe('dangling')
  })
})

describe('flattenTree', () => {
  it('展开顺序为父节点在前、子节点紧随其后，并标注层级', () => {
    const tree = listToTree(flat())
    const rows = flattenTree(tree)
    expect(rows.map((r) => `${r.node.id}@${r.depth}`)).toEqual([
      '2@0',
      '1@0',
      '4@1',
      '3@1',
      '5@2',
      '9@0',
    ])
  })

  it('空树返回空数组', () => {
    expect(flattenTree([])).toEqual([])
  })
})

describe('findTreeNode / collectTreeIds', () => {
  it('深度优先查找节点', () => {
    const tree = listToTree(flat())
    expect(findTreeNode(tree, (n) => n.name === '用户新增')?.id).toBe(5)
    expect(findTreeNode(tree, (n) => n.name === '不存在的节点')).toBeNull()
  })

  it('收集自身与全部子孙 id', () => {
    const tree = listToTree(flat())
    const system = findTreeNode(tree, (n) => n.id === 1)!
    expect(collectTreeIds(system)).toEqual([1, 4, 3, 5])
  })
})
