# 动漫啦 (dongman.la) 全站爬虫工具

## 逆向分析结果

经过对 https://www.dongman.la/ 网站的完整分析，得出以下结论：

### ✅ 无复杂加密，无需逆向解密

1. **图片URL直接暴露在HTML源码中** - 使用 `data-src` 属性存储真实图片地址
2. **无JavaScript动态加密** - 仅使用了简单的IntersectionObserver懒加载
3. **图片CDN地址公开可访问** - `https://img.dongman.la/` 无防盗链或签名验证
4. **URL结构完全规律化**
    - 漫画详情页：`/manhua/detail/{comic_id}/`
    - 章节阅读页（滚动模式，含全部图片）：`/manhua/chapter/{comic_id}/{chapter_id}/all.html`
    - 图片地址格式：`https://img.dongman.la/[首字母]/[拼音缩写]/[章节号]/[页码].jpg`

### 网站结构分析

- **服务端渲染 (SSR)** - 所有内容在HTML中直接输出
- **懒加载机制** - 仅预加载前3张，滚动时加载后续图片，但所有图片地址均在源码中
- **反爬机制宽松** - 仅需基础User-Agent即可访问，无Cookie验证、无验证码、无签名

---

## 安装依赖

`pip install -r requirements.txt`

## 使用方法

### 1. 爬取指定漫画（推荐先测试）

`# 爬取一拳超人(ID:5985)`\
`python dongmanla_spider.py --comic-id 5985`

### 2. 搜索并下载漫画

`# 搜索"火影忍者"并下载所有结果`\
`python dongmanla_spider.py --search 火影忍者`

### 3. 爬取特定分类

`# 只爬取日本漫画分类，前3页`\
`python dongmanla_spider.py --category ribenmanhua --max-pages 3`

可用分类名称:

- `ribenmanhua` - 日本漫画
- `gangtaimanhua` - 港台漫画
- `oumeimanhua` - 欧美漫画
- `guochanmanhua` - 国产漫画
- `hanman` - 韩漫
- `wanjie` - 完结漫画
- `lianzaizhong` - 连载中
- `kongbulingyi` - 恐怖灵异
- `shaonianrexue` - 少年热血
- `danmeibaihe` - 耽美百合

### 4. 只爬取首页推荐

`python dongmanla_spider.py --homepage-only`

### 5. 全站爬取

`# 全站爬取所有分类所有漫画`\
`python dongmanla_spider.py`

## 参数说明

| 参数 | 说明 | 默认值 |
| --- | --- | --- |
| `--comic-id` | 指定漫画ID下载 | 无 |
| `--search` | 搜索关键词下载 | 无 |
| `--delay` | 请求间隔(秒)，防止被封 | 0.5 |
| `--threads` | 图片下载并发线程数 | 5 |
| `--output` | 文件保存目录 | dongmanla_downloads |
| `--category` | 指定分类爬取 | 无 |
| `--max-pages` | 每个分类最多爬取页数 | 全部 |
| `--homepage-only` | 只爬首页推荐 | 否 |

## 功能特性

- ✅ **断点续传** - 自动记录已下载内容，中断后重新运行会自动跳过已完成部分
- ✅ **失败重试** - 网络错误自动重试3次，采用指数退避算法
- ✅ **多线程下载** - 图片并发下载提升速度
- ✅ **智能去重** - 自动检测重复漫画/章节
- ✅ **浏览器伪装** - 真实请求头，避免被识别为爬虫
- ✅ **目录结构清晰** - `下载目录/漫画名/章节名/图片.jpg`
- ✅ **进度显示** - 实时显示下载进度

## 目录结构示例

`dongmanla_downloads/`\
`├── .download_record.json    # 下载记录文件(用于断点续传)`\
`├── 一拳超人/`\
`│   ├── 第1话/`\
`│   │   ├── 0001.jpg`\
`│   │   ├── 0002.jpg`\
`│   │   └── ...`\
`│   ├── 第2话/`\
`│   └── ...`\
`└── 火影忍者/`\
`    └── ...`

## 注意事项

1. **首次使用建议先小范围测试**：先用 `--comic-id` 测试单部漫画是否正常下载
2. **合理设置延迟**：如果遇到访问受限，调大 `--delay` 参数（如设为1或2）
3. **版权声明**：本工具仅供学习交流使用，请支持正版漫画
4. **增量更新**：再次运行相同命令只会下载新更新的章节，不会重复下载

## 常见问题

**Q: 为什么下载速度很慢**？A: 可以增加线程数 `--threads 10`，但不建议超过15，避免给服务器造成过大压力。

**Q: 程序中断后怎么办**？A: 直接重新运行相同命令即可，程序会自动跳过已下载的内容，从断点继续。

**Q: 图片会下载到哪里**？A: 默认在当前目录的 `dongmanla_downloads` 文件夹下，可用 `--output` 指定其他位置。

**Q: 如何知道某部漫画的ID**？A: 在网站打开漫画详情页，URL中的数字就是ID，例如 `/manhua/detail/5985/` 的ID是5985。