/** 路由解析：#/、#/fs、#/fs/readfile-writefile */
export interface HomeRoute {
  name: 'home';
}

export interface ChapterRoute {
  name: 'chapter';
  chapterId: string;
  apiId: string | null;
}

export type Route = HomeRoute | ChapterRoute;

export function parseHash(): Route {
  const raw = window.location.hash.replace(/^#\/?/, '');
  const parts = raw.split('/').filter((s) => s.length > 0);
  if (parts.length === 0) return { name: 'home' };
  return { name: 'chapter', chapterId: parts[0], apiId: parts[1] ?? null };
}

export type RouteListener = (route: Route) => void;

export function initRouter(onChange: RouteListener): void {
  const notify = (): void => onChange(parseHash());
  window.addEventListener('hashchange', notify);
  notify();
}

export function navigateTo(route: Route): void {
  if (route.name === 'home') {
    window.location.hash = '#/';
    return;
  }
  window.location.hash = route.apiId ? `#/${route.chapterId}/${route.apiId}` : `#/${route.chapterId}`;
}
