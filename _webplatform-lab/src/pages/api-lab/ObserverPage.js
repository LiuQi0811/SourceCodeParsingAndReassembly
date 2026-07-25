// ObserverPage.js —— Observer 三剑客：Intersection / Mutation / Resize
// 演示 MDN：IntersectionObserver、MutationObserver、ResizeObserver、disconnect/takeRecords
import { Page } from '../../core/Component.js';
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';

export class ObserverPage extends Page {
  initialState() {
    return {
      intersectionLog: [],
      mutationLog: [],
      resizeLog: [],
      intersectionRatio: 0,
      boxWidth: 200,
      mutationCount: 0,
    };
  }

  componentDidMount() {
    this._setupIntersection();
    this._setupMutation();
    this._setupResize();
  }

  componentWillUnmount() {
    this._intersectionObserver?.disconnect();
    this._mutationObserver?.disconnect();
    this._resizeObserver?.disconnect();
  }

  _addIntersection(entry) {
    this.setState({
      intersectionRatio: Math.round(entry.intersectionRatio * 100),
      intersectionLog: [...this.state.intersectionLog, {
        time: formatTime(),
        text: `ratio=${(entry.intersectionRatio * 100).toFixed(0)}%  isIntersecting=${entry.isIntersecting}`,
      }].slice(-15),
    });
  }

  _setupIntersection() {
    const target = this.$('#intersection-target');
    if (!target) return;
    this._intersectionObserver = new IntersectionObserver((entries) => {
      entries.forEach((e) => this._addIntersection(e));
    }, { threshold: [0, 0.25, 0.5, 0.75, 1] });
    this._intersectionObserver.observe(target);
  }

  _setupMutation() {
    const target = this.$('#mutation-target');
    if (!target) return;
    this._mutationObserver = new MutationObserver((mutations) => {
      const logs = [];
      for (const m of mutations) {
        if (m.type === 'childList') {
          m.addedNodes.forEach((n) => logs.push(`+ ${n.nodeName}`));
          m.removedNodes.forEach((n) => logs.push(`- ${n.nodeName}`));
        } else if (m.type === 'attributes') {
          logs.push(`attr ${m.attributeName} = ${m.target.getAttribute(m.attributeName)}`);
        } else if (m.type === 'characterData') {
          logs.push(`text changed`);
        }
      }
      this.setState((s) => ({
        mutationCount: s.mutationCount + logs.length,
        mutationLog: [...s.mutationLog, ...logs.map((t) => ({ time: formatTime(), text: t }))].slice(-20),
      }));
    });
    this._mutationObserver.observe(target, {
      childList: true, attributes: true, characterData: true, subtree: true, attributeOldValue: false,
    });
  }

  _setupResize() {
    const target = this.$('#resize-target');
    if (!target) return;
    this._resizeObserver = new ResizeObserver((entries) => {
      for (const e of entries) {
        const cr = e.contentRect;
        this.setState({
          boxWidth: Math.round(cr.width),
          resizeLog: [...this.state.resizeLog, {
            time: formatTime(),
            text: `${Math.round(cr.width)} × ${Math.round(cr.height)}  (borderBox: ${e.borderBoxSize?.[0]?.inlineSize?.toFixed(0) || '?'}px)`,
          }].slice(-15),
        });
      }
    });
    this._resizeObserver.observe(target);
  }

  _btn(label, opts) {
    const btn = new Button({ ...opts, children: label, onClick: opts.onClick });
    this.registerChild(btn);
    return btn.render();
  }

  _mutate(type) {
    const target = this.$('#mutation-target');
    if (!target) return;
    if (type === 'add') {
      const el = document.createElement('div');
      el.className = 'tag tag--primary';
      el.textContent = `节点 #${target.children.length + 1}`;
      target.appendChild(el);
    } else if (type === 'remove' && target.lastChild) {
      target.removeChild(target.lastChild);
    } else if (type === 'attr') {
      const cur = target.getAttribute('data-version') || '0';
      target.setAttribute('data-version', String(Number(cur) + 1));
    } else if (type === 'text') {
      const span = target.querySelector('[data-mut-text]');
      if (span) span.textContent = `时间 ${Date.now()}`;
    } else if (type === 'clear') {
      target.innerHTML = '<span data-mut-text>初始文本</span>';
    }
  }

  _resize(delta) {
    const target = this.$('#resize-target');
    if (!target) return;
    const cur = parseInt(target.style.width, 10) || 200;
    target.style.width = Math.max(80, Math.min(500, cur + delta)) + 'px';
  }

  renderPage() {
    return [
      h('h2', { class: 'section-title' }, 'Observer 实验室'),

      h(Alert, {
        type: 'info',
        message: 'IntersectionObserver / MutationObserver / ResizeObserver',
        description: '三大 Observer 替代传统的 scroll/resize 轮询与 Mutation Events，性能更好。每个 Observer 提供 observe / unobserve / disconnect / takeRecords。',
      }),

      // IntersectionObserver
      h(Card, { title: 'IntersectionObserver', extra: h(Tag, { color: 'primary' }, `${this.state.intersectionRatio}%`) },
        h('p', { class: 'fs-sm text-secondary' }, '滚动下方容器，目标方块进入/离开视口时会触发回调并计算交叉比例。'),
        h('div', {
          class: 'observer-scroll',
          style: { height: '180px', overflowY: 'auto', border: '1px dashed #d9d9d9', padding: '600px 20px 20px' },
        },
          h('div', {
            id: 'intersection-target',
            style: {
              width: '120px', height: '120px',
              background: `linear-gradient(135deg, #1677ff 0%, #722ed1 ${this.state.intersectionRatio}%, #f0f0f0 ${this.state.intersectionRatio}%)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontWeight: 'bold', borderRadius: '8px',
              transition: 'background 0.2s',
            },
          }, `${this.state.intersectionRatio}%`),
        ),
        h('div', { class: 'log-panel mt-sm', style: { maxHeight: '120px' } },
          ...this.state.intersectionLog.map((l) => h('div', { class: 'log-panel__line' },
            h('span', { class: 'log-panel__time' }, l.time),
            h('span', { class: 'log-panel__tag log-panel__tag--push' }, 'intersect'),
            h('span', {}, l.text),
          )),
        ),
      ),

      // MutationObserver
      h(Card, { title: 'MutationObserver', extra: h(Tag, { color: 'success' }, `${this.state.mutationCount} 次`) },
        h('p', { class: 'fs-sm text-secondary' }, '观察下方容器内的 DOM 变化（添加/删除节点、属性变更、文本变更）。'),
        h('div', { class: 'flex gap-sm mb-sm' },
          this._btn('+ 添加节点', { size: 'sm', type: 'primary', onClick: () => this._mutate('add') }),
          this._btn('- 删除节点', { size: 'sm', onClick: () => this._mutate('remove') }),
          this._btn('改属性', { size: 'sm', onClick: () => this._mutate('attr') }),
          this._btn('改文本', { size: 'sm', onClick: () => this._mutate('text') }),
          this._btn('清空', { size: 'sm', danger: true, onClick: () => this._mutate('clear') }),
        ),
        h('div', {
          id: 'mutation-target',
          'data-version': '0',
          class: 'mutation-target',
        }, h('span', { 'data-mut-text': true }, '初始文本')),
        h('div', { class: 'log-panel mt-sm', style: { maxHeight: '120px' } },
          ...this.state.mutationLog.map((l) => h('div', { class: 'log-panel__line' },
            h('span', { class: 'log-panel__time' }, l.time),
            h('span', { class: 'log-panel__tag log-panel__tag--info' }, 'mutate'),
            h('span', {}, l.text),
          )),
        ),
      ),

      // ResizeObserver
      h(Card, { title: 'ResizeObserver', extra: h(Tag, { color: 'warning' }, `宽 ${this.state.boxWidth}px`) },
        h('p', { class: 'fs-sm text-secondary' }, '拖动下方滑块改变方块宽度，ResizeObserver 会捕获 contentRect 变化。'),
        h('div', { class: 'flex gap-sm mb-sm' },
          this._btn('- 20px', { size: 'sm', onClick: () => this._resize(-20) }),
          this._btn('+ 20px', { size: 'sm', onClick: () => this._resize(20) }),
        ),
        h('input', {
          type: 'range', min: '80', max: '500', value: String(this.state.boxWidth),
          style: { width: '100%' },
          oninput: (e) => {
            const target = this.$('#resize-target');
            if (target) target.style.width = e.target.value + 'px';
          },
        }),
        h('div', {
          id: 'resize-target',
          style: {
            width: '200px', height: '80px',
            background: 'linear-gradient(135deg, #52c41a, #1677ff)',
            borderRadius: '8px', marginTop: '12px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontWeight: 'bold',
          },
        }, `${this.state.boxWidth}px`),
        h('div', { class: 'log-panel mt-sm', style: { maxHeight: '120px' } },
          ...this.state.resizeLog.map((l) => h('div', { class: 'log-panel__line' },
            h('span', { class: 'log-panel__time' }, l.time),
            h('span', { class: 'log-panel__tag log-panel__tag--error' }, 'resize'),
            h('span', {}, l.text),
          )),
        ),
      ),
    ];
  }
}
