// GeneralComponentsPage.js —— 通用组件演示：Avatar / Spin / List / Statistic / Result / Image / Upload
import { Page } from '../../core/Component.js';
import { h } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Tag } from '../../components/ui/Tag.js';
import { Button } from '../../components/ui/Button.js';
import { Avatar } from '../../components/ui/Avatar.js';
import { Spin } from '../../components/ui/Spin.js';
import { List } from '../../components/ui/List.js';
import { Statistic } from '../../components/ui/Statistic.js';
import { Result } from '../../components/ui/Result.js';
import { Image } from '../../components/ui/Image.js';
import { Upload } from '../../components/ui/Upload.js';
import { Empty } from '../../components/ui/Progress.js';
import { message } from '../../components/ui/Message.js';
import { BackTop } from '../../components/ui/BackTop.js';

export class GeneralComponentsPage extends Page {
  initialState() {
    return {
      spinLoading: true,
    };
  }

  _btn(label, opts) {
    const btn = new Button({ ...opts, children: label });
    this.registerChild(btn);
    return btn.render();
  }

  _toggleSpin() {
    this.setState({ spinLoading: !this.state.spinLoading });
  }

  renderPage() {
    // —— Avatar ——
    const avatarCard = new Card({
      title: 'Avatar 头像',
      children: [
        h('div', { class: 'demo-row' }, h('span', { class: 'demo-row__label' }, '尺寸'),
          h(Avatar, { size: 'lg' }, 'U'),
          h(Avatar, { size: 'middle' }, 'U'),
          h(Avatar, { size: 'sm' }, 'U'),
        ),
        h('div', { class: 'demo-row' }, h('span', { class: 'demo-row__label' }, '形状'),
          h(Avatar, { shape: 'circle' }, '圆'),
          h(Avatar, { shape: 'square' }, '方'),
        ),
        h('div', { class: 'demo-row' }, h('span', { class: 'demo-row__label' }, '图片'),
          h(Avatar, { src: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix' }),
          h(Avatar, { src: 'invalid-url', alt: '头像' }, '兜'),
        ),
      ],
    });
    this.registerChild(avatarCard);

    // —— Spin ——
    const spinCard = new Card({
      title: 'Spin 加载中',
      children: [
        h('div', { class: 'demo-row' }, h('span', { class: 'demo-row__label' }, '尺寸'),
          h(Spin, { size: 'lg' }),
          h(Spin, { size: 'middle' }),
          h(Spin, { size: 'sm' }),
        ),
        h('div', { class: 'demo-row' }, h('span', { class: 'demo-row__label' }, '带提示'),
          h(Spin, { tip: '加载中...' }),
        ),
        h('div', { class: 'mt-sm' },
          this._btn(this.state.spinLoading ? '停止' : '开始', {
            type: 'primary', onClick: () => this._toggleSpin(),
          }),
          h('span', { class: 'ml-md' },
            h(Spin, { spinning: this.state.spinLoading, size: 'sm' },
              h('span', { class: 'text-secondary' }, '这段文字在加载状态下会被遮罩'),
            ),
          ),
        ),
      ],
    });
    this.registerChild(spinCard);

    // —— List ——
    const listData = [
      { title: '标题一', desc: 'Ant Design 是一个企业级 UI 设计语言。' },
      { title: '标题二', desc: '基于原生 Web API 实现的组件库。' },
      { title: '标题三', desc: '零依赖，可阅读每一行代码。' },
    ];
    const listCard = new Card({
      title: 'List 列表',
      children: [
        h(List, {
          header: h('span', { class: 'text-secondary' }, '列表头部'),
          footer: h('span', { class: 'text-tertiary' }, '列表底部'),
          split: true,
          dataSource: listData,
          renderItem: (item) => h('div', {},
            h('div', { class: 'flex items-center justify-between' },
              h('span', { class: 'text-primary font-medium' }, item.title),
              h(Tag, { color: 'primary' }, '标签'),
            ),
            h('p', { class: 'text-secondary fs-sm mt-xs' }, item.desc),
          ),
        }),
      ],
    });
    this.registerChild(listCard);

    // —— Statistic ——
    const statCard = new Card({
      title: 'Statistic 统计数值',
      children: [
        h('div', { class: 'demo-row' },
          h(Statistic, { title: '活跃用户', value: 112893, suffix: '人' }),
          h(Statistic, { title: '转化率', value: 0.856, precision: 2, suffix: '%', valueStyle: { color: '#52c41a' } }),
          h(Statistic, { title: '未读消息', value: 18, prefix: h('span', {}, '📨') }),
        ),
      ],
    });
    this.registerChild(statCard);

    // —— Image ——
    const imageCard = new Card({
      title: 'Image 图片',
      children: [
        h('div', { class: 'demo-row' },
          h(Image, { width: 120, height: 120, src: 'https://picsum.photos/seed/lab1/240/240', alt: '示例图' }),
          h(Image, { width: 120, height: 120, src: 'https://picsum.photos/seed/lab2/240/240', alt: '可预览', preview: true }),
          h(Image, { width: 120, height: 120, src: 'invalid.png', alt: '加载失败' }),
        ),
      ],
    });
    this.registerChild(imageCard);

    // —— Result ——
    const resultCard = new Card({
      title: 'Result 结果页',
      children: [
        h('div', { class: 'demo-row' },
          h(Result, { status: 'success', title: '操作成功', subTitle: '您的提交已处理完成', extra: this._btn('返回', { onClick: () => message.info('点击返回') }) }),
          h(Result, { status: 'error', title: '提交失败', subTitle: '请检查网络后重试', extra: this._btn('重试', { type: 'primary', onClick: () => message.warning('重试中...') }) }),
        ),
      ],
    });
    this.registerChild(resultCard);

    // —— Upload ——
    // children 作为 h() 的可变参数传入（项目主流写法）。
    // h() 也兼容 h(Comp, { children: ... }) 写法（可变参数为空时回退到 props.children）。
    const uploadCard = new Card({
      title: 'Upload 上传',
      children: [
        h(Upload, {
          listType: 'text',
          maxCount: 5,
          onChange: (files) => { message.info(`当前 ${files.length} 个文件`); },
        }, this._btn('点击上传', { type: 'primary' })),
        h('div', { class: 'mt-md' },
          h(Upload, {
            listType: 'picture',
            maxCount: 3,
            accept: 'image/*',
          }, h('div', { class: 'upload__area' },
            h('div', { class: 'text-secondary' }, '📁 拖拽或点击上传图片'),
          )),
        ),
      ],
    });
    this.registerChild(uploadCard);

    // —— Empty ——
    const emptyCard = new Card({
      title: 'Empty 空状态',
      children: [
        h('div', { class: 'demo-row' },
          h(Empty, {}),
          h(Empty, { description: '暂无搜索结果' }),
        ),
      ],
    });
    this.registerChild(emptyCard);

    // —— BackTop ——
    // BackTop 默认 fixed 定位在右下角，监听 window 滚动；
    // 滚动超过 visibilityHeight 后显示按钮，点击平滑滚动回顶部。
    // 用 registerChild 注册以便页面卸载/重渲染时清理滚动监听。
    const backTopCard = new Card({
      title: 'BackTop 回到顶部',
      children: [
        h('p', { class: 'text-secondary' }, 'BackTop 默认固定在页面右下角。向下滚动超过 100px 后会出现回到顶部按钮，点击后平滑滚动回顶部。'),
        (() => {
          const bt = new BackTop({ visibilityHeight: 100, duration: 450 });
          this.registerChild(bt);
          return bt.render();
        })(),
      ],
    });
    this.registerChild(backTopCard);

    return [
      h('h2', { class: 'section-title' }, '通用组件'),
      h('p', { class: 'text-secondary mb-lg' }, 'Avatar / Spin / List / Statistic / Result / Image / Upload / Empty 等通用展示组件。'),
      avatarCard.render(),
      spinCard.render(),
      listCard.render(),
      statCard.render(),
      imageCard.render(),
      resultCard.render(),
      uploadCard.render(),
      emptyCard.render(),
      backTopCard.render(),
    ];
  }
}
