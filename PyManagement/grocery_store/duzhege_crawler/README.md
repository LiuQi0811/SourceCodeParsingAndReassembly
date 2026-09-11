# 读者阁(duzhege.cn)全站PDF爬虫使用说明

## 功能特点

✅ **无加密逆向**：已完美绕过Cloudflare防护，自动使用备用直链源下载，无需解密 ✅ **自动爬取**：自动从sitemap抓取全站990+篇文章链接 ✅ **分类保存**：按杂志名称自动分类（科幻世界、故事会、知音、十月、小说月报等） ✅ **断点续传**：支持下载中断后继续下载，无需从头开始 ✅ **自动跳过**：已下载完成的文件自动跳过，避免重复下载 ✅ **失败重试**：网络错误自动重试5次，限流自动等待 ✅ **多线程下载**：默认3线程并发，可自行调整 ✅ **随机UA**：随机User-Agent，降低被封风险

## 文件说明

- `duzhege_crawler.py`：主爬虫程序
- `article_list.json`：所有文章URL列表
- `articles_info.json`：所有文章解析结果（含下载链接、分类）
- `duzhege_crawler.log`：运行日志文件
- `读者阁PDF/`：下载的PDF保存目录，按杂志分子目录

## 使用方法

### 1. 安装依赖

`pip install requests beautifulsoup4 tqdm lxml`

### 2. 运行爬虫

`python3 duzhege_crawler.py`

### 3. 查看进度

`# 实时查看日志`\
`tail -f duzhege_crawler.log`\
\
`# 查看已下载文件数量`\
`find ./读者阁PDF -name "*.pdf" | wc -l`\
\
`# 查看已下载文件大小`\
`du -sh ./读者阁PDF`

### 4. 后台运行（推荐）

`nohup python3 duzhege_crawler.py > run.log 2>&1 &`

## 配置说明

可在代码头部修改参数：

`SAVE_DIR = "./读者阁PDF"  # 保存目录`\
`MAX_WORKERS = 3  # 并发下载数（建议不要超过5，避免给服务器造成压力）`\
`TIMEOUT = 120  # 单文件下载超时时间(秒)`\
`RETRY_TIMES = 5  # 失败重试次数`

## 已支持下载的杂志分类

- 科幻世界/科幻世界译文版
- 十月/十月长篇小说
- 上海文学
- 小说月报/小说月报原创版/大字版
- 故事会/故事会文摘版/校园版
- 知音/知音海外版
- 格言校园版
- 微型小说月报
- 民间文学/民间传奇故事
- 北京文学
- 花城/芙蓉/清明
- 啄木鸟
- 读书/书屋
- 儿童文学（故事版/选萃版/经典版）
- 海外文摘/海外文摘文学版
- 今古传奇
- 小说选刊
- 当代长篇小说选刊 ...等全部站点资源

## 注意事项

1. 备用源下载速度约100KB/s-1MB/s，全站约300GB，完整下载需要较长时间
2. 请勿将并发数调得过高，遵守爬虫礼仪
3. 下载的PDF仅供个人学习使用，请勿商用传播
4. 如果下载中断，重新运行脚本即可自动续传

## 逆向说明

- 主站`cloud.duzhege.cn`使用Cloudflare 5秒盾防护，无法直接curl下载
- 备用源`yun.duzhege.cn`是SharePoint反代，直接返回302跳转到微软SharePoint直链，无加密
- 爬虫已自动优先选择备用源，无需破解任何JS加密，完美绕过反爬
- 链接构造规律：将在线阅读链接`https://yun.duzhege.cn/OneDrive/xxx.pdf`改为`https://yun.duzhege.cn/d/OneDrive/xxx.pdf`即为下载直链