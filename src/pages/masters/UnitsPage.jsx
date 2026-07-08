import React, { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Ruler } from 'lucide-react';
import { useApi } from '../../contexts/AuthContext';
import { useApp } from '../../contexts/AppContext';
import Modal from '../../components/ui/Modal';

export default function UnitsPage() {
  const fetchApi = useApi();
  const { addToast } = useApp();
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', short_name: '' });
  const [deleteId, setDeleteId] = useState(null);

  const load = () => { fetchApi('/api/units').then(setUnits).catch(e=>addToast('error','Error',e.message)).finally(()=>setLoading(false)); };
  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    if (!form.name.trim() || !form.short_name.trim()) { addToast('error','Name and short name required'); return; }
    try {
      if (editing) { await fetchApi(`/api/units/${editing.id}`, { method:'PUT', body:JSON.stringify(form) }); addToast('success','Unit updated'); }
      else { await fetchApi('/api/units', { method:'POST', body:JSON.stringify(form) }); addToast('success','Unit created'); }
      setModalOpen(false); load();
    } catch (e) { addToast('error','Error',e.message); }
  };

  const handleDelete = async () => {
    try { await fetchApi(`/api/units/${deleteId}`, { method:'DELETE' }); addToast('success','Unit deleted'); setDeleteId(null); load(); }
    catch (e) { addToast('error','Error',e.message); setDeleteId(null); }
  };

  return (
    <div>
      <div className="page-header">
        <div><h1 className="page-title">Units of Measure</h1><p className="page-subtitle">Define measurement units for items</p></div>
        <button className="btn btn-primary" onClick={() => { setEditing(null); setForm({name:'',short_name:''}); setModalOpen(true); }}><Plus size={16}/> Add Unit</button>
      </div>

      {loading ? <div className="loading-page"><div className="loading-spinner"/></div> : units.length === 0 ? (
        <div className="empty-state"><Ruler/><h3>No units</h3><p>Add measurement units</p></div>
      ) : (
        <div className="table-container"><table className="table"><thead><tr><th>Name</th><th>Short Name</th><th className="text-center">Items</th><th>Actions</th></tr></thead><tbody>
          {units.map(u => <tr key={u.id}><td style={{fontWeight:500}}>{u.name}</td><td className="text-mono">{u.short_name}</td><td className="text-center">{u.item_count||0}</td><td><div className="actions-cell"><button className="btn-icon btn-icon-sm" onClick={()=>{setEditing(u);setForm({name:u.name,short_name:u.short_name});setModalOpen(true);}}><Pencil size={14}/></button><button className="btn-icon btn-icon-sm" onClick={()=>setDeleteId(u.id)}><Trash2 size={14}/></button></div></td></tr>)}
        </tbody></table></div>
      )}

      <Modal isOpen={modalOpen} onClose={()=>setModalOpen(false)} title={editing?'Edit Unit':'Add Unit'} size="sm"
        footer={<><button className="btn btn-secondary" onClick={()=>setModalOpen(false)}>Cancel</button><button className="btn btn-primary" onClick={handleSave}>Save</button></>}>
        <div className="input-group"><label>Name *</label><input className="input" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="e.g. Kilograms" autoFocus/></div>
        <div className="input-group" style={{marginTop:12}}><label>Short Name *</label><input className="input" value={form.short_name} onChange={e=>setForm({...form,short_name:e.target.value})} placeholder="e.g. Kg"/></div>
      </Modal>

      <Modal isOpen={!!deleteId} onClose={()=>setDeleteId(null)} title="Delete Unit" size="sm"
        footer={<><button className="btn btn-secondary" onClick={()=>setDeleteId(null)}>Cancel</button><button className="btn btn-danger" onClick={handleDelete}>Delete</button></>}>
        <p>Are you sure? Units with items cannot be deleted.</p>
      </Modal>
    </div>
  );
}
