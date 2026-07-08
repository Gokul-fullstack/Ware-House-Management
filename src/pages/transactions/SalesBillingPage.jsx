import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Save, Printer, Trash2, Search, X, Plus, ArrowLeft, Upload } from 'lucide-react';
import { useApi } from '../../contexts/AuthContext';
import { useApp } from '../../contexts/AppContext';
import Modal from '../../components/ui/Modal';
import { QuickAddItemModal, QuickAddClientModal } from '../../components/QuickAddModals';

const emptyRow = () => ({ id: Date.now(), item_id: null, item_name: '', hsn_code: '', quantity: 1, unit_price: 0, base_unit_price: 0, mrp: 0, unit_name: 'Pcs', bulk_unit_name: '', bulk_conversion: 1, selected_unit: 'pcs', discount_percent: 0, gst_rate: 18, taxable_amount: 0, cgst_amount: 0, sgst_amount: 0, igst_amount: 0, total_amount: 0, is_free: false, _search: '', _results: [], _showSearch: false, _highlightIdx: 0 });

export default function SalesBillingPage() {
  const fetchApi = useApi();
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { formatCurrency, addToast, company, items, refreshItems, printInvoice } = useApp();

  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [clientSearch, setClientSearch] = useState('');
  const [clientResults, setClientResults] = useState([]);
  const [selectedClient, setSelectedClient] = useState(null);
  const [showClientSearch, setShowClientSearch] = useState(false);
  const [paymentMode, setPaymentMode] = useState('cash');
  const [isInterState, setIsInterState] = useState(false);
  const [notes, setNotes] = useState('');
  const [rows, setRows] = useState([emptyRow()]);
  const [saving, setSaving] = useState(false);
  const [savedInvoice, setSavedInvoice] = useState(null);
  const [loadingInvoice, setLoadingInvoice] = useState(false);
  const [originalInvoiceNumber, setOriginalInvoiceNumber] = useState('');
  const [defaultPrintFormat, setDefaultPrintFormat] = useState(localStorage.getItem('default_print_format') || 'none');
  const [quickAddItemOpen, setQuickAddItemOpen] = useState(false);
  const [quickAddClientOpen, setQuickAddClientOpen] = useState(false);
  const [lessPercent, setLessPercent] = useState(0);
  const [lessAmount, setLessAmount] = useState(0);
  const clientRef = useRef(null);
  const fileInputRef = useRef(null);
  const [units, setUnits] = useState([]);
  useEffect(() => {
    fetchApi('/api/units').then(setUnits).catch(() => {});
  }, []);

  // Wrap clearForm in useCallback to avoid stale closures in keyboard handler
  const clearForm = useCallback(() => {
    setRows([emptyRow()]);
    setSelectedClient(null);
    setClientSearch('');
    setNotes('');
    setPaymentMode('cash');
    setIsInterState(false);
    setSavedInvoice(null);
    setInvoiceDate(new Date().toISOString().split('T')[0]);
    setOriginalInvoiceNumber('');
    setLessPercent(0);
    setLessAmount(0);
    if (id) {
      navigate('/sales/new');
    }
  }, [id, navigate]);

  // Load imported invoice from CSV Import Page redirect if present
  useEffect(() => {
    if (location.state?.importedInvoice) {
      const inv = location.state.importedInvoice;
      
      // Populate client info
      if (inv.client_name) {
        setSelectedClient({
          id: null,
          name: inv.client_name,
          gstin: inv.client_gstin || '',
          address_line1: inv.client_address || '',
          city: '',
          phone: inv.client_phone || ''
        });
        setClientSearch(inv.client_name);
      }
      
      if (inv.invoice_date) {
        setInvoiceDate(inv.invoice_date);
      }

      // Populate rows
      const newRows = inv.items.map(item => {
        const qty = Number(item.quantity) || 1;
        const rate = Number(item.unit_price) || 0;
        const mrp = Number(item.mrp) || rate;
        const gstRate = Number(item.gst_rate) || 18;
        const discPct = Number(item.discount_percent) || 0;

        const gross = qty * rate;
        const discAmt = gross * discPct / 100;
        const taxable = gross - discAmt;
        let cgst = 0, sgst = 0, igst = 0;
        if (isInterState) {
          igst = taxable * gstRate / 100;
        } else {
          cgst = taxable * gstRate / 200;
          sgst = taxable * gstRate / 200;
        }

        // Try to match item inside active items context
        const matchedItem = items.find(i => i.name.toLowerCase() === item.item_name?.toLowerCase());

        return {
          id: Date.now() + Math.random(),
          item_id: matchedItem?.id || null,
          item_name: item.item_name,
          hsn_code: matchedItem?.hsn_code || item.hsn_code || '',
          quantity: qty,
          unit_price: rate,
          mrp: mrp,
          unit_name: matchedItem?.unit_name || item.unit_name || 'Pcs',
          discount_percent: discPct,
          gst_rate: gstRate,
          taxable_amount: Math.round(taxable * 100) / 100,
          cgst_amount: Math.round(cgst * 100) / 100,
          sgst_amount: Math.round(sgst * 100) / 100,
          igst_amount: Math.round(igst * 100) / 100,
          total_amount: Math.round((taxable + cgst + sgst + igst) * 100) / 100,
          is_free: false,
          _search: item.item_name,
          _results: [],
          _showSearch: false,
          _highlightIdx: 0
        };
      });

      setRows(newRows.length ? newRows : [emptyRow()]);
      addToast('success', 'CSV Loaded', 'Invoice details imported successfully. You can now modify it.');
      
      // Clean location state to avoid reloading on every render
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, items, isInterState]);

  const handleCSVImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target.result;
      let parsed = parseCSV(text);
      if (parsed.length < 2) {
        addToast('error', 'Invalid CSV', 'File must have at least a header row and one data row');
        return;
      }

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
      const rowsData = parsed.slice(1).filter(row => row.some(cell => cell.trim()));

      // Map columns
      const mapping = {};
      hdrs.forEach((h, idx) => {
        const target = autoMap(h);
        if (target) mapping[target] = idx;
      });

      const required = ['item_name', 'quantity', 'unit_price'];
      const missing = required.filter(f => mapping[f] === undefined);
      if (missing.length > 0) {
        addToast('error', 'Import Failed', `Missing required columns: ${missing.join(', ')}`);
        return;
      }

      // Populate client info if metadata found
      if (parsedMetadata) {
        if (parsedMetadata.client_name) {
          setSelectedClient({
            id: null,
            name: parsedMetadata.client_name,
            gstin: parsedMetadata.client_gstin || '',
            address_line1: parsedMetadata.client_address || '',
            city: '',
            phone: ''
          });
          setClientSearch(parsedMetadata.client_name);
        }
        if (parsedMetadata.invoice_date) {
          setInvoiceDate(parsedMetadata.invoice_date);
        }
      }

      // Map rows
      const newRows = rowsData.map(row => {
        const item_name = row[mapping.item_name]?.trim() || '';
        const quantity = parseNumeric(row[mapping.quantity]);
        const unit_price = parseNumeric(row[mapping.unit_price]);
        const mrp = mapping.mrp !== undefined ? parseNumeric(row[mapping.mrp]) : unit_price;
        const gst_rate = mapping.gst_rate !== undefined ? (parseNumeric(row[mapping.gst_rate]) || 18) : 18;
        const discount_percent = mapping.discount_percent !== undefined ? parseNumeric(row[mapping.discount_percent]) : 0;
        const unit_name = mapping.unit_name !== undefined ? row[mapping.unit_name]?.trim() || 'Pcs' : 'Pcs';
        const hsn_code = mapping.hsn_code !== undefined ? row[mapping.hsn_code]?.trim() || '' : '';

        const gross = quantity * unit_price;
        const discAmt = gross * discount_percent / 100;
        const taxable = gross - discAmt;
        let cgst = 0, sgst = 0, igst = 0;
        if (isInterState) {
          igst = taxable * gst_rate / 100;
        } else {
          cgst = taxable * gst_rate / 200;
          sgst = taxable * gst_rate / 200;
        }

        // Try to match in items context
        const matchedItem = items.find(i => i.name.toLowerCase() === item_name.toLowerCase());

        return {
          id: Date.now() + Math.random(),
          item_id: matchedItem?.id || null,
          item_name: item_name,
          hsn_code: matchedItem?.hsn_code || hsn_code,
          quantity: quantity || 1,
          unit_price: unit_price || 0,
          mrp: mrp || unit_price || 0,
          unit_name: matchedItem?.unit_name || unit_name,
          discount_percent: discount_percent || 0,
          gst_rate: matchedItem?.gst_rate || gst_rate,
          taxable_amount: Math.round(taxable * 100) / 100,
          cgst_amount: Math.round(cgst * 100) / 100,
          sgst_amount: Math.round(sgst * 100) / 100,
          igst_amount: Math.round(igst * 100) / 100,
          total_amount: Math.round((taxable + cgst + sgst + igst) * 100) / 100,
          is_free: false,
          _search: item_name,
          _results: [],
          _showSearch: false,
          _highlightIdx: 0
        };
      });

      setRows(newRows.length ? newRows : [emptyRow()]);
      addToast('success', 'CSV Parsed', 'Loaded CSV selection data into billing rows.');
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Load invoice if in edit mode
  useEffect(() => {
    if (!id) {
      clearForm();
      return;
    }

    const loadInvoice = async () => {
      setLoadingInvoice(true);
      try {
        const sale = await fetchApi(`/api/sales/${id}`);
        setInvoiceDate(sale.invoice_date);
        setPaymentMode(sale.payment_mode || 'cash');
        setIsInterState(!!sale.is_inter_state);
        setNotes(sale.notes || '');
        setOriginalInvoiceNumber(sale.invoice_number);
        setLessPercent(sale.discount_percent || 0);
        setLessAmount(sale.discount_amount || 0);

        // Load client details
        if (sale.client_id) {
          setSelectedClient({
            id: sale.client_id,
            name: sale.client_name,
            gstin: sale.client_gstin,
            address_line1: sale.client_address_line1,
            city: sale.client_city,
            phone: sale.client_phone
          });
          setClientSearch(sale.client_name);
        } else {
          setSelectedClient(null);
          setClientSearch('');
        }

        // Map items
        const mappedRows = sale.items.map(item => {
          const qty = Number(item.quantity) || 1;
          const rate = Number(item.unit_price) || 0;
          const discPct = Number(item.discount_percent) || 0;
          const gstRate = Number(item.gst_rate) || 0;

          // Find item details from context
          const matchedItem = items.find(i => i.id === item.item_id);
          const isBulk = matchedItem && matchedItem.bulk_unit_name && (item.unit_name?.toLowerCase() === matchedItem.bulk_unit_name.toLowerCase());

          return {
            id: item.id || Date.now() + Math.random(),
            item_id: item.item_id,
            item_name: item.item_name,
            hsn_code: item.hsn_code || '',
            quantity: qty,
            unit_price: rate,
            mrp: item.mrp || 0,
            unit_name: matchedItem?.unit_name || 'Pcs',
            bulk_unit_name: matchedItem?.bulk_unit_name || '',
            bulk_conversion: matchedItem?.bulk_conversion || 1,
            selected_unit: isBulk ? 'bulk' : 'pcs',
            discount_percent: discPct,
            gst_rate: gstRate,
            taxable_amount: item.taxable_amount,
            cgst_amount: item.cgst_amount,
            sgst_amount: item.sgst_amount,
            igst_amount: item.igst_amount,
            total_amount: item.total_amount,
            is_free: !!item.is_free,
            _search: item.item_name,
            _results: [],
            _showSearch: false,
            _highlightIdx: 0
          };
        });
        setRows(mappedRows.length ? mappedRows : [emptyRow()]);
      } catch (err) {
        addToast('error', 'Error', 'Failed to load invoice details: ' + err.message);
      } finally {
        setLoadingInvoice(false);
      }
    };

    loadInvoice();
  }, [id]);

  // Client search
  useEffect(() => {
    if (clientSearch.length < 1) { setClientResults([]); return; }
    const t = setTimeout(() => {
      fetchApi(`/api/clients/search?q=${encodeURIComponent(clientSearch)}&type=customer`).then(setClientResults).catch(() => {});
    }, 300);
    return () => clearTimeout(t);
  }, [clientSearch]);

  const selectClient = (c) => { setSelectedClient(c); setClientSearch(c.store_name || c.name); setShowClientSearch(false); setClientResults([]); };

  // Item search for a specific row
  const searchItems = useCallback((rowIdx, q) => {
    if (q.length < 1) { updateRow(rowIdx, { _results: [], _showSearch: false }); return; }
    const term = q.toLowerCase();
    const results = items.filter(item => 
      item.name.toLowerCase().includes(term) || 
      (item.code || '').toLowerCase().includes(term)
    ).slice(0, 20);
    updateRow(rowIdx, { _results: results, _showSearch: true, _highlightIdx: 0 });
  }, [items]);

  const updateRow = (idx, updates) => {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, ...updates } : r));
  };

  const selectItem = (rowIdx, item) => {
    const hasBulk = (item.bulk_conversion || 1) > 1;
    updateRow(rowIdx, {
      item_id: item.id, item_name: item.name, hsn_code: item.hsn_code || '',
      unit_price: item.selling_price, base_unit_price: item.selling_price, mrp: item.mrp || 0, unit_name: item.unit_name || 'Pcs',
      bulk_unit_name: hasBulk ? (item.bulk_unit_name || 'Box') : '',
      bulk_conversion: item.bulk_conversion || 1,
      selected_unit: 'pcs', quantity: 1,
      gst_rate: item.gst_rate || 18,
      _search: item.name, _results: [], _showSearch: false,
    });
    recalcRow(rowIdx, { unit_price: item.selling_price, base_unit_price: item.selling_price, gst_rate: item.gst_rate || 18, quantity: 1, discount_percent: 0, mrp: item.mrp || 0, unit_name: item.unit_name || 'Pcs', bulk_unit_name: hasBulk ? (item.bulk_unit_name || 'Box') : '', bulk_conversion: item.bulk_conversion || 1, selected_unit: 'pcs' });

    // Move focus directly to Quantity input field of the current row
    setTimeout(() => {
      const tbody = document.querySelector('.billing-grid tbody');
      if (tbody) {
        const trs = tbody.querySelectorAll('tr');
        const targetTr = trs[rowIdx];
        if (targetTr) {
          const qtyInput = targetTr.querySelector('.cell-input.numeric');
          if (qtyInput) {
            qtyInput.focus();
            if (typeof qtyInput.select === 'function') qtyInput.select();
          }
        }
      }
    }, 50);
  };

  const handlePrint = (type, inv = savedInvoice) => {
    if (!inv) return;
    printInvoice(inv.id, type);
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
      return { ...row, taxable_amount: Math.round(taxable * 100) / 100, cgst_amount: Math.round(cgst * 100) / 100, sgst_amount: Math.round(sgst * 100) / 100, igst_amount: Math.round(igst * 100) / 100, total_amount: Math.round((taxable + cgst + sgst + igst) * 100) / 100 };
    }));
  };

  const handleUnitToggle = (idx, newUnitType, nextVal) => {
    setRows(prev => prev.map((r, i) => {
      if (i !== idx) return r;
      const row = { ...r };
      const oldUnitType = row.selected_unit || 'pcs';
      if (oldUnitType === newUnitType) return row;

      const conversion = Number(row.bulk_conversion) || 1;
      const oldQty = Number(row.quantity) || 0;
      const oldRate = Number(row.unit_price) || 0;

      let newQty = oldQty;
      let newRate = oldRate;

      if (oldUnitType === 'pcs' && newUnitType === 'bulk') {
        newRate = oldRate * conversion;
      } else if (oldUnitType === 'bulk' && newUnitType === 'pcs') {
        newRate = oldRate / conversion;
      }

      row.selected_unit = newUnitType;
      row.quantity = newQty;
      row.unit_price = newRate;

      if (newUnitType === 'bulk') {
        row.bulk_unit_name = nextVal || row.bulk_unit_name || 'Box';
      } else {
        row.unit_name = nextVal || row.unit_name || 'Pcs';
      }

      // Recalculate TAXABLE, TAX, and TOTAL immediately after toggling
      const gross = newQty * newRate;
      const discAmt = gross * (Number(row.discount_percent) || 0) / 100;
      const taxable = gross - discAmt;
      let cgst = 0, sgst = 0, igst = 0;
      const gstRate = Number(row.gst_rate) || 0;
      if (isInterState) {
        igst = taxable * gstRate / 100;
      } else {
        cgst = taxable * gstRate / 200;
        sgst = taxable * gstRate / 200;
      }
      row.taxable_amount = Math.round(taxable * 100) / 100;
      row.cgst_amount = Math.round(cgst * 100) / 100;
      row.sgst_amount = Math.round(sgst * 100) / 100;
      row.igst_amount = Math.round(igst * 100) / 100;
      row.total_amount = Math.round((taxable + cgst + sgst + igst) * 100) / 100;

      return row;
    }));
  };

  // Recalc all rows when inter-state changes
  useEffect(() => {
    rows.forEach((_, i) => recalcRow(i));
  }, [isInterState]);

  const removeRow = (idx) => {
    if (rows.length <= 1) { setRows([emptyRow()]); return; }
    setRows(prev => prev.filter((_, i) => i !== idx));
  };

  const addEmptyRow = () => setRows(prev => [...prev, emptyRow()]);

  // Totals
  const validRows = rows.filter(r => r.item_id);
  const subtotal = validRows.reduce((s, r) => s + r.taxable_amount, 0);
  const cgstTotal = validRows.reduce((s, r) => s + r.cgst_amount, 0);
  const sgstTotal = validRows.reduce((s, r) => s + r.sgst_amount, 0);
  const igstTotal = validRows.reduce((s, r) => s + r.igst_amount, 0);
  const taxTotal = cgstTotal + sgstTotal + igstTotal;
  
  // Calculate overall discount
  const grossTotal = subtotal;
  const totalTax = taxTotal;
  const grossPlusTax = grossTotal + totalTax;
  
  let overallDiscount = Number(lessAmount) || 0;
  if (Number(lessPercent) > 0) {
    overallDiscount += Math.round((grossPlusTax * Number(lessPercent) / 100) * 100) / 100;
  }
  
  const rawGrand = grossPlusTax - overallDiscount;
  const grandTotal = Math.round(rawGrand);
  const roundOff = grandTotal - rawGrand;

  // Calculate Distribution of GST slabs
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
    setSelectedClient(client);
    setClientSearch(client.name);
    setShowClientSearch(false);
  };

  // Amount in words — Fixed Indian numbering system
  const numToWords = (n) => {
    if (!n || n === 0) return 'Zero Rupees Only';
    const ones = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
    const tens = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
    const toWords = (num) => {
      if (num === 0) return '';
      if (num < 20) return ones[num];
      if (num < 100) return tens[Math.floor(num / 10)] + (num % 10 ? ' ' + ones[num % 10] : '');
      return ones[Math.floor(num / 100)] + ' Hundred' + (num % 100 ? ' and ' + toWords(num % 100) : '');
    };
    const abs = Math.abs(Math.floor(n));
    if (abs === 0) return 'Zero Rupees Only';
    // Indian numbering: units (3 digits), thousands (2 digits), lakhs (2 digits), crores (2 digits), ...
    let result = '';
    const units = abs % 1000;
    const thousands = Math.floor(abs / 1000) % 100;
    const lakhs = Math.floor(abs / 100000) % 100;
    const crores = Math.floor(abs / 10000000) % 100;
    const aboveCrores = Math.floor(abs / 1000000000);
    if (aboveCrores > 0) result += toWords(aboveCrores) + ' Arab ';
    if (crores > 0) result += toWords(crores) + ' Crore ';
    if (lakhs > 0) result += toWords(lakhs) + ' Lakh ';
    if (thousands > 0) result += toWords(thousands) + ' Thousand ';
    if (units > 0) result += toWords(units) + ' ';
    return 'Rupees ' + result.trim() + ' Only';
  };

  const handleSave = useCallback(async () => {
    if (!validRows.length) { addToast('error', 'Add at least one item'); return; }
    setSaving(true);
    try {
      const body = {
        invoice_date: invoiceDate,
        client_id: selectedClient?.id || null,
        payment_mode: paymentMode,
        is_inter_state: isInterState,
        notes,
        discount_amount: overallDiscount,
        discount_percent: Number(lessPercent) || 0,
        round_off: roundOff,
        grand_total: grandTotal,
        items: validRows.map(r => ({
          item_id: r.item_id,
          quantity: Number(r.quantity),
          unit_name: r.selected_unit === 'bulk' ? (r.bulk_unit_name || 'Box') : (r.unit_name || 'Pcs'),
          unit_price: Number(r.unit_price),
          discount_percent: Number(r.discount_percent),
          gst_rate: Number(r.gst_rate),
          is_free: r.is_free,
          selected_unit: r.selected_unit || 'pcs'
        })),
      };

      let result;
      if (id) {
        result = await fetchApi(`/api/sales/${id}`, { method: 'PUT', body: JSON.stringify(body) });
        addToast('success', 'Invoice Updated', `Invoice ${result.invoice_number} updated successfully`);
      } else {
        result = await fetchApi('/api/sales', { method: 'POST', body: JSON.stringify(body) });
        setSavedInvoice(result);
        addToast('success', 'Invoice Created', `Invoice ${result.invoice_number} saved successfully`);
      }

      refreshItems();

      // Trigger auto-print if configured
      if (defaultPrintFormat !== 'none') {
        printInvoice(result.id, defaultPrintFormat);
      }

      if (id) {
        navigate('/reports/sales');
      } else {
        clearForm();
      }
    } catch (e) { addToast('error', 'Error', e.message); }
    setSaving(false);
  }, [validRows, id, invoiceDate, selectedClient, paymentMode, isInterState, notes, defaultPrintFormat, fetchApi, refreshItems, printInvoice, navigate, addToast, clearForm]);

  const handleCancelInvoice = useCallback(async () => {
    if (!id) return;
    if (!window.confirm('Cancel this invoice? Stock will be restored.')) return;
    try {
      await fetchApi(`/api/sales/${id}`, { method: 'DELETE' });
      addToast('success', 'Invoice Cancelled', 'Invoice has been cancelled and stock restored.');
      refreshItems();
      navigate('/reports/sales');
    } catch (e) { addToast('error', 'Error', e.message); }
  }, [id, fetchApi, addToast, refreshItems, navigate]);


  // Click outside client search to close dropdown
  useEffect(() => {
    const handler = (e) => {
      if (clientRef.current && !clientRef.current.contains(e.target)) {
        setShowClientSearch(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      if (e.ctrlKey && e.key === 's') { e.preventDefault(); handleSave(); }
      if (e.ctrlKey && e.key === 'n') { e.preventDefault(); clearForm(); }
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
              handleUnitToggle(idx, newUnit);
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
      if (e.key === 'F9') {
        e.preventDefault();
        const activeTr = document.activeElement?.closest('tr');
        if (activeTr) {
          const rowsList = Array.from(activeTr.closest('tbody').querySelectorAll('tr'));
          const idx = rowsList.indexOf(activeTr);
          if (idx !== -1) {
            const row = rows[idx];
            if (row && row.item_id) {
              const isFree = !row.is_free;
              updateRow(idx, { is_free: isFree, unit_price: isFree ? 0 : row.unit_price });
              recalcRow(idx, { unit_price: isFree ? 0 : row.unit_price });
            }
          }
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleSave, clearForm, rows, handleUnitToggle, removeRow, updateRow, recalcRow]);

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
      if (e.key === 'Enter' || e.key === 'ArrowRight') { e.preventDefault(); selectItem(rowIdx, row._results[row._highlightIdx]); return; }
      if (e.key === 'Escape') { updateRow(rowIdx, { _showSearch: false }); return; }
    }
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft' || e.key === 'Enter') {
      handleGridNavigation(e);
    }
  };

  if (loadingInvoice) {
    return <div className="loading-page"><div className="loading-spinner" /></div>;
  }

  return (
    <div className="billing-page">
      {/* Header */}
      <div className="billing-header">
        <div className="input-group" style={{ width: 170 }}>
          <label>{id ? 'Editing Invoice #' : 'Invoice #'}</label>
          <input className="input" value={id ? originalInvoiceNumber : (savedInvoice?.invoice_number || 'Auto')} readOnly style={{ color: 'var(--text-muted)' }} />
        </div>
        <div className="input-group" style={{ width: 160 }}>
          <label>Date</label>
          <input className="input" type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} />
        </div>
        <div className="input-group" style={{ flex: 1, minWidth: 200, position: 'relative' }} ref={clientRef}>
          <label>Customer</label>
          <div className="input-with-icon">
            <Search />
            <input className="input" value={clientSearch} onChange={e => { setClientSearch(e.target.value); setShowClientSearch(true); if (!e.target.value) setSelectedClient(null); }} onFocus={() => clientSearch.length >= 1 && setShowClientSearch(true)} placeholder="Search customer (or leave blank for Walk-in)" />
          </div>
          {showClientSearch && clientResults.length > 0 && (
            <div className="item-search-popup" style={{ zIndex: 100 }}>
              {clientResults.map(c => (
                <div key={c.id} className="search-result-item" onClick={() => selectClient(c)}>
                  <span>
                    <span className="item-name">{c.store_name || c.name}</span>
                    {c.store_name && <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: 8 }}>(Contact: {c.name})</span>}
                    <span className="item-code">{c.code}</span>
                  </span>
                  <span className="item-rate">{c.gstin || ''}</span>
                </div>
              ))}
            </div>
          )}
          {selectedClient && selectedClient.id && (
            <div style={{ display: 'flex', gap: 16, marginTop: 5, flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                Old Balance:{' '}
                <strong style={{ color: (selectedClient.current_balance || 0) > 0 ? '#ef4444' : (selectedClient.current_balance || 0) < 0 ? '#10b981' : 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                  {formatCurrency(selectedClient.current_balance || 0)}
                </strong>
              </span>
              {paymentMode !== 'cash' && (
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  New Balance:{' '}
                  <strong style={{ color: '#ef4444', fontFamily: 'var(--font-mono)' }}>
                    {formatCurrency((selectedClient.current_balance || 0) + grandTotal)}
                  </strong>
                </span>
              )}
            </div>
          )}
        </div>
        <div className="input-group" style={{ width: 240 }}>
          <label>Payment</label>
          <div className="toggle-group">
            {['cash', 'credit', 'upi', 'card', 'cheque'].map(m => (
              <button key={m} className={paymentMode === m ? 'active' : ''} onClick={() => setPaymentMode(m)} style={{ padding: '6px 10px', fontSize: '0.78rem' }}>{m.toUpperCase()}</button>
            ))}
          </div>
        </div>
        <div className="input-group" style={{ width: 100 }}>
          <label>GST Type</label>
          <div className="toggle-group">
            <button className={!isInterState ? 'active' : ''} onClick={() => setIsInterState(false)}>Intra</button>
            <button className={isInterState ? 'active' : ''} onClick={() => setIsInterState(true)}>Inter</button>
          </div>
        </div>
      </div>

      {/* Customer details panel */}
      {selectedClient && (
        <div className="billing-customer-panel">
          <div className="detail-item"><span className="detail-label">Name:</span><span className="detail-value">{selectedClient.name}</span></div>
          {selectedClient.gstin && <div className="detail-item"><span className="detail-label">GSTIN:</span><span className="detail-value">{selectedClient.gstin}</span></div>}
          {selectedClient.address_line1 && <div className="detail-item"><span className="detail-label">Address:</span><span className="detail-value">{selectedClient.address_line1}{selectedClient.city ? `, ${selectedClient.city}` : ''}</span></div>}
          {selectedClient.phone && <div className="detail-item"><span className="detail-label">Phone:</span><span className="detail-value">{selectedClient.phone}</span></div>}
        </div>
      )}

      {/* Billing Grid */}
      <div className="billing-grid-container">
        <table className="billing-grid">
          <thead>
            <tr>
              <th style={{ width: 40 }}>#</th>
              <th style={{ minWidth: 200 }}>Item Name</th>
              <th style={{ width: 90 }}>HSN</th>
              <th style={{ width: 100 }}>Qty</th>
              <th style={{ width: 85 }}>Unit</th>
              <th style={{ width: 80 }}>MRP ₹</th>
              <th style={{ width: 90 }}>Rate ₹</th>
              <th style={{ width: 65 }}>Disc%</th>
              <th style={{ width: 90 }} className="text-right">Taxable ₹</th>
              <th style={{ width: 55 }}>GST%</th>
              <th style={{ width: 80 }} className="text-right">Tax ₹</th>
              <th style={{ width: 90 }} className="text-right">R/Q ₹</th>
              <th style={{ width: 100 }} className="text-right">Total ₹</th>
              <th style={{ width: 36 }}></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => {
              const rowRQ = row.quantity > 0 ? (row.total_amount / row.quantity) : (Number(row.unit_price) * (1 + Number(row.gst_rate) / 100));
              const isFree = row.is_free;
              return (
                <tr key={row.id} className={isFree ? 'free-item-row' : ''}>
                  <td className="row-num">{idx + 1}</td>
                  <td style={{ position: 'relative' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <input className="cell-input" value={row._search || row.item_name}
                        onChange={e => { updateRow(idx, { _search: e.target.value, item_name: '' }); searchItems(idx, e.target.value); }}
                        onKeyDown={e => handleItemKeyDown(e, idx)}
                        onFocus={e => e.target.select()}
                        placeholder="Type to search item..."
                        style={{ flex: 1 }}
                      />
                      {row.item_id && (
                        <button
                          title={isFree ? 'Mark as chargeable' : 'Mark as FREE item'}
                          onClick={() => { updateRow(idx, { is_free: !isFree, unit_price: !isFree ? 0 : row.unit_price }); recalcRow(idx, { unit_price: !isFree ? 0 : row.unit_price }); }}
                          style={{ padding: '2px 6px', fontSize: '0.6rem', fontWeight: 700, borderRadius: 4, border: `1px solid ${isFree ? '#10b981' : 'var(--border-primary)'}`, background: isFree ? 'rgba(16,185,129,0.12)' : 'var(--bg-secondary)', color: isFree ? '#10b981' : 'var(--text-muted)', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}
                        >FREE</button>
                      )}
                    </div>
                    {row._showSearch && row._results.length > 0 && (
                      <div className="item-search-popup">
                        {row._results.map((item, ri) => {
                          const hasBulk = item.bulk_conversion > 1 && item.bulk_unit_name;
                          const bulkQty = hasBulk ? Math.floor(item.current_stock / item.bulk_conversion) : 0;
                          const pcsQty = hasBulk ? (item.current_stock % item.bulk_conversion) : item.current_stock;
                          const bulkUnitDisp = item.bulk_unit_name || 'Box';
                          const baseUnitDisp = (item.unit_name && item.unit_name.toLowerCase() !== bulkUnitDisp.toLowerCase()) ? item.unit_name : 'Pcs';
                          return (
                            <div key={item.id} className={`search-result-item ${ri === row._highlightIdx ? 'highlighted' : ''}`} onClick={() => selectItem(idx, item)}>
                              <span><span className="item-name">{item.name}</span><span className="item-code">{item.code}</span></span>
                              <span>
                                <span className={`item-stock ${item.current_stock <= 0 ? 'out' : item.current_stock <= (item.min_stock_level || 5) ? 'low' : 'ok'}`}>
                                  Stock: {item.current_stock} {baseUnitDisp}
                                  {hasBulk && ` (${bulkQty} ${bulkUnitDisp} + ${pcsQty} ${baseUnitDisp})`}
                                </span>
                                <span className="item-rate">₹{(item.selling_price * (1 + item.gst_rate / 100)).toFixed(2)}</span>
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </td>
                  <td><span className="cell-readonly">{row.hsn_code}</span></td>
                  <td>
                    <div className="qty-spinner">
                      <button onClick={() => { const q = Math.max(0, Number(row.quantity) - 1); updateRow(idx, { quantity: q }); recalcRow(idx, { quantity: q }); }}>−</button>
                      <input className="cell-input numeric" type="number" min="0" value={row.quantity}
                        onChange={e => { updateRow(idx, { quantity: e.target.value }); recalcRow(idx, { quantity: e.target.value }); }}
                        onKeyDown={handleGridNavigation} onFocus={e => e.target.select()}
                      />
                      <button onClick={() => { const q = Number(row.quantity) + 1; updateRow(idx, { quantity: q }); recalcRow(idx, { quantity: q }); }}>+</button>
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
                            handleUnitToggle(idx, selectedUnit, nextVal);
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
                            handleUnitToggle(idx, newUnit);
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
                  <td><input className="cell-input numeric" type="number" min="0" value={row.mrp} onChange={e => { updateRow(idx, { mrp: e.target.value }); }} onKeyDown={handleGridNavigation} onFocus={e => e.target.select()} style={{ width: '100%', minWidth: '70px' }} /></td>
                  <td><input className="cell-input numeric" type="number" min="0" value={row.unit_price} onChange={e => {
                    const newRate = Number(e.target.value) || 0;
                    const baseRate = row.selected_unit === 'bulk' ? (newRate / row.bulk_conversion) : newRate;
                    updateRow(idx, { unit_price: newRate, base_unit_price: baseRate });
                    recalcRow(idx, { unit_price: newRate });
                  }} onKeyDown={handleGridNavigation} onFocus={e => e.target.select()} style={{ width: '100%', minWidth: '80px' }} /></td>
                  <td>
                    <input className="cell-input numeric" type="number" min="0" max="100" value={row.discount_percent}
                      onChange={e => { updateRow(idx, { discount_percent: e.target.value }); recalcRow(idx, { discount_percent: e.target.value }); }}
                      onKeyDown={handleGridNavigation} onFocus={e => e.target.select()} style={{ width: '100%', minWidth: '55px' }}
                    />
                    <div className="disc-pills">
                      {[5, 10, 15].map(d => (
                        <button key={d} className="disc-pill" onClick={() => { updateRow(idx, { discount_percent: d }); recalcRow(idx, { discount_percent: d }); }}>{d}%</button>
                      ))}
                    </div>
                  </td>
                  <td className="cell-readonly">{formatCurrency(row.taxable_amount)}</td>
                  <td><input className="cell-input numeric" type="number" min="0" max="100" step="0.01" value={row.gst_rate} onChange={e => { updateRow(idx, { gst_rate: e.target.value }); recalcRow(idx, { gst_rate: e.target.value }); }} onKeyDown={handleGridNavigation} onFocus={e => e.target.select()} style={{ width: 54 }} /></td>
                  <td className="cell-readonly">{formatCurrency(row.cgst_amount + row.sgst_amount + row.igst_amount)}</td>
                  <td className="cell-readonly">{formatCurrency(rowRQ)}</td>
                  <td className="cell-readonly" style={{ fontWeight: 600, color: isFree ? '#10b981' : 'var(--text-primary)' }}>{isFree ? 'FREE' : formatCurrency(row.total_amount)}</td>
                  <td><button className="row-delete" onClick={() => removeRow(idx)}><X size={14} /></button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ padding: '8px 24px', flexShrink: 0 }}>
        <button className="btn btn-ghost btn-sm" onClick={addEmptyRow}><Plus size={14} /> Add Row</button>
      </div>

      {/* Summary */}
      <div className="billing-summary" style={{ display: 'grid', gridTemplateColumns: '280px 240px auto 240px', gap: 20, alignItems: 'start', padding: '16px 24px' }}>
        {/* Left: Notes & Words */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="input-group" style={{ margin: 0 }}>
            <label>Notes / Remarks</label>
            <textarea className="textarea" value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Optional notes..." />
          </div>
          <div className="billing-amount-words" style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{grandTotal > 0 && numToWords(grandTotal)}</div>
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
                    <td style={{ padding: '3px 6px', fontWeight: 600 }}>Sales {rate}%</td>
                    <td style={{ padding: '3px 6px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{slab.sales.toFixed(2)}</td>
                    <td style={{ padding: '3px 6px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{slab.tax.toFixed(2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* LESS Discount & Shortcuts Legend */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* LESS (% / Rs.) */}
          <div className="less-discount-box" style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: 8, background: 'var(--bg-secondary)', borderRadius: 8, border: '1px solid var(--border-primary)' }}>
            <span style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>LESS (% / Rs.)</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>%</span>
                <input className="input" type="number" min="0" max="100" value={lessPercent || ''} onChange={e => { setLessPercent(e.target.value); setLessAmount(0); }} style={{ padding: '3px 6px', fontSize: '0.75rem', height: 28 }} />
              </div>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>₹</span>
                <input className="input" type="number" min="0" value={lessAmount || ''} onChange={e => { setLessAmount(e.target.value); setLessPercent(0); }} style={{ padding: '3px 6px', fontSize: '0.75rem', height: 28 }} />
              </div>
            </div>
          </div>

          {/* Shortcuts panel */}
          <div className="shortcuts-legend" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '3px', padding: 8, background: 'var(--bg-secondary)', borderRadius: 8, border: '1px solid var(--border-primary)', fontSize: '0.65rem', fontWeight: 600 }}>
            <div style={{ color: 'var(--text-muted)' }}><span style={{ color: 'var(--accent-blue)', fontWeight: 700 }}>F4:</span> Toggle Unit (PCS/BOX)</div>
            <div style={{ color: 'var(--text-muted)' }}><span style={{ color: 'var(--accent-blue)', fontWeight: 700 }}>F5:</span> Remove Item Row</div>
            <div style={{ color: 'var(--text-muted)' }}><span style={{ color: 'var(--accent-blue)', fontWeight: 700 }}>F7:</span> Quick Add Item</div>
            <div style={{ color: 'var(--text-muted)' }}><span style={{ color: 'var(--accent-blue)', fontWeight: 700 }}>F8:</span> Quick Add Customer</div>
            <div style={{ color: 'var(--text-muted)' }}><span style={{ color: 'var(--accent-blue)', fontWeight: 700 }}>F9:</span> Toggle Free Item</div>
          </div>
        </div>

        {/* Right: Summary Panel */}
        <div className="billing-summary-right" style={{ minWidth: 220 }}>
          <div className="billing-summary-row" style={{ background: '#002f6c', color: '#fff', padding: '6px 12px', borderLeft: '4px solid var(--accent-blue)', display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}><span className="label" style={{ fontWeight: 700 }}>GROSS</span><span className="value" style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{formatCurrency(subtotal)}</span></div>
          <div className="billing-summary-row" style={{ background: '#002f6c', color: '#fff', padding: '6px 12px', borderLeft: '4px solid var(--accent-blue)', display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}><span className="label" style={{ fontWeight: 700 }}>GST</span><span className="value" style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{formatCurrency(taxTotal)}</span></div>
          <div className="billing-summary-row" style={{ background: '#5c0000', color: '#fff', padding: '6px 12px', borderLeft: '4px solid #ef4444', display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}><span className="label" style={{ fontWeight: 700 }}>DISCOUNT</span><span className="value" style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{formatCurrency(overallDiscount)}</span></div>
          <div className="billing-summary-row" style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', padding: '6px 12px', borderLeft: '4px solid var(--border-primary)', display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}><span className="label" style={{ fontWeight: 700 }}>ROUND</span><span className="value" style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{roundOff > 0 ? '+' : ''}{roundOff.toFixed(2)}</span></div>
          <div className="billing-summary-row total" style={{ background: '#004b00', color: '#fff', padding: '8px 12px', borderLeft: '4px solid #10b981', display: 'flex', justifyContent: 'space-between' }}><span className="label" style={{ fontWeight: 700 }}>NET</span><span className="value" style={{ fontFamily: 'var(--font-mono)', fontSize: '1.4rem', fontWeight: 700 }}>{formatCurrency(grandTotal)}</span></div>
        </div>
      </div>

      {/* Actions */}
      <div className="billing-actions" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          {id ? (
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-secondary btn-lg" onClick={() => navigate('/reports/sales')}>
                <ArrowLeft size={16} style={{ marginRight: 6 }} /> Cancel Edit
              </button>
              <button className="btn btn-danger" onClick={handleCancelInvoice} style={{ padding: '8px 16px', borderRadius: 'var(--radius-md)', background: 'rgba(220,38,38,0.1)', color: 'var(--accent-red, #ef4444)', border: '1px solid rgba(220,38,38,0.3)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Trash2 size={15} /> Cancel Invoice
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 12 }}>
              <button className="btn btn-ghost" onClick={clearForm}><Trash2 size={16} /> Clear</button>
              <label className="btn btn-secondary" style={{ margin: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px' }}>
                <Upload size={15} /> Import CSV
                <input type="file" accept=".csv" onChange={handleCSVImport} style={{ display: 'none' }} />
              </label>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <div className="input-group" style={{ flexDirection: 'row', alignItems: 'center', gap: 8, margin: 0, width: 'auto' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Auto-Print:</span>
            <select
              className="input input-sm"
              value={defaultPrintFormat}
              onChange={e => {
                const val = e.target.value;
                setDefaultPrintFormat(val);
                localStorage.setItem('default_print_format', val);
              }}
              style={{ width: 155, height: 32, padding: '4px 8px' }}
            >
              <option value="none">No Auto Print</option>
              <option value="a4">Auto A4 Invoice</option>
              <option value="a5">Auto A5 Invoice</option>
              <option value="thermal">Auto Thermal Receipt</option>
            </select>
          </div>

          <button className="btn btn-primary btn-lg" onClick={handleSave} disabled={saving || !validRows.length}>
            <Save size={18} /> {saving ? (id ? 'Updating...' : 'Saving...') : (id ? 'Update Invoice' : 'Save Invoice')}
          </button>
        </div>
      </div>

      {savedInvoice && (
        <Modal isOpen={!!savedInvoice} onClose={() => setSavedInvoice(null)} title="Invoice Saved Successfully" size="md">
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <p style={{ fontSize: '1.15rem', marginBottom: 8, color: 'var(--text-primary)' }}>
              Invoice <strong style={{ color: 'var(--accent-blue)' }}>{savedInvoice.invoice_number}</strong> has been saved.
            </p>
            <p style={{ color: 'var(--text-muted)', marginBottom: 24 }}>
              Select a format below to print the tax invoice.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button className="btn btn-secondary" onClick={() => setSavedInvoice(null)} style={{ padding: '10px 20px' }}>
                Close
              </button>
              <button className="btn btn-primary" onClick={() => handlePrint('a4', savedInvoice)} style={{ padding: '10px 20px' }}>
                <Printer size={16} style={{ marginRight: 6 }} /> Print A4
              </button>
              <button className="btn btn-primary" onClick={() => handlePrint('a5', savedInvoice)} style={{ padding: '10px 20px' }}>
                <Printer size={16} style={{ marginRight: 6 }} /> Print A5
              </button>
              <button className="btn btn-primary" onClick={() => handlePrint('thermal', savedInvoice)} style={{ padding: '10px 20px' }}>
                <Printer size={16} style={{ marginRight: 6 }} /> Print Thermal
              </button>
            </div>
          </div>
        </Modal>
      )}

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
        type="customer"
        fetchApi={fetchApi}
        addToast={addToast}
      />
    </div>
  );
}

// ─── CSV Parser Helpers ───

function parseCSV(text) {
  const lines = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i+1];
    
    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      if (lines.length === 0) lines.push([]);
      lines[lines.length - 1].push(current);
      current = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && next === '\n') i++;
      if (lines.length === 0) lines.push([]);
      lines[lines.length - 1].push(current);
      current = '';
      lines.push([]);
    } else {
      current += char;
    }
  }
  if (current || (lines.length > 0 && lines[lines.length - 1].length > 0)) {
    if (lines.length === 0) lines.push([current]);
    else lines[lines.length - 1].push(current);
  }
  while (lines.length > 0 && lines[lines.length - 1].length === 0) lines.pop();
  return lines;
}

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

function parseNumeric(val) {
  if (val === undefined || val === null || val === '') return 0;
  const cleaned = String(val).replace(/[₹$,\s]/g, '').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}
