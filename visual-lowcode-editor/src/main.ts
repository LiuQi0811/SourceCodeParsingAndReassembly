import { HistoryManager } from './core/history';
import { createInitialSchema } from './core/initial-schema';
import { createStore } from './core/store';
import { NodeIndex } from './core/node-index';
import type { ComponentNode, ComponentType, PageSchema } from './core/schema';
import { createNode } from './core/registry';
import { insertNode, moveNode, removeNode, cloneNodeTree } from './core/schema-utils';
import { DragDropEngine, type DropTarget } from './engine/dragdrop';
import { CanvasPanel } from './panels/canvas';
import { InspectorPanel } from './panels/inspector';
import { LayersPanel } from './panels/layers';
import { MaterialPanel } from './panels/material';
import { Toolbar, type DeviceWidth } from './panels/toolbar';
import { loadSchema, parseSchemaFile, saveSchema, downloadJson } from './features/persistence';
import { downloadHtml } from './features/export';
import { PreviewManager } from './features/preview';

interface EditorUiState {
  selectedId: string | null;
  hoveredId: string | null;
  previewing: boolean;
  device: DeviceWidth;
  historyTick: number;
}

export function initApp(): void {
  const rootElement = document.getElementById('app');
  if (!rootElement) return;

  const pageStore = createStore<PageSchema>(loadSchema() ?? createInitialSchema());
  const schema = pageStore.state;
  const history = new HistoryManager(schema);
  const nodeIndex = new NodeIndex();
  const rebuildIndex = (): void => nodeIndex.rebuild(schema.root);
  const uiStore = createStore<EditorUiState>({
    selectedId: null,
    hoveredId: null,
    previewing: false,
    device: 'pc',
    historyTick: 0,
  });
  const ui = uiStore.state;

  const editorElement = document.createElement('div');
  editorElement.className = 'editor-shell';
  rootElement.appendChild(editorElement);

  const toolbar = new Toolbar(
    {
      canUndo: history.state.canUndo,
      canRedo: history.state.canRedo,
      previewing: false,
      device: 'pc',
    },
    {
      onUndo: () => history.undo(),
      onRedo: () => history.redo(),
      onTogglePreview: togglePreview,
      onImport: importJson,
      onExportHtml: () => downloadHtml(schema),
      onClear: clearCanvas,
      onDevice: (device) => {
        ui.device = device;
      },
    },
  );

  const workspaceElement = document.createElement('main');
  workspaceElement.className = 'workspace';
  const leftPanel = document.createElement('div');
  leftPanel.className = 'left-rail panel';
  const canvasPanel = new CanvasPanel(
    () => schema,
    () => ui.selectedId,
    () => ui.hoveredId,
    (id) => nodeIndex.getNode(id),
    (id) => nodeIndex.getLocation(id),
    () => clipboardData !== null,
    {
      onSelect: (id) => selectNode(id),
      onHover: (id) => {
        ui.hoveredId = id;
      },
      onNodePointerDown: (event, id) => dragDrop.startNodeDrag(event, id),
      onTextCommit: commitText,
      onCopy: copyNode,
      onPaste: pasteAfterNode,
      onMoveUp: moveNodeUp,
      onMoveDown: moveNodeDown,
      onToggleLock: toggleNodeLock,
      onToggleHidden: toggleNodeHidden,
      onDelete: deleteNode,
    },
  );
  const rightPanel = document.createElement('aside');
  rightPanel.className = 'right-rail panel';

  const materialPanel = new MaterialPanel(
    (event, type) => dragDrop.startMaterialDrag(event, type),
    (type) => addComponent(type),
  );
  const layersPanel = new LayersPanel(
    () => schema,
    () => ui.selectedId,
    {
      onSelect: (id) => selectNode(id),
      onMove: moveLayer,
    },
  );
  leftPanel.append(materialPanel.element, layersPanel.element);

  const inspector = new InspectorPanel(
    () => schema,
    () => ui.selectedId,
    (id) => nodeIndex.getNode(id),
    {
      onEditStart: () => history.begin(),
      onEditCommit: () => history.commit('修改属性'),
      onDelete: deleteSelected,
    },
  );

  const exportJsonButton = document.createElement('button');
  exportJsonButton.type = 'button';
  exportJsonButton.className = 'sidebar-export-json';
  exportJsonButton.textContent = '导出 JSON';
  exportJsonButton.addEventListener('click', () => downloadJson(schema));

  rightPanel.append(inspector.element, exportJsonButton);

  const canvasFrame = document.createElement('section');
  canvasFrame.className = 'canvas-frame';
  const previewContainer = document.createElement('div');
  previewContainer.className = 'preview-container hidden';
  const preview = new PreviewManager(previewContainer);

  canvasFrame.append(canvasPanel.element, previewContainer);
  workspaceElement.append(leftPanel, canvasFrame, rightPanel);
  editorElement.append(toolbar.element, workspaceElement);

  const dragDrop = new DragDropEngine(canvasPanel.element, {
    getSchema: () => schema,
    getSelectedId: () => ui.selectedId,
    getNode: (id) => nodeIndex.getNode(id),
    getParentId: (id) => nodeIndex.getParentId(id),
    getLocation: (id) => nodeIndex.getLocation(id),
    isAncestor: (a, b) => nodeIndex.isAncestor(a, b),
    onSelect: (id) => selectNode(id),
    onDrop: handleDrop,
  });

  function renderAll(): void {
    canvasPanel.render();
    layersPanel.render();
    inspector.render();
    if (ui.previewing) preview.update(schema);
  }

  // 图层树只依赖节点结构，纯 props/style 编辑（如输入文案）无需重建图层。
  const isPropertyEdit = (path: string): boolean => /\.(?:props|style)\./.test(path);

  function renderFromSchemaChange(changedPath: string): void {
    canvasPanel.render();
    const structureChanged = changedPath
      .split(',')
      .some((path) => path !== '' && !isPropertyEdit(path));
    if (structureChanged) layersPanel.render();
    if (ui.previewing) preview.requestUpdate(schema);
  }

  function selectNode(id: string | null): void {
    ui.selectedId = id;
    if (id && !nodeIndex.has(id)) ui.selectedId = null;
  }

  function handleDrop(node: ComponentNode | null, target: DropTarget, sourceId?: string): void {
    history.begin();
    if (node) {
      insertNode(schema.root, node, target.parentId, target.index);
      ui.selectedId = node.id;
    } else if (sourceId) {
      moveNode(schema.root, sourceId, target.parentId, target.index);
      ui.selectedId = sourceId;
    }
    history.commit(node ? '添加组件' : '移动组件');
  }

  function addComponent(type: ComponentType): void {
    const node = createNode(type);
    history.run('添加组件', () => {
      const selected = ui.selectedId ? nodeIndex.getNode(ui.selectedId) : null;
      const parentId = selected?.type === 'container' ? selected.id : schema.root.id;
      const parent = nodeIndex.getNode(parentId) ?? schema.root;
      insertNode(schema.root, node, parent.id, parent.children.length);
      ui.selectedId = node.id;
    });
  }

  function deleteSelected(): void {
    const id = ui.selectedId;
    if (!id || id === schema.root.id) return;
    const node = nodeIndex.getNode(id);
    if (!node || node.locked) return; // 锁定的节点不可删除
    history.run('删除组件', () => {
      removeNode(schema.root, id);
      selectNode(null);
    });
  }

  function deleteNode(id: string): void {
    if (!id || id === schema.root.id) return;
    const node = nodeIndex.getNode(id);
    if (!node || node.locked) return;
    history.run('删除组件', () => {
      removeNode(schema.root, id);
      if (ui.selectedId === id) selectNode(null);
    });
  }

  function copyNode(id: string): void {
    if (!id || id === schema.root.id) return;
    const node = nodeIndex.getNode(id);
    if (!node) return;
    clipboardData = JSON.stringify(node);
  }

  function pasteAfterNode(targetId: string): void {
    if (!clipboardData) return;
    const source = JSON.parse(clipboardData) as ComponentNode;
    const clone = cloneNodeTree(source);

    history.run('粘贴组件', () => {
      const location = nodeIndex.getLocation(targetId);
      let parentId = schema.root.id;
      let insertIndex = schema.root.children.length;

      if (location) {
        parentId = location.parent.id;
        insertIndex = location.index + 1;
      }

      insertNode(schema.root, clone, parentId, insertIndex);
      ui.selectedId = clone.id;
    });
  }

  function moveNodeUp(id: string): void {
    const location = nodeIndex.getLocation(id);
    if (!location || location.index === 0) return;
    history.run('上移组件', () => {
      moveNode(schema.root, id, location.parent.id, location.index - 1);
      ui.selectedId = id;
    });
  }

  function moveNodeDown(id: string): void {
    const location = nodeIndex.getLocation(id);
    if (!location || location.index >= location.parent.children.length - 1) return;
    history.run('下移组件', () => {
      moveNode(schema.root, id, location.parent.id, location.index + 1);
      ui.selectedId = id;
    });
  }

  function toggleNodeLock(id: string): void {
    const node = nodeIndex.getNode(id);
    if (!node || id === schema.root.id) return;
    history.run(node.locked ? '解锁组件' : '锁定组件', () => {
      node.locked = !node.locked;
    });
  }

  function toggleNodeHidden(id: string): void {
    const node = nodeIndex.getNode(id);
    if (!node || id === schema.root.id) return;
    history.run(node.hidden ? '显示组件' : '隐藏组件', () => {
      node.hidden = !node.hidden;
    });
  }

  function commitText(id: string, text: string): void {
    const node = nodeIndex.getNode(id);
    if (!node) return;
    history.run('编辑文案', () => {
      node.props.text = text;
    });
  }

  function moveLayer(id: string, direction: -1 | 1): void {
    history.run('调整图层顺序', () => {
      const location = nodeIndex.getLocation(id);
      if (!location) return;
      const nextIndex = location.index + direction;
      if (nextIndex < 0 || nextIndex >= location.parent.children.length) return;
      const [node] = location.parent.children.splice(location.index, 1);
      location.parent.children.splice(nextIndex, 0, node);
      ui.selectedId = id;
    });
  }

  // 剪贴板：存储序列化后的节点快照，粘贴时反序列化并生成新 id。
  let clipboardData: string | null = null;

  function copySelected(): void {
    const id = ui.selectedId;
    if (!id || id === schema.root.id) return;
    const node = nodeIndex.getNode(id);
    if (!node) return;
    clipboardData = JSON.stringify(node);
  }

  function pasteNode(): void {
    if (!clipboardData) return;
    const source = JSON.parse(clipboardData) as ComponentNode;
    const clone = cloneNodeTree(source);

    history.run('粘贴组件', () => {
      const selectedId = ui.selectedId;
      let parentId = schema.root.id;
      let insertIndex = schema.root.children.length;

      if (selectedId) {
        const location = nodeIndex.getLocation(selectedId);
        if (location) {
          parentId = location.parent.id;
          insertIndex = location.index + 1;
        }
      }

      insertNode(schema.root, clone, parentId, insertIndex);
      ui.selectedId = clone.id;
    });
  }

  function duplicateSelected(): void {
    const id = ui.selectedId;
    if (!id || id === schema.root.id) return;
    const node = nodeIndex.getNode(id);
    if (!node) return;
    const clone = cloneNodeTree(node);
    const location = nodeIndex.getLocation(id);
    if (!location) return;

    history.run('重复组件', () => {
      insertNode(schema.root, clone, location.parent.id, location.index + 1);
      ui.selectedId = clone.id;
    });
  }

  function clearCanvas(): void {
    if (!window.confirm('确定清空当前画布吗？此操作可以撤销。')) return;
    history.run('清空画布', () => {
      schema.root.children.length = 0;
      selectNode(null);
    });
  }

  function togglePreview(): void {
    ui.previewing = !ui.previewing;
    if (ui.previewing) {
      preview.update(schema);
      preview.show();
      canvasPanel.element.classList.add('hidden');
    } else {
      preview.hide();
      canvasPanel.element.classList.remove('hidden');
    }
  }

  function importJson(file: File): void {
    parseSchemaFile(file)
      .then((nextSchema) => {
        history.run('导入 JSON', () => {
          schema.version = nextSchema.version;
          schema.root.id = nextSchema.root.id;
          schema.root.type = nextSchema.root.type;
          schema.root.props = nextSchema.root.props;
          schema.root.style = nextSchema.root.style;
          schema.root.children = nextSchema.root.children;
          selectNode(null);
        });
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : '未知错误';
        window.alert(`导入失败：${message}`);
      });
  }

  let saveTimer: number | undefined;
  pageStore.subscribe((_, changedPath) => {
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => saveSchema(schema), 300);

    const paths = changedPath.split(',');
    const structureChanged = paths.some((path) => path !== '' && !isPropertyEdit(path));
    if (structureChanged) rebuildIndex();

    renderFromSchemaChange(changedPath);
  });

  history.subscribe(() => {
    rebuildIndex();
    ui.historyTick += 1;
    if (ui.selectedId && !nodeIndex.has(ui.selectedId)) selectNode(null);
    toolbar.setState({
      canUndo: history.state.canUndo,
      canRedo: history.state.canRedo,
    });
  });

  // Proxy-based UI store subscriptions keep each panel synchronized through one render boundary.
  uiStore.subscribe((_, changedPath) => {
    if (changedPath.includes('historyTick')) {
      inspector.render();
      return;
    }
    if (changedPath.includes('hoveredId')) {
      canvasPanel.renderHighlight();
    }
    if (changedPath.includes('selectedId')) {
      canvasPanel.render();
      layersPanel.render();
      inspector.render(true);
    }
    if (changedPath.includes('previewing')) {
      toolbar.setState({ previewing: ui.previewing });
    }
    if (changedPath.includes('device')) {
      document.documentElement.dataset.device = ui.device;
      toolbar.setState({ device: ui.device });
    }
  });

  window.addEventListener('keydown', (event) => {
    const target = event.target as HTMLElement | null;
    // 焦点在输入控件或可编辑文本内时，交给浏览器处理原生编辑行为（退格、撤销等）。
    const typing = !!target && (
      target.isContentEditable
      || target.tagName === 'INPUT'
      || target.tagName === 'TEXTAREA'
      || target.tagName === 'SELECT'
    );
    if (typing) return;

    const key = event.key.toLowerCase();
    const mod = event.ctrlKey || event.metaKey;

    if (mod && key === 'z') {
      event.preventDefault();
      if (event.shiftKey) history.redo();
      else history.undo();
    }
    if (mod && key === 'y') {
      event.preventDefault();
      history.redo();
    }
    if (mod && key === 'c') {
      event.preventDefault();
      copySelected();
    }
    if (mod && key === 'v') {
      event.preventDefault();
      pasteNode();
    }
    if (mod && key === 'd') {
      event.preventDefault();
      duplicateSelected();
    }
    if (!mod && (event.key === 'Delete' || event.key === 'Backspace')) {
      event.preventDefault();
      deleteSelected();
    }
    if (event.key === 'Escape') {
      selectNode(null);
    }
  });

  document.documentElement.dataset.device = 'pc';
  history.reset();
  renderAll();
}

