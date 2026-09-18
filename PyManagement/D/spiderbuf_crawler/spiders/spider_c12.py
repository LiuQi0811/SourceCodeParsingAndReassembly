# -*- coding: utf-8 -*-
"""
================================================================================
关卡 c12 - AES 密钥混淆与 Selenium 高级对抗
难度: 4.0 / 5.0
反爬技术: 随机 AES 密钥混淆 + MD5 校验参数 + AES-CBC(IV 前置) 双层解密 + webdriver/cdc_ 检测
加密算法: MD5(t2+randomKey) 作 q 参数；AES-128-CBC(PKCS7, IV 前置在密文前) 双层解密
运行方式: python spider_c12.py
原理（逆向 c12.min.js）:
  1) 客户端生成 16 位随机 key（字符集 A-Za-z0-9）
  2) t2 = 当前秒级时间戳；q = MD5(str(t2)+key).hex
  3) GET /api?q=<q>&t=<t2>
  4) 响应 {"a":<b64>,"b":<b64>}：先用 key 解 b 得临时 key，再用临时 key 解 a 得 JSON
     （AES-CBC，IV 为密文前 16 字节）
  5) webdriver / cdc_ 检测失败则渲染拦截页
  本脚本用 playwright(Edge) 跑通上述 JS，等待表格渲染后提取数据，
  再按"内存 > 16GB 且币种=USD"过滤求平均价（关卡目标）。
================================================================================
"""
import json
import time

from playwright.sync_api import sync_playwright

URL = "https://spiderbuf.cn/challenge/web-scraping-practice-js-reverse-c12"


def main():
    print("=" * 70)
    print("SpiderBuf c12 - AES 密钥混淆与 Selenium 高级对抗")
    print("=" * 70)
    with sync_playwright() as p:
        browser = p.chromium.launch(channel="msedge", headless=True, args=[
            "--disable-blink-features=AutomationControlled", "--no-sandbox"])
        ctx = browser.new_context(
            user_agent=("Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                        "AppleWebKit/537.36 (KHTML, like Gecko) "
                        "Chrome/126.0.0.0 Safari/537.36"),
            viewport={"width": 1366, "height": 768}, locale="zh-CN")
        ctx.add_init_script("Object.defineProperty(navigator,'webdriver',{get:()=>undefined});")
        page = ctx.new_page()
        page.goto(URL, wait_until="domcontentloaded", timeout=30000)
        # 等待数据行渲染
        try:
            page.wait_for_selector("tbody tr", timeout=15000)
        except Exception:
            print("[c12] 等待表格超时")
        time.sleep(2)

        rows = page.eval_on_selector_all("tbody tr", """
            els => els.map(tr => {
                const tds = tr.querySelectorAll('td');
                return Array.from(tds).map(td => td.textContent.trim());
            })
        """)
        browser.close()

    # 列: NO. MODEL SCREEN CHIP MEMORY STORAGE PRICE CURRENCY NOTE
    records = []
    for cells in rows:
        if len(cells) < 8:
            continue
        try:
            mem = cells[4]
            price = float(cells[6])
            cur = cells[7]
        except (ValueError, IndexError):
            continue
        records.append({
            "model": cells[1], "screen": cells[2], "chip": cells[3],
            "memory": mem, "storage": cells[5], "price": price, "currency": cur,
        })

    # 目标：内存 > 16GB（即 24GB/32GB，严格大于）且 USD 的平均价格
    def mem_gb(m):
        try:
            return int(m.lower().replace("gb", ""))
        except ValueError:
            return 0

    target = [r for r in records if mem_gb(r["memory"]) > 16 and r["currency"] == "USD"]
    avg = round(sum(r["price"] for r in target) / len(target), 2) if target else 0.0

    print("-" * 70)
    print(f"[c12] 提取数据行数: {len(records)}")
    print(json.dumps(records, ensure_ascii=False, indent=2))
    print("-" * 70)
    print(f"[c12] 过滤条件 内存>16GB & USD 的行数: {len(target)}")
    print(f"[c12] 目标结果 平均价格 = {avg}")
    print("=" * 70)
    print(f"[c12] DONE rows={len(records)} avg_price={avg}")


if __name__ == "__main__":
    main()
