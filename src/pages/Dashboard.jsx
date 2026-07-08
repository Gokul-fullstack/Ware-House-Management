import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  IndianRupee, TrendingUp, TrendingDown, Package, AlertTriangle,
  Receipt, ShoppingCart, Plus, Users, Printer, ArrowUpRight,
  ArrowDownRight, BarChart2, RefreshCw, Box, Minus
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Area, AreaChart, Cell
} from 'recharts';
import { useApi } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';

export default function Dashboard() {
  const fetchApi = useApi();
  const { formatCurrency, formatDate, company, addToast, printInvoice } = useApp();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true); else setRefreshing(true);
    try {
      const d = await fetchApi('/api/dashboard');
      setData(d);
    } catch (e) {
      addToast('error', 'Dashboard Error', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [fetchApi, addToast]);

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <div className="loading-page">
      <div className="loading-spinner" />
    </div>
  );

  const todayVsYesterday = data?.yesterdaySales > 0
    ? ((data.todaySales - data.yesterdaySales) / data.yesterdaySales * 100).toFixed(1)
    : null;
  const isUp = todayVsYesterday !== null && Number(todayVsYesterday) >= 0;

  const PAYMENT_COLORS = { cash: '#10b981', credit: '#ef4444', upi: '#3b82f6', card: '#8b5cf6', cheque: '#f59e0b' };

  // Today's date formatted
  const now = new Date();
  const todayStr = now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div style={{ animation: 'fadeIn 0.3s ease' }}>
      {/* Page Header */}
      <div className="page-header" style={{ marginBottom: 28 }}>
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle" style={{ color: 'var(--text-muted)', marginTop: 2 }}>{todayStr}</p>
        </div>
        <button
          className="btn btn-secondary"
          onClick={() => load(true)}
          disabled={refreshing}
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <RefreshCw size={14} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
          Refresh
        </button>
      </div>

      {/* KPI Stats Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        {/* Today's Sales */}
        <div className="card" style={{ padding: '20px 22px', borderLeft: '4px solid #6366f1', position: 'relative', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Today's Sales</p>
              <p style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1 }}>{formatCurrency(data?.todaySales || 0)}</p>
              <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 6 }}>{data?.todayCount || 0} invoices today</p>
            </div>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(99,102,241,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Receipt size={20} style={{ color: '#6366f1' }} />
            </div>
          </div>
          {todayVsYesterday !== null && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 12, fontSize: '0.75rem' }}>
              {isUp ? <ArrowUpRight size={13} color="#10b981" /> : <ArrowDownRight size={13} color="#ef4444" />}
              <span style={{ color: isUp ? '#10b981' : '#ef4444', fontWeight: 600 }}>{Math.abs(Number(todayVsYesterday))}%</span>
              <span style={{ color: 'var(--text-muted)' }}>vs yesterday</span>
            </div>
          )}
        </div>

        {/* Month Sales */}
        <div className="card" style={{ padding: '20px 22px', borderLeft: '4px solid #10b981', position: 'relative', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Month Sales</p>
              <p style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1 }}>{formatCurrency(data?.monthSales || 0)}</p>
              <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 6 }}>Purchases: {formatCurrency(data?.monthPurchases || 0)}</p>
            </div>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(16,185,129,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <TrendingUp size={20} style={{ color: '#10b981' }} />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 12, fontSize: '0.75rem' }}>
            <IndianRupee size={11} style={{ color: 'var(--text-muted)' }} />
            <span style={{ color: 'var(--text-muted)' }}>Net: {formatCurrency((data?.monthSales || 0) - (data?.monthPurchases || 0))}</span>
          </div>
        </div>

        {/* Stock Alerts */}
        <div className="card" style={{ padding: '20px 22px', borderLeft: '4px solid #f59e0b', cursor: 'pointer' }} onClick={() => navigate('/reports/stock')}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Stock Alerts</p>
              <p style={{ fontSize: '1.6rem', fontWeight: 700, color: (data?.lowStockCount || 0) > 0 ? '#f59e0b' : 'var(--text-primary)', lineHeight: 1 }}>{data?.lowStockCount || 0}</p>
              <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 6 }}>Out of stock: {data?.outOfStockCount || 0}</p>
            </div>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(245,158,11,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <AlertTriangle size={20} style={{ color: '#f59e0b' }} />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 12, fontSize: '0.75rem' }}>
            <span style={{ color: 'var(--accent-blue)' }}>Click to view stock report →</span>
          </div>
        </div>

        {/* Pending Receivables */}
        <div className="card" style={{ padding: '20px 22px', borderLeft: '4px solid #ef4444' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Pending Receivables</p>
              <p style={{ fontSize: '1.6rem', fontWeight: 700, color: (data?.pendingReceivables || 0) > 0 ? '#ef4444' : 'var(--text-primary)', lineHeight: 1 }}>{formatCurrency(data?.pendingReceivables || 0)}</p>
              <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 6 }}>Outstanding credit dues</p>
            </div>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(239,68,68,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <IndianRupee size={20} style={{ color: '#ef4444' }} />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 12, fontSize: '0.75rem' }}>
            <span style={{ color: 'var(--text-muted)' }}>From credit invoices</span>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20, marginBottom: 20 }}>
        {/* 7-Day Sales Bar Chart */}
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 600 }}>7-Day Sales Trend</h3>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', background: 'var(--bg-secondary)', padding: '3px 8px', borderRadius: 4 }}>Last 7 days</span>
          </div>
          {data?.chartData?.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={data.chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-primary)" />
                <XAxis dataKey="date" fontSize={11} tickLine={false} axisLine={false} stroke="var(--text-muted)" />
                <YAxis fontSize={10} tickLine={false} axisLine={false} stroke="var(--text-muted)" tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
                <Tooltip
                  contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-primary)', borderRadius: 8, fontSize: 12 }}
                  formatter={(v) => [formatCurrency(v), 'Sales']}
                  labelFormatter={(l, payload) => payload?.[0]?.payload?.fullDate || l}
                />
                <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                  {data.chartData.map((entry, i) => (
                    <Cell key={i} fill={entry.fullDate === new Date().toISOString().split('T')[0] ? '#6366f1' : '#818cf8'} opacity={0.85} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>No sales data yet</div>
          )}
        </div>

        {/* Today's Payment Breakdown */}
        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: 16 }}>Today's Collection</h3>
          {data?.paymentBreakdown?.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {data.paymentBreakdown.map(p => {
                const pct = data.todaySales > 0 ? Math.round(p.total / data.todaySales * 100) : 0;
                const color = PAYMENT_COLORS[p.payment_mode] || '#94a3b8';
                return (
                  <div key={p.payment_mode}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: 4 }}>
                      <span style={{ fontWeight: 500, textTransform: 'capitalize' }}>{p.payment_mode}</span>
                      <span style={{ color: 'var(--text-muted)' }}>{formatCurrency(p.total)} ({pct}%)</span>
                    </div>
                    <div style={{ height: 6, background: 'var(--bg-secondary)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 3, transition: 'width 0.5s ease' }} />
                    </div>
                  </div>
                );
              })}
              <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border-primary)', fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
                <span>Total Today</span>
                <strong style={{ color: 'var(--text-primary)' }}>{formatCurrency(data.todaySales)}</strong>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 140, color: 'var(--text-muted)', fontSize: '0.82rem', gap: 8 }}>
              <BarChart2 size={28} style={{ opacity: 0.3 }} />
              <span>No sales today yet</span>
              <button className="btn btn-primary btn-sm" onClick={() => navigate('/sales/new')} style={{ marginTop: 4, fontSize: '0.75rem', padding: '5px 12px' }}>Create First Sale</button>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20 }}>
        {/* Recent Sales */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '0.88rem', fontWeight: 600 }}>Recent Sales</h3>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/reports/sales')} style={{ fontSize: '0.72rem' }}>View All →</button>
          </div>
          <div style={{ maxHeight: 280, overflowY: 'auto' }}>
            {data?.recentSales?.length ? (
              <table className="table" style={{ fontSize: '0.78rem' }}>
                <thead>
                  <tr>
                    <th>Invoice</th>
                    <th>Customer</th>
                    <th className="text-right">Amount</th>
                    <th className="text-center">Print</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentSales.map(s => (
                    <tr key={s.id}>
                      <td className="text-mono" style={{ fontSize: '0.73rem' }}>{s.invoice_number}</td>
                      <td style={{ maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.client_name || 'Walk-in'}</td>
                      <td className="text-right text-mono" style={{ fontWeight: 600 }}>{formatCurrency(s.grand_total)}</td>
                      <td className="text-center">
                        <div style={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => printInvoice(s.id, 'thermal')} style={{ padding: '2px 5px', fontSize: '0.68rem' }}><Printer size={10} /></button>
                          <button className="btn btn-ghost btn-sm" onClick={() => printInvoice(s.id, 'a4')} style={{ padding: '2px 5px', fontSize: '0.68rem' }}>A4</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div style={{ padding: '30px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                <Receipt size={24} style={{ opacity: 0.3, marginBottom: 8 }} />
                <p>No sales yet</p>
              </div>
            )}
          </div>
        </div>

        {/* Top Selling Items */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '0.88rem', fontWeight: 600 }}>Top Items This Month</h3>
            <TrendingUp size={14} style={{ color: '#10b981' }} />
          </div>
          <div style={{ padding: '12px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {data?.topItems?.length > 0 ? data.topItems.map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 22, height: 22, borderRadius: '50%', background: ['#6366f1','#10b981','#3b82f6','#f59e0b','#ef4444'][i] + '20', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 700, color: ['#6366f1','#10b981','#3b82f6','#f59e0b','#ef4444'][i], flexShrink: 0 }}>{i+1}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.item_name}</div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{item.qty_sold} units sold</div>
                </div>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--accent-green)', flexShrink: 0 }}>{formatCurrency(item.revenue)}</div>
              </div>
            )) : (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '30px 0', fontSize: '0.82rem' }}>
                <Package size={24} style={{ opacity: 0.3, marginBottom: 8 }} />
                <p>No sales this month</p>
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions + Low Stock */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Quick Actions */}
          <div className="card" style={{ padding: 16 }}>
            <h3 style={{ fontSize: '0.88rem', fontWeight: 600, marginBottom: 12 }}>Quick Actions</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[
                { label: 'New Sale', icon: Receipt, path: '/sales/new', color: '#6366f1' },
                { label: 'Purchase', icon: ShoppingCart, path: '/purchases/new', color: '#10b981' },
                { label: 'Add Item', icon: Package, path: '/items', color: '#3b82f6' },
                { label: 'Clients', icon: Users, path: '/clients', color: '#f59e0b' },
              ].map(a => (
                <button key={a.path} onClick={() => navigate(a.path)}
                  style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border-primary)', background: 'var(--bg-secondary)', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 500, color: 'var(--text-primary)', transition: 'all 0.15s ease' }}
                  onMouseEnter={e => { e.currentTarget.style.background = a.color + '12'; e.currentTarget.style.borderColor = a.color + '40'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-secondary)'; e.currentTarget.style.borderColor = 'var(--border-primary)'; }}
                >
                  <a.icon size={14} style={{ color: a.color }} /> {a.label}
                </button>
              ))}
            </div>
            <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border-primary)', display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              <span>Items: <strong style={{ color: 'var(--text-primary)' }}>{data?.totalItems || 0}</strong></span>
              <span>Clients: <strong style={{ color: 'var(--text-primary)' }}>{data?.totalClients || 0}</strong></span>
            </div>
          </div>

          {/* Low Stock Alerts */}
          {data?.lowStockItems?.length > 0 && (
            <div className="card" style={{ padding: 0, overflow: 'hidden', border: '1px solid rgba(245,158,11,0.3)' }}>
              <div style={{ padding: '10px 14px', background: 'rgba(245,158,11,0.08)', borderBottom: '1px solid rgba(245,158,11,0.2)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <AlertTriangle size={13} style={{ color: '#f59e0b' }} />
                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#f59e0b' }}>Low Stock ({data.lowStockItems.length})</span>
              </div>
              <div style={{ maxHeight: 140, overflowY: 'auto' }}>
                {data.lowStockItems.map(item => (
                  <div key={item.id} style={{ padding: '6px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)', fontSize: '0.75rem' }}>
                    <span style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 100 }}>{item.name}</span>
                    <span style={{ color: item.current_stock <= 0 ? '#ef4444' : '#f59e0b', fontWeight: 600, flexShrink: 0 }}>{item.current_stock} left</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
