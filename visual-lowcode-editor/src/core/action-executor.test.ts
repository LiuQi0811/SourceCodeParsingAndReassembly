import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { executeAction, collectFormData, validateEvents } from './action-executor';
import type { ComponentAction } from './schema';

// ============================================================
// Mock 工具
// ============================================================

interface MockElement {
  id: string;
  tagName: string;
  style: Record<string, string>;
  textContent: string | null;
  value?: string;
  checked?: boolean;
  type?: string;
  name?: string;
  children: MockElement[];
  __scrolled?: boolean;
  setProperty(key: string, value: string): void;
  getAttribute(key: string): string | null;
  querySelectorAll(selector: string): MockElement[];
}

function createMockStyle(initial: Record<string, string> = {}): Record<string, string> & { setProperty: (k: string, v: string) => void; getPropertyValue: (k: string) => string } {
  const style = { ...initial } as Record<string, string> & { setProperty: (k: string, v: string) => void; getPropertyValue: (k: string) => string };
  style.setProperty = (k: string, v: string): void => {
    style[k] = v;
  };
  style.getPropertyValue = (k: string): string => style[k] ?? '';
  return style;
}

function createMockElement(id: string, tagName = 'div', extra: Partial<MockElement> = {}): MockElement {
  const { style: _styleOverride, ...restExtra } = extra;
  const el: MockElement = {
    id,
    tagName: tagName.toUpperCase(),
    style: createMockStyle(extra.style || {}),
    textContent: '',
    children: [],
    ...restExtra,
    setProperty(key: string, value: string) {
      el.style[key] = value;
    },
    getAttribute(key: string): string | null {
      const record = el as unknown as Record<string, unknown>;
      if (key in record && key !== 'style' && key !== 'children') {
        const val = record[key];
        return val == null ? null : String(val);
      }
      return null;
    },
    querySelectorAll(_selector: string): MockElement[] {
      const results: MockElement[] = [];
      const walk = (node: MockElement): void => {
        node.children.forEach((child) => {
          // 简单模拟：所有子 input/textarea/select 都收集
          if (['INPUT', 'TEXTAREA', 'SELECT'].includes(child.tagName)) {
            results.push(child);
          }
          walk(child);
        });
      };
      walk(el);
      return results;
    },
  };
  return el;
}

function createMockContext(elements: MockElement[] = []) {
  const elementMap = new Map(elements.map((el) => [el.id, el]));
  const alerts: string[] = [];
  const navigations: Array<{ url: string; openInNewTab: boolean }> = [];
  const customCalls: Array<{ code: string; event: Event | null }> = [];
  const formSubmits: Array<{ formId: string; data: Record<string, string> }> = [];

  return {
    alerts,
    navigations,
    customCalls,
    formSubmits,
    addElement(el: MockElement): void {
      elementMap.set(el.id, el);
    },
    ctx: {
      findElement: (id: string): Element | null =>
        (elementMap.get(id) ?? null) as unknown as Element | null,
      alert: (msg: string) => alerts.push(msg),
      navigate: (url: string, openInNewTab: boolean) => navigations.push({ url, openInNewTab }),
      evalCustom: (code: string, event: Event | null) => customCalls.push({ code, event }),
      onFormSubmit: (formId: string, data: Record<string, string>) =>
        formSubmits.push({ formId, data }),
    },
  };
}

// ============================================================
// 测试
// ============================================================

describe('executeAction', () => {
  describe('show / hide / toggle', () => {
    it('show 把 display 设为空', () => {
      const el = createMockElement('btn1', 'button', { style: { display: 'none' } });
      const { ctx } = createMockContext([el]);
      const result = executeAction({ id: 'a1', type: 'show', targetId: 'btn1' }, null, ctx);
      assert.equal(result, true);
      assert.equal(el.style.display, '');
    });

    it('hide 把 display 设为 none', () => {
      const el = createMockElement('btn1', 'button', { style: { display: '' } });
      const { ctx } = createMockContext([el]);
      const result = executeAction({ id: 'a1', type: 'hide', targetId: 'btn1' }, null, ctx);
      assert.equal(result, true);
      assert.equal(el.style.display, 'none');
    });

    it('toggle 在显示和隐藏之间切换', () => {
      const el = createMockElement('btn1', 'button', { style: { display: '' } });
      const { ctx } = createMockContext([el]);
      executeAction({ id: 'a1', type: 'toggle', targetId: 'btn1' }, null, ctx);
      assert.equal(el.style.display, 'none');
      executeAction({ id: 'a1', type: 'toggle', targetId: 'btn1' }, null, ctx);
      assert.equal(el.style.display, '');
    });

    it('目标不存在时返回 false', () => {
      const { ctx } = createMockContext([]);
      const result = executeAction({ id: 'a1', type: 'show', targetId: 'nope' }, null, ctx);
      assert.equal(result, false);
    });
  });

  describe('setText', () => {
    it('设置元素文本', () => {
      const el = createMockElement('h1', 'h1', { textContent: '旧标题' });
      const { ctx } = createMockContext([el]);
      const result = executeAction(
        { id: 'a1', type: 'setText', targetId: 'h1', text: '新标题' },
        null,
        ctx,
      );
      assert.equal(result, true);
      assert.equal(el.textContent, '新标题');
    });

    it('text 为空时清空', () => {
      const el = createMockElement('h1', 'h1', { textContent: '有内容' });
      const { ctx } = createMockContext([el]);
      executeAction({ id: 'a1', type: 'setText', targetId: 'h1', text: '' }, null, ctx);
      assert.equal(el.textContent, '');
    });
  });

  describe('setStyle', () => {
    it('设置 CSS 属性', () => {
      const el = createMockElement('box', 'div', { style: { color: 'black' } });
      const { ctx } = createMockContext([el]);
      const result = executeAction(
        { id: 'a1', type: 'setStyle', targetId: 'box', styleKey: 'color', styleValue: 'red' },
        null,
        ctx,
      );
      assert.equal(result, true);
      assert.equal(el.style.color, 'red');
    });

    it('styleKey 为空时返回 false', () => {
      const el = createMockElement('box', 'div');
      const { ctx } = createMockContext([el]);
      const result = executeAction(
        { id: 'a1', type: 'setStyle', targetId: 'box', styleKey: '', styleValue: 'red' },
        null,
        ctx,
      );
      assert.equal(result, false);
    });
  });

  describe('scrollTo', () => {
    it('标记元素已滚动', () => {
      const el = createMockElement('target', 'div');
      const { ctx } = createMockContext([el]);
      const result = executeAction({ id: 'a1', type: 'scrollTo', targetId: 'target' }, null, ctx);
      assert.equal(result, true);
      assert.equal(el.__scrolled, true);
    });

    it('目标不存在返回 false', () => {
      const { ctx } = createMockContext([]);
      const result = executeAction({ id: 'a1', type: 'scrollTo', targetId: 'nope' }, null, ctx);
      assert.equal(result, false);
    });
  });

  describe('alert', () => {
    it('调用 alert 并传入消息', () => {
      const { ctx, alerts } = createMockContext([]);
      const result = executeAction({ id: 'a1', type: 'alert', message: '你好' }, null, ctx);
      assert.equal(result, true);
      assert.deepEqual(alerts, ['你好']);
    });

    it('空消息也能调用', () => {
      const { ctx, alerts } = createMockContext([]);
      executeAction({ id: 'a1', type: 'alert', message: '' }, null, ctx);
      assert.deepEqual(alerts, ['']);
    });
  });

  describe('navigate', () => {
    it('当前页跳转', () => {
      const { ctx, navigations } = createMockContext([]);
      const result = executeAction(
        { id: 'a1', type: 'navigate', url: 'https://example.com', openInNewTab: 'false' },
        null,
        ctx,
      );
      assert.equal(result, true);
      assert.deepEqual(navigations, [{ url: 'https://example.com', openInNewTab: false }]);
    });

    it('新标签打开', () => {
      const { ctx, navigations } = createMockContext([]);
      executeAction(
        { id: 'a1', type: 'navigate', url: 'https://example.com', openInNewTab: 'true' },
        null,
        ctx,
      );
      assert.equal(navigations[0].openInNewTab, true);
    });

    it('url 为空返回 false', () => {
      const { ctx, navigations } = createMockContext([]);
      const result = executeAction(
        { id: 'a1', type: 'navigate', url: '', openInNewTab: 'false' },
        null,
        ctx,
      );
      assert.equal(result, false);
      assert.deepEqual(navigations, []);
    });
  });

  describe('custom', () => {
    it('执行自定义代码并传入 event', () => {
      const { ctx, customCalls } = createMockContext([]);
      const fakeEvent = { type: 'click' } as unknown as Event;
      const result = executeAction(
        { id: 'a1', type: 'custom', code: "console.log('hi')" },
        fakeEvent,
        ctx,
      );
      assert.equal(result, true);
      assert.equal(customCalls.length, 1);
      assert.equal(customCalls[0].code, "console.log('hi')");
      assert.equal(customCalls[0].event?.type, 'click');
    });

    it('空代码也返回 true（只是什么都不做）', () => {
      const { ctx, customCalls } = createMockContext([]);
      const result = executeAction({ id: 'a1', type: 'custom', code: '' }, null, ctx);
      assert.equal(result, true);
      assert.equal(customCalls.length, 1);
    });
  });

  describe('submitForm', () => {
    it('收集表单字段并触发提交', () => {
      const form = createMockElement('form1', 'form', {
        children: [
          createMockElement('i1', 'input', { name: 'username', value: 'alice', type: 'text' }),
          createMockElement('i2', 'input', { name: 'email', value: 'a@b.com', type: 'text' }),
          createMockElement('i3', 'input', { name: 'agree', value: 'yes', type: 'checkbox', checked: true }),
        ],
      });
      const { ctx, formSubmits } = createMockContext([form]);

      const result = executeAction(
        { id: 'a1', type: 'submitForm', formId: 'form1', successMessage: '提交成功' },
        null,
        ctx,
      );
      assert.equal(result, true);
      assert.equal(formSubmits.length, 1);
      assert.equal(formSubmits[0].formId, 'form1');
      assert.equal(formSubmits[0].data.username, 'alice');
      assert.equal(formSubmits[0].data.email, 'a@b.com');
      assert.equal(formSubmits[0].data.agree, 'yes');
    });

    it('表单不存在返回 false', () => {
      const { ctx, formSubmits } = createMockContext([]);
      const result = executeAction(
        { id: 'a1', type: 'submitForm', formId: 'nope', successMessage: '' },
        null,
        ctx,
      );
      assert.equal(result, false);
      assert.deepEqual(formSubmits, []);
    });
  });

  describe('resetForm', () => {
    it('清空表单所有字段', () => {
      const input = createMockElement('i1', 'input', { name: 'name', value: 'bob', type: 'text' });
      const cb = createMockElement('i2', 'input', { name: 'ok', value: 'on', type: 'checkbox', checked: true });
      const form = createMockElement('form1', 'form', { children: [input, cb] });
      const { ctx } = createMockContext([form]);

      const result = executeAction({ id: 'a1', type: 'resetForm', formId: 'form1' }, null, ctx);
      assert.equal(result, true);
      assert.equal(input.value, '');
      assert.equal(cb.checked, false);
    });
  });
});

describe('collectFormData', () => {
  it('收集 text/password 等普通输入', () => {
    const form = createMockElement('f', 'form', {
      children: [
        createMockElement('i1', 'input', { name: 'user', value: 'tom', type: 'text' }),
        createMockElement('i2', 'input', { name: 'pwd', value: 'secret', type: 'password' }),
      ],
    });
    const data = collectFormData(form as unknown as Element);
    assert.equal(data.user, 'tom');
    assert.equal(data.pwd, 'secret');
  });

  it('checkbox 选中时返回 value，未选中返回空字符串', () => {
    const form = createMockElement('f', 'form', {
      children: [
        createMockElement('c1', 'input', { name: 'a', value: 'yes', type: 'checkbox', checked: true }),
        createMockElement('c2', 'input', { name: 'b', value: 'no', type: 'checkbox', checked: false }),
      ],
    });
    const data = collectFormData(form as unknown as Element);
    assert.equal(data.a, 'yes');
    assert.equal(data.b, '');
  });

  it('radio 只收集选中的那个', () => {
    const form = createMockElement('f', 'form', {
      children: [
        createMockElement('r1', 'input', { name: 'gender', value: 'male', type: 'radio', checked: false }),
        createMockElement('r2', 'input', { name: 'gender', value: 'female', type: 'radio', checked: true }),
      ],
    });
    const data = collectFormData(form as unknown as Element);
    assert.equal(data.gender, 'female');
  });

  it('没有 name 的字段跳过', () => {
    const form = createMockElement('f', 'form', {
      children: [createMockElement('i1', 'input', { value: 'no-name', type: 'text' })],
    });
    const data = collectFormData(form as unknown as Element);
    assert.equal(Object.keys(data).length, 0);
  });

  it('select 也能收集', () => {
    const form = createMockElement('f', 'form', {
      children: [createMockElement('s1', 'select', { name: 'city', value: 'beijing' })],
    });
    const data = collectFormData(form as unknown as Element);
    assert.equal(data.city, 'beijing');
  });
});

describe('validateEvents', () => {
  it('空对象合法', () => {
    assert.equal(validateEvents({}), true);
  });

  it('正确的事件-动作结构合法', () => {
    const events = {
      click: [{ id: 'a1', type: 'show', targetId: 'x' } as ComponentAction],
    };
    assert.equal(validateEvents(events), true);
  });

  it('null 不合法', () => {
    assert.equal(validateEvents(null), false);
  });

  it('数组不合法', () => {
    assert.equal(validateEvents([]), false);
  });

  it('动作缺少 id 不合法', () => {
    assert.equal(validateEvents({ click: [{ type: 'show' }] }), false);
  });

  it('动作缺少 type 不合法', () => {
    assert.equal(validateEvents({ click: [{ id: 'a1' }] }), false);
  });

  it('动作列表不是数组不合法', () => {
    assert.equal(validateEvents({ click: 'not-array' }), false);
  });

  it('支持多个事件、每个事件多个动作', () => {
    const events = {
      click: [
        { id: 'a1', type: 'show', targetId: 'x' },
        { id: 'a2', type: 'alert', message: 'hi' },
      ],
      input: [{ id: 'a3', type: 'custom', code: '' }],
    };
    assert.equal(validateEvents(events), true);
  });
});
