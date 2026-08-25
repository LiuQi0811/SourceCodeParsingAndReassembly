/**
 * 模板引擎 - 1:1 还原原 js/templates.js 的 Template 类
 * 支持 ${var} 占位符 + 管道处理器(slice|replace|regexp|exists|to|find|filter|prompt)
 */
import { isEmpty, stringModify, appendZero } from './function';

export interface TemplateContext {
  url?: string;
  referer?: string;
  origin?: string;
  initiator?: string;
  webUrl?: string;
  title?: string;
  _title?: string;
  cookie?: string;
  tabId?: number;
  pageDOM?: Document;
  fullFileName?: string;
  fileName?: string;
  ext?: string;
  mobileUserAgent?: string;
  userAgent?: string;
  requestHeaders?: Record<string, string>;
  [key: string]: unknown;
}

type Processor = (
  txt: string,
  arg: unknown[],
  data: TemplateContext,
) => string;

export class Template {
  static _processors: Record<string, Processor> = {
    slice: (txt, arg) => txt.slice(...(arg as [number, number?])),
    replace: (txt, arg) =>
      txt.replace(...(arg as [string | RegExp, string])),
    replaceAll: (txt, arg) =>
      txt.replaceAll(...(arg as [string, string])),
    regexp: (txt, arg) => {
      const match = txt.match(new RegExp(...(arg as [string, string?])));
      if (!match) return '';
      return match.slice(1).filter(Boolean).map((s) => s.trim()).join('');
    },
    exists: (txt, arg) => {
      const a = arg as string[];
      return txt ? (a[0]?.replaceAll('*', txt) ?? '') : (a[1]?.replaceAll('*', txt) ?? '');
    },
    prepend: (txt, arg) => ((arg[0] as string) || '') + txt,
    concat: (txt, arg) => txt + ((arg[0] as string) || ''),
    to: (txt, arg) => {
      const type = arg[0] as string;
      switch (type) {
        case 'base64':
          try {
            return btoa(
              encodeURIComponent(txt).replace(
                /%([0-9A-F]{2})/g,
                (_, p1) => String.fromCharCode(parseInt(p1, 16)),
              ),
            );
          } catch {
            return txt;
          }
        case 'urlEncode':
          return encodeURIComponent(txt);
        case 'urlDecode':
          return decodeURIComponent(txt);
        case 'lowerCase':
          return txt.toLowerCase();
        case 'upperCase':
          return txt.toUpperCase();
        case 'trim':
          return txt.trim();
        case 'filter':
          return stringModify(txt.trim());
        default:
          return txt;
      }
    },
    find: (_txt, arg, data) => {
      if (data?.pageDOM && data.pageDOM instanceof Document) {
        try {
          return (data.pageDOM.querySelector(arg[0] as string)?.textContent?.trim() ?? '');
        } catch {
          return '';
        }
      }
      return '';
    },
    filter: (txt, arg) => stringModify(txt, arg[0] as string),
    prompt: (txt) => (typeof window !== 'undefined' ? window.prompt('', txt) || '' : txt),
  };

  static render(text: unknown, data: TemplateContext): string {
    if (isEmpty(text)) return '';

    // 补全文件名相关数据(还原 templates.js 第 46-53 行)
    try {
      data.fullFileName = new URL(data.url ?? '').pathname.split('/').pop() || '';
    } catch {
      data.fullFileName = 'NULL';
    }
    const parts = data.fullFileName.split('.');
    if (parts.length > 1) parts.pop();
    data.fileName = parts.join('.');
    if (isEmpty(data.ext)) {
      const extParts = data.fullFileName.split('.');
      data.ext = extParts.length === 1 ? '' : extParts[extParts.length - 1];
    }

    const date = new Date();
    const trimData: TemplateContext = {
      url: data.url ?? '',
      referer: data.requestHeaders?.referer ?? '',
      origin: data.requestHeaders?.origin ?? '',
      initiator: data.requestHeaders?.referer
        ? data.requestHeaders.referer
        : data.initiator,
      webUrl: data.webUrl ?? '',
      title: data._title || data.title || 'NULL',
      pageDOM: data.pageDOM,
      cookie: data.cookie ?? '',
      tabId: data.tabId ?? 0,
      year: date.getFullYear(),
      month: appendZero(date.getMonth() + 1),
      date: appendZero(date.getDate()),
      day: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][date.getDay()],
      fullDate: `${date.getFullYear()}-${appendZero(date.getMonth() + 1)}-${appendZero(date.getDate())}`,
      time: `${appendZero(date.getHours())}'${appendZero(date.getMinutes())}'${appendZero(date.getSeconds())}`,
      hours: appendZero(date.getHours()),
      minutes: appendZero(date.getMinutes()),
      seconds: appendZero(date.getSeconds()),
      now: Date.now(),
      timestamp: date.toISOString(),
      fullFileName: data.fullFileName,
      fileName: data.fileName ?? '',
      ext: data.ext ?? '',
      mobileUserAgent: data.mobileUserAgent ?? '',
      userAgent: data.userAgent ?? '',
    };
    trimData.title = String(trimData.title).replace(/[/\\]/g, '_');
    const _data: TemplateContext = { ...data, ...trimData };

    const ast = this._parse(String(text));
    return this._evaluate(ast, _data, trimData);
  }

  // ========== 解析阶段(还原 templates.js 第 91-206 行) ==========
  private static _parse(input: string) {
    interface Node {
      type: 'text' | 'tag';
      value?: string;
      varName?: string;
      pipes?: any[];
    }
    const nodes: Node[] = [];
    let pos = 0;
    const peek = (offset = 0) =>
      pos + offset < input.length ? input[pos + offset] : '';
    const advance = () => (pos < input.length ? input[pos++] : '');
    const eof = () => pos >= input.length;

    const readBalancedContent = () => {
      let depth = 1;
      const start = pos;
      let inDouble = false;
      let inSingle = false;
      let escaped = false;
      while (!eof() && depth > 0) {
        const ch = advance();
        if (escaped) {
          escaped = false;
          continue;
        }
        if (ch === '\\') {
          escaped = true;
          continue;
        }
        if (!inSingle && ch === '"') inDouble = !inDouble;
        else if (!inDouble && ch === "'") inSingle = !inSingle;
        else if (!inDouble && !inSingle) {
          if (ch === '$' && peek() === '{') depth++;
          else if (ch === '}') {
            depth--;
            if (depth === 0) return input.slice(start, pos - 1);
          }
        }
      }
      return input.slice(start, pos);
    };

    const splitByTopLevelPipe = (str: string) => {
      const parts: string[] = [];
      let start = 0;
      let inDouble = false;
      let inSingle = false;
      let escaped = false;
      for (let i = 0; i < str.length; i++) {
        const ch = str[i];
        if (escaped) {
          escaped = false;
          continue;
        }
        if (ch === '\\') {
          escaped = true;
          continue;
        }
        if (!inSingle && ch === '"') inDouble = !inDouble;
        else if (!inDouble && ch === "'") inSingle = !inSingle;
        else if (!inDouble && !inSingle && ch === '|') {
          parts.push(str.slice(start, i));
          start = i + 1;
        }
      }
      parts.push(str.slice(start));
      return parts;
    };

    const parseOnePipe = (pipeStr: string) => {
      const colonIdx = pipeStr.indexOf(':');
      let name: string;
      let argsRaw: string;
      if (colonIdx === -1) {
        name = pipeStr.trim();
        argsRaw = '';
      } else {
        name = pipeStr.slice(0, colonIdx).trim();
        argsRaw = pipeStr.slice(colonIdx + 1).trim();
      }
      const argStrings = argsRaw ? Template._splitString(argsRaw, ',') : [];
      const args = argStrings.map((arg) => {
        const cleanArg = arg.trim().replace(/^(["'])([\s\S]*)\1$/, '$2');
        if (cleanArg.includes('${')) {
          return Template._parse(cleanArg);
        }
        return { type: 'text' as const, value: cleanArg };
      });
      return { name, args };
    };

    const parsePipeChain = (chainStr: string) =>
      splitByTopLevelPipe(chainStr).map((s) => parseOnePipe(s.trim()));

    const parseTag = () => {
      advance();
      advance(); // 跳过 ${
      const content = readBalancedContent();
      const pipeIdx = (() => {
        let inD = false,
          inS = false,
          esc = false;
        for (let i = 0; i < content.length; i++) {
          const ch = content[i];
          if (esc) {
            esc = false;
            continue;
          }
          if (ch === '\\') {
            esc = true;
            continue;
          }
          if (!inS && ch === '"') inD = !inD;
          else if (!inD && ch === "'") inS = !inS;
          else if (!inD && !inS && ch === '|') return i;
        }
        return -1;
      })();
      const varName = pipeIdx === -1 ? content.trim() : content.slice(0, pipeIdx).trim();
      const pipes = pipeIdx === -1 ? [] : parsePipeChain(content.slice(pipeIdx + 1).trim());
      return { type: 'tag' as const, varName, pipes };
    };

    while (pos < input.length) {
      if (peek() === '$' && peek(1) === '{') {
        nodes.push(parseTag());
      } else {
        const start = pos;
        while (!eof() && !(peek() === '$' && peek(1) === '{')) advance();
        nodes.push({ type: 'text', value: input.slice(start, pos) });
      }
    }
    return nodes;
  }

  // ========== 求值阶段(还原 templates.js 第 209-254 行) ==========
  private static _evaluate(
    nodes: any[],
    data: TemplateContext,
    trimData: TemplateContext,
  ): string {
    let result = '';
    for (const node of nodes) {
      if (node.type === 'text') {
        result += node.value ?? '';
      } else if (node.type === 'tag') {
        result += this._evalTag(node, data, trimData);
      }
    }
    return result;
  }

  private static _evalTag(
    tag: { varName: string; pipes: any[] },
    data: TemplateContext,
    trimData: TemplateContext,
  ): string {
    let value: unknown;
    if (tag.varName === 'data') {
      const {
        pageDOM, year, month, date, day, fullDate, time, hours, minutes, seconds,
        mobileUserAgent, ...rest
      } = trimData;
      value = JSON.stringify(rest);
    } else {
      value = (data as Record<string, unknown>)[tag.varName];
    }

    let current = value !== undefined ? String(value) : '';
    if (!tag.pipes.length) {
      return value !== undefined ? String(value) : '${' + tag.varName + '}';
    }

    for (const pipe of tag.pipes) {
      const resolvedArgs = pipe.args.map((arg: any) => {
        if (Array.isArray(arg)) {
          return this._evaluate(arg, data, trimData);
        }
        if (arg && arg.type === 'text') return arg.value as string;
        return arg;
      });

      if (isEmpty(current) && !['exists', 'find', 'prompt'].includes(pipe.name)) return '';
      if (resolvedArgs.length === 0 && !['filter', 'prompt'].includes(pipe.name)) break;

      const processor = Template._processors[pipe.name];
      if (processor) {
        current = processor(current, resolvedArgs, data);
      }
    }
    return current;
  }

  /** 字符串分割辅助(还原 templates.js 第 257-274 行) */
  private static _splitString(text: string, separator: string): string[] {
    text = text.trim();
    if (text.length === 0) return [];
    const parts: string[] = [];
    let inQuotes = false;
    let inSingle = false;
    let start = 0;
    for (let i = 0; i < text.length; i++) {
      if (text[i] === separator && !inQuotes && !inSingle) {
        parts.push(text.slice(start, i));
        start = i + 1;
      } else if (text[i] === '"' && !inSingle) {
        inQuotes = !inQuotes;
      } else if (text[i] === "'" && !inQuotes) {
        inSingle = !inSingle;
      }
    }
    parts.push(text.slice(start));
    return parts;
  }
}

/** 兼容原项目 templates(text, data) 函数式调用 */
export function templates(text: unknown, data: TemplateContext): string {
  return Template.render(text, data);
}
