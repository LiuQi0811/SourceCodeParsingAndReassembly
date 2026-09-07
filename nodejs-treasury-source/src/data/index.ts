import type { ChapterDoc } from '../types';
import { gettingStarted } from './ch01-getting-started';
import { modules } from './ch02-modules';
import { fsChapter } from './ch03-fs';
import { pathChapter } from './ch04-path';
import { httpChapter } from './ch05-http';
import { eventsChapter } from './ch06-events';
import { streamChapter } from './ch07-stream';
import { bufferChapter } from './ch08-buffer';
import { asyncChapter } from './ch09-async';
import { processChapter } from './ch10-process';
import { toolsChapter } from './ch11-tools';
import { cryptoChapter } from './ch12-crypto';
import { childProcessChapter } from './ch13-child-process';
import { globalsChapter } from './ch14-globals';
import { tsPracticeChapter } from './ch15-ts-practice';
import { ltsChapter } from './ch16-lts';
import { netChapter } from './ch17-net';
import { concurrencyChapter } from './ch18-concurrency';
import { readlineChapter } from './ch19-readline';
import { miscChapter } from './ch20-misc';
import { advancedChapter } from './ch21-advanced';

export const chapters: ChapterDoc[] = [
  gettingStarted,
  modules,
  fsChapter,
  pathChapter,
  httpChapter,
  eventsChapter,
  streamChapter,
  bufferChapter,
  asyncChapter,
  processChapter,
  toolsChapter,
  cryptoChapter,
  childProcessChapter,
  globalsChapter,
  tsPracticeChapter,
  ltsChapter,
  netChapter,
  concurrencyChapter,
  readlineChapter,
  miscChapter,
  advancedChapter,
];

/** 章节序号格式化：1 -> 01 */
export function chapterNo(index: number): string {
  return String(index + 1).padStart(2, '0');
}

/** 全站 API 总数 */
export function totalApiCount(): number {
  return chapters.reduce((sum, ch) => sum + ch.sections.reduce((s, sec) => s + sec.apis.length, 0), 0);
}

/** 全站示例总数 */
export function totalExampleCount(): number {
  return chapters.reduce(
    (sum, ch) => sum + ch.sections.reduce((s, sec) => s + sec.apis.reduce((a, api) => a + api.examples.length, 0), 0),
    0,
  );
}

/** 按 id 查找章节 */
export function findChapter(id: string): ChapterDoc | undefined {
  return chapters.find((ch) => ch.id === id);
}
