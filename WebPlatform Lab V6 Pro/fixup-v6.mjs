// Comprehensive fixup v6 - improved caps interface regeneration that strips comments,
// handles polymorphic _caps(items) overloads, and adds common type annotations.
import { readFileSync, writeFileSync, readdirSync } from 'fs';

const DIR = '/workspace/ts/pages/api-lab';
const files = readdirSync(DIR).filter(f => f.endsWith('.ts'));

// ============ Brace matching ============
function matchBrace(src, openIdx) {
  let depth = 0;
  for (let i = openIdx; i < src.length; i++) {
    const ch = src[i];
    if (ch === '{') depth++;
    else if (ch === '}') { depth--; if (depth === 0) return i; }
    else if (ch === "'" || ch === '"' || ch === '`') {
      const q = ch; i++;
      while (i < src.length && src[i] !== q) { if (src[i] === '\\') i++; i++; }
    } else if (ch === '/' && src[i+1] === '/') {
      while (i < src.length && src[i] !== '\n') i++;
    } else if (ch === '/' && src[i+1] === '*') {
      i += 2;
      while (i < src.length - 1 && !(src[i] === '*' && src[i+1] === '/')) i++;
      i++;
    }
  }
  return -1;
}

// ============ Type inference ============
function inferType(v) {
  const t = v.trim();
  if (t === 'true' || t === 'false') return 'boolean';
  if (t === 'null') return 'any';
  if (t === 'undefined') return 'any';
  if (/^-?\d+(\.\d+)?$/.test(t)) return 'number';
  if ((t.startsWith("'") && t.endsWith("'")) || (t.startsWith('"') && t.endsWith('"'))) return 'string';
  // function call returning boolean (common in caps)
  if (/^(supports|has|match|typeof|this\._safe)/.test(t)) return 'boolean';
  // default to boolean for caps (most flags are boolean)
  return 'boolean';
}

// Strip // line comments and /* */ block comments from a segment.
function stripComments(s) {
  let out = '';
  let i = 0;
  let inStr = null;
  while (i < s.length) {
    const ch = s[i];
    if (inStr) {
      out += ch;
      if (ch === '\\' && i + 1 < s.length) { out += s[i+1]; i += 2; continue; }
      if (ch === inStr) inStr = null;
      i++;
    } else if (ch === "'" || ch === '"' || ch === '`') {
      inStr = ch; out += ch; i++;
    } else if (ch === '/' && s[i+1] === '/') {
      while (i < s.length && s[i] !== '\n') i++;
    } else if (ch === '/' && s[i+1] === '*') {
      i += 2;
      while (i < s.length - 1 && !(s[i] === '*' && s[i+1] === '/')) i++;
      i += 2;
    } else {
      out += ch; i++;
    }
  }
  return out;
}

function extractPairsFromObject(src, objOpenIdx) {
  let depth = 0;
  let segStart = objOpenIdx + 1;
  const segments = [];
  for (let i = objOpenIdx; i < src.length; i++) {
    const ch = src[i];
    if (ch === '{' || ch === '[' || ch === '(') depth++;
    else if (ch === '}' || ch === ']' || ch === ')') {
      depth--;
      if (depth === 0 && ch === '}') { segments.push(src.slice(segStart, i)); break; }
    } else if (ch === ',' && depth === 1) { segments.push(src.slice(segStart, i)); segStart = i + 1; }
    else if (ch === "'" || ch === '"' || ch === '`') {
      const q = ch; i++;
      while (i < src.length && src[i] !== q) { if (src[i] === '\\') i++; i++; }
    } else if (ch === '/' && src[i+1] === '/') {
      while (i < src.length && src[i] !== '\n') i++;
    } else if (ch === '/' && src[i+1] === '*') {
      i += 2;
      while (i < src.length - 1 && !(src[i] === '*' && s[i+1] === '/')) i++;
      i++;
    }
  }
  const pairs = [];
  for (const seg of segments) {
    // Strip comments first, then trim
    const t = stripComments(seg).trim();
    if (!t) continue;
    // Strip trailing comma
    const tc = t.endsWith(',') ? t.slice(0, -1).trim() : t;
    // key: value
    const m = tc.match(/^([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:\s*([\s\S]+)$/);
    if (m) {
      // Skip if value contains a function body (multiline) - just type as boolean
      const val = m[2].trim();
      // If value is a multiline expression (contains newline), still parse the key
      pairs.push({ key: m[1], type: inferType(val) });
      continue;
    }
    // shorthand: just key
    if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(tc)) pairs.push({ key: tc, type: 'boolean' });
  }
  return pairs;
}

// Find the caps/flags object returned by the detection function.
function extractCapsPairs(src, fnBodyOpenIdx) {
  // 1) Look for `return {` at depth 1
  let depth = 0;
  for (let i = fnBodyOpenIdx; i < src.length; i++) {
    const ch = src[i];
    if (ch === '{' || ch === '[' || ch === '(') depth++;
    else if (ch === '}' || ch === ']' || ch === ')') { depth--; if (depth === 0) break; }
    else if (ch === "'" || ch === '"' || ch === '`') {
      const q = ch; i++;
      while (i < src.length && src[i] !== q) { if (src[i] === '\\') i++; i++; }
    } else if (ch === '/' && src[i+1] === '/') {
      while (i < src.length && src[i] !== '\n') i++;
    } else if (depth === 1 && src.slice(i, i+6) === 'return' && /\s/.test(src[i+6] || '')) {
      let j = i + 6;
      while (j < src.length && /\s/.test(src[j])) j++;
      if (src[j] === '{') return extractPairsFromObject(src, j);
    }
  }
  // 2) Fallback: `const <var> = { ... }` at depth 1, then `return <var>;`
  depth = 0;
  for (let i = fnBodyOpenIdx; i < src.length; i++) {
    const ch = src[i];
    if (ch === '{' || ch === '[' || ch === '(') depth++;
    else if (ch === '}' || ch === ']' || ch === ')') { depth--; if (depth === 0) break; }
    else if (ch === "'" || ch === '"' || ch === '`') {
      const q = ch; i++;
      while (i < src.length && src[i] !== q) { if (src[i] === '\\') i++; i++; }
    } else if (depth === 1 && src.slice(i, i+5) === 'const' && /\s/.test(src[i+5] || '')) {
      let j = i + 5;
      while (j < src.length && /\s/.test(src[j])) j++;
      const vm = src.slice(j).match(/^([a-zA-Z_$][\w$]*)\s*=\s*\{/);
      if (vm) {
        const objOpen = j + vm[0].length - 1;
        const pairs = extractPairsFromObject(src, objOpen);
        if (pairs.length > 0) return pairs;
      }
    }
  }
  return null;
}

// ============ Safe param typing ============
function typeParams(params) {
  if (!params.trim()) return params;
  if (params.includes('`') || params.includes('\n')) return params;
  if (params.includes('{') || params.includes('[') || params.includes('...')) return params;
  const parts = params.split(',').map(p => {
    const t = p.trim();
    if (!t) return t;
    if (/^[a-zA-Z_$][\w$]*\s*[:?]/.test(t)) return p;
    const dm = t.match(/^([a-zA-Z_$][\w$]*)(\s*=\s*.+)$/);
    if (dm) return `${dm[1]}: any${dm[2]}`;
    if (/^[a-zA-Z_$][\w$]*$/.test(t)) return `${t}: any`;
    return p;
  });
  return parts.join(',');
}

// ============ Main fix function ============
function fix(name) {
  const path = `${DIR}/${name}`;
  let src = readFileSync(path, 'utf8');
  const orig = src;
  const clsName = name.replace(/\.ts$/, '');
  const capsType = `${clsName}Caps`;

  // === 0) Repair corruption: `  _x:!: type;` -> `  _x!: type;` ===
  src = src.replace(/^(  _\w+):!:\s*/gm, '$1!: ');

  // === 1) Fix polymorphic `_caps(items): Node[]` with overloads ===
  // Pattern: `  _caps(items?: [string, boolean][]): any {` or `  _caps(items): Node[] {`
  // We need: overload signature `_caps(): XxxCaps;` + impl `_caps(items?: ...): any {`
  // But only if there's also a `_flags()` or `_caps()` returning the caps object.
  const polyRe = new RegExp(
    `^(  )_caps\\(items(?:\\s*:\\s*\\[string,\\s*boolean\\]\\[\\])?\\s*\\):\\s*(any|Node\\[\\])\\s*\\{`,
    'm'
  );
  const polyMatch = polyRe.exec(src);
  if (polyMatch) {
    // Check if a _flags() or _caps() returning the caps object exists
    const flagsRe = new RegExp(`_(?:flags|caps)\\(\\):\\s*${capsType}\\b`);
    const hasFlagsReturn = flagsRe.test(src);
    const ifaceExists = new RegExp(`interface\\s+${capsType}\\b`).test(src);
    if (hasFlagsReturn && ifaceExists) {
      // Replace the polymorphic _caps(items) signature with proper overloads
      const replacement = `${polyMatch[1]}_caps(): ${capsType};\n${polyMatch[1]}_caps(items: [string, boolean][]): Node[];\n${polyMatch[1]}_caps(items?: [string, boolean][]): any {`;
      src = src.slice(0, polyMatch.index) + replacement + src.slice(polyMatch.index + polyMatch[0].length);
    }
  }

  // === 2) Regenerate caps interface from _caps()/_flags() return value ===
  const fnRe = new RegExp(`_(?:caps|flags)\\(\\):\\s*${capsType}\\s*\\{`);
  const fnMatch = fnRe.exec(src);
  let capsPairs = null;
  if (fnMatch) {
    const openIdx = fnMatch.index + fnMatch[0].lastIndexOf('{');
    const bodyClose = matchBrace(src, openIdx);
    if (bodyClose !== -1) capsPairs = extractCapsPairs(src, openIdx);
  }
  if (capsPairs && capsPairs.length > 0) {
    const ifaceRe = new RegExp(`(interface\\s+${capsType}\\s*\\{)\\s*([\\s\\S]*?)\\n\\}`);
    const im = ifaceRe.exec(src);
    if (im) {
      const newBody = capsPairs.map(p => `  ${p.key}: ${p.type};`).join('\n');
      src = src.slice(0, im.index) + `${im[1]}\n${newBody}\n}` + src.slice(im.index + im[0].length);
    } else {
      // Interface doesn't exist - inject it after LogEntry or after imports
      const ifaceBody = capsPairs.map(p => `  ${p.key}: ${p.type};`).join('\n');
      const iface = `interface ${capsType} {\n${ifaceBody}\n}\n\n`;
      const injectAnchor = src.indexOf('interface LogEntry');
      if (injectAnchor !== -1) {
        src = src.slice(0, injectAnchor) + iface + src.slice(injectAnchor);
      } else {
        const classIdx = src.indexOf(`export class ${clsName}`);
        if (classIdx !== -1) {
          src = src.slice(0, classIdx) + iface + src.slice(classIdx);
        }
      }
    }
  }

  // === 3) Cast `this.$(...)` and `this.$$(...)` to `any` ===
  src = src.replace(/\bthis\.\$\(([^)]*)\)(?!\s*as\b)/g, "(this.$($1) as any)");
  src = src.replace(/\bthis\.\$\$\(([^)]*)\)(?!\s*as\b)/g, "(this.$$($1) as any[])");

  // === 4) Cast `document.getElementById(...)` to `any` ===
  src = src.replace(/\bdocument\.getElementById\(([^)]*)\)(?!\s*as\b)/g, "(document.getElementById($1) as any)");

  // === 5) Cast `document.createElement('canvas'|'video'|'audio'|'input')` to `any` ===
  src = src.replace(
    /\bdocument\.createElement\(('canvas'|'video'|'audio'|'input'|"canvas"|"video"|"audio"|"input")\)(?!\s*as\b)/g,
    '(document.createElement($1) as any)'
  );

  // === 6) Line-by-line: type method params, catch bindings, addEventListener ===
  const lines = src.split('\n');
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // 6a) Type class method params (2-space indent, `_`-prefixed methods only)
    if (!line.includes('`')) {
      let m = line.match(/^(  (?:async\s+)?)(_\w+)\(([^()]*)\):\s*([^{;]+)\s*\{\s*$/);
      if (m) {
        const newParams = typeParams(m[3]);
        if (newParams !== m[3]) {
          line = `${m[1]}${m[2]}(${newParams}): ${m[4]} {`;
        }
      } else {
        m = line.match(/^(  (?:async\s+)?)(_\w+)\(([^()]*)\)\s*\{\s*$/);
        if (m) {
          const newParams = typeParams(m[3]);
          if (newParams !== m[3]) {
            line = `${m[1]}${m[2]}(${newParams}) {`;
          }
        }
      }
    }

    // 6b) Type arrow function params in `const name = (params) =>`
    if (!line.includes('`')) {
      const am = line.match(/^(\s*const\s+(\w+)\s*=\s*(?:async\s*)?)\(([^()]*)\)\s*=>\s*(.*)$/);
      if (am) {
        const newParams = typeParams(am[3]);
        if (newParams !== am[3]) {
          line = `${am[1]}(${newParams}) => ${am[4]}`;
        }
      }
    }

    // 6c) `catch (x)` -> `catch (x: any)`
    line = line.replace(/\bcatch\s*\(\s*(\w+)\s*\)/g, 'catch ($1: any)');

    // 6d) `addEventListener('event', (e) =>` -> `addEventListener('event', (e: any) =>`
    line = line.replace(
      /\baddEventListener\(\s*('[^']*'|"[^"]*")\s*,\s*\(([a-zA-Z_$][\w$]*)\)\s*=>/g,
      "addEventListener($1, ($2: any) =>"
    );

    lines[i] = line;
  }
  src = lines.join('\n');

  // === 7) Add `!` definite assignment to uninitialized class fields ===
  src = src.replace(/^(\s+_\w+)\s*:\s*([^{=;\n]+?)(;\s*)$/gm, (m, name, type, end) => {
    if (name.endsWith('!')) return m;
    if (/\?$/.test(type.trim())) return m;
    return `${name}!: ${type}${end}`;
  });

  // === 8) Type common arrow-function helper patterns ===
  src = src.replace(/\bconst\s+c\s*=\s*\(ok\)\s*=>/g, 'const c = (ok: boolean) =>');
  src = src.replace(/\bconst\s+ck\s*=\s*\(ok\)\s*=>/g, 'const ck = (ok: boolean) =>');
  src = src.replace(/\bconst\s+supportsSel\s*=\s*\(sel\)\s*=>/g, 'const supportsSel = (sel: string) =>');
  src = src.replace(/\bconst\s+supportsPV\s*=\s*\(p,\s*v\)\s*=>/g, 'const supportsPV = (p: string, v: string) =>');
  src = src.replace(/\bconst\s+mark\s*=\s*\(b\)\s*=>/g, 'const mark = (b: boolean) =>');
  // `const c = (ok: any) =>` -> `const c = (ok: boolean) =>`
  src = src.replace(/\bconst\s+c\s*=\s*\(ok:\s*any\)\s*=>/g, 'const c = (ok: boolean) =>');

  // === 9) Widen `_renderCard*` / `_renderLogPanel` return types ===
  src = src.replace(/(_renderCard\w*)\(\):\s*Node\s*\{/g, '$1(): Node | string {');
  src = src.replace(/(_renderLogPanel)\(\):\s*Node\s*\{/g, '$1(): Node | string {');

  if (src !== orig) {
    writeFileSync(path, src);
    return true;
  }
  return false;
}

let fixedCount = 0;
for (const f of files) {
  try {
    if (fix(f)) { fixedCount++; console.log(`FIXED: ${f}`); }
  } catch(e) { console.log(`ERROR: ${f}: ${e.message}`); }
}
console.log(`\nFixed ${fixedCount} of ${files.length} files.`);
