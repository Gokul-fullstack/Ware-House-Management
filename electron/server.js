// electron/server.js — Express API server for multi-terminal access
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const { generateA4InvoiceHTML } = require('./print/a4-invoice');
const { generateThermalHTML } = require('./print/thermal');

let db = null;
let saveFn = null;
let dbPathStr = '';
let restoreFn = null;
const sessions = new Map(); // token -> { userId, username, name, role }

function createServer(database, save, filePath, restore) {
  db = database;
  saveFn = save;
  dbPathStr = filePath;
  restoreFn = restore;
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '10mb' }));

  // ─── Helper functions ───
  function query(sql, params = []) {
    const stmt = db.prepare(sql);
    if (params.length) stmt.bind(params);
    const results = [];
    while (stmt.step()) results.push(stmt.getAsObject());
    stmt.free();
    return results;
  }

  function queryOne(sql, params = []) {
    const rows = query(sql, params);
    return rows[0] || null;
  }

  let lastInsertId = 0;

  function run(sql, params = []) {
    if (params.length) {
      const stmt = db.prepare(sql);
      stmt.bind(params);
      stmt.step();
      stmt.free();
    } else {
      db.run(sql);
    }
    try {
      const res = db.exec('SELECT last_insert_rowid() as id');
      lastInsertId = res[0]?.values[0][0] || 0;
    } catch (e) {
      console.error('[Database] Failed to capture last insert ID:', e);
    }
    if (saveFn) saveFn();
  }

  function getLastId() {
    return lastInsertId;
  }

  // Auth middleware
  function auth(req, res, next) {
    let token = req.headers['x-session-token'];
    if (!token && req.headers['authorization']) {
      const parts = req.headers['authorization'].split(' ');
      if (parts[0] === 'Bearer') token = parts[1];
    }
    if (!token && req.query) {
      token = req.query['x-session-token'];
    }
    if (!token || !sessions.has(token)) return res.status(401).json({ error: 'Unauthorized' });
    req.user = sessions.get(token);
    next();
  }

  // ════════════════════════════════════════════
  //  AUTH ROUTES
  // ════════════════════════════════════════════
  app.post('/api/auth/login', (req, res) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

      const trimmedUsername = username.trim();
      const user = queryOne('SELECT * FROM users WHERE (username = ? COLLATE NOCASE OR email = ? COLLATE NOCASE) AND is_active = 1', [trimmedUsername, trimmedUsername]);
      if (!user) return res.status(401).json({ error: 'Invalid credentials' });

      if (user.approved === 0) {
        return res.status(403).json({ error: 'Your account is pending administrator approval.' });
      }

      if (!bcrypt.compareSync(password, user.password_hash)) return res.status(401).json({ error: 'Invalid credentials' });

      const token = uuidv4();
      const session = { userId: user.id, username: user.username, name: user.name, role: user.role };
      sessions.set(token, session);

      run("UPDATE users SET last_login = datetime('now') WHERE id = ?", [user.id]);

      res.json({ token, user: session });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/auth/verify', (req, res) => {
    const token = req.headers['x-session-token'];
    if (!token || !sessions.has(token)) return res.status(401).json({ error: 'Invalid session' });
    res.json({ user: sessions.get(token) });
  });

  app.post('/api/auth/logout', (req, res) => {
    const token = req.headers['x-session-token'];
    if (token) sessions.delete(token);
    res.json({ success: true });
  });

  // ════════════════════════════════════════════
  //  DASHBOARD
  // ════════════════════════════════════════════
  app.get('/api/dashboard', auth, (req, res) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const monthStart = today.substring(0, 7) + '-01';
      // Yesterday
      const yd = new Date(); yd.setDate(yd.getDate() - 1);
      const yesterday = yd.toISOString().split('T')[0];

      const todaySales = queryOne("SELECT COALESCE(SUM(grand_total), 0) as total, COUNT(*) as count FROM sales WHERE invoice_date = ? AND status = 'completed'", [today]);
      const yesterdaySales = queryOne("SELECT COALESCE(SUM(grand_total), 0) as total FROM sales WHERE invoice_date = ? AND status = 'completed'", [yesterday]);
      const monthSales = queryOne("SELECT COALESCE(SUM(grand_total), 0) as total FROM sales WHERE invoice_date >= ? AND status = 'completed'", [monthStart]);
      const lowStock = queryOne('SELECT COUNT(*) as count FROM items WHERE current_stock <= min_stock_level AND is_active = 1 AND min_stock_level > 0');
      const outOfStock = queryOne('SELECT COUNT(*) as count FROM items WHERE current_stock <= 0 AND is_active = 1');
      const pendingReceivables = queryOne("SELECT COALESCE(SUM(balance_due), 0) as total FROM sales WHERE balance_due > 0 AND status = 'completed'");
      const recentSales = query("SELECT id, invoice_number, invoice_date, client_name, grand_total, payment_mode, status FROM sales WHERE status = 'completed' ORDER BY id DESC LIMIT 8");
      const totalItems = queryOne('SELECT COUNT(*) as count FROM items WHERE is_active = 1');
      const totalClients = queryOne('SELECT COUNT(*) as count FROM clients WHERE is_active = 1');

      // 7-day chart data
      const chartData = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i);
        const ds = d.toISOString().split('T')[0];
        const row = queryOne("SELECT COALESCE(SUM(grand_total),0) as total, COUNT(*) as count FROM sales WHERE invoice_date=? AND status='completed'", [ds]);
        const dow = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()];
        chartData.push({ date: dow, total: Math.round(row?.total || 0), count: row?.count || 0, fullDate: ds });
      }

      // Top 5 selling items this month
      const topItems = query(`
        SELECT si.item_name, SUM(si.quantity) as qty_sold, SUM(si.total_amount) as revenue
        FROM sale_items si
        JOIN sales s ON si.sale_id = s.id
        WHERE s.invoice_date >= ? AND s.status = 'completed'
        GROUP BY si.item_id, si.item_name
        ORDER BY qty_sold DESC LIMIT 5
      `, [monthStart]);

      // Payment mode breakdown today
      const paymentBreakdown = query("SELECT payment_mode, COUNT(*) as count, COALESCE(SUM(grand_total),0) as total FROM sales WHERE invoice_date=? AND status='completed' GROUP BY payment_mode", [today]);

      // Low stock items list
      const lowStockItems = query('SELECT id, name, code, current_stock, min_stock_level FROM items WHERE current_stock <= min_stock_level AND is_active = 1 AND min_stock_level > 0 ORDER BY current_stock ASC LIMIT 8');

      // Month purchase total
      const monthPurchases = queryOne("SELECT COALESCE(SUM(grand_total), 0) as total FROM purchases WHERE bill_date >= ?", [monthStart]);

      res.json({
        todaySales: todaySales?.total || 0,
        todayCount: todaySales?.count || 0,
        yesterdaySales: yesterdaySales?.total || 0,
        monthSales: monthSales?.total || 0,
        monthPurchases: monthPurchases?.total || 0,
        lowStockCount: lowStock?.count || 0,
        outOfStockCount: outOfStock?.count || 0,
        pendingReceivables: pendingReceivables?.total || 0,
        recentSales: recentSales || [],
        totalItems: totalItems?.count || 0,
        totalClients: totalClients?.count || 0,
        chartData,
        topItems: topItems || [],
        paymentBreakdown: paymentBreakdown || [],
        lowStockItems: lowStockItems || [],
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ════════════════════════════════════════════
  //  SYNC STATUS (Real-time tracking)
  // ════════════════════════════════════════════
  app.get('/api/sync/status', auth, (req, res) => {
    try {
      const lastMovement = queryOne('SELECT MAX(id) as id FROM stock_movements');
      const lastItemUpdate = queryOne('SELECT MAX(updated_at) as t FROM items');
      res.json({
        lastMovementId: lastMovement?.id || 0,
        lastItemUpdate: lastItemUpdate?.t || ''
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ════════════════════════════════════════════
  //  ITEMS
  // ════════════════════════════════════════════
  app.get('/api/items', auth, (req, res) => {
    try {
      const { search, category_id, stock_status, page = 1, limit = 50 } = req.query;
      let sql = 'SELECT i.*, c.name as category_name, u.short_name as unit_name, bu.short_name as bulk_unit_name FROM items i LEFT JOIN categories c ON i.category_id = c.id LEFT JOIN units u ON i.unit_id = u.id LEFT JOIN units bu ON i.bulk_unit_id = bu.id WHERE i.is_active = 1';
      const params = [];

      if (search) { sql += ' AND (i.name LIKE ? OR i.code LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
      if (category_id) { sql += ' AND i.category_id = ?'; params.push(Number(category_id)); }
      if (stock_status === 'low') sql += ' AND i.current_stock > 0 AND i.current_stock <= i.min_stock_level';
      else if (stock_status === 'out') sql += ' AND i.current_stock <= 0';
      else if (stock_status === 'in') sql += ' AND i.current_stock > 0';

      const countSql = sql.replace('SELECT i.*, c.name as category_name, u.short_name as unit_name, bu.short_name as bulk_unit_name', 'SELECT COUNT(*) as total');
      const totalResult = queryOne(countSql, params);
      const total = totalResult?.total || 0;

      const offset = (Number(page) - 1) * Number(limit);
      sql += ` ORDER BY i.name ASC LIMIT ${Number(limit)} OFFSET ${offset}`;

      const items = query(sql, params);
      res.json({ items, total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/items/search', auth, (req, res) => {
    try {
      const { q } = req.query;
      if (!q) return res.json([]);
      const items = query("SELECT i.id, i.code, i.name, i.hsn_code, i.selling_price, i.purchase_price, i.mrp, i.gst_rate, i.current_stock, i.min_stock_level, i.bulk_unit_id, i.bulk_conversion, COALESCE(u.short_name, 'Pcs') as unit_name, COALESCE(bu.short_name, 'Box') as bulk_unit_name FROM items i LEFT JOIN units u ON i.unit_id = u.id LEFT JOIN units bu ON i.bulk_unit_id = bu.id WHERE i.is_active = 1 AND (i.name LIKE ? OR i.code LIKE ?) ORDER BY i.name LIMIT 20", [`%${q}%`, `%${q}%`]);
      res.json(items);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/items/:id', auth, (req, res) => {
    try {
      const item = queryOne('SELECT i.*, c.name as category_name, u.short_name as unit_name, bu.short_name as bulk_unit_name FROM items i LEFT JOIN categories c ON i.category_id = c.id LEFT JOIN units u ON i.unit_id = u.id LEFT JOIN units bu ON i.bulk_unit_id = bu.id WHERE i.id = ?', [Number(req.params.id)]);
      if (!item) return res.status(404).json({ error: 'Item not found' });
      res.json(item);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/items', auth, (req, res) => {
    try {
      const { code, name, description, category_id, unit_id, bulk_unit_id, bulk_conversion, purchase_price, selling_price, mrp, gst_rate, hsn_code, opening_stock, min_stock_level, zone, image_path } = req.body;
      if (!name) return res.status(400).json({ error: 'Item name is required' });

      const autoCode = code || ('ITM' + String(Date.now()).slice(-6));
      run('INSERT INTO items (code, name, description, category_id, unit_id, bulk_unit_id, bulk_conversion, purchase_price, selling_price, mrp, gst_rate, hsn_code, opening_stock, current_stock, min_stock_level, zone, image_path) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [autoCode, name, description || '', category_id || null, unit_id || null, bulk_unit_id || null, Number(bulk_conversion) || 1, purchase_price || 0, selling_price || 0, mrp || 0, gst_rate ?? 18, hsn_code || '', opening_stock || 0, opening_stock || 0, min_stock_level || 0, zone || 'A', image_path || '']);

      const id = getLastId();
      if (opening_stock > 0) {
        run('INSERT INTO stock_movements (item_id, movement_type, quantity, balance_after, notes) VALUES (?, ?, ?, ?, ?)',
          [id, 'opening', opening_stock, opening_stock, 'Opening stock']);
      }
      const item = queryOne('SELECT i.*, c.name as category_name, u.short_name as unit_name, bu.short_name as bulk_unit_name FROM items i LEFT JOIN categories c ON i.category_id = c.id LEFT JOIN units u ON i.unit_id = u.id LEFT JOIN units bu ON i.bulk_unit_id = bu.id WHERE i.id = ?', [id]);
      res.status(201).json(item);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/items/:id', auth, (req, res) => {
    try {
      const { name, description, category_id, unit_id, bulk_unit_id, bulk_conversion, code, purchase_price, selling_price, mrp, gst_rate, hsn_code, current_stock, min_stock_level, zone, image_path } = req.body;
      if (!name) return res.status(400).json({ error: 'Item name is required' });

      run("UPDATE items SET name=?, description=?, category_id=?, unit_id=?, bulk_unit_id=?, bulk_conversion=?, code=?, purchase_price=?, selling_price=?, mrp=?, gst_rate=?, hsn_code=?, current_stock=?, min_stock_level=?, zone=?, image_path=?, updated_at=datetime('now') WHERE id=?",
        [name, description || '', category_id || null, unit_id || null, bulk_unit_id || null, Number(bulk_conversion) || 1, code || '', purchase_price || 0, selling_price || 0, mrp || 0, gst_rate ?? 18, hsn_code || '', Number(current_stock) || 0, min_stock_level || 0, zone || 'A', image_path || '', Number(req.params.id)]);

      // Return with full joins so unit_name, bulk_unit_name, category_name are populated
      const item = queryOne('SELECT i.*, c.name as category_name, u.short_name as unit_name, bu.short_name as bulk_unit_name FROM items i LEFT JOIN categories c ON i.category_id = c.id LEFT JOIN units u ON i.unit_id = u.id LEFT JOIN units bu ON i.bulk_unit_id = bu.id WHERE i.id = ?', [Number(req.params.id)]);
      res.json(item);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/items/:id', auth, (req, res) => {
    try {
      run("UPDATE items SET is_active = 0, updated_at = datetime('now') WHERE id = ?", [Number(req.params.id)]);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Bulk update GST rate for multiple items at once
  app.post('/api/items/bulk-gst-update', auth, (req, res) => {
    try {
      const { item_ids, new_gst_rate } = req.body;
      if (!Array.isArray(item_ids) || item_ids.length === 0) {
        return res.status(400).json({ error: 'item_ids must be a non-empty array' });
      }
      if (new_gst_rate === undefined || new_gst_rate === null || isNaN(Number(new_gst_rate))) {
        return res.status(400).json({ error: 'new_gst_rate is required' });
      }
      const rate = Number(new_gst_rate);
      const placeholders = item_ids.map(() => '?').join(',');
      run(
        `UPDATE items SET gst_rate = ?, updated_at = datetime('now') WHERE id IN (${placeholders}) AND is_active = 1`,
        [rate, ...item_ids.map(Number)]
      );
      res.json({ success: true, updated: item_ids.length, new_gst_rate: rate });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ════════════════════════════════════════════
  //  CLIENTS
  // ════════════════════════════════════════════
  app.get('/api/clients', auth, (req, res) => {
    try {
      const { search, type, page = 1, limit = 50 } = req.query;
      let sql = `
        SELECT c.*, u.id AS user_id, u.username AS wms_username, u.approved AS wms_approved, u.is_active AS wms_active 
        FROM clients c 
        LEFT JOIN users u ON (c.email IS NOT NULL AND c.email != '' AND LOWER(c.email) = LOWER(u.email)) 
          OR (c.phone IS NOT NULL AND c.phone != '' AND LOWER(c.phone) = LOWER(u.username)) 
          OR (c.mobile IS NOT NULL AND c.mobile != '' AND LOWER(c.mobile) = LOWER(u.username))
        WHERE c.is_active = 1
      `;
      const params = [];

      if (search) { 
        sql += ' AND (c.name LIKE ? OR c.store_name LIKE ? OR c.code LIKE ? OR c.phone LIKE ? OR c.email LIKE ?)'; 
        params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`); 
      }
      if (type && type !== 'all') { 
        sql += ' AND c.type = ?'; 
        params.push(type); 
      }

      const countSql = `
        SELECT COUNT(*) as total 
        FROM clients c 
        LEFT JOIN users u ON (c.email IS NOT NULL AND c.email != '' AND LOWER(c.email) = LOWER(u.email)) 
          OR (c.phone IS NOT NULL AND c.phone != '' AND LOWER(c.phone) = LOWER(u.username)) 
          OR (c.mobile IS NOT NULL AND c.mobile != '' AND LOWER(c.mobile) = LOWER(u.username))
        WHERE c.is_active = 1
        ${search ? ' AND (c.name LIKE ? OR c.store_name LIKE ? OR c.code LIKE ? OR c.phone LIKE ? OR c.email LIKE ?)' : ''}
        ${type && type !== 'all' ? ' AND c.type = ?' : ''}
      `;
      const total = queryOne(countSql, params)?.total || 0;

      const offset = (Number(page) - 1) * Number(limit);
      sql += ` ORDER BY c.name ASC LIMIT ${Number(limit)} OFFSET ${offset}`;

      res.json({ clients: query(sql, params), total, page: Number(page), totalPages: Math.ceil(total / Number(limit)) });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/clients/search', auth, (req, res) => {
    try {
      const { q, type } = req.query;
      if (!q) return res.json([]);
      let sql = 'SELECT id, code, name, store_name, type, gstin, state_code, address_line1, city, phone, current_balance FROM clients WHERE is_active = 1 AND (name LIKE ? OR store_name LIKE ? OR code LIKE ?)';
      const params = [`%${q}%`, `%${q}%`, `%${q}%`];
      if (type) { sql += ' AND type IN (?, "both")'; params.push(type); }
      sql += ' ORDER BY name LIMIT 20';
      res.json(query(sql, params));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/clients/:id', auth, (req, res) => {
    try {
      const client = queryOne('SELECT * FROM clients WHERE id = ?', [Number(req.params.id)]);
      if (!client) return res.status(404).json({ error: 'Client not found' });
      res.json(client);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/clients', auth, (req, res) => {
    try {
      const { code, name, store_name, type, address_line1, address_line2, address_line3, city, state, pincode, phone, mobile, email, gstin, state_code, pan, credit_limit, credit_days, area, zone, opening_balance, wms_enabled, wms_username, wms_password, wms_approved } = req.body;
      if (!name) return res.status(400).json({ error: 'Client name is required' });

      const autoCode = code || ((type === 'supplier' ? 'SUP' : 'CUS') + String(Date.now()).slice(-6));
      run('INSERT INTO clients (code, name, store_name, type, address_line1, address_line2, address_line3, city, state, pincode, phone, mobile, email, gstin, state_code, pan, credit_limit, credit_days, area, zone, opening_balance, current_balance) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
        [autoCode, name, store_name||'', type || 'customer', address_line1||'', address_line2||'', address_line3||'', city||'', state||'', pincode||'', phone||'', mobile||'', email||'', gstin||'', state_code||'', pan||'', credit_limit||0, credit_days||30, area||'', zone||'', opening_balance||0, opening_balance||0]);
      
      const clientId = getLastId();

      // WMS User Sync
      if (wms_enabled && wms_username) {
        const existing = queryOne("SELECT id FROM users WHERE email = ? OR username = ?", [wms_username, wms_username]);
        if (!existing) {
          const pass = wms_password || '123456';
          const hash = bcrypt.hashSync(pass, 10);
          run("INSERT INTO users (username, password_hash, name, role, email, store_name, gst_number, store_address, approved, is_active, created_at) VALUES (?, ?, ?, 'client', ?, ?, ?, ?, ?, 1, datetime('now'))",
            [wms_username, hash, name, email || wms_username, store_name || name, gstin || '', address_line1 || '', wms_approved ? 1 : 0]);
        }
      }

      res.status(201).json(queryOne('SELECT * FROM clients WHERE id = ?', [clientId]));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/clients/:id', auth, (req, res) => {
    try {
      const { name, store_name, type, code, address_line1, address_line2, address_line3, city, state, pincode, phone, mobile, email, gstin, state_code, pan, credit_limit, credit_days, area, zone, current_balance, wms_enabled, wms_username, wms_password, wms_approved } = req.body;
      if (!name) return res.status(400).json({ error: 'Client name is required' });
      const clientId = Number(req.params.id);

      run('UPDATE clients SET name=?, store_name=?, type=?, code=?, address_line1=?, address_line2=?, address_line3=?, city=?, state=?, pincode=?, phone=?, mobile=?, email=?, gstin=?, state_code=?, pan=?, credit_limit=?, credit_days=?, area=?, zone=?, current_balance=?, updated_at=datetime("now") WHERE id=?',
        [name, store_name||'', type||'customer', code||'', address_line1||'', address_line2||'', address_line3||'', city||'', state||'', pincode||'', phone||'', mobile||'', email||'', gstin||'', state_code||'', pan||'', credit_limit||0, credit_days||30, area||'', zone||'', current_balance !== undefined ? Number(current_balance) : queryOne('SELECT current_balance FROM clients WHERE id=?',[clientId])?.current_balance || 0, clientId]);

      // WMS User Sync
      if (wms_enabled && wms_username) {
        const existing = queryOne("SELECT id FROM users WHERE email = ? OR username = ?", [wms_username, wms_username]);
        if (existing) {
          let updateSql = "UPDATE users SET name = ?, store_name = ?, gst_number = ?, store_address = ?, approved = ?, is_active = 1";
          const updateParams = [name, store_name || name, gstin || '', address_line1 || '', wms_approved ? 1 : 0];
          if (wms_password && wms_password.trim() !== '') {
            updateSql += ", password_hash = ?";
            updateParams.push(bcrypt.hashSync(wms_password, 10));
          }
          updateSql += " WHERE id = ?";
          updateParams.push(existing.id);
          run(updateSql, updateParams);
        } else {
          const pass = wms_password || '123456';
          const hash = bcrypt.hashSync(pass, 10);
          run("INSERT INTO users (username, password_hash, name, role, email, store_name, gst_number, store_address, approved, is_active, created_at) VALUES (?, ?, ?, 'client', ?, ?, ?, ?, ?, 1, datetime('now'))",
            [wms_username, hash, name, email || wms_username, store_name || name, gstin || '', address_line1 || '', wms_approved ? 1 : 0]);
        }
      } else if (!wms_enabled && wms_username) {
        run("UPDATE users SET is_active = 0, approved = 0 WHERE username = ? OR email = ?", [wms_username, wms_username]);
      }

      res.json(queryOne('SELECT * FROM clients WHERE id = ?', [clientId]));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/clients/:id', auth, (req, res) => {
    try {
      const client = queryOne('SELECT email, phone FROM clients WHERE id = ?', [Number(req.params.id)]);
      run("UPDATE clients SET is_active = 0, updated_at = datetime('now') WHERE id = ?", [Number(req.params.id)]);
      if (client) {
        const iden = client.email || client.phone;
        if (iden) {
          run("UPDATE users SET is_active = 0, approved = 0 WHERE username = ? OR email = ?", [iden, iden]);
        }
      }
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // WMS Client Self-Registrations Pending
  app.get('/api/clients-pending/registrations', auth, (req, res) => {
    try {
      const pendingUsers = query("SELECT id, username, name, email, store_name, gst_number, store_address, created_at FROM users WHERE role = 'client' AND approved = 0 ORDER BY created_at DESC");
      res.json(pendingUsers);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Approve WMS Client Registration
  app.put('/api/clients-pending/approve/:userId', auth, (req, res) => {
    try {
      const userId = Number(req.params.userId);
      const user = queryOne("SELECT * FROM users WHERE id = ?", [userId]);
      if (!user) return res.status(404).json({ error: 'Registration not found' });

      run("UPDATE users SET approved = 1 WHERE id = ?", [userId]);

      const email = user.email || user.username;
      const existingClient = queryOne("SELECT id FROM clients WHERE LOWER(email) = LOWER(?) OR name = ?", [email, user.store_name]);
      if (!existingClient) {
        const autoCode = 'CUS' + String(Date.now()).slice(-6);
        run('INSERT INTO clients (code, name, type, address_line1, email, gstin, current_balance) VALUES (?, ?, "customer", ?, ?, ?, 0)',
          [autoCode, user.store_name || user.name, user.store_address || '', email, user.gst_number || '']);
      }
      res.json({ success: true, message: 'Registration approved and Client profile created.' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Reject WMS Client Registration
  app.delete('/api/clients-pending/reject/:userId', auth, (req, res) => {
    try {
      const userId = Number(req.params.userId);
      const user = queryOne("SELECT id FROM users WHERE id = ?", [userId]);
      if (!user) return res.status(404).json({ error: 'Registration not found' });

      run("DELETE FROM users WHERE id = ?", [userId]);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ════════════════════════════════════════════
  //  CATEGORIES
  // ════════════════════════════════════════════
  app.get('/api/categories', auth, (req, res) => {
    try {
      const cats = query('SELECT c.*, (SELECT COUNT(*) FROM items WHERE category_id = c.id AND is_active = 1) as item_count FROM categories c ORDER BY c.name');
      res.json(cats);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  app.post('/api/categories', auth, (req, res) => {
    try {
      const { name, description } = req.body;
      if (!name) return res.status(400).json({ error: 'Category name required' });
      run('INSERT INTO categories (name, description) VALUES (?, ?)', [name, description || '']);
      res.status(201).json(queryOne('SELECT * FROM categories WHERE id = ?', [getLastId()]));
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  app.put('/api/categories/:id', auth, (req, res) => {
    try {
      const { name, description } = req.body;
      run('UPDATE categories SET name = ?, description = ? WHERE id = ?', [name, description || '', Number(req.params.id)]);
      res.json(queryOne('SELECT * FROM categories WHERE id = ?', [Number(req.params.id)]));
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  app.delete('/api/categories/:id', auth, (req, res) => {
    try {
      const itemCount = queryOne('SELECT COUNT(*) as c FROM items WHERE category_id = ? AND is_active = 1', [Number(req.params.id)]);
      if (itemCount?.c > 0) return res.status(400).json({ error: 'Cannot delete category with items' });
      run('DELETE FROM categories WHERE id = ?', [Number(req.params.id)]);
      res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // ════════════════════════════════════════════
  //  UNITS
  // ════════════════════════════════════════════
  app.get('/api/units', auth, (req, res) => {
    try {
      const u = query('SELECT u.*, (SELECT COUNT(*) FROM items WHERE unit_id = u.id AND is_active = 1) as item_count FROM units u ORDER BY u.name');
      res.json(u);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  app.post('/api/units', auth, (req, res) => {
    try {
      const { name, short_name } = req.body;
      if (!name || !short_name) return res.status(400).json({ error: 'Name and short name required' });
      run('INSERT INTO units (name, short_name) VALUES (?, ?)', [name, short_name]);
      res.status(201).json(queryOne('SELECT * FROM units WHERE id = ?', [getLastId()]));
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  app.put('/api/units/:id', auth, (req, res) => {
    try {
      const { name, short_name } = req.body;
      run('UPDATE units SET name = ?, short_name = ? WHERE id = ?', [name, short_name, Number(req.params.id)]);
      res.json(queryOne('SELECT * FROM units WHERE id = ?', [Number(req.params.id)]));
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  app.delete('/api/units/:id', auth, (req, res) => {
    try {
      const itemCount = queryOne('SELECT COUNT(*) as c FROM items WHERE unit_id = ? AND is_active = 1', [Number(req.params.id)]);
      if (itemCount?.c > 0) return res.status(400).json({ error: 'Cannot delete unit with items' });
      run('DELETE FROM units WHERE id = ?', [Number(req.params.id)]);
      res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // ════════════════════════════════════════════
  //  COMPANY SETTINGS
  // ════════════════════════════════════════════
  app.get('/api/company', auth, (req, res) => {
    try {
      const company = queryOne('SELECT * FROM company WHERE id = 1');
      res.json(company || {});
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  app.put('/api/company', auth, (req, res) => {
    try {
      // First ensure new columns exist (migration-safe)
      try {
        db.run("ALTER TABLE company ADD COLUMN invoice_prefix TEXT DEFAULT '';");
      } catch(e) { /* column already exists */ }
      try {
        db.run("ALTER TABLE company ADD COLUMN default_gst_rate TEXT DEFAULT '18';");
      } catch(e) { /* column already exists */ }

      const fields = ['name','address_line1','address_line2','address_line3','city','state','pincode','phone','mobile','email','gstin','state_code','bank_name','bank_account','bank_ifsc','bank_branch','logo_path','financial_year_start','financial_year_end','invoice_prefix','default_gst_rate'];
      const sets = fields.map(f => `${f} = ?`).join(', ');
      const vals = fields.map(f => req.body[f] !== undefined ? req.body[f] : '');
      vals.push(1);
      run(`UPDATE company SET ${sets}, updated_at = datetime('now') WHERE id = ?`, vals);
      res.json(queryOne('SELECT * FROM company WHERE id = 1'));
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // ════════════════════════════════════════════
  //  SALES (Core Billing)
  // ════════════════════════════════════════════
  function generateInvoiceNumber() {
    const now = new Date();
    const fy = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
    const fyStr = `${String(fy).slice(-2)}-${String(fy + 1).slice(-2)}`;

    // Read company prefix (if set), fall back to 'AT'
    let prefix = 'AT';
    try {
      const co = queryOne("SELECT invoice_prefix FROM company WHERE id = 1");
      if (co && co.invoice_prefix && co.invoice_prefix.trim()) {
        // Remove trailing slash if present — we'll add it ourselves
        prefix = co.invoice_prefix.replace(/\/+$/, '');
      }
    } catch(e) { /* ignore if column missing on old DB */ }

    const pattern = `${prefix}/${fyStr}/%`;
    const last = queryOne(`SELECT invoice_number FROM sales WHERE invoice_number LIKE ? ORDER BY id DESC LIMIT 1`, [pattern]);
    let nextNum = 1;
    if (last) {
      const parts = last.invoice_number.split('/');
      const lastPart = parts[parts.length - 1];
      const parsed = parseInt(lastPart, 10);
      if (!isNaN(parsed)) nextNum = parsed + 1;
    }
    return `${prefix}/${fyStr}/${String(nextNum).padStart(4, '0')}`;
  }

  app.get('/api/sales', auth, (req, res) => {
    try {
      const { search, date_from, date_to, client_id, status, page = 1, limit = 25 } = req.query;
      let sql = 'SELECT * FROM sales WHERE 1=1';
      const params = [];

      if (search) { sql += ' AND (invoice_number LIKE ? OR client_name LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
      if (date_from) { sql += ' AND invoice_date >= ?'; params.push(date_from); }
      if (date_to) { sql += ' AND invoice_date <= ?'; params.push(date_to); }
      if (client_id) { sql += ' AND client_id = ?'; params.push(Number(client_id)); }
      if (status) { sql += ' AND status = ?'; params.push(status); }

      const total = queryOne(sql.replace('SELECT *', 'SELECT COUNT(*) as total'), params)?.total || 0;
      const offset = (Number(page) - 1) * Number(limit);
      sql += ` ORDER BY created_at DESC LIMIT ${Number(limit)} OFFSET ${offset}`;

      res.json({ sales: query(sql, params), total, page: Number(page), totalPages: Math.ceil(total / Number(limit)) });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  app.get('/api/sales/:id', auth, (req, res) => {
    try {
      const sale = queryOne('SELECT * FROM sales WHERE id = ?', [Number(req.params.id)]);
      if (!sale) return res.status(404).json({ error: 'Invoice not found' });
      sale.items = query('SELECT * FROM sale_items WHERE sale_id = ?', [sale.id]);
      res.json(sale);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  app.get('/api/sales/:id/print', auth, (req, res) => {
    try {
      const sale = queryOne('SELECT * FROM sales WHERE id = ?', [Number(req.params.id)]);
      if (!sale) return res.status(404).json({ error: 'Invoice not found' });
      sale.items = query('SELECT * FROM sale_items WHERE sale_id = ?', [sale.id]);

      const company = queryOne('SELECT * FROM company WHERE id = 1') || {};
      const printType = req.query.type || 'a4';

      let html = '';
      if (printType === 'thermal') {
        html = generateThermalHTML(sale, company);
      } else if (printType === 'a5') {
        const { generateA5InvoiceHTML } = require('./print/a5-invoice');
        html = generateA5InvoiceHTML(sale, company);
      } else {
        html = generateA4InvoiceHTML(sale, company);
      }

      // Inject auto-print script
      const printScript = `
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 500);
          };
        </script>
      `;
      html = html.replace('</body>', `${printScript}</body>`);

      res.setHeader('Content-Type', 'text/html');
      res.send(html);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/sales', auth, (req, res) => {
    try {
      const { invoice_date, client_id, payment_mode, is_inter_state, notes, discount_amount, discount_percent, items } = req.body;
      if (!items || !items.length) return res.status(400).json({ error: 'At least one item is required' });

      // Validate stock (taking bulk conversion into account)
      for (const item of items) {
        if (item.is_free) continue;
        const dbItem = queryOne('SELECT current_stock, name, bulk_conversion FROM items WHERE id = ?', [item.item_id]);
        if (!dbItem) return res.status(400).json({ error: `Item not found: ${item.item_id}` });
        const conversion = (item.selected_unit === 'bulk') ? (dbItem.bulk_conversion || 1) : 1;
        const piecesToDeduct = item.quantity * conversion;
        if (dbItem.current_stock < piecesToDeduct) {
          return res.status(400).json({ error: `Insufficient stock! Available: ${dbItem.current_stock} Pcs, Requested: ${piecesToDeduct} Pcs.` });
        }
      }

      const invoice_number = generateInvoiceNumber();
      const client = client_id ? queryOne('SELECT name, gstin, state_code, address_line1, address_line2, city, state, pincode, phone, mobile FROM clients WHERE id = ?', [client_id]) : null;
      const interState = is_inter_state ? 1 : 0;

      let subtotal = 0, cgst_total = 0, sgst_total = 0, igst_total = 0, discount_total = 0;

      const processedItems = items.map(item => {
        const qty = Number(item.quantity) || 1;
        const rate = Number(item.unit_price) || 0;
        const discPct = Number(item.discount_percent) || 0;
        const gstRate = Number(item.gst_rate) || 0;

        const gross = qty * rate;
        const discAmt = gross * discPct / 100;
        const taxable = gross - discAmt;

        let cgst = 0, sgst = 0, igst = 0;
        if (interState) { igst = taxable * gstRate / 100; }
        else { cgst = taxable * gstRate / 200; sgst = taxable * gstRate / 200; }

        const total = taxable + cgst + sgst + igst;

        subtotal += taxable;
        cgst_total += cgst;
        sgst_total += sgst;
        igst_total += igst;
        discount_total += discAmt;

        return { ...item, quantity: qty, unit_price: rate, discount_percent: discPct, discount_amount: Math.round(discAmt * 100) / 100, taxable_amount: Math.round(taxable * 100) / 100, gst_rate: gstRate, cgst_amount: Math.round(cgst * 100) / 100, sgst_amount: Math.round(sgst * 100) / 100, igst_amount: Math.round(igst * 100) / 100, total_amount: Math.round(total * 100) / 100 };
      });

      const tax_total = cgst_total + sgst_total + igst_total;
      const overall_discount = discount_amount !== undefined ? Number(discount_amount) : discount_total;
      const overall_discount_percent = discount_percent !== undefined ? Number(discount_percent) : 0;

      const rawGrand = (subtotal + tax_total) - overall_discount;
      const grand_total = Math.round(rawGrand);
      const round_off = grand_total - rawGrand;
      const amount_paid = payment_mode === 'cash' ? grand_total : 0;
      const balance_due = grand_total - amount_paid;

      // Capture client's current balance before this invoice (for old_balance/new_balance tracking)
      const clientFull = client_id ? queryOne('SELECT name, gstin, state_code, address_line1, address_line2, city, state, pincode, phone, mobile, current_balance FROM clients WHERE id = ?', [client_id]) : null;
      const old_balance = clientFull ? (Number(clientFull.current_balance) || 0) : 0;
      const new_balance = old_balance + balance_due; // balance_due is what remains unpaid for this invoice

      run(`INSERT INTO sales (invoice_number, invoice_date, client_id, client_name, client_gstin, client_address_line1, client_address_line2, client_city, client_state, client_pincode, client_phone, client_mobile, client_state_code, payment_mode, subtotal, discount_amount, discount_percent, cgst_total, sgst_total, igst_total, tax_total, round_off, grand_total, amount_paid, balance_due, old_balance, new_balance, notes, is_gst_bill, is_inter_state, status, created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,?,?,?)`,
        [invoice_number, invoice_date || new Date().toISOString().split('T')[0], client_id || null, clientFull?.name || client?.name || 'Walk-in Customer', clientFull?.gstin || client?.gstin || '', clientFull?.address_line1 || client?.address_line1 || '', clientFull?.address_line2 || client?.address_line2 || '', clientFull?.city || client?.city || '', clientFull?.state || client?.state || '', clientFull?.pincode || client?.pincode || '', clientFull?.phone || client?.phone || '', clientFull?.mobile || client?.mobile || '', clientFull?.state_code || client?.state_code || '', payment_mode || 'cash', Math.round(subtotal*100)/100, Math.round(overall_discount*100)/100, overall_discount_percent, Math.round(cgst_total*100)/100, Math.round(sgst_total*100)/100, Math.round(igst_total*100)/100, Math.round(tax_total*100)/100, Math.round(round_off*100)/100, grand_total, amount_paid, balance_due, Math.round(old_balance*100)/100, Math.round(new_balance*100)/100, notes || '', interState, 'completed', req.user?.userId || null]);

      const saleId = getLastId();

      // Insert sale items + deduct stock
      for (const item of processedItems) {
        const dbItem = queryOne('SELECT i.name, i.hsn_code, i.mrp, i.bulk_conversion, COALESCE(u.short_name, "Pcs") as unit_name, COALESCE(bu.short_name, "Box") as bulk_unit_name FROM items i LEFT JOIN units u ON i.unit_id = u.id LEFT JOIN units bu ON i.bulk_unit_id = bu.id WHERE i.id = ?', [item.item_id]);
        const finalUnitName = item.unit_name || ((item.selected_unit === 'bulk') ? (dbItem?.bulk_unit_name || 'Box') : (dbItem?.unit_name || 'Pcs'));

        run('INSERT INTO sale_items (sale_id, item_id, item_name, hsn_code, mrp, unit_name, quantity, unit_price, discount_percent, discount_amount, taxable_amount, gst_rate, cgst_amount, sgst_amount, igst_amount, total_amount, is_free, selected_unit) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
          [saleId, item.item_id, dbItem?.name || '', dbItem?.hsn_code || '', dbItem?.mrp || 0, finalUnitName, item.quantity, item.unit_price, item.discount_percent, item.discount_amount, item.taxable_amount, item.gst_rate, item.cgst_amount, item.sgst_amount, item.igst_amount, item.total_amount, item.is_free ? 1 : 0, item.selected_unit || 'pcs']);

        const conversion = (item.selected_unit === 'bulk') ? (dbItem?.bulk_conversion || 1) : 1;
        const piecesToDeduct = item.quantity * conversion;

        // Deduct physical stock
        run("UPDATE items SET current_stock = current_stock - ?, updated_at = datetime('now') WHERE id = ?", [piecesToDeduct, item.item_id]);
        const updatedItem = queryOne('SELECT current_stock FROM items WHERE id = ?', [item.item_id]);
        run('INSERT INTO stock_movements (item_id, movement_type, quantity, reference_type, reference_id, balance_after, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [item.item_id, 'sale', -piecesToDeduct, 'sale', saleId, updatedItem?.current_stock || 0, `Sale ${invoice_number}${item.is_free ? ' (FREE)' : ''}`]);
      }

      // Update client balance for credit/non-cash sales
      if (client_id && balance_due !== 0) {
        run("UPDATE clients SET current_balance = current_balance + ?, updated_at = datetime('now') WHERE id = ?", [balance_due, client_id]);
      }

      const sale = queryOne('SELECT * FROM sales WHERE id = ?', [saleId]);
      sale.items = query('SELECT * FROM sale_items WHERE sale_id = ?', [saleId]);
      res.status(201).json(sale);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── UPDATE SALE ──────────────────────────────
  app.put('/api/sales/:id', auth, (req, res) => {
    try {
      const saleId = Number(req.params.id);
      const existing = queryOne('SELECT * FROM sales WHERE id = ?', [saleId]);
      if (!existing) return res.status(404).json({ error: 'Invoice not found' });

      const { invoice_date, client_id, payment_mode, is_inter_state, notes, discount_amount, discount_percent, items } = req.body;
      if (!items || !items.length) return res.status(400).json({ error: 'At least one item is required' });

      // Restore old stock — reverse original deductions
      const oldItems = query('SELECT * FROM sale_items WHERE sale_id = ?', [saleId]);
      for (const oi of oldItems) {
        const itemDb = queryOne("SELECT i.bulk_conversion FROM items i WHERE i.id = ?", [oi.item_id]);
        const isBulk = oi.selected_unit === 'bulk';
        const conversion = isBulk ? (itemDb?.bulk_conversion || 1) : 1;
        const piecesToRestore = oi.quantity * conversion;
        run("UPDATE items SET current_stock = current_stock + ?, updated_at = datetime('now') WHERE id = ?", [piecesToRestore, oi.item_id]);
      }

      // Validate stock for new items (taking bulk conversion into account)
      for (const item of items) {
        if (item.is_free) continue;
        const dbItem = queryOne('SELECT current_stock, name, bulk_conversion FROM items WHERE id = ?', [item.item_id]);
        if (!dbItem) {
          // Revert old stock deductions before responding
          for (const oi of oldItems) {
            const itemDb = queryOne("SELECT i.bulk_conversion FROM items i WHERE i.id = ?", [oi.item_id]);
            const isBulk = oi.selected_unit === 'bulk';
            const conversion = isBulk ? (itemDb?.bulk_conversion || 1) : 1;
            const piecesToRestore = oi.quantity * conversion;
            run("UPDATE items SET current_stock = current_stock - ?, updated_at = datetime('now') WHERE id = ?", [piecesToRestore, oi.item_id]);
          }
          return res.status(400).json({ error: `Item not found: ${item.item_id}` });
        }
        const conversion = (item.selected_unit === 'bulk') ? (dbItem.bulk_conversion || 1) : 1;
        const piecesToDeduct = item.quantity * conversion;
        if (dbItem.current_stock < piecesToDeduct) {
          // Revert old stock deductions before responding
          for (const oi of oldItems) {
            const itemDb = queryOne("SELECT i.bulk_conversion FROM items i WHERE i.id = ?", [oi.item_id]);
            const isBulk = oi.selected_unit === 'bulk';
            const conversion = isBulk ? (itemDb?.bulk_conversion || 1) : 1;
            const piecesToRestore = oi.quantity * conversion;
            run("UPDATE items SET current_stock = current_stock - ?, updated_at = datetime('now') WHERE id = ?", [piecesToRestore, oi.item_id]);
          }
          return res.status(400).json({ error: `Insufficient stock! Available: ${dbItem.current_stock} Pcs, Requested: ${piecesToDeduct} Pcs.` });
        }
      }

      // Reverse client balance if original was credit
      if (existing.client_id && existing.balance_due > 0) {
        run("UPDATE clients SET current_balance = current_balance - ?, updated_at = datetime('now') WHERE id = ?", [existing.balance_due, existing.client_id]);
      }

      // Delete old items and stock movements
      run('DELETE FROM sale_items WHERE sale_id = ?', [saleId]);
      run("DELETE FROM stock_movements WHERE reference_type = 'sale' AND reference_id = ?", [saleId]);

      const client = client_id ? queryOne('SELECT name, gstin, state_code, address_line1, address_line2, city, state, pincode, phone, mobile FROM clients WHERE id = ?', [client_id]) : null;
      const interState = is_inter_state ? 1 : 0;

      let subtotal = 0, cgst_total = 0, sgst_total = 0, igst_total = 0, discount_total = 0;
      const processedItems = items.map(item => {
        const qty = Number(item.quantity) || 1;
        const rate = Number(item.unit_price) || 0;
        const discPct = Number(item.discount_percent) || 0;
        const gstRate = Number(item.gst_rate) || 0;
        const gross = qty * rate;
        const discAmt = gross * discPct / 100;
        const taxable = gross - discAmt;
        let cgst = 0, sgst = 0, igst = 0;
        if (interState) { igst = taxable * gstRate / 100; }
        else { cgst = taxable * gstRate / 200; sgst = taxable * gstRate / 200; }
        const total = taxable + cgst + sgst + igst;
        subtotal += taxable; cgst_total += cgst; sgst_total += sgst; igst_total += igst; discount_total += discAmt;
        return { ...item, quantity: qty, unit_price: rate, discount_percent: discPct, discount_amount: Math.round(discAmt*100)/100, taxable_amount: Math.round(taxable*100)/100, gst_rate: gstRate, cgst_amount: Math.round(cgst*100)/100, sgst_amount: Math.round(sgst*100)/100, igst_amount: Math.round(igst*100)/100, total_amount: Math.round(total*100)/100 };
      });

      const tax_total = cgst_total + sgst_total + igst_total;
      const overall_discount = discount_amount !== undefined ? Number(discount_amount) : 0;
      const rawGrand = (subtotal + tax_total) - overall_discount;
      const grand_total = Math.round(rawGrand);
      const round_off = grand_total - rawGrand;
      const amount_paid = payment_mode === 'cash' ? grand_total : 0;
      const balance_due = grand_total - amount_paid;

      run(`UPDATE sales SET invoice_date=?, client_id=?, client_name=?, client_gstin=?, client_address_line1=?, client_address_line2=?, client_city=?, client_state=?, client_pincode=?, client_phone=?, client_mobile=?, client_state_code=?, payment_mode=?, subtotal=?, discount_amount=?, cgst_total=?, sgst_total=?, igst_total=?, tax_total=?, round_off=?, grand_total=?, amount_paid=?, balance_due=?, notes=?, is_inter_state=?, updated_at=datetime('now') WHERE id=?`,
        [invoice_date || existing.invoice_date, client_id || null, client?.name || 'Walk-in Customer', client?.gstin || '', client?.address_line1 || '', client?.address_line2 || '', client?.city || '', client?.state || '', client?.pincode || '', client?.phone || '', client?.mobile || '', client?.state_code || '', payment_mode || 'cash', Math.round(subtotal*100)/100, Math.round(discount_total*100)/100, Math.round(cgst_total*100)/100, Math.round(sgst_total*100)/100, Math.round(igst_total*100)/100, Math.round(tax_total*100)/100, Math.round(round_off*100)/100, grand_total, amount_paid, balance_due, notes || '', interState, saleId]);

      // Insert new items + deduct stock
      for (const item of processedItems) {
        const dbItem = queryOne('SELECT i.name, i.hsn_code, i.mrp, i.bulk_conversion, COALESCE(u.short_name, "Pcs") as unit_name, COALESCE(bu.short_name, "Box") as bulk_unit_name FROM items i LEFT JOIN units u ON i.unit_id = u.id LEFT JOIN units bu ON i.bulk_unit_id = bu.id WHERE i.id = ?', [item.item_id]);
        const finalUnitName = item.unit_name || ((item.selected_unit === 'bulk') ? (dbItem?.bulk_unit_name || 'Box') : (dbItem?.unit_name || 'Pcs'));

        run('INSERT INTO sale_items (sale_id, item_id, item_name, hsn_code, mrp, unit_name, quantity, unit_price, discount_percent, discount_amount, taxable_amount, gst_rate, cgst_amount, sgst_amount, igst_amount, total_amount, is_free, selected_unit) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
          [saleId, item.item_id, dbItem?.name || '', dbItem?.hsn_code || '', dbItem?.mrp || 0, finalUnitName, item.quantity, item.unit_price, item.discount_percent, item.discount_amount, item.taxable_amount, item.gst_rate, item.cgst_amount, item.sgst_amount, item.igst_amount, item.total_amount, item.is_free ? 1 : 0, item.selected_unit || 'pcs']);

        const conversion = (item.selected_unit === 'bulk') ? (dbItem?.bulk_conversion || 1) : 1;
        const piecesToDeduct = item.quantity * conversion;
        run("UPDATE items SET current_stock = current_stock - ?, updated_at = datetime('now') WHERE id = ?", [piecesToDeduct, item.item_id]);
        const updatedItem = queryOne('SELECT current_stock FROM items WHERE id = ?', [item.item_id]);
        run('INSERT INTO stock_movements (item_id, movement_type, quantity, reference_type, reference_id, balance_after, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [item.item_id, 'sale', -piecesToDeduct, 'sale', saleId, updatedItem?.current_stock || 0, `Sale Edit ${existing.invoice_number}`]);
      }

      if (client_id && balance_due > 0) {
        run("UPDATE clients SET current_balance = current_balance + ?, updated_at = datetime('now') WHERE id = ?", [balance_due, client_id]);
      }

      const sale = queryOne('SELECT * FROM sales WHERE id = ?', [saleId]);
      sale.items = query('SELECT * FROM sale_items WHERE sale_id = ?', [saleId]);
      res.json(sale);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // ── DELETE SALE ──────────────────────────────
  app.delete('/api/sales/:id', auth, (req, res) => {
    try {
      const saleId = Number(req.params.id);
      const existing = queryOne('SELECT * FROM sales WHERE id = ?', [saleId]);
      if (!existing) return res.status(404).json({ error: 'Invoice not found' });
      if (existing.status === 'cancelled') return res.status(400).json({ error: 'Invoice is already cancelled' });

      // Restore stock for all line items
      const oldItems = query('SELECT * FROM sale_items WHERE sale_id = ?', [saleId]);
      for (const oi of oldItems) {
        const itemDb = queryOne("SELECT i.bulk_conversion FROM items i WHERE i.id = ?", [oi.item_id]);
        const isBulk = oi.selected_unit === 'bulk';
        const conversion = isBulk ? (itemDb?.bulk_conversion || 1) : 1;
        const piecesToRestore = oi.quantity * conversion;

        run("UPDATE items SET current_stock = current_stock + ?, updated_at = datetime('now') WHERE id = ?", [piecesToRestore, oi.item_id]);
        const updatedItem = queryOne('SELECT current_stock FROM items WHERE id = ?', [oi.item_id]);
        run('INSERT INTO stock_movements (item_id, movement_type, quantity, reference_type, reference_id, balance_after, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [oi.item_id, 'sales_return', piecesToRestore, 'sale_cancel', saleId, updatedItem?.current_stock || 0, `Sale Cancelled: ${existing.invoice_number}`]);
      }

      // Reverse client balance if credit sale
      if (existing.client_id && existing.balance_due > 0) {
        run("UPDATE clients SET current_balance = current_balance - ?, updated_at = datetime('now') WHERE id = ?", [existing.balance_due, existing.client_id]);
      }

      // Mark cancelled (preserve data for audit trail)
      run("UPDATE sales SET status = 'cancelled' WHERE id = ?", [saleId]);
      res.json({ success: true, message: `Invoice ${existing.invoice_number} cancelled` });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // ════════════════════════════════════════════
  //  PURCHASES
  // ════════════════════════════════════════════
  function generatePurchaseRef() {
    const now = new Date();
    const fy = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
    const fyStr = `${String(fy).slice(-2)}-${String(fy + 1).slice(-2)}`;
    const last = queryOne(`SELECT our_ref_number FROM purchases WHERE our_ref_number LIKE 'PUR/${fyStr}/%' ORDER BY id DESC LIMIT 1`);
    let nextNum = 1;
    if (last) {
      const parts = last.our_ref_number.split('/');
      nextNum = parseInt(parts[2], 10) + 1;
    }
    return `PUR/${fyStr}/${String(nextNum).padStart(4, '0')}`;
  }

  app.get('/api/purchases', auth, (req, res) => {
    try {
      const { search, date_from, date_to, page = 1, limit = 25 } = req.query;
      let sql = 'SELECT * FROM purchases WHERE 1=1';
      const params = [];

      if (search) { sql += ' AND (our_ref_number LIKE ? OR supplier_name LIKE ? OR bill_number LIKE ?)'; params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
      if (date_from) { sql += ' AND ref_date >= ?'; params.push(date_from); }
      if (date_to) { sql += ' AND ref_date <= ?'; params.push(date_to); }

      const total = queryOne(sql.replace('SELECT *', 'SELECT COUNT(*) as total'), params)?.total || 0;
      const offset = (Number(page) - 1) * Number(limit);
      sql += ` ORDER BY created_at DESC LIMIT ${Number(limit)} OFFSET ${offset}`;

      res.json({ purchases: query(sql, params), total, page: Number(page), totalPages: Math.ceil(total / Number(limit)) });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  app.get('/api/purchases/:id', auth, (req, res) => {
    try {
      const purchase = queryOne('SELECT * FROM purchases WHERE id = ?', [Number(req.params.id)]);
      if (!purchase) return res.status(404).json({ error: 'Purchase not found' });
      purchase.items = query('SELECT * FROM purchase_items WHERE purchase_id = ?', [purchase.id]);
      res.json(purchase);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  app.put('/api/purchases/:id', auth, (req, res) => {
    try {
      const purchaseId = Number(req.params.id);
      const existing = queryOne('SELECT * FROM purchases WHERE id = ?', [purchaseId]);
      if (!existing) return res.status(404).json({ error: 'Purchase not found' });

      const { bill_number, bill_date, dc_number, dc_date, client_id, payment_mode, is_inter_state, notes, items } = req.body;
      if (!items || !items.length) return res.status(400).json({ error: 'At least one item is required' });

      // Restore old stock
      const oldItems = query('SELECT * FROM purchase_items WHERE purchase_id = ?', [purchaseId]);
      for (const oi of oldItems) {
        const itemDb = queryOne("SELECT i.bulk_conversion FROM items i WHERE i.id = ?", [oi.item_id]);
        const isBulk = oi.selected_unit === 'bulk';
        const conversion = isBulk ? (itemDb?.bulk_conversion || 1) : 1;
        const piecesToRevert = oi.quantity * conversion;
        run("UPDATE items SET current_stock = current_stock - ?, updated_at = datetime('now') WHERE id = ?", [piecesToRevert, oi.item_id]);
      }

      // Reverse supplier balance if credit
      if (existing.client_id && existing.balance_due > 0) {
        run("UPDATE clients SET current_balance = current_balance + ?, updated_at = datetime('now') WHERE id = ?", [existing.balance_due, existing.client_id]);
      }

      run('DELETE FROM purchase_items WHERE purchase_id = ?', [purchaseId]);
      run("DELETE FROM stock_movements WHERE reference_type = 'purchase' AND reference_id = ?", [purchaseId]);

      const supplier = client_id ? queryOne('SELECT name, gstin FROM clients WHERE id = ?', [client_id]) : null;
      const interState = is_inter_state ? 1 : 0;

      let subtotal = 0, cgst_total = 0, sgst_total = 0, igst_total = 0, discount_total = 0;
      const processedItems = items.map(item => {
        const qty = Number(item.quantity) || 1;
        const rate = Number(item.unit_price) || 0;
        const discPct = Number(item.discount_percent) || 0;
        const gstRate = Number(item.gst_rate) || 0;
        const gross = qty * rate;
        const discAmt = gross * discPct / 100;
        const taxable = gross - discAmt;
        let cgst = 0, sgst = 0, igst = 0;
        if (interState) { igst = taxable * gstRate / 100; }
        else { cgst = taxable * gstRate / 200; sgst = taxable * gstRate / 200; }
        const total = taxable + cgst + sgst + igst;
        subtotal += taxable; cgst_total += cgst; sgst_total += sgst; igst_total += igst; discount_total += discAmt;
        return { ...item, quantity: qty, unit_price: rate, discount_percent: discPct, discount_amount: Math.round(discAmt*100)/100, taxable_amount: Math.round(taxable*100)/100, gst_rate: gstRate, cgst_amount: Math.round(cgst*100)/100, sgst_amount: Math.round(sgst*100)/100, igst_amount: Math.round(igst*100)/100, total_amount: Math.round(total*100)/100 };
      });

      const tax_total = cgst_total + sgst_total + igst_total;
      const grand_total = Math.round(subtotal + tax_total);
      const round_off = grand_total - (subtotal + tax_total);
      const amount_paid = payment_mode === 'cash' ? grand_total : 0;
      const balance_due = grand_total - amount_paid;

      run('UPDATE purchases SET bill_number=?, bill_date=?, dc_number=?, dc_date=?, client_id=?, supplier_name=?, supplier_gstin=?, payment_mode=?, subtotal=?, discount_amount=?, cgst_total=?, sgst_total=?, igst_total=?, tax_total=?, round_off=?, grand_total=?, amount_paid=?, balance_due=?, notes=?, is_inter_state=? WHERE id=?',
        [bill_number || existing.bill_number, bill_date || existing.bill_date, dc_number || existing.dc_number, dc_date || existing.dc_date, client_id || null, supplier?.name || existing.supplier_name, supplier?.gstin || existing.supplier_gstin, payment_mode || 'credit', Math.round(subtotal*100)/100, Math.round(discount_total*100)/100, Math.round(cgst_total*100)/100, Math.round(sgst_total*100)/100, Math.round(igst_total*100)/100, Math.round(tax_total*100)/100, Math.round(round_off*100)/100, grand_total, amount_paid, balance_due, notes || '', interState, purchaseId]);

      for (const item of processedItems) {
        const dbItem = queryOne('SELECT i.name, i.hsn_code, i.bulk_conversion, COALESCE(u.short_name, \'Pcs\') as unit_name, COALESCE(bu.short_name, \'Box\') as bulk_unit_name FROM items i LEFT JOIN units u ON i.unit_id = u.id LEFT JOIN units bu ON i.bulk_unit_id = bu.id WHERE i.id = ?', [item.item_id]);
        const finalUnitName = item.unit_name || dbItem?.unit_name || 'Pcs';
        const isBulk = item.selected_unit === 'bulk';
        const conversion = isBulk ? (dbItem?.bulk_conversion || 1) : 1;
        const piecesToAdd = item.quantity * conversion;

        run('INSERT INTO purchase_items (purchase_id, item_id, item_name, hsn_code, quantity, unit_name, unit_price, discount_percent, discount_amount, taxable_amount, gst_rate, cgst_amount, sgst_amount, igst_amount, total_amount, selected_unit) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
          [purchaseId, item.item_id, dbItem?.name || '', dbItem?.hsn_code || '', item.quantity, finalUnitName, item.unit_price, item.discount_percent, item.discount_amount, item.taxable_amount, item.gst_rate, item.cgst_amount, item.sgst_amount, item.igst_amount, item.total_amount, item.selected_unit || 'pcs']);
        run("UPDATE items SET current_stock = current_stock + ?, purchase_price = ?, gst_rate = ?, updated_at = datetime('now') WHERE id = ?", [piecesToAdd, item.unit_price, item.gst_rate, item.item_id]);
        const updatedItem = queryOne('SELECT current_stock FROM items WHERE id = ?', [item.item_id]);
        run('INSERT INTO stock_movements (item_id, movement_type, quantity, reference_type, reference_id, balance_after, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [item.item_id, 'purchase', piecesToAdd, 'purchase', purchaseId, updatedItem?.current_stock || 0, `Purchase Edit ${existing.our_ref_number}`]);
      }

      if (client_id && balance_due > 0) {
        run("UPDATE clients SET current_balance = current_balance - ?, updated_at = datetime('now') WHERE id = ?", [balance_due, client_id]);
      }

      const purchase = queryOne('SELECT * FROM purchases WHERE id = ?', [purchaseId]);
      purchase.items = query('SELECT * FROM purchase_items WHERE purchase_id = ?', [purchaseId]);
      res.json(purchase);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  app.post('/api/purchases', auth, (req, res) => {
    try {
      const { bill_number, bill_date, dc_number, dc_date, client_id, payment_mode, is_inter_state, notes, items } = req.body;
      if (!items || !items.length) return res.status(400).json({ error: 'At least one item is required' });

      const ref_number = generatePurchaseRef();
      const ref_date = bill_date || new Date().toISOString().split('T')[0];
      const supplier = client_id ? queryOne('SELECT name, gstin FROM clients WHERE id = ?', [client_id]) : null;
      const interState = is_inter_state ? 1 : 0;

      let subtotal = 0, cgst_total = 0, sgst_total = 0, igst_total = 0, discount_total = 0;

      const processedItems = items.map(item => {
        const qty = Number(item.quantity) || 1;
        const rate = Number(item.unit_price) || 0;
        const discPct = Number(item.discount_percent) || 0;
        const gstRate = Number(item.gst_rate) || 0;
        const gross = qty * rate;
        const discAmt = gross * discPct / 100;
        const taxable = gross - discAmt;
        let cgst = 0, sgst = 0, igst = 0;
        if (interState) { igst = taxable * gstRate / 100; }
        else { cgst = taxable * gstRate / 200; sgst = taxable * gstRate / 200; }
        const total = taxable + cgst + sgst + igst;
        subtotal += taxable; cgst_total += cgst; sgst_total += sgst; igst_total += igst; discount_total += discAmt;
        return { ...item, quantity: qty, unit_price: rate, discount_percent: discPct, discount_amount: Math.round(discAmt*100)/100, taxable_amount: Math.round(taxable*100)/100, gst_rate: gstRate, cgst_amount: Math.round(cgst*100)/100, sgst_amount: Math.round(sgst*100)/100, igst_amount: Math.round(igst*100)/100, total_amount: Math.round(total*100)/100 };
      });

      const tax_total = cgst_total + sgst_total + igst_total;
      const grand_total = Math.round(subtotal + tax_total);
      const round_off = grand_total - (subtotal + tax_total);
      const amount_paid = payment_mode === 'cash' ? grand_total : 0;
      const balance_due = grand_total - amount_paid;

      run('INSERT INTO purchases (bill_number, bill_date, dc_number, dc_date, our_ref_number, ref_date, client_id, supplier_name, supplier_gstin, payment_mode, subtotal, discount_amount, cgst_total, sgst_total, igst_total, tax_total, round_off, grand_total, amount_paid, balance_due, notes, is_inter_state, status, created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
        [bill_number || '', bill_date || '', dc_number || '', dc_date || '', ref_number, ref_date, client_id || null, supplier?.name || '', supplier?.gstin || '', payment_mode || 'credit', Math.round(subtotal*100)/100, Math.round(discount_total*100)/100, Math.round(cgst_total*100)/100, Math.round(sgst_total*100)/100, Math.round(igst_total*100)/100, Math.round(tax_total*100)/100, Math.round(round_off*100)/100, grand_total, amount_paid, balance_due, notes || '', interState, 'completed', req.user?.userId || null]);

      const purchaseId = getLastId();

      for (const item of processedItems) {
        const dbItem = queryOne('SELECT i.name, i.hsn_code, i.bulk_conversion, COALESCE(u.short_name, \'Pcs\') as unit_name, COALESCE(bu.short_name, \'Box\') as bulk_unit_name FROM items i LEFT JOIN units u ON i.unit_id = u.id LEFT JOIN units bu ON i.bulk_unit_id = bu.id WHERE i.id = ?', [item.item_id]);
        const finalUnitName = item.unit_name || dbItem?.unit_name || 'Pcs';
        const isBulk = item.selected_unit === 'bulk';
        const conversion = isBulk ? (dbItem?.bulk_conversion || 1) : 1;
        const piecesToAdd = item.quantity * conversion;

        run('INSERT INTO purchase_items (purchase_id, item_id, item_name, hsn_code, quantity, unit_name, unit_price, discount_percent, discount_amount, taxable_amount, gst_rate, cgst_amount, sgst_amount, igst_amount, total_amount, selected_unit) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
          [purchaseId, item.item_id, dbItem?.name || '', dbItem?.hsn_code || '', item.quantity, finalUnitName, item.unit_price, item.discount_percent, item.discount_amount, item.taxable_amount, item.gst_rate, item.cgst_amount, item.sgst_amount, item.igst_amount, item.total_amount, item.selected_unit || 'pcs']);

        // Add stock and auto-update purchase price / GST rate in item master
        run("UPDATE items SET current_stock = current_stock + ?, purchase_price = ?, gst_rate = ?, updated_at = datetime('now') WHERE id = ?", [piecesToAdd, item.unit_price, item.gst_rate, item.item_id]);
        const updatedItem = queryOne('SELECT current_stock FROM items WHERE id = ?', [item.item_id]);
        run('INSERT INTO stock_movements (item_id, movement_type, quantity, reference_type, reference_id, balance_after, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [item.item_id, 'purchase', piecesToAdd, 'purchase', purchaseId, updatedItem?.current_stock || 0, `Purchase ${ref_number}`]);
      }

      // Update supplier balance
      if (client_id && balance_due > 0) {
        run("UPDATE clients SET current_balance = current_balance - ?, updated_at = datetime('now') WHERE id = ?", [balance_due, client_id]);
      }

      const purchase = queryOne('SELECT * FROM purchases WHERE id = ?', [purchaseId]);
      purchase.items = query('SELECT * FROM purchase_items WHERE purchase_id = ?', [purchaseId]);
      res.status(201).json(purchase);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ════════════════════════════════════════════
  //  REPORTS (basic)
  // ════════════════════════════════════════════
  app.get('/api/reports/sales-register', auth, (req, res) => {
    try {
      const { date_from, date_to } = req.query;
      // Include completed AND cancelled — frontend shows cancelled as greyed out
      let sql = "SELECT * FROM sales WHERE status IN ('completed', 'cancelled')";
      const params = [];
      if (date_from) { sql += ' AND invoice_date >= ?'; params.push(date_from); }
      if (date_to) { sql += ' AND invoice_date <= ?'; params.push(date_to); }
      sql += ' ORDER BY invoice_date DESC, id DESC';
      const sales = query(sql, params);
      // Totals only count completed invoices (not cancelled)
      const totals = { subtotal: 0, cgst: 0, sgst: 0, igst: 0, grand_total: 0 };
      sales.filter(s => s.status === 'completed').forEach(s => {
        totals.subtotal += s.subtotal;
        totals.cgst += s.cgst_total;
        totals.sgst += s.sgst_total;
        totals.igst += s.igst_total;
        totals.grand_total += s.grand_total;
      });
      res.json({ sales, totals });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  app.get('/api/reports/purchase-register', auth, (req, res) => {
    try {
      const { date_from, date_to } = req.query;
      // purchases table: ref_date is the main date, bill_date is the supplier's bill date
      // Filter by ref_date (our reference date) for accurate date-range queries
      let sql = 'SELECT * FROM purchases WHERE 1=1';
      const params = [];
      if (date_from) { sql += ' AND ref_date >= ?'; params.push(date_from); }
      if (date_to) { sql += ' AND ref_date <= ?'; params.push(date_to); }
      sql += ' ORDER BY ref_date DESC, id DESC';
      const purchases = query(sql, params);
      const totals = { subtotal: 0, cgst: 0, sgst: 0, igst: 0, grand_total: 0, count: purchases.length };
      purchases.forEach(p => {
        totals.subtotal += p.subtotal || 0;
        totals.cgst += p.cgst_total || 0;
        totals.sgst += p.sgst_total || 0;
        totals.igst += p.igst_total || 0;
        totals.grand_total += p.grand_total || 0;
      });
      res.json({ purchases, totals });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  app.get('/api/reports/daily-item-sales', auth, (req, res) => {
    try {
      const { date, from_invoice, to_invoice } = req.query;
      let sql = `
        SELECT 
          si.item_id,
          si.item_name,
          i.code as item_code,
          i.selling_price,
          SUM(CASE WHEN si.selected_unit = 'bulk' THEN si.quantity ELSE 0 END) as total_bulk_qty,
          SUM(CASE WHEN si.selected_unit = 'pcs' OR si.selected_unit IS NULL THEN si.quantity ELSE 0 END) as total_pcs_qty,
          MAX(CASE WHEN si.selected_unit = 'bulk' THEN si.unit_name ELSE NULL END) as bulk_unit_label,
          MAX(CASE WHEN si.selected_unit = 'pcs' OR si.selected_unit IS NULL THEN si.unit_name ELSE NULL END) as pcs_unit_label,
          SUM(si.total_amount) as total_revenue
        FROM sale_items si
        JOIN sales s ON si.sale_id = s.id
        LEFT JOIN items i ON si.item_id = i.id
        WHERE s.status = 'completed'
      `;
      const params = [];
      if (from_invoice && to_invoice) {
        sql += ` AND s.invoice_number >= ? AND s.invoice_number <= ?`;
        params.push(from_invoice.trim(), to_invoice.trim());
      } else {
        const targetDate = date || new Date().toISOString().split('T')[0];
        sql += ` AND s.invoice_date = ?`;
        params.push(targetDate);
      }
      sql += `
        GROUP BY si.item_id, si.item_name, i.code, i.selling_price
        ORDER BY total_revenue DESC
      `;
      const items = query(sql, params);
      res.json({ items });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  app.get('/api/reports/trading-report', auth, (req, res) => {
    try {
      const { report_type, date_from, date_to, client_id, area, zone, item_id, from_invoice, to_invoice } = req.query;
      const df = date_from || '';
      const dt = date_to || '';

      const applySalesFilters = (sqlBase, paramsArray) => {
        let sql = sqlBase;
        if (from_invoice && to_invoice) {
          sql += ' AND s.invoice_number >= ? AND s.invoice_number <= ?';
          paramsArray.push(from_invoice.trim(), to_invoice.trim());
        } else {
          if (df) { sql += ' AND s.invoice_date >= ?'; paramsArray.push(df); }
          if (dt) { sql += ' AND s.invoice_date <= ?'; paramsArray.push(dt); }
        }
        return sql;
      };

      if (report_type === 'sales_all' || report_type === 'sales_cash' || report_type === 'sales_credit') {
        let sql = `
          SELECT s.*, c.area, c.zone 
          FROM sales s
          LEFT JOIN clients c ON s.client_id = c.id
          WHERE 1=1
        `;
        const params = [];
        sql = applySalesFilters(sql, params);
        if (client_id) { sql += ' AND s.client_id = ?'; params.push(Number(client_id)); }
        if (area) { sql += ' AND c.area = ?'; params.push(area); }
        if (zone) { sql += ' AND c.zone = ?'; params.push(zone); }

        if (report_type === 'sales_cash') {
          sql += " AND s.payment_mode = 'cash'";
        } else if (report_type === 'sales_credit') {
          sql += " AND s.payment_mode = 'credit'";
        }

        sql += ' ORDER BY s.invoice_date DESC, s.id DESC';
        const data = query(sql, params);
        res.json({ report_type, data });

      } else if (report_type === 'purchase_all' || report_type === 'purchase_cash' || report_type === 'purchase_credit') {
        let sql = `
          SELECT p.*, c.area, c.zone
          FROM purchases p
          LEFT JOIN clients c ON p.client_id = c.id
          WHERE 1=1
        `;
        const params = [];
        if (df) { sql += ' AND p.ref_date >= ?'; params.push(df); }
        if (dt) { sql += ' AND p.ref_date <= ?'; params.push(dt); }
        if (client_id) { sql += ' AND p.client_id = ?'; params.push(Number(client_id)); }

        if (report_type === 'purchase_cash') {
          sql += " AND p.payment_mode = 'cash'";
        } else if (report_type === 'purchase_credit') {
          sql += " AND p.payment_mode = 'credit'";
        }

        sql += ' ORDER BY p.ref_date DESC, p.id DESC';
        const data = query(sql, params);
        res.json({ report_type, data });

      } else if (report_type === 'item_sales') {
        let sql = `
          SELECT 
            si.item_id,
            si.item_name,
            i.code as item_code,
            i.selling_price,
            i.bulk_conversion,
            SUM(CASE WHEN si.selected_unit = 'bulk' THEN si.quantity ELSE 0 END) as total_bulk_qty,
            SUM(CASE WHEN si.selected_unit = 'pcs' OR si.selected_unit IS NULL THEN si.quantity ELSE 0 END) as total_pcs_qty,
            MAX(CASE WHEN si.selected_unit = 'bulk' THEN si.unit_name ELSE NULL END) as bulk_unit_label,
            MAX(CASE WHEN si.selected_unit = 'pcs' OR si.selected_unit IS NULL THEN si.unit_name ELSE NULL END) as pcs_unit_label,
            SUM(si.total_amount) as total_revenue
          FROM sale_items si
          JOIN sales s ON si.sale_id = s.id
          LEFT JOIN items i ON si.item_id = i.id
          LEFT JOIN clients c ON s.client_id = c.id
          WHERE s.status = 'completed'
        `;
        const params = [];
        sql = applySalesFilters(sql, params);
        if (client_id) { sql += ' AND s.client_id = ?'; params.push(Number(client_id)); }
        if (area) { sql += ' AND c.area = ?'; params.push(area); }
        if (zone) { sql += ' AND c.zone = ?'; params.push(zone); }
        if (item_id) { sql += ' AND si.item_id = ?'; params.push(Number(item_id)); }

        sql += `
          GROUP BY si.item_id, si.item_name, i.code, i.selling_price, i.bulk_conversion
          ORDER BY total_revenue DESC
        `;
        const data = query(sql, params);
        res.json({ report_type, data });

      } else if (report_type === 'area_sales') {
        let sql = `
          SELECT 
            COALESCE(c.area, 'Walk-in / General') as area_name,
            COUNT(DISTINCT s.id) as total_invoices,
            SUM(s.grand_total) as total_revenue
          FROM sales s
          LEFT JOIN clients c ON s.client_id = c.id
          WHERE s.status = 'completed'
        `;
        const params = [];
        sql = applySalesFilters(sql, params);
        if (zone) { sql += ' AND c.zone = ?'; params.push(zone); }

        sql += `
          GROUP BY c.area
          ORDER BY total_revenue DESC
        `;
        const data = query(sql, params);
        res.json({ report_type, data });

      } else if (report_type === 'zone_sales') {
        let sql = `
          SELECT 
            COALESCE(c.zone, 'No Zone') as zone_name,
            COUNT(DISTINCT s.id) as total_invoices,
            SUM(s.grand_total) as total_revenue
          FROM sales s
          LEFT JOIN clients c ON s.client_id = c.id
          WHERE s.status = 'completed'
        `;
        const params = [];
        sql = applySalesFilters(sql, params);
        if (area) { sql += ' AND c.area = ?'; params.push(area); }

        sql += `
          GROUP BY c.zone
          ORDER BY total_revenue DESC
        `;
        const data = query(sql, params);
        res.json({ report_type, data });

      } else if (report_type === 'stock_position') {
        let sql = `
          SELECT i.*, cat.name as category_name, u.short_name as unit_name
          FROM items i
          LEFT JOIN categories cat ON i.category_id = cat.id
          LEFT JOIN units u ON i.unit_id = u.id
          WHERE i.is_active = 1
        `;
        const params = [];
        if (item_id) { sql += ' AND i.id = ?'; params.push(Number(item_id)); }
        sql += ' ORDER BY i.name';
        const data = query(sql, params);
        res.json({ report_type, data });

      } else if (report_type === 'reorder_items') {
        let sql = `
          SELECT i.*, cat.name as category_name, u.short_name as unit_name
          FROM items i
          LEFT JOIN categories cat ON i.category_id = cat.id
          LEFT JOIN units u ON i.unit_id = u.id
          WHERE i.is_active = 1 AND i.current_stock <= i.min_stock_level
        `;
        const params = [];
        if (item_id) { sql += ' AND i.id = ?'; params.push(Number(item_id)); }
        sql += ' ORDER BY i.name';
        const data = query(sql, params);
        res.json({ report_type, data });
      } else if (report_type === 'sales_turnover') {
        let sql = `
          SELECT 
            s.client_id,
            COALESCE(c.store_name, s.client_name) as client_display_name,
            c.name as contact_name,
            c.area,
            c.zone,
            COUNT(s.id) as total_bills,
            SUM(s.subtotal) as total_subtotal,
            SUM(s.tax_total) as total_tax,
            SUM(s.grand_total) as total_turnover
          FROM sales s
          LEFT JOIN clients c ON s.client_id = c.id
          WHERE s.status = 'completed'
        `;
        const params = [];
        sql = applySalesFilters(sql, params);
        if (client_id) { sql += ' AND s.client_id = ?'; params.push(Number(client_id)); }
        if (area) { sql += ' AND c.area = ?'; params.push(area); }
        if (zone) { sql += ' AND c.zone = ?'; params.push(zone); }

        sql += `
          GROUP BY s.client_id, c.store_name, s.client_name, c.name, c.area, c.zone
          ORDER BY total_turnover DESC
        `;
        const data = query(sql, params);
        res.json({ report_type, data });

      } else if (report_type === 'purchase_turnover') {
        let sql = `
          SELECT 
            p.client_id,
            COALESCE(c.store_name, p.supplier_name) as supplier_display_name,
            c.name as contact_name,
            c.area,
            c.zone,
            COUNT(p.id) as total_bills,
            SUM(p.subtotal) as total_subtotal,
            SUM(p.tax_total) as total_tax,
            SUM(p.grand_total) as total_turnover
          FROM purchases p
          LEFT JOIN clients c ON p.client_id = c.id
          WHERE 1=1
        `;
        const params = [];
        if (df) { sql += ' AND p.ref_date >= ?'; params.push(df); }
        if (dt) { sql += ' AND p.ref_date <= ?'; params.push(dt); }
        if (client_id) { sql += ' AND p.client_id = ?'; params.push(Number(client_id)); }
        if (area) { sql += ' AND c.area = ?'; params.push(area); }
        if (zone) { sql += ' AND c.zone = ?'; params.push(zone); }

        sql += `
          GROUP BY p.client_id, c.store_name, p.supplier_name, c.name, c.area, c.zone
          ORDER BY total_turnover DESC
        `;
        const data = query(sql, params);
        res.json({ report_type, data });

      } else if (report_type === 'carriage_loading') {
        let sql = `
          SELECT 
            si.item_id,
            si.item_name,
            i.code as item_code,
            SUM(CASE WHEN si.selected_unit = 'bulk' THEN si.quantity ELSE 0 END) as total_bulk_qty,
            SUM(CASE WHEN si.selected_unit = 'pcs' OR si.selected_unit IS NULL THEN si.quantity ELSE 0 END) as total_pcs_qty,
            MAX(CASE WHEN si.selected_unit = 'bulk' THEN si.unit_name ELSE NULL END) as bulk_unit_label,
            MAX(CASE WHEN si.selected_unit = 'pcs' OR si.selected_unit IS NULL THEN si.unit_name ELSE NULL END) as pcs_unit_label,
            GROUP_CONCAT(DISTINCT COALESCE(c.store_name, s.client_name) || ' (' || COALESCE(c.area, 'Walk-in') || ')') as destinations
          FROM sale_items si
          JOIN sales s ON si.sale_id = s.id
          LEFT JOIN items i ON si.item_id = i.id
          LEFT JOIN clients c ON s.client_id = c.id
          WHERE s.status = 'completed'
        `;
        const params = [];
        sql = applySalesFilters(sql, params);
        if (client_id) { sql += ' AND s.client_id = ?'; params.push(Number(client_id)); }
        if (area) { sql += ' AND c.area = ?'; params.push(area); }
        if (zone) { sql += ' AND c.zone = ?'; params.push(zone); }
        if (item_id) { sql += ' AND si.item_id = ?'; params.push(Number(item_id)); }

        sql += `
          GROUP BY si.item_id, si.item_name, i.code
          ORDER BY si.item_name ASC
        `;
        const data = query(sql, params);
        res.json({ report_type, data });

      } else if (report_type === 'customer_collections') {
        let sql = `
          SELECT col.*, c.name as client_name, c.store_name as client_store_name, c.code as client_code, c.area, c.zone
          FROM collections col
          LEFT JOIN clients c ON col.client_id = c.id
          WHERE 1=1
        `;
        const params = [];
        if (df) { sql += ' AND col.payment_date >= ?'; params.push(df); }
        if (dt) { sql += ' AND col.payment_date <= ?'; params.push(dt); }
        if (client_id) { sql += ' AND col.client_id = ?'; params.push(Number(client_id)); }
        if (area) { sql += ' AND c.area = ?'; params.push(area); }
        if (zone) { sql += ' AND c.zone = ?'; params.push(zone); }

        sql += ' ORDER BY col.payment_date DESC, col.id DESC';
        const data = query(sql, params);
        res.json({ report_type, data });

      } else {
        res.json({ report_type, data: [] });
      }
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  app.get('/api/reports/trading-parameters', auth, (req, res) => {
    try {
      const clients = query("SELECT id, name, store_name, type FROM clients WHERE is_active = 1 ORDER BY name");
      const items = query("SELECT id, name, code FROM items WHERE is_active = 1 ORDER BY name");
      const areas = query("SELECT DISTINCT area FROM clients WHERE area IS NOT NULL AND area != '' AND is_active = 1 ORDER BY area");
      const zones = query("SELECT DISTINCT zone FROM clients WHERE zone IS NOT NULL AND zone != '' AND is_active = 1 ORDER BY zone");
      res.json({ clients, items, areas: areas.map(a => a.area), zones: zones.map(z => z.zone) });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  app.get('/api/reports/stock-report', auth, (req, res) => {
    try {
      const items = query('SELECT i.*, c.name as category_name, u.short_name as unit_name FROM items i LEFT JOIN categories c ON i.category_id = c.id LEFT JOIN units u ON i.unit_id = u.id WHERE i.is_active = 1 ORDER BY i.name');
      const totalValue = items.reduce((sum, i) => sum + (i.current_stock * i.purchase_price), 0);
      res.json({ items, totalValue });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  app.get('/api/reports/gst-summary', auth, (req, res) => {
    try {
      const { date_from, date_to } = req.query;

      // 1. Sales GST (Outward Supplies)
      let salesSql = `
        SELECT 
          si.gst_rate,
          SUM(si.taxable_amount) as taxable_amount,
          SUM(si.cgst_amount) as cgst_amount,
          SUM(si.sgst_amount) as sgst_amount,
          SUM(si.igst_amount) as igst_amount,
          SUM(si.total_amount) as total_amount
        FROM sale_items si
        INNER JOIN sales s ON si.sale_id = s.id
        WHERE s.status = 'completed'
      `;
      const salesParams = [];
      if (date_from) {
        salesSql += ' AND s.invoice_date >= ?';
        salesParams.push(date_from);
      }
      if (date_to) {
        salesSql += ' AND s.invoice_date <= ?';
        salesParams.push(date_to);
      }
      salesSql += ' GROUP BY si.gst_rate ORDER BY si.gst_rate';
      const salesGST = query(salesSql, salesParams);

      // Calculate Sales Totals
      const salesTotals = { taxable_amount: 0, cgst_amount: 0, sgst_amount: 0, igst_amount: 0, total_amount: 0 };
      salesGST.forEach(row => {
        salesTotals.taxable_amount += row.taxable_amount || 0;
        salesTotals.cgst_amount += row.cgst_amount || 0;
        salesTotals.sgst_amount += row.sgst_amount || 0;
        salesTotals.igst_amount += row.igst_amount || 0;
        salesTotals.total_amount += row.total_amount || 0;
      });

      // 2. Purchases GST (Inward Supplies / ITC)
      let purchaseSql = `
        SELECT 
          pi.gst_rate,
          SUM(pi.taxable_amount) as taxable_amount,
          SUM(pi.cgst_amount) as cgst_amount,
          SUM(pi.sgst_amount) as sgst_amount,
          SUM(pi.igst_amount) as igst_amount,
          SUM(pi.total_amount) as total_amount
        FROM purchase_items pi
        INNER JOIN purchases p ON pi.purchase_id = p.id
        WHERE p.status = 'completed'
      `;
      const purchaseParams = [];
      if (date_from) {
        purchaseSql += ' AND p.ref_date >= ?';
        purchaseParams.push(date_from);
      }
      if (date_to) {
        purchaseSql += ' AND p.ref_date <= ?';
        purchaseParams.push(date_to);
      }
      purchaseSql += ' GROUP BY pi.gst_rate ORDER BY pi.gst_rate';
      const purchasesGST = query(purchaseSql, purchaseParams);

      // Calculate Purchases Totals
      const purchasesTotals = { taxable_amount: 0, cgst_amount: 0, sgst_amount: 0, igst_amount: 0, total_amount: 0 };
      purchasesGST.forEach(row => {
        purchasesTotals.taxable_amount += row.taxable_amount || 0;
        purchasesTotals.cgst_amount += row.cgst_amount || 0;
        purchasesTotals.sgst_amount += row.sgst_amount || 0;
        purchasesTotals.igst_amount += row.igst_amount || 0;
        purchasesTotals.total_amount += row.total_amount || 0;
      });

      // 3. Net GST Calculation
      const netGSTPayable = {
        cgst: salesTotals.cgst_amount - purchasesTotals.cgst_amount,
        sgst: salesTotals.sgst_amount - purchasesTotals.sgst_amount,
        igst: salesTotals.igst_amount - purchasesTotals.igst_amount,
        total: (salesTotals.cgst_amount + salesTotals.sgst_amount + salesTotals.igst_amount) - 
               (purchasesTotals.cgst_amount + purchasesTotals.sgst_amount + purchasesTotals.igst_amount)
      };

      res.json({
        salesGST,
        salesTotals,
        purchasesGST,
        purchasesTotals,
        netGSTPayable
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ════════════════════════════════════════════
  //  CSV IMPORT (Batch create invoices)
  // ════════════════════════════════════════════
  app.post('/api/sales/import', auth, (req, res) => {
    try {
      const { invoices } = req.body;
      if (!invoices || !Array.isArray(invoices) || !invoices.length) {
        return res.status(400).json({ error: 'No invoices provided' });
      }

      const created = [];
      const errors = [];

      for (let g = 0; g < invoices.length; g++) {
        const inv = invoices[g];
        try {
          // ─── Resolve or auto-create client ───
          let clientId = null;
          let client = null;
          if (inv.client_name && inv.client_name.trim()) {
            const name = inv.client_name.trim();
            client = queryOne("SELECT * FROM clients WHERE LOWER(name) = LOWER(?) AND is_active = 1", [name]);
            if (!client) {
              // Auto-create customer
              const autoCode = 'CUS' + String(Date.now()).slice(-6);
              run('INSERT INTO clients (code, name, type, address_line1, city, state, phone, gstin, state_code) VALUES (?,?,?,?,?,?,?,?,?)',
                [autoCode, name, 'customer', inv.client_address || '', inv.client_city || '', inv.client_state || '', inv.client_phone || '', inv.client_gstin || '', inv.client_state_code || '']);
              clientId = getLastId();
              client = queryOne('SELECT * FROM clients WHERE id = ?', [clientId]);
            } else {
              clientId = client.id;
            }
          }

          // ─── Resolve or auto-create items ───
          const items = inv.items || [];
          if (!items.length) { errors.push({ index: g, error: 'No items in invoice group' }); continue; }

          const interState = inv.is_inter_state ? 1 : 0;
          let subtotal = 0, cgst_total = 0, sgst_total = 0, igst_total = 0, discount_total = 0;

          const processedItems = [];
          for (const item of items) {
            // Find item by name
            let dbItem = queryOne("SELECT i.*, COALESCE(u.short_name, 'Pcs') as unit_name FROM items i LEFT JOIN units u ON i.unit_id = u.id WHERE LOWER(i.name) = LOWER(?) AND i.is_active = 1", [item.item_name?.trim()]);
            if (!dbItem && item.item_name?.trim()) {
              // Auto-create item
              const autoCode = 'ITM' + String(Date.now()).slice(-6) + Math.floor(Math.random() * 100);
              const gstRate = Number(item.gst_rate) || 18;
              const sellingPrice = Number(item.unit_price) || 0;
              const mrp = Number(item.mrp) || sellingPrice;
              run('INSERT INTO items (code, name, selling_price, purchase_price, mrp, gst_rate, hsn_code, current_stock, opening_stock, min_stock_level) VALUES (?,?,?,?,?,?,?,?,?,?)',
                [autoCode, item.item_name.trim(), sellingPrice, sellingPrice, mrp, gstRate, item.hsn_code || '', 9999, 9999, 5]);
              dbItem = queryOne("SELECT i.*, COALESCE(u.short_name, 'Pcs') as unit_name FROM items i LEFT JOIN units u ON i.unit_id = u.id WHERE i.id = ?", [getLastId()]);
            }
            if (!dbItem) { errors.push({ index: g, error: `Item not found and could not be created: ${item.item_name}` }); continue; }

            const qty = Number(item.quantity) || 1;
            const rate = Number(item.unit_price) || Number(dbItem.selling_price) || 0;
            const discPct = Number(item.discount_percent) || 0;
            const gstRate = Number(item.gst_rate) || Number(dbItem.gst_rate) || 18;
            const gross = qty * rate;
            const discAmt = gross * discPct / 100;
            const taxable = gross - discAmt;

            let cgst = 0, sgst = 0, igst = 0;
            if (interState) { igst = taxable * gstRate / 100; }
            else { cgst = taxable * gstRate / 200; sgst = taxable * gstRate / 200; }

            const total = taxable + cgst + sgst + igst;
            subtotal += taxable; cgst_total += cgst; sgst_total += sgst; igst_total += igst; discount_total += discAmt;

            processedItems.push({
              item_id: dbItem.id,
              item_name: dbItem.name,
              hsn_code: dbItem.hsn_code || item.hsn_code || '',
              mrp: Number(item.mrp) || dbItem.mrp || 0,
              unit_name: item.unit_name || dbItem.unit_name || 'Pcs',
              quantity: qty,
              unit_price: rate,
              discount_percent: discPct,
              discount_amount: Math.round(discAmt * 100) / 100,
              taxable_amount: Math.round(taxable * 100) / 100,
              gst_rate: gstRate,
              cgst_amount: Math.round(cgst * 100) / 100,
              sgst_amount: Math.round(sgst * 100) / 100,
              igst_amount: Math.round(igst * 100) / 100,
              total_amount: Math.round(total * 100) / 100,
            });
          }

          if (!processedItems.length) { errors.push({ index: g, error: 'No valid items after resolution' }); continue; }

          // ─── Create sale record ───
          const invoice_number = generateInvoiceNumber();
          const invoice_date = inv.invoice_date || new Date().toISOString().split('T')[0];
          const payment_mode = inv.payment_mode || 'cash';
          const tax_total = cgst_total + sgst_total + igst_total;
          const rawGrand = subtotal + tax_total;
          const grand_total = Math.ceil(rawGrand);
          const round_off = grand_total - rawGrand;
          const amount_paid = payment_mode === 'cash' ? grand_total : 0;
          const balance_due = grand_total - amount_paid;

          run(`INSERT INTO sales (invoice_number, invoice_date, client_id, client_name, client_gstin, client_address_line1, client_city, client_state, client_pincode, client_phone, client_state_code, payment_mode, subtotal, discount_amount, discount_percent, cgst_total, sgst_total, igst_total, tax_total, round_off, grand_total, amount_paid, balance_due, notes, is_gst_bill, is_inter_state, status, created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,?,?,?)`,
            [invoice_number, invoice_date, clientId, client?.name || 'Walk-in Customer', client?.gstin || inv.client_gstin || '', client?.address_line1 || inv.client_address || '', client?.city || inv.client_city || '', client?.state || inv.client_state || '', client?.pincode || '', client?.phone || inv.client_phone || '', client?.state_code || inv.client_state_code || '', payment_mode, Math.round(subtotal*100)/100, Math.round(discount_total*100)/100, 0, Math.round(cgst_total*100)/100, Math.round(sgst_total*100)/100, Math.round(igst_total*100)/100, Math.round(tax_total*100)/100, Math.round(round_off*100)/100, grand_total, amount_paid, balance_due, inv.notes || 'CSV Import', interState, 'completed', req.user?.userId || null]);

          const saleId = getLastId();

          // ─── Insert sale items & deduct stock ───
          for (const pi of processedItems) {
            run('INSERT INTO sale_items (sale_id, item_id, item_name, hsn_code, mrp, unit_name, quantity, unit_price, discount_percent, discount_amount, taxable_amount, gst_rate, cgst_amount, sgst_amount, igst_amount, total_amount, is_free) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
              [saleId, pi.item_id, pi.item_name, pi.hsn_code, pi.mrp, pi.unit_name, pi.quantity, pi.unit_price, pi.discount_percent, pi.discount_amount, pi.taxable_amount, pi.gst_rate, pi.cgst_amount, pi.sgst_amount, pi.igst_amount, pi.total_amount, 0]);
            // Deduct stock
            run("UPDATE items SET current_stock = current_stock - ?, updated_at = datetime('now') WHERE id = ?", [pi.quantity, pi.item_id]);
            const updatedItem = queryOne('SELECT current_stock FROM items WHERE id = ?', [pi.item_id]);
            run('INSERT INTO stock_movements (item_id, movement_type, quantity, reference_type, reference_id, balance_after, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
              [pi.item_id, 'sale', -pi.quantity, 'sale', saleId, updatedItem?.current_stock || 0, `Sale ${invoice_number} (CSV Import)`]);
          }

          // Update client balance for credit sales
          if (clientId && balance_due > 0) {
            run("UPDATE clients SET current_balance = current_balance + ?, updated_at = datetime('now') WHERE id = ?", [balance_due, clientId]);
          }

          const sale = queryOne('SELECT * FROM sales WHERE id = ?', [saleId]);
          sale.items = query('SELECT * FROM sale_items WHERE sale_id = ?', [saleId]);
          created.push(sale);
        } catch (innerErr) {
          errors.push({ index: g, error: innerErr.message });
        }
      }

      res.status(201).json({ created, errors, totalCreated: created.length, totalErrors: errors.length });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ════════════════════════════════════════════
  //  STOCK ADJUSTMENT
  // ════════════════════════════════════════════
  app.post('/api/items/:id/adjust-stock', auth, (req, res) => {
    try {
      const { adjustment_qty, notes } = req.body;
      const itemId = Number(req.params.id);
      if (adjustment_qty == null || isNaN(adjustment_qty)) {
        return res.status(400).json({ error: 'Adjustment quantity is required and must be a number' });
      }

      const item = queryOne('SELECT * FROM items WHERE id = ?', [itemId]);
      if (!item) return res.status(404).json({ error: 'Item not found' });

      const newStock = (item.current_stock || 0) + Number(adjustment_qty);
      run("UPDATE items SET current_stock = ?, updated_at = datetime('now') WHERE id = ?", [newStock, itemId]);
      
      run('INSERT INTO stock_movements (item_id, movement_type, quantity, balance_after, notes) VALUES (?, ?, ?, ?, ?)',
        [itemId, 'adjustment', Number(adjustment_qty), newStock, notes || 'Manual stock adjustment']);

      const updatedItem = queryOne('SELECT i.*, c.name as category_name, u.short_name as unit_name, bu.short_name as bulk_unit_name FROM items i LEFT JOIN categories c ON i.category_id = c.id LEFT JOIN units u ON i.unit_id = u.id LEFT JOIN units bu ON i.bulk_unit_id = bu.id WHERE i.id = ?', [itemId]);
      res.json(updatedItem);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ════════════════════════════════════════════
  //  SYSTEM BACKUP & RESTORE
  // ════════════════════════════════════════════
  app.get('/api/system/backup', auth, (req, res) => {
    try {
      if (saveFn) saveFn(); // save db first
      res.download(dbPathStr, 'aruntraders.sqlite');
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/system/restore', auth, (req, res) => {
    try {
      const { fileData } = req.body;
      if (!fileData) return res.status(400).json({ error: 'Database file data is required' });

      const buffer = Buffer.from(fileData, 'base64');
      if (restoreFn) {
        const newDb = restoreFn(buffer);
        db = newDb; // Update server's active db reference
        res.json({ success: true, message: 'Database restored successfully' });
      } else {
        res.status(500).json({ error: 'Database restore functionality is not initialized' });
      }
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ════════════════════════════════════════════
  //  ACCOUNTS & VOUCHERS
  // ════════════════════════════════════════════
  app.get('/api/accounts', auth, (req, res) => {
    try {
      const accounts = query('SELECT * FROM accounts ORDER BY name');
      res.json(accounts);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/vouchers', auth, (req, res) => {
    try {
      const vouchers = query(`
        SELECT v.*, 
               da.name as debit_account_name, 
               ca.name as credit_account_name 
        FROM vouchers v
        LEFT JOIN accounts da ON v.debit_account_id = da.id
        LEFT JOIN accounts ca ON v.credit_account_id = ca.id
        ORDER BY v.voucher_date DESC, v.id DESC
      `);
      res.json(vouchers);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/vouchers', auth, (req, res) => {
    try {
      const { voucher_date, voucher_type, debit_account_id, credit_account_id, amount, narration, cheque_number, cheque_date, bank_name } = req.body;
      if (!voucher_type || !debit_account_id || !credit_account_id || !amount) {
        return res.status(400).json({ error: 'Missing required voucher fields' });
      }

      const voucher_number = 'VCH' + String(Date.now()).slice(-8);

      run(`
        INSERT INTO vouchers (
          voucher_number, voucher_date, voucher_type, debit_account_id, credit_account_id, 
          amount, narration, cheque_number, cheque_date, bank_name
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        voucher_number, voucher_date || new Date().toISOString().split('T')[0], voucher_type, 
        debit_account_id, credit_account_id, amount, narration || '', 
        cheque_number || '', cheque_date || '', bank_name || ''
      ]);

      const id = getLastId();

      // Update account balances
      run('UPDATE accounts SET current_balance = current_balance + ? WHERE id = ?', [amount, debit_account_id]);
      run('UPDATE accounts SET current_balance = current_balance - ? WHERE id = ?', [amount, credit_account_id]);

      const voucher = queryOne('SELECT * FROM vouchers WHERE id = ?', [id]);
      res.status(201).json(voucher);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ════════════════════════════════════════════
  //  CUSTOMER COLLECTIONS / PAYMENTS RECEIVED
  // ════════════════════════════════════════════

  // Get outstanding credit invoices for a specific client
  app.get('/api/clients/:id/invoices', auth, (req, res) => {
    try {
      const clientId = Number(req.params.id);
      const invoices = query(`
        SELECT id, invoice_number, invoice_date, grand_total, amount_paid, balance_due, payment_mode, status
        FROM sales
        WHERE client_id = ? AND payment_mode = 'credit' AND balance_due > 0 AND status != 'cancelled'
        ORDER BY invoice_date ASC, id ASC
      `, [clientId]);
      res.json(invoices);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  app.get('/api/collections', auth, (req, res) => {
    try {
      const { date_from, date_to, client_id } = req.query;
      let sql = `
        SELECT col.*,
               c.name as client_name,
               c.store_name as client_store_name,
               c.code as client_code,
               s.invoice_number as linked_invoice_number
        FROM collections col
        LEFT JOIN clients c ON col.client_id = c.id
        LEFT JOIN sales s ON col.invoice_id = s.id
        WHERE 1=1
      `;
      const params = [];
      if (date_from) { sql += ' AND col.payment_date >= ?'; params.push(date_from); }
      if (date_to)   { sql += ' AND col.payment_date <= ?'; params.push(date_to); }
      if (client_id) { sql += ' AND col.client_id = ?'; params.push(Number(client_id)); }
      sql += ' ORDER BY col.payment_date DESC, col.id DESC';
      res.json(query(sql, params));
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  app.post('/api/collections', auth, (req, res) => {
    try {
      const { client_id, invoice_id, payment_date, amount, payment_mode, reference_number, notes } = req.body;
      if (!client_id || !payment_date || !amount || !payment_mode) {
        return res.status(400).json({ error: 'Missing required fields: client_id, payment_date, amount, payment_mode' });
      }

      // 1. Insert collection (with optional invoice_id link)
      run(`
        INSERT INTO collections (client_id, invoice_id, payment_date, amount, payment_mode, reference_number, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [client_id, invoice_id || null, payment_date, amount, payment_mode, reference_number || '', notes || '']);
      const collectionId = getLastId();

      // 2. Subtract from client balance
      run("UPDATE clients SET current_balance = current_balance - ?, updated_at = datetime('now') WHERE id = ?", [amount, client_id]);

      // 3. If a specific invoice was selected, reduce its balance_due
      if (invoice_id) {
        const inv = queryOne('SELECT balance_due, amount_paid FROM sales WHERE id = ?', [Number(invoice_id)]);
        if (inv) {
          const newBalance = Math.max(0, (inv.balance_due || 0) - Number(amount));
          const newPaid = (inv.amount_paid || 0) + Number(amount);
          run("UPDATE sales SET balance_due = ?, amount_paid = ?, updated_at = datetime('now') WHERE id = ?",
            [newBalance, newPaid, Number(invoice_id)]);
        }
      }

      // 4. Return created payment with joined fields
      const collection = queryOne(`
        SELECT col.*, c.name as client_name, c.store_name as client_store_name, c.code as client_code,
               s.invoice_number as linked_invoice_number
        FROM collections col
        LEFT JOIN clients c ON col.client_id = c.id
        LEFT JOIN sales s ON col.invoice_id = s.id
        WHERE col.id = ?
      `, [collectionId]);
      res.status(201).json(collection);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  app.delete('/api/collections/:id', auth, (req, res) => {
    try {
      const id = Number(req.params.id);
      const payment = queryOne('SELECT * FROM collections WHERE id = ?', [id]);
      if (!payment) return res.status(404).json({ error: 'Collection entry not found' });

      // Revert client balance
      run("UPDATE clients SET current_balance = current_balance + ?, updated_at = datetime('now') WHERE id = ?", [payment.amount, payment.client_id]);

      // If linked to invoice, restore its balance_due
      if (payment.invoice_id) {
        const inv = queryOne('SELECT balance_due, amount_paid FROM sales WHERE id = ?', [payment.invoice_id]);
        if (inv) {
          const restoredBalance = (inv.balance_due || 0) + Number(payment.amount);
          const restoredPaid = Math.max(0, (inv.amount_paid || 0) - Number(payment.amount));
          run("UPDATE sales SET balance_due = ?, amount_paid = ?, updated_at = datetime('now') WHERE id = ?",
            [restoredBalance, restoredPaid, payment.invoice_id]);
        }
      }

      run('DELETE FROM collections WHERE id = ?', [id]);
      res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // Mount WMS Router
  const wmsRouter = require('./wms-server')(db, saveFn, query, queryOne, run, sessions, auth, getLastId);
  app.use('/api', wmsRouter);

  // Serve static assets in production
  app.use(express.static(path.join(__dirname, '../dist')));

  // Client-side routing catch-all
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(__dirname, '../dist/index.html'));
  });

  return app;
}

module.exports = { createServer };

// Standalone server execution for cloud deployments
if (require.main === module) {
  const fs = require('fs');
  const { initDatabase, saveDatabase } = require('./database/schema');
  const { seedDatabase } = require('./database/seed');

  const PORT = process.env.PORT || 3456;
  const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '../data/aruntraders.sqlite');

  console.log(`[Cloud Standalone] Starting server...`);
  console.log(`[Cloud Standalone] Database target path: ${dbPath}`);

  initDatabase(dbPath)
    .then((db) => {
      seedDatabase(db, saveDatabase);

      const { restoreDatabase } = require('./database/schema');
      const app = createServer(db, saveDatabase, dbPath, restoreDatabase);

      // Auto-save database file every 30 seconds
      setInterval(() => {
        try {
          saveDatabase();
        } catch (e) {
          console.error('[Cloud Standalone] Auto-save failed:', e);
        }
      }, 30000);

      app.listen(PORT, '0.0.0.0', () => {
        console.log(`[Cloud Standalone] Web app running at http://0.0.0.0:${PORT}`);
      });
    })
    .catch((err) => {
      console.error('[Cloud Standalone] Database initialization failed:', err);
      process.exit(1);
    });
}
