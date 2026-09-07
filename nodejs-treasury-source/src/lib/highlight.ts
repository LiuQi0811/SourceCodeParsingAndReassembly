// 轻量级语法高亮器（零依赖）：支持 TypeScript / Bash / JSON
// 输出 HTML 片段，类名 tk-* 由 style.css 定义配色

export type CodeLang = 'ts' | 'bash' | 'json';

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function span(cls: string, text: string): string {
  return `<span class="${cls}">${escapeHtml(text)}</span>`;
}

const TS_KEYWORDS = new Set([
  'const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'do', 'switch',
  'case', 'break', 'continue', 'new', 'class', 'extends', 'implements', 'interface', 'type',
  'enum', 'import', 'export', 'from', 'as', 'default', 'async', 'await', 'try', 'catch',
  'finally', 'throw', 'typeof', 'instanceof', 'in', 'of', 'void', 'delete', 'yield', 'static',
  'public', 'private', 'protected', 'readonly', 'super', 'this', 'declare', 'satisfies',
  'keyof', 'abstract', 'get', 'set', 'require',
]);

const TS_CONSTANTS = new Set(['true', 'false', 'null', 'undefined', 'NaN', 'Infinity']);

function highlightTemplateInner(inner: string): string {
  const parts: string[] = ['<span class="tk-s">`</span>'];
  const re = /\$\{([^{}]*)\}/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(inner)) !== null) {
    if (m.index > last) parts.push(span('tk-s', inner.slice(last, m.index)));
    parts.push('<span class="tk-s">${</span>');
    parts.push(tokenizeTs(m[1]));
    parts.push('<span class="tk-s">}</span>');
    last = m.index + m[0].length;
  }
  if (last < inner.length) parts.push(span('tk-s', inner.slice(last)));
  parts.push('<span class="tk-s">`</span>');
  return parts.join('');
}

function tokenizeTs(code: string): string {
  const out: string[] = [];
  let i = 0;
  let lastSig = '';
  const n = code.length;
  while (i < n) {
    const ch = code[i];
    if (/\s/.test(ch)) {
      out.push(escapeHtml(ch));
      i += 1;
      continue;
    }
    if (ch === '/' && code[i + 1] === '/') {
      let j = code.indexOf('\n', i);
      if (j === -1) j = n;
      out.push(span('tk-c', code.slice(i, j)));
      i = j;
      continue;
    }
    if (ch === '/' && code[i + 1] === '*') {
      const end = code.indexOf('*/', i + 2);
      const j = end === -1 ? n : end + 2;
      out.push(span('tk-c', code.slice(i, j)));
      i = j;
      continue;
    }
    if (ch === '"' || ch === "'") {
      let j = i + 1;
      while (j < n && code[j] !== ch) {
        if (code[j] === '\\') j += 1;
        if (code[j] === '\n') break;
        j += 1;
      }
      out.push(span('tk-s', code.slice(i, Math.min(j + 1, n))));
      i = j + 1;
      lastSig = 'x';
      continue;
    }
    if (ch === '`') {
      let j = i + 1;
      let inner = '';
      while (j < n) {
        if (code[j] === '\\') {
          inner += code.slice(j, j + 2);
          j += 2;
          continue;
        }
        if (code[j] === '`') break;
        inner += code[j];
        j += 1;
      }
      out.push(highlightTemplateInner(inner));
      i = j + 1;
      lastSig = 'x';
      continue;
    }
    if (/\d/.test(ch)) {
      let j = i + 1;
      while (j < n && /[0-9a-fA-F._eExXbBoO]/.test(code[j])) j += 1;
      out.push(span('tk-n', code.slice(i, j)));
      i = j;
      lastSig = 'x';
      continue;
    }
    if (/[A-Za-z_$]/.test(ch)) {
      let j = i + 1;
      while (j < n && /[\w$]/.test(code[j])) j += 1;
      const word = code.slice(i, j);
      let k = j;
      while (k < n && code[k] === ' ') k += 1;
      const isCall = code[k] === '(';
      if (TS_KEYWORDS.has(word)) out.push(span('tk-k', word));
      else if (TS_CONSTANTS.has(word)) out.push(span('tk-v', word));
      else if (isCall) out.push(span('tk-f', word));
      else if (lastSig === '.') out.push(span('tk-p', word));
      else if (/^[A-Z]/.test(word)) out.push(span('tk-t', word));
      else out.push(escapeHtml(word));
      i = j;
      lastSig = 'x';
      continue;
    }
    if (ch === '.') {
      out.push(escapeHtml(ch));
      i += 1;
      lastSig = '.';
      continue;
    }
    out.push(escapeHtml(ch));
    i += 1;
    lastSig = 'x';
  }
  return out.join('');
}

const BASH_CMDS = new Set([
  'node', 'npm', 'pnpm', 'npx', 'nvm', 'fnm', 'curl', 'cd', 'mkdir', 'touch', 'echo', 'git',
  'rm', 'cp', 'mv', 'ls', 'tsc', 'tsx', 'export', 'sudo', 'which', 'kill', 'bun', 'deno',
  'code', 'sh', 'source', 'nodemon', 'node-inspect', 'wget', 'tar', 'unzip',
]);

function tokenizeBash(code: string): string {
  const lines = code.split('\n');
  const out: string[] = [];
  for (const line of lines) {
    const trimmed = line.trimStart();
    if (trimmed.startsWith('#')) {
      out.push(span('tk-c', line));
      out.push('\n');
      continue;
    }
    const re = /("(?:\\.|[^"\\])*"|'[^']*')|(\$\{[^}]*\}|\$\w+)|(\s--?[\w-]+)|([A-Za-z_][\w.-]*)|([^\sA-Za-z_]+|\s+)/g;
    let m: RegExpExecArray | null;
    let prev = '';
    while ((m = re.exec(line)) !== null) {
      if (m[1] !== undefined) out.push(span('tk-s', m[1]));
      else if (m[2] !== undefined) out.push(span('tk-t', m[2]));
      else if (m[3] !== undefined) out.push(span('tk-p', m[3]));
      else if (m[4] !== undefined) {
        const word = m[4];
        const isCmdStart = prev === '' || prev.endsWith('&&') || prev.endsWith('||') || prev.endsWith('|') || prev.endsWith(';');
        if ((isCmdStart || prev === '') && BASH_CMDS.has(word)) out.push(span('tk-f', word));
        else out.push(escapeHtml(word));
        prev += word;
        continue;
      } else if (m[5] !== undefined) out.push(escapeHtml(m[5]));
      prev += m[0];
    }
    out.push('\n');
  }
  return out.join('').replace(/\n$/, '');
}

function tokenizeJson(code: string): string {
  const re = /("(?:\\.|[^"\\])*")(\s*:)|("(?:\\.|[^"\\])*")|(-?\d+(?:\.\d+)?)|\b(true|false|null)\b/g;
  const out: string[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(code)) !== null) {
    if (m.index > last) out.push(escapeHtml(code.slice(last, m.index)));
    if (m[1] !== undefined) {
      out.push(span('tk-p', m[1]));
      out.push(escapeHtml(m[2] ?? ''));
    } else if (m[3] !== undefined) out.push(span('tk-s', m[3]));
    else if (m[4] !== undefined) out.push(span('tk-n', m[4]));
    else if (m[5] !== undefined) out.push(span('tk-v', m[5]));
    last = m.index + m[0].length;
  }
  if (last < code.length) out.push(escapeHtml(code.slice(last)));
  return out.join('');
}

export function highlightCode(code: string, lang: CodeLang = 'ts'): string {
  if (lang === 'bash') return tokenizeBash(code);
  if (lang === 'json') return tokenizeJson(code);
  return tokenizeTs(code);
}
