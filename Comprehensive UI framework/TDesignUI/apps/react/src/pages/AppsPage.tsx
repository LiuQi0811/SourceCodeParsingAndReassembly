import { useEffect, useState } from 'react';
import { Button, Card, Divider, Empty, Input, Pagination, Space, Tag } from 'tdesign-react';
import {
  ALL,
  CATEGORY_OPTIONS,
  STATUS_OPTIONS,
  appListStore,
  statusLabel,
  statusTheme,
  type AppStatus,
  type CategoryFilter,
} from '@tdesignui/core';

export default function AppsPage() {
  // 列表状态机来自 core 的共享单例：新建页写入后，这里订阅会立刻收到新快照
  const store = appListStore;
  const [snapshot, setSnapshot] = useState(store.get());
  useEffect(() => store.subscribe(setSnapshot), [store]);

  const categoryText = (value: string) => (value === ALL ? '全部分类' : value);
  const statusText = (value: string) =>
    value === ALL ? '全部状态' : statusLabel(value as AppStatus);

  return (
    <div className="tds-page">
      <header className="tds-hero--left">
        <h1>应用列表</h1>
        <p>数据、筛选、分页、状态文案全部来自 @tdesignui/core，React 只负责渲染</p>
      </header>

      <div className="tds-stack--wide">
        <Card bordered title="概览">
          <Space align="center" size={16}>
            <Tag theme="primary" variant="light">
              共 {snapshot.totalItems} 个应用
            </Tag>
            <Tag theme="success" variant="light">
              已上线 {snapshot.summary.online}
            </Tag>
            <Tag theme="warning" variant="light">
              构建中 {snapshot.summary.building}
            </Tag>
            <Tag theme="default" variant="light">
              已下线 {snapshot.summary.offline}
            </Tag>
            <Tag variant="outline">匹配结果 {snapshot.result.total}</Tag>
          </Space>
        </Card>

        <Card bordered title="筛选">
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Input
              value={snapshot.filter.keyword}
              placeholder="搜索应用名 / 编号 / 负责人"
              clearable
              onChange={(value) => store.setKeyword(value)}
            />

            <Space align="center" size={8} breakLine>
              <span className="tds-filter-label">分类</span>
              {CATEGORY_OPTIONS.map((item) => (
                <Tag
                  key={item}
                  className="tds-pickable"
                  theme={snapshot.filter.category === item ? 'primary' : 'default'}
                  variant={snapshot.filter.category === item ? 'light' : 'outline'}
                  onClick={() => store.setCategory(item as CategoryFilter)}
                >
                  {categoryText(item)}
                </Tag>
              ))}
            </Space>

            <Space align="center" size={8} breakLine>
              <span className="tds-filter-label">状态</span>
              {STATUS_OPTIONS.map((item) => (
                <Tag
                  key={item}
                  className="tds-pickable"
                  theme={snapshot.filter.status === item ? 'primary' : 'default'}
                  variant={snapshot.filter.status === item ? 'light' : 'outline'}
                  onClick={() => store.setStatus(item)}
                >
                  {statusText(item)}
                </Tag>
              ))}
            </Space>

            <Space align="center">
              <Button variant="outline" onClick={() => store.reset()}>
                重置条件
              </Button>
              <span className="tds-hint">
                当前：{snapshot.filter.keyword || '不限关键词'} ·{' '}
                {categoryText(snapshot.filter.category)} · {statusText(snapshot.filter.status)}
              </span>
            </Space>
          </Space>
        </Card>

        <Card bordered title="列表">
          {snapshot.result.total === 0 ? (
            <div className="tds-empty">
              <Empty description="没有匹配的应用，试试放宽筛选条件" />
            </div>
          ) : (
            <div className="tds-grid">
              {snapshot.result.rows.map((row) => (
                <div key={row.id} className="tds-item">
                  <div className="tds-item-head">
                    <span className="tds-item-name">{row.name}</span>
                    <Tag theme={statusTheme(row.status)} variant="light">
                      {statusLabel(row.status)}
                    </Tag>
                  </div>
                  <div className="tds-item-meta">
                    <span>{row.id}</span>
                    <span>{row.category}</span>
                    <span>负责人 {row.owner}</span>
                    <span>更新 {row.updatedAt}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <Divider />
          <div className="tds-footer">
            <span className="tds-hint">
              第 {snapshot.page} / {snapshot.result.totalPages} 页，每页 {snapshot.pageSize} 条
            </span>
            <Pagination
              current={snapshot.page}
              total={snapshot.result.total}
              pageSize={snapshot.pageSize}
              onCurrentChange={(current) => store.setPage(current)}
            />
          </div>
        </Card>
      </div>
    </div>
  );
}
