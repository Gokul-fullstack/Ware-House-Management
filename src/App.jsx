import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth, useApi } from './contexts/AuthContext';
import { AppProvider } from './contexts/AppContext';
import { ToastContainer } from './components/ui/Toast';
import MainLayout from './components/layout/MainLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ItemsPage from './pages/masters/ItemsPage';
import ClientsPage from './pages/masters/ClientsPage';
import CategoriesPage from './pages/masters/CategoriesPage';
import UnitsPage from './pages/masters/UnitsPage';
import SalesBillingPage from './pages/transactions/SalesBillingPage';
import PurchaseEntryPage from './pages/transactions/PurchaseEntryPage';
import CompanySettings from './pages/settings/CompanySettings';
import CSVImportPage from './pages/transactions/CSVImportPage';
import SalesRegisterPage from './pages/reports/SalesRegisterPage';
import PurchaseRegisterPage from './pages/reports/PurchaseRegisterPage';
import StockReportPage from './pages/reports/StockReportPage';
import GSTSummaryPage from './pages/reports/GSTSummaryPage';
import DailyItemSalesReportPage from './pages/reports/DailyItemSalesReportPage';
import TradingReportsPage from './pages/reports/TradingReportsPage';
import StockAdjustmentPage from './pages/transactions/StockAdjustmentPage';
import VouchersPage from './pages/transactions/VouchersPage';
import AdminDashboard from './components/suriya/AdminDashboard';
import StoreOwnerDashboard from './components/suriya/StoreOwnerDashboard';
import CollectionsPage from './pages/transactions/CollectionsPage';


function AppRoutes() {
  const { isAuthenticated, loading, user } = useAuth();
  const fetchApi = useApi();

  const wmsApi = React.useCallback(async (endpoint, options = {}) => {
    return fetchApi(`/api${endpoint}`, options);
  }, [fetchApi]);

  if (loading) {
    return (
      <div className="flex-center" style={{ minHeight: '100vh' }}>
        <div className="loading-spinner" />
      </div>
    );
  }

  if (!isAuthenticated) return <Login />;

  return (
    <Routes>
      <Route element={<MainLayout />}>
        {/* Redirect based on role */}
        <Route path="/" element={
          user?.role === 'client' ? <Navigate to="/wms/dashboard" replace /> :
          <Dashboard />
        } />

        {/* Admin and original operator/manager roles can access the billing system */}
        {user?.role === 'admin' && (
          <>
            <Route path="/items" element={<ItemsPage />} />
            <Route path="/clients" element={<ClientsPage />} />
            <Route path="/categories" element={<CategoriesPage />} />
            <Route path="/units" element={<UnitsPage />} />
            <Route path="/sales" element={<SalesBillingPage />} />
            <Route path="/sales/new" element={<SalesBillingPage />} />
            <Route path="/sales-edit/:id" element={<SalesBillingPage />} />
            <Route path="/sales/import" element={<CSVImportPage />} />
            <Route path="/purchases" element={<PurchaseEntryPage />} />
            <Route path="/purchases/new" element={<PurchaseEntryPage />} />
            <Route path="/stock/adjustment" element={<StockAdjustmentPage />} />
            <Route path="/vouchers" element={<VouchersPage />} />
            <Route path="/collections" element={<CollectionsPage />} />
            <Route path="/reports/sales" element={<SalesRegisterPage />} />
            <Route path="/reports/purchases" element={<PurchaseRegisterPage />} />
            <Route path="/reports/stock" element={<StockReportPage />} />
            <Route path="/reports/gst" element={<GSTSummaryPage />} />
            <Route path="/reports/daily-items" element={<DailyItemSalesReportPage />} />
            <Route path="/reports/trading" element={<TradingReportsPage />} />
            <Route path="/settings" element={<CompanySettings />} />

            {/* WMS Admin Routes */}
            <Route path="/wms/dashboard" element={<AdminDashboard currentPage="dashboard" api={wmsApi} currentUser={user} />} />
            <Route path="/wms/price-history" element={<AdminDashboard currentPage="price-history" api={wmsApi} currentUser={user} />} />
            <Route path="/wms/daily-selections" element={<AdminDashboard currentPage="daily-selections" api={wmsApi} currentUser={user} />} />
            <Route path="/wms/discrepancies" element={<AdminDashboard currentPage="discrepancies" api={wmsApi} currentUser={user} />} />
            <Route path="/wms/product-requests" element={<AdminDashboard currentPage="product-requests" api={wmsApi} currentUser={user} />} />
            <Route path="/wms/announcements" element={<AdminDashboard currentPage="announcements" api={wmsApi} currentUser={user} />} />
            <Route path="/wms/notifications" element={<AdminDashboard currentPage="notifications" api={wmsApi} currentUser={user} />} />
            <Route path="/wms/audit-logs" element={<AdminDashboard currentPage="audit-logs" api={wmsApi} currentUser={user} />} />
          </>
        )}

        {/* Client WMS Routes */}
        {user?.role === 'client' && (
          <>
            <Route path="/wms/dashboard" element={<StoreOwnerDashboard currentPage="dashboard" api={wmsApi} currentUser={user} />} />
            <Route path="/wms/make-selection" element={<StoreOwnerDashboard currentPage="make-selection" api={wmsApi} currentUser={user} />} />
            <Route path="/wms/my-orders" element={<StoreOwnerDashboard currentPage="my-orders" api={wmsApi} currentUser={user} />} />
            <Route path="/wms/templates" element={<StoreOwnerDashboard currentPage="templates" api={wmsApi} currentUser={user} />} />
            <Route path="/wms/request-product" element={<StoreOwnerDashboard currentPage="request-product" api={wmsApi} currentUser={user} />} />
            <Route path="/wms/notifications" element={<StoreOwnerDashboard currentPage="notifications" api={wmsApi} currentUser={user} />} />
          </>
        )}


      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <HashRouter>
      <AuthProvider>
        <AppProvider>
          <AppRoutes />
          <ToastContainer />
        </AppProvider>
      </AuthProvider>
    </HashRouter>
  );
}
