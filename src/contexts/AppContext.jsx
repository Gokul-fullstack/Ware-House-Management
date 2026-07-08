import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useApi, useAuth } from './AuthContext';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [company, setCompany] = useState(null);
  const fetchApi = useApi();
  const { token } = useAuth();

  const [items, setItems] = useState([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [syncState, setSyncState] = useState({ lastMovementId: 0, lastItemUpdate: '' });

  const refreshItems = useCallback(async () => {
    if (!token) return;
    setItemsLoading(true);
    try {
      const res = await fetchApi('/api/items?limit=1000');
      setItems(res.items || []);
    } catch (err) {
      console.error('Failed to fetch items', err);
    } finally {
      setItemsLoading(false);
    }
  }, [token, fetchApi]);

  useEffect(() => {
    if (token) {
      fetchApi('/api/company')
        .then(setCompany)
        .catch(err => console.error('Failed to load company info', err));
    }
  }, [token, fetchApi]);

  // Initial load of items on login or page load
  useEffect(() => {
    if (token) {
      refreshItems();
    } else {
      setItems([]);
      setSyncState({ lastMovementId: 0, lastItemUpdate: '' });
    }
  }, [token, refreshItems]);

  // Polling for updates — with AbortController to cancel stale in-flight requests
  useEffect(() => {
    if (!token) return;
    let abortController = null;

    // First fetch sync status to establish baseline
    fetchApi('/api/sync/status')
      .then(status => {
        setSyncState({
          lastMovementId: status.lastMovementId,
          lastItemUpdate: status.lastItemUpdate
        });
      })
      .catch(err => console.error('Failed to fetch initial sync status', err));

    const interval = setInterval(() => {
      // Cancel the previous request if it's still in-flight
      if (abortController) abortController.abort();
      abortController = new AbortController();

      fetchApi('/api/sync/status')
        .then(status => {
          setSyncState(prev => {
            if (status.lastMovementId > prev.lastMovementId || status.lastItemUpdate !== prev.lastItemUpdate) {
              console.log('[Sync] Stock or catalog update detected. Syncing items...');
              refreshItems();
              return {
                lastMovementId: status.lastMovementId,
                lastItemUpdate: status.lastItemUpdate
              };
            }
            return prev;
          });
        })
        .catch(err => {
          if (err.name !== 'AbortError') {
            console.error('[Sync] Failed to poll sync status', err);
          }
        });
    }, 3000);

    return () => {
      clearInterval(interval);
      if (abortController) abortController.abort();
    };
  }, [token, fetchApi, refreshItems]);

  const toggleSidebar = () => setSidebarCollapsed(p => !p);

  const addToast = useCallback((type, title, message = '') => {
    const id = Date.now() + Math.random();
    setToasts(p => [...p, { id, type, title, message }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 4000);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(p => p.filter(t => t.id !== id));
  }, []);

  const formatCurrency = useCallback((amount) => {
    if (amount == null || isNaN(amount)) return '₹0.00';
    const num = Number(amount);
    const isNeg = num < 0;
    const abs = Math.abs(num).toFixed(2);
    const [intPart, decPart] = abs.split('.');
    // Indian number format: last 3, then groups of 2
    let formatted = '';
    if (intPart.length <= 3) { formatted = intPart; }
    else {
      formatted = intPart.slice(-3);
      let remaining = intPart.slice(0, -3);
      while (remaining.length > 2) {
        formatted = remaining.slice(-2) + ',' + formatted;
        remaining = remaining.slice(0, -2);
      }
      if (remaining) formatted = remaining + ',' + formatted;
    }
    return `${isNeg ? '-' : ''}₹${formatted}.${decPart}`;
  }, []);

  const formatDate = useCallback((dateStr) => {
    if (!dateStr) return '';
    // Split directly to avoid UTC→local timezone shift (e.g. "2026-07-08" becoming July 7 in IST)
    const parts = String(dateStr).split('T')[0].split('-');
    if (parts.length < 3) return dateStr;
    const [yyyy, mm, dd] = parts;
    return `${dd}/${mm}/${yyyy}`;
  }, []);

  const printInvoice = useCallback(async (invoiceId, type = 'a4') => {
    if (window.electronAPI) {
      try {
        const sale = await fetchApi(`/api/sales/${invoiceId}`);
        const result = await window.electronAPI.print(type, { invoice: sale, company: company || {} });
        if (!result.success) {
          addToast('error', 'Print Failed', result.error || 'Failed to print');
        }
      } catch (err) {
        addToast('error', 'Print Error', err.message);
      }
    } else {
      const url = `/api/sales/${invoiceId}/print?type=${type}&x-session-token=${token}`;
      window.open(url, '_blank');
    }
  }, [token, company, fetchApi, addToast]);

  return (
    <AppContext.Provider value={{ sidebarCollapsed, toggleSidebar, toasts, addToast, removeToast, formatCurrency, formatDate, company, setCompany, items, itemsLoading, refreshItems, printInvoice }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
