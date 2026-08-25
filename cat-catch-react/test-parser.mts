/**
 * M3U8 解析器单元测试
 * 通过 vite-node 直接运行 TS 源码,验证 parseM3u8/fetchAndParseM3u8 逻辑
 *
 * 运行: npx vite-node test-parser.mts
 */
import { parseM3u8, fetchAndParseM3u8 } from './src/lib/m3u8-parser';

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

function assertEq<T>(name: string, actual: T, expected: T): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  check(name, a === e, `\n    actual:   ${a}\n    expected: ${e}`);
}

async function main(): Promise<void> {
  console.log('\n[T1] master playlist 解析');
  {
    const text = await (await fetch(BASE + 'master.m3u8')).text();
    const r = parseM3u8(text, BASE + 'master.m3u8');
    check('isMaster=true', r.isMaster);
    check('levels.length=2', r.levels.length === 2, `got ${r.levels.length}`);
    check(
      'level0 url=media-low.m3u8',
      r.levels[0]?.url === BASE + 'media-low.m3u8',
      `got ${r.levels[0]?.url}`,
    );
    check('level0 bandwidth=1280000', r.levels[0]?.bandwidth === 1280000);
    check('level0 resolution=640x360', r.levels[0]?.resolution === '640x360');
    check(
      'level1 url=media-high.m3u8',
      r.levels[1]?.url === BASE + 'media-high.m3u8',
      `got ${r.levels[1]?.url}`,
    );
    check('level1 bandwidth=2560000', r.levels[1]?.bandwidth === 2560000);
    check('media playlist fragments 为空', r.fragments.length === 0);
  }

  console.log('\n[T2] media playlist 解析(无加密)');
  {
    const text = await (await fetch(BASE + 'media-high.m3u8')).text();
    const r = parseM3u8(text, BASE + 'media-high.m3u8');
    check('isMaster=false', !r.isMaster);
    check('fragments.length=3', r.fragments.length === 3, `got ${r.fragments.length}`);
    check('totalDuration=12', r.totalDuration === 12, `got ${r.totalDuration}`);
    check('live=false', !r.live);
    check('version=3', r.version === 3);
    check(
      'frag0 url',
      r.fragments[0]?.url === BASE + 'segment_0.ts',
      `got ${r.fragments[0]?.url}`,
    );
    check('frag0 index=0', r.fragments[0]?.index === 0);
    check('frag1 index=1', r.fragments[1]?.index === 1);
    check('frag2 index=2', r.fragments[2]?.index === 2);
    check('frag0 duration=4', r.fragments[0]?.duration === 4);
    check('frag0 encrypted=false', !r.fragments[0]?.encrypted);
  }

  console.log('\n[T3] media playlist 解析(AES-128 + EXT-X-MAP + IV)');
  {
    const text = await (await fetch(BASE + 'media-low.m3u8')).text();
    const r = parseM3u8(text, BASE + 'media-low.m3u8');
    check('fragments.length=4', r.fragments.length === 4, `got ${r.fragments.length}`);
    check('totalDuration=24', r.totalDuration === 24, `got ${r.totalDuration}`);
    check('targetDuration=6', r.targetDuration === 6);
    // key info
    check('keyInfo.method=AES-128', r.keyInfo?.method === 'AES-128');
    check(
      'keyInfo.uri=key.bin absolute',
      r.keyInfo?.uri === BASE + 'key.bin',
      `got ${r.keyInfo?.uri}`,
    );
    check('keyInfo.iv length=16', r.keyInfo?.iv?.length === 16, `got ${r.keyInfo?.iv?.length}`);
    check('keyInfo.iv[15]=1', r.keyInfo?.iv?.[15] === 1, `got ${r.keyInfo?.iv?.[15]}`);
    // fragment inherit
    check('frag0 encrypted=true', !!r.fragments[0]?.encrypted);
    check('frag0 decryptdata.uri', r.fragments[0]?.decryptdata?.uri === BASE + 'key.bin');
    check('frag0 decryptdata.iv[15]=1', r.fragments[0]?.decryptdata?.iv?.[15] === 1);
    // init segment
    check(
      'frag0 initSegment.url',
      r.fragments[0]?.initSegment?.url === BASE + 'init.mp4',
      `got ${r.fragments[0]?.initSegment?.url}`,
    );
    check('all frags have initSegment', r.fragments.every((f) => f.initSegment?.url === BASE + 'init.mp4'));
  }

  console.log('\n[T4] media playlist 解析(BYTERANGE + v4)');
  {
    const text = await (await fetch(BASE + 'media-byterange.m3u8')).text();
    const r = parseM3u8(text, BASE + 'media-byterange.m3u8');
    check('version=4', r.version === 4);
    check('fragments.length=3', r.fragments.length === 3, `got ${r.fragments.length}`);
    check('totalDuration=15', r.totalDuration === 15, `got ${r.totalDuration}`);
    // init segment with byterange
    check(
      'init byteRange=[0,720]',
      JSON.stringify(r.fragments[0]?.initSegment?.byteRange) === '[0,720]',
      `got ${JSON.stringify(r.fragments[0]?.initSegment?.byteRange)}`,
    );
    // segment byteRange
    check(
      'frag0 byteRange=[720,1744]',
      JSON.stringify(r.fragments[0]?.byteRange) === '[720,1744]',
      `got ${JSON.stringify(r.fragments[0]?.byteRange)}`,
    );
    check(
      'frag1 byteRange=[1744,2768]',
      JSON.stringify(r.fragments[1]?.byteRange) === '[1744,2768]',
      `got ${JSON.stringify(r.fragments[1]?.byteRange)}`,
    );
    check(
      'frag2 byteRange=[2768,3792]',
      JSON.stringify(r.fragments[2]?.byteRange) === '[2768,3792]',
      `got ${JSON.stringify(r.fragments[2]?.byteRange)}`,
    );
    // url absolute
    check(
      'frag0 url',
      r.fragments[0]?.url === BASE + 'single-segment.mp4',
      `got ${r.fragments[0]?.url}`,
    );
  }

  console.log('\n[T5] fetchAndParseM3u8(网络请求 + 解析)');
  {
    const r = await fetchAndParseM3u8(BASE + 'media-low.m3u8');
    check('fetch master ok', r.fragments.length === 4, `got ${r.fragments.length}`);
    check('fetch keyInfo.method', r.keyInfo?.method === 'AES-128');
    check(
      'fetch frag0 absolute url',
      r.fragments[0]?.url === BASE + 'segment_0.ts',
      `got ${r.fragments[0]?.url}`,
    );
  }

  console.log('\n[T6] 异常输入(非 m3u8)');
  {
    const r = parseM3u8('not a m3u8 file', BASE);
    check('fragments=0', r.fragments.length === 0);
    check('isMaster=false', !r.isMaster);
    check('live=true', r.live);
  }

  console.log('\n[T7] 空 m3u8');
  {
    const r = parseM3u8('#EXTM3U\n', BASE);
    check('fragments=0', r.fragments.length === 0);
    check('isMaster=false', !r.isMaster);
  }

  console.log(`\n===== 结果: ${pass} 通过 / ${fail} 失败 =====\n`);
  if (fail > 0) {
    console.log('失败详情:\n' + failures.map((f) => '  - ' + f).join('\n'));
    process.exit(1);
  }
}

void main();
