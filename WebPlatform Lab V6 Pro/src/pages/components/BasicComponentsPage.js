// BasicComponentsPage.js —— 基础组件演示：Button / Tag / Badge / Card / Alert
import { Page } from '../../core/Component.js';
import { h } from '../../core/utils.js';
import { Button } from '../../components/ui/Button.js';
import { Tag } from '../../components/ui/Tag.js';
import { Badge } from '../../components/ui/Badge.js';
import { Card } from '../../components/ui/Card.js';
import { Alert } from '../../components/ui/Alert.js';
import { Divider } from '../../components/ui/Progress.js';
import { message } from '../../components/ui/Message.js';
import { Layout, Header, Content, Footer, Sider } from '../../components/ui/Layout.js';
import { Row, Col } from '../../components/ui/Grid.js';
import { Space } from '../../components/ui/Space.js';
import { Title, Paragraph, Text } from '../../components/ui/Typography.js';
import { Flex } from '../../components/ui/Flex.js';

export class BasicComponentsPage extends Page {
  _btn(label, opts) {
    const btn = new Button({ ...opts, children: label, onClick: opts.onClick });
    this.registerChild(btn);
    return btn.render();
  }

  renderPage() {
    return [
      h('h2', { class: 'section-title' }, '基础组件'),

      // Button
      h(Card, { title: 'Button 按钮' },
        h('div', { class: 'demo-row' }, h('span', { class: 'demo-row__label' }, '类型'),
          this._btn('默认', { onClick: () => message.info('点击了默认按钮') }),
          this._btn('主要', { type: 'primary', onClick: () => message.success('主要按钮') }),
          this._btn('成功', { type: 'success', onClick: () => message.success('成功按钮') }),
          this._btn('警告', { type: 'warning', onClick: () => message.warning('警告按钮') }),
          this._btn('危险', { type: 'danger', onClick: () => message.error('危险按钮') }),
          this._btn('虚线', { type: 'dashed', onClick: () => message.info('虚线按钮') }),
          this._btn('链接', { type: 'link', onClick: () => message.info('链接按钮') }),
        ),
        h('div', { class: 'demo-row' }, h('span', { class: 'demo-row__label' }, '尺寸'),
          this._btn('大', { type: 'primary', size: 'lg', onClick: () => message.info('大尺寸') }),
          this._btn('中', { type: 'primary', onClick: () => message.info('中尺寸') }),
          this._btn('小', { type: 'primary', size: 'sm', onClick: () => message.info('小尺寸') }),
        ),
        h('div', { class: 'demo-row' }, h('span', { class: 'demo-row__label' }, '状态'),
          this._btn('禁用', { disabled: true }),
          this._btn('加载中', { loading: true }),
          this._btn('block', { type: 'primary', block: true, onClick: () => message.info('块级按钮') }),
        ),
      ),

      // Tag
      h(Card, { title: 'Tag 标签' },
        h('div', { class: 'demo-row' }, h('span', { class: 'demo-row__label' }, '颜色'),
          h(Tag, {}, '默认'),
          h(Tag, { color: 'primary' }, '主要'),
          h(Tag, { color: 'success' }, '成功'),
          h(Tag, { color: 'warning' }, '警告'),
          h(Tag, { color: 'error' }, '错误'),
        ),
        h('div', { class: 'demo-row' }, h('span', { class: 'demo-row__label' }, '可关闭'),
          h(Tag, { color: 'primary', closable: true }, '可关闭'),
        ),
      ),

      // Badge
      h(Card, { title: 'Badge 徽标' },
        h('div', { class: 'demo-row' }, h('span', { class: 'demo-row__label' }, '计数'),
          h(Badge, { count: 5 }, h('button', { class: 'btn', type: 'button' }, '消息')),
          h(Badge, { count: 99 }, h('button', { class: 'btn', type: 'button' }, '消息')),
          h(Badge, { count: 200 }, h('button', { class: 'btn', type: 'button' }, '消息')),
          h(Badge, { dot: true }, h('button', { class: 'btn', type: 'button' }, '消息')),
        ),
      ),

      // Alert
      h(Card, { title: 'Alert 警告' },
        h(Alert, { type: 'info', message: '信息提示', description: '这是一条信息提示的描述文案。' }),
        h('div', { class: 'mt-sm' }, h(Alert, { type: 'success', message: '成功提示' })),
        h('div', { class: 'mt-sm' }, h(Alert, { type: 'warning', message: '警告提示' })),
        h('div', { class: 'mt-sm' }, h(Alert, { type: 'error', message: '错误提示', closable: true })),
      ),

      h(Card, { title: 'Divider 分割线' },
        h('p', { class: 'text-secondary' }, '上文内容'),
        h(Divider, {}),
        h('p', { class: 'text-secondary' }, '下文内容'),
        h(Divider, { label: '带文字' }),
        h('p', { class: 'text-secondary' }, '更多内容'),
      ),

      // Layout
      h(Card, { title: 'Layout 布局' },
        h('div', { class: 'demo-row' }, h('span', { class: 'demo-row__label' }, '基本结构'),
          h(Layout, {},
            h(Header, {}, 'Header'),
            h(Content, {}, 'Content 内容区'),
            h(Footer, {}, 'Footer'),
          ),
        ),
        h('div', { class: 'demo-row' }, h('span', { class: 'demo-row__label' }, '含侧边栏'),
          h(Layout, { hasSider: true },
            h(Sider, { width: 80 }, 'Sider'),
            h(Content, {}, 'Content'),
          ),
        ),
      ),

      // Grid
      h(Card, { title: 'Grid 栅格' },
        h('div', { class: 'demo-row' }, h('span', { class: 'demo-row__label' }, '基础栅格'),
          h(Row, { gutter: 8 },
            h(Col, { span: 8 }, h('div', { style: { background: '#1677ff', color: '#fff', textAlign: 'center', padding: '8px' } }, 'col-8')),
            h(Col, { span: 8 }, h('div', { style: { background: '#1677ff', color: '#fff', textAlign: 'center', padding: '8px' } }, 'col-8')),
            h(Col, { span: 8 }, h('div', { style: { background: '#1677ff', color: '#fff', textAlign: 'center', padding: '8px' } }, 'col-8')),
          ),
        ),
        h('div', { class: 'demo-row' }, h('span', { class: 'demo-row__label' }, '偏移'),
          h(Row, { gutter: 8 },
            h(Col, { span: 6, offset: 6 }, h('div', { style: { background: '#52c41a', color: '#fff', textAlign: 'center', padding: '8px' } }, 'col-6 offset-6')),
            h(Col, { span: 6, offset: 6 }, h('div', { style: { background: '#52c41a', color: '#fff', textAlign: 'center', padding: '8px' } }, 'col-6 offset-6')),
          ),
        ),
      ),

      // Space
      h(Card, { title: 'Space 间距' },
        h('div', { class: 'demo-row' }, h('span', { class: 'demo-row__label' }, '水平'),
          h(Space, { size: 'middle' }, h(Tag, {}, 'A'), h(Tag, { color: 'primary' }, 'B'), h(Tag, { color: 'success' }, 'C')),
        ),
        h('div', { class: 'demo-row' }, h('span', { class: 'demo-row__label' }, '垂直'),
          h(Space, { direction: 'vertical', size: 'small' }, h('span', {}, '第一行'), h('span', {}, '第二行'), h('span', {}, '第三行')),
        ),
        h('div', { class: 'demo-row' }, h('span', { class: 'demo-row__label' }, '分隔符'),
          h(Space, { split: '|' }, h('span', {}, 'A'), h('span', {}, 'B'), h('span', {}, 'C')),
        ),
      ),

      // Typography
      h(Card, { title: 'Typography 排版' },
        h(Title, { level: 4 }, '标题 H4'),
        h(Paragraph, {}, '这是一段段落文本。Typography 提供标题、段落、文本三种基础排版组件，支持多种语义化样式。'),
        h('div', { class: 'demo-row' }, h('span', { class: 'demo-row__label' }, '文本类型'),
          h(Text, { type: 'primary' }, '主要'),
          h(Text, { type: 'success' }, '成功'),
          h(Text, { type: 'warning' }, '警告'),
          h(Text, { type: 'danger' }, '危险'),
        ),
        h('div', { class: 'demo-row' }, h('span', { class: 'demo-row__label' }, '样式'),
          h(Text, { strong: true }, '加粗'),
          h(Text, { underline: true }, '下划线'),
          h(Text, { delete: true }, '删除'),
          h(Text, { code: true }, 'code'),
          h(Text, { mark: true }, '标记'),
        ),
      ),

      // Flex
      h(Card, { title: 'Flex 弹性布局' },
        h('div', { class: 'demo-row' }, h('span', { class: 'demo-row__label' }, '水平间距'),
          h(Flex, { gap: 'small' }, h(Tag, {}, 'A'), h(Tag, { color: 'primary' }, 'B'), h(Tag, { color: 'success' }, 'C')),
        ),
        h('div', { class: 'demo-row' }, h('span', { class: 'demo-row__label' }, '两端对齐'),
          h('div', { style: { width: '300px' } },
            h(Flex, { justify: 'space-between' }, h('span', {}, '左'), h('span', {}, '中'), h('span', {}, '右')),
          ),
        ),
        h('div', { class: 'demo-row' }, h('span', { class: 'demo-row__label' }, '垂直'),
          h(Flex, { vertical: true, gap: 'small' }, h('span', {}, '上'), h('span', {}, '中'), h('span', {}, '下')),
        ),
      ),
    ];
  }
}
