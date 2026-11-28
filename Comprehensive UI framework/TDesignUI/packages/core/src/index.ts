// @tdesignui/core —— 纯 TS，禁止 import vue / react / tdesign-*
// 这里是 Vue 与 React 两端的唯一真相：常量、路由表、领域模型、框架无关 store。

export const APP_SPEC = {
  product: 'TDesign UI',
  version: '1.0.0',
  tagline: 'Vue 3 与 React 19 共用同一份领域逻辑',
} as const;

export * from './counter';
export * from './routes';
export * from './apps';
