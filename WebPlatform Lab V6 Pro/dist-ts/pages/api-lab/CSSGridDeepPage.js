// =====================================================================
// CSSGridDeepPage.js —— CSS Grid Layout 深度 实验室
// 完整覆盖 CSS Grid Layout Module Level 1 + Level 2 (subgrid)，演示
// 二维网格布局的全套能力，是现代 CSS 布局的核心模块：
//   1. display: grid / inline-grid —— 声明网格容器
//   2. grid-template-columns / grid-template-rows —— 显式网格轨道
//      轨道尺寸取值：length / percentage / fr / auto / min-content /
//      max-content / minmax(min, max) / fit-content()
//   3. fr 单位 —— flexible fraction，按比例分配剩余空间（类似 flex-grow）
//   4. minmax(min, max) —— 轨道最小最大值约束
//   5. repeat() —— 重复轨道简写
//      repeat(n, track) 固定次数
//      repeat(auto-fill, minmax(200px, 1fr)) 自动填充（保留空列）
//      repeat(auto-fit, minmax(200px, 1fr)) 自动适配（空列折叠拉伸）
//   6. grid-template-areas —— 字符串命名区域布局
//      每行引号包裹，空格分隔区域名，. 表示空单元格
//      grid-area: <name> 项目放入命名区域
//   7. 命名网格线 —— [start] 200px [content-start] 1fr [end]
//      grid-column / grid-row / grid-area（行起/列起/行止/列止 简写）
//      span N 跨越 N 条轨道
//   8. grid-auto-flow —— 自动放置算法
//      row（默认）/ column / dense / row dense / column dense
//      grid-auto-columns / grid-auto-rows 隐式网格轨道尺寸
//   9. gap / align-items / justify-items / place-items —— 项目对齐
//      justify-content / align-content / place-content —— 网格整体对齐
//  10. subgrid（Level 2）—— 子网格继承父网格轨道
//      grid-template-columns: subgrid / grid-template-rows: subgrid
//      Chrome 117+/Firefox 71+/Safari 16+
//  11. vs Flexbox 决策树：一维→Flex，二维→Grid；内容驱动→Flex，布局驱动→Grid
// 说明：jsdom 不做真实布局，但 CSS.supports 可探测属性支持；
//       注入演示样式 + 完整代码示例，真实浏览器可查看效果。
// =====================================================================
import { Page } from '../../core/Component.js';
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';
export class CSSGridDeepPage extends Page {
    _inited = false;
    _dynamicStyles = [];
    initialState() {
        return {
            logs: [],
            capsSummary: '',
            basicsInfo: '', // Card 1：Grid 容器基础与显式网格
            repeatInfo: '', // Card 2：repeat() / auto-fill / auto-fit
            areasInfo: '', // Card 3：grid-template-areas 命名网格布局
            linesInfo: '', // Card 4：命名网格线 / grid-column / grid-row / grid-area
            flowInfo: '', // Card 5：grid-auto-flow 自动放置算法
            alignInfo: '', // Card 6：gap / align-items / justify-items 对齐
            subgridInfo: '', // Card 7：Subgrid（Level 2）与嵌套网格
            patternInfo: '', // Card 8：实战布局模式与 vs Flexbox
        };
    }
    componentDidMount() {
        if (this._inited)
            return;
        this._inited = true;
        this._dynamicStyles = [];
        const f = this._flags();
        const c = (ok) => ok ? '✓' : '✗';
        const parts = [
            `grid ${c(f.grid)}`,
            `inline-grid ${c(f.inlineGrid)}`,
            `fr ${c(f.fr)}`,
            `minmax() ${c(f.minmax)}`,
            `repeat() ${c(f.repeat)}`,
            `auto-fill ${c(f.autoFill)}`,
            `auto-fit ${c(f.autoFit)}`,
            `subgrid ${c(f.subgrid)}`,
            `gap ${c(f.gap)}`,
            `grid-area ${c(f.gridArea)}`,
            `dense ${c(f.gridAutoFlowDense)}`,
        ];
        const summary = f.css
            ? `CSS Grid 能力检测：${parts.join(' · ')}。jsdom 不做真实布局，但 CSS.supports 可探测属性支持；按钮点击注入演示样式 + 完整代码示例，真实浏览器（Chrome/Edge/Firefox/Safari 全线支持 Grid L1，subgrid 需 Chrome 117+/Firefox 71+/Safari 16+）可查看效果。`
            : '当前环境不支持 CSS 全局对象（typeof CSS === "undefined"）；所有按钮点击仅记日志说明，不会抛异常。';
        this.setState({ capsSummary: summary });
        this._addLog(f.css ? 'info' : 'warn', `能力检测：${parts.join('，')}`);
        if (!f.subgrid)
            this._addLog('warn', 'subgrid 不可用（Chrome 117+/Firefox 71+/Safari 16+ 起支持）');
        if (!f.gridAutoFlowDense)
            this._addLog('warn', 'grid-auto-flow: dense 不可用');
        this._injectBaseStyles();
    }
    componentWillUnmount() {
        for (const style of this._dynamicStyles) {
            try {
                style.parentNode && style.parentNode.removeChild(style);
            }
            catch { /* noop */ }
        }
        this._dynamicStyles = [];
    }
    // —— 辅助方法 ——
    _addLog(type, content) {
        this.setState({ logs: [...this.state.logs, { type, content, time: formatTime() }].slice(-40) });
    }
    _btn(label, opts) {
        const btn = new Button({ ...opts, children: label, onClick: opts.onClick });
        this.registerChild(btn);
        return btn.render();
    }
    _caps(items) {
        return items.map(([label, ok]) => h(Tag, { color: ok ? 'success' : 'error' }, `${label} ${ok ? '✓' : '✗'}`));
    }
    _injectStyle(id, css) {
        const existing = document.getElementById(id);
        if (existing)
            existing.remove();
        const style = document.createElement('style');
        style.id = id;
        style.textContent = css;
        document.head.appendChild(style);
        this._dynamicStyles.push(style);
    }
    _injectBaseStyles() {
        this._injectStyle('css-grid-base', `
      .cg-demo {
        padding: 12px;
        background: #f8fafc;
        border: 1px solid #cbd5e1;
        border-radius: 8px;
        margin-top: 10px;
      }
      .cg-grid {
        display: grid;
        gap: 6px;
        margin-top: 8px;
      }
      .cg-cell {
        background: #3b82f6;
        color: #fff;
        padding: 10px 8px;
        border-radius: 4px;
        text-align: center;
        font-size: 12px;
        font-weight: 600;
      }
      .cg-cell.cg-alt { background: #1e40af; }
      .cg-cell.cg-warn { background: #ef4444; }
      .cg-cell.cg-ok { background: #10b981; }
      .cg-areas {
        display: grid;
        grid-template-areas:
          "header header header"
          "sidebar main main"
          "footer footer footer";
        grid-template-columns: 120px 1fr 1fr;
        grid-template-rows: 50px 1fr 40px;
        gap: 4px;
        margin-top: 8px;
        min-height: 180px;
      }
      .cg-area { background: #e0e7ff; padding: 8px; border-radius: 4px; font-size: 11px; color: #1e3a8a; display: flex; align-items: center; justify-content: center; font-weight: 600; }
      .cg-area--header { grid-area: header; background: #c7d2fe; }
      .cg-area--sidebar { grid-area: sidebar; background: #ddd6fe; }
      .cg-area--main { grid-area: main; background: #bfdbfe; }
      .cg-area--footer { grid-area: footer; background: #c7d2fe; }
      .cg-output {
        background: #0f172a;
        color: #e2e8f0;
        border-radius: 4px;
        padding: 8px;
        font-family: monospace;
        font-size: 11px;
        white-space: pre-wrap;
        word-break: break-all;
        margin-top: 8px;
      }
    `);
    }
    _flags() {
        const hasCSS = typeof CSS !== 'undefined';
        const supportsPV = (p, v) => {
            try {
                return hasCSS && typeof CSS.supports === 'function' && CSS.supports(p, v);
            }
            catch {
                return false;
            }
        };
        return {
            css: hasCSS,
            supports: hasCSS && typeof CSS.supports === 'function',
            grid: supportsPV('display', 'grid'),
            inlineGrid: supportsPV('display', 'inline-grid'),
            fr: supportsPV('grid-template-columns', '1fr'),
            minmax: supportsPV('grid-template-columns', 'minmax(100px, 1fr)'),
            repeat: supportsPV('grid-template-columns', 'repeat(2, 100px)'),
            autoFill: supportsPV('grid-template-columns', 'repeat(auto-fill, 1fr)'),
            autoFit: supportsPV('grid-template-columns', 'repeat(auto-fit, 1fr)'),
            subgrid: supportsPV('grid-template-columns', 'subgrid'),
            gap: supportsPV('gap', '10px'),
            gridArea: supportsPV('grid-area', '1 / 1 / 2 / 2'),
            gridAutoFlowDense: supportsPV('grid-auto-flow', 'dense'),
        };
    }
    // ===================== Card 1：Grid 容器基础与显式网格 =====================
    _runBasicsDemo() {
        const f = this._flags();
        this._injectStyle('cg-basics-demo', `
      .cg-basics-fixed {
        display: grid;
        grid-template-columns: 100px 200px 100px;
        gap: 6px;
        margin-top: 8px;
      }
      .cg-basics-fr {
        display: grid;
        grid-template-columns: 1fr 2fr 1fr;
        gap: 6px;
        margin-top: 8px;
      }
      .cg-basics-minmax {
        display: grid;
        grid-template-columns: minmax(120px, 1fr) minmax(200px, 2fr);
        gap: 6px;
        margin-top: 8px;
      }
      .cg-basics-auto {
        display: grid;
        grid-template-columns: auto 1fr auto;
        gap: 6px;
        margin-top: 8px;
      }
    `);
        const info = [
            '===== CSS Grid 容器基础与显式网格 =====',
            '',
            '【动机】',
            '  Flexbox 是一维布局（一次只控制行或列），',
            '  Grid 是二维布局（同时控制行和列），',
            '  适合结构性布局（页面骨架、表单、卡片墙、仪表盘）。',
            '',
            '【display: grid / inline-grid】',
            '  .container { display: grid; }        /* 块级网格容器 */',
            '  .container { display: inline-grid; } /* 行内网格容器 */',
            '  // 子元素（grid items）自动成为网格项目',
            '  // 容器外层仍按 display 规则参与文档流',
            '',
            '【显式网格：grid-template-columns / grid-template-rows】',
            '  .container {',
            '    display: grid;',
            '    grid-template-columns: 100px 200px 100px;  /* 三列固定宽度 */',
            '    grid-template-rows: 50px 1fr;              /* 两行，第二行弹性 */',
            '  }',
            '  // 列定义之间用空格分隔，数量决定显式列数',
            '',
            '【轨道尺寸取值全集】',
            '  length        100px / 2em / 1rem      绝对长度',
            '  percentage    50% / 25%               相对容器尺寸',
            '  fr            1fr / 2fr               弹性份额（按比例分配剩余空间）',
            '  auto          auto                    自动：按内容/剩余空间',
            '  min-content   min-content             最小内容尺寸',
            '  max-content   max-content             最大内容尺寸（不换行）',
            '  fit-content   fit-content(200px)      内容驱动但不超过上限',
            '  minmax()      minmax(100px, 1fr)      最小最大值约束',
            '',
            '【fr 单位详解（flexible fraction）】',
            '  fr 是 Grid 独有的弹性单位，类似 flex-grow：',
            '  - 容器先满足所有固定/百分比/auto 轨道',
            '  - 剩余空间按 fr 比例分配给弹性轨道',
            '',
            '  grid-template-columns: 1fr 2fr 1fr;',
            '  // 总宽 600px，无固定列 → 剩余 600px 按 1:2:1 分配',
            '  // 第 1 列 150px，第 2 列 300px，第 3 列 150px',
            '',
            '  grid-template-columns: 200px 1fr 2fr;',
            '  // 总宽 600px，先扣 200px 固定，剩 400px 按 1:2 分配',
            '  // 第 2 列 133.3px，第 3 列 266.7px',
            '',
            '  注意：fr 单位的最小尺寸是 auto（按内容），',
            '  内容超出时会撑破分配比例，用 minmax(0, 1fr) 强制遵守。',
            '',
            '【minmax(min, max) 函数】',
            '  minmax(min, max) 约束轨道的最小最大值：',
            '  - 内容少时不会小于 min',
            '  - 内容多时不会超过 max（除非 max 是 fr）',
            '',
            '  grid-template-columns: minmax(120px, 1fr) minmax(200px, 2fr);',
            '  // 第 1 列至少 120px，最多占剩余空间的 1/(1+2)',
            '  // 第 2 列至少 200px，最多占剩余空间的 2/(1+2)',
            '',
            '  minmax(0, 1fr)         // 强制 1fr 不被内容撑大（常见防溢出）',
            '  minmax(100px, auto)    // 至少 100px，可按内容增长',
            '  minmax(auto, 300px)    // 按内容但不超过 300px',
            '',
            '【auto 关键字】',
            '  grid-template-columns: auto 1fr auto;',
            '  // 第 1、3 列按内容尺寸，第 2 列吃掉剩余空间',
            '  // 常见表单布局：label auto | input 1fr | button auto',
            '',
            '【min-content / max-content】',
            '  .col-min { grid-template-columns: min-content 1fr; }',
            '  // 第 1 列取最长单词的宽度（最窄不换行）',
            '  .col-max { grid-template-columns: max-content 1fr; }',
            '  // 第 1 列取整行不换行的宽度',
            '',
            '【固定列 vs 弹性列 vs 自适应列组合】',
            '  .container {',
            '    grid-template-columns:',
            '      200px           /* 固定侧边栏 */',
            '      minmax(0, 1fr)  /* 弹性主内容（minmax(0,1fr) 防溢出）*/',
            '      minmax(150px, 250px); /* 半弹性辅助列 */',
            '  }',
            '',
            '【完整代码示例】',
            '  <div class="container">',
            '    <div>A</div><div>B</div><div>C</div>',
            '  </div>',
            '',
            '  .container {',
            '    display: grid;',
            '    grid-template-columns: 1fr 2fr 1fr;',
            '    grid-template-rows: 100px;',
            '    gap: 8px;',
            '  }',
            '',
            '【浏览器支持】',
            `  display: grid: ${f.grid ? '✓' : '✗'} (IE 10 部分支持，Chrome 57+/Firefox 52+/Safari 10.1+ 完整)`,
            `  inline-grid: ${f.inlineGrid ? '✓' : '✗'}`,
            `  fr 单位: ${f.fr ? '✓' : '✗'}`,
            `  minmax(): ${f.minmax ? '✓' : '✗'}`,
            '',
            '【常见陷阱】',
            '  1. fr 会被内容撑大：用 minmax(0, 1fr) 强制遵守比例',
            '  2. 百分比 + gap 会导致总宽 > 100%：用 fr 或减去 gap',
            '  3. grid-template-rows 默认 auto：行高跟随内容',
            '  4. 子元素 float/vertical-align 在 grid item 上失效（正常）',
            '  5. 子元素 display 设为 contents 可「穿透」到孙节点',
        ].join('\n');
        this.setState({ basicsInfo: info });
        this._addLog('css', `Grid 容器基础演示完成；supports=${f.grid}/${f.fr}/${f.minmax}`);
    }
    _renderCard1() {
        const s = this.state;
        const f = this._flags();
        const card = new Card({
            title: '1. Grid 容器基础与显式网格 —— display: grid + grid-template-*',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([
                ['grid', f.grid],
                ['inline-grid', f.inlineGrid],
                ['fr', f.fr],
                ['minmax()', f.minmax],
            ]), h(Tag, { color: 'primary' }, 'Grid L1')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'display: grid / inline-grid 声明网格容器，grid-template-columns / grid-template-rows 定义显式网格。轨道尺寸取值：length / percentage / fr（弹性份额，类似 flex-grow）/ auto / min-content / max-content / minmax(min, max) / fit-content()。fr 按比例分配剩余空间，minmax 约束最小最大值。常见防溢出技巧：minmax(0, 1fr) 强制 fr 不被内容撑大。'),
                h('div', { class: 'cg-demo' }, h('div', { class: 'fs-sm text-secondary' }, '固定列：100px 200px 100px'), h('div', { class: 'cg-grid cg-basics-fixed' }, h('div', { class: 'cg-cell' }, '100'), h('div', { class: 'cg-cell cg-alt' }, '200'), h('div', { class: 'cg-cell' }, '100')), h('div', { class: 'fs-sm text-secondary mt-sm' }, 'fr 比例：1fr 2fr 1fr'), h('div', { class: 'cg-grid cg-basics-fr' }, h('div', { class: 'cg-cell' }, '1fr'), h('div', { class: 'cg-cell cg-alt' }, '2fr'), h('div', { class: 'cg-cell' }, '1fr')), h('div', { class: 'fs-sm text-secondary mt-sm' }, 'minmax 约束：minmax(120px,1fr) minmax(200px,2fr)'), h('div', { class: 'cg-grid cg-basics-minmax' }, h('div', { class: 'cg-cell' }, 'minmax(120,1fr)'), h('div', { class: 'cg-cell cg-alt' }, 'minmax(200,2fr)')), h('div', { class: 'fs-sm text-secondary mt-sm' }, 'auto 1fr auto（表单布局）'), h('div', { class: 'cg-grid cg-basics-auto' }, h('div', { class: 'cg-cell' }, 'auto'), h('div', { class: 'cg-cell cg-alt' }, '1fr'), h('div', { class: 'cg-cell' }, 'auto'))),
                h('div', { class: 'flex items-center gap-sm flex-wrap mt-md' }, this._btn('运行基础演示', { type: 'primary', size: 'sm', onClick: () => this._runBasicsDemo() })),
                h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
                h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } }, h('code', {}, s.basicsInfo || '（点击按钮查看 Grid 容器基础与显式网格完整用法）')),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // ===================== Card 2：repeat() / auto-fill / auto-fit =====================
    _runRepeatDemo() {
        const f = this._flags();
        const info = [
            '===== repeat() / auto-fill / auto-fit —— 响应式网格核心 =====',
            '',
            '【repeat() 语法】',
            '  grid-template-columns: repeat(<count>, <track-list>);',
            '',
            '  <count> 取值：',
            '    <integer>          固定次数：repeat(3, 1fr)',
            '    auto-fill          自动填充：尽可能多列，空列保留',
            '    auto-fit           自动适配：空列折叠，现有列拉伸填满',
            '',
            '【repeat(n, track) 固定次数】',
            '  .grid { grid-template-columns: repeat(3, 100px); }',
            '  // 等价于 100px 100px 100px',
            '',
            '  .grid { grid-template-columns: repeat(4, 1fr); }',
            '  // 等价于 1fr 1fr 1fr 1fr，四等分',
            '',
            '【repeat() 内可混合多个轨道】',
            '  .grid { grid-template-columns: repeat(3, 100px 1fr); }',
            '  // 等价于 100px 1fr 100px 1fr 100px 1fr（共 6 列）',
            '',
            '  .grid { grid-template-columns: repeat(2, 200px [line]) 100px; }',
            '  // 200px [line] 200px [line] 100px，含命名线',
            '',
            '【repeat(auto-fill, minmax(200px, 1fr)) 自动填充】',
            '  .grid {',
            '    display: grid;',
            '    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));',
            '    gap: 16px;',
            '  }',
            '  // 浏览器自动计算：容器宽度 / 200px = 列数',
            '  // 容器 900px → 4 列（每列 min 200px，剩余按 1fr 平分）',
            '  // 容器 500px → 2 列',
            '  // 容器 300px → 1 列',
            '  // 项目少于列数时，空列位置保留（空白）',
            '',
            '【repeat(auto-fit, minmax(200px, 1fr)) 自动适配】',
            '  .grid {',
            '    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));',
            '    gap: 16px;',
            '  }',
            '  // 行为同 auto-fill，但项目少于列数时：',
            '  // 空列折叠为 0，现有列拉伸填满整个容器宽度',
            '',
            '【auto-fill vs auto-fit 精确区别】',
            '  假设容器 800px，minmax(200px, 1fr)，只有 2 个项目：',
            '',
            '  auto-fill：',
            '    浏览器计算最多 4 列（800/200），创建 4 个轨道',
            '    2 个项目占 2 列，剩下 2 列空着（空白区域）',
            '    项目宽度 = minmax(200, 800/4) = 200px',
            '',
            '  auto-fit：',
            '    浏览器同样计算最多 4 列',
            '    2 个项目占 2 列，剩下 2 列折叠为 0 宽度',
            '    项目拉伸填满：800/2 = 400px 每列',
            '',
            '  口诀：项目填满时两者相同；项目稀疏时 auto-fit 拉伸，auto-fill 保留空位',
            '',
            '【minmax(200px, 1fr) 实现无媒体查询响应式】',
            '  .cards {',
            '    display: grid;',
            '    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));',
            '    gap: 16px;',
            '  }',
            '  // 一行 CSS 实现：',
            '  // - 宽屏自动多列',
            '  // - 窄屏自动少列',
            '  // - 每列至少 200px',
            '  // - 项目少时拉伸填满',
            '  // - 无需任何 @media 断点',
            '  // 这就是著名的「The Math of CSS Grid」',
            '',
            '【minmax 的 min 用 ch 单位（响应文本）】',
            '  .article-cards {',
            '    grid-template-columns: repeat(auto-fit, minmax(min(100%, 25ch), 1fr));',
            '  }',
            '  // min(100%, 25ch)：窄屏取 100%（单列），宽屏取 25ch',
            '  // 实现「窄屏单列，宽屏多列，每列约 25 字符宽」',
            '',
            '【auto-fill/auto-fit 与显式列混用】',
            '  .grid {',
            '    grid-template-columns: 200px repeat(auto-fit, minmax(150px, 1fr));',
            '  }',
            '  // 第 1 列固定 200px，剩余空间用 auto-fit 填充',
            '',
            '【响应式断点用 min() 函数】',
            '  .grid {',
            '    grid-template-columns:',
            '      repeat(auto-fit, minmax(min(100%, 240px), 1fr));',
            '  }',
            '  // min(100%, 240px) 确保 240px 不超过容器宽度',
            '  // 容器 < 240px 时取 100%（强制单列）',
            '',
            '【完整代码示例：响应式卡片墙】',
            '  <div class="cards">',
            '    <div class="card">卡片 1</div>',
            '    <div class="card">卡片 2</div>',
            '    <div class="card">卡片 3</div>',
            '    <div class="card">卡片 4</div>',
            '    <div class="card">卡片 5</div>',
            '  </div>',
            '',
            '  .cards {',
            '    display: grid;',
            '    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));',
            '    gap: 16px;',
            '    padding: 16px;',
            '  }',
            '  .card {',
            '    background: #fff;',
            '    border: 1px solid #e5e7eb;',
            '    border-radius: 8px;',
            '    padding: 16px;',
            '  }',
            '',
            '【浏览器支持】',
            `  repeat(): ${f.repeat ? '✓' : '✗'}`,
            `  auto-fill: ${f.autoFill ? '✓' : '✗'}`,
            `  auto-fit: ${f.autoFit ? '✓' : '✗'}`,
            '  Chrome 57+/Firefox 52+/Safari 10.1+ 完整支持',
            '',
            '【常见陷阱】',
            '  1. auto-fill/auto-fit 必须配合 minmax()，否则只能 1 列',
            '  2. minmax 的 min 太大（如 500px）窄屏会溢出',
            '  3. minmax(200px, 1fr) 的 1fr 在 auto-fit 下是「最大值」语义',
            '  4. auto-fit 折叠空列后项目实际尺寸 ≠ minmax 的 max',
            '  5. 项目数固定且不响应式时，直接写 repeat(n, 1fr) 更直观',
        ].join('\n');
        this.setState({ repeatInfo: info });
        this._addLog('css', `repeat()/auto-fill/auto-fit 演示完成；supports=${f.repeat}/${f.autoFill}/${f.autoFit}`);
    }
    _renderCard2() {
        const s = this.state;
        const f = this._flags();
        const card = new Card({
            title: '2. repeat() / auto-fill / auto-fit —— 响应式网格核心',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([
                ['repeat()', f.repeat],
                ['auto-fill', f.autoFill],
                ['auto-fit', f.autoFit],
            ]), h(Tag, { color: 'primary' }, '响应式')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'repeat(n, track) 重复固定次数，repeat(auto-fill, minmax(200px, 1fr)) 自动填充（尽可能多列，空列保留），repeat(auto-fit, minmax(200px, 1fr)) 自动适配（空列折叠，现有列拉伸填满）。minmax(200px, 1fr) 实现无媒体查询的响应式卡片网格。auto-fill vs auto-fit 关键区别：项目少于列数时 auto-fit 拉伸项目，auto-fill 保留空位。repeat() 内可混合多轨道：repeat(3, 100px 1fr) = 100px 1fr 100px 1fr 100px 1fr。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('运行 repeat 演示', { type: 'primary', size: 'sm', onClick: () => this._runRepeatDemo() })),
                h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
                h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } }, h('code', {}, s.repeatInfo || '（点击按钮查看 repeat() / auto-fill / auto-fit 完整用法）')),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // ===================== Card 3：grid-template-areas 命名网格布局 =====================
    _runAreasDemo() {
        const f = this._flags();
        const info = [
            '===== grid-template-areas —— 字符串命名网格布局 =====',
            '',
            '【动机】',
            '  传统布局用数字坐标（grid-column: 1 / 3）难读难改，',
            '  grid-template-areas 用字符串命名区域，可视化定义布局结构，',
            '  是 Grid 最直观、最易维护的特性。',
            '',
            '【语法】',
            '  .container {',
            '    display: grid;',
            '    grid-template-areas:',
            '      "header header header"',
            '      "sidebar main main"',
            '      "footer footer footer";',
            '    grid-template-columns: 200px 1fr 1fr;',
            '    grid-template-rows: auto 1fr auto;',
            '  }',
            '',
            '  规则：',
            '  - 每行用双引号包裹，行内用空格分隔区域名',
            '  - 每行单元格数必须等于 grid-template-columns 列数',
            '  - 行数由引号字符串数量决定',
            '  - . 表示空单元格（无区域归属）',
            '  - 同名区域必须相邻形成矩形（不能 L 形、不能分裂）',
            '',
            '【项目放入命名区域】',
            '  .header { grid-area: header; }',
            '  .sidebar { grid-area: sidebar; }',
            '  .main { grid-area: main; }',
            '  .footer { grid-area: footer; }',
            '  // grid-area: <name> 等价于把项目放到对应命名区域',
            '',
            '【完整经典三栏布局】',
            '  <div class="layout">',
            '    <header class="header">Header</header>',
            '    <aside class="sidebar">Sidebar</aside>',
            '    <main class="main">Main Content</main>',
            '    <footer class="footer">Footer</footer>',
            '  </div>',
            '',
            '  .layout {',
            '    display: grid;',
            '    grid-template-areas:',
            '      "header header header"',
            '      "sidebar main main"',
            '      "footer footer footer";',
            '    grid-template-columns: 200px 1fr 1fr;',
            '    grid-template-rows: 60px 1fr 40px;',
            '    min-height: 100vh;',
            '    gap: 8px;',
            '  }',
            '  .header { grid-area: header; }',
            '  .sidebar { grid-area: sidebar; }',
            '  .main { grid-area: main; }',
            '  .footer { grid-area: footer; }',
            '',
            '【. 表示空单元格】',
            '  .layout {',
            '    grid-template-areas:',
            '      "header header header"',
            '      "sidebar . main"     /* 中间留空 */',
            '      "footer footer footer";',
            '  }',
            '  // 中间行的中间格不属于任何命名区域，项目不会自动落入',
            '',
            '【同名区域必须相邻形成矩形】',
            '  // ✓ 合法：main 形成矩形',
            '  "header header"',
            '  "main   main"',
            '',
            '  // ✗ 非法：main 分裂',
            '  "main   header"',
            '  "header main"',
            '  // 浏览器会忽略整个 grid-template-areas 声明',
            '',
            '【响应式重排：media query 改变 areas 定义】',
            '  .layout {',
            '    grid-template-areas:',
            '      "header"',
            '      "sidebar"',
            '      "main"',
            '      "footer";',
            '    grid-template-columns: 1fr;',
            '  }',
            '',
            '  @media (min-width: 768px) {',
            '    .layout {',
            '      grid-template-areas:',
            '        "header header"',
            '        "sidebar main"',
            '        "footer footer";',
            '      grid-template-columns: 200px 1fr;',
            '    }',
            '  }',
            '',
            '  @media (min-width: 1024px) {',
            '    .layout {',
            '      grid-template-areas:',
            '        "header header header"',
            '        "sidebar main main"',
            '        "footer footer footer";',
            '      grid-template-columns: 200px 1fr 1fr;',
            '    }',
            '  }',
            '  // 项目代码不变，只改容器 areas 即可实现三套布局',
            '',
            '【areas 隐式创建命名网格线】',
            '  grid-template-areas: "header main"',
            '  会自动创建网格线：',
            '    header-start / header-end（行起止、列起止）',
            '    main-start / main-end',
            '  可用 grid-column: header-start / main-end 跨越',
            '',
            '【grid-area 简写四元组】',
            '  grid-area: <row-start> / <column-start> / <row-end> / <column-end>;',
            '  grid-area: 1 / 1 / 3 / 4;  /* 从 (1,1) 到 (3,4) */',
            '  grid-area: header;         /* 单值时视为命名区域 */',
            '  // 详见 Card 4',
            '',
            '【实战：仪表盘布局】',
            '  .dashboard {',
            '    display: grid;',
            '    grid-template-areas:',
            '      "nav    nav    nav"',
            '      "stats  stats  stats"',
            '      "chart  chart  activity"',
            '      "table  table  activity";',
            '    grid-template-columns: 1fr 1fr 300px;',
            '    grid-template-rows: 50px 100px 1fr 1fr;',
            '    gap: 12px;',
            '    min-height: 100vh;',
            '  }',
            '  // 各区块用 grid-area: nav / stats / chart / activity / table 命名',
            '',
            '【浏览器支持】',
            '  grid-template-areas: 全线支持（Chrome 57+/Firefox 52+/Safari 10.1+）',
            '  是 Grid L1 最稳定可靠的特性之一',
            '',
            '【常见陷阱】',
            '  1. 每行单元格数必须等于列数，否则整个 areas 失效',
            '  2. 同名区域不邻接（如分裂）→ 整个 areas 失效',
            '  3. 区域名不能用纯数字（如 "1 2 3"），需字母开头',
            '  4. . 前后都要空格："a . b" 而非 "a.b"',
            '  5. 项目未声明 grid-area 时不进入任何命名区域，自动放置',
            '  6. areas 与 grid-template-columns 行列数不匹配会被忽略',
        ].join('\n');
        this.setState({ areasInfo: info });
        this._addLog('css', 'grid-template-areas 演示完成');
    }
    _renderCard3() {
        const s = this.state;
        const f = this._flags();
        const card = new Card({
            title: '3. grid-template-areas —— 命名网格布局（经典三栏布局）',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([['grid', f.grid], ['grid-area', f.gridArea]]), h(Tag, { color: 'primary' }, '命名区域')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'grid-template-areas 用字符串命名区域，每行引号包裹、空格分隔区域名，. 表示空单元格，同名区域必须相邻形成矩形。项目用 grid-area: <name> 放入命名区域。实战：经典三栏布局 header/sidebar/main/footer 一目了然。响应式重排只需用 media query 改变 areas 定义，项目代码不变。是 Grid 最直观、最易维护的特性。'),
                h('div', { class: 'cg-areas' }, h('div', { class: 'cg-area cg-area--header' }, 'header'), h('div', { class: 'cg-area cg-area--sidebar' }, 'sidebar'), h('div', { class: 'cg-area cg-area--main' }, 'main'), h('div', { class: 'cg-area cg-area--footer' }, 'footer')),
                h('div', { class: 'flex items-center gap-sm flex-wrap mt-md' }, this._btn('运行 areas 演示', { type: 'primary', size: 'sm', onClick: () => this._runAreasDemo() })),
                h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
                h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } }, h('code', {}, s.areasInfo || '（点击按钮查看 grid-template-areas 完整用法）')),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // ===================== Card 4：命名网格线 / grid-column / grid-row / grid-area =====================
    _runLinesDemo() {
        const f = this._flags();
        const info = [
            '===== 命名网格线 / grid-column / grid-row / grid-area =====',
            '',
            '【命名网格线】',
            '  在 grid-template-* 中用 [name] 给网格线命名：',
            '  .container {',
            '    grid-template-columns:',
            '      [start] 200px [content-start] 1fr [content-end end];',
            '  }',
            '  // 三条网格线分别叫 start / content-start / content-end (同 end)',
            '  // 一条线可有多个名字（空格分隔）',
            '',
            '【grid-column / grid-row —— 项目定位】',
            '  .item {',
            '    grid-column: <start-line> / <end-line>;',
            '    grid-row: <start-line> / <end-line>;',
            '  }',
            '  // 线可用数字（1 开始）或名字引用',
            '',
            '  .item-a {',
            '    grid-column: 1 / 3;   // 从第 1 条线到第 3 条线（跨 2 列）',
            '    grid-row: 1 / 2;      // 第 1 行',
            '  }',
            '',
            '  .item-b {',
            '    grid-column: start / content-end;  // 用命名线',
            '    grid-row: 1 / 2;',
            '  }',
            '',
            '【span N —— 跨越 N 条轨道】',
            '  .item {',
            '    grid-column: 1 / span 2;   // 从第 1 线起跨 2 列',
            '    grid-row: span 3;          // 自动放置，跨 3 行',
            '  }',
            '  // span N = end - start，可与起止线混用',
            '  // grid-column: span 2; 等价于自动起 + 跨 2 列',
            '',
            '【grid-area 简写四元组】',
            '  grid-area: <row-start> / <column-start> / <row-end> / <column-end>;',
            '',
            '  .item { grid-area: 1 / 1 / 3 / 4; }  // 行 1-3，列 1-4 */',
            '  // 等价于：',
            '  //   grid-row: 1 / 3;',
            '  //   grid-column: 1 / 4;',
            '',
            '  // 单值时视为命名区域（grid-template-areas 定义）',
            '  .header { grid-area: header; }',
            '',
            '【默认值 auto：自动放置】',
            '  .item { grid-column: auto; grid-row: auto; }',
            '  // 由 grid-auto-flow 算法自动分配位置',
            '  // 未指定定位的项目按顺序填入剩余空间',
            '',
            '【线名可重复，引用最近的同名线】',
            '  .container {',
            '    grid-template-columns: repeat(3, [col] 1fr [col]);',
            '  }',
            '  // 每列前后都有名为 col 的线',
            '  .item {',
            '    grid-column: col 2 / col 4;',
            '    // col 2 表示第 2 条名为 col 的线',
            '    // col 4 表示第 4 条名为 col 的线',
            '  }',
            '',
            '【完整示例：12 列网格系统】',
            '  .container {',
            '    display: grid;',
            '    grid-template-columns: repeat(12, 1fr);',
            '    gap: 16px;',
            '  }',
            '  .col-6 { grid-column: span 6; }   // 占 6 列（半宽）',
            '  .col-4 { grid-column: span 4; }   // 占 4 列（1/3 宽）',
            '  .col-3 { grid-column: span 3; }   // 占 3 列（1/4 宽）',
            '  .col-full { grid-column: 1 / -1; } // 占满整行（-1 表示最后一条线）',
            '',
            '【负数线号：从末尾计数】',
            '  .item { grid-column: 1 / -1; }  // 从第 1 线到最后 1 线（占满）',
            '  .item { grid-column: -3 / -1; } // 倒数第 3 线到倒数第 1 线',
            '  // -1 永远是显式网格的最后一条线',
            '',
            '【完整代码示例】',
            '  <div class="container">',
            '    <div class="item-a">A（跨 2 列）</div>',
            '    <div class="item-b">B</div>',
            '    <div class="item-c">C（跨 2 行）</div>',
            '  </div>',
            '',
            '  .container {',
            '    display: grid;',
            '    grid-template-columns: [start] 1fr [mid] 1fr [end];',
            '    grid-template-rows: 100px 100px;',
            '    gap: 8px;',
            '  }',
            '  .item-a { grid-column: start / end; grid-row: 1; }  // 占满第 1 行',
            '  .item-b { grid-column: start; grid-row: 2; }',
            '  .item-c { grid-column: mid; grid-row: 2; }',
            '',
            '【命名线 + areas 协同】',
            '  grid-template-areas 自动生成 <name>-start / <name>-end 线：',
            '  grid-template-areas: "header main"',
            '  → 隐式生成 header-start / header-end / main-start / main-end',
            '  可用 grid-column: header-start / main-end 跨越',
            '',
            '【浏览器支持】',
            `  grid-area: ${f.gridArea ? '✓' : '✗'}`,
            '  命名网格线、span、负数线号全线支持',
            '',
            '【常见陷阱】',
            '  1. 线号从 1 开始，不是 0',
            '  2. grid-column: 1 / 3 跨 2 列（3-1=2），不是 3 列',
            '  3. 项目定位冲突会重叠（后定位的覆盖前定位的，按 z-index）',
            '  4. 跨越超出显式网格 → 进入隐式网格（grid-auto-* 控制尺寸）',
            '  5. span N 中 N 不能为 0 或负数',
            '  6. 同名线引用第 N 条用 "name N" 格式（中间空格）',
            '  7. -1 仅指显式网格最后一线，隐式网格扩展后 -1 不变',
        ].join('\n');
        this.setState({ linesInfo: info });
        this._addLog('css', `命名网格线/grid-column/grid-row/grid-area 演示完成；supports=${f.gridArea}`);
    }
    _renderCard4() {
        const s = this.state;
        const f = this._flags();
        const card = new Card({
            title: '4. 命名网格线 / grid-column / grid-row / grid-area',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([['grid-area', f.gridArea]]), h(Tag, { color: 'primary' }, '网格线')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, '命名网格线：grid-template-columns: [start] 200px [content-start] 1fr [content-end end]，一条线可有多个名字。grid-column / grid-row: <start-line> / <end-line>，线号从 1 开始，可用 span N 跨越、负数从末尾计数（-1 是显式网格最后线）。grid-area 简写：<row-start> / <column-start> / <row-end> / <column-end>，单值时视为命名区域。默认 auto 由 grid-auto-flow 自动放置。线名可重复，用 "name N" 引用第 N 条同名线。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('运行命名线演示', { type: 'primary', size: 'sm', onClick: () => this._runLinesDemo() })),
                h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
                h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } }, h('code', {}, s.linesInfo || '（点击按钮查看命名网格线/grid-column/grid-row/grid-area 完整用法）')),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // ===================== Card 5：grid-auto-flow 自动放置算法 =====================
    _runFlowDemo() {
        const f = this._flags();
        this._injectStyle('cg-flow-demo', `
      .cg-flow-row {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        grid-auto-flow: row;
        gap: 4px;
        margin-top: 8px;
      }
      .cg-flow-col {
        display: grid;
        grid-template-rows: repeat(3, 40px);
        grid-auto-flow: column;
        gap: 4px;
        margin-top: 8px;
      }
      .cg-flow-dense {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        grid-auto-rows: 40px;
        grid-auto-flow: row dense;
        gap: 4px;
        margin-top: 8px;
      }
      .cg-flow-dense .cg-cell:nth-child(1) { grid-column: span 2; }
      .cg-flow-dense .cg-cell:nth-child(2) { grid-column: span 2; grid-row: span 2; }
      .cg-flow-dense .cg-cell:nth-child(3) { grid-column: span 1; }
      .cg-flow-dense .cg-cell:nth-child(4) { grid-column: span 1; }
      .cg-flow-dense .cg-cell:nth-child(5) { grid-column: span 1; }
      .cg-flow-dense .cg-cell:nth-child(6) { grid-column: span 2; }
    `);
        const info = [
            '===== grid-auto-flow —— 自动放置算法 =====',
            '',
            '【动机】',
            '  项目未显式定位（grid-column/row 为 auto）时，',
            '  浏览器按 grid-auto-flow 算法自动分配位置。',
            '  不同的 flow 值影响排列方向和是否填补空位。',
            '',
            '【取值】',
            '  grid-auto-flow: row;          // 默认：逐行填充',
            '  grid-auto-flow: column;       // 逐列填充',
            '  grid-auto-flow: row dense;    // 逐行 + 密集填补',
            '  grid-auto-flow: column dense; // 逐列 + 密集填补',
            '  // row/column 控制方向，dense 控制是否回填空位',
            '',
            '【row（默认）：逐行填充】',
            '  .grid {',
            '    grid-template-columns: repeat(3, 1fr);',
            '    grid-auto-flow: row;',
            '  }',
            '  // 项目依次填入：',
            '  //   (1,1) (1,2) (1,3)',
            '  //   (2,1) (2,2) (2,3)',
            '  //   ...',
            '  // 一行填满后换下一行',
            '',
            '【column：逐列填充】',
            '  .grid {',
            '    grid-template-rows: repeat(3, 40px);',
            '    grid-auto-flow: column;',
            '  }',
            '  // 项目依次填入：',
            '  //   (1,1) (2,1) (3,1)',
            '  //   (1,2) (2,2) (3,2)',
            '  //   ...',
            '  // 一列填满后换下一列',
            '',
            '【sparse 算法（默认）：不回填】',
            '  假设有 3 列，第 1 个项目跨 2 列：',
            '  项目 1：跨 (1,1)-(1,2)',
            '  项目 2：(1,3)            ← 第 1 行剩 1 列',
            '  项目 3：(2,1)            ← 跳到第 2 行，(1,3) 后无空位',
            '  // 稀疏模式：光标只前进不回头，不留空位的下一格继续',
            '',
            '【dense 算法：回填空位】',
            '  .grid {',
            '    grid-template-columns: repeat(4, 1fr);',
            '    grid-auto-flow: row dense;',
            '  }',
            '  项目 1：跨 2 列 → (1,1)-(1,2)',
            '  项目 2：跨 2 列 2 行 → (1,3)-(2,4)',
            '  项目 3：1 列 → 回填 (1,3) 后空位... 实际填到第 2 行空位',
            '  // 密集模式：算法回头尝试用小项目填补大项目留下的空位',
            '  // 适合瀑布流、不同尺寸卡片墙',
            '',
            '【row dense vs column dense】',
            '  row dense：按行回填，优先填当前行的空位',
            '  column dense：按列回填，优先填当前列的空位',
            '  // 视觉效果不同，按布局方向选择',
            '',
            '【隐式网格：grid-auto-columns / grid-auto-rows】',
            '  当项目超出显式网格（grid-template-* 定义的）时，',
            '  浏览器自动创建隐式轨道，尺寸由 grid-auto-* 控制：',
            '',
            '  .grid {',
            '    grid-template-columns: repeat(3, 100px);  // 显式 3 列',
            '    grid-auto-rows: 80px;                     // 隐式行高 80px',
            '    grid-auto-columns: 120px;                 // 隐式列宽 120px',
            '    grid-auto-flow: row;                      // 行方向扩展',
            '  }',
            '  // 项目多于 3 个 → 自动加行，新行高 80px',
            '  // grid-auto-flow: column 时 → 自动加列，新列宽 120px',
            '',
            '【dense 适用与不适用场景】',
            '  ✓ 适合：照片墙、卡片墙（不同尺寸，视觉无序无所谓）',
            '  ✓ 适合：商品列表（顺序不重要）',
            '  ✗ 不适合：时间线、文章列表（顺序重要，dense 会打乱）',
            '  ✗ 不适合：表单（顺序敏感）',
            '',
            '【完整代码示例：dense 瀑布流近似】',
            '  <div class="masonry">',
            '    <div class="item big">大</div>',
            '    <div class="item">小</div>',
            '    <div class="item">小</div>',
            '    <div class="item tall">高</div>',
            '    <div class="item">小</div>',
            '  </div>',
            '',
            '  .masonry {',
            '    display: grid;',
            '    grid-template-columns: repeat(4, 1fr);',
            '    grid-auto-rows: 80px;',
            '    grid-auto-flow: row dense;',
            '    gap: 8px;',
            '  }',
            '  .item.big { grid-column: span 2; grid-row: span 2; }',
            '  .item.tall { grid-row: span 2; }',
            '  // 小项目自动填补大项目留下的空位',
            '  // 注意：不是真正瀑布流（CSS Grid 无原生 masonry）',
            '  // 真正 masonry 见 grid-template-rows: masonry（Chrome 实验）',
            '',
            '【自动放置算法详解（规范）】',
            '  1. 稀疏模式（默认）：',
            '     - 维护一个「自动放置光标」(row, column)',
            '     - 光标只前进不后退',
            '     - 项目放不下时光标前进到下一可用位置',
            '     - 留下的空位永久空着',
            '',
            '  2. 密集模式（dense）：',
            '     - 每个项目都从 (1,1) 重新尝试',
            '     - 找到第一个能放下的位置（含之前的空位）',
            '     - 小项目会填进大项目留下的空位',
            '     - 代价：DOM 顺序与视觉顺序可能不一致',
            '     - 无障碍风险：屏幕阅读器按 DOM 顺序朗读',
            '',
            '【浏览器支持】',
            `  grid-auto-flow: dense: ${f.gridAutoFlowDense ? '✓' : '✗'}`,
            '  row/column/dense 全线支持（Chrome 57+/Firefox 52+/Safari 10.1+）',
            '',
            '【常见陷阱】',
            '  1. dense 打乱视觉顺序，影响无障碍（屏幕阅读器按 DOM 读）',
            '  2. dense 性能开销略大（每个项目都从 (1,1) 扫描）',
            '  3. grid-auto-rows 默认 auto（按内容），多行项目可能高度不一',
            '  4. 显式定位的项目不参与自动放置，dense 只填 auto 项目空位',
            '  5. column 方向时容器宽度可能超出，需配 grid-auto-columns',
            '  6. 真正 masonry 仍需 JS 或等 grid-template-rows: masonry 普及',
        ].join('\n');
        this.setState({ flowInfo: info });
        this._addLog('css', `grid-auto-flow 演示完成；supports=${f.gridAutoFlowDense}`);
    }
    _renderCard5() {
        const s = this.state;
        const f = this._flags();
        const card = new Card({
            title: '5. grid-auto-flow —— 自动放置算法（row / column / dense）',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([['dense', f.gridAutoFlowDense]]), h(Tag, { color: 'primary' }, '自动放置')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'grid-auto-flow: row(默认逐行)/column(逐列)/dense(密集回填)/row dense/column dense。稀疏模式（默认）光标只前进不回头，留下空位；密集模式（dense）每个项目从 (1,1) 重新扫描，小项目填进大项目留下的空位，适合瀑布流近似但打乱视觉顺序（影响无障碍）。隐式网格用 grid-auto-columns / grid-auto-rows 控制超出显式网格时自动生成轨道的尺寸。'),
                h('div', { class: 'cg-demo' }, h('div', { class: 'fs-sm text-secondary' }, 'row（逐行填充）'), h('div', { class: 'cg-flow-row' }, h('div', { class: 'cg-cell' }, '1'), h('div', { class: 'cg-cell cg-alt' }, '2'), h('div', { class: 'cg-cell' }, '3'), h('div', { class: 'cg-cell cg-alt' }, '4'), h('div', { class: 'cg-cell' }, '5'), h('div', { class: 'cg-cell cg-alt' }, '6')), h('div', { class: 'fs-sm text-secondary mt-sm' }, 'row dense（密集回填，不同 span 混合）'), h('div', { class: 'cg-flow-dense' }, h('div', { class: 'cg-cell cg-warn' }, '1 (span2)'), h('div', { class: 'cg-cell cg-ok' }, '2 (2x2)'), h('div', { class: 'cg-cell' }, '3'), h('div', { class: 'cg-cell' }, '4'), h('div', { class: 'cg-cell' }, '5'), h('div', { class: 'cg-cell cg-alt' }, '6 (span2)'))),
                h('div', { class: 'flex items-center gap-sm flex-wrap mt-md' }, this._btn('运行 auto-flow 演示', { type: 'primary', size: 'sm', onClick: () => this._runFlowDemo() })),
                h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
                h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } }, h('code', {}, s.flowInfo || '（点击按钮查看 grid-auto-flow 完整用法）')),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // ===================== Card 6：gap / align-items / justify-items 对齐 =====================
    _runAlignDemo() {
        const f = this._flags();
        this._injectStyle('cg-align-demo', `
      .cg-align-items {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        grid-template-rows: 80px;
        gap: 8px;
        margin-top: 8px;
        background: #f1f5f9;
        padding: 8px;
        border-radius: 4px;
      }
      .cg-align-items .cg-cell { background: #3b82f6; color: #fff; padding: 4px; border-radius: 4px; }
      .cg-ji-start { justify-items: start; }
      .cg-ji-center { justify-items: center; }
      .cg-ai-center { align-items: center; }
      .cg-ai-end { align-items: end; }
      .cg-content-center {
        display: grid;
        grid-template-columns: repeat(3, 80px);
        grid-template-rows: 40px;
        gap: 8px;
        justify-content: center;
        align-content: center;
        height: 120px;
        background: #f1f5f9;
        padding: 8px;
        border-radius: 4px;
        margin-top: 8px;
      }
    `);
        const info = [
            '===== gap / align-items / justify-items / place-items 对齐 =====',
            '',
            '【gap：网格间距】',
            '  .grid {',
            '    column-gap: 16px;   /* 列间距 */',
            '    row-gap: 12px;      /* 行间距 */',
            '    gap: 12px 16px;     /* 简写：row-gap column-gap */',
            '    gap: 16px;          /* 单值：行列相同 */',
            '  }',
            '  // gap 不会作用在容器边缘（仅轨道之间）',
            '  // gap 替代旧的 grid-gap / grid-column-gap / grid-row-gap',
            '  // 现已通用：Flexbox、Multi-column 也支持 gap',
            '',
            '【两轴对齐模型】',
            '  Grid 有两组对齐属性：',
            '  - items 系列：项目在「单元格内」的对齐',
            '  - content 系列：整个「网格」在容器内的对齐',
            '',
            '  justify-* 控制行向（inline / 水平）',
            '  align-*  控制块向（block / 垂直）',
            '',
            '【justify-items：项目在单元格内的水平对齐】',
            '  .grid { justify-items: stretch; }  // 默认：拉伸填满',
            '  .grid { justify-items: start; }    // 左对齐',
            '  .grid { justify-items: end; }      // 右对齐',
            '  .grid { justify-items: center; }   // 居中',
            '  .grid { justify-items: baseline; } // 基线对齐',
            '',
            '【align-items：项目在单元格内的垂直对齐】',
            '  .grid { align-items: stretch; }    // 默认：拉伸填满',
            '  .grid { align-items: start; }      // 顶对齐',
            '  .grid { align-items: end; }        // 底对齐',
            '  .grid { align-items: center; }     // 居中',
            '  .grid { align-items: baseline; }   // 基线对齐',
            '',
            '【place-items 简写】',
            '  place-items: <align> <justify>;',
            '  place-items: center;          // 两轴都居中',
            '  place-items: start center;    // 上中',
            '  place-items: end start;       // 下左',
            '  // 单值时两轴相同',
            '',
            '【单个项目覆盖：justify-self / align-self】',
            '  .item-special {',
            '    justify-self: center;',
            '    align-self: end;',
            '    place-self: end center;     // 简写',
            '  }',
            '  // 仅该项目生效，不影响其他',
            '',
            '【justify-content：整个网格在容器内的水平对齐】',
            '  当网格总宽 < 容器宽时，整个网格如何放置：',
            '  justify-content: start;          // 左对齐（默认）',
            '  justify-content: end;            // 右对齐',
            '  justify-content: center;         // 居中',
            '  justify-content: stretch;        // 拉伸（轨道按比例扩展）',
            '  justify-content: space-around;   // 每个轨道左右等距',
            '  justify-content: space-between;  // 首尾贴边，中间等距',
            '  justify-content: space-evenly;   // 所有间距相等（含首尾）',
            '',
            '  .grid {',
            '    grid-template-columns: repeat(3, 100px);  // 总宽 300px',
            '    justify-content: center;                  // 容器 500px → 网格居中',
            '  }',
            '',
            '【align-content：整个网格在容器内的垂直对齐】',
            '  align-content: start | end | center | stretch | space-around |',
            '                space-between | space-evenly',
            '  // 同 justify-content 但垂直方向',
            '  // 仅当网格总高 < 容器高时生效',
            '',
            '【place-content 简写】',
            '  place-content: <align-content> <justify-content>;',
            '  place-content: center;          // 两轴都居中',
            '  place-content: space-between;   // 两轴两端对齐',
            '',
            '【与 Flexbox 对齐属性对应关系】',
            '  Flexbox             Grid',
            '  ─────────────────────────────────────────',
            '  justify-content  →  justify-content（相同）',
            '  align-items      →  align-items（相同）',
            '  align-content    →  align-content（相同）',
            '  （无对应）       →  justify-items（Grid 独有，Flexbox 无）',
            '  （无对应）       →  place-items / place-content（Grid 简写）',
            '',
            '  关键差异：',
            '  - Flexbox 一维，justify 是主轴，align 是交叉轴',
            '  - Grid 二维，justify 是行向（水平），align 是列向（垂直）',
            '  - Grid 多了 justify-items（Flexbox 仅有 align-items）',
            '  - Grid 的 items 系列作用在「单元格内」',
            '',
            '【完整代码示例】',
            '  <div class="grid">',
            '    <div>A</div><div>B</div><div>C</div>',
            '  </div>',
            '',
            '  .grid {',
            '    display: grid;',
            '    grid-template-columns: repeat(3, 1fr);',
            '    grid-template-rows: 80px;',
            '    gap: 12px;',
            '    place-items: center;        // 项目在单元格内居中',
            '    place-content: center;      // 网格在容器内居中',
            '  }',
            '',
            '【stretch 与项目尺寸的交互】',
            '  align-items: stretch 时项目垂直拉伸填满单元格，',
            '  但项目自身设置了 height（如 50px）则不拉伸。',
            '  justify-items: stretch 同理：设了 width 则不拉伸。',
            '',
            '【baseline 对齐】',
            '  align-items: baseline 让多个项目的文字基线对齐，',
            '  适合表单 label + input 不同字号时基线统一',
            '',
            '【浏览器支持】',
            `  gap: ${f.gap ? '✓' : '✗'}`,
            '  justify-items/align-items/place-items 全线支持',
            '  gap 在 Flexbox 也支持（Chrome 84+/Firefox 63+/Safari 14.1+）',
            '',
            '【常见陷阱】',
            '  1. align-content 仅当网格总高 < 容器高时生效',
            '  2. justify-items: stretch 是默认值，项目不设宽才生效',
            '  3. place-* 简写第一值是 align（垂直），第二值是 justify（水平），易混',
            '  4. gap 不作用在容器边缘，需用 padding 补',
            '  5. Flexbox 的 align-items 在 Grid 中语义不同（Grid 是单元格内）',
            '  6. baseline 对齐多项目时取首个项目的基线为基准',
        ].join('\n');
        this.setState({ alignInfo: info });
        this._addLog('css', `gap/align-items/justify-items 演示完成；supports=${f.gap}`);
    }
    _renderCard6() {
        const s = this.state;
        const f = this._flags();
        const card = new Card({
            title: '6. gap / align-items / justify-items / place-items 对齐',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([['gap', f.gap]]), h(Tag, { color: 'primary' }, '对齐')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'gap 简写 row-gap + column-gap（轨道间距，不作用容器边缘）。justify-items: stretch(默认)/start/end/center/baseline 项目在单元格内水平对齐；align-items 同值垂直对齐；place-items 简写。justify-content/align-content/place-content 控制整个网格在容器内对齐（start/end/center/stretch/space-around/between/evenly）。与 Flexbox 对应：justify-content/align-items 相同，但 Grid 多了 justify-items（Flexbox 无），且 items 系列作用在「单元格内」。'),
                h('div', { class: 'cg-demo' }, h('div', { class: 'fs-sm text-secondary' }, 'justify-items: start + align-items: center'), h('div', { class: 'cg-align-items cg-ji-start cg-ai-center' }, h('div', { class: 'cg-cell' }, 'start'), h('div', { class: 'cg-cell' }, 'start'), h('div', { class: 'cg-cell' }, 'start')), h('div', { class: 'fs-sm text-secondary mt-sm' }, 'justify-items: center + align-items: end'), h('div', { class: 'cg-align-items cg-ji-center cg-ai-end' }, h('div', { class: 'cg-cell' }, 'center'), h('div', { class: 'cg-cell' }, 'center'), h('div', { class: 'cg-cell' }, 'center')), h('div', { class: 'fs-sm text-secondary mt-sm' }, 'place-content: center（网格在容器内居中）'), h('div', { class: 'cg-content-center' }, h('div', { class: 'cg-cell' }, 'A'), h('div', { class: 'cg-cell' }, 'B'), h('div', { class: 'cg-cell' }, 'C'))),
                h('div', { class: 'flex items-center gap-sm flex-wrap mt-md' }, this._btn('运行对齐演示', { type: 'primary', size: 'sm', onClick: () => this._runAlignDemo() })),
                h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
                h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } }, h('code', {}, s.alignInfo || '（点击按钮查看 gap/align-items/justify-items 完整用法）')),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // ===================== Card 7：Subgrid（Level 2）与嵌套网格 =====================
    _runSubgridDemo() {
        const f = this._flags();
        this._injectStyle('cg-subgrid-demo', `
      .cg-subgrid-parent {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 8px;
        background: #f1f5f9;
        padding: 8px;
        border-radius: 4px;
        margin-top: 8px;
      }
      .cg-subgrid-child {
        grid-column: span 2;
        display: grid;
        grid-template-columns: subgrid;
        gap: 8px;
        background: #dbeafe;
        padding: 4px;
        border-radius: 4px;
      }
      .cg-subgrid-child .cg-cell { background: #1e40af; }
      .cg-nested-parent {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 8px;
        background: #f1f5f9;
        padding: 8px;
        border-radius: 4px;
        margin-top: 8px;
      }
      .cg-nested-child {
        grid-column: span 2;
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 8px;
        background: #fef3c7;
        padding: 4px;
        border-radius: 4px;
      }
      .cg-nested-child .cg-cell { background: #d97706; }
    `);
        const info = [
            '===== Subgrid（Grid Level 2）与嵌套网格 =====',
            '',
            '【动机】',
            '  嵌套 display: grid 时，子网格的轨道与父网格完全独立，',
            '  无法让孙项目的列与父项目的列对齐。',
            '  subgrid 让子网格继承父网格的轨道定义，实现跨层级对齐。',
            '',
            '【语法】',
            '  .parent {',
            '    display: grid;',
            '    grid-template-columns: repeat(3, 1fr);',
            '  }',
            '  .child {',
            '    grid-column: span 2;                    // 子项目跨 2 列',
            '    display: grid;',
            '    grid-template-columns: subgrid;          // 继承父网格的 2 列轨道',
            '    grid-template-rows: subgrid;             // 也可继承行轨道',
            '  }',
            '  // subgrid 是 grid-template-columns/rows 的特殊值',
            '  // 子网格的轨道数 = 它所跨越的父网格轨道数',
            '',
            '【子网格继承父网格的轨道定义】',
            '  父：grid-template-columns: 100px 200px 100px',
            '  子：grid-column: 1 / 3（跨第 1、2 列）',
            '      grid-template-columns: subgrid',
            '  → 子网格的 2 列分别是 100px 和 200px（与父对齐）',
            '  → 孙项目放在子网格的列 = 父网格对应列的位置',
            '',
            '【跨越多列的子网格对齐（line-names 继承）】',
            '  .parent {',
            '    grid-template-columns: [a] 100px [b] 200px [c] 100px [d];',
            '  }',
            '  .child {',
            '    grid-column: b / d;',
            '    grid-template-columns: subgrid;',
            '  }',
            '  // 子网格继承线名 b / c / d',
            '  // 孙项目可用 grid-column: b / c 引用继承的线名',
            '',
            '【subgrid 的 gap 继承】',
            '  .parent { gap: 16px; }',
            '  .child {',
            '    grid-template-columns: subgrid;',
            '    // gap 默认继承父网格的 16px',
            '    // 可显式覆盖：gap: 8px;',
            '  }',
            '  // 子网格的 gap 与父网格对齐时保持一致视觉效果',
            '',
            '【与嵌套 display:grid 的区别】',
            '  嵌套 grid（非 subgrid）：',
            '  .parent { grid-template-columns: 100px 200px 100px; }',
            '  .child {',
            '    grid-column: span 2;',
            '    display: grid;',
            '    grid-template-columns: 1fr 1fr;  // 独立定义，与父不对齐',
            '  }',
            '  // 子网格的列是 1fr 1fr，等分子项目宽度',
            '  // 不会与父网格的 100px 200px 对齐',
            '',
            '  subgrid：',
            '  .child {',
            '    grid-column: span 2;',
            '    grid-template-columns: subgrid;  // 继承父的 100px 200px',
            '  }',
            '  // 孙项目列与父项目列严格对齐',
            '',
            '【实战 1：表单标签输入对齐】',
            '  <form class="form">',
            '    <div class="row">',
            '      <label>姓名</label>',
            '      <input type="text">',
            '    </div>',
            '    <div class="row">',
            '      <label>邮箱</label>',
            '      <input type="email">',
            '    </div>',
            '  </form>',
            '',
            '  .form {',
            '    display: grid;',
            '    grid-template-columns: max-content 1fr;',
            '    gap: 8px 12px;',
            '  }',
            '  .row {',
            '    display: grid;',
            '    grid-template-columns: subgrid;',
            '    grid-column: 1 / -1;       // 跨满父网格',
            '  }',
            '  // 每行的 label 和 input 严格对齐父网格的两列',
            '  // 无需重复定义列宽，父级改了子级自动跟随',
            '',
            '【实战 2：卡片内容跨列对齐】',
            '  <div class="cards">',
            '    <article class="card">',
            '      <h3>标题 1</h3>',
            '      <p>描述 1</p>',
            '      <button>按钮</button>',
            '    </article>',
            '    <article class="card">',
            '      <h3>标题 2（更长）</h3>',
            '      <p>描述 2</p>',
            '      <button>按钮</button>',
            '    </article>',
            '  </div>',
            '',
            '  .cards {',
            '    display: grid;',
            '    grid-template-columns: repeat(2, 1fr);',
            '    gap: 16px;',
            '  }',
            '  .card {',
            '    display: grid;',
            '    grid-template-rows: subgrid;   // 继承父行轨道',
            '    grid-row: span 3;              // 跨 3 行',
            '  }',
            '  // 所有卡片的标题/描述/按钮行水平对齐',
            '  // 即使某卡片标题换行，其他卡片对应行也跟着调整',
            '',
            '【实战 3：表头与表体列对齐】',
            '  .table {',
            '    display: grid;',
            '    grid-template-columns: 200px 1fr 100px 80px;',
            '  }',
            '  .header, .row {',
            '    display: grid;',
            '    grid-template-columns: subgrid;',
            '    grid-column: 1 / -1;',
            '  }',
            '  // 表头和每行的列严格对齐，无需重复列定义',
            '  // 比 table 元素更灵活（可加 gap、可响应式）',
            '',
            '【subgrid 限制】',
            '  - 子网格只能继承它所跨越的轨道',
            '  - 不能在 subgrid 上重新定义轨道尺寸',
            '  - grid-template-areas 在 subgrid 上无效',
            '  - 跨轴（如只继承列不继承行）需分别声明',
            '',
            '【浏览器支持】',
            `  subgrid: ${f.subgrid ? '✓' : '✗'}`,
            '  Firefox 71+（2019-12 首个支持）',
            '  Safari 16+（2022-09）',
            '  Chrome 117+（2023-09）',
            '  Edge 117+',
            '  全球支持率 ~95%（2025）',
            '',
            '【渐进增强】',
            '  @supports (grid-template-columns: subgrid) {',
            '    .child { grid-template-columns: subgrid; }',
            '  }',
            '  @supports not (grid-template-columns: subgrid) {',
            '    .child { grid-template-columns: 1fr 1fr; } /* 降级 */',
            '  }',
            '',
            '【常见陷阱】',
            '  1. subgrid 必须配合 grid-column/grid-row span 使用',
            '  2. subgrid 不能与显式轨道尺寸共存（要么 subgrid 要么轨道列表）',
            '  3. 继承的线名带后缀（如 a-start 在子网格中仍叫 a-start）',
            '  4. gap 继承后可在子网格覆盖，但会破坏与父对齐',
            '  5. 旧浏览器（Chrome < 117）不支持，需降级方案',
            '  6. subgrid 不继承 grid-template-areas，需重新定义或用线名',
        ].join('\n');
        this.setState({ subgridInfo: info });
        this._addLog('css', `subgrid 演示完成；supports=${f.subgrid}`);
    }
    _renderCard7() {
        const s = this.state;
        const f = this._flags();
        const card = new Card({
            title: '7. Subgrid（Level 2）—— 子网格继承父网格轨道',
            extra: h('div', { class: 'flex gap-xs' }, ...this._caps([['subgrid', f.subgrid]]), h(Tag, { color: 'primary' }, 'Grid L2')),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, 'grid-template-columns: subgrid / grid-template-rows: subgrid 让子网格继承父网格轨道定义，孙项目列与父项目列严格对齐。继承内容包括轨道尺寸、命名网格线（line-names）、gap。与嵌套 display:grid 区别：嵌套各自独立定义轨道不对齐，subgrid 继承并对齐。实战：表单标签输入对齐、卡片内容跨列对齐、表头表体列对齐。浏览器支持：Chrome 117+/Firefox 71+/Safari 16+，全球 ~95%。'),
                h('div', { class: 'cg-demo' }, h('div', { class: 'fs-sm text-secondary' }, 'subgrid：子网格跨 2 列继承父轨道（与父列对齐）'), h('div', { class: 'cg-subgrid-parent' }, h('div', { class: 'cg-cell' }, '父-1'), h('div', { class: 'cg-subgrid-child' }, h('div', { class: 'cg-cell' }, '子-1（对齐父-2）'), h('div', { class: 'cg-cell' }, '子-2（对齐父-3）'))), h('div', { class: 'fs-sm text-secondary mt-sm' }, '嵌套 grid（非 subgrid）：子网格独立定义不对齐'), h('div', { class: 'cg-nested-parent' }, h('div', { class: 'cg-cell' }, '父-1'), h('div', { class: 'cg-nested-child' }, h('div', { class: 'cg-cell' }, '子-1（独立）'), h('div', { class: 'cg-cell' }, '子-2（独立）')))),
                h('div', { class: 'flex items-center gap-sm flex-wrap mt-md' }, this._btn('运行 subgrid 演示', { type: 'primary', size: 'sm', onClick: () => this._runSubgridDemo() })),
                h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
                h('pre', { class: 'code-block', style: { maxHeight: '500px', overflow: 'auto' } }, h('code', {}, s.subgridInfo || '（点击按钮查看 subgrid 完整用法）')),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    // ===================== Card 8：实战布局模式与 vs Flexbox =====================
    _runPatternDemo() {
        const f = this._flags();
        const info = [
            '===== 实战布局模式与 vs Flexbox 决策树 =====',
            '',
            '【模式 1：经典三栏布局（areas + 1fr）】',
            '  <div class="layout">',
            '    <header>Header</header>',
            '    <aside>Sidebar</aside>',
            '    <main>Main</main>',
            '    <footer>Footer</footer>',
            '  </div>',
            '',
            '  .layout {',
            '    display: grid;',
            '    grid-template-areas:',
            '      "header header header"',
            '      "sidebar main main"',
            '      "footer footer footer";',
            '    grid-template-columns: 200px 1fr 1fr;',
            '    grid-template-rows: auto 1fr auto;',
            '    min-height: 100vh;',
            '    gap: 12px;',
            '  }',
            '  header { grid-area: header; }',
            '  aside { grid-area: sidebar; }',
            '  main { grid-area: main; }',
            '  footer { grid-area: footer; }',
            '  // 一段 CSS 实现完整页面骨架，响应式只改 areas',
            '',
            '【模式 2：照片墙（auto-fit + minmax + gap）】',
            '  .gallery {',
            '    display: grid;',
            '    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));',
            '    gap: 12px;',
            '  }',
            '  .photo {',
            '    aspect-ratio: 1;           // 正方形',
            '    object-fit: cover;',
            '    border-radius: 8px;',
            '  }',
            '  // 无媒体查询，宽屏多列窄屏少列，每列至少 200px',
            '',
            '【模式 3：12 列网格系统（repeat(12, 1fr) + span）】',
            '  .row {',
            '    display: grid;',
            '    grid-template-columns: repeat(12, 1fr);',
            '    gap: 16px;',
            '  }',
            '  .col-12 { grid-column: span 12; }  // 全宽',
            '  .col-6  { grid-column: span 6; }   // 半宽',
            '  .col-4  { grid-column: span 4; }   // 1/3',
            '  .col-3  { grid-column: span 3; }   // 1/4',
            '  .col-8  { grid-column: span 8; }   // 2/3',
            '  .offset-2 { grid-column-start: 3; } // 偏移',
            '  // 替代 Bootstrap 的 .col-md-6 等，纯 CSS 无需框架',
            '',
            '【模式 4：瀑布流近似（grid-auto-flow: dense + 不同 span）】',
            '  .masonry {',
            '    display: grid;',
            '    grid-template-columns: repeat(4, 1fr);',
            '    grid-auto-rows: 80px;',
            '    grid-auto-flow: dense;',
            '    gap: 8px;',
            '  }',
            '  .item.big   { grid-column: span 2; grid-row: span 2; }',
            '  .item.tall  { grid-row: span 2; }',
            '  .item.wide  { grid-column: span 2; }',
            '  // 小项目自动填补大项目空位',
            '  // 注意：非真正 masonry，真正 masonry 见',
            '  //   grid-template-rows: masonry（Firefox 实验性，未普及）',
            '',
            '【模式 5：暗黑模式仪表盘（areas 响应式重排）】',
            '  .dashboard {',
            '    display: grid;',
            '    grid-template-areas:',
            '      "nav nav"',
            '      "stats stats"',
            '      "chart activity";',
            '    grid-template-columns: 1fr 300px;',
            '    gap: 12px;',
            '    min-height: 100vh;',
            '  }',
            '  @media (prefers-color-scheme: dark) {',
            '    .dashboard { background: #0f172a; color: #e2e8f0; }',
            '  }',
            '  @media (max-width: 768px) {',
            '    .dashboard {',
            '      grid-template-areas:',
            '        "nav" "stats" "chart" "activity";',
            '      grid-template-columns: 1fr;',
            '    }',
            '  }',
            '  // 暗黑模式用 prefers-color-scheme 媒体查询',
            '  // 响应式用 media query 改 areas 定义',
            '',
            '【模式 6：圣杯布局（Holy Grail）】',
            '  .holy-grail {',
            '    display: grid;',
            '    grid-template-areas:',
            '      "header header header"',
            '      "nav    main   aside"',
            '      "footer footer footer";',
            '    grid-template-columns: 150px 1fr 200px;',
            '    grid-template-rows: auto 1fr auto;',
            '    min-height: 100vh;',
            '  }',
            '  // header/footer 全宽，中间 nav/main/aside 三栏',
            '',
            '【vs Flexbox 决策树】',
            '  ┌──────────────────────────────────┬──────────┐',
            '  │ 场景                             │ 选择     │',
            '  ├──────────────────────────────────┼──────────┤',
            '  │ 一维布局（行或列）               │ Flexbox  │',
            '  │ 二维布局（行和列同时）           │ Grid     │',
            '  │ 内容驱动（项目数不定）           │ Flexbox  │',
            '  │ 布局驱动（结构固定）             │ Grid     │',
            '  │ 居中单元素                       │ Flexbox  │',
            '  │   （justify+align 一行）         │ （更简洁）│',
            '  │ 整页布局                         │ Grid     │',
            '  │   （areas 更直观）               │          │',
            '  │ 导航栏（横向）                   │ Flexbox  │',
            '  │ 卡片墙（响应式多列）             │ Grid     │',
            '  │ 表单（label-input 对齐）         │ Grid     │',
            '  │ 工具栏（按钮排列）               │ Flexbox  │',
            '  │ 仪表盘（多区块）                 │ Grid     │',
            '  │ 文字流（环绕图片）               │ 都不用  │',
            '  │                                  │ （float）│',
            '  └──────────────────────────────────┴──────────┘',
            '',
            '  口诀：',
            '  - 一维内容流 → Flex',
            '  - 二维结构布局 → Grid',
            '  - 不确定 → 先试 Flex，对齐困难再换 Grid',
            '',
            '【混合使用：外层 Grid + 内层 Flex】',
            '  .card {',
            '    display: grid;',
            '    grid-template-rows: auto 1fr auto;  // 标题/内容/操作',
            '    gap: 8px;',
            '  }',
            '  .card__actions {',
            '    display: flex;                       // 按钮横向排列',
            '    justify-content: flex-end;',
            '    gap: 8px;',
            '  }',
            '  // Grid 控制整体结构，Flex 控制局部一维排列',
            '  // 这是生产环境最常见的组合',
            '',
            '【CSS Grid 调试（Chrome DevTools）】',
            '  1. Elements 面板选中 grid 容器',
            '  2. 顶部出现 grid 标识，点击展开 Layout 面板',
            '  3. 勾选「Show grid overlays」显示网格线',
            '  4. 选项：',
            '     - Show line numbers      显示线号',
            '     - Show area names        显示 areas 命名',
            '     - Extend grid lines      延伸到容器外',
            '     - Show track sizes       显示轨道尺寸',
            '  5. 多个 grid 容器可在 Layout 面板逐个切换',
            '  6. Firefox 也有类似 Grid Inspector（更早支持）',
            '',
            '【浏览器支持总览（2025）】',
            `  Grid L1: ${f.grid ? '✓' : '✗'} (Chrome 57+/Firefox 52+/Safari 10.1+，全球 ~98%)`,
            `  subgrid: ${f.subgrid ? '✓' : '✗'} (Chrome 117+/Firefox 71+/Safari 16+，全球 ~95%)`,
            '  masonry: 实验性（Firefox 默认开启，Chrome flag）',
            '',
            '【资源】',
            '  - 规范 L1: https://www.w3.org/TR/css-grid-1/',
            '  - 规范 L2: https://www.w3.org/TR/css-grid-2/',
            '  - MDN: https://developer.mozilla.org/zh-CN/docs/Web/CSS/CSS_grid_layout',
            '  - Grid Garden（游戏）: https://cssgridgarden.com/',
            '  - Layout Lab: https://labs.jensimmons.com/',
            '  - Subgrid 指南: https://developer.mozilla.org/zh-CN/docs/Web/CSS/CSS_grid_layout/Subgrid',
            '',
            '【常见陷阱汇总】',
            '  1. fr 被内容撑大 → 用 minmax(0, 1fr)',
            '  2. dense 打乱顺序 → 影响无障碍',
            '  3. subgrid 旧浏览器不支持 → @supports 降级',
            '  4. gap 不作用容器边缘 → 用 padding',
            '  5. auto-fill/auto-fit 必须配 minmax',
            '  6. grid-template-areas 行列数不匹配 → 整个声明失效',
            '  7. -1 仅指显式网格最后一线',
            '  8. 嵌套 grid 不继承父轨道 → 用 subgrid',
        ].join('\n');
        this.setState({ patternInfo: info });
        this._addLog('css', '实战布局模式与 vs Flexbox 演示完成');
    }
    _renderCard8() {
        const s = this.state;
        const f = this._flags();
        const card = new Card({
            title: '8. 实战布局模式与 vs Flexbox 决策树',
            extra: h('div', { class: 'flex gap-xs' }, h(Tag, { color: 'primary' }, '实战'), h(Tag, { color: f.subgrid ? 'success' : 'error' }, `subgrid ${f.subgrid ? '✓' : '✗'}`)),
            children: [
                h('p', { class: 'fs-sm text-secondary' }, '实战模式：经典三栏（areas + 1fr）/ 照片墙（auto-fit + minmax + gap）/ 12 列网格系统（repeat(12, 1fr) + span）/ 瀑布流近似（dense + 不同 span）/ 暗黑模式仪表盘（areas 响应式重排 + prefers-color-scheme）/ 圣杯布局。vs Flexbox 决策树：一维→Flex，二维→Grid；内容驱动→Flex，布局驱动→Grid；居中单元素→Flex，整页布局→Grid areas。生产常见组合：外层 Grid 控结构 + 内层 Flex 控局部。Chrome DevTools Grid 调试：网格线/area/track sizes 高亮。'),
                h('div', { class: 'flex items-center gap-sm flex-wrap' }, this._btn('运行实战模式演示', { type: 'primary', size: 'sm', onClick: () => this._runPatternDemo() })),
                h('div', { class: 'fs-sm text-secondary' }, '演示结果：'),
                h('pre', { class: 'code-block', style: { maxHeight: '600px', overflow: 'auto' } }, h('code', {}, s.patternInfo || '（点击按钮查看实战布局模式与 vs Flexbox 完整代码）')),
            ],
        });
        this.registerChild(card);
        return card.render();
    }
    _renderLogPanel() {
        const s = this.state;
        if (!s.logs || s.logs.length === 0)
            return '';
        return h(Card, { title: '运行日志' }, h('div', { class: 'log-list' }, ...s.logs.map((log) => h('div', { class: `log-item log-${log.type}` }, h('span', { class: 'log-time' }, log.time), h('span', { class: 'log-content' }, log.content)))));
    }
    renderPage() {
        const s = this.state;
        return [
            h('h2', { class: 'section-title' }, 'CSS Grid Layout 深度实验室'),
            h(Alert, {
                type: 'info',
                message: 'CSS Grid Layout Module Level 1 + Level 2 (subgrid) —— 二维网格布局核心模块',
                description: '完整覆盖 CSS Grid 全套能力：display:grid + grid-template-* 显式网格、fr 弹性单位、minmax() 约束、repeat()/auto-fill/auto-fit 响应式网格、grid-template-areas 命名区域布局、命名网格线 + grid-column/grid-row/grid-area 定位、grid-auto-flow 自动放置算法（row/column/dense）、gap + align-items/justify-items/place-items 对齐、subgrid 子网格继承父轨道（Level 2）、实战布局模式（三栏/照片墙/12 列/瀑布流/仪表盘）与 vs Flexbox 决策树。Grid L1 全线支持（Chrome 57+/Firefox 52+/Safari 10.1+），subgrid 需 Chrome 117+/Firefox 71+/Safari 16+。用 CSS.supports() 检测，jsdom 不做真实布局但流程完整。',
            }),
            s.capsSummary !== '' ? h(Alert, { type: 'info', message: s.capsSummary }) : null,
            h('div', { class: 'feature-grid' }, this._renderCard1(), this._renderCard2(), this._renderCard3(), this._renderCard4(), this._renderCard5(), this._renderCard6(), this._renderCard7(), this._renderCard8()),
            this._renderLogPanel(),
        ];
    }
}
//# sourceMappingURL=CSSGridDeepPage.js.map