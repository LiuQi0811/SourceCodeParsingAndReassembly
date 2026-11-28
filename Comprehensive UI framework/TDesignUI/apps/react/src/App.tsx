import { useState, type CSSProperties } from 'react';
import { Alert, Button, Card, Divider, Input, Space, Switch, Tag } from 'tdesign-react';
import { APP_SPEC } from '@tdesignui/core';

const styles = {
  page: {
    minHeight: '100vh',
    padding: '48px 24px',
    boxSizing: 'border-box',
    background: '#f5f7fa',
    transition: 'background 0.3s ease',
  } as CSSProperties,
  shell: { maxWidth: 720, margin: '0 auto' },
  hero: { marginBottom: 32, textAlign: 'center' } as CSSProperties,
  title: { margin: '0 0 8px', fontSize: 28, color: '#1f2329' },
  subtitle: { margin: 0, color: '#646a73' },
};

export default function App() {
  const [name, setName] = useState('TDesign');
  const [count, setCount] = useState(0);
  const [dark, setDark] = useState(false);
  const tags = ['React 19', 'Vite 7', 'TypeScript', 'TDesign'];

  const greeting = name ? `你好，${name}！` : '请输入名字';
  const textColor = dark ? '#e8e8e8' : '#1f2329';

  return (
    <div style={{ ...styles.page, background: dark ? '#1a1a1a' : '#f5f7fa' }}>
      <header style={{ ...styles.shell, ...styles.hero }}>
        <h1 style={{ ...styles.title, color: textColor }}>{APP_SPEC.product}</h1>
        <p style={{ ...styles.subtitle, color: dark ? '#a8abb2' : '#646a73' }}>
          {APP_SPEC.tagline} · React 版 · Fast Refresh 已启用
        </p>
      </header>

      <div style={styles.shell}>
        <Space direction="vertical" size={24} style={{ width: '100%' }}>
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
                <Button theme="primary" onClick={() => setCount((c) => c + 1)}>
                  点我 +1
                </Button>
                <Tag theme="primary" variant="light">
                  当前点击：{count} 次
                </Tag>
              </Space>
              <Alert theme="success" message={greeting} />
            </Space>
          </Card>

          <Card title="主题与状态" bordered>
            <Space align="center" size={16}>
              <Switch value={dark} onChange={(value) => setDark(Boolean(value))} />
              <span style={{ color: textColor }}>深色模式</span>
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
        </Space>
      </div>
    </div>
  );
}
