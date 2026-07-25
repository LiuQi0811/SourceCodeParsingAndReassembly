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
          this._btn('成功', { type: 'success' }),
          this._btn('警告', { type: 'warning' }),
          this._btn('危险', { type: 'danger' }),
          this._btn('虚线', { type: 'dashed' }),
          this._btn('链接', { type: 'link' }),
        ),
        h('div', { class: 'demo-row' }, h('span', { class: 'demo-row__label' }, '尺寸'),
          this._btn('大', { type: 'primary', size: 'lg' }),
          this._btn('中', { type: 'primary' }),
          this._btn('小', { type: 'primary', size: 'sm' }),
        ),
        h('div', { class: 'demo-row' }, h('span', { class: 'demo-row__label' }, '状态'),
          this._btn('禁用', { disabled: true }),
          this._btn('加载中', { loading: true }),
          this._btn('block', { type: 'primary', block: true }),
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
          h(Badge, { count: 5 }, h('button', { class: 'btn' }, '消息')),
          h(Badge, { count: 99 }, h('button', { class: 'btn' }, '消息')),
          h(Badge, { count: 200 }, h('button', { class: 'btn' }, '消息')),
          h(Badge, { dot: true }, h('button', { class: 'btn' }, '消息')),
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
    ];
  }
}
