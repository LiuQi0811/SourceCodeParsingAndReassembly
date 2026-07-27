// HomePage.ts —— WebPlatform Lab 首页：Hero + 特性卡片 + Canvas 仪表盘
// 演示 MDN：Canvas 2D、requestAnimationFrame、setInterval、IntersectionObserver
import { Page } from '../core/Component.js';
import { h, request } from '../core/utils.js';
import { Button } from '../components/ui/Button.js';
import { Card } from '../components/ui/Card.js';
import { Tag } from '../components/ui/Tag.js';
const FEATURES = [
    { icon: '↹', title: '自研路由系统', desc: '基于 History API 实现 push/replace/go/守卫/嵌套/动态参数，零依赖。', tags: ['History API', 'popstate', '编程式导航'], path: '/router' },
    { icon: '◍', title: 'Ant Design 风格组件库', desc: 'Button、Card、Table、Modal、Form 等组件，纯原生 CSS 实现。', tags: ['CSS 变量', 'OOP', '多态'], path: '/components/basic' },
    { icon: '⚙', title: 'Web API 实验室', desc: 'Storage、Fetch、Canvas、Worker、Observer、多媒体 API 全覆盖。', tags: ['MDN', '实战'], path: '/api-lab/history' },
    { icon: '◈', title: '设计模式实战', desc: '观察者、单例、工厂、模板方法、策略、装饰器、命令模式一应俱全。', tags: ['OOP', '继承', '多态'], path: '/about' },
];
// 打字机标题
const TYPE_TEXT = '用原生 Web API 构建现代 SPA';
export class HomePage extends Page {
    _typeTimer = null;
    _canvasRaf = null;
    _coverageObserver = null;
    // typed 初始即完整文本：若 JS 禁用或打字机未启动，标题也能正常显示。
    // 打字机作为渐进增强：启动时清空再逐字打出。重渲染时 state.typed 保持完整文本，
    // 不会因 _loadArticles 的 setState 覆盖打字机已写的进度。
    initialState() { return { typed: TYPE_TEXT, articles: [], loading: true }; }
    componentDidMount() {
        this._startTyping();
        this._loadArticles().then(() => {
            // 等 _loadArticles 的 setState 触发的 rerender 完成后再 observe canvas，
            // 否则 canvas 会被 rerender 重建，observe 的是已脱离 DOM 的旧 canvas，
            // IntersectionObserver 永远不会触发回调，统计图不展示。
            this._animateCoverage();
        });
    }
    componentWillUnmount() {
        if (this._typeTimer)
            clearInterval(this._typeTimer);
        if (this._canvasRaf)
            cancelAnimationFrame(this._canvasRaf);
        this._coverageObserver?.disconnect();
    }
    _startTyping() {
        // 注意：不要用 setState 同步 typed 文本——每 80ms 一次 setState 会触发整页 _rerender，
        // 重建 2 个 Button + 16 个 Card + 数百 Tag 节点，导致首页持续闪烁（与 canvas 同源问题）。
        // 直接写 DOM 即可，文本只是展示用，无需进入 state。
        const typedEl = this.$('#typed-text');
        if (!typedEl)
            return;
        typedEl.textContent = ''; // 清空，从第一个字开始打
        let i = 0;
        this._typeTimer = setInterval(() => {
            i++;
            typedEl.textContent = TYPE_TEXT.slice(0, i);
            if (i >= TYPE_TEXT.length)
                clearInterval(this._typeTimer);
        }, 80);
    }
    async _loadArticles() {
        try {
            const data = await request('/assets/data/articles.json');
            this.setState({ articles: data, loading: false });
        }
        catch (err) {
            console.error('加载文章失败', err);
            this.setState({ loading: false });
        }
    }
    _animateCoverage() {
        // IntersectionObserver：仪表盘进入视口才动画
        const canvas = this.$('#coverage-canvas');
        if (!canvas)
            return;
        this._coverageObserver = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting)
                    this._drawDonut(canvas);
            });
        }, { threshold: 0.3 });
        this._coverageObserver.observe(canvas);
    }
    _drawDonut(canvas) {
        const ctx = canvas.getContext('2d');
        if (!ctx)
            return;
        const dpr = window.devicePixelRatio || 1;
        const size = 220;
        canvas.width = size * dpr;
        canvas.height = size * dpr;
        canvas.style.width = `${size}px`;
        canvas.style.height = `${size}px`;
        ctx.scale(dpr, dpr);
        const cx = size / 2, cy = size / 2;
        const radius = 80;
        const lineWidth = 18;
        const target = 86; // 目标覆盖率
        const start = performance.now();
        const duration = 1500;
        const animate = (now) => {
            const t = Math.min(1, (now - start) / duration);
            const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
            const value = target * eased;
            ctx.clearRect(0, 0, size, size);
            // 背景圆环
            ctx.beginPath();
            ctx.arc(cx, cy, radius, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(128,128,128,0.15)';
            ctx.lineWidth = lineWidth;
            ctx.stroke();
            // 进度圆环（渐变）
            const grad = ctx.createLinearGradient(0, 0, size, size);
            grad.addColorStop(0, '#1677ff');
            grad.addColorStop(1, '#722ed1');
            ctx.beginPath();
            ctx.arc(cx, cy, radius, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * value) / 100);
            ctx.strokeStyle = grad;
            ctx.lineWidth = lineWidth;
            ctx.lineCap = 'round';
            ctx.stroke();
            // 中心文字
            ctx.fillStyle = '#1677ff';
            ctx.font = 'bold 36px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(`${Math.round(value)}%`, cx, cy - 6);
            ctx.fillStyle = 'rgba(128,128,128,0.7)';
            ctx.font = '12px sans-serif';
            ctx.fillText('MDN API 覆盖', cx, cy + 22);
            // 注意：不要在 rAF 循环里调用 setState，否则每帧都会触发整页 _rerender，
            // 导致 canvas 被重建、IntersectionObserver 重新触发、动画从头开始——形成"无限闪屏"。
            // 覆盖率数值已直接绘制在 canvas 上，无需同步到 state。
            if (t < 1)
                this._canvasRaf = requestAnimationFrame(animate);
        };
        this._canvasRaf = requestAnimationFrame(animate);
    }
    renderPage() {
        const cta1 = new Button({
            type: 'primary', size: 'lg',
            children: '探索组件库',
            onClick: () => this.props.router.push('/components/basic'),
        });
        this.registerChild(cta1);
        const cta2 = new Button({
            size: 'lg',
            children: '查看路由示例',
            onClick: () => this.props.router.push('/router'),
        });
        this.registerChild(cta2);
        return [
            // Hero
            h('section', { class: 'home-hero' }, h('div', { class: 'home-hero__content' }, h('span', { class: 'home-hero__badge' }, '✦ 零依赖 · 纯原生 · OOP'), h('h1', { class: 'home-hero__title' }, h('span', { id: 'typed-text' }, this.state.typed), h('span', { class: 'cursor' })), h('p', { class: 'home-hero__subtitle' }, 'WebPlatform Lab —— 借鉴 MDN Web 文档组织形式，用浏览器原生 API 自主实现路由系统、UI 组件库与状态管理，覆盖 178 个 Web API 深度页面。每一行代码都可被阅读、调试与学习。'), h('div', { class: 'home-hero__actions' }, cta1.render(), cta2.render()))),
            // 特性卡片
            h('h2', { class: 'section-title' }, '核心特性'),
            h('div', { class: 'feature-grid' }, ...FEATURES.map((f) => {
                const card = new Card({
                    title: h('div', { class: 'flex items-center gap-sm' }, h('span', { class: 'feature-card__icon', style: { display: 'inline-grid' } }, f.icon), h('span', {}, f.title)),
                    hoverable: true,
                    children: [
                        h('p', { class: 'feature-card__desc' }, f.desc),
                        h('div', { class: 'feature-card__meta' }, ...f.tags.map((t) => h(Tag, { color: 'primary' }, t))),
                    ],
                });
                this.registerChild(card);
                const node = card.render();
                node.classList.add('feature-card');
                node.addEventListener('click', () => this.props.router.push(f.path));
                return node;
            })),
            // API 覆盖仪表盘
            h('h2', { class: 'section-title' }, 'MDN Web API 覆盖度'),
            h('div', { class: 'dashboard' }, h('div', { class: 'dashboard__chart' }, h('canvas', { id: 'coverage-canvas' })), h('div', { class: 'dashboard__list' }, ...[
                { api: 'History API', weight: 100 },
                { api: 'DOM / CustomEvent', weight: 100 },
                { api: 'Fetch / AbortController', weight: 100 },
                { api: 'Storage（local/session/Cookie）', weight: 100 },
                { api: 'Canvas 2D', weight: 90 },
                { api: 'requestAnimationFrame', weight: 100 },
                { api: 'Web Workers / BigInt', weight: 100 },
                { api: 'IntersectionObserver', weight: 100 },
                { api: 'MutationObserver', weight: 100 },
                { api: 'ResizeObserver', weight: 100 },
                { api: 'Clipboard / Geolocation', weight: 90 },
                { api: 'Drag & Drop / Web Audio', weight: 85 },
            ].map((item) => h('div', { class: 'dashboard__item' }, h('span', {}, item.api), h('span', { class: `tag ${item.weight >= 100 ? 'tag--success' : 'tag--warning'}` }, `${item.weight}%`))))),
            // 文章列表（Fetch 演示）
            h('h2', { class: 'section-title mt-lg' }, '文章列表（Fetch 加载）'),
            h('div', { class: 'feature-grid' }, this.state.loading
                ? [0, 1, 2].map(() => h('div', { class: 'card' }, h('div', { class: 'card__body' }, h('div', { class: 'skeleton', style: { height: '120px' } }))))
                : this.state.articles.map((a) => {
                    const card = new Card({
                        title: a.title,
                        hoverable: true,
                        children: [
                            h('div', { class: 'flex items-center gap-xs mb-sm' }, h(Tag, { color: 'primary' }, a.category), h('span', { class: 'fs-sm text-tertiary' }, `${a.readTime} 分钟阅读`)),
                            h('p', { class: 'text-secondary fs-sm' }, a.summary),
                        ],
                    });
                    this.registerChild(card);
                    return card.render();
                })),
        ];
    }
}
//# sourceMappingURL=HomePage.js.map