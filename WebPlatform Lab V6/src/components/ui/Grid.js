// Grid.js —— 栅格布局组件（Row/Col）
import { Component } from '../../core/Component.js';
import { h } from '../../core/utils.js';

const BREAKPOINTS = ['xs', 'sm', 'md', 'lg', 'xl', 'xxl'];

const JUSTIFY_MAP = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  'space-around': 'space-around',
  'space-between': 'space-between',
};

const ALIGN_MAP = {
  top: 'flex-start',
  middle: 'center',
  bottom: 'flex-end',
};

/** 栅格行容器：支持 gutter/justify/align/wrap */
export class Row extends Component {
  render() {
    const {
      gutter = 0, justify = 'start', align = 'top',
      wrap = true, className = '', children,
    } = this.props;

    // gutter 可为数字（水平=垂直）或 [水平, 垂直]
    const [gx, gy] = Array.isArray(gutter)
      ? [gutter[0] || 0, gutter[1] || 0]
      : [gutter, gutter];

    const classes = [
      'row',
      justify !== 'start' && `row--justify-${justify}`,
      align !== 'top' && `row--align-${align}`,
      !wrap && 'row--nowrap',
      className,
    ];

    const style = {
      display: 'flex',
      flexFlow: `${wrap ? 'wrap' : 'nowrap'} row`,
      justifyContent: JUSTIFY_MAP[justify] || justify,
      alignItems: ALIGN_MAP[align] || align,
      boxSizing: 'border-box',
    };

    const kids = Array.isArray(children) ? children : [children];
    const row = h('div', { class: classes, style }, ...kids);

    // 通过 CSS 变量把 gutter 传递给 Col（Object.assign 不支持自定义属性，需手动 setProperty）。
    // Row 自身用负 margin 抵消边界 Col 的 gutter，使内容与容器边缘对齐。
    if (gx) {
      row.style.setProperty('--row-gutter-x', `${gx / 2}px`);
      row.style.marginLeft = `${-gx / 2}px`;
      row.style.marginRight = `${-gx / 2}px`;
    }
    if (gy) {
      row.style.setProperty('--row-gutter-y', `${gy / 2}px`);
      row.style.marginTop = `${-gy / 2}px`;
    }
    return row;
  }
}

/** 解析响应式断点配置：数字 → {span}；对象 → 透传 span/offset/push/pull */
function parseResponsive(value) {
  if (value == null) return null;
  if (typeof value === 'number') return { span: value, offset: 0, push: 0, pull: 0 };
  if (typeof value === 'object') {
    return {
      span: value.span,
      offset: value.offset || 0,
      push: value.push || 0,
      pull: value.pull || 0,
    };
  }
  return null;
}

/** 栅格列：支持 span/offset/push/pull 与 xs/sm/md/lg/xl/xxl 响应式 */
export class Col extends Component {
  render() {
    const {
      span, offset = 0, push = 0, pull = 0,
      className = '', children, ...rest
    } = this.props;

    const classes = ['col', className];
    const style = {
      boxSizing: 'border-box',
      // gutter 通过 CSS 变量读取（Row 上定义），未定义时回退 0
      marginLeft: 'var(--row-gutter-x, 0px)',
      marginRight: 'var(--row-gutter-x, 0px)',
      marginTop: 'var(--row-gutter-y, 0px)',
    };

    // 基础 span：flex-basis 基于 span/24
    if (span != null) {
      const pct = `${(span / 24) * 100}%`;
      style.flex = `0 0 ${pct}`;
      style.maxWidth = pct;
    } else {
      style.flex = '0 0 auto';
    }

    // offset/push/pull：offset 覆盖 gutter 的 marginLeft
    if (offset) style.marginLeft = `${(offset / 24) * 100}%`;
    if (push) { style.position = 'relative'; style.left = `${(push / 24) * 100}%`; }
    if (pull) { style.position = 'relative'; style.right = `${(pull / 24) * 100}%`; }

    const col = h('div', { class: classes, style },
      ...(Array.isArray(children) ? children : [children]),
    );

    // 响应式断点：通过 CSS 变量 + data 属性暴露，
    // 供用户 CSS 用 @media 媒体查询消费（如 @media (max-width:575px){ .col{ flex:0 0 calc(var(--col-xs-span,24)*100%/24) } }）
    for (const bp of BREAKPOINTS) {
      const parsed = parseResponsive(rest[bp]);
      if (!parsed) continue;
      if (parsed.span != null) col.style.setProperty(`--col-${bp}-span`, parsed.span);
      if (parsed.offset) col.style.setProperty(`--col-${bp}-offset`, parsed.offset);
      if (parsed.span != null) {
        col.dataset[bp] = parsed.offset ? `${parsed.span}:${parsed.offset}` : `${parsed.span}`;
      }
    }
    return col;
  }
}
