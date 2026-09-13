"""
使用示例 2：带 AES 解密 + 代理 + 自定义请求头（模拟逆向场景）
"""
from universal_async_spider import Config, UniversalSpider

if __name__ == "__main__":
    cfg = Config(
        start_urls=["https://example-encrypted-site.com/"],
        output_dir="./aes_output",
        concurrency=15,
        delay=0.5,
        max_depth=3,
        max_retries=5,
        # ===== 逆向 / AES 解密配置 =====
        decryption="aes",
        decryption_key="0123456789abcdef0123456789abcdef",  # 32字节 => AES-256
        decryption_iv="abcdef9876543210",                    # 16字节 IV
        # ===== 反爬 =====
        proxy="http://127.0.0.1:7890",
        headers={
            "Referer": "https://example-encrypted-site.com/",
            "X-Requested-With": "XMLHttpRequest",
        },
        cookies={"sessionid": "your-session-id"},
    )
    spider = UniversalSpider(cfg)
    spider.run()
