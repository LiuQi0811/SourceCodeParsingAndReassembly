// 内容数据模型：章节 -> 小节 -> API 文档

export type ExampleLang = 'ts' | 'bash' | 'json';

/** API 参数说明 */
export interface ParamDoc {
  name: string;
  type: string;
  required: boolean;
  desc: string;
}

/** 代码示例（可带真实运行输出，用于终端模拟） */
export interface ExampleDoc {
  title?: string;
  lang: ExampleLang;
  code: string;
  output?: string;
  note?: string;
}

/** 单个 API / 知识点文档 */
export interface ApiDoc {
  id: string;
  title: string;
  signature: string;
  desc: string;
  params: ParamDoc[];
  examples: ExampleDoc[];
  details: string[];
  config?: string[];
  since?: string;
}

/** 章内小节（多主题章节使用） */
export interface SectionDoc {
  id: string;
  title: string;
  desc?: string;
  apis: ApiDoc[];
}

/** 章节 */
export interface ChapterDoc {
  id: string;
  title: string;
  tagline: string;
  sections: SectionDoc[];
}

/** 搜索索引条目 */
export interface SearchItem {
  chapterId: string;
  chapterTitle: string;
  apiId: string;
  title: string;
  signature: string;
  desc: string;
  haystack: string;
}
