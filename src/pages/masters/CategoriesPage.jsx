import React, { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Tag } from 'lucide-react';
import { useApi } from '../../contexts/AuthContext';
import { useApp } from '../../contexts/AppContext';
import Modal from '../../components/ui/Modal';

export default function CategoriesPage() {
  const fetchApi = useApi();
  const { addToast } = useApp();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', description: '' });
  const [deleteId, setDeleteId] = useState(null);

  const load = () => { fetchApi('/api/categories').then(setCategories).catch(e => addToast('error','Error',e.message)).finally(()=>setLoading(false)); };
  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    if (!form.name.trim()) { addToast('error','Category name required'); return; }
    try {
      if (editing) { await fetchApi(`/api/categories/${editing.id}`, { method:'PUT', body:JSON.stringify(form) }); addToast('success','Category updated'); }
      else { await fetchApi('/api/categories', { method:'POST', body:JSON.stringify(form) }); addToast('success','Category created'); }
      setModalOpen(false); load();
    } catch (e) { addToast('error','Error',e.message); }
  };

  const handleDelete = async () => {
    try { await fetchApi(`/api/categories/${deleteId}`, { method:'DELETE' }); addToast('success','Category deleted'); setDeleteId(null); load(); }
    catch (e) { addToast('error','Error',e.message); setDeleteId(null); }
  };

  return (
    <div>
      <div className="page-header">
        <div><h1 className="page-title">Categories</h1><p className="page-subtitle">Organize items by category</p></div>
        <button className="btn btn-primary" onClick={() => { setEditing(null); setForm({name:'',description:''}); setModalOpen(true); }}><Plus size={16}/> Add Category</button>
      </div>

      {loading ? <div className="loading-page"><div className="loading-spinner"/></div> : categories.length === 0 ? (
        <div className="empty-state"><Tag/><h3>No categories</h3><p>Add categories to organize items</p></div>
      ) : (
        <div className="table-container"><table className="table"><thead><tr><th>Name</th><th>Description</th><th className="text-center">Items</th><th>Actions</th></tr></thead><tbody>
          {categories.map(c => <tr key={c.id}><td style={{fontWeight:500}}>{c.name}</td><td style={{color:'var(--text-secondary)'}}>{c.description||'—'}</td><td className="text-center">{c.item_count||0}</td><td><div className="actions-cell"><button className="btn-icon btn-icon-sm" onClick={()=>{setEditing(c);setForm({name:c.name,description:c.description||''});setModalOpen(true);}}><Pencil size={14}/></button><button className="btn-icon btn-icon-sm" onClick={()=>setDeleteId(c.id)}><Trash2 size={14}/></button></div></td></tr>)}
        </tbody></table></div>
      )}

      <Modal isOpen={modalOpen} onClose={()=>setModalOpen(false)} title={editing?'Edit Category':'Add Category'} size="sm"
        footer={<><button className="btn btn-secondary" onClick={()=>setModalOpen(false)}>Cancel</button><button className="btn btn-primary" onClick={handleSave}>Save</button></>}>
        <div className="input-group"><label>Name *</label><input className="input" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} autoFocus/></div>
        <div className="input-group" style={{marginTop:12}}><label>Description</label><textarea className="textarea" value={form.description} onChange={e=>setForm({...form,description:e.target.value})} rows={2}/></div>
      </Modal>

      <Modal isOpen={!!deleteId} onClose={()=>setDeleteId(null)} title="Delete Category" size="sm"
        footer={<><button className="btn btn-secondary" onClick={()=>setDeleteId(null)}>Cancel</button><button className="btn btn-danger" onClick={handleDelete}>Delete</button></>}>
        <p>Are you sure? Categories with items cannot be deleted.</p>
      </Modal>
    </div>
  );
}
