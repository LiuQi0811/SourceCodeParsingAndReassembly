#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
导出城通网盘下载链接工具
从元数据JSON中提取所有下载链接，可导出为：
- TXT纯链接列表（导入IDM/迅雷等下载器）
- HTML页面（可在浏览器中批量打开）
"""

import os
import json
import argparse

OUTPUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "novels")


def export_to_txt(cat_filter=None, output=None):
    """导出纯链接列表，每行一个URL"""
    json_path = os.path.join(OUTPUT_DIR, "novels_metadata.json")
    if not os.path.exists(json_path):
        print(f"[!] 元数据文件不存在: {json_path}")
        print("    请先运行爬虫: python txtxiaoshuo_spider.py")
        return

    with open(json_path, "r", encoding="utf-8") as f:
        novels = json.load(f)

    if cat_filter:
        novels = [n for n in novels if n.get("category") == cat_filter or str(n.get("category_id")) == str(cat_filter)]

    if not output:
        output = os.path.join(OUTPUT_DIR, "download_links.txt")

    with open(output, "w", encoding="utf-8") as f:
        for n in novels:
            url = n.get("download_url", "")
            name = n.get("name", "未知")
            author = n.get("author", "")
            if url:
                # 确保密码在URL中
                if "p=" not in url:
                    url += ("&" if "?" in url else "?") + "p=txtxiaoshuo"
                f.write(f"{url}\n")
                # 也保存书名到单独的映射文件
                f.write(f"# {name} - {author}\n")

    print(f"[+] 已导出 {len([n for n in novels if n.get('download_url')])} 个下载链接到: {output}")
    print(f"[+] 提示: 可将TXT文件导入IDM/迅雷等下载器批量下载")
    print(f"[+] 或者在浏览器中打开链接手动下载(密码已自动填充)")


def export_to_html(output=None):
    """导出为HTML页面，可直接点击下载"""
    json_path = os.path.join(OUTPUT_DIR, "novels_metadata.json")
    if not os.path.exists(json_path):
        print(f"[!] 元数据文件不存在: {json_path}")
        return

    with open(json_path, "r", encoding="utf-8") as f:
        novels = json.load(f)

    if not output:
        output = os.path.join(OUTPUT_DIR, "download_page.html")

    # 按分类分组
    categories = {}
    for n in novels:
        cat = n.get("category", "其他")
        categories.setdefault(cat, []).append(n)

    html = """<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <title>txt小说网 - 批量下载页</title>
    <style>
        body { font-family: "Microsoft YaHei", sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; background: #f5f5f5; }
        h1 { color: #333; text-align: center; }
        .cat-section { background: white; margin: 20px 0; padding: 20px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
        .cat-title { color: #009999; border-bottom: 2px solid #009999; padding-bottom: 10px; }
        .novel-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 15px; margin-top: 15px; }
        .novel-card { border: 1px solid #e0e0e0; border-radius: 6px; padding: 12px; transition: all 0.2s; }
        .novel-card:hover { border-color: #009999; box-shadow: 0 2px 12px rgba(0,153,153,0.2); }
        .novel-name { font-weight: bold; font-size: 15px; color: #333; margin-bottom: 5px; }
        .novel-author { color: #666; font-size: 13px; margin-bottom: 8px; }
        .novel-size { color: #999; font-size: 12px; margin-bottom: 10px; }
        .download-btn { display: inline-block; background: #009999; color: white; padding: 6px 16px; border-radius: 4px; text-decoration: none; font-size: 13px; }
        .download-btn:hover { background: #007777; }
        .tip { background: #fff3cd; border: 1px solid #ffc107; padding: 15px; border-radius: 6px; margin-bottom: 20px; }
    </style>
</head>
<body>
    <h1>📚 txt小说网 批量下载页</h1>
    <div class="tip">
        <strong>使用说明：</strong>点击"下载"按钮打开城通网盘页面，密码已自动填充，点击"普通下载"→"立即下载"即可。
        所有链接共享密码：<code>txtxiaoshuo</code>
    </div>
"""

    for cat_name, cat_novels in categories.items():
        html += f'    <div class="cat-section">\n'
        html += f'        <h2 class="cat-title">{cat_name} ({len(cat_novels)}本)</h2>\n'
        html += f'        <div class="novel-grid">\n'
        for n in cat_novels:
            url = n.get("download_url", "")
            if not url:
                continue
            if "p=" not in url:
                url += ("&" if "?" in url else "?") + "p=txtxiaoshuo"
            html += f'''            <div class="novel-card">
                <div class="novel-name">{n.get('name', '未知')}</div>
                <div class="novel-author">作者：{n.get('author', '未知')}</div>
                <div class="novel-size">大小：{n.get('file_size', '未知')} | {n.get('status', '')}</div>
                <a class="download-btn" href="{url}" target="_blank">🔽 下载</a>
            </div>
'''
        html += f'        </div>\n    </div>\n'

    html += """</body>
</html>"""

    with open(output, "w", encoding="utf-8") as f:
        f.write(html)

    print(f"[+] 已生成HTML下载页面: {output}")
    print(f"[+] 共 {len(novels)} 本小说，用浏览器打开该页面即可点击下载")


def main():
    parser = argparse.ArgumentParser(description="导出城通网盘下载链接")
    parser.add_argument("--format", choices=["txt", "html", "both"], default="both", help="导出格式")
    parser.add_argument("--category", default=None, help="按分类筛选（分类名或分类ID）")
    args = parser.parse_args()

    if args.format in ("txt", "both"):
        export_to_txt(args.category)
    if args.format in ("html", "both"):
        export_to_html()


if __name__ == "__main__":
    main()
