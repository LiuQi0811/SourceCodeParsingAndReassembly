import Dashboard from './pages/Dashboard';
import NotFound from './pages/NotFound';
import type { ReactNode } from 'react';

export interface RouteConfig {
  name: string;
  path: string;
  element: ReactNode;
  visible?: boolean;
  public?: boolean;
}

export const routes: RouteConfig[] = [
  {
    name: 'Dashboard',
    path: '/',
    element: <Dashboard />,
    public: true,
  },
  {
    name: '404',
    path: '*',
    element: <NotFound />,
    public: true,
  }
];
