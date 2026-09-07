import type { ChapterDoc } from '../types';
import { chapters, chapterNo, totalApiCount, totalExampleCount } from '../data';

const HERO_LINES = [
  { cmd: 'node --experimental-strip-types hello.ts', out: 'Hello, Node.js!' },
  { cmd: 'node -e "console.log(process.version)"', out: 'v22.11.0' },
  { cmd: 'node --watch --test src/', out: 'pass 42 fail 0' },
];

function esc(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function renderHome(main: HTMLElement): void {
  const apiCount = totalApiCount();
  const exCount = totalExampleCount();

  const heroTerm = HERO_LINES.map(
    (l) => `<div class="ht-line"><span class="term-prompt">$</span> ${esc(l.cmd)}</div><div class="ht-out">${esc(l.out)}</div>`,
  ).join('');

  const cards = chapters
    .map((ch: ChapterDoc, idx: number) => {
      const apiCountCh = ch.sections.reduce((sum, sec) => sum + sec.apis.length, 0);
      return `
      <a class="card" href="#/${ch.id}">
        <span class="card-no">${chapterNo(idx)}</span>
        <h3>${esc(ch.title)}</h3>
        <p>${esc(ch.tagline)}</p>
        <span class="card-meta">${apiCountCh} 个 API</span>
      </a>`;
    })
    .join('');

  main.innerHTML = `
    <div class="home">
      <section class="hero">
        <div class="hero-grid">
          <div class="hero-copy">
            <div class="hero-kicker">NODE.JS TREASURY</div>
            <h1>Node.js <span>宝典秘籍</span></h1>
            <p class="hero-desc">
              一部写给工程师的 Node.js 实战手册：从模块系统到事件循环，从 fs 到 child_process，
              每个核心 API 都配有参数说明、TypeScript 示例、真实输出与踩坑细节。
            </p>
            <div class="hero-stats">
              <span class="stat"><b>${chapters.length}</b> 章节</span>
              <span class="stat"><b>${apiCount}</b> 个核心 API</span>
              <span class="stat"><b>${exCount}</b> 个可运行示例</span>
            </div>
            <div class="hero-actions">
              <a class="btn-primary" href="#/getting-started">开始修炼</a>
              <a class="btn-ghost" href="#/lts">LTS 新特性</a>
            </div>
          </div>
          <div class="hero-term">${heroTerm}<span class="term-cursor"></span></div>
        </div>
      </section>
      <section class="chapter-grid">${cards}</section>
      <footer class="site-footer">
        <span>Node.js 宝典秘籍 · 基于 Node.js 22 LTS 编写</span>
        <span>纯 TypeScript + CSS3 构建 · 服务由 Node.js 驱动</span>
      </footer>
    </div>
  `;
}
