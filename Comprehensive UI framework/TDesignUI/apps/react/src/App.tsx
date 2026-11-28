import { NavLink, Route, Routes } from 'react-router-dom';
import type { ComponentType } from 'react';
import { APP_SPEC, ROUTES } from '@tdesignui/core';
import HomePage from './pages/HomePage';
import AppsPage from './pages/AppsPage';

// 路径来自 core 的路由表，组件在这里映射 —— 与 Vue 端共用同一份路径定义
const pages: Record<string, ComponentType> = {
  home: HomePage,
  apps: AppsPage,
};

export default function App() {
  return (
    <div className="shell">
      <header className="nav">
        <div className="brand">{APP_SPEC.product}</div>
        <nav className="links">
          {ROUTES.map((route) => (
            <NavLink
              key={route.key}
              to={route.path}
              end={route.path === '/'}
              className={({ isActive }) => (isActive ? 'link active' : 'link')}
            >
              {route.navLabel}
            </NavLink>
          ))}
        </nav>
        <span className="badge">React 版</span>
      </header>

      <main className="main">
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
