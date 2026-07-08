import React, { useState, useEffect, useMemo } from 'react';
import { Search, Save, Plus, RefreshCw, ClipboardList, Wallet, FileText, CheckCircle } from 'lucide-react';
import { useApi } from '../../contexts/AuthContext';
import { useApp } from '../../contexts/AppContext';

export default function VouchersPage() {
  const fetchApi = useApi();
  const { formatCurrency, formatDate, addToast } = useApp();

  const [vouchers, setVouchers] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('list'); // 'list' or 'create'

  // Search filter
  const [searchQuery, setSearchQuery] = useState('');

  // Form State
  const [voucherDate, setVoucherDate] = useState(new Date().toISOString().split('T')[0]);
  const [voucherType, setVoucherType] = useState('cash_receipt');
  const [debitAccountId, setDebitAccountId] = useState('');
  const [creditAccountId, setCreditAccountId] = useState('');
  const [amount, setAmount] = useState('');
  const [narration, setNarration] = useState('');
  
  // Cheque info for bank transactions
  const [chequeNumber, setChequeNumber] = useState('');
  const [chequeDate, setChequeDate] = useState('');
  const [bankName, setBankName] = useState('');

  const [submitting, setSubmitting] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const vRes = await fetchApi('/api/vouchers');
      setVouchers(vRes || []);

      const aRes = await fetchApi('/api/accounts');
      setAccounts(aRes || []);
    } catch (err) {
      console.error(err);
      addToast('error', 'Error', 'Failed to load accounts and vouchers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredVouchers = useMemo(() => {
    return vouchers.filter(v => {
      const term = searchQuery.toLowerCase();
      return (
        v.voucher_number.toLowerCase().includes(term) ||
        (v.narration || '').toLowerCase().includes(term) ||
        (v.debit_account_name || '').toLowerCase().includes(term) ||
        (v.credit_account_name || '').toLowerCase().includes(term)
      );
    });
  }, [vouchers, searchQuery]);

  // Handle Type Change to auto-suggest standard debit/credit accounts
  // cash_receipt: Debit = Cash (ACC001), Credit = user-selected
  // cash_payment: Debit = user-selected, Credit = Cash (ACC001)
  // bank_receipt: Debit = Bank (ACC002), Credit = user-selected
  // bank_payment: Debit = user-selected, Credit = Bank (ACC002)
  useEffect(() => {
    if (!accounts.length) return;
    const cashAcc = accounts.find(a => a.code === 'ACC001')?.id || '';
    const bankAcc = accounts.find(a => a.code === 'ACC002')?.id || '';

    if (voucherType === 'cash_receipt') {
      setDebitAccountId(cashAcc);
      setCreditAccountId('');
    } else if (voucherType === 'cash_payment') {
      setDebitAccountId('');
      setCreditAccountId(cashAcc);
    } else if (voucherType === 'bank_receipt') {
      setDebitAccountId(bankAcc);
      setCreditAccountId('');
    } else if (voucherType === 'bank_payment') {
      setDebitAccountId('');
      setCreditAccountId(bankAcc);
    }
  }, [voucherType, accounts]);

  const handleSaveVoucher = async (e) => {
    e.preventDefault();
    if (!debitAccountId || !creditAccountId) {
      addToast('error', 'Validation Error', 'Please select both debit and credit accounts');
      return;
    }
    if (debitAccountId === creditAccountId) {
      addToast('error', 'Validation Error', 'Debit and Credit accounts cannot be the same');
      return;
    }
    if (!amount || isNaN(amount) || Number(amount) <= 0) {
      addToast('error', 'Validation Error', 'Please enter a valid positive amount');
      return;
    }

    setSubmitting(true);
    try {
      const newVoucher = await fetchApi('/api/vouchers', {
        method: 'POST',
        body: JSON.stringify({
          voucher_date: voucherDate,
          voucher_type: voucherType,
          debit_account_id: Number(debitAccountId),
          credit_account_id: Number(creditAccountId),
          amount: Number(amount),
          narration: narration.trim(),
          cheque_number: chequeNumber,
          cheque_date: chequeDate,
          bank_name: bankName
        })
      });

      addToast('success', 'Success', `Voucher ${newVoucher.voucher_number} created successfully`);
      
      // Update lists and refresh balances
      fetchData();

      // Reset form
      setAmount('');
      setNarration('');
      setChequeNumber('');
      setChequeDate('');
      setBankName('');
      setActiveTab('list');
    } catch (err) {
      console.error(err);
      addToast('error', 'Failed', err.message || 'Server error');
    } finally {
      setSubmitting(false);
    }
  };

  const isBankTransaction = ['bank_receipt', 'bank_payment'].includes(voucherType);

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 className="page-title">Vouchers & Accounts</h1>
          <p className="page-subtitle">Record cash and bank receipts, payments, and view accounting ledgers</p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button 
            className={`btn ${activeTab === 'list' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('list')}
          >
            <ClipboardList size={16} style={{ marginRight: 6 }} /> Voucher List
          </button>
          <button 
            className={`btn ${activeTab === 'create' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('create')}
          >
            <Plus size={16} style={{ marginRight: 6 }} /> Create Voucher
          </button>
        </div>
      </div>

      {activeTab === 'list' ? (
        <div className="grid-3" style={{ gap: 24 }}>
          {/* Main List */}
          <div className="card col-span-2" style={{ padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 16 }}>Transaction Ledger</h3>
              <div className="search-box" style={{ maxWidth: 280, margin: 0 }}>
                <Search size={16} />
                <input 
                  type="text" 
                  placeholder="Search vouchers..." 
                  className="form-control"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            {loading ? (
              <div style={{ display: 'flex', height: 250, justifyContent: 'center', alignItems: 'center', color: 'var(--color-text-muted)' }}>
                <RefreshCw size={24} className="spin" style={{ marginRight: 8 }} /> Loading transactions...
              </div>
            ) : filteredVouchers.length === 0 ? (
              <div style={{ display: 'flex', height: 250, justifyContent: 'center', alignItems: 'center', color: 'var(--color-text-muted)' }}>
                No vouchers found
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Voucher No</th>
                      <th>Date</th>
                      <th>Type</th>
                      <th>Accounts (Dr / Cr)</th>
                      <th style={{ textAlign: 'right' }}>Amount</th>
                      <th>Narration</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredVouchers.map(v => (
                      <tr key={v.id}>
                        <td style={{ fontWeight: 'bold' }}>{v.voucher_number}</td>
                        <td>{formatDate(v.voucher_date)}</td>
                        <td>
                          <span className={`badge ${
                            v.voucher_type.includes('receipt') ? 'badge-success' : 'badge-danger'
                          }`}>
                            {v.voucher_type.replace('_', ' ').toUpperCase()}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', fontSize: 12 }}>
                            <span style={{ color: '#10b981' }}>Dr: {v.debit_account_name}</span>
                            <span style={{ color: 'var(--color-text-muted)' }}>Cr: {v.credit_account_name}</span>
                          </div>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{formatCurrency(v.amount)}</td>
                        <td style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>
                          {v.narration || '-'}
                          {v.cheque_number && ` (Chq: ${v.cheque_number})`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Account Balances Summary Card */}
          <div className="card" style={{ padding: 20, height: 'fit-content' }}>
            <h3 style={{ fontSize: 16, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Wallet size={18} /> Account Balances
            </h3>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--color-text-muted)' }}>
                Loading accounts...
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {accounts.map(acc => (
                  <div 
                    key={acc.id} 
                    style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center', 
                      paddingBottom: 8, 
                      borderBottom: '1px solid var(--color-border)' 
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 500, fontSize: 14 }}>{acc.name}</div>
                      <div style={{ fontSize: 10, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>{acc.type}</div>
                    </div>
                    <div style={{ fontWeight: 'bold', fontSize: 14, color: acc.current_balance < 0 ? '#ef4444' : '#10b981' }}>
                      {formatCurrency(Math.abs(acc.current_balance))}
                      {acc.current_balance < 0 && ' (Cr)'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Create Voucher Form tab */
        <div className="card" style={{ padding: 24, maxWidth: 650, margin: '0 auto' }}>
          <h3 style={{ fontSize: 18, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
            <FileText size={20} /> Record New Accounting Voucher
          </h3>
          <form onSubmit={handleSaveVoucher} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            
            {/* Voucher Date & Type */}
            <div className="grid-2" style={{ gap: 16 }}>
              <div className="form-group">
                <label className="form-label">Date</label>
                <input 
                  type="date" 
                  className="form-control"
                  value={voucherDate}
                  onChange={e => setVoucherDate(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Voucher Type</label>
                <select 
                  className="form-control"
                  value={voucherType}
                  onChange={e => setVoucherType(e.target.value)}
                  required
                >
                  <option value="cash_receipt">Cash Receipt</option>
                  <option value="cash_payment">Cash Payment</option>
                  <option value="bank_receipt">Bank Receipt</option>
                  <option value="bank_payment">Bank Payment</option>
                </select>
              </div>
            </div>

            {/* Debit & Credit Accounts */}
            <div className="grid-2" style={{ gap: 16 }}>
              <div className="form-group">
                <label className="form-label">Debit Account (Receiver)</label>
                <select 
                  className="form-control"
                  value={debitAccountId}
                  onChange={e => setDebitAccountId(e.target.value)}
                  required
                >
                  <option value="">-- Select Debit Account --</option>
                  {accounts.map(acc => (
                    <option key={acc.id} value={acc.id}>{acc.name} ({acc.code})</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Credit Account (Giver)</label>
                <select 
                  className="form-control"
                  value={creditAccountId}
                  onChange={e => setCreditAccountId(e.target.value)}
                  required
                >
                  <option value="">-- Select Credit Account --</option>
                  {accounts.map(acc => (
                    <option key={acc.id} value={acc.id}>{acc.name} ({acc.code})</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Amount */}
            <div className="form-group">
              <label className="form-label">Amount (₹)</label>
              <input 
                type="number" 
                className="form-control"
                placeholder="0.00"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                min="0.01"
                step="0.01"
                required
              />
            </div>

            {/* Bank details (only if bank voucher) */}
            {isBankTransaction && (
              <div style={{ border: '1px dashed var(--color-border)', padding: 16, borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-primary)' }}>Bank / Cheque Information</div>
                <div className="grid-3" style={{ gap: 12 }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: 11 }}>Cheque / Ref No</label>
                    <input 
                      type="text" 
                      className="form-control"
                      value={chequeNumber}
                      onChange={e => setChequeNumber(e.target.value)}
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: 11 }}>Cheque Date</label>
                    <input 
                      type="date" 
                      className="form-control"
                      value={chequeDate}
                      onChange={e => setChequeDate(e.target.value)}
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: 11 }}>Bank Name</label>
                    <input 
                      type="text" 
                      className="form-control"
                      placeholder="e.g. SBI, HDFC"
                      value={bankName}
                      onChange={e => setBankName(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Narration */}
            <div className="form-group">
              <label className="form-label">Narration / Description</label>
              <textarea 
                className="form-control"
                placeholder="Enter details about this transaction..."
                value={narration}
                onChange={e => setNarration(e.target.value)}
                rows="3"
                style={{ resize: 'vertical' }}
              />
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 12 }}>
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={() => setActiveTab('list')}
                disabled={submitting}
              >
                Cancel
              </button>
              <button 
                type="submit" 
                className="btn btn-primary" 
                disabled={submitting}
              >
                {submitting ? (
                  <RefreshCw size={16} className="spin" style={{ marginRight: 6 }} />
                ) : (
                  <Save size={16} style={{ marginRight: 6 }} />
                )}
                Save Voucher
              </button>
            </div>

          </form>
        </div>
      )}
    </div>
  );
}
