// Fixup script v2 for converted api-lab .ts files.
import { readFileSync, writeFileSync } from 'fs';

const FILES = [
  'ScrollEventsPage','IntersectionObserverV2Page','SchedulerTasksPage',
  'AsyncContextPage','AsyncCookbookPage','ConcurrencyPage','SharedMemoryAtomicsPage',
  'WebLocksAPIPage','BarcodeScreenCapturePage','CaptureAdvancedPage','CanvasRecordingPage',
  'WindowPiPViewportPage','WindowManagerPage','ViewTransitionsL2Page','CSSViewTransitionsDeepPage',
  'WebGPUViewTransitionsPage','CSSScrollDrivenAnimationsDeepPage','CSSMotionPathDeepPage',
  'CSSHoudiniWorkletsDeepPage','CSSHoudiniPage','CSSAdvancedFeaturesPage','CSSAdvancedPropertiesPage',
  'CSSAnchorPositioningDeepPage','CSSBackgroundsBordersShadowsDeepPage','CSSBoxModelPositioningPage',
  'CSSCascadeInheritanceDeepPage','CSSCascadeLayersPage','CSSClipPathDeepPage','CSSColorHDRDeepPage',
];

const DIR = '/workspace/ts/pages/api-lab';

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

function inferCapType(value) {
  const v = value.trim();
  if (v === 'true' || v === 'false') return 'boolean';
  if (/^-?\d+(\.\d+)?$/.test(v)) return 'number';
  if ((v.startsWith("'") && v.endsWith("'")) || (v.startsWith('"') && v.endsWith('"'))) return 'string';
  if (v === 'null') return 'null';
  return 'boolean';
}

// Parse top-level key/value pairs of the object literal whose `{` is at objOpenIdx.
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
    }
  }
  const pairs = [];
  for (const seg of segments) {
    const t = seg.trim();
    if (!t) continue;
    const m = t.match(/^([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:\s*([\s\S]+)$/);
    if (m) {
      let val = m[2].trim();
      if (val.endsWith(',')) val = val.slice(0, -1).trim();
      pairs.push({ key: m[1], type: inferCapType(val) });
      continue;
    }
    const qm = t.match(/^'([^']+)'\s*:\s*([\s\S]+)$/) || t.match(/^"([^"]+)"\s*:\s*([\s\S]+)$/);
    if (qm) { let val = qm[2].trim(); if (val.endsWith(',')) val = val.slice(0,-1).trim(); pairs.push({ key: qm[1], type: inferCapType(val) }); continue; }
    if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(t)) pairs.push({ key: t, type: 'boolean' });
  }
  return pairs;
}

// Find the caps object in the detection function body. Handles both
// `return { ... }` and `const <var> = { ... } ... return <var>`.
function extractCapsPairs(src, fnBodyOpenIdx) {
  // 1) look for `return {` at depth 1
  let depth = 0;
  for (let i = fnBodyOpenIdx; i < src.length; i++) {
    const ch = src[i];
    if (ch === '{' || ch === '[' || ch === '(') depth++;
    else if (ch === '}' || ch === ']' || ch === ')') { depth--; if (depth === 0) break; }
    else if (ch === "'" || ch === '"' || ch === '`') {
      const q = ch; i++;
      while (i < src.length && src[i] !== q) { if (src[i] === '\\') i++; i++; }
    } else if (depth === 1 && ch === 'r' && src.slice(i, i+7) === 'return' && /\s/.test(src[i+7] || '')) {
      let j = i + 7;
      while (j < src.length && /\s/.test(src[j])) j++;
      if (src[j] === '{') return extractPairsFromObject(src, j);
    }
  }
  // 2) fallback: `const <var> = { ... }` at depth 1
  depth = 0;
  for (let i = fnBodyOpenIdx; i < src.length; i++) {
    const ch = src[i];
    if (ch === '{' || ch === '[' || ch === '(') depth++;
    else if (ch === '}' || ch === ']' || ch === ')') { depth--; if (depth === 0) break; }
    else if (ch === "'" || ch === '"' || ch === '`') {
      const q = ch; i++;
      while (i < src.length && src[i] !== q) { if (src[i] === '\\') i++; i++; }
    } else if (depth === 1 && ch === 'c' && src.slice(i, i+5) === 'const' && /\s/.test(src[i+5] || '')) {
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

function fix(name) {
  const path = `${DIR}/${name}.ts`;
  let src = readFileSync(path, 'utf8');
  const orig = src;
  const capsType = `${name}Caps`;

  // A) Regenerate caps interface from the detection function's return.
  const fnRe = new RegExp(`_(flags|caps)\\(\\):\\s*${capsType}\\s*\\{`);
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
    }
  }

  // B) Fix instance field declarations.
  //    B1: repair corruption from prior run: `  _x:!: type;` -> `  _x!: type;`
  src = src.replace(/^(  _\w+):!:\s*/gm, '$1!: ');
  //    B2: original-form uninitialized fields `  _x: type;` (no `=`, no `!`) -> `  _x!: type;`
  //        (already-`!:` lines won't match because `:` is required right after `_\w+`)
  src = src.replace(/^(  _\w+)(:\s*)([^=;\n]+?)(;\s*)$/gm, (m, name, colon, type, end) => {
    if (name.endsWith('!')) return m; // safety
    return `${name}!:${colon}${type}${end}`;
  });

  // C) `catch (x)` -> `catch (x: any)` for untyped bindings.
  src = src.replace(/\bcatch\s*\(\s*(\w+)\s*\)/g, (m, v) => `catch (${v}: any)`);

  // D) Type common untyped params.
  src = src.replace(/\b_caps\((items)\)\s*\{/g, '_caps($1: [string, boolean][]): Node[] {');
  src = src.replace(/\b_injectStyle\((id),\s*(css)\)\s*\{/g, '_injectStyle($1: string, $2: string): void {');
  src = src.replace(/const\s+c\s*=\s*\(ok\)\s*=>/g, 'const c = (ok: boolean) =>');
  src = src.replace(/const\s+ck\s*=\s*\(ok\)\s*=>/g, 'const ck = (ok: boolean) =>');
  src = src.replace(/const\s+supportsPV\s*=\s*\(p,\s*v\)\s*=>/g, 'const supportsPV = (p: string, v: string) =>');
  src = src.replace(/const\s+supportsSel\s*=\s*\(sel\)\s*=>/g, 'const supportsSel = (sel: string) =>');

  // E) Widen _renderCard*/_renderLogPanel return type and `return null;` -> `return '';`.
  src = src.replace(/(_renderCard\w*)\(\):\s*Node\s*\{/g, '$1(): Node | string {');
  src = src.replace(/(_renderLogPanel)\(\):\s*Node\s*\{/g, '$1(): Node | string {');
  for (const base of ['_renderCard', '_renderLogPanel']) {
    const re = new RegExp(`(${base}\\w*)\\(\\):\\s*Node\\s*\\|\\s*string\\s*\\{`, 'g');
    let m;
    while ((m = re.exec(src)) !== null) {
      const openIdx = m.index + m[0].lastIndexOf('{');
      const closeIdx = matchBrace(src, openIdx);
      if (closeIdx === -1) continue;
      const body = src.slice(openIdx, closeIdx + 1);
      const newBody = body.replace(/return null;\s*/g, "return '';");
      if (newBody !== body) {
        src = src.slice(0, openIdx) + newBody + src.slice(closeIdx + 1);
        re.lastIndex = m.index;
      }
    }
  }

  if (src !== orig) {
    writeFileSync(path, src);
    console.log(`FIXED: ${name}${capsPairs ? ` (caps:${capsPairs.length})` : ''}`);
  } else {
    console.log(`NOCHANGE: ${name}`);
  }
}

for (const f of FILES) {
  try { fix(f); } catch(e) { console.log(`ERROR: ${f}: ${e.message}`); }
}
