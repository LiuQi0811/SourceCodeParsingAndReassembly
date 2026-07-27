// NavigationComponentsPage.ts —— 导航与交互组件：Breadcrumb / Tooltip / Popover / Collapse / Dropdown / Pagination / Steps / Timeline / Rate / Slider / Segmented / Anchor / PageHeader / Affix / FloatButton
import { Page } from '../../core/Component.js';
import { h } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Breadcrumb } from '../../components/ui/Breadcrumb.js';
import { Tooltip } from '../../components/ui/Tooltip.js';
import { Popover } from '../../components/ui/Popover.js';
import { Collapse } from '../../components/ui/Collapse.js';
import { Dropdown } from '../../components/ui/Dropdown.js';
import { Pagination } from '../../components/ui/Pagination.js';
import { Steps } from '../../components/ui/Steps.js';
import { Timeline } from '../../components/ui/Timeline.js';
import { Rate } from '../../components/ui/Rate.js';
import { Slider } from '../../components/ui/Slider.js';
import { Segmented } from '../../components/ui/Segmented.js';
import { message } from '../../components/ui/Message.js';
import { Tag } from '../../components/ui/Tag.js';
import { Anchor } from '../../components/ui/Anchor.js';
import { PageHeader } from '../../components/ui/PageHeader.js';
import { Affix } from '../../components/ui/Affix.js';
import { FloatButton } from '../../components/ui/FloatButton.js';
import { Menu } from '../../components/ui/Menu.js';
import { Icon } from '../../components/ui/Icon.js';
export class NavigationComponentsPage extends Page {
    initialState() {
        return {
            page: 1,
            pageSize: 10,
            currentStep: 1,
            rateValue: 3,
            sliderValue: 30,
            segmentedValue: 'a',
            collapseActive: ['1'],
        };
    }
    _btn(label, opts) {
        const btn = new Button({ ...opts, children: label });
        this.registerChild(btn);
        return btn.render();
    }
    renderPage() {
        // —— Breadcrumb ——
        const breadcrumbCard = new Card({
            title: 'Breadcrumb 面包屑',
            children: [
                h(Breadcrumb, {
                    items: [
                        { label: '首页', onClick: () => this.props.router.push('/') },
                        { label: '组件演示', onClick: () => this.props.router.push('/components') },
                        { label: '导航组件' },
                    ],
                }),
                h('div', { class: 'mt-sm' }, h(Breadcrumb, {
                    separator: '>',
                    items: [
                        { label: '主页', onClick: () => message.info('点击主页') },
                        { label: '当前页' },
                    ],
                })),
            ],
        });
        this.registerChild(breadcrumbCard);
        // —— Tooltip ——
        const tooltipCard = new Card({
            title: 'Tooltip 文字提示',
            children: [
                h('div', { class: 'demo-row' }, h(Tooltip, { title: '上方提示文字', placement: 'top' }, this._btn('上', {})), h(Tooltip, { title: '下方提示', placement: 'bottom' }, this._btn('下', {})), h(Tooltip, { title: '左侧提示', placement: 'left' }, this._btn('左', {})), h(Tooltip, { title: '右侧提示', placement: 'right' }, this._btn('右', {}))),
            ],
        });
        this.registerChild(tooltipCard);
        // —— Popover ——
        const popoverCard = new Card({
            title: 'Popover 气泡卡片',
            children: [
                h('div', { class: 'demo-row' }, h(Popover, {
                    title: '标题', placement: 'top', trigger: 'click',
                    content: h('div', {}, h('p', {}, '这是一段内容。'), this._btn('确定', { type: 'primary', size: 'sm', onClick: () => message.success('已确认') })),
                }, this._btn('点击触发', { type: 'primary' })), h(Popover, {
                    title: '悬停', placement: 'bottom', trigger: 'hover',
                    content: '鼠标悬停显示的气泡内容。',
                }, this._btn('悬停触发', {}))),
            ],
        });
        this.registerChild(popoverCard);
        // —— Collapse ——
        // 使用 activeKey（受控）而非 defaultActiveKey（非受控），
        // 这样 page 重渲染时（如其他组件 setState 触发）Collapse 状态不会丢失。
        const collapseCard = new Card({
            title: 'Collapse 折叠面板',
            children: [
                h(Collapse, {
                    activeKey: this.state.collapseActive,
                    onChange: (keys) => this.setState({ collapseActive: keys }),
                    items: [
                        { key: '1', label: '面板一', children: h('p', { class: 'text-secondary' }, '这是面板一的内容。') },
                        { key: '2', label: '面板二', children: h('p', { class: 'text-secondary' }, '这是面板二的内容。') },
                        { key: '3', label: '面板三（禁用）', disabled: true, children: '禁用' },
                    ],
                }),
            ],
        });
        this.registerChild(collapseCard);
        // —— Dropdown ——
        const dropdownCard = new Card({
            title: 'Dropdown 下拉菜单',
            children: [
                h('div', { class: 'demo-row' }, h(Dropdown, {
                    placement: 'bottomLeft',
                    menu: [
                        { key: '1', label: '编辑', onClick: () => message.info('点击编辑') },
                        { key: '2', label: '复制', onClick: () => message.success('已复制') },
                        { type: 'divider' },
                        { key: '3', label: '删除', danger: true, onClick: () => message.error('已删除') },
                    ],
                }, this._btn('左对齐菜单 ▾', { type: 'primary' })), h(Dropdown, {
                    placement: 'bottomRight',
                    menu: [
                        { key: '1', label: '选项 A', onClick: () => message.info('选项 A') },
                        { key: '2', label: '选项 B（禁用）', disabled: true },
                    ],
                }, this._btn('右对齐菜单 ▾', {}))),
            ],
        });
        this.registerChild(dropdownCard);
        // —— Pagination ——
        const paginationCard = new Card({
            title: 'Pagination 分页',
            children: [
                h(Pagination, {
                    current: this.state.page,
                    total: 85,
                    pageSize: this.state.pageSize,
                    showTotal: true,
                    showQuickJumper: true,
                    onChange: (page) => { this.setState({ page }); message.info(`跳转到第 ${page} 页`); },
                }),
                h('div', { class: 'mt-md text-secondary fs-sm' }, `当前页：${this.state.page}`),
            ],
        });
        this.registerChild(paginationCard);
        // —— Steps ——
        const stepsCard = new Card({
            title: 'Steps 步骤条',
            children: [
                h(Steps, {
                    current: this.state.currentStep,
                    items: [
                        { title: '已完成', description: '这是描述' },
                        { title: '进行中', description: '当前步骤' },
                        { title: '待处理', description: '等待中' },
                        { title: '待处理' },
                    ],
                }),
                h('div', { class: 'flex gap-sm mt-md' }, this._btn('上一步', { disabled: this.state.currentStep === 0, onClick: () => this.setState({ currentStep: Math.max(0, this.state.currentStep - 1) }) }), this._btn('下一步', { type: 'primary', disabled: this.state.currentStep >= 3, onClick: () => this.setState({ currentStep: Math.min(3, this.state.currentStep + 1) }) })),
            ],
        });
        this.registerChild(stepsCard);
        // —— Timeline ——
        const timelineCard = new Card({
            title: 'Timeline 时间轴',
            children: [
                h(Timeline, {
                    items: [
                        { color: 'green', label: '创建项目', children: '初始化项目结构', timestamp: '2024-01-01' },
                        { color: 'blue', label: '开发中', children: '完成核心功能开发', timestamp: '2024-02-15' },
                        { color: 'blue', label: '测试阶段', children: '编写单元测试', timestamp: '2024-03-01' },
                        { color: 'gray', label: '发布', children: '准备上线', timestamp: '待定' },
                    ],
                }),
            ],
        });
        this.registerChild(timelineCard);
        // —— Rate ——
        const rateCard = new Card({
            title: 'Rate 评分',
            children: [
                h('div', { class: 'demo-row' }, h('span', { class: 'demo-row__label' }, '基本'), h(Rate, { value: this.state.rateValue, allowHalf: true, onChange: (v) => { this.setState({ rateValue: v }); message.info(`评分：${v} 星`); } }), h('span', { class: 'ml-sm text-secondary' }, `${this.state.rateValue} 星`)),
                h('div', { class: 'demo-row' }, h('span', { class: 'demo-row__label' }, '禁用'), h(Rate, { value: 4, disabled: true })),
                h('div', { class: 'demo-row' }, h('span', { class: 'demo-row__label' }, '自定义字符'), h(Rate, { value: 3, character: '👍' })),
            ],
        });
        this.registerChild(rateCard);
        // —— Slider ——
        const sliderCard = new Card({
            title: 'Slider 滑动输入条',
            children: [
                h('div', { class: 'mb-md' }, h(Slider, { value: this.state.sliderValue, min: 0, max: 100, onChange: (v) => this.setState({ sliderValue: v }) })),
                h('div', { class: 'mb-md' }, h(Slider, { value: this.state.sliderValue, showInput: true, onChange: (v) => this.setState({ sliderValue: v }) })),
                h('div', { class: 'text-secondary fs-sm' }, `当前值：${this.state.sliderValue}`),
            ],
        });
        this.registerChild(sliderCard);
        // —— Segmented ——
        const segmentedCard = new Card({
            title: 'Segmented 分段控制器',
            children: [
                h('div', { class: 'demo-row' }, h(Segmented, {
                    value: this.state.segmentedValue,
                    onChange: (v) => this.setState({ segmentedValue: v }),
                    options: [
                        { value: 'a', label: '选项 A' },
                        { value: 'b', label: '选项 B' },
                        { value: 'c', label: '选项 C' },
                    ],
                })),
                h('div', { class: 'demo-row' }, h(Segmented, {
                    block: true,
                    value: 'daily',
                    options: [
                        { value: 'daily', label: '日' },
                        { value: 'weekly', label: '周' },
                        { value: 'monthly', label: '月' },
                        { value: 'yearly', label: '年' },
                    ],
                })),
                h('div', { class: 'mt-sm text-secondary fs-sm' }, `当前选择：${this.state.segmentedValue}`),
            ],
        });
        this.registerChild(segmentedCard);
        // —— Anchor ——
        // Anchor 通过 items 配置锚点列表，点击链接平滑滚动到对应 href 目标元素。
        // 这里用静态示例展示外观；实际滚动联动需配合页面内同 id 元素。
        const anchorCard = new Card({
            title: 'Anchor 锚点',
            children: [
                h('div', { class: 'demo-row' }, h('span', { class: 'demo-row__label' }, '基本'), h(Anchor, {
                    affix: false,
                    items: [
                        { key: '1', href: '#anchor-1', title: '锚点一' },
                        { key: '2', href: '#anchor-2', title: '锚点二' },
                        { key: '3', href: '#anchor-3', title: '锚点三' },
                    ],
                })),
                h('div', { class: 'demo-row' }, h('span', { class: 'demo-row__label' }, '嵌套'), h(Anchor, {
                    affix: false,
                    items: [
                        { key: 'a', href: '#anchor-a', title: '一级 A' },
                        {
                            key: 'b', href: '#anchor-b', title: '一级 B',
                            children: [
                                { key: 'b-1', href: '#anchor-b-1', title: '二级 B-1' },
                                { key: 'b-2', href: '#anchor-b-2', title: '二级 B-2' },
                            ],
                        },
                    ],
                })),
            ],
        });
        this.registerChild(anchorCard);
        // —— PageHeader ——
        // PageHeader 用于展示页面标题区，支持返回按钮、标签、额外操作、面包屑、页脚等。
        const pageHeaderCard = new Card({
            title: 'PageHeader 页头',
            children: [
                h(PageHeader, {
                    title: '页面标题',
                    subtitle: '这是子标题',
                    onBack: () => message.info('点击返回'),
                }),
                h('div', { class: 'mt-md' }, h(PageHeader, {
                    title: '带标签与操作',
                    tags: [
                        h(Tag, { color: 'primary' }, '新'),
                        h(Tag, { color: 'success' }, '已完成'),
                    ],
                    extra: [
                        this._btn('操作', { type: 'primary', onClick: () => message.info('点击操作') }),
                    ],
                    footer: h('div', { class: 'text-secondary fs-sm' }, '这是页脚内容'),
                }, h('p', { class: 'text-secondary' }, '这是页面正文内容区域。'))),
            ],
        });
        this.registerChild(pageHeaderCard);
        // —— Affix ——
        // Affix 在滚动到指定位置时将元素固定在视口顶部 offsetTop 处。
        // 用 registerChild 注册以便页面卸载/重渲染时清理滚动监听。
        const affixCard = new Card({
            title: 'Affix 固钉',
            children: [
                h('p', { class: 'text-secondary' }, 'Affix 在滚动超过原始位置后将元素固定在视口顶部。向下滚动页面观察下方按钮的固定效果。'),
                (() => {
                    const affix = new Affix({
                        offsetTop: 0,
                        onChange: (fixed) => message.info(fixed ? '已固定' : '已取消固定'),
                        children: this._btn('固钉按钮', { type: 'primary' }),
                    });
                    this.registerChild(affix);
                    return affix.render();
                })(),
            ],
        });
        this.registerChild(affixCard);
        // —— FloatButton ——
        // FloatButton 默认 fixed 定位在右下角，这里通过 fixed:false 演示其外观。
        // 支持 tooltip、badge、shape、type 等配置。
        const floatButtonCard = new Card({
            title: 'FloatButton 浮动按钮',
            children: [
                h('p', { class: 'text-secondary' }, 'FloatButton 默认固定在页面右下角。下方通过 fixed:false 将按钮放在文档流内展示外观。'),
                h('div', { class: 'demo-row', style: { minHeight: '60px', alignItems: 'center' } }, h(FloatButton, { fixed: false, icon: '＋', type: 'primary', shape: 'circle', tooltip: '新增' }), h(FloatButton, { fixed: false, icon: '★', type: 'default', shape: 'circle', tooltip: '收藏' }), h(FloatButton, { fixed: false, icon: '?', type: 'primary', shape: 'circle', badge: { dot: true }, tooltip: '帮助' })),
            ],
        });
        this.registerChild(floatButtonCard);
        // Menu 导航菜单
        const menuItems = [
            { key: 'mail', label: '导航一', icon: '✉' },
            { key: 'app', label: '导航二', icon: '◆' },
            {
                key: 'submenu', label: '子菜单 - 点击展开', icon: '☰',
                children: [
                    { key: 'sub-1', label: '选项 1' },
                    { key: 'sub-2', label: '选项 2' },
                    { key: 'sub-3', label: '选项 3', disabled: true },
                ],
            },
            { key: 'disabled', label: '禁用项', disabled: true },
        ];
        const menuCard = new Card({
            title: 'Menu 导航菜单',
            children: [
                h('p', { class: 'text-secondary' }, '横向菜单（hover 子菜单自动展开）'),
                (() => {
                    const c = new Menu({
                        mode: 'horizontal', items: menuItems, selectedKeys: ['mail'],
                        onSelect: ({ key, keyPath }) => message.info(`Menu 选中：${key}，keyPath: ${JSON.stringify(keyPath)}`),
                    });
                    this.registerChild(c);
                    return c.render();
                })(),
                h('p', { class: 'text-secondary', style: 'margin-top:16px;' }, 'inline 菜单（点击展开子菜单）'),
                (() => {
                    const c = new Menu({
                        mode: 'inline', items: menuItems, selectedKeys: ['mail'],
                        onSelect: ({ key }) => message.info(`Menu 选中：${key}`),
                    });
                    this.registerChild(c);
                    return c.render();
                })(),
            ],
        });
        this.registerChild(menuCard);
        // Icon 图标
        const iconCard = new Card({
            title: 'Icon 图标（纯 inline SVG）',
            children: [
                h('p', { class: 'text-secondary' }, `内置 ${Icon.names.length} 个常用图标，支持 size / color / spin / rotate。`),
                h('div', { style: 'display:flex; flex-wrap:wrap; gap:24px; font-size:24px; margin-top:12px;' }, ...Icon.names.map((name) => h('div', {
                    style: 'display:flex; flex-direction:column; align-items:center; gap:4px; width:64px; padding:8px 0; border-radius:6px; cursor:pointer;',
                    title: name,
                    onClick: () => message.info(`点击图标：${name}`),
                }, (() => { const c = new Icon({ name, size: 24, color: 'var(--color-primary)' }); this.registerChild(c); return c.render(); })(), h('span', { style: 'font-size:11px; color:var(--color-text-tertiary);' }, name)))),
                h('p', { class: 'text-secondary', style: 'margin-top:16px;' }, '旋转图标示例：'),
                h('div', { style: 'display:flex; gap:24px; font-size:24px; align-items:center;' }, (() => { const c = new Icon({ name: 'reload', size: 24, color: 'var(--color-primary)' }); this.registerChild(c); return c.render(); })(), (() => { const c = new Icon({ name: 'reload', size: 32, color: '#52c41a', spin: true }); this.registerChild(c); return c.render(); })(), (() => { const c = new Icon({ name: 'setting', size: 28, color: '#faad14', spin: true }); this.registerChild(c); return c.render(); })(), (() => { const c = new Icon({ name: 'arrowLeft', size: 24, rotate: 180 }); this.registerChild(c); return c.render(); })()),
            ],
        });
        this.registerChild(iconCard);
        return [
            h('h2', { class: 'section-title' }, '导航与交互组件'),
            h('p', { class: 'text-secondary mb-lg' }, 'Breadcrumb / Tooltip / Popover / Collapse / Dropdown / Pagination / Steps / Timeline / Rate / Slider / Segmented / Anchor / PageHeader / Affix / FloatButton / Menu / Icon 等导航交互组件。'),
            breadcrumbCard.render(),
            tooltipCard.render(),
            popoverCard.render(),
            collapseCard.render(),
            dropdownCard.render(),
            paginationCard.render(),
            stepsCard.render(),
            timelineCard.render(),
            rateCard.render(),
            sliderCard.render(),
            segmentedCard.render(),
            anchorCard.render(),
            pageHeaderCard.render(),
            affixCard.render(),
            floatButtonCard.render(),
            menuCard.render(),
            iconCard.render(),
        ];
    }
}
//# sourceMappingURL=NavigationComponentsPage.js.map