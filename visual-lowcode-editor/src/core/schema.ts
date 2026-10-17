export type ComponentType =
  | 'container'
  | 'heading'
  | 'paragraph'
  | 'button'
  | 'image'
  | 'divider'
  | 'input'
  | 'link'
  | 'form'
  | 'textarea'
  | 'select'
  | 'checkbox'
  | 'switch';

export type RenderMode = 'editor' | 'export';

export type ComponentProps = Record<string, string>;

export interface ComponentStyle {
  width?: string;
  minHeight?: string;
  textAlign?: string;
  fontSize?: string;
  fontWeight?: string;
  color?: string;
  backgroundColor?: string;
  borderRadius?: string;
  padding?: string;
  margin?: string;
  height?: string;
  lineHeight?: string;
  display?: string;
  border?: string;
  [key: string]: string | undefined;
}

// ==================== 交互系统 ====================

export type ActionType =
  | 'show'
  | 'hide'
  | 'toggle'
  | 'setText'
  | 'setStyle'
  | 'scrollTo'
  | 'alert'
  | 'navigate'
  | 'custom'
  | 'submitForm'
  | 'resetForm';

export interface BaseAction {
  id: string;
  type: ActionType;
}

export interface TargetAction extends BaseAction {
  type: 'show' | 'hide' | 'toggle' | 'scrollTo';
  targetId: string;
}

export interface SetTextAction extends BaseAction {
  type: 'setText';
  targetId: string;
  text: string;
}

export interface SetStyleAction extends BaseAction {
  type: 'setStyle';
  targetId: string;
  styleKey: string;
  styleValue: string;
}

export interface AlertAction extends BaseAction {
  type: 'alert';
  message: string;
}

export interface NavigateAction extends BaseAction {
  type: 'navigate';
  url: string;
  openInNewTab: string; // 'true' | 'false'
}

export interface CustomAction extends BaseAction {
  type: 'custom';
  code: string;
}

export interface SubmitFormAction extends BaseAction {
  type: 'submitForm';
  formId: string;
  successMessage: string;
}

export interface ResetFormAction extends BaseAction {
  type: 'resetForm';
  formId: string;
}

export type ComponentAction =
  | TargetAction
  | SetTextAction
  | SetStyleAction
  | AlertAction
  | NavigateAction
  | CustomAction
  | SubmitFormAction
  | ResetFormAction;

/** 事件名 → 动作列表。事件名如 click、input、change、submit 等。 */
export type ComponentEvents = Record<string, ComponentAction[]>;

// ==================== 节点 / 页面 ====================

export interface ComponentNode {
  id: string;
  type: ComponentType;
  props: ComponentProps;
  style: ComponentStyle;
  children: ComponentNode[];
  events: ComponentEvents;
  /** 锁定后不可拖拽、不可删除、不可编辑 */
  locked: boolean;
  /** 隐藏后画布灰显，导出后 display:none */
  hidden: boolean;
}

export interface PageCustomCode {
  /** 注入到 <head> 末尾的脚本代码 */
  headScript: string;
  /** 注入到 </body> 前的脚本代码 */
  bodyScript: string;
  /** 注入到 <head> 的样式代码 */
  headStyle: string;
}

export interface PageSchema {
  version: 1;
  root: ComponentNode;
  customCode: PageCustomCode;
}

export type FieldKind = 'text' | 'textarea' | 'color' | 'select' | 'number';

export interface InspectorField {
  target: 'props' | 'style';
  key: string;
  label: string;
  kind: FieldKind;
  placeholder?: string;
  options?: Array<{ label: string; value: string }>;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
}

export type ComponentRenderer = (
  node: ComponentNode,
  mode: RenderMode,
  children?: DocumentFragment,
) => HTMLElement;

export interface ComponentEventSpec {
  name: string;
  label: string;
}

export interface ComponentDefinition {
  type: ComponentType;
  label: string;
  description: string;
  icon: string;
  canHaveChildren: boolean;
  editableText: boolean;
  defaultProps: ComponentProps;
  defaultStyle: ComponentStyle;
  defaultEvents: ComponentEvents;
  inspector: InspectorField[];
  events: ComponentEventSpec[];
  render: ComponentRenderer;
}
