// 内容编写辅助函数：让章节文件保持精炼
import type { ApiDoc, ChapterDoc, ExampleDoc, ParamDoc, SectionDoc } from '../types';

export function chapter(id: string, title: string, tagline: string, sections: SectionDoc[]): ChapterDoc {
  return { id, title, tagline, sections };
}

export function section(id: string, title: string, apis: ApiDoc[]): SectionDoc {
  return { id, title, apis };
}

export function api(
  id: string,
  title: string,
  signature: string,
  desc: string,
  params: ParamDoc[] = [],
  examples: ExampleDoc[] = [],
  details: string[] = [],
  config?: string[],
  since?: string,
): ApiDoc {
  return { id, title, signature, desc, params, examples, details, config, since };
}

/** 声明一个参数说明 */
export function p(name: string, type: string, required: boolean, desc: string): ParamDoc {
  return { name, type, required, desc };
}

/** TypeScript 代码示例 */
export function ex(title: string, code: string, output?: string, note?: string): ExampleDoc {
  return { title, code, output, note, lang: 'ts' };
}

/** Shell 命令示例 */
export function bash(title: string, code: string, output?: string): ExampleDoc {
  return { title, code, output, lang: 'bash' };
}

/** JSON / 配置示例 */
export function json(title: string, code: string, note?: string): ExampleDoc {
  return { title, code, note, lang: 'json' };
}
