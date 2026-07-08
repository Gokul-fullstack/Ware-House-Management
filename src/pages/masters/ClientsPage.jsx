import React, { useState, useEffect } from 'react';
import { Plus, Search, Pencil, Trash2, Users, Key, Shield, ShieldAlert, Check, X, Warehouse } from 'lucide-react';
import { useApi } from '../../contexts/AuthContext';
import { useApp } from '../../contexts/AppContext';
import Modal from '../../components/ui/Modal';

const emptyClient = { 
  code: '', name: '', store_name: '', type: 'customer', address_line1: '', address_line2: '', 
  city: '', state: '', pincode: '', phone: '', mobile: '', email: '', 
  gstin: '', state_code: '', pan: '', credit_limit: '', credit_days: '30', 
  area: '', zone: '', opening_balance: '', current_balance: '',
  wms_enabled: false, wms_username: '', wms_password: '', wms_approved: true
};

const F = ({ label, children, span }) => (
  <div className="input-group" style={span ? {gridColumn: `span ${span}`} : {}}>
    {label && <label>{label}</label>}
    {children}
  </div>
);

export default function ClientsPage() {
  const fetchApi = useApi();
  const { formatCurrency, addToast } = useApp();
  const [clients, setClients] = useState([]);
  const [pendingRegs, setPendingRegs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyClient);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState(null);

  const load = () => {
    const params = new URLSearchParams({ limit: '200' });
    if (search) params.set('search', search);
    if (typeFilter !== 'all') params.set('type', typeFilter);
    
    fetchApi(`/api/clients?${params}`)
      .then(d => setClients(d.clients||[]))
      .catch(e => addToast('error','Error',e.message))
      .finally(()=>setLoading(false));

    fetchApi('/api/clients-pending/registrations')
      .then(d => setPendingRegs(d||[]))
      .catch(() => {});
  };

  useEffect(() => { load(); }, [search, typeFilter]);

  const openAdd = () => { 
    setEditing(null); 
    setForm(emptyClient); 
    setModalOpen(true); 
  };
  
  const openEdit = (c) => { 
    setEditing(c); 
    setForm({
      ...emptyClient,
      ...c,
      wms_enabled: !!c.wms_username,
      wms_username: c.wms_username || c.email || '',
      wms_password: '',
      wms_approved: c.wms_approved !== undefined ? !!c.wms_approved : true
    }); 
    setModalOpen(true); 
  };

  const handleSave = async () => {
    if (!form.name.trim()) { addToast('error', 'Client name required'); return; }
    if (form.wms_enabled && !form.wms_username.trim()) { addToast('error', 'WMS Username is required when login access is enabled'); return; }
    
    setSaving(true);
    try {
      const body = {
        ...form, 
        credit_limit: Number(form.credit_limit)||0, 
        credit_days: Number(form.credit_days)||30, 
        opening_balance: Number(form.opening_balance)||0,
        ...(editing ? { current_balance: Number(form.current_balance) || 0 } : {})
      };
      if (editing) { 
        await fetchApi(`/api/clients/${editing.id}`, { method:'PUT', body: JSON.stringify(body) }); 
        addToast('success','Client updated'); 
      }
      else { 
        await fetchApi('/api/clients', { method:'POST', body: JSON.stringify(body) }); 
        addToast('success','Client created'); 
      }
      setModalOpen(false); 
      load();
    } catch (e) { 
      addToast('error','Error',e.message); 
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    try { 
      await fetchApi(`/api/clients/${deleteId}`, { method:'DELETE' }); 
      addToast('success','Client deleted'); 
      setDeleteId(null); 
      load(); 
    }
    catch (e) { 
      addToast('error','Error',e.message); 
    }
  };

  const handleApproveReg = async (userId) => {
    try {
      await fetchApi(`/api/clients-pending/approve/${userId}`, { method: 'PUT' });
      addToast('success', 'Registration approved successfully');
      load();
    } catch (e) {
      addToast('error', 'Failed to approve', e.message);
    }
  };

  const handleRejectReg = async (userId) => {
    if (!window.confirm("Are you sure you want to reject and delete this registration?")) return;
    try {
      await fetchApi(`/api/clients-pending/reject/${userId}`, { method: 'DELETE' });
      addToast('success', 'Registration rejected');
      load();
    } catch (e) {
      addToast('error', 'Failed to reject', e.message);
    }
  };


  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Clients & Users</h1>
          <p className="page-subtitle">{clients.length} clients registered</p>
        </div>
        <button className="btn btn-primary" onClick={openAdd}><Plus size={16} /> Add Client</button>
      </div>

      {/* Pending Online Client Registrations */}
      {pendingRegs.length > 0 && (
        <div className="card" style={{ marginBottom: 24, border: '1px solid var(--accent-amber-soft)', background: 'rgba(245, 158, 11, 0.03)' }}>
          <div className="card-header" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 18px', borderBottom: '1px solid rgba(245, 158, 11, 0.1)' }}>
            <Warehouse size={18} style={{ color: 'var(--accent-amber)' }} />
            <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--accent-amber)', margin: 0 }}>Pending Client Sign-Ups ({pendingRegs.length})</h3>
          </div>
          <div className="card-body" style={{ padding: '0 18px' }}>
            <table className="table" style={{ fontSize: '0.8rem' }}>
              <thead>
                <tr>
                  <th>Store / Client Name</th>
                  <th>Contact Person</th>
                  <th>Username / Email</th>
                  <th>GST Number</th>
                  <th>Address</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pendingRegs.map(reg => (
                  <tr key={reg.id}>
                    <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{reg.store_name || reg.name}</td>
                    <td>{reg.name}</td>
                    <td className="text-mono">{reg.email || reg.username}</td>
                    <td className="text-mono">{reg.gst_number || '—'}</td>
                    <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{reg.store_address || '—'}</td>
                    <td>
                      <div className="actions-cell" style={{ justifyContent: 'flex-end', gap: 6 }}>
                        <button className="btn btn-success btn-xs" onClick={() => handleApproveReg(reg.id)} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Check size={12} /> Approve
                        </button>
                        <button className="btn btn-danger btn-xs" onClick={() => handleRejectReg(reg.id)} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <X size={12} /> Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="flex-gap" style={{ marginBottom: 20, flexWrap: 'wrap' }}>
        <div className="search-bar" style={{ flex: 1, maxWidth: 350 }}>
          <Search />
          <input className="input" placeholder="Search clients by name, code, email..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="tab-group">
          {['all','customer','supplier'].map(t => (
            <button key={t} className={`tab-item ${typeFilter===t?'tab-active':''}`} onClick={()=>setTypeFilter(t)}>
              {t === 'all' ? 'All Clients' : t === 'customer' ? 'Customers' : 'Suppliers'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="loading-page"><div className="loading-spinner" /></div>
      ) : clients.length === 0 ? (
        <div className="empty-state"><Users /><h3>No clients found</h3><p>Create customers and suppliers</p></div>
      ) : (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Client Name</th>
                <th>Type</th>
                <th>Contact / Zone</th>
                <th>GSTIN</th>
                <th>WMS Login Access</th>
                <th className="text-right">Balance</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {clients.map(c => (
                <tr key={c.id}>
                  <td className="text-mono">{c.code}</td>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{c.store_name || c.name}</span>
                      {c.store_name && <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Contact: {c.name}</span>}
                      {c.email && <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{c.email}</span>}
                    </div>
                  </td>
                  <td>
                    <span className={`badge ${c.type==='customer'?'badge-info':c.type==='supplier'?'badge-purple':'badge-neutral'}`}>
                      {c.type}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', fontSize: '0.75rem' }}>
                      <span>{c.phone || c.mobile || '—'}</span>
                      {c.area && <span style={{ color: 'var(--text-muted)' }}>{c.area}</span>}
                      {c.zone && (
                        <span style={{ marginTop: 2 }}>
                          <span style={{ display: 'inline-block', padding: '1px 7px', borderRadius: 20, fontSize: '0.65rem', fontWeight: 700, background: 'var(--accent-blue)', color: '#fff', letterSpacing: '0.5px' }}>
                            {c.zone}
                          </span>
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="text-mono">{c.gstin || '—'}</td>
                  <td>
                    {c.wms_username ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span className={`badge ${c.wms_approved ? 'badge-success' : 'badge-warning'}`} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Key size={10} /> {c.wms_approved ? 'Enabled' : 'Pending'}
                        </span>
                        <span className="text-mono" style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>({c.wms_username})</span>
                      </div>
                    ) : (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Not Enabled</span>
                    )}
                  </td>
                  <td className={`text-right text-mono ${c.current_balance > 0 ? 'text-green' : c.current_balance < 0 ? 'text-red' : ''}`} style={{ fontWeight: 600 }}>
                    {formatCurrency(c.current_balance)}
                  </td>
                  <td>
                    <div className="actions-cell">
                      <button className="btn-icon btn-icon-sm" onClick={() => openEdit(c)} title="Edit profile & WMS login"><Pencil size={14} /></button>
                      <button className="btn-icon btn-icon-sm" onClick={() => setDeleteId(c.id)} title="Delete client"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add / Edit Client Modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Client Profile' : 'Add New Client'} size="lg"
        footer={<><button className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button><button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving?'Saving...':'Save Client'}</button></>}>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 20 }}>
          {/* Section 1: Billing Profile */}
          <div>
            <h4 style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-color)', paddingBottom: 6, marginBottom: 14 }}>Billing Details</h4>
            <div className="form-row">
              <F label="Code"><input className="input" value={form.code} onChange={e=>setForm({...form,code:e.target.value})} placeholder="Auto-generated" /></F>
              <F label="Name *"><input className="input" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="e.g. Gokul" autoFocus /></F>
              <F label="Store Name"><input className="input" value={form.store_name} onChange={e=>setForm({...form,store_name:e.target.value})} placeholder="e.g. Suriya Traders" /></F>
            </div>
            <div className="form-row" style={{marginTop:12}}>
              <F label="Type">
                <select className="select" value={form.type} onChange={e=>setForm({...form,type:e.target.value})}>
                  <option value="customer">Customer</option>
                  <option value="supplier">Supplier</option>
                  <option value="both">Both</option>
                </select>
              </F>
              <F label="Address Line 1"><input className="input" value={form.address_line1} onChange={e=>setForm({...form,address_line1:e.target.value})} /></F>
              <F label="Address Line 2"><input className="input" value={form.address_line2} onChange={e=>setForm({...form,address_line2:e.target.value})} /></F>
            </div>
            <div className="form-row" style={{marginTop:12}}>
              <F label="City"><input className="input" value={form.city} onChange={e=>setForm({...form,city:e.target.value})} /></F>
              <F label="State"><input className="input" value={form.state} onChange={e=>setForm({...form,state:e.target.value})} /></F>
              <F label="Pincode"><input className="input" value={form.pincode} onChange={e=>setForm({...form,pincode:e.target.value})} /></F>
            </div>
            <div className="form-row" style={{marginTop:12}}>
              <F label="Phone"><input className="input" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} /></F>
              <F label="Mobile"><input className="input" value={form.mobile} onChange={e=>setForm({...form,mobile:e.target.value})} /></F>
              <F label="Email Address"><input className="input" type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} placeholder="e.g. client@email.com" /></F>
            </div>
            <div className="form-row" style={{marginTop:12}}>
              <F label="GSTIN"><input className="input" value={form.gstin} onChange={e=>setForm({...form,gstin:e.target.value})} maxLength={15} placeholder="15 alphanumeric characters" /></F>
              <F label="State Code"><input className="input" value={form.state_code} onChange={e=>setForm({...form,state_code:e.target.value})} maxLength={2} /></F>
              <F label="PAN"><input className="input" value={form.pan} onChange={e=>setForm({...form,pan:e.target.value})} maxLength={10} /></F>
            </div>
            <div className="form-row" style={{marginTop:12}}>
              <F label="Credit Limit ₹"><input className="input" type="number" value={form.credit_limit} onChange={e=>setForm({...form,credit_limit:e.target.value})} /></F>
              <F label="Credit Days"><input className="input" type="number" value={form.credit_days} onChange={e=>setForm({...form,credit_days:e.target.value})} /></F>
              <F label="Area / Route"><input className="input" value={form.area} onChange={e=>setForm({...form,area:e.target.value})} /></F>
              <F label="Zone"><input className="input" value={form.zone} onChange={e=>setForm({...form,zone:e.target.value})} placeholder="e.g. North, South, Zone A" /></F>
            </div>
            {editing ? (
              <div className="form-row" style={{marginTop:12}}>
                <F label="Current Balance ₹ (+ve = receivable, -ve = payable)">
                  <input className="input" type="number" value={form.current_balance} onChange={e=>setForm({...form,current_balance:e.target.value})} />
                </F>
                <F label="">
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.5 }}>
                    <strong>Note:</strong> Editing this will override the running balance. Use only to correct errors.
                  </div>
                </F>
              </div>
            ) : (
              <div className="form-row" style={{marginTop:12}}>
                <F label="Opening Balance ₹ (+ve = receivable, -ve = payable)"><input className="input" type="number" value={form.opening_balance} onChange={e=>setForm({...form,opening_balance:e.target.value})} /></F>
              </div>
            )}
          </div>

          {/* Section 2: WMS Portal Login Details */}
          <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: 18, borderRadius: 12, border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <h4 style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Key size={16} style={{ color: 'var(--accent-blue)' }} /> Client Portal Login Access
              </h4>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>
                <input type="checkbox" checked={form.wms_enabled} onChange={e => setForm({...form, wms_enabled: e.target.checked, wms_username: form.wms_username || form.email || ''})} style={{ width: 15, height: 15 }} />
                Enable Login Access
              </label>
            </div>
            
            {form.wms_enabled ? (
              <div className="form-row animate-fade-in" style={{ marginTop: 14 }}>
                <F label="Username / Login Email *">
                  <input className="input text-mono" value={form.wms_username} onChange={e=>setForm({...form, wms_username: e.target.value})} placeholder="Username or email address" required />
                </F>
                <F label={editing ? "Reset Password (leave blank to keep unchanged)" : "Password"}>
                  <input className="input" type="password" value={form.wms_password} onChange={e=>setForm({...form, wms_password: e.target.value})} placeholder={editing ? "••••••••" : "Default: 123456"} />
                </F>
                <F label="Login Account Approval" span={1}>
                  <div style={{ display: 'flex', alignItems: 'center', height: '100%', minHeight: 38 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8rem', cursor: 'pointer', margin: 0 }}>
                      <input type="checkbox" checked={form.wms_approved} onChange={e => setForm({...form, wms_approved: e.target.checked})} style={{ width: 16, height: 16 }} />
                      Account Approved & Active
                    </label>
                  </div>
                </F>
              </div>
            ) : (
              <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                Enabling login access allows this client to sign in to the client logistics portal to place selection orders, view catalogs, templates, and report discrepancies.
              </p>
            )}
          </div>
        </div>
      </Modal>

      <Modal isOpen={!!deleteId} onClose={() => setDeleteId(null)} title="Delete Client" size="sm"
        footer={<><button className="btn btn-secondary" onClick={() => setDeleteId(null)}>Cancel</button><button className="btn btn-danger" onClick={handleDelete}>Delete</button></>}>
        <p>Are you sure you want to delete this client? This will disable their login credentials if they have WMS access.</p>
      </Modal>
    </div>
  );
}
