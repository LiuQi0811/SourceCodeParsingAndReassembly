// DataComponentsPage.js —— 数据展示：Table / Tabs / Card
import { Page } from '../../core/Component.js';
import { h, request } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Table } from '../../components/ui/Table.js';
import { Tabs } from '../../components/ui/Tabs.js';
import { Tag } from '../../components/ui/Tag.js';
import { Skeleton } from '../../components/ui/Progress.js';

export class DataComponentsPage extends Page {
  initialState() { return { users: [], loading: true }; }

  async componentDidMount() {
    try {
      const users = await request('./assets/data/users.json');
      this.setState({ users, loading: false });
    } catch (err) {
      console.error('加载用户数据失败', err);
      this.setState({ loading: false });
    }
  }

  // 将面板内创建的子组件注册到 tabs（owner），
  // 这样切换 Tab 触发 Tabs._rerender 时会自动销毁上一面板的子组件，
  // 避免实例在 Page._children 中无限累积导致内存泄漏。
  _renderTable(owner) {
    if (this.state.loading) return h(Skeleton, { lines: 6 });

    const columns = [
      { title: 'ID', dataIndex: 'id', key: 'id', sorter: (a, b) => a.id - b.id },
      { title: '姓名', dataIndex: 'name', key: 'name', sorter: (a, b) => a.name.localeCompare(b.name) },
      { title: '邮箱', dataIndex: 'email', key: 'email' },
      { title: '角色', dataIndex: 'role', key: 'role',
        render: (v) => h(Tag, { color: 'primary' }, v) },
      { title: '年龄', dataIndex: 'age', key: 'age', sorter: (a, b) => a.age - b.age },
      { title: '城市', dataIndex: 'city', key: 'city' },
      { title: '状态', dataIndex: 'status', key: 'status',
        render: (v) => h(Tag, { color: v === 'active' ? 'success' : 'warning' }, v === 'active' ? '在线' : '空闲') },
    ];

    const table = new Table({
      columns, dataSource: this.state.users, pageSize: 5,
      onRowClick: (row) => this.props.router.push(`/router/user/${row.id}`),
    });
    owner.registerChild(table);
    return table.render();
  }

  _renderCards(owner) {
    if (this.state.loading) return h(Skeleton, { lines: 4 });
    return h('div', { class: 'feature-grid' },
      ...this.state.users.slice(0, 6).map((u) => {
        const card = new Card({
          title: u.name, hoverable: true,
          extra: h(Tag, { color: 'primary' }, u.role),
          children: [
            h('div', { class: 'fs-sm text-secondary mb-xs' }, u.email),
            h('div', { class: 'flex items-center justify-between' },
              h('span', { class: 'fs-sm text-tertiary' }, `${u.city} · ${u.age}岁`),
              h(Tag, { color: u.status === 'active' ? 'success' : 'warning' }, u.status),
            ),
          ],
        });
        owner.registerChild(card);
        const node = card.render();
        node.addEventListener('click', () => this.props.router.push(`/router/user/${u.id}`));
        return node;
      }),
    );
  }

  renderPage() {
    const tabs = new Tabs({
      items: [
        { key: 'table', label: '用户表格', content: () => this._renderTable(tabs) },
        { key: 'cards', label: '卡片网格', content: () => this._renderCards(tabs) },
        { key: 'code', label: '说明', content: () => h('div', { class: 'alert alert--info' },
          h('span', { class: 'alert__icon' }, 'ℹ'),
          h('div', {}, '点击表格行可跳转到用户详情页（动态路由 /router/user/:id）。')) },
      ],
    });
    // Tabs 自身由 Page 持有；面板内的 Table/Card 由 Tabs 持有
    this.registerChild(tabs);

    return [
      h('h2', { class: 'section-title' }, '数据展示组件'),
      h(Card, { title: 'Table + Tabs 组合' }, tabs.render()),
    ];
  }
}
