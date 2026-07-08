import React, { useState, useEffect } from 'react';
import { Plus, Search, Pencil, Trash2, Package, CheckSquare2, Square, RefreshCw, AlertTriangle, ChevronDown, ChevronUp, Percent } from 'lucide-react';
import { useApi } from '../../contexts/AuthContext';
import { useApp } from '../../contexts/AppContext';
import Modal from '../../components/ui/Modal';

const emptyItem = { code: '', name: '', description: '', category_id: '', unit_id: '', bulk_unit_id: '', bulk_conversion: '', purchase_price: '', selling_price: '', final_selling_price: '', mrp: '', gst_rate: '5', hsn_code: '', opening_stock: '', min_stock_level: '', zone: 'A', image_path: '' };

const F = ({ label, children }) => <div className="input-group">{label && <label>{label}</label>}{children}</div>;

export default function ItemsPage() {
  const fetchApi = useApi();
  const { formatCurrency, addToast, items, itemsLoading, refreshItems } = useApp();
  const [search, setSearch] = useState('');
  const [categories, setCategories] = useState([]);
  const [units, setUnits] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyItem);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [filterCat, setFilterCat] = useState('');
  const [filterStock, setFilterStock] = useState('');
  const [filterGst, setFilterGst] = useState('');
  const [filterHsn, setFilterHsn] = useState('');

  // Bulk GST Update state
  const [bulkPanelOpen, setBulkPanelOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [newGstRate, setNewGstRate] = useState('');
  const [bulkSaving, setBulkSaving] = useState(false);

  useEffect(() => {
    fetchApi('/api/categories').then(setCategories).catch(() => {});
    fetchApi('/api/units').then(setUnits).catch(() => {});
  }, []);

  const openAdd = () => { setEditing(null); setForm(emptyItem); setModalOpen(true); };
  const openEdit = (item) => {
    const gstMul = 1 + (Number(item.gst_rate) || 0) / 100;
    const finalSell = item.selling_price ? (Number(item.selling_price) * gstMul).toFixed(2) : '';
    setEditing(item);
    setForm({ ...emptyItem, ...item, category_id: item.category_id || '', unit_id: item.unit_id || '', bulk_unit_id: item.bulk_unit_id || '', bulk_conversion: item.bulk_conversion === 1 ? '' : (item.bulk_conversion || ''), final_selling_price: finalSell, zone: item.zone || 'A' });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { addToast('error', 'Item name is required'); return; }
    setSaving(true);
    try {
      const gstRate = Number(form.gst_rate) || 0;
      const gstMul = 1 + gstRate / 100;
      // Back-calculate selling price (excl GST) from final selling price (incl GST)
      const finalSell = Number(form.final_selling_price) || 0;
      const sellingPriceExcl = finalSell > 0 ? parseFloat((finalSell / gstMul).toFixed(4)) : (Number(form.selling_price) || 0);
      const body = {
        ...form,
        purchase_price: Number(form.purchase_price) || 0,
        selling_price: sellingPriceExcl,
        mrp: Number(form.mrp) || 0,
        gst_rate: gstRate,
        current_stock: Number(form.current_stock) || 0,
        opening_stock: Number(form.opening_stock) || 0,
        min_stock_level: Number(form.min_stock_level) || 0,
        category_id: form.category_id || null,
        unit_id: form.unit_id || null,
        bulk_unit_id: form.bulk_unit_id || null,
        bulk_conversion: Number(form.bulk_conversion) || 1,
        zone: form.zone || 'A',
      };
      if (editing) { await fetchApi(`/api/items/${editing.id}`, { method: 'PUT', body: JSON.stringify(body) }); addToast('success', 'Item updated'); }
      else { await fetchApi('/api/items', { method: 'POST', body: JSON.stringify(body) }); addToast('success', 'Item created'); }
      setModalOpen(false); refreshItems();
    } catch (e) { addToast('error', 'Error', e.message); }
    setSaving(false);
  };

  const handleDelete = async () => {
    try { await fetchApi(`/api/items/${deleteId}`, { method: 'DELETE' }); addToast('success', 'Item deleted'); setDeleteId(null); refreshItems(); }
    catch (e) { addToast('error', 'Error', e.message); }
  };

  const filteredItems = items.filter(item => {
    const term = search.toLowerCase();
    const matchesSearch = !search ||
      item.name.toLowerCase().includes(term) ||
      (item.code || '').toLowerCase().includes(term) ||
      (item.hsn_code || '').toLowerCase().includes(term);
    const matchesCat   = !filterCat   || String(item.category_id) === String(filterCat);
    const matchesStock = !filterStock ||
      (filterStock === 'in'  && item.current_stock > 0) ||
      (filterStock === 'low' && item.current_stock > 0 && item.current_stock <= item.min_stock_level) ||
      (filterStock === 'out' && item.current_stock <= 0);
    const matchesGst   = !filterGst || String(item.gst_rate) === filterGst;
    const matchesHsn   = !filterHsn  || (item.hsn_code || '').toLowerCase().includes(filterHsn.toLowerCase());
    return matchesSearch && matchesCat && matchesStock && matchesGst && matchesHsn;
  });

  // Bulk GST handler
  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };
  const toggleSelectAll = () => {
    if (selectedIds.size === filteredItems.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredItems.map(i => i.id)));
    }
  };
  const handleBulkGstUpdate = async () => {
    if (selectedIds.size === 0) { addToast('error', 'No items selected'); return; }
    if (!newGstRate && newGstRate !== 0) { addToast('error', 'Select a new GST rate'); return; }
    if (!window.confirm(`Change GST rate to ${newGstRate}% for ${selectedIds.size} item(s)?`)) return;
    setBulkSaving(true);
    try {
      await fetchApi('/api/items/bulk-gst-update', {
        method: 'POST',
        body: JSON.stringify({ item_ids: Array.from(selectedIds), new_gst_rate: Number(newGstRate) })
      });
      addToast('success', 'GST Updated', `${selectedIds.size} item(s) updated to ${newGstRate}% GST`);
      setSelectedIds(new Set());
      setNewGstRate('');
      refreshItems();
    } catch (e) {
      addToast('error', 'Failed', e.message);
    }
    setBulkSaving(false);
  };

  const stockBadge = (item) => {
    if (item.current_stock <= 0) return <span className="badge badge-danger">Out of Stock</span>;
    if (item.current_stock <= item.min_stock_level) return <span className="badge badge-warning">Low Stock</span>;
    return <span className="badge badge-success">In Stock</span>;
  };



  return (
    <div>
      <div className="page-header">
        <div><h1 className="page-title">Items & Inventory</h1><p className="page-subtitle">{filteredItems.length} items</p></div>
        <button className="btn btn-primary" onClick={openAdd}><Plus size={16} /> Add Item</button>
      </div>

      <div className="flex-gap" style={{ marginBottom: 12, flexWrap: 'wrap' }}>
        <div className="search-bar" style={{ flex: 1, maxWidth: 300 }}><Search /><input className="input" placeholder="Search items..." value={search} onChange={e => setSearch(e.target.value)} /></div>
        <select className="select" style={{ width: 150 }} value={filterCat} onChange={e => setFilterCat(e.target.value)}><option value="">All Categories</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        <select className="select" style={{ width: 130 }} value={filterStock} onChange={e => setFilterStock(e.target.value)}><option value="">All Stock</option><option value="in">In Stock</option><option value="low">Low Stock</option><option value="out">Out of Stock</option></select>
        <select className="select" style={{ width: 120 }} value={filterGst} onChange={e => setFilterGst(e.target.value)}>
          <option value="">All GST %</option>
          {[0,5,12,18,28].map(r => <option key={r} value={r}>{r}%</option>)}
        </select>
        <input className="input" style={{ width: 130 }} placeholder="Filter HSN..." value={filterHsn} onChange={e => setFilterHsn(e.target.value)} />
        <button
          className={`btn ${bulkPanelOpen ? 'btn-warning' : 'btn-secondary'}`}
          onClick={() => setBulkPanelOpen(v => !v)}
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <Percent size={15} /> Bulk GST Update {bulkPanelOpen ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
        </button>
      </div>

      {/* ── Bulk GST Update Panel ── */}
      {bulkPanelOpen && (
        <div style={{
          marginBottom: 16, padding: '16px 20px',
          background: 'linear-gradient(135deg, rgba(245,158,11,0.06) 0%, rgba(239,68,68,0.04) 100%)',
          border: '1.5px solid rgba(245,158,11,0.3)', borderRadius: 10
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertTriangle size={16} style={{ color: '#f59e0b' }} />
              <span style={{ fontWeight: 700, fontSize: '0.88rem' }}>Bulk GST Rate Update</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {selectedIds.size > 0 ? `${selectedIds.size} item(s) selected` : 'Select items from the table below'}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <button className="btn btn-ghost" style={{ fontSize: '0.78rem', padding: '4px 10px' }}
                onClick={toggleSelectAll}>
                {selectedIds.size === filteredItems.length && filteredItems.length > 0 ? 'Deselect All' : `Select All (${filteredItems.length})`}
              </button>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, whiteSpace: 'nowrap' }}>Change To:</label>
                <select className="select" style={{ width: 100 }} value={newGstRate} onChange={e => setNewGstRate(e.target.value)}>
                  <option value="">— Rate —</option>
                  {[0,5,12,18,28].map(r => <option key={r} value={r}>{r}%</option>)}
                </select>
              </div>
              <button
                className="btn btn-primary"
                style={{ background: '#f59e0b', borderColor: '#f59e0b', padding: '6px 16px', fontSize: '0.82rem' }}
                onClick={handleBulkGstUpdate}
                disabled={bulkSaving || selectedIds.size === 0 || newGstRate === ''}
              >
                {bulkSaving ? <RefreshCw size={14} className="spin" /> : <Percent size={14} />}
                &nbsp;{bulkSaving ? 'Updating...' : `Apply to ${selectedIds.size} Item(s)`}
              </button>
            </div>
          </div>
          <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: 0 }}>
            💡 Tip: Use the <strong>Filter HSN</strong> or <strong>GST %</strong> dropdowns above to narrow down to affected products, then click <em>Select All</em> and choose the new rate.
          </p>
        </div>
      )}


      {itemsLoading ? <div className="loading-page"><div className="loading-spinner" /></div> : filteredItems.length === 0 ? (
        <div className="empty-state"><Package /><h3>No items found</h3><p>Add your first product to get started</p></div>
      ) : (
        <div className="table-container">
          <table className="table">
            <thead><tr>
              {bulkPanelOpen && <th style={{ width: 36 }}>
                <button style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', color: 'var(--text-muted)' }}
                  onClick={toggleSelectAll}>
                  {selectedIds.size === filteredItems.length && filteredItems.length > 0
                    ? <CheckSquare2 size={16} style={{ color: 'var(--accent-blue)' }} />
                    : <Square size={16} />}
                </button>
              </th>}
              <th>Code</th><th>Name</th><th>Category</th><th style={{ minWidth: 110 }}>Unit</th><th>Zone</th>
              <th className="text-right">Purch ₹</th>
              <th className="text-right">Purch+GST</th>
              <th className="text-right">Final Sell ₹</th>
              <th className="text-right">GST%</th>
              <th style={{ minWidth: 260 }}>Stock Level</th><th>Status</th><th>Actions</th>
            </tr></thead>
            <tbody>
              {filteredItems.map(item => {
                const gstMul = 1 + (Number(item.gst_rate) || 0) / 100;
                const netPurch = Math.round(item.purchase_price * gstMul * 100) / 100;
                const finalSell = Math.round(item.selling_price * gstMul * 100) / 100;
                const stockPct = item.min_stock_level > 0 ? Math.min(100, Math.round(item.current_stock / (item.min_stock_level * 3) * 100)) : (item.current_stock > 0 ? 100 : 0);
                const stockClass = item.current_stock <= 0 ? 'low' : item.current_stock <= item.min_stock_level ? 'medium' : 'high';
                const bulkUnitDisp = item.bulk_unit_name || 'Box';
                const baseUnitDisp = (item.unit_name && item.unit_name.toLowerCase() !== bulkUnitDisp.toLowerCase()) ? item.unit_name : 'Pcs';
                const boxes = Math.floor(item.current_stock / item.bulk_conversion);
                const piecesPerBox = item.bulk_conversion;
                const extraPieces = Math.round(item.current_stock % item.bulk_conversion);
                const totalPieces = item.current_stock;
                const bulkUnitLabel = (bulkUnitDisp.toLowerCase() === 'box') ? (boxes === 1 ? 'Box' : 'Boxes') : bulkUnitDisp;
                const formulaText = extraPieces > 0
                  ? `${boxes} ${bulkUnitLabel} × ${piecesPerBox} ${baseUnitDisp} + ${extraPieces} ${baseUnitDisp}`
                  : `${boxes} ${bulkUnitLabel} × ${piecesPerBox} ${baseUnitDisp}`;

                return (
                <tr key={item.id} style={{ background: bulkPanelOpen && selectedIds.has(item.id) ? 'rgba(99,102,241,0.06)' : undefined }}>
                  {bulkPanelOpen && (
                    <td style={{ width: 36 }}>
                      <button
                        onClick={() => toggleSelect(item.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}
                      >
                        {selectedIds.has(item.id)
                          ? <CheckSquare2 size={16} style={{ color: 'var(--accent-blue)' }} />
                          : <Square size={16} style={{ color: 'var(--text-muted)' }} />}
                      </button>
                    </td>
                  )}
                  <td className="text-mono" style={{ fontSize: '0.78rem' }}>{item.code}</td>
                  <td style={{ fontWeight: 500 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                       {item.image_path ? (
                        <img src={item.image_path} alt={item.name} style={{ width: 30, height: 30, borderRadius: 6, objectFit: 'cover', border: '1px solid var(--border-primary)' }} onError={(e) => { e.target.style.display = 'none'; }} />
                      ) : (
                        <div style={{ width: 30, height: 30, borderRadius: 6, backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', flexShrink: 0 }}>
                          <Package size={14} />
                        </div>
                      )}
                      <div>
                        <div>{item.name}</div>
                        {item.hsn_code && <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>HSN: {item.hsn_code}</div>}
                      </div>
                    </div>
                  </td>
                  <td style={{ fontSize: '0.8rem' }}>{item.category_name || '—'}</td>
                  <td style={{ fontSize: '0.8rem' }}>
                    {item.unit_name || '—'}
                    {item.bulk_conversion > 1 && (
                      <div style={{ fontSize: '0.68rem', color: 'var(--accent-blue)', fontWeight: 600, marginTop: 2 }}>
                        1 {item.bulk_unit_name || 'Box'} = {item.bulk_conversion} {(item.unit_name && item.unit_name.toLowerCase() !== (item.bulk_unit_name || 'Box').toLowerCase()) ? item.unit_name : 'Pcs'}
                      </div>
                    )}
                  </td>
                  <td><span style={{ fontSize: '0.7rem', padding: '2px 6px', borderRadius: 4, background: 'rgba(79,70,229,0.1)', color: '#4F46E5', fontWeight: 600 }}>Z-{item.zone || 'A'}</span></td>
                  <td className="text-right text-mono" style={{ fontSize: '0.82rem' }}>{formatCurrency(item.purchase_price)}</td>
                  <td className="text-right text-mono" style={{ color: 'var(--accent-blue)', fontSize: '0.82rem' }}>{formatCurrency(netPurch)}</td>
                  <td className="text-right text-mono" style={{ color: 'var(--accent-green)', fontWeight: 600, fontSize: '0.85rem' }}>{formatCurrency(finalSell)}</td>
                  <td className="text-right" style={{ fontSize: '0.8rem' }}>{item.gst_rate}%</td>
                  <td>
                    <div className="stock-bar-wrap" style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        {item.bulk_conversion > 1 ? (
                          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: item.current_stock <= 0 ? 'var(--accent-red)' : item.current_stock <= item.min_stock_level ? 'var(--accent-amber)' : 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                            📦 Stock: {formulaText} = {totalPieces} Total {baseUnitDisp === 'Pcs' ? 'Pieces' : baseUnitDisp}
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: item.current_stock <= 0 ? 'var(--accent-red)' : item.current_stock <= item.min_stock_level ? 'var(--accent-amber)' : 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                            {item.current_stock} {item.unit_name || 'Pcs'}
                          </span>
                        )}
                      </div>
                      <div className="stock-bar" style={{ width: '100%' }}>
                        <div className={`stock-bar-fill ${stockClass}`} style={{ width: `${Math.max(2, stockPct)}%` }} />
                      </div>
                    </div>
                  </td>
                  <td>{stockBadge(item)}</td>
                  <td><div className="actions-cell">
                    <button className="btn-icon btn-icon-sm" onClick={() => openEdit(item)} title="Edit"><Pencil size={14} /></button>
                    <button className="btn-icon btn-icon-sm" onClick={() => setDeleteId(item.id)} title="Delete"><Trash2 size={14} /></button>
                  </div></td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add/Edit Modal */}
      {(() => {
        const activeBaseUnit = units.find(u => String(u.id) === String(form.unit_id));
        const activeBulkUnit = units.find(u => String(u.id) === String(form.bulk_unit_id));
        const baseUnitLabel = activeBaseUnit ? activeBaseUnit.short_name : 'Pcs';
        const bulkUnitLabel = activeBulkUnit ? activeBulkUnit.short_name : 'Boxes';
        const unitConflictError = form.unit_id && form.bulk_unit_id && String(form.unit_id) === String(form.bulk_unit_id) && Number(form.bulk_conversion) > 1;
        
        const differentUnits = form.unit_id && form.bulk_unit_id && String(form.unit_id) !== String(form.bulk_unit_id);
        const mrpPerBoxValue = form.mrp
          ? (differentUnits ? (Number(form.mrp) * Number(form.bulk_conversion)).toFixed(2) : Number(form.mrp).toFixed(2))
          : '';

        return (
          <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Item' : 'Add New Item'} size="lg"
            footer={<><button className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button><button className="btn btn-primary" onClick={handleSave} disabled={saving || unitConflictError}>{saving ? 'Saving...' : 'Save Item'}</button></>}>
            <div className="form-row"><F label="Item Code"><input className="input" value={form.code} onChange={e => setForm({...form, code: e.target.value})} placeholder="Auto-generated if empty" /></F><F label="Item Name *"><input className="input" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Enter item name" autoFocus /></F></div>
            <div className="form-row" style={{ marginTop: 16 }}><F label="Category"><select className="select" value={form.category_id} onChange={e => setForm({...form, category_id: e.target.value})}><option value="">Select category</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></F><F label="Base Unit (e.g. Pieces)"><select className="select" value={form.unit_id} onChange={e => setForm({...form, unit_id: e.target.value})}><option value="">Select base unit</option>{units.map(u => <option key={u.id} value={u.id}>{u.name} ({u.short_name})</option>)}</select></F></div>
            <div className="form-row" style={{ marginTop: 16 }}>
              <F label="Pieces per Box (leave blank if not applicable)">
                <input
                  className="input"
                  type="number"
                  min="1"
                  value={form.bulk_conversion}
                  onChange={e => {
                    const val = e.target.value;
                    setForm({ ...form, bulk_conversion: val, bulk_unit_id: val ? (form.bulk_unit_id || '') : '' });
                  }}
                  placeholder="e.g. 10 means 1 Box = 10 Pieces"
                />
              </F>
              {Number(form.bulk_conversion) > 1 && (
                <F label="Bulk Unit (e.g. Box, Bag)">
                  <select className="select" value={form.bulk_unit_id} onChange={e => setForm({...form, bulk_unit_id: e.target.value})}>
                    <option value="">Select bulk unit</option>
                    {units.map(u => <option key={u.id} value={u.id}>{u.name} ({u.short_name})</option>)}
                  </select>
                </F>
              )}
            </div>
            {unitConflictError && (
              <div style={{ color: 'var(--accent-red)', fontSize: '0.82rem', marginTop: 8, fontWeight: 600 }}>
                Base Unit and Bulk Unit cannot be the same. Please select different units.
              </div>
            )}

            {/* GST Rate — must be set before prices */}
            <div className="form-row" style={{ marginTop: 16 }}>
              <F label="GST Rate %">
                <input className="input" type="number" min="0" max="100" step="0.01"
                  value={form.gst_rate}
                  onChange={e => {
                    const newGst = e.target.value;
                    // Re-compute final_selling_price when GST changes if selling_price exists
                    const sp = Number(form.selling_price) || 0;
                    const newFinal = sp > 0 ? (sp * (1 + Number(newGst) / 100)).toFixed(2) : form.final_selling_price;
                    setForm({ ...form, gst_rate: newGst, final_selling_price: newFinal });
                  }}
                  placeholder="e.g. 5"
                />
              </F>
              <F label="HSN Code"><input className="input" value={form.hsn_code} onChange={e => setForm({...form, hsn_code: e.target.value})} placeholder="e.g. 1514" /></F>
            </div>

            <div className="form-row" style={{ marginTop: 16 }}>
              <F label="Purchase Price ₹ (excl. GST)">
                <input className="input" type="number" min="0" step="0.01"
                  value={form.purchase_price}
                  onChange={e => setForm({...form, purchase_price: e.target.value})}
                  placeholder="e.g. 1300.00"
                />
                {Number(form.purchase_price) > 0 && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--accent-blue)', marginTop: 4, display: 'block' }}>
                    Incl. GST: ₹{(Number(form.purchase_price) * (1 + Number(form.gst_rate || 0) / 100)).toFixed(2)}
                  </span>
                )}
              </F>

              <F label="Final Selling Price ₹ (incl. GST)">
                <input className="input" type="number" min="0" step="0.01"
                  value={form.final_selling_price}
                  onChange={e => {
                    const finalVal = e.target.value;
                    const gstMul = 1 + (Number(form.gst_rate) || 0) / 100;
                    const exclGst = Number(finalVal) > 0 ? (Number(finalVal) / gstMul).toFixed(4) : '';
                    setForm({ ...form, final_selling_price: finalVal, selling_price: exclGst });
                  }}
                  placeholder="e.g. 162.85"
                />
                {Number(form.final_selling_price) > 0 && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--accent-green)', marginTop: 4, display: 'block' }}>
                    Excl. GST (stored): ₹{Number(form.selling_price).toFixed(2)}
                    &nbsp;|&nbsp;GST ({form.gst_rate}%): ₹{(Number(form.final_selling_price) - Number(form.selling_price)).toFixed(2)}
                  </span>
                )}
              </F>

              <F label="MRP (per Base Unit) ₹">
                <input className="input" type="number" min="0" step="0.01"
                  value={form.mrp}
                  onChange={e => setForm({...form, mrp: e.target.value})}
                  placeholder="e.g. 180.00"
                />
                {Number(form.mrp) > 0 && Number(form.bulk_conversion) > 1 && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 4, display: 'block' }}>
                    MRP per {bulkUnitLabel}: ₹{mrpPerBoxValue} (auto-calculated)
                  </span>
                )}
              </F>
            </div>

            {Number(form.bulk_conversion) > 1 && (
              <div className="form-row" style={{ marginTop: 16, padding: '16px 18px', background: 'rgba(99,102,241,0.05)', borderRadius: 10, border: '1px dashed var(--accent-blue)', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                <F label={`Purchase Price per ${bulkUnitLabel} (excl. GST)`}>
                  <input className="input" type="number" min="0" step="0.01"
                    value={form.purchase_price ? (Number(form.purchase_price) * Number(form.bulk_conversion)).toFixed(2) : ''}
                    onChange={e => {
                      const val = e.target.value;
                      const piecePrice = val ? (Number(val) / Number(form.bulk_conversion)).toFixed(4) : '';
                      setForm({ ...form, purchase_price: piecePrice });
                    }}
                    placeholder={`Purchase price per ${bulkUnitLabel.toLowerCase()}`}
                  />
                </F>
                <F label={`Selling Price per ${bulkUnitLabel} (incl. GST)`}>
                  <input className="input" type="number" min="0" step="0.01"
                    value={form.final_selling_price ? (Number(form.final_selling_price) * Number(form.bulk_conversion)).toFixed(2) : ''}
                    onChange={e => {
                      const val = e.target.value;
                      const pieceFinalPrice = val ? (Number(val) / Number(form.bulk_conversion)).toFixed(4) : '';
                      const gstMul = 1 + (Number(form.gst_rate) || 0) / 100;
                      const pieceExclPrice = pieceFinalPrice ? (Number(pieceFinalPrice) / gstMul).toFixed(4) : '';
                      setForm({ ...form, final_selling_price: pieceFinalPrice, selling_price: pieceExclPrice });
                    }}
                    placeholder={`Selling price per ${bulkUnitLabel.toLowerCase()}`}
                  />
                </F>
                <F label={`MRP per ${bulkUnitLabel}`}>
                  <input className="input" type="number" min="0" step="0.01"
                    value={mrpPerBoxValue}
                    onChange={e => {
                      const val = e.target.value;
                      const pieceMrp = val ? (differentUnits ? (Number(val) / Number(form.bulk_conversion)).toFixed(4) : Number(val).toFixed(4)) : '';
                      setForm({ ...form, mrp: pieceMrp });
                    }}
                    placeholder={`MRP per ${bulkUnitLabel.toLowerCase()}`}
                  />
                </F>
              </div>
            )}

            {/* 📦 Stock Information Section */}
            <div style={{ marginTop: 20, borderTop: '1px solid var(--border-primary)', paddingTop: 16 }}>
              <h4 style={{ fontSize: '0.88rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                📦 Stock Information
              </h4>
              <div className="form-row">
                {Number(form.bulk_conversion) > 1 ? (
                  <>
                    <F label={`Boxes (${bulkUnitLabel})`}>
                      <input
                        className="input"
                        type="number"
                        min="0"
                        value={Math.floor(Number(form.current_stock || 0) / (Number(form.bulk_conversion) || 1))}
                        onChange={e => {
                          const val = e.target.value;
                          const boxes = parseInt(val, 10) || 0;
                          setForm(prev => {
                            const conversion = Number(prev.bulk_conversion) || 1;
                            const currentTotal = Number(prev.current_stock || 0);
                            const extraPieces = parseFloat((currentTotal % conversion).toFixed(2)) || 0;
                            const totalPcs = (boxes * conversion) + extraPieces;
                            const updates = { ...prev, current_stock: totalPcs };
                            if (!editing) {
                              updates.opening_stock = totalPcs;
                            }
                            return updates;
                          });
                        }}
                        placeholder="Boxes"
                      />
                    </F>
                    <F label={`Loose Pieces (${baseUnitLabel})`}>
                      <input
                        className="input"
                        type="number"
                        min="0"
                        value={parseFloat((Number(form.current_stock || 0) % (Number(form.bulk_conversion) || 1)).toFixed(2)) || 0}
                        onChange={e => {
                          const val = e.target.value;
                          const extraPieces = parseFloat(val) || 0;
                          setForm(prev => {
                            const conversion = Number(prev.bulk_conversion) || 1;
                            const currentTotal = Number(prev.current_stock || 0);
                            const boxes = Math.floor(currentTotal / conversion);
                            const totalPcs = (boxes * conversion) + extraPieces;
                            const updates = { ...prev, current_stock: totalPcs };
                            if (!editing) {
                              updates.opening_stock = totalPcs;
                            }
                            return updates;
                          });
                        }}
                        placeholder="Loose pieces"
                      />
                    </F>
                  </>
                ) : (
                  <F label={`Current Stock (in ${baseUnitLabel})`}>
                    <input
                      className="input"
                      type="number"
                      step="0.01"
                      min="0"
                      value={form.current_stock || 0}
                      onChange={e => {
                        const val = e.target.value;
                        const totalPcs = parseFloat(val) || 0;
                        setForm(prev => {
                          const updates = { ...prev, current_stock: totalPcs };
                          if (!editing) {
                            updates.opening_stock = totalPcs;
                          }
                          return updates;
                        });
                      }}
                      placeholder="Enter stock quantity"
                    />
                  </F>
                )}
              </div>
              {Number(form.bulk_conversion) > 1 && (() => {
                const conversion = Number(form.bulk_conversion) || 1;
                const totalPcs = Number(form.current_stock || 0);
                const boxes = Math.floor(totalPcs / conversion);
                const extraPieces = parseFloat((totalPcs - boxes * conversion).toFixed(2));
                let bulkDisp = bulkUnitLabel;
                if (bulkUnitLabel.toLowerCase() === 'box') {
                  bulkDisp = boxes === 1 ? 'Box' : 'Boxes';
                } else {
                  bulkDisp = boxes === 1 ? bulkUnitLabel : `${bulkUnitLabel}s`;
                }
                const formulaText = extraPieces > 0
                  ? `${boxes} ${bulkDisp} × ${conversion} ${baseUnitLabel} + ${extraPieces} ${baseUnitLabel} = ${totalPcs} Total Pieces`
                  : `${boxes} ${bulkDisp} × ${conversion} ${baseUnitLabel} = ${totalPcs} Total Pieces`;
                return (
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: 8, fontWeight: 600 }}>
                    📦 Stock: {formulaText}
                  </div>
                );
              })()}
            </div>

            <div className="form-row" style={{ marginTop: 16 }}>
              <F label="Min Stock Level (in Base Unit)">
                <input className="input" type="number" value={form.min_stock_level} onChange={e => setForm({...form, min_stock_level: e.target.value})} />
              </F>
              <F label="Warehouse Storage Zone">
                <select className="select" value={form.zone} onChange={e => setForm({...form, zone: e.target.value})}>
                  <option value="A">Zone A (Fast Moving)</option>
                  <option value="B">Zone B</option>
                  <option value="C">Zone C</option>
                  <option value="D">Zone D</option>
                  <option value="E">Zone E</option>
                </select>
              </F>
              <F label="Image URL">
                <input className="input" value={form.image_path} onChange={e => setForm({...form, image_path: e.target.value})} placeholder="https://example.com/image.jpg" />
              </F>
            </div>
            <div className="input-group" style={{ marginTop: 16 }}><label>Description</label><textarea className="textarea" value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="Item description" rows={2} /></div>
          </Modal>
        );
      })()}

      {/* Delete confirm */}
      <Modal isOpen={!!deleteId} onClose={() => setDeleteId(null)} title="Delete Item" size="sm"
        footer={<><button className="btn btn-secondary" onClick={() => setDeleteId(null)}>Cancel</button><button className="btn btn-danger" onClick={handleDelete}>Delete</button></>}>
        <p>Are you sure you want to delete this item? This action cannot be undone.</p>
      </Modal>
    </div>
  );
}
