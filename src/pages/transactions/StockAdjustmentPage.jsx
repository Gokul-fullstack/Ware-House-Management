import React, { useState, useEffect } from 'react';
import { Search, Save, AlertTriangle, ArrowUpRight, ArrowDownLeft, Plus, RefreshCw } from 'lucide-react';
import { useApi } from '../../contexts/AuthContext';
import { useApp } from '../../contexts/AppContext';

export default function StockAdjustmentPage() {
  const fetchApi = useApi();
  const { addToast, items, itemsLoading, refreshItems } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  
  // Selected item and form state
  const [selectedItem, setSelectedItem] = useState(null);
  const [adjustType, setAdjustType] = useState('add'); // 'add' or 'reduce'
  const [qty, setQty] = useState(''); // for single-unit items
  const [adjBoxes, setAdjBoxes] = useState(''); // for double-unit items (Boxes)
  const [adjPieces, setAdjPieces] = useState(''); // for double-unit items (Loose Pieces)
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const filteredItems = items.filter(item => {
    const term = searchQuery.toLowerCase();
    return (
      item.name.toLowerCase().includes(term) ||
      (item.code || '').toLowerCase().includes(term) ||
      (item.hsn_code || '').toLowerCase().includes(term)
    );
  });

  const formatStockText = (item) => {
    if (!item) return '0 Pcs';
    const stock = Number(item.current_stock) || 0;
    const conversion = Number(item.bulk_conversion) || 1;
    if (conversion <= 1) {
      return `${stock} ${item.unit_name || 'Pcs'}`;
    }
    const boxes = Math.floor(stock / conversion);
    const extraPieces = Math.round(stock % conversion);
    const bulkUnitDisp = item.bulk_unit_name || 'Box';
    const baseUnitDisp = (item.unit_name && item.unit_name.toLowerCase() !== bulkUnitDisp.toLowerCase()) ? item.unit_name : 'Pcs';
    const bulkUnitLabel = (bulkUnitDisp.toLowerCase() === 'box') ? (boxes === 1 ? 'Box' : 'Boxes') : bulkUnitDisp;

    return extraPieces > 0
      ? `${boxes} ${bulkUnitLabel} × ${conversion} ${baseUnitDisp} + ${extraPieces} ${baseUnitDisp}`
      : `${boxes} ${bulkUnitLabel} × ${conversion} ${baseUnitDisp}`;
  };

  const handleSelectItem = (item) => {
    setSelectedItem(item);
    setQty('');
    setAdjBoxes('');
    setAdjPieces('');
    setNotes('');
  };

  const handleSaveAdjustment = async (e) => {
    e.preventDefault();
    if (!selectedItem) return;

    let finalQty = 0;
    const conversion = Number(selectedItem.bulk_conversion) || 1;
    if (conversion > 1) {
      const boxes = Number(adjBoxes) || 0;
      const pieces = Number(adjPieces) || 0;
      if (boxes === 0 && pieces === 0) {
        addToast('error', 'Validation Error', 'Please enter a valid quantity to adjust');
        return;
      }
      finalQty = (boxes * conversion) + pieces;
    } else {
      if (!qty || isNaN(qty) || Number(qty) <= 0) {
        addToast('error', 'Validation Error', 'Please enter a valid positive quantity');
        return;
      }
      finalQty = Number(qty);
    }

    if (!notes.trim()) {
      addToast('error', 'Validation Error', 'Please enter notes/reason for adjustment');
      return;
    }

    setSubmitting(true);
    const adjustmentQty = adjustType === 'add' ? finalQty : -finalQty;

    try {
      const updatedItem = await fetchApi(`/api/items/${selectedItem.id}/adjust-stock`, {
        method: 'POST',
        body: JSON.stringify({
          adjustment_qty: adjustmentQty,
          notes: notes.trim()
        })
      });

      addToast('success', 'Success', `Stock adjusted successfully for ${selectedItem.name}`);
      
      // Update selected item & trigger global state sync
      setSelectedItem(updatedItem);
      refreshItems();
      
      // Reset form
      setQty('');
      setAdjBoxes('');
      setAdjPieces('');
      setNotes('');
    } catch (err) {
      console.error(err);
      addToast('error', 'Adjustment Failed', err.message || 'Server error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 className="page-title">Stock Adjustments</h1>
          <p className="page-subtitle">Manually add or reduce stock quantities for audit or corrections</p>
        </div>
        <button className="btn btn-secondary" onClick={refreshItems} disabled={itemsLoading}>
          <RefreshCw size={16} className={itemsLoading ? 'spin' : ''} style={{ marginRight: 6 }} /> Reload Items
        </button>
      </div>

      <div className="grid-3" style={{ gap: 24 }}>
        {/* Left column: Item list selection */}
        <div className="card col-span-2" style={{ padding: 20, display: 'flex', flexDirection: 'column', height: 'calc(100vh - 190px)', minHeight: 450 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontSize: 16 }}>Select Item to Adjust</h3>
            <div className="search-box" style={{ maxWidth: 280, margin: 0 }}>
              <Search size={16} />
              <input 
                type="text" 
                placeholder="Search items by name, code..." 
                className="form-control"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {itemsLoading ? (
            <div style={{ display: 'flex', flex: 1, justifyContent: 'center', alignItems: 'center', color: 'var(--color-text-muted)' }}>
              <RefreshCw size={24} className="spin" style={{ marginRight: 8 }} /> Loading product catalog...
            </div>
          ) : filteredItems.length === 0 ? (
            <div style={{ display: 'flex', flex: 1, justifyContent: 'center', alignItems: 'center', color: 'var(--color-text-muted)' }}>
              No products found
            </div>
          ) : (
            <div className="table-responsive" style={{ overflowY: 'auto', flex: 1 }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Name</th>
                    <th style={{ textAlign: 'right' }}>Current Stock</th>
                    <th style={{ textAlign: 'center' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map(item => (
                    <tr 
                      key={item.id} 
                      className={selectedItem?.id === item.id ? 'active-row' : ''}
                      style={selectedItem?.id === item.id ? { backgroundColor: 'rgba(59, 130, 246, 0.08)' } : {}}
                    >
                      <td style={{ fontWeight: 'bold' }}>{item.code || '-'}</td>
                      <td>{item.name}</td>
                      <td style={{ textAlign: 'right', fontWeight: 'bold', fontSize: '0.85rem' }}>{formatStockText(item)}</td>
                      <td style={{ textAlign: 'center' }}>
                        <button className="btn btn-ghost btn-xs" onClick={() => handleSelectItem(item)}>
                          Select
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right column: Form */}
        <div className="card" style={{ padding: 20, height: 'fit-content' }}>
          <h3 style={{ fontSize: 16, marginBottom: 16 }}>Adjustment Form</h3>
          {selectedItem ? (
            <form onSubmit={handleSaveAdjustment} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Item Info Box */}
              <div style={{ backgroundColor: 'rgba(255,255,255,0.02)', padding: 12, borderRadius: 8, border: '1px solid var(--color-border)' }}>
                <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 4 }}>SELECTED ITEM</div>
                <div style={{ fontWeight: 'bold', fontSize: 16, marginBottom: 4 }}>{selectedItem.name}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--color-text-muted)', flexDirection: 'column', gap: 4 }}>
                  <span>Code: {selectedItem.code || '-'}</span>
                  <span>Stock: <strong style={{ color: '#fff' }}>{formatStockText(selectedItem)} ({selectedItem.current_stock} Total Pieces)</strong></span>
                </div>
              </div>

              {/* Adjustment Type */}
              <div className="form-group">
                <label className="form-label">Type of Adjustment</label>
                <div style={{ display: 'flex', gap: 12 }}>
                  <button 
                    type="button"
                    className={`btn ${adjustType === 'add' ? 'btn-success' : 'btn-ghost'}`}
                    onClick={() => setAdjustType('add')}
                    style={{ flex: 1, padding: 10, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6 }}
                  >
                    <ArrowUpRight size={16} /> Add Stock (+)
                  </button>
                  <button 
                    type="button"
                    className={`btn ${adjustType === 'reduce' ? 'btn-danger' : 'btn-ghost'}`}
                    onClick={() => setAdjustType('reduce')}
                    style={{ flex: 1, padding: 10, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6 }}
                  >
                    <ArrowDownLeft size={16} /> Reduce Stock (-)
                  </button>
                </div>
              </div>

              {/* Quantity */}
              {Number(selectedItem.bulk_conversion) > 1 ? (
                <div style={{ display: 'flex', gap: 12 }}>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label">Boxes ({selectedItem.bulk_unit_name || 'Box'})</label>
                    <input 
                      type="number" 
                      className="form-control"
                      placeholder="Boxes"
                      value={adjBoxes}
                      onChange={e => setAdjBoxes(e.target.value)}
                      min="0"
                      step="1"
                    />
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label">Pieces ({selectedItem.unit_name || 'Pcs'})</label>
                    <input 
                      type="number" 
                      className="form-control"
                      placeholder="Pieces"
                      value={adjPieces}
                      onChange={e => setAdjPieces(e.target.value)}
                      min="0"
                      step="any"
                    />
                  </div>
                </div>
              ) : (
                <div className="form-group">
                  <label className="form-label">Quantity to Adjust ({selectedItem.unit_name || 'Pcs'})</label>
                  <input 
                    type="number" 
                    className="form-control"
                    placeholder="e.g. 5, 10, 50"
                    value={qty}
                    onChange={e => setQty(e.target.value)}
                    min="0.01"
                    step="any"
                    required
                  />
                </div>
              )}

              {Number(selectedItem.bulk_conversion) > 1 && (Number(adjBoxes) > 0 || Number(adjPieces) > 0) && (() => {
                const boxes = Number(adjBoxes) || 0;
                const pieces = Number(adjPieces) || 0;
                const conversion = Number(selectedItem.bulk_conversion) || 1;
                const total = (boxes * conversion) + pieces;
                const bulkUnitDisp = selectedItem.bulk_unit_name || 'Box';
                const baseUnitDisp = selectedItem.unit_name || 'Pcs';
                const bulkUnitLabel = (bulkUnitDisp.toLowerCase() === 'box') ? (boxes === 1 ? 'Box' : 'Boxes') : bulkUnitDisp;

                const formulaText = pieces > 0
                  ? `${boxes} ${bulkUnitLabel} × ${conversion} ${baseUnitDisp} + ${pieces} ${baseUnitDisp} = ${total} Total Pieces`
                  : `${boxes} ${bulkUnitLabel} × ${conversion} ${baseUnitDisp} = ${total} Total Pieces`;
                return (
                  <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: -8, fontWeight: 'bold' }}>
                    📦 Total Adjustment: {formulaText}
                  </div>
                );
              })()}

              {/* Notes */}
              <div className="form-group">
                <label className="form-label">Reason / Notes <span style={{ color: '#ef4444' }}>*</span></label>
                <textarea 
                  className="form-control"
                  placeholder="Explain why you are adjusting stock (e.g. Broken goods, physical inventory audit discrepancy)"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows="4"
                  style={{ resize: 'vertical' }}
                  required
                />
              </div>

              {/* Submit */}
              <button 
                type="submit" 
                className="btn btn-primary" 
                disabled={submitting}
                style={{ width: '100%', padding: '12px 0', marginTop: 8 }}
              >
                {submitting ? (
                  <RefreshCw size={16} className="spin" style={{ marginRight: 6 }} />
                ) : (
                  <Save size={16} style={{ marginRight: 6 }} />
                )}
                Save Adjustment
              </button>
            </form>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center', justifyContent: 'center', padding: '60px 0', color: 'var(--color-text-muted)', textAlign: 'center' }}>
              <AlertTriangle size={36} style={{ color: 'var(--color-text-muted)' }} />
              <p>Please select an item from the catalog on the left to adjust its stock quantity.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
