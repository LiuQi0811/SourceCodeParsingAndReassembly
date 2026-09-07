"""生成测试站点：把所有"藏资源"的写法都塞进去。"""

import base64
import io
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).parent
MEDIA = ROOT / "media"
MEDIA.mkdir(parents=True, exist_ok=True)
(ROOT / "sub").mkdir(exist_ok=True)


def make_image(name: str, size, color, fmt="JPEG", text=""):
    img = Image.new("RGB", size, color)
    draw = ImageDraw.Draw(img)
    # 1x1 这类极小图没有空间画边框和文字
    if size[0] > 12 and size[1] > 12:
        draw.rectangle([4, 4, size[0] - 5, size[1] - 5],
                       outline=(255, 255, 255), width=2)
    if text and size[0] > 80 and size[1] > 30:
        draw.text((12, 12), text, fill=(255, 255, 255))
    img.save(MEDIA / name, fmt)
    return name


# 正常尺寸的图
make_image("photo1.jpg", (800, 600), (30, 80, 180), "JPEG", "photo1 800x600")
make_image("photo2.png", (400, 300), (40, 150, 70), "PNG", "photo2 lazy")
make_image("photo3.webp", (1200, 900), (180, 50, 50), "WEBP", "photo3 2x")
make_image("poster.jpg", (640, 360), (120, 60, 170), "JPEG", "video poster")
make_image("bg.jpg", (1920, 1080), (200, 120, 40), "JPEG", "css background")
make_image("og.jpg", (1200, 630), (20, 160, 170), "JPEG", "og image")
make_image("sub1.jpg", (600, 400), (90, 90, 160), "JPEG", "sub page image")
# 1x1 占位图，用来验证 --min-size 过滤
make_image("tiny.gif", (1, 1), (255, 255, 255), "GIF", "")

# 内联 base64 图
buf = io.BytesIO()
Image.new("RGB", (48, 48), (220, 180, 60)).save(buf, "PNG")
inline_b64 = base64.b64encode(buf.getvalue()).decode()

INDEX = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<title>资源抓取测试站</title>
<meta property="og:image" content="/media/og.jpg">
<meta name="twitter:image" content="/media/og.jpg">
<link rel="stylesheet" href="/style.css">
<link rel="icon" href="/media/photo2.png">
</head>
<body>
<h1>mharvest 测试页</h1>

<!-- 1. 最老实的写法 -->
<img src="/media/photo1.jpg" alt="普通图片">

<!-- 2. 懒加载：真实站点最常见的坑 -->
<img class="lazy" data-src="/media/photo2.png" alt="懒加载图">
<img data-original="/media/photo3.webp" alt="另一种懒加载">

<!-- 3. srcset：一个标签多个 URL -->
<img src="/media/photo1.jpg"
     srcset="/media/photo1.jpg 1x, /media/photo3.webp 2x"
     alt="响应式图">

<!-- 4. picture / source -->
<picture>
  <source srcset="/media/photo3.webp" type="image/webp">
  <source srcset="/media/photo1.jpg" type="image/jpeg">
  <img src="/media/photo1.jpg" alt="picture 回退">
</picture>

<!-- 5. 视频 + 海报 + source 子标签 -->
<video controls poster="/media/poster.jpg" width="640">
  <source src="/media/clip.mp4" type="video/mp4">
</video>

<!-- 6. 音频 -->
<audio controls src="/media/sound.mp3"></audio>

<!-- 7. 指向资源的普通链接 -->
<a href="/media/clip.mp4">下载视频</a>
<a href="/media/photo3.webp">看大图</a>

<!-- 8. 内联样式里的背景图 -->
<div style="background-image: url('/media/bg.jpg'); width:300px; height:120px;">
  内联样式背景
</div>

<!-- 9. data: URI 内联图 -->
<img src="data:image/png;base64,{inline_b64}" alt="内联图">

<!-- 10. 占位图，用来验证 min-size -->
<img src="/media/tiny.gif" alt="1x1">

<!-- 11. JS 配置里藏的流地址（正则兜底的目标） -->
<script>
  window.__PLAYER__ = {{
    master: "/media/master.m3u8",
    encrypted: "/media/enc.m3u8",
    cover: "/media/poster.jpg"
  }};
</script>

<!-- 12. iframe 播放器 -->
<iframe src="/player.html" width="640" height="360"></iframe>

<!-- 13. 子页面 -->
<p><a href="/sub/page2.html">进入子页面</a></p>
<p><a href="https://external.invalid/other.jpg">站外图片（应被同域策略拦下）</a></p>
</body>
</html>
"""

PAGE2 = """<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>子页面</title>
<link rel="stylesheet" href="/style.css"></head>
<body>
<h1>子页面</h1>
<img src="/media/sub1.jpg" alt="子页图片">
<img src="/media/photo1.jpg" alt="与首页重复，验证内容去重">
<video src="/media/clip.mp4" controls width="480"></video>
<p><a href="/">回首页</a></p>
</body></html>
"""

PLAYER = """<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>播放器</title></head>
<body>
<video id="v" controls></video>
<script src="/media/master.m3u8"></script>
<script>
  var src = "http://127.0.0.1:8877/media/enc.m3u8";
</script>
</body></html>
"""

CSS = """
body { font-family: sans-serif; }
.hero { background-image: url(/media/bg.jpg); }
.icon { background: url("/media/photo2.png") no-repeat; }
@font-face {
  font-family: 'Demo';
  src: url('/media/photo2.png') format('png');
}
.bad { background: linear-gradient(#fff, #000); }
.data-bg { background-image: url(data:image/gif;base64,R0lGODlhAQABAAAAACw=); }
"""

(ROOT / "index.html").write_text(INDEX, encoding="utf-8")
(ROOT / "sub" / "page2.html").write_text(PAGE2, encoding="utf-8")
(ROOT / "player.html").write_text(PLAYER, encoding="utf-8")
(ROOT / "style.css").write_text(CSS, encoding="utf-8")

print("生成完成：")
for f in ("index.html", "sub/page2.html", "player.html", "style.css"):
    print("  ", f, (ROOT / f).stat().st_size, "字节")
print("  媒体文件：", sorted(p.name for p in MEDIA.iterdir()))
