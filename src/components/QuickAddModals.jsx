import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';

export function QuickAddItemModal({ isOpen, onClose, onSave, fetchApi, addToast }) {
  const [form, setForm] = useState({
    code: '', name: '', purchase_price: '', selling_price: '', mrp: '', gst_rate: '5',
    category_id: '', unit_id: '1', bulk_unit_id: '', bulk_conversion: '1'
  });
  const [categories, setCategories] = useState([]);
  const [units, setUnits] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Fetch categories & units
      fetchApi('/api/categories').then(setCategories).catch(() => {});
      fetchApi('/api/units').then(setUnits).catch(() => {});
      // Auto-generate code
      const randCode = 'ITM' + Math.floor(1000 + Math.random() * 9000);
      setForm({
        code: randCode, name: '', purchase_price: '', selling_price: '', mrp: '', gst_rate: '5',
        category_id: '', unit_id: '1', bulk_unit_id: '', bulk_conversion: '1'
      });
    }
  }, [isOpen, fetchApi]);

  if (!isOpen) return null;

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { addToast('error', 'Item name is required'); return; }
    setSaving(true);
    try {
      const gstRate = Number(form.gst_rate) || 0;
      const gstMul = 1 + gstRate / 100;
      const finalSell = Number(form.selling_price) || 0;
      const sellingPriceExcl = finalSell > 0 ? parseFloat((finalSell / gstMul).toFixed(4)) : 0;
      
      const body = {
        ...form,
        purchase_price: Number(form.purchase_price) || 0,
        selling_price: sellingPriceExcl,
        mrp: Number(form.mrp) || 0,
        gst_rate: gstRate,
        current_stock: 0,
        opening_stock: 0,
        min_stock_level: 5,
        category_id: form.category_id || null,
        unit_id: form.unit_id || null,
        bulk_unit_id: form.bulk_unit_id || null,
        bulk_conversion: Number(form.bulk_conversion) || 1,
        zone: 'A',
      };
      
      const savedItem = await fetchApi('/api/items', {
        method: 'POST',
        body: JSON.stringify(body)
      });
      addToast('success', 'Item Created', `${form.name} added successfully.`);
      onSave(savedItem);
      onClose();
    } catch (err) {
      addToast('error', 'Error', err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 999 }}>
      <div className="modal-container" style={{ maxWidth: 500, width: '90%' }}>
        <div className="modal-header">
          <h3>Quick Add Item (F7)</h3>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={handleSave} className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="input-group">
              <label>Item Code *</label>
              <input className="input" value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} required />
            </div>
            <div className="input-group">
              <label>GST Rate % *</label>
              <select className="input" value={form.gst_rate} onChange={e => setForm({ ...form, gst_rate: e.target.value })}>
                {['0', '5', '12', '18', '28'].map(r => <option key={r} value={r}>{r}%</option>)}
              </select>
            </div>
          </div>
          <div className="input-group">
            <label>Item Name *</label>
            <input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Item Name" required />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="input-group">
              <label>Base Unit *</label>
              <select className="input" value={form.unit_id} onChange={e => setForm({ ...form, unit_id: e.target.value })}>
                {units.map(u => <option key={u.id} value={u.id}>{u.name} ({u.short_name})</option>)}
              </select>
            </div>
            <div className="input-group">
              <label>Category</label>
              <select className="input" value={form.category_id} onChange={e => setForm({ ...form, category_id: e.target.value })}>
                <option value="">Select Category</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="input-group">
              <label>Bulk Unit</label>
              <select className="input" value={form.bulk_unit_id} onChange={e => setForm({ ...form, bulk_unit_id: e.target.value })}>
                <option value="">None</option>
                {units.map(u => <option key={u.id} value={u.id}>{u.name} ({u.short_name})</option>)}
              </select>
            </div>
            <div className="input-group">
              <label>Bulk Conversion</label>
              <input className="input" type="number" min="1" value={form.bulk_conversion} onChange={e => setForm({ ...form, bulk_conversion: e.target.value })} disabled={!form.bulk_unit_id} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div className="input-group">
              <label>MRP ₹</label>
              <input className="input" type="number" min="0" step="0.01" value={form.mrp} onChange={e => setForm({ ...form, mrp: e.target.value })} placeholder="MRP" />
            </div>
            <div className="input-group">
              <label>Purchase Price ₹</label>
              <input className="input" type="number" min="0" step="0.01" value={form.purchase_price} onChange={e => setForm({ ...form, purchase_price: e.target.value })} placeholder="Excl. GST" />
            </div>
            <div className="input-group">
              <label>Final Sell Price ₹</label>
              <input className="input" type="number" min="0" step="0.01" value={form.selling_price} onChange={e => setForm({ ...form, selling_price: e.target.value })} placeholder="Incl. GST" />
            </div>
          </div>
          <div className="modal-actions" style={{ marginTop: 8 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save Item'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function QuickAddClientModal({ isOpen, onClose, onSave, type, fetchApi, addToast }) {
  const [form, setForm] = useState({ code: '', name: '', phone: '', gstin: '', email: '', address_line1: '', city: '', state: 'Tamil Nadu', is_active: '1' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const prefix = type === 'supplier' ? 'SUP' : 'CUST';
      const randCode = prefix + Math.floor(1000 + Math.random() * 9000);
      setForm({ code: randCode, name: '', phone: '', gstin: '', email: '', address_line1: '', city: '', state: 'Tamil Nadu', is_active: '1' });
    }
  }, [isOpen, type]);

  if (!isOpen) return null;

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { addToast('error', 'Name is required'); return; }
    setSaving(true);
    try {
      const body = {
        ...form,
        type: type,
        is_active: 1
      };
      const savedClient = await fetchApi('/api/clients', {
        method: 'POST',
        body: JSON.stringify(body)
      });
      addToast('success', `${type === 'supplier' ? 'Supplier' : 'Customer'} Created`, `${form.name} added successfully.`);
      onSave(savedClient);
      onClose();
    } catch (err) {
      addToast('error', 'Error', err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 999 }}>
      <div className="modal-container" style={{ maxWidth: 450, width: '90%' }}>
        <div className="modal-header">
          <h3>Quick Add {type === 'supplier' ? 'Supplier' : 'Customer'} (F8)</h3>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={handleSave} className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="input-group">
              <label>Code *</label>
              <input className="input" value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} required />
            </div>
            <div className="input-group">
              <label>Phone</label>
              <input className="input" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="10-digit number" />
            </div>
          </div>
          <div className="input-group">
            <label>Name *</label>
            <input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Full Name" required />
          </div>
          <div className="input-group">
            <label>GSTIN</label>
            <input className="input" value={form.gstin} onChange={e => setForm({ ...form, gstin: e.target.value.toUpperCase() })} placeholder="15-digit GSTIN" />
          </div>
          <div className="modal-actions" style={{ marginTop: 8 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
