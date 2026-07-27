// Typography.js —— 排版组件（Title/Paragraph/Text）
import { Component } from '../../core/Component.js';
import { h, copyText } from '../../core/utils.js';

/** 默认复制图标（内联 SVG，避免依赖字体/外部资源） */
const COPY_ICON_SVG = '<svg viewBox="0 0 1024 1024" width="1em" height="1em" fill="currentColor" style="vertical-align:-0.125em;"><path d="M832 64H296c-43.7 0-79.4 35.7-79.4 79.4V192H160c-35.3 0-64 28.7-64 64v640c0 35.3 28.7 64 64 64h512c35.3 0 64-28.7 64-64v-56.6h56.6c43.7 0 79.4-35.7 79.4-79.4V143.4C911.4 99.7 875.7 64 832 64zM736.6 896H160V256h576.6v640z m160-96.6H736V256c0-35.3-28.7-64-64-64H296v-48.6c0-8.5 6.9-15.4 15.4-15.4h520.8c8.5 0 15.4 6.9 15.4 15.4v592.4z"/></svg>';

/** 从 children 中提取纯文本，用于 copyable 默认复制内容 */
function extractText(children) {
  const arr = Array.isArray(children) ? children : [children];
  return arr.map((c) => {
    if (c == null || c === false || c === true) return '';
    if (c.nodeType) return c.textContent || '';
    if (typeof c === 'string' || typeof c === 'number') return String(c);
    return '';
  }).join('');
}

/**
 * 渲染复制按钮
 * @param {Component} host 宿主组件，用于 emit 事件
 * @param {boolean|object} copyable 配置：true 或 { text, icon, onCopy }
 * @param {*} children 用于提取默认复制文本
 */
function renderCopyable(host, copyable, children) {
  if (!copyable) return null;
  const config = typeof copyable === 'object' ? copyable : {};
  const capturedText = extractText(children);

  return h('span', {
    class: 'typography__copy',
    role: 'button',
    tabIndex: 0,
    title: '复制',
    onClick: async (e) => {
      e.stopPropagation();
      const content = config.text ?? capturedText;
      const ok = await copyText(content);
      host.emit('copy', { ok, text: content });
      config.onCopy?.(content, ok);
    },
  }, config.icon != null ? config.icon : h('span', { class: 'typography__copy-icon', html: COPY_ICON_SVG }));
}

/** 标题：level 1-5 对应 h1-h5 */
export class Title extends Component {
  render() {
    const { level = 1, copyable = false, className = '', children } = this.props;
    const lv = Math.min(Math.max(parseInt(level, 10) || 1, 1), 5);
    const tag = `h${lv}`;
    const classes = ['typography', 'typography--title', `typography--h${lv}`, className];

    const kids = [...(Array.isArray(children) ? children : [children])];
    if (copyable) kids.push(renderCopyable(this, copyable, children));
    return h(tag, { class: classes }, ...kids);
  }
}

/** 段落 */
export class Paragraph extends Component {
  render() {
    const { copyable = false, className = '', children } = this.props;
    const classes = ['typography', 'typography--paragraph', className];
    const kids = [...(Array.isArray(children) ? children : [children])];
    if (copyable) kids.push(renderCopyable(this, copyable, children));
    return h('p', { class: classes }, ...kids);
  }
}

/** 文本：支持 type/code/copyable/italic/delete/underline/mark/strong */
export class Text extends Component {
  render() {
    const {
      type, code = false, copyable = false,
      italic = false, delete: deleted = false, underline = false,
      mark = false, strong = false, className = '', children,
    } = this.props;

    const classes = [
      'typography',
      'typography--text',
      type && `typography--${type}`,
      italic && 'typography--italic',
      underline && 'typography--underline',
      deleted && 'typography--delete',
      mark && 'typography--mark',
      strong && 'typography--strong',
      code && 'typography--code',
      className,
    ];

    // 用语义化标签包装：既保留语义又给 CSS 提供钩子（多层包装顺序参考 antd）
    let content = children;
    if (code) content = h('code', {}, content);
    if (mark) content = h('mark', {}, content);
    if (deleted) content = h('del', {}, content);
    if (strong) content = h('strong', {}, content);
    if (underline) content = h('u', {}, content);
    if (italic) content = h('em', {}, content);

    const kids = [content];
    if (copyable) kids.push(renderCopyable(this, copyable, children));
    return h('span', { class: classes }, ...kids);
  }
}

// 命名空间导出，便于以 Typography.Title / Typography.Paragraph / Typography.Text 形式访问
export const Typography = { Title, Paragraph, Text };
export default Typography;
