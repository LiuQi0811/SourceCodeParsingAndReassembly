"""快速端到端测试：抓取《仙逆》一部，验证列表+详情+集数+视频源+m3u8可访问"""
import sys, os, json, requests
sys.path.insert(0, os.path.dirname(__file__))

from xg_cartoon_spider import XgCartoonSpider, HttpClient, BASE_CN

http = HttpClient(delay=0.2)
spider = XgCartoonSpider(output_dir='/tmp/xg_test', index_only=False, quality='middle')

# 1) 列表
items = spider._extract_detail_links(http.get(BASE_CN + '/').text)
print(f'[1] 首页解析到 {len(items)} 部动漫')
xianni = next((x for x in items if '仙逆' in x['title']), None)
assert xianni, '未找到仙逆'
print(f'    找到仙逆: title={xianni["title"]}, slug={xianni["slug"]}, id={xianni["anime_id"]}')

# 2) 详情
detail = spider.fetch_anime_detail(dict(xianni))
print(f'[2] 详情页: title={detail["title"]}, 集数={detail["total_episodes"]}')
assert detail['total_episodes'] > 100, f'集数太少: {detail["total_episodes"]}'
print(f'    首集: {detail["episodes"][0]["episode_id"]} / {detail["episodes"][0]["title"]}')

# 3) 视频源API
ep0 = spider.fetch_episode_video(dict(detail['episodes'][0]))
print(f'[3] 视频源API: vid={ep0["vid"]}')
print(f'    m3u8={ep0["m3u8"]}')
assert ep0['vid'] and ep0['m3u8'], '视频源解析失败'

# 4) m3u8 可访问
r = requests.get(ep0['m3u8'], headers=dict(spider.http.session.headers), timeout=15)
print(f'[4] m3u8 HTTP {r.status_code}, {len(r.content)} bytes')
assert r.status_code == 200
print('    内容预览:', r.text[:300].replace('\n', ' | '))

# 5) 缩略图可访问
r2 = requests.get(ep0['thumbnail'], headers=dict(spider.http.session.headers), timeout=15)
print(f'[5] 缩略图 HTTP {r2.status_code}, {len(r2.content)} bytes')

print('\n✅ 全部验证通过！爬虫可正常工作。')
