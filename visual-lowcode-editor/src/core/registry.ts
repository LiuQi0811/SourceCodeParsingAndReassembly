import type {
  ComponentDefinition,
  ComponentNode,
  ComponentStyle,
  ComponentType,
  RenderMode,
} from './schema';
import { uid } from './uid';

const defaultImage = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360"><rect width="640" height="360" fill="#e8edf3"/><circle cx="190" cy="125" r="42" fill="#b7c3d1"/><path d="M90 300l155-135 105 92 72-62 128 105H90z" fill="#aebdcc"/><path d="M270 300l102-86 80 70 62-48 70 64H270z" fill="#91a3b5"/><text x="320" y="188" text-anchor="middle" font-family="Arial,sans-serif" font-size="24" fill="#667485">图片</text></svg>',
)}`;

const fontFamily = '-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif';

const BLOCKED_HREF_SCHEME = /^\s*(?:javascript|data|vbscript|file)\s*:/i;

// 导入的 Schema 可能包含危险协议，导出前统一收敛为安全值。
export function safeHref(value: string): string {
  const trimmed = value.trim();
  if (!trimmed || BLOCKED_HREF_SCHEME.test(trimmed)) return '#';
  return trimmed;
}

function createElement<K extends keyof HTMLElementTagNameMap>(tag: K): HTMLElementTagNameMap[K] {
  return document.createElement(tag);
}

function applyCommon(element: HTMLElement, node: ComponentNode, mode: RenderMode): void {
  const style: ComponentStyle = { ...node.style };
  if (mode === 'editor') {
    element.dataset.nodeId = node.id;
    element.dataset.nodeType = node.type;
    element.classList.add('lc-node');
    style.outline = 'none';
    style.position = style.position ?? 'relative';
    style.boxSizing = 'border-box';
    style.fontFamily = style.fontFamily ?? fontFamily;
    if (getDefinition(node.type).editableText) {
      element.contentEditable = 'false';
      element.spellcheck = false;
      element.dataset.textEditable = 'true';
    }
  }

  Object.entries(style).forEach(([key, value]) => {
    if (value !== undefined && value !== '') {
      element.style.setProperty(key.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`), value);
    }
  });
}

function appendChildren(element: HTMLElement, children?: DocumentFragment): void {
  if (children) element.appendChild(children);
}

function renderText(tag: 'h1' | 'p' | 'button' | 'a', node: ComponentNode, mode: RenderMode, children?: DocumentFragment): HTMLElement {
  const element = createElement(tag);
  element.textContent = node.props.text ?? '';
  applyCommon(element, node, mode);

  if (tag === 'a') {
    element.setAttribute('href', mode === 'export' ? safeHref(node.props.href ?? '') : '#');
    if (mode === 'export') element.setAttribute('target', '_blank');
    element.setAttribute('rel', 'noopener noreferrer');
  }

  if (element instanceof HTMLButtonElement) element.type = 'button';
  if (mode === 'editor') {
    element.contentEditable = 'true';
    element.spellcheck = false;
    element.dataset.textEditable = 'true';
  }
  appendChildren(element, children);
  return element;
}

const definitions: Record<ComponentType, ComponentDefinition> = {
  container: {
    type: 'container',
    label: '容器',
    description: '可嵌套的布局区块',
    icon: '<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 4v16M16 4v16M4 12h16"/></svg>',
    canHaveChildren: true,
    editableText: false,
    defaultProps: {},
    defaultEvents: {},
    defaultStyle: {
      width: '100%',
      minHeight: '120px',
      padding: '16px',
      margin: '0 0 12px',
      backgroundColor: '#f8fafc',
      borderRadius: '10px',
      border: '1px dashed #cbd5e1',
      display: 'flex',
      flexDirection: 'column',
    },
    inspector: [
      { target: 'style', key: 'width', label: '宽度', kind: 'text', placeholder: '100% 或 320px' },
      { target: 'style', key: 'minHeight', label: '最小高度', kind: 'text', placeholder: '120px' },
      { target: 'style', key: 'padding', label: '内边距', kind: 'text', placeholder: '16px' },
      { target: 'style', key: 'margin', label: '外边距', kind: 'text', placeholder: '0 0 12px' },
      { target: 'style', key: 'backgroundColor', label: '背景色', kind: 'color' },
      { target: 'style', key: 'borderRadius', label: '圆角', kind: 'text', placeholder: '10px' },
    ],
    events: [{ name: 'click', label: '点击' }],
    render: (node, mode, children) => {
      const element = createElement('div');
      applyCommon(element, node, mode);
      if (mode === 'editor') element.dataset.dropContainer = 'true';
      appendChildren(element, children);
      return element;
    },
  },
  heading: {
    type: 'heading',
    label: '标题',
    description: '页面主标题',
    icon: '<svg viewBox="0 0 24 24"><path d="M6 4v16M18 4v16M5 12h14"/></svg>',
    canHaveChildren: false,
    editableText: true,
    defaultProps: { text: '标题文字' },
    defaultEvents: {},
    defaultStyle: {
      width: '100%',
      margin: '0 0 12px',
      fontSize: '30px',
      fontWeight: '700',
      lineHeight: '1.3',
      color: '#111827',
    },
    inspector: [
      { target: 'props', key: 'text', label: '标题文案', kind: 'textarea' },
      { target: 'style', key: 'textAlign', label: '对齐', kind: 'select', options: [
        { label: '左对齐', value: 'left' },
        { label: '居中', value: 'center' },
        { label: '右对齐', value: 'right' },
      ] },
      { target: 'style', key: 'fontSize', label: '字号', kind: 'text', placeholder: '30px' },
      { target: 'style', key: 'fontWeight', label: '字重', kind: 'select', options: [
        { label: '常规', value: '400' },
        { label: '中等', value: '500' },
        { label: '加粗', value: '700' },
      ] },
      { target: 'style', key: 'color', label: '文字颜色', kind: 'color' },
      { target: 'style', key: 'margin', label: '外边距', kind: 'text' },
    ],
    events: [{ name: 'click', label: '点击' }],
    render: (node, mode) => renderText('h1', node, mode),
  },
  paragraph: {
    type: 'paragraph',
    label: '段落文本',
    description: '多行正文内容',
    icon: '<svg viewBox="0 0 24 24"><path d="M5 6h14M5 10h14M5 14h10M5 18h14"/></svg>',
    canHaveChildren: false,
    editableText: true,
    defaultProps: { text: '在这里输入一段说明文字，用于介绍页面内容、功能卖点或其他信息。' },
    defaultEvents: {},
    defaultStyle: {
      width: '100%',
      margin: '0 0 12px',
      fontSize: '15px',
      lineHeight: '1.8',
      color: '#374151',
    },
    inspector: [
      { target: 'props', key: 'text', label: '正文', kind: 'textarea' },
      { target: 'style', key: 'textAlign', label: '对齐', kind: 'select', options: [
        { label: '左对齐', value: 'left' },
        { label: '居中', value: 'center' },
        { label: '右对齐', value: 'right' },
      ] },
      { target: 'style', key: 'fontSize', label: '字号', kind: 'text', placeholder: '15px' },
      { target: 'style', key: 'fontWeight', label: '字重', kind: 'select', options: [
        { label: '常规', value: '400' },
        { label: '中等', value: '500' },
        { label: '加粗', value: '700' },
      ] },
      { target: 'style', key: 'color', label: '文字颜色', kind: 'color' },
      { target: 'style', key: 'lineHeight', label: '行高', kind: 'text' },
      { target: 'style', key: 'margin', label: '外边距', kind: 'text' },
    ],
    events: [{ name: 'click', label: '点击' }],
    render: (node, mode) => renderText('p', node, mode),
  },
  button: {
    type: 'button',
    label: '按钮',
    description: '行动触发按钮',
    icon: '<svg viewBox="0 0 24 24"><rect x="4" y="8" width="16" height="8" rx="4"/><path d="M9 12h6"/></svg>',
    canHaveChildren: false,
    editableText: true,
    defaultProps: { text: '立即开始' },
    defaultEvents: {},
    defaultStyle: {
      padding: '10px 18px',
      margin: '0 0 12px',
      fontSize: '15px',
      fontWeight: '600',
      color: '#ffffff',
      backgroundColor: '#2563eb',
      borderRadius: '8px',
      border: '0',
    },
    inspector: [
      { target: 'props', key: 'text', label: '按钮文案', kind: 'text' },
      { target: 'style', key: 'textAlign', label: '对齐', kind: 'select', options: [
        { label: '左对齐', value: 'left' },
        { label: '居中', value: 'center' },
        { label: '右对齐', value: 'right' },
      ] },
      { target: 'style', key: 'fontSize', label: '字号', kind: 'text' },
      { target: 'style', key: 'fontWeight', label: '字重', kind: 'select', options: [
        { label: '常规', value: '400' },
        { label: '中等', value: '500' },
        { label: '加粗', value: '700' },
      ] },
      { target: 'style', key: 'color', label: '文字颜色', kind: 'color' },
      { target: 'style', key: 'backgroundColor', label: '背景色', kind: 'color' },
      { target: 'style', key: 'borderRadius', label: '圆角', kind: 'text' },
      { target: 'style', key: 'padding', label: '内边距', kind: 'text' },
      { target: 'style', key: 'margin', label: '外边距', kind: 'text' },
    ],
    events: [{ name: 'click', label: '点击' }],
    render: (node, mode) => renderText('button', node, mode),
  },
  image: {
    type: 'image',
    label: '图片',
    description: '内置占位图片',
    icon: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="10" r="1.5"/><path d="M5 17l5-5 4 4 2-2 3 3"/></svg>',
    canHaveChildren: false,
    editableText: false,
    defaultProps: { alt: '图片内容', src: defaultImage },
    defaultEvents: {},
    defaultStyle: {
      display: 'block',
      width: '100%',
      height: 'auto',
      margin: '0 0 12px',
      borderRadius: '10px',
      objectFit: 'cover',
    },
    inspector: [
      { target: 'props', key: 'alt', label: '替代文本', kind: 'text' },
      { target: 'style', key: 'width', label: '宽度', kind: 'text' },
      { target: 'style', key: 'height', label: '高度', kind: 'text' },
      { target: 'style', key: 'borderRadius', label: '圆角', kind: 'text' },
      { target: 'style', key: 'margin', label: '外边距', kind: 'text' },
    ],
    events: [{ name: 'click', label: '点击' }],
    render: (node, mode) => {
      const element = createElement('img');
      element.src = node.props.src || defaultImage;
      element.alt = node.props.alt || '图片';
      applyCommon(element, node, mode);
      return element;
    },
  },
  divider: {
    type: 'divider',
    label: '分割线',
    description: '内容分隔线',
    icon: '<svg viewBox="0 0 24 24"><path d="M4 12h16"/></svg>',
    canHaveChildren: false,
    editableText: false,
    defaultProps: {},
    defaultEvents: {},
    defaultStyle: {
      width: '100%',
      margin: '16px 0',
      color: '#d1d5db',
      borderRadius: '0',
    },
    inspector: [
      { target: 'style', key: 'width', label: '宽度', kind: 'text' },
      { target: 'style', key: 'color', label: '线条颜色', kind: 'color' },
      { target: 'style', key: 'margin', label: '外边距', kind: 'text' },
    ],
    events: [],
    render: (node, mode) => {
      const element = createElement('hr');
      const style = { ...node.style, border: `1px solid ${node.style.color || '#d1d5db'}`, backgroundColor: 'transparent' };
      const clone: ComponentNode = { ...node, style };
      applyCommon(element, clone, mode);
      return element;
    },
  },
  input: {
    type: 'input',
    label: '输入框',
    description: '单行文本输入',
    icon: '<svg viewBox="0 0 24 24"><rect x="3" y="8" width="18" height="8" rx="2"/><path d="M7 12h3"/></svg>',
    canHaveChildren: false,
    editableText: false,
    defaultProps: { placeholder: '请输入内容' },
    defaultEvents: {},
    defaultStyle: {
      display: 'block',
      width: '100%',
      padding: '10px 12px',
      margin: '0 0 12px',
      fontSize: '14px',
      color: '#111827',
      backgroundColor: '#ffffff',
      border: '1px solid #cbd5e1',
      borderRadius: '8px',
    },
    inspector: [
      { target: 'props', key: 'placeholder', label: '占位提示', kind: 'text' },
      { target: 'style', key: 'width', label: '宽度', kind: 'text' },
      { target: 'style', key: 'fontSize', label: '字号', kind: 'text' },
      { target: 'style', key: 'color', label: '文字颜色', kind: 'color' },
      { target: 'style', key: 'backgroundColor', label: '背景色', kind: 'color' },
      { target: 'style', key: 'borderRadius', label: '圆角', kind: 'text' },
      { target: 'style', key: 'padding', label: '内边距', kind: 'text' },
      { target: 'style', key: 'margin', label: '外边距', kind: 'text' },
    ],
    events: [
      { name: 'input', label: '输入变化' },
      { name: 'change', label: '值改变' },
      { name: 'focus', label: '获得焦点' },
      { name: 'blur', label: '失去焦点' },
    ],
    render: (node, mode) => {
      const element = createElement('input');
      element.placeholder = node.props.placeholder || '';
      element.type = 'text';
      if (mode === 'editor') element.readOnly = true;
      applyCommon(element, node, mode);
      return element;
    },
  },
  link: {
    type: 'link',
    label: '链接',
    description: '文本超链接',
    icon: '<svg viewBox="0 0 24 24"><path d="M10 14a5 5 0 007.07 0l2.83-2.83a5 5 0 00-7.07-7.07L11.5 5.5"/><path d="M14 10a5 5 0 00-7.07 0L4.1 12.83a5 5 0 007.07 7.07l1.4-1.4"/></svg>',
    canHaveChildren: false,
    editableText: true,
    defaultProps: { text: '查看详情', href: '#' },
    defaultEvents: {},
    defaultStyle: {
      margin: '0 0 12px',
      fontSize: '15px',
      fontWeight: '500',
      color: '#2563eb',
      textDecoration: 'underline',
    },
    inspector: [
      { target: 'props', key: 'text', label: '链接文案', kind: 'text' },
      { target: 'props', key: 'href', label: '链接地址', kind: 'text', placeholder: 'https://' },
      { target: 'style', key: 'textAlign', label: '对齐', kind: 'select', options: [
        { label: '左对齐', value: 'left' },
        { label: '居中', value: 'center' },
        { label: '右对齐', value: 'right' },
      ] },
      { target: 'style', key: 'fontSize', label: '字号', kind: 'text' },
      { target: 'style', key: 'fontWeight', label: '字重', kind: 'select', options: [
        { label: '常规', value: '400' },
        { label: '中等', value: '500' },
        { label: '加粗', value: '700' },
      ] },
      { target: 'style', key: 'color', label: '文字颜色', kind: 'color' },
      { target: 'style', key: 'margin', label: '外边距', kind: 'text' },
    ],
    events: [{ name: 'click', label: '点击' }],
    render: (node, mode) => renderText('a', node, mode),
  },
  form: {
    type: 'form',
    label: '表单',
    description: '可提交的表单容器',
    icon: '<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 9h8M8 13h5M8 17h8"/></svg>',
    canHaveChildren: true,
    editableText: false,
    defaultProps: { name: 'form1', action: '' },
    defaultEvents: {},
    defaultStyle: {
      width: '100%',
      minHeight: '60px',
      padding: '16px',
      margin: '0 0 12px',
      backgroundColor: '#ffffff',
      borderRadius: '10px',
      border: '1px solid #e2e8f0',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
    },
    inspector: [
      { target: 'props', key: 'name', label: '表单名称', kind: 'text' },
      { target: 'props', key: 'action', label: '提交地址', kind: 'text', placeholder: 'https://' },
      { target: 'style', key: 'width', label: '宽度', kind: 'text', placeholder: '100% 或 320px' },
      { target: 'style', key: 'padding', label: '内边距', kind: 'text', placeholder: '16px' },
      { target: 'style', key: 'margin', label: '外边距', kind: 'text', placeholder: '0 0 12px' },
      { target: 'style', key: 'backgroundColor', label: '背景色', kind: 'color' },
      { target: 'style', key: 'borderRadius', label: '圆角', kind: 'text', placeholder: '10px' },
    ],
    events: [
      { name: 'submit', label: '提交' },
      { name: 'reset', label: '重置' },
    ],
    render: (node, mode, children) => {
      const element = createElement('form');
      element.name = node.props.name || '';
      if (mode === 'export') element.action = node.props.action || '';
      applyCommon(element, node, mode);
      if (mode === 'editor') {
        element.dataset.dropContainer = 'true';
        element.addEventListener('submit', (e) => e.preventDefault());
      }
      appendChildren(element, children);
      return element;
    },
  },
  textarea: {
    type: 'textarea',
    label: '多行文本',
    description: '多行文本输入域',
    icon: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 8h10M7 12h10M7 16h6"/></svg>',
    canHaveChildren: false,
    editableText: false,
    defaultProps: { placeholder: '请输入多行内容', name: 'textarea1', rows: '4' },
    defaultEvents: {},
    defaultStyle: {
      display: 'block',
      width: '100%',
      padding: '10px 12px',
      margin: '0 0 12px',
      fontSize: '14px',
      color: '#111827',
      backgroundColor: '#ffffff',
      border: '1px solid #cbd5e1',
      borderRadius: '8px',
      resize: 'vertical',
      minHeight: '80px',
    },
    inspector: [
      { target: 'props', key: 'placeholder', label: '占位提示', kind: 'text' },
      { target: 'props', key: 'name', label: '字段名', kind: 'text' },
      { target: 'props', key: 'rows', label: '行数', kind: 'text', placeholder: '4' },
      { target: 'style', key: 'width', label: '宽度', kind: 'text' },
      { target: 'style', key: 'fontSize', label: '字号', kind: 'text' },
      { target: 'style', key: 'color', label: '文字颜色', kind: 'color' },
      { target: 'style', key: 'backgroundColor', label: '背景色', kind: 'color' },
      { target: 'style', key: 'borderRadius', label: '圆角', kind: 'text' },
      { target: 'style', key: 'padding', label: '内边距', kind: 'text' },
      { target: 'style', key: 'margin', label: '外边距', kind: 'text' },
    ],
    events: [
      { name: 'input', label: '输入变化' },
      { name: 'change', label: '值改变' },
      { name: 'focus', label: '获得焦点' },
      { name: 'blur', label: '失去焦点' },
    ],
    render: (node, mode) => {
      const element = createElement('textarea');
      element.placeholder = node.props.placeholder || '';
      element.name = node.props.name || '';
      const rows = parseInt(node.props.rows || '4', 10);
      if (!isNaN(rows)) element.rows = rows;
      if (mode === 'editor') element.readOnly = true;
      applyCommon(element, node, mode);
      return element;
    },
  },
  select: {
    type: 'select',
    label: '下拉选择',
    description: '下拉选择框',
    icon: '<svg viewBox="0 0 24 24"><rect x="3" y="8" width="18" height="8" rx="2"/><path d="M9 12h6l-3 3z"/></svg>',
    canHaveChildren: false,
    editableText: false,
    defaultProps: { name: 'select1', options: '选项一\n选项二\n选项三', value: '' },
    defaultEvents: {},
    defaultStyle: {
      display: 'block',
      width: '100%',
      padding: '10px 12px',
      margin: '0 0 12px',
      fontSize: '14px',
      color: '#111827',
      backgroundColor: '#ffffff',
      border: '1px solid #cbd5e1',
      borderRadius: '8px',
    },
    inspector: [
      { target: 'props', key: 'name', label: '字段名', kind: 'text' },
      { target: 'props', key: 'options', label: '选项', kind: 'textarea', placeholder: '每行一个选项' },
      { target: 'style', key: 'width', label: '宽度', kind: 'text' },
      { target: 'style', key: 'fontSize', label: '字号', kind: 'text' },
      { target: 'style', key: 'color', label: '文字颜色', kind: 'color' },
      { target: 'style', key: 'backgroundColor', label: '背景色', kind: 'color' },
      { target: 'style', key: 'borderRadius', label: '圆角', kind: 'text' },
      { target: 'style', key: 'padding', label: '内边距', kind: 'text' },
      { target: 'style', key: 'margin', label: '外边距', kind: 'text' },
    ],
    events: [
      { name: 'change', label: '值改变' },
      { name: 'focus', label: '获得焦点' },
      { name: 'blur', label: '失去焦点' },
    ],
    render: (node, mode) => {
      const element = createElement('select');
      element.name = node.props.name || '';
      const optionsText = node.props.options || '';
      optionsText.split('\n').forEach((opt) => {
        const trimmed = opt.trim();
        if (trimmed) {
          const option = createElement('option');
          option.value = trimmed;
          option.textContent = trimmed;
          if (node.props.value === trimmed) option.selected = true;
          element.appendChild(option);
        }
      });
      if (mode === 'editor') element.disabled = true;
      applyCommon(element, node, mode);
      return element;
    },
  },
  checkbox: {
    type: 'checkbox',
    label: '复选框',
    description: '多选复选框',
    icon: '<svg viewBox="0 0 24 24"><rect x="5" y="5" width="14" height="14" rx="3"/><path d="M8 12l3 3 5-6"/></svg>',
    canHaveChildren: false,
    editableText: false,
    defaultProps: { name: 'checkbox1', label: '我已阅读并同意', checked: 'false', value: '同意' },
    defaultEvents: {},
    defaultStyle: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      margin: '0 0 12px',
      fontSize: '14px',
      color: '#111827',
      cursor: 'pointer',
    },
    inspector: [
      { target: 'props', key: 'label', label: '标签文案', kind: 'text' },
      { target: 'props', key: 'name', label: '字段名', kind: 'text' },
      { target: 'props', key: 'value', label: '选中值', kind: 'text' },
      { target: 'style', key: 'fontSize', label: '字号', kind: 'text' },
      { target: 'style', key: 'color', label: '文字颜色', kind: 'color' },
      { target: 'style', key: 'margin', label: '外边距', kind: 'text' },
    ],
    events: [{ name: 'change', label: '值改变' }],
    render: (node, mode) => {
      const labelEl = createElement('label');
      const input = createElement('input');
      input.type = 'checkbox';
      input.name = node.props.name || '';
      input.value = node.props.value || '';
      input.checked = node.props.checked === 'true';
      if (mode === 'editor') input.disabled = true;
      const span = createElement('span');
      span.textContent = node.props.label || '';
      labelEl.appendChild(input);
      labelEl.appendChild(span);
      applyCommon(labelEl, node, mode);
      return labelEl;
    },
  },
  switch: {
    type: 'switch',
    label: '开关',
    description: '开关切换按钮',
    icon: '<svg viewBox="0 0 24 24"><rect x="3" y="8" width="18" height="8" rx="4"/><circle cx="17" cy="12" r="3"/></svg>',
    canHaveChildren: false,
    editableText: false,
    defaultProps: { name: 'switch1', checked: 'false', label: '开启自动保存' },
    defaultEvents: {},
    defaultStyle: {
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      margin: '0 0 12px',
      fontSize: '14px',
      color: '#111827',
      cursor: 'pointer',
    },
    inspector: [
      { target: 'props', key: 'label', label: '标签文案', kind: 'text' },
      { target: 'props', key: 'name', label: '字段名', kind: 'text' },
      { target: 'style', key: 'fontSize', label: '字号', kind: 'text' },
      { target: 'style', key: 'color', label: '文字颜色', kind: 'color' },
      { target: 'style', key: 'margin', label: '外边距', kind: 'text' },
    ],
    events: [{ name: 'change', label: '值改变' }],
    render: (node, mode) => {
      const labelEl = createElement('label');
      const input = createElement('input');
      input.type = 'checkbox';
      input.name = node.props.name || '';
      input.checked = node.props.checked === 'true';
      input.setAttribute('role', 'switch');
      if (mode === 'editor') input.disabled = true;
      const span = createElement('span');
      span.textContent = node.props.label || '';
      labelEl.appendChild(input);
      labelEl.appendChild(span);
      applyCommon(labelEl, node, mode);
      return labelEl;
    },
  },
};

export function getDefinition(type: ComponentType): ComponentDefinition {
  return definitions[type];
}

export function getDefinitions(): ComponentDefinition[] {
  return Object.values(definitions);
}

export function createNode(type: ComponentType): ComponentNode {
  const definition = definitions[type];
  return {
    id: uid(type),
    type,
    props: { ...definition.defaultProps },
    style: { ...definition.defaultStyle },
    children: [],
    events: {},
    locked: false,
    hidden: false,
  };
}
