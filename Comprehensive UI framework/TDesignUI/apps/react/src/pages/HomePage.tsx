import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Divider, Input, Space, Switch, Tag } from 'tdesign-react';
import { APP_SPEC, createCounter, formatCount } from '@tdesignui/core';

export default function HomePage() {
  const [name, setName] = useState('TDesign');
  const [dark, setDark] = useState(false);
  const tags = ['React 19', 'Vite 7', 'TypeScript', 'TDesign'];

  // 计数器来自 packages/core，与 Vue 端共用同一份实现
  const counter = useMemo(() => createCounter(), []);
  const [count, setCount] = useState(counter.get());
  useEffect(() => counter.subscribe(setCount), [counter]);

  const greeting = name ? `你好，${name}！` : '请输入名字';

  return (
    <div className={dark ? 'tds-page tds-page--dark' : 'tds-page'}>
      <header className="tds-hero">
        <h1>{APP_SPEC.product}</h1>
        <p>{APP_SPEC.tagline} · React 版 · Fast Refresh 已启用</p>
      </header>

      <div className="tds-stack">
        <Card title="基础交互" bordered hoverShadow>
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Input
              label="名字"
              value={name}
              clearable
              placeholder="输入你的名字"
              onChange={(value) => setName(value)}
            />
            <Space align="center">
              <Button theme="primary" onClick={() => counter.increment()}>
                点我 +1
              </Button>
              <Button variant="outline" onClick={() => counter.increment(5)}>
                一次 +5
              </Button>
              <Button variant="text" onClick={() => counter.reset()}>
                重置
              </Button>
              <Tag theme="primary" variant="light">
                {formatCount(count)}
              </Tag>
            </Space>
            <Alert theme="success" message={greeting} />
          </Space>
        </Card>

        <Card title="主题与状态" bordered>
          <Space align="center" size={16}>
            <Switch value={dark} onChange={(value) => setDark(Boolean(value))} />
            <span>深色模式</span>
          </Space>
          <Divider />
          <Space>
            {tags.map((tag) => (
              <Tag key={tag} variant="outline">
                {tag}
              </Tag>
            ))}
          </Space>
        </Card>
      </div>
    </div>
  );
}
