# -*- coding: utf-8 -*-
"""
================================================================================
关卡 c13 - API 参数签名与分块传输
难度: 4.0 / 5.0
反爬技术: HTTP Range 分片请求（断点续传式数据分片）+ X-Token/X-Timestamp/X-Sign 头校验
           + XOR 数据混淆 + webdriver/cdc_ 检测
加密算法: 分片 Base64 拼接后解码；CPC = (cpc_usd ^ monthly_search_volume)/100
运行方式: python spider_c13.py
原理（逆向 c13.min.js）:
  1) 循环发起带 Range: bytes=<start>-<start+255> 的 GET 请求
  2) 首片无 X-Token；后续片带 X-Token（上一片响应的 token）
     每片带 X-Timestamp(Date.now()) 与 X-Sign 头
  3) 每片响应 JSON: {data:<base64片>, next:<下一片起始偏移,-1结束>, token:<下片X-Token>}
  4) 拼接所有 base64 片 -> atob -> UTF-8 -> JSON 列表
  5) CPC = (cpc_usd ^ monthly_search_volume)/100
  本脚本用 playwright(Edge) 跑通分片请求与签名头，等待表格渲染后提取数据，
  计算 CPC 列平均值（关卡目标）。
================================================================================
"""
import json
import time

from playwright.sync_api import sync_playwright

URL = "https://spiderbuf.cn/challenge/web-scraping-practice-c13"


def main():
    print("=" * 70)
    print("SpiderBuf c13 - API 参数签名与分块传输")
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
        try:
            page.wait_for_selector("tbody tr", timeout=15000)
        except Exception:
            print("[c13] 等待表格超时，手动触发 run()")
            try:
                page.evaluate("typeof run==='function' && run()")
            except Exception:
                pass
        time.sleep(3)

        rows = page.eval_on_selector_all("tbody tr", """
            els => els.map(tr => Array.from(tr.querySelectorAll('td')).map(td => td.textContent.trim()))
        """)
        browser.close()

    records = []
    for cells in rows:
        if len(cells) < 7:
            continue
        try:
            idx = cells[0]
            cpc = float(cells[2])
            monthly = int(cells[3])
        except (ValueError, IndexError):
            continue
        records.append({
            "keyword": cells[1], "cpc": cpc, "monthly_search": monthly,
            "competition": cells[4], "industry": cells[5], "source": cells[6],
        })

    avg = round(sum(r["cpc"] for r in records) / len(records), 2) if records else 0.0
    print("-" * 70)
    print(f"[c13] 提取数据行数: {len(records)}")
    print(json.dumps(records, ensure_ascii=False, indent=2))
    print("-" * 70)
    print(f"[c13] 目标结果 CPC 列平均值 = {avg}")
    print("=" * 70)
    print(f"[c13] DONE rows={len(records)} avg_cpc={avg}")


if __name__ == "__main__":
    main()
