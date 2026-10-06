---
title: TypeScript 基础：给 JavaScript 加上类型
date: 2026-09-12
tags: [TypeScript, 入门]
description: 从 any 到 interface，十分钟理解 TypeScript 在真实项目里的用法。
---

TypeScript = JavaScript + 类型系统。类型在**编译时**检查，最终运行的还是纯 JS。

## 为什么需要类型

看这段 JS：

```js
function add(a, b) {
  return a + b;
}
add(1, 2); // 3
add("1", 2); // "12"，灾难在运行时才爆发
```

加上类型之后：

```ts
function add(a: number, b: number): number {
  return a + b;
}
add("1", 2); // 编辑器直接标红，错误消灭在写代码时
```

## 最常用的三个类型工具

### 1. interface：描述对象形状

```ts
interface Post {
  title: string;
  tags: string[];
  date?: string; // ? 表示可选字段
}
```

### 2. 泛型：类型的"参数"

`Array<string>` 表示"字符串数组"，`Promise<Post>` 表示"将来会给一个 Post"。

### 3. 类型收窄

```ts
if (typeof x === "string") {
  x.toUpperCase(); // 这个分支里 x 自动被当成 string
}
```

## 小结

类型不是负担，而是**免费的自动化文档 + 错误提前爆发器**。
