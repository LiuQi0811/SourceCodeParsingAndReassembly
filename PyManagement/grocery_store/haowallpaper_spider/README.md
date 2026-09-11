# 哲风壁纸 (haowallpaper.com) 全站爬虫

## 逆向成果

代码已完美绕过/复现网站全部前端保护：

| 保护机制 | 逆向结果 |
|---|---|
| API 通信加密 | **AES-128-CBC + PKCS7** <br>Key=`68zhehao2O776519` / IV=`aa176b7519e84710`<br>请求体 AES 加密后 hex → base64 放入 `?data=` 参数；响应 `data` 字段同样解密 |
| 匿名鉴权 | 请求头 `token: ack:<32位随机hex>`（游客身份，JS 自动生成） |
| ALTCHA PoW 反爬 | SHA-256 工作量证明：GET `/pc/certify/challenge` 拿题，本地 0.2 秒内爆搜 `number ∈ [0,160000]` 使 `SHA256(salt+number)==challenge`，POST 验证后复用同一 session 直连原图 |
| 直链时效签名 | `down.haowallpaper.com/...?zfsign=...` 签名 URL，拿到后立即下载 |

**已验证能下载 4K 原图 (4096×2306 PNG) 及 4K 视频壁纸（MP4）**。

## 文件清单
- `hao_spider.py` —— 爬虫主程序
- `wallpapers/` —— 测试下载目录（含 3 个真实原图/视频样本 + 元数据）
- `README.md` —— 本说明

## 安装依赖
```bash
pip install requests pycryptodome
```

## 使用
```bash
# 默认：从第1页爬取，保存到 ./wallpapers
python3 hao_spider.py

# 指定页码范围
python3 hao_spider.py --start 1 --end 10

# 只抓元数据（不下载原图，用于收集索引）
python3 hao_spider.py --only-list

# 慢爬（防止触发限频）
python3 hao_spider.py --delay 2.0 --out ./my_wallpapers
```

## 输出结构
```
wallpapers/
├── _downloaded.txt          # 已下载 fileId 记录（支持断点续爬）
├── _meta/
│   ├── page_1.json          # 每页原始元数据（含所有字段）
│   └── 15789130517090624.json
├── 15789130517090624_4096x2306_党徽_....png
└── 17603630336822656_3840x2160_....mp4
```

## 核心接口
| 接口 | 方法 | 说明 |
|---|---|---|
| `/pc/wallpaper/wallpaperList` | GET | 壁纸列表（参数 AES 加密放 `?data=`）|
| `/pc/wallpaper/getWallpaperDetails/{type}/{wtId}` | GET | 详情（type=1 PC / 2 手机 / 3 视频）|
| `/common/file/getCompleteUrl/{wtId}` | GET | 原图直链（需过 ALTCHA）|
| `/pc/certify/challenge` | GET | 取 PoW 挑战 |
| `/pc/certify/verify` | POST | 提交 PoW 结果 |
| `/common/file/getCroppingImg/{fileId}` | GET | 缩略图（890×501 webp）|
| `/common/file/previewFileImg/{fileId}` | GET | 预览图（1100×619 webp）|

## 注意事项
1. **游客每日下载次数上限**：未登录用户每天只有少量下载配额，触发后会返回 `访客今日下载次数上限`。这是业务规则，不是反爬。若要全量下载，可以：
   - 多轮隔天运行（脚本自带断点续爬）；
   - 用浏览器登录后把 `token` 替换成真实用户 token。
2. 脚本会自动保存进度到 `_downloaded.txt`，中断后再次运行自动跳过已下载项。
3. 建议 `--delay` 设 1~2 秒，避免过快触发风控。
