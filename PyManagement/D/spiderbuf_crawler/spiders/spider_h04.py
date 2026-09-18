# -*- coding: utf-8 -*-
"""
================================================================================
关卡 h04 - js加密混淆及简单反调试
难度: 3.0 / 5.0
反爬技术: JS 数据加密混淆（对象 key 用 \\uXXXX unicode 转义、数字用 0x 十六进制表示）
          + debugger 反调试（反爬虫常伴随 console 方法 hook / 断点）
加密算法: 无对称加密，仅为字符串混淆（unicode/hex）。数据直接放在混淆 JS 里
          `var data=[...]`，执行后渲染进 <table>。
运行方式: python spider_h04.py
原理:
  1) 关卡页引用 /static/js/udSL29.min.js，内部第一句就是 var data=[...弱密码排行...];
  2) 因为 key 被 \\uXXXX 转义、数值为 0x 十六进制，直接正则切出数组字面量后用 node
     求值（比 Python eval 更稳，兼容 JS 语法）。
  3) 反调试不影响我们——我们根本不在浏览器里跑 debugger，直接拿数据。
================================================================================
"""
import json
import subprocess
import time

import requests

JS_URL = "https://spiderbuf.cn/static/js/udSL29.min.js"
HEADERS = {
    "User-Agent": ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                   "AppleWebKit/537.36 (KHTML, like Gecko) "
                   "Chrome/126.0.0.0 Safari/537.36"),
}


def fetch_js() -> str:
    resp = requests.get(JS_URL, headers=HEADERS, timeout=20)
    resp.raise_for_status()
    return resp.text


def parse_with_node(js: str) -> list:
    """从混淆 JS 中切出 var data=[...] 数组字面量，交给 node 求值后输出 JSON。"""
    start = js.index("var data=") + len("var data=")
    end = js.index("];", start) + 1  # 包含 ']'
    array_literal = js[start:end]
    node_code = f"process.stdout.write(JSON.stringify({array_literal}));"
    out = subprocess.run(
        ["node", "-e", node_code],
        capture_output=True, text=True, timeout=30,
    )
    if out.returncode != 0:
        raise RuntimeError(f"node 解析失败: {out.stderr}")
    return json.loads(out.stdout)


def main():
    print("=" * 70)
    print("SpiderBuf h04 - js加密混淆及简单反调试")
    print("=" * 70)
    js = fetch_js()
    print(f"[h04] 下载混淆 JS: {len(js)} 字节")
    time.sleep(1)  # 每请求间隔 >=1s
    rows = parse_with_node(js)
    print("-" * 70)
    print(f"[h04] 从混淆 JS 提取数据行数: {len(rows)}")
    print(json.dumps(rows, ensure_ascii=False, indent=2))
    print("=" * 70)
    print(f"[h04] DONE rows={len(rows)}")


if __name__ == "__main__":
    main()
