// electron/database/seed.js — Default seed data
const bcrypt = require('bcryptjs');

function seedDatabase(db, saveFn) {
  // Always verify company details update
  db.run(`INSERT OR IGNORE INTO company (id, name, address_line1, address_line2, address_line3, city, state, pincode, phone, mobile, gstin, state_code, financial_year_start, financial_year_end)
    VALUES (1, 'SURIYA MALIGAI', 'NO-27, NORTH REDDY STREET,,', 'UTHIRAMERUR-603406.', 'KPM DISTRICT', 'Uthiramerur', 'Tamil Nadu', '603406', '6379355917', '9600838819', '33AOEPT0355D2Z9', '33', '2026-04-01', '2027-03-31')`);

  db.run(`UPDATE company SET 
    name = 'SURIYA MALIGAI',
    address_line1 = 'NO-27, NORTH REDDY STREET,,',
    address_line2 = 'UTHIRAMERUR-603406.',
    address_line3 = 'KPM DISTRICT',
    city = 'Uthiramerur',
    state = 'Tamil Nadu',
    pincode = '603406',
    phone = '6379355917',
    mobile = '9600838819',
    gstin = '33AOEPT0355D2Z9',
    state_code = '33'
    WHERE id = 1 AND name = 'Arun Traders'`);

  // Seed sample client if empty
  const clientCount = db.exec('SELECT COUNT(*) as c FROM clients')[0]?.values[0][0] || 0;
  if (clientCount === 0) {
    db.run(`INSERT INTO clients (code, name, type, address_line1, address_line2, city, state, pincode, phone, mobile, gstin, state_code, current_balance)
      VALUES ('CUS001', '7. KNS MARKETING', 'customer', 'No.10, LAKSHMI COMPLEX, PILLAIYAR KOVIL STREET', 'OZHUGARAI VILLAGE', 'UTHIRAMERUR TALUK, KANCHEEPURAM DIST 631603', 'Tamil Nadu', '', '283643734343', '', '33EMQPS0903E1Z3', '33', 0.00)`);
  }

  // Seed sample item if empty
  const itemCount = db.exec('SELECT COUNT(*) as c FROM items')[0]?.values[0][0] || 0;
  if (itemCount === 0) {
    db.run(`INSERT INTO items (code, name, description, category_id, unit_id, bulk_unit_id, bulk_conversion, purchase_price, selling_price, mrp, gst_rate, hsn_code, current_stock, opening_stock, min_stock_level)
      VALUES ('ITM001', 'SUNLAND 1L PACK', 'Sunland edible oil 1L pack', 3, 1, 6, 10.00, 130.00, 162.8571, 180.00, 5.00, '1514', 1000, 1000, 5)`);
  }

  // Seed sample invoice if empty
  const saleCount = db.exec('SELECT COUNT(*) as c FROM sales')[0]?.values[0][0] || 0;
  if (saleCount === 0) {
    db.run(`INSERT INTO sales (invoice_number, invoice_date, client_id, client_name, client_gstin, client_address_line1, client_address_line2, client_city, client_state, client_pincode, client_phone, client_mobile, client_state_code, payment_mode, subtotal, discount_amount, discount_percent, cgst_total, sgst_total, igst_total, tax_total, round_off, grand_total, amount_paid, balance_due, notes, is_gst_bill, is_inter_state, status, created_by)
      VALUES ('938', '2026-06-26', 1, '7. KNS MARKETING', '33EMQPS0903E1Z3', 'No.10, LAKSHMI COMPLEX, PILLAIYAR KOVIL STREET', 'OZHUGARAI VILLAGE', 'UTHIRAMERUR TALUK, KANCHEEPURAM DIST 631603', 'Tamil Nadu', '', '283643734343', '', '33', 'cash', 16285.70, 0.00, 0, 407.15, 407.15, 0.00, 814.30, 0.00, 17100, 17100, 0, 'Sample invoice matching photo', 1, 0, 'completed', 1)`);
    
    db.run(`INSERT INTO sale_items (sale_id, item_id, item_name, hsn_code, mrp, unit_name, quantity, unit_price, discount_percent, discount_amount, taxable_amount, gst_rate, cgst_amount, sgst_amount, igst_amount, total_amount, is_free)
      VALUES (1, 1, 'SUNLAND 1L PACK', '1514', 1800.00, 'Box', 10.00, 1628.57, 0.00, 0.00, 16285.70, 5.00, 407.15, 407.15, 0.00, 17100.00, 0)`);
  }

  // Only seed if tables are empty
  const userCount = db.exec('SELECT COUNT(*) as c FROM users')[0]?.values[0][0] || 0;
  if (userCount > 0) {
    if (saveFn) saveFn();
    return;
  }

  console.log('[Seed] Inserting default data...');

  // Default units
  const units = [
    ['Pieces', 'Pcs'], ['Kilograms', 'Kg'], ['Grams', 'Gm'], ['Litres', 'Ltr'], ['Millilitres', 'Ml'],
    ['Box', 'Box'], ['Dozen', 'Dzn'], ['Pack', 'Pck'], ['Meters', 'Mtr'], ['Set', 'Set'],
    ['Numbers', 'Nos'], ['Bags', 'Bag'], ['Rolls', 'Roll'], ['Pairs', 'Pr'],
  ];
  const insertUnit = db.prepare('INSERT OR IGNORE INTO units (name, short_name) VALUES (?, ?)');
  units.forEach(([name, short]) => { insertUnit.bind([name, short]); insertUnit.step(); insertUnit.reset(); });
  insertUnit.free();

  // Default categories
  const categories = [
    ['General', 'General items'], ['Electronics', 'Electronic goods'], ['FMCG', 'Fast moving consumer goods'],
    ['Stationery', 'Office & stationery supplies'], ['Hardware', 'Hardware & tools'],
    ['Groceries', 'Grocery items'], ['Textiles', 'Textile & fabric products'],
  ];
  const insertCat = db.prepare('INSERT OR IGNORE INTO categories (name, description) VALUES (?, ?)');
  categories.forEach(([name, desc]) => { insertCat.bind([name, desc]); insertCat.step(); insertCat.reset(); });
  insertCat.free();

  // Admin user (password: admin123)
  const hash = bcrypt.hashSync('admin123', 10);
  db.run(`INSERT OR IGNORE INTO users (username, password_hash, name, role, approved, is_active) VALUES ('admin', '${hash}', 'Administrator', 'admin', 1, 1)`);

  // Default chart of accounts
  const accounts = [
    ['ACC001', 'Cash Account', 'asset', 1],
    ['ACC002', 'Bank Account', 'asset', 1],
    ['ACC003', 'Accounts Receivable', 'asset', 1],
    ['ACC004', 'Inventory', 'asset', 1],
    ['ACC005', 'Accounts Payable', 'liability', 1],
    ['ACC006', 'CGST Payable', 'liability', 1],
    ['ACC007', 'SGST Payable', 'liability', 1],
    ['ACC008', 'IGST Payable', 'liability', 1],
    ['ACC009', 'Sales Revenue', 'income', 1],
    ['ACC010', 'Other Income', 'income', 0],
    ['ACC011', 'Purchase Expense', 'expense', 1],
    ['ACC012', 'Operating Expense', 'expense', 0],
    ['ACC013', 'Salary Expense', 'expense', 0],
    ['ACC014', 'Capital Account', 'equity', 0],
    ['ACC015', 'Retained Earnings', 'equity', 0],
  ];
  const insertAcc = db.prepare('INSERT OR IGNORE INTO accounts (code, name, type, is_system) VALUES (?, ?, ?, ?)');
  accounts.forEach(([code, name, type, sys]) => { insertAcc.bind([code, name, type, sys]); insertAcc.step(); insertAcc.reset(); });
  insertAcc.free();

  if (saveFn) saveFn();
  console.log('[Seed] Default data inserted successfully.');
}

module.exports = { seedDatabase };
