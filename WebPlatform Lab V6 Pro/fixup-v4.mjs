// Safe fixup v4 for converted api-lab .ts files.
// Processes line-by-line to avoid cross-line regex matching bugs.
// Only applies conservative, targeted transformations.
import { readFileSync, writeFileSync, readdirSync } from 'fs';

const DIR = '/workspace/ts/pages/api-lab';
const files = readdirSync(DIR).filter(f => f.endsWith('.ts'));

// Type untyped params in a param list string. Conservative: only handles plain identifiers.
function typeParams(params) {
  if (!params.trim()) return params;
  // Skip if contains backticks, newlines, or complex expressions
  if (params.includes('`') || params.includes('\n')) return params;
  // Skip destructuring or rest
  if (params.includes('{') || params.includes('[') || params.includes('...')) return params;
  const parts = params.split(',').map(p => {
    const t = p.trim();
    if (!t) return t;
    // Already typed
    if (/^[a-zA-Z_$][\w$]*\s*[:?]/.test(t)) return p;
    // Default value without type: identifier = value
    const dm = t.match(/^([a-zA-Z_$][\w$]*)(\s*=\s*.+)$/);
    if (dm) return `${dm[1]}: any${dm[2]}`;
    // Plain identifier only
    if (/^[a-zA-Z_$][\w$]*$/.test(t)) return `${t}: any`;
    // Anything else (strings, numbers, expressions) - leave alone
    return p;
  });
  return parts.join(',');
}

function fix(name) {
  const path = `${DIR}/${name}`;
  let src = readFileSync(path, 'utf8');
  const orig = src;
  const clsName = name.replace(/\.ts$/, '');
  const capsType = `${clsName}Caps`;

  // === 0) Repair prior-run corruption: `  _x:!: type;` -> `  _x!: type;` ===
  src = src.replace(/^(  _\w+):!:\s*/gm, '$1!: ');

  // === 1) Fix polymorphic `_caps(items)` methods ===
  // Pattern: `_caps(items): Node[] {` or `_caps(items: [string, boolean][]): Node[] {`
  // Replace with overload + implementation:
  //   _caps(): XxxCaps;
  //   _caps(items: [string, boolean][]): Node[];
  //   _caps(items?: [string, boolean][]): any {
  const capsPolyRe = /_caps\(items(?:\s*:\s*\[string,\s*boolean\]\[\])?\):\s*Node\[\]\s*\{/;
  if (capsPolyRe.test(src)) {
    // Check if XxxCaps interface exists; if not, we still add the overload (any return)
    const hasIface = new RegExp(`interface\\s+${capsType}\\b`).test(src);
    const ifaceLine = hasIface ? `: ${capsType}` : ': any';
    // Replace the signature line with overloads + impl signature
    src = src.replace(
      capsPolyRe,
      `_caps()${ifaceLine};\n  _caps(items: [string, boolean][]): Node[];\n  _caps(items?: [string, boolean][]): any {`
    );
  }

  // === 2) Line-by-line safe transformations ===
  const lines = src.split('\n');
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // 2a) Cast `this.$('selector')` to `any` (single-line, simple selector)
    // Pattern: this.$('xxx') -> (this.$('xxx') as any)
    // Skip if already has `as any` or `as HTMLXxx`
    line = line.replace(/\bthis\.\$\(('[^']*'|"[^"]*")\)(?!\s*as\b)/g, "(this.$($1) as any)");
    // 2b) Cast `this.$$('selector')` to `any[]`
    line = line.replace(/\bthis\.\$\$\(('[^']*'|"[^"]*")\)(?!\s*as\b)/g, "(this.$$($1) as any[])");

    // 2c) Cast `document.getElementById('xxx')` to `any`
    line = line.replace(/\bdocument\.getElementById\(('[^']*'|"[^"]*")\)(?!\s*as\b)/g, "(document.getElementById($1) as any)");

    // 2d) Cast `document.createElement('canvas'|'video'|'audio'|'input')` to `any`
    line = line.replace(
      /\bdocument\.createElement\(('canvas'|'video'|'audio'|'input'|"canvas"|"video"|"audio"|"input")\)(?!\s*as\b)/g,
      '(document.createElement($1) as any)'
    );

    // 2e) Type class method params (only for `  _xxx(params) {` or `  async _xxx(params) {` or `  _xxx(params): Ret {`)
    //     Only matches at 2-space indent, only `_`-prefixed method names.
    //     Skips lines with backticks (template literals) to avoid false matches.
    //     IMPORTANT: reconstruct the line from captured groups (NOT String.replace)
    //     because String.replace would replace the first occurrence of the param
    //     substring anywhere in the line (e.g. inside the method name).
    if (!line.includes('`')) {
      // Method with return type: `  _xxx(params): Ret {`
      let m = line.match(/^(  (?:async\s+)?)(_\w+)\(([^()]*)\):\s*([^{;]+)\s*\{\s*$/);
      if (m) {
        const newParams = typeParams(m[3]);
        if (newParams !== m[3]) {
          line = `${m[1]}${m[2]}(${newParams}): ${m[4]} {`;
        }
      } else {
        // Method without return type: `  _xxx(params) {`
        m = line.match(/^(  (?:async\s+)?)(_\w+)\(([^()]*)\)\s*\{\s*$/);
        if (m) {
          const newParams = typeParams(m[3]);
          if (newParams !== m[3]) {
            line = `${m[1]}${m[2]}(${newParams}) {`;
          }
        }
      }
    }

    // 2f) Type arrow function params in `const name = (params) =>` (single-line only)
    if (!line.includes('`')) {
      const am = line.match(/^(\s*const\s+(\w+)\s*=\s*(?:async\s*)?)\(([^()]*)\)\s*=>\s*(.*)$/);
      if (am) {
        const newParams = typeParams(am[3]);
        if (newParams !== am[3]) {
          line = `${am[1]}(${newParams}) => ${am[4]}`;
        }
      }
    }

    // 2g) Type `catch (x)` -> `catch (x: any)` (single-line)
    line = line.replace(/\bcatch\s*\(\s*(\w+)\s*\)/g, 'catch ($1: any)');

    // 2h) Type `addEventListener('event', (e) =>` -> `addEventListener('event', (e: any) =>`
    line = line.replace(
      /\baddEventListener\(\s*('[^']*'|"[^"]*")\s*,\s*\(([a-zA-Z_$][\w$]*)\)\s*=>/g,
      "addEventListener($1, ($2: any) =>"
    );

    lines[i] = line;
  }
  src = lines.join('\n');

  // === 3) Add `!` definite assignment to uninitialized class fields ===
  // Pattern: `  _foo: any;` -> `  _foo!: any;` (only for fields starting with `_`, no `=` or `!`)
  // Skip optional types (ending with `?`) and types that are already `!`
  src = src.replace(/^(\s+_\w+)\s*:\s*([^{=;\n]+?)(;\s*)$/gm, (m, name, type, end) => {
    if (name.endsWith('!')) return m;
    if (/\?$/.test(type.trim())) return m;
    return `${name}!: ${type}${end}`;
  });

  // === 4) Type common arrow-function helper patterns ===
  // `const c = (ok) =>` -> `const c = (ok: boolean) =>`
  src = src.replace(/\bconst\s+c\s*=\s*\(ok\)\s*=>/g, 'const c = (ok: boolean) =>');
  src = src.replace(/\bconst\s+ck\s*=\s*\(ok\)\s*=>/g, 'const ck = (ok: boolean) =>');
  src = src.replace(/\bconst\s+supportsSel\s*=\s*\(sel\)\s*=>/g, 'const supportsSel = (sel: string) =>');
  src = src.replace(/\bconst\s+supportsPV\s*=\s*\(p,\s*v\)\s*=>/g, 'const supportsPV = (p: string, v: string) =>');
  src = src.replace(/\bconst\s+mark\s*=\s*\(b\)\s*=>/g, 'const mark = (b: boolean) =>');

  // === 5) Widen `_renderCard*` / `_renderLogPanel` return types to `Node | string` ===
  src = src.replace(/(_renderCard\w*)\(\):\s*Node\s*\{/g, '$1(): Node | string {');
  src = src.replace(/(_renderLogPanel)\(\):\s*Node\s*\{/g, '$1(): Node | string {');

  if (src !== orig) {
    writeFileSync(path, src);
    console.log(`FIXED: ${name}`);
  } else {
    console.log(`NOCHANGE: ${name}`);
  }
}

let fixedCount = 0;
for (const f of files) {
  try {
    const before = readFileSync(`${DIR}/${f}`, 'utf8');
    fix(f);
    fixedCount++;
  } catch(e) { console.log(`ERROR: ${f}: ${e.message}`); }
}
console.log(`\nProcessed ${fixedCount} files.`);
