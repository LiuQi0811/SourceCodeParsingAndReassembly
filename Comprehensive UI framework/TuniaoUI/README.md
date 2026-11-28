# TuniaoUI 全知识点示例工程

基于 `@tuniao/tnui-vue3-uniapp 1.0.23`（内含 `@tuniao/tn-icon` 838 图标）与 uni-app（Vue3 + TypeScript + Vite + Sass）搭建的可运行示例项目，覆盖 55 个组件模块、进阶 API、主题换肤、原子类、图标、表单校验、命令式调用、多语言、工程化分包、跨端生命周期与系统 API、请求超时 / 取消 / 重试 / 上传下载进度，以及 Pinia 登录态 / 请求封装 / 购物车 / 订单分页的业务闭环，并附带「商城列表 / 商品详情」两个实战模板页。

## 快速开始

```bash
npm install
npm run dev:h5        # 浏览器调试，默认 http://localhost:5173
npm run dev:mp-weixin # 微信小程序（需在微信开发者工具中导入 dist/dev/mp-weixin）
npm run build:h5      # 生产构建，产物在 dist/build/h5
npm run build:mp-weixin
npm run build:app     # HBuilderX 导入 dist/build/app 运行到 App 基座
npm run type-check    # vue-tsc 检查 src（示例代码 0 错误；组件库源码会有上游类型报错）
```

> 微信小程序端需要在 `src/manifest.json` 的 `mp-weixin.appid` 填入自己的 AppID。

## 目录结构

```
src/
├── App.vue                     # 全局样式、base64 图标字体、i18n 语言还原、生命周期
├── main.ts                     # 全量安装组件库 + Pinia + vue-i18n
├── pages.json                  # 主包 15 页 + 分包 1 页 + 5 项 tabBar + easycom custom
├── manifest.json               # 应用配置（H5 hash 路由 / 小程序 AppID）
├── uni.scss / env.d.ts         # 全局 scss 变量、TS 声明
├── i18n/                       # vue-i18n 实例与中英文语言包
├── stores/
│   ├── user.ts                 # 登录态：token / profile / login / logout / expire
│   └── cart.ts                 # 购物车：增删改、合计、watch 持久化
├── utils/request.ts            # uni.request 封装：.env 地址、token、401、业务码、超时 / 取消 / 重试、上传下载进度、Mock
├── data/
│   ├── icons.ts                # 838 个内置图标名（自动提取）
│   └── mock.ts                 # 轮播 / 商品 / 相册 / 瀑布流 / 联系人等演示数据
├── components/demo-block/      # 示例卡片（效果预览 / 源码双视图 + 复制）
├── static/demo/                # 本地占位图（轮播 3 张 + 商品 3 张）
├── pages/
│   ├── index/index.vue         # 首页：Hero、数据统计、快捷入口、通知
│   ├── components/index.vue    # 组件总览：分类入口 + 55 个组件清单 + 页面地图
│   ├── basic/index.vue         # Button / Icon / Avatar / AvatarGroup / Badge / Tag / Title
│   ├── layout/index.vue        # 布局实验室 / 真实页面布局 / 宽高 / 间距 / 圆角 / 阴影 / 文本 / 边框 / 色板 / 渐变 / ListItem / Sticky
│   ├── form/index.vue          # Form 校验 + 全部输入类组件 + 三种 Picker + 键盘 + 图片上传
│   ├── feedback/index.vue      # Modal / Notify / ActionSheet / Popup / Overlay / 进度 / 倒计时 / 通知栏
│   ├── nav/index.vue           # Navbar / Tabs / Tabbar / SwitchTab / Steps / Collapse / Subsection / SwipeAction
│   ├── data/index.vue          # Calendar / WeekCalendar / Swiper / PhotoAlbum / LazyLoad / WaterFall / ScrollList / IndexList
│   ├── theme/index.vue         # CSS 变量换肤 / 21 色板 / 渐变库 / 图标检索 / i18n / 条件编译
│   ├── advanced/index.vue      # 进阶 API：类型化实例 / validateField / 返回拦截 / 事件全集 / 组件文案 i18n
│   ├── cross-platform/index.vue# 跨端：生命周期 / 网络窗口监听 / 分享 / 媒体 / 扫码 / 定位 / 设置 / 拨号 / 能力探测 / easycom custom / hooks
│   ├── business/index.vue      # 业务闭环：Pinia / 登录态 / 购物车 / 请求封装 / 401 / 订单分页
│   ├── template/index.vue      # 实战模板：商城列表页（自定义导航栏 + 搜索 + 轮播 + 秒杀 + 商品网格）
│   ├── detail/index.vue        # 商品详情：相册 / 规格选择 / 优惠券弹窗 / 物流步骤 / 图文详情
│   └── mine/index.vue          # 我的：用户卡 / 功能列表 / FAQ / 技术栈 / 知识点清单
└── pages-sub/
    └── engineering/index.vue   # 分包页：按需引入 / subPackages / 字体本地化 / 小程序检查清单
```

## 示例卡交互说明

- 布局页新增「布局实验室」：方向 / 交叉轴 / 主轴 / wrap / gap 五组切换会实时更新 `tn-flex-*` 类名与预览，支持复制 class；「真实页面布局」可切换 1/2/3 列与侧栏显隐，用来观察内容区自适应。
- 示例卡默认是「效果预览」，里面的按钮、弹层、输入框都是真实运行的组件；绿色圆点表示当前是可交互预览。
- 「源码」是卡片对应的代表性用法片段，属于只读文本；每张卡片另有「完整源码」入口，跳到 `pages/source/index` 查看当前页面的整份 `.vue` 源码，并可一键复制全文。
- 页面源码由 `npm run gen:sources`（`scripts/generate-page-sources.mjs`）在 `dev` / `build` 前生成到 `src/utils/page-source.generated.ts`，修改页面后重新运行构建即可刷新。
- `TnActionSheet.show({ select })` 的 `select` 回调需要返回 `true`（或 resolve 为 `true` 的 Promise）才会关闭操作菜单；只弹 Toast 不返回值时菜单会保持打开并继续挡住页面点击。
- `TnModal` / `TnNotify` / `TnActionSheet` / `TnPopup` / `TnOverlay` 这类层叠组件建议放在页面根节点，不要放进 `demo-block` 卡片；卡片的 `overflow` 与圆角会让小程序里的 fixed 弹层被裁剪。示例卡已移除 `overflow: hidden`，反馈 / 表单 / 进阶页的弹层宿主也已统一移到页面根节点。
- **小程序“点了没反应”的根因是组件没有注册**：`pages.json` 必须提供 `^tn-(.*)` 的 easycom 规则，否则构建产物里 `<tn-*>` 只是未知节点。微信会把未知节点当普通容器渲染子内容，于是文字看得见、点击也能触发页面事件，但组件行为（弹层、选择器、开关）完全不存在。`src/pages.json` 现已配置 `^tn-(.*) → @tuniao/tnui-vue3-uniapp/components/$1/src/$1.vue`，并为 `avatar-group`、`checkbox-group`、`collapse-item`、`form-item`、`list-item`、`radio-group`、`steps-item`、`subsection-item`、`swipe-action-item`、`tabbar-item`、`tabs-item` 补了显式映射。验证方式：构建后查看 `dist/build/mp-weixin/pages/form/index.json` 的 `usingComponents`，表单页应包含 `tn-picker`、`tn-date-time-picker`、`tn-region-picker` 等 19 个组件。
- **小程序选择器需要额外兜底**：`TnPicker` 的条目不能用 `height: fit-content`（微信不支持，会塌缩成 0 高），已改为 44px，并给 `picker-view-column` 补 `height: 100%`；级联选择器的列是动态生成的，原生 `picker-view` 不会为后到的列补渲染，`use-picker.ts` 在 `MP-WEIXIN` 打开时先卸载、300ms 后重建。以上改动会被 `scripts/patch-tuniao-popup.mjs` 在 `postinstall` 自动补齐，重新安装依赖不会丢。
- 小程序部分基础库在组件样式隔离下会丢失 `TnPopup` / `TnOverlay` 组件 wxss 里的 `position: fixed`，弹层会掉进文档流、显示在页面底部。项目在组件根节点补了内联 `position: fixed / inset: 0` 兜底，并由 `scripts/patch-tuniao-popup.mjs` 在 `npm install` 后自动打补丁（见 `postinstall`）；升级 TuniaoUI 后重新安装依赖也不会丢。
- H5 下 `TnPopup` 的 scoped 过渡偶发停在 `opacity: 0 / scaleY(0)` 起始帧，`App.vue` 已加 `#ifdef H5` 的 `.tn-popup.is-show` 可见性兜底，避免“点了按钮但弹层不出现”。
- 小程序里隐藏态的 `TnPopup` / `TnOverlay` / `TnNotify` 即使 `visibility: hidden`，仍可能作为全屏 fixed 层拦截点击，整页表现成“点不动”。`App.vue` 已统一加 `.tn-popup:not(.is-show) / .tn-overlay:not(.tn-overlay--show) / .tn-notify:not(.is-active) { display: none !important }`，让隐藏层彻底退出命中测试。

## 知识点覆盖

| 模块 | 覆盖内容 |
| --- | --- |
| 工程化 | Vue3 `script setup` + TS、Vite 别名 `@`、easycom 自动引入与 `easycom.custom` 别名规则、`uni.scss` 全局变量、页面路由与 tabBar、subPackages 分包 |
| 组件安装 | `import * as TnUI` 遍历 `TnXxx` 显式注册（修正默认安装注册成 `tabs` 的问题）；也演示 `TnButton` 单组件按需注册 |
| 主题体系 | `--tn-color-primary` / `--tn-color-primary-rgb` CSS 变量换肤；21 种内置色；`tn-{color}_{prop}` 原子类；`tn-type-{type}_{prop}` 语义类 |
| 渐变 | `tn-gradient-bg__{color}`、`__{color}-light`、`__cool-1..16` |
| 图标 | 838 个内置图标；`name` 支持图片绝对路径、`transparent`、`offsetTop`、`imgMode`；base64 字体离线可用 |
| 表单 | async-validator 规则、`validate()`、`validateField('field')`、`resetFields()`、`clearValidate()`、自定义 validator、600ms 异步 validator |
| 命令式 API | `TnModal.showModal()`、`TnNotify.show()`、`TnActionSheet.show()`；`select(index, value)` 回调；类型 `TnModalInstance` / `TnActionSheetInstance` |
| 进阶 API | `beforeBack` / `beforeHome` 拦截返回、Tabs `beforeSwitch`、CountDown `start/stop/reset`、Popup `open/close/overlay-click`、ReadMore `beforeExpand` 异步拦截 |
| 选择器 | Picker 单列 / 多列 / 级联；DateTimePicker 7 种 mode 全部可点选且 `format` 跟随 mode；RegionPicker 省市区；Keyboard 5 种模式 + 车牌中英文；`cancelText/confirmText` 可被 i18n 覆盖 |
| 数据展示 | 日历三模式、周历标记、Swiper 3 种指示器 × 6 个位置、瀑布流 normal / calc、索引列表、横向滚动、懒加载 |
| 交互 | Tabs / Tabbar（凸起 bulge、角标 badge、禁用 disabled）/ Steps / Collapse（手风琴与 number[] 多开）/ Subsection / SwipeAction（open、select、round、disabled）/ NoticeBar 横向与纵向 |
| 第三方 | vue-i18n 中英切换并写入 Storage；Pinia setup store；sass 主题编译 |
| 业务闭环 | `uni.login` 换 code、token 持久化、`uni.request` 统一封装与 401 兜底、购物车 `watch` 持久化、`onReachBottom` 分页、`onPullDownRefresh` 重置、`uni.setTabBarBadge` 角标 |
| 请求封装 | `.env` 基础地址、Bearer token、`{ code, data, message }` 解包、`BusinessError`、401 清 token、10s 超时、`AbortController` 取消、5xx / 408 指数退避重试、`uploadFile` / `downloadFile` 进度 |
| 跨端 | 页面生命周期 `onLoad / onReady / onShow / onHide / onUnload / onPageScroll / onTabItemTap`、`onShareAppMessage` / `onShareTimeline`、`uni.onNetworkStatusChange` / `onWindowResize`、`chooseImage` / `previewImage` / `scanCode` / `chooseLocation` / `openSetting` / `makePhoneCall`、能力探测、`#ifdef` 条件编译 |
| 二次开发 | `easycom.custom` 把 `tnx-button` 映射到组件库源码；`useNamespace` / `useComponentColor` / `useComponentSize` hooks 实际渲染 |
| 实战 | 商城列表页 + 商品详情页，串起导航、轮播、卡片、按钮、弹层、页脚等组合用法 |

### 模式与状态矩阵

- **DateTimePicker**：`year` / `yearmonth` / `date` / `datetime` / `time` / `datetimeNoSecond` / `timeNoSecond` 七个按钮直接切换，`format` 由计算属性同步，示例中会立即打开选择器。
- **Keyboard**：`number` / `digit` / `idcard` / `random` / `car` 五种模式；`car` 模式额外提供 `carLang` 的 `cn` / `en` 切换。
- **Swiper**：`indicatorType` 的 `line` / `dot` / `number` 三种样式，`indicatorPosition` 的六个方位都可点选验证。
- **WaterFall**：`normal` 固定左右分栏与 `calc` 按内容高度动态分配可即时切换。
- **Collapse**：`accordion=true` 时 `modelValue` 为 number，`accordion=false` 时切换为 number[]，可同时展开多项。
- **NoticeBar**：`horizontal` 衔接滚动 / `vertical` 上下轮播；横向时 `speed` 是像素/秒，纵向时是切换间隔。
- **表单校验**：异步 validator 输入 `admin` 后失焦，600ms 返回“已被占用”；`clearValidate` 只清提示、不清值，`resetFields` 连值一起重置。

## 进阶 API 与类型

- **类型化实例**：从包入口导入 `TnFormInstance` / `TnModalInstance` / `TnActionSheetInstance` / `TnCountDownInstance`，用 `ref<TnFormInstance>()` 获取 `validate` / `validateField` / `resetFields` / `clearValidate` 的完整类型提示，避免 `any`。
- **单字段校验**：`await formRef.value?.validateField('username')`，catch 到的数组第一项即字段错误信息。
- **返回拦截**：`<tn-navbar :before-back="fn" :before-home="fn" />`，回调返回 `Promise<boolean>` 或 `boolean`，`false` 阻止返回。`TnNavbar` 没有 `click-back` 事件，返回逻辑要靠这个 prop。
- **切换拦截**：`<tn-tabs :before-switch="fn">`，回调参数为目标索引，返回 `false` 时 `v-model` 不变。
- **事件全集**：NoticeBar `click(index)` / `left-icon-click` / `right-icon-click`；SwipeAction `open(index)` / `select(index, optionIndex)`；Popup `open` / `close` / `overlay-click`；Tabbar 的选中值通过 `v-model` + `@change`（单个 item 的 `click` 不冒泡到 tabbar）。
- **组件内置文案 i18n**：组件库固定文案不会自动跟随 vue-i18n，需要显式覆盖：
  - Picker：`:cancel-text="t('common.cancel')"`、`:confirm-text="t('common.confirm')"`
  - ActionSheet：`show({ cancelText: t('common.cancel'), ... })`
  - Modal：`showModal({ confirmText, cancelText })`
  - Loadmore：`:text="{ loadmore, loading, nomore, empty }"` 整对象覆盖
  - Empty：没有 `text` prop，用 `#tips` 插槽

## 跨端生命周期与系统 API

- **页面生命周期**：`onLoad` 先拿到路由参数，`onShow` 每次页面可见都会触发，`onReady` 只保证首次渲染完成，`onHide` / `onUnload` 分别对应切后台与页面销毁；`onPageScroll` 带 `scrollTop`，`onTabItemTap` 仅 tabBar 页面触发。跨端页会把每次触发实时写进日志，返回 / 切后台后再回来可以观察顺序。
- **监听器清理**：`uni.onNetworkStatusChange` 与 `uni.onWindowResize` 的回调必须在 `onUnload` 里用对应的 `off` 注销，否则热重载或反复进出页面会重复触发。
- **分享**：`onShareAppMessage` 返回 `{ title, path, imageUrl }`，`onShareTimeline` 返回 `{ title, query }`；两者只在微信小程序等支持分享的平台生效，H5 只保留注册代码。
- **系统 API**：`chooseImage` / `previewImage`、`scanCode`、`chooseLocation`、`openSetting`、`makePhoneCall` 都带 `success` / `fail` 分支；H5 没配地图 key 时 `chooseLocation` 会 fail，`openSetting` 在 H5 也不可用。调用前可用 `typeof uni.xxx === 'function'` 或 `uni.canIUse` 做能力探测。
- **条件编译**：`#ifdef H5` / `#ifndef H5` 包住 `AbortController` 这类平台专属代码；不要把 `#ifdef` 写进模板属性字符串。

### easycom.custom 与 hooks

`pages.json` 增加了自定义别名规则，`tnx-button` 不需要在 `main.ts` 注册，编译时直接映射到组件库源码：

```json
"easycom": {
  "autoscan": true,
  "custom": {
    "^tnx-(.*)": "@tuniao/tnui-vue3-uniapp/components/$1/src/$1.vue"
  }
}
```

页面里可直接写 `<tnx-button>`；构建后 `index.json` 的 `usingComponents` 会生成 `tnx-button → .../components/button/src/button`。二次开发 hooks 也从包入口导入：

```ts
import { useNamespace, useComponentColor, useComponentSize } from '@tuniao/tnui-vue3-uniapp'

const ns = useNamespace('knowledge-card')
const color = ref('tn-blue')
const [colorClass, colorStyle] = useComponentColor(color, 'bg')
const { sizeType } = useComponentSize('lg')
```

`ns.b()` → `tn-knowledge-card`，`ns.e('body')` → `tn-knowledge-card__body`；`useComponentColor` 返回 `tn-blue_bg` 这类类名或 `#hex` 样式值；`useComponentSize('lg')` 的 `sizeType` 为 `inner`，传自定义数值时为 `custom`。

## 请求封装进阶

`src/utils/request.ts` 在原有 token / 401 / Mock 基础上补齐：

1. **基础地址**：`.env` 的 `VITE_API_BASE_URL` 优先，缺省回退 `https://api.example.com`；`.env.example` 可直接复制。
2. **业务码解包**：响应是 `{ code, data, message }` 时，`code = 0 / 200` 返回 `data`，否则抛 `BusinessError`（带 `code` 与原始 `payload`）；没有 `code` 的旧接口自动原样返回。
3. **超时与取消**：`timeout` 默认 10000ms，超时抛 `RequestError(408)`；H5 可传 `AbortController.signal`，小程序 / App 用 `onTask(t => { task = t })` 保存底层 `RequestTask`，再调 `task?.abort()`。
4. **重试**：`retries` 只对网络错误、408、5xx 生效，按 `retryDelay * (attempt + 1)` 退避；401 与业务错误不重试。
5. **上传 / 下载**：`uploadFile` / `downloadFile` 复用 token 与 loading，支持 `onProgress` 回传百分比；上传响应同样走业务码解包。
6. **Mock 一致**：`mock` 也会经过 `unwrapBody`，所以业务码解包、`BusinessError`、取消信号在离线示例里同样能演示。

```ts
const data = await request<{ name: string }>({
  url: '/demo/envelope',
  mock: () => ({ code: 0, data: { name: 'TuniaoUI' }, message: 'ok' }),
  timeout: 10000,
  retries: 2,
})
```

业务闭环页新增了「请求封装进阶」卡片，可分别点「业务码解包」「业务错误」「取消请求」验证三条分支。

## 工程化与分包

- **真实分包**：`pages.json` 中声明 `subPackages: [{ root: 'pages-sub', pages: ['engineering/index'] }]`，本页从进阶页 `navigateTo('/pages-sub/engineering/index')` 进入。H5 构建会产出独立的 `pages-sub-engineering-*.js` 懒加载 chunk；小程序构建会生成独立分包目录。
- **按需 vs 全量**：业务项目建议只注册用到的组件（`app.component('TnButton', TnButton)`），减小主包；本示例为了展示全部组件使用全量遍历注册。接口一致，可随时切换。
- **图标字体本地化**：默认 `tn-style` 的 `@font-face` 指向 `//at.alicdn.com/...woff`，断网/域名拦截时图标变方块，小程序也无法加载外链字体。`App.vue` 在 `tn-style` 之后追加：

  ```scss
  @import '@tuniao/tn-style/dist/uniapp/index.css';
  @import '@tuniao/tn-icon/dist/base64/index.css';
  ```

  base64 版本约 178KB，woff2 内嵌。`App.vue` 的全局声明负责 H5 页面里直接写的 `tn-icon-*` 类；小程序端组件 `icon.wxss` 由 Vite 别名单独指向 base64，避免回退到 CDN。H5 主 CSS 约 314KB，小程序总包约 1.71MB。
- **小程序上线清单**：安全区（`safe-area-inset-bottom`）、自定义导航栏胶囊高度（`uni.getMenuButtonBoundingClientRect()`）、字体离线、tabBar 必须在主包、分包不能跨包引用资源、主包 < 2MB / 总包 < 20MB、iOS/Android 真机各验一次。

## 小程序构建与真机验证

已通过 `npm run build:mp-weixin` 实测，产物在 `dist/build/mp-weixin`：188 个文件、约 1.33MB；主包约 1.31MB（低于 2MB 限制），`pages-sub/engineering` 为独立分包目录，`app.json` 中的 `subPackages` 已正确写入。

构建前必须对齐 `@dcloudio/*` 版本：组件库会把 2023 alpha 版 `@dcloudio/uni-mp-*` 带进依赖树，与 2024 版 `@dcloudio/uni-app` 跨代不匹配，报 `"isInSSRComponentSetup" is not exported`。本项目已在根 `dependencies` 显式声明 `@dcloudio/uni-mp-weixin` / `uni-mp-vue` / `uni-mp-compiler`，并在 `overrides` 中把组件库子树统一钉到 `3.0.0-4020920240930001`，重装后构建通过。

小程序端会把组件内的 `tn-icon` CSS 抽成组件独立的 `icon.wxss`，只靠 `App.vue` 的 base64 字体不够，`icon.wxss` 仍会指向 `at.alicdn.com`。`vite.config.ts` 已加别名，把 `@tuniao/tn-icon/dist/index.css` 指向 `dist/base64/index.css`，确保 `icon.wxss` 也内嵌 woff2，断网时图标仍能显示。

真机验证步骤：

1. `src/manifest.json` 的 `mp-weixin.appid` 已填入当前使用的 AppID；换成正式小程序时替换该值并重新构建。`touristappid` 只能跑模拟器，不能真机预览。
2. 执行 `npm run build:mp-weixin`，微信开发者工具导入 `dist/build/mp-weixin`。
3. 工具内点“预览”，用绑定该 AppID 的微信扫码；真机重点检查：
   - 图标在飞行模式/断网下是否正常
   - 首页 → 进阶 API → 分包工程化页的跳转与返回
   - 自定义导航栏标题与右上角胶囊是否对齐
   - 底部 tabBar、凸起项、角标与安全区
   - Popup / ActionSheet / Modal 的遮罩层级和关闭手势
   - 分包页从主包进入、独立打开是否都正常
4. 开发者工具“详情 → 本地设置”里的“不校验合法域名”只用于开发；正式真机环境要配置 request 合法域名。


## App 构建

`npm run build:app` 已通过，产物在 `dist/build/app`（38 个文件、约 1.9MB），用 HBuilderX 导入后运行到 Android / iOS 基座。

App 平台最初因 `@dcloudio/uni-app-plus` / `uni-app-vite` / `uni-app-vue` 被组件库带成 2023 alpha 版而失败，报 `"isInSSRComponentSetup" is not exported`；已在根 `devDependencies` 显式安装与主工程一致的 `3.0.0-4020920240930001`，三端现在都能构建。真机运行仍需在 HBuilderX 里配置 App 图标、启动图、模块权限与签名证书，CLI 只负责生成资源。

## 关键实现说明

1. **全量注册**：组件库包入口只做 `export *`，且组件对象内部的 `name` 取自 SFC 文件名（如 `tabs`），直接用默认导出安装会把组件注册成 `tabs` 而不是 `tn-tabs`。因此 `main.ts` 采用 `import * as TnUI`，遍历所有 `TnXxx` 导出，按 `TnButton → tn-button` 的规则显式 `app.component(tag, comp)`，保证所有 `tn-*` 标签（含 `tn-tabs-item` 等子组件）可用。
2. **样式入口**：`App.vue` 中引入 `@tuniao/tn-style/dist/uniapp/index.css`，原子类与主题样式全局生效；不要在单个页面里引，否则 tabBar 其他页面会丢样式。
3. **换肤原理**：所有组件颜色取自 `--tn-color-primary` 与 `--tn-color-primary-rgb`，在容器上覆盖这两个变量即可让子组件联动变色，无需重新编译。
4. **颜色命名规则（重要）**：组件把 `color` / `bg-color` / `border-color` 等值拼成 `tn-xxx_bg` / `tn-xxx_text` 原子类，而原子类只有调色板名：`tn-blue`、`tn-green`、`tn-orange`、`tn-red`、`tn-grey`、`tn-blue-light`…；**没有 `tn-primary` / `tn-success`**。语义名（`primary` / `success` / `warning` / `danger` / `info`）只适用于组件的 `type` 属性。写错不会报错，只会静默回退默认色。
5. **自定义导航栏**：`template` 与 `detail` 页配置 `navigationStyle: custom`；`TnNavbar` 的标题写在默认插槽，右侧操作写在 `#right`。传 `back-icon="" home-icon=""` 可让左侧按钮完全隐藏（`navbackButtonType` 变为 `none`）。
6. **命令式组件**：模板中 `ref="modalRef"`，脚本 `const modalRef = ref<TnModalInstance>()`，调用 `modalRef.value?.showModal({...})`；`confirm` / `cancel` 返回 `false` 或 reject 可阻止关闭。`ActionSheet.select` 的参数是 `(index, value)`，不是 action 对象。
7. **表单校验**：`TnForm` 的 `rules` 直接使用 async-validator 语法；`TnFormItem` 通过 `prop` 关联字段；数组类型用 `type: 'array'`；`validateField` 只校验单个字段，适合「下一步」局部校验。
8. **图片上传**：`TnImageUpload` 的 `customUploadHandler(file)` 返回 `Promise<string>`，即可接入自己的上传接口，演示中使用本地临时路径。
9. **条件编译注意**：uni-app 预处理器会解析 `#ifdef` 指令，不要把指令写进模板属性字符串（如 `code="// #ifdef H5"`），否则会报 `Unbalanced delimiter`；示例中改为在 JS 注释与模板 HTML 注释中使用。
10. **倒计时单位**：`TnCountDown` 的 `time` 单位是**秒**，不是毫秒；`CountDown` 实例方法为 `start` / `stop` / `reset`。

## 设计约定

- 视觉统一为「深墨色 Hero + 蓝青强调 + 白色圆角卡片 + 深色代码块」：页面背景 `#f4f7fb`，卡片 24–28rpx 圆角、1rpx 边框与柔和阴影，标题使用 `DEMO` / `EXPLORE` 这类小号字距标签建立层次。
- 首页用双列入口 + 编号专题卡 + 精简列表，替代长列表；组件总览、业务闭环、我的都复用同一套卡片节奏。
- 代码块统一深色底 + 三色圆点 + 「左右滑动查看完整代码」提示；长行不换行，用 `scroll-view scroll-x` 横向查看，避免把 `icon="right"` 这类属性从中间断词。小程序端同样走 `scroll-view`。
- `demo-block` 默认展示真实运行的效果，顶部可切换到「源码」查看用法片段，并提供「复制」按钮；代码示例按文档片段定位，不承诺单段复制即为独立可运行工程。
- 颜色、间距、圆角优先使用原子类（`tn-flex-*`、`tn-mt-sm`、`tn-radius`、`tn-shadow` 等），scoped 样式只处理卡片类布局。
- 演示数据集中在 `src/data/mock.ts`，业务页的面包与订单是页面内 mock，替换为真实接口时改 `utils/request.ts` 的 `BASE_URL` 即可。
- 页面内不写 TS 类型标注（模板表达式会被 uni-app 编译器拒绝），需要类型时在 `<script setup>` 中定义具名函数；`uni.*` 调用也放在脚本里，模板只绑定函数。

## 构建产物

- H5：48 个文件，约 1.73MB（主 CSS 314KB，其中约 178KB 为 base64 图标字体）；`base: './'`，可直接静态部署。
- 分包：`assets/pages-sub-engineering-*.js` 独立 chunk，验证 subPackages 生效。
- 小程序：`dist/build/mp-weixin`，363 个文件、约 1.71MB；用微信开发者工具导入后预览/真机。
- App：`dist/build/app`，39 个文件、约 2.94MB；用 HBuilderX 导入后运行到 Android / iOS 基座。

## 常见问题

- **H5 打开是空白**：确认 `manifest.json` 中 H5 使用 hash 路由，且 `vite.config.ts` 的 `base` 为 `'./'`。
- **组件标签不生效 / 小程序点了没反应**：先检查 `src/pages.json` 是否有 `^tn-(.*)` 的 easycom 规则；再看构建后页面 JSON 的 `usingComponents` 是否包含 `tn-*`。`main.ts` 里按 `TnXxx → tn-xxx` 的显式注册只作用于 Vue 运行时，不会自动生成小程序组件声明。
- **颜色不生效**：`color` 用 `tn-blue` 这类调色板名，别用 `tn-primary`；`type` 才用语义名。
- **图标显示为方块**：默认字体走 at.alicdn。H5 已在 `App.vue` 追加 base64 字体；小程序还要靠 `vite.config.ts` 的别名让组件 `icon.wxss` 也用 base64 版本。
- **小程序样式缺失**：确认 `App.vue` 引入了 `tn-style` 的 uniapp 版 CSS，而不是 web 版。
- **HMR 后白屏**：改动 `pages.json` 新增页面/分包后，重启 `npm run dev:h5`（H5 路由表在启动时生成，热更新不会补新页面）。
- **type-check 报 node_modules 错误**：`vue-tsc` 会连带编译 `@tuniao/tnui-vue3-uniapp` 内的 `.ts` 源码（DateTimePicker 内部 `dayjs` 类型与根依赖不合并，且库内部有严格模式报错），这些属于上游问题；本项目 `src` 目录为 0 错误。若只想看自己的代码，可加 `--skipLibCheck`。
