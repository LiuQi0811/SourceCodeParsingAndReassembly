// ComponentsIndexPage.ts —— 组件演示入口
import { Page } from '../../core/Component.js';
import { h } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Tag } from '../../components/ui/Tag.js';
const CATEGORIES = [
    {
        path: '/components/basic', icon: '◍', title: '基础组件',
        desc: 'Button 按钮 / Tag 标签 / Badge 徽标 / Alert 警告 / Divider 分割线',
        tags: ['Button', 'Tag', 'Badge', 'Alert'],
    },
    {
        path: '/components/form', icon: '▦', title: '表单组件',
        desc: 'Input 输入框 / Select 选择器 / Switch 开关 / Checkbox / Radio / 表单校验',
        tags: ['Input', 'Select', 'Switch', 'Form'],
    },
    {
        path: '/components/data', icon: '▤', title: '数据展示',
        desc: 'Table 表格（排序/分页） / Tabs 标签页 / 行点击跳转动态路由',
        tags: ['Table', 'Tabs'],
    },
    {
        path: '/components/feedback', icon: '✦', title: '反馈组件',
        desc: 'Message 全局消息 / Notification 通知 / Modal 对话框 / Drawer 抽屉 / Progress 进度条',
        tags: ['Message', 'Notification', 'Modal', 'Drawer'],
    },
    {
        path: '/components/general', icon: '◉', title: '通用组件',
        desc: 'Avatar 头像 / Spin 加载 / List 列表 / Statistic 统计 / Result 结果页 / Image 图片 / Upload 上传',
        tags: ['Avatar', 'Spin', 'List', 'Statistic', 'Result', 'Image', 'Upload'],
    },
    {
        path: '/components/navigation', icon: '◈', title: '导航与交互组件',
        desc: 'Breadcrumb 面包屑 / Tooltip / Popover / Collapse / Dropdown / Pagination / Steps / Timeline / Rate / Slider / Segmented',
        tags: ['Breadcrumb', 'Tooltip', 'Popover', 'Collapse', 'Dropdown', 'Pagination', 'Steps', 'Timeline', 'Rate', 'Slider', 'Segmented'],
    },
];
export class ComponentsIndexPage extends Page {
    renderPage() {
        return [
            h('h2', { class: 'section-title' }, '组件演示'),
            h('p', { class: 'text-secondary mb-lg' }, '所有组件均以原生 CSS + ES Class 实现，无任何第三方依赖。体现 OOP 继承（Component 基类）、多态（type/size 变体）、组合（父子组件）。'),
            h('div', { class: 'feature-grid' }, ...CATEGORIES.map((cat) => {
                const card = new Card({
                    title: h('div', { class: 'flex items-center gap-sm' }, h('span', { class: 'feature-card__icon' }, cat.icon), h('span', {}, cat.title)),
                    hoverable: true,
                    children: [
                        h('p', { class: 'feature-card__desc' }, cat.desc),
                        h('div', { class: 'feature-card__meta' }, ...cat.tags.map((t) => h(Tag, { color: 'primary' }, t))),
                    ],
                });
                this.registerChild(card);
                const node = card.render();
                node.classList.add('feature-card');
                node.addEventListener('click', () => this.props.router.push(cat.path));
                return node;
            })),
        ];
    }
}
//# sourceMappingURL=ComponentsIndexPage.js.map