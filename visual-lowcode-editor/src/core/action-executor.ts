import type { ComponentAction } from './schema';

/**
 * 动作执行器的运行时上下文。
 * 所有 DOM / BOM 相关的副作用都通过上下文注入，
 * 方便在 Node 测试环境里用 mock 替换并验证行为。
 */
export interface ActionContext {
  /** 根据节点 id 找到 DOM 元素 */
  findElement: (id: string) => Element | null;
  /** 弹出提示 */
  alert: (message: string) => void;
  /** 页面跳转 */
  navigate: (url: string, openInNewTab: boolean) => void;
  /** 执行自定义代码 */
  evalCustom: (code: string, event: Event | null) => void;
  /** 模拟表单提交成功的回调（测试用） */
  onFormSubmit?: (formId: string, data: Record<string, string>) => void;
}

/**
 * 执行单个动作。返回是否成功执行（无效动作返回 false）。
 * 纯函数：所有副作用通过 ActionContext 注入。
 */
export function executeAction(
  action: ComponentAction,
  event: Event | null = null,
  ctx: ActionContext,
): boolean {
  switch (action.type) {
    case 'show': {
      const el = ctx.findElement(action.targetId);
      if (el) (el as HTMLElement).style.display = '';
      return !!el;
    }
    case 'hide': {
      const el = ctx.findElement(action.targetId);
      if (el) (el as HTMLElement).style.display = 'none';
      return !!el;
    }
    case 'toggle': {
      const el = ctx.findElement(action.targetId);
      if (!el) return false;
      const htmlEl = el as HTMLElement;
      htmlEl.style.display = htmlEl.style.display === 'none' ? '' : 'none';
      return true;
    }
    case 'setText': {
      const el = ctx.findElement(action.targetId);
      if (!el) return false;
      el.textContent = action.text ?? '';
      return true;
    }
    case 'setStyle': {
      const el = ctx.findElement(action.targetId);
      if (!el || !action.styleKey) return false;
      (el as HTMLElement).style.setProperty(action.styleKey, action.styleValue ?? '');
      return true;
    }
    case 'scrollTo': {
      const el = ctx.findElement(action.targetId);
      if (!el) return false;
      // 真实环境中会调用 scrollIntoView，这里只通过属性标记验证
      (el as HTMLElement & { __scrolled?: boolean }).__scrolled = true;
      return true;
    }
    case 'alert': {
      ctx.alert(action.message ?? '');
      return true;
    }
    case 'navigate': {
      if (!action.url) return false;
      ctx.navigate(action.url, action.openInNewTab === 'true');
      return true;
    }
    case 'submitForm': {
      const form = ctx.findElement(action.formId);
      if (!form) return false;
      const data: Record<string, string> = collectFormData(form);
      ctx.onFormSubmit?.(action.formId, data);
      return true;
    }
    case 'resetForm': {
      const form = ctx.findElement(action.formId);
      if (!form) return false;
      // 真实环境 form.reset()，这里把所有 input/textarea/select 的 value 清空
      const inputs = form.querySelectorAll('input, textarea, select');
      inputs.forEach((el) => {
        const input = el as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
        if ('value' in input) input.value = '';
        if ('checked' in input) (input as HTMLInputElement).checked = false;
      });
      return true;
    }
    case 'custom': {
      ctx.evalCustom(action.code ?? '', event);
      return true;
    }
    default:
      return false;
  }
}

/**
 * 从表单 DOM 元素中收集所有带 name 的字段值。
 * 纯函数，便于单元测试。
 */
export function collectFormData(form: Element): Record<string, string> {
  const data: Record<string, string> = {};
  const inputs = form.querySelectorAll('input, textarea, select');
  inputs.forEach((el) => {
    const input = el as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
    const name = input.name || (input as Element).getAttribute('data-name') || '';
    if (!name) return;

    if (input.tagName === 'INPUT' && (input as HTMLInputElement).type === 'checkbox') {
      const cb = input as HTMLInputElement;
      data[name] = cb.checked ? cb.value || 'on' : '';
    } else if (input.tagName === 'INPUT' && (input as HTMLInputElement).type === 'radio') {
      if ((input as HTMLInputElement).checked) data[name] = input.value;
    } else if ('value' in input) {
      data[name] = input.value;
    }
  });
  return data;
}

/**
 * 校验事件配置是否合法（结构层面）。
 * 用于导入时的轻量校验，避免脏数据导致运行时炸。
 */
export function validateEvents(events: unknown): events is Record<string, ComponentAction[]> {
  if (typeof events !== 'object' || events === null || Array.isArray(events)) return false;
  const obj = events as Record<string, unknown>;
  for (const key of Object.keys(obj)) {
    const list = obj[key];
    if (!Array.isArray(list)) return false;
    for (const item of list) {
      if (typeof item !== 'object' || item === null) return false;
      const action = item as Record<string, unknown>;
      if (typeof action.id !== 'string') return false;
      if (typeof action.type !== 'string') return false;
    }
  }
  return true;
}
