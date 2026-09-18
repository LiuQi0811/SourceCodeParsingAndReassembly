"""自测：三种解析器 + 组合（bs4 / xpath / re / composite）。"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from core.factories import ParserFactory

HTML = """
<!DOCTYPE html>
<html><head><meta charset="gbk"><title>测试页面</title></head>
<body>
<h1>标题一</h1>
<a href="/page/1">第一页</a>
<a href="https://other.com/x">外部</a>
<a href="javascript:void(0)">忽略</a>
<img src="/img/a.png" alt="图片A">
<img src="/img/b.jpg" alt="图片B">
<table id="t">
  <thead><tr><th>姓名</th><th>分数</th></tr></thead>
  <tbody>
    <tr><td>张三</td><td>90</td></tr>
    <tr><td>李四</td><td>85</td></tr>
  </tbody>
</table>
<div class="card">卡1</div>
<div class="card">卡2</div>
</body></html>
"""

BASE = "https://example.com/"


def test_bs4() -> None:
    p = ParserFactory.create("bs4")
    r = p.parse(HTML, url=BASE)
    assert r.title == "测试页面"
    assert "https://example.com/page/1" in r.links
    assert "https://other.com/x" in r.links
    assert all(not l.startswith("javascript") for l in r.links)
    imgs = [res for res in r.resources if res.kind.value == "images"]
    assert len(imgs) == 2
    assert imgs[0].url == "https://example.com/img/a.png"
    rows = r.data.get("table", [])
    assert len(rows) == 2 and rows[0]["姓名"] == "张三"
    print(f"  ✔ bs4: title={r.title}, links={len(r.links)}, 资源={len(r.resources)}, 表={len(rows)}行")


def test_xpath() -> None:
    p = ParserFactory.create("xpath", {
        "xpath": {"卡片": "//div[@class='card']/text()"},
        "links_xpath": "//a/@href",
    })
    r = p.parse(HTML, url=BASE)
    assert r.data["fields"]["卡片"] == ["卡1", "卡2"]
    assert len(r.links) == 2  # javascript 被过滤
    print(f"  ✔ xpath: 字段={r.data['fields']}, links={len(r.links)}")


def test_re() -> None:
    p = ParserFactory.create("re", {
        "patterns": {"分数": r"<td>(\d+)</td>"},
    })
    r = p.parse(HTML, url=BASE)
    assert r.data["fields"]["分数"] == ["90", "85"]
    assert len(r.links) == 2
    print(f"  ✔ re: 字段={r.data['fields']}, links={len(r.links)}")


def test_composite() -> None:
    p = ParserFactory.create("composite", {
        "parsers": [
            {"name": "bs4", "config": {"table": True}},
            {"name": "xpath", "config": {"xpath": {"卡片": "//div[@class='card']/text()"}}},
            {"name": "re", "config": {"patterns": {"分数": r"<td>(\d+)</td>"}}},
        ]
    })
    r = p.parse(HTML, url=BASE)
    assert len(r.data["table"]) == 2
    assert r.data["fields"]["卡片"] == ["卡1", "卡2"]
    assert r.data["fields"]["分数"] == ["90", "85"]
    # 资源/链接合并去重
    assert len(r.links) == 2
    assert len(r.resources) == 2
    print(f"  ✔ composite: 表格+字段合并 = {sorted(r.data.keys())}")


if __name__ == "__main__":
    test_bs4()
    test_xpath()
    test_re()
    test_composite()
