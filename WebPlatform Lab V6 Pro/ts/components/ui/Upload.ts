// Upload.ts —— 文件上传组件（支持拖拽、自动上传、列表展示）
import { Component } from '../../core/Component.js';
import { h } from '../../core/utils.js';
import type { Props, State } from '../../core/types.js';

export interface UploadFileEntry {
  uid: string;
  name: string;
  size: number;
  status: 'uploading' | 'done' | 'error';
  percent: number;
  raw: File;
  url: string | null;
}

export interface UploadProps extends Props {
  accept?: string;
  multiple?: boolean;
  maxCount?: number;
  action?: string | null;
  listType?: string;
  children?: Node | string;
  beforeUpload?: (file: File, fileList: UploadFileEntry[]) => boolean | void;
  onChange?: (fileList: UploadFileEntry[]) => void;
  onSuccess?: (entry: UploadFileEntry, data: any) => void;
}

export interface UploadState extends State {
  fileList: UploadFileEntry[];
  dragging: boolean;
}

export class Upload extends Component {
  declare props: UploadProps;
  declare state: UploadState;
  _input: HTMLInputElement | null = null;

  initialState(): UploadState {
    return { fileList: [], dragging: false };
  }

  render(): Node | string {
    const {
      accept = '', multiple = false, maxCount = 0,
      action = null, listType = 'text',
      children = null,
    } = this.props;
    const { fileList, dragging } = this.state;

    // 隐藏的 file input（每次重渲染都会重建引用）
    const input = h('input', {
      class: 'upload__input',
      type: 'file',
      accept, multiple,
      style: { display: 'none' },
      onChange: (e: Event) => {
        const target = e.target as HTMLInputElement;
        this._handleFiles(target.files);
        // 清空值，允许重复选择同一文件
        target.value = '';
      },
    }) as HTMLInputElement;
    this._input = input;

    // 触发器：自定义元素或默认按钮，点击后调用 input.click()
    const trigger = children != null
      ? (typeof children === 'string'
          ? h('button', { class: 'btn', type: 'button' }, children)
          : children)
      : h('button', { class: 'btn', type: 'button' }, '上传文件');
    const triggerWrapper = h('div', {
      class: 'upload__trigger',
      onClick: () => { if (this._input) this._input.click(); },
    }, trigger);

    // 文件列表
    const list = fileList.length > 0
      ? h('div', { class: `upload__list upload__list--${listType}` },
          ...fileList.map((file, index) => this._renderFile(file, index)),
        )
      : null;

    return h('div', {
      class: ['upload', dragging && 'upload--dragging'],
      onDragover: (e: DragEvent) => {
        e.preventDefault();
        if (!this.state.dragging) this.setState({ dragging: true });
      },
      onDragleave: (e: DragEvent) => {
        // 仅当真正离开容器时才取消高亮，避免子元素切换导致闪烁
        if ((e.currentTarget as Node).contains(e.relatedTarget as Node | null)) return;
        if (this.state.dragging) this.setState({ dragging: false });
      },
      onDrop: (e: DragEvent) => {
        e.preventDefault();
        if (this.state.dragging) this.setState({ dragging: false });
        this._handleFiles(e.dataTransfer?.files || null);
      },
    }, input, triggerWrapper, list);
  }

  /** 渲染单个文件条目 */
  _renderFile(file: UploadFileEntry, index: number): Node {
    const { listType = 'text' } = this.props;
    const isPicture = listType === 'picture';

    const thumb: Node | null = isPicture
      ? (file.url
          ? h('img', { class: 'upload__file-thumb', src: file.url, alt: file.name })
          : h('div', { class: 'upload__file-thumb upload__file-thumb--placeholder' }, '📄'))
      : null;

    return h('div', { class: ['upload__file', `upload__file--${file.status}`] },
      thumb,
      h('div', { class: 'upload__file-info' },
        h('div', { class: 'upload__file-name' }, file.name),
        h('div', { class: 'upload__file-meta' },
          file.size != null && h('span', { class: 'upload__file-size' }, this._formatSize(file.size)),
          h('span', { class: `upload__file-status upload__file-status--${file.status}` }, this._statusText(file.status)),
        ),
        file.status === 'uploading' && h('div', { class: 'upload__file-progress' },
          h('div', {
            class: 'upload__file-progress-bar',
            style: { width: `${file.percent || 0}%` },
          }),
        ),
      ),
      h('span', {
        class: 'upload__file-remove',
        onClick: (e: MouseEvent) => {
          e.stopPropagation();
          this._removeFile(index);
        },
      }, '×'),
    );
  }

  _statusText(status: string): string {
    const map: Record<string, string> = { uploading: '上传中', done: '已完成', error: '失败' };
    return map[status] || '';
  }

  _formatSize(bytes: number): string {
    if (bytes == null) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  /** 处理选中的文件列表：校验数量、beforeUpload 钩子、自动上传 */
  _handleFiles(fileList: FileList | null): void {
    const files = Array.from(fileList || []);
    if (files.length === 0) return;

    const { maxCount = 0, beforeUpload = null, action = null } = this.props;
    const nextList = [...this.state.fileList];

    for (const file of files) {
      // 超出最大数量限制
      if (maxCount > 0 && nextList.length >= maxCount) break;

      // beforeUpload 钩子：返回 false 取消该文件
      if (beforeUpload) {
        const result = beforeUpload(file, nextList);
        if (result === false) continue;
      }

      const entry: UploadFileEntry = {
        uid: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        name: file.name,
        size: file.size,
        status: action ? 'uploading' : 'done',
        percent: action ? 0 : 100,
        raw: file,
        url: null,
      };
      nextList.push(entry);

      // 提供了 action 则自动上传
      if (action) this._upload(entry, file);
    }

    if (nextList.length !== this.state.fileList.length) {
      this.setState({ fileList: nextList });
      this.props.onChange?.(nextList);
    }
  }

  /** 通过 fetch 自动上传单个文件 */
  _upload(entry: UploadFileEntry, file: File): void {
    const { action, onSuccess } = this.props;
    if (!action) return;
    const formData = new FormData();
    formData.append('file', file);

    fetch(action, { method: 'POST', body: formData })
      .then((resp) => {
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const ct = resp.headers.get('content-type') || '';
        return ct.includes('application/json') ? resp.json() : {} as Record<string, unknown>;
      })
      .then((data) => {
        entry.status = 'done';
        entry.percent = 100;
        entry.url = (data as Record<string, unknown>)?.url as string | null || null;
        this._syncFile(entry);
        onSuccess?.(entry, data);
      })
      .catch(() => {
        entry.status = 'error';
        this._syncFile(entry);
      });
  }

  /** 同步某个文件条目的状态并触发重渲染 */
  _syncFile(entry: UploadFileEntry): void {
    const nextList = this.state.fileList.map((f) => f.uid === entry.uid ? { ...entry } : f);
    this.setState({ fileList: nextList });
    this.props.onChange?.(nextList);
  }

  /** 移除指定索引的文件 */
  _removeFile(index: number): void {
    const nextList = this.state.fileList.filter((_, i) => i !== index);
    this.setState({ fileList: nextList });
    this.props.onChange?.(nextList);
  }

  getFileList(): UploadFileEntry[] { return this.state.fileList; }
}
