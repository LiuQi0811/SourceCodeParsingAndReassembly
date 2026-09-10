import json, time, urllib.request, websocket

tabs = json.loads(urllib.request.urlopen("http://127.0.0.1:9222/json").read())
ws_url = None
for t in tabs:
    if 'yichengwlkj' in t.get('url',''):
        ws_url = t['webSocketDebuggerUrl']
        break
if not ws_url:
    ws_url = tabs[0]['webSocketDebuggerUrl']

ws = websocket.create_connection(ws_url)
msg_id = [1]
def send(method, params=None):
    ws.send(json.dumps({"id":msg_id[0],"method":method,"params":params or {}}))
    msg_id[0] += 1

send("Network.enable")
send("Page.enable")

# 发送JS到页面，覆盖签名函数记录msg
send("Runtime.evaluate", {
  "expression": """
  (function(){
    // Hook CryptoJS HMAC SHA256
    if (!window.__origHmac) {
      // 简单方式：hook fetch 打印最终URL和headers，我们要拿到 x-ca-sign 和 t 以及 最终URL
      const _fetch = window.fetch;
      window.__sigs = [];
      window.fetch = async function(input, init) {
        const url = typeof input === 'string' ? input : input.url;
        if (url.includes('api.rrmj.plus') && url.includes('drama/')) {
          const headers = new Headers(init?.headers || input?.headers || {});
          const h = {};
          headers.forEach((v,k) => h[k]=v);
          window.__sigs.push({url, headers: h});
        }
        return _fetch.apply(this, arguments);
      };
    }
    return 'hooked';
  })();
  """,
  "awaitPromise": True
})

# 刷新页面
send("Page.reload", {"ignoreCache": True})

import time as _t
_t.sleep(8)

# 读取__sigs
send("Runtime.evaluate", {"expression": "JSON.stringify(window.__sigs)", "awaitPromise": True})

deadline = time.time() + 5
while time.time() < deadline:
    ws.settimeout(1)
    try:
        data = ws.recv()
        m = json.loads(data)
        if m.get('id') and m.get('result',{}).get('result',{}).get('value'):
            val = m['result']['result']['value']
            if val and val != 'hooked':
                print("=== CAPTURED SIGS ===")
                print(val[:5000])
        if m.get('method','').startswith('Network.'):
            pass  # ignore
    except websocket.WebSocketTimeoutException:
        continue
    except Exception as e:
        pass

ws.close()
