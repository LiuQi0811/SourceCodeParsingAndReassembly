import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import IntersectObserver from '@/components/common/IntersectObserver';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ConfigProvider } from '@/contexts/ConfigContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { AppLayout } from '@/components/layouts/AppLayout';
import { ensureSession } from '@/lib/supabaseAuth';

import { routes } from './routes';

const App: React.FC = () => {
  useEffect(() => {
    ensureSession();
  }, []);

  return (
    <ThemeProvider>
      <ConfigProvider>
      <TooltipProvider delayDuration={200}>
        <Router>
          <IntersectObserver />
          <AppLayout>
            <Routes>
              {routes.map((route, index) => (
                <Route key={index} path={route.path} element={route.element} />
              ))}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </AppLayout>
          <Toaster position="top-center" />
        </Router>
      </TooltipProvider>
    </ConfigProvider>
    </ThemeProvider>
  );
};

export default App;
