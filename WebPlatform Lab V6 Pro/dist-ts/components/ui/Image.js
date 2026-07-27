// Image.ts —— 图片组件（含加载占位、错误回退、点击预览）
import { Component } from '../../core/Component.js';
import { h } from '../../core/utils.js';
export class Image extends Component {
    _previewOverlay = null;
    initialState() {
        return { status: 'loading' };
    }
    render() {
        const { src, alt = '', width, height, preview = false, fallback = null, placeholder = null, } = this.props;
        const { status } = this.state;
        const style = {};
        if (width != null)
            style.width = typeof width === 'number' ? `${width}px` : width;
        if (height != null)
            style.height = typeof height === 'number' ? `${height}px` : height;
        let content;
        if (status === 'loaded' && src) {
            // 加载完成：展示图片，预览模式下可点击放大
            content = h('img', {
                class: 'image__img',
                src, alt,
                onClick: () => { if (preview)
                    this._openPreview(); },
            });
        }
        else if (status === 'error') {
            // 加载失败：优先使用回退图，否则展示错误占位
            content = fallback
                ? h('img', { class: 'image__img', src: fallback, alt })
                : h('div', { class: 'image__error' }, '✕');
        }
        else {
            // 加载中：展示占位内容，并用隐藏探测图监听 load/error 事件
            content = h('div', { class: 'image__inner' }, placeholder || h('div', { class: 'image__placeholder' }), src && h('img', {
                class: 'image__probe',
                src, alt,
                style: { display: 'none' },
                onLoad: () => this.setState({ status: 'loaded' }),
                onError: () => this.setState({ status: 'error' }),
            }));
        }
        return h('div', { class: 'image', style }, content);
    }
    /** 打开全屏预览遮罩（点击任意位置关闭） */
    _openPreview() {
        const { src, alt = '' } = this.props;
        const overlay = h('div', {
            class: 'image__preview-overlay',
            onClick: () => this._closePreview(),
        }, h('img', { class: 'image__preview-img', src, alt }));
        document.body.appendChild(overlay);
        this._previewOverlay = overlay;
    }
    _closePreview() {
        if (this._previewOverlay) {
            this._previewOverlay.remove();
            this._previewOverlay = null;
        }
    }
    componentWillUnmount() {
        // 卸载时清理可能残留的预览遮罩
        this._closePreview();
    }
}
//# sourceMappingURL=Image.js.map