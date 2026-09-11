# 📚 知识酷(zhishikoo.com)全站爬虫使用说明

## 🔓 逆向分析结论
**重要：该网站完全不需要逆向解密！**

经过完整的逆向分析确认：
1. ✅ 所有百度网盘链接、提取码、解压密码**全部明文写在HTML源码中**
2. ✅ 没有JS加密混淆、没有点击触发解密、没有动态加载
3. ✅ 没有加密参数、没有签名算法
4. ⚠️ 唯一防护：Cloudflare 5秒盾（访问层防护，不是内容加密）

**证据**：打开任意书籍详情页，右键"查看网页源代码"，Ctrl+F搜索`pan.baidu.com`，可以直接看到网盘链接和提取码，这就是明文！

---

## 🚀 两种运行方案（任选其一）

### 方案一：自动浏览器验证（推荐，零配置）
1. 安装依赖：
```bash
pip install -r requirements.txt
```
2. 确保电脑已安装Chrome浏览器
3. 直接运行爬虫：
```bash
python zhishikoo_crawler.py
```
4. 首次运行遇到Cloudflare时，会**自动弹出Chrome窗口**完成验证，之后Cookies会自动保存，后续运行直接使用

### 方案二：手动导出Cookies（极速模式，速度最快）
1. 用Chrome/Edge浏览器打开 https://www.zhishikoo.com
2. 等待Cloudflare验证通过，正常看到网站内容
3. 安装浏览器插件「EditThisCookie」
4. 点击插件 → 导出Cookies（JSON格式）
5. 保存为`cookies.json`放到爬虫同目录
6. 运行爬虫即可极速抓取，不会再遇到验证

---

## ✨ 爬虫功能
- ✅ 全站5大分类+最新发布区自动遍历
- ✅ 自动提取：书名、作者、出版社、ISBN、封面、发布时间、浏览量
- ✅ 自动提取：百度网盘链接、提取码、解压密码
- ✅ 断点续爬（中途关闭不丢数据）
- ✅ 自动限速（2-4秒请求间隔，友好不封IP）
- ✅ 失败自动重试
- ✅ 导出格式：Excel(.xlsx)、CSV、JSON
- ✅ 自动去重

---

## 📁 输出文件
运行后会生成`zhishikoo_data`目录，包含：
- `知识酷书籍大全_时间.xlsx` - Excel表格，方便筛选查看
- `知识酷书籍大全_时间.csv` - CSV格式
- `知识酷书籍大全_时间.json` - 完整JSON数据
- `progress.json` - 断点续爬进度文件

---

## 📋 Excel字段说明
| 字段 | 说明 |
|------|------|
| title | 书籍标题 |
| author | 作者 |
| publisher | 出版社 |
| isbn | ISBN编号 |
| pan_url | 百度网盘链接 |
| extract_code | 网盘提取码 |
| extract_password | 压缩包解压密码 |
| category | 所属分类 |
| publish_time | 网站发布时间 |
| views | 浏览量 |
| cover_url | 封面图片地址 |
| url | 原书籍详情页 |

---

## ⚙️ 自定义配置
编辑`zhishikoo_crawler.py`开头的CONFIG区：
```python
CONFIG = {
    'delay_min': 1.5,        # 请求最小间隔（秒）
    'delay_max': 3.5,        # 请求最大间隔（秒）
    'categories': ['jingyinglizhi', 'renwensheke', ...],  # 要抓的分类
    'crawl_latest_first': True,  # 是否抓最新发布
}
```

---

## ⚠️ 免责声明
本爬虫仅供学习交流使用，请遵守网站robots协议和相关法律法规，下载的电子书请于24小时内删除，支持正版书籍。
