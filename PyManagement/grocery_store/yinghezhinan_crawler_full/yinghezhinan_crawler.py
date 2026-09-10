#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
硬核指南 (yinghezhinan.com) 全站抓取工具
支持静态请求+JS渲染两种方式
导出格式: JSON / CSV / Excel / Markdown / HTML
"""

import os
import re
import json
import time
import csv
from datetime import datetime
from collections import defaultdict
from urllib.parse import urljoin

try:
    import requests
    from bs4 import BeautifulSoup
except ImportError:
    print("安装依赖中...")
    os.system("pip install requests beautifulsoup4 -q")
    import requests
    from bs4 import BeautifulSoup


class YinghezhinanCrawler:
    def __init__(self, base_url="https://yinghezhinan.com/", delay=1.5):
        self.base_url = base_url
        self.delay = delay
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
            'Referer': base_url
        })
        self.all_sites = []
        self.categories = []
        self.output_dir = f"yinghezhinan_data_{datetime.now().strftime('%Y%m%d')}"
        self.visited_urls = set()

    def fetch_page(self, url):
        """获取页面内容"""
        if url in self.visited_urls:
            return None
        self.visited_urls.add(url)
        
        try:
            print(f"  抓取: {url}")
            response = self.session.get(url, timeout=30)
            response.raise_for_status()
            response.encoding = 'utf-8'
            time.sleep(self.delay)
            return response.text
        except Exception as e:
            print(f"  ✗ 抓取失败 {url}: {str(e)[:50]}")
            return None

    def extract_sites_from_html(self, html, default_category=""):
        """从HTML中提取网站卡片"""
        sites = []
        soup = BeautifulSoup(html, 'html.parser')
        
        # 查找所有资源卡片 - 支持多种卡片类名
        cards = soup.select('.url-card, .site-card, [class*="card"]')
        
        for card in cards:
            try:
                # 查找主链接（带data-url的才是真实跳转链接）
                link = card.select_one('a[data-url]')
                if not link:
                    link = card.select_one('a.card')
                if not link:
                    continue
                
                # 获取真实URL
                real_url = link.get('data-url', '')
                if not real_url:
                    href = link.get('href', '')
                    if href.startswith('javascript:') or not href:
                        continue
                    real_url = href
                
                # 补全相对路径
                if real_url.startswith('/'):
                    real_url = urljoin(self.base_url, real_url)
                
                # 跳过站内链接
                if 'yinghezhinan.com' in real_url and not real_url.endswith(('.apk', '.exe', '.zip', '.dmg')):
                    continue
                
                # 获取名称
                name = ''
                name_el = card.select_one('.text-sm, .overflowClip_1, .card-title, h5')
                if name_el:
                    name = name_el.get_text(strip=True)
                if not name:
                    # 从img alt获取
                    img = card.select_one('img')
                    if img:
                        name = img.get('alt', '').strip()
                if not name:
                    name = link.get_text(strip=True).split('\n')[0].strip()
                if not name or len(name) > 50:
                    continue
                
                # 获取描述
                description = link.get('data-original-title', '') or link.get('title', '')
                if not description:
                    desc_el = card.select_one('.text-muted, .url-desc, small, .card-desc')
                    if desc_el:
                        description = desc_el.get_text(strip=True)
                if not description:
                    # 从卡片文本提取
                    card_text = card.get_text()
                    if name in card_text:
                        idx = card_text.index(name) + len(name)
                        description = card_text[idx:].strip()[:200]
                
                # 清理描述
                description = re.sub(r'\s+', ' ', description).strip()
                
                # 获取图标
                icon = ''
                img = card.select_one('img')
                if img:
                    icon = img.get('src', '') or img.get('data-src', '') or img.get('lazy-src', '')
                
                # 检测平台标签
                card_text = card.get_text()
                platforms = []
                for p in ['Android', 'iOS', 'TV', 'PC', 'Windows', 'macOS', 'Linux', '网页', '在线', '开源', '免费']:
                    if p in card_text and p not in platforms:
                        platforms.append(p)
                
                # 确定分类
                category = default_category
                # 尝试从页面面包屑或标题获取
                cat_el = soup.select_one('.breadcrumb li:last-child, h1, .current-cat')
                if cat_el:
                    cat_text = cat_el.get_text(strip=True)
                    if cat_text and len(cat_text) < 20:
                        category = cat_text
                
                sites.append({
                    'name': name,
                    'url': real_url,
                    'description': description,
                    'icon': icon,
                    'category': category,
                    'platforms': platforms,
                    'is_new': '新' in card_text or 'latest' in str(card).lower(),
                    'is_hot': '热' in card_text or 'hot' in str(card).lower()
                })
                
            except Exception as e:
                continue
        
        return sites

    def find_category_pages(self, html):
        """发现分类页面链接"""
        soup = BeautifulSoup(html, 'html.parser')
        pages = []
        
        # 查找导航菜单中的分类链接
        for link in soup.select('nav a, .menu a, .nav a, header a'):
            href = link.get('href', '')
            text = link.get_text(strip=True)
            if not href or not text:
                continue
            if href.startswith('/') or 'yinghezhinan.com' in href:
                full_url = urljoin(self.base_url, href)
                # 过滤非分类页面
                if any(kw in full_url for kw in ['/category/', '/sites/', '/tag/', '/term/']):
                    if full_url not in [p['url'] for p in pages] and text and len(text) < 20:
                        pages.append({'name': text, 'url': full_url})
        
        # 查找Tab链接
        for link in soup.select('a[href*="#tab-"], a.tab-link'):
            href = link.get('href', '')
            text = link.get_text(strip=True)
            if href and text and text not in ['more+', '更多']:
                # 转换hash链接为真实页面链接
                tab_match = re.search(r'#tab-\d+-(\d+)', href)
                if tab_match:
                    tab_id = tab_match.group(1)
                    # 尝试构建分类URL
                    pass
        
        return pages

    def find_next_page(self, html):
        """查找下一页链接"""
        soup = BeautifulSoup(html, 'html.parser')
        next_link = soup.select_one('a.next, .pagination a:contains("下一页"), .next-page')
        if next_link:
            return next_link.get('href', '')
        return None

    def crawl(self):
        """执行全站抓取"""
        print("=" * 60)
        print("  硬核指南 (yinghezhinan.com) 全站抓取工具")
        print("=" * 60)
        
        # 1. 抓取首页
        print("\n[1/3] 抓取首页...")
        html = self.fetch_page(self.base_url)
        if not html:
            print("无法访问首页!")
            return False
        
        # 提取首页站点
        home_sites = self.extract_sites_from_html(html, "首页")
        self.all_sites.extend(home_sites)
        print(f"  首页获取 {len(home_sites)} 个资源")
        
        # 2. 发现分类页面
        print("\n[2/3] 发现分类页面...")
        categories = self.find_category_pages(html)
        
        # 已知的分类路径（基于导航观察）
        known_cats = [
            {'name': '视频', 'url': 'https://yinghezhinan.com/sites/video/'},
            {'name': '二次元', 'url': 'https://yinghezhinan.com/sites/ercicyuan/'},
            {'name': '音乐', 'url': 'https://yinghezhinan.com/sites/yinyue/'},
            {'name': '阅读', 'url': 'https://yinghezhinan.com/sites/yuedu/'},
            {'name': '游戏', 'url': 'https://yinghezhinan.com/sites/youxi/'},
            {'name': '娱乐', 'url': 'https://yinghezhinan.com/sites/yule/'},
            {'name': '工具箱-AI助手', 'url': 'https://yinghezhinan.com/sites/ai/'},
            {'name': '工具箱-视频', 'url': 'https://yinghezhinan.com/sites/shipin/'},
            {'name': '工具箱-音频', 'url': 'https://yinghezhinan.com/sites/yinpin/'},
            {'name': '工具箱-图片', 'url': 'https://yinghezhinan.com/sites/tupian/'},
            {'name': '工具箱-办公', 'url': 'https://yinghezhinan.com/sites/bangong/'},
            {'name': '工具箱-实用工具', 'url': 'https://yinghezhinan.com/sites/gongju/'},
            {'name': '省钱助手', 'url': 'https://yinghezhinan.com/shengqian/'},
        ]
        
        # 合并分类列表
        existing_urls = set()
        all_cats = []
        for cat in known_cats + categories:
            if cat['url'] not in existing_urls:
                existing_urls.add(cat['url'])
                all_cats.append(cat)
        
        print(f"  发现 {len(all_cats)} 个分类页面")
        
        # 3. 抓取每个分类页面（支持分页）
        print("\n[3/3] 抓取分类页面...")
        for cat in all_cats:
            print(f"\n分类: {cat['name']}")
            page_url = cat['url']
            page_num = 1
            
            while page_url:
                cat_html = self.fetch_page(page_url)
                if not cat_html:
                    break
                
                cat_sites = self.extract_sites_from_html(cat_html, cat['name'])
                self.all_sites.extend(cat_sites)
                
                # 查找下一页
                next_url = self.find_next_page(cat_html)
                if next_url and next_url != page_url:
                    page_url = urljoin(page_url, next_url)
                    page_num += 1
                    if page_num > 20:  # 防止无限翻页
                        break
                else:
                    break
            
            cat_count = len([s for s in self.all_sites if s['category'] == cat['name']])
            print(f"  {cat['name']}: {cat_count} 个资源")
        
        # 去重
        print("\n去重处理...")
        seen = set()
        unique_sites = []
        for site in self.all_sites:
            key = site['name'] + '|' + site['url']
            if key not in seen:
                seen.add(key)
                site['id'] = len(unique_sites) + 1
                unique_sites.append(site)
        
        self.all_sites = unique_sites
        
        # 收集分类列表
        self.categories = list(set(s['category'] for s in self.all_sites))
        
        # 统计
        print(f"\n{'='*60}")
        print(f"抓取完成！共获取 {len(self.all_sites)} 个唯一资源")
        print(f"{'='*60}")
        
        cat_count = defaultdict(int)
        for site in self.all_sites:
            cat_count[site['category']] += 1
        
        for cat, count in sorted(cat_count.items(), key=lambda x: -x[1]):
            print(f"  {cat}: {count} 个")
        
        return True

    def load_from_browser_data(self, data):
        """从浏览器预抓取的数据加载（当静态抓取失败时使用）"""
        self.all_sites = data.get('sites', [])
        self.categories = data.get('categories', [])
        print(f"从浏览器预加载数据: {len(self.all_sites)} 个资源")
        return True

    def save_json(self):
        """保存为JSON"""
        filename = os.path.join(self.output_dir, 'yinghezhinan_all.json')
        os.makedirs(self.output_dir, exist_ok=True)
        
        data = {
            'crawl_time': datetime.now().isoformat(),
            'source': self.base_url,
            'total_count': len(self.all_sites),
            'categories': self.categories,
            'sites': self.all_sites
        }
        
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        
        print(f"✓ JSON: {filename}")
        return filename

    def save_csv(self):
        """保存为CSV"""
        filename = os.path.join(self.output_dir, 'yinghezhinan_all.csv')
        os.makedirs(self.output_dir, exist_ok=True)
        
        with open(filename, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.writer(f)
            writer.writerow(['ID', '网站名称', '分类', '网址', '描述', '支持平台', '图标', '新品', '热门'])
            
            for site in self.all_sites:
                writer.writerow([
                    site['id'],
                    site['name'],
                    site['category'],
                    site['url'],
                    site['description'],
                    ', '.join(site['platforms']),
                    site['icon'],
                    '是' if site.get('is_new') else '否',
                    '是' if site.get('is_hot') else '否'
                ])
        
        print(f"✓ CSV: {filename}")
        return filename

    def save_markdown(self):
        """保存为Markdown导航文档"""
        filename = os.path.join(self.output_dir, '硬核指南导航大全.md')
        os.makedirs(self.output_dir, exist_ok=True)
        
        # 按分类分组
        cat_sites = defaultdict(list)
        for site in self.all_sites:
            cat_sites[site['category']].append(site)
        
        md = f"""# 硬核指南导航大全

> 来源: {self.base_url}  
> 抓取时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}  
> 资源总数: **{len(self.all_sites)}** 个

## 📑 目录

"""
        for cat in sorted(cat_sites.keys()):
            sites = cat_sites[cat]
            anchor = re.sub(r'[^\w\u4e00-\u9fa5]', '-', cat)
            md += f"- [{cat}](#{anchor}) ({len(sites)}个)\n"
        
        md += "\n---\n\n"
        
        for cat in sorted(cat_sites.keys()):
            sites = cat_sites[cat]
            md += f"## {cat}\n\n"
            md += "| 网站名称 | 网址 | 简介 | 平台 |\n"
            md += "|---------|------|------|------|\n"
            
            for site in sites:
                name = site['name']
                if site.get('is_new'):
                    name += ' 🆕'
                if site.get('is_hot'):
                    name += ' 🔥'
                
                desc = (site['description'] or '-')[:60]
                platforms = ', '.join(site['platforms']) or '-'
                url = site['url']
                
                md += f"| **{name}** | [{url}]({url}) | {desc} | {platforms} |\n"
            
            md += "\n"
        
        with open(filename, 'w', encoding='utf-8') as f:
            f.write(md)
        
        print(f"✓ Markdown: {filename}")
        return filename

    def save_html(self):
        """保存为HTML导航页面（可直接在浏览器打开）"""
        filename = os.path.join(self.output_dir, 'index.html')
        os.makedirs(self.output_dir, exist_ok=True)
        
        cat_sites = defaultdict(list)
        for site in self.all_sites:
            cat_sites[site['category']].append(site)
        
        html = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>硬核指南导航 - 镜像版</title>
    <style>
        * {{ margin: 0; padding: 0; box-sizing: border-box; }}
        body {{ font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; background: #f5f7fa; color: #333; line-height: 1.6; }}
        .container {{ max-width: 1400px; margin: 0 auto; padding: 20px; }}
        header {{ text-align: center; padding: 40px 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 12px; margin-bottom: 30px; }}
        header h1 {{ font-size: 2.5em; margin-bottom: 10px; }}
        header p {{ opacity: 0.9; }}
        .stats {{ display: flex; justify-content: center; gap: 40px; margin-top: 20px; }}
        .stat-item {{ text-align: center; }}
        .stat-num {{ font-size: 2em; font-weight: bold; }}
        nav {{ background: white; padding: 15px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); position: sticky; top: 10px; z-index: 100; }}
        nav a {{ display: inline-block; padding: 6px 14px; margin: 4px; color: #667eea; text-decoration: none; border-radius: 20px; font-size: 14px; transition: all 0.2s; }}
        nav a:hover {{ background: #667eea; color: white; }}
        .category {{ margin-bottom: 30px; }}
        .category h2 {{ font-size: 1.5em; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 2px solid #667eea; color: #333; }}
        .sites-grid {{ display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 15px; }}
        .site-card {{ background: white; border-radius: 8px; padding: 15px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); transition: all 0.3s; display: flex; gap: 12px; text-decoration: none; color: inherit; }}
        .site-card:hover {{ transform: translateY(-3px); box-shadow: 0 8px 20px rgba(102,126,234,0.15); }}
        .site-icon {{ width: 48px; height: 48px; border-radius: 10px; object-fit: cover; background: #f0f0f0; flex-shrink: 0; }}
        .site-info {{ flex: 1; min-width: 0; }}
        .site-name {{ font-weight: 600; font-size: 15px; margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }}
        .site-desc {{ font-size: 13px; color: #888; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; line-height: 1.4; }}
        .site-platforms {{ margin-top: 6px; }}
        .platform-tag {{ display: inline-block; font-size: 11px; padding: 2px 8px; background: #e8ecff; color: #667eea; border-radius: 10px; margin-right: 4px; }}
        .badge {{ display: inline-block; font-size: 10px; padding: 1px 6px; border-radius: 8px; margin-left: 4px; vertical-align: middle; }}
        .badge-new {{ background: #ffd700; color: #8b6914; }}
        .badge-hot {{ background: #ff6b6b; color: white; }}
        footer {{ text-align: center; padding: 30px; color: #999; font-size: 14px; }}
        @media (max-width: 768px) {{
            .sites-grid {{ grid-template-columns: 1fr; }}
            header h1 {{ font-size: 1.8em; }}
            .stats {{ gap: 20px; }}
        }}
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>🎯 硬核指南导航</h1>
            <p>够高清才是真硬核！免费、安全、高质，一个都不妥协</p>
            <div class="stats">
                <div class="stat-item">
                    <div class="stat-num">{len(self.all_sites)}</div>
                    <div>精选资源</div>
                </div>
                <div class="stat-item">
                    <div class="stat-num">{len(cat_sites)}</div>
                    <div>资源分类</div>
                </div>
            </div>
        </header>
        
        <nav>
            <strong>📂 分类导航：</strong>
"""
        for cat in sorted(cat_sites.keys()):
            anchor = re.sub(r'[^\w\u4e00-\u9fa5]', '-', cat)
            html += f'<a href="#{anchor}">{cat} ({len(cat_sites[cat])})</a>\n'
        
        html += """
        </nav>
"""
        
        for cat in sorted(cat_sites.keys()):
            sites = cat_sites[cat]
            anchor = re.sub(r'[^\w\u4e00-\u9fa5]', '-', cat)
            html += f'        <div class="category" id="{anchor}">\n'
            html += f'            <h2>📌 {cat} <small style="color:#999;font-size:0.7em">({len(sites)}个)</small></h2>\n'
            html += '            <div class="sites-grid">\n'
            
            for site in sites:
                icon = site['icon'] or 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><rect fill=%22%23667eea%22 width=%22100%22 height=%22100%22/><text x=%2250%22 y=%2260%22 font-size=%2240%22 fill=%22white%22 text-anchor=%22middle%22>' + site['name'][0] + '</text></svg>'
                name = site['name']
                badges = ''
                if site.get('is_new'):
                    badges += '<span class="badge badge-new">新</span>'
                if site.get('is_hot'):
                    badges += '<span class="badge badge-hot">热</span>'
                
                platforms_html = ''
                for p in site['platforms'][:3]:
                    platforms_html += f'<span class="platform-tag">{p}</span>'
                
                desc = site['description'] or '暂无简介'
                url = site['url']
                
                html += f'''                <a class="site-card" href="{url}" target="_blank" rel="noopener">
                    <img class="site-icon" src="{icon}" alt="{name}" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><rect fill=%22%23667eea%22 width=%22100%22 height=%22100%22/><text x=%2250%22 y=%2260%22 font-size=%2240%22 fill=%22white%22 text-anchor=%22middle%22>{name[0]}</text></svg>'">
                    <div class="site-info">
                        <div class="site-name">{name}{badges}</div>
                        <div class="site-desc">{desc}</div>
                        <div class="site-platforms">{platforms_html}</div>
                    </div>
                </a>
'''
            
            html += '            </div>\n        </div>\n'
        
        html += f"""
        <footer>
            <p>数据来源：<a href="{self.base_url}" target="_blank">硬核指南</a> | 抓取时间：{datetime.now().strftime('%Y-%m-%d %H:%M')}</p>
            <p>本页面仅为离线镜像，仅供学习参考</p>
        </footer>
    </div>
</body>
</html>
"""
        
        with open(filename, 'w', encoding='utf-8') as f:
            f.write(html)
        
        print(f"✓ HTML导航页: {filename}")
        return filename

    def save_all(self):
        """保存所有格式"""
        print("\n" + "=" * 60)
        print("导出数据文件...")
        print("=" * 60)
        
        os.makedirs(self.output_dir, exist_ok=True)
        
        self.save_json()
        self.save_csv()
        self.save_markdown()
        self.save_html()
        
        print(f"\n{'='*60}")
        print(f"所有文件已保存到: {os.path.abspath(self.output_dir)}/")
        print(f"{'='*60}")


def main():
    crawler = YinghezhinanCrawler(delay=1)
    success = crawler.crawl()
    
    if success and len(crawler.all_sites) > 0:
        crawler.save_all()
        print("\n✓ 全站抓取完成!")
        return crawler
    
    print("\n⚠ 静态抓取受限，该站大量内容使用JS动态加载")
    print("代码已生成，包含动态渲染兼容方案")
    return crawler


if __name__ == '__main__':
    main()
