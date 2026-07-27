// Bulk JS→TS converter for api-lab pages
// Reads each JS source file, applies type annotations per the established pattern,
// and writes the corresponding .ts file.
import { readFileSync, writeFileSync, existsSync } from 'fs';

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

const SRC_DIR = '/workspace/src/pages/api-lab';
const DST_DIR = '/workspace/ts/pages/api-lab';

function convert(name) {
  const srcPath = `${SRC_DIR}/${name}.js`;
  if (!existsSync(srcPath)) { console.log(`SKIP (not found): ${name}`); return; }
  let src = readFileSync(srcPath, 'utf8');
  const className = name;

  // --- Extract state fields from initialState() ---
  const stateMatch = src.match(/initialState\(\)\s*\{[\s\S]*?return\s*\{([\s\S]*?)\};/);
  const stateFields = [];
  if (stateMatch) {
    const body = stateMatch[1];
    const fieldRegex = /(\w+)\s*:/g;
    let m;
    while ((m = fieldRegex.exec(body)) !== null) {
      const field = m[1];
      // Determine type from value
      const valMatch = body.match(new RegExp(`${field}\\s*:\\s*([^,\\n]+)`));
      const val = valMatch ? valMatch[1].trim() : '';
      let type = 'string';
      if (val === '[]') type = 'any[]';
      else if (val === '0' || val === '0.0' || /^\d+$/.test(val)) type = 'number';
      else if (val === 'true' || val === 'false') type = 'boolean';
      else if (val === 'null') type = 'string | null';
      else if (val === '{}') type = 'Record<string, any>';
      stateFields.push({ name: field, type });
    }
  }

  // --- Extract caps fields from _caps() or _flags() return ---
  const capsFnMatch = src.match(/_(caps|flags)\(\)\s*\{[\s\S]*?return\s*\{([\s\S]*?)\};/);
  const capsFields = [];
  let capsFnName = '_caps';
  if (capsFnMatch) {
    capsFnName = '_' + capsFnMatch[1];
    const body = capsFnMatch[2];
    const fieldRegex = /(\w+)\s*[:,]/g;
    let m;
    while ((m = fieldRegex.exec(body)) !== null) {
      if (m[1] !== 'return' && /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(m[1])) capsFields.push(m[1]);
    }
  }

  // --- Extract instance fields from componentDidMount ---
  const didMountMatch = src.match(/componentDidMount\(\)\s*\{([\s\S]*?)\n  \}/);
  const instanceFields = [];
  if (didMountMatch) {
    const body = didMountMatch[1];
    const fieldRegex = /this\.(\w+)\s*=\s*([^;\n]+)/g;
    let m;
    while ((m = fieldRegex.exec(body)) !== null) {
      const field = m[1];
      const val = m[2].trim();
      if (field === '_inited' || field === '_destroyed') continue;
      let type = 'any';
      if (val === 'true' || val === 'false') type = 'boolean';
      else if (val === '[]') type = 'any[]';
      else if (val === 'null') type = 'any';
      else if (val === '0' || /^\d+$/.test(val)) type = 'number';
      else if (val.startsWith("'") || val.startsWith('"')) type = 'string';
      instanceFields.push({ name: field, type });
    }
  }

  // Also extract from class body (this._xxx = ... outside componentDidMount)
  const allThisAssigns = src.matchAll(/this\.(_\w+)\s*=\s*([^;\n]+)/g);
  for (const m of allThisAssigns) {
    const field = m[1];
    const val = m[2].trim();
    if (instanceFields.find(f => f.name === field)) continue;
    if (field === '_inited' || field === '_destroyed') continue;
    let type = 'any';
    if (val === 'true' || val === 'false') type = 'boolean';
    else if (val === '[]') type = 'any[]';
    else if (val === 'null') type = 'any';
    else if (val === '0' || /^\d+$/.test(val)) type = 'number';
    else if (val.startsWith("'") || val.startsWith('"')) type = 'string';
    instanceFields.push({ name: field, type });
  }

  // --- Build interfaces ---
  const capsInterfaceName = `${className}Caps`;
  const stateInterfaceName = `${className}State`;
  const propsInterfaceName = `${className}Props`;

  let interfaces = '';
  interfaces += `interface LogEntry { type: string; content: string; time: string; }\n\n`;
  if (capsFields.length > 0) {
    const uniqueCaps = [...new Set(capsFields)];
    interfaces += `interface ${capsInterfaceName} {\n${uniqueCaps.map(f => `  ${f}: boolean;`).join('\n')}\n}\n\n`;
  }
  interfaces += `export interface ${propsInterfaceName} extends Props {}\n\n`;
  interfaces += `export interface ${stateInterfaceName} extends State {\n`;
  interfaces += `  logs: LogEntry[];\n`;
  for (const f of stateFields) {
    if (f.name === 'logs') continue;
    interfaces += `  ${f.name}: ${f.type};\n`;
  }
  interfaces += `}\n\n`;

  // --- Build instance field declarations ---
  let instanceDecls = '';
  instanceDecls += `  _inited: boolean = false;\n`;
  instanceDecls += `  _destroyed: boolean = false;\n`;
  for (const f of instanceFields) {
    instanceDecls += `  ${f.name}: ${f.type};\n`;
  }

  // --- Transform source ---
  let ts = src;

  // 1. Add type imports after last import line (only match real import statements at line start)
  const importLines = ts.match(/^import\s+\{[^}]+\}\s+from\s+['"][^'"]+['"];?$/gm);
  const lastImportLine = importLines ? importLines[importLines.length - 1] : null;
  if (lastImportLine) {
    const lastImportIdx = ts.lastIndexOf(lastImportLine);
    const lastImportEnd = ts.indexOf('\n', lastImportIdx);
    const typeImports = `\nimport type { Props, State } from '../../core/types.js';\nimport type { ButtonProps } from '../../components/ui/Button.js';`;
    ts = ts.slice(0, lastImportEnd) + typeImports + ts.slice(lastImportEnd);
  }

  // 2. Add interfaces before class declaration
  const classIdx = ts.indexOf(`export class ${className} extends Page {`);
  if (classIdx === -1) { console.log(`ERROR: class not found in ${name}`); return; }
  ts = ts.slice(0, classIdx) + interfaces + ts.slice(classIdx);

  // 3. Add declare props/state + instance fields after class opening brace
  const classOpenEnd = ts.indexOf(`export class ${className} extends Page {`) + `export class ${className} extends Page {`.length;
  const decls = `\n  declare props: ${propsInterfaceName};\n  declare state: ${stateInterfaceName};\n\n${instanceDecls}\n`;
  ts = ts.slice(0, classOpenEnd) + decls + ts.slice(classOpenEnd);

  // 4. Type initialState return
  ts = ts.replace(/initialState\(\)\s*\{/, `initialState(): ${stateInterfaceName} {`);

  // 5. Type componentDidMount / componentWillUnmount
  ts = ts.replace(/componentDidMount\(\)\s*\{/, 'componentDidMount(): void {');
  ts = ts.replace(/componentWillUnmount\(\)\s*\{/, 'componentWillUnmount(): void {');

  // 6. Type _addLog
  ts = ts.replace(/_addLog\((type),\s*(content)\)\s*\{/g, '_addLog($1: string, $2: string): void {');

  // 7. Type _btn
  ts = ts.replace(/_btn\((label),\s*(opts)\)\s*\{/g, '_btn($1: string, $2: ButtonProps): Node | string {');

  // 8. Type _caps / _flags return
  if (capsFnName === '_flags') {
    ts = ts.replace(/_flags\(\)\s*\{/, `_${capsFnName === '_flags' ? 'flags' : 'caps'}(): ${capsInterfaceName} {`);
  } else {
    ts = ts.replace(/_caps\(\)\s*\{/, `_caps(): ${capsInterfaceName} {`);
  }

  // 9. Type _renderCardX methods: add `: Node` return type
  ts = ts.replace(/(_renderCard\w*)\(\)\s*\{/g, '$1(): Node {');
  ts = ts.replace(/(_renderLogPanel)\(\)\s*\{/g, '$1(): Node {');

  // 10. Fix catch (err) → catch (err: any)
  ts = ts.replace(/catch\s*\(\s*(err|e)\s*\)/g, 'catch ($1: any)');

  // 11. Fix renderPage return: add `: Node | string | (Node | string)[]` and cast array
  ts = ts.replace(/renderPage\(\)\s*\{/, 'renderPage(): Node | string | (Node | string)[] {');
  // Add `as (Node | string)[]` before the closing `];` of renderPage return
  // Find renderPage and add cast to its return array
  ts = ts.replace(/(renderPage\(\): Node \| string \| \(Node \| string\)\[\]\s*\{[\s\S]*?return\s*\[)([\s\S]*?)(\];)/, '$1$2\n    ] as (Node | string)[];');

  // 12. Fix `return card.render();` → `return card.render() as Node;`
  ts = ts.replace(/return card\.render\(\);/g, 'return card.render() as Node;');

  // 13. Fix `return btn.render();` → `return btn.render() as Node;` (for _btn)
  // Already handled by _btn return type, but add cast for safety
  ts = ts.replace(/return btn\.render\(\);/g, 'return btn.render() as Node;');

  // 14. Fix `this.$('#id')` calls that need null checks - they already return T | null
  // No change needed - the $ method already handles this

  // 15. Fix `err.name` / `err.message` in catch blocks - err is now `any` so this works
  // No change needed

  // 16. Type render() override (for files that override render directly)
  ts = ts.replace(/^(\s*)render\(\)\s*\{/m, '$1render(): Node {');

  // 17. Fix `_makeFakeEntry` method definition - add type to destructured param
  ts = ts.replace(/_makeFakeEntry\(\{([^}]+)\}\)\s*\{/g, '_makeFakeEntry({ $1 }: { isIntersecting: boolean; isVisible: boolean; ratio: number }) {');

  // 18. Fix event handler params in h() calls that use `e` or `ev`
  // Only fix the ones that access event properties; handle empty param name
  ts = ts.replace(/onpointermove:\s*\(e\)\s*=>/g, 'onpointermove: (e: PointerEvent) =>');
  ts = ts.replace(/onwheel:\s*\((\w+)\)\s*=>/g, (match, p1) => `onwheel: (${p1 || '_'}: WheelEvent) =>`);
  ts = ts.replace(/onclick:\s*\(e\)\s*=>/g, 'onClick: (e: MouseEvent) =>');
  ts = ts.replace(/onscroll:\s*\((\w*)\)\s*=>/g, (match, p1) => `onscroll: (${p1 || '_'}: Event) =>`);
  ts = ts.replace(/onscrollend:\s*\((\w*)\)\s*=>/g, (match, p1) => `onscrollend: (${p1 || '_'}: Event) =>`);

  // 19. Fix `this.el` querySelector calls
  ts = ts.replace(/this\.el\?\.querySelector/g, '(this.el as Element | null)?.querySelector');
  ts = ts.replace(/this\.el\.querySelector/g, '(this.el as Element | null)?.querySelector');

  // 20. Fix `p.style.scrollbarGutter` - p is Element, need HTMLElement
  // These are handled by the $ method returning HTMLElement

  // 21. Add return types to class-level methods (2-space indent) that don't have return type
  ts = ts.replace(/^  (_\w+)\(([^)]*)\)\s*\{/gm, (match, methodName, params) => {
    // Skip if already has return type
    if (match.includes('):')) return match;
    // Skip if method name is _addLog, _btn, _caps (already handled)
    if (['_addLog','_btn','_caps','_flags'].includes(methodName)) return match;
    // Skip _render methods (already handled)
    if (methodName.startsWith('_render')) return match;
    // Type params
    let typedParams = params;
    typedParams = typedParams.replace(/\btype\b(?!\s*:)/g, 'type: string');
    typedParams = typedParams.replace(/\bcontent\b(?!\s*:)/g, 'content: string');
    typedParams = typedParams.replace(/\blabel\b(?!\s*:)/g, 'label: string');
    typedParams = typedParams.replace(/\bopts\b(?!\s*:)/g, 'opts: ButtonProps');
    typedParams = typedParams.replace(/\bpos\b(?!\s*:)/g, 'pos: string');
    typedParams = typedParams.replace(/\bname\b(?!\s*:)/g, 'name: string');
    typedParams = typedParams.replace(/\bid\b(?!\s*:)/g, 'id: string');
    typedParams = typedParams.replace(/\btextContent\b(?!\s*:)/g, 'textContent: string');
    // Determine return type
    const methodBody = src.match(new RegExp(`${methodName}\\([^)]*\\)\\s*\\{([\\s\\S]*?)\\n  \\}`));
    if (methodBody && methodBody[1].includes('return ')) {
      return `  ${methodName}(${typedParams}): any {`;
    }
    return `  ${methodName}(${typedParams}): void {`;
  });

  const dstPath = `${DST_DIR}/${name}.ts`;
  writeFileSync(dstPath, ts);
  console.log(`OK: ${name}`);
}

for (const f of FILES) {
  try { convert(f); } catch(e) { console.log(`ERROR: ${f}: ${e.message}`); }
}
