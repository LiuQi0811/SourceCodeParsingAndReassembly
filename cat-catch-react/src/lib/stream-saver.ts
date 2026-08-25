/**
 * 大文件流式落盘
 * 1:1 还原原 js/StreamSaver.js 在 m3u8 下载场景的能力
 *
 * 实现:Chrome 86+ File System Access API(showSaveFilePicker + createWritable)
 * 不再依赖 Service Worker(原 StreamSaver.js 的实现路径),
 * 扩展页面环境天然支持,代码量更小、更稳定
 *
 * 失败回退:回退到内存 Blob 一次性下载(mergeBuffers + <a download>)
 */
export interface FileStream {
  /** 写入一段数据(按顺序调用) */
  write: (chunk: Uint8Array) => void;
  /** 完成写入,关闭文件句柄 */
  close: () => Promise<void>;
  /** 是否真的在流式落盘(否则只是内存累积) */
  streaming: boolean;
}

/** 检测当前环境是否支持 showSaveFilePicker */
export function supportsFileSystemAccess(): boolean {
  return typeof (window as unknown as { showSaveFilePicker?: unknown }).showSaveFilePicker === 'function';
}

/**
 * 创建一个可流式写入的文件输出流
 * - 推荐路径:showSaveFilePicker -> FileSystemFileStream
 * - 回退路径:Blob 收集 + close 时 <a download>
 *
 * @param suggestedName 建议文件名(含扩展名)
 * @param mime Blob 回退时的 MIME 类型
 */
export async function createFileStream(
  suggestedName: string,
  mime: string = 'video/mp2t',
): Promise<FileStream> {
  // 优先使用 File System Access API(Chrome 86+ 扩展页面)
  if (supportsFileSystemAccess()) {
    try {
      const handle = await (window as unknown as {
        showSaveFilePicker: (opts: {
          suggestedName?: string;
          types?: Array<{ description?: string; accept: Record<string, string[]> }>;
        }) => Promise<FileSystemFileHandle>;
      }).showSaveFilePicker({
        suggestedName,
        types: [
          {
            description: 'Media file',
            accept: { [mime]: ['.ts', '.mp4', '.m4s', '.mkv', '.mp3', '.aac'] },
          },
        ],
      });
      const writable = await handle.createWritable();
      return {
        streaming: true,
        write: (chunk: Uint8Array) => {
          void writable.write(chunk as unknown as BufferSource);
        },
        close: async () => {
          await writable.close();
        },
      };
    } catch (e) {
      // 用户取消或权限不足 -> 回退到 Blob
      if (e instanceof DOMException && e.name === 'AbortError') {
        throw e;
      }
      console.warn('showSaveFilePicker failed, fallback to Blob', e);
    }
  }

  // 回退:内存 Blob 收集
  const chunks: Uint8Array[] = [];
  return {
    streaming: false,
    write: (chunk: Uint8Array) => {
      chunks.push(chunk);
    },
    close: async () => {
      const blob = new Blob(chunks as unknown as BlobPart[], { type: mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = suggestedName;
      a.click();
      URL.revokeObjectURL(url);
    },
  };
}
