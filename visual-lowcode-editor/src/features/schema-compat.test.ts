import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateSchema } from '../core/schema-utils';
import { normalizeSchema } from './persistence';
import type { PageSchema, ComponentNode } from '../core/schema';

function makeMinimalNode(id: string, type = 'heading', children: ComponentNode[] = []): ComponentNode {
  return {
    id,
    type: type as ComponentNode['type'],
    props: {},
    style: {},
    children,
    events: {},
    locked: false,
    hidden: false,
  };
}

describe('validateSchema', () => {
  it('接受带 events 和 customCode 的新格式', () => {
    const schema = {
      version: 1 as const,
      root: makeMinimalNode('root', 'container', [makeMinimalNode('h1', 'heading')]),
      customCode: { headScript: '', bodyScript: '', headStyle: '' },
    };
    assert.equal(validateSchema(schema), true);
  });

  it('接受没有 customCode 字段的旧格式（validate 只校验必填结构）', () => {
    const schema = {
      version: 1 as const,
      root: makeMinimalNode('root', 'container'),
    };
    // validateSchema 是结构校验，只看必填字段；customCode 不在必填里所以通过
    assert.equal(validateSchema(schema), true);
  });

  it('接受没有 events 字段的节点（validate 不强制要求 events）', () => {
    const node: Record<string, unknown> = {
      id: 'root',
      type: 'container',
      props: {},
      style: {},
      children: [],
    };
    const schema = { version: 1 as const, root: node };
    assert.equal(validateSchema(schema), true);
  });

  it('拒绝 version 错误的 schema', () => {
    const schema = { version: 2, root: makeMinimalNode('root') };
    assert.equal(validateSchema(schema), false);
  });

  it('拒绝 root 不是对象的 schema', () => {
    const schema = { version: 1 as const, root: null };
    assert.equal(validateSchema(schema), false);
  });

  it('拒绝非法的组件类型', () => {
    const badNode = makeMinimalNode('x', 'weird-type' as ComponentNode['type']);
    const schema = { version: 1 as const, root: badNode };
    assert.equal(validateSchema(schema), false);
  });

  it('支持所有 13 种组件类型', () => {
    const types = [
      'container', 'heading', 'paragraph', 'button', 'image',
      'divider', 'input', 'link', 'form', 'textarea',
      'select', 'checkbox', 'switch',
    ];
    for (const type of types) {
      const node = makeMinimalNode('n', type as ComponentNode['type']);
      const schema = { version: 1 as const, root: node };
      assert.equal(validateSchema(schema), true, `类型 ${type} 应该合法`);
    }
  });
});

describe('normalizeSchema', () => {
  it('给没有 events 的节点补上空对象', () => {
    const root = {
      id: 'root',
      type: 'container' as const,
      props: {},
      style: {},
      children: [
        {
          id: 'btn1',
          type: 'button' as const,
          props: { text: 'hi' },
          style: {},
          children: [],
          // 故意没有 events
        },
      ],
      // 根节点也没有 events
    } as unknown as ComponentNode;

    const schema = { version: 1 as const, root } as PageSchema;
    const normalized = normalizeSchema(schema);

    assert.ok(normalized.root.events);
    assert.equal(typeof normalized.root.events, 'object');
    assert.equal(Object.keys(normalized.root.events).length, 0);
    assert.ok(normalized.root.children[0].events);
    assert.equal(Object.keys(normalized.root.children[0].events).length, 0);
  });

  it('给没有 customCode 的 schema 补上默认值', () => {
    const schema = {
      version: 1 as const,
      root: makeMinimalNode('root', 'container'),
    } as PageSchema;
    const normalized = normalizeSchema(schema);
    assert.ok(normalized.customCode);
    assert.equal(normalized.customCode.headScript, '');
    assert.equal(normalized.customCode.bodyScript, '');
    assert.equal(normalized.customCode.headStyle, '');
  });

  it('已有 events 的节点不被覆盖', () => {
    const node = makeMinimalNode('btn', 'button');
    node.events = { click: [{ id: 'a1', type: 'alert', message: 'hi' }] };
    const root = makeMinimalNode('root', 'container', [node]);
    const schema = { version: 1 as const, root, customCode: { headScript: '', bodyScript: '', headStyle: '' } };

    const normalized = normalizeSchema(schema);
    assert.equal(normalized.root.children[0].events.click?.length, 1);
    assert.equal(normalized.root.children[0].events.click?.[0].type, 'alert');
  });

  it('已有 customCode 的值不被覆盖', () => {
    const schema = {
      version: 1 as const,
      root: makeMinimalNode('root', 'container'),
      customCode: { headScript: 'console.log(1)', bodyScript: 'console.log(2)', headStyle: 'body{color:red}' },
    };
    const normalized = normalizeSchema(schema);
    assert.equal(normalized.customCode.headScript, 'console.log(1)');
    assert.equal(normalized.customCode.bodyScript, 'console.log(2)');
    assert.equal(normalized.customCode.headStyle, 'body{color:red}');
  });

  it('customCode 字段缺失字符串时补空串', () => {
    const schema = {
      version: 1 as const,
      root: makeMinimalNode('root', 'container'),
      customCode: { headScript: 123 as unknown as string, bodyScript: '', headStyle: null as unknown as string },
    };
    const normalized = normalizeSchema(schema);
    assert.equal(normalized.customCode.headScript, '');
    assert.equal(normalized.customCode.headStyle, '');
  });
});
