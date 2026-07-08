import React, { useState, useEffect } from 'react';
import { useApi } from '../../contexts/AuthContext';
import { useApp } from '../../contexts/AppContext';
import { Save, Download, Upload, Server, Building2, CreditCard, Calendar, ShieldAlert, Printer, Receipt } from 'lucide-react';

const EMPTY = {
  name: '', address_line1: '', address_line2: '', address_line3: '',
  city: '', state: '', pincode: '', phone: '', mobile: '', email: '',
  gstin: '', state_code: '', bank_name: '', bank_account: '',
  bank_ifsc: '', bank_branch: '', financial_year_start: '', financial_year_end: '',
  invoice_prefix: '', default_gst_rate: '18',
};

// ─── Defined OUTSIDE the parent component ────────────────────────────────────
// If defined inside, React treats it as a NEW component type on every render
// and unmounts + remounts the input, making it lose focus after each keystroke.
function Field({ label, field, type = 'text', placeholder = '', span, form, onChange }) {
  return (
    <div className="input-group" style={span ? { gridColumn: `span ${span}` } : {}}>
      <label>{label}</label>
      <input
        className="input"
        type={type}
        value={form[field] || ''}
        onChange={e => onChange(field, e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}
// ─────────────────────────────────────────────────────────────────────────────

export default function CompanySettings() {
  const fetchApi = useApi();
  const { addToast, setCompany } = useApp();
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchApi('/api/company')
      .then(d => { setForm(prev => ({ ...prev, ...d })); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const handleChange = (field, value) => setForm(f => ({ ...f, [field]: value }));

  const handleSave = async () => {
    if (!form.name?.trim()) { addToast('error', 'Company name is required'); return; }
    setSaving(true);
    try {
      const updated = await fetchApi('/api/company', { method: 'PUT', body: JSON.stringify(form) });
      setCompany(updated);
      addToast('success', 'Settings Saved', 'Company profile updated successfully');
    } catch (e) { addToast('error', 'Error', e.message); }
    setSaving(false);
  };

  const handleBackup = () => {
    const token = localStorage.getItem('session_token');
    fetch('/api/system/backup', { headers: { 'x-session-token': token } })
      .then(res => { if (!res.ok) throw new Error('Backup failed'); return res.blob(); })
      .then(blob => {
        const a = Object.assign(document.createElement('a'), {
          href: URL.createObjectURL(blob), download: 'suriyamaligai_backup.sqlite',
        });
        document.body.appendChild(a); a.click(); a.remove();
        addToast('success', 'Backup Downloaded', 'Database backup saved successfully');
      })
      .catch(err => addToast('error', 'Backup Failed', err.message));
  };

  const handleRestore = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!window.confirm('WARNING: This will overwrite ALL current data. Are you sure?')) { e.target.value = ''; return; }
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        await fetchApi('/api/system/restore', { method: 'POST', body: JSON.stringify({ fileData: reader.result.split(',')[1] }) });
        addToast('success', 'Restored', 'Database restored. Reloading...');
        setTimeout(() => window.location.reload(), 2000);
      } catch (err) { addToast('error', 'Restore Failed', err.message); }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Helper function to render a Field directly as an element to preserve focus
  const renderField = (label, field, placeholder = '', span = null, type = 'text') => (
    <Field
      label={label}
      field={field}
      type={type}
      placeholder={placeholder}
      span={span}
      form={form}
      onChange={handleChange}
    />
  );

  if (loading) return <div className="loading-page"><div className="loading-spinner" /></div>;

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Company Settings</h1>
          <p className="page-subtitle">Configure your business profile and preferences</p>
        </div>
        <button className="btn btn-primary btn-lg" onClick={handleSave} disabled={saving}>
          <Save size={16} /> {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>

      {/* Business Information */}
      <div className="card card-static" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Building2 size={18} style={{ color: 'var(--accent-blue)' }} />
            <h3>Business Information</h3>
          </div>
        </div>
        <div className="card-body">
          <div className="form-row">
            {renderField("Company Name *", "name", "e.g. SURIYA MALIGAI", 2)}
            {renderField("Phone", "phone", "e.g. 6379355917")}
          </div>
          <div className="form-row" style={{ marginTop: 16 }}>
            {renderField("Mobile", "mobile", "e.g. 9600838819")}
            {renderField("Email", "email", "e.g. info@example.com", null, "email")}
          </div>
          <div className="form-row" style={{ marginTop: 16 }}>
            {renderField("Address Line 1", "address_line1", "e.g. NO-27, NORTH REDDY STREET", 2)}
            {renderField("Address Line 2", "address_line2", "e.g. UTHIRAMERUR-603406")}
          </div>
          <div className="form-row" style={{ marginTop: 16 }}>
            {renderField("Address Line 3", "address_line3", "e.g. KPM DISTRICT")}
            {renderField("City", "city", "e.g. Uthiramerur")}
            {renderField("State", "state", "e.g. Tamil Nadu")}
          </div>
          <div className="form-row" style={{ marginTop: 16 }}>
            {renderField("Pincode", "pincode", "e.g. 603406")}
            {renderField("GSTIN", "gstin", "e.g. 33AOEPT0355D2Z9")}
            {renderField("State Code", "state_code", "e.g. 33")}
          </div>
        </div>
      </div>

      {/* Bank Details */}
      <div className="card card-static" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <CreditCard size={18} style={{ color: 'var(--accent-green)' }} />
            <h3>Bank Details</h3>
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Printed on invoices</span>
        </div>
        <div className="card-body">
          <div className="form-row">
            {renderField("Bank Name", "bank_name", "e.g. State Bank of India")}
            {renderField("Branch", "bank_branch", "e.g. Uthiramerur Branch")}
          </div>
          <div className="form-row" style={{ marginTop: 16 }}>
            {renderField("Account Number", "bank_account", "e.g. 123456789012")}
            {renderField("IFSC Code", "bank_ifsc", "e.g. SBIN0005943")}
          </div>
        </div>
      </div>

      {/* Invoice Preferences */}
      <div className="card card-static" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Receipt size={18} style={{ color: 'var(--accent-purple)' }} />
            <h3>Invoice Preferences</h3>
          </div>
        </div>
        <div className="card-body">
          <div className="form-row">
            {renderField("Invoice Number Prefix", "invoice_prefix", "e.g. AT/24-25/")}
            <div className="input-group">
              <label>Default GST Rate %</label>
              <select className="select" value={form.default_gst_rate || '18'} onChange={e => handleChange('default_gst_rate', e.target.value)}>
                {['0','5','12','18','28'].map(r => <option key={r} value={r}>{r}%</option>)}
              </select>
            </div>
          </div>
          <div className="form-row" style={{ marginTop: 16 }}>
            <div className="input-group">
              <label>Default Print Format</label>
              <select className="select" value={localStorage.getItem('default_print_format') || 'none'}
                onChange={e => {
                  localStorage.setItem('default_print_format', e.target.value);
                  addToast('success', 'Print Format Saved', `Default set to: ${e.target.value.toUpperCase()}`);
                }}
              >
                <option value="none">Don't auto-print (manual)</option>
                <option value="a4">Auto-print A4 after saving</option>
                <option value="a5">Auto-print A5 after saving</option>
                <option value="thermal">Auto-print Thermal after saving</option>
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 6, padding: '8px 12px', background: 'var(--bg-secondary)', borderRadius: 8, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              <span>💡 Invoice prefix is added before the auto-generated number.</span>
              <span>e.g. prefix <strong>AT/25-26/</strong> → invoice <strong>AT/25-26/0001</strong></span>
            </div>
          </div>
        </div>
      </div>

      {/* Financial Year + System Utilities */}
      <div className="grid-2" style={{ gap: 20 }}>
        <div className="card card-static" style={{ margin: 0 }}>
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Calendar size={18} style={{ color: 'var(--accent-amber)' }} />
              <h3>Financial Year</h3>
            </div>
          </div>
          <div className="card-body">
            <div className="form-row">
              {renderField("Start Date", "financial_year_start", "", null, "date")}
              {renderField("End Date", "financial_year_end", "", null, "date")}
            </div>
            <div style={{ marginTop: 16, padding: '10px 14px', background: 'var(--accent-blue-soft)', borderRadius: 'var(--radius-md)', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              Current year: <strong style={{ color: 'var(--accent-blue)' }}>{form.financial_year_start || '—'}</strong> → <strong style={{ color: 'var(--accent-blue)' }}>{form.financial_year_end || '—'}</strong>
            </div>
          </div>
        </div>

        <div className="card card-static" style={{ margin: 0 }}>
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Server size={18} style={{ color: 'var(--accent-purple)' }} />
              <h3>System Utilities</h3>
            </div>
          </div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', gap: 12 }}>
              <button className="btn btn-secondary" onClick={handleBackup} style={{ flex: 1 }}>
                <Download size={15} /> Backup Database
              </button>
              <label className="btn btn-secondary" style={{ flex: 1, cursor: 'pointer', margin: 0 }}>
                <Upload size={15} /> Restore Database
                <input type="file" accept=".sqlite,.db" onChange={handleRestore} style={{ display: 'none' }} />
              </label>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, background: 'var(--accent-amber-soft)', border: '1px solid rgba(245,158,11,0.2)', padding: '10px 14px', borderRadius: 'var(--radius-md)' }}>
              <ShieldAlert size={16} style={{ color: 'var(--accent-amber)', flexShrink: 0, marginTop: 1 }} />
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
                <strong style={{ color: 'var(--accent-amber)' }}>Caution:</strong> Restore overwrites all current data including bills, items, and settings. Always keep a fresh backup first.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
