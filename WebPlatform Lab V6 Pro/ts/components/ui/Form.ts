// Form.ts —— 表单容器与表单项（参考 antd Form / Form.Item）
import { Component } from '../../core/Component.js';
import { h } from '../../core/utils.js';
import type { Props, State } from '../../core/types.js';

/** 表单校验规则 */
export interface FormRule {
  required?: boolean;
  message?: string;
  pattern?: RegExp;
  min?: number;
  max?: number;
  validator?: (rule: FormRule, value: any) => void | Promise<void>;
}

/** 字段错误信息 */
export interface FieldError {
  name: string;
  errors: string[];
}

/** 列布局配置 */
export interface ColConfig {
  span: number;
}

export interface FormProps extends Props {
  layout?: 'horizontal' | 'vertical' | 'inline';
  labelAlign?: 'left' | 'right';
  labelCol?: ColConfig | null;
  wrapperCol?: ColConfig | null;
  initialValues?: Record<string, any>;
  onFinish?: (values: Record<string, any>) => void;
  onFinishFailed?: (result: { values: Record<string, any>; errorFields: FieldError[] }) => void;
  children?: any;
}

export interface FormState extends State {
  values: Record<string, any>;
  errorFields: FieldError[];
}

/**
 * 表单容器
 * props:
 *   - layout: 'horizontal' | 'vertical' | 'inline'（默认 horizontal）
 *   - labelAlign: 'left' | 'right'（默认 right）
 *   - labelCol: { span: 1..24 }
 *   - wrapperCol: { span: 1..24 }
 *   - initialValues: { name: value }
 *   - onFinish: (values) => void
 *   - onFinishFailed: ({ values, errorFields }) => void
 */
export class Form extends Component {
  declare props: FormProps;
  declare state: FormState;
  _items: Set<FormItem> | null = null;

  initialState(): FormState {
    return {
      values: { ...(this.props.initialValues || {}) },
      errorFields: [], // [{ name, errors: [string] }]
    };
  }

  componentDidMount(): void {
    // 注册到 DOM 上，供 FormItem 通过 closest('.form') 反向拿到表单实例
    if (this.el) (this.el as HTMLElement & { __form?: Form }).__form = this;
    // 暴露给 FormItem 的注册回调（收集子项实例以便统一校验/提交）
    this._items = new Set();
  }

  /** FormItem 注册自身 */
  _registerItem(item: FormItem): () => void {
    this._items = this._items || new Set();
    this._items.add(item);
    return () => { this._items?.delete(item); };
  }

  /** 设置某字段的值 */
  setFieldValue(name: string, value: any): void {
    this.setState({ values: { ...this.state.values, [name]: value } });
    // 同步触发相关字段校验
    const item = this._findItem(name);
    item?.validate?.(value);
  }

  /** 设置多个字段值 */
  setFieldsValue(values: Record<string, any> = {}): void {
    this.setState({ values: { ...this.state.values, ...values } });
  }

  /** 获取字段值 */
  getFieldValue(name: string): any {
    return this.state.values[name];
  }

  getFieldsValue(): Record<string, any> {
    return { ...this.state.values };
  }

  /** 重置为 initialValues */
  resetFields(): void {
    this.setState({ values: { ...(this.props.initialValues || {}) }, errorFields: [] });
    this._items?.forEach((item) => item.reset?.());
  }

  _findItem(name: string): FormItem | null {
    if (!this._items) return null;
    for (const it of this._items) if (it.props.name === name) return it;
    return null;
  }

  /** 校验全部字段并触发提交 */
  async submit(): Promise<void> {
    const errors: FieldError[] = [];
    const values = { ...this.state.values };
    if (this._items) {
      for (const item of this._items) {
        const itemName = item.props.name as string;
        const errs = await item.validate(values[itemName]);
        if (errs && errs.length) errors.push({ name: itemName, errors: errs });
      }
    }
    this.setState({ errorFields: errors });
    if (errors.length) {
      this.props.onFinishFailed?.({ values, errorFields: errors });
    } else {
      this.props.onFinish?.(values);
    }
  }

  render(): Node | string {
    const {
      layout = 'horizontal',
      labelAlign = 'right',
      labelCol = null,
      wrapperCol = null,
      children,
    } = this.props;

    // 把布局参数放到 dataset 上，CSS 可据此做栅格宽度
    const dataset: Record<string, string> = {
      layout,
      labelAlign,
    };
    if (labelCol) dataset.labelSpan = String(labelCol.span);
    if (wrapperCol) dataset.wrapperSpan = String(wrapperCol.span);

    const kids = Array.isArray(children) ? children : (children ? [children] : []);
    return h('form', {
      class: `form form--${layout}`,
      dataset,
      autocomplete: 'off',
      onSubmit: (e: Event) => {
        e.preventDefault();
        this.submit();
      },
    }, ...kids);
  }
}

export interface FormItemProps extends Props {
  label?: Node | string;
  name?: string;
  rules?: FormRule[];
  help?: string;
  validateStatus?: 'success' | 'warning' | 'error' | '';
  required?: boolean;
  colon?: boolean;
  labelAlign?: 'left' | 'right';
  labelCol?: ColConfig | null;
  wrapperCol?: ColConfig | null;
  validateTrigger?: 'onChange' | 'onBlur';
  children?: any;
}

export interface FormItemState extends State {
  errors: string[];
  status: string;
  validating: boolean;
}

/**
 * 表单项
 * props:
 *   - label: string
 *   - name: string
 *   - rules: Array<{ required, message, pattern, min, max, validator }>
 *   - help: string（自定义提示）
 *   - validateStatus: 'success' | 'warning' | 'error' | ''（显式指定）
 *   - required: boolean（仅控制星号样式）
 *   - colon: boolean（默认 true，标签后加冒号）
 *   - labelCol / wrapperCol: 优先级高于 Form
 */
export class FormItem extends Component {
  declare props: FormItemProps;
  declare state: FormItemState;
  _form: Form | null = null;
  _unregister: (() => void) | null = null;

  initialState(): FormItemState {
    return { errors: [], status: '', validating: false };
  }

  componentDidMount(): void {
    // 反向拿到所属表单实例并注册自己
    const formEl = (this.el as Element | null)?.closest('.form') as (HTMLElement & { __form?: Form }) | null;
    this._form = formEl?.__form || null;
    this._unregister = this._form?._registerItem?.(this) || null;
    // 给子控件绑定值变化监听（约定子组件暴露 onChange 事件）
    this._bindChildEvents();
  }

  componentWillUnmount(): void {
    this._unregister?.();
  }

  /** 拿到直接子控件元素（第一个非 label 的真实控件 DOM） */
  _getChildEl(): HTMLElement | null {
    const control = (this.el as Element | null)?.querySelector('.form-item__control');
    return control?.firstElementChild as HTMLElement | null || null;
  }

  /** 绑定子控件 input/change 事件，自动同步到 Form values 并触发校验 */
  _bindChildEvents(): void {
    const childEl = this._getChildEl();
    if (!childEl) return;
    const name = this.props.name;
    const sync = (val: any): void => {
      if (this._form && name) this._form.state.values[name] = val;
      if (this.props.validateTrigger !== 'onBlur') this.validate(val);
    };
    // 表单控件常见事件
    this.on(childEl, 'input', (e: Event) => {
      const v = (e.target as HTMLInputElement | null)?.value;
      sync(v);
    });
    this.on(childEl, 'change', (e: Event) => {
      // 自定义事件 detail 优先，其次 target.value
      const ce = e as CustomEvent;
      const v = ce.detail != null ? ce.detail : (e.target as HTMLInputElement | null)?.value;
      sync(v);
    });
    this.on(childEl, 'blur', () => {
      if (this.props.validateTrigger === 'onBlur') this.validate();
    });
  }

  /** 取当前值（从 Form state 优先） */
  _getValue(): any {
    if (this._form && this.props.name) return this._form.state.values[this.props.name];
    return null;
  }

  /** 校验：返回 errors 数组（空数组表示通过） */
  async validate(value?: any): Promise<string[]> {
    const v = value !== undefined ? value : this._getValue();
    const rules = this.props.rules || [];
    const errors: string[] = [];
    this.setState({ validating: true });
    for (const rule of rules) {
      if (rule.required && (v == null || v === '' || (Array.isArray(v) && v.length === 0))) {
        errors.push(rule.message || `${this.props.label || ''}不能为空`);
        continue;
      }
      if (v == null || v === '') continue;
      if (rule.pattern && !rule.pattern.test(String(v))) {
        errors.push(rule.message || `${this.props.label || ''}格式不正确`);
      }
      if (rule.min != null && typeof v === 'string' && v.length < rule.min) {
        errors.push(rule.message || `${this.props.label || ''}长度不能少于 ${rule.min}`);
      }
      if (rule.max != null && typeof v === 'string' && v.length > rule.max) {
        errors.push(rule.message || `${this.props.label || ''}长度不能超过 ${rule.max}`);
      }
      if (typeof rule.validator === 'function') {
        try {
          await rule.validator(rule, v);
        } catch (err) {
          const msg = (err as { message?: string })?.message || rule.message || '校验失败';
          errors.push(msg);
        }
      }
    }
    // 显式 validateStatus 优先于自动判定
    const explicit = this.props.validateStatus;
    const status = explicit ? explicit : (errors.length ? 'error' : (v ? 'success' : ''));
    this.setState({ errors, status, validating: false });
    return errors;
  }

  reset(): void {
    this.setState({ errors: [], status: '' });
  }

  render(): Node | string {
    const {
      label, name, required = false, colon = true,
      help, labelCol, wrapperCol, children,
    } = this.props;

    const showStar = required || (this.props.rules || []).some((r) => r.required);
    const status = this.props.validateStatus || this.state.status;
    const helpText = help != null ? help : this.state.errors[0];

    const labelClasses = [
      'form-item__label',
      `form-item__label--${this.props.labelAlign || 'right'}`,
      showStar && 'is-required',
    ].filter(Boolean).join(' ');

    const labelStyle: Record<string, string> = {};
    if (labelCol) labelStyle.flexBasis = `${(labelCol.span / 24) * 100}%`;
    const wrapperStyle: Record<string, string> = {};
    if (wrapperCol) wrapperStyle.flexBasis = `${(wrapperCol.span / 24) * 100}%`;

    const labelNode = label != null
      ? h('label', {
        class: labelClasses,
        for: name,
        style: labelStyle,
      }, `${label}${colon ? '：' : ''}`)
      : null;

    const controlNode = h('div', {
      class: `form-item__control ${status ? `has-${status}` : ''} ${this.state.validating ? 'is-validating' : ''}`,
      style: wrapperStyle,
    }, ...(Array.isArray(children) ? children : (children ? [children] : [])));

    const helpNode = helpText
      ? h('div', { class: `form-item__explain ${status ? `form-item__explain--${status}` : ''}` }, helpText)
      : null;

    return h('div', {
      class: `form-item ${status ? `form-item--${status}` : ''}`,
      'data-name': name || '',
    },
      labelNode,
      h('div', { class: 'form-item__content' },
        controlNode,
        helpNode,
      ),
    );
  }
}
