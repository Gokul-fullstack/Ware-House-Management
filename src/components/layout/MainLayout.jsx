import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import { useApp } from '../../contexts/AppContext';

// These routes are full-height grid pages — no padding around them
const FULL_HEIGHT_ROUTES = [
  '/sales', '/sales/new', '/sales-edit', '/purchases', '/purchases/new', '/sales/import',
];

export default function MainLayout() {
  const { sidebarCollapsed } = useApp();
  const location = useLocation();
  const isFull = FULL_HEIGHT_ROUTES.some(r => location.pathname === r || location.pathname.startsWith(r));

  return (
    <div className="app-layout">
      <Sidebar />
      <div className={`main-content ${sidebarCollapsed ? 'sidebar-is-collapsed' : ''}`}>
        <Header />
        <div className={`page-container${isFull ? ' no-pad' : ''}`}>
          <Outlet />
        </div>
      </div>
    </div>
  );
}
