# Anime1.me 全站爬蟲下載工具

## 逆向分析報告

通過對網站前端 JavaScript 的完整逆向分析，已完美解析視頻獲取流程：

| 環節 | 地址 | 方法 |
|------|------|------|
| 動畫列表 | `https://anime1.me/animelist.json` | GET，返回 JSON，共 1913 部作品 |
| 分類/集數頁 | `https://anime1.me/?cat={cid}` | GET，HTML 中每個 `<article>` 含一個 `<video>` 標籤 |
| **加密參數** | video 標籤的 `data-apireq` 屬性 | 伺服器預簽名的 JSON：`{"c":cid,"e":ep,"t":ts,"p":0,"s":md5}` |
| 視頻源 API | `https://v.anime1.me/api` | POST，body=`d={urlencoded_apireq}`，返回 MP4 直鏈 |
| 18+ 內容 | `https://anime1.pw/`（姊妹站） | 結構完全相同，API 為 `v.anime1.pw/api` |

**關鍵逆向發現**：`data-apireq` 中的 `s` 字段（32位MD5簽名）由**伺服器端**在渲染 HTML 時
直接生成並嵌入，前端 JS 只是讀取該屬性原樣發送給 API，**無需本地計算簽名**。
爬蟲只需從 HTML 中提取該參數原樣 POST 即可拿到視頻地址，完全規避了 JS 逆向算簽名的問題。

## 功能特性

- ✅ 完美逆向加密參數，**無需 JS 執行環境**，純 Python requests 即可
- ✅ 全站 1913 部動畫一鍵抓取
- ✅ 支持中斷後續傳（Range 頭）
- ✅ 自動跳過已下載的完整文件
- ✅ 支持按年份/季節/分類ID篩選
- ✅ 可選元數據-only 模式（僅建立索引不下載）
- ✅ 支持 R18 站（anime1.pw，需加 --r18）
- ✅ 自動重試機制
- ✅ 實時進度條顯示
- ✅ 元數據保存為 JSON，方便後續管理

## 環境要求

```bash
pip install requests beautifulsoup4
```

## 使用方法

```bash
# 1. 快速測試：僅抓取一部作品的元數據（不下載）
python anime1_spider.py --metadata-only --cat 1951

# 2. 下載單部動畫（例如 cat=1951）
python anime1_spider.py --cat 1951

# 3. 下載 2026 年夏季新番
python anime1_spider.py --year 2026 --season 夏

# 4. 僅抓取全站元數據索引（快速，幾分鐘完成）
python anime1_spider.py --metadata-only -o ./anime1_all

# 5. 全站批量下載（注意：數據量很大，約數 TB 級，建議搭配篩選）
python anime1_spider.py -o ./anime1_all --workers 3

# 6. 包含 R18 內容
python anime1_spider.py --r18 --cat 62

# 7. 測試：只處理前 3 部
python anime1_spider.py --max 3 -o ./test
```

## 參數說明

| 參數 | 說明 |
|------|------|
| `-o, --output` | 下載目錄（默認 `./anime1_downloads`） |
| `-j, --workers` | 併發線程數（默認 3，建議不要太高避免被封） |
| `--cat` | 指定分類 ID（動畫編號） |
| `--year` | 按年份篩選，如 `2026` |
| `--season` | 按季節篩選：`春`/`夏`/`秋`/`冬` |
| `--r18` | 包含 R18 內容（anime1.pw） |
| `--metadata-only` | 僅抓取元數據，不下載視頻 |
| `--max` | 最多處理 N 部作品（用於測試） |
| `--timeout` | 請求超時秒數（默認 120） |
| `--retries` | 失敗重試次數（默認 3） |
| `--delay` | 請求間隔秒數（默認 0.8，建議不要設太低） |

## 目錄結構

```
anime1_downloads/
├── metadata.json                        # 所有元數據（視頻URL、本地路徑等）
├── [2026][夏][桜都] 躲在超市後門抽菸的兩人/
│   ├── 躲在超市後門抽菸的兩人 [01].mp4
│   ├── 躲在超市後門抽菸的兩人 [02].mp4
│   └── ...
├── [2026][夏][] GRAND BLUE 碧藍之海 第三季/
│   └── ...
└── ...
```

## metadata.json 格式

```json
{
  "1951": {
    "title": "躲在超市後門抽菸的兩人",
    "year": "2026",
    "season": "夏",
    "group": "桜都",
    "r18": false,
    "dir": "/path/to/[2026][夏][桜都] 躲在超市後門抽菸的兩人",
    "episodes": [
      {
        "ep": "1",
        "title": "躲在超市後門抽菸的兩人 [01]",
        "url": "https://bocchi.v.anime1.me/1951/1.mp4",
        "file": "/path/to/.../xxx.mp4"
      }
    ]
  }
}
```

## 注意事項

1. **版權聲明**：本工具僅供學習研究使用，請遵守當地法律法規，下載內容請在 24 小時內刪除。
2. **請求頻率**：默認 delay=0.8s，建議不要大幅降低，避免對網站伺服器造成壓力或被封 IP。
3. **磁碟空間**：全站視頻體積非常大（每集約 70-300MB，1900+部×平均12集 ≈ 數 TB），
   強烈建議搭配 `--year`/`--season`/`--cat` 篩選下載。
4. **簽名有效期**：`data-apireq` 中的時間戳 `t` 由伺服器生成，只要拿到 HTML 後立即
   調用 API 即可，已測試在數小時內均有效。爬蟲是邊抓邊用，不存在過期問題。
