import React, { useState, useEffect, useMemo } from 'react';
import { Calendar, Users, ShoppingBag, MapPin, Layers, FileText, Search, Printer, RefreshCw, BarChart2, CheckCircle2 } from 'lucide-react';
import { useApi } from '../../contexts/AuthContext';
import { useApp } from '../../contexts/AppContext';

export default function TradingReportsPage() {
  const fetchApi = useApi();
  const { formatCurrency, formatDate, addToast, company } = useApp();

  const todayStr = new Date().toISOString().split('T')[0];
  const firstDayStr = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

  // Parameters lists
  const [params, setParams] = useState({ clients: [], items: [], areas: [], zones: [] });
  const [loadingParams, setLoadingParams] = useState(true);

  // Filter States
  const [reportType, setReportType] = useState('sales_all');
  const [dateFrom, setDateFrom] = useState(firstDayStr);
  const [dateTo, setDateTo] = useState(todayStr);
  const [selectedClient, setSelectedClient] = useState('');
  const [selectedArea, setSelectedArea] = useState('');
  const [selectedZone, setSelectedZone] = useState('');
  const [selectedItem, setSelectedItem] = useState('');
  const [filterMode, setFilterMode] = useState('date'); // 'date' | 'invoice'
  const [fromInvoice, setFromInvoice] = useState('');
  const [toInvoice, setToInvoice] = useState('');

  // Results State
  const [reportData, setReportData] = useState([]);
  const [loadingReport, setLoadingReport] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Pre-defined reports list
  const reportsList = [
    { id: 'sales_all', label: '1. Sales Register (ALL)', category: 'sales' },
    { id: 'sales_cash', label: '2. Sales Register (CASH)', category: 'sales' },
    { id: 'sales_credit', label: '3. Sales Register (CREDIT)', category: 'sales' },
    { id: 'purchase_all', label: '4. Purchase Register (ALL)', category: 'purchase' },
    { id: 'purchase_cash', label: '5. Purchase Register (CASH)', category: 'purchase' },
    { id: 'purchase_credit', label: '6. Purchase Register (CREDIT)', category: 'purchase' },
    { id: 'item_sales', label: '7. Item-wise Sales Summary', category: 'items' },
    { id: 'area_sales', label: '8. Area-wise Sales Summary', category: 'location' },
    { id: 'zone_sales', label: '9. Zone-wise Sales Summary', category: 'location' },
    { id: 'sales_turnover', label: '10. Statement of Sales Turnover', category: 'sales' },
    { id: 'purchase_turnover', label: '11. Statement of Purchase Turnover', category: 'purchase' },
    { id: 'carriage_loading', label: '12. Carriage Loading Statement', category: 'sales' },
    { id: 'customer_collections', label: '13. Customer Collections Register', category: 'sales' },
    { id: 'stock_position', label: '14. Stock Position (Summary)', category: 'inventory' },
    { id: 'reorder_items', label: '15. Low Stock / Reorder items', category: 'inventory' },
  ];

  // Load selection parameters
  useEffect(() => {
    fetchApi('/api/reports/trading-parameters')
      .then(setParams)
      .catch(err => addToast('error', 'Error', 'Failed to load filter choices'))
      .finally(() => setLoadingParams(false));
  }, []);

  // Fetch report data when report type or params change
  const fetchReport = async () => {
    setLoadingReport(true);
    try {
      const q = new URLSearchParams({
        report_type: reportType,
        client_id: selectedClient,
        area: selectedArea,
        zone: selectedZone,
        item_id: selectedItem
      });
      if (filterMode === 'invoice') {
        q.append('from_invoice', fromInvoice.trim());
        q.append('to_invoice', toInvoice.trim());
      } else {
        q.append('date_from', dateFrom);
        q.append('date_to', dateTo);
      }
      const res = await fetchApi(`/api/reports/trading-report?${q.toString()}`);
      setReportData(res.data || []);
    } catch (err) {
      console.error(err);
      addToast('error', 'Error', 'Failed to generate report');
    } finally {
      setLoadingReport(false);
    }
  };

  useEffect(() => {
    if (filterMode === 'date') {
      fetchReport();
    } else if (filterMode === 'invoice' && fromInvoice.trim() && toInvoice.trim()) {
      fetchReport();
    }
  }, [reportType, filterMode, dateFrom, dateTo, selectedClient, selectedArea, selectedZone, selectedItem, fromInvoice, toInvoice]);

  const filteredData = useMemo(() => {
    if (!searchQuery.trim()) return reportData;
    const q = searchQuery.toLowerCase();
    // Use explicit checks — startsWith would incorrectly match sales_turnover / purchase_turnover
    const isSalesRegister = ['sales_all', 'sales_cash', 'sales_credit'].includes(reportType);
    const isPurchaseRegister = ['purchase_all', 'purchase_cash', 'purchase_credit'].includes(reportType);

    return reportData.filter(row => {
      if (isSalesRegister) {
        return (row.invoice_number || '').toLowerCase().includes(q) ||
               (row.client_name || '').toLowerCase().includes(q) ||
               (row.payment_mode || '').toLowerCase().includes(q);
      }
      if (isPurchaseRegister) {
        return (row.our_ref_number || '').toLowerCase().includes(q) ||
               (row.supplier_name || '').toLowerCase().includes(q) ||
               (row.bill_number || '').toLowerCase().includes(q);
      }
      if (reportType === 'item_sales') {
        return (row.item_name || '').toLowerCase().includes(q) ||
               (row.item_code || '').toLowerCase().includes(q);
      }
      if (reportType === 'area_sales') {
        return (row.area_name || '').toLowerCase().includes(q);
      }
      if (reportType === 'zone_sales') {
        return (row.zone_name || '').toLowerCase().includes(q);
      }
      if (reportType === 'sales_turnover') {
        return (row.client_display_name || '').toLowerCase().includes(q) ||
               (row.contact_name || '').toLowerCase().includes(q) ||
               (row.area || '').toLowerCase().includes(q) ||
               (row.zone || '').toLowerCase().includes(q);
      }
      if (reportType === 'purchase_turnover') {
        return (row.supplier_display_name || '').toLowerCase().includes(q) ||
               (row.contact_name || '').toLowerCase().includes(q) ||
               (row.area || '').toLowerCase().includes(q) ||
               (row.zone || '').toLowerCase().includes(q);
      }
      if (reportType === 'carriage_loading') {
        return (row.item_name || '').toLowerCase().includes(q) ||
               (row.item_code || '').toLowerCase().includes(q) ||
               (row.destinations || '').toLowerCase().includes(q);
      }
      if (reportType === 'customer_collections') {
        return (row.client_name || '').toLowerCase().includes(q) ||
               (row.client_store_name || '').toLowerCase().includes(q) ||
               (row.client_code || '').toLowerCase().includes(q) ||
               (row.payment_mode || '').toLowerCase().includes(q) ||
               (row.reference_number || '').toLowerCase().includes(q) ||
               (row.notes || '').toLowerCase().includes(q);
      }
      if (reportType === 'stock_position' || reportType === 'reorder_items') {
        return (row.name || '').toLowerCase().includes(q) ||
               (row.code || '').toLowerCase().includes(q);
      }
      return false;
    });
  }, [reportData, searchQuery, reportType]);

  // Calculate totals — use explicit type checks to avoid startsWith misclassifying turnover reports
  const totals = useMemo(() => {
    const isSalesRegister = ['sales_all', 'sales_cash', 'sales_credit'].includes(reportType);
    const isPurchaseRegister = ['purchase_all', 'purchase_cash', 'purchase_credit'].includes(reportType);
    const t = { subtotal: 0, tax: 0, total: 0, qtyBulk: 0, qtyPcs: 0, count: filteredData.length };

    filteredData.forEach(row => {
      if (isSalesRegister || isPurchaseRegister) {
        t.subtotal += row.subtotal || 0;
        t.tax += row.tax_total || 0;
        t.total += row.grand_total || 0;
      } else if (reportType === 'sales_turnover' || reportType === 'purchase_turnover') {
        t.subtotal += row.total_subtotal || 0;
        t.tax += row.total_tax || 0;
        t.total += row.total_turnover || 0;
      } else if (reportType === 'item_sales' || reportType === 'carriage_loading') {
        t.qtyBulk += row.total_bulk_qty || 0;
        t.qtyPcs += row.total_pcs_qty || 0;
        t.total += row.total_revenue || 0;
      } else if (reportType === 'area_sales' || reportType === 'zone_sales') {
        t.total += row.total_revenue || 0;
      } else if (reportType === 'customer_collections') {
        t.total += row.amount || 0;
      } else if (reportType === 'stock_position' || reportType === 'reorder_items') {
        t.total += (row.current_stock || 0) * (row.selling_price || 0);
        t.qtyPcs += row.current_stock || 0;
      }
    });

    return t;
  }, [filteredData, reportType]);

  const handlePrint = () => {
    if (filteredData.length === 0) {
      addToast('error', 'Print Error', 'No data available to print');
      return;
    }
    window.print();
  };

  const reportLabel = reportsList.find(r => r.id === reportType)?.label || 'Trading Report';

  // Helper to format quantity sold in table
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

  return (
    <div style={{ animation: 'fadeIn 0.3s ease' }}>
      
      {/* CSS print override styles */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .printable-report-area, .printable-report-area * {
            visibility: visible;
          }
          .printable-report-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            display: block !important;
            color: #000 !important;
            background: #fff !important;
          }
          .print-header {
            text-align: center;
            border-bottom: 3px solid #000;
            padding-bottom: 12px;
            margin-bottom: 20px;
          }
          .print-header h1 {
            font-size: 24px;
            font-weight: 900;
            text-transform: uppercase;
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
            background: #e0e0e0 !important;
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
            background: #f0f0f0 !important;
          }
        }
      `}</style>

      {/* Page Title */}
      <div className="page-header" style={{ marginBottom: 20 }}>
        <div>
          <h1 className="page-title">Trading Reports</h1>
          <p className="page-subtitle">Centralized report summary for Sales, Purchases, Stock & Area Wise performance</p>
        </div>
        <button className="btn btn-secondary" onClick={handlePrint} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Printer size={16} /> Print Report
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 20, alignItems: 'start' }}>
        
        {/* LEFT COLUMN: List of pre-defined reports */}
        <div className="card" style={{ padding: 14 }}>
          <h3 style={{ fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 12, borderBottom: '1.5px solid var(--border-primary)', paddingBottom: 6 }}>
            Report Names
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {reportsList.map(rep => (
              <button 
                key={rep.id}
                onClick={() => setReportType(rep.id)}
                style={{
                  textAlign: 'left',
                  padding: '9px 12px',
                  borderRadius: 6,
                  border: 'none',
                  fontSize: '0.78rem',
                  fontWeight: reportType === rep.id ? 700 : 500,
                  background: reportType === rep.id ? 'var(--accent-blue)' : 'transparent',
                  color: reportType === rep.id ? '#fff' : 'var(--text-primary)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                {rep.label}
              </button>
            ))}
          </div>
        </div>

        {/* RIGHT COLUMN: Parameters + Preview */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          
          {/* PARAMETERS SECTION */}
          <div className="card" style={{ padding: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, borderBottom: '1px dashed var(--border-primary)', paddingBottom: 6 }}>
              <h3 style={{ fontSize: '0.82rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)', margin: 0 }}>
                Select Report Parameters
              </h3>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)' }}>Mode:</span>
                <div className="toggle-group" style={{ display: 'inline-flex', height: 24 }}>
                  <button type="button" className={filterMode === 'date' ? 'active' : ''} onClick={() => setFilterMode('date')} style={{ padding: '2px 8px', fontSize: '0.68rem', height: 24 }}>Date</button>
                  <button type="button" className={filterMode === 'invoice' ? 'active' : ''} onClick={() => setFilterMode('invoice')} style={{ padding: '2px 8px', fontSize: '0.68rem', height: 24 }}>Invoice</button>
                </div>
              </div>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
              
              {/* Date Ranges or Invoice Ranges */}
              {filterMode === 'date' ? (
                <>
                  <div className="input-group" style={{ margin: 0 }}>
                    <label style={{ fontSize: '0.7rem', fontWeight: 700 }}>From Date</label>
                    <input type="date" className="input" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ padding: '5px 8px', height: 32 }} />
                  </div>
                  <div className="input-group" style={{ margin: 0 }}>
                    <label style={{ fontSize: '0.7rem', fontWeight: 700 }}>To Date</label>
                    <input type="date" className="input" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ padding: '5px 8px', height: 32 }} />
                  </div>
                </>
              ) : (
                <>
                  <div className="input-group" style={{ margin: 0 }}>
                    <label style={{ fontSize: '0.7rem', fontWeight: 700 }}>From Invoice #</label>
                    <input type="text" className="input" placeholder="e.g. INV001" value={fromInvoice} onChange={e => setFromInvoice(e.target.value)} style={{ padding: '5px 8px', height: 32 }} />
                  </div>
                  <div className="input-group" style={{ margin: 0 }}>
                    <label style={{ fontSize: '0.7rem', fontWeight: 700 }}>To Invoice #</label>
                    <input type="text" className="input" placeholder="e.g. INV050" value={toInvoice} onChange={e => setToInvoice(e.target.value)} style={{ padding: '5px 8px', height: 32 }} />
                  </div>
                </>
              )}

              {/* Client dropdown */}
              <div className="input-group" style={{ margin: 0 }}>
                <label style={{ fontSize: '0.7rem', fontWeight: 700 }}>Client / Supplier</label>
                <select className="select" value={selectedClient} onChange={e => setSelectedClient(e.target.value)} style={{ padding: '5px 8px', height: 32 }}>
                  <option value="">All Clients</option>
                  {params.clients.map(c => (
                    <option key={c.id} value={c.id}>{c.store_name || c.name} ({c.type})</option>
                  ))}
                </select>
              </div>

              {/* Area dropdown */}
              <div className="input-group" style={{ margin: 0 }}>
                <label style={{ fontSize: '0.7rem', fontWeight: 700 }}>Area / Route</label>
                <select className="select" value={selectedArea} onChange={e => setSelectedArea(e.target.value)} style={{ padding: '5px 8px', height: 32 }}>
                  <option value="">All Areas</option>
                  {params.areas.map(a => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              </div>

              {/* Zone dropdown */}
              <div className="input-group" style={{ margin: 0 }}>
                <label style={{ fontSize: '0.7rem', fontWeight: 700 }}>Zone</label>
                <select className="select" value={selectedZone} onChange={e => setSelectedZone(e.target.value)} style={{ padding: '5px 8px', height: 32 }}>
                  <option value="">All Zones</option>
                  {params.zones.map(z => (
                    <option key={z} value={z}>{z}</option>
                  ))}
                </select>
              </div>

              {/* Item dropdown */}
              <div className="input-group" style={{ margin: 0 }}>
                <label style={{ fontSize: '0.7rem', fontWeight: 700 }}>Product / Item</label>
                <select className="select" value={selectedItem} onChange={e => setSelectedItem(e.target.value)} style={{ padding: '5px 8px', height: 32 }}>
                  <option value="">All Products</option>
                  {params.items.map(item => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </select>
              </div>

            </div>
          </div>

          {/* REPORT PREVIEW PANEL */}
          <div className="card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 16 }}>
              <div className="input-with-icon" style={{ maxWidth: 300, flex: 1 }}>
                <Search size={16} />
                <input 
                  className="input" 
                  placeholder="Filter preview results..." 
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                Found {filteredData.length} records
              </div>
            </div>

            {loadingReport ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
                <div className="loading-spinner" />
              </div>
            ) : filteredData.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                <FileText size={36} style={{ opacity: 0.3, marginBottom: 8 }} />
                <h3>No records match parameters</h3>
                <p>Modify date range or selected filters</p>
              </div>
            ) : (
              <div>
                <div className="table-container" style={{ maxHeight: 400, overflowY: 'auto' }}>
                  <table className="table">
                    <thead>
                      {/* Dynamic headers based on Report Type */}
                      {['sales_all','sales_cash','sales_credit'].includes(reportType) && (
                        <tr>
                          <th>Date</th>
                          <th>Invoice No</th>
                          <th>Customer</th>
                          <th>Area</th>
                          <th>Pay Mode</th>
                          <th className="text-right">Total Amount</th>
                        </tr>
                      )}
                      {['purchase_all','purchase_cash','purchase_credit'].includes(reportType) && (
                        <tr>
                          <th>Date</th>
                          <th>Ref No</th>
                          <th>Supplier</th>
                          <th>Bill No</th>
                          <th>Pay Mode</th>
                          <th className="text-right">Total Amount</th>
                        </tr>
                      )}
                      {reportType === 'item_sales' && (
                        <tr>
                          <th>Code</th>
                          <th>Item Name</th>
                          <th className="text-right">Qty Sold</th>
                          <th className="text-right">Pcs Rate</th>
                          <th className="text-right">Box Rate</th>
                          <th className="text-right">Revenue</th>
                        </tr>
                      )}
                      {reportType === 'area_sales' && (
                        <tr>
                          <th>Area Name</th>
                          <th className="text-right">Invoices Count</th>
                          <th className="text-right">Total Sales</th>
                        </tr>
                      )}
                      {reportType === 'zone_sales' && (
                        <tr>
                          <th>Zone Name</th>
                          <th className="text-right">Invoices Count</th>
                          <th className="text-right">Total Sales</th>
                        </tr>
                      )}
                      {reportType === 'sales_turnover' && (
                        <tr>
                          <th>Customer</th>
                          <th>Contact Name</th>
                          <th>Area</th>
                          <th>Zone</th>
                          <th className="text-right">Bills Count</th>
                          <th className="text-right">Taxable</th>
                          <th className="text-right">GST</th>
                          <th className="text-right">Turnover</th>
                        </tr>
                      )}
                      {reportType === 'purchase_turnover' && (
                        <tr>
                          <th>Supplier</th>
                          <th>Contact Name</th>
                          <th>Area</th>
                          <th>Zone</th>
                          <th className="text-right">Bills Count</th>
                          <th className="text-right">Taxable</th>
                          <th className="text-right">GST</th>
                          <th className="text-right">Turnover</th>
                        </tr>
                      )}
                      {reportType === 'carriage_loading' && (
                        <tr>
                          <th>Code</th>
                          <th>Item Name</th>
                          <th className="text-right">Qty to Load</th>
                          <th>Destinations / Deliver To</th>
                        </tr>
                      )}
                      {reportType === 'customer_collections' && (
                        <tr>
                          <th>Date</th>
                          <th>Customer</th>
                          <th>Area</th>
                          <th>Zone</th>
                          <th>Pay Mode</th>
                          <th>Reference No</th>
                          <th>Notes</th>
                          <th className="text-right">Amount Received</th>
                        </tr>
                      )}
                      {reportType === 'stock_position' && (
                        <tr>
                          <th>Code</th>
                          <th>Item Name</th>
                          <th>Category</th>
                          <th className="text-right">Current Stock</th>
                          <th className="text-right">Rate</th>
                          <th className="text-right">Valuation</th>
                        </tr>
                      )}
                      {reportType === 'reorder_items' && (
                        <tr>
                          <th>Code</th>
                          <th>Item Name</th>
                          <th className="text-right">Current Stock</th>
                          <th className="text-right">Min Level</th>
                          <th className="text-right">Rate</th>
                        </tr>
                      )}
                    </thead>
                    <tbody>
                      {/* Dynamic rows based on Report Type */}
                      {filteredData.map((row, idx) => (
                        <tr key={idx}>
                          {['sales_all','sales_cash','sales_credit'].includes(reportType) && (
                            <>
                              <td>{formatDate(row.invoice_date)}</td>
                              <td className="text-mono" style={{ fontWeight: 600 }}>{row.invoice_number}</td>
                              <td style={{ fontWeight: 600 }}>{row.client_name}</td>
                              <td>{row.area || '—'}</td>
                              <td><span className={`badge ${row.payment_mode==='cash'?'badge-success':'badge-info'}`}>{row.payment_mode}</span></td>
                              <td className="text-right text-mono" style={{ fontWeight: 700 }}>{formatCurrency(row.grand_total)}</td>
                            </>
                          )}
                          {['purchase_all','purchase_cash','purchase_credit'].includes(reportType) && (
                            <>
                              <td>{formatDate(row.ref_date)}</td>
                              <td className="text-mono" style={{ fontWeight: 600 }}>{row.our_ref_number}</td>
                              <td style={{ fontWeight: 600 }}>{row.supplier_name}</td>
                              <td>{row.bill_number || '—'}</td>
                              <td><span className={`badge badge-neutral`}>{row.payment_mode}</span></td>
                              <td className="text-right text-mono" style={{ fontWeight: 700 }}>{formatCurrency(row.grand_total)}</td>
                            </>
                          )}
                          {reportType === 'item_sales' && (
                            <>
                              <td className="text-mono">{row.item_code || '—'}</td>
                              <td style={{ fontWeight: 600 }}>{row.item_name}</td>
                              <td className="text-right text-mono" style={{ fontWeight: 700, color: 'var(--accent-blue)' }}>{renderQtySold(row)}</td>
                              <td className="text-right text-mono">{formatCurrency(row.selling_price || 0)}</td>
                              <td className="text-right text-mono">
                                {(row.bulk_conversion || 1) > 1 
                                  ? formatCurrency((row.selling_price || 0) * row.bulk_conversion) 
                                  : '—'}
                              </td>
                              <td className="text-right text-mono" style={{ fontWeight: 700, color: 'var(--accent-green)' }}>{formatCurrency(row.total_revenue)}</td>
                            </>
                          )}
                          {reportType === 'sales_turnover' && (
                            <>
                              <td style={{ fontWeight: 600 }}>{row.client_display_name}</td>
                              <td>{row.contact_name || '—'}</td>
                              <td>{row.area || '—'}</td>
                              <td>{row.zone || '—'}</td>
                              <td className="text-right text-mono">{row.total_bills} bills</td>
                              <td className="text-right text-mono">{formatCurrency(row.total_subtotal)}</td>
                              <td className="text-right text-mono">{formatCurrency(row.total_tax)}</td>
                              <td className="text-right text-mono" style={{ fontWeight: 700, color: 'var(--accent-green)' }}>{formatCurrency(row.total_turnover)}</td>
                            </>
                          )}
                          {reportType === 'purchase_turnover' && (
                            <>
                              <td style={{ fontWeight: 600 }}>{row.supplier_display_name}</td>
                              <td>{row.contact_name || '—'}</td>
                              <td>{row.area || '—'}</td>
                              <td>{row.zone || '—'}</td>
                              <td className="text-right text-mono">{row.total_bills} bills</td>
                              <td className="text-right text-mono">{formatCurrency(row.total_subtotal)}</td>
                              <td className="text-right text-mono">{formatCurrency(row.total_tax)}</td>
                              <td className="text-right text-mono" style={{ fontWeight: 700, color: 'var(--accent-green)' }}>{formatCurrency(row.total_turnover)}</td>
                            </>
                          )}
                          {reportType === 'carriage_loading' && (
                            <>
                              <td className="text-mono">{row.item_code || '—'}</td>
                              <td style={{ fontWeight: 600 }}>{row.item_name}</td>
                              <td className="text-right text-mono" style={{ fontWeight: 700, color: 'var(--accent-blue)' }}>{renderQtySold(row)}</td>
                              <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{row.destinations || '—'}</td>
                            </>
                          )}
                          {reportType === 'customer_collections' && (
                            <>
                              <td>{formatDate(row.payment_date)}</td>
                              <td style={{ fontWeight: 600 }}>
                                {row.client_store_name || row.client_name}
                                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginLeft: 8, fontFamily: 'var(--font-mono)' }}>({row.client_code})</span>
                              </td>
                              <td>{row.area || '—'}</td>
                              <td>{row.zone || '—'}</td>
                              <td>
                                <span className={`badge ${
                                  row.payment_mode === 'cash' ? 'badge-success' :
                                  row.payment_mode === 'upi' ? 'badge-info' : 'badge-neutral'
                                }`}>
                                  {row.payment_mode?.toUpperCase()}
                                </span>
                              </td>
                              <td className="text-mono" style={{ fontSize: '0.74rem' }}>{row.reference_number || '—'}</td>
                              <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.notes || '—'}</td>
                              <td className="text-right text-mono" style={{ fontWeight: 700, color: 'var(--accent-green)' }}>{formatCurrency(row.amount)}</td>
                            </>
                          )}
                          {reportType === 'area_sales' && (
                            <>
                              <td style={{ fontWeight: 600 }}>{row.area_name}</td>
                              <td className="text-right text-mono">{row.total_invoices} bills</td>
                              <td className="text-right text-mono" style={{ fontWeight: 700, color: 'var(--accent-green)' }}>{formatCurrency(row.total_revenue)}</td>
                            </>
                          )}
                          {reportType === 'zone_sales' && (
                            <>
                              <td style={{ fontWeight: 600 }}><span className="badge badge-info">{row.zone_name}</span></td>
                              <td className="text-right text-mono">{row.total_invoices} bills</td>
                              <td className="text-right text-mono" style={{ fontWeight: 700, color: 'var(--accent-green)' }}>{formatCurrency(row.total_revenue)}</td>
                            </>
                          )}
                          {reportType === 'stock_position' && (
                            <>
                              <td className="text-mono">{row.code || '—'}</td>
                              <td style={{ fontWeight: 600 }}>{row.name}</td>
                              <td>{row.category_name || '—'}</td>
                              <td className="text-right text-mono" style={{ fontWeight: 700 }}>{row.current_stock} {row.unit_name || 'Pcs'}</td>
                              <td className="text-right text-mono">{formatCurrency(row.selling_price)}</td>
                              <td className="text-right text-mono" style={{ fontWeight: 700, color: 'var(--accent-green)' }}>{formatCurrency((row.current_stock || 0) * (row.selling_price || 0))}</td>
                            </>
                          )}
                          {reportType === 'reorder_items' && (
                            <>
                              <td className="text-mono">{row.code || '—'}</td>
                              <td style={{ fontWeight: 600, color: 'var(--accent-red)' }}>{row.name}</td>
                              <td className="text-right text-mono" style={{ fontWeight: 700, color: 'var(--accent-red)' }}>{row.current_stock} {row.unit_name || 'Pcs'}</td>
                              <td className="text-right text-mono" style={{ fontWeight: 600 }}>{row.min_stock_level}</td>
                              <td className="text-right text-mono">{formatCurrency(row.selling_price)}</td>
                            </>
                          )}
                        </tr>
                      ))}
                      
                      {/* Summary row */}
                      <tr style={{ fontWeight: 800, background: 'var(--bg-secondary)', borderTop: '2px solid var(--border-primary)' }}>
                        <td colspan={
                          ['sales_all','sales_cash','sales_credit'].includes(reportType) ? 5 :
                          ['purchase_all','purchase_cash','purchase_credit'].includes(reportType) ? 5 :
                          reportType === 'item_sales' ? 5 :
                          reportType === 'area_sales' ? 2 :
                          reportType === 'zone_sales' ? 2 :
                          reportType === 'sales_turnover' ? 7 :
                          reportType === 'purchase_turnover' ? 7 :
                          reportType === 'carriage_loading' ? 3 :
                          reportType === 'customer_collections' ? 7 :
                          reportType === 'stock_position' ? 5 : 4
                        } className="text-right">
                          Total Summary ({totals.count} rows)
                        </td>
                        <td className="text-right text-mono" style={{ color: 'var(--accent-green)' }}>
                          {reportType === 'carriage_loading' ? (
                            <span style={{ color: 'var(--accent-blue)', fontWeight: 800 }}>
                              {totals.qtyBulk > 0 && `${totals.qtyBulk} Box`}
                              {totals.qtyBulk > 0 && totals.qtyPcs > 0 && ' + '}
                              {totals.qtyPcs > 0 && `${totals.qtyPcs} Pcs`}
                              {totals.qtyBulk === 0 && totals.qtyPcs === 0 && '0 Pcs'}
                            </span>
                          ) : (
                            formatCurrency(totals.total)
                          )}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* PRINT DIALOG RENDER TARGET */}
      <div className="printable-report-area" style={{ display: 'none' }}>
        <div className="print-header">
          <h1>{company?.name || 'SURIYA MALIGAI'}</h1>
          <p>{company?.address_line1 || 'NO-27, NORTH REDDY STREET,'} {company?.address_line2 || 'UTHIRAMERUR-603406'}</p>
          <p>Phone: {company?.phone || '6379355917'} | GSTIN: {company?.gstin || '33AOEPT0355D2Z9'}</p>
          <div style={{ marginTop: 15, borderTop: '2px solid #000', paddingTop: 8 }}>
            <h2 style={{ fontSize: '15px', fontWeight: 'bold' }}>{reportLabel}</h2>
            {filterMode === 'invoice' ? (
              <p>Invoice Range: {fromInvoice} to {toInvoice}</p>
            ) : (
              <p>From Date: {formatDate(dateFrom)} &nbsp;|&nbsp; To Date: {formatDate(dateTo)}</p>
            )}
            {selectedArea && <p>Area Filter: {selectedArea}</p>}
            {selectedZone && <p>Zone Filter: {selectedZone}</p>}
            <p style={{ fontSize: '10px', marginTop: 4 }}>Report Generated on: {new Date().toLocaleString('en-IN')}</p>
          </div>
        </div>

        <table className="print-table">
          <thead>
            {['sales_all','sales_cash','sales_credit'].includes(reportType) && (
              <tr>
                <th style={{ width: '40px' }}>S.No</th>
                <th style={{ width: '100px' }}>Date</th>
                <th>Invoice No</th>
                <th>Customer</th>
                <th>Area</th>
                <th style={{ textAlign: 'right', width: '120px' }}>Amount</th>
              </tr>
            )}
            {['purchase_all','purchase_cash','purchase_credit'].includes(reportType) && (
              <tr>
                <th style={{ width: '40px' }}>S.No</th>
                <th style={{ width: '100px' }}>Date</th>
                <th>Ref No</th>
                <th>Supplier</th>
                <th>Bill No</th>
                <th style={{ textAlign: 'right', width: '120px' }}>Amount</th>
              </tr>
            )}
            {reportType === 'item_sales' && (
              <tr>
                <th style={{ width: '40px' }}>S.No</th>
                <th style={{ width: '80px' }}>Code</th>
                <th>Item Name</th>
                <th style={{ textAlign: 'right', width: '120px' }}>Qty Sold</th>
                <th style={{ textAlign: 'right', width: '90px' }}>Pcs Rate</th>
                <th style={{ textAlign: 'right', width: '95px' }}>Box Rate</th>
                <th style={{ textAlign: 'right', width: '110px' }}>Total Revenue</th>
              </tr>
            )}
            {reportType === 'sales_turnover' && (
              <tr>
                <th style={{ width: '40px' }}>S.No</th>
                <th>Customer</th>
                <th>Contact Name</th>
                <th>Area</th>
                <th>Zone</th>
                <th style={{ textAlign: 'right', width: '90px' }}>Bills</th>
                <th style={{ textAlign: 'right', width: '100px' }}>Taxable</th>
                <th style={{ textAlign: 'right', width: '100px' }}>GST</th>
                <th style={{ textAlign: 'right', width: '120px' }}>Turnover</th>
              </tr>
            )}
            {reportType === 'purchase_turnover' && (
              <tr>
                <th style={{ width: '40px' }}>S.No</th>
                <th>Supplier</th>
                <th>Contact Name</th>
                <th>Area</th>
                <th>Zone</th>
                <th style={{ textAlign: 'right', width: '90px' }}>Bills</th>
                <th style={{ textAlign: 'right', width: '100px' }}>Taxable</th>
                <th style={{ textAlign: 'right', width: '100px' }}>GST</th>
                <th style={{ textAlign: 'right', width: '120px' }}>Turnover</th>
              </tr>
            )}
            {reportType === 'carriage_loading' && (
              <tr>
                <th style={{ width: '40px' }}>S.No</th>
                <th style={{ width: '100px' }}>Code</th>
                <th>Item Name</th>
                <th style={{ textAlign: 'right', width: '150px' }}>Qty to Load</th>
                <th>Destinations / Deliver To</th>
              </tr>
            )}
            {reportType === 'customer_collections' && (
              <tr>
                <th style={{ width: '40px' }}>S.No</th>
                <th style={{ width: '90px' }}>Date</th>
                <th>Customer</th>
                <th>Area</th>
                <th>Zone</th>
                <th style={{ width: '90px' }}>Pay Mode</th>
                <th>Reference No</th>
                <th style={{ textAlign: 'right', width: '130px' }}>Amount</th>
              </tr>
            )}
            {reportType === 'area_sales' && (
              <tr>
                <th style={{ width: '40px' }}>S.No</th>
                <th>Area Name</th>
                <th style={{ textAlign: 'right', width: '120px' }}>Invoices</th>
                <th style={{ textAlign: 'right', width: '150px' }}>Total Sales</th>
              </tr>
            )}
            {reportType === 'zone_sales' && (
              <tr>
                <th style={{ width: '40px' }}>S.No</th>
                <th>Zone Name</th>
                <th style={{ textAlign: 'right', width: '120px' }}>Invoices</th>
                <th style={{ textAlign: 'right', width: '150px' }}>Total Sales</th>
              </tr>
            )}
            {reportType === 'stock_position' && (
              <tr>
                <th style={{ width: '40px' }}>S.No</th>
                <th style={{ width: '100px' }}>Code</th>
                <th>Item Name</th>
                <th style={{ textAlign: 'right', width: '100px' }}>Stock</th>
                <th style={{ textAlign: 'right', width: '120px' }}>Valuation</th>
              </tr>
            )}
            {reportType === 'reorder_items' && (
              <tr>
                <th style={{ width: '40px' }}>S.No</th>
                <th style={{ width: '100px' }}>Code</th>
                <th>Item Name</th>
                <th style={{ textAlign: 'right', width: '100px' }}>Stock</th>
                <th style={{ textAlign: 'right', width: '100px' }}>Min Level</th>
              </tr>
            )}
          </thead>
          <tbody>
            {filteredData.map((row, idx) => (
              <tr key={idx}>
                <td style={{ textAlign: 'center' }}>{idx + 1}</td>
                {['sales_all','sales_cash','sales_credit'].includes(reportType) && (
                  <>
                    <td>{formatDate(row.invoice_date)}</td>
                    <td style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{row.invoice_number}</td>
                    <td style={{ fontWeight: 'bold' }}>{row.client_name}</td>
                    <td>{row.area || '—'}</td>
                    <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{formatCurrency(row.grand_total)}</td>
                  </>
                )}
                {['purchase_all','purchase_cash','purchase_credit'].includes(reportType) && (
                  <>
                    <td>{formatDate(row.ref_date)}</td>
                    <td style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{row.our_ref_number}</td>
                    <td style={{ fontWeight: 'bold' }}>{row.supplier_name}</td>
                    <td>{row.bill_number || '—'}</td>
                    <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{formatCurrency(row.grand_total)}</td>
                  </>
                )}
                {reportType === 'item_sales' && (
                  <>
                    <td style={{ fontFamily: 'monospace' }}>{row.item_code || '—'}</td>
                    <td style={{ fontWeight: 'bold' }}>{row.item_name}</td>
                    <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{renderQtySold(row)}</td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(row.selling_price || 0)}</td>
                    <td style={{ textAlign: 'right' }}>
                      {(row.bulk_conversion || 1) > 1 
                        ? formatCurrency((row.selling_price || 0) * row.bulk_conversion) 
                        : '—'}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{formatCurrency(row.total_revenue)}</td>
                  </>
                )}
                {reportType === 'sales_turnover' && (
                  <>
                    <td style={{ fontWeight: 'bold' }}>{row.client_display_name}</td>
                    <td>{row.contact_name || '—'}</td>
                    <td>{row.area || '—'}</td>
                    <td>{row.zone || '—'}</td>
                    <td style={{ textAlign: 'right' }}>{row.total_bills}</td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(row.total_subtotal)}</td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(row.total_tax)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{formatCurrency(row.total_turnover)}</td>
                  </>
                )}
                {reportType === 'purchase_turnover' && (
                  <>
                    <td style={{ fontWeight: 'bold' }}>{row.supplier_display_name}</td>
                    <td>{row.contact_name || '—'}</td>
                    <td>{row.area || '—'}</td>
                    <td>{row.zone || '—'}</td>
                    <td style={{ textAlign: 'right' }}>{row.total_bills}</td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(row.total_subtotal)}</td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(row.total_tax)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{formatCurrency(row.total_turnover)}</td>
                  </>
                )}
                {reportType === 'carriage_loading' && (
                  <>
                    <td style={{ fontFamily: 'monospace' }}>{row.item_code || '—'}</td>
                    <td style={{ fontWeight: 'bold' }}>{row.item_name}</td>
                    <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{renderQtySold(row)}</td>
                    <td style={{ fontSize: '10px' }}>{row.destinations || '—'}</td>
                  </>
                )}
                {reportType === 'customer_collections' && (
                  <>
                    <td>{formatDate(row.payment_date)}</td>
                    <td style={{ fontWeight: 'bold' }}>{row.client_store_name || row.client_name}</td>
                    <td>{row.area || '—'}</td>
                    <td>{row.zone || '—'}</td>
                    <td>{row.payment_mode?.toUpperCase()}</td>
                    <td style={{ fontFamily: 'monospace' }}>{row.reference_number || '—'}</td>
                    <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{formatCurrency(row.amount)}</td>
                  </>
                )}
                {reportType === 'area_sales' && (
                  <>
                    <td style={{ fontWeight: 'bold' }}>{row.area_name}</td>
                    <td style={{ textAlign: 'right' }}>{row.total_invoices} bills</td>
                    <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{formatCurrency(row.total_revenue)}</td>
                  </>
                )}
                {reportType === 'zone_sales' && (
                  <>
                    <td style={{ fontWeight: 'bold' }}>{row.zone_name}</td>
                    <td style={{ textAlign: 'right' }}>{row.total_invoices} bills</td>
                    <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{formatCurrency(row.total_revenue)}</td>
                  </>
                )}
                {reportType === 'stock_position' && (
                  <>
                    <td style={{ fontFamily: 'monospace' }}>{row.code || '—'}</td>
                    <td style={{ fontWeight: 'bold' }}>{row.name}</td>
                    <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{row.current_stock} {row.unit_name || 'Pcs'}</td>
                    <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{formatCurrency((row.current_stock || 0) * (row.selling_price || 0))}</td>
                  </>
                )}
                {reportType === 'reorder_items' && (
                  <>
                    <td style={{ fontFamily: 'monospace' }}>{row.code || '—'}</td>
                    <td style={{ fontWeight: 'bold', color: '#b91c1c' }}>{row.name}</td>
                    <td style={{ textAlign: 'right', fontWeight: 'bold', color: '#b91c1c' }}>{row.current_stock} {row.unit_name || 'Pcs'}</td>
                    <td style={{ textAlign: 'right' }}>{row.min_stock_level}</td>
                  </>
                )}
              </tr>
            ))}
            <tr className="print-summary-row">
              <td colSpan={
                ['sales_all','sales_cash','sales_credit'].includes(reportType) ? 5 :
                ['purchase_all','purchase_cash','purchase_credit'].includes(reportType) ? 5 :
                reportType === 'item_sales' ? 5 :
                reportType === 'area_sales' ? 2 :
                reportType === 'zone_sales' ? 2 :
                reportType === 'sales_turnover' ? 8 :
                reportType === 'purchase_turnover' ? 8 :
                reportType === 'carriage_loading' ? 3 :
                reportType === 'customer_collections' ? 7 :
                reportType === 'stock_position' ? 4 : 4
              } style={{ textAlign: 'right', paddingRight: '10px', fontWeight: 'bold' }}>
                Grand Total ({totals.count} items)
              </td>
              <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                {reportType === 'carriage_loading' ? (
                  <span style={{ color: '#002f6c' }}>
                    {totals.qtyBulk > 0 && `${totals.qtyBulk} Box`}
                    {totals.qtyBulk > 0 && totals.qtyPcs > 0 && ' + '}
                    {totals.qtyPcs > 0 && `${totals.qtyPcs} Pcs`}
                    {totals.qtyBulk === 0 && totals.qtyPcs === 0 && '0 Pcs'}
                  </span>
                ) : (
                  formatCurrency(totals.total)
                )}
              </td>
            </tr>
          </tbody>
        </table>

        <div style={{ marginTop: '60px', display: 'flex', justifyContent: 'space-between' }}>
          <div style={{ fontSize: '10px', color: '#555' }}>
            * This report is generated dynamically by Arun Traders Billing System
          </div>
          <div style={{ textAlign: 'center', width: '200px', borderTop: '1px dashed #000', paddingTop: '5px', fontSize: '11px', fontWeight: 'bold' }}>
            Authorized Signatory
          </div>
        </div>
      </div>

    </div>
  );
}
