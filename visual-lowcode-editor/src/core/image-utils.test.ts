import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { applyImageDataUrl, readImageAsDataUrl } from './image-utils';
import type { ComponentNode } from './schema';

// Node 环境没有 FileReader，注入一个最小 polyfill 以验证函数调用链路的正确性。
class MockFileReader {
  result: string | ArrayBuffer | null = null;
  error: DOMException | null = null;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;

  readAsDataURL(blob: Blob): void {
    blob.arrayBuffer().then((buffer) => {
      const base64 = Buffer.from(buffer).toString('base64');
      const type = blob.type || 'application/octet-stream';
      this.result = `data:${type};base64,${base64}`;
      this.onload?.();
    }).catch(() => {
      this.error = new DOMException('读取失败') as DOMException;
      this.onerror?.();
    });
  }
}

describe('image-utils', () => {
  before(() => {
    (globalThis as unknown as { FileReader: typeof MockFileReader }).FileReader = MockFileReader;
  });
  after(() => {
    delete (globalThis as unknown as { FileReader?: unknown }).FileReader;
  });

  describe('applyImageDataUrl', () => {
    function makeImageNode(src = ''): ComponentNode {
      return {
        id: 'img-1',
        type: 'image',
        props: { src, alt: '测试图' },
        style: {},
        children: [],
        events: {},
        locked: false,
        hidden: false,
      };
    }

    it('图片节点写入新 src 并返回 true', () => {
      const node = makeImageNode('');
      const result = applyImageDataUrl(node, 'data:image/png;base64,abc');
      assert.equal(result, true);
      assert.equal(node.props.src, 'data:image/png;base64,abc');
    });

    it('src 相同时不重复写入并返回 false', () => {
      const src = 'data:image/png;base64,abc';
      const node = makeImageNode(src);
      const result = applyImageDataUrl(node, src);
      assert.equal(result, false);
      assert.equal(node.props.src, src);
    });

    it('非图片类型返回 false 且不修改', () => {
      const node: ComponentNode = {
        id: 'btn-1',
        type: 'button',
        props: { text: '按钮' },
        style: {},
        children: [],
        events: {},
        locked: false,
        hidden: false,
      };
      const result = applyImageDataUrl(node, 'data:image/png;base64,xyz');
      assert.equal(result, false);
      assert.equal(node.props.src, undefined);
    });

    it('空字符串 src 也能正确写入', () => {
      const node = makeImageNode('old');
      const result = applyImageDataUrl(node, '');
      assert.equal(result, true);
      assert.equal(node.props.src, '');
    });
  });

  describe('readImageAsDataUrl', () => {
    it('读取 Blob 为 data URL', async () => {
      // Node 环境中 Blob 是全局可用的（Node 18+）
      const blob = new Blob(['hello world'], { type: 'text/plain' });
      const dataUrl = await readImageAsDataUrl(blob);
      assert.ok(dataUrl.startsWith('data:text/plain;base64,'), `期望 data URL 前缀，实际：${dataUrl.slice(0, 40)}`);
      // 'hello world' base64 = aGVsbG8gd29ybGQ=
      assert.ok(dataUrl.includes('aGVsbG8gd29ybGQ='));
    });

    it('空 Blob 也能生成 data URL', async () => {
      const blob = new Blob([], { type: 'image/png' });
      const dataUrl = await readImageAsDataUrl(blob);
      assert.ok(dataUrl.startsWith('data:image/png;base64,'));
    });

    it('图片类型 Blob 返回对应 MIME 类型', async () => {
      const blob = new Blob(['fake-image-bytes'], { type: 'image/jpeg' });
      const dataUrl = await readImageAsDataUrl(blob);
      assert.ok(dataUrl.startsWith('data:image/jpeg;base64,'));
    });
  });
});
