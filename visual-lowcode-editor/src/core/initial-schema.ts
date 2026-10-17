import { createNode } from './registry';
import type { PageSchema } from './schema';
import { uid } from './uid';

export function createInitialSchema(): PageSchema {
  const heading = createNode('heading');
  heading.props.text = '可视化页面搭建';
  heading.style.textAlign = 'center';

  const paragraph = createNode('paragraph');
  paragraph.props.text = '从左侧拖入组件，在右侧调整内容与样式。所有修改都会自动保存，并支持撤销、重做和导出单文件 HTML。';
  paragraph.style.textAlign = 'center';
  paragraph.style.color = '#64748b';

  const button = createNode('button');
  button.props.text = '开始使用';
  button.style.margin = '0 auto 12px';

  const container = createNode('container');
  container.style.display = 'flex';
  container.style.flexDirection = 'column';
  container.style.alignItems = 'center';
  container.style.padding = '32px 20px';
  container.style.backgroundColor = '#eff6ff';
  container.style.border = '1px solid #bfdbfe';
  container.children.push(heading, paragraph, button);

  const rootId = uid('root');
  return {
    version: 1,
    root: {
      id: rootId,
      type: 'container',
      props: {},
      style: {
        width: '100%',
        minHeight: '100%',
        padding: '32px',
        backgroundColor: '#ffffff',
        borderRadius: '10px',
        display: 'block',
      },
      children: [container, createNode('divider'), createNode('image'), createNode('input'), createNode('link')],
      events: {},
      locked: false,
      hidden: false,
    },
    customCode: {
      headScript: '',
      bodyScript: '',
      headStyle: '',
    },
  };
}
