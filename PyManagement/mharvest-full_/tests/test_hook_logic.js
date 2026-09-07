/* 在 Node 里模拟浏览器的 MSE 环境，验证注入脚本的逻辑。
 *
 * 浏览器跑不起来的环境下，这能覆盖最容易出错的几处：
 *   1. appendBuffer 是否真被拦截
 *   2. slice(0) 复制是否生效（原 buffer 被改后，捕获的数据还完整吗）
 *   3. createObjectURL 能否识别 MediaSource
 *   4. base64 往返编解码是否无损
 */

const fs = require('fs');

// ---------- 模拟浏览器环境 ----------
class MediaSource {}
class SourceBuffer {
  constructor() { this.received = []; }
  appendBuffer(data) {
    // 模拟播放器的真实行为：把数据留下，且会复用/覆盖传入的 buffer
    this.received.push(data);
  }
}
class URLClass {
  static createObjectURL(obj) {
    const url = 'blob:http://localhost/' + Math.random().toString(36).slice(2);
    return url;
  }
}

global.MediaSource = MediaSource;
global.SourceBuffer = SourceBuffer;
global.URL = URLClass;
global.window = global;
global.btoa = (s) => Buffer.from(s, 'binary').toString('base64');

// ---------- 载入待验证的脚本 ----------
const hook = fs.readFileSync('/tmp/js_hook.js', 'utf8');
const fetchChunk = fs.readFileSync('/tmp/js_fetch.js', 'utf8');
const countChunks = fs.readFileSync('/tmp/js_count.js', 'utf8');
const clearChunks = fs.readFileSync('/tmp/js_clear.js', 'utf8');

eval(hook);
const doFetchChunk = eval(fetchChunk);
const doCount = eval(countChunks);
const doClear = eval(clearChunks);

let pass = 0, fail = 0;
function check(name, cond, detail) {
  if (cond) { console.log('  [OK  ] ' + name); pass++; }
  else { console.log('  [FAIL] ' + name + (detail ? '  -> ' + detail : '')); fail++; }
}

console.log('\n=== 1. appendBuffer 拦截 ===');
{
  const sb = new SourceBuffer();
  const payload = new Uint8Array([1, 2, 3, 4, 5]).buffer;
  sb.appendBuffer(payload);
  check('调用后被记录', doCount() === 1, 'count=' + doCount());
  check('播放器自身仍收到数据', sb.received.length === 1,
        'received=' + sb.received.length);
}

console.log('\n=== 2. slice(0) 复制语义（最关键）===');
{
  doClear();
  const sb = new SourceBuffer();
  const buf = new Uint8Array([10, 20, 30, 40]).buffer;
  sb.appendBuffer(buf);
  // 模拟播放器复用 buffer：把内容全部覆盖掉
  new Uint8Array(buf).fill(0);
  const captured = Buffer.from(doFetchChunk(0), 'base64');
  check('捕获的字节未被污染',
        captured[0] === 10 && captured[3] === 40,
        'got=[' + Array.from(captured).join(',') + ']');
}

console.log('\n=== 3. base64 往返（大块数据，验证没踩 apply 栈溢出）===');
{
  doClear();
  const sb = new SourceBuffer();
  const big = new Uint8Array(500000);
  for (let i = 0; i < big.length; i++) big[i] = i % 251;  // 251 是质数，波形不重复
  sb.appendBuffer(big.buffer);
  const b64 = doFetchChunk(0);
  const back = Buffer.from(b64, 'base64');
  check('长度一致', back.length === big.length,
        big.length + ' vs ' + back.length);
  let same = true;
  for (let i = 0; i < big.length; i += 997) {
    if (back[i] !== big[i]) { same = false; break; }
  }
  check('抽样内容一致', same);
}

console.log('\n=== 4. appendBufferAsync 也拦得住 ===');
{
  doClear();
  SourceBuffer.prototype.appendBufferAsync = function (d) { return Promise.resolve(); };
  // 重新注入一次，让 hook 认到 async 版本
  global.__MH_HOOKED__ = false;
  eval(hook);
  const sb = new SourceBuffer();
  sb.appendBufferAsync(new Uint8Array([7, 8, 9]).buffer);
  check('异步版本被记录', doCount() === 1, 'count=' + doCount());
}

console.log('\n=== 5. MediaSource 的 blob 地址被记录 ===');
{
  // 上一节为了测 async 分支重新注入过一次 hook，先清掉历史记录
  global.__MH_BLOBS__ = [];
  const ms = new MediaSource();
  const url = URL.createObjectURL(ms);
  check('识别 MediaSource', global.__MH_BLOBS__.length === 1,
        JSON.stringify(global.__MH_BLOBS__));
  check('返回的是 blob: 地址', url.startsWith('blob:'), url);
  // 非 MediaSource 的对象不该被记录（比如 Blob 缩略图）
  URLClass.createObjectURL({ name: 'not-a-media-source' });
  check('非 MediaSource 不记录', global.__MH_BLOBS__.length === 1,
        JSON.stringify(global.__MH_BLOBS__));
}

console.log('\n=== 6. 重复注入的守卫（防 hook 叠加）===');
{
  // 浏览器里每个 frame 都会跑一次 init script，
  // 守卫失效的话 appendBuffer 会被包装多次，数据重复记录
  doClear();
  eval(hook);  // __MH_HOOKED__ 仍为 true，应当直接 return
  const sb = new SourceBuffer();
  sb.appendBuffer(new Uint8Array([1]).buffer);
  check('重复注入后仍只记一次', doCount() === 1, 'count=' + doCount());
}

console.log('\n=== 7. 越界取块不会崩 ===');
{
  doClear();
  check('空数组取值返回 null', doFetchChunk(5) === null);
  check('空数组计数为 0', doCount() === 0);
}

console.log('\n结果：' + pass + ' 通过，' + fail + ' 失败\n');
process.exit(fail === 0 ? 0 : 1);
