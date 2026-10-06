---
title: 用 Tailwind CSS 写样式：不用离开 HTML
date: 2026-09-20
tags: [CSS, Tailwind]
description: 把样式原子化成 class，直接在标签上拼出界面。
---

Tailwind 的思路：**不写单独的 CSS 文件，把样式拆成原子化的 class**，直接在标签上组合。

## 一个按钮的进化

传统方式，先在 CSS 里写好类：

```css
.btn-primary {
  background: #171717;
  padding: 8px 16px;
  border-radius: 8px;
  color: #fff;
}
```

Tailwind 方式，直接在标签上拼：

```html
<button class="bg-black px-4 py-2 rounded-lg text-white">按钮</button>
```

## 常用 class 速查

| class | 作用 |
| --- | --- |
| `flex items-center` | 弹性布局 + 垂直居中 |
| `mx-auto max-w-3xl` | 水平居中 + 限制最大宽度 |
| `text-sm text-zinc-600` | 小号字体 + 灰色文字 |
| `dark:bg-black` | 暗色模式下的背景 |

## 前缀 = 条件

- `sm:`、`md:` —— 屏幕宽度达到阈值时生效（响应式）
- `hover:`、`focus:` —— 悬停、聚焦时生效（状态）
- `dark:` —— 暗色模式下生效（主题）

> 心法：在浏览器里直接改 class 看效果，熟练之后比来回切换 CSS 文件快得多。
