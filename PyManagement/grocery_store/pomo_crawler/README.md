# pomo.mom 全站爬虫使用说明

## 逆向分析结论

经完整前端逆向分析，**pomo.mom 无任何下载链接加密**：

1. **磁力链接**：直接写在 HTML 的 `<a data-url="magnet:?xt=urn:btih:...">` 属性中，完全明文。
2. **夸克网盘链接**：由 JS 通过 `insertAdjacentHTML` 动态插入到播放按钮旁，URL 以转义字符串形式存在于页面源码中（如 `href=\"https://pan.quark.cn/s/xxxxx\"`），**无加密、无签名、无 token 校验**，正则提取即可还原。
3. **列表/分页**：纯静态HTML，分页路径为 `/page/N`（分类下为 `/{cat}/page/N`），无 AJAX 瀑布流加密。
4. **影片详情页**：路径 `/数字ID`，无 ID 加密。

**结论：零解密成本，完美还原全部下载链接。**

## 环境要求

- Python 3.8+
- 依赖：`requests`、`beautifulsoup4`

```bash
pip install requests beautifulsoup4
```

## 使用方法

### 1. 快速测试（只抓首页前2页）

```bash
python pomo_crawler.py --only-home --pages 2 --delay 1
```

### 2. 抓取全站（推荐）

```bash
python pomo_crawler.py --delay 1.0 --workers 8
```

全站共约 223 页首页 + 7 个分类（华语热门/家庭影院/动画/冷门佳片/TOP250/蓝光原盘/剧集），
预计影片数 3000+ 部，运行时间约 30~60 分钟（取决于网络）。

### 3. 常用参数

| 参数 | 说明 | 默认 |
|------|------|------|
| `--pages N` | 每个分类只抓前 N 页（测试用） | 不设限（抓全部） |
| `--only-home` | 只抓首页列表，不抓其他分类 | 关闭 |
| `--delay N` | 请求间隔秒数（防封IP） | 1.0 |
| `--workers N` | 详情页并发线程数 | 8 |
| `--resume` | 断点续抓（上次中断位置继续） | 关闭 |

### 4. 断点续抓示例

中途断网/被封，使用 `--resume` 从上次进度继续：

```bash
python pomo_crawler.py --delay 1.5 --workers 6 --resume
```

## 输出文件

所有结果保存在 `pomo_output/` 目录：

| 文件 | 内容 |
|------|------|
| `pomo_all_movies.json` | 全量结构化数据（含标题、简介、封面、全部下载链接） |
| `pomo_download_links.csv` | 扁平表格（可用 Excel 打开，每行一条下载链接） |
| `pomo_magnets.txt` | 纯磁力链接合集（按影片分组，带注释名，可直接导入 qBittorrent/迅雷/比特彗星） |
| `pomo_quark.txt` | 夸克网盘链接合集（按影片分组） |
| `summary.json` | 抓取统计摘要 |

## 注意事项

1. **合理设置 delay**：建议 `--delay 1` 以上，过快会被站点封IP（返回403/503）。
2. **并发别太高**：`--workers` 建议 5~10，过高会触发反爬。
3. **4K资源体积大**：原盘文件通常 30GB~80GB/部，下载请自备夸克网盘会员或足够磁盘空间。
4. **尊重版权**：本工具仅用于技术学习，请遵守当地法律法规，支持正版。
