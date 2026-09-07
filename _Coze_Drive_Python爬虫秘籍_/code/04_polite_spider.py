# -*- coding: utf-8 -*-
"""反爬应对模板：请求头、自动重试、超时、限速、Session、代理。

pip install requests
python 04_polite_spider.py
"""
import random
import time

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

def build_session(proxy: str | None = None) -> requests.Session:
    """创建一个带重试和默认请求头的会话。"""
    session = requests.Session()

    retry = Retry(
        total=3,                  # 总共重试 3 次
        backoff_factor=1,         # 重试间隔：1s → 2s → 4s
        status_forcelist=[429, 500, 502, 503, 504],  # 遇到这些状态码就重试
    )
    adapter = HTTPAdapter(max_retries=retry, pool_connections=10, pool_maxsize=10)
    session.mount("http://", adapter)
    session.mount("https://", adapter)

    # 请求头越像浏览器，越不容易被当成脚本
    session.headers.update({
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
            "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
        ),
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    })

    if proxy:  # 需要时启用代理，例如 "http://127.0.0.1:7890"
        session.proxies = {"http": proxy, "https": proxy}

    return session

def polite_get(session: requests.Session, url: str, **kwargs) -> requests.Response:
    """每次请求前随机等待 1~3 秒，别把人家网站打挂。"""
    time.sleep(random.uniform(1, 3))
    return session.get(url, timeout=10, **kwargs)

def main():
    session = build_session()
    # httpbin.org 会把你发去的请求头原样返回，用来验证伪装效果
    resp = polite_get(session, "https://httpbin.org/user-agent")
    print("服务器看到的 UA:", resp.json()["user-agent"])

if __name__ == "__main__":
    main()
