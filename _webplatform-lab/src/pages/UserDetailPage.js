// UserDetailPage.js —— 用户详情：演示动态路由参数 :id
import { Page } from '../core/Component.js';
import { h, request } from '../core/utils.js';
import { Card } from '../components/ui/Card.js';
import { Tag } from '../components/ui/Tag.js';
import { Button } from '../components/ui/Button.js';
import { Skeleton } from '../components/ui/Progress.js';

export class UserDetailPage extends Page {
  initialState() { return { user: null, loading: true, error: null }; }

  async onRouteEnter(params) {
    const id = params?.id || this.props.params?.id;
    if (!id) return;
    this.setState({ loading: true, error: null });
    try {
      const all = await request('./assets/data/users.json');
      const user = all.find((u) => String(u.id) === String(id));
      if (!user) throw new Error(`找不到 ID 为 ${id} 的用户`);
      this.setState({ user, loading: false });
    } catch (err) {
      this.setState({ error: err.message, loading: false });
    }
  }

  renderPage() {
    const { id } = this.props.params || {};

    if (this.state.loading) {
      return [
        h('h2', { class: 'section-title' }, `用户 #${id}`),
        h('div', { class: 'card' }, h('div', { class: 'card__body' }, h(Skeleton, { lines: 6 }))),
      ];
    }

    if (this.state.error) {
      return [
        h('h2', { class: 'section-title' }, '加载失败'),
        h('div', { class: 'alert alert--error' },
          h('span', { class: 'alert__icon' }, '✕'),
          h('div', {}, this.state.error),
        ),
      ];
    }

    const u = this.state.user;
    const backBtn = new Button({
      children: '← 返回路由示例',
      onClick: () => this.props.router.push('/router'),
    });
    this.registerChild(backBtn);
    const prevBtn = new Button({
      type: 'primary', children: '上一个用户',
      onClick: () => this.props.router.push(`/router/user/${Number(id) - 1 || 1}`),
    });
    this.registerChild(prevBtn);
    const nextBtn = new Button({
      type: 'primary', children: '下一个用户',
      onClick: () => this.props.router.push(`/router/user/${Number(id) + 1}`),
    });
    this.registerChild(nextBtn);

    return [
      h('h2', { class: 'section-title' }, `用户详情 #${id}`),
      h('div', { class: 'flex items-center justify-between mb-md' },
        backBtn.render(),
        h('div', { class: 'flex gap-sm' }, prevBtn.render(), nextBtn.render()),
      ),
      h('div', { class: 'user-detail' },
        h('div', { class: 'user-avatar' }, u.name.charAt(0)),
        h('div', { class: 'flex-1' },
          h(Card, { title: '基本信息' },
            h('div', { class: 'flex flex-col gap-sm' },
              h('div', { class: 'flex justify-between' }, h('span', { class: 'text-tertiary' }, '姓名'), h('span', { class: 'fw-medium' }, u.name)),
              h('div', { class: 'flex justify-between' }, h('span', { class: 'text-tertiary' }, '邮箱'), h('span', { class: 'text-mono' }, u.email)),
              h('div', { class: 'flex justify-between' }, h('span', { class: 'text-tertiary' }, '角色'),
                h(Tag, { color: 'primary' }, u.role)),
              h('div', { class: 'flex justify-between' }, h('span', { class: 'text-tertiary' }, '年龄'), h('span', {}, `${u.age} 岁`)),
              h('div', { class: 'flex justify-between' }, h('span', { class: 'text-tertiary' }, '城市'), h('span', {}, u.city)),
              h('div', { class: 'flex justify-between' }, h('span', { class: 'text-tertiary' }, '状态'),
                h(Tag, { color: u.status === 'active' ? 'success' : 'warning' }, u.status === 'active' ? '在线' : '空闲')),
              h('div', { class: 'flex justify-between' }, h('span', { class: 'text-tertiary' }, '加入时间'), h('span', {}, u.joined)),
            ),
          ),
        ),
      ),
      h('div', { class: 'alert alert--info mt-lg' },
        h('span', { class: 'alert__icon' }, 'ℹ'),
        h('div', {},
          h('div', { class: 'fw-medium' }, '动态路由参数'),
          h('div', { class: 'fs-sm' }, `当前路径 /router/user/:id 解析得到 params.id = "${id}"。Router 通过正则匹配 :id 段并自动注入到 onRouteEnter。`),
        ),
      ),
    ];
  }
}
