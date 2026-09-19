"""
异步全站爬虫通用框架全功能自动化测试套件
全面验证：
1. 两种队列（内存队列 & SQLite 持久化队列断点续爬）
2. 三大解析器（BS4 / XPath / Regex）及组合使用
3. 字符集自动识别（GBK、UTF-8）中文无乱码
4. 资源类型识别与分类目录归档
5. 逆向解密扩展（Base64, XOR, RC4, AES, Custom Hook）
6. 观察者模式事件派发
"""
import asyncio
import os
import shutil
import unittest
from pathlib import Path
from crawler_framework.core.models import (
    CrawlTask,
    ResourceCategory,
    TaskStatus,
)
from crawler_framework.queues.factory import QueueFactory
from crawler_framework.queues.memory_queue import MemoryQueueStrategy
from crawler_framework.queues.sqlite_queue import SQLiteQueueStrategy
from crawler_framework.parsers.factory import ParserFactory
from crawler_framework.parsers.bs4_parser import Bs4Parser
from crawler_framework.parsers.xpath_parser import XPathParser
from crawler_framework.parsers.regex_parser import RegexParser
from crawler_framework.parsers.composite_parser import CompositeParser
from crawler_framework.decoders.charset_detector import CharsetDetector
from crawler_framework.storage.resource_classifier import ResourceClassifier
from crawler_framework.storage.saver import ResourceSaver
from crawler_framework.decryptors.factory import DecryptorFactory
from crawler_framework.observers.event_bus import CrawlerEventBus
from crawler_framework.observers.events import CrawlerEvent, EventType
from crawler_framework.observers.base import BaseObserver
from crawler_framework.core.engine import CrawlerEngine


class TestCrawlerFramework(unittest.IsolatedAsyncioTestCase):

    async def asyncSetUp(self):
        # 测试临时目录动态指向 tests/ 目录下，兼容 Windows / Linux 路径
        self.test_dir = str(Path(__file__).resolve().parent / "tmp_downloads")
        self.test_db = str(Path(__file__).resolve().parent / "test_tasks.db")
        if os.path.exists(self.test_dir):
            shutil.rmtree(self.test_dir)
        if os.path.exists(self.test_db):
            os.remove(self.test_db)
        os.makedirs(self.test_dir, exist_ok=True)

    async def asyncTearDown(self):
        if os.path.exists(self.test_dir):
            shutil.rmtree(self.test_dir)
        if os.path.exists(self.test_db):
            os.remove(self.test_db)

    # ─────────────────────────────────────────────────────────────
    # 测试 1: 两种队列切换与 SQLite 断点续爬验证
    # ─────────────────────────────────────────────────────────────
    async def test_queue_switching_and_breakpoint_resume(self):
        # 1. 内存队列测试
        mem_q = QueueFactory.create_queue(mode="memory")
        await mem_q.initialize()
        t1 = CrawlTask(url="https://example.com/page1")
        t2 = CrawlTask(url="https://example.com/page1")  # 重复
        t3 = CrawlTask(url="https://example.com/page2")

        self.assertTrue(await mem_q.push(t1))
        self.assertFalse(await mem_q.push(t2), "内存队列应自动去重")
        self.assertTrue(await mem_q.push(t3))

        popped = await mem_q.pop()
        self.assertEqual(popped.url, "https://example.com/page1")
        await mem_q.complete(popped)
        stats = await mem_q.stats()
        self.assertEqual(stats["completed"], 1)
        self.assertEqual(stats["pending"], 1)

        # 2. SQLite 持久化队列与断点续爬测试
        sqlite_q = QueueFactory.create_queue(mode="sqlite", db_path=self.test_db)
        await sqlite_q.initialize()
        sq_t1 = CrawlTask(url="https://site.com/item1")
        sq_t2 = CrawlTask(url="https://site.com/item2")
        await sqlite_q.push(sq_t1)
        await sqlite_q.push(sq_t2)

        # 模拟程序开始抓取 item1（变为 processing），随后程序发生异常退出
        in_progress_task = await sqlite_q.pop()
        self.assertEqual(in_progress_task.url, "https://site.com/item1")
        # 此时任务处于 processing
        stats_before = await sqlite_q.get_stats()
        self.assertEqual(stats_before["processing"], 1)
        self.assertEqual(stats_before["pending"], 1)

        # 模拟重启爬虫：调用 reset_processing 进行断点恢复
        recovered = await sqlite_q.reset_processing()
        self.assertEqual(recovered, 1, "应成功将未完成任务从 processing 恢复为 pending")

        stats_after = await sqlite_q.get_stats()
        self.assertEqual(stats_after["processing"], 0)
        self.assertEqual(stats_after["pending"], 2, "断点恢复后两个任务均待抓取")
        await sqlite_q.close()

    # ─────────────────────────────────────────────────────────────
    # 测试 2: 内置 bs4、xpath、regex 三大解析器及组合使用
    # ─────────────────────────────────────────────────────────────
    def test_parsers_and_composite(self):
        html = """
        <!DOCTYPE html>
        <html>
        <head><title>全站爬虫测试页面</title></head>
        <body>
            <div id="content">
                <h1 class="main-title">异步爬虫框架实战</h1>
                <p class="desc">基于 asyncio 和 aiohttp 研发</p>
                <span class="token" data-token="SEC_TOKEN_8899">秘钥Token</span>
                <ul class="article-list">
                    <li><a href="/art/101.html">文章一</a></li>
                    <li><a href="/art/102.html">文章二</a></li>
                </ul>
                <img src="/static/avatar.png" alt="头像" />
                <video src="/media/demo.mp4"></video>
            </div>
        </body>
        </html>
        """
        base_url = "https://mycrawler.test"

        # 1. BS4 解析器
        bs4_p = ParserFactory.get_parser("bs4")
        bs4_res = bs4_p.parse(html, base_url, {
            "title": "title",
            "main_title": "h1.main-title",
            "desc": "p.desc"
        })
        self.assertEqual(bs4_res.data["main_title"], "异步爬虫框架实战")
        self.assertIn("https://mycrawler.test/art/101.html", bs4_res.extracted_urls)
        self.assertIn("https://mycrawler.test/static/avatar.png", bs4_res.resource_urls)

        # 2. XPath 解析器
        xpath_p = ParserFactory.get_parser("xpath")
        xpath_res = xpath_p.parse(html, base_url, {
            "title": "//title/text()",
            "h1": "//h1[@class='main-title']/text()",
            "token": "//span/@data-token"
        })
        self.assertEqual(xpath_res.data["h1"], "异步爬虫框架实战")
        self.assertEqual(xpath_res.data["token"], "SEC_TOKEN_8899")

        # 3. Regex 解析器
        regex_p = ParserFactory.get_parser("regex")
        regex_res = regex_p.parse(html, base_url, {
            "token": r'data-token=["\']([^"\']+)["\']',
            "articles": [r'href=["\'](/art/\d+\.html)["\']']
        })
        self.assertEqual(regex_res.data["token"], "SEC_TOKEN_8899")
        self.assertEqual(len(regex_res.data["articles"]), 2)

        # 4. 组合解析器 (Composite)
        composite_p = ParserFactory.get_parser("composite")
        combo_res = composite_p.parse(html, base_url, {
            "bs4": {"main_title": "h1.main-title"},
            "xpath": {"token": "//span/@data-token"},
            "regex": {"raw_desc": r'<p class="desc">(.*?)</p>'}
        })
        self.assertEqual(combo_res.data["main_title"], "异步爬虫框架实战")
        self.assertEqual(combo_res.data["token"], "SEC_TOKEN_8899")
        self.assertEqual(combo_res.data["raw_desc"], "基于 asyncio 和 aiohttp 研发")

    # ─────────────────────────────────────────────────────────────
    # 测试 3: 自动识别网页字符集，GBK/UTF-8兼容，中文不乱码
    # ─────────────────────────────────────────────────────────────
    def test_charset_auto_detection_and_no_chinese_garbled(self):
        # 1. GBK 编码测试（常见于传统新闻站点）
        gbk_chinese = "<html><head><meta charset='gbk'></head><body><h1>中国新闻：GBK中文正常识别</h1></body></html>"
        gbk_bytes = gbk_chinese.encode("gbk")
        decoded_text, enc = CharsetDetector.decode(gbk_bytes, content_type_header="text/html; charset=gbk")
        self.assertIn("中国新闻：GBK中文正常识别", decoded_text)
        self.assertIn("gb", enc.lower())

        # 2. UTF-8 编码测试
        utf8_chinese = "<html><head><title>UTF8测试</title></head><body><p>深度测试中文转码</p></body></html>"
        utf8_bytes = utf8_chinese.encode("utf-8")
        decoded_utf8, enc_utf8 = CharsetDetector.decode(utf8_bytes, content_type_header="text/html; charset=utf-8")
        self.assertIn("深度测试中文转码", decoded_utf8)
        self.assertEqual(enc_utf8.lower(), "utf-8")

        # 3. 响应头未提供字符集，仅 Meta 标签声明 GB2312
        gb2312_text = "<html><head><meta http-equiv='Content-Type' content='text/html; charset=gb2312'></head><body>测试无Header的GB2312内容</body></html>"
        decoded_meta, _ = CharsetDetector.decode(gb2312_text.encode("gb2312"))
        self.assertIn("测试无Header的GB2312内容", decoded_meta)

    # ─────────────────────────────────────────────────────────────
    # 测试 4: 自动识别资源类型，创建分类目录保存图片视频文档
    # ─────────────────────────────────────────────────────────────
    async def test_resource_classification_and_auto_categorized_saving(self):
        saver = ResourceSaver(base_dir=self.test_dir)

        # 1. 图片类型识别并保存
        img_bytes = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR" + b"\x00" * 20
        cat_img = ResourceClassifier.classify("https://test.com/logo.png", "image/png", img_bytes)
        self.assertEqual(cat_img, ResourceCategory.IMAGE)
        path_img, _ = await saver.save_resource("https://test.com/logo.png", cat_img, img_bytes, "image/png")
        self.assertTrue(os.path.exists(path_img))
        self.assertIn(os.path.join("images", ""), path_img)

        # 2. 视频类型识别并保存
        vid_bytes = b"\x00\x00\x00 ftypmp42" + b"\x00" * 30
        cat_vid = ResourceClassifier.classify("https://test.com/trailer.mp4", "video/mp4", vid_bytes)
        self.assertEqual(cat_vid, ResourceCategory.VIDEO)
        path_vid, _ = await saver.save_resource("https://test.com/trailer.mp4", cat_vid, vid_bytes, "video/mp4")
        self.assertTrue(os.path.exists(path_vid))
        self.assertIn(os.path.join("videos", ""), path_vid)

        # 3. 文档类型识别并保存
        doc_bytes = b"%PDF-1.5 test pdf document content"
        cat_doc = ResourceClassifier.classify("https://test.com/report.pdf", "application/pdf", doc_bytes)
        self.assertEqual(cat_doc, ResourceCategory.DOCUMENT)
        path_doc, _ = await saver.save_resource("https://test.com/report.pdf", cat_doc, doc_bytes, "application/pdf")
        self.assertTrue(os.path.exists(path_doc))
        self.assertIn(os.path.join("documents", ""), path_doc)

    # ─────────────────────────────────────────────────────────────
    # 测试 5: 逆向解密扩展（Base64, XOR, RC4, AES, Custom Hook）
    # ─────────────────────────────────────────────────────────────
    def test_reverse_decryptors(self):
        # 1. Base64 逆向解密
        b64_dec = DecryptorFactory.create_decryptor("base64")
        import base64, json
        raw_obj = {"code": 200, "data": "爬虫逆向成功", "list": [1, 2, 3]}
        encoded_b64 = base64.b64encode(json.dumps(raw_obj, ensure_ascii=False).encode()).decode()
        dec_res = b64_dec.decrypt(encoded_b64)
        self.assertEqual(dec_res["data"], "爬虫逆向成功")

        # 2. XOR 异或反混淆逆向解密
        xor_dec = DecryptorFactory.create_decryptor("xor")
        plain = "Anti-Scraping Token: 888666"
        key = "crawlerKey"
        enc_hex = bytes([b ^ key.encode()[i % len(key.encode())] for i, b in enumerate(plain.encode())]).hex()
        xor_result = xor_dec.decrypt(enc_hex, {"key": key, "format": "hex"})
        self.assertEqual(xor_result, plain)

        # 3. RC4 逆向解密
        rc4_dec = DecryptorFactory.create_decryptor("rc4")
        rc4_key = "secure_key_123"
        # 模拟前端 RC4 加密输出为 hex 字符串
        raw_msg = "Hello RC4 Reverse Decrypt"
        S = list(range(256))
        j = 0
        k_bytes = rc4_key.encode()
        for i in range(256):
            j = (j + S[i] + k_bytes[i % len(k_bytes)]) % 256
            S[i], S[j] = S[j], S[i]
        i = j = 0
        cipher_bytes = bytearray()
        for b in raw_msg.encode():
            i = (i + 1) % 256
            j = (j + S[i]) % 256
            S[i], S[j] = S[j], S[i]
            cipher_bytes.append(b ^ S[(S[i] + S[j]) % 256])
        rc4_cipher_hex = cipher_bytes.hex()

        rc4_plain = rc4_dec.decrypt(rc4_cipher_hex, {"key": rc4_key, "format": "hex"})
        self.assertEqual(rc4_plain, raw_msg)

        # 4. 自定义逆向 Hook 函数
        custom_dec = DecryptorFactory.create_decryptor("custom")
        custom_dec.set_handler(lambda payload, params: f"DECRYPTED_{payload.upper()}")
        custom_res = custom_dec.decrypt("secret_token_abc")
        self.assertEqual(custom_res, "DECRYPTED_SECRET_TOKEN_ABC")

    # ─────────────────────────────────────────────────────────────
    # 测试 6: 观察者模式事件派发系统
    # ─────────────────────────────────────────────────────────────
    async def test_observer_pattern_event_bus(self):
        bus = CrawlerEventBus()
        captured_events = []

        class MockObserver(BaseObserver):
            async def on_event(self, event: CrawlerEvent) -> None:
                captured_events.append(event.event_type)

        observer = MockObserver()
        bus.subscribe(observer)

        await bus.emit(CrawlerEvent(event_type=EventType.ENGINE_STARTED))
        await bus.emit(CrawlerEvent(event_type=EventType.TASK_STARTED))
        await bus.emit(CrawlerEvent(event_type=EventType.REQUEST_SUCCESS))
        await bus.emit(CrawlerEvent(event_type=EventType.ENGINE_STOPPED))

        self.assertIn(EventType.ENGINE_STARTED, captured_events)
        self.assertIn(EventType.TASK_STARTED, captured_events)
        self.assertIn(EventType.REQUEST_SUCCESS, captured_events)
        self.assertIn(EventType.ENGINE_STOPPED, captured_events)


if __name__ == "__main__":
    unittest.main()
