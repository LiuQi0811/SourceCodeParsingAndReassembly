# 拾光壁纸 (gallery.timeline.ink) 全站爬虫

完美逆向 AES-CBC 加密的图片URL，自动设备指纹注册，支持全量/分类/专题/图源抓取与下载。

## 逆向分析总结

### 1. 设备注册（必须先调用）
```
POST https://api.nguaduot.cn/appstats/web
Headers:
  Timeline-Client: timelineweb
  Timeline-Device: <32位MD5设备指纹>
Body (JSON): {"screenw":1920,"screenh":1080,"dpr":1,"timezone":"Asia/Shanghai","lang":"zh-CN"}
```
未注册设备直接请求列表API会返回「无访问权限」。

### 2. 列表API
| 页面 | API端点 |
|---|---|
| 专题首页 | `https://api.nguaduot.cn/snake/v4/topic?stock=10&mobile=0&keyword=` |
| 图源列表 | `https://api.nguaduot.cn/snake/v4/cover` |
| 最新 | `https://api.nguaduot.cn/snake/v4?order=date&seed=<ms时间戳>&no={no}&id={id}&catehow=&catewhat=` |
| 热门 | `https://api.nguaduot.cn/snake/v4?order=score&no={no}&id={id}&catehow=&catewhat=` |
| 随机 | `https://api.nguaduot.cn/snake/v4?order=random&seed=<ms时间戳>&no=99999999&id=&catehow=&catewhat=` |
| 专题内容 | `https://api.nguaduot.cn/snake/v4?order=date&seed=<ms>&no={no}&id={id}&catehow=&catewhat=&topic=<urlencoded>` |

分页：`no` 参数是游标，首次传 `99999999`，后续用本页最小 `no - 1`。

### 3. URL加密解密（完美逆向 en.min.js）
部分图源（wallhaven/wallpaperup/huamao/qingbiz等代理图源）的图片URL文件名经过AES-CBC加密：
- **密钥 (Key)**：`rawprovider` 字段（图源标识，如"wallhaven"），取 `(key*16).slice(-16)` 作为AES Key
- **IV**：`md5(key).slice(8,24)`（16字节）
- **模式**：AES-CBC, ZeroPadding
- **密文**：文件名主干的前32字符（HEX编码），解密后与剩余部分拼接

JS原版逻辑（en.min.js）：
```js
function decryptAes(t, e) {
  e = e.repeat(16).slice(-16);
  let r = encryptMd5(e).slice(8, 24);
  let n = CryptoJS.enc.Base64.stringify(CryptoJS.enc.Hex.parse(t));
  let i = CryptoJS.AES.decrypt(n, CryptoJS.enc.Utf8.parse(e), {
    iv: CryptoJS.enc.Utf8.parse(r), mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.ZeroPadding
  });
  return i.toString(CryptoJS.enc.Utf8);
}
```

### 4. 防盗链处理
- `c-ssl.dtstatic.com` / `c-ssl.duitang.com`：带 `Referer: https://gallery.timeline.ink/` 会被403，需用 `Referer: https://www.duitang.com/` 或不带Referer
- 其他CDN通用：不带Referer或浏览器UA即可

## 安装依赖

```bash
pip install requests pycryptodome
```

## 使用方法

```bash
# 全站抓取（最新+热门+随机+所有专题），默认下载原图到 ./wallpapers/
python3 gallery_crawler.py

# 只抓最新
python3 gallery_crawler.py --mode latest

# 只抓热门
python3 gallery_crawler.py --mode hot

# 只抓随机
python3 gallery_crawler.py --mode rand

# 抓取专题（默认全部专题）
python3 gallery_crawler.py --mode topics --max-topics 10   # 只抓前10个专题

# 列出图源
python3 gallery_crawler.py --mode providers

# 只抓元数据不下载图片
python3 gallery_crawler.py --no-download

# 自定义保存目录和并发数
python3 gallery_crawler.py -o /path/to/save -w 16
```

## 命令行参数

| 参数 | 说明 |
|---|---|
| `-o, --output` | 保存目录 (默认: ./wallpapers) |
| `-w, --workers` | 下载并发数 (默认: 8) |
| `--no-download` | 仅抓取元数据不下载图片 |
| `--no-topics` | 跳过专题抓取 |
| `--max-topics N` | 最多抓取N个专题(0=全部) |
| `--mode` | 抓取模式: all/latest/hot/rand/topics/providers (默认: all) |

## 文件结构
```
wallpapers/
├── latest/           # 最新壁纸（按图源分目录）
│   ├── wallhaven/
│   ├── unsplash/
│   └── ...
├── hot/              # 热门壁纸
├── rand/             # 随机壁纸
├── topics/           # 专题壁纸（按专题名分目录）
│   ├── 风光摄影/
│   ├── 原神/
│   └── ...
└── metadata.json     # 所有壁纸元数据（含标题/分辨率/图源/URL等）
```

## API 调用代码直接使用

```python
from gallery_crawler import GalleryCrawler, decrypt_url

crawler = GalleryCrawler(save_dir="./wallpapers")
items = crawler.fetch_latest(max_pages=5)   # 抓最新5页(400张)
crawler.download_all(items, "latest")       # 下载原图
```
