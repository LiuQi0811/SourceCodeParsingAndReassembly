# PublicIPTV.com 全站爬虫

## 逆向分析说明

| 项目 | 结论 |
|------|------|
| 网站框架 | Next.js App Router + Turbopack (React Server Components) |
| 渲染方式 | SSR 服务端渲染，所有数据明文嵌入 HTML |
| 加密 | ❌ **无加密**，无 token、无签名、无 JS 混淆解密 |
| 流数据位置 | `/channels/{id}` 页面 SSR HTML 中的 `"streams":[...]` JSON |
| 关键逆向点 | RSC Flight 二进制协议使用 **T439 HashedString** 类型，长字符串以 ID 引用 (`"$15"`)，需要构建字符串引用表解析。含 JWT token 的超长 URL 会被 RSC 分块传输切割到多个 `<script>` 标签之间，必须拼接所有 chunk 后再解析（参见代码中 `build_rsc_string_table` 函数）。 |
| 分页 | `/countries/{code}?page=N`，每页约 36 个频道 |
| 国家数量 | 231 个国家/地区 |
| 反爬 | 仅 Cloudflare 基础防护，标准 UA + 合理延迟即可稳定抓取 |

## 快速开始

```bash
# 安装依赖
pip install requests

# 测试：只抓美国第1页（约36个频道，耗时约15秒）
python3 publiciptv_crawler.py --country us --pages 1

# 抓取单个国家全部频道
python3 publiciptv_crawler.py --country us

# 全量抓取全站（231国，预计数万频道，建议用 --resume 断点续爬）
python3 publiciptv_crawler.py --concurrency 5 --delay 0.3 --resume

# 断点续爬（中断后重新运行加 --resume）
python3 publiciptv_crawler.py --resume --concurrency 5
```

## 参数说明

| 参数 | 说明 | 默认 |
|------|------|------|
| `--country/-c` | 只抓取指定国家代码（us/cn/jp/uk 等） | 全部国家 |
| `--pages/-p` | 每个国家最大页数（测试用） | 全部页 |
| `--concurrency/-t` | 并发线程数 | 3 |
| `--delay/-d` | 请求间隔秒数 | 0.4 |
| `--resume/-r` | 断点续爬（从上次中断处继续） | 关闭 |
| `--no-cache` | 禁用本地页面缓存 | 使用缓存 |

## 输出文件

所有输出在 `output/` 目录：

| 文件 | 说明 |
|------|------|
| `channels.json` | 完整频道数据（JSON格式），包含所有频道元数据和流地址 |
| `publiciptv_best.m3u` | 最佳播放列表（每频道取第一个可用流） |
| `publiciptv_all_streams.m3u` | 全源流列表（每频道所有可用流） |
| `m3u_by_country/` | 按国家分目录的 M3U 文件（us.m3u, cn.m3u...） |
| `m3u_by_category/` | 按分类分目录的 M3U 文件（news.m3u, sports.m3u...） |
| `summary.json` | 抓取统计摘要 |
| `_progress.json` | 进度信息 |

## JSON 数据结构

```json
{
  "id": "foxnewschannelus",
  "name": "Fox News Channel",
  "country": "US",
  "categories": ["news"],
  "logo": "https://...svg.png",
  "updated_at": "2026-09-07T04:04:57.291Z",
  "description": "Watch Fox News Channel - news from US.",
  "network": "Fox Corporation",
  "website": "https://www.foxnews.com/",
  "url": "https://publiciptv.com/channels/foxnewschannelus",
  "streams": [
    {
      "url": "http://4.30.180.36:8420/foxnews/index.m3u8?token=test",
      "status_code": 200,
      "source": "iptvorg",
      "checking_count": 1,
      "redirect": null,
      "is_working": true
    }
  ],
  "stream_count": 5,
  "working_stream_count": 5
}
```

## 使用 M3U 播放列表

将生成的 `.m3u` 文件导入支持 M3U 的播放器即可观看：
- **VLC**：媒体 → 打开网络串流 → 粘贴 m3u8 URL 或打开 M3U 文件
- **Kodi**：安装 IPTV Simple Client 插件，加载 M3U 文件
- **Tivimate / IPTV Smarters**（Android）：导入 M3U URL
- **mpv**：`mpv --playlist=publiciptv_best.m3u`

## 注意事项

1. IPTV 流地址可能随时失效，本爬虫只负责抓取，不保证流长期可用
2. 建议设置合理的请求延迟（≥0.3s），避免对服务器造成压力
3. 全站抓取量很大（估计 20000+ 频道、10万+ 流地址），建议用 `--resume` 配合较高并发
4. 页面缓存在 `cache/` 目录，可随时删除不影响结果
