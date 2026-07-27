// DataComponentsPage.ts —— 数据展示：Table / Tabs / Card
import { Page } from '../../core/Component.js';
import { h, request } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Table } from '../../components/ui/Table.js';
import { Tabs } from '../../components/ui/Tabs.js';
import { Tag } from '../../components/ui/Tag.js';
import { Skeleton } from '../../components/ui/Progress.js';
import { Tree } from '../../components/ui/Tree.js';
import { Carousel } from '../../components/ui/Carousel.js';
import { Calendar } from '../../components/ui/Calendar.js';
import { Descriptions } from '../../components/ui/Descriptions.js';
import { Comment } from '../../components/ui/Comment.js';
import { QRCode } from '../../components/ui/QRCode.js';
import { Watermark } from '../../components/ui/Watermark.js';
export class DataComponentsPage extends Page {
    initialState() { return { users: [], loading: true }; }
    async componentDidMount() {
        try {
            const users = await request('/assets/data/users.json');
            this.setState({ users, loading: false });
        }
        catch (err) {
            console.error('加载用户数据失败', err);
            this.setState({ loading: false });
        }
    }
    // 将面板内创建的子组件注册到 tabs（owner），
    // 这样切换 Tab 触发 Tabs._rerender 时会自动销毁上一面板的子组件，
    // 避免实例在 Page._children 中无限累积导致内存泄漏。
    _renderTable(owner) {
        if (this.state.loading)
            return h(Skeleton, { lines: 6 });
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
        if (this.state.loading)
            return h(Skeleton, { lines: 4 });
        return h('div', { class: 'feature-grid' }, ...this.state.users.slice(0, 6).map((u) => {
            const card = new Card({
                title: u.name, hoverable: true,
                extra: h(Tag, { color: 'primary' }, u.role),
                children: [
                    h('div', { class: 'fs-sm text-secondary mb-xs' }, u.email),
                    h('div', { class: 'flex items-center justify-between' }, h('span', { class: 'fs-sm text-tertiary' }, `${u.city} · ${u.age}岁`), h(Tag, { color: u.status === 'active' ? 'success' : 'warning' }, u.status)),
                ],
            });
            owner.registerChild(card);
            const node = card.render();
            node.addEventListener('click', () => this.props.router.push(`/router/user/${u.id}`));
            return node;
        }));
    }
    renderPage() {
        const tabs = new Tabs({
            items: [
                { key: 'table', label: '用户表格', content: () => this._renderTable(tabs) },
                { key: 'cards', label: '卡片网格', content: () => this._renderCards(tabs) },
                { key: 'code', label: '说明', content: () => h('div', { class: 'alert alert--info' }, h('span', { class: 'alert__icon' }, 'ℹ'), h('div', {}, '点击表格行可跳转到用户详情页（动态路由 /router/user/:id）。')) },
            ],
        });
        // Tabs 自身由 Page 持有；面板内的 Table/Card 由 Tabs 持有
        this.registerChild(tabs);
        return [
            h('h2', { class: 'section-title' }, '数据展示组件'),
            h(Card, { title: 'Table + Tabs 组合' }, tabs.render()),
            // Tree
            h(Card, { title: 'Tree 树形控件' }, h('div', { class: 'demo-row' }, h('span', { class: 'demo-row__label' }, '基本'), h(Tree, {
                defaultExpandAll: true,
                treeData: [
                    { key: '1', title: '父节点一', children: [
                            { key: '1-1', title: '子节点 1-1' },
                            { key: '1-2', title: '子节点 1-2' },
                        ] },
                    { key: '2', title: '父节点二', children: [
                            { key: '2-1', title: '子节点 2-1' },
                        ] },
                ],
            })), h('div', { class: 'demo-row' }, h('span', { class: 'demo-row__label' }, '可勾选'), h(Tree, {
                checkable: true,
                defaultExpandAll: true,
                treeData: [
                    { key: 'a', title: '可勾选 A', children: [
                            { key: 'a1', title: 'A-1' },
                            { key: 'a2', title: 'A-2' },
                        ] },
                ],
            }))),
            // Carousel
            h(Card, { title: 'Carousel 轮播' }, (() => {
                const c = new Carousel({
                    autoplay: true,
                    autoplaySpeed: 2500,
                    children: [
                        h('div', { style: { height: '160px', background: '#1677ff', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' } }, '幻灯片 1'),
                        h('div', { style: { height: '160px', background: '#52c41a', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' } }, '幻灯片 2'),
                        h('div', { style: { height: '160px', background: '#faad14', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' } }, '幻灯片 3'),
                    ],
                });
                this.registerChild(c);
                return c.render();
            })(), h('div', { class: 'mt-md' }, (() => {
                const c = new Carousel({
                    effect: 'fade',
                    children: [
                        h('div', { style: { height: '160px', background: '#722ed1', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' } }, '渐隐 1'),
                        h('div', { style: { height: '160px', background: '#13c2c2', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' } }, '渐隐 2'),
                    ],
                });
                this.registerChild(c);
                return c.render();
            })())),
            // Calendar
            h(Card, { title: 'Calendar 日历' }, h(Calendar, {})),
            // Descriptions
            h(Card, { title: 'Descriptions 描述列表' }, h(Descriptions, {
                title: '用户信息',
                column: 2,
                border: true,
                items: [
                    { label: '姓名', children: '张三' },
                    { label: '邮箱', children: 'zhangsan@example.com' },
                    { label: '手机', children: '13800138000' },
                    { label: '地址', children: '北京市朝阳区' },
                ],
            })),
            // Comment
            h(Card, { title: 'Comment 评论' }, h(Comment, {
                author: '张三',
                avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Comment',
                content: '这是一条评论内容。Comment 组件支持头像、作者、时间和操作列表。',
                datetime: '2024-01-15 10:30',
                actions: ['点赞', '回复'],
            })),
            // QRCode
            h(Card, { title: 'QRCode 二维码' }, h('div', { class: 'demo-row' }, h('span', { class: 'demo-row__label' }, '基本'), h(QRCode, { value: 'https://example.com', size: 128 }), h(QRCode, { value: 'Hello World', size: 128, color: '#1677ff' }), h(QRCode, { value: 'https://example.com', size: 128, type: 'svg' }))),
            // Watermark
            h(Card, { title: 'Watermark 水印' }, h(Watermark, {
                content: 'Demo Watermark',
                gap: [80, 80],
            }, h('div', { style: { height: '160px', background: '#fafafa', padding: '16px' } }, h('p', {}, '这段内容上方覆盖了水印文字。'), h('p', { class: 'text-secondary' }, '水印由 canvas 生成，平铺在内容之上但不阻挡交互。')))),
        ];
    }
}
//# sourceMappingURL=DataComponentsPage.js.map