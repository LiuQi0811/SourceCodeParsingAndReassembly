import json, time, urllib.request, websocket

tabs = json.loads(urllib.request.urlopen("http://127.0.0.1:9222/json").read())
ws_url = None
for t in tabs:
    if 'yichengwlkj' in t.get('url',''):
        ws_url = t['webSocketDebuggerUrl']
        print("target:", t['url'])
        break
if not ws_url:
    ws_url = tabs[0]['webSocketDebuggerUrl']
    print("use first tab:", tabs[0]['url'])

ws = websocket.create_connection(ws_url)
msg_id = [1]
def send(method, params=None):
    ws.send(json.dumps({"id":msg_id[0],"method":method,"params":params or {}}))
    msg_id[0] += 1

send("Network.enable")
send("Page.enable")

send("Page.navigate", {"url":"https://mh.yichengwlkj.com/pc/drama/34838"})

pending = {}
deadline = time.time() + 25
while time.time() < deadline:
    ws.settimeout(1)
    try:
        data = ws.recv()
        m = json.loads(data)
        method = m.get('method','')
        params = m.get('params',{})
        if method == 'Network.requestWillBeSent':
            req = params.get('request',{})
            url = req.get('url','')
            if 'api.rrmj.plus' in url and 'drama' in url:
                rid = params.get('requestId')
                pending[rid] = url
                print(f"\n=== REQUEST {url}")
                print(f"Method: {req.get('method')}")
                h = req.get('headers',{})
                for k,v in h.items():
                    print(f"  {k}: {v[:200]}")
                print(f"  PostData: {str(req.get('postData',''))[:500]}")
        if method == 'Network.responseReceived':
            resp = params.get('response',{})
            url = resp.get('url','')
            rid = params.get('requestId')
            if 'api.rrmj.plus' in url and 'drama' in url:
                print(f"\n=== RESPONSE {url} status={resp.get('status')}")
                for k,v in resp.get('headers',{}).items():
                    print(f"  {k}: {v}")
                send("Network.getResponseBody", {"requestId": rid})
        if m.get('id') and 'result' in m:
            body = m['result'].get('body','')
            print(f"  Response Body (first 800): {body[:800]}")
    except websocket.WebSocketTimeoutException:
        continue
    except Exception as e:
        pass

ws.close()
