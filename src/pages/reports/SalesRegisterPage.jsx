import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Download, Printer, RefreshCw, BarChart2, DollarSign, Tag, Percent, Edit, X } from 'lucide-react';
import { useApi } from '../../contexts/AuthContext';
import { useApp } from '../../contexts/AppContext';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

export default function SalesRegisterPage() {
  const fetchApi = useApi();
  const navigate = useNavigate();
  const { formatCurrency, formatDate, addToast, printInvoice } = useApp();

  const [sales, setSales] = useState([]);
  const [totals, setTotals] = useState({ subtotal: 0, cgst: 0, sgst: 0, igst: 0, grand_total: 0 });
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const todayStr = new Date().toISOString().split('T')[0];
  const firstDayOfMonthStr = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

  const [dateFrom, setDateFrom] = useState(firstDayOfMonthStr);
  const [dateTo, setDateTo] = useState(todayStr);

  const fetchSales = async () => {
    setLoading(true);
    try {
      let url = '/api/reports/sales-register';
      const params = [];
      if (dateFrom) params.push(`date_from=${dateFrom}`);
      if (dateTo) params.push(`date_to=${dateTo}`);
      if (params.length) url += `?${params.join('&')}`;
      const res = await fetchApi(url);
      setSales(res.sales || []);
      setTotals(res.totals || { subtotal: 0, cgst: 0, sgst: 0, igst: 0, grand_total: 0 });
    } catch (err) {
      addToast('error', 'Error', 'Failed to fetch sales register');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelInvoice = async (sale) => {
    if (sale.status === 'cancelled') { addToast('warning', 'Already Cancelled', 'This invoice is already cancelled.'); return; }
    if (!window.confirm(`Cancel invoice ${sale.invoice_number}? This will restore stock and cannot be undone.`)) return;
    try {
      await fetchApi(`/api/sales/${sale.id}`, { method: 'DELETE' });
      addToast('success', 'Invoice Cancelled', `${sale.invoice_number} cancelled and stock restored.`);
      fetchSales();
    } catch (e) {
      addToast('error', 'Cancel Failed', e.message);
    }
  };

  useEffect(() => { fetchSales(); }, [dateFrom, dateTo]);

  const filteredSales = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return sales.filter(s =>
      s.invoice_number.toLowerCase().includes(q) ||
      (s.client_name || '').toLowerCase().includes(q) ||
      (s.payment_mode || '').toLowerCase().includes(q)
    );
  }, [sales, searchQuery]);

  const activeTotals = useMemo(() => {
    if (!searchQuery) return totals;
    const t = { subtotal: 0, cgst: 0, sgst: 0, igst: 0, grand_total: 0, discount: 0 };
    filteredSales.forEach(s => {
      t.subtotal += s.subtotal || 0;
      t.cgst += s.cgst_total || 0;
      t.sgst += s.sgst_total || 0;
      t.igst += s.igst_total || 0;
      t.grand_total += s.grand_total || 0;
      t.discount += s.discount_amount || 0;
    });
    return t;
  }, [filteredSales, searchQuery, totals]);

  const chartData = useMemo(() => {
    const daily = {};
    sales.forEach(s => { daily[s.invoice_date] = (daily[s.invoice_date] || 0) + (s.grand_total || 0); });
    return Object.keys(daily).sort().map(date => ({
      date: formatDate(date).substring(0, 5),
      'Sales (₹)': Number(daily[date].toFixed(2)),
    }));
  }, [sales, formatDate]);

  const paymentModeData = useMemo(() => {
    const counts = {};
    sales.forEach(s => {
      const mode = (s.payment_mode || 'Cash').toUpperCase();
      counts[mode] = (counts[mode] || 0) + (s.grand_total || 0);
    });
    return Object.keys(counts).map(mode => ({ name: mode, value: Number(counts[mode].toFixed(2)) }));
  }, [sales]);

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'];

  const handleExportCSV = () => {
    if (!filteredSales.length) { addToast('warning', 'No Data', 'Nothing to export'); return; }
    const headers = ['Invoice No', 'Date', 'Customer', 'Taxable', 'Discount', 'CGST', 'SGST', 'IGST', 'Grand Total', 'Mode'];
    const rows = filteredSales.map(s => [
      `"${s.invoice_number}"`, `"${s.invoice_date}"`, `"${s.client_name || 'Cash Customer'}"`,
      s.subtotal.toFixed(2), s.discount_amount.toFixed(2), s.cgst_total.toFixed(2),
      s.sgst_total.toFixed(2), s.igst_total.toFixed(2), s.grand_total.toFixed(2),
      `"${s.payment_mode.toUpperCase()}"`,
    ]);
    rows.push(['"TOTAL"','""','""',
      activeTotals.subtotal.toFixed(2), (activeTotals.discount||0).toFixed(2),
      activeTotals.cgst.toFixed(2), activeTotals.sgst.toFixed(2), activeTotals.igst.toFixed(2),
      activeTotals.grand_total.toFixed(2),'""',
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const link = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' })),
      download: `Sales_Register_${dateFrom}_to_${dateTo}.csv`,
    });
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
    addToast('success', 'Exported', 'Sales register exported to CSV');
  };

  const setPreset = (days) => {
    if (days === 0) { setDateFrom(todayStr); setDateTo(todayStr); return; }
    if (days === -1) {
      const y = new Date(); y.setDate(y.getDate() - 1);
      const s = y.toISOString().split('T')[0]; setDateFrom(s); setDateTo(s); return;
    }
    if (days === 'month') { setDateFrom(firstDayOfMonthStr); setDateTo(todayStr); return; }
    const d = new Date(); d.setDate(d.getDate() - days);
    setDateFrom(d.toISOString().split('T')[0]); setDateTo(todayStr);
  };

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Sales Register</h1>
          <p className="page-subtitle">Track and analyze store sales performance</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary" onClick={fetchSales} disabled={loading}>
            <RefreshCw size={15} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} /> Reload
          </button>
          <button className="btn btn-primary" onClick={handleExportCSV}>
            <Download size={15} /> Export CSV
          </button>
        </div>
      </div>

      {/* Date Filter Bar */}
      <div className="card" style={{ padding: '12px 16px', marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>From:</span>
            <input type="date" className="input input-sm" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ width: 155 }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>To:</span>
            <input type="date" className="input input-sm" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ width: 155 }} />
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setPreset(0)}>Today</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setPreset(-1)}>Yesterday</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setPreset('month')}>This Month</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setPreset(30)}>Last 30 Days</button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid-4" style={{ marginBottom: 20, gap: 14 }}>
        {[
          { label: 'Total Sales (Gross)', val: activeTotals.grand_total, sub: 'Inclusive of GST', color: '#3b82f6', Icon: BarChart2 },
          { label: 'Taxable Amount', val: activeTotals.subtotal, sub: 'Excluding GST', color: '#10b981', Icon: DollarSign },
          { label: 'GST Collected', val: activeTotals.cgst + activeTotals.sgst + activeTotals.igst, sub: 'CGST + SGST + IGST', color: '#f59e0b', Icon: Percent },
          { label: 'Total Discounts', val: activeTotals.discount || 0, sub: 'Allowed in Bills', color: '#ec4899', Icon: Tag },
        ].map(({ label, val, sub, color, Icon }) => (
          <div key={label} className="card" style={{ padding: 20, borderLeft: `4px solid ${color}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{label}</span>
              <Icon size={18} style={{ color }} />
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', lineHeight: 1.2 }}>{formatCurrency(val)}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 5 }}>{sub}</div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid-3" style={{ marginBottom: 20, gap: 14 }}>
        <div className="card" style={{ padding: 20, gridColumn: 'span 2' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: 14 }}>Sales Trend Over Time</h3>
          <div style={{ height: 220 }}>
            {chartData.length === 0
              ? <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>No data for this range</div>
              : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.01} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={11} tickLine={false} />
                    <YAxis stroke="var(--text-muted)" fontSize={11} tickLine={false} />
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: 8 }} labelStyle={{ color: '#fff', fontWeight: 'bold' }} itemStyle={{ color: '#3b82f6' }} />
                    <Area type="monotone" dataKey="Sales (₹)" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorSales)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
          </div>
        </div>

        <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: 14 }}>Payment Modes</h3>
          {paymentModeData.length === 0
            ? <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>No data</div>
            : (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: '100%', height: 160 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={paymentModeData} cx="50%" cy="50%" innerRadius={42} outerRadius={62} paddingAngle={4} dataKey="value">
                        {paymentModeData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v) => [`₹${v.toLocaleString('en-IN')}`, 'Amount']} contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: 8 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 12px', justifyContent: 'center', marginTop: 10 }}>
                  {paymentModeData.map((item, i) => (
                    <div key={item.name} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.72rem' }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: COLORS[i % COLORS.length] }} />
                      <span style={{ color: 'var(--text-secondary)' }}>{item.name} ({activeTotals.grand_total ? Math.round(item.value / activeTotals.grand_total * 100) : 0}%)</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
        </div>
      </div>

      {/* Sales Table */}
      <div className="card" style={{ padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 600 }}>Sales Ledger <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: '0.8rem' }}>({filteredSales.length} invoices)</span></h3>
          <div className="search-bar" style={{ maxWidth: 280, flex: 1 }}>
            <Search />
            <input type="text" className="input" placeholder="Search invoice, customer..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
          </div>
        </div>

        {loading ? (
          <div className="loading-page"><div className="loading-spinner" /></div>
        ) : filteredSales.length === 0 ? (
          <div className="empty-state" style={{ padding: '40px 20px' }}>
            <Search style={{ width: 40, height: 40 }} />
            <h3>No invoices found</h3>
            <p>Try changing the date range or search term</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Bill No</th>
                  <th>Date</th>
                  <th>Customer</th>
                  <th className="text-right">Taxable</th>
                  <th className="text-right">Total GST</th>
                  <th className="text-right">Round Off</th>
                  <th className="text-right">Grand Total</th>
                  <th className="text-center">Mode</th>
                  <th className="text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredSales.map(s => (
                  <tr key={s.id} style={s.status === 'cancelled' ? { opacity: 0.5, textDecoration: 'line-through' } : {}}>
                    <td style={{ fontWeight: 600 }}>{s.invoice_number}</td>
                    <td>{formatDate(s.invoice_date)}</td>
                    <td>{s.client_name || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Cash Customer</span>}</td>
                    <td className="text-right text-mono">{formatCurrency(s.subtotal)}</td>
                    <td className="text-right text-mono">{formatCurrency(s.cgst_total + s.sgst_total + s.igst_total)}</td>
                    <td className="text-right text-mono" style={{ color: s.round_off < 0 ? 'var(--accent-red)' : 'var(--accent-green)' }}>{s.round_off.toFixed(2)}</td>
                    <td className="text-right text-mono" style={{ fontWeight: 600 }}>{formatCurrency(s.grand_total)}</td>
                    <td className="text-center">
                      {s.status === 'cancelled' ? (
                        <span className="badge badge-danger">CANCELLED</span>
                      ) : (
                        <span className={`badge ${s.payment_mode === 'cash' ? 'badge-success' : s.payment_mode === 'credit' ? 'badge-danger' : 'badge-warning'}`}>
                          {(s.payment_mode || 'cash').toUpperCase()}
                        </span>
                      )}
                    </td>
                    <td className="text-center">
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                        {s.status !== 'cancelled' && (
                          <>
                            <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/sales-edit/${s.id}`)} style={{ padding: '4px 8px', fontSize: '0.75rem', color: 'var(--accent-blue)' }}>
                              <Edit size={12} /> Edit
                            </button>
                            <button className="btn btn-ghost btn-sm" onClick={() => printInvoice(s.id, 'a4')} style={{ padding: '4px 8px', fontSize: '0.75rem' }}>
                              <Printer size={12} /> A4
                            </button>
                            <button className="btn btn-ghost btn-sm" onClick={() => printInvoice(s.id, 'a5')} style={{ padding: '4px 8px', fontSize: '0.75rem' }}>
                              <Printer size={12} /> A5
                            </button>
                            <button className="btn btn-ghost btn-sm" onClick={() => printInvoice(s.id, 'thermal')} style={{ padding: '4px 8px', fontSize: '0.75rem' }}>
                              <Printer size={12} /> Receipt
                            </button>
                            <button className="btn btn-ghost btn-sm" onClick={() => handleCancelInvoice(s)} style={{ padding: '4px 8px', fontSize: '0.75rem', color: 'var(--accent-red, #ef4444)' }} title="Cancel Invoice">
                              <X size={12} /> Cancel
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                <tr style={{ fontWeight: 700, background: 'rgba(59,130,246,0.06)', borderTop: '2px solid var(--border-primary)' }}>
                  <td colSpan={3} style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total ({filteredSales.length} bills)</td>
                  <td className="text-right text-mono">{formatCurrency(activeTotals.subtotal)}</td>
                  <td className="text-right text-mono">{formatCurrency(activeTotals.cgst + activeTotals.sgst + activeTotals.igst)}</td>
                  <td />
                  <td className="text-right text-mono" style={{ color: 'var(--accent-green)', fontSize: '1rem' }}>{formatCurrency(activeTotals.grand_total)}</td>
                  <td colSpan={2} />
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
