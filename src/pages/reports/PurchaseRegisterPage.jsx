import React, { useState, useEffect, useMemo } from 'react';
import { Search, Download, RefreshCw, ShoppingCart, DollarSign, TrendingDown } from 'lucide-react';
import { useApi } from '../../contexts/AuthContext';
import { useApp } from '../../contexts/AppContext';

export default function PurchaseRegisterPage() {
  const fetchApi = useApi();
  const { formatCurrency, addToast } = useApp();

  const today = new Date().toISOString().split('T')[0];
  const monthStart = today.substring(0, 7) + '-01';

  const [purchases, setPurchases] = useState([]);
  const [totals, setTotals] = useState({ subtotal: 0, cgst: 0, sgst: 0, igst: 0, grand_total: 0 });
  const [loading, setLoading] = useState(false);
  const [dateFrom, setDateFrom] = useState(monthStart);
  const [dateTo, setDateTo] = useState(today);
  const [searchQuery, setSearchQuery] = useState('');

  const formatDate = (d) => {
    if (!d) return '—';
    const dt = new Date(d + 'T00:00:00');
    return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const fetchPurchases = async () => {
    setLoading(true);
    try {
      let url = '/api/reports/purchase-register';
      const params = [];
      if (dateFrom) params.push(`date_from=${dateFrom}`);
      if (dateTo) params.push(`date_to=${dateTo}`);
      if (params.length) url += `?${params.join('&')}`;
      const res = await fetchApi(url);
      setPurchases(res.purchases || []);
      setTotals(res.totals || { subtotal: 0, cgst: 0, sgst: 0, igst: 0, grand_total: 0 });
    } catch (err) {
      addToast('error', 'Error', 'Failed to fetch purchase register');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPurchases(); }, [dateFrom, dateTo]);

  const filtered = useMemo(() => {
    if (!searchQuery) return purchases;
    const t = searchQuery.toLowerCase();
    return purchases.filter(p =>
      (p.our_ref_number || '').toLowerCase().includes(t) ||
      (p.bill_number || '').toLowerCase().includes(t) ||
      (p.supplier_name || '').toLowerCase().includes(t)
    );
  }, [purchases, searchQuery]);

  const exportCSV = () => {
    const headers = ['Ref Date','Our Ref','Bill No','Supplier','Taxable','CGST','SGST','IGST','Total','Mode'];
    const rows = filtered.map(p => [
      p.ref_date || p.bill_date || '', p.our_ref_number || '', p.bill_number || '',
      p.supplier_name || '',
      (p.subtotal || 0).toFixed(2), (p.cgst_total || 0).toFixed(2),
      (p.sgst_total || 0).toFixed(2), (p.igst_total || 0).toFixed(2),
      (p.grand_total || 0).toFixed(2), p.payment_mode || ''
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `purchase-register-${dateFrom}-${dateTo}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Purchase Register</h1>
          <p className="page-subtitle">{filtered.length} purchases</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary" onClick={fetchPurchases} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} /> Refresh
          </button>
          <button className="btn btn-secondary" onClick={exportCSV} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Download size={14} /> CSV
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card" style={{ padding: '14px 18px', marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>From:</label>
            <input type="date" className="input" style={{ width: 145 }} value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>To:</label>
            <input type="date" className="input" style={{ width: 145 }} value={dateTo} onChange={e => setDateTo(e.target.value)} />
          </div>
          <div className="search-bar" style={{ flex: 1, maxWidth: 280 }}>
            <Search size={15} />
            <input type="text" className="input" placeholder="Search bill, supplier..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 20 }}>
        <div className="card" style={{ padding: '14px 18px', borderLeft: '3px solid #6366f1' }}>
          <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Taxable Amount</p>
          <p style={{ fontSize: '1.25rem', fontWeight: 700 }}>{formatCurrency(totals.subtotal)}</p>
        </div>
        <div className="card" style={{ padding: '14px 18px', borderLeft: '3px solid #3b82f6' }}>
          <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Total GST</p>
          <p style={{ fontSize: '1.25rem', fontWeight: 700 }}>{formatCurrency(totals.cgst + totals.sgst + totals.igst)}</p>
        </div>
        <div className="card" style={{ padding: '14px 18px', borderLeft: '3px solid #10b981' }}>
          <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Grand Total</p>
          <p style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--accent-green)' }}>{formatCurrency(totals.grand_total)}</p>
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 20 }}>
        <h3 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: 14 }}>Purchase Ledger <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: '0.8rem' }}>({filtered.length} entries)</span></h3>
        {loading ? (
          <div className="loading-page"><div className="loading-spinner" /></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state" style={{ padding: '40px 20px' }}>
            <ShoppingCart style={{ width: 40, height: 40 }} />
            <h3>No purchases found</h3>
            <p>Try changing the date range or search term</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Our Ref</th>
                  <th>Bill No</th>
                  <th>Supplier</th>
                  <th className="text-right">Taxable</th>
                  <th className="text-right">CGST</th>
                  <th className="text-right">SGST</th>
                  <th className="text-right">IGST</th>
                  <th className="text-right">Grand Total</th>
                  <th className="text-center">Mode</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => (
                  <tr key={p.id}>
                    <td>
                      <div style={{ fontWeight: 500 }}>{formatDate(p.ref_date || p.bill_date)}</div>
                      {p.bill_date && p.bill_date !== p.ref_date && <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Bill: {formatDate(p.bill_date)}</div>}
                    </td>
                    <td style={{ fontWeight: 600 }}>{p.our_ref_number || '—'}</td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>{p.bill_number || '—'}</td>
                    <td>{p.supplier_name || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Cash Purchase</span>}</td>
                    <td className="text-right text-mono">{formatCurrency(p.subtotal)}</td>
                    <td className="text-right text-mono" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{formatCurrency(p.cgst_total)}</td>
                    <td className="text-right text-mono" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{formatCurrency(p.sgst_total)}</td>
                    <td className="text-right text-mono" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{formatCurrency(p.igst_total)}</td>
                    <td className="text-right text-mono" style={{ fontWeight: 600 }}>{formatCurrency(p.grand_total)}</td>
                    <td className="text-center">
                      <span className={`badge ${p.payment_mode === 'cash' ? 'badge-success' : p.payment_mode === 'credit' ? 'badge-danger' : 'badge-warning'}`}>
                        {(p.payment_mode || 'credit').toUpperCase()}
                      </span>
                    </td>
                  </tr>
                ))}
                <tr style={{ fontWeight: 700, background: 'rgba(99,102,241,0.05)', borderTop: '2px solid var(--border-primary)' }}>
                  <td colSpan={4} style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase' }}>Total ({filtered.length})</td>
                  <td className="text-right text-mono">{formatCurrency(totals.subtotal)}</td>
                  <td className="text-right text-mono" style={{ fontSize: '0.8rem' }}>{formatCurrency(totals.cgst)}</td>
                  <td className="text-right text-mono" style={{ fontSize: '0.8rem' }}>{formatCurrency(totals.sgst)}</td>
                  <td className="text-right text-mono" style={{ fontSize: '0.8rem' }}>{formatCurrency(totals.igst)}</td>
                  <td className="text-right text-mono" style={{ color: 'var(--accent-green)', fontSize: '1rem' }}>{formatCurrency(totals.grand_total)}</td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
