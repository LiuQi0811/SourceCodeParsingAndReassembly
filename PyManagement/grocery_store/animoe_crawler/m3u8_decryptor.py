"""通过CDP使用浏览器内Hls.js解密m3u8,返回完整明文m3u8文本和分片URL列表"""
import json, time, urllib.request, websocket, os
from websocket import WebSocketTimeoutException

WORKDIR = '/home/user/11192070517084179797/animoe_crawler'

def _find_animoe_tab():
    tabs = json.loads(urllib.request.urlopen("http://localhost:9222/json", timeout=5).read())
    for t in tabs:
        if t['type']=='page' and 'animoe.org' in t.get('url',''):
            return t['webSocketDebuggerUrl']
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
        # 接收直到匹配id，跳过event
        while True:
            try:
                self.ws.settimeout(60)
                r = json.loads(self.ws.recv())
            except websocket.WebSocketTimeoutException:
                raise TimeoutError(f"CDP timeout: {method}")
            if r.get("id") == m["id"]:
                return r
    def ev(self, expr, timeout=20000):
        p = {"expression": expr, "returnByValue": True, "awaitPromise": True, "timeout": timeout}
        r = self.send("Runtime.evaluate", p)
        res = r.get('result', {})
        if 'exceptionDetails' in res:
            raise RuntimeError(f"JS Exception: {json.dumps(res['exceptionDetails'])[:500]}")
        return res.get('result', {}).get('value')
    def close(self):
        self.ws.close()

_DECRYPT_JS = r"""
(playUrl) => {
  return new Promise((resolve) => {
    // 导航到playUrl
    // 注意：调用方已经在play页面，这里直接在当前页中切换播放器源
    // 但为了通用性，我们允许传新的playUrl，需要导航
    const needNavigate = playUrl && location.href !== playUrl;
    function doWork() {
      const fs = document.querySelectorAll('iframe');
      let pf = null;
      for (const f of fs) { try { if (f.src && f.src.indexOf('assplayer/dist.html')!==-1) { pf=f; break; } } catch(e){} }
      if (!pf) return resolve({err: 'no assplayer iframe'});
      const w = pf.contentWindow, d = pf.contentDocument;
      if (!w || !d) return resolve({err: 'no w/d'});
      if (w.Hls) w.Hls.isSupported = () => true;
      const v = d.querySelector('video');
      if (!v) return resolve({err: 'no video'});
      const rawUrl = w.parent.MacPlayer.PlayUrl;
      const m3u8Url = rawUrl.split('*')[0].split('!')[0];
      // 字幕
      const subtitles = [];
      const parts = rawUrl.split('*');
      for (let i=1;i<parts.length;i++) {
        const sp = parts[i].split('^');
        if (sp.length>=3 && sp[2].startsWith('http')) {
          const end = sp[2].indexOf('!');
          subtitles.push({lang: sp[0], name: sp[1], url: end===-1 ? sp[2] : sp[2].substring(0, end)});
        }
      }
      if (w.__crawlHls) try { w.__crawlHls.destroy(); } catch(e){}
      const hls = new w.Hls({enableWorker:false});
      w.__crawlHls = hls;
      let done = false;
      function finish(r) {
        if (done) return; done = true;
        try { hls.destroy(); } catch(e){}
        resolve(r);
      }
      hls.on(w.Hls.Events.LEVEL_LOADED, (ev, data) => {
        try {
          const det = data.details;
          if (!det) return;
          const lines = ['#EXTM3U', '#EXT-X-VERSION:6'];
          const td = Math.max(1, Math.ceil(det.targetduration || 10));
          lines.push('#EXT-X-TARGETDURATION:'+td);
          // init segment for fMP4
          let initUri = null;
          if (det.fragments && det.fragments.length) {
            const iseg0 = det.fragments[0].initSegment;
            if (iseg0 && (iseg0.relurl || iseg0.url)) initUri = iseg0.relurl || iseg0.url;
          }
          // KEY
          if (det.keys && det.keys.length) {
            for (const k of det.keys) {
              if (!k || !k.uri) continue;
              let ln = '#EXT-X-KEY:METHOD='+(k.method||'AES-128')+',URI="'+k.uri+'"';
              if (k.iv) ln += ',IV=0x'+BigInt(k.iv).toString(16).padStart(32,'0');
              lines.push(ln);
            }
          }
          lines.push('#EXT-X-MEDIA-SEQUENCE:'+(det.mediaSequence||0));
          const fragments = [];
          let lastInit = null;
          for (const f of (det.fragments||[])) {
            const iseg = f.initSegment;
            const iurl = iseg ? (iseg.relurl || iseg.url) : null;
            if (iurl && iurl !== lastInit) {
              lines.push('#EXT-X-MAP:URI="'+iurl+'"');
              lastInit = iurl;
            }
            lines.push('#EXTINF:'+f.duration.toFixed(4)+',');
            const u = f.relurl || f.url;
            lines.push(u);
            let keyinfo = null;
            if (f.decryptdata && f.decryptdata.uri) {
              keyinfo = {method: f.decryptdata.method, uri: f.decryptdata.uri, iv: f.decryptdata.iv ? ('0x'+BigInt(f.decryptdata.iv).toString(16).padStart(32,'0')) : null};
            }
            fragments.push({url: u, duration: f.duration, sn: f.sn, key: keyinfo});
          }
          lines.push('#EXT-X-ENDLIST');
          finish({
            ok: true,
            m3u8: lines.join('\n'),
            fragments,
            duration: det.totalduration,
            targetduration: td,
            baseurl: det.baseurl,
            m3u8_url: m3u8Url,
            raw_url: rawUrl,
            subtitles,
            frag_count: fragments.length,
            title: w.parent.MacPlayer.PlayNote || '',
            next: w.parent.MacPlayer.PlayLinkNext || '',
            pre: w.parent.MacPlayer.PlayLinkPre || '',
            vod_name: w.parent.MacPlayer.VodName || '',
          });
        } catch(e) { finish({err: 'build m3u8: '+e.message, stack: e.stack}); }
      });
      hls.on(w.Hls.Events.ERROR, (ev, data) => {
        if (data.fatal) {
          setTimeout(()=>finish({err: data.type+'/'+data.details, url: m3u8Url, resp: data.response?.code, contextUrl: data.context?.url, reason: data.reason}), 3000);
        }
      });
      try {
        hls.loadSource(m3u8Url);
        hls.attachMedia(v);
      } catch(e) { finish({err: 'hls start: '+e.message}); }
      setTimeout(()=>finish({timeout:true, m3u8_url: m3u8Url}), 20000);
    }
    if (needNavigate) {
      location.href = playUrl;
      setTimeout(doWork, 8000);
    } else {
      setTimeout(doWork, 1500);
    }
  });
}
"""

def decrypt_m3u8(play_url, navigate=True):
    """打开play_url，返回解密后的m3u8字典"""
    ws_url = _find_animoe_tab()
    if not ws_url:
        raise RuntimeError("没有找到animoe.org的标签页，请先在浏览器中打开网站")
    cdp = _CDP(ws_url)
    cur = cdp.ev("location.href") or ''
    if navigate and play_url not in cur:
        cdp.send("Page.navigate", {"url": play_url})
        time.sleep(10)
    else:
        time.sleep(2)
    # 关闭广告遮罩
    try:
        cdp.ev("(()=>{const b=document.getElementById('buffer');if(b)b.style.display='none';})()")
    except: pass
    time.sleep(2)
    r = cdp.ev(f"({_DECRYPT_JS})({json.dumps(play_url if navigate and play_url not in cur else '')})")
    cdp.close()
    return r

def get_vod_info(info_url):
    """获取番剧详情页的所有集数信息"""
    import urllib.request, re
    req = urllib.request.Request(info_url, headers={'User-Agent':'Mozilla/5.0'})
    html = urllib.request.urlopen(req, timeout=15).read().decode('utf-8','ignore')
    # 提取player_aaaa里的集数列表
    # player_aaaa是一个JS对象，包含vod_data和集数
    # 从playlist链接
    episodes = []
    # 找 play/xx-x-x 链接
    seen = set()
    for m in re.finditer(r'href="(/play/(\d+)-(\d+)-(\d+)\.html)"[^>]*>([^<]+)</a>', html):
        url, vid, sid, nid, name = m.group(1), m.group(2), m.group(3), m.group(4), m.group(5).strip()
        key = (vid,sid,nid)
        if key not in seen:
            seen.add(key)
            episodes.append({'url':'https://animoe.org'+url,'vid':vid,'sid':sid,'nid':nid,'name':name})
    # 标题
    title_m = re.search(r'<h1[^>]*class="[^"]*title[^"]*"[^>]*>([^<]+)</h1>', html)
    title = title_m.group(1).strip() if title_m else ''
    return {'title': title, 'episodes': episodes, 'html': html}

if __name__ == '__main__':
    import sys
    url = sys.argv[1] if len(sys.argv)>1 else "https://animoe.org/play/926-2-1.html"
    print("Decrypting:", url)
    r = decrypt_m3u8(url)
    print(json.dumps({k:v for k,v in r.items() if k not in ('m3u8','fragments')}, indent=2, ensure_ascii=False))
    if r.get('ok'):
        out = os.path.join(WORKDIR, 'plain.m3u8')
        with open(out,'w',encoding='utf-8') as f: f.write(r['m3u8'])
        print(f"\nm3u8 saved to {out}, {r['frag_count']} fragments, {r['duration']:.0f}s")
        print(r['m3u8'][:2000])
