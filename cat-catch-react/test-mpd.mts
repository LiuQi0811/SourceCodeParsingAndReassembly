/**
 * MPD 解析器单元测试
 * 复用 src/public/lib/mpd-parser.min.js(原 lib/mpd-parser.min.js UMD bundle)
 * 通过手动注入 globalThis.window / DOMParser 加载到 vite-node 环境
 *
 * 运行: npx vite-node test-mpd.mts
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseMPD, isDRM, playlistToM3u8, formatVideoOption } from './src/lib/mpd-parser';

const BASE = 'http://127.0.0.1:8080/';
let pass = 0;
let fail = 0;
const failures: string[] = [];

function check(name: string, cond: boolean, detail = ''): void {
  if (cond) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    failures.push(`${name} ${detail}`);
    console.log(`  ✗ ${name} ${detail}`);
  }
}

async function main(): Promise<void> {
  // 加载 mpd-parser.min.js (UMD bundle,期望浏览器环境)
  // 用 @xmldom/xmldom 提供 DOMParser shim(Node 无原生 DOMParser)
  const xmldom = await import('@xmldom/xmldom');
  const DOMParserShim = xmldom.DOMParser;
  // 构造一个 window-like 沙箱,mpd-parser.min.js 会读取 t.DOMParser / t.URL 等
  const sandbox: Record<string, unknown> = {
    DOMParser: DOMParserShim,
    atob: (s: string) => Buffer.from(s, 'base64').toString('binary'),
    URL,
    BigInt,
  };
  sandbox.window = sandbox; // 自引用
  sandbox.self = sandbox;
  sandbox.globalThis = sandbox;

  const minJsPath = resolve(process.cwd(), 'src/public/lib/mpd-parser.min.js');
  const minJsCode = readFileSync(minJsPath, 'utf8');
  // UMD bundle 自执行,通过 module.exports/window.mpdParser 暴露
  // 我们用 Function 在带 window 的上下文里求值,捕获 module.exports
  const ModuleMock = { exports: {} as Record<string, unknown> };
  const factory = new Function(
    'self',
    'window',
    'globalThis',
    'module',
    'exports',
    'require',
    'DOMParser',
    'console',
    'Buffer',
    minJsCode +
      '\n; try { return (typeof module!=="undefined" && module.exports) ? module.exports : (typeof mpdParser!=="undefined"?mpdParser:(typeof window!=="undefined"&&window.mpdParser)?window.mpdParser:null); } catch(e){ return null; }',
  );
  const exported = factory(
    sandbox,
    sandbox,
    sandbox,
    ModuleMock,
    ModuleMock.exports,
    (id: string) => {
      if (id === '@xmldom/xmldom') return { DOMParser: DOMParserShim };
      return {};
    },
    DOMParserShim,
    console,
    Buffer,
  );
  const mpdParserMod = exported ?? ModuleMock.exports ?? null;
  if (!mpdParserMod || typeof (mpdParserMod as { parse?: unknown }).parse !== 'function') {
    console.error('!! 无法加载 mpd-parser.min.js, mpdParser=', mpdParserMod);
    process.exit(2);
  }
  // 注入到 globalThis.window.mpdParser 供 src/lib/mpd-parser.ts 使用
  (globalThis as unknown as { window?: { mpdParser?: unknown } }).window ??= {};
  (globalThis as unknown as { window: { mpdParser?: unknown } }).window.mpdParser =
    mpdParserMod;
  // isDRM 直接用 new DOMParser(),需在 globalThis 上提供
  (globalThis as unknown as { DOMParser?: unknown }).DOMParser = DOMParserShim;
  console.log('mpd-parser.min.js 已加载, parse 可用\n');

  console.log('[T1] 基本 MPD 解析(video + audio)');
  {
    const text = readFileSync(resolve(process.cwd(), 'test-fixtures/test.mpd'), 'utf8');
    const r = parseMPD(text, BASE + 'test.mpd');
    check('duration=30', r.duration === 30, `got ${r.duration}`);
    check('playlists.length=2', r.playlists.length === 2, `got ${r.playlists.length}`);
    check(
      'playlist0 bandwidth=1000000',
      r.playlists[0]?.attributes.BANDWIDTH === 1000000,
      `got ${r.playlists[0]?.attributes.BANDWIDTH}`,
    );
    check(
      'playlist0 resolution.width=640',
      (r.playlists[0]?.attributes.RESOLUTION as { width: number } | undefined)?.width === 640,
    );
    check(
      'playlist1 bandwidth=2500000',
      r.playlists[1]?.attributes.BANDWIDTH === 2500000,
    );
    // audio tracks via mediaGroups
    const audioGroups = r.mediaGroups?.AUDIO?.audio ?? {};
    const langs = Object.keys(audioGroups);
    check('audioGroups has en+zh', langs.length === 2, `got ${langs.join(',')}`);
    check('audio en playlist exists', (audioGroups['en']?.playlists.length ?? 0) > 0);
    check('audio zh playlist exists', (audioGroups['zh']?.playlists.length ?? 0) > 0);
  }

  console.log('\n[T2] playlistToM3u8 转换');
  {
    const text = readFileSync(resolve(process.cwd(), 'test-fixtures/test.mpd'), 'utf8');
    const r = parseMPD(text, BASE + 'test.mpd');
    // 注意:SegmentBase 类型 playlist 需要 sidxMapping 才能展开 segments,
    // 当前未提供 sidx -> segments 为空 -> playlistToM3u8 返回空串
    const m3u8 = playlistToM3u8(r.playlists[0]!);
    check(
      '空 segments 返回空串',
      m3u8 === '',
      `got len=${m3u8.length}`,
    );
    check(
      'playlist 有 sidx(indexRange)',
      !!(r.playlists[0] as { sidx?: unknown }).sidx,
      `sidx=${JSON.stringify((r.playlists[0] as { sidx?: unknown }).sidx).slice(0, 100)}`,
    );
    // 用合成 playlist 测试转换逻辑
    const fakePlaylist = {
      attributes: { NAME: 'test' },
      targetDuration: 6,
      segments: [
        {
          resolvedUri: BASE + 'seg0.ts',
          duration: 6,
          map: { resolvedUri: BASE + 'init.mp4' },
        },
        { resolvedUri: BASE + 'seg1.ts', duration: 6 },
      ],
    };
    const fakeM3u8 = playlistToM3u8(fakePlaylist as never);
    check('fake m3u8 starts with EXTM3U', fakeM3u8.startsWith('#EXTM3U'));
    check('fake m3u8 has ENDLIST', fakeM3u8.endsWith('#EXT-X-ENDLIST'));
    check('fake m3u8 has VERSION:3', fakeM3u8.includes('#EXT-X-VERSION:3'));
    check('fake m3u8 has TARGETDURATION:6', fakeM3u8.includes('#EXT-X-TARGETDURATION:6'));
    check('fake m3u8 has PLAYLIST-TYPE:VOD', fakeM3u8.includes('#EXT-X-PLAYLIST-TYPE:VOD'));
    check('fake m3u8 has EXT-X-MAP', fakeM3u8.includes(`#EXT-X-MAP:URI="${BASE}init.mp4"`));
    check('fake m3u8 has seg0.ts', fakeM3u8.includes(`${BASE}seg0.ts`));
    check('fake m3u8 has seg1.ts', fakeM3u8.includes(`${BASE}seg1.ts`));
  }

  console.log('\n[T3] formatVideoOption 格式化');
  {
    const text = readFileSync(resolve(process.cwd(), 'test-fixtures/test.mpd'), 'utf8');
    const r = parseMPD(text, BASE + 'test.mpd');
    const label = formatVideoOption(r.playlists[1]!, 1);
    check('label contains 720p resolution', label.includes('1280x720'), `got: ${label}`);
    check('label contains 60fps', label.includes('60.0'), `got: ${label}`);
    check('label contains bandwidth', label.includes('kbps'), `got: ${label}`);
  }

  console.log('\n[T4] DRM 检测');
  {
    const text = readFileSync(resolve(process.cwd(), 'test-fixtures/test-drm.mpd'), 'utf8');
    const drm = isDRM(text);
    check('drm.length=2', drm.length === 2, `got ${drm.length}`);
    check(
      'Widevine detected',
      drm.some((d) => d.encryptionType === 'Widevine'),
    );
    check(
      'Microsoft PlayReady detected',
      drm.some((d) => d.encryptionType === 'Microsoft PlayReady'),
    );
    check('all have pssh', drm.every((d) => d.pssh.length > 0));
    check(
      'widevine pssh base64',
      drm.find((d) => d.encryptionType === 'Widevine')?.pssh.includes('=='),
    );
  }

  console.log('\n[T5] 非 DRM MPD');
  {
    const text = readFileSync(resolve(process.cwd(), 'test-fixtures/test.mpd'), 'utf8');
    const drm = isDRM(text);
    check('drm.length=0', drm.length === 0);
  }

  console.log(`\n===== MPD 结果: ${pass} 通过 / ${fail} 失败 =====\n`);
  if (fail > 0) {
    console.log('失败详情:\n' + failures.map((f) => '  - ' + f).join('\n'));
    process.exit(1);
  }
}

void main();
