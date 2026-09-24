# Theme Name: 极客终端
# Vibe & Description: 主打低保真怀旧感，唤起早期黑客探索与计算机冒险的记忆。视觉上以荧光绿色或琥珀色为核心色调，界面遵循 CLI 优先原则，采用以文本为主，图形为辅的呈现形式，模仿 DOS 或 Unix Shell 等经典命令行环境。同时融入强沉浸感设计，通过模拟真实 CRT 显示器的视觉伪影 —— 包括屏幕弯曲、扫描线、代码雨等。

# Color
- 背景（Background）：复古CRT黑（#1a1b26）或极深绿色（#0D1107）。
- 前景（Foreground）：荧光绿（#00FF00）或琥珀橙（#FFB000）及其不同层次的色调变化。


# Font
- Heading: Source Han Mono SC (url: https://resource-static.cdn.bcebos.com/fonts/SourceHanMonoSC-Regular.woff2)
- Body: ChillBitmap 16px (url: https://resource-static.cdn.bcebos.com/fonts/ChillBitmap_16px.woff2)
# Animation
## 元素动画
- 元素移动或消失时留下轻微拖影；
- 闪烁的“块状光标” 或 “下划线光标”
## 过渡动画 & 入场动画
- 轻微的视觉扭曲、信号干扰、CRT扫描线、代码流效果，增加复古的故障感
## 动画实现
- 项目中集成了 tailwindcss-intersect 插件，可以使用类似下述的方式来实现元素进入视口时的动画效果：
opacity-0 intersect:opacity-100 transition duration-700
- 同时可使用 motion/react 配合实现动画。


# Layout
- 页面加载时呈现系统启动序列
- 单列纵向流式布局，新内容像命令输出一样被“执行”并追加在底部。
- 导航体验类似输入命令行，进行选择。

# Elements
- 在命令行界面有用字符渲染的 Logo 与肖像（ASCII 艺术）。
- 如要插入图片，可根据需求添加故障艺术特效