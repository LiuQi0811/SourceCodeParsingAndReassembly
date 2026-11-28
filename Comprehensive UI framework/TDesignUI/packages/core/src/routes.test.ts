import { describe, expect, it } from 'vitest';
import { ROUTES, routePathOf } from './routes';

describe('ROUTES', () => {
  it('三条路由的路径唯一', () => {
    const paths = ROUTES.map((route) => route.path);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it('首页是根路径', () => {
    expect(routePathOf('home')).toBe('/');
  });

  it('列表与新建页都有独立路径', () => {
    expect(routePathOf('apps')).toBe('/apps');
    expect(routePathOf('create')).toBe('/create');
  });

  it('每条路由都有标题和导航文案', () => {
    ROUTES.forEach((route) => {
      expect(route.title.length).toBeGreaterThan(0);
      expect(route.navLabel.length).toBeGreaterThan(0);
    });
  });
});
