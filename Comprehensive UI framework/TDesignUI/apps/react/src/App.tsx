import { useEffect, useState } from 'react';
import { Switch } from 'tdesign-react';
import { NavLink, Route, Routes } from 'react-router-dom';
import type { ComponentType } from 'react';
import { APP_SPEC, ROUTES, applyTheme, themeLabel, themeStore } from '@tdesignui/core';
import HomePage from './pages/HomePage';
import AppsPage from './pages/AppsPage';
import CreatePage from './pages/CreatePage';

// 路径来自 core 的路由表，组件在这里映射 —— 与 Vue 端共用同一份路径定义
const pages: Record<string, ComponentType> = {
  home: HomePage,
  apps: AppsPage,
  create: CreatePage,
};

export default function App() {
  // 主题状态来自 core 的共享单例，切一次全站生效（含 TDesign 组件）
  const [theme, setTheme] = useState(themeStore.get());
  useEffect(() => themeStore.subscribe(setTheme), []);
  useEffect(() => applyTheme(theme), [theme]);

  return (
    <div className="tds-shell">
      <header className="tds-nav">
        <div className="tds-brand">{APP_SPEC.product}</div>
        <nav className="tds-links">
          {ROUTES.map((route) => (
            <NavLink
              key={route.key}
              to={route.path}
              end={route.path === '/'}
              className={({ isActive }) => (isActive ? 'tds-link tds-link--active' : 'tds-link')}
            >
              {route.navLabel}
            </NavLink>
          ))}
        </nav>
        <span className="tds-theme-label">{themeLabel(theme)}</span>
        <Switch
          value={theme === 'dark'}
          onChange={(value) => themeStore.set(value ? 'dark' : 'light')}
        />
        <span className="tds-badge">React 版</span>
      </header>

      <main className="tds-main">
        <Routes>
          {ROUTES.map((route) => {
            const Page = pages[route.key];
            return <Route key={route.key} path={route.path} element={<Page />} />;
          })}
        </Routes>
      </main>
    </div>
  );
}
