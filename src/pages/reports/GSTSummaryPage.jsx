import React, { useState, useEffect, useMemo } from 'react';
import { Calendar, Download, RefreshCw, AlertTriangle, ArrowUpRight, ArrowDownLeft, Percent, Calculator } from 'lucide-react';
import { useApi } from '../../contexts/AuthContext';
import { useApp } from '../../contexts/AppContext';

export default function GSTSummaryPage() {
  const fetchApi = useApi();
  const { formatCurrency, formatDate, addToast } = useApp();

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState({
    salesGST: [],
    salesTotals: { taxable_amount: 0, cgst_amount: 0, sgst_amount: 0, igst_amount: 0, total_amount: 0 },
    purchasesGST: [],
    purchasesTotals: { taxable_amount: 0, cgst_amount: 0, sgst_amount: 0, igst_amount: 0, total_amount: 0 },
    netGSTPayable: { cgst: 0, sgst: 0, igst: 0, total: 0 }
  });

  // Date range selectors (default to current month)
  const todayStr = new Date().toISOString().split('T')[0];
  const firstDayOfMonthStr = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
  
  const [dateFrom, setDateFrom] = useState(firstDayOfMonthStr);
  const [dateTo, setDateTo] = useState(todayStr);

  const fetchGSTData = async () => {
    setLoading(true);
    try {
      let url = '/api/reports/gst-summary';
      const params = [];
      if (dateFrom) params.push(`date_from=${dateFrom}`);
      if (dateTo) params.push(`date_to=${dateTo}`);
      if (params.length) url += `?${params.join('&')}`;

      const res = await fetchApi(url);
      setData(res || {
        salesGST: [],
        salesTotals: { taxable_amount: 0, cgst_amount: 0, sgst_amount: 0, igst_amount: 0, total_amount: 0 },
        purchasesGST: [],
        purchasesTotals: { taxable_amount: 0, cgst_amount: 0, sgst_amount: 0, igst_amount: 0, total_amount: 0 },
        netGSTPayable: { cgst: 0, sgst: 0, igst: 0, total: 0 }
      });
    } catch (err) {
      console.error(err);
      addToast('error', 'Error', 'Failed to fetch GST tax summary');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGSTData();
  }, [dateFrom, dateTo]);

  // Aggregate GST collected vs paid totals
  const outwardGST = useMemo(() => {
    const t = data.salesTotals;
    return t.cgst_amount + t.sgst_amount + t.igst_amount;
  }, [data.salesTotals]);

  const inwardGST = useMemo(() => {
    const t = data.purchasesTotals;
    return t.cgst_amount + t.sgst_amount + t.igst_amount;
  }, [data.purchasesTotals]);

  // Export to CSV
  const handleExportCSV = () => {
    const lines = [];

    // Header Metadata
    lines.push(`"GST TAX SUMMARY REPORT"`);
    lines.push(`"Period: ${dateFrom} to ${dateTo}"`);
    lines.push('');

    // OUTWARD SUPPLIES (SALES)
    lines.push('"1. OUTWARD SUPPLIES (SALES GST BREAKDOWN)"');
    lines.push('GST Rate Slab,Taxable Value (₹),CGST Collected (₹),SGST Collected (₹),IGST Collected (₹),Total GST (₹)');
    data.salesGST.forEach(row => {
      const rowGST = (row.cgst_amount || 0) + (row.sgst_amount || 0) + (row.igst_amount || 0);
      lines.push(`${row.gst_rate}%,${row.taxable_amount.toFixed(2)},${row.cgst_amount.toFixed(2)},${row.sgst_amount.toFixed(2)},${row.igst_amount.toFixed(2)},${rowGST.toFixed(2)}`);
    });
    lines.push(`Total,${data.salesTotals.taxable_amount.toFixed(2)},${data.salesTotals.cgst_amount.toFixed(2)},${data.salesTotals.sgst_amount.toFixed(2)},${data.salesTotals.igst_amount.toFixed(2)},${outwardGST.toFixed(2)}`);
    lines.push('');

    // INWARD SUPPLIES (PURCHASES)
    lines.push('"2. INWARD SUPPLIES (PURCHASES GST BREAKDOWN / INPUT TAX CREDIT)"');
    lines.push('GST Rate Slab,Taxable Value (₹),CGST Paid (₹),SGST Paid (₹),IGST Paid (₹),Total GST (₹)');
    data.purchasesGST.forEach(row => {
      const rowGST = (row.cgst_amount || 0) + (row.sgst_amount || 0) + (row.igst_amount || 0);
      lines.push(`${row.gst_rate}%,${row.taxable_amount.toFixed(2)},${row.cgst_amount.toFixed(2)},${row.sgst_amount.toFixed(2)},${row.igst_amount.toFixed(2)},${rowGST.toFixed(2)}`);
    });
    lines.push(`Total,${data.purchasesTotals.taxable_amount.toFixed(2)},${data.purchasesTotals.cgst_amount.toFixed(2)},${data.purchasesTotals.sgst_amount.toFixed(2)},${data.purchasesTotals.igst_amount.toFixed(2)},${inwardGST.toFixed(2)}`);
    lines.push('');

    // NET RECONCILIATION
    lines.push('"3. NET GST RECONCILIATION"');
    lines.push('Tax Component,GST Collected (Outward) (₹),GST Paid (Inward/ITC) (₹),Net Payable (₹)');
    lines.push(`CGST,${data.salesTotals.cgst_amount.toFixed(2)},${data.purchasesTotals.cgst_amount.toFixed(2)},${data.netGSTPayable.cgst.toFixed(2)}`);
    lines.push(`SGST,${data.salesTotals.sgst_amount.toFixed(2)},${data.purchasesTotals.sgst_amount.toFixed(2)},${data.netGSTPayable.sgst.toFixed(2)}`);
    lines.push(`IGST,${data.salesTotals.igst_amount.toFixed(2)},${data.purchasesTotals.igst_amount.toFixed(2)},${data.netGSTPayable.igst.toFixed(2)}`);
    lines.push(`TOTAL,${outwardGST.toFixed(2)},${inwardGST.toFixed(2)},${data.netGSTPayable.total.toFixed(2)}`);

    const csvContent = lines.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `GST_Summary_Report_${dateFrom}_to_${dateTo}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addToast('success', 'Export Completed', 'GST tax report exported to CSV');
  };

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 className="page-title">GST Tax Summary</h1>
          <p className="page-subtitle">Outward supplies (Sales GST) vs. Inward supplies (Purchases GST / Input Tax Credit)</p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button className="btn btn-secondary" onClick={fetchGSTData} disabled={loading}>
            <RefreshCw size={16} className={loading ? 'spin' : ''} style={{ marginRight: 6 }} /> Reload
          </button>
          <button className="btn btn-primary" onClick={handleExportCSV}>
            <Download size={16} style={{ marginRight: 6 }} /> Export CSV
          </button>
        </div>
      </div>

      {/* Date Filters Row */}
      <div className="card" style={{ padding: 16, marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 14, color: 'var(--color-text-muted)' }}>From:</span>
            <input 
              type="date" 
              className="form-control" 
              value={dateFrom} 
              onChange={e => setDateFrom(e.target.value)} 
              style={{ padding: '6px 12px', minWidth: 150 }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 14, color: 'var(--color-text-muted)' }}>To:</span>
            <input 
              type="date" 
              className="form-control" 
              value={dateTo} 
              onChange={e => setDateTo(e.target.value)} 
              style={{ padding: '6px 12px', minWidth: 150 }}
            />
          </div>
          
          <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
            <button className="btn btn-ghost btn-sm" onClick={() => { setDateFrom(todayStr); setDateTo(todayStr); }}>
              Today
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => { setDateFrom(firstDayOfMonthStr); setDateTo(todayStr); }}>
              This Month
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => {
              const lastQuarterStart = new Date();
              // Back 90 days
              lastQuarterStart.setDate(lastQuarterStart.getDate() - 90);
              setDateFrom(lastQuarterStart.toISOString().split('T')[0]);
              setDateTo(todayStr);
            }}>
              Last 90 Days
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid-5" style={{ marginBottom: 24, gap: 16 }}>
        <div className="card card-kpi" style={{ borderLeft: '4px solid #3b82f6', padding: 16 }}>
          <div className="card-kpi-header" style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-text-muted)', marginBottom: 8, fontSize: 13 }}>
            <span>Outward Taxable (Sales)</span>
            <ArrowUpRight size={16} style={{ color: '#3b82f6' }} />
          </div>
          <h3 style={{ fontSize: 18, fontWeight: 'bold' }}>{formatCurrency(data.salesTotals.taxable_amount)}</h3>
          <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Net Taxable Sales</span>
        </div>

        <div className="card card-kpi" style={{ borderLeft: '4px solid #3b82f6', padding: 16 }}>
          <div className="card-kpi-header" style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-text-muted)', marginBottom: 8, fontSize: 13 }}>
            <span>Outward GST Collected</span>
            <Percent size={16} style={{ color: '#3b82f6' }} />
          </div>
          <h3 style={{ fontSize: 18, fontWeight: 'bold' }}>{formatCurrency(outwardGST)}</h3>
          <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>CGST+SGST+IGST</span>
        </div>

        <div className="card card-kpi" style={{ borderLeft: '4px solid #10b981', padding: 16 }}>
          <div className="card-kpi-header" style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-text-muted)', marginBottom: 8, fontSize: 13 }}>
            <span>Inward Taxable (Purchases)</span>
            <ArrowDownLeft size={16} style={{ color: '#10b981' }} />
          </div>
          <h3 style={{ fontSize: 18, fontWeight: 'bold' }}>{formatCurrency(data.purchasesTotals.taxable_amount)}</h3>
          <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Net Purchase Expenses</span>
        </div>

        <div className="card card-kpi" style={{ borderLeft: '4px solid #10b981', padding: 16 }}>
          <div className="card-kpi-header" style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-text-muted)', marginBottom: 8, fontSize: 13 }}>
            <span>Inward ITC (Paid)</span>
            <Percent size={16} style={{ color: '#10b981' }} />
          </div>
          <h3 style={{ fontSize: 18, fontWeight: 'bold' }}>{formatCurrency(inwardGST)}</h3>
          <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Input Tax Credit (ITC)</span>
        </div>

        {/* Net GST Card */}
        <div className="card card-kpi" style={{ borderLeft: `4px solid ${data.netGSTPayable.total >= 0 ? '#ef4444' : '#10b981'}`, padding: 16 }}>
          <div className="card-kpi-header" style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-text-muted)', marginBottom: 8, fontSize: 13 }}>
            <span>Net Tax Payable</span>
            <Calculator size={16} style={{ color: data.netGSTPayable.total >= 0 ? '#ef4444' : '#10b981' }} />
          </div>
          <h3 style={{ fontSize: 18, fontWeight: 'bold', color: data.netGSTPayable.total >= 0 ? '#ef4444' : '#10b981' }}>
            {formatCurrency(Math.abs(data.netGSTPayable.total))}
            {data.netGSTPayable.total < 0 && ' (Cr)'}
          </h3>
          <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
            {data.netGSTPayable.total >= 0 ? 'Payable to Government' : 'Credit Balance (ITC)'}
          </span>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', height: 200, justifyContent: 'center', alignItems: 'center', color: 'var(--color-text-muted)' }}>
          <RefreshCw size={24} className="spin" style={{ marginRight: 8 }} /> Calculating tax components...
        </div>
      ) : (
        <div className="grid-2" style={{ gap: 24, marginBottom: 24 }}>
          {/* Outward Sales table */}
          <div className="card" style={{ padding: 20 }}>
            <h3 style={{ fontSize: 15, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#3b82f6' }} /> Outward Supplies (GST Collected on Sales)
            </h3>
            {data.salesGST.length === 0 ? (
              <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                No taxable sales recorded in this period.
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table table-sm">
                  <thead>
                    <tr>
                      <th>Slab</th>
                      <th style={{ textAlign: 'right' }}>Taxable Sales</th>
                      <th style={{ textAlign: 'right' }}>CGST</th>
                      <th style={{ textAlign: 'right' }}>SGST</th>
                      <th style={{ textAlign: 'right' }}>IGST</th>
                      <th style={{ textAlign: 'right' }}>Tax Collected</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.salesGST.map(row => {
                      const totalCollected = (row.cgst_amount || 0) + (row.sgst_amount || 0) + (row.igst_amount || 0);
                      return (
                        <tr key={row.gst_rate}>
                          <td style={{ fontWeight: 'bold' }}>{row.gst_rate}%</td>
                          <td style={{ textAlign: 'right' }}>{formatCurrency(row.taxable_amount)}</td>
                          <td style={{ textAlign: 'right' }}>{formatCurrency(row.cgst_amount)}</td>
                          <td style={{ textAlign: 'right' }}>{formatCurrency(row.sgst_amount)}</td>
                          <td style={{ textAlign: 'right' }}>{formatCurrency(row.igst_amount)}</td>
                          <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{formatCurrency(totalCollected)}</td>
                        </tr>
                      );
                    })}
                    <tr style={{ fontWeight: 'bold', borderTop: '2px solid var(--color-border)', backgroundColor: 'rgba(255,255,255,0.01)' }}>
                      <td>Total</td>
                      <td style={{ textAlign: 'right' }}>{formatCurrency(data.salesTotals.taxable_amount)}</td>
                      <td style={{ textAlign: 'right' }}>{formatCurrency(data.salesTotals.cgst_amount)}</td>
                      <td style={{ textAlign: 'right' }}>{formatCurrency(data.salesTotals.sgst_amount)}</td>
                      <td style={{ textAlign: 'right' }}>{formatCurrency(data.salesTotals.igst_amount)}</td>
                      <td style={{ textAlign: 'right' }}>{formatCurrency(outwardGST)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Inward Purchases table */}
          <div className="card" style={{ padding: 20 }}>
            <h3 style={{ fontSize: 15, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#10b981' }} /> Inward Supplies (GST Paid / ITC on Purchases)
            </h3>
            {data.purchasesGST.length === 0 ? (
              <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                No purchases recorded in this period.
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table table-sm">
                  <thead>
                    <tr>
                      <th>Slab</th>
                      <th style={{ textAlign: 'right' }}>Taxable Cost</th>
                      <th style={{ textAlign: 'right' }}>CGST</th>
                      <th style={{ textAlign: 'right' }}>SGST</th>
                      <th style={{ textAlign: 'right' }}>IGST</th>
                      <th style={{ textAlign: 'right' }}>Tax Paid (ITC)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.purchasesGST.map(row => {
                      const totalPaid = (row.cgst_amount || 0) + (row.sgst_amount || 0) + (row.igst_amount || 0);
                      return (
                        <tr key={row.gst_rate}>
                          <td style={{ fontWeight: 'bold' }}>{row.gst_rate}%</td>
                          <td style={{ textAlign: 'right' }}>{formatCurrency(row.taxable_amount)}</td>
                          <td style={{ textAlign: 'right' }}>{formatCurrency(row.cgst_amount)}</td>
                          <td style={{ textAlign: 'right' }}>{formatCurrency(row.sgst_amount)}</td>
                          <td style={{ textAlign: 'right' }}>{formatCurrency(row.igst_amount)}</td>
                          <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{formatCurrency(totalPaid)}</td>
                        </tr>
                      );
                    })}
                    <tr style={{ fontWeight: 'bold', borderTop: '2px solid var(--color-border)', backgroundColor: 'rgba(255,255,255,0.01)' }}>
                      <td>Total</td>
                      <td style={{ textAlign: 'right' }}>{formatCurrency(data.purchasesTotals.taxable_amount)}</td>
                      <td style={{ textAlign: 'right' }}>{formatCurrency(data.purchasesTotals.cgst_amount)}</td>
                      <td style={{ textAlign: 'right' }}>{formatCurrency(data.purchasesTotals.sgst_amount)}</td>
                      <td style={{ textAlign: 'right' }}>{formatCurrency(data.purchasesTotals.igst_amount)}</td>
                      <td style={{ textAlign: 'right' }}>{formatCurrency(inwardGST)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Net GST Reconciliation calculation */}
      {!loading && (
        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ fontSize: 16, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Calculator size={18} /> Net GST Tax Reconciliation (CGST / SGST / IGST Breakdown)
          </h3>
          <div className="table-responsive">
            <table className="table" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th>GST Component</th>
                  <th style={{ textAlign: 'right' }}>GST Collected (Outward Sales)</th>
                  <th style={{ textAlign: 'right' }}>GST Paid (Inward Purchases / ITC)</th>
                  <th style={{ textAlign: 'right' }}>Net Payable Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ fontWeight: 'bold' }}>CGST (Central Tax)</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(data.salesTotals.cgst_amount)}</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(data.purchasesTotals.cgst_amount)}</td>
                  <td style={{ textAlign: 'right', fontWeight: 'bold', color: data.netGSTPayable.cgst >= 0 ? '#ef4444' : '#10b981' }}>
                    {formatCurrency(Math.abs(data.netGSTPayable.cgst))} {data.netGSTPayable.cgst < 0 && '(Credit)'}
                  </td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 'bold' }}>SGST (State Tax)</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(data.salesTotals.sgst_amount)}</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(data.purchasesTotals.sgst_amount)}</td>
                  <td style={{ textAlign: 'right', fontWeight: 'bold', color: data.netGSTPayable.sgst >= 0 ? '#ef4444' : '#10b981' }}>
                    {formatCurrency(Math.abs(data.netGSTPayable.sgst))} {data.netGSTPayable.sgst < 0 && '(Credit)'}
                  </td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 'bold' }}>IGST (Integrated Tax)</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(data.salesTotals.igst_amount)}</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(data.purchasesTotals.igst_amount)}</td>
                  <td style={{ textAlign: 'right', fontWeight: 'bold', color: data.netGSTPayable.igst >= 0 ? '#ef4444' : '#10b981' }}>
                    {formatCurrency(Math.abs(data.netGSTPayable.igst))} {data.netGSTPayable.igst < 0 && '(Credit)'}
                  </td>
                </tr>
                <tr style={{ fontWeight: 'bold', borderTop: '2px solid var(--color-border)', backgroundColor: 'rgba(255,255,255,0.02)' }}>
                  <td>TOTAL NET TAX</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(outwardGST)}</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(inwardGST)}</td>
                  <td style={{ textAlign: 'right', fontSize: 16, color: data.netGSTPayable.total >= 0 ? '#ef4444' : '#10b981' }}>
                    {formatCurrency(Math.abs(data.netGSTPayable.total))} {data.netGSTPayable.total < 0 ? '(Tax Credit Balance)' : '(Net Tax Payable)'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
