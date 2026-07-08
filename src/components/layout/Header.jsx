import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Clock, HelpCircle, Keyboard, X } from 'lucide-react';

const pageTitles = {
  '/': 'Dashboard',
  '/items': 'Items & Inventory',
  '/clients': 'Customers & Suppliers',
  '/categories': 'Categories',
  '/units': 'Units of Measure',
  '/sales': 'Sales Billing',
  '/sales/new': 'New Sale',
  '/sales/import': 'Import Bills from CSV',
  '/purchases': 'Purchase Entry',
  '/purchases/new': 'New Purchase',
  '/stock/adjustment': 'Stock Adjustments',
  '/vouchers': 'Vouchers & Accounts',
  '/reports/sales': 'Sales Register',
  '/reports/stock': 'Stock Report & Valuation',
  '/reports/purchases': 'Purchase Register',
  '/reports/gst': 'GST Tax Summary',
  '/settings': 'Company Settings',
  '/wms/dashboard': 'WMS Dashboard',
  '/wms/products': 'WMS Products',
  '/wms/price-history': 'WMS Price History',
  '/wms/users': 'WMS Users',
  '/wms/daily-selections': 'WMS Daily Selections',
  '/wms/discrepancies': 'WMS Discrepancies',
  '/wms/product-requests': 'WMS Product Requests',
  '/wms/announcements': 'WMS Announcements',
  '/wms/notifications': 'WMS Notifications',
  '/wms/audit-logs': 'WMS Audit Logs',
  '/wms/make-selection': 'WMS Make Selection',
  '/wms/my-orders': 'WMS My Orders',
  '/wms/templates': 'WMS Recurring Templates',
  '/wms/request-product': 'WMS Request Product',
  '/wms/catalogue': 'WMS Product Catalogue',
};

export default function Header() {
  const location = useLocation();
  const [time, setTime] = useState(new Date());
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Global F1 key handler to show help
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'F1') {
        e.preventDefault();
        setShowHelp(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const title = pageTitles[location.pathname] || 'Arun Traders';
  const dd = String(time.getDate()).padStart(2, '0');
  const mm = String(time.getMonth() + 1).padStart(2, '0');
  const yyyy = time.getFullYear();
  const hh = String(time.getHours()).padStart(2, '0');
  const min = String(time.getMinutes()).padStart(2, '0');
  const ss = String(time.getSeconds()).padStart(2, '0');

  return (
    <header className="header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', height: 64, borderBottom: '1px solid var(--border-primary)', backgroundColor: 'var(--bg-header)' }}>
      <div className="header-left">
        <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{title}</h2>
      </div>
      
      <div className="header-right" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        {/* Keyboard Helper Button */}
        <button 
          onClick={() => setShowHelp(true)} 
          style={{ 
            background: 'none', 
            color: 'var(--text-secondary)', 
            cursor: 'pointer', 
            display: 'flex', 
            alignItems: 'center', 
            gap: 6,
            fontSize: 12,
            padding: '6px 10px',
            borderRadius: 6,
            transition: 'all 0.2s',
            border: '1px solid transparent'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'var(--text-primary)';
            e.currentTarget.style.borderColor = 'var(--border-primary)';
            e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--text-secondary)';
            e.currentTarget.style.borderColor = 'transparent';
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          <Keyboard size={16} />
          <span>F1 Help</span>
        </button>

        <div className="header-time" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-secondary)' }}>
          <Clock size={14} />
          <span>{dd}/{mm}/{yyyy} {hh}:{min}:{ss}</span>
        </div>
      </div>

      {/* Floating Keyboard Shortcut Overlay Modal */}
      {showHelp && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 9999
        }}>
          <div style={{
            backgroundColor: '#0f172a',
            border: '1px solid #334155',
            borderRadius: 12,
            width: 480,
            maxWidth: '90%',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
            display: 'flex',
            flexDirection: 'column'
          }}>
            {/* Header */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '16px 20px',
              borderBottom: '1px solid #1e293b'
            }}>
              <h3 style={{ margin: 0, fontSize: 16, display: 'flex', alignItems: 'center', gap: 8, color: '#fff' }}>
                <Keyboard size={20} style={{ color: 'var(--color-primary)' }} /> Keyboard Shortcuts
              </h3>
              <button 
                onClick={() => setShowHelp(false)}
                style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', padding: 4 }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Sales Billing Shortcuts */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                  Sales Counter Billing
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ color: 'var(--color-text-muted)' }}>Save and Print (A4 Format)</span>
                    <kbd style={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: 4, padding: '2px 6px', fontFamily: 'monospace', fontSize: 12 }}>F4</kbd>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ color: 'var(--color-text-muted)' }}>Save and Print (Thermal Format)</span>
                    <kbd style={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: 4, padding: '2px 6px', fontFamily: 'monospace', fontSize: 12 }}>F5</kbd>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ color: 'var(--color-text-muted)' }}>Save Invoice (Without Printing)</span>
                    <kbd style={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: 4, padding: '2px 6px', fontFamily: 'monospace', fontSize: 12 }}>F9</kbd>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ color: 'var(--color-text-muted)' }}>Open Serial Numbers Modal</span>
                    <kbd style={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: 4, padding: '2px 6px', fontFamily: 'monospace', fontSize: 12 }}>F12</kbd>
                  </div>
                </div>
              </div>

              {/* General Shortcuts */}
              <div style={{ borderTop: '1px solid #1e293b', paddingTop: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                  General / Global
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ color: 'var(--color-text-muted)' }}>Toggle Help Overlay (This Screen)</span>
                    <kbd style={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: 4, padding: '2px 6px', fontFamily: 'monospace', fontSize: 12 }}>F1</kbd>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ color: 'var(--color-text-muted)' }}>Cancel / Clear Row / Close Modals</span>
                    <kbd style={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: 4, padding: '2px 6px', fontFamily: 'monospace', fontSize: 12 }}>Esc</kbd>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div style={{
              padding: '12px 20px',
              borderTop: '1px solid #1e293b',
              backgroundColor: '#0a0f1d',
              borderBottomLeftRadius: 12,
              borderBottomRightRadius: 12,
              textAlign: 'center',
              fontSize: 12,
              color: 'var(--color-text-muted)'
            }}>
              Press <kbd style={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: 3, padding: '1px 4px', fontFamily: 'monospace' }}>Esc</kbd> or click the Close button to dismiss.
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
