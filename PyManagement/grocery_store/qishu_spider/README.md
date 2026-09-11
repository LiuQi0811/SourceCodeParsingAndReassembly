# 奇书电子书下载网（www.7shutxt.com）全站爬虫

## 逆向分析说明

经过对目标站点的完整逆向分析，结论如下：

1. **站点架构**：帝国CMS（EmpireCMS）二次开发的 TXT 小说下载站，共 14 个主分类（穿越/重生/历史/言情/总裁/仙侠/同人/网游/耽美/玄幻/都市/军事/悬疑/名著），总计约 1.5 万本小说。

2. **URL 结构**：
   - 列表页：`/list.php?classid={cid}&orderby=0&page={p}`（page 从 0 开始）
   - 详情页：`/article-{cid}-{id}.html`
   - 下载列表：`/download-{cid}-{id}.html`（需 Referer 校验）
   - 文件直链：`/e/DownSys/doaction.php?enews=DownSoft&classid={cid}&id={id}&pathid=0&pass={md5}&p=::::::`（TXT）
                  `/e/DownSys/GetDown/?classid={cid}&id={id}&pathid=1&pass={md5}&p=::::::`（RAR 压缩包）
   - 部分书为夸克网盘链接：`https://pan.quark.cn/s/...`

3. **加密/反爬情况（结论：**无 JS 加密，反爬较轻）**：
   - ✅ **无需 JS 解密**：所有下载链接直接写在 HTML 里（CMS 直链 `<a href>` 直接输出，网盘链接亦然）。`pass` 参数是帝国CMS标准MD5校验串，**无需本地计算**，从HTML中正则提取即可。
   - ✅ **访问 doaction.php 直接返回文件流**（`Content-Disposition: attachment`），无二次跳转、无JS混淆、无Base64。
   - ⚠️ **Referer 校验**：`download-*-*.html` 页面和文件直链都校验 Referer 头，必须从上级页面带过来。
   - ⚠️ **频率限制**：请求过快（<1秒）时服务器会返回 `<script>window.location.href="/";</script>` 跳回首页，脚本已实现自动冷却 + 重试。
   - ⚠️ **无验证码、无登录墙、无Cookie强制校验、无字体反爬**。

4. **文件编码**：站内 TXT 多为 GBK/GB18030 编码，脚本自动检测并转换为 UTF-8。

## 目录结构

```
qishu_spider/
├── qishu_spider.py        # 主爬虫脚本
├── requirements.txt       # Python 依赖
├── README.md              # 本说明
├── downloads/             # 下载的小说文件（按分类分目录，自动创建）
│   ├── 穿越小说/
│   ├── 修真仙侠幻想/
│   └── ...
├── data/
│   ├── meta.jsonl         # 每本书一行JSON元数据（标题/作者/大小/更新时间/网盘链接等）
│   └── visited.json       # 已完成的书ID（断点续爬/增量抓取用）
└── logs/
    └── spider.log         # 运行日志
```

## 安装

```bash
pip install -r requirements.txt
```

## 使用

```bash
# 1) 全站全量下载（TXT + RAR）
python3 qishu_spider.py

# 2) 只抓某一分类（例如穿越小说 cid=2）
python3 qishu_spider.py --cid 2

# 3) 只下载 TXT 版本（推荐，RAR 是压缩包但内容一样）
python3 qishu_spider.py --txt-only

# 4) 调试：每个分类只抓前 3 页
python3 qishu_spider.py --max-pages 3 --txt-only

# 5) 只要元数据，不下载文件（网盘链接会完整记录在 meta.jsonl 中）
python3 qishu_spider.py --no-download

# 6) 调整并发（建议 1~3，过高会被临时封IP）
python3 qishu_spider.py --workers 2 --txt-only
```

### 分类对照表

| cid | 分类名           |   | cid | 分类名               |
|-----|------------------|---|-----|----------------------|
| 2   | 穿越小说         |   | 10  | 耽于纯美小说         |
| 3   | 重生小说         |   | 11  | 玄幻小说             |
| 4   | 历史架空古装     |   | 12  | 都市异能娱乐爽文     |
| 5   | 青春校园现言     |   | 13  | 历史架空铁血军旅     |
| 6   | 豪门总裁小说     |   | 14  | 恐怖惊悚悬疑推理     |
| 7   | 修真仙侠幻想     |   | 15  | 古今中外文学名著     |
| 8   | 衍生同人小说     |   |     |                      |
| 9   | 网游小说         |   |     |                      |

## 输出字段说明

`meta.jsonl` 每行是一个 JSON 对象：

```json
{
  "cid": 7,
  "id": 1318,
  "category": "修真仙侠幻想",
  "title": "她怎么可以不爱我",
  "author": "答鸽兔",
  "size": "412 KB",
  "update_time": "2025-05-12 22:02:53",
  "cover": "https://www.7shutxt.com/uploads/images/20250512/xxx.jpg",
  "detail_url": "https://www.7shutxt.com/article-7-1318.html",
  "download_page_url": "https://www.7shutxt.com/download-7-1318.html",
  "downloads": [
    {"type": "cms",  "url": "https://.../e/DownSys/doaction.php?...", "label": "TXT电子书下载地址"},
    {"type": "cms",  "url": "https://.../e/DownSys/GetDown/?...",     "label": "RAR压缩包下载地址"},
    {"type": "quark","url": "https://pan.quark.cn/s/...",             "label": "夸克网盘安全下载"}
  ],
  "saved_files": ["/abs/path/to/她怎么可以不爱我_答鸽兔.txt"]
}
```

- `type=cms` 表示可直接下载的直链，脚本已自动下载。
- `type=quark/baidu/aliyun/lanzou/189/123pan` 等为网盘链接（需客户端/登录），脚本不自动下载，仅记录URL。

## 断点续爬

脚本会把已完成的 `(cid, id)` 写入 `data/visited.json`，下次运行自动跳过。
如需重新抓取，加 `--fresh` 参数或删除 `data/visited.json`。

## 合理使用声明

本脚本仅供个人离线备份已授权的电子书资源学习使用，请遵守著作权法与站点robots规则，
不要对站点造成过大压力（建议 `--workers 1` 低速运行），下载后请于24小时内删除。
