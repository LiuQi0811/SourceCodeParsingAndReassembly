#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Animoe.org 全站爬虫
- 自动翻页爬取所有番剧列表
- 使用浏览器内Hls.js解密enc!加密的m3u8
- 通过ffmpeg下载视频（无需解密enc!算法，直接用浏览器内解密后的manifest）
- 支持断点续爬
"""
import os, sys, re, json, time, argparse, urllib.request, urllib.parse, urllib.error, subprocess, threading, queue
import websocket
from websocket import WebSocketTimeoutException
from concurrent.futures import ThreadPoolExecutor, as_completed

WORKDIR = '/home/user/11192070517084179797/animoe_crawler'
OUTPUT_DIR = os.path.join(WORKDIR, 'downloads')
os.makedirs(OUTPUT_DIR, exist_ok=True)
STATE_FILE = os.path.join(WORKDIR, 'crawl_state.json')

UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

# ============== CDP 解密模块 ==============

def _find_animoe_tab():
    for _ in range(3):
        try:
            tabs = json.loads(urllib.request.urlopen("http://localhost:9222/json", timeout=5).read())
            for t in tabs:
                if t['type']=='page' and 'animoe.org' in t.get('url',''):
                    return t['webSocketDebuggerUrl']
        except: pass
        time.sleep(2)
    return None

class _CDP:
    def __init__(self, ws_url):
        self.ws = websocket.create_connection(ws_url, timeout=60)
        self.ws.settimeout(60)
        self.mid = 1
    def send(self, method, params=None):
        m = {"id": self.mid, "method": method}
        if params: m["params"] = params
        self.mid += 1
        self.ws.send(json.dumps(m))
        while True:
            try:
                self.ws.settimeout(60)
                r = json.loads(self.ws.recv())
            except WebSocketTimeoutException:
                raise TimeoutError(f"CDP timeout: {method}")
            if r.get("id") == m["id"]: return r
    def ev(self, expr, timeout=25000):
        p = {"expression": expr, "returnByValue": True, "awaitPromise": True, "timeout": timeout}
        r = self.send("Runtime.evaluate", p)
        res = r.get('result', {})
        if 'exceptionDetails' in res:
            raise RuntimeError(f"JS Exception: {json.dumps(res['exceptionDetails'])[:300]}")
        return res.get('result', {}).get('value')
    def close(self):
        try: self.ws.close()
        except: pass

_DECRYPT_JS = r"""
(playUrl) => {
  return new Promise((resolve) => {
    const needNav = playUrl && location.href !== playUrl;
    function go() {
      const fs = document.querySelectorAll('iframe');
      let pf=null;
      for(const f of fs){try{if(f.src&&f.src.indexOf('assplayer/dist.html')!==-1){pf=f;break;}}catch(e){}}
      if(!pf)return resolve({err:'no assplayer iframe'});
      const w=pf.contentWindow,d=pf.contentDocument;
      if(!w||!d)return resolve({err:'no w/d'});
      if(w.Hls)w.Hls.isSupported=()=>true;
      const v=d.querySelector('video');
      if(!v)return resolve({err:'no video'});
      const rawUrl=w.parent.MacPlayer.PlayUrl;
      const m3u8Url=rawUrl.split('*')[0].split('!')[0];
      const subtitles=[];
      const parts=rawUrl.split('*');
      for(let i=1;i<parts.length;i++){const sp=parts[i].split('^');if(sp.length>=3&&sp[2].startsWith('http')){const idx=sp[2].indexOf('!');subtitles.push({lang:sp[0],name:sp[1],url:idx===-1?sp[2]:sp[2].substring(0,idx)});}}
      if(w.__ch)try{w.__ch.destroy();}catch(e){}
      const hls=new w.Hls({enableWorker:false});
      w.__ch=hls;
      let done=false;
      function fin(r){if(done)return;done=true;try{hls.destroy();}catch(e){}resolve(r);}
      hls.on(w.Hls.Events.LEVEL_LOADED,(ev,data)=>{
        try{
          const det=data.details;if(!det)return;
          const lines=['#EXTM3U','#EXT-X-VERSION:6'];
          const td=Math.max(1,Math.ceil(det.targetduration||10));
          lines.push('#EXT-X-TARGETDURATION:'+td);
          let initUri=null;
          if(det.fragments&&det.fragments.length){const is0=det.fragments[0].initSegment;if(is0&&(is0.relurl||is0.url))initUri=is0.relurl||is0.url;}
          if(det.keys&&det.keys.length){for(const k of det.keys){if(!k||!k.uri)continue;let ln='#EXT-X-KEY:METHOD='+(k.method||'AES-128')+',URI="'+k.uri+'"';if(k.iv)ln+=',IV=0x'+BigInt(k.iv).toString(16).padStart(32,'0');lines.push(ln);}}
          lines.push('#EXT-X-MEDIA-SEQUENCE:'+(det.mediaSequence||0));
          const frags=[];let lastInit=null;
          for(const f of(det.fragments||[])){
            const iseg=f.initSegment;const iurl=iseg?(iseg.relurl||iseg.url):null;
            if(iurl&&iurl!==lastInit){lines.push('#EXT-X-MAP:URI="'+iurl+'"');lastInit=iurl;}
            lines.push('#EXTINF:'+f.duration.toFixed(4)+',');
            const u=f.relurl||f.url;
            lines.push(u);
            let ki=null;
            if(f.decryptdata&&f.decryptdata.uri){ki={method:f.decryptdata.method,uri:f.decryptdata.uri,iv:f.decryptdata.iv?'0x'+BigInt(f.decryptdata.iv).toString(16).padStart(32,'0'):null};}
            frags.push({url:u,duration:f.duration,sn:f.sn,key:ki});
          }
          lines.push('#EXT-X-ENDLIST');
          const vod=w.parent.MacPlayer;
          fin({ok:true,m3u8:lines.join('\n'),fragments:frags,duration:det.totalduration,m3u8_url:m3u8Url,subtitles,title:vod.VodData?.vod_name||'',part:vod.PlayNote||'',next:vod.PlayLinkNext||'',pre:vod.PlayLinkPre||'',frag_count:frags.length});
        }catch(e){fin({err:'build:'+e.message});}
      });
      hls.on(w.Hls.Events.ERROR,(ev,data)=>{if(data.fatal){setTimeout(()=>fin({err:data.type+'/'+data.details,url:m3u8Url,resp:data.response?.code}),2000);}});
      try{hls.loadSource(m3u8Url);hls.attachMedia(v);}catch(e){fin({err:'start:'+e.message});}
      setTimeout(()=>fin({timeout:true,m3u8_url:m3u8Url}),25000);
    }
    if(needNav){location.href=playUrl;setTimeout(go,10000);}
    else setTimeout(go,1500);
  });
}
"""

_cdp_instance = None
_cdp_lock = threading.Lock()

def get_cdp():
    global _cdp_instance
    with _cdp_lock:
        if _cdp_instance is None:
            ws_url = _find_animoe_tab()
            if not ws_url:
                raise RuntimeError("请先在浏览器中打开 https://animoe.org/ （任意页面均可）后再运行爬虫")
            _cdp_instance = _CDP(ws_url)
        return _cdp_instance

def decrypt_episode(play_url, navigate=True):
    """通过浏览器解密m3u8，返回 {ok, m3u8, fragments, ...}"""
    cdp = get_cdp()
    with _cdp_lock:
        if navigate:
            cdp.send("Page.navigate", {"url": play_url})
            time.sleep(10)
        else:
            time.sleep(2)
        try:
            cdp.ev("(()=>{const b=document.getElementById('buffer');if(b)b.style.display='none';})()")
        except: pass
        time.sleep(2)
        nav_arg = json.dumps(play_url if navigate else '')
        r = cdp.ev(f"({_DECRYPT_JS})({nav_arg})")
        return r

# ============== 列表抓取 ==============

def http_get(url, referer='https://animoe.org/'):
    req = urllib.request.Request(url, headers={'User-Agent': UA, 'Referer': referer, 'Accept-Encoding':'gzip, deflate'})
    try:
        import gzip
        from io import BytesIO
        resp = urllib.request.urlopen(req, timeout=15)
        data = resp.read()
        if resp.headers.get('Content-Encoding') == 'gzip':
            data = gzip.decompress(data)
        return data.decode('utf-8','ignore')
    except Exception as e:
        print(f"  [HTTP ERR] {url}: {e}")
        return None

def get_all_vod_list():
    """从首页和分类页爬取所有番剧列表"""
    vods = {}
    # 分类ID：1=连载中(从首页和分页)，2=已完结，3=剧场版
    categories = [
        ('连载中', '/show/20/'),
        ('已完结', '/show/21/'),
        ('剧场版', '/show/23/'),
    ]
    for cat_name, cat_prefix in categories:
        for pg in range(1, 200):
            if pg == 1:
                url = f"https://animoe.org/type/{cat_prefix.split('/')[2]}.html"
            else:
                url = f"https://animoe.org{cat_prefix}{pg}.html"
            print(f"  抓取[{cat_name}] 第{pg}页: {url}")
            html = http_get(url)
            if not html:
                break
            # 提取番剧详情页链接 /info/ID.html
            items = re.findall(r'href="(/info/(\d+)\.html)"[^>]*>(?:<[^>]*>)*\s*([^<]{1,80}?)\s*(?:</a>|<span)', html)
            # 备用匹配
            if not items:
                items = re.findall(r'href="(/info/(\d+)\.html)"[^>]*title="([^"]+)"', html)
            new_count = 0
            for m in items:
                link, vid, name = m[0], m[1], m[2].strip()
                name = re.sub(r'<[^>]+>', '', name).strip()
                if vid not in vods:
                    vods[vid] = {'id': vid, 'name': name, 'url': 'https://animoe.org'+link, 'category': cat_name}
                    new_count += 1
            print(f"    新增{new_count}部, 累计{len(vods)}部")
            # 判断是否最后一页
            if new_count == 0 or pg > 50:
                break
            time.sleep(0.5)
    return vods

def get_episodes(vod_url):
    """获取一部番剧的所有集数"""
    html = http_get(vod_url)
    if not html: return []
    episodes = []
    seen = set()
    # 匹配播放链接
    for m in re.finditer(r'href="(/play/(\d+)-(\d+)-(\d+)\.html)"[^>]*>([^<]+)</a>', html):
        url, vid, sid, nid, name = m.group(1), int(m.group(2)), int(m.group(3)), int(m.group(4)), m.group(5).strip()
        if nid == 0: continue
        key = (vid, sid, nid)
        if key not in seen:
            seen.add(key)
            episodes.append({'url':'https://animoe.org'+url, 'vid':vid, 'sid':sid, 'nid':nid, 'name':name})
    return episodes

# ============== 下载模块 ==============

def sanitize_filename(name):
    return re.sub(r'[\\/:*?"<>|]', '_', name).strip()[:120]

def download_with_ffmpeg(m3u8_content, output_path, m3u8_url=None, subtitles=None):
    """将m3u8文本写入临时文件，使用ffmpeg下载"""
    m3u8_tmp = output_path + '.m3u8'
    with open(m3u8_tmp, 'w', encoding='utf-8') as f:
        f.write(m3u8_content)
    cmd = [
        'ffmpeg', '-y',
        '-allowed_extensions', 'ALL',
        '-protocol_whitelist', 'file,http,https,tcp,tls,crypto',
        '-i', m3u8_tmp,
        '-c', 'copy',
        '-bsf:a', 'aac_adtstoasc',
    ]
    if subtitles:
        # 下载字幕
        for i, sub in enumerate(subtitles):
            sub_path = output_path + f'.{sub.get("lang",i)}.ass'
            try:
                sub_data = http_get(sub['url'], referer='https://animoe.org/')
                if sub_data:
                    with open(sub_path, 'w', encoding='utf-8') as sf:
                        sf.write(sub_data)
            except: pass
    cmd.append(output_path + '.mp4')
    try:
        result = subprocess.run(cmd, capture_output=True, timeout=600)
        if result.returncode == 0 and os.path.exists(output_path+'.mp4') and os.path.getsize(output_path+'.mp4') > 10000:
            os.remove(m3u8_tmp)
            return True
        else:
            print(f"  [ffmpeg err] {result.stderr.decode('utf-8','ignore')[-500:]}")
            return False
    except subprocess.TimeoutExpired:
        print("  [ffmpeg timeout]")
        return False
    except Exception as e:
        print(f"  [ffmpeg exception] {e}")
        return False

# ============== 主程序 ==============

def load_state():
    if os.path.exists(STATE_FILE):
        with open(STATE_FILE,'r',encoding='utf-8') as f:
            return json.load(f)
    return {'vods': {}, 'downloaded': []}

def save_state(state):
    with open(STATE_FILE,'w',encoding='utf-8') as f:
        json.dump(state, f, ensure_ascii=False, indent=2)

def main():
    parser = argparse.ArgumentParser(description='Animoe.org 全站爬虫')
    parser.add_argument('--mode', choices=['list','download','all','single'], default='all', help='运行模式')
    parser.add_argument('--url', help='单个视频URL (single模式)')
    parser.add_argument('--list-only', action='store_true', help='只抓列表不下载')
    parser.add_argument('--limit', type=int, default=0, help='限制下载的番剧数量(0=不限)')
    parser.add_argument('--start-from', type=str, default='', help='从某个番剧名开始')
    args = parser.parse_args()
    
    state = load_state()
    
    if args.mode == 'single' and args.url:
        print(f"[单集模式] {args.url}")
        r = decrypt_episode(args.url)
        if r and r.get('ok'):
            print(f"  解密成功: {r['frag_count']}个分片, 时长{r['duration']:.0f}s")
            out_name = sanitize_filename(r.get('title','video') + '_' + r.get('part','ep'))
            out_path = os.path.join(OUTPUT_DIR, out_name)
            download_with_ffmpeg(r['m3u8'], out_path, subtitles=r.get('subtitles'))
            print(f"  下载完成: {out_path}.mp4")
        else:
            print(f"  解密失败: {r}")
        return
    
    # 抓取列表
    if not state['vods'] or args.mode != 'download':
        print("[1/3] 抓取番剧列表...")
        vods = get_all_vod_list()
        state['vods'] = vods
        save_state(state)
        print(f"  共发现 {len(vods)} 部番剧")
    
    if args.list_only:
        print("列表抓取完毕")
        return
    
    # 下载
    print("[2/3] 准备下载，确保浏览器已打开 animoe.org")
    # 先验证浏览器可用
    try:
        cdp = get_cdp()
        cur = cdp.ev("location.href")
        print(f"  浏览器当前页面: {cur}")
    except Exception as e:
        print(f"  [错误] 无法连接浏览器: {e}")
        print("  请先在浏览器打开 https://animoe.org/ 再运行本脚本")
        return
    
    print("[3/3] 开始下载视频...")
    vods = state['vods']
    downloaded = set(state.get('downloaded', []))
    count = 0
    failed = []
    
    vods_items = list(vods.items())
    if args.start_from:
        vods_items = [(k,v) for k,v in vods_items if v['name'] >= args.start_from]
    
    for vid, info in vods_items:
        if args.limit and count >= args.limit: break
        vod_name = sanitize_filename(info['name'])
        vod_dir = os.path.join(OUTPUT_DIR, vod_name)
        os.makedirs(vod_dir, exist_ok=True)
        print(f"\n=== [{info['category']}] {info['name']} (id={vid}) ===")
        
        # 获取该番剧的所有集数
        episodes = get_episodes(info['url'])
        print(f"  共{len(episodes)}集")
        
        # 第一集需要navigate，后续可复用页面（通过player_aaaa的链接切换）
        first = True
        for ep in episodes:
            ep_key = f"{ep['vid']}-{ep['sid']}-{ep['nid']}"
            ep_name = sanitize_filename(ep['name'])
            out_path = os.path.join(vod_dir, ep_name)
            
            if ep_key in downloaded:
                if os.path.exists(out_path+'.mp4'):
                    print(f"  [跳过] {ep_name} 已下载")
                    continue
            
            # 如果mp4已存在但state没记录，跳过
            if os.path.exists(out_path+'.mp4') and os.path.getsize(out_path+'.mp4')>10000:
                print(f"  [跳过] {ep_name} 文件已存在")
                downloaded.add(ep_key)
                continue
            
            print(f"  解密: {ep['name']} ({ep['url']})")
            for attempt in range(3):
                try:
                    r = decrypt_episode(ep['url'], navigate=first)
                    first = False
                    if r and r.get('ok'):
                        break
                    else:
                        print(f"    尝试{attempt+1}失败: {r}")
                        time.sleep(3)
                        first = True  # 下次重新导航
                except Exception as e:
                    print(f"    尝试{attempt+1}异常: {e}")
                    time.sleep(3)
                    first = True
            else:
                failed.append(ep)
                print(f"    [失败] 无法解密 {ep['name']}")
                continue
            
            title = sanitize_filename(r.get('title','') or vod_name)
            part = sanitize_filename(r.get('part','') or ep['name'])
            out_path = os.path.join(vod_dir, part)
            print(f"    解密成功: {r['frag_count']}个分片, 时长{r['duration']:.0f}s")
            print(f"    下载中...")
            ok = download_with_ffmpeg(r['m3u8'], out_path, subtitles=r.get('subtitles'))
            if ok:
                print(f"    完成: {out_path}.mp4")
                downloaded.add(ep_key)
                state['downloaded'] = list(downloaded)
                save_state(state)
                count += 1
            else:
                print(f"    [失败] 下载出错")
                failed.append(ep)
                first = True
            time.sleep(1)
    
    print(f"\n=== 下载完毕 ===")
    print(f"  本次成功下载: {count} 个视频")
    print(f"  失败: {len(failed)} 个")
    for f in failed[:10]:
        print(f"    - {f['name']}: {f['url']}")
    save_state(state)

if __name__ == '__main__':
    main()
