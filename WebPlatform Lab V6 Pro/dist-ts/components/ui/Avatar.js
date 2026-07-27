// Avatar.ts —— 头像组件（图片或文字/图标回退）
import { Component } from '../../core/Component.js';
import { h } from '../../core/utils.js';
export class Avatar extends Component {
    initialState() {
        return { imgError: false };
    }
    render() {
        const { src, size = 'middle', shape = 'circle', icon = null, children } = this.props;
        const classes = [
            'avatar',
            `avatar--${size}`,
            shape !== 'circle' && `avatar--${shape}`,
        ].filter(Boolean).join(' ');
        // 优先显示图片，加载失败时回退到文字（首字母）/ 图标
        const showImg = src && !this.state.imgError;
        const content = showImg
            ? h('img', {
                src,
                alt: '',
                onError: () => this.setState({ imgError: true }),
            })
            : (children || icon);
        return h('span', { class: classes }, content);
    }
}
//# sourceMappingURL=Avatar.js.map