import type { PageSchema } from './schema';

export interface HistoryState {
  undoStack: PageSchema[];
  redoStack: PageSchema[];
  canUndo: boolean;
  canRedo: boolean;
}

const HISTORY_LIMIT = 80;

export class HistoryManager {
  readonly state: HistoryState;

  private snapshot: PageSchema;
  private transaction = 0;
  private readonly listeners = new Set<() => void>();

  constructor(private readonly schema: PageSchema) {
    this.snapshot = this.capture();
    this.state = {
      undoStack: [],
      redoStack: [],
      canUndo: false,
      canRedo: false,
    };
  }

  /**
   * 拍摄当前 schema 的深拷贝快照。
   * 优先使用 structuredClone（浏览器原生，速度快内存省），
   * 失败时回退到 JSON 序列化（保证 Proxy 包裹或特殊属性下也能工作）。
   */
  private capture(): PageSchema {
    try {
      return structuredClone(this.schema);
    } catch {
      return JSON.parse(JSON.stringify(this.schema)) as PageSchema;
    }
  }

  /**
   * 比较两个快照是否内容相同。
   * 用 JSON.stringify 做深度比较（结构化克隆对象无法用 ===）。
   * 只在 commit 时调用一次，用于跳过无实质变化的提交。
   */
  private isEqual(a: PageSchema, b: PageSchema): boolean {
    return JSON.stringify(a) === JSON.stringify(b);
  }

  private syncFlags(): void {
    this.state.canUndo = this.state.undoStack.length > 0;
    this.state.canRedo = this.state.redoStack.length > 0;
    this.listeners.forEach((listener) => listener());
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  begin(): void {
    this.transaction += 1;
  }

  commit(_label = '编辑'): void {
    if (this.transaction === 0) return;
    this.transaction -= 1;
    if (this.transaction > 0) return;

    const next = this.capture();
    if (this.isEqual(next, this.snapshot)) return;

    this.state.undoStack.push(this.snapshot);
    if (this.state.undoStack.length > HISTORY_LIMIT) this.state.undoStack.shift();
    this.state.redoStack.length = 0;
    this.snapshot = next;
    this.syncFlags();
  }

  run<T>(label: string, mutator: () => T): T {
    this.begin();
    try {
      return mutator();
    } finally {
      this.commit(label);
    }
  }

  undo(): void {
    const previous = this.state.undoStack.pop();
    if (!previous) return;
    this.state.redoStack.push(this.snapshot);
    this.snapshot = previous;
    this.restore(previous);
    this.syncFlags();
  }

  redo(): void {
    const next = this.state.redoStack.pop();
    if (!next) return;
    this.state.undoStack.push(this.snapshot);
    this.snapshot = next;
    this.restore(next);
    this.syncFlags();
  }

  reset(): void {
    this.transaction = 0;
    this.state.undoStack.length = 0;
    this.state.redoStack.length = 0;
    this.snapshot = this.capture();
    this.syncFlags();
  }

  private restore(snap: PageSchema): void {
    // 根节点原地替换：清空再 assign，保证引用不变（Proxy 能感知）
    const root = this.schema.root as unknown as Record<string, unknown>;
    Object.keys(root).forEach((key) => delete root[key]);
    Object.assign(root, snap.root);
    this.schema.version = snap.version;
    this.schema.customCode.headStyle = snap.customCode?.headStyle ?? '';
    this.schema.customCode.headScript = snap.customCode?.headScript ?? '';
    this.schema.customCode.bodyScript = snap.customCode?.bodyScript ?? '';
  }
}
