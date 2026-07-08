import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, Package, Users, Tag, Ruler, Receipt, ShoppingCart, 
  Settings, ChevronLeft, ChevronRight, LogOut, FileUp, BarChart3, 
  ClipboardList, Percent, Sliders, BookOpen, Warehouse, AlertTriangle, 
  PlusCircle, Megaphone, FileText, Bell, PackageSearch, ShoppingBag, Wallet
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useApp } from '../../contexts/AppContext';

export default function Sidebar() {
  const { user, logout } = useAuth();
  const { sidebarCollapsed, toggleSidebar } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const [tooltip, setTooltip] = useState(null);

  // Define sidebar navigation dynamically based on user role
  const getNavItems = () => {
    if (!user) return [];

    if (user.role === 'admin') {
      return [
        { label: 'Dashboard', icon: LayoutDashboard, path: '/' },
        { type: 'divider' },
        { type: 'label', text: 'Billing Masters' },
        { label: 'Items', icon: Package, path: '/items' },
        { label: 'Clients', icon: Users, path: '/clients' },
        { label: 'Categories', icon: Tag, path: '/categories' },
        { label: 'Units', icon: Ruler, path: '/units' },
        { type: 'divider' },
        { type: 'label', text: 'Billing Transactions' },
        { label: 'Sales Billing', icon: Receipt, path: '/sales/new', primary: true },
        { label: 'Purchase Entry', icon: ShoppingCart, path: '/purchases/new' },
        { label: 'Import Bills', icon: FileUp, path: '/sales/import' },
        { label: 'Stock Adjustment', icon: Sliders, path: '/stock/adjustment' },
        { label: 'Customer Payments', icon: Wallet, path: '/collections' },
        { label: 'Vouchers & Accounts', icon: BookOpen, path: '/vouchers' },
        { type: 'divider' },
        { type: 'label', text: 'Billing Reports' },
        { label: 'Sales Register', icon: BarChart3, path: '/reports/sales' },
        { label: 'Purchase Register', icon: ShoppingCart, path: '/reports/purchases' },
        { label: 'Stock Report', icon: ClipboardList, path: '/reports/stock' },
        { label: 'GST Summary', icon: Percent, path: '/reports/gst' },
        { label: 'Daily Item Sales', icon: ShoppingBag, path: '/reports/daily-items' },
        { label: 'Trading Reports', icon: BarChart3, path: '/reports/trading' },
        
        { type: 'divider' },
        { type: 'label', text: 'Warehouse Logistics' },
        { label: 'WMS Dashboard', icon: LayoutDashboard, path: '/wms/dashboard' },
        { label: 'WMS Daily Selections', icon: ClipboardList, path: '/wms/daily-selections' },
        { label: 'WMS Price History', icon: BookOpen, path: '/wms/price-history' },
        { label: 'WMS Discrepancies', icon: AlertTriangle, path: '/wms/discrepancies' },
        { label: 'WMS Product Requests', icon: PlusCircle, path: '/wms/product-requests' },
        { label: 'WMS Announcements', icon: Megaphone, path: '/wms/announcements' },
        { label: 'WMS Notifications', icon: Bell, path: '/wms/notifications' },
        { label: 'WMS Audit Logs', icon: FileText, path: '/wms/audit-logs' },

        { type: 'divider' },
        { label: 'Settings', icon: Settings, path: '/settings' },
      ];
    } else if (user.role === 'client') {
      return [
        { label: 'WMS Dashboard', icon: LayoutDashboard, path: '/wms/dashboard' },
        { type: 'divider' },
        { label: 'Make Selection', icon: ShoppingCart, path: '/wms/make-selection', primary: true },
        { label: 'My Orders', icon: ClipboardList, path: '/wms/my-orders' },
        { label: 'Templates', icon: BookOpen, path: '/wms/templates' },
        { label: 'Request Product', icon: PlusCircle, path: '/wms/request-product' },
        { label: 'Notifications', icon: Bell, path: '/wms/notifications' },
      ];
    }
    return [];
  };

  const navItems = getNavItems();

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <div className={`sidebar ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">AT</div>
        <div className="sidebar-logo-text">
          <h1>Arun Traders</h1>
          <span>Billing & Inventory</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        {navItems.map((item, i) => {
          if (item.type === 'divider') return <div key={i} className="sidebar-divider" />;
          if (item.type === 'label') return <div key={i} className="sidebar-section-label">{!sidebarCollapsed && item.text}</div>;

          const Icon = item.icon;
          return (
            <button
              key={item.path}
              className={`sidebar-item ${isActive(item.path) ? 'active' : ''} ${item.primary ? 'primary-action' : ''}`}
              onClick={() => navigate(item.path)}
              onMouseEnter={(e) => sidebarCollapsed && setTooltip({ text: item.label, top: e.currentTarget.getBoundingClientRect().top })}
              onMouseLeave={() => setTooltip(null)}
            >
              <Icon size={20} />
              {!sidebarCollapsed && <span>{item.label}</span>}
            </button>
          );
        })}
      </nav>

      {tooltip && sidebarCollapsed && (
        <div className="sidebar-item-tooltip" style={{ top: tooltip.top + 4 }}>{tooltip.text}</div>
      )}

      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="sidebar-user-avatar">{user?.name?.[0]?.toUpperCase() || 'A'}</div>
          {!sidebarCollapsed && (
            <div className="sidebar-user-info">
              <div className="name">{user?.name || 'User'}</div>
              <div className="role">{user?.role || 'operator'}</div>
            </div>
          )}
        </div>
        <button className={`btn btn-ghost btn-sm sidebar-toggle`} onClick={toggleSidebar}>
          {sidebarCollapsed ? <ChevronRight size={16} /> : <><ChevronLeft size={16} /> Collapse</>}
        </button>
        <button className="btn btn-ghost btn-sm sidebar-toggle" onClick={logout} style={{ marginTop: 4, color: 'var(--accent-red)' }}>
          <LogOut size={16} /> {!sidebarCollapsed && 'Logout'}
        </button>
      </div>
    </div>
  );
}
