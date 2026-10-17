import type { ComponentNode } from './schema';

/**
 * 读取图片文件为 data URL，纯异步函数，不依赖 DOM。
 * 供 Inspector 图片上传和其他需要 File→dataURL 转换的场景复用。
 *
 * @param file 图片文件（File 或 Blob）
 * @returns data: URL 字符串
 */
export function readImageAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === 'string') resolve(result);
      else reject(new Error('读取结果不是字符串'));
    };
    reader.onerror = () => {
      reject(reader.error ?? new Error('文件读取失败'));
    };
    reader.readAsDataURL(file);
  });
}

/**
 * 将 data URL 写入图片节点的 props.src，并返回是否发生了变更。
 * 纯函数式更新，不直接操作 DOM，便于测试。
 *
 * @param node 目标图片节点
 * @param dataUrl 图片的 data URL
 * @returns 是否实际修改了 src
 */
export function applyImageDataUrl(node: ComponentNode, dataUrl: string): boolean {
  if (node.type !== 'image') return false;
  if (node.props.src === dataUrl) return false;
  node.props.src = dataUrl;
  return true;
}
