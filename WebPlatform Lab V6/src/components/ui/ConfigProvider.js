// ConfigProvider.js —— 全局配置组件
import { Component } from '../../core/Component.js';
import { h } from '../../core/utils.js';

// 主题预设常量（参考 antd 5.x defaultSeed）
export const theme = {
  // 默认种子 token：antd 5.x 的基础设计变量
  defaultSeed: {
    colorPrimary: '#1677ff',
    colorSuccess: '#52c41a',
    colorWarning: '#faad14',
    colorError: '#ff4d4f',
    colorInfo: '#1677ff',
    colorTextBase: '#000',
    colorBgBase: '#fff',
    fontSize: 14,
    borderRadius: 6,
    borderRadiusLG: 8,
    borderRadiusSM: 4,
    wireframe: false,
  },
  // 预设色板：供主题切换使用
  presetColors: [
    { name: 'daybreak', color: '#1677ff' },
    { name: 'dust', color: '#fa8c16' },
    { name: 'volcano', color: '#fa541c' },
    { name: 'sunset', color: '#faad14' },
    { name: 'cyan', color: '#13c2c2' },
    { name: 'green', color: '#52c41a' },
    { name: 'geekblue', color: '#2f54eb' },
    { name: 'purple', color: '#722ed1' },
  ],
};

// token 字段 -> CSS 变量名映射；未列出的字段按 camelCase 转 kebab-case
const TOKEN_TO_CSS_VAR = {
  colorPrimary: '--color-primary',
  colorSuccess: '--color-success',
  colorWarning: '--color-warning',
  colorError: '--color-error',
  colorInfo: '--color-info',
  fontSize: '--font-size-base',
  borderRadius: '--border-radius-base',
  borderRadiusLG: '--border-radius-lg',
  borderRadiusSM: '--border-radius-sm',
};

export class ConfigProvider extends Component {
  componentDidMount() {
    this._applyTheme();
  }

  // props 变更后重新写入 CSS 变量（覆盖 setProps 以补 componentDidUpdate 缺失）
  setProps(partial = {}) {
    super.setProps(partial);
    this._applyTheme();
    return this;
  }

  /** 把 theme.token 写入根元素 style 的 CSS 变量 */
  _applyTheme() {
    const { theme: themeProp, direction, prefixCls } = this.props;
    const token = themeProp?.token || {};
    const root = document.documentElement;
    for (const [key, value] of Object.entries(token)) {
      const varName = TOKEN_TO_CSS_VAR[key]
        || `--${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
      root.style.setProperty(varName, typeof value === 'number' ? `${value}px` : String(value));
    }
    // direction：写入根元素 dir 属性，影响整体排版方向
    if (direction) root.setAttribute('dir', direction);
    // prefixCls：作为 data 属性记录，便于 CSS 选择器前缀定制
    if (prefixCls) this.el?.setAttribute('data-prefix-cls', prefixCls);
  }

  render() {
    const { children, componentSize, locale } = this.props;
    return h('div', {
      class: ['config-provider', componentSize && `config-provider--${componentSize}`]
        .filter(Boolean).join(' '),
      'data-component-size': componentSize || undefined,
      'data-locale': typeof locale === 'string' ? locale : locale?.locale || undefined,
    }, children);
  }
}
