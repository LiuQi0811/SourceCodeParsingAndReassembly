# WMMFLIX (idyclub.com) 全站爬虫

## 逆向分析结论（重要）

经人工逆向分析，**该站点不存在 JS 加密、动态签名、滑块验证码或前端解密逻辑**：

| 项目 | 分析结果 |
|------|----------|
| 站点系统 | 基于 phpwind 论坛二次开发的影视资源站 |
| 页面渲染 | **服务端渲染 (SSR)**，HTML 直接包含所有数据 |
| 列表页 URL | `https://www.idyclub.com/thread-{fid}-{page}` |
| 详情页 URL | `https://www.idyclub.com/read-{tid}` |
| 反爬强度 | ⭐ 低（无 WAF 强拦截，仅需控制请求频率）|
| JS 加密 | ❌ 无（无需扣代码、无需还原混淆）|
| 动态签名 | ❌ 无（没有 `_signature`/`token`/时间戳校验）|
| 滑块验证码 | ❌ 无 |
| 下载链接隐藏 | 新帖/热门帖服务端对游客返回 `javascript:alert(...)`，登录后直接返回真实 URL（不是前端解密！本质是 Cookie 鉴权）|

**所谓"逆向解密"的本质**：带上有效登录 Cookie 即可，不需要任何前端逆向。

---

## 功能特性

- ✅ 遍历全部主板块 + 子板块（电影/剧集/综艺/动漫/交流，共 **23 个板块**）
- ✅ 自动探测每个板块的总页数
- ✅ 抓全部影片元信息：标题、年份、导演、编剧、主演、类型、国家、语言、上映日期、片长、又名、IMDb、豆瓣ID、豆瓣评分、剧情简介
- ✅ 抓全部下载链接：夸克网盘 / 百度网盘 / 迅雷云盘 / UC网盘 / 115网盘 / 磁力BT / 其他
- ✅ 自动下载海报封面图
- ✅ **断点续爬**（已完成的帖子/页面自动跳过，中断后可随时继续）
- ✅ 结果导出为 **JSON + CSV** 双格式（CSV 可用 Excel 直接打开）
- ✅ 内置礼貌爬取延迟 + 多线程并发 + 403 自动重试
- ✅ 游客模式即可抓公开元数据 + 部分开放资源；传 Cookie 可解锁全部隐藏链接

---

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 游客模式运行（无需登录，直接可用）

```bash
python idy_crawler.py
```

这将抓取全站所有影片的公开信息和直接开放的下载链接。

### 3. 调试模式（每个板块只抓前 3 页，快速验证）

```bash
python idy_crawler.py --max-pages 3 --workers 2
```

### 4. 登录模式（抓全部隐藏下载链接）

1. 在 Chrome/Edge 浏览器打开 https://www.idyclub.com/ 并登录
2. 按 `F12` 打开 DevTools → `Application`（应用）→ `Cookies` → `https://www.idyclub.com/`
3. 把所有 cookie 复制成 `key=value; key2=value2` 格式（或在 Network 面板随便找一个请求，复制 Request Headers 里的 Cookie 值）
4. 运行：

```bash
python idy_crawler.py --cookie "你的完整cookie字符串"
```

### 5. 不下载海报（提速）

```bash
python idy_crawler.py --no-posters
```

---

## 命令行参数

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `--cookie` | 空 | 浏览器 Cookie 字符串，用于解锁登录可见资源 |
| `--max-pages` | 0（全部） | 每个板块最多抓多少页，调试用 |
| `--workers` | 3 | 详情页并发线程数（建议 2~5，过高容易触发风控）|
| `--no-posters` | False | 加此参数则不下载海报图片 |

---

## 输出目录结构

```
output/
├── data/
│   ├── movies.json       # 完整结构化数据（推荐二次处理用）
│   ├── movies.csv        # 表格版（Excel 可直接打开）
│   └── progress.json     # 断点续爬进度文件（不要手动删）
├── posters/              # 海报封面图（以 tid 命名）
│   ├── 83371068.jpg
│   └── ...
└── README_抓取结果.txt   # 本次抓取汇总报告
```

---

## 数据字段说明

`movies.json` 中每条记录字段如下：

| 字段 | 说明 |
|------|------|
| `tid` | 帖子ID（唯一标识）|
| `url` | 详情页地址 |
| `title` | 影片中文名 |
| `year` | 年份 |
| `poster` | 海报原始URL |
| `poster_local` | 海报本地路径（下载后才有）|
| `director` | 导演 |
| `writer` | 编剧 |
| `actors` | 主演 |
| `genre` | 类型 |
| `country` | 制片国家/地区 |
| `language` | 语言 |
| `release_date` | 上映日期 |
| `runtime` | 片长 |
| `aka` | 又名 |
| `imdb` | IMDb 编号 |
| `douban` | 豆瓣 subject ID |
| `douban_rating` | 豆瓣评分 |
| `summary` | 剧情简介 |
| `download_links` | 下载链接数组，每项含 `type/title/uploader/date/link/hidden` |

---

## 断点续爬说明

- 程序会在 `output/data/progress.json` 中记录已完成的列表页和帖子ID
- 中断后（Ctrl+C、报错、网络问题）直接重新运行同样的命令即可
- 已完成的部分会自动跳过，不会重复请求
- **如需从头抓**：删除 `output/` 目录即可

---

## 常见问题

**Q: 下载链接是空的 / 显示 hidden=true？**
A: 新资源/热门资源对游客隐藏。用 `--cookie` 参数传入登录 Cookie 即可抓真实链接。

**Q: 出现 403 错误怎么办？**
A: 程序会自动等待重试。若持续 403，可：
   1. 降低 `--workers` 到 1 或 2
   2. 暂停一段时间再运行（断点续爬）
   3. 换 IP 或用浏览器登录后复制新 Cookie

**Q: 会被封号吗？**
A: 代码内置 0.8~2s 随机延迟，默认 3 线程，属于"礼貌爬取"强度。建议控制在 5 线程以内。

---

## 逆向验证方法（可自行复核）

1. 浏览器禁用 JS（DevTools → Settings → Disable JavaScript），刷新页面
2. 页面所有内容（标题、信息、列表）均正常显示 → **证明是纯 SSR，无 JS 渲染依赖**
3. 查看详情页 HTML 源码，直接搜索网盘链接关键词（`pan.quark.cn`等）→
   - 游客模式搜不到 → 服务端不给
   - 登录后能搜到 → 服务端根据 Cookie 决定是否输出
4. **结论：没有前端解密、没有动态接口、没有签名算法，只需 HTTP 请求 + 正确 Cookie**
