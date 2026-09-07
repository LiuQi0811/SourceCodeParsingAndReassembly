"""构造 blob / MSE 视频场景的测试页。

真实站点的播放器几乎都用 MediaSource：JS 把分片下载下来，
用 appendBuffer 喂给浏览器，video.src 最终是一个 blob: 地址。

这里做两个版本，用来对比抓取难度：
  mse_simple.html  分片地址硬编码在 JS 数组里（静态扫描能找到）
  mse_api.html     分片地址由接口动态返回（静态扫描完全看不到）
"""

import json
from pathlib import Path

ROOT = Path(__file__).parent
MEDIA = ROOT / "media"

# fMP4 分片清单，两个页面共用
segments = sorted(p.name for p in MEDIA.glob("fmp4_seg_*.m4s"))
print(f"检测到 {len(segments)} 个 fMP4 分片")

# ---------- 版本一：地址写在 JS 里 ----------
SIMPLE = """<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="utf-8"><title>MSE 播放器（地址硬编码）</title></head>
<body>
<h1>MediaSource 播放器 · 版本一</h1>
<p>video.src 是 blob: 地址，真实分片在 JS 数组里。</p>
<p><button id="play">点我开始播放</button> <span id="stat">未开始</span></p>
<video id="v" controls width="720"></video>

<script>
var SEGMENTS = __SEGMENTS__;
var INIT = "/media/fmp4_init.mp4";

document.getElementById('play').onclick = function () {
  var video = document.getElementById('v');
  var ms = new MediaSource();
  // 关键：video 的 src 是浏览器内存里的 blob 引用，服务端不存在这个 URL
  video.src = URL.createObjectURL(ms);

  ms.addEventListener('sourceopen', async function () {
    var sb = ms.addSourceBuffer('video/mp4; codecs="avc1.64001f,mp4a.40.2"');
    var stat = document.getElementById('stat');

    // 先喂初始化段，没有它后面的分片全是废数据
    var initBuf = await (await fetch(INIT)).arrayBuffer();
    sb.appendBuffer(initBuf);

    for (var i = 0; i < SEGMENTS.length; i++) {
      var url = "/media/" + SEGMENTS[i];
      var buf = await (await fetch(url)).arrayBuffer();
      sb.appendBuffer(buf);
      stat.textContent = "已加载 " + (i + 1) + "/" + SEGMENTS.length;
    }
    video.play();
  });
};
</script>
</body></html>
"""

# ---------- 版本二：地址由接口动态返回 ----------
API = """<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="utf-8"><title>MSE 播放器（地址来自接口）</title></head>
<body>
<h1>MediaSource 播放器 · 版本二</h1>
<p>video.src 是 blob: 地址，分片地址由 <code>/api/segments.json</code> 动态返回，
<b>页面源码里一个 .m4s 都搜不到</b>。</p>
<p><button id="play">点我开始播放</button> <span id="stat">未开始</span></p>
<video id="v" controls width="720"></video>

<script>
// 真实站点的常见做法：播放地址走接口，且往往带签名、有时效
fetch('/api/segments.json').then(function (r) { return r.json(); })
  .then(function (cfg) {
    window.__CFG__ = cfg;
    document.getElementById('stat').textContent =
      '已获取配置，' + cfg.segments.length + ' 个分片';
  });

document.getElementById('play').onclick = function () {
  var cfg = window.__CFG__;
  if (!cfg) return;

  var video = document.getElementById('v');
  var ms = new MediaSource();
  video.src = URL.createObjectURL(ms);

  ms.addEventListener('sourceopen', async function () {
    var sb = ms.addSourceBuffer('video/mp4; codecs="avc1.64001f,mp4a.40.2"');
    var stat = document.getElementById('stat');

    var initBuf = await (await fetch(cfg.init)).arrayBuffer();
    sb.appendBuffer(initBuf);

    for (var i = 0; i < cfg.segments.length; i++) {
      var buf = await (await fetch(cfg.segments[i])).arrayBuffer();
      sb.appendBuffer(buf);
      stat.textContent = "已加载 " + (i + 1) + "/" + cfg.segments.length;
    }
    video.play();
  });
};
</script>
</body></html>
"""

(ROOT / "mse_simple.html").write_text(
    SIMPLE.replace("__SEGMENTS__", json.dumps(segments)), encoding="utf-8")
(ROOT / "mse_api.html").write_text(API, encoding="utf-8")

# 接口返回的分片配置
api_payload = {
    "init": "/media/fmp4_init.mp4",
    "segments": [f"/media/{name}" for name in segments],
    "note": "模拟真实站点的播放地址接口，通常还会带签名和有效期",
}
(ROOT / "api").mkdir(exist_ok=True)
(ROOT / "api" / "segments.json").write_text(
    json.dumps(api_payload, ensure_ascii=False, indent=2), encoding="utf-8")

print("已生成：mse_simple.html / mse_api.html / api/segments.json")
