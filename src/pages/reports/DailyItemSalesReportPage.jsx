import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Calendar, Search, FileText, ShoppingBag, DollarSign, ListOrdered, RefreshCw, Printer, Hash } from 'lucide-react';
import { useApi } from '../../contexts/AuthContext';
import { useApp } from '../../contexts/AppContext';

const renderQtySold = (item) => {
  const parts = [];
  if (item.total_bulk_qty > 0) {
    parts.push(`${item.total_bulk_qty} ${item.bulk_unit_label || 'Box'}`);
  }
  if (item.total_pcs_qty > 0) {
    parts.push(`${item.total_pcs_qty} ${item.pcs_unit_label || 'Pcs'}`);
  }
  if (parts.length === 0) return '0 Pcs';
  return parts.join(', ');
};

const renderTotalQtyStats = (stats) => {
  const parts = [];
  if (stats.totalBulk > 0) {
    parts.push(`${stats.totalBulk} bulk`);
  }
  if (stats.totalPcs > 0) {
    parts.push(`${stats.totalPcs} pcs`);
  }
  if (parts.length === 0) return '0 units';
  return parts.join(', ');
};

export default function DailyItemSalesReportPage() {
  const fetchApi = useApi();
  const { formatCurrency, addToast, company } = useApp();

  const todayStr = new Date().toISOString().split('T')[0];
  const [filterMode, setFilterMode] = useState('date'); // 'date' | 'invoice'
  const [date, setDate] = useState(todayStr);
  const [fromInvoice, setFromInvoice] = useState('');
  const [toInvoice, setToInvoice] = useState('');
  
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchDailySales = async () => {
    setLoading(true);
    try {
      let queryUrl = '/api/reports/daily-item-sales';
      if (filterMode === 'invoice') {
        if (!fromInvoice.trim() || !toInvoice.trim()) {
          addToast('error', 'Required Fields', 'Please enter both From and To Invoice Numbers');
          setLoading(false);
          return;
        }
        queryUrl += `?from_invoice=${encodeURIComponent(fromInvoice.trim())}&to_invoice=${encodeURIComponent(toInvoice.trim())}`;
      } else {
        queryUrl += `?date=${date}`;
      }

      const res = await fetchApi(queryUrl);
      setItems(res.items || []);
    } catch (err) {
      console.error(err);
      addToast('error', 'Error', 'Failed to fetch items sales report');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Auto-fetch on date change, but manually trigger for invoice range to avoid partial inputs
    if (filterMode === 'date') {
      fetchDailySales();
    }
  }, [date, filterMode]);

  // Filtered list based on search query
  const filteredItems = useMemo(() => {
    return items.filter(item => 
      (item.item_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.item_code || '').toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [items, searchQuery]);

  // KPI Calculations
  const stats = useMemo(() => {
    let totalBulk = 0;
    let totalPcs = 0;
    let totalRevenue = 0;
    let uniqueItems = filteredItems.length;

    filteredItems.forEach(item => {
      totalBulk += item.total_bulk_qty || 0;
      totalPcs += item.total_pcs_qty || 0;
      totalRevenue += item.total_revenue || 0;
    });

    return {
      totalBulk,
      totalPcs,
      totalRevenue,
      uniqueItems
    };
  }, [filteredItems]);

  const handlePrint = () => {
    if (items.length === 0) {
      addToast('error', 'No Data', 'No records available to print');
      return;
    }
    window.print();
  };

  const reportHeaderTitle = filterMode === 'invoice' 
    ? `Item Sales Report (Invoice: ${fromInvoice || '—'} to ${toInvoice || '—'})`
    : `Item Sales Report for Date: ${new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`;

  return (
    <div style={{ animation: 'fadeIn 0.3s ease' }}>
      
      {/* CSS style block for printable print styles */}
      <style>{`
        @media print {
          /* Hide everything else on the page */
          body * {
            visibility: hidden;
          }
          /* Show only the printable section */
          .printable-report, .printable-report * {
            visibility: visible;
          }
          .printable-report {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            color: #000 !important;
            background: #fff !important;
            font-size: 12px;
            display: block !important;
          }
          .print-header {
            text-align: center;
            border-bottom: 2px solid #000;
            padding-bottom: 12px;
            margin-bottom: 20px;
          }
          .print-header h1 {
            font-size: 22px;
            font-weight: 800;
            text-transform: uppercase;
            margin-bottom: 4px;
          }
          .print-header p {
            font-size: 12px;
            margin: 2px 0;
          }
          .print-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 15px;
          }
          .print-table th {
            border: 1px solid #000;
            background: #f0f0f0 !important;
            color: #000 !important;
            padding: 8px 6px;
            font-weight: bold;
            font-size: 11px;
            text-transform: uppercase;
          }
          .print-table td {
            border: 1px solid #000;
            padding: 6px;
            font-size: 11px;
          }
          .print-summary-row {
            font-weight: bold;
            background: #f9f9f9 !important;
          }
          .print-kpis {
            display: flex;
            justify-content: space-between;
            margin-bottom: 20px;
            border: 1px solid #000;
            padding: 10px;
            background: #fafafa !important;
          }
          .print-kpi-item {
            text-align: center;
            flex: 1;
          }
          .print-kpi-item span {
            font-size: 10px;
            text-transform: uppercase;
            color: #666;
            display: block;
          }
          .print-kpi-item strong {
            font-size: 14px;
            color: #000;
          }
        }
      `}</style>

      {/* Page Header */}
      <div className="page-header" style={{ marginBottom: 24 }}>
        <div>
          <h1 className="page-title">Daily Item Sales Report</h1>
          <p className="page-subtitle">Track quantities and revenues of items sold by Date or Invoice Number range</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button 
            className="btn btn-secondary" 
            onClick={handlePrint}
            style={{ display: 'flex', alignItems: 'center', gap: 6, height: 36 }}
          >
            <Printer size={16} />
            Print Report
          </button>
        </div>
      </div>

      {/* Filter Mode Selector */}
      <div className="card" style={{ padding: 16, marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <button 
              className={`btn ${filterMode === 'date' ? 'btn-primary' : 'btn-ghost'}`} 
              onClick={() => setFilterMode('date')}
              style={{ fontSize: '0.78rem', padding: '6px 12px', height: 32 }}
            >
              <Calendar size={14} style={{ marginRight: 4 }} /> Filter by Date
            </button>
            <button 
              className={`btn ${filterMode === 'invoice' ? 'btn-primary' : 'btn-ghost'}`} 
              onClick={() => setFilterMode('invoice')}
              style={{ fontSize: '0.78rem', padding: '6px 12px', height: 32 }}
            >
              <Hash size={14} style={{ marginRight: 4 }} /> Filter by Invoice Range
            </button>
          </div>

          <div style={{ flex: 1, height: '1px', background: 'var(--border-primary)' }} />

          {filterMode === 'date' ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)' }}>Date:</span>
              <input 
                type="date" 
                className="input" 
                value={date} 
                onChange={e => setDate(e.target.value)} 
                style={{ width: 150, padding: '5px 10px', height: 32, margin: 0 }}
              />
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)' }}>From Inv:</span>
                <input 
                  type="text" 
                  className="input" 
                  placeholder="e.g. AT/25-26/0001" 
                  value={fromInvoice} 
                  onChange={e => setFromInvoice(e.target.value)} 
                  style={{ width: 160, padding: '5px 10px', height: 32, margin: 0 }}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)' }}>To Inv:</span>
                <input 
                  type="text" 
                  className="input" 
                  placeholder="e.g. AT/25-26/0010" 
                  value={toInvoice} 
                  onChange={e => setToInvoice(e.target.value)} 
                  style={{ width: 160, padding: '5px 10px', height: 32, margin: 0 }}
                />
              </div>
              <button 
                className="btn btn-primary" 
                onClick={fetchDailySales}
                disabled={loading}
                style={{ height: 32, padding: '0 16px', fontSize: '0.78rem' }}
              >
                Get Report
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        <div className="card" style={{ padding: '16px 20px', borderLeft: '4px solid var(--accent-blue)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Total Qty Sold</p>
              <p style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>{renderTotalQtyStats(stats)}</p>
            </div>
            <div style={{ width: 40, height: 40, borderRadius: 8, background: 'rgba(59,130,246,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ShoppingBag size={20} style={{ color: 'var(--accent-blue)' }} />
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: '16px 20px', borderLeft: '4px solid var(--accent-green)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Total Revenue</p>
              <p style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>{formatCurrency(stats.totalRevenue)}</p>
            </div>
            <div style={{ width: 40, height: 40, borderRadius: 8, background: 'rgba(16,185,129,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <DollarSign size={20} style={{ color: 'var(--accent-green)' }} />
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: '16px 20px', borderLeft: '4px solid var(--accent-purple, #8b5cf6)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Unique Items</p>
              <p style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>{stats.uniqueItems} items</p>
            </div>
            <div style={{ width: 40, height: 40, borderRadius: 8, background: 'rgba(139,92,246,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ListOrdered size={20} style={{ color: 'var(--accent-purple, #8b5cf6)' }} />
            </div>
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="card" style={{ padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 16 }}>
          <div className="input-with-icon" style={{ maxWidth: 300, flex: 1 }}>
            <Search size={16} />
            <input 
              className="input" 
              placeholder="Search items by name or code..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Showing {filteredItems.length} of {items.length} records
          </div>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
            <div className="loading-spinner" />
          </div>
        ) : filteredItems.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
            <ShoppingBag size={36} style={{ opacity: 0.3, marginBottom: 8 }} />
            <h3>No items sold in the selected range</h3>
            <p>Select a different date or input different invoice numbers</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Item Name</th>
                  <th className="text-right">Qty Sold</th>
                  <th className="text-right">Pcs Rate</th>
                  <th className="text-right">Box Rate</th>
                  <th className="text-right">Total Revenue</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item, idx) => (
                  <tr key={`${item.item_id}-${idx}`}>
                    <td className="text-mono" style={{ fontSize: '0.78rem' }}>{item.item_code || '—'}</td>
                    <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{item.item_name}</td>
                    <td className="text-right text-mono" style={{ fontWeight: 700, color: 'var(--accent-blue)' }}>
                      {renderQtySold(item)}
                    </td>
                    <td className="text-right text-mono">{formatCurrency(item.selling_price || 0)}</td>
                    <td className="text-right text-mono">
                      {(item.bulk_conversion || 1) > 1 
                        ? formatCurrency((item.selling_price || 0) * item.bulk_conversion) 
                        : '—'}
                    </td>
                    <td className="text-right text-mono" style={{ fontWeight: 700, color: 'var(--accent-green)' }}>
                      {formatCurrency(item.total_revenue || 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Hidden printable component rendered ONLY during print dialog */}
      <div className="printable-report" style={{ display: 'none' }}>
        <div className="print-header">
          <h1>{company?.name || 'SURIYA MALIGAI'}</h1>
          <p>{company?.address_line1 || 'NO-27, NORTH REDDY STREET,'} {company?.address_line2 || 'UTHIRAMERUR-603406'}</p>
          <p>Phone: {company?.phone || '6379355917'} | GSTIN: {company?.gstin || '33AOEPT0355D2Z9'}</p>
          <div style={{ marginTop: 15, borderTop: '1px solid #000', paddingTop: 8 }}>
            <h2 style={{ fontSize: '15px', fontWeight: 'bold', margin: '4px 0' }}>{reportHeaderTitle}</h2>
            <p>Generated on: {new Date().toLocaleString('en-IN')}</p>
          </div>
        </div>

        <div className="print-kpis">
          <div className="print-kpi-item">
            <span>Total Qty Sold</span>
            <strong>{renderTotalQtyStats(stats)}</strong>
          </div>
          <div className="print-kpi-item" style={{ borderLeft: '1px solid #000', borderRight: '1px solid #000' }}>
            <span>Total Revenue</span>
            <strong>{formatCurrency(stats.totalRevenue)}</strong>
          </div>
          <div className="print-kpi-item">
            <span>Unique Items</span>
            <strong>{stats.uniqueItems} items</strong>
          </div>
        </div>

        <table className="print-table">
          <thead>
            <tr>
              <th style={{ width: '40px' }}>S.No</th>
              <th style={{ width: '80px' }}>Code</th>
              <th>Item Name</th>
              <th style={{ textAlign: 'right', width: '120px' }}>Qty Sold</th>
              <th style={{ textAlign: 'right', width: '90px' }}>Pcs Rate</th>
              <th style={{ textAlign: 'right', width: '95px' }}>Box Rate</th>
              <th style={{ textAlign: 'right', width: '110px' }}>Total Amount</th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.map((item, idx) => (
              <tr key={idx}>
                <td style={{ textAlign: 'center' }}>{idx + 1}</td>
                <td style={{ fontFamily: 'monospace' }}>{item.item_code || '—'}</td>
                <td style={{ fontWeight: 'bold' }}>{item.item_name}</td>
                <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                  {renderQtySold(item)}
                </td>
                <td style={{ textAlign: 'right' }}>{formatCurrency(item.selling_price || 0)}</td>
                <td style={{ textAlign: 'right' }}>
                  {(item.bulk_conversion || 1) > 1 
                    ? formatCurrency((item.selling_price || 0) * item.bulk_conversion) 
                    : '—'}
                </td>
                <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{formatCurrency(item.total_revenue || 0)}</td>
              </tr>
            ))}
            <tr className="print-summary-row">
              <td colspan="3" style={{ textAlign: 'right', paddingRight: '10px' }}>Total Summary</td>
              <td style={{ textAlign: 'right' }}>{renderTotalQtyStats(stats)}</td>
              <td>&nbsp;</td>
              <td>&nbsp;</td>
              <td style={{ textAlign: 'right' }}>{formatCurrency(stats.totalRevenue)}</td>
            </tr>
          </tbody>
        </table>

        <div style={{ marginTop: '50px', display: 'flex', justifyContent: 'space-between' }}>
          <div style={{ fontSize: '10px', color: '#555' }}>
            * This report is generated dynamically by Billing Software
          </div>
          <div style={{ textAlign: 'center', width: '200px', borderTop: '1px dashed #000', paddingTop: '5px', fontSize: '11px', fontWeight: 'bold' }}>
            Authorized Signatory
          </div>
        </div>
      </div>

    </div>
  );
}
