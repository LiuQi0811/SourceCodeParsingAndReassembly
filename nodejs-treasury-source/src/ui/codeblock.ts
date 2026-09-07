import { highlightCode } from '../lib/highlight';
import type { CodeLang } from '../lib/highlight';

const COPY_ICON = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>';
const CHECK_ICON = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m4 12 5 5L20 6"/></svg>';
const PLAY_ICON = '<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M7 4.5v15l13-7.5Z"/></svg>';
const REPLAY_ICON = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/></svg>';

const LANG_LABEL: Record<CodeLang, string> = {
  ts: 'TypeScript',
  bash: 'SHELL',
  json: 'JSON',
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

/** 从 bash 示例中提取首条可执行命令（跳过注释行） */
export function firstBashCommand(code: string): string {
  for (const line of code.split('\n')) {
    const t = line.trim();
    if (t.length > 0 && !t.startsWith('#')) return t;
  }
  return 'bash';
}

export interface CodeBlockData {
  lang: CodeLang;
  code: string;
  output?: string;
  note?: string;
  command?: string;
  boxId: string;
}

/** 渲染代码块 + 输出框（终端） */
export function renderCodeBlock(data: CodeBlockData): string {
  const langLabel = LANG_LABEL[data.lang];
  const hasOutput = typeof data.output === 'string' && data.output.length > 0;
  const outputHtml = hasOutput
    ? `
    <div class="outputbox" id="${data.boxId}" data-command="${escapeAttr(data.command ?? '')}" data-output="${escapeAttr(data.output ?? '')}">
      <div class="ob-bar">
        <span class="ob-dots"><i></i><i></i><i></i></span>
        <span class="ob-label">终端输出</span>
        <span class="ob-cmd">$ ${escapeHtml(data.command ?? 'node index.ts')}</span>
        <button class="btn-replay" type="button" data-target="${data.boxId}">${REPLAY_ICON}<span>重新播放</span></button>
      </div>
      <pre class="ob-body">${escapeHtml(data.output ?? '')}</pre>
    </div>`
    : '';
  const noteHtml = data.note ? `<p class="ex-note">${escapeHtml(data.note)}</p>` : '';

  return `
  <div class="codeblock">
    <div class="cb-bar">
      <span class="cb-lang">${langLabel}</span>
      <div class="cb-actions">
        <button class="btn-run" type="button" data-target="${data.boxId}" ${hasOutput ? '' : 'hidden'}>${PLAY_ICON}<span>运行模拟</span></button>
        <button class="btn-copy" type="button">${COPY_ICON}<span>复制</span></button>
      </div>
    </div>
    <pre class="cb-pre"><code>${highlightCode(data.code, data.lang)}</code></pre>
  </div>
  ${outputHtml}
  ${noteHtml}`;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeAttr(text: string): string {
  return escapeHtml(text).replace(/"/g, '&quot;');
}

let runToken = 0;

/** 终端模拟：逐字键入命令、逐行输出 */
export async function replayOutput(box: HTMLElement): Promise<void> {
  const command = box.dataset.command ?? '';
  const output = box.dataset.output ?? '';
  const body = box.querySelector('.ob-body') as HTMLElement;
  const token = ++runToken;

  box.classList.add('running');
  body.innerHTML =
    '<div class="term-line"><span class="term-prompt">$</span> <span class="term-cmd"></span><span class="term-cursor"></span></div>';
  const cmdEl = body.querySelector('.term-cmd') as HTMLElement;

  for (const ch of command) {
    if (token !== runToken) return;
    cmdEl.textContent += ch;
    await sleep(16);
  }
  await sleep(240);
  if (token !== runToken) return;
  const cursor = body.querySelector('.term-cursor');
  if (cursor) cursor.remove();

  for (const line of output.split('\n')) {
    if (token !== runToken) return;
    const div = document.createElement('div');
    div.className = 'term-line';
    div.textContent = line.length === 0 ? ' ' : line;
    body.appendChild(div);
    await sleep(65);
  }
  if (token !== runToken) return;
  const exit = document.createElement('div');
  exit.className = 'term-exit';
  exit.textContent = '[进程已退出，code 0]';
  body.appendChild(exit);
  box.classList.remove('running');
}

/** 代码块交互：复制 + 运行模拟（事件委托） */
export function bindCodeBlockActions(root: HTMLElement): void {
  root.addEventListener('click', (e: MouseEvent) => {
    const target = e.target as HTMLElement;

    const runBtn = target.closest('.btn-run') as HTMLElement | null;
    const replayBtn = target.closest('.btn-replay') as HTMLElement | null;
    if (runBtn || replayBtn) {
      const boxId = (runBtn ?? replayBtn)?.dataset.target ?? '';
      const box = document.getElementById(boxId);
      if (box) {
        box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        void replayOutput(box);
      }
      return;
    }

    const copyBtn = target.closest('.btn-copy') as HTMLElement | null;
    if (copyBtn) {
      const block = copyBtn.closest('.codeblock') as HTMLElement;
      const pre = block.querySelector('.cb-pre') as HTMLElement;
      void copyText(pre.textContent ?? '').then((ok) => {
        const label = copyBtn.querySelector('span') as HTMLElement;
        if (!ok) return;
        copyBtn.classList.add('copied');
        label.textContent = '已复制';
        window.setTimeout(() => {
          copyBtn.classList.remove('copied');
          label.textContent = '复制';
        }, 1600);
      });
    }
  });
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // 非安全上下文降级方案
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}
