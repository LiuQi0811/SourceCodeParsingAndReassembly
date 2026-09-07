# -*- coding: utf-8 -*-
"""逆向实战配套：本地签名靶场（第 9 章练习用）。

pip install flask
python 08_flask_lab.py
然后浏览器打开 http://127.0.0.1:5000 ，F12 → Network 观察搜索请求。

这是为自己搭建的练习站，逆向它完全合法 :)
"""
import time

from flask import Flask, jsonify, request

app = Flask(__name__)

PAGE = """<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><title>Spider Lab 商城</title></head>
<body>
<h1>Spider Lab 商城（练习用）</h1>
<input id="kw" placeholder="输入商品关键词，如 cpu">
<button onclick="doSearch()">搜索</button>
<pre id="out"></pre>
<script>
// —— 以下签名代码经过“轻度混淆”，试着读懂它 ——
var _0x1 = "SPI" + "DER_" + "LAB";          // 常量被拆成了三段
function _0xs(a, b) {
  var h = 5381;
  var s = a + "|" + b + "|" + _0x1;
  for (var i = 0; i < s.length; i++) {
    h = (((h << 5) + h) + s.charCodeAt(i)) >>> 0;   // djb2 变体
  }
  return h.toString(16);
}
function doSearch() {
  var kw = document.getElementById("kw").value;
  var ts = Math.floor(Date.now() / 1000);
  fetch("/api/data?kw=" + encodeURIComponent(kw) + "&ts=" + ts + "&sign=" + _0xs(kw, ts))
    .then(r => r.json()).then(j => document.getElementById("out").textContent = JSON.stringify(j, null, 2));
}
</script>
</body></html>"""

ITEMS = {
    "cpu": [{"name": "CPU A", "price": 1999}, {"name": "CPU B", "price": 2599}],
    "gpu": [{"name": "GPU X", "price": 4999}, {"name": "GPU Y", "price": 6499}],
    "ram": [{"name": "RAM 16G", "price": 399}],
}

SECRET = "SPIDER_LAB"   # 与前端被拆开的 _0x1 拼回结果一致：SPI+DER_+LAB

def djb2(s: str) -> str:
    """服务端校验用的签名算法（与前端 JS 逻辑一致）。"""
    h = 5381
    for ch in s:
        h = (((h << 5) + h) + ord(ch)) & 0xFFFFFFFF
    return format(h, "x")

@app.get("/")
def index():
    return PAGE

@app.get("/api/data")
def api_data():
    kw = request.args.get("kw", "")
    ts = request.args.get("ts", "")
    sign = request.args.get("sign", "")
    if not kw or not ts or not sign:
        return jsonify(error="missing params"), 403
    if abs(time.time() - int(ts)) > 120:
        return jsonify(error="timestamp expired"), 403
    if djb2(f"{kw}|{ts}|{SECRET}") != sign:
        return jsonify(error="bad signature"), 403
    return jsonify(items=ITEMS.get(kw.lower(), []), note="签名校验通过！")

if __name__ == "__main__":
    app.run(debug=False)
