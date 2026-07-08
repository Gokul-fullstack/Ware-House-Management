import React, { useState, useEffect, useCallback } from 'react';
import { Save, Trash2, Search, X, Plus } from 'lucide-react';
import { useApi } from '../../contexts/AuthContext';
import { useApp } from '../../contexts/AppContext';
import { QuickAddItemModal, QuickAddClientModal } from '../../components/QuickAddModals';

const emptyRow = () => ({ id: Date.now()+Math.random(), item_id: null, item_name: '', hsn_code: '', quantity: 1, unit_name: 'Pcs', bulk_unit_name: '', bulk_conversion: 1, selected_unit: 'pcs', unit_price: 0, base_unit_price: 0, discount_percent: 0, gst_rate: 18, taxable_amount: 0, cgst_amount: 0, sgst_amount: 0, igst_amount: 0, total_amount: 0, _search: '', _results: [], _showSearch: false, _highlightIdx: 0 });

export default function PurchaseEntryPage() {
  const fetchApi = useApi();
  const { formatCurrency, addToast, items, refreshItems } = useApp();

  const today = new Date().toISOString().split('T')[0];
  const [billNumber, setBillNumber] = useState('');
  const [billDate, setBillDate] = useState(today);
  const [dcNumber, setDcNumber] = useState('');
  const [dcDate, setDcDate] = useState(today);
  const [supplierSearch, setSupplierSearch] = useState('');
  const [supplierResults, setSupplierResults] = useState([]);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [showSupplierSearch, setShowSupplierSearch] = useState(false);
  const [paymentMode, setPaymentMode] = useState('credit');
  const [isInterState, setIsInterState] = useState(false);
  const [notes, setNotes] = useState('');
  const [rows, setRows] = useState([emptyRow()]);
  const [saving, setSaving] = useState(false);
  const [quickAddItemOpen, setQuickAddItemOpen] = useState(false);
  const [quickAddClientOpen, setQuickAddClientOpen] = useState(false);
  const [units, setUnits] = useState([]);
  useEffect(() => {
    fetchApi('/api/units').then(setUnits).catch(() => {});
  }, []);

  const searchSuppliers = useCallback(async (q) => {
    if (q.length < 2) { setSupplierResults([]); return; }
    try {
      const res = await fetchApi(`/api/clients/search?q=${encodeURIComponent(q)}&type=supplier`);
      setSupplierResults(res.filter(c => c.is_active === 1));
    } catch (e) { addToast('error', 'Error', 'Failed to search suppliers'); }
  }, [fetchApi, addToast]);

  useEffect(() => {
    const timer = setTimeout(() => { if (supplierSearch) searchSuppliers(supplierSearch); }, 300);
    return () => clearTimeout(timer);
  }, [supplierSearch, searchSuppliers]);

  const selectSupplier = (s) => { setSelectedSupplier(s); setSupplierSearch(s.store_name || s.name); setShowSupplierSearch(false); };

  const updateRow = (idx, updates) => setRows(prev => prev.map((r, i) => i === idx ? { ...r, ...updates } : r));

  const searchItems = useCallback((rowIdx, q) => {
    if (q.length < 1) { updateRow(rowIdx, { _results: [], _showSearch: false }); return; }
    const term = q.toLowerCase();
    const results = items.filter(item => 
      item.name.toLowerCase().includes(term) || 
      (item.code || '').toLowerCase().includes(term)
    ).slice(0, 20);
    updateRow(rowIdx, { _results: results, _showSearch: true, _highlightIdx: 0 });
  }, [items]);

  const selectItem = (rowIdx, item) => {
    const hasBulk = (item.bulk_conversion || 1) > 1;
    updateRow(rowIdx, {
      item_id: item.id, item_name: item.name, hsn_code: item.hsn_code || '',
      unit_name: item.unit_name || 'Pcs',
      bulk_unit_name: hasBulk ? (item.bulk_unit_name || 'Box') : '',
      bulk_conversion: item.bulk_conversion || 1,
      selected_unit: 'pcs', quantity: 1,
      unit_price: item.purchase_price, base_unit_price: item.purchase_price, gst_rate: item.gst_rate || 18,
      _search: item.name, _results: [], _showSearch: false
    });
    recalcRow(rowIdx, { unit_price: item.purchase_price, base_unit_price: item.purchase_price, gst_rate: item.gst_rate || 18, quantity: 1, discount_percent: 0, unit_name: item.unit_name || 'Pcs', bulk_unit_name: hasBulk ? (item.bulk_unit_name || 'Box') : '', bulk_conversion: item.bulk_conversion || 1, selected_unit: 'pcs' });
  };

  const recalcRow = (idx, overrides = {}) => {
    setRows(prev => prev.map((r, i) => {
      if (i !== idx) return r;
      const row = { ...r, ...overrides };
      const qty = Number(row.quantity) || 0;
      const rate = Number(row.unit_price) || 0;
      const discPct = Number(row.discount_percent) || 0;
      const gstRate = Number(row.gst_rate) || 0;
      const gross = qty * rate;
      const discAmt = gross * discPct / 100;
      const taxable = gross - discAmt;
      let cgst = 0, sgst = 0, igst = 0;
      if (isInterState) igst = taxable * gstRate / 100;
      else { cgst = taxable * gstRate / 200; sgst = taxable * gstRate / 200; }
      return { ...row, taxable_amount: Math.round(taxable*100)/100, cgst_amount: Math.round(cgst*100)/100, sgst_amount: Math.round(sgst*100)/100, igst_amount: Math.round(igst*100)/100, total_amount: Math.round((taxable+cgst+sgst+igst)*100)/100 };
    }));
  };

  useEffect(() => { rows.forEach((_, i) => recalcRow(i)); }, [isInterState]);

  const addEmptyRow = () => setRows(prev => [...prev, emptyRow()]);

  const removeRow = (idx) => { if (rows.length <= 1) setRows([emptyRow()]); else setRows(prev => prev.filter((_, i) => i !== idx)); };

  const validRows = rows.filter(r => r.item_id);
  const subtotal = validRows.reduce((s, r) => s + r.taxable_amount, 0);
  const cgstTotal = validRows.reduce((s, r) => s + r.cgst_amount, 0);
  const sgstTotal = validRows.reduce((s, r) => s + r.sgst_amount, 0);
  const igstTotal = validRows.reduce((s, r) => s + r.igst_amount, 0);
  const taxTotal = cgstTotal + sgstTotal + igstTotal;
  const rawGrand = subtotal + taxTotal;
  const grandTotal = Math.round(rawGrand);
  const roundOff = grandTotal - rawGrand;

  // Calculate GST Slab distribution
  const slabs = [0, 5, 12, 18, 28].reduce((acc, rate) => {
    acc[rate] = { sales: 0, tax: 0 };
    return acc;
  }, {});
  validRows.forEach(r => {
    const rate = Math.round(Number(r.gst_rate) || 0);
    const taxable = Number(r.taxable_amount) || 0;
    const tax = (Number(r.cgst_amount) || 0) + (Number(r.sgst_amount) || 0) + (Number(r.igst_amount) || 0);
    if (slabs[rate] !== undefined) {
      slabs[rate].sales += taxable;
      slabs[rate].tax += tax;
    }
  });

  const handleQuickItemSave = (item) => {
    let targetIdx = rows.findIndex(r => !r.item_id);
    if (targetIdx === -1) {
      addEmptyRow();
      targetIdx = rows.length;
    }
    selectItem(targetIdx, item);
  };

  const handleQuickClientSave = (client) => {
    setSelectedSupplier(client);
    setSupplierSearch(client.name);
    setShowSupplierSearch(false);
  };

  const handleSave = async () => {
    if (!validRows.length) { addToast('error', 'Add at least one item'); return; }
    setSaving(true);
    try {
      const result = await fetchApi('/api/purchases', { method: 'POST', body: JSON.stringify({
        bill_number: billNumber, bill_date: billDate, dc_number: dcNumber, dc_date: dcDate,
        client_id: selectedSupplier?.id || null, payment_mode: paymentMode, is_inter_state: isInterState, notes,
        discount_amount: 0,
        round_off: roundOff,
        grand_total: grandTotal,
        items: validRows.map(r => ({
          item_id: r.item_id,
          quantity: Number(r.quantity),
          unit_name: r.selected_unit === 'bulk' ? (r.bulk_unit_name || 'Box') : (r.unit_name || 'Pcs'),
          unit_price: Number(r.unit_price),
          discount_percent: Number(r.discount_percent),
          gst_rate: Number(r.gst_rate),
          selected_unit: r.selected_unit || 'pcs'
        })),
      })});
      addToast('success', 'Purchase Saved', `Ref: ${result.our_ref_number}`);
      refreshItems();
      setRows([emptyRow()]); setSelectedSupplier(null); setSupplierSearch(''); setBillNumber(''); setNotes('');
    } catch (e) { addToast('error', 'Error', e.message); }
    setSaving(false);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      if (e.ctrlKey && e.key === 's') { e.preventDefault(); handleSave(); }
      if (e.key === 'F2' || (e.altKey && e.key === 'n')) {
        e.preventDefault();
        addEmptyRow();
        setTimeout(() => {
          const tbody = document.querySelector('.billing-grid tbody');
          if (tbody) {
            const lastTr = tbody.querySelector('tr:last-child');
            if (lastTr) {
              const firstInput = lastTr.querySelector('.cell-input');
              if (firstInput) {
                firstInput.focus();
                if (typeof firstInput.select === 'function') firstInput.select();
              }
            }
          }
        }, 50);
      }
      if (e.key === 'F4') {
        e.preventDefault();
        const activeTr = document.activeElement?.closest('tr');
        if (activeTr) {
          const rowsList = Array.from(activeTr.closest('tbody').querySelectorAll('tr'));
          const idx = rowsList.indexOf(activeTr);
          if (idx !== -1) {
            const row = rows[idx];
            if (row && row.item_id) {
              const newUnit = row.selected_unit === 'pcs' ? 'bulk' : 'pcs';
              const rate = newUnit === 'bulk' ? (row.base_unit_price * row.bulk_conversion) : row.base_unit_price;
              updateRow(idx, { selected_unit: newUnit, unit_price: rate });
              recalcRow(idx, { selected_unit: newUnit, unit_price: rate });
            }
          }
        }
      }
      if (e.key === 'F5') {
        e.preventDefault();
        const activeTr = document.activeElement?.closest('tr');
        if (activeTr) {
          const rowsList = Array.from(activeTr.closest('tbody').querySelectorAll('tr'));
          const idx = rowsList.indexOf(activeTr);
          if (idx !== -1) {
            removeRow(idx);
          }
        }
      }
      if (e.key === 'F7') {
        e.preventDefault();
        setQuickAddItemOpen(true);
      }
      if (e.key === 'F8') {
        e.preventDefault();
        setQuickAddClientOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleSave, rows, removeRow, updateRow, recalcRow]);

  const handleGridNavigation = (e) => {
    if (e.key === 'ArrowRight' || e.key === 'Enter') {
      const currentInput = e.target;
      const tr = currentInput.closest('tr');
      if (!tr) return;
      const inputs = Array.from(tr.querySelectorAll('.cell-input'));
      const idx = inputs.indexOf(currentInput);
      if (idx !== -1) {
        if (idx < inputs.length - 1) {
          e.preventDefault();
          const nextInput = inputs[idx + 1];
          nextInput.focus();
          if (typeof nextInput.select === 'function') nextInput.select();
        } else {
          const nextTr = tr.nextElementSibling;
          if (nextTr) {
            const nextRowInput = nextTr.querySelector('.cell-input');
            if (nextRowInput) {
              e.preventDefault();
              nextRowInput.focus();
              if (typeof nextRowInput.select === 'function') nextRowInput.select();
            }
          } else if (e.key === 'Enter') {
            e.preventDefault();
            addEmptyRow();
            setTimeout(() => {
              const tbody = tr.closest('tbody');
              if (tbody) {
                const trs = Array.from(tbody.querySelectorAll('tr'));
                const lastTr = trs[trs.length - 1];
                if (lastTr) {
                  const firstInput = lastTr.querySelector('.cell-input');
                  if (firstInput) {
                    firstInput.focus();
                    if (typeof firstInput.select === 'function') firstInput.select();
                  }
                }
              }
            }, 50);
          }
        }
      }
    } else if (e.key === 'ArrowLeft') {
      const currentInput = e.target;
      const tr = currentInput.closest('tr');
      if (!tr) return;
      const inputs = Array.from(tr.querySelectorAll('.cell-input'));
      const idx = inputs.indexOf(currentInput);
      if (idx !== -1) {
        if (idx < inputs.length - 1) {
          e.preventDefault();
          const nextInput = inputs[idx + 1];
          nextInput.focus();
          if (typeof nextInput.select === 'function') nextInput.select();
        } else {
          const nextTr = tr.nextElementSibling;
          if (nextTr) {
            const nextRowInput = nextTr.querySelector('.cell-input');
            if (nextRowInput) {
              e.preventDefault();
              nextRowInput.focus();
              if (typeof nextRowInput.select === 'function') nextRowInput.select();
            }
          }
        }
      }
    } else if (e.key === 'ArrowLeft') {
      const currentInput = e.target;
      const tr = currentInput.closest('tr');
      if (!tr) return;
      const inputs = Array.from(tr.querySelectorAll('.cell-input'));
      const idx = inputs.indexOf(currentInput);
      if (idx !== -1) {
        if (idx > 0) {
          e.preventDefault();
          const prevInput = inputs[idx - 1];
          prevInput.focus();
          if (typeof prevInput.select === 'function') prevInput.select();
        } else {
          const prevTr = tr.previousElementSibling;
          if (prevTr) {
            const prevRowInputs = Array.from(prevTr.querySelectorAll('.cell-input'));
            const prevRowLastInput = prevRowInputs[prevRowInputs.length - 1];
            if (prevRowLastInput) {
              e.preventDefault();
              prevRowLastInput.focus();
              if (typeof prevRowLastInput.select === 'function') prevRowLastInput.select();
            }
          }
        }
      }
    }
  };

  const handleItemKeyDown = (e, rowIdx) => {
    const row = rows[rowIdx];
    if (row._showSearch && row._results.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); updateRow(rowIdx, { _highlightIdx: Math.min(row._highlightIdx + 1, row._results.length - 1) }); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); updateRow(rowIdx, { _highlightIdx: Math.max(row._highlightIdx - 1, 0) }); return; }
      if (e.key === 'Enter') { e.preventDefault(); selectItem(rowIdx, row._results[row._highlightIdx]); return; }
      if (e.key === 'Escape') { updateRow(rowIdx, { _showSearch: false }); return; }
    }
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft' || e.key === 'Enter') {
      handleGridNavigation(e);
    }
  };

  return (
    <div className="billing-page">
      {/* Purchase Rate Auto Update Status Bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 20px', background: 'linear-gradient(90deg, rgba(34,197,94,0.12), rgba(34,197,94,0.04))', borderBottom: '1px solid rgba(34,197,94,0.3)', flexShrink: 0 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', display: 'inline-block', boxShadow: '0 0 6px #22c55e' }} />
        <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#22c55e', letterSpacing: '0.04em' }}>PURCHASE RATE AUTO UPDATE ON</span>
        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: 4 }}>— Saving a purchase entry automatically updates the item master with the latest purchase price &amp; GST rate.</span>
      </div>
      <div className="billing-header">
        <div className="input-group" style={{ width: 140 }}><label>Supplier Bill #</label><input className="input" value={billNumber} onChange={e => setBillNumber(e.target.value)} placeholder="Bill No" /></div>
        <div className="input-group" style={{ width: 150 }}><label>Bill Date</label><input className="input" type="date" value={billDate} onChange={e => setBillDate(e.target.value)} /></div>
        <div className="input-group" style={{ width: 130 }}><label>DC Number</label><input className="input" value={dcNumber} onChange={e => setDcNumber(e.target.value)} placeholder="DC No" /></div>
        <div className="input-group" style={{ width: 140 }}><label>DC Date</label><input className="input" type="date" value={dcDate} onChange={e => setDcDate(e.target.value)} /></div>
        <div className="input-group" style={{ flex: 1, minWidth: 180, position: 'relative' }}>
          <label>Supplier</label>
          <div className="input-with-icon"><Search /><input className="input" value={supplierSearch} onChange={e => { setSupplierSearch(e.target.value); setShowSupplierSearch(true); }} onFocus={() => supplierSearch.length >= 2 && setShowSupplierSearch(true)} placeholder="Search supplier" /></div>
          {showSupplierSearch && supplierResults.length > 0 && (
            <div className="item-search-popup" style={{ zIndex: 100 }}>
              {supplierResults.map(s => (
                <div key={s.id} className="search-result-item" onClick={() => selectSupplier(s)}>
                  <span>
                    <span className="item-name">{s.store_name || s.name}</span>
                    {s.store_name && <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: 8 }}>(Contact: {s.name})</span>}
                  </span>
                  <span className="item-rate">{s.gstin||''}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="input-group" style={{ width: 130 }}>
          <label>Payment</label>
          <div className="toggle-group">
            {['credit','cash'].map(m => <button key={m} className={paymentMode===m?'active':''} onClick={()=>setPaymentMode(m)}>{m.toUpperCase()}</button>)}
          </div>
        </div>
      </div>

      <div className="billing-grid-container">
        <table className="billing-grid">
          <thead><tr><th style={{width:40}}>#</th><th style={{minWidth:200}}>Item Name</th><th style={{width:90}}>HSN</th><th style={{width:100}}>Qty</th><th style={{width:85}}>Unit</th><th style={{width:100}}>Rate ₹</th><th style={{width:65}}>Disc%</th><th style={{width:100}} className="text-right">Taxable ₹</th><th style={{width:55}}>GST%</th><th style={{width:90}} className="text-right">Tax ₹</th><th style={{width:90}} className="text-right">R/Q ₹</th><th style={{width:110}} className="text-right">Total ₹</th><th style={{width:36}}></th></tr></thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={row.id}>
                <td className="row-num">{idx+1}</td>
                <td style={{position:'relative'}}>
                  <input className="cell-input" value={row._search||row.item_name} onChange={e=>{updateRow(idx,{_search:e.target.value,item_name:''});searchItems(idx,e.target.value);}} onKeyDown={e=>handleItemKeyDown(e,idx)} onFocus={e => e.target.select()} placeholder="Search item..." />
                  {row._showSearch && row._results.length > 0 && <div className="item-search-popup">{row._results.map((item,ri)=><div key={item.id} className={`search-result-item ${ri===row._highlightIdx?'highlighted':''}`} onClick={()=>selectItem(idx,item)}><span><span className="item-name">{item.name}</span><span className="item-code">{item.code}</span></span><span className="item-rate">₹{item.purchase_price}</span></div>)}</div>}
                </td>
                <td><span className="cell-readonly">{row.hsn_code}</span></td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <input className="cell-input numeric" type="number" min="0" value={row.quantity} onChange={e=>{updateRow(idx,{quantity:e.target.value});recalcRow(idx,{quantity:e.target.value});}} onKeyDown={handleGridNavigation} onFocus={e => e.target.select()} style={{ width: '100%' }} />
                  </div>
                </td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <input
                      className="cell-input"
                      value={row.selected_unit === 'bulk' ? (row.bulk_unit_name || 'Box') : (row.unit_name || 'Pcs')}
                      readOnly
                      onKeyDown={e => {
                        if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'Enter') {
                          e.preventDefault();
                          
                          const baseU = row.unit_name || 'Pcs';
                          const bulkU = row.bulk_conversion > 1 ? (row.bulk_unit_name || 'Box') : null;
                          const options = [baseU, ...(bulkU ? [bulkU] : [])];
                          if (options.length <= 1) return;
                          
                          const currentVal = row.selected_unit === 'bulk' ? (row.bulk_unit_name || 'Box') : (row.unit_name || 'Pcs');
                          let optIdx = options.findIndex(opt => opt.toLowerCase() === currentVal.toLowerCase());
                          if (optIdx === -1) optIdx = 0;
                          
                          let nextOptIdx;
                          if (e.key === 'ArrowUp') {
                            nextOptIdx = (optIdx - 1 + options.length) % options.length;
                          } else {
                            nextOptIdx = (optIdx + 1) % options.length; // Enter and ArrowDown toggle to next option
                          }
                          const nextVal = options[nextOptIdx];
                          
                          const isBulk = bulkU && nextVal.toLowerCase() === bulkU.toLowerCase();
                          const selectedUnit = isBulk ? 'bulk' : 'pcs';
                          const rate = isBulk ? (row.base_unit_price * row.bulk_conversion) : row.base_unit_price;
                          
                          if (isBulk) {
                            updateRow(idx, { selected_unit: 'bulk', bulk_unit_name: nextVal, unit_price: rate });
                          } else {
                            updateRow(idx, { selected_unit: 'pcs', unit_name: nextVal, unit_price: rate });
                          }
                          recalcRow(idx, { selected_unit: selectedUnit, unit_price: rate });
                        } else {
                          handleGridNavigation(e);
                        }
                      }}
                      style={{ width: '100%', padding: '4px', fontSize: '0.78rem', fontWeight: 600, color: 'var(--accent-blue)', textAlign: 'center' }}
                    />
                    {row.bulk_conversion > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          const newUnit = row.selected_unit === 'pcs' ? 'bulk' : 'pcs';
                          const rate = newUnit === 'bulk' ? (row.base_unit_price * row.bulk_conversion) : row.base_unit_price;
                          updateRow(idx, { selected_unit: newUnit, unit_price: rate });
                          recalcRow(idx, { selected_unit: newUnit, unit_price: rate });
                        }}
                        style={{
                          padding: '2px 4px',
                          fontSize: '0.62rem',
                          fontWeight: 700,
                          background: row.selected_unit === 'bulk' ? 'var(--accent-blue)' : 'var(--bg-secondary)',
                          color: row.selected_unit === 'bulk' ? '#fff' : 'var(--text-muted)',
                          border: '1px solid var(--border-primary)',
                          borderRadius: 4,
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                          flexShrink: 0
                        }}
                      >
                        {row.selected_unit === 'bulk' ? 'BOX' : 'PCS'}
                      </button>
                    )}
                  </div>
                </td>
                <td><input className="cell-input numeric" type="number" min="0" value={row.unit_price} onChange={e=>{
                  const newRate = Number(e.target.value) || 0;
                  const baseRate = row.selected_unit === 'bulk' ? (newRate / row.bulk_conversion) : newRate;
                  updateRow(idx, { unit_price: newRate, base_unit_price: baseRate });
                  recalcRow(idx, { unit_price: newRate });
                }} onKeyDown={handleGridNavigation} onFocus={e => e.target.select()} style={{ width: '100%', minWidth: '80px' }} /></td>
                <td><input className="cell-input numeric" type="number" min="0" max="100" value={row.discount_percent} onChange={e=>{updateRow(idx,{discount_percent:e.target.value});recalcRow(idx,{discount_percent:e.target.value});}} onKeyDown={handleGridNavigation} onFocus={e => e.target.select()} style={{ width: '100%', minWidth: '55px' }} /></td>
                <td className="cell-readonly">{formatCurrency(row.taxable_amount)}</td>
                <td><input className="cell-input numeric" type="number" min="0" max="100" step="0.01" value={row.gst_rate} onChange={e=>{updateRow(idx,{gst_rate:e.target.value});recalcRow(idx,{gst_rate:e.target.value});}} onKeyDown={handleGridNavigation} onFocus={e => e.target.select()} style={{width:54}}/></td>
                <td className="cell-readonly">{formatCurrency(row.cgst_amount+row.sgst_amount+row.igst_amount)}</td>
                <td className="cell-readonly" style={{color:'var(--accent-blue)',fontSize:'0.85rem'}}>{formatCurrency(Number(row.quantity) > 0 ? row.total_amount / row.quantity : Number(row.unit_price) * (1 + Number(row.gst_rate) / 100))}</td>
                <td className="cell-readonly" style={{fontWeight:600,color:'var(--text-primary)'}}>{formatCurrency(row.total_amount)}</td>
                <td><button className="row-delete" onClick={()=>removeRow(idx)}><X size={14}/></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{padding:'8px 24px',flexShrink:0}}><button className="btn btn-ghost btn-sm" onClick={addEmptyRow}><Plus size={14}/> Add Row</button></div>

      {/* Summary */}
      <div className="billing-summary" style={{ display: 'grid', gridTemplateColumns: '280px 240px auto 240px', gap: 20, alignItems: 'start', padding: '16px 24px' }}>
        {/* Left: Notes & Words */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="input-group" style={{ margin: 0 }}>
            <label>Notes</label>
            <textarea className="textarea" value={notes} onChange={e=>setNotes(e.target.value)} rows={2} placeholder="Notes..."/>
          </div>
        </div>

        {/* Distribution of GST */}
        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ background: '#1e293b', color: '#fff', fontSize: '0.65rem', fontWeight: 700, padding: '4px 10px', textTransform: 'uppercase', textAlign: 'center', letterSpacing: 0.5 }}>Distribution of GST</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.7rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-primary)', background: 'rgba(0,0,0,0.1)' }}>
                <th style={{ padding: '4px 6px', fontWeight: 600 }}>Slab</th>
                <th style={{ padding: '4px 6px', fontWeight: 600, textAlign: 'right' }}>Taxable Sales</th>
                <th style={{ padding: '4px 6px', fontWeight: 600, textAlign: 'right' }}>Tax Amount</th>
              </tr>
            </thead>
            <tbody>
              {[0, 5, 12, 18, 28].map(rate => {
                const slab = slabs[rate] || { sales: 0, tax: 0 };
                return (
                  <tr key={rate} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '3px 6px', fontWeight: 600 }}>Tax {rate}%</td>
                    <td style={{ padding: '3px 6px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{slab.sales.toFixed(2)}</td>
                    <td style={{ padding: '3px 6px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{slab.tax.toFixed(2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Shortcuts Legend */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Shortcuts panel */}
          <div className="shortcuts-legend" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '3px', padding: 8, background: 'var(--bg-secondary)', borderRadius: 8, border: '1px solid var(--border-primary)', fontSize: '0.65rem', fontWeight: 600 }}>
            <div style={{ color: 'var(--text-muted)' }}><span style={{ color: 'var(--accent-blue)', fontWeight: 700 }}>F4:</span> Toggle Unit (PCS/BOX)</div>
            <div style={{ color: 'var(--text-muted)' }}><span style={{ color: 'var(--accent-blue)', fontWeight: 700 }}>F5:</span> Remove Item Row</div>
            <div style={{ color: 'var(--text-muted)' }}><span style={{ color: 'var(--accent-blue)', fontWeight: 700 }}>F7:</span> Quick Add Item</div>
            <div style={{ color: 'var(--text-muted)' }}><span style={{ color: 'var(--accent-blue)', fontWeight: 700 }}>F8:</span> Quick Add Supplier</div>
          </div>
        </div>

        {/* Right: Summary Panel */}
        <div className="billing-summary-right" style={{ minWidth: 220 }}>
          <div className="billing-summary-row" style={{ background: '#002f6c', color: '#fff', padding: '6px 12px', borderLeft: '4px solid var(--accent-blue)', display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}><span className="label" style={{ fontWeight: 700 }}>GROSS</span><span className="value" style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{formatCurrency(subtotal)}</span></div>
          <div className="billing-summary-row" style={{ background: '#002f6c', color: '#fff', padding: '6px 12px', borderLeft: '4px solid var(--accent-blue)', display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}><span className="label" style={{ fontWeight: 700 }}>GST</span><span className="value" style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{formatCurrency(taxTotal)}</span></div>
          <div className="billing-summary-row" style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', padding: '6px 12px', borderLeft: '4px solid var(--border-primary)', display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}><span className="label" style={{ fontWeight: 700 }}>ROUND</span><span className="value" style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{roundOff > 0 ? '+' : ''}{roundOff.toFixed(2)}</span></div>
          <div className="billing-summary-row total" style={{ background: '#004b00', color: '#fff', padding: '8px 12px', borderLeft: '4px solid #10b981', display: 'flex', justifyContent: 'space-between' }}><span className="label" style={{ fontWeight: 700 }}>NET</span><span className="value" style={{ fontFamily: 'var(--font-mono)', fontSize: '1.4rem', fontWeight: 700 }}>{formatCurrency(grandTotal)}</span></div>
        </div>
      </div>

      <div className="billing-actions">
        <button className="btn btn-ghost" onClick={()=>{setRows([emptyRow()]);setSelectedSupplier(null);setSupplierSearch('');setBillNumber('');setNotes('');}}><Trash2 size={16}/> Clear</button>
        <button className="btn btn-primary btn-lg" onClick={handleSave} disabled={saving||!validRows.length}><Save size={18}/> {saving?'Saving...':'Save Purchase'}</button>
      </div>
      <QuickAddItemModal
        isOpen={quickAddItemOpen}
        onClose={() => setQuickAddItemOpen(false)}
        onSave={handleQuickItemSave}
        fetchApi={fetchApi}
        addToast={addToast}
      />
      <QuickAddClientModal
        isOpen={quickAddClientOpen}
        onClose={() => setQuickAddClientOpen(false)}
        onSave={handleQuickClientSave}
        type="supplier"
        fetchApi={fetchApi}
        addToast={addToast}
      />
    </div>
  );
}
