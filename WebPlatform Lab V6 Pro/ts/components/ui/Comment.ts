// Comment.ts —— 评论组件
import { Component } from '../../core/Component.js';
import { h } from '../../core/utils.js';
import type { Props, State } from '../../core/types.js';

export interface CommentProps extends Props {
  actions?: (Node | string)[];
  author?: Node | string;
  avatar?: Node | string;
  content?: Node | string;
  datetime?: Node | string;
  children?: Node | string | (Node | string)[];
}

export interface CommentState extends State {}

export class Comment extends Component {
  declare props: CommentProps;
  declare state: CommentState;

  render(): Node | string {
    const {
      actions = [], author, avatar, content, datetime, children,
    } = this.props;

    // 头像（可传字符串 URL 或任意节点）
    const avatarNode: Node | null = avatar == null
      ? null
      : (typeof avatar === 'string'
        ? h('img', { class: 'comment__avatar-img', src: avatar, alt: author || '' })
        : h('div', { class: 'comment__avatar' }, avatar));

    // 主体：作者行 + 内容 + 操作
    const body = h('div', { class: 'comment__content' },
      (author != null || datetime != null) && h('div', { class: 'comment__author' },
        author && h('span', { class: 'comment__author-name' }, author),
        datetime && h('span', { class: 'comment__author-time' }, datetime),
      ),
      content && h('div', { class: 'comment__detail' }, content),
      actions.length > 0 && h('ul', { class: 'comment__actions' },
        ...actions.map((act, i) => h('li', { class: 'comment__action', key: i }, act)),
      ),
    );

    const inner = h('div', { class: 'comment__inner' },
      avatarNode && h('div', { class: 'comment__avatar-wrap' }, avatarNode),
      body,
    );

    // 嵌套评论作为回复列表
    const kids = Array.isArray(children) ? children : (children ? [children] : []);
    return h('div', { class: 'comment' },
      inner,
      kids.length > 0 && h('div', { class: 'comment__nested' }, ...kids),
    );
  }
}
