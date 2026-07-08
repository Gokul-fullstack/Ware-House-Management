// electron/print/a4-invoice.js — A4 GST Tax Invoice (Indian format matching Suriya Maligai style)
'use strict';

/**
 * Generate a full A4 GST Tax Invoice HTML matching traditional Indian bill format.
 * @param {object} invoice - The sale/invoice object with items array
 * @param {object} company - The company profile object
 * @returns {string} Complete HTML string ready for print
 */
function generateA4InvoiceHTML(invoice, company) {
  const c = {
    name: company.name || 'SURIYA MALIGAI',
    address_line1: company.address_line1 || 'NO-27, NORTH REDDY STREET,,',
    address_line2: company.address_line2 || 'UTHIRAMERUR-603406.',
    address_line3: company.address_line3 || 'KPM DISTRICT',
    city: company.city || 'Uthiramerur',
    state: company.state || 'Tamil Nadu',
    pincode: company.pincode || '603406',
    phone: company.phone || '6379355917',
    mobile: company.mobile || '9600838819',
    email: company.email || '',
    gstin: company.gstin || '33AOEPT0355D2Z9',
    state_code: company.state_code || '33',
    bank_name: company.bank_name || '',
    bank_account: company.bank_account || '',
    bank_ifsc: company.bank_ifsc || '',
    bank_branch: company.bank_branch || '',
  };

  // Build full address lines
  const addressLines = [c.address_line1, c.address_line2, c.address_line3].filter(Boolean);

  const invoiceDate = new Date(invoice.invoice_date || invoice.created_at);
  const dd = String(invoiceDate.getDate()).padStart(2, '0');
  const mm = String(invoiceDate.getMonth() + 1).padStart(2, '0');
  const yyyy = invoiceDate.getFullYear();
  const dateStr = `${dd}-${mm}-${yyyy}`;

  const items = invoice.items || [];
  const isInterState = invoice.is_inter_state;

  // ─── Build item rows ───
  let itemsHTML = '';
  items.forEach((item, idx) => {
    const qty = parseFloat(item.quantity) || 0;
    const rate = parseFloat(item.unit_price) || 0;
    const mrp = parseFloat(item.mrp) || 0;
    const discPct = parseFloat(item.discount_percent) || 0;
    const taxableAmt = parseFloat(item.taxable_amount) || 0;
    const gstRate = parseFloat(item.gst_rate) || 0;
    const halfRate = (gstRate / 2).toFixed(2);
    const cgst = parseFloat(item.cgst_amount) || 0;
    const sgst = parseFloat(item.sgst_amount) || 0;
    const igst = parseFloat(item.igst_amount) || 0;
    const total = parseFloat(item.total_amount) || 0;
    const unitName = item.unit_name || 'Box';

    // R/Q = Unit price inclusive of GST
    const unitPriceWithTax = qty > 0 ? (total / qty) : (rate * (1 + gstRate / 100));

    itemsHTML += `<tr>
      <td class="c">${idx + 1}</td>
      <td class="c">${esc(item.hsn_code || '')}</td>
      <td class="item-name">${esc(item.item_name || item.name)}</td>
      <td class="r">${fmtQty(qty)} ${esc(unitName)}</td>
      <td class="r">${mrp > 0 ? fmtAmt(mrp) : '0.00'}</td>
      <td class="r">${fmtAmt(rate)}</td>
      <td class="r">${discPct > 0 ? discPct.toFixed(2) + '%' : ''}</td>`;

    if (isInterState) {
      itemsHTML += `
      <td class="c">${gstRate}%</td>
      <td class="r">${fmtAmt(igst)}</td>`;
    } else {
      itemsHTML += `
      <td class="c">${halfRate} %</td>
      <td class="r">${fmtAmt(sgst)}</td>
      <td class="c">${halfRate} %</td>
      <td class="r">${fmtAmt(cgst)}</td>`;
    }

    itemsHTML += `
      <td class="r">${fmtAmt(unitPriceWithTax)}</td>
      <td class="r total-col">${fmtAmt(total)}</td>
    </tr>`;
  });

  // Pad empty rows for visual consistency
  const minRows = 12;
  const colCount = isInterState ? 11 : 13;
  for (let i = items.length; i < minRows; i++) {
    itemsHTML += `<tr class="empty-row">`;
    for (let j = 0; j < colCount; j++) {
      itemsHTML += `<td>&nbsp;</td>`;
    }
    itemsHTML += `</tr>`;
  }

  // ─── Total Row for Items Table ───
  const grandTotal = parseFloat(invoice.grand_total) || 0;
  const subtotal = parseFloat(invoice.subtotal) || 0;
  const taxTotal = parseFloat(invoice.tax_total) || 0;
  const cgstTotal = parseFloat(invoice.cgst_total) || 0;
  const sgstTotal = parseFloat(invoice.sgst_total) || 0;
  const igstTotal = parseFloat(invoice.igst_total) || 0;
  const roundOff = parseFloat(invoice.round_off) || 0;
  const amountWords = numberToWordsINR(grandTotal);

  const totalRQ = items.reduce((sum, item) => {
    const qty = parseFloat(item.quantity) || 0;
    const rate = parseFloat(item.unit_price) || 0;
    const gstRate = parseFloat(item.gst_rate) || 0;
    const total = parseFloat(item.total_amount) || 0;
    const itemRQ = qty > 0 ? (total / qty) : (rate * (1 + gstRate / 100));
    return sum + itemRQ;
  }, 0);

  itemsHTML += `<tr class="total-row" style="font-weight: bold; border-top: 2px solid #000; border-bottom: 2px double #000; background: #f9f9f9;">
    <td colspan="7" class="r" style="padding-right: 12px; font-weight: bold;">Total</td>`;

  if (isInterState) {
    itemsHTML += `
      <td class="c">&nbsp;</td>
      <td class="r">${fmtAmt(igstTotal)}</td>`;
  } else {
    itemsHTML += `
      <td class="c">&nbsp;</td>
      <td class="r">${fmtAmt(sgstTotal)}</td>
      <td class="c">&nbsp;</td>
      <td class="r">${fmtAmt(cgstTotal)}</td>`;
  }

  itemsHTML += `
    <td class="r">${fmtAmt(totalRQ)}</td>
    <td class="r total-col">${fmtAmt(grandTotal)}</td>
  </tr>`;

  // ─── GST Slab-wise Tax Summary (Sales 0%, 5%, 12%, 18%, 28%) ───
  const slabs = [0, 5, 12, 18, 28];
  const slabData = {};
  slabs.forEach(s => { slabData[s] = { taxable: 0, tax: 0 }; });

  for (const item of items) {
    const gstRate = parseFloat(item.gst_rate) || 0;
    const taxable = parseFloat(item.taxable_amount) || 0;
    const itemTax = (parseFloat(item.cgst_amount) || 0) + (parseFloat(item.sgst_amount) || 0) + (parseFloat(item.igst_amount) || 0);
    let matched = false;
    for (const s of slabs) {
      if (Math.abs(gstRate - s) < 0.5) { slabData[s].taxable += taxable; slabData[s].tax += itemTax; matched = true; break; }
    }
    if (!matched) {
      const nearest = slabs.reduce((p, c2) => Math.abs(c2 - gstRate) < Math.abs(p - gstRate) ? c2 : p);
      slabData[nearest].taxable += taxable;
      slabData[nearest].tax += itemTax;
    }
  }

  let slabRows = '';
  slabs.forEach(s => {
    slabRows += `<tr>
      <td class="slab-label">Sales ${s}%</td>
      <td class="r">${fmtAmt(slabData[s].taxable)}</td>
      <td class="slab-label">Tax ${s}%</td>
      <td class="r">${fmtAmt(slabData[s].tax)}</td>
    </tr>`;
  });

  slabRows += `<tr style="font-weight: bold; border-top: 1px solid #000; background: #f9f9f9;">
    <td class="slab-label">Total</td>
    <td class="r">${fmtAmt(subtotal)}</td>
    <td class="slab-label">Tax Total</td>
    <td class="r">${fmtAmt(taxTotal)}</td>
  </tr>`;

  // Buyer details
  const buyerName = invoice.client_name || '7. KNS MARKETING';
  const buyerAddr1 = invoice.client_address_line1 || invoice.client_address || 'No.10, LAKSHMI COMPLEX, PILLAIYAR KOVIL STREET';
  const buyerAddr2 = invoice.client_address_line2 || 'OZHUGARAI VILLAGE';
  const buyerCity = invoice.client_city || 'UTHIRAMERUR TALUK, KANCHEEPURAM DIST 631603';
  const buyerState = invoice.client_state || 'Tamil Nadu';
  const buyerPincode = invoice.client_pincode || '';
  const buyerGstin = invoice.client_gstin || '33EMQPS0903E1Z3';
  const buyerPhone = invoice.client_phone || invoice.client_mobile || '283643734343';

  const buyerAddrLines = [buyerAddr1, buyerAddr2].filter(Boolean);
  if (buyerCity) buyerAddrLines.push(buyerCity);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Tax Invoice - ${esc(invoice.invoice_number || '')}</title>
<style>
  @page { size: A4; margin: 8mm 10mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Arial Black', 'Arial', 'Helvetica', sans-serif;
    font-size: 13px;
    color: #000;
    line-height: 1.4;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .invoice-box {
    max-width: 790px;
    margin: 0 auto;
    border: 3px solid #000;
  }

  /* ── Grid Header ── */
  .grid-header {
    width: 100%;
    border-collapse: collapse;
    border-bottom: 3px solid #000;
  }
  .grid-header td {
    border: 2px solid #000;
    padding: 8px 12px;
    vertical-align: top;
  }
  .metadata-cell {
    width: 260px;
    font-size: 13px;
    font-weight: 700;
    line-height: 1.6;
  }
  .seller-cell {
    text-align: center;
    line-height: 1.45;
  }
  .tax-invoice-title {
    font-size: 15px;
    font-weight: 900;
    letter-spacing: 2px;
    margin-bottom: 6px;
    text-decoration: underline;
    text-transform: uppercase;
  }
  .seller-name {
    font-size: 24px;
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: 1px;
    margin-bottom: 3px;
  }
  .seller-address {
    font-size: 11.5px;
    font-weight: 700;
    text-transform: uppercase;
    color: #111;
  }
  .seller-contacts {
    font-size: 11.5px;
    font-weight: 600;
    margin-top: 3px;
    color: #111;
  }
  .buyer-cell {
    line-height: 1.5;
  }
  .buyer-title {
    font-size: 13px;
    font-weight: 700;
    margin-bottom: 3px;
  }
  .buyer-address {
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    color: #111;
  }
  .buyer-tax-details {
    font-size: 12px;
    margin-top: 4px;
    font-weight: 700;
    color: #000;
  }

  /* ── Items Table ── */
  .items-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
  }
  .items-table th {
    background: #222;
    color: #fff;
    font-weight: 800;
    padding: 7px 5px;
    border: 1.5px solid #000;
    text-align: center;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    line-height: 1.3;
  }
  .items-table td {
    padding: 5px 5px;
    border: 1.5px solid #000;
    vertical-align: middle;
    font-size: 12px;
  }
  .items-table tbody tr:nth-child(even) {
    background: #f5f5f5;
  }
  .items-table .empty-row td {
    height: 22px;
    border-top: none;
    border-bottom: none;
  }
  .r { text-align: right; }
  .c { text-align: center; }
  .item-name { font-weight: 800; font-size: 12.5px; }
  .total-col { font-weight: 800; background: #ececec; }

  /* ── Bottom Section ── */
  .bottom-section {
    display: flex;
    border-top: 3px solid #000;
  }
  .bottom-left {
    flex: 1;
    border-right: 3px solid #000;
    padding: 8px;
  }
  .bottom-right {
    flex: 1.2;
    padding: 14px 16px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    min-height: 120px;
  }

  /* Slab-wise tax summary */
  .slab-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 11.5px;
  }
  .slab-table td {
    padding: 4px 7px;
    border: 1.5px solid #000;
  }
  .slab-label {
    font-weight: 800;
  }

  /* Amount in words & Net Amount */
  .amount-words {
    font-size: 12.5px;
    font-weight: 700;
    line-height: 1.5;
    color: #000;
  }
  .net-amount-box {
    border: 3px solid #000;
    padding: 10px 14px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: #111;
    color: #fff;
    border-radius: 4px;
    margin-top: 12px;
  }
  .net-amount-label {
    font-size: 16px;
    font-weight: 900;
    letter-spacing: 2px;
  }
  .net-amount-value {
    font-size: 26px;
    font-weight: 900;
    letter-spacing: 1px;
  }

  /* Bank + Signatory */
  .footer-section {
    display: flex;
    border-top: 3px solid #000;
  }
  .bank-details {
    flex: 1;
    padding: 10px 14px;
    border-right: 3px solid #000;
    font-size: 12px;
  }
  .bank-details h4 { font-size: 13px; font-weight: 800; margin-bottom: 5px; }
  .bank-details p { margin: 2px 0; font-weight: 600; }
  .signatory {
    flex: 0.8;
    padding: 10px 14px;
    text-align: center;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    font-size: 12px;
    font-weight: 600;
  }
  .signatory .company-name { font-weight: 900; font-size: 13px; }
  .signatory .sig-line { margin-top: 48px; border-top: 2px solid #000; padding-top: 5px; font-weight: 700; }

  /* Terms */
  .terms {
    padding: 7px 14px;
    border-top: 3px solid #000;
    font-size: 10px;
    color: #111;
    font-weight: 600;
  }
  .terms h4 { font-size: 11px; font-weight: 800; color: #000; margin-bottom: 3px; }
  .terms ol { margin-left: 16px; }
  .terms li { margin-bottom: 2px; }
</style>
</head>
<body>
<div class="invoice-box">

  <!-- ═══ Suriya Maligai Grid Header ═══ -->
  <table class="grid-header">
    <tr>
      <td class="metadata-cell">
        <strong>Invoice No. &nbsp;: &nbsp;${esc(invoice.invoice_number || '938')}</strong>
      </td>
      <td class="seller-cell" rowspan="2">
        <div class="tax-invoice-title">${invoice.is_gst_bill === 0 ? 'BILL OF SUPPLY' : 'TAX INVOICE'}</div>
        <h1 class="seller-name">${esc(c.name)}</h1>
        <div class="seller-address">
          ${addressLines.map(line => esc(line)).join(', ')}
        </div>
        <div class="seller-contacts">
          ${c.phone ? 'Dial : ' + esc(c.phone) : ''}${c.phone && c.mobile ? ' &nbsp;&nbsp; ' : ''}${c.mobile ? 'Mobile : ' + esc(c.mobile) : ''}
        </div>
      </td>
    </tr>
    <tr>
      <td class="metadata-cell">
        <strong>GSTIN : ${esc(c.gstin)}</strong>
      </td>
    </tr>
    <tr>
      <td class="metadata-cell">
        <strong>Date &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;: &nbsp;${dateStr}</strong>
      </td>
      <td class="buyer-cell">
        <div class="buyer-title">To M/s. &nbsp;&nbsp;<strong>${esc(buyerName)}</strong></div>
        <div class="buyer-address">
          ${buyerAddrLines.join(', ')}
        </div>
        <div class="buyer-tax-details">
          ${buyerGstin ? `GSTIN : ${esc(buyerGstin)} &nbsp;&nbsp;&nbsp;` : ''}${buyerPhone ? `Phone : ${esc(buyerPhone)}` : ''}
        </div>
      </td>
    </tr>
  </table>

  <!-- ═══ Items Table ═══ -->
  <table class="items-table">
    <thead>
      <tr>
        <th style="width:24px;">Sl.</th>
        <th style="width:55px;">HSN</th>
        <th>PARTICULARS</th>
        <th style="width:75px;">Quantity</th>
        <th style="width:55px;">MRP</th>
        <th style="width:65px;">Rate</th>
        <th style="width:40px;">LESS</th>
        ${isInterState
          ? `<th style="width:42px;">IGST %</th><th style="width:60px;">IGST</th>`
          : `<th style="width:42px;">SGST %</th><th style="width:55px;">SGST</th>
             <th style="width:42px;">CGST %</th><th style="width:55px;">CGST</th>`
        }
        <th style="width:65px;">R/Q</th>
        <th style="width:75px;">Amount</th>
      </tr>
    </thead>
    <tbody>
      ${itemsHTML}
    </tbody>
  </table>

  <!-- ═══ Bottom: Slab Summary + Net Amount ═══ -->
  <div class="bottom-section">
    <div class="bottom-left">
      <table class="slab-table">
        ${slabRows}
      </table>
    </div>
    <div class="bottom-right">
      <div class="amount-words">
        <strong>(Rupees ${esc(amountWords)})</strong>
      </div>
      <div class="net-amount-box">
        <span class="net-amount-label">NET AMOUNT</span>
        <span class="net-amount-value">₹ ${fmtAmt(grandTotal)}</span>
      </div>
      ${invoice.client_id && invoice.old_balance !== undefined && invoice.old_balance !== null ? `
      <div style="margin-top:6px; border-top:1px solid #ccc; padding-top:6px;">
        <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:2px;">
          <span style="color:#555;">Previous Balance:</span>
          <span style="font-family:monospace;font-weight:600;">₹ ${fmtAmt(invoice.old_balance)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:12px;font-weight:700;color:#b91c1c;">
          <span>Net Outstanding:</span>
          <span style="font-family:monospace;">₹ ${fmtAmt(invoice.new_balance)}</span>
        </div>
      </div>` : ''}
    </div>
  </div>

  <!-- ═══ Bank Details & Signatory ═══ -->
  <div class="footer-section">
    <div class="bank-details">
      <h4>Bank Details</h4>
      ${c.bank_name ? `<p><strong>Bank:</strong> ${esc(c.bank_name)}</p>` : '<p>-</p>'}
      ${c.bank_account ? `<p><strong>A/C No:</strong> ${esc(c.bank_account)}</p>` : ''}
      ${c.bank_ifsc ? `<p><strong>IFSC:</strong> ${esc(c.bank_ifsc)}</p>` : ''}
      ${c.bank_branch ? `<p><strong>Branch:</strong> ${esc(c.bank_branch)}</p>` : ''}
    </div>
    <div class="signatory">
      <div class="company-name">For ${esc(c.name)}</div>
      <div class="sig-line">Authorised Signatory</div>
    </div>
  </div>

  <!-- ═══ Terms ═══ -->
  <div class="terms">
    <h4>Terms &amp; Conditions:</h4>
    <ol>
      <li>Goods once sold will not be taken back or exchanged.</li>
      <li>All disputes are subject to local jurisdiction only.</li>
      <li>E. &amp; O.E. (Errors &amp; Omissions Excepted).</li>
      <li>Interest @ 18% p.a. will be charged on overdue payments.</li>
      <li>Subject to realisation of cheque/draft.</li>
    </ol>
  </div>

</div>
</body>
</html>`;

  return html;
}

// ── Helper functions ──

function esc(str) {
  if (!str && str !== 0) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmtAmt(n) {
  const val = parseFloat(n);
  if (isNaN(val)) return '0.00';
  return val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtQty(n) {
  const val = parseFloat(n);
  if (isNaN(val)) return '0';
  return val % 1 === 0 ? val.toFixed(2) : val.toFixed(2);
}

/**
 * Convert a number to Indian English words for INR.
 * Handles Lakhs, Crores with proper Indian grouping.
 */
function numberToWordsINR(amount) {
  if (typeof amount !== 'number' || isNaN(amount)) return '';
  if (amount === 0) return 'Rupees Zero Only';

  const isNegative = amount < 0;
  amount = Math.abs(amount);

  const rupees = Math.floor(amount);
  const paise = Math.round((amount - rupees) * 100);

  let result = '';
  if (isNegative) result += 'Minus ';
  result += 'Rupees ';

  if (rupees > 0) {
    result += convertToIndianWords(rupees);
  } else {
    result += 'Zero';
  }

  if (paise > 0) {
    result += ' and ' + convertToIndianWords(paise) + ' Paise';
  }

  result += ' Only';
  return result;
}

function convertToIndianWords(num) {
  if (num === 0) return '';

  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen',
    'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  if (num < 20) return ones[num];
  if (num < 100) {
    return tens[Math.floor(num / 10)] + (num % 10 ? ' ' + ones[num % 10] : '');
  }
  if (num < 1000) {
    return ones[Math.floor(num / 100)] + ' Hundred' +
      (num % 100 ? ' and ' + convertToIndianWords(num % 100) : '');
  }
  if (num < 100000) {
    return convertToIndianWords(Math.floor(num / 1000)) + ' Thousand' +
      (num % 1000 ? ' and ' + convertToIndianWords(num % 1000) : '');
  }
  if (num < 10000000) {
    return convertToIndianWords(Math.floor(num / 100000)) + ' Lakh' +
      (num % 100000 ? ' ' + convertToIndianWords(num % 100000) : '');
  }
  return convertToIndianWords(Math.floor(num / 10000000)) + ' Crore' +
    (num % 10000000 ? ' ' + convertToIndianWords(num % 10000000) : '');
}

module.exports = { generateA4InvoiceHTML, numberToWordsINR };
