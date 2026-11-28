export interface TreeNode {
  id: number
  parentId: number
  children?: TreeNode[]
}

/** 扁平列表转树 */
export const listToTree = <T extends TreeNode>(
  list: T[],
  rootId = 0
): (T & { children?: T[] })[] => {
  const nodes = list.map((item) => ({ ...item, children: [] as T[] }))
  const tree: (T & { children?: T[] })[] = []

  nodes.forEach((node) => {
    const parent = nodes.find((item) => item.id === node.parentId)
    if (node.parentId === rootId || !parent) {
      tree.push(node)
    } else {
      parent.children!.push(node)
    }
  })

  const sortTree = (items: (T & { children?: T[] })[]) => {
    items.sort((a: any, b: any) => (a.sort ?? 0) - (b.sort ?? 0))
    items.forEach((item) => {
      if (item.children && item.children.length) sortTree(item.children as any)
      else delete item.children
    })
  }
  sortTree(tree)
  return tree
}

export interface FlatNode<T> {
  node: T
  depth: number
}

/** 树拍平，附带层级深度，便于在列表里做缩进展示 */
export const flattenTree = <T extends TreeNode>(tree: T[], depth = 0): FlatNode<T>[] => {
  const result: FlatNode<T>[] = []
  tree.forEach((node) => {
    result.push({ node, depth })
    if (node.children && node.children.length) {
      result.push(...flattenTree(node.children as T[], depth + 1))
    }
  })
  return result
}

/** 在树中查找节点 */
export const findTreeNode = <T extends TreeNode>(
  tree: T[],
  predicate: (node: T) => boolean
): T | null => {
  for (const node of tree) {
    if (predicate(node)) return node
    if (node.children && node.children.length) {
      const found = findTreeNode(node.children as T[], predicate)
      if (found) return found
    }
  }
  return null
}

/** 收集某个节点及其所有子孙节点的 id */
export const collectTreeIds = <T extends TreeNode>(node: T): number[] => {
  const ids: number[] = [node.id]
  if (node.children && node.children.length) {
    node.children.forEach((child) => {
      ids.push(...collectTreeIds(child as T))
    })
  }
  return ids
}
