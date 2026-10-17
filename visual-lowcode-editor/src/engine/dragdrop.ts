import type { ComponentNode, ComponentType, PageSchema } from '../core/schema';
import { createNode } from '../core/registry';
import { moveNode } from '../core/schema-utils';

export interface DropTarget {
  parentId: string;
  index: number;
}

interface DragPayload {
  kind: 'material' | 'node';
  type?: ComponentType;
  id?: string;
}

interface DragContext {
  payload: DragPayload;
  ghost: HTMLElement;
  indicator: HTMLElement;
  target: DropTarget | null;
}

interface PendingDrag {
  event: PointerEvent;
  payload: DragPayload;
}

interface DragDropOptions {
  getSchema: () => PageSchema;
  getSelectedId: () => string | null;
  getNode: (id: string) => ComponentNode | null;
  getParentId: (id: string) => string | null;
  getLocation: (id: string) => { parent: ComponentNode; index: number } | null;
  isAncestor: (ancestorId: string, nodeId: string) => boolean;
  onDrop: (node: ComponentNode | null, target: DropTarget, sourceId?: string) => void;
  onSelect: (id: string | null) => void;
}

interface Candidate {
  element: HTMLElement;
  node: ComponentNode;
  rect: DOMRect;
}

const DRAG_THRESHOLD = 6;
/** 画布边缘多少像素内触发自动滚动 */
const AUTO_SCROLL_EDGE = 40;
/** 自动滚动最大速度（像素/帧） */
const AUTO_SCROLL_MAX_SPEED = 16;

export class DragDropEngine {
  private context: DragContext | null = null;
  private pending: PendingDrag | null = null;
  private candidates: Candidate[] | null = null;
  private readonly candidateMap = new Map<string, Candidate>();
  private autoScrollRaf: number | null = null;
  private autoScrollVelocity = { x: 0, y: 0 };

  constructor(private readonly canvas: HTMLElement, private readonly options: DragDropOptions) {}

  startMaterialDrag(event: PointerEvent, type: ComponentType): void {
    if (event.button !== 0) return;
    this.beginPending(event, { kind: 'material', type });
  }

  private beginPending(event: PointerEvent, payload: DragPayload): void {
    this.cancelPendingListeners();
    this.pending = { event, payload };
    window.addEventListener('pointermove', this.handlePendingMove);
    window.addEventListener('pointerup', this.cancelPending, { once: true });
  }

  private handlePendingMove = (event: PointerEvent): void => {
    if (!this.pending) return;
    const start = this.pending.event;
    if (Math.hypot(event.clientX - start.clientX, event.clientY - start.clientY) < DRAG_THRESHOLD) return;
    const payload = this.pending.payload;
    this.pending = null;
    this.cancelPendingListeners();
    this.beginDrag(event, payload);
  };

  private cancelPendingListeners(): void {
    window.removeEventListener('pointermove', this.handlePendingMove);
    window.removeEventListener('pointerup', this.cancelPending);
  }

  private cancelPending = (): void => {
    this.pending = null;
    this.cancelPendingListeners();
  };

  startNodeDrag(event: PointerEvent, id: string): void {
    if (event.button !== 0 || event.detail > 1) return;
    if ((event.target as HTMLElement).isContentEditable) return;
    const node = this.options.getNode(id);
    if (node?.locked) return; // 锁定的节点不可拖动
    this.options.onSelect(id);
    this.beginPending(event, { kind: 'node', id });
  }

  private beginDrag(event: PointerEvent, payload: DragPayload): void {
    const ghost = document.createElement('div');
    ghost.className = 'lc-drag-ghost';
    ghost.textContent = payload.kind === 'material' ? '新增组件' : '移动组件';

    const indicator = document.createElement('div');
    indicator.className = 'lc-drop-indicator';

    document.body.append(ghost, indicator);
    document.body.classList.add('lc-dragging');

    this.context = {
      payload,
      ghost,
      indicator,
      target: null,
    };

    // 拖拽期间 DOM 与滚动位置稳定，候选矩形只测量一次，避免每帧触发布局计算。
    this.invalidateCandidates();
    window.addEventListener('scroll', this.invalidateCandidates, true);
    window.addEventListener('pointermove', this.handlePointerMove);
    window.addEventListener('pointerup', this.handlePointerUp, { once: true });
    window.addEventListener('keydown', this.handleKeyDown);
    this.updateDrag(event);
  }

  private readonly invalidateCandidates = (): void => {
    this.candidates = null;
    this.candidateMap.clear();
  };

  private handlePointerMove = (event: PointerEvent): void => {
    this.updateAutoScroll(event);
    this.updateDrag(event);
  };

  private handleKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') this.cancelDrag();
  };

  private updateDrag(event: PointerEvent): void {
    if (!this.context) return;
    this.context.ghost.style.transform = `translate(${event.clientX + 14}px, ${event.clientY + 14}px)`;

    // 拖出画布视口外不计算目标，指示器隐藏
    const canvasRect = this.canvas.getBoundingClientRect();
    const outOfBounds =
      event.clientX < canvasRect.left - 20 ||
      event.clientX > canvasRect.right + 20 ||
      event.clientY < canvasRect.top - 20 ||
      event.clientY > canvasRect.bottom + 20;

    if (outOfBounds) {
      this.context.target = null;
      this.context.indicator.classList.add('hidden');
      return;
    }

    const target = this.calculateTarget(event);
    this.context.target = target;
    this.renderIndicator(target);
  }

  // ============================================================
  // 自动滚动：拖拽到画布边缘时平滑滚动画布
  // ============================================================

  private updateAutoScroll(event: PointerEvent): void {
    const canvasRect = this.canvas.getBoundingClientRect();

    let vx = 0;
    let vy = 0;

    if (event.clientX < canvasRect.left + AUTO_SCROLL_EDGE) {
      const ratio = (canvasRect.left + AUTO_SCROLL_EDGE - event.clientX) / AUTO_SCROLL_EDGE;
      vx = -Math.min(ratio * AUTO_SCROLL_MAX_SPEED, AUTO_SCROLL_MAX_SPEED);
    } else if (event.clientX > canvasRect.right - AUTO_SCROLL_EDGE) {
      const ratio = (event.clientX - (canvasRect.right - AUTO_SCROLL_EDGE)) / AUTO_SCROLL_EDGE;
      vx = Math.min(ratio * AUTO_SCROLL_MAX_SPEED, AUTO_SCROLL_MAX_SPEED);
    }

    if (event.clientY < canvasRect.top + AUTO_SCROLL_EDGE) {
      const ratio = (canvasRect.top + AUTO_SCROLL_EDGE - event.clientY) / AUTO_SCROLL_EDGE;
      vy = -Math.min(ratio * AUTO_SCROLL_MAX_SPEED, AUTO_SCROLL_MAX_SPEED);
    } else if (event.clientY > canvasRect.bottom - AUTO_SCROLL_EDGE) {
      const ratio = (event.clientY - (canvasRect.bottom - AUTO_SCROLL_EDGE)) / AUTO_SCROLL_EDGE;
      vy = Math.min(ratio * AUTO_SCROLL_MAX_SPEED, AUTO_SCROLL_MAX_SPEED);
    }

    this.autoScrollVelocity = { x: vx, y: vy };

    if ((vx !== 0 || vy !== 0) && this.autoScrollRaf === null) {
      this.runAutoScroll();
    }
  }

  private runAutoScroll = (): void => {
    if (this.autoScrollVelocity.x === 0 && this.autoScrollVelocity.y === 0) {
      this.autoScrollRaf = null;
      return;
    }

    this.canvas.scrollLeft += this.autoScrollVelocity.x;
    this.canvas.scrollTop += this.autoScrollVelocity.y;

    // 滚动后候选矩形失效，下一帧重新计算
    this.invalidateCandidates();

    this.autoScrollRaf = requestAnimationFrame(this.runAutoScroll);
  };

  private stopAutoScroll(): void {
    if (this.autoScrollRaf !== null) {
      cancelAnimationFrame(this.autoScrollRaf);
      this.autoScrollRaf = null;
    }
    this.autoScrollVelocity = { x: 0, y: 0 };
  }

  private cancelDrag(): void {
    if (!this.context) return;
    const context = this.context;
    window.removeEventListener('pointermove', this.handlePointerMove);
    window.removeEventListener('scroll', this.invalidateCandidates, true);
    window.removeEventListener('pointerup', this.handlePointerUp);
    window.removeEventListener('keydown', this.handleKeyDown);
    context.ghost.remove();
    context.indicator.remove();
    document.body.classList.remove('lc-dragging');
    this.context = null;
    this.stopAutoScroll();
    this.invalidateCandidates();
  }

  // ============================================================
  // 候选收集 & 目标计算
  // ============================================================

  private getCandidates(): Candidate[] {
    if (this.candidates) return this.candidates;

    const root = this.options.getSchema().root;
    const candidates: Candidate[] = [];
    this.candidateMap.clear();

    // 用 TreeWalker 一次遍历收集所有带 data-node-id 的元素，
    // 替代递归 querySelector（节点多时性能提升明显）。
    const walker = document.createTreeWalker(this.canvas, NodeFilter.SHOW_ELEMENT, {
      acceptNode(node: Node): number {
        const el = node as HTMLElement;
        return el.dataset && el.dataset.nodeId ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
      },
    });

    const idToNode = new Map<string, ComponentNode>();
    const collectNode = (n: ComponentNode): void => {
      idToNode.set(n.id, n);
      n.children.forEach(collectNode);
    };
    collectNode(root);

    let current: Node | null = walker.currentNode;
    while ((current = walker.nextNode())) {
      const el = current as HTMLElement;
      const id = el.dataset.nodeId;
      if (!id) continue;
      const node = idToNode.get(id);
      if (!node) continue;
      const candidate: Candidate = { element: el, node, rect: el.getBoundingClientRect() };
      candidates.push(candidate);
      this.candidateMap.set(id, candidate);
    }

    // 面积从小到大排列，便于 find 先匹配到最深层（小的更具体）
    this.candidates = candidates.sort((a, b) => a.rect.width * a.rect.height - b.rect.width * b.rect.height);
    return this.candidates;
  }

  private calculateTarget(event: PointerEvent): DropTarget | null {
    const root = this.options.getSchema().root;
    const candidates = this.getCandidates();
    const rootCandidate = this.candidateMap.get(root.id);
    if (!rootCandidate || !this.insideRect(event.clientX, event.clientY, rootCandidate.rect)) return null;

    const deepest = candidates.find((candidate) => this.insideRect(event.clientX, event.clientY, candidate.rect));

    if (!deepest) {
      return this.isAllowedTargetParent(root.id) ? { parentId: root.id, index: root.children.length } : null;
    }

    // 容器类（container / form）可以作为拖入目标
    if (this.isContainer(deepest.node.type) && this.isAllowedTargetParent(deepest.node.id)) {
      const isHorizontal = deepest.node.style.flexDirection === 'row';
      const edgeDistance = isHorizontal
        ? Math.min(event.clientX - deepest.rect.left, deepest.rect.right - event.clientX)
        : Math.min(event.clientY - deepest.rect.top, deepest.rect.bottom - event.clientY);
      const childTarget = this.findChildIndex(deepest, event);
      const enteringChildEdge =
        childTarget && (childTarget.index === 0 || childTarget.index === deepest.node.children.length);

      if (deepest.node.children.length === 0 || (edgeDistance > 16 && !(enteringChildEdge && edgeDistance < 28))) {
        return childTarget ?? { parentId: deepest.node.id, index: deepest.node.children.length };
      }
    }

    if (deepest.node.id !== root.id) {
      const location = this.options.getLocation(deepest.node.id);
      if (location && this.isAllowedTargetParent(location.parent.id)) {
        const parent = location.parent;
        const isHorizontal = parent.style.flexDirection === 'row';
        const rect = deepest.rect;
        let before: boolean;
        if (isHorizontal) {
          before = event.clientX < rect.left + rect.width / 2;
        } else {
          before = event.clientY < rect.top + rect.height / 2;
        }
        return { parentId: location.parent.id, index: before ? location.index : location.index + 1 };
      }
    }

    return this.isAllowedTargetParent(root.id) ? { parentId: root.id, index: root.children.length } : null;
  }

  private findChildIndex(container: Candidate, event: PointerEvent): DropTarget | null {
    const isHorizontal = container.node.style.flexDirection === 'row';
    for (const childNode of container.node.children) {
      const child = this.candidateMap.get(childNode.id);
      if (!child) continue;
      const isBefore = isHorizontal
        ? event.clientX < child.rect.left + child.rect.width / 2
        : event.clientY < child.rect.top + child.rect.height / 2;
      if (isBefore) {
        const index = container.node.children.findIndex((node) => node.id === childNode.id);
        return { parentId: container.node.id, index };
      }
    }
    return null;
  }

  private isContainer(type: ComponentNode['type']): boolean {
    return type === 'container' || type === 'form';
  }

  private isAllowedTargetParent(parentId: string): boolean {
    if (!this.context) return false;
    const parent = this.options.getNode(parentId);
    const root = this.options.getSchema().root;
    if (!parent) return false;
    // 容器类和根节点可以作为拖入目标
    if (!this.isContainer(parent.type) && parent.id !== root.id) return false;
    if (this.context.payload.kind === 'node' && this.context.payload.id) {
      const sourceId = this.context.payload.id;
      if (sourceId === parentId) return false;
      const source = this.options.getNode(sourceId);
      return !!source && !this.options.isAncestor(sourceId, parentId);
    }
    return true;
  }

  private insideRect(x: number, y: number, rect: DOMRect): boolean {
    return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
  }

  private renderIndicator(target: DropTarget | null): void {
    if (!this.context) return;
    if (!target) {
      this.context.indicator.classList.add('hidden');
      return;
    }

    const parent = this.options.getNode(target.parentId);
    const parentCandidate = this.candidateMap.get(target.parentId);
    if (!parent || !parentCandidate) {
      this.context.indicator.classList.add('hidden');
      return;
    }

    const isHorizontal = parent.style.flexDirection === 'row';
    const indicator = this.context.indicator;
    indicator.classList.toggle('is-horizontal', isHorizontal);

    const child = parent.children[target.index];
    if (child) {
      const childCandidate = this.candidateMap.get(child.id);
      if (childCandidate) {
        const rect = childCandidate.rect;
        if (isHorizontal) {
          indicator.style.left = `${rect.left - 2}px`;
          indicator.style.top = `${rect.top + 2}px`;
          indicator.style.width = '3px';
          indicator.style.height = `${Math.max(rect.height - 4, 20)}px`;
        } else {
          indicator.style.left = `${rect.left + 2}px`;
          indicator.style.top = `${rect.top - 2}px`;
          indicator.style.width = `${Math.max(rect.width - 4, 20)}px`;
          indicator.style.height = '3px';
        }
        indicator.classList.remove('hidden');
        return;
      }
    }

    // 容器末尾
    const rect = parentCandidate.rect;
    if (isHorizontal) {
      indicator.style.left = `${rect.right - 6}px`;
      indicator.style.top = `${rect.top + 8}px`;
      indicator.style.width = '3px';
      indicator.style.height = `${Math.max(rect.height - 16, 20)}px`;
    } else {
      indicator.style.left = `${rect.left + 8}px`;
      indicator.style.top = `${rect.bottom - 6}px`;
      indicator.style.width = `${Math.max(rect.width - 16, 20)}px`;
      indicator.style.height = '3px';
    }
    indicator.classList.remove('hidden');
  }

  private handlePointerUp = (event: PointerEvent): void => {
    if (!this.context) return;
    const context = this.context;

    const target = this.calculateTarget(event);

    window.removeEventListener('pointermove', this.handlePointerMove);
    window.removeEventListener('scroll', this.invalidateCandidates, true);
    window.removeEventListener('keydown', this.handleKeyDown);
    context.ghost.remove();
    context.indicator.remove();
    document.body.classList.remove('lc-dragging');
    this.context = null;
    this.stopAutoScroll();
    this.invalidateCandidates();

    if (!target) return;

    if (context.payload.kind === 'material' && context.payload.type) {
      this.options.onDrop(createNode(context.payload.type), target);
    } else if (context.payload.kind === 'node' && context.payload.id) {
      const root = this.options.getSchema().root;
      if (moveNode(root, context.payload.id, target.parentId, target.index)) {
        this.options.onDrop(null, target, context.payload.id);
      }
    }
  };
}
