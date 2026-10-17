import type { ComponentNode, ComponentType, PageSchema } from './schema';
import { getDefinition } from './registry';
import { uid } from './uid';

const COMPONENT_TYPES: ReadonlySet<ComponentType> = new Set<ComponentType>([
  'container',
  'heading',
  'paragraph',
  'button',
  'image',
  'divider',
  'input',
  'link',
  'form',
  'textarea',
  'select',
  'checkbox',
  'switch',
]);

export interface PathLocation {
  parent: ComponentNode;
  index: number;
}

export function findNode(root: ComponentNode, id: string): ComponentNode | null {
  if (root.id === id) return root;
  for (const child of root.children) {
    const found = findNode(child, id);
    if (found) return found;
  }
  return null;
}

export function findLocation(root: ComponentNode, id: string): PathLocation | null {
  const index = root.children.findIndex((child) => child.id === id);
  if (index >= 0) return { parent: root, index };

  for (const child of root.children) {
    const found = findLocation(child, id);
    if (found) return found;
  }
  return null;
}

export function isAncestor(maybeAncestor: ComponentNode, nodeId: string): boolean {
  return maybeAncestor.children.some((child) => child.id === nodeId || isAncestor(child, nodeId));
}

export function canContain(parent: ComponentNode): boolean {
  return getDefinition(parent.type).canHaveChildren;
}

export function insertNode(root: ComponentNode, node: ComponentNode, parentId: string, index: number): boolean {
  if (root.id === node.id) return false;
  const parent = findNode(root, parentId);
  if (!parent || !canContain(parent) || isAncestor(node, parentId)) return false;
  const nextIndex = Math.max(0, Math.min(index, parent.children.length));
  parent.children.splice(nextIndex, 0, node);
  return true;
}

export function removeNode(root: ComponentNode, id: string): ComponentNode | null {
  const location = findLocation(root, id);
  if (!location) return null;
  const [removed] = location.parent.children.splice(location.index, 1);
  return removed;
}

export function moveNode(root: ComponentNode, id: string, targetParentId: string, targetIndex: number): boolean {
  if (id === root.id || id === targetParentId) return false;
  const source = findLocation(root, id);
  if (!source) return false;
  const node = source.parent.children[source.index];
  const targetParent = findNode(root, targetParentId);
  if (!targetParent || !canContain(targetParent) || isAncestor(node, targetParentId)) return false;

  source.parent.children.splice(source.index, 1);
  const sameParent = source.parent.id === targetParent.id;
  const adjustedIndex = sameParent && source.index < targetIndex ? targetIndex - 1 : targetIndex;
  const nextIndex = Math.max(0, Math.min(adjustedIndex, targetParent.children.length));
  targetParent.children.splice(nextIndex, 0, node);
  return true;
}

/**
 * 深拷贝组件节点及其子树，所有节点生成新的 id。
 * 用于复制、粘贴、重复操作。
 */
export function cloneNodeTree(node: ComponentNode): ComponentNode {
  const cloned: ComponentNode = {
    id: uid(node.type),
    type: node.type,
    props: { ...node.props },
    style: { ...node.style },
    children: node.children.map((child) => cloneNodeTree(child)),
    events: Object.fromEntries(
      Object.entries(node.events).map(([key, actions]) => [key, actions.map((a) => ({ ...a }))]),
    ),
    locked: node.locked,
    hidden: node.hidden,
  };
  return cloned;
}

const MAX_DEPTH = 200;

export function validateSchema(value: unknown): value is PageSchema {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<PageSchema>;
  if (candidate.version !== 1 || typeof candidate.root !== 'object' || candidate.root === null) return false;
  return validateNode(candidate.root as unknown);
}

function validateNode(value: unknown, depth = 0): value is ComponentNode {
  if (depth > MAX_DEPTH) return false;
  if (typeof value !== 'object' || value === null) return false;
  const node = value as Partial<ComponentNode>;
  if (typeof node.id !== 'string' || !COMPONENT_TYPES.has(node.type as ComponentType)) return false;
  if (typeof node.props !== 'object' || node.props === null) return false;
  if (typeof node.style !== 'object' || node.style === null) return false;
  if (!Array.isArray(node.children)) return false;
  return node.children.every((child) => validateNode(child, depth + 1));
}
