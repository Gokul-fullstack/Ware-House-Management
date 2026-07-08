import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Warehouse, LogOut, Menu, X, Bell, Megaphone, ArrowLeft,
  LayoutDashboard, Package, History, Users, ClipboardList,
  AlertTriangle, PlusCircle, FileText, ShoppingCart, ListOrdered,
  Bookmark, PackageSearch
} from 'lucide-react';
import { useAuth, useApi } from '../contexts/AuthContext';
import { StatusBadge, Modal } from '../components/App';
import AdminDashboard from '../components/suriya/AdminDashboard';
import StoreOwnerDashboard from '../components/suriya/StoreOwnerDashboard';
import ViewerCatalogue from '../components/suriya/ViewerCatalogue';

/* ================================================================
   NAV LINK DEFINITIONS
   ================================================================ */
const NAV_LINKS = {
  admin: [
    { page: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { page: 'products', label: 'Products', icon: Package },
    { page: 'price-history', label: 'Price History', icon: History },
    { page: 'users', label: 'Users', icon: Users },
    { page: 'daily-selections', label: 'Daily Selections', icon: ClipboardList },
    { page: 'discrepancies', label: 'Discrepancies', icon: AlertTriangle },
    { page: 'product-requests', label: 'Product Requests', icon: PlusCircle },
    { page: 'announcements', label: 'Announcements', icon: Megaphone },
    { page: 'notifications', label: 'Notifications', icon: Bell },
    { page: 'audit-logs', label: 'Audit Logs', icon: FileText },
  ],
  store_owner: [
    { page: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { page: 'make-selection', label: 'Make Selection', icon: ShoppingCart },
    { page: 'my-orders', label: 'My Orders', icon: ListOrdered },
    { page: 'templates', label: 'Templates', icon: Bookmark },
    { page: 'request-product', label: 'Request Product', icon: PlusCircle },
    { page: 'notifications', label: 'Notifications', icon: Bell },
  ],
  viewer: [
    { page: 'catalogue', label: 'Product Catalogue', icon: PackageSearch },
  ],
};

export default function WMSPortal() {
  const { user: currentUser, logout } = useAuth();
  const fetchApi = useApi();
  const navigate = useNavigate();

  const [currentPage, setCurrentPage] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [announcement, setAnnouncement] = useState(null);

  // Unified WMS API caller that matches the dashboard expectations (prefixes with /api)
  const api = useCallback(async (endpoint, options = {}) => {
    return fetchApi(`/api${endpoint}`, options);
  }, [fetchApi]);

  // Set default page based on role
  useEffect(() => {
    if (currentUser) {
      const role = currentUser.role;
      if (role === 'viewer') {
        setCurrentPage('catalogue');
      } else {
        setCurrentPage('dashboard');
      }
    }
  }, [currentUser?.role]);

  // Fetch notifications & announcements with periodic polling
  useEffect(() => {
    if (!currentUser) return;

    const fetchNotifications = () => {
      api('/notifications').then(setNotifications).catch(() => {});
    };

    const fetchAnnouncements = () => {
      api('/announcements/active').then((data) => {
        if (data && (data.title || data.message)) {
          setAnnouncement(data);
        } else if (Array.isArray(data) && data.length > 0) {
          setAnnouncement(data[0]);
        } else {
          setAnnouncement(null);
        }
      }).catch(() => {});
    };

    fetchNotifications();
    fetchAnnouncements();

    const interval = setInterval(fetchNotifications, 15000);
    return () => clearInterval(interval);
  }, [currentUser, api]);

  if (!currentUser) return null;

  const role = currentUser.role;
  const links = NAV_LINKS[role] || [];
  const currentLabel = links.find((l) => l.page === currentPage)?.label || 'Dashboard';
  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleLogout = () => {
    logout();
  };

  const navigateTo = (page) => {
    setCurrentPage(page);
    setSidebarOpen(false);
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden w-full text-slate-800 font-sans">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/30 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* -------- SIDEBAR -------- */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-[260px] bg-slate-900 flex flex-col transform transition-transform duration-300 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-white/5">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <Warehouse className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-white font-bold text-base tracking-tight">Arun Enterprises</h1>
            <p className="text-gray-400 text-[10px] uppercase tracking-widest">Trading & Logistics</p>
          </div>
          <button className="ml-auto lg:hidden text-gray-400 hover:text-white" onClick={() => setSidebarOpen(false)}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User info */}
        <div className="px-5 py-4 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
              {(currentUser.name || currentUser.username || 'U').charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-white text-sm font-semibold truncate">{currentUser.name || currentUser.username}</p>
              <StatusBadge status={role} />
            </div>
          </div>
          {currentUser.store_name && (
            <p className="text-gray-400 text-xs mt-2 pl-[52px] truncate">{currentUser.store_name}</p>
          )}
        </div>

        {/* Nav links */}
        <nav className="flex-1 py-3 overflow-y-auto">
          {/* Back to Billing link for Admins */}
          {role === 'admin' && (
            <button
              onClick={() => navigate('/')}
              className="sidebar-link w-full flex items-center gap-3 px-5 py-2.5 text-sm transition-all text-indigo-300 hover:text-white hover:bg-white/5 border-b border-white/5 mb-2"
            >
              <ArrowLeft className="w-[18px] h-[18px] flex-shrink-0" />
              <span className="font-semibold">Back to Billing</span>
            </button>
          )}

          {links.map((link) => {
            const Icon = link.icon;
            const active = currentPage === link.page;
            return (
              <button
                key={link.page}
                onClick={() => navigateTo(link.page)}
                className={`sidebar-link w-full flex items-center gap-3 px-5 py-2.5 text-sm transition-all ${
                  active
                    ? 'text-white font-semibold bg-white/10'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon className="w-[18px] h-[18px] flex-shrink-0" />
                <span>{link.label}</span>
                {link.page === 'notifications' && unreadCount > 0 && (
                  <span className="ml-auto bg-red-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="px-5 py-4 border-t border-white/5">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-all text-sm"
          >
            <LogOut className="w-[18px] h-[18px]" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* -------- MAIN CONTENT AREA -------- */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-50">
        {/* Top Header */}
        <header className="bg-white border-b border-slate-100 px-4 sm:px-6 py-3 flex items-center gap-4 flex-shrink-0 shadow-sm">
          <button className="lg:hidden p-1.5 rounded-lg hover:bg-slate-100" onClick={() => setSidebarOpen(true)}>
            <Menu className="w-5 h-5 text-slate-600" />
          </button>
          <h2 className="text-lg font-bold text-slate-800 truncate">{currentLabel}</h2>
          <div className="ml-auto flex items-center gap-3">
            {/* Notification bell */}
            <button
              onClick={() => role === 'store_owner' && navigateTo('notifications')}
              className="relative p-2 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <Bell className="w-5 h-5 text-slate-500" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
            {/* User avatar */}
            <div className="hidden sm:flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-xs">
                {(currentUser.name || 'U').charAt(0).toUpperCase()}
              </div>
              <span className="text-sm font-medium text-slate-700 hidden md:block">{currentUser.name}</span>
            </div>
          </div>
        </header>

        {/* Announcement banner */}
        {announcement && (
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-4 sm:px-6 py-2.5 flex items-center gap-3 flex-shrink-0 shadow-md">
            <Megaphone className="w-4 h-4 flex-shrink-0 animate-bounce" />
            <p className="text-sm font-medium truncate">
              <span className="font-bold">{announcement.title}:</span> {announcement.message}
            </p>
            <button onClick={() => setAnnouncement(null)} className="ml-auto flex-shrink-0 hover:bg-white/20 rounded p-0.5">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 w-full">
          {role === 'admin' && (
            <AdminDashboard currentPage={currentPage} api={api} currentUser={currentUser} />
          )}
          {role === 'store_owner' && (
            <StoreOwnerDashboard currentPage={currentPage} api={api} currentUser={currentUser} navigateTo={navigateTo} />
          )}
          {role === 'viewer' && (
            <ViewerCatalogue api={api} />
          )}
        </main>
      </div>
    </div>
  );
}
