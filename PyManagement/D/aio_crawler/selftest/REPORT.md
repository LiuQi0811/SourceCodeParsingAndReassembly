# 自测报告

- 时间: 2026-09-17 11:52:17
- 结果: **27/27 通过** (全部通过)
- 耗时: 2.8s

| # | 用例 | 结果 | 说明 |
|---|------|------|------|
| 1 | GBK 页面按头部 charset 解码 | PASS | charset=gbk |
| 2 | GBK 页面按 meta 自动识别 | PASS | charset=gbk |
| 3 | 解析器 bs4 解析 GBK 页 | PASS | title='中文GBK页面-测试' links=1 res=2 |
| 4 | 解析器 xpath 解析 GBK 页 | PASS | title='中文GBK页面-测试' links=1 res=2 |
| 5 | 解析器 re 解析 GBK 页 | PASS | title='中文GBK页面-测试' links=1 res=2 |
| 6 | 组合解析器(auto) 解析 | PASS | used=['bs4', 'xpath', 're'] links=1 res=2 |
| 7 | 单任务解析器切换(全局bs4 -> 任务xpath) | PASS | global=bs4 task=xpath |
| 8 | 自定义组合(composite:re,xpath) | PASS | used=['re', 'xpath'] |
| 9 | 声明 utf-8 但实际 gbk 自动回退 | PASS | 实际=gbk |
| 10 | 内存队列完成全站抓取 | PASS | pages=5 res_dl=9 res_fail=0 |
| 11 | 标题目录存在: 测试站点-首页 | PASS |  |
| 12 | 标题目录存在: 中文GBK页面-测试 | PASS |  |
| 13 | 标题目录存在: 深度页面一 | PASS |  |
| 14 | 标题目录存在: 深度页面二 | PASS |  |
| 15 | 标题目录存在: 视频播放页-示例 | PASS |  |
| 16 | 图片分组保存(images/*.png 非空) | PASS | files=['测试站点-首页.png'] |
| 17 | 文档分组保存(docs/*.pdf) | PASS |  |
| 18 | 视频目录至少 3 个 mp4 (hls/dash/直链) | PASS | files=['视频播放页-示例.mp4', '视频播放页-示例_2.mp4', '视频播放页-示例_3.mp4'] |
| 19 | 视频可播放(ffprobe 时长>1s) | PASS | ok=3/3 |
| 20 | manifest.json 资源清单 | PASS | exists=True |
| 21 | 第一段受限抓取后停止 | PASS | pages=2 |
| 22 | 中断后队列保留待处理任务(断点数据在) | PASS | total=5 pending=3 |
| 23 | 续爬后剩余页面完成(2+3=5) | PASS | second_pages=3 fail=0 |
| 24 | 队列状态：done=5 pending=0 | PASS | done=5 pending=0 |
| 25 | 解析器 bs4 首页发现链接/资源 | PASS | pages=1 links=3 res=2 |
| 26 | 解析器 xpath 首页发现链接/资源 | PASS | pages=1 links=3 res=2 |
| 27 | 解析器 re 首页发现链接/资源 | PASS | pages=1 links=3 res=2 |

## 抓取产物（selftest/downloads）

- `中文GBK页面-测试/`
  - `docs/`: 中文GBK页面-测试.pdf
  - `images/`: 中文GBK页面-测试.png
- `测试站点-首页/`
  - `docs/`: 测试站点-首页.pdf
  - `images/`: 测试站点-首页.png
- `深度页面一/`
  - `videos/`: 深度页面一.mp4
- `深度页面二/`
  - `images/`: 深度页面二.png
- `视频播放页-示例/`
  - `videos/`: 视频播放页-示例.mp4, 视频播放页-示例_2.mp4, 视频播放页-示例_3.mp4