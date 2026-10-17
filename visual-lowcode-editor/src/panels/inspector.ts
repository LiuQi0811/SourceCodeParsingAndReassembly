import { getDefinition } from '../core/registry';
import { applyImageDataUrl, readImageAsDataUrl } from '../core/image-utils';
import { uid } from '../core/uid';
import type {
  ComponentAction,
  ComponentNode,
  InspectorField,
  PageSchema,
} from '../core/schema';

interface InspectorHandlers {
  onEditStart: () => void;
  onEditCommit: () => void;
  onDelete: () => void;
}

interface ActionTypeMeta {
  label: string;
  hasTarget: boolean;
  hasFormTarget: boolean;
}

const ACTION_TYPE_META: Record<string, ActionTypeMeta> = {
  show: { label: '显示', hasTarget: true, hasFormTarget: false },
  hide: { label: '隐藏', hasTarget: true, hasFormTarget: false },
  toggle: { label: '切换显示', hasTarget: true, hasFormTarget: false },
  setText: { label: '设置文本', hasTarget: true, hasFormTarget: false },
  setStyle: { label: '设置样式', hasTarget: true, hasFormTarget: false },
  scrollTo: { label: '滚动到', hasTarget: true, hasFormTarget: false },
  alert: { label: '弹窗提示', hasTarget: false, hasFormTarget: false },
  navigate: { label: '页面跳转', hasTarget: false, hasFormTarget: false },
  custom: { label: '自定义代码', hasTarget: false, hasFormTarget: false },
  submitForm: { label: '提交表单', hasTarget: false, hasFormTarget: true },
  resetForm: { label: '重置表单', hasTarget: false, hasFormTarget: true },
};

export class InspectorPanel {
  readonly element: HTMLElement;
  private readonly bodyElement: HTMLElement;
  private editing = false;

  constructor(
    private readonly getSchema: () => PageSchema,
    private readonly getSelectedId: () => string | null,
    private readonly getNode: (id: string) => ComponentNode | null,
    private readonly handlers: InspectorHandlers,
  ) {
    this.element = document.createElement('aside');
    this.element.className = 'panel inspector-panel';
    this.element.innerHTML = '<div class="panel-title">属性</div>';
    this.bodyElement = document.createElement('div');
    this.bodyElement.className = 'inspector-body';
    this.element.appendChild(this.bodyElement);
  }

  private getSelectedNode(): ComponentNode | null {
    const id = this.getSelectedId();
    if (!id) return null;
    return this.getNode(id);
  }

  render(force = false): void {
    if (!force && this.bodyElement.contains(document.activeElement)) return;
    const node = this.getSelectedNode();
    if (!node) {
      this.renderPageSettings();
      return;
    }

    const definition = getDefinition(node.type);
    this.bodyElement.innerHTML = `
      <div class="inspector-header">
        <div>
          <span class="inspector-type">${definition.label}</span>
          <small>${node.id}</small>
        </div>
        <button type="button" class="danger-button" data-action="delete">删除</button>
      </div>
      <div class="inspector-groups"></div>
    `;

    const groups = this.bodyElement.querySelector('.inspector-groups') as HTMLElement;
    const contentFields = definition.inspector.filter((field) => field.target === 'props');
    const styleFields = definition.inspector.filter((field) => field.target === 'style');
    if (contentFields.length > 0) groups.appendChild(this.createGroup('内容', node, contentFields));
    groups.appendChild(this.createGroup('常用样式', node, styleFields));

    if (definition.events.length > 0) {
      groups.appendChild(this.createEventsGroup(node, definition.events));
    }

    if (node.type === 'image') {
      this.attachImageUpload(node);
    }

    this.bodyElement.querySelector('[data-action="delete"]')?.addEventListener('click', () => this.handlers.onDelete());
  }

  // ==================== 页面设置 ====================

  private renderPageSettings(): void {
    const schema = this.getSchema();
    const pageTitle = schema.root.props.pageTitle ?? '';
    const { headStyle, headScript, bodyScript } = schema.customCode;

    this.bodyElement.innerHTML = `
      <div class="inspector-header">
        <div>
          <span class="inspector-type">页面设置</span>
          <small>全局配置</small>
        </div>
      </div>
      <div class="inspector-groups">
        <section class="inspector-group">
          <h3>基础</h3>
          <label class="field">
            <span>页面标题</span>
            <input type="text" data-field="pageTitle" value="${this.escapeAttr(pageTitle)}" placeholder="未命名页面" />
          </label>
        </section>
        <section class="inspector-group">
          <h3>自定义样式</h3>
          <label class="field">
            <span>注入 &lt;head&gt; 的 CSS</span>
            <textarea data-field="headStyle" rows="6" placeholder="/* 自定义样式 */">${this.escapeText(headStyle)}</textarea>
          </label>
        </section>
        <section class="inspector-group">
          <h3>头部脚本</h3>
          <label class="field">
            <span>注入 &lt;head&gt; 末尾的 JS</span>
            <textarea data-field="headScript" rows="6" placeholder="// 在页面加载初期执行">${this.escapeText(headScript)}</textarea>
          </label>
        </section>
        <section class="inspector-group">
          <h3>底部脚本</h3>
          <label class="field">
            <span>注入 &lt;/body&gt; 前的 JS</span>
            <textarea data-field="bodyScript" rows="6" placeholder="// 在 DOM 就绪后执行">${this.escapeText(bodyScript)}</textarea>
          </label>
        </section>
      </div>
    `;

    // 修正 headScript textarea 中多余的前缀
    const headScriptEl = this.bodyElement.querySelector('[data-field="headScript"]') as HTMLTextAreaElement;
    if (headScriptEl) headScriptEl.value = headScript;

    const pageTitleEl = this.bodyElement.querySelector('[data-field="pageTitle"]') as HTMLInputElement;
    const headStyleEl = this.bodyElement.querySelector('[data-field="headStyle"]') as HTMLTextAreaElement;
    const bodyScriptEl = this.bodyElement.querySelector('[data-field="bodyScript"]') as HTMLTextAreaElement;

    const bindInput = (el: HTMLElement | null, apply: (value: string) => void): void => {
      if (!el) return;
      el.addEventListener('focus', () => this.beginEdit());
      el.addEventListener('input', () => {
        const value = (el as HTMLInputElement | HTMLTextAreaElement).value;
        apply(value);
      });
      el.addEventListener('blur', () => this.commitEdit());
    };

    bindInput(pageTitleEl, (value) => {
      schema.root.props.pageTitle = value;
    });
    bindInput(headStyleEl, (value) => {
      schema.customCode.headStyle = value;
    });
    bindInput(headScriptEl, (value) => {
      schema.customCode.headScript = value;
    });
    bindInput(bodyScriptEl, (value) => {
      schema.customCode.bodyScript = value;
    });
  }

  // ==================== 交互分组 ====================

  private createEventsGroup(node: ComponentNode, events: Array<{ name: string; label: string }>): HTMLElement {
    const group = document.createElement('section');
    group.className = 'inspector-group';

    const heading = document.createElement('h3');
    heading.textContent = '交互';
    group.appendChild(heading);

    // 事件选择器
    const eventLabel = document.createElement('label');
    eventLabel.className = 'field';
    const eventTitle = document.createElement('span');
    eventTitle.textContent = '触发事件';
    const eventSelect = document.createElement('select');
    eventSelect.className = 'event-select';
    events.forEach((evt) => {
      const option = document.createElement('option');
      option.value = evt.name;
      option.textContent = evt.label;
      eventSelect.appendChild(option);
    });
    eventLabel.append(eventTitle, eventSelect);
    group.appendChild(eventLabel);

    // 动作列表容器
    const actionsContainer = document.createElement('div');
    actionsContainer.className = 'actions-container';
    group.appendChild(actionsContainer);

    // 添加动作按钮
    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'add-action-btn';
    addBtn.textContent = '+ 添加动作';
    group.appendChild(addBtn);

    // 动作类型选择菜单（默认隐藏）
    const actionPicker = document.createElement('div');
    actionPicker.className = 'action-picker hidden';
    Object.entries(ACTION_TYPE_META).forEach(([type, meta]) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'action-picker-item';
      btn.dataset.actionType = type;
      btn.textContent = meta.label;
      btn.addEventListener('click', () => {
        this.beginEdit();
        this.addAction(node, eventSelect.value, type as ComponentAction['type']);
        this.commitEdit();
        actionPicker.classList.add('hidden');
        this.renderActions(node, eventSelect.value, actionsContainer);
      });
      actionPicker.appendChild(btn);
    });
    group.appendChild(actionPicker);

    addBtn.addEventListener('click', () => {
      actionPicker.classList.toggle('hidden');
    });

    // 切换事件时重新渲染动作列表
    eventSelect.addEventListener('change', () => {
      this.renderActions(node, eventSelect.value, actionsContainer);
    });

    // 初始渲染第一个事件的动作列表
    if (events.length > 0) {
      this.renderActions(node, events[0].name, actionsContainer);
    }

    return group;
  }

  private renderActions(node: ComponentNode, eventName: string, container: HTMLElement): void {
    container.innerHTML = '';
    const actions = node.events[eventName] ?? [];

    if (actions.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'actions-empty';
      empty.textContent = '暂无动作，点击下方按钮添加';
      container.appendChild(empty);
      return;
    }

    actions.forEach((action) => {
      const actionItem = this.createActionItem(node, eventName, action);
      container.appendChild(actionItem);
    });
  }

  private createActionItem(node: ComponentNode, eventName: string, action: ComponentAction): HTMLElement {
    const item = document.createElement('div');
    item.className = 'action-item';

    // 动作头部：类型名 + 删除按钮
    const header = document.createElement('div');
    header.className = 'action-item-header';

    const typeLabel = document.createElement('span');
    typeLabel.className = 'action-type-label';
    typeLabel.textContent = ACTION_TYPE_META[action.type]?.label ?? action.type;
    header.appendChild(typeLabel);

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'action-delete-btn';
    deleteBtn.textContent = '×';
    deleteBtn.title = '删除动作';
    deleteBtn.addEventListener('click', () => {
      this.beginEdit();
      this.removeAction(node, eventName, action.id);
      this.commitEdit();
      // 重新渲染整个动作列表
      const container = item.parentElement;
      if (container) this.renderActions(node, eventName, container);
    });
    header.appendChild(deleteBtn);

    item.appendChild(header);

    // 动作参数表单
    const paramsForm = document.createElement('div');
    paramsForm.className = 'action-params';
    this.buildActionParamsForm(node, action, paramsForm);
    item.appendChild(paramsForm);

    return item;
  }

  private buildActionParamsForm(_node: ComponentNode, action: ComponentAction, form: HTMLElement): void {
    const meta = ACTION_TYPE_META[action.type];
    if (!meta) return;

    // targetId 字段
    if (meta.hasTarget) {
      const label = document.createElement('label');
      label.className = 'field';
      const title = document.createElement('span');
      title.textContent = '目标组件';
      const select = this.createTargetSelect(action.type === 'scrollTo' ? 'scrollTo' : 'target');
      const targetId = (action as { targetId?: string }).targetId ?? '';
      select.value = targetId;
      select.addEventListener('change', () => {
        this.beginEdit();
        (action as { targetId: string }).targetId = select.value;
        this.commitEdit();
      });
      label.append(title, select);
      form.appendChild(label);
    }

    // formId 字段
    if (meta.hasFormTarget) {
      const label = document.createElement('label');
      label.className = 'field';
      const title = document.createElement('span');
      title.textContent = '目标表单';
      const select = this.createTargetSelect('form');
      const formId = (action as { formId?: string }).formId ?? '';
      select.value = formId;
      select.addEventListener('change', () => {
        this.beginEdit();
        (action as { formId: string }).formId = select.value;
        this.commitEdit();
      });
      label.append(title, select);
      form.appendChild(label);
    }

    // setText: text
    if (action.type === 'setText') {
      const label = document.createElement('label');
      label.className = 'field';
      const title = document.createElement('span');
      title.textContent = '文本内容';
      const textarea = document.createElement('textarea');
      textarea.rows = 3;
      textarea.value = action.text;
      textarea.addEventListener('focus', () => this.beginEdit());
      textarea.addEventListener('input', () => {
        action.text = textarea.value;
      });
      textarea.addEventListener('blur', () => this.commitEdit());
      label.append(title, textarea);
      form.appendChild(label);
    }

    // setStyle: styleKey + styleValue
    if (action.type === 'setStyle') {
      const keyLabel = document.createElement('label');
      keyLabel.className = 'field';
      const keyTitle = document.createElement('span');
      keyTitle.textContent = '样式属性';
      const keyInput = document.createElement('input');
      keyInput.type = 'text';
      keyInput.value = action.styleKey;
      keyInput.placeholder = '如 color';
      keyInput.addEventListener('focus', () => this.beginEdit());
      keyInput.addEventListener('input', () => {
        action.styleKey = keyInput.value;
      });
      keyInput.addEventListener('blur', () => this.commitEdit());
      keyLabel.append(keyTitle, keyInput);
      form.appendChild(keyLabel);

      const valLabel = document.createElement('label');
      valLabel.className = 'field';
      const valTitle = document.createElement('span');
      valTitle.textContent = '样式值';
      const valInput = document.createElement('input');
      valInput.type = 'text';
      valInput.value = action.styleValue;
      valInput.placeholder = '如 red';
      valInput.addEventListener('focus', () => this.beginEdit());
      valInput.addEventListener('input', () => {
        action.styleValue = valInput.value;
      });
      valInput.addEventListener('blur', () => this.commitEdit());
      valLabel.append(valTitle, valInput);
      form.appendChild(valLabel);
    }

    // alert: message
    if (action.type === 'alert') {
      const label = document.createElement('label');
      label.className = 'field';
      const title = document.createElement('span');
      title.textContent = '提示消息';
      const textarea = document.createElement('textarea');
      textarea.rows = 3;
      textarea.value = action.message;
      textarea.addEventListener('focus', () => this.beginEdit());
      textarea.addEventListener('input', () => {
        action.message = textarea.value;
      });
      textarea.addEventListener('blur', () => this.commitEdit());
      label.append(title, textarea);
      form.appendChild(label);
    }

    // navigate: url + openInNewTab
    if (action.type === 'navigate') {
      const urlLabel = document.createElement('label');
      urlLabel.className = 'field';
      const urlTitle = document.createElement('span');
      urlTitle.textContent = '跳转地址';
      const urlInput = document.createElement('input');
      urlInput.type = 'text';
      urlInput.value = action.url;
      urlInput.placeholder = 'https://';
      urlInput.addEventListener('focus', () => this.beginEdit());
      urlInput.addEventListener('input', () => {
        action.url = urlInput.value;
      });
      urlInput.addEventListener('blur', () => this.commitEdit());
      urlLabel.append(urlTitle, urlInput);
      form.appendChild(urlLabel);

      const tabLabel = document.createElement('label');
      tabLabel.className = 'field';
      const tabTitle = document.createElement('span');
      tabTitle.textContent = '打开方式';
      const tabSelect = document.createElement('select');
      const currentOpt = document.createElement('option');
      currentOpt.value = 'false';
      currentOpt.textContent = '当前页';
      const newOpt = document.createElement('option');
      newOpt.value = 'true';
      newOpt.textContent = '新标签';
      tabSelect.append(currentOpt, newOpt);
      tabSelect.value = action.openInNewTab;
      tabSelect.addEventListener('change', () => {
        this.beginEdit();
        action.openInNewTab = tabSelect.value;
        this.commitEdit();
      });
      tabLabel.append(tabTitle, tabSelect);
      form.appendChild(tabLabel);
    }

    // custom: code
    if (action.type === 'custom') {
      const label = document.createElement('label');
      label.className = 'field';
      const title = document.createElement('span');
      title.textContent = '代码内容';
      const textarea = document.createElement('textarea');
      textarea.rows = 6;
      textarea.value = action.code;
      textarea.placeholder = '// 自定义 JavaScript 代码';
      textarea.style.fontFamily = 'monospace';
      textarea.addEventListener('focus', () => this.beginEdit());
      textarea.addEventListener('input', () => {
        action.code = textarea.value;
      });
      textarea.addEventListener('blur', () => this.commitEdit());
      label.append(title, textarea);
      form.appendChild(label);
    }

    // submitForm: successMessage
    if (action.type === 'submitForm') {
      const label = document.createElement('label');
      label.className = 'field';
      const title = document.createElement('span');
      title.textContent = '成功提示';
      const input = document.createElement('input');
      input.type = 'text';
      input.value = action.successMessage;
      input.placeholder = '提交成功！';
      input.addEventListener('focus', () => this.beginEdit());
      input.addEventListener('input', () => {
        action.successMessage = input.value;
      });
      input.addEventListener('blur', () => this.commitEdit());
      label.append(title, input);
      form.appendChild(label);
    }
  }

  private createTargetSelect(kind: 'target' | 'form' | 'scrollTo'): HTMLSelectElement {
    const select = document.createElement('select');
    const empty = document.createElement('option');
    empty.value = '';
    empty.textContent = '请选择';
    select.appendChild(empty);

    const schema = this.getSchema();
    const nodes = kind === 'form' ? this.collectFormNodes(schema.root) : this.collectAllNodes(schema.root);
    nodes.forEach((n) => {
      const def = getDefinition(n.type);
      const option = document.createElement('option');
      option.value = n.id;
      option.textContent = `${def.label} - ${n.id}`;
      select.appendChild(option);
    });

    return select;
  }

  private collectAllNodes(root: ComponentNode): ComponentNode[] {
    const result: ComponentNode[] = [];
    const walk = (node: ComponentNode): void => {
      result.push(node);
      node.children.forEach(walk);
    };
    walk(root);
    return result;
  }

  private collectFormNodes(root: ComponentNode): ComponentNode[] {
    return this.collectAllNodes(root).filter((n) => n.type === 'form');
  }

  private addAction(node: ComponentNode, eventName: string, type: ComponentAction['type']): void {
    if (!node.events[eventName]) {
      node.events[eventName] = [];
    }

    const id = uid('action');
    let newAction: ComponentAction;

    switch (type) {
      case 'show':
      case 'hide':
      case 'toggle':
      case 'scrollTo':
        newAction = { id, type, targetId: '' } as ComponentAction;
        break;
      case 'setText':
        newAction = { id, type, targetId: '', text: '' } as ComponentAction;
        break;
      case 'setStyle':
        newAction = { id, type, targetId: '', styleKey: '', styleValue: '' } as ComponentAction;
        break;
      case 'alert':
        newAction = { id, type, message: '' } as ComponentAction;
        break;
      case 'navigate':
        newAction = { id, type, url: '', openInNewTab: 'false' } as ComponentAction;
        break;
      case 'custom':
        newAction = { id, type, code: '' } as ComponentAction;
        break;
      case 'submitForm':
        newAction = { id, type, formId: '', successMessage: '' } as ComponentAction;
        break;
      case 'resetForm':
        newAction = { id, type, formId: '' } as ComponentAction;
        break;
      default:
        return;
    }

    node.events[eventName].push(newAction);
  }

  private removeAction(node: ComponentNode, eventName: string, actionId: string): void {
    const actions = node.events[eventName];
    if (!actions) return;
    const index = actions.findIndex((a) => a.id === actionId);
    if (index >= 0) {
      actions.splice(index, 1);
    }
  }

  // ==================== 原有功能 ====================

  private attachImageUpload(node: ComponentNode): void {
    const section = document.createElement('section');
    section.className = 'inspector-group';
    const heading = document.createElement('h3');
    heading.textContent = '图片来源';
    section.appendChild(heading);

    const row = document.createElement('div');
    row.className = 'image-upload-row';

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'image-upload-btn';
    button.textContent = '上传本地图片';
    button.addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.addEventListener('change', () => {
        const file = input.files?.[0];
        if (!file) return;
        this.beginEdit();
        readImageAsDataUrl(file)
          .then((dataUrl) => {
            applyImageDataUrl(node, dataUrl);
          })
          .finally(() => {
            this.commitEdit();
          });
      });
      input.click();
    });

    const hint = document.createElement('small');
    hint.className = 'upload-hint';
    hint.textContent = '支持 JPG / PNG / SVG / GIF 等，将以内联方式保存';

    row.append(button, hint);
    section.appendChild(row);

    const groupsEl = this.bodyElement.querySelector('.inspector-groups');
    if (groupsEl && groupsEl.firstChild) {
      groupsEl.insertBefore(section, groupsEl.firstChild);
    } else if (groupsEl) {
      groupsEl.appendChild(section);
    }
  }

  private beginEdit(): void {
    if (this.editing) return;
    this.editing = true;
    this.handlers.onEditStart();
  }

  private commitEdit(): void {
    if (!this.editing) return;
    this.editing = false;
    this.handlers.onEditCommit();
  }

  private createGroup(title: string, node: ComponentNode, fields: InspectorField[]): HTMLElement {
    const group = document.createElement('section');
    group.className = 'inspector-group';
    const heading = document.createElement('h3');
    heading.textContent = title;
    group.appendChild(heading);

    fields.forEach((field) => {
      const label = document.createElement('label');
      label.className = 'field';
      const titleElement = document.createElement('span');
      titleElement.textContent = field.label;
      label.appendChild(titleElement);

      const input = this.createInput(node, field);
      label.appendChild(input);
      group.appendChild(label);
    });

    return group;
  }

  private createInput(node: ComponentNode, field: InspectorField): HTMLElement {
    const value = node[field.target][field.key] ?? '';

    if (field.kind === 'textarea') {
      const textarea = document.createElement('textarea');
      textarea.value = value;
      textarea.rows = 4;
      textarea.placeholder = field.placeholder ?? '';
      textarea.addEventListener('focus', () => this.beginEdit());
      textarea.addEventListener('input', () => {
        node[field.target][field.key] = textarea.value;
      });
      textarea.addEventListener('blur', () => this.commitEdit());
      return textarea;
    }

    if (field.kind === 'select') {
      const select = document.createElement('select');
      const empty = document.createElement('option');
      empty.value = '';
      empty.textContent = '默认';
      select.appendChild(empty);
      field.options?.forEach((option) => {
        const optionElement = document.createElement('option');
        optionElement.value = option.value;
        optionElement.textContent = option.label;
        if (option.value === value) optionElement.selected = true;
        select.appendChild(optionElement);
      });
      select.addEventListener('change', () => {
        this.beginEdit();
        node[field.target][field.key] = select.value;
        this.commitEdit();
      });
      return select;
    }

    if (field.kind === 'color') {
      const wrapper = document.createElement('span');
      wrapper.className = 'color-field';
      const color = document.createElement('input');
      color.type = 'color';
      color.value = this.normalizeColor(value);
      const text = document.createElement('input');
      text.type = 'text';
      text.value = value;
      text.placeholder = '#000000';
      color.addEventListener('focus', () => this.beginEdit());
      color.addEventListener('input', () => {
        node[field.target][field.key] = color.value;
        text.value = color.value;
      });
      color.addEventListener('change', () => this.commitEdit());
      text.addEventListener('focus', () => this.beginEdit());
      text.addEventListener('input', () => {
        node[field.target][field.key] = text.value;
      });
      text.addEventListener('blur', () => this.commitEdit());
      wrapper.append(color, text);
      return wrapper;
    }

    const input = document.createElement('input');
    input.type = field.kind === 'number' ? 'number' : 'text';
    input.value = value;
    input.placeholder = field.placeholder ?? '';
    if (field.kind === 'number') {
      if (field.min !== undefined) input.min = String(field.min);
      if (field.max !== undefined) input.max = String(field.max);
      if (field.step !== undefined) input.step = String(field.step);
    }
    input.addEventListener('focus', () => this.beginEdit());
    input.addEventListener('input', () => {
      node[field.target][field.key] = input.value;
    });
    input.addEventListener('blur', () => this.commitEdit());
    return input;
  }

  private normalizeColor(value: string): string {
    if (/^#[0-9a-f]{6}$/i.test(value)) return value;
    return '#000000';
  }

  private escapeAttr(value: string): string {
    return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  }

  private escapeText(value: string): string {
    return value.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  }
}
