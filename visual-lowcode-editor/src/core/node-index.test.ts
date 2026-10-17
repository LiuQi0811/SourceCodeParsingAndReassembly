import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { NodeIndex } from './node-index';
import type { ComponentNode } from './schema';

function makeNode(id: string, type = 'container', children: ComponentNode[] = []): ComponentNode {
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

describe('NodeIndex', () => {
  describe('rebuild / getNode', () => {
    it('索引根节点', () => {
      const root = makeNode('root');
      const index = new NodeIndex();
      index.rebuild(root);
      assert.equal(index.getNode('root')?.id, 'root');
    });

    it('索引多层子节点', () => {
      const root = makeNode('root', 'container', [
        makeNode('a', 'heading'),
        makeNode('b', 'container', [
          makeNode('b-1', 'paragraph'),
          makeNode('b-2', 'button'),
        ]),
      ]);
      const index = new NodeIndex();
      index.rebuild(root);

      assert.equal(index.getNode('a')?.type, 'heading');
      assert.equal(index.getNode('b')?.type, 'container');
      assert.equal(index.getNode('b-1')?.type, 'paragraph');
      assert.equal(index.getNode('b-2')?.type, 'button');
    });

    it('不存在的节点返回 null', () => {
      const root = makeNode('root');
      const index = new NodeIndex();
      index.rebuild(root);
      assert.equal(index.getNode('nope'), null);
    });

    it('rebuild 会清空旧索引', () => {
      const root1 = makeNode('root', 'container', [makeNode('old', 'heading')]);
      const root2 = makeNode('root', 'container', [makeNode('new', 'paragraph')]);
      const index = new NodeIndex();
      index.rebuild(root1);
      assert.equal(index.getNode('old')?.type, 'heading');

      index.rebuild(root2);
      assert.equal(index.getNode('old'), null);
      assert.equal(index.getNode('new')?.type, 'paragraph');
    });
  });

  describe('getParentId / getParent', () => {
    it('根节点没有父节点', () => {
      const root = makeNode('root');
      const index = new NodeIndex();
      index.rebuild(root);
      assert.equal(index.getParentId('root'), null);
      assert.equal(index.getParent('root'), null);
    });

    it('一级子节点的父节点是 root', () => {
      const root = makeNode('root', 'container', [makeNode('a', 'heading')]);
      const index = new NodeIndex();
      index.rebuild(root);
      assert.equal(index.getParentId('a'), 'root');
      assert.equal(index.getParent('a')?.id, 'root');
    });

    it('深层子节点能找到正确的父节点', () => {
      const root = makeNode('root', 'container', [
        makeNode('a', 'container', [
          makeNode('a-1', 'paragraph'),
        ]),
      ]);
      const index = new NodeIndex();
      index.rebuild(root);
      assert.equal(index.getParentId('a-1'), 'a');
      assert.equal(index.getParent('a-1')?.id, 'a');
    });
  });

  describe('getLocation', () => {
    it('返回正确的父节点和索引', () => {
      const root = makeNode('root', 'container', [
        makeNode('a', 'heading'),
        makeNode('b', 'paragraph'),
        makeNode('c', 'button'),
      ]);
      const index = new NodeIndex();
      index.rebuild(root);

      const locA = index.getLocation('a');
      assert.ok(locA);
      assert.equal(locA.parent.id, 'root');
      assert.equal(locA.index, 0);

      const locB = index.getLocation('b');
      assert.ok(locB);
      assert.equal(locB.index, 1);

      const locC = index.getLocation('c');
      assert.ok(locC);
      assert.equal(locC.index, 2);
    });

    it('根节点没有 location', () => {
      const root = makeNode('root');
      const index = new NodeIndex();
      index.rebuild(root);
      assert.equal(index.getLocation('root'), null);
    });

    it('不存在的节点返回 null', () => {
      const root = makeNode('root');
      const index = new NodeIndex();
      index.rebuild(root);
      assert.equal(index.getLocation('nope'), null);
    });
  });

  describe('isAncestor', () => {
    it('父节点是子节点的祖先', () => {
      const root = makeNode('root', 'container', [makeNode('a', 'heading')]);
      const index = new NodeIndex();
      index.rebuild(root);
      assert.equal(index.isAncestor('root', 'a'), true);
    });

    it('多层祖先关系', () => {
      const root = makeNode('root', 'container', [
        makeNode('a', 'container', [
          makeNode('a-1', 'container', [
            makeNode('a-1-1', 'paragraph'),
          ]),
        ]),
      ]);
      const index = new NodeIndex();
      index.rebuild(root);
      assert.equal(index.isAncestor('root', 'a-1-1'), true);
      assert.equal(index.isAncestor('a', 'a-1-1'), true);
      assert.equal(index.isAncestor('a-1', 'a-1-1'), true);
    });

    it('兄弟节点不是祖先', () => {
      const root = makeNode('root', 'container', [
        makeNode('a', 'heading'),
        makeNode('b', 'paragraph'),
      ]);
      const index = new NodeIndex();
      index.rebuild(root);
      assert.equal(index.isAncestor('a', 'b'), false);
    });

    it('自己不是自己的祖先', () => {
      const root = makeNode('root', 'container', [makeNode('a', 'heading')]);
      const index = new NodeIndex();
      index.rebuild(root);
      assert.equal(index.isAncestor('a', 'a'), false);
    });

    it('子节点不是父节点的祖先（反向）', () => {
      const root = makeNode('root', 'container', [makeNode('a', 'heading')]);
      const index = new NodeIndex();
      index.rebuild(root);
      assert.equal(index.isAncestor('a', 'root'), false);
    });
  });

  describe('has / rootNode', () => {
    it('has 判断节点是否存在', () => {
      const root = makeNode('root', 'container', [makeNode('a', 'heading')]);
      const index = new NodeIndex();
      index.rebuild(root);
      assert.equal(index.has('root'), true);
      assert.equal(index.has('a'), true);
      assert.equal(index.has('nope'), false);
    });

    it('rootNode 返回根节点', () => {
      const root = makeNode('root');
      const index = new NodeIndex();
      index.rebuild(root);
      assert.equal(index.rootNode?.id, 'root');
    });
  });
});
