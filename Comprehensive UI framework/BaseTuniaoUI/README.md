# 图鸟系统管理基础框架

基于 **uni-app 3 + Vue 3.4 + TypeScript + TuniaoUI（图鸟 UI）** 的后台管理基础框架，采用**单仓多应用（npm workspaces）**组织：

```
apps/admin   后台端（H5，管理界面，默认接内置 Mock）
apps/api     装修后端（Node HTTP，数据与上传落本地）
apps/mp      小程序端（微信，C 端，独立 pages / manifest）
packages/shared  两端共用的纯逻辑：表单校验、树工具、格式化、接口类型
packages/deco    装修协议（schema）与渲染器（DecoRenderer + 4 个组件块）
```

共享包通过 `@btn/shared` / `@btn/deco` 引入，源码即 TS/Vue 源文件，不需要额外编译步骤。
两端共用同一套技术栈与版本（Vue 3.4.21、uni-app 3.0.0-4020920240930001），但页面、路由清单、登录态彼此独立：后台走 RBAC，小程序端后续接自己的 C 端登录，不复用后台权限模型。

## 快速开始

命令统一在**仓库根**执行（根脚本用 `-w` 代理到对应应用）：

```bash
npm install          # 首次，一次装完所有应用
npm run dev:api      # 装修后端（零依赖 Node），默认 http://localhost:3001
npm run dev:h5       # 后台端调试，默认 http://localhost:5173
npm run build:h5     # 后台端生产构建，产物在 apps/admin/dist/build/h5
npm run dev:mp       # 小程序端调试（微信开发者工具导入 apps/mp/dist/dev/mp-weixin）
npm run build:mp     # 小程序端构建，产物在 apps/mp/dist/build/mp-weixin
npm run mp:tenant -- <应用标识> <AppID> [后端地址]  # 切换小程序构建目标（租户 + AppID）
npm test             # 单元测试（Vitest，目前 102 条）
npm run test:e2e     # 端到端测试（Playwright，自动拉起 dev server，目前 32 条）
npm run smoke:api    # 装修后端冒烟：临时目录跑多应用隔离/复制/发布/回滚/模板/上传
npm run verify       # 一次跑完 lint + 两端类型检查 + 格式 + 单测 + H5 构建（提交前建议）
```

也可以在子应用目录里跑同名脚本（如 `cd apps/admin && npm run dev:h5`）。注意 E2E 与单测的配置都在 `apps/admin` 下，**不要在根直接 `npx playwright test`**，用根脚本 `npm run test:e2e`。

以下内容除非特别说明，路径均相对 `apps/admin/`。

演示账号（密码统一 `123456`）：

| 账号 | 角色 | 权限 |
| --- | --- | --- |
| `admin` | 超级管理员 | 全部 |
| `chenmo` | 系统管理员 | 用户 / 角色 / 字典 |
| `zhouye` | 运维人员 | 菜单 / 日志只读 |

普通账号直接访问无权限页面会被 `AppLayout` 拦成「无访问权限」页；右上角用户菜单可重置演示数据。

## 技术要点

- **响应式**：`app` store 监听窗口宽度，`<768px` 为 mobile，`<1200px` 为 tablet，其余 desktop；桌面为「固定侧边栏 + 吸顶顶栏」，移动端自动切为「抽屉菜单 + 卡片列表」。
- **尺寸单位**：布局与控件统一使用 **px 设计令牌**（`src/styles/tokens.scss`），不使用 rpx。原因是桌面 H5 上 rpx 会随窗口宽度放大，后台表格与表单会被撑大；图标统一用 `AppIcon`，按 `size` 传像素值。
- **图标**：`AppIcon` 是纯字体实现（`tn-icon-{name}` 类名取字形），字体文件离线放在 `src/static/fonts/tuniao-icon.woff`，由 `src/styles/icon-font.scss` 以同名 `font-family` 覆盖官方 CSS 里的 CDN 地址，内网/断网也不会丢图标；不再引入 `@tuniao/tnui-vue3-uniapp` 的 icon 组件。
- **请求层**：`src/utils/request.ts` 统一封装 `get/post/put/del`，处理 loading、`code !== 0` 业务错误、401 清理登录态并广播 `auth:expired`。`VITE_USE_MOCK=true` 走 `src/mock`，否则走 `VITE_API_BASE` 真实域名。
- **Mock 层**：`src/mock/adapter.ts` 做路由匹配（支持 `/system/user/:id`），数据由 `src/mock/db.ts` 写入本地存储，可持久化、可重置。种子数据带版本号（`SEED_VERSION`，存在 `BTN_mock_seed_version`）：给种子加了新菜单/新角色后把它加一，老浏览器缓存会按 id 把缺失记录补进来，不用清 localStorage；同时布局页启动时会静默补拉一次 `profile`，避免缓存里的旧菜单树盖住新入口。
- **权限**：登录后 `profile` 返回菜单树、按钮权限码与 `roleIds`，`user.hasPerm('system:user:add')`、`user.hasPage('/pages/system/user/index')` 分别控制按钮与页面。角色改授权/改资料后，若改的是当前账号所属角色，页面会 `user.refreshProfile()`，侧边栏与当前页权限即时生效（收回当前页权限会直接落到「无访问权限」）。
- **路由注册单一来源**：`src/config/routes.ts` 的 `REGISTERED_PAGES` 必须与 `src/pages.json` 的页面路径一致。菜单表单保存会校验路径是否已注册，`navigateTo` 也会拦截未注册路径，避免「点了没反应」。
- **主题外观**：右上角头像 → 主题外观，可切换浅色 / 深色与四种品牌色（天青 / 松绿 / 黛紫 / 赤橙），并额外提供「界面密度（标准 / 紧凑）」与「圆角（小 / 标准 / 大）」两组档位。实现是「CSS 变量 + 根节点 class」：`app` store 的 `themeClass` 输出 `theme-*`、`accent-*`、`density-*`、`radius-*`，页面根节点（`AppLayout`、登录页）绑定后，所有控件通过 `var(--app-*)` 继承，切换即时生效并写入本地存储。紧凑模式整体压字号（`--app-font*`）与内容边距，并收窄按钮 / 输入框 / 表格行高；圆角档位只改 `--app-radius*` 三个变量。新增品牌色只需在 `src/styles/themes.scss` 加一个 `.accent-xxx` 块、再到 `app.ts` 的 `ACCENTS` 登记色值。
- **表单与 CRUD**：新增/编辑弹窗统一走 `src/hooks/useCrudForm.ts`（打开 → 重置 → 校验 → 提交 → toast → 关闭 → `onSaved` 刷新），校验规则是纯数据声明（`src/utils/validate.ts` 的 `FormRule`：必填、正则、最大长度、跨字段 `validate`），按声明顺序短路只提示第一条。删除确认统一走 `src/utils/dialog.ts` 的 `confirmDelete`，确认按钮文案与危险色一致；`uni.showModal` 的取消键默认跟浏览器语言走（中文页面也会显示 `Cancel`），所以 `cancelText` 显式传 `t('common.cancel')`。
- **多语言**：`vue-i18n`（Composition API，`legacy: false`），文案按命名空间放在 `src/locales/{zh-CN,en-US}.ts`：`common`（通用词）、`layout`、`login`、`home` 与各业务页各自的命名空间（含 `deco`）。`src/locales/index.ts` 从 `BTN_locale` 读语言、`setLocale()` 写回；页面里 `const { t } = useI18n()` 后直接 `t('user.title')`。切换入口两处：登录页右上角「EN / 中文」、头像菜单「语言 / Language」面板。因为文案在 setup 时求值，切换语言后统一 `reLaunch` 当前页生效；通用控件（`AppDialog` / `AppTable` / `AppSelect` / `AppInput` / `AppEmpty` / `AppPagination`）的默认文案自己兜 `t()`，页面不传也不会出现中文残留。
- **业务数据的英文层**：Mock 种子只存中文（它同时是新增/编辑后的真实数据），`src/mock/i18n.ts` 在 `en-US` 下把接口返回体深拷贝一份，按「中文原值 → 英文译文」翻译 `name` / `deptName` / `roleNames` / `label` / `remark` / `module` / `action` 这几个字段，覆盖菜单名、部门名、角色名与说明、字典标签、日志模块与动作；账号、昵称、手机号、路径、权限码不动，表里查不到的文案（用户自己输入的名称）原样保留。**译文绝不写回 db**，否则切回中文会看到英文。角色名、菜单树来自落在本地的 `profile`，所以切换语言时会先 `user.refreshProfile()` 再 `reLaunch`，避免侧边栏仍显示旧语言。Mock 抛出的业务错误（`MockError`）也走同一层：`localizeMockMessage()` 把「账号已存在」「该角色已被 N 个用户使用」这类提示翻成英文，未登记的开发期提示（如 Mock 接口未定义）保留中文方便排查。
- **代码规范**：`npm run lint`（ESLint 9 flat config）、`npm run format`（Prettier）；`npm run type-check` 用 `vue-tsc --noEmit`；`npm run format:check` 只检查不改写。
- **CI**：`.github/workflows/ci.yml` 两个 job —— `quality`（ESLint → 两端类型检查 → 格式检查 → 102 条单测 → `build:h5` → `build:mp`）与 `e2e`（`needs: quality`，安装 Chromium 后跑 31 条 Playwright 用例，失败上传 `apps/admin/test-results` / `apps/admin/playwright-report`）。CI 上设 `PW_BROWSER=chromium`，`playwright.config.ts` 据此从「系统 Chrome」切到 Playwright 自带 Chromium；本机仍复用系统 Chrome，不额外下载。提交前本地跑 `npm run verify` 等价于 `quality` job（但不含 `build:mp`，改小程序端时单独跑一次）。
- **单元测试**：`npm test`（Vitest，配置在 `vitest.config.ts`，`src/**/*.spec.ts` 自动收集，目前 102 条）。覆盖权限判断（`utils/permission.ts`）、页面注册校验（`config/routes.ts`）、树工具、格式化工具、表单规则（`utils/validate.ts`）、`useCrudForm` 的打开/校验短路/新增/编辑/失败保留弹窗、主题外观与密度/圆角的读写与非法值回落（`store/app`）、Mock 业务数据英文层（各字段翻译、未命中保留原文、深拷贝不改 db、错误提示翻译、走真实请求链路验证）、删除确认的按钮文案与失败兜底（`utils/dialog.ts`）、装修协议校验（版本号、id 重复、轮播/公告/导航必填项、未知组件类型，`utils/deco.spec.ts`）、组件注册表（四个内置组件、默认值可生成合法页面、未登记类型不生成、列表字段统一包含跳转路径、范围与必填规则进入校验，`utils/decoRegistry.spec.ts`）、组件拖拽排序的插入点与索引换算（`utils/decoDrag.spec.ts`），以及请求层 + Mock 的契约（登录成功/失败、401 清理与 `auth:expired` 广播、404、`showError`、loading 成对调用、图片上传回显 base64 与非法格式拦截、装修多页面的新建/存草稿/发布/读取/删除与首页保护）。测试里用内存 Map 替身扮演 `uni` 存储，无需浏览器或 HBuilderX。
- **端到端测试**：`npm run test:e2e`（Playwright，`e2e/*.spec.ts`，目前 6 个文件 32 条）。直接复用本机 Chrome（`channel: 'chrome'`，不额外下载浏览器），`playwright.config.ts` 里配了 `webServer`：没有 dev server 时自动 `npm run dev:h5`，已在跑则复用 5173 端口，单 worker 顺序执行。分两个 project：`desktop`（1280×800，跑 auth / permission / theme / user-crud / deco）与 `mobile`（660×570，命中 `<768` 断点，只跑 `mobile.spec.ts`）。装修用例覆盖组件联动、注册表驱动的属性面板（列表增删与跳转路径保存）、拖拽手柄排序、新增/切换小程序应用后数据隔离、切换前未保存草稿确认、删除非默认应用、草稿持久化、发布状态、图片回填、多页增删切换、复制与模板复用、发布历史回滚。设置 `PW_BASE_URL` 可跳过自动拉起 dev server，把同一套用例指向真实后端模式。
  - 桌面覆盖登录与会话（未登录拦截、空账号、密码错误、admin 进工作台）、权限拦截（chenmo 无菜单管理、zhouye 无用户管理、admin 有新增按钮）、主题外观与语言（深色落 class + 落 storage、紧凑密度叠大圆角、切英文再切回中文且菜单名/角色名/日志模块同步变英文、英文列表页部门与角色列已翻译而昵称保持中文、英文环境重复账号得到英文错误提示）、用户 CRUD（空表单必填、手机号格式、新增→检索→删除，且删除确认框取消键为「取消」而非 `Cancel`）、装修编辑器（组件列表 4 项、预览渲染轮播、新增轮播后计数变 5、上移生效、改间距后保存草稿并刷新仍保留数值、选图后图片地址回填为 base64 且保存刷新仍在、发布后状态标签显示最近发布时间且刷新后仍在、新建页面后空白页可保存/切回首页/再切回/删除并自动回首页）。
  - 移动覆盖侧边栏不渲染 / 顶栏标题替面包屑、菜单按钮开抽屉且点菜单项后自动收起、用户列表渲染为卡片（`.table-cards` 且无 `.table-wrap`）、头像菜单收起昵称但仍可切深色。
  - 失败会留存 `test-results/` 下的截图、trace 与 `error-context.md`，`npm run test:e2e:report` 打开 HTML 报告。
  - 写用例要注意 uni-app 的几个坑：`getByPlaceholder` 对 uni H5 输入框无效（placeholder 是独立节点，统一用 `e2e/helpers.ts` 的 `field()`）；登录页默认预填 `admin/123456`，测「空值」要先 `fill('')`；`page.goto('#/...')` 不重建应用，登出必须 `reload()`（见 `resetApp()`）；`uni.showModal` 的按钮文案来自调用方 `confirmText`，不是统一的「确定」。

## 页面装修（一期）

- 入口：侧边栏「小程序运营 → 页面装修」，页面路径 `/pages/operation/deco/index`，权限码 `operation:deco:edit`，按钮另有 `operation:deco:save` / `operation:deco:publish`。
- 三栏布局：左侧组件列表（新增、拖拽排序、上移/下移、删除），中间 375px 手机预览，右侧属性面板（间距、高度、圆角、文案、图片地址、商品价格、跳转路径等），底部是页面标题与主色。桌面端按住组件左侧手柄拖动即可调整顺序，拖动时显示插入位置提示；小程序管理端保留上移/下移作为兜底。
- 组件注册表：`packages/deco/src/registry.ts` 是组件的唯一元数据源，登记新增按钮文案、默认值、属性字段、列表项字段、摘要和校验规则。后台新增按钮、属性面板、列表摘要与 `validateDecoPage()` 都读这份定义；属性面板按字段类型自动渲染文本、多行文本、数字、图片、下拉和列表（列表支持增删、上下移）。新增组件时先登记定义，再为后台预览和小程序端补对应渲染块。
- 预览与小程序端共用 `packages/deco` 的 `DecoRenderer`，改一处两端同时生效。发布前会跑 `validateDecoPage()`，脏数据（版本不对、id 重复、组件缺必填项、数字越界）直接拦下并提示具体原因。
- 多页面：顶部「装修页面」下拉可切换、新建、删除页面（首页由第一个页面固定担任、不允许删除，最多 20 个）。每页有独立的草稿与已发布数据，互不影响；新页面从空白开始，标题改完保存即同步到下拉。
- 复制与模板复用：页面栏可「复制当前页」（默认标题加「副本」，组件与图片整体带过去，最多 20 个页面）、「存为模板」（快照存进模板库，最多 20 个）、打开「模板库」用已有模板新建页面或删除模板。首次打开模板库会种入一个内置「电商首页模板」（`tpl-demo`），可直接拿来起新页。
- 版本回滚：每次发布前把当前已发布页压进该页历史（最多保留 10 版），页面栏「版本历史」列出标题与发布时间；点「回滚」把选中版本当新发布写回草稿与线上，同时把回滚前的版本继续留档，历史不丢。
- 草稿与发布走 Mock 接口（契约与真实后端一致）：`GET /deco/pages`（列表，含 `isHome` / `path` / 时间戳）、`POST /deco/pages`（新建）、`POST /deco/pages/:id/copy`（复制，body 可带 `title`）、`DELETE /deco/pages/:id`、`GET|PUT /deco/pages/:id/draft`（草稿）、`PUT /deco/pages/:id/publish`（发布）、`GET /deco/pages/:id`（C 端读某页）、`GET /deco/pages/:id/versions`（历史摘要）、`POST /deco/pages/:id/versions/:versionId/rollback`（回滚）、`GET|POST /deco/templates`（模板列表/存模板）、`DELETE /deco/templates/:id`、`POST /deco/templates/:id/use`（用模板建页，body 可带 `title`）、`GET|PUT /deco/home`（首页快捷读写）。Mock 实现落在 `src/mock/handlers/deco.ts`，数据存 `BTN_deco_pages` / `BTN_deco_templates`（`BTN_deco_pages_version` 当前为 2，老数据会自动补 `versions: []`）；老的单页键 `deco_home_draft` / `deco_home_published` 会一次性迁移成首页记录。
- 小程序端 `apps/mp/src/api/deco.ts`：默认 `GET /deco/home`；首页支持 `?pageId=xxx` 时改读 `GET /deco/pages/:id`。后端可用且存在多个页面时，首页左下角出现「装修页面」入口，点开可切换其他已发布页面。`apps/mp/.env` 的 `VITE_API_BASE` 为空时用内置示例（`packages/deco` 的 `createDemoPage()`），填了地址就拉后台发布的页面，校验不过或请求失败也回落示例，保证页面永远能渲染。
- 图片上传：属性面板的图片字段（轮播图、商品图）支持「选择图片 / 更换 / 移除」，也可继续手贴外部图片地址。前端把图读成 base64 后走 `POST /upload`，Mock 返回同一个 data URL（`inline: true`），单图上限 600KB；真实后端把这里换成 OSS 上传并返回 CDN 地址即可，协议与渲染器不用动。
- 一期边界：支持拖拽排序、上下移、增删、改属性，不做画布自由拖拽；内置轮播、公告、宫格导航、商品列表 4 种组件，组件元数据可继续在注册表扩展，但每个新组件仍需补后台预览块与小程序渲染块。页面之间通过「复制页面 / 存为模板」复用，不设自定义首页以外的入口页策略。图片在演示环境是 base64 内联，多张大图会顶到 localStorage 容量上限；Mock 数据只存在当前浏览器（含版本历史与模板），真机要看到后台发布的内容必须配置真实后端。

### 多小程序共用（多租户）

一套后台、一个后端维护多个微信小程序应用。每个应用有独立的页面、模板、草稿、发布历史和发布状态；小程序端只读取自己应用的数据，互不串页。

- **应用标识**：每个应用有一个不可变的 `tenantId`，规则 `^[a-z0-9][a-z0-9-]{1,31}$`。默认应用为 `btn-mall`（图鸟商城，AppID `wx4cd3b6ba323e40ea`）。
- **数据模型**：`apps/api/data/deco.json` 为 `{ version: 2, defaultTenantId, tenants: [{ id, name, appId, createdAt, members, pages, templates }] }`。`members` 是可管理该应用的装修账号，`admin` 作为超级管理员自动拥有全部应用；老数据首次启动会自动补上成员字段。
- **租户选择**：所有 `/deco/*` 请求通过请求头 `X-Deco-Tenant: <tenantId>` 选择应用，未带时回落默认应用，旧小程序和旧调用不用改。未知应用返回 404。C 端公开接口同样按该请求头只返回对应应用的已发布数据。
- **应用级权限**：登录用户只能看到自己有权管理的应用；切到未授权应用时，页面、草稿、模板、版本和上传接口统一返回 403。`admin` 可切换所有应用；`chenmo` 默认只被授权「图鸟商城」；`zhouye` 没有装修权限。公开的 `/deco/home`、`/deco/published`、`/deco/pages/:id` 仍不要求登录，只返回已发布数据。
- **后台入口**：页面装修顶部新增「小程序应用」卡片，可下拉切换、查看 AppID、新增、编辑或删除应用。超级管理员可在「编辑应用」弹窗里维护「可管理账号」；普通装修账号只看到已授权应用，且不显示应用增删改入口。应用标识创建后不可修改，名称和 AppID 可以改；新增时标识留空会自动生成 `app-<timestamp>`。切换应用会重新加载该应用的页面、模板与版本；如果当前页有未保存草稿，会先弹窗确认「放弃并切换」。删除只对非默认应用开放，会同时删除该应用的页面、模板、版本、发布状态和上传图片，需二次确认。
- **租户接口**：`GET /deco/tenants`（登录即可，按权限过滤，返回 `{ defaultTenantId, canManage, tenants }`）、`GET /deco/accounts`（`admin`，可分配成员账号）、`POST /deco/tenants`（`admin`，body `{ id?, name, appId, members? }`）、`PUT /deco/tenants/:id`（`admin`，body `{ name, appId, members? }`）、`DELETE /deco/tenants/:id`（`admin`，默认应用不可删）。AppID 规则 `^wx[a-z0-9]{16}$`，重复标识或重复 AppID 返回 409。
- **小程序端**：`apps/mp/.env` 的 `VITE_DECO_TENANT` 决定读哪个应用，`apps/mp/src/utils/request.ts` 会自动带上 `X-Deco-Tenant`。一个小程序对应一份 `.env` + `manifest.json` 的 AppID，构建前切换：

```bash
# 根目录执行：应用标识 AppID [后端地址]
npm run mp:tenant -- mall-xz wx1234567890abcdef http://192.168.1.20:3001

# 然后照常构建，产物仍是 apps/mp/dist/build/mp-weixin
npm run build:mp
```

`mp:tenant` 会同步改写 `apps/mp/.env` 的 `VITE_DECO_TENANT`（传了第三个参数时也改 `VITE_API_BASE`）和 `apps/mp/src/manifest.json` 的微信 AppID。每发布一个新小程序，就在后台新增一个应用，拿到它的 AppID，再用该脚本切换并构建；不要把不同小程序的产物混用同一个 AppID。

- **边界**：应用级权限已覆盖后台与后端，但账号仍是演示用静态账号，成员在应用编辑弹窗里维护；面向不同客户交付时，还需要接入真实用户体系、按客户拆分域名/登录品牌，并补发布审计与素材治理。

### 装修真实后端（apps/api）

`apps/api` 是一个零依赖的 Node HTTP 服务，接口路径、响应结构（`{ code, msg, data }`）与后台 Mock 完全一致：

- 数据落盘：`apps/api/data/deco.json`，v2 结构按应用存放页面与模板；首次启动自动种入默认应用「图鸟商城」及其首页与「电商首页模板」，老单应用数据自动迁移
- 图片落盘：`apps/api/uploads/<tenantId>/`，通过 `GET /uploads/<tenantId>/<file>` 访问，上传接口为 `POST /upload`（仍收 base64，服务端转文件；按 `X-Deco-Tenant` 分应用存目录）
- 多应用：管理端接口默认按 `X-Deco-Tenant` 读写对应应用，缺省回落默认应用；应用列表会按登录账号的应用授权过滤，未授权应用的管理接口返回 403
- 管理端接口：页面列表/新建/复制/删除、草稿读写、发布、版本历史与回滚、模板 CRUD 与套用、上传；全部要求 `Authorization: Bearer <token>`，并校验当前账号是否被授权该应用
- C 端公开接口：`GET /deco/home`、`GET /deco/published`（只返回已发布页面）、`GET /deco/pages/:id`（只返回已发布数据）；均按 `X-Deco-Tenant` 返回对应应用
- 鉴权：`POST /auth/deco-login` 用后台演示账号换 token；`admin`（密码 `123456`）是超级管理员，`chenmo` 可装修但只默认拥有 `btn-mall`，`zhouye` 无装修权限；token 为 HMAC 签名，默认 8 小时过期；后台登录成功后会自动换一个装修 token。token 只证明登录身份，应用授权由服务端按账号实时判定
- 冒烟：`npm run smoke:api`，使用临时目录与 3101 端口，覆盖应用创建、权限过滤、未授权 403、成员授权/撤销、上传隔离与默认应用兼容，不污染正式数据
- 启动：`npm run dev:api`（3001 端口，`PORT` / `HOST` 可覆盖，`DECO_TOKEN_SECRET` 可换签名密钥；`DECO_DEFAULT_TENANT` / `DECO_DEFAULT_TENANT_NAME` / `DECO_DEFAULT_APP_ID` 可改默认应用）

后台切换真实后端（只影响装修与上传，登录等仍走 Mock）：

```bash
# apps/admin/.env
VITE_DECO_API_BASE=http://localhost:3001
```

留空时继续走内置 Mock，所以单测/E2E 不需要启动后端。小程序端 `apps/mp/.env`：

```bash
# apps/mp/.env
VITE_API_BASE=http://localhost:3001
VITE_DECO_TENANT=btn-mall
```

`VITE_DECO_TENANT` 对应后台应用标识；换小程序时用 `npm run mp:tenant -- <应用标识> <AppID> [后端地址]` 一次改好租户与 AppID。微信开发者工具需勾选「不校验合法域名」；真机调试把 `VITE_API_BASE` 改成电脑局域网 IP（手机与电脑同一网络），正式发布必须换 HTTPS 域名并在小程序后台配置 request 合法域名。

当前后端的边界：鉴权账号仍是演示账号、密码明文写在服务端；JSON 存储与本地图片只适合开发。生产环境要换数据库和真实账号体系、上传换 OSS/CDN，并上 HTTPS。

## 目录结构（apps/admin）

```
apps/admin/src/
├── api/                 各模块接口（auth/user/role/menu/dept/dict/log/dashboard）
├── components/
│   ├── layout/          AppLayout（外壳）、SideMenu（菜单）
│   └── ui/              AppButton / AppTable / AppDialog / AppSelect 等基础控件
├── config/index.ts      appName、baseURL、useMock、tokenKey、分页大小、断点
├── config/routes.ts     已注册页面清单（菜单路径校验的唯一来源）
├── hooks/               useTableList（分页搜索）、useCrudForm（新增/编辑弹窗）
├── locales/             i18n：index（实例与读写）、zh-CN、en-US
├── mock/                adapter、db、seed 数据、i18n（业务数据英文层）、各模块 handler
├── pages/
│   ├── login/index.vue  登录（桌面左右分栏 / 移动单列）
│   ├── home/index.vue   工作台（KPI、7 日趋势、快捷入口、最近日志）
│   ├── operation/deco/  页面装修编辑器（组件列表 + 预览 + 属性面板）
│   └── system/          user / role / menu / dept / dict / log
├── store/               pinia：app（响应式与侧边栏）、user（登录态与权限）
├── styles/              tokens（设计令牌）、themes（明暗与品牌色）、base（重置与工具类）、icon-font（图标字体）、index
├── static/fonts/        tuniao-icon.woff（本地图标字体，离线可用）
├── utils/               request、storage、tree、format、navigate、permission、validate（表单规则）、dialog（删除确认）
├── types/http.ts        ApiResponse / PageQuery / PageResult
├── App.vue              引入全局样式，onLaunch 初始化响应式
├── main.ts              注册 pinia 与全部 App* 控件
├── pages.json           9 个页面 + easycom 规则 + 自定义导航栏
```

`utils/validate.ts`、`utils/tree.ts`、`utils/format.ts`、`types/http.ts` 的实现已迁到 `packages/shared`，这里只留一行转发，页面与单测的 import 路径不变。

测试与工具配置在 `apps/admin` 下（仓库根不放应用配置）：

```
apps/admin/e2e/          Playwright 用例：auth / permission / theme / user-crud / deco / mobile + helpers
apps/admin/playwright.config.ts  E2E 配置（复用本机 Chrome、自动拉起 dev server、失败留存 trace）
apps/admin/vitest.config.ts      单元测试配置
.github/workflows/ci.yml         流水线：静态检查 / 单测 / 两端构建 + 端到端测试
```

小程序端目前是首页骨架 + 装修渲染 + 多页面切换：

```
apps/mp/src/
├── App.vue / main.ts     应用入口
├── manifest.json         mp-weixin appid，默认图鸟商城，构建其他小程序前用 mp:tenant 切换
├── pages.json            只有 pages/home/index 一个页面
├── pages/home/index.vue  首页：拉取 /deco/home 或指定页，多页时显示「装修页面」切换入口
└── deco/                 构建前由 packages/deco 同步生成（gitignore，勿手改）
```

装修一期组件集：`banner`（轮播）、`notice`（公告）、`nav`（宫格导航）、`goods`（商品列表）。协议类型在 `packages/deco/src/schema.ts`，组件元数据与默认值在 `registry.ts`，`validateDecoPage()` 在渲染前做运行期校验（版本号、id 唯一、各组件必填项、列表长度与数字范围）。

**一个小程序端的编译限制**：`mp-weixin` 编译器不接受 `src` 之外的 `.vue`，直接 import `@btn/deco` 的渲染器会生成 `../node-modules/...` 这种非法 chunk 名并构建失败。所以渲染器只在 `packages/deco` 维护一份，`apps/mp` 的 `predev:mp` / `prebuild:mp` / `pretype-check` 会先跑 `scripts/sync-deco.mjs` 拷到 `apps/mp/src/deco`。改渲染器只改 `packages/deco`，重跑构建即可。后台端（H5）没有这个限制，可以直接 `import { DecoRenderer } from '@btn/deco'`。

## 接入真实后端

1. 改 `.env`：

```ini
VITE_USE_MOCK=false
VITE_API_BASE=https://your-api.example.com
```

2. 后端按 `src/api/types.ts` 里的结构返回，统一格式：

```json
{ "code": 0, "message": "ok", "data": {} }
```

分页接口的 `data` 为 `{ list, total, pageNum, pageSize }`；登录接口返回 `{ token, profile }`，`profile` 里含 `menus`（树）与 `perms`（按钮权限码数组）。
码值不一致时只需改 `code` 判定（`src/utils/request.ts`）与 401 处理分支，页面无需改动。

## 扩展一个新模块

1. 在 `src/api` 加接口文件，`src/mock/handlers` 加对应 handler 并在 `src/mock/index.ts` 引入（走真实接口时忽略这步）。
2. 在 `src/pages` 下新建页面，用 `AppLayout` 包裹，列表页直接用 `useTableList` + `AppTable`（桌面表格 / 移动卡片自动切换）。
3. 在 `src/pages.json` 的 `pages` 里注册路径（**必须与菜单数据的 `path` 一致**），同时把路径补进 `src/config/routes.ts` 的 `REGISTERED_PAGES`，否则菜单表单会报「未在 pages.json 注册」。
4. 在 `src/mock/data.ts` 的菜单种子中加目录与按钮权限，前端即可按角色看到入口。

## 约定

- 新控件放 `src/components/ui/`，命名 `App*`，并在 `src/main.ts` 全局注册，页面里无需 import。
- 颜色、圆角、字号一律取 `var(--app-*)` 令牌，不要写死色值。
- 页面必须用 `AppLayout` 包裹才能拿到侧边栏、面包屑与权限校验。
