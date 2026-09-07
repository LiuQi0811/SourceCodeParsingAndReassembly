import type { Route } from '../lib/router';
import { chapters, chapterNo } from '../data';

export function renderSidebar(nav: HTMLElement, route: Route): void {
  const activeChapter = route.name === 'chapter' ? route.chapterId : null;
  const activeApi = route.name === 'chapter' ? route.apiId : null;
  const html: string[] = [];

  html.push(
    `<a class="nav-ch nav-home${route.name === 'home' ? ' active' : ''}" href="#/">` +
      '<span class="nav-no">00</span><span class="nav-title">宝典总览</span></a>',
  );

  chapters.forEach((ch, idx) => {
    const no = chapterNo(idx);
    const isActive = activeChapter === ch.id;
    const apiCount = ch.sections.reduce((sum, sec) => sum + sec.apis.length, 0);
    html.push(
      `<a class="nav-ch${isActive ? ' active' : ''}" href="#/${ch.id}">` +
        `<span class="nav-no">${no}</span><span class="nav-title">${ch.title}</span><span class="nav-count">${apiCount}</span></a>`,
    );
    if (isActive) {
      ch.sections.forEach((sec) => {
        if (ch.sections.length > 1) {
          html.push(`<div class="nav-sec">${sec.title}</div>`);
        }
        sec.apis.forEach((api) => {
          const cls = activeApi === api.id ? ' active' : '';
          html.push(`<a class="nav-api${cls}" href="#/${ch.id}/${api.id}">${api.title}</a>`);
        });
      });
    }
  });

  nav.innerHTML = html.join('');
}
