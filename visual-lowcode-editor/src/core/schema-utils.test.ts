import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { cloneNodeTree } from './schema-utils';
import type { ComponentNode } from './schema';

function makeNode(
  id: string,
  type: ComponentNode['type'] = 'heading',
  opts: Partial<Pick<ComponentNode, 'props' | 'style' | 'children' | 'events'>> = {},
): ComponentNode {
  return {
    id,
    type,
    props: opts.props ?? {},
    style: opts.style ?? {},
    children: opts.children ?? [],
    events: opts.events ?? {},
    locked: false,
    hidden: false,
  };
}

describe('cloneNodeTree', () => {
  describe('叶子节点', () => {
    it('生成不同的 id', () => {
      const original = makeNode('h1', 'heading', { props: { text: '你好' } });
      const cloned = cloneNodeTree(original);
      assert.notEqual(cloned.id, original.id);
    });

    it('保留 type', () => {
      const original = makeNode('b1', 'button');
      const cloned = cloneNodeTree(original);
      assert.equal(cloned.type, 'button');
    });

    it('保留 props', () => {
      const original = makeNode('h1', 'heading', { props: { text: '标题', foo: 'bar' } });
      const cloned = cloneNodeTree(original);
      assert.deepEqual(cloned.props, { text: '标题', foo: 'bar' });
    });

    it('保留 style', () => {
      const original = makeNode('h1', 'heading', {
        style: { color: '#ff0000', fontSize: '24px' },
      });
      const cloned = cloneNodeTree(original);
      assert.deepEqual(cloned.style, { color: '#ff0000', fontSize: '24px' });
    });

    it('props 是浅拷贝，修改克隆不影响原节点', () => {
      const original = makeNode('h1', 'heading', { props: { text: '原标题' } });
      const cloned = cloneNodeTree(original);
      cloned.props.text = '新标题';
      assert.equal(original.props.text, '原标题');
    });

    it('style 是浅拷贝，修改克隆不影响原节点', () => {
      const original = makeNode('h1', 'heading', { style: { color: 'red' } });
      const cloned = cloneNodeTree(original);
      cloned.style.color = 'blue';
      assert.equal(original.style.color, 'red');
    });
  });

  describe('容器节点与子树', () => {
    it('克隆容器并保留子节点数量', () => {
      const original = makeNode('c', 'container', {
        children: [
          makeNode('c1', 'heading'),
          makeNode('c2', 'paragraph'),
        ],
      });
      const cloned = cloneNodeTree(original);
      assert.equal(cloned.type, 'container');
      assert.equal(cloned.children.length, 2);
    });

    it('所有子节点都生成新 id', () => {
      const original = makeNode('c', 'container', {
        children: [
          makeNode('c1', 'heading'),
          makeNode('c2', 'paragraph'),
        ],
      });
      const cloned = cloneNodeTree(original);
      assert.notEqual(cloned.children[0].id, 'c1');
      assert.notEqual(cloned.children[1].id, 'c2');
      assert.notEqual(cloned.children[0].id, cloned.children[1].id);
    });

    it('子节点保留自己的 props 和 style', () => {
      const original = makeNode('c', 'container', {
        children: [
          makeNode('b', 'button', { props: { text: '点我' }, style: { color: 'white' } }),
        ],
      });
      const cloned = cloneNodeTree(original);
      assert.equal(cloned.children[0].props.text, '点我');
      assert.equal(cloned.children[0].style.color, 'white');
    });

    it('深层递归克隆', () => {
      const original = makeNode('root', 'container', {
        children: [
          makeNode('a', 'container', {
            children: [
              makeNode('a-1', 'container', {
                children: [makeNode('a-1-1', 'heading', { props: { text: '深层' } })],
              }),
            ],
          }),
        ],
      });
      const cloned = cloneNodeTree(original);
      assert.equal(cloned.children[0].children[0].children[0].props.text, '深层');
      assert.notEqual(cloned.children[0].children[0].children[0].id, 'a-1-1');
    });

    it('子节点数组是新数组，修改克隆 children 不影响原节点', () => {
      const original = makeNode('c', 'container', {
        children: [makeNode('c1', 'heading')],
      });
      const cloned = cloneNodeTree(original);
      cloned.children.push(makeNode('extra', 'paragraph'));
      assert.equal(original.children.length, 1);
      assert.equal(cloned.children.length, 2);
    });

    it('子节点对象是新对象，修改克隆子节点不影响原节点', () => {
      const original = makeNode('c', 'container', {
        children: [makeNode('c1', 'heading', { props: { text: '原始' } })],
      });
      const cloned = cloneNodeTree(original);
      cloned.children[0].props.text = '修改';
      assert.equal(original.children[0].props.text, '原始');
    });
  });

  describe('id 前缀与类型一致', () => {
    it('克隆后 id 前缀反映组件类型', () => {
      const heading = makeNode('h-old', 'heading');
      const button = makeNode('b-old', 'button');
      const container = makeNode('c-old', 'container');

      const clonedHeading = cloneNodeTree(heading);
      const clonedButton = cloneNodeTree(button);
      const clonedContainer = cloneNodeTree(container);

      assert.ok(clonedHeading.id.startsWith('heading_'), `期望 heading_ 前缀，实际是 ${clonedHeading.id}`);
      assert.ok(clonedButton.id.startsWith('button_'), `期望 button_ 前缀，实际是 ${clonedButton.id}`);
      assert.ok(clonedContainer.id.startsWith('container_'), `期望 container_ 前缀，实际是 ${clonedContainer.id}`);
    });
  });
});
