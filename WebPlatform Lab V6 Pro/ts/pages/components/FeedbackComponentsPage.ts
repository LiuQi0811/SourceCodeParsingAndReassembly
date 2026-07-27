// FeedbackComponentsPage.ts —— 反馈组件：Message / Notification / Modal / Drawer
import { Page } from '../../core/Component.js';
import { h } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Modal, confirm } from '../../components/ui/Modal.js';
import { Drawer } from '../../components/ui/Drawer.js';
import { message } from '../../components/ui/Message.js';
import { notification } from '../../components/ui/Notification.js';
import { Progress } from '../../components/ui/Progress.js';
import { Popconfirm } from '../../components/ui/Popconfirm.js';
import { Tour } from '../../components/ui/Tour.js';
import type { Props, State } from '../../core/types.js';
import type { ButtonProps } from '../../components/ui/Button.js';

export interface FeedbackComponentsPageProps extends Props {}

export interface FeedbackComponentsPageState extends State {
  progress: number;
  tourOpen: boolean;
}

export class FeedbackComponentsPage extends Page {
  declare props: FeedbackComponentsPageProps;
  declare state: FeedbackComponentsPageState;
  _progressTimer: ReturnType<typeof setInterval> | null = null;

  initialState(): FeedbackComponentsPageState { return { progress: 0, tourOpen: false }; }

  componentWillUnmount(): void {
    // 清理未完成的进度任务定时器，避免卸载后仍 setState 导致报错/泄漏
    if (this._progressTimer) {
      clearInterval(this._progressTimer);
      this._progressTimer = null;
    }
  }

  _btn(label: string, opts: ButtonProps): Node | string {
    const btn = new Button({ ...opts, children: label });
    this.registerChild(btn);
    return btn.render();
  }

  _openModal(): void {
    const modal = new Modal({
      title: '编辑信息',
      width: 480,
      onOk: () => { message.success('已保存'); },
      children: h('div', { class: 'flex flex-col gap-sm' },
        h('p', {}, '这是一个由自研 Modal 组件渲染的对话框。'),
        h('input', { class: 'input', placeholder: '输入内容…' }),
      ),
    });
    this.registerChild(modal);
    modal.open();
    modal.mount(document.body);
  }

  _openDrawer(): void {
    const drawer = new Drawer({
      title: '抽屉面板',
      width: 380,
      children: h('div', {},
        h('p', { class: 'text-secondary mb-md' }, 'Drawer 从右侧滑入，适合承载详情或表单。'),
        h('div', { class: 'flex flex-col gap-sm' },
          h('input', { class: 'input', placeholder: '字段 1' }),
          h('input', { class: 'input', placeholder: '字段 2' }),
          h('textarea', { class: 'input', placeholder: '备注', rows: 3 }),
        ),
      ),
    });
    this.registerChild(drawer);
    drawer.open();
    drawer.mount(document.body);
  }

  _openDrawerLeft(): void {
    const drawer = new Drawer({
      title: '左侧抽屉',
      placement: 'left',
      width: 320,
      children: h('div', {},
        h('p', { class: 'text-secondary mb-md' }, 'Drawer 也可从左侧滑入，适合导航或筛选面板。'),
        h('div', { class: 'flex flex-col gap-sm' },
          h('input', { class: 'input', placeholder: '筛选关键词' }),
          h('div', { class: 'flex gap-sm' },
            (() => { const b = new Button({ type: 'primary', children: '应用筛选', onClick: () => { message.success('已应用'); drawer.close(); } }); this.registerChild(b); return b.render(); })(),
            (() => { const b = new Button({ children: '重置', onClick: () => message.info('已重置') }); this.registerChild(b); return b.render(); })(),
          ),
        ),
      ),
    });
    this.registerChild(drawer);
    drawer.open();
    drawer.mount(document.body);
  }

  _asyncTask(): Promise<void> {
    return new Promise((resolve) => {
      // 清理上一次未完成的定时器，防止多个任务并行互相覆盖
      if (this._progressTimer) { clearInterval(this._progressTimer); this._progressTimer = null; }
      this.setState({ progress: 0 });
      this._progressTimer = setInterval(() => {
        const next = this.state.progress + 10;
        this.setState({ progress: next });
        if (next >= 100) {
          if (this._progressTimer) { clearInterval(this._progressTimer); this._progressTimer = null; }
          resolve();
        }
      }, 200);
    });
  }

  renderPage(): Node | string | (Node | string)[] {
    return [
      h('h2', { class: 'section-title' }, '反馈组件'),

      h(Card, { title: 'Message 全局消息' },
        h('div', { class: 'demo-row' },
          this._btn('成功', { type: 'success', onClick: () => message.success('操作成功') }),
          this._btn('警告', { type: 'warning', onClick: () => message.warning('请注意风险') }),
          this._btn('错误', { type: 'danger', onClick: () => message.error('操作失败') }),
          this._btn('信息', { onClick: () => message.info('这是一条信息') }),
          this._btn('加载中', { type: 'primary', onClick: async () => {
            await message.withLoading('正在处理…', () => new Promise<void>(r => setTimeout(r, 1500)), '处理完成');
          }}),
        ),
      ),

      h(Card, { title: 'Notification 通知提醒' },
        h('div', { class: 'demo-row' },
          this._btn('成功通知', { type: 'success', onClick: () => notification.success('保存成功', '您的修改已同步到服务器。') }),
          this._btn('警告通知', { type: 'warning', onClick: () => notification.warning('存储空间不足', '剩余空间不足 10%，请及时清理。') }),
          this._btn('错误通知', { type: 'danger', onClick: () => notification.error('同步失败', '网络连接异常，已自动重试 3 次。') }),
          this._btn('信息通知', { onClick: () => notification.info('系统通知', '版本 v1.2.0 已发布。') }),
        ),
      ),

      h(Card, { title: 'Modal 对话框' },
        h('div', { class: 'demo-row' },
          this._btn('打开 Modal', { type: 'primary', onClick: () => this._openModal() }),
          this._btn('确认弹窗', { onClick: async () => {
            const ok = await confirm({
              title: '确认删除？', danger: true, okText: '删除',
              content: h('p', {}, '此操作不可恢复，确定要删除该项吗？'),
            });
            if (ok) message.success('已删除');
            else message.info('已取消');
          }}),
        ),
      ),

      h(Card, { title: 'Drawer 抽屉' },
        h('div', { class: 'demo-row' },
          this._btn('右侧 Drawer', { type: 'primary', onClick: () => this._openDrawer() }),
          this._btn('左侧 Drawer', { onClick: () => this._openDrawerLeft() }),
        ),
      ),

      h(Card, { title: 'Progress 进度条（演示定时器）' },
        this._btn('开始异步任务', { type: 'primary', onClick: () => this._asyncTask() }),
        h('div', { class: 'mt-md' }, (() => {
          const p = new Progress({ percent: this.state.progress, status: this.state.progress >= 100 ? 'success' : 'active' });
          this.registerChild(p);
          return p.render();
        })()),
      ),

      // Popconfirm
      h(Card, { title: 'Popconfirm 气泡确认框' },
        h('div', { class: 'demo-row' },
          h(Popconfirm, {
            title: '确定删除这项内容？',
            okText: '删除',
            okType: 'danger',
            cancelText: '取消',
            onConfirm: () => message.success('已删除'),
            onCancel: () => message.info('已取消'),
          }, this._btn('删除', { type: 'danger' })),
          h(Popconfirm, {
            title: '确定要执行此操作吗？',
            description: '此操作将影响相关数据。',
            okText: '确定',
            cancelText: '取消',
            onConfirm: () => message.success('已确认'),
          }, this._btn('确认操作', { type: 'primary' })),
          h(Popconfirm, {
            title: '带图标的确认框',
            icon: '⚠️',
            onConfirm: () => message.success('已确认'),
          }, this._btn('带图标', {})),
        ),
      ),

      // Tour
      h(Card, { title: 'Tour 漫游引导' },
        h('div', { class: 'demo-row' },
          this._btn('开始引导', { type: 'primary', onClick: () => this.setState({ tourOpen: true }) }),
          h('span', { class: 'text-secondary fs-sm' }, '点击按钮启动漫游引导（open 初始为 false）'),
        ),
        (() => { const t = new Tour({
          open: this.state.tourOpen,
          onClose: () => this.setState({ tourOpen: false }),
          steps: [
            { title: '第一步', description: '这是漫游引导的第一步，介绍基本功能。' },
            { title: '第二步', description: '这是第二步，展示更多内容。' },
            { title: '完成', description: '引导到此结束，感谢观看！' },
          ],
        }); this.registerChild(t); return t.render(); })(),
      ),
    ];
  }
}
