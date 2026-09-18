# -*- coding: utf-8 -*-
"""
================================================================================
关卡 c14 - 主流模拟浏览器检测对抗
难度: 4.5 / 5.0
反爬技术: 主流自动化框架特征检测（navigator.webdriver / cdc_ 变量 / window.chrome.runtime
           / 自动化全局对象枚举）+ AES 加密数据 + 浏览器指纹
加密算法: 服务端返回 AES 加密数据，客户端用 getFingerprint() 派生密钥解密后渲染
运行方式: python spider_c14.py
原理（逆向 _c14.min.js + 实测定位）:
  1) requests 直连被 403；playwright(Edge) 加载后客户端 JS 做多重自动化检测，
     任一特征命中则静默退出、不发起数据请求（.data-container 为空）。
  2) 实测定位触发点：headless Edge 下 window.chrome.runtime 为 undefined，
     而真实浏览器该对象存在。补全 chrome.runtime / chrome.app / chrome.csi /
     chrome.loadTimes，并隐藏 navigator.webdriver，即可通过检测。
  3) 加载后手动调用 run() 触发：POST 指纹 -> GET 加密数据 -> AES 解密 ->
     renderKeywords 渲染到 .data-container > div（含 keyword/cpc/industry/source）。
  4) 提取全部卡片，计算 CPC 列平均值（关卡目标）。
================================================================================
"""
import json
import time

from playwright.sync_api import sync_playwright

URL = "https://spiderbuf.cn/challenge/anti-simulate-web-browser"

STEALTH_JS = """
Object.defineProperty(navigator,'webdriver',{get:()=>undefined});
if(!window.chrome) window.chrome = {};
window.chrome.runtime = window.chrome.runtime || {};
window.chrome.app = window.chrome.app || {isInstalled:false};
window.chrome.csi = window.chrome.csi || function(){return{startE:Date.now(),onloadE:Date.now(),pageT:0};};
window.chrome.loadTimes = window.chrome.loadTimes || function(){return{commitLoadTime:Date.now()/1000,finishLoadTime:Date.now()/1000,requestTime:Date.now()/1000,startLoadTime:Date.now()/1000};};
Object.defineProperty(navigator,'languages',{get:()=>['zh-CN','zh','en']});
"""


def main():
    print("=" * 70)
    print("SpiderBuf c14 - 主流模拟浏览器检测对抗")
    print("=" * 70)
    with sync_playwright() as p:
        browser = p.chromium.launch(channel="msedge", headless=True, args=[
            "--disable-blink-features=AutomationControlled", "--no-sandbox"])
        ctx = browser.new_context(
            user_agent=("Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                        "AppleWebKit/537.36 (KHTML, like Gecko) "
                        "Chrome/126.0.0.0 Safari/537.36"),
            viewport={"width": 1366, "height": 768}, locale="zh-CN")
        ctx.add_init_script(STEALTH_JS)
        page = ctx.new_page()
        page.goto(URL, wait_until="domcontentloaded", timeout=30000)
        time.sleep(3)
        # 手动触发数据加载（onload 可能已错过或被检测门拦截）
        try:
            page.evaluate("typeof run==='function' && run()")
        except Exception:
            pass
        try:
            page.wait_for_selector(".data-container > div", timeout=15000)
        except Exception:
            print("[c14] 等待卡片超时")
        time.sleep(2)

        cards = page.eval_on_selector_all(".data-container > div", """
            els => els.map(el => ({
                keyword: (el.querySelector('[data-keyword],.keyword,.kw')||{}).textContent || el.getAttribute('data-keyword') || '',
                cpc_text: (el.querySelector('[data-cpc],.cpc')||{}).textContent || el.getAttribute('data-cpc') || '',
                industry: (el.querySelector('[data-industry],.industry')||{}).textContent || el.getAttribute('data-industry') || '',
                source: (el.querySelector('[data-source],.source')||{}).textContent || el.getAttribute('data-source') || '',
                raw: el.innerText
            }))
        """)
        browser.close()

    records = []
    for c in cards:
        raw = (c.get("raw") or "").strip()
        # 解析 "keyword\nCPC: $xx.xx\nIndustry: ...\nSource: ..."
        lines = [x.strip() for x in raw.splitlines() if x.strip()]
        keyword = lines[0] if lines else c.get("keyword", "")
        cpc = 0.0
        industry = c.get("industry", "")
        source = c.get("source", "")
        for seg in lines[1:]:
            low = seg.lower()
            if low.startswith("cpc"):
                try:
                    cpc = float(seg.replace("CPC", "").replace("$", "").replace(":", "").strip())
                except ValueError:
                    pass
            elif low.startswith("industry"):
                industry = seg.split(":", 1)[-1].strip()
            elif low.startswith("source"):
                source = seg.split(":", 1)[-1].strip()
        if keyword:
            records.append({"keyword": keyword, "cpc": cpc, "industry": industry, "source": source})

    avg = round(sum(r["cpc"] for r in records) / len(records), 2) if records else 0.0
    print("-" * 70)
    print(f"[c14] 提取数据行数: {len(records)}")
    print(json.dumps(records, ensure_ascii=False, indent=2))
    print("-" * 70)
    print(f"[c14] 目标结果 CPC 列平均值 = {avg}")
    print("=" * 70)
    print(f"[c14] DONE rows={len(records)} avg_cpc={avg}")


if __name__ == "__main__":
    main()
