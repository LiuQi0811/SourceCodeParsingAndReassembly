# SeedHub 全站爬虫使用说明

## 逆向结论 ✅

**该网站无任何JavaScript加密！**

- 真实网盘链接直接存储在跳转页面的 `var panLink = "xxx"` 变量中
- 无需解密、无需执行JS、无需逆向算法，直接正则提取即可
- 所有网盘链接（夸克、百度、迅雷、UC、阿里）均为明文
- 提取码也直接在URL参数中（?pwd=xxxx）

## 文件说明

| 文件 | 说明 |
|------|------|
| `seedhub_crawler.py` | 主爬虫程序 |
| `test_crawler.py` | 功能测试脚本 |
| `README.md` | 本说明文档 |

## 快速开始

### 1. 安装依赖
```bash
pip install requests beautifulsoup4 tqdm
```

### 2. 运行爬虫
```bash
# 开始全站爬取（支持断点续爬，中断后再次运行即可继续）
python seedhub_crawler.py

# 仅导出CSV和Markdown（不爬取新内容）
python seedhub_crawler.py export

# 仅下载影片封面图片
python seedhub_crawler.py covers
```

### 3. 测试功能
```bash
python test_crawler.py
```

## 爬虫特性

### 🕷️ 爬取范围
- ✅ 电影、动漫、剧集三大分类
- ✅ 所有列表分页自动遍历
- ✅ 影片详情页全部元数据
- ✅ 所有网盘资源链接（夸克/百度/迅雷/UC/阿里云盘）
- ✅ 磁力链接
- ✅ 海报封面图
- ✅ 剧情截图

### 🛡️ 反爬策略
- ✅ 随机User-Agent轮换
- ✅ 请求随机延迟（0.5-1.5秒）
- ✅ 失败自动重试（最多3次）
- ✅ 自动记录已访问URL
- ✅ 支持断点续爬（随时Ctrl+C中断，下次继续）

### 📊 导出格式
- **JSON**: 完整结构化数据（`seedhub_data/movies.json`）
- **CSV**: 可直接用Excel打开（`seedhub_data/seedhub_movies.csv`）
- **Markdown**: 带链接的索引文档，方便浏览（`seedhub_data/seedhub_index.md`）
- **HTML原始页面**: 保存详情页源码用于离线查看（`seedhub_data/pages/`）
- **封面图片**: 可选下载海报到本地（`seedhub_data/images/covers/`）

## 数据字段说明

```json
{
  "id": "126710",           // 影片ID
  "title": "抓特务",         // 中文标题
  "rating": "7.4",          // 豆瓣评分
  "year": "2026",           // 上映年份
  "genres": ["剧情", "悬疑"], // 类型
  "directors": ["冯小刚"],   // 导演
  "actors": ["雷佳音", "胡歌"], // 演员
  "cover": "https://...",   // 封面图URL
  "description": "...",     // 剧情简介
  "pan_links": [            // 网盘链接列表
    {
      "title": "资源名称",
      "url": "https://pan.quark.cn/s/xxxxxx",
      "type": "夸克网盘",
      "pwd": "abcd"         // 提取码（如果有）
    }
  ],
  "images": [],             // 剧情截图
  "url": "https://...",     // 详情页URL
  "crawl_time": "2026-..."  // 爬取时间
}
```

## 支持的网盘类型

- 🔵 夸克网盘 (`pan.quark.cn`)
- 🔴 百度网盘 (`pan.baidu.com`)
- 🟡 迅雷网盘 (`pan.xunlei.com`)
- 🟢 UC网盘 (`drive.uc.cn`)
- 🟣 阿里云盘 (`alipan.com` / `aliyundrive.com`)
- 🧲 磁力链接 (`magnet:?xt=urn:btih:...`)

## 注意事项

1. **合理使用**: 爬取速度已做限制，请勿修改延迟导致对方服务器压力过大
2. **版权说明**: 本工具仅用于技术学习，请支持正版影视资源
3. **增量更新**: 定期运行爬虫即可抓取最新更新的影片
4. **数据位置**: 所有数据保存在 `seedhub_data/` 目录下
5. **断点续爬**: 看到想要的影片数量已足够可以随时Ctrl+C停止

## 逆向过程说明

1. 首页检查：VuePress静态站点，服务端渲染
2. 详情页检查：链接指向 `/link_start/?redirect_to=pan_id_xxxxx`
3. 跳转页源码分析：直接找到 `<script>` 中定义的全局变量
4. **关键发现**: `var panLink = "https://pan.quark.cn/s/7fae5ad911d3"`
5. 结论：无混淆、无加密、无签名、无动态生成，纯明文！

逆向难度：⭐（完全没有加密，直接查看源码就能看到真实链接）
