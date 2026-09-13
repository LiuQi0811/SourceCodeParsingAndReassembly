"""
使用示例 3：注册自定义解密器（可用于执行 JS / 复杂逆向）
例如对接 PyExecJS / Node 子进程调用逆向出的 JS
"""
from universal_async_spider import Config, UniversalSpider
from universal_async_spider.decryptor import Decryptor, DecryptorFactory


class MyCustomDecryptor(Decryptor):
    """自定义解密策略示例：如调用 JS 函数解密"""
    name = "custom_js"

    def match(self, content, headers, url):
        # 自定义判断逻辑：例如响应中含特定标记
        return b"encrypted_payload" in content

    def decrypt(self, content, key=None, iv=None):
        # ===== 这里写你自己的逆向逻辑 =====
        # 例1：调用 execjs 执行网站 JS
        # import execjs
        # ctx = execjs.compile(open("site.js").read())
        # return ctx.call("decrypt", content.decode()).encode()
        #
        # 例2：调用 Node 子进程
        # import subprocess
        # result = subprocess.run(["node", "decrypt.js", content], capture_output=True)
        # return result.stdout
        return content  # 占位


if __name__ == "__main__":
    # 注册自定义策略
    DecryptorFactory.register("custom_js", MyCustomDecryptor())

    cfg = Config(
        start_urls=["https://target-site.com/"],
        output_dir="./custom_output",
        decryption="custom_js",   # 显式指定使用自定义解密
        concurrency=10,
        delay=1.0,
    )
    spider = UniversalSpider(cfg)
    spider.run()
