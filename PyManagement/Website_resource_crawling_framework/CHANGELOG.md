# 变更记录 (Changelog)

> 记录 2026-09-19 对全站异步并发抓取通用框架的测试、缺陷修复与质量改进。
> 测试总数：6 → 66（全部通过），无残留文件与连接泄漏。

---

## 一、Bug 修复

### 1. 引擎未校验 HTTP 状态码（核心缺陷）
- **位置**：`crawler_framework/core/engine.py` `_process_task`
- **问题**：`resp.raise_for_status()` 缺失，404/500 等错误页面被当作成功解析并参与递归，统计指标失真。
- **修复**：请求后立即 `raise_for_status()`，4xx/5xx 触发失败与重试，直至 `max_retries` 后标记 `failed`。
- **验证**：500 页面重试 3 次后最终 failed（`failed_requests=4`）；404 不再计入成功请求。

### 2. RC4 解密器空 key 除零崩溃
- **位置**：`crawler_framework/decryptors/builtin_handlers.py` `RC4Decryptor`
- **问题**：未传 key 时 `key_bytes` 为空，KSA 循环 `i % len(key_bytes)` 抛 `ZeroDivisionError`。
- **修复**：key 为空时回退默认值 `"default_key"`。

### 3. ResourceSaver 签名 2 返回值与文档不一致
- **位置**：`crawler_framework/storage/saver.py` `save_resource`
- **问题**：docstring 声明签名 2 `save_resource(url, content, content_type_header)` 返回 `(category, saved_path, size)`，实际只返回 `(saved_path, size)`。
- **修复**：实现对齐文档，签名 2 返回 3 元组 `(category, path, size)`；签名 1 保持 `(path, size)` 不变。

### 4. SQLite 队列 close 后查询泄漏连接
- **位置**：`crawler_framework/queues/sqlite_queue.py`
- **问题**：`close()` 将 `_conn` 置空后，`get_stats()`/`is_empty()`/`pending_count()` 会静默重建持久连接且无人关闭，造成连接泄漏与 db 文件锁（临时目录无法清理）。`server.py handle_status` 对已结束引擎轮询时会持续触发。
- **修复**：新增 `_read_connection()` —— 队列存活时复用持久连接；已关闭时使用短连接自开自关，三个只读查询方法全部接入。

### 5. 测试代码硬编码容器路径（跨平台缺陷）
- **位置**：`tests/test_crawler_suite.py`
- **问题**：硬编码 Linux 沙箱路径 `/workspace/app-efej0zprkmwx/...`，Windows 上解析为 `D:\workspace\...` 污染磁盘根目录；`assertIn("/images/", ...)` 不兼容 Windows 分隔符。
- **修复**：改用 `Path(__file__).resolve().parent` 动态路径与 `os.path.join` 断言。

### 6. 域名白名单子串匹配（安全缺陷）
- **位置**：`crawler_framework/core/engine.py` `_is_domain_allowed`
- **问题**：白名单用 `any(d in hostname)` 子串匹配，`evil169tp.com` 会被 `169tp.com` 白名单放行。
- **修复**：改为边界匹配 `hostname == d or hostname.endswith("." + d)`；白名单条目支持带协议写法并归一化。

### 7. max_pages 失效（爬取失控）
- **位置**：`crawler_framework/core/engine.py` `run` 主循环
- **问题**：页面限制只在翻页入队分支检查；首页一次性入队全部子页后失控（max_pages=3 实际抓 11 页）。
- **修复**：主循环取新任务前强制检查 `max_pages and pages_crawled >= max_pages`，达到即平稳收尾（置 `_stop_reason`、`_is_running=False`）。

### 8. 字符集编码混淆（big5 被误判为韩文 cp949）
- **位置**：`crawler_framework/decoders/charset.py`、`charset_detector.py`
- **问题**：big5 内容被 charset-normalizer 误判为 cp949（韩文音节），繁体中文输出乱码；声明编码优先分支缺失。
- **修复**：两个解码器统一为「声明编码优先 → 多候选（normalizer 全部候选 + 中文回退链）+ round-trip 校验 + 文本质量评分（CJK 汉字 +3 / 日文假名 -5 / 韩文音节 -5 / 替换字符 -10）」取最高分。
- **验证**：big5 内容错标 utf-8 头正确解出「繁體中文測試」；GBK/UTF-8/ASCII 无声明均正常。

### 9. MemoryQueue 队列满挂死
- **位置**：`crawler_framework/queues/memory_queue.py` `push`
- **问题**：`await queue.put()` 在 `maxsize` 模式下队列满时无限阻塞——无人消费即永久挂起（深层测试整套挂死 30s+ 的根因，faulthandler 定位）。
- **修复**：改 `put_nowait()`，捕获 `asyncio.QueueFull` 时回滚 `_seen_urls`/`_tasks_map` 并返回 False（非阻塞拒绝）。
- **验证**：`maxsize=2` 推入第 3 个任务立即返回 False，不再挂起。

---

## 二、健壮性与可观测性改进

### engine.py
- 资源下载（页面内图片/音视频）失败：`except: pass` 静默吞异常 → 统一 emit `REQUEST_FAILED` 事件（含 HTTP 非 200 与异常信息），Web 控制台可见。
- 逆向解密失败：`print` 终端输出 → emit `REQUEST_FAILED` 事件（携带解密类型与错误）。
- `ENGINE_STOPPED` 事件重复触发（达 max_pages 与正常收尾各一次）→ 合并为收尾统一触发一次，新增 `_stop_reason` 携带停止原因。

### server.py
- `EVENT_HISTORY` 由 `list.pop(0)`（O(n)）改为 `collections.deque(maxlen=300)` 自动淘汰；事件接口适配 `list()` 切片。

### cli.py
- `--decrypt-test` 中 RC4 由假数据（仅验证接口存在）改为真实 RC4 加解密往返校验，结果不一致会明确告警。

### 代码清理
- 删除死代码 `crawler_framework/storage/classifier.py`（与 `resource_classifier.py` 重复且全项目零引用）。

---

## 三、测试体系扩展

| 文件 | 新增用例 | 覆盖内容 |
|---|---|---|
| `tests/test_crawler_e2e.py` | 15 | 引擎端到端真实抓取（本地 HTTP 服务器）、PaginationDetector 翻页识别与链接分流、M3U8 master/media 解析、VideoExtractor 流媒体提取、M3U8 切片下载→合并全链路 |
| `tests/test_server_api.py` | 11 | status/events/resources、字符集、解析器、解密、清理白名单校验（防路径穿越）、M3U8 任务、引擎 start/stop 生命周期 |
| `tests/test_crawler_advanced.py` | 14 | HTTP 状态码处理与失败重试、SQLite 断点续爬（engine 级）、域名级限速、DownloadManager 任务状态机、RC4/AES 边界、保存器路径安全、内存队列重试状态机 |
| `tests/test_crawler_deep.py` | 25 | 字符集解码全链路（Header/meta/normalizer/回退/BOM/二进制容错）、资源分类全类型（扩展名/MIME/魔数/优先级）、引擎并发不丢任务/URL 去重/max_pages 边界/域名白名单、MemoryQueue maxsize、server API（并行守卫 409、cleanup 实删、real-fetch 本地站点） |

## 四、测试隔离（防污染生产文件）

- 引擎审计观察者日志隔离：e2e 测试指向临时目录；API 测试在模块级将 `FileAuditObserver` 重定向到 `tests/tmp_audit_test.jsonl`。
- 运行前后校验：`crawler_audit.jsonl` 保持原始内容；测试结束无残留目录/临时文件/数据库。

## 五、最终状态

```
Ran 66 tests in ~19s
OK
```

- 无 ResourceWarning / 连接泄漏
- 无残留临时目录
- `crawler_audit.jsonl` 保持原始 6 行（引擎审计隔离：e2e 与 API 测试均重定向到临时文件）

## 六、深层测试过程记录

- 深层测试套件曾两次整体挂死（>5 分钟）：使用 `faulthandler.dump_traceback_later(30)` + `unittest.TestCase.run` 打桩逐用例追踪，最终定位为 `MemoryQueueStrategy(maxsize=N)` 测试挂死（见 Bug 修复 9）。
- `real-fetch` 响应结构核实：`status="ok"`、`http_status`、`encoding`、`content_type`、`title`、`resources.{images,videos,audios,links,stream_urls}`（测试断言按实际结构修正）。
- 回归口径：66/66 通过、审计行数不增长（6→6）、无警告、无残留文件。
