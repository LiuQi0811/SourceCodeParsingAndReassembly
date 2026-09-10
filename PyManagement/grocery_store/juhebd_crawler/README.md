# juhebd.com 全站爬虫（已完成前端逆向解密）

## 逆向分析说明

### 站点结构
| 站点 | 域名 | 技术栈 | 认证 |
|------|------|--------|------|
| 主站 | https://www.juhebd.com | 传统 SSR（Bootstrap+jQuery+Layui） | 无需登录 |
| 资源子站 | https://res.juhebd.com | Vue3 + RuoYi 后台管理系统 | JWT 登录 |

### 栏目
- `/mv` 电影
- `/tv` 剧集
- `/acg` 动漫
- `/q/?k=关键词` 搜索

### 前端链接加密算法（已完整逆向）

旧版主站直接在详情页渲染加密的下载链接字段 `diskUrls` / `urls` / `adsUrls`。
从 `/js/front.js?v=260613` 中 `bdfilm.downurl.init()` 逆向得到：

```js
// 前端原始解密代码
urls.split("").reverse().join("")      // 1. 字符串反转
decode64(...)                          // 2. Base64 解码
utf8ToUtf16(...)                       // 3. 逐字节还原为 UTF-8 字符串
.split("###")                          // 4. 按 ### 分割
```

Python 实现：
```python
def decode_ciphertext(cipher: str) -> str:
    reversed_str = cipher[::-1]                              # 反转
    reversed_str = reversed_str.replace("-","+").replace("_","/")
    pad = (-len(reversed_str)) % 4
    reversed_str += "=" * pad
    raw_bytes = base64.b64decode(reversed_str)               # Base64
    return bytes([b for b in raw_bytes]).decode("utf-8", errors="replace")
```

### 网盘链接格式
- `密码||URL` （含提取码）
- 直接 URL（无密码）
- 网盘类型自动识别：夸克 / 百度 / 迅雷
- 直链自动识别 ed2k（含文件名+大小）/ magnet（dn 参数）/ ftp / http

### 新版（res 子站）
主站详情页底部有：
```js
document.querySelector('#res').href = 'https://res.juhebd.com/r?Uak0';
```
资源子站使用 RuoYi-Vue 框架，流程：
1. `GET /captchaImage` 获取验证码 + uuid
2. `POST /login` 携带 username/password/code/uuid 获取 JWT token
3. 后续接口加 `Authorization: Bearer {token}` 请求
4. 业务接口前缀推测为 `/film/resource/...`（路由从打包 JS 的 `views/film/resource` 目录得出）

代码中已内置多种可能的接口路径探测，若后端路径有调整可在 `ResClient.fetch_resource_by_code()` 中添加。

## 使用方法

### 1. 安装依赖
```bash
pip install -r requirements.txt
```

### 2. 仅爬主站（列表+详情+元数据，不含网盘密码）
```bash
python juhebd_crawler.py --main-only --max-pages 10
```
产物：`juhebd_all.json`

### 3. 爬主站 + 登录资源站抓真实下载链接
```bash
python juhebd_crawler.py -u 你的账号 -p 你的密码 --max-pages 20 --workers 8
```
运行时若出现验证码，会弹出图片并在终端提示输入，登录后自动抓取所有详情的真实资源。

### 4. 关键词搜索
```bash
python juhebd_crawler.py --search "八仙" -o result.json
```

### 5. 指定栏目
```bash
python juhebd_crawler.py --main-only --categories mv tv   # 只爬电影和剧集
```

## 输出字段说明
每条记录包含：
- `category` / `category_name` 栏目
- `code` 页面短码
- `title` 标题
- `detail_url` 详情页地址
- `year` 年份
- `douban_rating` / `imdb_rating` 评分
- `poster` 海报
- `description` 简介
- `directors` / `actors` / `tags` 导演/演员/类型
- `screenshots` 剧照
- `res_url` 资源子站入口
- `pan_links` 网盘链接（若主站直接暴露了加密字段）
- `direct_links` 直链/magnet/ed2k（同上）
- `res_data` 资源子站返回的结构化资源数据（登录后）

## 文件清单
- `juhebd_crawler.py` —— 主爬虫脚本
- `requirements.txt` —— Python 依赖
- `README.md` —— 本说明
