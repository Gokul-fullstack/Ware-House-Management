// electron/wms-server.js — WMS endpoints ported from Suriya Backend to SQLite
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

module.exports = function(db, saveDatabase, query, queryOne, run, sessions, auth, getLastId) {

  function logAudit(userId, action, details) {
    try {
      run("INSERT INTO audit_logs (user_id, action, module, details, created_at) VALUES (?, ?, 'WMS', ?, datetime('now'))", 
        [userId, action, details]);
    } catch(e) {
      console.error('[WMS-Audit] Failed to log:', e.message);
    }
  }

  function notifyUser(userId, title, message) {
    try {
      run("INSERT INTO notifications (user_id, title, message, read, created_at) VALUES (?, ?, ?, 0, datetime('now'))", 
        [userId, title, message]);
    } catch(e) {
      console.error('[WMS-Notify] Failed to notify:', e.message);
    }
  }

  function notifyAdmin(title, message) {
    try {
      const admins = query("SELECT id FROM users WHERE role = 'admin'");
      admins.forEach(admin => {
        run("INSERT INTO notifications (user_id, title, message, read, created_at) VALUES (?, ?, ?, 0, datetime('now'))", 
          [admin.id, title, message]);
      });
    } catch(e) {
      console.error('[WMS-Notify-Admin] Failed to notify admins:', e.message);
    }
  }

  // Middleware roles
  function requireAdmin(req, res, next) {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
    next();
  }

  function requireClient(req, res, next) {
    if (req.user.role !== 'client') return res.status(403).json({ error: 'Client access required' });
    next();
  }

  // ─── AUTH & USER SIGNUPS ──────────────────────────────────────────────────

  // POST /auth/register
  router.post('/auth/register', (req, res) => {
    try {
      const { email, password, name, store_name, gst_number, store_address } = req.body;
      if (!email || !password || !name || !store_name || !store_address) {
        return res.status(400).json({ error: 'Email, password, name, store name, and address are required' });
      }

      // Check if user exists
      const existing = queryOne("SELECT id FROM users WHERE email = ? OR username = ?", [email, email]);
      if (existing) return res.status(400).json({ error: 'User with this email already exists' });

      const password_hash = bcrypt.hashSync(password, 10);
      
      run("INSERT INTO users (username, password_hash, name, role, email, store_name, gst_number, store_address, approved, is_active, created_at) VALUES (?, ?, ?, 'client', ?, ?, ?, ?, 0, 1, datetime('now'))",
        [email, password_hash, name, email, store_name, gst_number || null, store_address]);

      notifyAdmin('New Client Registration', `Client "${store_name}" (${name}) has registered and is pending approval.`);
      res.status(201).json({ message: 'Registration submitted successfully. Pending admin approval.' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });



  // Apply auth middleware to all subsequent WMS routes
  router.use(auth);

  // GET /auth/me
  router.get('/auth/me', (req, res) => {
    res.json({ user: req.user });
  });

  // ─── USER MANAGEMENT (ADMIN) ──────────────────────────────────────────────

  // GET /users
  router.get('/users', requireAdmin, (req, res) => {
    try {
      const users = query("SELECT id, username, name, email, role, store_name, gst_number, store_address, approved, is_active, created_at FROM users");
      res.json(users);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // PUT /users/:id/approve
  router.put('/users/:id/approve', requireAdmin, (req, res) => {
    try {
      const { id } = req.params;
      const user = queryOne("SELECT * FROM users WHERE id = ?", [id]);
      if (!user) return res.status(404).json({ error: 'User not found' });

      run("UPDATE users SET approved = 1 WHERE id = ?", [id]);
      logAudit(req.user.userId, 'APPROVE_USER', `Approved user ${user.email || user.username}`);
      notifyUser(id, 'Account Approved', 'Your store owner registration has been approved by the administrator.');

      res.json({ message: 'User approved successfully' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // PUT /users/:id/disable
  router.put('/users/:id/disable', requireAdmin, (req, res) => {
    try {
      const { id } = req.params;
      const user = queryOne("SELECT * FROM users WHERE id = ?", [id]);
      if (!user) return res.status(404).json({ error: 'User not found' });

      const newStatus = user.is_active ? 0 : 1;
      run("UPDATE users SET is_active = ? WHERE id = ?", [newStatus, id]);
      logAudit(req.user.userId, 'TOGGLE_USER_STATUS', `Changed status of user ${user.username} to ${newStatus}`);

      res.json({ message: 'User status updated successfully' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // DELETE /users/:id
  router.delete('/users/:id', requireAdmin, (req, res) => {
    try {
      const { id } = req.params;
      const user = queryOne("SELECT username FROM users WHERE id = ?", [id]);
      if (!user) return res.status(404).json({ error: 'User not found' });

      run("DELETE FROM users WHERE id = ?", [id]);
      logAudit(req.user.userId, 'DELETE_USER', `Deleted user ${user.username}`);

      res.json({ message: 'User deleted successfully' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── PRODUCTS & CATALOG ───────────────────────────────────────────────────

  // GET /products
  router.get('/products', (req, res) => {
    try {
      const { search, category } = req.query;
      let sql = "SELECT p.*, p.current_price AS price, p.stock_quantity AS stock, c.name AS category_name FROM products p LEFT JOIN categories c ON c.id = p.category_id WHERE 1=1";
      const params = [];

      if (search) {
        sql += " AND (p.name LIKE ? OR p.description LIKE ?)";
        params.push(`%${search}%`, `%${search}%`);
      }
      if (category) {
        sql += " AND p.category_id = ?";
        params.push(Number(category));
      }
      sql += " ORDER BY p.name ASC";

      const products = query(sql, params);
      res.json(products);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /products/price-history
  router.get('/products/price-history', (req, res) => {
    try {
      const history = query("SELECT ph.*, p.name AS product_name, u.name AS changed_by_name FROM price_history ph JOIN items p ON p.id = ph.product_id LEFT JOIN users u ON u.id = ph.changed_by ORDER BY ph.changed_at DESC");
      res.json(history);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /products/:id
  router.get('/products/:id', (req, res) => {
    try {
      const product = queryOne("SELECT p.*, p.current_price AS price, p.stock_quantity AS stock, c.name AS category_name FROM products p LEFT JOIN categories c ON c.id = p.category_id WHERE p.id = ?", [req.params.id]);
      if (!product) return res.status(404).json({ error: 'Product not found' });
      res.json(product);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/products', requireAdmin, (req, res) => {
    try {
      const { code, name, description, category_id, category, unit_id, bulk_unit_id, bulk_conversion, purchase_price, selling_price, price, mrp, gst_rate, hsn_code, stock_quantity, stock, min_stock_level, image_url, image_path, zone } = req.body;
      const actualName = name;
      // Fix: use selling_price or price — 'current_price' was never declared
      const actualPrice = selling_price !== undefined ? selling_price : (price !== undefined ? price : 0);
      const actualStock = stock_quantity !== undefined ? stock_quantity : (stock !== undefined ? stock : 0);

      if (!actualName) {
        return res.status(400).json({ error: 'Product name is required' });
      }

      // Resolve category text if category_id not provided
      let resolvedCategoryId = category_id;
      if (!resolvedCategoryId && category) {
        const catName = category.trim();
        if (catName) {
          let cat = queryOne("SELECT id FROM categories WHERE name = ?", [catName]);
          if (!cat) {
            run("INSERT INTO categories (name, description) VALUES (?, '')", [catName]);
            resolvedCategoryId = getLastId();
          } else {
            resolvedCategoryId = cat.id;
          }
        }
      }

      const autoCode = code || ('ITM' + String(Date.now()).slice(-6));
      run("INSERT INTO items (code, name, description, category_id, unit_id, bulk_unit_id, bulk_conversion, purchase_price, selling_price, mrp, gst_rate, hsn_code, opening_stock, current_stock, min_stock_level, image_path, zone, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))",
        [
          autoCode,
          actualName,
          description || '',
          resolvedCategoryId || null,
          unit_id || null,
          bulk_unit_id || null,
          Number(bulk_conversion) || 1,
          Number(purchase_price) || 0,
          Number(actualPrice) || 0,
          Number(mrp) || 0,
          gst_rate !== undefined ? Number(gst_rate) : 18,
          hsn_code || '',
          Number(actualStock) || 0,
          Number(actualStock) || 0,
          Number(min_stock_level) || 0,
          image_url || image_path || '',
          zone || 'A'
        ]
      );
      
      const productId = getLastId();
      logAudit(req.user.userId, 'CREATE_PRODUCT', `Created product "${actualName}" (#${productId})`);

      res.status(201).json({ id: productId, name: actualName, current_price: actualPrice, stock_quantity: actualStock });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // PUT /products/:id
  router.put('/products/:id', requireAdmin, (req, res) => {
    try {
      const { id } = req.params;
      const { code, name, description, category_id, category, unit_id, bulk_unit_id, bulk_conversion, purchase_price, selling_price, price, mrp, gst_rate, hsn_code, stock_quantity, stock, min_stock_level, image_url, image_path, zone } = req.body;
      // Fix: use selling_price or price — 'current_price' was never declared
      const actualPrice = selling_price !== undefined ? selling_price : (price !== undefined ? price : undefined);
      const actualStock = stock_quantity !== undefined ? stock_quantity : (stock !== undefined ? stock : undefined);

      const existing = queryOne("SELECT selling_price FROM items WHERE id = ?", [id]);
      if (!existing) return res.status(404).json({ error: 'Product not found' });

      // Price history check
      if (actualPrice !== undefined && Number(actualPrice) !== Number(existing.selling_price)) {
        run("INSERT INTO price_history (product_id, old_price, new_price, changed_by, changed_at) VALUES (?, ?, ?, ?, datetime('now'))",
          [id, existing.selling_price, actualPrice, req.user.userId]);
      }

      // Resolve category text if category_id not provided
      let resolvedCategoryId = category_id;
      if (!resolvedCategoryId && category) {
        const catName = category.trim();
        if (catName) {
          let cat = queryOne("SELECT id FROM categories WHERE name = ?", [catName]);
          if (!cat) {
            run("INSERT INTO categories (name, description) VALUES (?, '')", [catName]);
            resolvedCategoryId = getLastId();
          } else {
            resolvedCategoryId = cat.id;
          }
        }
      }

      run("UPDATE items SET code = COALESCE(?, code), name = COALESCE(?, name), description = COALESCE(?, description), category_id = COALESCE(?, category_id), unit_id = COALESCE(?, unit_id), bulk_unit_id = COALESCE(?, bulk_unit_id), bulk_conversion = COALESCE(?, bulk_conversion), purchase_price = COALESCE(?, purchase_price), selling_price = COALESCE(?, selling_price), mrp = COALESCE(?, mrp), gst_rate = COALESCE(?, gst_rate), hsn_code = COALESCE(?, hsn_code), current_stock = COALESCE(?, current_stock), min_stock_level = COALESCE(?, min_stock_level), image_path = COALESCE(?, image_path), zone = COALESCE(?, zone), updated_at = datetime('now') WHERE id = ?",
        [
          code !== undefined ? code : null,
          name !== undefined ? name : null,
          description !== undefined ? description : null,
          resolvedCategoryId !== undefined ? resolvedCategoryId : null,
          unit_id !== undefined ? unit_id : null,
          bulk_unit_id !== undefined ? bulk_unit_id : null,
          bulk_conversion !== undefined ? Number(bulk_conversion) : null,
          purchase_price !== undefined ? Number(purchase_price) : null,
          actualPrice !== undefined ? Number(actualPrice) : null,
          mrp !== undefined ? Number(mrp) : null,
          gst_rate !== undefined ? Number(gst_rate) : null,
          hsn_code !== undefined ? hsn_code : null,
          actualStock !== undefined ? Number(actualStock) : null,
          min_stock_level !== undefined ? Number(min_stock_level) : null,
          image_url || image_path || null,
          zone !== undefined ? zone : null,
          id
        ]);

      logAudit(req.user.userId, 'UPDATE_PRODUCT', `Updated product #${id}`);
      res.json({ message: 'Product updated successfully' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // DELETE /products/:id — Soft delete to preserve FK integrity (sale_items, purchase_items)
  router.delete('/products/:id', requireAdmin, (req, res) => {
    try {
      const { id } = req.params;
      const existing = queryOne("SELECT id FROM items WHERE id = ?", [id]);
      if (!existing) return res.status(404).json({ error: 'Product not found' });

      run("UPDATE items SET is_active = 0, updated_at = datetime('now') WHERE id = ?", [id]);
      logAudit(req.user.userId, 'DELETE_PRODUCT', `Soft-deleted product #${id}`);
      res.json({ message: 'Product deleted successfully' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── DAILY SELECTIONS ─────────────────────────────────────────────────────

  // GET /selections
  router.get('/selections', (req, res) => {
    try {
      const { date } = req.query;
      let sql = "SELECT ds.*, ds.selection_date AS date, u.name AS store_owner_name, u.store_name, u.gst_number, u.store_address FROM daily_selections ds JOIN users u ON u.id = ds.store_owner_id";
      const params = [];

      if (req.user.role === 'client') {
        sql += " WHERE ds.store_owner_id = ?";
        params.push(req.user.userId);
        if (date) {
          sql += " AND ds.selection_date = ?";
          params.push(date);
        }
      } else {
        if (date) {
          sql += " WHERE ds.selection_date = ?";
          params.push(date);
        }
      }

      sql += " ORDER BY ds.created_at DESC";
      const selections = query(sql, params);
      
      // Fetch and attach items for each selection
      selections.forEach(sel => {
        sel.items = query(`
          SELECT 
            si.id,
            si.selection_id,
            si.product_id,
            si.requested_quantity AS quantity,
            si.unit_price_at_selection AS unit_price,
            p.name AS product_name,
            p.name AS name,
            p.current_price AS price,
            p.zone,
            c.name AS category
          FROM selection_items si
          JOIN products p ON p.id = si.product_id
          LEFT JOIN categories c ON c.id = p.category_id
          WHERE si.selection_id = ?
        `, [sel.id]);
      });

      res.json(selections);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /selections/cart
  router.get('/selections/cart', requireClient, (req, res) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const selection = queryOne("SELECT ds.*, ds.selection_date AS date FROM daily_selections ds WHERE ds.store_owner_id = ? AND ds.selection_date = ? AND ds.status = 'draft' ORDER BY ds.created_at DESC LIMIT 1", [req.user.userId, today]);
      if (!selection) return res.json(null);

      // Get items
      selection.items = query(`
        SELECT 
          si.id,
          si.selection_id,
          si.product_id,
          si.requested_quantity AS quantity,
          si.unit_price_at_selection AS unit_price,
          p.name AS product_name,
          p.name AS name,
          p.current_price AS price,
          p.zone,
          c.name AS category
        FROM selection_items si 
        JOIN products p ON p.id = si.product_id 
        LEFT JOIN categories c ON c.id = p.category_id 
        WHERE si.selection_id = ?
      `, [selection.id]);

      res.json(selection);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /selections/mine
  router.get('/selections/mine', requireClient, (req, res) => {
    try {
      const selections = query("SELECT *, selection_date AS date FROM daily_selections WHERE store_owner_id = ? ORDER BY selection_date DESC", [req.user.userId]);
      selections.forEach(sel => {
        sel.items = query(`
          SELECT 
            si.id,
            si.selection_id,
            si.product_id,
            si.requested_quantity AS quantity,
            si.unit_price_at_selection AS unit_price,
            p.name AS product_name,
            p.name AS name,
            p.current_price AS price,
            p.zone,
            c.name AS category
          FROM selection_items si
          JOIN products p ON p.id = si.product_id
          LEFT JOIN categories c ON c.id = p.category_id
          WHERE si.selection_id = ?
        `, [sel.id]);
      });
      res.json(selections);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /selections/:id
  router.get('/selections/:id', (req, res) => {
    try {
      const selection = queryOne("SELECT ds.*, ds.selection_date AS date, u.name AS store_owner_name, u.store_name, u.gst_number, u.store_address FROM daily_selections ds JOIN users u ON u.id = ds.store_owner_id WHERE ds.id = ?", [req.params.id]);
      if (!selection) return res.status(404).json({ error: 'Selection not found' });

      // Get items
      selection.items = query(`
        SELECT 
          si.id,
          si.selection_id,
          si.product_id,
          si.requested_quantity AS quantity,
          si.unit_price_at_selection AS unit_price,
          p.name AS product_name,
          p.name AS name,
          p.current_price AS price,
          p.zone,
          c.name AS category 
        FROM selection_items si 
        JOIN products p ON p.id = si.product_id 
        LEFT JOIN categories c ON c.id = p.category_id 
        WHERE si.selection_id = ?
      `, [selection.id]);
      res.json(selection);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /selections
  router.post('/selections', requireClient, (req, res) => {
    try {
      const { id, notes, items, status } = req.body;
      const selection_date = req.body.selection_date || req.body.date;
      const newStatus = status || 'draft';
      
      if (!selection_date || !items || !items.length) {
        return res.status(400).json({ error: 'Date and items are required' });
      }

      const activeStatuses = ['submitted', 'packed', 'shipped', 'delivered'];

      let selection = null;
      let oldStatus = 'draft';
      let oldItems = [];

      if (id) {
        selection = queryOne("SELECT * FROM daily_selections WHERE id = ? AND store_owner_id = ?", [id, req.user.userId]);
        if (selection) {
          oldStatus = selection.status;
          oldItems = query("SELECT product_id, requested_quantity FROM selection_items WHERE selection_id = ?", [selection.id]);
        }
      }

      const wasActive = activeStatuses.includes(oldStatus);
      const isActive = activeStatuses.includes(newStatus);

      // Revert old stock if it was active
      if (wasActive) {
        oldItems.forEach(item => {
          run("UPDATE items SET current_stock = current_stock + ? WHERE id = ?", [item.requested_quantity, item.product_id]);
          
          const updated = queryOne("SELECT current_stock FROM items WHERE id = ?", [item.product_id]);
          run("INSERT INTO stock_movements (item_id, movement_type, quantity, reference_type, reference_id, balance_after, notes, created_at) VALUES (?, 'purchase', ?, 'selection_edit_revert', ?, ?, 'WMS Selection Revert before edit', datetime('now'))",
            [item.product_id, item.requested_quantity, selection.id, updated?.current_stock || 0]);
        });
      }

      if (selection) {
        // Delete old selection items
        run("DELETE FROM selection_items WHERE selection_id = ?", [selection.id]);
        run("UPDATE daily_selections SET status = ?, notes = ?, submitted_at = ? WHERE id = ?",
          [newStatus, notes || '', newStatus === 'submitted' ? datetimeNow() : null, selection.id]);
      } else {
        run("INSERT INTO daily_selections (store_owner_id, selection_date, status, notes, submitted_at, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))",
          [req.user.userId, selection_date, newStatus, notes || '', newStatus === 'submitted' ? datetimeNow() : null]);
        selection = { id: getLastId() };
      }

      // Insert items
      items.forEach(item => {
        const prod = queryOne("SELECT selling_price FROM items WHERE id = ?", [item.product_id]);
        const price = prod ? prod.selling_price : 0;
        const qty = item.requested_quantity || item.quantity || 0;
        run("INSERT INTO selection_items (selection_id, product_id, requested_quantity, unit_price_at_selection) VALUES (?, ?, ?, ?)",
          [selection.id, item.product_id, qty, price]);
      });

      // Deduct new stock if active (with availability check)
      if (isActive) {
        // Validate stock availability first
        for (const item of items) {
          const qty = item.requested_quantity || item.quantity || 0;
          const stockRow = queryOne("SELECT current_stock, name FROM items WHERE id = ?", [item.product_id]);
          if (stockRow && stockRow.current_stock < qty) {
            return res.status(400).json({ error: `Insufficient stock for "${stockRow.name}". Available: ${stockRow.current_stock}, Requested: ${qty}` });
          }
        }
        items.forEach(item => {
          const qty = item.requested_quantity || item.quantity || 0;
          run("UPDATE items SET current_stock = current_stock - ? WHERE id = ?", [qty, item.product_id]);
          
          const updated = queryOne("SELECT current_stock FROM items WHERE id = ?", [item.product_id]);
          run("INSERT INTO stock_movements (item_id, movement_type, quantity, reference_type, reference_id, balance_after, notes, created_at) VALUES (?, 'sale', ?, 'selection', ?, ?, 'WMS Selection Placed', datetime('now'))",
            [item.product_id, -qty, selection.id, updated?.current_stock || 0]);
        });
      }

      if (newStatus === 'submitted') {
        logAudit(req.user.userId, 'SUBMIT_SELECTION', `Submitted selection for ${selection_date}`);
        notifyAdmin('New Daily Selection', `Store "${req.user.name || 'Store'}" submitted selections for ${selection_date}.`);
      }

      // Fetch the full selection object to return
      const fullSelection = queryOne("SELECT ds.*, ds.selection_date AS date FROM daily_selections ds WHERE ds.id = ?", [selection.id]);
      if (fullSelection) {
        fullSelection.items = query(`
          SELECT 
            si.id,
            si.selection_id,
            si.product_id,
            si.requested_quantity AS quantity,
            si.unit_price_at_selection AS unit_price,
            p.name AS product_name,
            p.name AS name,
            p.current_price AS price,
            p.zone,
            c.name AS category
          FROM selection_items si
          JOIN products p ON p.id = si.product_id
          LEFT JOIN categories c ON c.id = p.category_id
          WHERE si.selection_id = ?
        `, [selection.id]);
      }

      res.status(201).json(fullSelection || { id: selection.id, message: 'Selection saved successfully' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  function datetimeNow() {
    return new Date().toISOString().replace('T', ' ').substring(0, 19);
  }

  // PUT /selections/:id/status (Admin updates status)
  router.put('/selections/:id/status', requireAdmin, (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body; // 'draft', 'submitted', 'packed', 'shipped', 'delivered'
      if (!status) return res.status(400).json({ error: 'Status is required' });

      const selection = queryOne("SELECT * FROM daily_selections WHERE id = ?", [id]);
      if (!selection) return res.status(404).json({ error: 'Selection not found' });

      const oldStatus = selection.status;
      run("UPDATE daily_selections SET status = ? WHERE id = ?", [status, id]);

      // Active dispatched statuses where stock is decremented
      const activeStatuses = ['submitted', 'packed', 'shipped', 'delivered'];
      const wasActive = activeStatuses.includes(oldStatus);
      const isActive = activeStatuses.includes(status);

      if (isActive && !wasActive) {
        // Deduct stock levels!
        const items = query("SELECT product_id, requested_quantity FROM selection_items WHERE selection_id = ?", [id]);
        items.forEach(item => {
          run("UPDATE items SET current_stock = current_stock - ? WHERE id = ?", [item.requested_quantity, item.product_id]);
          
          // Insert stock movements
          const updated = queryOne("SELECT current_stock FROM items WHERE id = ?", [item.product_id]);
          run("INSERT INTO stock_movements (item_id, movement_type, quantity, reference_type, reference_id, balance_after, notes, created_at) VALUES (?, 'sale', ?, 'selection', ?, ?, 'WMS Selection Dispatch', datetime('now'))",
            [item.product_id, -item.requested_quantity, id, updated?.current_stock || 0]);
        });
      } else if (!isActive && wasActive) {
        // Restore stock levels!
        const items = query("SELECT product_id, requested_quantity FROM selection_items WHERE selection_id = ?", [id]);
        items.forEach(item => {
          run("UPDATE items SET current_stock = current_stock + ? WHERE id = ?", [item.requested_quantity, item.product_id]);
          
          // Insert stock movements
          const updated = queryOne("SELECT current_stock FROM items WHERE id = ?", [item.product_id]);
          run("INSERT INTO stock_movements (item_id, movement_type, quantity, reference_type, reference_id, balance_after, notes, created_at) VALUES (?, 'purchase', ?, 'selection_cancel', ?, ?, 'WMS Selection Cancelled', datetime('now'))",
            [item.product_id, item.requested_quantity, id, updated?.current_stock || 0]);
        });
      }

      logAudit(req.user.userId, 'UPDATE_SELECTION_STATUS', `Changed status of selection #${id} to ${status}`);
      notifyUser(selection.store_owner_id, 'Order Update', `Your order for ${selection.selection_date} is now ${status}.`);

      res.json({ message: 'Status updated successfully' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /selections/:id/submit
  router.post('/selections/:id/submit', requireClient, (req, res) => {
    try {
      const { id } = req.params;
      const selection = queryOne("SELECT * FROM daily_selections WHERE id = ? AND store_owner_id = ?", [id, req.user.userId]);
      if (!selection) return res.status(404).json({ error: 'Draft selection not found' });

      const oldStatus = selection.status;
      if (oldStatus !== 'submitted') {
        run("UPDATE daily_selections SET status = 'submitted', submitted_at = ? WHERE id = ?", [datetimeNow(), id]);

        // Deduct stock levels!
        const items = query("SELECT product_id, requested_quantity FROM selection_items WHERE selection_id = ?", [id]);
        items.forEach(item => {
          run("UPDATE items SET current_stock = current_stock - ? WHERE id = ?", [item.requested_quantity, item.product_id]);
          
          const updated = queryOne("SELECT current_stock FROM items WHERE id = ?", [item.product_id]);
          run("INSERT INTO stock_movements (item_id, movement_type, quantity, reference_type, reference_id, balance_after, notes, created_at) VALUES (?, 'sale', ?, 'selection', ?, ?, 'WMS Selection Submitted', datetime('now'))",
            [item.product_id, -item.requested_quantity, id, updated?.current_stock || 0]);
        });
      }

      logAudit(req.user.userId, 'SUBMIT_SELECTION', `Submitted selection #${id}`);
      notifyAdmin('New Daily Selection', `Store "${req.user.name || 'Store'}" submitted selections for ${selection.selection_date}.`);

      res.json({ message: 'Selection submitted successfully' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // DELETE /selections/:id
  router.delete('/selections/:id', (req, res) => {
    try {
      const { id } = req.params;
      const selection = queryOne("SELECT * FROM daily_selections WHERE id = ?", [id]);
      if (!selection) return res.status(404).json({ error: 'Selection not found' });

      if (req.user.role === 'client' && selection.status !== 'draft') {
        return res.status(400).json({ error: 'Cannot delete submitted selections' });
      }

      const activeStatuses = ['submitted', 'packed', 'shipped', 'delivered'];
      if (activeStatuses.includes(selection.status)) {
        // Restore stock levels before deleting
        const items = query("SELECT product_id, requested_quantity FROM selection_items WHERE selection_id = ?", [id]);
        items.forEach(item => {
          run("UPDATE items SET current_stock = current_stock + ? WHERE id = ?", [item.requested_quantity, item.product_id]);
          
          const updated = queryOne("SELECT current_stock FROM items WHERE id = ?", [item.product_id]);
          run("INSERT INTO stock_movements (item_id, movement_type, quantity, reference_type, reference_id, balance_after, notes, created_at) VALUES (?, 'purchase', ?, 'selection_delete', ?, ?, 'WMS Selection Deleted', datetime('now'))",
            [item.product_id, item.requested_quantity, id, updated?.current_stock || 0]);
        });
      }

      run("DELETE FROM daily_selections WHERE id = ?", [id]);
      res.json({ message: 'Selection deleted successfully' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── RECURRING TEMPLATES ──────────────────────────────────────────────────

  // GET /templates
  router.get('/templates', requireClient, (req, res) => {
    try {
      const templates = query("SELECT * FROM recurring_templates WHERE store_owner_id = ? ORDER BY name ASC", [req.user.userId]);
      templates.forEach(t => {
        t.items = query("SELECT ti.*, p.name, p.current_price AS price, p.zone FROM template_items ti JOIN products p ON p.id = ti.product_id WHERE ti.template_id = ?", [t.id]);
      });
      res.json(templates);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /templates
  router.post('/templates', requireClient, (req, res) => {
    try {
      const { name, items } = req.body;
      if (!name || !items || !items.length) {
        return res.status(400).json({ error: 'Template name and items are required' });
      }

      run("INSERT INTO recurring_templates (store_owner_id, name, created_at) VALUES (?, ?, datetime('now'))",
        [req.user.userId, name]);
      const templateId = getLastId();

      items.forEach(item => {
        run("INSERT INTO template_items (template_id, product_id, quantity) VALUES (?, ?, ?)",
          [templateId, item.product_id, item.quantity || 1]);
      });

      res.status(201).json({ id: templateId, name, message: 'Template saved successfully' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // DELETE /templates/:id
  router.delete('/templates/:id', requireClient, (req, res) => {
    try {
      const { id } = req.params;
      const templateId = Number(id);
      const existing = queryOne("SELECT id FROM recurring_templates WHERE id = ? AND store_owner_id = ?", [templateId, req.user.userId]);
      if (!existing) return res.status(404).json({ error: 'Template not found' });

      run("DELETE FROM recurring_templates WHERE id = ?", [templateId]);
      res.json({ message: 'Template deleted successfully' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── PRODUCT REQUESTS ─────────────────────────────────────────────────────

  // GET /product-requests
  router.get('/product-requests', (req, res) => {
    try {
      let sql = "SELECT pr.*, u.name AS store_owner_name, u.store_name FROM product_requests pr JOIN users u ON u.id = pr.store_owner_id";
      const params = [];
      if (req.user.role === 'client') {
        sql += " WHERE pr.store_owner_id = ?";
        params.push(req.user.userId);
      }
      sql += " ORDER BY pr.created_at DESC";
      const requests = query(sql, params);
      res.json(requests);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /product-requests/mine
  router.get('/product-requests/mine', requireClient, (req, res) => {
    try {
      const requests = query("SELECT * FROM product_requests WHERE store_owner_id = ? ORDER BY created_at DESC", [req.user.userId]);
      res.json(requests);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /product-requests
  router.post('/product-requests', requireClient, (req, res) => {
    try {
      const { product_name, proposed_description } = req.body;
      if (!product_name) return res.status(400).json({ error: 'Product name is required' });

      run("INSERT INTO product_requests (store_owner_id, product_name, proposed_description, status, created_at) VALUES (?, ?, ?, 'pending', datetime('now'))",
        [req.user.userId, product_name, proposed_description || '']);
      
      notifyAdmin('New Product Request', `Store "${req.user.name || 'Store'}" requested a new product: "${product_name}".`);

      res.status(201).json({ message: 'Product request submitted successfully' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // PUT /product-requests/:id
  router.put('/product-requests/:id', requireAdmin, (req, res) => {
    try {
      const { id } = req.params;
      const { status, admin_notes } = req.body; // 'approved', 'rejected'
      if (!status) return res.status(400).json({ error: 'Status is required' });

      const request = queryOne("SELECT * FROM product_requests WHERE id = ?", [id]);
      if (!request) return res.status(404).json({ error: 'Request not found' });

      run("UPDATE product_requests SET status = ?, admin_notes = ? WHERE id = ?", [status, admin_notes || '', id]);
      notifyUser(request.store_owner_id, 'Product Request Update', `Your request for "${request.product_name}" has been ${status}.`);

      res.json({ message: 'Request status updated successfully' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── DISCREPANCIES ────────────────────────────────────────────────────────

  // GET /discrepancies
  router.get('/discrepancies', (req, res) => {
    try {
      let sql = "SELECT d.*, ds.selection_date, p.name AS product_name, u.name AS store_owner_name, u.store_name FROM discrepancies d JOIN daily_selections ds ON ds.id = d.selection_id JOIN products p ON p.id = d.product_id JOIN users u ON u.id = ds.store_owner_id";
      const params = [];
      if (req.user.role === 'client') {
        sql += " WHERE ds.store_owner_id = ?";
        params.push(req.user.userId);
      }
      sql += " ORDER BY d.created_at DESC";
      const list = query(sql, params);
      res.json(list);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /discrepancies
  router.post('/discrepancies', requireClient, (req, res) => {
    try {
      const { selection_id, product_id, quantity, issue_type, notes } = req.body;
      if (!selection_id || !product_id || !quantity || !issue_type) {
        return res.status(400).json({ error: 'Selection ID, product ID, quantity, and issue type are required' });
      }

      run("INSERT INTO discrepancies (selection_id, product_id, quantity, issue_type, notes, status, created_at) VALUES (?, ?, ?, ?, ?, 'reported', datetime('now'))",
        [selection_id, product_id, quantity, issue_type, notes || '']);

      notifyAdmin('New Discrepancy Reported', `Store "${req.user.name}" reported a discrepancy (${issue_type}) for order #${selection_id}.`);

      res.status(201).json({ message: 'Discrepancy reported successfully' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // PUT /discrepancies/:id
  router.put('/discrepancies/:id', requireAdmin, (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body; // 'resolved', 'rejected'
      if (!status) return res.status(400).json({ error: 'Status is required' });

      const discrepancy = queryOne("SELECT d.*, ds.store_owner_id, p.name AS product_name FROM discrepancies d JOIN daily_selections ds ON ds.id = d.selection_id JOIN products p ON p.id = d.product_id WHERE d.id = ?", [id]);
      if (!discrepancy) return res.status(404).json({ error: 'Discrepancy record not found' });

      run("UPDATE discrepancies SET status = ? WHERE id = ?", [status, id]);
      notifyUser(discrepancy.store_owner_id, 'Discrepancy Resolved', `Your reported issue for "${discrepancy.product_name}" has been marked as ${status}.`);

      res.json({ message: 'Discrepancy updated successfully' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── ANNOUNCEMENTS & NOTIFICATIONS ────────────────────────────────────────

  // GET /notifications
  router.get('/notifications', (req, res) => {
    try {
      const list = query("SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50", [req.user.userId]);
      // map SQLite 0/1 back to false/true
      res.json(list.map(n => ({ ...n, read: !!n.read })));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // PUT /notifications/:id/read
  router.put('/notifications/:id/read', (req, res) => {
    try {
      run("UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?", [req.params.id, req.user.userId]);
      res.json({ message: 'Notification marked as read' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // PUT /notifications/read-all
  router.put('/notifications/read-all', (req, res) => {
    try {
      run("UPDATE notifications SET read = 1 WHERE user_id = ?", [req.user.userId]);
      res.json({ message: 'All notifications marked as read' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /announcements
  router.get('/announcements', (req, res) => {
    try {
      const list = query("SELECT a.*, u.name AS created_by_name FROM announcements a LEFT JOIN users u ON u.id = a.created_by ORDER BY a.created_at DESC");
      res.json(list.map(a => ({ ...a, active: !!a.active })));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /announcements/active
  router.get('/announcements/active', (req, res) => {
    try {
      const list = query("SELECT a.*, u.name AS created_by_name FROM announcements a LEFT JOIN users u ON u.id = a.created_by WHERE a.active = 1 ORDER BY a.created_at DESC LIMIT 5");
      res.json(list.map(a => ({ ...a, active: !!a.active })));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /announcements
  router.post('/announcements', requireAdmin, (req, res) => {
    try {
      const { title, message } = req.body;
      if (!title || !message) return res.status(400).json({ error: 'Title and message are required' });

      run("INSERT INTO announcements (created_by, title, message, active, created_at) VALUES (?, ?, ?, 1, datetime('now'))",
        [req.user.userId, title, message]);
      
      const newAnnId = getLastId();
      logAudit(req.user.userId, 'CREATE_ANNOUNCEMENT', `Created announcement "${title}"`);

      // Notify all store owners
      const stores = query("SELECT id FROM users WHERE role = 'client'");
      stores.forEach(store => {
        notifyUser(store.id, 'New Announcement', title);
      });

      res.status(201).json({ id: newAnnId, title, message, active: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // PUT /announcements/:id
  router.put('/announcements/:id', requireAdmin, (req, res) => {
    try {
      const { id } = req.params;
      const { title, message, active } = req.body;

      const existing = queryOne("SELECT id FROM announcements WHERE id = ?", [id]);
      if (!existing) return res.status(404).json({ error: 'Announcement not found' });

      const newActive = active !== undefined ? (active ? 1 : 0) : null;

      run("UPDATE announcements SET title = COALESCE(?, title), message = COALESCE(?, message), active = COALESCE(?, active) WHERE id = ?",
        [title, message, newActive, id]);

      res.json({ message: 'Announcement updated successfully' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // DELETE /announcements/:id
  router.delete('/announcements/:id', requireAdmin, (req, res) => {
    try {
      const { id } = req.params;
      const existing = queryOne("SELECT id FROM announcements WHERE id = ?", [id]);
      if (!existing) return res.status(404).json({ error: 'Announcement not found' });

      run("DELETE FROM announcements WHERE id = ?", [id]);
      res.json({ message: 'Announcement deleted successfully' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── ADMIN STATS & CHARTS ─────────────────────────────────────────────────

  // GET /admin/stats
  router.get('/admin/stats', requireAdmin, (req, res) => {
    try {
      const products = queryOne("SELECT COUNT(*) AS total FROM items");
      const users = queryOne("SELECT COUNT(*) AS total FROM users");
      const selections = queryOne("SELECT COUNT(*) AS total FROM daily_selections WHERE selection_date = date('now')");
      const pending = queryOne("SELECT COUNT(*) AS total FROM users WHERE approved = 0 AND role = 'client'");

      res.json({
        total_products: products?.total || 0,
        total_users: users?.total || 0,
        todays_selections: selections?.total || 0,
        pending_approvals: pending?.total || 0
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /admin/chart/daily-selections
  router.get('/admin/chart/daily-selections', requireAdmin, (req, res) => {
    try {
      const rows = query(`
        WITH RECURSIVE dates(d) AS (
          SELECT date('now', '-13 days')
          UNION ALL
          SELECT date(d, '+1 day') FROM dates WHERE d < date('now')
        )
        SELECT dates.d AS raw_date, COUNT(ds.id) AS selections
        FROM dates
        LEFT JOIN daily_selections ds ON ds.selection_date = dates.d
        GROUP BY dates.d
        ORDER BY dates.d
      `);

      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      const formatted = rows.map(r => {
        const dateObj = new Date(r.raw_date);
        return {
          date: `${months[dateObj.getMonth()]} ${String(dateObj.getDate()).padStart(2, '0')}`,
          selections: r.selections
        };
      });

      res.json(formatted);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /admin/chart/top-products
  router.get('/admin/chart/top-products', requireAdmin, (req, res) => {
    try {
      const rows = query(`
        SELECT p.name, SUM(si.requested_quantity) AS count
        FROM selection_items si
        JOIN daily_selections ds ON ds.id = si.selection_id
        JOIN items p ON p.id = si.product_id
        WHERE ds.selection_date >= date('now', '-30 days')
        GROUP BY p.id, p.name
        ORDER BY count DESC
        LIMIT 5
      `);
      res.json(rows);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /admin/activity
  router.get('/admin/activity', requireAdmin, (req, res) => {
    try {
      const rows = query(`
        SELECT al.id, al.action, u.name AS user, al.created_at
        FROM audit_logs al
        LEFT JOIN users u ON u.id = al.user_id
        ORDER BY al.created_at DESC
        LIMIT 10
      `);

      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      const formatted = rows.map(r => {
        const elapsed = Date.now() - new Date(r.created_at).getTime();
        let timeStr = '';
        if (elapsed < 60000) { timeStr = 'Just now'; }
        else if (elapsed < 3600000) { timeStr = Math.floor(elapsed / 60000) + ' min ago'; }
        else if (elapsed < 86400000) { timeStr = Math.floor(elapsed / 3600000) + ' hours ago'; }
        else {
          const d = new Date(r.created_at);
          timeStr = `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
        }
        return { id: r.id, action: r.action, user: r.user || 'System', time: timeStr };
      });

      res.json(formatted);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── STORE STATS & CHARTS ─────────────────────────────────────────────────

  // GET /store/stats
  router.get('/store/stats', requireClient, (req, res) => {
    try {
      const total = queryOne("SELECT COUNT(*) AS total FROM daily_selections WHERE store_owner_id = ?", [req.user.userId]);
      const month = queryOne("SELECT COUNT(*) AS total FROM daily_selections WHERE store_owner_id = ? AND selection_date >= date('now', 'start of month')", [req.user.userId]);
      const pending = queryOne("SELECT COUNT(*) AS total FROM daily_selections WHERE store_owner_id = ? AND status IN ('submitted', 'packed', 'shipped')", [req.user.userId]);
      const templates = queryOne("SELECT COUNT(*) AS total FROM recurring_templates WHERE store_owner_id = ?", [req.user.userId]);

      res.json({
        total_orders: total?.total || 0,
        this_month: month?.total || 0,
        pending_deliveries: pending?.total || 0,
        templates: templates?.total || 0
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /store/chart/top-products
  router.get('/store/chart/top-products', requireClient, (req, res) => {
    try {
      const rows = query(`
        SELECT p.name, SUM(si.requested_quantity) AS count
        FROM selection_items si
        JOIN daily_selections ds ON ds.id = si.selection_id
        JOIN items p ON p.id = si.product_id
        WHERE ds.store_owner_id = ? AND ds.selection_date >= date('now', '-30 days')
        GROUP BY p.id, p.name
        ORDER BY count DESC
        LIMIT 5
      `, [req.user.userId]);
      res.json(rows);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /store/recent-price-changes
  router.get('/store/recent-price-changes', requireClient, (req, res) => {
    try {
      const rows = query(`
        SELECT DISTINCT ph.product_id, p.name AS product_name, ph.old_price, ph.new_price, ph.changed_at
        FROM price_history ph
        JOIN items p ON p.id = ph.product_id
        WHERE ph.product_id IN (
          SELECT DISTINCT si.product_id
          FROM selection_items si
          JOIN daily_selections ds ON ds.id = si.selection_id
          WHERE ds.store_owner_id = ? AND ds.selection_date >= date('now', '-60 days')
        )
        AND ph.changed_at >= date('now', '-14 days')
        ORDER BY ph.changed_at DESC
        LIMIT 10
      `, [req.user.userId]);
      res.json(rows);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /dashboard/admin
  router.get('/dashboard/admin', requireAdmin, (req, res) => {
    try {
      const products = queryOne("SELECT COUNT(*) AS total FROM items");
      const users = queryOne("SELECT COUNT(*) AS total FROM users");
      const today = queryOne("SELECT COUNT(*) AS total FROM daily_selections WHERE selection_date = date('now')");
      res.json({
        total_products: products?.total || 0,
        total_users: users?.total || 0,
        total_selections_today: today?.total || 0
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /dashboard/store-owner
  router.get('/dashboard/store-owner', requireClient, (req, res) => {
    try {
      const sel = queryOne("SELECT COUNT(*) AS total FROM daily_selections WHERE store_owner_id = ?", [req.user.userId]);
      res.json({ my_selections_count: sel?.total || 0 });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /audit-logs
  router.get('/audit-logs', requireAdmin, (req, res) => {
    try {
      const logs = query(`
        SELECT al.*, u.name AS user_name, u.email AS user_email
        FROM audit_logs al
        LEFT JOIN users u ON u.id = al.user_id
        ORDER BY al.created_at DESC
        LIMIT 200
      `);
      res.json(logs);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
