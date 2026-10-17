import type { ComponentNode } from './schema';

export interface NodeLocation {
  parent: ComponentNode;
  index: number;
}

/**
 * 组件 id → 节点/父节点/索引 的扁平索引。
 * 结构变更后调用 `rebuild(root)` 重建，之后所有查询均为 O(1)。
 * 相比递归遍历 `findNode/findLocation`，在组件数较多时查询性能提升显著。
 */
export class NodeIndex {
  private readonly nodeMap = new Map<string, ComponentNode>();
  private readonly parentMap = new Map<string, string | null>();
  private readonly indexMap = new Map<string, number>();
  private rootId: string | null = null;

  rebuild(root: ComponentNode): void {
    this.nodeMap.clear();
    this.parentMap.clear();
    this.indexMap.clear();
    this.rootId = root.id;
    this.walk(root, null);
  }

  private walk(node: ComponentNode, parentId: string | null, index = 0): void {
    this.nodeMap.set(node.id, node);
    this.parentMap.set(node.id, parentId);
    this.indexMap.set(node.id, index);
    node.children.forEach((child, i) => this.walk(child, node.id, i));
  }

  getNode(id: string): ComponentNode | null {
    return this.nodeMap.get(id) ?? null;
  }

  getParentId(id: string): string | null {
    return this.parentMap.get(id) ?? null;
  }

  getParent(id: string): ComponentNode | null {
    const parentId = this.parentMap.get(id);
    if (parentId === null || parentId === undefined) return null;
    return this.nodeMap.get(parentId) ?? null;
  }

  getLocation(id: string): NodeLocation | null {
    const parent = this.getParent(id);
    const index = this.indexMap.get(id);
    if (!parent || index === undefined) return null;
    return { parent, index };
  }

  isAncestor(ancestorId: string, nodeId: string): boolean {
    let current: string | null | undefined = this.parentMap.get(nodeId);
    while (current !== null && current !== undefined) {
      if (current === ancestorId) return true;
      current = this.parentMap.get(current);
    }
    return false;
  }

  get rootNode(): ComponentNode | null {
    if (!this.rootId) return null;
    return this.nodeMap.get(this.rootId) ?? null;
  }

  has(id: string): boolean {
    return this.nodeMap.has(id);
  }
}
