# -*- coding: utf-8 -*-
"""
关卡: S03 - lxml库进阶语法及解析练习
难度: 入门
反爬技术: 无。练习点：表格单元格内嵌 <a>/<font> 标签，直接 td.text 取不到全部文本，
         需用 string(.) 或 .//text() 提取嵌套节点文本；并练习 xpath 谓词筛选。
运行方式: python spider_s03.py
目标数据: 局域网设备表（IP 单元格内嵌 <a>，状态单元格内嵌 <font color>）
"""
import json
import time

import requests
from lxml import etree

URL = "https://spiderbuf.cn/challenge/lxml-xpath-advanced"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
}


def cell_text(td):
    """进阶语法：string(.) 取 td 及其所有子孙节点的文本（含 <a>/<font> 内文本）。"""
    return td.xpath("string(.)").strip()


def main():
    resp = requests.get(URL, headers=HEADERS, timeout=20)
    print(f"[s03] GET {URL} -> status={resp.status_code}, len={len(resp.text)}")
    resp.raise_for_status()
    time.sleep(1)

    root = etree.HTML(resp.text)
    headers = ["".join(th.xpath('.//text()')).strip()
               for th in root.xpath('//table//thead//th')]

    rows = []
    for tr in root.xpath('//table//tbody/tr'):
        tds = tr.xpath('./td')
        cells = [cell_text(td) for td in tds]
        if len(cells) != len(headers):
            continue
        rec = dict(zip(headers, cells))
        # 进阶：提取 IP 单元格内 <a> 的 href，以及状态单元格 <font> 的颜色
        ip_td = tds[1]
        rec["ip_link"] = (ip_td.xpath('./a/@href') or [""])[0]
        status_font = tds[7].xpath('./font')
        rec["status_color"] = (status_font[0].get('color') if status_font else "")
        rows.append(rec)

    print(f"[s03] 表头: {headers}")
    print(f"[s03] 解析到 {len(rows)} 条记录")
    print(json.dumps(rows[:3], ensure_ascii=False, indent=2))

    # 进阶 xpath 谓词示例：只取“在线”设备
    online = root.xpath('//table//tbody/tr[td[8]//font[@color="green"]]')
    print(f"[s03] xpath 谓词筛选在线设备: {len(online)} 台")
    online_rows = []
    for tr in online:
        cells = [cell_text(td) for td in tr.xpath('./td')]
        online_rows.append(dict(zip(headers, cells)))
    print(json.dumps(online_rows, ensure_ascii=False, indent=2))
    return rows


if __name__ == "__main__":
    main()
