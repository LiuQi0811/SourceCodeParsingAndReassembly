import { buildNode } from '../engine/renderer';
import type { ComponentNode, ComponentStyle, PageSchema } from '../core/schema';
import { runtimeScript } from './runtime-script';

const RESET_CSS = `
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body {
  min-height: 100vh;
  color: #111827;
  background: #ffffff;
  font-family: -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;
  -webkit-font-smoothing: antialiased;
}
.page-root {
  width: 100%;
  max-width: 960px;
  margin: 0 auto;
  padding: 40px 32px;
}
img { max-width: 100%; }
a { text-underline-offset: 3px; }
button { cursor: pointer; font-family: inherit; }
input, textarea, select { font-family: inherit; }
`;

function toCssKey(key: string): string {
  return key.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`);
}

function applyStyleObject(element: HTMLElement, style: ComponentStyle): void {
  Object.entries(style).forEach(([key, value]) => {
    if (value !== undefined && value !== '') element.style.setProperty(toCssKey(key), value);
  });
}

function styleToCssText(style: CSSStyleDeclaration): string {
  return Array.from(style)
    .map((property) => `${property}: ${style.getPropertyValue(property)};`)
    .join(' ');
}

/**
 * 把事件配置序列化为 data-events 属性，挂到对应的 DOM 元素上。
 * 运行时脚本靠这个属性绑定事件监听。
 */
function applyEventsData(rootElement: HTMLElement, rootNode: ComponentNode): void {
  const applyNode = (node: ComponentNode): void => {
    if (node.events && Object.keys(node.events).length > 0) {
      const el = rootElement.querySelector<HTMLElement>(`[data-node-id="${CSS.escape(node.id)}"]`);
      if (el) el.setAttribute('data-events', JSON.stringify(node.events));
    }
    node.children.forEach(applyNode);
  };
  rootNode.children.forEach(applyNode);
}

/**
 * hidden 节点导出后 display:none（不删节点，保持结构完整）。
 */
function applyHiddenStyles(rootElement: HTMLElement, rootNode: ComponentNode): void {
  const applyNode = (node: ComponentNode): void => {
    if (node.hidden) {
      const el = rootElement.querySelector<HTMLElement>(`[data-node-id="${CSS.escape(node.id)}"]`);
      if (el) el.style.display = 'none';
    }
    node.children.forEach(applyNode);
  };
  rootNode.children.forEach(applyNode);
}

function inlineAllStyles(element: HTMLElement, keepClass = false): void {
  const cssText = styleToCssText(element.style);
  if (!keepClass) element.removeAttribute('class');
  // data-node-id 和 data-events 保留：运行时靠它们找到元素和绑定事件
  element.removeAttribute('data-node-type');
  element.removeAttribute('data-drop-container');
  element.removeAttribute('data-root');
  element.removeAttribute('contenteditable');
  element.removeAttribute('spellcheck');
  element.removeAttribute('data-text-editable');
  element.removeAttribute('data-editing');
  element.removeAttribute('readonly');
  element.removeAttribute('disabled');
  if (cssText) element.setAttribute('style', cssText);
  Array.from(element.children).forEach((child) => inlineAllStyles(child as HTMLElement));
}

export function renderStandalone(schema: PageSchema): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'page-root';
  applyStyleObject(wrapper, schema.root.style);
  schema.root.children.forEach((node) => wrapper.appendChild(buildNode(node, 'export')));
  applyEventsData(wrapper, schema.root);
  applyHiddenStyles(wrapper, schema.root);
  inlineAllStyles(wrapper, true);
  return wrapper;
}

export function generateStandaloneHtml(schema: PageSchema): string {
  const content = renderStandalone(schema);
  const contentHtml = content.outerHTML;

  const customHeadScript = schema.customCode?.headScript?.trim()
    ? `<script>\n${schema.customCode.headScript}\n</script>`
    : '';
  const customHeadStyle = schema.customCode?.headStyle?.trim()
    ? `<style>\n${schema.customCode.headStyle}\n</style>`
    : '';
  const customBodyScript = schema.customCode?.bodyScript?.trim()
    ? `<script>\n${schema.customCode.bodyScript}\n</script>`
    : '';

  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>低代码页面</title>
<style>${RESET_CSS}</style>
${customHeadStyle}
${customHeadScript}
</head>
<body>
${contentHtml}
<script>
${runtimeScript}
</script>
${customBodyScript}
</body>
</html>
`;
}

export function downloadHtml(schema: PageSchema): void {
  const blob = new Blob([generateStandaloneHtml(schema)], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'lowcode-page.html';
  link.click();
  URL.revokeObjectURL(url);
}
