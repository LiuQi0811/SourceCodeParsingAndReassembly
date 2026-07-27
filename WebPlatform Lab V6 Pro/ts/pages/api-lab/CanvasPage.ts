// CanvasPage.ts —— Canvas 2D 实验室：路径 / 渐变 / 变换 / 文字 / 动画 / 粒子
// 演示 MDN：CanvasRenderingContext2D、requestAnimationFrame、cancelAnimationFrame、devicePixelRatio
import { Page } from '../../core/Component.js';
import { h } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';
import type { Props, State } from '../../core/types.js';

export interface CanvasPageProps extends Props {}

export interface CanvasPageState extends State {
  shape: string;
  animRunning: boolean;
  particleCount: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
}

export class CanvasPage extends Page {
  declare props: CanvasPageProps;
  declare state: CanvasPageState;
  _animRaf: number | null = null;
  _particleRaf: number | null = null;
  _particles: Particle[] | null = null;

  initialState(): CanvasPageState {
    return { shape: 'star', animRunning: false, particleCount: 0 };
  }

  componentDidMount(): void {
    // 静态画布：绘制各种 2D 图元
    this._drawShapes();
    this._drawGradients();
    this._drawTransform();
    this._drawText();
  }

  componentWillUnmount(): void {
    if (this._animRaf != null) cancelAnimationFrame(this._animRaf);
    if (this._particleRaf != null) cancelAnimationFrame(this._particleRaf);
  }

  _setupCanvas(canvas: HTMLCanvasElement, w: any = 320, h: any = 200): CanvasRenderingContext2D | null {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.scale(dpr, dpr);
    return ctx;
  }

  _drawShapes(): void {
    const canvas = this.$<HTMLCanvasElement>('#canvas-shapes');
    if (!canvas) return;
    const ctx = this._setupCanvas(canvas);
    if (!ctx) return;
    ctx.clearRect(0, 0, 320, 200);

    // 矩形
    ctx.fillStyle = '#1677ff';
    ctx.fillRect(20, 20, 60, 40);

    // 圆形 arc
    ctx.beginPath();
    ctx.arc(140, 40, 22, 0, Math.PI * 2);
    ctx.fillStyle = '#52c41a';
    ctx.fill();

    // 三角形 path
    ctx.beginPath();
    ctx.moveTo(220, 20);
    ctx.lineTo(260, 60);
    ctx.lineTo(180, 60);
    ctx.closePath();
    ctx.fillStyle = '#faad14';
    ctx.fill();

    // 描边圆形
    ctx.beginPath();
    ctx.arc(280, 40, 22, 0, Math.PI * 2);
    ctx.strokeStyle = '#722ed1';
    ctx.lineWidth = 3;
    ctx.stroke();

    // 贝塞尔曲线
    ctx.beginPath();
    ctx.moveTo(20, 120);
    ctx.bezierCurveTo(80, 80, 240, 160, 300, 120);
    ctx.strokeStyle = '#ff4d4f';
    ctx.lineWidth = 2;
    ctx.stroke();

    // 二次曲线
    ctx.beginPath();
    ctx.moveTo(20, 170);
    ctx.quadraticCurveTo(160, 100, 300, 170);
    ctx.strokeStyle = '#13c2c2';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  _drawGradients(): void {
    const canvas = this.$<HTMLCanvasElement>('#canvas-gradient');
    if (!canvas) return;
    const ctx = this._setupCanvas(canvas);
    if (!ctx) return;
    // 线性渐变
    const lg = ctx.createLinearGradient(0, 0, 320, 0);
    lg.addColorStop(0, '#1677ff');
    lg.addColorStop(0.5, '#722ed1');
    lg.addColorStop(1, '#ff4d4f');
    ctx.fillStyle = lg;
    ctx.fillRect(10, 10, 300, 80);

    // 径向渐变
    const rg = ctx.createRadialGradient(80, 140, 5, 80, 140, 60);
    rg.addColorStop(0, '#fff');
    rg.addColorStop(0.5, '#52c41a');
    rg.addColorStop(1, 'rgba(82,196,26,0)');
    ctx.fillStyle = rg;
    ctx.fillRect(20, 90, 140, 100);

    // 圆锥渐变（较新）
    if (typeof ctx.createConicGradient === 'function') {
      const cg = ctx.createConicGradient(0, 240, 140);
      cg.addColorStop(0, '#ff4d4f');
      cg.addColorStop(0.25, '#faad14');
      cg.addColorStop(0.5, '#52c41a');
      cg.addColorStop(0.75, '#1677ff');
      cg.addColorStop(1, '#ff4d4f');
      ctx.fillStyle = cg;
      ctx.beginPath();
      ctx.arc(240, 140, 55, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  _drawTransform(): void {
    const canvas = this.$<HTMLCanvasElement>('#canvas-transform');
    if (!canvas) return;
    const ctx = this._setupCanvas(canvas);
    if (!ctx) return;
    ctx.translate(160, 100);
    for (let i = 0; i < 12; i++) {
      ctx.save();
      ctx.rotate((Math.PI * 2 * i) / 12);
      ctx.translate(50, 0);
      ctx.fillStyle = `hsl(${i * 30}, 70%, 55%)`;
      ctx.fillRect(-12, -12, 24, 24);
      ctx.restore();
    }
  }

  _drawText(): void {
    const canvas = this.$<HTMLCanvasElement>('#canvas-text');
    if (!canvas) return;
    const ctx = this._setupCanvas(canvas);
    if (!ctx) return;
    ctx.fillStyle = '#1677ff';
    ctx.font = 'bold 36px sans-serif';
    ctx.textBaseline = 'top';
    ctx.fillText('Canvas 2D', 20, 20);

    ctx.font = '14px monospace';
    ctx.fillStyle = 'rgba(128,128,128,0.8)';
    ctx.fillText('fillText / strokeText / measureText', 20, 70);

    // 阴影
    ctx.shadowColor = 'rgba(114,46,209,0.6)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetX = 4;
    ctx.shadowOffsetY = 4;
    ctx.fillStyle = '#722ed1';
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText('Shadow Text', 20, 110);
    ctx.shadowColor = 'transparent';

    // 测量文字
    const m = ctx.measureText('Shadow Text');
    ctx.font = '12px sans-serif';
    ctx.fillStyle = 'rgba(128,128,128,0.6)';
    ctx.fillText(`width=${(m.width as any).toFixed(1)}px`, 20, 160);
  }

  _toggleAnimation(): void {
    if (this.state.animRunning) {
      if (this._animRaf != null) cancelAnimationFrame(this._animRaf);
      this.setState({ animRunning: false });
      return;
    }
    this.setState({ animRunning: true });
    const canvas = this.$<HTMLCanvasElement>('#canvas-anim');
    if (!canvas) return;
    const ctx = this._setupCanvas(canvas, 480, 200);
    if (!ctx) return;
    const start = performance.now();
    const animate = (now: number): void => {
      const t = (now - start) / 1000;
      ctx.clearRect(0, 0, 480, 200);
      // 多个旋转方块
      for (let i = 0; i < 6; i++) {
        ctx.save();
        const x = 60 + i * 70;
        const y = 100 + Math.sin(t * 2 + i) * 40;
        ctx.translate(x, y);
        ctx.rotate(t * (1 + i * 0.2));
        ctx.fillStyle = `hsl(${(t * 60 + i * 60) % 360}, 70%, 55%)`;
        ctx.fillRect(-20, -20, 40, 40);
        ctx.restore();
      }
      this._animRaf = requestAnimationFrame(animate);
    };
    this._animRaf = requestAnimationFrame(animate);
  }

  _toggleParticles(): void {
    if (this.state.particleCount > 0) {
      if (this._particleRaf != null) cancelAnimationFrame(this._particleRaf);
      this._particles = null;
      this.setState({ particleCount: 0 });
      const canvas = this.$<HTMLCanvasElement>('#canvas-particles');
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, 480, 240);
      }
      return;
    }
    const canvas = this.$<HTMLCanvasElement>('#canvas-particles');
    if (!canvas) return;
    const ctx = this._setupCanvas(canvas, 480, 240);
    if (!ctx) return;
    const W = 480, H = 240;
    const particles: Particle[] = [];
    for (let i = 0; i < 80; i++) {
      particles.push({
        x: W / 2, y: H / 2,
        vx: (Math.random() - 0.5) * 4,
        vy: (Math.random() - 0.5) * 4,
        life: 1,
        color: `hsl(${Math.random() * 360}, 70%, 55%)`,
      });
    }
    this._particles = particles;
    this.setState({ particleCount: particles.length });
    const step = (): void => {
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.fillRect(0, 0, W, H);
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.05; // 重力
        p.life -= 0.005;
        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      // 复活衰减完的粒子
      for (const p of particles) {
        if (p.life <= 0) {
          p.x = W / 2; p.y = H / 2;
          p.vx = (Math.random() - 0.5) * 4;
          p.vy = (Math.random() - 0.5) * 4;
          p.life = 1;
        }
      }
      this._particleRaf = requestAnimationFrame(step);
    };
    this._particleRaf = requestAnimationFrame(step);
  }

  _btn(label: string, opts: Props): Node {
    const btn = new Button({ ...opts, children: label, onClick: opts.onClick });
    this.registerChild(btn);
    return btn.render() as Node;
  }

  renderPage(): Node | string | (Node | string)[] {
    return [
      h('h2', { class: 'section-title' }, 'Canvas 2D 实验室'),

      h(Alert, {
        type: 'info',
        message: 'CanvasRenderingContext2D 绘图 API',
        description: '展示路径、填充、描边、线性/径向/圆锥渐变、变换（translate/rotate/save/restore）、文字、阴影、动画与粒子系统。所有画布按 devicePixelRatio 处理高清屏。',
      }),

      // 静态图元
      h('div', { class: 'feature-grid mt-lg' },
        h(Card, { title: '路径与图元' },
          h('canvas', { id: 'canvas-shapes', class: 'canvas-stage' }),
        ),
        h(Card, { title: '渐变（Linear / Radial / Conic）' },
          h('canvas', { id: 'canvas-gradient', class: 'canvas-stage' }),
        ),
        h(Card, { title: '变换（translate / rotate / save / restore）' },
          h('canvas', { id: 'canvas-transform', class: 'canvas-stage' }),
        ),
        h(Card, { title: '文字与阴影（fillText / measureText）' },
          h('canvas', { id: 'canvas-text', class: 'canvas-stage' }),
        ),
      ),

      // 动画
      h(Card, { title: 'requestAnimationFrame 动画', extra: h(Tag, { color: this.state.animRunning ? 'success' : 'default' }, this.state.animRunning ? '运行中' : '已停止') },
        h('div', { class: 'flex flex-col gap-sm' },
          h('div', { class: 'flex gap-sm' },
            this._btn(this.state.animRunning ? '停止动画' : '启动动画', {
              type: 'primary', size: 'sm', onClick: () => this._toggleAnimation(),
            }),
          ),
          h('canvas', { id: 'canvas-anim', class: 'canvas-stage', style: { width: '480px', height: '200px' } }),
        ),
      ),

      // 粒子
      h(Card, { title: '粒子系统', extra: h(Tag, { color: this.state.particleCount > 0 ? 'success' : 'default' }, `${this.state.particleCount} 粒子`) },
        h('div', { class: 'flex flex-col gap-sm' },
          h('div', { class: 'flex gap-sm' },
            this._btn(this.state.particleCount > 0 ? '停止粒子' : '启动粒子', {
              type: 'primary', size: 'sm', onClick: () => this._toggleParticles(),
            }),
          ),
          h('canvas', { id: 'canvas-particles', class: 'canvas-stage', style: { width: '480px', height: '240px', background: '#fff' } }),
        ),
      ),
    ];
  }
}
