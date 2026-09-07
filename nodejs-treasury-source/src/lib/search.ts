import type { ChapterDoc, SearchItem } from '../types';

let cache: SearchItem[] | null = null;

function buildIndex(chapters: ChapterDoc[]): SearchItem[] {
  const items: SearchItem[] = [];
  chapters.forEach((ch, idx) => {
    ch.sections.forEach((sec) => {
      sec.apis.forEach((api) => {
        items.push({
          chapterId: ch.id,
          chapterTitle: `${String(idx + 1).padStart(2, '0')} ${ch.title}`,
          apiId: api.id,
          title: api.title,
          signature: api.signature,
          desc: api.desc,
          haystack: `${api.title} ${api.signature} ${api.desc} ${api.id} ${ch.title}`.toLowerCase(),
        });
      });
    });
  });
  return items;
}

export function getSearchIndex(chapters: ChapterDoc[]): SearchItem[] {
  if (cache === null) cache = buildIndex(chapters);
  return cache;
}

export interface SearchResult extends SearchItem {
  /** 命中片段（用于展示） */
  hit: string;
}

/** 快速搜索：标题命中优先，其次签名/描述；最多返回 limit 条 */
export function search(index: SearchItem[], query: string, limit = 12): SearchResult[] {
  const q = query.trim().toLowerCase();
  if (q.length === 0) return [];
  const results: Array<SearchResult & { score: number }> = [];
  for (const item of index) {
    let score = -1;
    let hit = '';
    if (item.title.toLowerCase().includes(q)) {
      score = 100;
      hit = item.title;
    } else if (item.signature.toLowerCase().includes(q)) {
      score = 60;
      hit = item.signature;
    } else if (item.desc.toLowerCase().includes(q)) {
      score = 30;
      hit = item.desc.length > 60 ? item.desc.slice(0, 60) + '...' : item.desc;
    } else if (item.haystack.includes(q)) {
      score = 10;
      hit = item.chapterTitle;
    }
    if (score >= 0) results.push({ ...item, score, hit });
  }
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit).map((r) => ({
    chapterId: r.chapterId,
    chapterTitle: r.chapterTitle,
    apiId: r.apiId,
    title: r.title,
    signature: r.signature,
    desc: r.desc,
    haystack: r.haystack,
    hit: r.hit,
  }));
}
