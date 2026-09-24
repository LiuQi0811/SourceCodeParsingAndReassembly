import type { ReactNode } from 'react';
import { WorkbenchPage } from './pages/WorkbenchPage';
import { OptionsPage } from './pages/OptionsPage';
import { PresetsPage } from './pages/PresetsPage';
import { BatchPage } from './pages/BatchPage';
import { HelpPage } from './pages/HelpPage';

export interface RouteConfig {
  name: string;
  path: string;
  element: ReactNode;
  visible?: boolean;
  /** Accessible without login. Routes without this flag require authentication. Has no effect when RouteGuard is not in use. */
  public?: boolean;
}

export const routes: RouteConfig[] = [
  { name: '工作台', path: '/', element: <WorkbenchPage />, public: true },
  { name: '选项配置中心', path: '/options', element: <OptionsPage />, public: true },
  { name: '预设管理', path: '/presets', element: <PresetsPage />, public: true },
  { name: '批量任务', path: '/batch', element: <BatchPage />, public: true },
  { name: '参数速查', path: '/help', element: <HelpPage />, public: true },
];
