// Conversion script: JS → TS strict mode for api-lab pages
// Improved version with more robust pattern handling
const fs = require('fs');
const path = require('path');

const SRC_DIR = '/workspace/src/pages/api-lab';
const DST_DIR = '/workspace/ts/pages/api-lab';

const FILES = [
  'CSSContainerStyleQueriesPage.js',
  'CSSCounterStylesPage.js',
  'CSSCustomHighlightAPIPage.js',
  'CSSFlexboxDeepPage.js',
  'CSSFontTypographyDeepPage.js',
  'CSSFormColorPage.js',
  'CSSFunctionsDeepPage.js',
  'CSSGeneratedContentListsPage.js',
  'CSSGradientsDeepPage.js',
  'CSSGridDeepPage.js',
  'CSSInlineLayoutPage.js',
  'CSSLogicalLayoutPage.js',
  'CSSMaskingCompositingDeepPage.js',
  'CSSMediaUserPreferencePage.js',
  'CSSNestingScopeDeepPage.js',
  'CSSObjectModelPage.js',
  'CSSPerformanceLayoutPage.js',
  'CSSResizePage.js',
  'CSSRubyDeepPage.js',
  'CSSScrollLayoutPage.js',
  'CSSScrollSnapPage.js',
  'CSSShapesPage.js',
  'CSSStartingStylePage.js',
  'CSSTableLayoutDeepPage.js',
  'CSSTextAdvancedPage.js',
  'CSSTransforms3DDeepPage.js',
  'CSSTransitionsAnimationsPage.js',
  'CSSViewportUnitsMulticolPage.js',
  'CSSVisualEffectsPage.js',
  'CSSWritingModesPage.js',
];

function convertFile(filename) {
  const srcPath = path.join(SRC_DIR, filename);
  if (!fs.existsSync(srcPath)) {
    console.log(`SKIP (not found): ${filename}`);
    return;
  }
  let code = fs.readFileSync(srcPath, 'utf8');
  const className = filename.replace('.js', '');
  const stateName = `${className}State`;

  // 1. Add type import after last import line (if not already present)
  if (!code.includes("import type { Props, State }")) {
    const importLines = code.match(/^import .*$/gm) || [];
    const lastImport = importLines[importLines.length - 1];
    code = code.replace(lastImport, lastImport + "\nimport type { Props, State } from '../../core/types.js';");
  }

  // 2. Extract initialState return fields by finding the initialState method body
  const initialStateMatch = code.match(/initialState\(\)\s*\{([\s\S]*?)\n    \};\n/);
  let stateFields = [];
  if (initialStateMatch) {
    const body = initialStateMatch[1];
    // Match fields like:  fieldName: value,
    const fieldRegex = /^\s*(\w+):\s*(.+?),?\s*$/gm;
    let m;
    while ((m = fieldRegex.exec(body)) !== null) {
      const name = m[1];
      let val = m[2].trim().replace(/,$/, '').trim();
      // Remove trailing comments
      val = val.replace(/\/\/.*$/, '').trim();
      if (!val) continue;
      let type = 'string';
      if (val === '[]') type = 'any[]';
      else if (val === 'null') type = 'null';
      else if (val === 'true' || val === 'false') type = 'boolean';
      else if (/^-?\d+(\.\d+)?$/.test(val)) type = 'number';
      else if (val.startsWith("'") || val.startsWith('"') || val.startsWith('`')) type = 'string';
      else if (val.startsWith('{')) type = 'Record<string, any>';
      else if (val.startsWith('new Map')) type = 'Map<any, any>';
      else if (val.startsWith('new Set')) type = 'Set<any>';
      else if (val.startsWith('new Date')) type = 'Date';
      else type = 'any';
      stateFields.push({ name, type, val });
    }
  }

  // Build LogEntry + State interface
  let stateInterface = `interface LogEntry { type: string; content: string; time: string; }\n\ninterface ${stateName} extends State {\n`;
  for (const f of stateFields) {
    if (f.name === 'logs') {
      stateInterface += `  logs: LogEntry[];\n`;
    } else if (f.type === 'null') {
      // Infer from field name
      if (f.name.includes('Style') || f.name.includes('El') || f.name.includes('el')) {
        stateInterface += `  ${f.name}: HTMLElement | null;\n`;
      } else if (f.name.toLowerCase().includes('timer') || f.name.includes('raf') || f.name.includes('Raf') || f.name.includes('interval') || f.name.includes('timeout')) {
        stateInterface += `  ${f.name}: number | null;\n`;
      } else {
        stateInterface += `  ${f.name}: any;\n`;
      }
    } else {
      stateInterface += `  ${f.name}: ${f.type};\n`;
    }
  }
  stateInterface += `}\n\n`;

  // BtnOpts interface
  const btnOptsInterface = `interface BtnOpts extends Props {\n  type?: string;\n  size?: string;\n  disabled?: boolean;\n  danger?: boolean;\n  loading?: boolean;\n  onClick: (e: MouseEvent) => void;\n}\n\n`;

  // Insert interfaces before the class declaration
  const classDeclRegex = new RegExp(`(export class ${className} extends Page \\{)`);
  if (classDeclRegex.test(code)) {
    code = code.replace(classDeclRegex, stateInterface + btnOptsInterface + '$1');
  }

  // 3. Detect instance fields from `this._xxx = ...` assignments
  const instanceFields = new Map();
  const assignRegex = /this\.(_\w+)\s*=\s*([^;\n]+)/g;
  let am;
  while ((am = assignRegex.exec(code)) !== null) {
    const fieldName = am[1];
    const val = am[2].trim().replace(/;$/, '').trim();
    if (!instanceFields.has(fieldName)) {
      let type = 'any';
      if (val === 'true' || val === 'false') type = 'boolean';
      else if (val === '[]') type = 'any[]';
      else if (val === 'null') type = 'any';
      else if (val === 'undefined') type = 'any';
      else if (/^-?\d+(\.\d+)?$/.test(val)) type = 'number';
      else if (val.startsWith("'") || val.startsWith('"') || val.startsWith('`')) type = 'string';
      else if (val.startsWith('document.createElement')) type = 'HTMLElement';
      else if (val.startsWith('new Map')) type = 'Map<any, any>';
      else if (val.startsWith('new Set')) type = 'Set<any>';
      else if (val.startsWith('new Date')) type = 'Date';
      instanceFields.set(fieldName, { type, val });
    }
  }

  // Build field declarations
  let fieldDecls = `  declare state: ${stateName};\n`;
  for (const [name, info] of instanceFields) {
    let tsType = info.type;
    // Refine types based on field name patterns
    if (name === '_inited') tsType = 'boolean';
    else if (name === '_dynamicStyles') tsType = 'HTMLStyleElement[]';
    else if (name === '_styleEl' || name === '_styleElement') tsType = 'HTMLStyleElement | null';
    else if (name === '_currentSystem' || name === '_currentMode' || name === '_currentTab' || name === '_currentVariant' || name === '_currentLayout' || name === '_currentDemo') tsType = 'string';
    else if (name.includes('Injected')) tsType = 'boolean';
    else if (name.includes('Raf') || name.includes('raf') || name === '_animFrame' || name === '_rafId' || name.includes('Timer') || name.includes('timer') || name === '_tickTimer' || name === '_autoTimer' || name === '_timer' || name === '_intervalId' || name === '_timeoutId' || name === '_cleanupTimer') tsType = info.type === 'any' ? 'number' : (info.type === 'any' ? 'number | null' : 'number');
    else if (name === '_audioCtx' || name === '_audioContext') tsType = 'any';
    else if (name === '_workletUrl' || name === '_workletCode') tsType = 'string | null';
    else if (name.includes('Observer') || name.includes('observer')) tsType = 'any';
    else if (name === '_demoStyle' || name === '_baseStyle') tsType = 'HTMLStyleElement | null';
    // Determine initializer
    let initVal;
    if (tsType === 'boolean') initVal = 'false';
    else if (tsType.endsWith('[]') && tsType !== 'any[]') initVal = '[]';
    else if (tsType === 'any[]') initVal = '[]';
    else if (tsType === 'number') initVal = '0';
    else if (tsType === 'string') initVal = "''";
    else if (tsType.includes('| null')) initVal = 'null';
    else if (tsType === 'any') initVal = 'undefined as any';
    else if (tsType.startsWith('Map')) initVal = 'new Map()';
    else if (tsType.startsWith('Set')) initVal = 'new Set()';
    else if (tsType === 'Date') initVal = 'new Date()';
    else if (tsType === 'HTMLElement') initVal = 'null as any';
    else if (tsType === 'HTMLStyleElement | null') initVal = 'null';
    else if (tsType === 'HTMLStyleElement[]') initVal = '[]';
    else initVal = 'undefined as any';

    fieldDecls += `  ${name}: ${tsType} = ${initVal};\n`;
  }
  fieldDecls += '\n';

  // Insert field declarations right after `export class Xxx extends Page {`
  code = code.replace(new RegExp(`(export class ${className} extends Page \\{)`), '$1\n' + fieldDecls);

  // 4. Type initialState return type
  code = code.replace(/initialState\(\)\s*\{/g, `initialState(): ${stateName} {`);

  // 5. Type lifecycle methods
  code = code.replace(/componentDidMount\(\)\s*\{/g, 'componentDidMount(): void {');
  code = code.replace(/componentWillUnmount\(\)\s*\{/g, 'componentWillUnmount(): void {');

  // 6. Type common helper methods
  code = code.replace(/_addLog\(type,\s*content\)\s*\{/g, '_addLog(type: string, content: string): void {');
  code = code.replace(/_addLog\(type:\s*string,\s*content\)\s*\{/g, '_addLog(type: string, content: string): void {');
  code = code.replace(/_btn\(label,\s*opts\)\s*\{/g, '_btn(label: string, opts: BtnOpts): Node {');
  code = code.replace(/_caps\(items\)\s*\{/g, '_caps(items: [string, boolean][]): Node[] {');
  code = code.replace(/_flags\(\)\s*\{/g, '_flags(): any {');
  code = code.replace(/_caps\(\)\s*\{/g, '_caps(): any {');

  // 7. Type _injectStyle, _injectDemoStyle, _injectBaseStyles
  code = code.replace(/_injectStyle\(id,\s*textContent\)\s*\{/g, '_injectStyle(id: string, textContent: string): HTMLStyleElement {');
  code = code.replace(/_injectDemoStyle\(\)\s*\{/g, '_injectDemoStyle(): void {');
  code = code.replace(/_injectBaseStyles\(\)\s*\{/g, '_injectBaseStyles(): void {');
  code = code.replace(/_injectStyles\(\)\s*\{/g, '_injectStyles(): void {');

  // 8. Type _renderCardX methods return Node
  code = code.replace(/(_renderCard\w*)\(\)\s*\{/g, '$1(): Node {');
  // Type _renderLogPanel return Node (could return null or Node)
  code = code.replace(/_renderLogPanel\(\)\s*\{/g, '_renderLogPanel(): Node {');
  // Type _renderXxxPanel methods
  code = code.replace(/(_render\w+Panel)\(\)\s*\{/g, '$1(): Node {');
  // Type _renderXxxSection methods
  code = code.replace(/(_render\w+Section)\(\)\s*\{/g, '$1(): Node {');
  // Type _renderXxx methods (general) - but be careful not to override already typed ones
  code = code.replace(/(_render\w+)\(\)\s*\{/g, (match, p1) => {
    // Don't re-type if already has return type
    if (match.includes('): ')) return match;
    return `${p1}(): Node {`;
  });

  // 9. Type _readXxx methods that return string
  code = code.replace(/(_read\w+)\(\)\s*\{/g, '$1(): string {');

  // 10. Type _runXxx, _showXxx, _demoXxx, _compareXxx, _setXxx, _toggleXxx, _updateXxx, _applyXxx, _startXxx, _stopXxx, _resetXxx, _injectXxx methods
  const voidMethodPatterns = [
    /(_run\w+)\(\)\s*\{/g,
    /(_show\w+)\(\)\s*\{/g,
    /(_demo\w+)\(\)\s*\{/g,
    /(_compare\w+)\(\)\s*\{/g,
    /(_toggle\w+)\(\)\s*\{/g,
    /(_update\w+)\(\)\s*\{/g,
    /(_apply\w+)\(\)\s*\{/g,
    /(_start\w+)\(\)\s*\{/g,
    /(_stop\w+)\(\)\s*\{/g,
    /(_reset\w+)\(\)\s*\{/g,
    /(_inject\w+)\(\)\s*\{/g,
    /(_init\w+)\(\)\s*\{/g,
    /(_cleanup\w+)\(\)\s*\{/g,
    /(_handle\w+)\(\)\s*\{/g,
  ];
  for (const pattern of voidMethodPatterns) {
    code = code.replace(pattern, (match, p1) => {
      if (match.includes('): ')) return match;
      return `${p1}(): void {`;
    });
  }

  // Type _setXxx with parameter
  code = code.replace(/_setSystem\(mode\)\s*\{/g, '_setSystem(mode: string): void {');
  code = code.replace(/_setSystem\(system\)\s*\{/g, '_setSystem(system: string): void {');
  code = code.replace(/_setMode\(mode\)\s*\{/g, '_setMode(mode: string): void {');
  code = code.replace(/_setVariant\(variant\)\s*\{/g, '_setVariant(variant: string): void {');
  code = code.replace(/_setTab\(tab\)\s*\{/g, '_setTab(tab: string): void {');
  code = code.replace(/_setLayout\(layout\)\s*\{/g, '_setLayout(layout: string): void {');

  // 11. Type renderPage and render
  code = code.replace(/renderPage\(\)\s*\{/g, 'renderPage(): Node | string | (Node | string)[] {');
  // render() - only if it doesn't already have a return type
  code = code.replace(/render\(\)\s*\{/g, 'render(): Node {');

  // 12. Type common closure parameters
  code = code.replace(/\(ok\)\s*=>\s*ok\s*\?/g, '(ok: boolean) => ok ?');
  code = code.replace(/const c = \(ok\)\s*=>/g, 'const c = (ok: boolean) =>');
  code = code.replace(/const c = \(ok:\s*boolean\)\s*=>/g, 'const c = (ok: boolean) =>');
  code = code.replace(/supportsPV\s*=\s*\(p,\s*v\)\s*=>/g, 'supportsPV = (p: string, v: string) =>');
  code = code.replace(/supportsCond\s*=\s*\(cond\)\s*=>/g, 'supportsCond = (cond: string) =>');
  code = code.replace(/supportsDecl\s*=\s*\(decl\)\s*=>/g, 'supportsDecl = (decl: string) =>');
  code = code.replace(/const safe\s*=\s*\(fn\)\s*=>/g, 'const safe = (fn: () => boolean): boolean =>');
  code = code.replace(/const safe\s*=\s*\(fn:\s*\(\)\s*=>\s*boolean\):\s*boolean\s*=>/g, 'const safe = (fn: () => boolean): boolean =>');
  code = code.replace(/\.map\(\(\[label,\s*ok\]\)\s*=>/g, '.map(([label, ok]: [string, boolean]) =>');
  code = code.replace(/\.map\(\(log\)\s*=>/g, '.map((log: LogEntry) =>');
  code = code.replace(/\.map\(\(log:\s*LogEntry\)\s*=>/g, '.map((log: LogEntry) =>');
  code = code.replace(/\.map\(\(entry\)\s*=>/g, '.map((entry: LogEntry) =>');
  code = code.replace(/\.map\(\(item\)\s*=>/g, '.map((item: any) =>');
  code = code.replace(/\.map\(\(line\)\s*=>/g, '.map((line: any) =>');

  // 13. Add `as Node` to .render() returns
  code = code.replace(/return card\.render\(\);/g, 'return card.render() as Node;');
  code = code.replace(/return btn\.render\(\);/g, 'return btn.render() as Node;');
  code = code.replace(/return alert\.render\(\);/g, 'return alert.render() as Node;');

  // 14. Handle catch blocks - cast err to Error
  // catch (err) { → catch (err) { const e = err as Error;
  // But only replace err.name/err.message within the same catch block
  // Simpler approach: change catch (err) to catch (err: any) so err is typed as any
  code = code.replace(/catch\s*\(err\)\s*\{/g, 'catch (err: any) {');
  // Also handle catch (e) and catch (error)
  code = code.replace(/catch\s*\(e\)\s*\{/g, 'catch (e: any) {');
  code = code.replace(/catch\s*\(error\)\s*\{/g, 'catch (error: any) {');

  // 15. Cast renderPage return arrays - find `return [` ... `];` in renderPage and add cast
  // The array in renderPage often contains null (from ternary), so we need `as (Node | string)[]`
  // We'll find the renderPage method and add the cast to its return array
  if (code.includes('renderPage(): Node | string | (Node | string)[]')) {
    // Find all `return [` in renderPage context and the matching `];`
    // The return array ends with `\n  ];` or `\n    ];` before the closing `}`
    // We need to be careful to only match within renderPage

    // Strategy: find renderPage method, then within it find `return [`
    const renderPageStart = code.indexOf('renderPage(): Node | string | (Node | string)[]');
    if (renderPageStart !== -1) {
      // Find the end of renderPage method (next `}` at the same indentation level)
      const afterStart = code.indexOf('{', renderPageStart);
      let depth = 1;
      let endIdx = afterStart + 1;
      while (depth > 0 && endIdx < code.length) {
        if (code[endIdx] === '{') depth++;
        else if (code[endIdx] === '}') depth--;
        endIdx++;
      }
      const renderPageBody = code.slice(afterStart, endIdx);

      // Find `return [` in the body and the matching `];`
      const returnArrMatch = renderPageBody.match(/return \[/);
      if (returnArrMatch) {
        const arrStart = renderPageBody.indexOf('return [');
        // Find the matching `]` - need to count brackets
        let bdepth = 1;
        let bIdx = arrStart + 8; // after "return ["
        while (bdepth > 0 && bIdx < renderPageBody.length) {
          if (renderPageBody[bIdx] === '[') bdepth++;
          else if (renderPageBody[bIdx] === ']') bdepth--;
          bIdx++;
        }
        // bIdx is now after the closing ]
        // Check if there's already a cast
        const afterBracket = renderPageBody.slice(bIdx, bIdx + 30);
        if (afterBracket.startsWith(';')) {
          // Add cast: replace `]` with `] as (Node | string)[]`
          const newBody = renderPageBody.slice(0, bIdx - 1) + '] as (Node | string)[]' + renderPageBody.slice(bIdx);
          code = code.slice(0, afterStart) + newBody + code.slice(endIdx);
        }
      }
    }
  }

  // 16. Handle render() that returns h('div', ...) - that returns Node, fine.
  // But some render() methods return arrays or have null elements.
  // If render() returns h('div', {...}, ...children) where children contain null,
  // h() accepts any[] children, so null is fine.
  // But if render() itself returns an array, we need to cast.
  // Check if render() returns an array (rare for these files - they mostly use renderPage)

  // 17. Handle experimental APIs not in TS lib
  // CSS.highlights, CSS.registerProperty, etc. - use (CSS as any) or (window as any)
  // These will be caught by tsc and fixed manually.

  // 18. Fix `.style` property access on elements that might be typed as Node
  // e.g., (el as HTMLElement).style
  // Most are fine since we use document.createElement which returns HTMLElement

  // 19. Handle `this.$(...)` and `this.$$(...)` - already typed in Component

  // 20. Type any remaining untyped method parameters that have implicit any
  // This is hard to do generically. We'll rely on tsc to find them.

  // Write the file
  const dstPath = path.join(DST_DIR, filename.replace('.js', '.ts'));
  fs.writeFileSync(dstPath, code);
  console.log(`Converted: ${filename} → ${filename.replace('.js', '.ts')}`);
}

// Process all files
for (const file of FILES) {
  convertFile(file);
}
console.log('Done.');
