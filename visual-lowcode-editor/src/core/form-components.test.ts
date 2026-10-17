import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createNode, getDefinition, getDefinitions } from './registry';
import type { ComponentType } from './schema';

const FORM_TYPES: ComponentType[] = ['form', 'textarea', 'select', 'checkbox', 'switch'];

describe('表单物料注册', () => {
  describe('定义完整性', () => {
    for (const type of FORM_TYPES) {
      it(`${type} 有完整定义`, () => {
        const def = getDefinition(type);
        assert.ok(def, `${type} 定义不存在`);
        assert.equal(def.type, type);
        assert.ok(def.label, `${type} 缺少 label`);
        assert.ok(def.description, `${type} 缺少 description`);
        assert.ok(def.icon, `${type} 缺少 icon`);
        assert.equal(typeof def.canHaveChildren, 'boolean');
        assert.equal(typeof def.editableText, 'boolean');
        assert.ok(def.defaultProps, `${type} 缺少 defaultProps`);
        assert.ok(def.defaultStyle, `${type} 缺少 defaultStyle`);
        assert.ok(Array.isArray(def.inspector), `${type} inspector 不是数组`);
        assert.ok(Array.isArray(def.events), `${type} events 不是数组`);
        assert.equal(typeof def.render, 'function');
      });
    }
  });

  describe('createNode 生成正确结构', () => {
    for (const type of FORM_TYPES) {
      it(`${type} createNode 产出完整节点`, () => {
        const node = createNode(type);
        assert.equal(node.type, type);
        assert.ok(node.id, `${type} 缺少 id`);
        assert.ok(node.id.startsWith(`${type}_`), `${type} id 前缀不对：${node.id}`);
        assert.ok(node.props && typeof node.props === 'object');
        assert.ok(node.style && typeof node.style === 'object');
        assert.ok(Array.isArray(node.children));
        assert.ok(node.events && typeof node.events === 'object');
      });
    }
  });

  describe('form 容器特性', () => {
    it('form 可以有子节点', () => {
      const def = getDefinition('form');
      assert.equal(def.canHaveChildren, true);
    });

    it('form 支持 submit 和 reset 事件', () => {
      const def = getDefinition('form');
      const eventNames = def.events.map((e) => e.name);
      assert.ok(eventNames.includes('submit'), 'form 缺少 submit 事件');
      assert.ok(eventNames.includes('reset'), 'form 缺少 reset 事件');
    });

    it('form 默认有 name prop', () => {
      const node = createNode('form');
      assert.equal(typeof node.props.name, 'string');
      assert.ok(node.props.name.length > 0);
    });
  });

  describe('textarea', () => {
    it('支持 input/change/focus/blur 四个事件', () => {
      const def = getDefinition('textarea');
      const names = def.events.map((e) => e.name);
      assert.deepEqual(names.sort(), ['blur', 'change', 'focus', 'input']);
    });

    it('默认有 placeholder、name、rows', () => {
      const node = createNode('textarea');
      assert.ok('placeholder' in node.props);
      assert.ok('name' in node.props);
      assert.ok('rows' in node.props);
    });
  });

  describe('select', () => {
    it('支持 change/focus/blur 三个事件', () => {
      const def = getDefinition('select');
      const names = def.events.map((e) => e.name);
      assert.deepEqual(names.sort(), ['blur', 'change', 'focus']);
    });

    it('默认有 options（换行分隔）和 name', () => {
      const node = createNode('select');
      assert.ok(node.props.options);
      assert.ok(node.props.name);
      const optionLines = node.props.options.split('\n');
      assert.ok(optionLines.length >= 2, '默认 options 至少 2 行');
    });
  });

  describe('checkbox', () => {
    it('只有 change 事件', () => {
      const def = getDefinition('checkbox');
      assert.equal(def.events.length, 1);
      assert.equal(def.events[0].name, 'change');
    });

    it('默认有 name、label、checked、value 四个 prop', () => {
      const node = createNode('checkbox');
      assert.ok('name' in node.props);
      assert.ok('label' in node.props);
      assert.ok('checked' in node.props);
      assert.ok('value' in node.props);
    });
  });

  describe('switch', () => {
    it('只有 change 事件', () => {
      const def = getDefinition('switch');
      assert.equal(def.events.length, 1);
      assert.equal(def.events[0].name, 'change');
    });

    it('默认有 name、checked、label', () => {
      const node = createNode('switch');
      assert.ok('name' in node.props);
      assert.ok('checked' in node.props);
      assert.ok('label' in node.props);
    });
  });

  describe('所有物料总数', () => {
    it('共 13 种组件', () => {
      const defs = getDefinitions();
      assert.equal(defs.length, 13);
    });

    it('所有定义的 type 都在 ComponentType 联合类型里', () => {
      const defs = getDefinitions();
      const expectedTypes = [
        'container', 'heading', 'paragraph', 'button', 'image',
        'divider', 'input', 'link', 'form', 'textarea',
        'select', 'checkbox', 'switch',
      ];
      const actualTypes = defs.map((d) => d.type).sort();
      assert.deepEqual(actualTypes, [...expectedTypes].sort());
    });
  });
});
