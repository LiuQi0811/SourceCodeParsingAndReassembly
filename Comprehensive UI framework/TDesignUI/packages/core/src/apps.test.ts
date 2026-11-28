import { describe, expect, it } from 'vitest';
import {
  APP_CATALOG,
  APP_CATEGORIES,
  APP_STATUSES,
  DEFAULT_FILTER,
  createAppListStore,
  filterApps,
  formatDate,
  nextAppId,
  paginate,
  statusLabel,
  statusTheme,
  summarizeApps,
  type AppInput,
} from './';

const draftInput: AppInput = {
  name: '新营销页',
  owner: '测试',
  category: '营销',
  status: 'building',
};

describe('目录数据', () => {
  it('共 10 个应用', () => {
    expect(APP_CATALOG).toHaveLength(10);
  });

  it('分类与状态取值来自同一份常量', () => {
    expect(APP_CATEGORIES).toEqual(['电商', '中台', '工具', '营销']);
    expect(APP_STATUSES).toEqual(['online', 'offline', 'building']);
  });

  it('所有应用的分类和状态都合法', () => {
    APP_CATALOG.forEach((item) => {
      expect(APP_CATEGORIES).toContain(item.category);
      expect(APP_STATUSES).toContain(item.status);
    });
  });
});

describe('filterApps', () => {
  it('默认条件下返回全量', () => {
    expect(filterApps(APP_CATALOG, DEFAULT_FILTER)).toHaveLength(10);
  });

  it('关键词命中负责人', () => {
    expect(
      filterApps(APP_CATALOG, { ...DEFAULT_FILTER, keyword: '张立' }).map((i) => i.id),
    ).toEqual(['A-1001']);
  });

  it('关键词命中编号且忽略大小写', () => {
    expect(
      filterApps(APP_CATALOG, { ...DEFAULT_FILTER, keyword: 'a-1005' }).map((i) => i.id),
    ).toEqual(['A-1005']);
  });

  it('关键词命中应用名', () => {
    expect(
      filterApps(APP_CATALOG, { ...DEFAULT_FILTER, keyword: '看板' }).map((i) => i.id),
    ).toEqual(['A-1006']);
  });

  it('按分类筛选', () => {
    expect(filterApps(APP_CATALOG, { ...DEFAULT_FILTER, category: '中台' })).toHaveLength(3);
  });

  it('按状态筛选', () => {
    expect(filterApps(APP_CATALOG, { ...DEFAULT_FILTER, status: 'building' })).toHaveLength(2);
  });

  it('分类与状态是且关系', () => {
    expect(
      filterApps(APP_CATALOG, { ...DEFAULT_FILTER, category: '营销', status: 'online' }),
    ).toHaveLength(1);
  });

  it('关键词前后空格不影响结果', () => {
    expect(filterApps(APP_CATALOG, { ...DEFAULT_FILTER, keyword: '  看板  ' })).toHaveLength(1);
  });
});

describe('paginate', () => {
  it('第 1 页取满 pageSize', () => {
    expect(paginate(APP_CATALOG, 1, 4).rows).toHaveLength(4);
  });

  it('总页数按向上取整', () => {
    expect(paginate(APP_CATALOG, 1, 4).totalPages).toBe(3);
  });

  it('末页只返回剩余条目', () => {
    const last = paginate(APP_CATALOG, 3, 4);
    expect(last.rows).toHaveLength(2);
    expect(last.rows[0].id).toBe('A-1009');
  });

  it('页码超出范围时回夹到末页', () => {
    expect(paginate(APP_CATALOG, 99, 4).page).toBe(3);
  });

  it('页码小于 1 时回夹到首页', () => {
    expect(paginate(APP_CATALOG, 0, 4).page).toBe(1);
  });

  it('空集合也有 1 页', () => {
    const empty = paginate([], 1, 4);
    expect(empty.totalPages).toBe(1);
    expect(empty.rows).toHaveLength(0);
  });
});

describe('状态文案与统计', () => {
  it('状态文案', () => {
    expect(statusLabel('online')).toBe('已上线');
    expect(statusLabel('offline')).toBe('已下线');
    expect(statusLabel('building')).toBe('构建中');
  });

  it('tag 主题映射', () => {
    expect(statusTheme('online')).toBe('success');
    expect(statusTheme('offline')).toBe('default');
    expect(statusTheme('building')).toBe('warning');
  });

  it('统计各状态数量', () => {
    expect(summarizeApps(APP_CATALOG)).toEqual({ online: 5, offline: 3, building: 2 });
  });
});

describe('nextAppId', () => {
  it('在最大编号上加一', () => {
    expect(nextAppId(APP_CATALOG)).toBe('A-1011');
  });

  it('空集合从 A-1001 开始', () => {
    expect(nextAppId([])).toBe('A-1001');
  });

  it('忽略非法编号', () => {
    expect(nextAppId([{ ...APP_CATALOG[0], id: 'X-1' }, APP_CATALOG[0]])).toBe('A-1002');
  });
});

describe('formatDate', () => {
  it('补零到 YYYY-MM-DD', () => {
    expect(formatDate(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('两位月日不补零', () => {
    expect(formatDate(new Date(2026, 10, 28))).toBe('2026-11-28');
  });
});

describe('createAppListStore', () => {
  it('初始快照反映全量数据', () => {
    const store = createAppListStore();
    expect(store.get().totalItems).toBe(10);
    expect(store.get().result.total).toBe(10);
    expect(store.get().page).toBe(1);
    expect(store.get().result.rows).toHaveLength(4);
  });

  it('改分类会重置页码并更新统计', () => {
    const store = createAppListStore();
    store.setPage(3);
    store.setCategory('电商');
    expect(store.get().page).toBe(1);
    expect(store.get().result.total).toBe(2);
    expect(store.get().summary).toEqual({ online: 1, offline: 1, building: 0 });
  });

  it('条件叠加生效', () => {
    const store = createAppListStore();
    store.setCategory('营销');
    store.setKeyword('订单');
    expect(store.get().result.total).toBe(0);
  });

  it('单页时翻页被回夹', () => {
    const store = createAppListStore();
    store.setKeyword('看板');
    store.setPage(2);
    expect(store.get().page).toBe(1);
  });

  it('reset 恢复默认条件与全量', () => {
    const store = createAppListStore();
    store.setCategory('工具');
    store.setStatus('offline');
    store.reset();
    expect(store.get().filter).toEqual(DEFAULT_FILTER);
    expect(store.get().result.total).toBe(10);
  });

  it('每次条件变更通知一次订阅者', () => {
    const store = createAppListStore();
    const seen: number[] = [];
    const stop = store.subscribe((snap) => seen.push(snap.result.total));
    store.setCategory('电商');
    store.setKeyword('订单');
    store.setPage(2);
    store.reset();
    expect(seen).toEqual([2, 1, 1, 10]);
    stop();
    store.setCategory('工具');
    expect(seen).toHaveLength(4);
  });

  it('names 返回当前全部应用名', () => {
    const store = createAppListStore();
    expect(store.names()).toHaveLength(10);
    expect(store.names()).toContain('交易中台');
  });

  it('addApp 写入后总条数 +1、新条目置顶、编号连续', () => {
    const store = createAppListStore();
    const created = store.addApp(draftInput, new Date(2026, 11, 1));
    const snap = store.get();
    expect(created.id).toBe('A-1011');
    expect(created.updatedAt).toBe('2026-12-01');
    expect(snap.totalItems).toBe(11);
    expect(snap.result.total).toBe(11);
    expect(snap.result.rows[0].name).toBe('新营销页');
    expect(snap.result.rows[0].owner).toBe('测试');
  });

  it('addApp 时首尾空格被清掉', () => {
    const store = createAppListStore();
    const created = store.addApp({ ...draftInput, name: '  空格应用  ', owner: ' 张三 ' });
    expect(created.name).toBe('空格应用');
    expect(created.owner).toBe('张三');
  });

  it('addApp 会通知订阅者', () => {
    const store = createAppListStore();
    let latest = 0;
    store.subscribe((snap) => {
      latest = snap.totalItems;
    });
    store.addApp(draftInput);
    expect(latest).toBe(11);
  });

  it('addApp 后筛选条件保持不变', () => {
    const store = createAppListStore();
    store.setCategory('工具');
    store.addApp(draftInput);
    expect(store.get().filter.category).toBe('工具');
    expect(store.get().result.total).toBe(2);
  });
});
