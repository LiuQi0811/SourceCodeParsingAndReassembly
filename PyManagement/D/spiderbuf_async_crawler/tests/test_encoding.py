"""自测：字符集自动识别与编解码（gbk/utf8 兼容、中文不乱码）。"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from core.encoding import decode_bytes, detect_encoding


def test_gbk_meta() -> None:
    html = ('<html><head><meta charset="gbk"></head><body>'
            '<p>中文测试：你好，世界</p></body></html>').encode("gbk")
    enc = detect_encoding({"Content-Type": "text/html"}, html)
    assert enc in ("gbk", "gb18030"), f"应识别 gbk，实际 {enc}"
    text, used = decode_bytes(html)
    assert "你好，世界" in text, "中文应无乱码"
    assert used == "gbk"
    print(f"  ✔ gbk 页面: enc={used}, 中文无损")


def test_gbk_http_header() -> None:
    body = "内容标题".encode("gb18030")
    enc = detect_encoding({"Content-Type": "text/html; charset=gb18030"}, body)
    assert enc == "gb18030"
    print(f"  ✔ HTTP 头 charset=gb18030: enc={enc}")


def test_utf8_utf16_bom() -> None:
    assert detect_encoding(None, "你好".encode("utf-8")) == "utf-8"
    assert detect_encoding(None, b"\xef\xbb\xbfhello") == "utf-8-sig"
    assert detect_encoding(None, "你好".encode("utf-16")) == "utf-16"
    print("  ✔ utf-8 / utf-8-sig(BOM) / utf-16(BOM)")


def test_force_encoding() -> None:
    raw = "中文測試".encode("big5")
    text, used = decode_bytes(raw, force_encoding="big5")
    assert "中文測試" in text
    print(f"  ✔ 强制 big5: used={used}")


if __name__ == "__main__":
    test_gbk_meta()
    test_gbk_http_header()
    test_utf8_utf16_bom()
    test_force_encoding()
