import { createDemoPage, validateDecoPage, type DecoPage } from "@/deco";
import { apiGet, hasRemoteApi } from "@/utils/request";

export interface DecoHomePayload {
  page: DecoPage | null;
  publishedAt: string;
}

export interface DecoPageSummary {
  id: string;
  title: string;
  isHome: boolean;
  publishedAt: string;
  updatedAt: string;
}

/** 多页面清单：用于 C 端页面切换 / 演示入口；后端不可用时返回空数组 */
export const fetchDecoPages = async (): Promise<DecoPageSummary[]> => {
  if (!hasRemoteApi()) return [];

  try {
    const result = await apiGet<{ pages: DecoPageSummary[] }>("/deco/published");
    return Array.isArray(result.pages) ? result.pages : [];
  } catch (error) {
    console.warn("[deco] 拉取装修页面清单失败", error);
    return [];
  }
};

/**
 * 按页面 id 读取某个装修页面
 * 约定接口：GET {VITE_API_BASE}/deco/pages/:id → { page, publishedAt }
 * 未传 id / 未配后端 / 数据不合法都回落示例
 */
export const fetchDecoPage = async (pageId?: string): Promise<DecoPage> => {
  if (!pageId || !hasRemoteApi()) return createDemoPage();

  try {
    const result = await apiGet<DecoHomePayload>(`/deco/pages/${pageId}`);
    if (result.page && validateDecoPage(result.page).valid) return result.page;
  } catch (error) {
    console.warn("[deco] 拉取指定页面失败，使用内置示例", error);
  }
  return createDemoPage();
};

/**
 * C 端首页装修数据
 * 约定接口：GET {VITE_API_BASE}/deco/home → { code, msg, data: { page, publishedAt } }
 * 没配后端地址（或页面数据不合法）时回落到内置示例，保证首页始终能渲染
 */
export const fetchHomePage = async (): Promise<DecoPage> => {
  if (!hasRemoteApi()) return createDemoPage();

  try {
    const result = await apiGet<DecoHomePayload>("/deco/home");
    if (result.page && validateDecoPage(result.page).valid) return result.page;
  } catch (error) {
    console.warn("[deco] 拉取装修数据失败，使用内置示例", error);
  }
  return createDemoPage();
};
