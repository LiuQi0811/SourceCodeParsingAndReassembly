// =====================================================================
// types.ts —— 核心类型定义
// 所有公共接口的 TypeScript 类型集中声明，便于跨模块共享
// =====================================================================

// 前向声明 Component，避免循环依赖
// 真正的 Component 类在 ./Component.ts 中定义并 import here 会导致循环引用，
// 因此用 abstract class 占位，类型层面引用即可。
import type { Component } from './Component.js';

/** 组件 Props 通用接口：任意键值对，子类可细化 */
export type Props = Record<string, any>;

/** 组件 State 通用接口：任意键值对，子类可细化 */
export type State = Record<string, any>;

/** 子节点类型：DOM 节点、字符串、数字、布尔、组件实例、null/undefined */
export type Child =
  | Node
  | string
  | number
  | boolean
  | null
  | undefined
  | Component
  | Child[];

/** h() 第一个参数：字符串标签名或组件类 */
export type Tag = string | ComponentConstructor;

/** 组件构造函数类型 */
export type ComponentConstructor = new (props?: Props) => Component;

/** 事件处理器 */
export type EventHandler<T = Event> = (event: T) => void;

/** 事件绑定记录 */
export interface EventBinding {
  target: EventTarget;
  type: string;
  handler: EventListenerOrEventListenerObject;
  options?: AddEventListenerOptions | boolean;
}

/** 路由记录 */
export interface RouteRecord {
  path: string;
  /** 运行时由 Router._navigate 写入 */
  fullPath?: string;
  regex: RegExp;
  keys: string[];
  component?: ComponentConstructor;
  name?: string;
  meta?: RouteMeta;
  redirect?: string | ((args: { to: RouteLocation; from: RouteLocation | null }) => string);
  parent: RouteRecord | null;
  matched: RouteRecord[];
}

/** 路由元信息 */
export interface RouteMeta {
  title?: string;
  icon?: string;
  group?: string;
  badge?: string;
  [key: string]: any;
}

/** 路由配置（用户传入） */
export interface RouteConfig {
  path: string;
  component?: ComponentConstructor;
  name?: string;
  meta?: RouteMeta;
  redirect?: string | ((args: { to: RouteLocation; from: RouteLocation | null }) => string);
  children?: RouteConfig[];
}

/** 路由位置信息 */
export interface RouteLocation {
  path: string;
  fullPath: string;
  query: Record<string, string>;
  params: Record<string, string>;
  route: RouteRecord;
  matched: RouteRecord[];
}

/** 导航守卫 */
export type NavigationGuard = (
  to: RouteLocation,
  from: RouteLocation | null,
) => boolean | string | Promise<boolean | string>;

/** 路由模式 */
export type RouterMode = 'history' | 'hash';

/** Store 模块定义 */
export interface StoreModule<TState = Record<string, any>> {
  state: TState;
  mutations?: Record<string, (state: TState, payload?: any) => void>;
}

/** Store 变更事件 */
export interface StoreChangeEvent {
  module: string;
  type: string;
  payload?: any;
  prev: Record<string, any>;
  next: Record<string, any>;
}

/** Store 订阅函数 */
export type StoreSubscriber = (event: StoreChangeEvent) => void;

/** Store Mutation 函数签名 */
export type MutationFn<TState = Record<string, any>> = (state: TState, payload?: any) => void;
