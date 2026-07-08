// electron/database/schema.js — SQLite schema initialization using sql.js
const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

let db = null;
let dbPath = '';
let SQLInstance = null;

/**
 * Initialize the SQLite database using sql.js (pure WASM).
 * @param {string} filePath - Path to the .sqlite file
 * @returns {Promise<object>} The sql.js Database instance
 */
async function initDatabase(filePath) {
  dbPath = filePath;
  const SQL = await initSqlJs();
  SQLInstance = SQL;

  if (fs.existsSync(filePath)) {
    const buffer = fs.readFileSync(filePath);
    db = new SQL.Database(buffer);
  } else {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    db = new SQL.Database();
  }

  // Enable WAL-like behavior and foreign keys
  db.run('PRAGMA journal_mode = WAL;');
  db.run('PRAGMA foreign_keys = ON;');

  createTables();
  createIndexes();
  saveDatabase();

  return db;
}

function createTables() {
  db.run(`
    CREATE TABLE IF NOT EXISTS company (
      id INTEGER PRIMARY KEY DEFAULT 1,
      name TEXT NOT NULL DEFAULT 'Arun Traders',
      address_line1 TEXT DEFAULT '',
      address_line2 TEXT DEFAULT '',
      address_line3 TEXT DEFAULT '',
      city TEXT DEFAULT '',
      state TEXT DEFAULT '',
      pincode TEXT DEFAULT '',
      phone TEXT DEFAULT '',
      mobile TEXT DEFAULT '',
      email TEXT DEFAULT '',
      gstin TEXT DEFAULT '',
      state_code TEXT DEFAULT '',
      bank_name TEXT DEFAULT '',
      bank_account TEXT DEFAULT '',
      bank_ifsc TEXT DEFAULT '',
      bank_branch TEXT DEFAULT '',
      logo_path TEXT DEFAULT '',
      financial_year_start TEXT DEFAULT '2025-04-01',
      financial_year_end TEXT DEFAULT '2026-03-31',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      description TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS units (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      short_name TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      category_id INTEGER REFERENCES categories(id),
      unit_id INTEGER REFERENCES units(id),
      bulk_unit_id INTEGER REFERENCES units(id),
      bulk_conversion REAL DEFAULT 1,
      purchase_price REAL DEFAULT 0,
      selling_price REAL DEFAULT 0,
      mrp REAL DEFAULT 0,
      gst_rate REAL DEFAULT 18,
      hsn_code TEXT DEFAULT '',
      opening_stock REAL DEFAULT 0,
      current_stock REAL DEFAULT 0,
      min_stock_level REAL DEFAULT 0,
      image_path TEXT DEFAULT '',
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE,
      name TEXT NOT NULL,
      store_name TEXT DEFAULT '',
      type TEXT NOT NULL DEFAULT 'customer' CHECK(type IN ('customer', 'supplier', 'both')),
      address_line1 TEXT DEFAULT '',
      address_line2 TEXT DEFAULT '',
      address_line3 TEXT DEFAULT '',
      city TEXT DEFAULT '',
      state TEXT DEFAULT '',
      pincode TEXT DEFAULT '',
      phone TEXT DEFAULT '',
      mobile TEXT DEFAULT '',
      email TEXT DEFAULT '',
      gstin TEXT DEFAULT '',
      state_code TEXT DEFAULT '',
      pan TEXT DEFAULT '',
      credit_limit REAL DEFAULT 0,
      credit_days INTEGER DEFAULT 30,
      area TEXT DEFAULT '',
      zone TEXT DEFAULT '',
      opening_balance REAL DEFAULT 0,
      current_balance REAL DEFAULT 0,
      is_blocked INTEGER DEFAULT 0,
      alert_message TEXT DEFAULT '',
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_number TEXT UNIQUE NOT NULL,
      invoice_date TEXT NOT NULL,
      client_id INTEGER REFERENCES clients(id),
      client_name TEXT DEFAULT '',
      client_gstin TEXT DEFAULT '',
      client_address_line1 TEXT DEFAULT '',
      client_address_line2 TEXT DEFAULT '',
      client_city TEXT DEFAULT '',
      client_state TEXT DEFAULT '',
      client_pincode TEXT DEFAULT '',
      client_phone TEXT DEFAULT '',
      client_mobile TEXT DEFAULT '',
      client_state_code TEXT DEFAULT '',
      payment_mode TEXT DEFAULT 'cash' CHECK(payment_mode IN ('cash', 'credit', 'upi', 'card', 'cheque')),
      subtotal REAL DEFAULT 0,
      discount_amount REAL DEFAULT 0,
      discount_percent REAL DEFAULT 0,
      cgst_total REAL DEFAULT 0,
      sgst_total REAL DEFAULT 0,
      igst_total REAL DEFAULT 0,
      tax_total REAL DEFAULT 0,
      round_off REAL DEFAULT 0,
      grand_total REAL DEFAULT 0,
      amount_paid REAL DEFAULT 0,
      balance_due REAL DEFAULT 0,
      old_balance REAL DEFAULT 0,
      new_balance REAL DEFAULT 0,
      notes TEXT DEFAULT '',
      is_gst_bill INTEGER DEFAULT 1,
      is_inter_state INTEGER DEFAULT 0,
      status TEXT DEFAULT 'completed' CHECK(status IN ('draft', 'completed', 'cancelled', 'returned')),
      created_by INTEGER,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS sale_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER REFERENCES sales(id) ON DELETE CASCADE,
      item_id INTEGER REFERENCES items(id),
      item_name TEXT DEFAULT '',
      hsn_code TEXT DEFAULT '',
      mrp REAL DEFAULT 0,
      unit_name TEXT DEFAULT '',
      quantity REAL NOT NULL DEFAULT 1,
      unit_price REAL NOT NULL DEFAULT 0,
      discount_percent REAL DEFAULT 0,
      discount_amount REAL DEFAULT 0,
      taxable_amount REAL DEFAULT 0,
      gst_rate REAL DEFAULT 0,
      cgst_amount REAL DEFAULT 0,
      sgst_amount REAL DEFAULT 0,
      igst_amount REAL DEFAULT 0,
      total_amount REAL DEFAULT 0,
      is_free INTEGER DEFAULT 0,
      selected_unit TEXT DEFAULT 'pcs',
      serial_numbers TEXT DEFAULT ''
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS purchases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bill_number TEXT DEFAULT '',
      bill_date TEXT DEFAULT '',
      dc_number TEXT DEFAULT '',
      dc_date TEXT DEFAULT '',
      our_ref_number TEXT UNIQUE NOT NULL,
      ref_date TEXT NOT NULL,
      client_id INTEGER REFERENCES clients(id),
      supplier_name TEXT DEFAULT '',
      supplier_gstin TEXT DEFAULT '',
      payment_mode TEXT DEFAULT 'credit',
      subtotal REAL DEFAULT 0,
      discount_amount REAL DEFAULT 0,
      cgst_total REAL DEFAULT 0,
      sgst_total REAL DEFAULT 0,
      igst_total REAL DEFAULT 0,
      tax_total REAL DEFAULT 0,
      round_off REAL DEFAULT 0,
      grand_total REAL DEFAULT 0,
      amount_paid REAL DEFAULT 0,
      balance_due REAL DEFAULT 0,
      notes TEXT DEFAULT '',
      is_inter_state INTEGER DEFAULT 0,
      status TEXT DEFAULT 'completed',
      created_by INTEGER,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS purchase_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      purchase_id INTEGER REFERENCES purchases(id) ON DELETE CASCADE,
      item_id INTEGER REFERENCES items(id),
      item_name TEXT DEFAULT '',
      hsn_code TEXT DEFAULT '',
      quantity REAL NOT NULL DEFAULT 1,
      unit_name TEXT DEFAULT 'Pcs',
      unit_price REAL NOT NULL DEFAULT 0,
      discount_percent REAL DEFAULT 0,
      discount_amount REAL DEFAULT 0,
      taxable_amount REAL DEFAULT 0,
      gst_rate REAL DEFAULT 0,
      cgst_amount REAL DEFAULT 0,
      sgst_amount REAL DEFAULT 0,
      igst_amount REAL DEFAULT 0,
      total_amount REAL DEFAULT 0,
      selected_unit TEXT DEFAULT 'pcs',
      serial_numbers TEXT DEFAULT ''
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('asset', 'liability', 'income', 'expense', 'equity')),
      parent_id INTEGER REFERENCES accounts(id),
      is_system INTEGER DEFAULT 0,
      opening_balance REAL DEFAULT 0,
      current_balance REAL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS vouchers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      voucher_number TEXT NOT NULL,
      voucher_date TEXT NOT NULL,
      voucher_type TEXT NOT NULL CHECK(voucher_type IN (
        'cash_receipt', 'cash_payment', 'bank_receipt', 'bank_payment',
        'contra', 'journal', 'sales', 'purchase', 'sales_return', 'purchase_return'
      )),
      debit_account_id INTEGER REFERENCES accounts(id),
      credit_account_id INTEGER REFERENCES accounts(id),
      amount REAL NOT NULL,
      narration TEXT DEFAULT '',
      cheque_number TEXT DEFAULT '',
      cheque_date TEXT DEFAULT '',
      is_cleared INTEGER DEFAULT 0,
      clearance_date TEXT DEFAULT '',
      bank_name TEXT DEFAULT '',
      reference_type TEXT DEFAULT '',
      reference_id INTEGER DEFAULT 0,
      is_authorized INTEGER DEFAULT 1,
      authorized_by INTEGER,
      created_by INTEGER,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS stock_movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id INTEGER REFERENCES items(id),
      movement_type TEXT NOT NULL CHECK(movement_type IN (
        'purchase', 'sale', 'sales_return', 'purchase_return',
        'adjustment', 'opening', 'transfer'
      )),
      quantity REAL NOT NULL,
      reference_type TEXT DEFAULT '',
      reference_id INTEGER DEFAULT 0,
      balance_after REAL DEFAULT 0,
      notes TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // Auto-migrate users table check constraint & columns
  const tableInfo = db.exec("PRAGMA table_info(users)");
  if (tableInfo.length > 0) {
    const columns = tableInfo[0].values.map(v => v[1]);
    
    // First migrate columns if email is missing (old schema layout)
    if (!columns.includes('email')) {
      db.run('ALTER TABLE users RENAME TO old_users;');
      db.run(`
        CREATE TABLE users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          name TEXT NOT NULL,
          role TEXT DEFAULT 'client' CHECK(role IN ('admin', 'client')),
          email TEXT UNIQUE,
          store_name TEXT,
          gst_number TEXT,
          store_address TEXT,
          approved INTEGER DEFAULT 1,
          created_by INTEGER,
          is_active INTEGER DEFAULT 1,
          last_login TEXT DEFAULT '',
          created_at TEXT DEFAULT (datetime('now'))
        );
      `);
      db.run(`
        INSERT INTO users (id, username, password_hash, name, role, is_active, last_login, created_at, approved)
        SELECT id, username, password_hash, name, 
          CASE WHEN role IN ('store_owner', 'viewer', 'operator', 'manager') THEN 'client' ELSE role END, 
          is_active, last_login, created_at, 1 FROM old_users;
      `);
      db.run('DROP TABLE old_users;');
    } else {
      // Check if schema definition constraint contains old role names
      const schemaResult = db.exec("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'");
      const schemaSql = schemaResult[0]?.values[0][0] || '';
      if (schemaSql && !schemaSql.includes("'client'")) {
        db.run("PRAGMA foreign_keys = OFF;");
        db.run("ALTER TABLE users RENAME TO old_users;");
        db.run(`
          CREATE TABLE users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            name TEXT NOT NULL,
            role TEXT DEFAULT 'client' CHECK(role IN ('admin', 'client')),
            email TEXT UNIQUE,
            store_name TEXT,
            gst_number TEXT,
            store_address TEXT,
            approved INTEGER DEFAULT 1,
            created_by INTEGER,
            is_active INTEGER DEFAULT 1,
            last_login TEXT DEFAULT '',
            created_at TEXT DEFAULT (datetime('now'))
          );
        `);
        db.run(`
          INSERT INTO users (id, username, password_hash, name, role, email, store_name, gst_number, store_address, approved, created_by, is_active, last_login, created_at)
          SELECT id, username, password_hash, name, 
            CASE WHEN role IN ('store_owner', 'viewer', 'operator', 'manager') THEN 'client' ELSE role END, 
            email, store_name, gst_number, store_address, approved, created_by, is_active, last_login, created_at 
          FROM old_users;
        `);
        db.run("DROP TABLE old_users;");
        db.run("PRAGMA foreign_keys = ON;");
      }
    }
  } else {
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        name TEXT NOT NULL,
        role TEXT DEFAULT 'client' CHECK(role IN ('admin', 'client')),
        email TEXT UNIQUE,
        store_name TEXT,
        gst_number TEXT,
        store_address TEXT,
        approved INTEGER DEFAULT 0,
        created_by INTEGER,
        is_active INTEGER DEFAULT 1,
        last_login TEXT DEFAULT '',
        created_at TEXT DEFAULT (datetime('now'))
      );
    `);
  }

  // Auto-migrate items table to add zone column
  const itemsInfo = db.exec("PRAGMA table_info(items)");
  if (itemsInfo.length > 0) {
    const columns = itemsInfo[0].values.map(v => v[1]);
    if (!columns.includes('zone')) {
      db.run("ALTER TABLE items ADD COLUMN zone TEXT DEFAULT 'A';");
    }
  }

  // Auto-migrate sales table to add updated_at, old_balance, new_balance columns
  const salesInfo = db.exec("PRAGMA table_info(sales)");
  if (salesInfo.length > 0) {
    const salesCols = salesInfo[0].values.map(v => v[1]);
    if (!salesCols.includes('updated_at')) {
      db.run("ALTER TABLE sales ADD COLUMN updated_at TEXT;");
    }
    if (!salesCols.includes('old_balance')) {
      db.run("ALTER TABLE sales ADD COLUMN old_balance REAL DEFAULT 0;");
    }
    if (!salesCols.includes('new_balance')) {
      db.run("ALTER TABLE sales ADD COLUMN new_balance REAL DEFAULT 0;");
    }
  }

  // Auto-migrate company table to add new preference columns
  const companyInfo = db.exec("PRAGMA table_info(company)");
  if (companyInfo.length > 0) {
    const companyCols = companyInfo[0].values.map(v => v[1]);
    if (!companyCols.includes('invoice_prefix')) {
      db.run("ALTER TABLE company ADD COLUMN invoice_prefix TEXT DEFAULT '';");
    }
    if (!companyCols.includes('default_gst_rate')) {
      db.run("ALTER TABLE company ADD COLUMN default_gst_rate TEXT DEFAULT '18';");
    }
  }

  // Auto-migrate purchase_items table to add unit_name column
  const purchaseItemsInfo = db.exec("PRAGMA table_info(purchase_items)");
  if (purchaseItemsInfo.length > 0) {
    const purchaseItemsCols = purchaseItemsInfo[0].values.map(v => v[1]);
    if (!purchaseItemsCols.includes('unit_name')) {
      db.run("ALTER TABLE purchase_items ADD COLUMN unit_name TEXT DEFAULT 'Pcs';");
    }
    if (!purchaseItemsCols.includes('selected_unit')) {
      db.run("ALTER TABLE purchase_items ADD COLUMN selected_unit TEXT DEFAULT 'pcs';");
    }
  }

  // Auto-migrate sale_items table to add selected_unit column
  const saleItemsInfo = db.exec("PRAGMA table_info(sale_items)");
  if (saleItemsInfo.length > 0) {
    const saleItemsCols = saleItemsInfo[0].values.map(v => v[1]);
    if (!saleItemsCols.includes('selected_unit')) {
      db.run("ALTER TABLE sale_items ADD COLUMN selected_unit TEXT DEFAULT 'pcs';");
    }
  }
  
  // Auto-migrate clients table to add store_name and zone columns
  const clientsInfo = db.exec("PRAGMA table_info(clients)");
  if (clientsInfo.length > 0) {
    const clientsCols = clientsInfo[0].values.map(v => v[1]);
    if (!clientsCols.includes('store_name')) {
      db.run("ALTER TABLE clients ADD COLUMN store_name TEXT DEFAULT '';");
    }
    if (!clientsCols.includes('zone')) {
      db.run("ALTER TABLE clients ADD COLUMN zone TEXT DEFAULT '';");
    }
  }


  // WMS Compatibility View — drop and recreate to keep definition current
  try { db.run("DROP VIEW IF EXISTS products;"); } catch(e) {}
  db.run(`
    CREATE VIEW IF NOT EXISTS products AS 
    SELECT 
      i.id, i.code, i.name, i.description, i.category_id,
      i.selling_price AS current_price,
      i.purchase_price,
      i.mrp,
      i.gst_rate,
      i.hsn_code,
      i.current_stock AS stock_quantity,
      i.min_stock_level,
      i.image_path AS image_url,
      i.zone,
      i.is_active,
      i.bulk_conversion,
      u.short_name AS unit_name,
      bu.short_name AS bulk_unit_name,
      i.created_at,
      i.updated_at 
    FROM items i
    LEFT JOIN units u ON i.unit_id = u.id
    LEFT JOIN units bu ON i.bulk_unit_id = bu.id
    WHERE i.is_active = 1;
  `);

  // WMS Specific Tables
  db.run(`
    CREATE TABLE IF NOT EXISTS daily_selections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      store_owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      selection_date TEXT NOT NULL,
      status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'packed', 'shipped', 'delivered')),
      submitted_at TEXT,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS selection_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      selection_id INTEGER REFERENCES daily_selections(id) ON DELETE CASCADE,
      product_id INTEGER REFERENCES items(id) ON DELETE CASCADE,
      requested_quantity INTEGER NOT NULL,
      unit_price_at_selection REAL
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS recurring_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      store_owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS template_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      template_id INTEGER REFERENCES recurring_templates(id) ON DELETE CASCADE,
      product_id INTEGER REFERENCES items(id) ON DELETE CASCADE,
      quantity INTEGER DEFAULT 1
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS product_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      store_owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      product_name TEXT NOT NULL,
      proposed_description TEXT,
      status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
      admin_notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS discrepancies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      selection_id INTEGER REFERENCES daily_selections(id) ON DELETE CASCADE,
      product_id INTEGER REFERENCES items(id) ON DELETE CASCADE,
      quantity INTEGER,
      issue_type TEXT CHECK (issue_type IN ('damaged', 'missing', 'wrong_item')),
      notes TEXT,
      status TEXT DEFAULT 'reported' CHECK (status IN ('reported', 'resolved', 'rejected')),
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      title TEXT,
      message TEXT,
      read INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS announcements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS price_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER REFERENCES items(id) ON DELETE CASCADE,
      old_price REAL,
      new_price REAL,
      changed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      changed_at TEXT DEFAULT (datetime('now'))
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id),
      action TEXT NOT NULL,
      module TEXT DEFAULT '',
      details TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS collections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER REFERENCES clients(id),
      invoice_id INTEGER REFERENCES sales(id),
      payment_date TEXT NOT NULL,
      amount REAL NOT NULL,
      payment_mode TEXT NOT NULL,
      reference_number TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // Auto-migrate collections table to add invoice_id column
  const collectionsInfo = db.exec("PRAGMA table_info(collections)");
  if (collectionsInfo.length > 0) {
    const collectionsCols = collectionsInfo[0].values.map(v => v[1]);
    if (!collectionsCols.includes('invoice_id')) {
      db.run("ALTER TABLE collections ADD COLUMN invoice_id INTEGER REFERENCES sales(id);");
    }
  }
}

function createIndexes() {
  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_items_code ON items(code)',
    'CREATE INDEX IF NOT EXISTS idx_items_name ON items(name)',
    'CREATE INDEX IF NOT EXISTS idx_items_category ON items(category_id)',
    'CREATE INDEX IF NOT EXISTS idx_clients_name ON clients(name)',
    'CREATE INDEX IF NOT EXISTS idx_clients_code ON clients(code)',
    'CREATE INDEX IF NOT EXISTS idx_clients_type ON clients(type)',
    'CREATE INDEX IF NOT EXISTS idx_sales_invoice ON sales(invoice_number)',
    'CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(invoice_date)',
    'CREATE INDEX IF NOT EXISTS idx_sales_client ON sales(client_id)',
    'CREATE INDEX IF NOT EXISTS idx_purchases_ref ON purchases(our_ref_number)',
    'CREATE INDEX IF NOT EXISTS idx_vouchers_date ON vouchers(voucher_date)',
    'CREATE INDEX IF NOT EXISTS idx_stock_movements_item ON stock_movements(item_id)',
  ];
  indexes.forEach(sql => db.run(sql));
}

/** Persist database to disk */
function saveDatabase() {
  if (db && dbPath) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
  }
}

/** Get the active db instance */
function getDb() { return db; }

/** Get the db path */
function getDbPath() { return dbPath; }

/** Restore database from buffer */
function restoreDatabase(buffer) {
  if (!SQLInstance) throw new Error('SQLite library has not been initialized');
  const tempDb = new SQLInstance.Database(buffer);
  
  // Test query to make sure schema is valid
  tempDb.exec("SELECT name FROM sqlite_master WHERE type='table'");
  
  // Write file to disk
  fs.writeFileSync(dbPath, buffer);
  db = tempDb;
  return db;
}

module.exports = { initDatabase, saveDatabase, getDb, getDbPath, restoreDatabase };
