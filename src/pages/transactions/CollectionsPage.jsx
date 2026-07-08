import React, { useState, useEffect, useMemo } from 'react';
import {
  Search, Save, Plus, RefreshCw, ClipboardList, Wallet,
  Trash2, Printer, FileText, CheckCircle2, AlertCircle, ChevronRight
} from 'lucide-react';
import { useApi } from '../../contexts/AuthContext';
import { useApp } from '../../contexts/AppContext';

export default function CollectionsPage() {
  const fetchApi = useApi();
  const { formatCurrency, formatDate, addToast, company } = useApp();

  const [collections, setCollections]   = useState([]);
  const [clients, setClients]           = useState([]);
  const [loading, setLoading]           = useState(false);
  // 'list' | 'general' | 'invoice'
  const [activeTab, setActiveTab]       = useState('list');

  // ── Filters ──────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery]     = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo]   = useState('');
  const [filterClient, setFilterClient]   = useState('');

  // ── Shared form state ─────────────────────────────────────────────
  const [paymentDate, setPaymentDate]       = useState(new Date().toISOString().split('T')[0]);
  const [selectedClient, setSelectedClient] = useState(null);
  const [clientSearch, setClientSearch]     = useState('');
  const [showClientSearch, setShowClientSearch] = useState(false);
  const [clientResults, setClientResults]   = useState([]);
  const [amount, setAmount]                 = useState('');
  const [paymentMode, setPaymentMode]       = useState('cash');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [notes, setNotes]                   = useState('');
  const [submitting, setSubmitting]         = useState(false);
  const [printReceiptData, setPrintReceiptData] = useState(null);

  // ── Invoice-specific state ────────────────────────────────────────
  const [pendingInvoices, setPendingInvoices] = useState([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);

  // ─────────────────────────────────────────────────────────────────
  const fetchCollections = async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (filterDateFrom) q.append('date_from', filterDateFrom);
      if (filterDateTo)   q.append('date_to',   filterDateTo);
      if (filterClient)   q.append('client_id', filterClient);
      const res = await fetchApi(`/api/collections?${q.toString()}`);
      setCollections(res || []);
    } catch (err) {
      addToast('error', 'Error', 'Failed to load collections list');
    } finally {
      setLoading(false);
    }
  };

  const fetchParameters = async () => {
    try {
      const res = await fetchApi('/api/reports/trading-parameters');
      setClients(res.clients || []);
    } catch {}
  };

  useEffect(() => {
    fetchCollections();
    fetchParameters();
  }, [filterDateFrom, filterDateTo, filterClient]);

  // Client live search
  useEffect(() => {
    if (clientSearch.length < 1) { setClientResults([]); return; }
    const t = setTimeout(() => {
      const term = clientSearch.toLowerCase();
      setClientResults(
        clients.filter(c =>
          c.name.toLowerCase().includes(term) ||
          (c.store_name || '').toLowerCase().includes(term) ||
          (c.code || '').toLowerCase().includes(term)
        ).slice(0, 10)
      );
    }, 200);
    return () => clearTimeout(t);
  }, [clientSearch, clients]);

  // When a client is selected, load their latest balance + pending invoices
  const selectClient = async (c) => {
    setSelectedClient(c);
    setClientSearch(c.store_name || c.name);
    setShowClientSearch(false);
    setClientResults([]);
    setSelectedInvoice(null);
    setPendingInvoices([]);
    try {
      const fresh = await fetchApi(`/api/clients/${c.id}`);
      setSelectedClient(fresh);
    } catch {}
    if (activeTab === 'invoice') {
      loadPendingInvoices(c.id);
    }
  };

  const loadPendingInvoices = async (clientId) => {
    setLoadingInvoices(true);
    try {
      const invs = await fetchApi(`/api/clients/${clientId}/invoices`);
      setPendingInvoices(invs || []);
    } catch {
      addToast('error', 'Error', 'Could not load pending invoices');
    } finally {
      setLoadingInvoices(false);
    }
  };

  // Re-load pending invoices whenever tab switches to 'invoice' and client already chosen
  useEffect(() => {
    if (activeTab === 'invoice' && selectedClient) {
      loadPendingInvoices(selectedClient.id);
    }
    if (activeTab !== 'invoice') {
      setSelectedInvoice(null);
      setPendingInvoices([]);
    }
  }, [activeTab]);

  // When user picks an invoice, auto-fill amount with remaining balance_due
  const pickInvoice = (inv) => {
    setSelectedInvoice(inv);
    setAmount(inv.balance_due.toFixed(2));
  };

  const resetForm = () => {
    setAmount('');
    setReferenceNumber('');
    setNotes('');
    setSelectedClient(null);
    setClientSearch('');
    setSelectedInvoice(null);
    setPendingInvoices([]);
  };

  // ── Save General Payment ───────────────────────────────────────────
  const handleSaveCollection = async (e) => {
    e.preventDefault();
    if (!selectedClient) { addToast('error', 'Validation', 'Please select a customer'); return; }
    if (!amount || isNaN(amount) || Number(amount) <= 0) { addToast('error', 'Validation', 'Enter a valid amount'); return; }

    setSubmitting(true);
    try {
      const result = await fetchApi('/api/collections', {
        method: 'POST',
        body: JSON.stringify({
          client_id: selectedClient.id,
          payment_date: paymentDate,
          amount: Number(amount),
          payment_mode: paymentMode,
          reference_number: referenceNumber.trim(),
          notes: notes.trim()
        })
      });
      addToast('success', 'Payment Saved', `Receipt recorded for ${selectedClient.store_name || selectedClient.name}`);
      fetchCollections();
      fetchParameters();
      setPrintReceiptData(result);
      setTimeout(() => window.print(), 100);
      resetForm();
      setActiveTab('list');
    } catch (err) {
      addToast('error', 'Failed', err.message || 'Server error');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Save Invoice-Specific Payment ─────────────────────────────────
  const handleSaveInvoicePayment = async (e) => {
    e.preventDefault();
    if (!selectedClient)  { addToast('error', 'Validation', 'Please select a customer'); return; }
    if (!selectedInvoice) { addToast('error', 'Validation', 'Please select an invoice'); return; }
    if (!amount || isNaN(amount) || Number(amount) <= 0) { addToast('error', 'Validation', 'Enter a valid amount'); return; }
    if (Number(amount) > selectedInvoice.balance_due) {
      addToast('error', 'Validation', `Amount cannot exceed invoice balance of ${formatCurrency(selectedInvoice.balance_due)}`);
      return;
    }

    setSubmitting(true);
    try {
      const result = await fetchApi('/api/collections', {
        method: 'POST',
        body: JSON.stringify({
          client_id: selectedClient.id,
          invoice_id: selectedInvoice.id,
          payment_date: paymentDate,
          amount: Number(amount),
          payment_mode: paymentMode,
          reference_number: referenceNumber.trim(),
          notes: notes.trim() || `Payment against ${selectedInvoice.invoice_number}`
        })
      });
      addToast('success', 'Invoice Payment Saved', `₹${Number(amount).toFixed(2)} applied to ${selectedInvoice.invoice_number}`);
      fetchCollections();
      fetchParameters();
      setPrintReceiptData(result);
      setTimeout(() => window.print(), 100);
      resetForm();
      setActiveTab('list');
    } catch (err) {
      addToast('error', 'Failed', err.message || 'Server error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteCollection = async (id, clientName, amt) => {
    if (!window.confirm(`Delete and revert payment of ${formatCurrency(amt)} from ${clientName}?`)) return;
    try {
      await fetchApi(`/api/collections/${id}`, { method: 'DELETE' });
      addToast('success', 'Payment Reverted', 'Payment deleted and balance restored.');
      fetchCollections();
      fetchParameters();
    } catch (err) {
      addToast('error', 'Revert Failed', err.message);
    }
  };

  const handlePrintReceipt = (col) => {
    setPrintReceiptData(col);
    setTimeout(() => window.print(), 100);
  };

  const filteredCollections = useMemo(() => {
    if (!searchQuery.trim()) return collections;
    const q = searchQuery.toLowerCase();
    return collections.filter(c =>
      (c.client_name || '').toLowerCase().includes(q) ||
      (c.client_store_name || '').toLowerCase().includes(q) ||
      (c.client_code || '').toLowerCase().includes(q) ||
      (c.payment_mode || '').toLowerCase().includes(q) ||
      (c.reference_number || '').toLowerCase().includes(q) ||
      (c.linked_invoice_number || '').toLowerCase().includes(q) ||
      (c.notes || '').toLowerCase().includes(q)
    );
  }, [collections, searchQuery]);

  const totalCollected = filteredCollections.reduce((s, c) => s + (c.amount || 0), 0);

  // ── Shared customer picker block ──────────────────────────────────
  const CustomerPicker = () => (
    <>
      <div className="form-group" style={{ position: 'relative' }}>
        <label className="form-label" style={{ fontWeight: 600 }}>Select Customer</label>
        <div className="input-with-icon">
          <Search size={16} />
          <input
            type="text"
            className="form-control"
            placeholder="Type store name, owner name or code..."
            value={clientSearch}
            onChange={e => { setClientSearch(e.target.value); setShowClientSearch(true); }}
            onFocus={() => clientSearch.length >= 1 && setShowClientSearch(true)}
          />
        </div>
        {showClientSearch && clientResults.length > 0 && (
          <div className="item-search-popup" style={{ zIndex: 100, width: '100%' }}>
            {clientResults.map(c => (
              <div key={c.id} className="search-result-item" onClick={() => selectClient(c)}>
                <span>
                  <span className="item-name">{c.store_name || c.name}</span>
                  <span className="item-code" style={{ marginLeft: 8 }}>{c.code}</span>
                </span>
                <span style={{ fontSize: '0.72rem', color: (c.current_balance || 0) > 0 ? '#ef4444' : 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  Bal: {formatCurrency(c.current_balance || 0)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedClient && (
        <div style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-primary)',
          borderRadius: 8,
          padding: '12px 16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text-muted)' }}>Customer</div>
            <strong style={{ color: 'var(--text-primary)', fontSize: '0.9rem' }}>{selectedClient.store_name || selectedClient.name}</strong>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text-muted)' }}>Outstanding Balance</div>
            <strong style={{
              fontSize: '1.1rem',
              fontFamily: 'var(--font-mono)',
              color: selectedClient.current_balance > 0 ? '#ef4444' : selectedClient.current_balance < 0 ? '#10b981' : 'var(--text-primary)'
            }}>
              {formatCurrency(selectedClient.current_balance || 0)}
            </strong>
          </div>
        </div>
      )}
    </>
  );

  // ── Shared payment detail fields ──────────────────────────────────
  const PaymentFields = ({ maxAmount }) => (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="form-group">
          <label className="form-label" style={{ fontWeight: 600 }}>Payment Date</label>
          <input type="date" className="form-control" value={paymentDate}
            onChange={e => setPaymentDate(e.target.value)} required />
        </div>
        <div className="form-group">
          <label className="form-label" style={{ fontWeight: 600 }}>
            Amount Received (₹){maxAmount != null && <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}> — max {formatCurrency(maxAmount)}</span>}
          </label>
          <input
            type="number" className="form-control" placeholder="0.00"
            value={amount} onChange={e => setAmount(e.target.value)}
            min="0.01" max={maxAmount || undefined} step="0.01" required
            style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--accent-green)' }}
          />
        </div>
      </div>

      <div className="form-group">
        <label className="form-label" style={{ fontWeight: 600 }}>Payment Mode</label>
        <div className="toggle-group" style={{ display: 'flex', width: '100%' }}>
          {['cash', 'upi', 'bank', 'card', 'cheque'].map(m => (
            <button key={m} type="button"
              className={paymentMode === m ? 'active' : ''}
              onClick={() => setPaymentMode(m)}
              style={{ flex: 1, padding: '10px 0', textTransform: 'uppercase', fontSize: '0.78rem', fontWeight: 600 }}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      <div className="form-group">
        <label className="form-label" style={{ fontWeight: 600 }}>Cheque / Transaction / Ref Number</label>
        <input type="text" className="form-control" placeholder="e.g. UTR / Cheque / Txn ID"
          value={referenceNumber} onChange={e => setReferenceNumber(e.target.value)} />
      </div>

      <div className="form-group">
        <label className="form-label" style={{ fontWeight: 600 }}>Narration / Notes</label>
        <textarea className="textarea" placeholder="Optional details..." value={notes}
          onChange={e => setNotes(e.target.value)} rows={2} />
      </div>
    </>
  );

  return (
    <div style={{ animation: 'fadeIn 0.3s ease' }}>

      {/* Print styles */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .printable-payment-receipt, .printable-payment-receipt * { visibility: visible; }
          .printable-payment-receipt {
            position: absolute; left: 0; top: 0; width: 100%;
            display: block !important; color: #000 !important;
            font-family: 'Courier New', monospace; padding: 10px;
          }
          .card, .page-header, .sidebar, .header-bar, .toast { display: none !important; }
        }
      `}</style>

      {/* Header */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 className="page-title">Customer Payments (Collections)</h1>
          <p className="page-subtitle">Receive money from credit customers — general or invoice-specific</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {[
            { id: 'list',    icon: <ClipboardList size={15} />, label: 'Payment History' },
            { id: 'general', icon: <Wallet size={15} />,       label: 'General Payment' },
            { id: 'invoice', icon: <FileText size={15} />,     label: 'Pay Invoice' },
          ].map(t => (
            <button key={t.id}
              className={`btn ${activeTab === t.id ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveTab(t.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── HISTORY TAB ──────────────────────────────────────────── */}
      {activeTab === 'list' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="card" style={{ padding: '14px 18px' }}>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)' }}>From:</label>
                  <input type="date" className="input input-sm" style={{ width: 140 }} value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)' }}>To:</label>
                  <input type="date" className="input input-sm" style={{ width: 140 }} value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)' }}>Customer:</label>
                  <select className="input input-sm" style={{ width: 180 }} value={filterClient} onChange={e => setFilterClient(e.target.value)}>
                    <option value="">All Customers</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.store_name || c.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="search-box" style={{ maxWidth: 280, margin: 0 }}>
                <Search size={16} />
                <input type="text" placeholder="Search receipts..." className="form-control"
                  value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 15, fontWeight: 600 }}>Collections Log ({filteredCollections.length} entries)</h3>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                Total: <strong style={{ color: 'var(--accent-green)', fontSize: '1rem', marginLeft: 6 }}>{formatCurrency(totalCollected)}</strong>
              </div>
            </div>

            {loading ? (
              <div style={{ display: 'flex', height: 250, justifyContent: 'center', alignItems: 'center', color: 'var(--text-muted)' }}>
                <RefreshCw size={24} className="spin" style={{ marginRight: 8 }} /> Loading...
              </div>
            ) : filteredCollections.length === 0 ? (
              <div style={{ display: 'flex', height: 250, flexDirection: 'column', justifyContent: 'center', alignItems: 'center', color: 'var(--text-muted)', gap: 8 }}>
                <Wallet size={32} style={{ opacity: 0.3 }} />
                <span>No payment receipts found</span>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table">
                  <thead>
                    <tr>
                      <th style={{ width: 100 }}>Date</th>
                      <th>Customer</th>
                      <th>Linked Invoice</th>
                      <th style={{ width: 90 }}>Mode</th>
                      <th>Reference</th>
                      <th>Notes</th>
                      <th className="text-right" style={{ width: 120 }}>Amount</th>
                      <th className="text-center" style={{ width: 90 }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCollections.map(col => (
                      <tr key={col.id}>
                        <td>{formatDate(col.payment_date)}</td>
                        <td style={{ fontWeight: 600 }}>
                          {col.client_store_name || col.client_name}
                          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginLeft: 8, fontFamily: 'var(--font-mono)' }}>({col.client_code})</span>
                        </td>
                        <td>
                          {col.linked_invoice_number ? (
                            <span style={{ fontSize: '0.74rem', fontFamily: 'var(--font-mono)', background: 'var(--bg-secondary)', padding: '2px 8px', borderRadius: 4, border: '1px solid var(--border-primary)' }}>
                              {col.linked_invoice_number}
                            </span>
                          ) : (
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>General</span>
                          )}
                        </td>
                        <td>
                          <span className={`badge ${col.payment_mode === 'cash' ? 'badge-success' : col.payment_mode === 'upi' ? 'badge-info' : 'badge-neutral'}`}>
                            {col.payment_mode?.toUpperCase()}
                          </span>
                        </td>
                        <td className="text-mono" style={{ fontSize: '0.74rem' }}>{col.reference_number || '—'}</td>
                        <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)', maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{col.notes || '—'}</td>
                        <td className="text-right text-mono" style={{ fontWeight: 700, color: 'var(--accent-green)' }}>{formatCurrency(col.amount)}</td>
                        <td className="text-center">
                          <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                            <button className="btn btn-ghost btn-xs" onClick={() => handlePrintReceipt(col)} title="Print Receipt" style={{ padding: 4 }}>
                              <Printer size={13} />
                            </button>
                            <button className="btn btn-ghost btn-xs" title="Delete & Revert"
                              onClick={() => handleDeleteCollection(col.id, col.client_store_name || col.client_name, col.amount)}
                              style={{ padding: 4, color: 'var(--accent-red)' }}>
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── GENERAL PAYMENT TAB ───────────────────────────────────── */}
      {activeTab === 'general' && (
        <div style={{ maxWidth: 680, margin: '0 auto' }}>
          <div className="card" style={{ padding: 28 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>General Payment Receipt</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 20 }}>
              Record a payment against the customer's total outstanding balance (not tied to any specific invoice).
            </p>

            <form onSubmit={handleSaveCollection} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <CustomerPicker />
              <PaymentFields />

              {selectedClient && amount && !isNaN(amount) && (
                <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', textAlign: 'center', background: 'rgba(16,185,129,0.06)', padding: '8px 12px', borderRadius: 6, border: '1px solid rgba(16,185,129,0.15)' }}>
                  Balance will reduce from <strong>{formatCurrency(selectedClient.current_balance)}</strong> to{' '}
                  <strong style={{ color: 'var(--accent-green)' }}>{formatCurrency(selectedClient.current_balance - Number(amount))}</strong>
                </div>
              )}

              <button type="submit" className="btn btn-primary"
                style={{ width: '100%', padding: '12px 0', fontSize: '0.9rem', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 10 }}
                disabled={submitting || !selectedClient}>
                <Save size={18} /> {submitting ? 'Saving...' : 'Save & Print Receipt'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── INVOICE-SPECIFIC PAYMENT TAB ─────────────────────────── */}
      {activeTab === 'invoice' && (
        <div style={{ maxWidth: 800, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Step 1 — Customer */}
          <div className="card" style={{ padding: 24 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ background: 'var(--accent-blue)', color: '#fff', borderRadius: '50%', width: 22, height: 22, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800 }}>1</span>
              Select Customer
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <CustomerPicker />
            </div>
          </div>

          {/* Step 2 — Invoice Picker */}
          {selectedClient && (
            <div className="card" style={{ padding: 24 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ background: 'var(--accent-blue)', color: '#fff', borderRadius: '50%', width: 22, height: 22, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800 }}>2</span>
                Select Pending Invoice
              </h3>

              {loadingInvoices ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-muted)', padding: '20px 0' }}>
                  <RefreshCw size={18} className="spin" /> Loading pending invoices...
                </div>
              ) : pendingInvoices.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '24px 0', color: 'var(--text-muted)' }}>
                  <CheckCircle2 size={32} style={{ color: 'var(--accent-green)', opacity: 0.6 }} />
                  <span style={{ fontWeight: 600 }}>No outstanding credit invoices</span>
                  <span style={{ fontSize: '0.78rem' }}>This customer has no unpaid credit invoices.</span>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {pendingInvoices.map(inv => {
                    const isSelected = selectedInvoice?.id === inv.id;
                    const isPaid = inv.balance_due <= 0;
                    return (
                      <div key={inv.id}
                        onClick={() => !isPaid && pickInvoice(inv)}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '12px 16px', borderRadius: 10, cursor: isPaid ? 'default' : 'pointer',
                          border: `2px solid ${isSelected ? 'var(--accent-blue)' : 'var(--border-primary)'}`,
                          background: isSelected ? 'rgba(99,102,241,0.05)' : 'var(--bg-secondary)',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                          <div style={{
                            width: 20, height: 20, borderRadius: '50%',
                            border: `2px solid ${isSelected ? 'var(--accent-blue)' : 'var(--border-primary)'}`,
                            background: isSelected ? 'var(--accent-blue)' : 'transparent',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                          }}>
                            {isSelected && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#fff' }} />}
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', fontSize: '0.88rem' }}>{inv.invoice_number}</div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>
                              Date: {formatDate(inv.invoice_date)} &nbsp;|&nbsp; Invoice Total: {formatCurrency(inv.grand_total)}
                              {inv.amount_paid > 0 && <> &nbsp;|&nbsp; Paid: {formatCurrency(inv.amount_paid)}</>}
                            </div>
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: 0.5 }}>Balance Due</div>
                          <div style={{ fontWeight: 800, fontSize: '1rem', fontFamily: 'var(--font-mono)', color: '#ef4444' }}>
                            {formatCurrency(inv.balance_due)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Step 3 — Payment Details */}
          {selectedInvoice && (
            <div className="card" style={{ padding: 24 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ background: 'var(--accent-blue)', color: '#fff', borderRadius: '50%', width: 22, height: 22, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800 }}>3</span>
                Enter Payment Details
              </h3>

              {/* Invoice summary pill */}
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 20, padding: '10px 14px', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8 }}>
                <AlertCircle size={16} style={{ color: '#ef4444', flexShrink: 0 }} />
                <span style={{ fontSize: '0.8rem' }}>
                  Paying against invoice <strong>{selectedInvoice.invoice_number}</strong> &nbsp;—&nbsp;
                  Balance due: <strong style={{ color: '#ef4444' }}>{formatCurrency(selectedInvoice.balance_due)}</strong>
                </span>
              </div>

              <form onSubmit={handleSaveInvoicePayment} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                <PaymentFields maxAmount={selectedInvoice.balance_due} />

                {amount && !isNaN(amount) && Number(amount) > 0 && Number(amount) <= selectedInvoice.balance_due && (
                  <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', textAlign: 'center', background: 'rgba(16,185,129,0.06)', padding: '8px 12px', borderRadius: 6, border: '1px solid rgba(16,185,129,0.15)' }}>
                    Invoice balance will reduce from <strong>{formatCurrency(selectedInvoice.balance_due)}</strong> to{' '}
                    <strong style={{ color: 'var(--accent-green)' }}>{formatCurrency(selectedInvoice.balance_due - Number(amount))}</strong>
                    {Number(amount) >= selectedInvoice.balance_due && <> &nbsp;<span style={{ color: 'var(--accent-green)', fontWeight: 700 }}>✓ Fully settled</span></>}
                  </div>
                )}

                <button type="submit" className="btn btn-primary"
                  style={{ width: '100%', padding: '12px 0', fontSize: '0.9rem', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                  disabled={submitting || !selectedClient || !selectedInvoice}>
                  <Save size={18} /> {submitting ? 'Saving...' : `Pay ${amount ? formatCurrency(Number(amount)) : ''} Against ${selectedInvoice.invoice_number}`}
                </button>
              </form>
            </div>
          )}
        </div>
      )}

      {/* ── Printable Receipt ────────────────────────────────────── */}
      {printReceiptData && (
        <div className="printable-payment-receipt" style={{ display: 'none' }}>
          <div style={{ textAlign: 'center', borderBottom: '2px solid #000', paddingBottom: '10px', marginBottom: '15px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 'bold', margin: '2px 0' }}>{company?.name || 'SURIYA MALIGAI'}</h2>
            <p style={{ fontSize: '11px', margin: '2px 0' }}>{company?.address_line1 || ''} {company?.address_line2 || ''}</p>
            <p style={{ fontSize: '11px', margin: '2px 0' }}>Phone: {company?.phone || ''} | GSTIN: {company?.gstin || ''}</p>
            <h3 style={{ fontSize: '15px', fontWeight: 'bold', border: '1px solid #000', display: 'inline-block', padding: '3px 15px', marginTop: '10px' }}>PAYMENT RECEIPT</h3>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '15px' }}>
            <div>
              <p><strong>Receipt No:</strong> REC{printReceiptData.id?.toString().padStart(6, '0')}</p>
              <p><strong>Received From:</strong></p>
              <p style={{ fontSize: '14px', fontWeight: 'bold', marginLeft: '10px' }}>{printReceiptData.client_store_name || printReceiptData.client_name}</p>
              <p style={{ marginLeft: '10px' }}>Customer Code: {printReceiptData.client_code}</p>
              {printReceiptData.linked_invoice_number && (
                <p style={{ marginLeft: '10px', marginTop: '6px' }}><strong>Against Invoice:</strong> {printReceiptData.linked_invoice_number}</p>
              )}
            </div>
            <div style={{ textAlign: 'right' }}>
              <p><strong>Date:</strong> {formatDate(printReceiptData.payment_date)}</p>
              <p><strong>Time:</strong> {new Date(printReceiptData.created_at || Date.now()).toLocaleTimeString('en-IN')}</p>
            </div>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000', fontSize: '12px', marginBottom: '15px' }}>
            <thead>
              <tr style={{ background: '#f2f2f2', borderBottom: '1px solid #000' }}>
                <th style={{ padding: '6px', textAlign: 'left', borderRight: '1px solid #000' }}>Description</th>
                <th style={{ padding: '6px', textAlign: 'right', width: '150px' }}>Amount Paid</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ height: '80px', verticalAlign: 'top' }}>
                <td style={{ padding: '8px', borderRight: '1px solid #000' }}>
                  <p>Payment received with thanks.</p>
                  <p style={{ fontSize: '11px', color: '#555', marginTop: '10px' }}>
                    <strong>Mode:</strong> {printReceiptData.payment_mode?.toUpperCase()}
                    {printReceiptData.reference_number && ` | Ref No: ${printReceiptData.reference_number}`}
                  </p>
                  {printReceiptData.notes && <p style={{ fontSize: '11px', color: '#555' }}><strong>Note:</strong> {printReceiptData.notes}</p>}
                </td>
                <td style={{ padding: '8px', textAlign: 'right', fontWeight: 'bold', fontSize: '14px', fontFamily: 'monospace' }}>
                  {formatCurrency(printReceiptData.amount)}
                </td>
              </tr>
              <tr style={{ borderTop: '1px solid #000', background: '#f2f2f2', fontWeight: 'bold' }}>
                <td style={{ padding: '6px', textAlign: 'right', borderRight: '1px solid #000' }}>Total Amount:</td>
                <td style={{ padding: '6px', textAlign: 'right', fontSize: '14px', fontFamily: 'monospace' }}>{formatCurrency(printReceiptData.amount)}</td>
              </tr>
            </tbody>
          </table>

          <div style={{ marginTop: '40px', display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
            <div><p><i>* This is a computer generated receipt. Signature not required.</i></p></div>
            <div style={{ textAlign: 'center', width: '180px', borderTop: '1px dashed #000', paddingTop: '5px', fontWeight: 'bold' }}>
              For {company?.name || 'Arun Traders'}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
