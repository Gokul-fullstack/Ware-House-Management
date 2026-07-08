import React, { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, FileSpreadsheet, ArrowRight, ArrowLeft, Check, AlertTriangle, Printer, X, Download, RefreshCw, Edit } from 'lucide-react';
import { useApi } from '../../contexts/AuthContext';
import { useApp } from '../../contexts/AppContext';
import Modal from '../../components/ui/Modal';

// ─── CSV Parser (handles quoted fields with commas) ───
function parseCSV(text) {
  const lines = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (inQuotes && text[i + 1] === '"') { current += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (ch === ',' && !inQuotes) {
      lines.length === 0 ? (lines.push([current]), current = '') : (lines[lines.length - 1].push(current), current = '');
    } else if ((ch === '\n' || ch === '\r') && !inQuotes) {
      if (current || (lines.length > 0 && lines[lines.length - 1].length > 0)) {
        if (lines.length === 0) lines.push([current]);
        else lines[lines.length - 1].push(current);
        current = '';
        lines.push([]); // start new row
      }
      if (ch === '\r' && text[i + 1] === '\n') i++; // skip \r\n
    } else {
      current += ch;
    }
  }
  // Flush last field
  if (current || (lines.length > 0 && lines[lines.length - 1].length > 0)) {
    if (lines.length === 0) lines.push([current]);
    else lines[lines.length - 1].push(current);
  }
  // Remove empty trailing rows
  while (lines.length > 0 && lines[lines.length - 1].length === 0) lines.pop();
  return lines;
}

// Target fields for mapping
const TARGET_FIELDS = [
  { key: '', label: '— Skip —' },
  { key: 'invoice_number', label: 'Invoice Number', group: 'Invoice' },
  { key: 'invoice_date', label: 'Invoice Date', group: 'Invoice' },
  { key: 'client_name', label: 'Customer Name', group: 'Customer' },
  { key: 'client_phone', label: 'Customer Phone', group: 'Customer' },
  { key: 'client_gstin', label: 'Customer GSTIN', group: 'Customer' },
  { key: 'client_address', label: 'Customer Address', group: 'Customer' },
  { key: 'client_city', label: 'Customer City', group: 'Customer' },
  { key: 'client_state', label: 'Customer State', group: 'Customer' },
  { key: 'item_name', label: 'Item / Product Name', group: 'Item', required: true },
  { key: 'quantity', label: 'Quantity', group: 'Item', required: true },
  { key: 'unit_price', label: 'Rate / Unit Price', group: 'Item', required: true },
  { key: 'gst_rate', label: 'GST Rate %', group: 'Item' },
  { key: 'discount_percent', label: 'Discount %', group: 'Item' },
  { key: 'mrp', label: 'MRP', group: 'Item' },
  { key: 'unit_name', label: 'Unit Name', group: 'Item' },
  { key: 'hsn_code', label: 'HSN Code', group: 'Item' },
  { key: 'payment_mode', label: 'Payment Mode', group: 'Invoice' },
];

// Auto-match CSV header to target field
function autoMap(header) {
  const h = header.toLowerCase().trim();
  const maps = {
    'invoice': 'invoice_number', 'invoice no': 'invoice_number', 'invoice number': 'invoice_number', 'bill no': 'invoice_number', 'bill number': 'invoice_number',
    'date': 'invoice_date', 'invoice date': 'invoice_date', 'bill date': 'invoice_date', 'order date': 'invoice_date',
    'customer': 'client_name', 'customer name': 'client_name', 'client': 'client_name', 'client name': 'client_name', 'buyer': 'client_name', 'name': 'client_name', 'party name': 'client_name',
    'phone': 'client_phone', 'customer phone': 'client_phone', 'mobile': 'client_phone',
    'gstin': 'client_gstin', 'gst no': 'client_gstin', 'gst number': 'client_gstin',
    'address': 'client_address', 'customer address': 'client_address',
    'city': 'client_city',
    'state': 'client_state',
    'item': 'item_name', 'item name': 'item_name', 'product': 'item_name', 'product name': 'item_name', 'particulars': 'item_name', 'description': 'item_name',
    'qty': 'quantity', 'quantity': 'quantity', 'qty.': 'quantity', 'total quantity': 'quantity', 'requested quantity': 'quantity',
    'rate': 'unit_price', 'unit price': 'unit_price', 'price': 'unit_price', 'selling price': 'unit_price', 'unit price (inr)': 'unit_price', 'rate (inr)': 'unit_price',
    'gst': 'gst_rate', 'gst rate': 'gst_rate', 'gst %': 'gst_rate', 'gst%': 'gst_rate', 'tax rate': 'gst_rate', 'tax %': 'gst_rate',
    'discount': 'discount_percent', 'disc': 'discount_percent', 'disc%': 'discount_percent', 'discount %': 'discount_percent', 'discount%': 'discount_percent',
    'mrp': 'mrp', 'maximum retail price': 'mrp',
    'unit': 'unit_name', 'uom': 'unit_name', 'unit name': 'unit_name',
    'hsn': 'hsn_code', 'hsn code': 'hsn_code',
    'payment': 'payment_mode', 'payment mode': 'payment_mode', 'payment method': 'payment_mode',
    'subtotal (inr)': '', 'subtotal': '',
  };
  return maps[h] || '';
}

// Safely parse numbers by removing currency symbols, commas, and extra spacing
function parseNumeric(val) {
  if (!val) return 0;
  const sanitized = String(val).replace(/[₹$,\s]/g, '');
  const num = Number(sanitized);
  return isNaN(num) ? 0 : num;
}

const STEPS = ['Upload', 'Map Columns', 'Preview', 'Import'];

export default function CSVImportPage() {
  const fetchApi = useApi();
  const navigate = useNavigate();
  const { formatCurrency, addToast, company, printInvoice } = useApp();

  // State
  const [step, setStep] = useState(0);
  const [fileName, setFileName] = useState('');
  const [rawData, setRawData] = useState([]); // [row][col]
  const [headers, setHeaders] = useState([]);
  const [mapping, setMapping] = useState({}); // colIdx -> targetKey
  const [invoiceGroups, setInvoiceGroups] = useState([]); // grouped invoices for preview
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [metadata, setMetadata] = useState(null); // WMS Selection header metadata
  const fileRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);

  // ─── Step 1: File Upload ───
  const handleFile = useCallback((file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      let parsed = parseCSV(text);
      if (parsed.length < 2) { addToast('error', 'Invalid CSV', 'File must have at least a header row and one data row'); return; }
      
      let parsedMetadata = null;
      // Detect and parse WMS export metadata header row
      if (parsed[0] && parsed[0][0] && parsed[0][0].toLowerCase().startsWith('store name:')) {
        parsedMetadata = {};
        parsed[0].forEach(cell => {
          const c = cell.trim();
          if (c.toLowerCase().startsWith('store name:')) {
            parsedMetadata.client_name = c.substring(11).trim();
          } else if (c.toLowerCase().startsWith('gstin:')) {
            parsedMetadata.client_gstin = c.substring(6).trim();
          } else if (c.toLowerCase().startsWith('store address:')) {
            parsedMetadata.client_address = c.substring(14).trim().replace(/^"|"$/g, '');
          } else if (c.toLowerCase().startsWith('date:')) {
            parsedMetadata.invoice_date = c.substring(5).trim();
          }
        });
        
        // Remove metadata row and any empty spacer rows
        parsed = parsed.slice(1);
        while (parsed.length > 0 && (parsed[0].length === 0 || !parsed[0].some(cell => cell.trim()))) {
          parsed = parsed.slice(1);
        }
      }
      
      if (parsed.length < 2) {
        addToast('error', 'Invalid CSV', 'No items table found in the file after the metadata header');
        return;
      }

      const hdrs = parsed[0].map(h => h.trim());
      setHeaders(hdrs);
      setRawData(parsed.slice(1).filter(row => row.some(cell => cell.trim())));
      setFileName(file.name);
      setMetadata(parsedMetadata);

      // Auto-map columns
      const autoMapping = {};
      hdrs.forEach((h, i) => {
        const mapped = autoMap(h);
        if (mapped) autoMapping[i] = mapped;
      });
      setMapping(autoMapping);
      setStep(1);
    };
    reader.readAsText(file);
  }, [addToast]);

  const handleDrop = useCallback((e) => {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer?.files?.[0];
    if (file && (file.name.endsWith('.csv') || file.type === 'text/csv')) handleFile(file);
    else addToast('error', 'Invalid File', 'Please drop a .csv file');
  }, [handleFile, addToast]);

  // ─── Step 2: Column Mapping ───
  const updateMapping = (colIdx, targetKey) => {
    setMapping(prev => {
      const next = { ...prev };
      if (targetKey) next[colIdx] = targetKey;
      else delete next[colIdx];
      return next;
    });
  };

  const requiredFields = ['item_name', 'quantity', 'unit_price'];
  const mappedKeys = Object.values(mapping);
  const missingRequired = requiredFields.filter(f => !mappedKeys.includes(f));

  // ─── Step 3: Build Preview ───
  const buildPreview = useCallback(() => {
    const reversedMap = {};
    Object.entries(mapping).forEach(([colIdx, key]) => { reversedMap[key] = Number(colIdx); });

    const get = (row, key) => reversedMap[key] !== undefined ? (row[reversedMap[key]] || '').trim() : '';

    const groups = {};
    for (const row of rawData) {
      const invNum = get(row, 'invoice_number') || 'SINGLE';
      if (!groups[invNum]) {
        groups[invNum] = {
          invoice_number: invNum === 'SINGLE' ? '' : invNum,
          invoice_date: get(row, 'invoice_date') || metadata?.invoice_date || '',
          client_name: get(row, 'client_name') || metadata?.client_name || '',
          client_phone: get(row, 'client_phone') || '',
          client_gstin: get(row, 'client_gstin') || metadata?.client_gstin || '',
          client_address: get(row, 'client_address') || metadata?.client_address || '',
          client_city: get(row, 'client_city') || '',
          client_state: get(row, 'client_state') || '',
          payment_mode: get(row, 'payment_mode') || 'cash',
          is_inter_state: false,
          items: [],
        };
      }
      // Add item
      const itemName = get(row, 'item_name');
      if (!itemName) continue;
      groups[invNum].items.push({
        item_name: itemName,
        quantity: parseNumeric(get(row, 'quantity')) || 1,
        unit_price: parseNumeric(get(row, 'unit_price')) || 0,
        gst_rate: parseNumeric(get(row, 'gst_rate')) || 18,
        discount_percent: parseNumeric(get(row, 'discount_percent')) || 0,
        mrp: parseNumeric(get(row, 'mrp')) || 0,
        unit_name: get(row, 'unit_name') || 'Pcs',
        hsn_code: get(row, 'hsn_code') || '',
      });
    }
    setInvoiceGroups(Object.values(groups));
    setStep(2);
  }, [mapping, rawData, metadata]);

  // ─── Step 4: Execute Import ───
  const executeImport = async () => {
    setImporting(true);
    try {
      const result = await fetchApi('/api/sales/import', {
        method: 'POST',
        body: JSON.stringify({ invoices: invoiceGroups }),
      });
      setImportResult(result);
      setStep(3);
      if (result.totalCreated > 0) {
        addToast('success', 'Import Successful', `${result.totalCreated} invoice(s) created`);
      }
      if (result.totalErrors > 0) {
        addToast('error', 'Import Errors', `${result.totalErrors} invoice(s) had errors`);
      }
    } catch (e) {
      addToast('error', 'Import Failed', e.message);
    }
    setImporting(false);
  };

  const handlePrint = (type, invoice) => {
    if (!invoice) return;
    printInvoice(invoice.id, type);
  };

  const reset = () => {
    setStep(0); setFileName(''); setRawData([]); setHeaders([]);
    setMapping({}); setInvoiceGroups([]); setImporting(false);
    setImportResult(null); setSelectedInvoice(null); setMetadata(null);
  };

  // Calculate totals for a group
  const groupTotal = (group) => {
    return group.items.reduce((sum, item) => {
      const gross = item.quantity * item.unit_price;
      const disc = gross * item.discount_percent / 100;
      const taxable = gross - disc;
      const tax = taxable * item.gst_rate / 100;
      return sum + taxable + tax;
    }, 0);
  };

  return (
    <div className="csv-import-page" style={{ padding: '24px', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* ═══ Step Indicator ═══ */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 24, gap: 0, flexShrink: 0 }}>
        {STEPS.map((s, i) => (
          <React.Fragment key={s}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              color: i <= step ? 'var(--accent-blue)' : 'var(--text-muted)',
              fontWeight: i === step ? 700 : 400, fontSize: '0.95rem',
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: i < step ? 'var(--accent-green)' : i === step ? 'var(--accent-blue)' : 'var(--surface-2)',
                color: i <= step ? '#fff' : 'var(--text-muted)', fontWeight: 700, fontSize: '0.85rem',
                transition: 'all 0.3s ease',
              }}>
                {i < step ? <Check size={16} /> : i + 1}
              </div>
              <span style={{ whiteSpace: 'nowrap' }}>{s}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div style={{
                flex: 1, height: 2, margin: '0 12px',
                background: i < step ? 'var(--accent-green)' : 'var(--surface-2)',
                transition: 'background 0.3s ease',
              }} />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* ═══ Step 0: Upload ═══ */}
      {step === 0 && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            style={{
              width: '100%', maxWidth: 600, padding: '64px 48px', borderRadius: 16,
              border: `2px dashed ${dragOver ? 'var(--accent-blue)' : 'var(--border)'}`,
              background: dragOver ? 'rgba(59,130,246,0.08)' : 'var(--surface-1)',
              textAlign: 'center', cursor: 'pointer',
              transition: 'all 0.3s ease',
            }}
          >
            <Upload size={48} style={{ color: 'var(--accent-blue)', marginBottom: 16 }} />
            <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
              Drop your CSV file here
            </h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: 20, lineHeight: 1.6 }}>
              Upload the CSV exported from your website's "Daily Selection" or billing export.
              <br />Supports any column order — you'll map them in the next step.
            </p>
            <button className="btn btn-primary" style={{ padding: '10px 28px' }}>
              <FileSpreadsheet size={18} style={{ marginRight: 8 }} /> Choose CSV File
            </button>
            <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }}
              onChange={(e) => handleFile(e.target.files?.[0])} />
          </div>
        </div>
      )}

      {/* ═══ Step 1: Map Columns ═══ */}
      {step === 1 && (
        <div style={{ flex: 1, overflow: 'auto' }}>
          <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
                <FileSpreadsheet size={18} style={{ marginRight: 8, verticalAlign: 'middle' }} />
                Map CSV Columns — {fileName}
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                {rawData.length} data rows found. Map each CSV column to the appropriate field below.
              </p>
            </div>
            {missingRequired.length > 0 && (
              <div style={{ color: 'var(--accent-amber)', display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.88rem', fontWeight: 600 }}>
                <AlertTriangle size={16} /> Missing: {missingRequired.join(', ')}
              </div>
            )}
          </div>

          <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid var(--border)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
              <thead>
                <tr style={{ background: 'var(--surface-2)' }}>
                  {headers.map((h, i) => (
                    <th key={i} style={{ padding: '10px 12px', borderBottom: '2px solid var(--border)', textAlign: 'left', whiteSpace: 'nowrap', minWidth: 160 }}>
                      <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>{h}</div>
                      <select
                        value={mapping[i] || ''}
                        onChange={(e) => updateMapping(i, e.target.value)}
                        style={{
                          width: '100%', padding: '6px 8px', borderRadius: 6,
                          background: mapping[i] ? 'rgba(59,130,246,0.12)' : 'var(--surface-1)',
                          border: `1px solid ${mapping[i] ? 'var(--accent-blue)' : 'var(--border)'}`,
                          color: 'var(--text-primary)', fontSize: '0.82rem',
                        }}
                      >
                        {TARGET_FIELDS.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
                      </select>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rawData.slice(0, 5).map((row, ri) => (
                  <tr key={ri} style={{ borderBottom: '1px solid var(--border)' }}>
                    {headers.map((_, ci) => (
                      <td key={ci} style={{ padding: '8px 12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 200 }}>
                        {row[ci] || ''}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rawData.length > 5 && (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: 8, textAlign: 'center' }}>
              Showing first 5 of {rawData.length} rows
            </p>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
            <button className="btn btn-ghost" onClick={reset}><ArrowLeft size={16} /> Start Over</button>
            <button className="btn btn-primary" onClick={buildPreview} disabled={missingRequired.length > 0}>
              Build Preview <ArrowRight size={16} style={{ marginLeft: 6 }} />
            </button>
          </div>
        </div>
      )}

      {/* ═══ Step 2: Preview ═══ */}
      {step === 2 && (
        <div style={{ flex: 1, overflow: 'auto' }}>
          <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
                Import Preview — {invoiceGroups.length} Invoice(s)
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                Review the invoices below. Missing customers or items will be auto-created.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8, fontSize: '0.88rem' }}>
              <span style={{ padding: '4px 10px', borderRadius: 6, background: 'rgba(59,130,246,0.12)', color: 'var(--accent-blue)', fontWeight: 600 }}>
                {invoiceGroups.reduce((s, g) => s + g.items.length, 0)} items
              </span>
              <span style={{ padding: '4px 10px', borderRadius: 6, background: 'rgba(16,185,129,0.12)', color: 'var(--accent-green)', fontWeight: 600 }}>
                {formatCurrency(invoiceGroups.reduce((s, g) => s + groupTotal(g), 0))} total
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {invoiceGroups.map((grp, gi) => (
              <div key={gi} style={{
                border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden',
                background: 'var(--surface-1)',
              }}>
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '12px 16px', background: 'var(--surface-2)',
                  borderBottom: '1px solid var(--border)',
                }}>
                  <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                    <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                      #{gi + 1} {grp.client_name || 'Walk-in Customer'}
                    </span>
                    {grp.invoice_date && <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{grp.invoice_date}</span>}
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      {grp.items.length} item(s)
                    </span>
                    <button className="btn btn-ghost btn-sm" onClick={() => {
                      navigate('/sales/new', { state: { importedInvoice: grp } });
                    }} style={{ padding: '2px 8px', fontSize: '0.78rem', color: 'var(--accent-blue)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Edit size={12} /> Open in Billing
                    </button>
                  </div>
                  <span style={{ fontWeight: 700, color: 'var(--accent-green)', fontSize: '1.05rem' }}>
                    {formatCurrency(Math.round(groupTotal(grp)))}
                  </span>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--surface-2)', opacity: 0.7 }}>
                      <th style={{ padding: '6px 12px', textAlign: 'left' }}>Item</th>
                      <th style={{ padding: '6px 8px', textAlign: 'right', width: 60 }}>Qty</th>
                      <th style={{ padding: '6px 8px', textAlign: 'right', width: 80 }}>Rate</th>
                      <th style={{ padding: '6px 8px', textAlign: 'right', width: 60 }}>GST%</th>
                      <th style={{ padding: '6px 8px', textAlign: 'right', width: 60 }}>Disc%</th>
                      <th style={{ padding: '6px 8px', textAlign: 'right', width: 90 }}>Est. Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {grp.items.map((item, ii) => {
                      const gross = item.quantity * item.unit_price;
                      const disc = gross * item.discount_percent / 100;
                      const taxable = gross - disc;
                      const tax = taxable * item.gst_rate / 100;
                      return (
                        <tr key={ii} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--text-primary)' }}>{item.item_name}</td>
                          <td style={{ padding: '8px 8px', textAlign: 'right' }}>{item.quantity} {item.unit_name}</td>
                          <td style={{ padding: '8px 8px', textAlign: 'right' }}>{formatCurrency(item.unit_price)}</td>
                          <td style={{ padding: '8px 8px', textAlign: 'right' }}>{item.gst_rate}%</td>
                          <td style={{ padding: '8px 8px', textAlign: 'right' }}>{item.discount_percent > 0 ? item.discount_percent + '%' : '—'}</td>
                          <td style={{ padding: '8px 8px', textAlign: 'right', fontWeight: 600 }}>{formatCurrency(Math.round(taxable + tax))}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
            <button className="btn btn-ghost" onClick={() => setStep(1)}>
              <ArrowLeft size={16} /> Back to Mapping
            </button>
            <button className="btn btn-primary btn-lg" onClick={executeImport} disabled={importing}>
              {importing ? (
                <><RefreshCw size={18} style={{ animation: 'spin 1s linear infinite' }} /> Importing...</>
              ) : (
                <><Download size={18} style={{ marginRight: 6 }} /> Import {invoiceGroups.length} Invoice(s)</>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ═══ Step 3: Results ═══ */}
      {step === 3 && importResult && (
        <div style={{ flex: 1, overflow: 'auto' }}>
          <div style={{
            textAlign: 'center', padding: '32px 0 24px',
          }}>
            <div style={{
              width: 64, height: 64, borderRadius: '50%', margin: '0 auto 16px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: importResult.totalCreated > 0 ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
            }}>
              {importResult.totalCreated > 0 ? <Check size={32} style={{ color: 'var(--accent-green)' }} /> : <AlertTriangle size={32} style={{ color: 'var(--accent-red)' }} />}
            </div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
              Import Complete
            </h2>
            <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginBottom: 24 }}>
              <span style={{ padding: '6px 14px', borderRadius: 8, background: 'rgba(16,185,129,0.12)', color: 'var(--accent-green)', fontWeight: 700 }}>
                {importResult.totalCreated} Created
              </span>
              {importResult.totalErrors > 0 && (
                <span style={{ padding: '6px 14px', borderRadius: 8, background: 'rgba(239,68,68,0.12)', color: 'var(--accent-red)', fontWeight: 700 }}>
                  {importResult.totalErrors} Errors
                </span>
              )}
            </div>
          </div>

          {/* Errors */}
          {importResult.errors?.length > 0 && (
            <div style={{ marginBottom: 20, padding: '12px 16px', borderRadius: 8, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
              <h4 style={{ color: 'var(--accent-red)', marginBottom: 6 }}>Errors:</h4>
              {importResult.errors.map((err, i) => (
                <p key={i} style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginBottom: 2 }}>
                  Invoice #{err.index + 1}: {err.error}
                </p>
              ))}
            </div>
          )}

          {/* Created invoices with print buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {importResult.created?.map((inv, i) => (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '12px 16px', borderRadius: 8, background: 'var(--surface-1)',
                border: '1px solid var(--border)',
              }}>
                <div>
                  <span style={{ fontWeight: 700, color: 'var(--accent-blue)', marginRight: 12 }}>{inv.invoice_number}</span>
                  <span style={{ color: 'var(--text-secondary)', marginRight: 12 }}>{inv.client_name}</span>
                  <span style={{ fontWeight: 700, color: 'var(--accent-green)' }}>{formatCurrency(inv.grand_total)}</span>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => handlePrint('a4', inv)}>
                    <Printer size={14} style={{ marginRight: 4 }} /> A4
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => handlePrint('a5', inv)}>
                    <Printer size={14} style={{ marginRight: 4 }} /> A5
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => handlePrint('thermal', inv)}>
                    <Printer size={14} style={{ marginRight: 4 }} /> Thermal
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 32, gap: 12 }}>
            <button className="btn btn-primary" onClick={reset}>
              <RefreshCw size={16} style={{ marginRight: 6 }} /> Import Another CSV
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
