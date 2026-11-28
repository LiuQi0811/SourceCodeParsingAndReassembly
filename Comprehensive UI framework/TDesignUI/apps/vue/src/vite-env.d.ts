/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  // 这是 Vite 对 .vue 单文件组件的类型垫片：Props / Data 故意用宽松类型，
  // 真实的 props 类型由 vue-tsc 或运行时校验负责
  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>;
  export default component;
}
