import type { ApiDoc, ChapterDoc } from '../types';
import { chapters, chapterNo } from '../data';
import { renderCodeBlock, firstBashCommand } from './codeblock';
import { renderHome } from './home';

function esc(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const CHECK_SVG = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m4 12 5 5L20 6"/></svg>';
const GEAR_SVG = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.03 1.56V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1.11-1.56 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.56-1.03H3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.56-1.11 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34h.01a1.7 1.7 0 0 0 1.03-1.56V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1.03 1.56 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87v.01a1.7 1.7 0 0 0 1.56 1.03H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.51.95Z"/></svg>';

function renderParams(api: ApiDoc): string {
  if (api.params.length === 0) return '';
  const rows = api.params
    .map(
      (pm) => `<tr>
        <td><code class="pm-name">${esc(pm.name)}</code></td>
        <td><code class="pm-type">${esc(pm.type)}</code></td>
        <td><span class="pm-req${pm.required ? '' : ' opt'}">${pm.required ? '必填' : '可选'}</span></td>
        <td>${esc(pm.desc)}</td>
      </tr>`,
    )
    .join('');
  return `
  <div class="params">
    <div class="sub-title">参数说明</div>
    <div class="table-wrap"><table>
      <thead><tr><th>参数</th><th>类型</th><th>必填</th><th>说明</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>
  </div>`;
}

function renderExamples(api: ApiDoc, chapterId: string, apiIndex: number): string {
  if (api.examples.length === 0) return '';
  const items = api.examples
    .map((exItem, i) => {
      const boxId = `box-${chapterId}-${api.id}-${i}`;
      const command =
        exItem.lang === 'bash'
          ? firstBashCommand(exItem.code)
          : `node examples/${chapterId}/${api.id}${api.examples.length > 1 ? `-${i + 1}` : ''}.ts`;
      const title = exItem.title ?? `示例 ${i + 1}`;
      return `
      <div class="example">
        <div class="ex-title"><span class="ex-no">${apiIndex + 1}.${i + 1}</span>${esc(title)}</div>
        ${renderCodeBlock({ lang: exItem.lang, code: exItem.code, output: exItem.output, note: exItem.note, command, boxId })}
      </div>`;
    })
    .join('');
  return `<div class="examples"><div class="sub-title">使用示例</div>${items}</div>`;
}

function renderDetails(api: ApiDoc): string {
  if (api.details.length === 0) return '';
  const items = api.details.map((d) => `<li>${CHECK_SVG}<span>${esc(d)}</span></li>`).join('');
  return `<div class="details"><div class="sub-title">关键细节</div><ul class="detail-list">${items}</ul></div>`;
}

function renderConfig(api: ApiDoc): string {
  if (!api.config || api.config.length === 0) return '';
  const items = api.config.map((c) => `<li>${GEAR_SVG}<code>${esc(c)}</code></li>`).join('');
  return `<div class="configs"><div class="sub-title">配置建议</div><ul class="config-list">${items}</ul></div>`;
}

function renderApi(api: ApiDoc, chapterId: string): string {
  const since = api.since ? `<span class="badge-since">${esc(api.since)}</span>` : '';
  return `
  <article class="api" id="api-${esc(api.id)}">
    <div class="api-head">
      <h2>${esc(api.title)}${since}</h2>
      <code class="api-sig">${esc(api.signature)}</code>
    </div>
    <p class="api-desc">${esc(api.desc)}</p>
    ${renderParams(api)}
    ${renderExamples(api, chapterId, 0)}
    ${renderDetails(api)}
    ${renderConfig(api)}
  </article>`;
}

function renderPager(chapterId: string): string {
  const idx = chapters.findIndex((ch) => ch.id === chapterId);
  const prev = idx > 0 ? chapters[idx - 1] : null;
  const next = idx < chapters.length - 1 ? chapters[idx + 1] : null;
  const prevHtml = prev
    ? `<a class="pager-link prev" href="#/${prev.id}"><span>上一章</span><b>${esc(prev.title)}</b></a>`
    : '<span class="pager-link prev empty"></span>';
  const nextHtml = next
    ? `<a class="pager-link next" href="#/${next.id}"><span>下一章</span><b>${esc(next.title)}</b></a>`
    : '<span class="pager-link next empty"></span>';
  return `<nav class="pager">${prevHtml}${nextHtml}</nav>`;
}

export function renderChapter(main: HTMLElement, chapter: ChapterDoc, apiId: string | null): void {
  const idx = chapters.findIndex((ch) => ch.id === chapter.id);
  const apiCount = chapter.sections.reduce((sum, sec) => sum + sec.apis.length, 0);

  const sectionsHtml = chapter.sections
    .map((sec) => {
      const secHead = chapter.sections.length > 1 ? `<h2 class="section-title">${esc(sec.title)}</h2>` : '';
      return secHead + sec.apis.map((api) => renderApi(api, chapter.id)).join('');
    })
    .join('');

  main.innerHTML = `
    <div class="chapter-page">
      <nav class="breadcrumb"><a href="#/">宝典总览</a><span class="bc-sep">/</span><b>${esc(chapter.title)}</b></nav>
      <header class="chapter-head">
        <div class="chapter-kicker">第 ${chapterNo(idx)} 章 · ${apiCount} 个 API</div>
        <h1>${esc(chapter.title)}</h1>
        <p class="chapter-tagline">${esc(chapter.tagline)}</p>
      </header>
      ${sectionsHtml}
      ${renderPager(chapter.id)}
      <footer class="site-footer">
        <span>Node.js 宝典秘籍 · 基于 Node.js 22 LTS 编写</span>
        <span>纯 TypeScript + CSS3 构建 · 服务由 Node.js 驱动</span>
      </footer>
    </div>
  `;
}

export { renderHome };
