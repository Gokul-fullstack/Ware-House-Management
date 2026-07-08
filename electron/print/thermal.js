// electron/print/thermal.js — 80mm thermal receipt generator
'use strict';

/**
 * Generates HTML for an 80mm thermal receipt printer.
 * @param {object} invoice - The sale/invoice object with items
 * @param {object} company - The company profile object
 * @returns {string} Complete HTML string ready for printing
 */
function generateThermalHTML(invoice, company) {
  const companyName = company.name || 'Arun Traders';
  const companyAddr = [company.address, company.city, company.state, company.pincode]
    .filter(Boolean)
    .join(', ');
  const companyPhone = company.phone || '';
  const companyGSTIN = company.gstin || '';

  const invoiceDate = new Date(invoice.invoice_date || invoice.created_at);
  const dateStr = invoiceDate.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const timeStr = invoiceDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

  const items = invoice.items || [];

  let itemsHTML = '';
  for (const item of items) {
    const name = truncate(item.item_name || item.name, 20);
    const qty = formatNum(item.quantity);
    const rate = formatCurrency(item.unit_price);
    const amt = formatCurrency(item.total_amount);
    itemsHTML += `
      <tr>
        <td colspan="4" style="padding:1px 0 0 0;font-size:11px;">${escapeHTML(name)}</td>
      </tr>
      <tr>
        <td style="padding:0 0 1px 0;font-size:11px;">&nbsp;</td>
        <td style="padding:0 0 1px 0;font-size:11px;text-align:center;">${qty}</td>
        <td style="padding:0 0 1px 0;font-size:11px;text-align:right;">${rate}</td>
        <td style="padding:0 0 1px 0;font-size:11px;text-align:right;">${amt}</td>
      </tr>`;
  }

  const totalItems = items.reduce((s, i) => s + (parseFloat(i.quantity) || 0), 0);

  let taxBreakdown = '';
  if (invoice.is_inter_state) {
    if (parseFloat(invoice.igst_total) > 0) {
      taxBreakdown += taxRow('IGST', invoice.igst_total);
    }
  } else {
    if (parseFloat(invoice.cgst_total) > 0) {
      taxBreakdown += taxRow('CGST', invoice.cgst_total);
    }
    if (parseFloat(invoice.sgst_total) > 0) {
      taxBreakdown += taxRow('SGST', invoice.sgst_total);
    }
  }

  const grandTotal = parseFloat(invoice.grand_total) || 0;
  const amountWords = numberToWordsINR(grandTotal);

  const clientName = invoice.client_name || '';

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Receipt - ${escapeHTML(invoice.invoice_number || '')}</title>
<style>
  @page { margin: 0; size: 80mm auto; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Courier New', Courier, monospace;
    font-size: 12px;
    width: 302px;
    margin: 0 auto;
    padding: 4px 8px;
    color: #000;
  }
  .center { text-align: center; }
  .bold { font-weight: bold; }
  .dashed {
    border-top: 1px dashed #000;
    margin: 4px 0;
  }
  table { width: 100%; border-collapse: collapse; }
  .total-row td {
    padding: 2px 0;
    font-size: 12px;
  }
  .grand-total td {
    font-weight: bold;
    font-size: 14px;
    padding: 4px 0;
  }
  .right { text-align: right; }
  .left { text-align: left; }
  .small { font-size: 10px; }
</style>
</head>
<body>

  <!-- Company Header -->
  <div class="center bold" style="font-size:16px;margin-bottom:2px;">${escapeHTML(companyName)}</div>
  ${companyAddr ? `<div class="center small">${escapeHTML(companyAddr)}</div>` : ''}
  ${companyPhone ? `<div class="center small">Ph: ${escapeHTML(companyPhone)}</div>` : ''}
  ${companyGSTIN ? `<div class="center small">GSTIN: ${escapeHTML(companyGSTIN)}</div>` : ''}

  <div class="dashed"></div>

  <!-- Invoice Details -->
  <table>
    <tr>
      <td class="left small">Inv: ${escapeHTML(invoice.invoice_number || '')}</td>
      <td class="right small">${dateStr}</td>
    </tr>
    <tr>
      <td class="left small">${invoice.payment_mode ? invoice.payment_mode.toUpperCase() : 'CASH'}</td>
      <td class="right small">${timeStr}</td>
    </tr>
  </table>

  ${clientName ? `<div class="small" style="margin-top:2px;">Customer: ${escapeHTML(clientName)}</div>` : ''}

  <div class="dashed"></div>

  <!-- Items Header -->
  <table>
    <tr style="font-weight:bold;font-size:11px;">
      <td class="left">Item</td>
      <td style="text-align:center;">Qty</td>
      <td class="right">Rate</td>
      <td class="right">Amt</td>
    </tr>
  </table>
  <div class="dashed" style="margin:2px 0;"></div>

  <!-- Items -->
  <table>${itemsHTML}</table>

  <div class="dashed"></div>

  <!-- Totals -->
  <table>
    <tr class="total-row">
      <td class="left">Items: ${totalItems}</td>
      <td class="right">Subtotal:</td>
      <td class="right" style="width:80px;">₹${formatCurrency(invoice.subtotal)}</td>
    </tr>
    ${parseFloat(invoice.discount_amount) > 0 ? `
    <tr class="total-row">
      <td class="left"></td>
      <td class="right">Discount:</td>
      <td class="right">-₹${formatCurrency(invoice.discount_amount)}</td>
    </tr>` : ''}
    ${taxBreakdown}
    ${parseFloat(invoice.round_off) !== 0 ? `
    <tr class="total-row">
      <td class="left"></td>
      <td class="right">Round Off:</td>
      <td class="right">₹${formatCurrency(invoice.round_off)}</td>
    </tr>` : ''}
  </table>

  <div class="dashed"></div>

  <table>
    <tr class="grand-total">
      <td class="left">TOTAL</td>
      <td class="right">₹${formatCurrency(invoice.grand_total)}</td>
    </tr>
  </table>

  ${amountWords ? `<div class="small" style="margin-top:2px;">${escapeHTML(amountWords)}</div>` : ''}

  ${parseFloat(invoice.amount_paid) > 0 && parseFloat(invoice.balance_due) > 0 ? `
  <div class="dashed"></div>
  <table>
    <tr class="total-row">
      <td class="left">Paid:</td>
      <td class="right">₹${formatCurrency(invoice.amount_paid)}</td>
    </tr>
    <tr class="total-row">
      <td class="left bold">Balance Due:</td>
      <td class="right bold">₹${formatCurrency(invoice.balance_due)}</td>
    </tr>
  </table>` : ''}

  ${invoice.client_id && invoice.old_balance !== undefined && invoice.old_balance !== null ? `
  <div class="dashed"></div>
  <table>
    <tr class="total-row">
      <td class="left">Prev. Balance:</td>
      <td class="right">₹${formatCurrency(invoice.old_balance)}</td>
    </tr>
    <tr class="total-row">
      <td class="left bold">Net Outstanding:</td>
      <td class="right bold">₹${formatCurrency(invoice.new_balance)}</td>
    </tr>
  </table>` : ''}

  <div class="dashed"></div>

  <div class="center small" style="margin-top:4px;">Thank you for your business!</div>
  <div class="center small">Visit Again</div>
  <div class="center small" style="margin-top:4px;margin-bottom:8px;">--- End of Receipt ---</div>

</body>
</html>`;

  return html;
}

// ── Helpers ──

function escapeHTML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function truncate(str, len) {
  if (!str) return '';
  return str.length > len ? str.substring(0, len - 1) + '…' : str;
}

function formatNum(n) {
  const val = parseFloat(n);
  if (isNaN(val)) return '0';
  return val % 1 === 0 ? val.toString() : val.toFixed(2);
}

function formatCurrency(n) {
  const val = parseFloat(n);
  if (isNaN(val)) return '0.00';
  return val.toFixed(2);
}

function taxRow(label, amount) {
  return `
    <tr class="total-row">
      <td class="left"></td>
      <td class="right">${label}:</td>
      <td class="right">₹${formatCurrency(amount)}</td>
    </tr>`;
}

/**
 * Convert a number to Indian English words for INR.
 * E.g., 1234.50 → "Rupees One Thousand Two Hundred Thirty Four and Fifty Paise Only"
 */
function numberToWordsINR(amount) {
  if (typeof amount !== 'number' || isNaN(amount)) return '';
  if (amount === 0) return 'Rupees Zero Only';

  const isNegative = amount < 0;
  amount = Math.abs(amount);

  const rupees = Math.floor(amount);
  const paise = Math.round((amount - rupees) * 100);

  let result = 'Rupees ';
  if (isNegative) result = 'Minus ' + result;

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
  if (num < 100) return tens[Math.floor(num / 10)] + (num % 10 ? ' ' + ones[num % 10] : '');

  if (num < 1000) {
    return ones[Math.floor(num / 100)] + ' Hundred' +
      (num % 100 ? ' ' + convertToIndianWords(num % 100) : '');
  }

  if (num < 100000) {
    return convertToIndianWords(Math.floor(num / 1000)) + ' Thousand' +
      (num % 1000 ? ' ' + convertToIndianWords(num % 1000) : '');
  }

  if (num < 10000000) {
    return convertToIndianWords(Math.floor(num / 100000)) + ' Lakh' +
      (num % 100000 ? ' ' + convertToIndianWords(num % 100000) : '');
  }

  return convertToIndianWords(Math.floor(num / 10000000)) + ' Crore' +
    (num % 10000000 ? ' ' + convertToIndianWords(num % 10000000) : '');
}

module.exports = { generateThermalHTML, numberToWordsINR };
