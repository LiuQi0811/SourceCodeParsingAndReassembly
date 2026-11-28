export interface RouteMeta {
  key: 'home' | 'apps';
  path: string;
  title: string;
  /** 导航栏上显示的名字 */
  navLabel: string;
}

export const ROUTES: readonly RouteMeta[] = [
  { key: 'home', path: '/', title: '首页', navLabel: '首页' },
  { key: 'apps', path: '/apps', title: '应用列表', navLabel: '应用列表' },
];

export function routePathOf(key: RouteMeta['key']): string {
  const route = ROUTES.find((item) => item.key === key);
  if (!route) throw new Error(`未知路由 key: ${key}`);
  return route.path;
}
