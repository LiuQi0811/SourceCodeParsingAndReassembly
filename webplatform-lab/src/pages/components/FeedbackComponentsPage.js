// FeedbackComponentsPage.js —— 反馈组件：Message / Notification / Modal / Drawer
import { Page } from '../../core/Component.js';
import { h } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Modal, confirm } from '../../components/ui/Modal.js';
import { Drawer } from '../../components/ui/Drawer.js';
import { message } from '../../components/ui/Message.js';
import { notification } from '../../components/ui/Notification.js';
import { Progress } from '../../components/ui/Progress.js';

export class FeedbackComponentsPage extends Page {
  initialState() { return { progress: 0 }; }

  _btn(label, opts) {
    const btn = new Button({ ...opts, children: label });
    this.registerChild(btn);
    return btn.render();
  }

  _openModal() {
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

  _openDrawer() {
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

  _asyncTask() {
    return new Promise((resolve) => {
      this.setState({ progress: 0 });
      const timer = setInterval(() => {
        const next = this.state.progress + 10;
        this.setState({ progress: next });
        if (next >= 100) { clearInterval(timer); resolve(); }
      }, 200);
    });
  }

  renderPage() {
    return [
      h('h2', { class: 'section-title' }, '反馈组件'),

      h(Card, { title: 'Message 全局消息' },
        h('div', { class: 'demo-row' },
          this._btn('成功', { type: 'success', onClick: () => message.success('操作成功') }),
          this._btn('警告', { type: 'warning', onClick: () => message.warning('请注意风险') }),
          this._btn('错误', { type: 'danger', onClick: () => message.error('操作失败') }),
          this._btn('信息', { onClick: () => message.info('这是一条信息') }),
          this._btn('加载中', { type: 'primary', onClick: async () => {
            await message.withLoading('正在处理…', () => new Promise(r => setTimeout(r, 1500)), '处理完成');
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
          this._btn('打开 Drawer', { type: 'primary', onClick: () => this._openDrawer() }),
        ),
      ),

      h(Card, { title: 'Progress 进度条（演示 requestAnimationFrame）' },
        this._btn('开始异步任务', { type: 'primary', onClick: () => this._asyncTask() }),
        h('div', { class: 'mt-md' }, (() => {
          const p = new Progress({ percent: this.state.progress, status: this.state.progress >= 100 ? 'success' : 'active' });
          this.registerChild(p);
          return p.render();
        })()),
      ),
    ];
  }
}
