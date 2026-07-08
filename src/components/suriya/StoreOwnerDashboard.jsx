import React, { useState, useEffect, useMemo } from 'react';
import {
  ShoppingCart, Package, ListOrdered, Bookmark, PlusCircle, Bell,
  Search, Filter, Plus, Minus, Check, X, ChevronRight, Save, Send,
  FileDown, AlertTriangle, Trash2, Clock, TrendingUp, Star, ArrowDownRight,
  ArrowUpRight, CheckCircle, Eye, DollarSign, PackageSearch, BarChart3,
  Tag, MapPin, LayoutGrid, List, Upload, FileUp, Download, File
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer
} from 'recharts';
import { StatusBadge, Loader, EmptyState, Modal } from '../App';

const getStockText = (p) => {
  const stock = Number(p.stock) || 0;
  const conversion = Number(p.bulk_conversion) || 1;
  if (conversion <= 1) {
    const baseUnit = p.unit_name || 'Pcs';
    return `${stock} ${baseUnit}`;
  }
  const boxes = Math.floor(stock / conversion);
  const extraPieces = Math.round(stock % conversion);
  const bulkUnitDisp = p.bulk_unit_name || 'Box';
  const baseUnitDisp = (p.unit_name && p.unit_name.toLowerCase() !== bulkUnitDisp.toLowerCase()) ? p.unit_name : 'Pcs';
  const bulkUnitLabel = (bulkUnitDisp.toLowerCase() === 'box') ? (boxes === 1 ? 'Box' : 'Boxes') : bulkUnitDisp;

  return extraPieces > 0
    ? `${boxes} ${bulkUnitLabel} × ${conversion} ${baseUnitDisp} + ${extraPieces} ${baseUnitDisp}`
    : `${boxes} ${bulkUnitLabel} × ${conversion} ${baseUnitDisp}`;
};

/* ================================================================
   STORE OWNER DASHBOARD — renders sub-pages based on currentPage
   ================================================================ */
export default function StoreOwnerDashboard({ currentPage, api, currentUser, navigateTo }) {
  const [cart, setCart] = useState({});
  const [existingSelection, setExistingSelection] = useState(null);

  switch (currentPage) {
    case 'dashboard':        return <StoreHome api={api} currentUser={currentUser} />;
    case 'make-selection':   return <MakeSelectionView api={api} currentUser={currentUser} cart={cart} setCart={setCart} existingSelection={existingSelection} setExistingSelection={setExistingSelection} />;
    case 'my-orders':        return <MyOrdersView api={api} currentUser={currentUser} navigateTo={navigateTo} setCart={setCart} setExistingSelection={setExistingSelection} />;
    case 'templates':        return <TemplatesView api={api} />;
    case 'request-product':  return <RequestProductView api={api} />;
    case 'notifications':    return <NotificationsView api={api} />;
    default:                 return <StoreHome api={api} currentUser={currentUser} />;
  }
}

/* ================================================================
   STAT CARD (Store version)
   ================================================================ */
function StatCard({ icon: Icon, label, value, gradient }) {
  return (
    <div className={`${gradient} rounded-2xl p-5 text-white card-hover animate-fade-in`}>
      <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center">
        <Icon className="w-5 h-5" />
      </div>
      <p className="mt-4 text-3xl font-extrabold">{value ?? '—'}</p>
      <p className="text-white/70 text-sm font-medium mt-1">{label}</p>
    </div>
  );
}

/* ================================================================
   STORE HOME — welcome, stats, charts, recent price changes
   ================================================================ */
function StoreHome({ api, currentUser }) {
  const [stats, setStats] = useState(null);
  const [topProducts, setTopProducts] = useState([]);
  const [priceChanges, setPriceChanges] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [s, t, p] = await Promise.allSettled([
          api('/store/stats'),
          api('/store/chart/top-products'),
          api('/store/recent-price-changes'),
        ]);
        if (s.status === 'fulfilled') setStats(s.value);
        if (t.status === 'fulfilled') setTopProducts(Array.isArray(t.value) ? t.value : t.value?.data || []);
        if (p.status === 'fulfilled') setPriceChanges(Array.isArray(p.value) ? p.value : p.value?.data || []);
      } catch {}
      setLoading(false);
    };
    load();
  }, [api]);

  if (loading) return <Loader text="Loading dashboard..." />;

  const safeStats = stats || {};
  const safeTop = topProducts.length ? topProducts : [];
  const safePrices = priceChanges.length ? priceChanges : [];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Welcome */}
      <div className="bg-gradient-to-r from-primary to-secondary rounded-2xl p-6 text-white">
        <h2 className="text-2xl font-extrabold">Welcome back, {currentUser.name || 'Store Owner'}!</h2>
        <p className="text-white/70 mt-1">
          {currentUser.store_name ? `Managing ${currentUser.store_name}` : 'Your store dashboard overview'}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard icon={ListOrdered} label="Total Orders" value={safeStats.total_orders ?? 0} gradient="stat-gradient-1" />
        <StatCard icon={ShoppingCart} label="This Month" value={safeStats.this_month ?? 0} gradient="stat-gradient-2" />
        <StatCard icon={Package} label="Pending Deliveries" value={safeStats.pending_deliveries ?? 0} gradient="stat-gradient-3" />
        <StatCard icon={Bookmark} label="Templates Saved" value={safeStats.templates ?? 0} gradient="stat-gradient-4" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top products chart */}
        <div className="bg-white rounded-2xl p-5 shadow-card card-hover">
          <h3 className="font-bold text-midnight mb-4 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-primary" />
            Most Selected Products
          </h3>
          {safeTop.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 text-gray-400">
              <BarChart3 className="w-10 h-10 mb-2 opacity-30" />
              <p className="text-sm">No selected products data available</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={safeTop} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: '#94a3b8' }} width={100} />
                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />
                <Bar dataKey="count" fill="#4F46E5" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Recent price changes */}
        <div className="bg-white rounded-2xl p-5 shadow-card card-hover">
          <h3 className="font-bold text-midnight mb-4 flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-warning" />
            Recent Price Changes
          </h3>
          {safePrices.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-gray-400">
              <DollarSign className="w-10 h-10 mb-2 opacity-30" />
              <p className="text-sm">No recent price changes</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {safePrices.slice(0, 6).map((pc, i) => {
                const increased = parseFloat(pc.new_price) > parseFloat(pc.old_price);
                return (
                  <div key={i} className="flex items-center gap-3 py-2.5">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${increased ? 'bg-red-50' : 'bg-green-50'}`}>
                      {increased ? <ArrowUpRight className="w-4 h-4 text-danger" /> : <ArrowDownRight className="w-4 h-4 text-success" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-midnight truncate">{pc.product_name || pc.product}</p>
                      <p className="text-xs text-gray-400">₹{parseFloat(pc.old_price).toFixed(2)} → ₹{parseFloat(pc.new_price).toFixed(2)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ================================================================
   MAKE SELECTION VIEW — product grid with quantity inputs + cart
   ================================================================ */
function MakeSelectionView({ api, currentUser, cart, setCart, existingSelection, setExistingSelection }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [confirmModal, setConfirmModal] = useState(false);
  const [saveTemplateModal, setSaveTemplateModal] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'list'

  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [prods, sel, tmpl] = await Promise.allSettled([
          api('/products'),
          api('/selections/cart'),
          api('/templates'),
        ]);
        if (prods.status === 'fulfilled') {
          const p = Array.isArray(prods.value) ? prods.value : prods.value?.products || prods.value?.data || [];
          setProducts(p);
        }
        if (Object.keys(cart).length === 0) {
          if (sel.status === 'fulfilled' && sel.value && (sel.value.id || sel.value._id || sel.value.status)) {
            setExistingSelection(sel.value);
            // Populate cart from existing selection
            const items = sel.value.items || [];
            const c = {};
            items.forEach((item) => { c[item.product_id || item.id] = item.quantity || 0; });
            setCart(c);
          }
        }
        if (tmpl.status === 'fulfilled') setTemplates(Array.isArray(tmpl.value) ? tmpl.value : tmpl.value?.data || []);
      } catch {}
      setLoading(false);
    };
    load();
  }, [api]);

  const categories = useMemo(() => {
    return [...new Set(products.map((p) => p.category).filter(Boolean))].sort();
  }, [products]);

  const filtered = useMemo(() => {
    return products.filter((p) => {
      const matchSearch = !search || p.name?.toLowerCase().includes(search.toLowerCase());
      const matchCat = !catFilter || p.category === catFilter;
      return matchSearch && matchCat;
    });
  }, [products, search, catFilter]);

  const cartItems = useMemo(() => {
    return Object.entries(cart)
      .filter(([, qty]) => qty > 0)
      .map(([pid, qty]) => {
        const p = products.find((pr) => (pr.id || pr._id) == pid);
        return p ? { ...p, quantity: qty } : null;
      })
      .filter(Boolean);
  }, [cart, products]);

  const cartTotal = cartItems.reduce((sum, item) => sum + (parseFloat(item.price || 0) * item.quantity), 0);

  const updateQty = (productId, delta) => {
    setCart((prev) => {
      const curr = prev[productId] || 0;
      const next = Math.max(0, curr + delta);
      return { ...prev, [productId]: next };
    });
  };

  const setQty = (productId, value) => {
    const num = parseInt(value) || 0;
    setCart((prev) => ({ ...prev, [productId]: Math.max(0, num) }));
  };

  const handleSubmit = async (isDraft = false) => {
    setSubmitting(true);
    try {
      const items = cartItems.map((item) => ({
        product_id: item.id || item._id,
        quantity: item.quantity,
      }));
      const selectionDate = existingSelection?.date || existingSelection?.selection_date || today;
      const data = await api('/selections', {
        method: 'POST',
        body: JSON.stringify({ id: existingSelection?.id, date: selectionDate, items, status: isDraft ? 'draft' : 'submitted' }),
      });
      
      if (isDraft) {
        setExistingSelection(data);
        alert('Draft selection saved successfully!');
      } else {
        // Clear cart and active draft since checkout is complete!
        setCart({});
        setExistingSelection(null);
        alert('Order submitted successfully! You can continue shopping or view your order in "My Orders" tab.');
      }
      setConfirmModal(false);
    } catch (err) {
      alert(err.message || 'Failed to submit selection.');
    } finally {
      setSubmitting(false);
    }
  };

  const loadTemplate = (tmpl) => {
    const items = tmpl.items || [];
    const c = {};
    items.forEach((item) => { c[item.product_id || item.id] = item.quantity || 1; });
    setCart(c);
  };

  const saveAsTemplate = async () => {
    try {
      const items = cartItems.map((item) => ({
        product_id: item.id || item._id,
        quantity: item.quantity,
        product_name: item.name,
      }));
      await api('/templates', { method: 'POST', body: JSON.stringify({ name: templateName, items }) });
      setSaveTemplateModal(false);
      setTemplateName('');
      // Reload templates immediately
      const tmplData = await api('/templates');
      setTemplates(Array.isArray(tmplData) ? tmplData : tmplData?.data || []);
    } catch {}
  };

  if (loading) return <Loader text="Loading products..." />;

  return (
    <div className="animate-fade-in">
      {/* Date and status header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-5">
        <div>
          <h3 className="text-lg font-bold text-midnight">
            Select Products to Order
          </h3>
          <p className="text-xs text-gray-400 mt-0.5">
            Add items to your cart and place orders at any time. Placed orders are logged in your Order History.
          </p>
        </div>
      </div>

      {existingSelection && (
        <div className="bg-indigo-50 border border-indigo-200/50 rounded-2xl p-4 mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center text-primary">
              <PlusCircle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-midnight">
                Editing selection for {existingSelection.date ? new Date(existingSelection.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'Order'}
              </p>
              <p className="text-xs text-gray-400">
                Status: <span className="font-semibold text-primary">{(existingSelection.status || 'draft').toUpperCase()}</span>
              </p>
            </div>
          </div>
          <button onClick={() => { setCart({}); setExistingSelection(null); }} className="px-4 py-2 rounded-xl text-xs font-semibold text-danger bg-red-50 hover:bg-red-100 transition-colors cursor-pointer border-0">
            Cancel Edit & Clear
          </button>
        </div>
      )}

      {/* Active selection mode — ALWAYS open and active! */}
      <div className="flex flex-col lg:flex-row gap-5">
        {/* Product list */}
        <div className="flex-1 space-y-4">
          {/* Search + filter + template */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="text" placeholder="Search products..." value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm" />
            </div>
            <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)}
              className="px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-700">
              <option value="">All Categories</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            {templates.length > 0 && (
              <select onChange={(e) => { const t = templates.find((t) => (t.id || t._id) == e.target.value); if (t) { loadTemplate(t); e.target.value = ""; } }}
                className="px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-700" defaultValue="">
                <option value="" disabled>Load Template</option>
                {templates.map((t) => <option key={t.id || t._id} value={t.id || t._id}>{t.name}</option>)}
              </select>
            )}

            {/* Amazon-style View Toggle */}
            <div className="flex items-center bg-slate-100 border border-slate-200/50 rounded-xl p-0.5 shadow-inner sm:ml-auto self-start sm:self-auto flex-shrink-0">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                title="Grid View"
                className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                  viewMode === 'grid'
                    ? 'bg-white text-primary shadow-sm font-bold'
                    : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                title="List View"
                className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                  viewMode === 'list'
                    ? 'bg-white text-primary shadow-sm font-bold'
                    : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                <List className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Product grid/list */}
          {filtered.length === 0 ? (
            <EmptyState icon={PackageSearch} title="No products found" message="Try a different search term." />
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
              {filtered.map((p) => {
                const pid = p.id || p._id;
                const qty = cart[pid] || 0;
                const outOfStock = (p.stock || 0) <= 0;
                const lowStock = (p.stock || 0) > 0 && (p.stock || 0) <= 10;
                const zone = p.zone || 'A';
                const ratingScore = (((p.id || 1) * 3) % 10) * 0.1 + 4.1;
                const ratingCount = (((p.id || 1) * 17) % 180) + 24;
                const discount = 15;
                const originalPrice = parseFloat(p.price || 0) / (1 - (discount / 100));
                
                const zoneColors = {
                  A: 'bg-indigo-100 text-primary',
                  B: 'bg-teal-100 text-teal-700',
                  C: 'bg-amber-100 text-amber-700',
                  D: 'bg-rose-100 text-rose-700',
                };

                return (
                  <div key={pid} className={`bg-white rounded-2xl shadow-card hover:shadow-lg hover:-translate-y-0.5 overflow-hidden border border-slate-100/50 transition-all duration-300 flex flex-col group ${outOfStock ? 'opacity-65' : ''} h-full`}>
                    {/* Centered Image Container */}
                    <div className="relative h-44 bg-white flex items-center justify-center p-3 border-b border-slate-50 overflow-hidden flex-shrink-0">
                      {p.image_url && (
                        <img 
                          src={p.image_url} 
                          alt={p.name} 
                          className="max-h-full max-w-full object-contain group-hover:scale-103 transition-transform duration-500 mx-auto"
                          onError={(e) => {
                            e.target.onerror = null;
                            e.target.style.display = 'none';
                            const sibling = e.target.nextSibling;
                            if (sibling) sibling.style.display = 'flex';
                          }}
                        />
                      )}
                      <div 
                        className="w-full h-full flex items-center justify-center bg-slate-50 rounded-xl"
                        style={{ display: p.image_url ? 'none' : 'flex' }}
                      >
                        <Package className="w-10 h-10 text-slate-300" />
                      </div>
                      {/* Zone Badge */}
                      <div className={`absolute top-2 right-2 px-2 py-0.5 rounded-lg text-[9px] font-extrabold ${zoneColors[zone] || 'bg-gray-100 text-gray-700'} shadow-sm flex items-center gap-1`}>
                        <MapPin className="w-2.5 h-2.5" />
                        Zone {zone}
                      </div>
                    </div>

                    {/* Content */}
                    <div className="p-4 flex flex-col flex-1">
                      {/* Category and stock status */}
                      <div className="flex flex-wrap gap-1.5 items-center justify-between mb-2">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-50 border border-slate-100 text-slate-400 text-[10px] font-semibold">
                          <Tag className="w-2.5 h-2.5" />
                          {p.category || 'General'}
                        </span>
                        {outOfStock ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-red-50 text-danger text-[9px] font-extrabold uppercase">
                            Out of Stock
                          </span>
                        ) : lowStock ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-orange-50 text-warning text-[9px] font-extrabold uppercase">
                            Low Stock ({getStockText(p)} left)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 text-[9px] font-extrabold uppercase">
                            In Stock ({getStockText(p)} left)
                          </span>
                        )}
                      </div>

                      {/* Name */}
                      <h4 className="font-extrabold text-midnight text-sm sm:text-base leading-tight mb-1 line-clamp-2 min-h-[40px] hover:text-primary transition-colors cursor-pointer" title={p.name}>
                        {p.name}
                      </h4>

                      {/* Ratings */}
                      <div className="flex items-center gap-1 mb-2.5">
                        <div className="flex items-center text-amber-500 bg-amber-50 px-1.5 py-0.5 rounded-md">
                          <Star className="w-3 h-3 fill-current" />
                          <span className="text-[10px] font-black ml-0.5">{ratingScore.toFixed(1)}</span>
                        </div>
                        <span className="text-[9px] text-gray-400 font-bold">({ratingCount} reviews)</span>
                      </div>

                      {/* Description */}
                      {p.description && (
                        <p className="text-xs text-gray-400 line-clamp-2 mb-3 min-h-[32px]">
                          {p.description}
                        </p>
                      )}

                      {/* Price row */}
                      <div className="flex items-baseline gap-1.5 mb-3.5 mt-auto">
                        <span className="text-xl font-black text-midnight">
                          ₹{parseFloat(p.bulk_conversion > 1 ? p.price * p.bulk_conversion : p.price || 0).toFixed(2)}
                          <span className="text-[10px] text-gray-400 font-normal"> / {p.bulk_conversion > 1 ? (p.bulk_unit_name || 'Box') : (p.unit_name || 'Pc')}</span>
                        </span>
                        <span className="text-[10px] text-gray-400 line-through">₹{((p.bulk_conversion > 1 ? p.price * p.bulk_conversion : p.price || 0) * 1.15).toFixed(2)}</span>
                        <span className="text-[9px] text-emerald-500 font-bold bg-emerald-50 px-1.5 py-0.5 rounded-md">{discount}% off</span>
                      </div>

                      {/* Call-to-Action Button / Quantity Control */}
                      <div className="pt-3 border-t border-slate-100 mt-auto">
                        {cart[pid] === undefined ? (
                          <button
                            onClick={() => setCart(prev => ({ ...prev, [pid]: 0 }))}
                            disabled={outOfStock}
                            className="w-full py-2 rounded-xl border border-primary text-primary hover:bg-primary hover:text-white text-xs font-bold transition-all duration-300 disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-primary flex items-center justify-center gap-1 cursor-pointer bg-white"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            Select for Today
                          </button>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
                            {p.bulk_conversion > 1 ? (
                              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                {/* Bulk Unit Box Input */}
                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                                  <label style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', textAlign: 'center' }}>{p.bulk_unit_name || 'Box'}</label>
                                  <input
                                    type="number"
                                    min="0"
                                    value={Math.floor(qty / p.bulk_conversion)}
                                    onChange={(e) => {
                                      const box = Math.max(0, parseInt(e.target.value) || 0);
                                      const pcs = qty % p.bulk_conversion;
                                      setQty(pid, box * p.bulk_conversion + pcs);
                                    }}
                                    className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-center"
                                  />
                                </div>
                                {/* Base Unit Pieces Input */}
                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                                  <label style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', textAlign: 'center' }}>{p.unit_name || 'Pcs'}</label>
                                  <input
                                    type="number"
                                    min="0"
                                    value={qty % p.bulk_conversion}
                                    onChange={(e) => {
                                      const pcs = Math.max(0, parseInt(e.target.value) || 0);
                                      const box = Math.floor(qty / p.bulk_conversion);
                                      setQty(pid, box * p.bulk_conversion + pcs);
                                    }}
                                    className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-center"
                                  />
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center justify-between gap-1.5 bg-slate-100/80 border border-slate-200/50 rounded-xl p-1 shadow-inner animate-fade-in">
                                <button
                                  onClick={() => updateQty(pid, -1)}
                                  className="w-7 h-7 rounded-lg bg-white hover:bg-slate-100 flex items-center justify-center transition-colors shadow-sm cursor-pointer border border-slate-200/30"
                                >
                                  <Minus className="w-3.5 h-3.5 text-slate-600" />
                                </button>
                                <div className="flex items-center gap-1 flex-1 justify-center">
                                  <span className="text-[10px] text-slate-400 font-bold uppercase">{p.unit_name || 'Pcs'}:</span>
                                  <input
                                    type="number"
                                    value={qty}
                                    onChange={(e) => setQty(pid, e.target.value)}
                                    className="w-8 text-center bg-transparent border-none text-xs font-extrabold text-midnight p-0 outline-none font-sans"
                                  />
                                </div>
                                <button
                                  onClick={() => updateQty(pid, 1)}
                                  className="w-7 h-7 rounded-lg bg-white hover:bg-slate-100 flex items-center justify-center transition-colors shadow-sm cursor-pointer border border-slate-200/30"
                                >
                                  <Plus className="w-3.5 h-3.5 text-slate-600" />
                                </button>
                              </div>
                            )}
                            
                            {/* Revert Selection Link */}
                            <button
                              onClick={() => setQty(pid, 0)}
                              className="text-[10px] font-bold text-rose-500 hover:text-rose-700 bg-transparent border-none p-0 mt-1 cursor-pointer self-center"
                            >
                              Remove Selection
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {filtered.map((p) => {
                const pid = p.id || p._id;
                const qty = cart[pid] || 0;
                const outOfStock = (p.stock || 0) <= 0;
                const lowStock = (p.stock || 0) > 0 && (p.stock || 0) <= 10;
                const zone = p.zone || 'A';
                const ratingScore = (((p.id || 1) * 3) % 10) * 0.1 + 4.1;
                const ratingCount = (((p.id || 1) * 17) % 180) + 24;
                const discount = 15;
                const originalPrice = parseFloat(p.price || 0) / (1 - (discount / 100));
                
                const zoneColors = {
                  A: 'bg-indigo-100 text-primary',
                  B: 'bg-teal-100 text-teal-700',
                  C: 'bg-amber-100 text-amber-700',
                  D: 'bg-rose-100 text-rose-700',
                };

                return (
                  <div key={pid} className={`bg-white rounded-2xl shadow-card hover:shadow-md overflow-hidden border border-slate-100/50 transition-all duration-300 flex flex-col sm:flex-row group ${outOfStock ? 'opacity-65' : ''} w-full`}>
                    {/* Centered Image Container on Left */}
                    <div className="relative w-full sm:w-[180px] aspect-[16/10] sm:aspect-square bg-white flex items-center justify-center p-3 border-r border-slate-50 overflow-hidden flex-shrink-0">
                      {p.image_url && (
                        <img 
                          src={p.image_url} 
                          alt={p.name} 
                          className="max-h-full max-w-full object-contain group-hover:scale-103 transition-transform duration-500 mx-auto"
                          onError={(e) => {
                            e.target.onerror = null;
                            e.target.style.display = 'none';
                            const sibling = e.target.nextSibling;
                            if (sibling) sibling.style.display = 'flex';
                          }}
                        />
                      )}
                      <div 
                        className="w-full h-full flex items-center justify-center bg-slate-50 rounded-xl"
                        style={{ display: p.image_url ? 'none' : 'flex' }}
                      >
                        <Package className="w-12 h-12 text-gray-200" />
                      </div>
                      {/* Zone Badge */}
                      <div className={`absolute top-2 left-2 px-2 py-0.5 rounded-lg text-[9px] font-extrabold ${zoneColors[zone] || 'bg-gray-100 text-gray-700'} shadow-sm flex items-center gap-1`}>
                        <MapPin className="w-2.5 h-2.5" />
                        Zone {zone}
                      </div>
                    </div>

                    {/* Right Details container */}
                    <div className="p-5 flex-1 flex flex-col justify-between">
                      <div>
                        {/* Category and stock */}
                        <div className="flex flex-wrap gap-1.5 items-center justify-between mb-2">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-50 border border-slate-100 text-slate-400 text-[10px] font-semibold">
                            <Tag className="w-2.5 h-2.5" />
                            {p.category || 'General'}
                          </span>
                          {outOfStock ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-red-50 text-danger text-[9px] font-extrabold uppercase">
                              Out of Stock
                            </span>
                          ) : lowStock ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-orange-50 text-warning text-[9px] font-extrabold uppercase">
                              Low Stock ({getStockText(p)} left)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 text-[9px] font-extrabold uppercase">
                              In Stock ({getStockText(p)} left)
                            </span>
                          )}
                        </div>

                        {/* Name */}
                        <h4 className="font-extrabold text-midnight text-base sm:text-lg leading-snug mb-1">
                          {p.name}
                        </h4>

                        {/* Ratings */}
                        <div className="flex items-center gap-1.5 mb-2.5">
                          <div className="flex items-center text-amber-500 bg-amber-50 px-1.5 py-0.5 rounded-md">
                            <Star className="w-3 h-3 fill-current" />
                            <span className="text-[10px] font-black ml-0.5">{ratingScore.toFixed(1)}</span>
                          </div>
                          <span className="text-[10px] text-gray-400 font-bold">({ratingCount} reviews)</span>
                        </div>

                        {/* Description */}
                        {p.description && (
                          <p className="text-xs text-gray-400 mb-3 line-clamp-2 max-w-xl">
                            {p.description}
                          </p>
                        )}
                      </div>

                      {/* Footer row */}
                      <div className="flex flex-wrap items-center justify-between pt-4 border-t border-slate-100 gap-4 mt-3">
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <p className="text-2xl font-black text-midnight">
                            ₹{parseFloat(p.bulk_conversion > 1 ? p.price * p.bulk_conversion : p.price || 0).toFixed(2)}
                            <span className="text-xs text-gray-400 font-normal"> / {p.bulk_conversion > 1 ? (p.bulk_unit_name || 'Box') : (p.unit_name || 'Pc')}</span>
                          </p>
                          <span className="text-xs text-gray-400 line-through">₹{((p.bulk_conversion > 1 ? p.price * p.bulk_conversion : p.price || 0) * 1.15).toFixed(2)}</span>
                          <span className="text-[10px] text-emerald-500 font-bold bg-emerald-50 px-2 py-0.5 rounded-md">{discount}% off</span>
                        </div>

                        {/* Interactive Quantity Control */}
                        <div>
                          {cart[pid] === undefined ? (
                            <button
                              onClick={() => setCart(prev => ({ ...prev, [pid]: 0 }))}
                              disabled={outOfStock}
                              className="px-5 py-2 rounded-xl border border-primary text-primary hover:bg-primary hover:text-white text-xs font-bold transition-all duration-300 disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-primary flex items-center gap-1.5 cursor-pointer bg-white"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              Select for Today
                            </button>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: '100%', maxWidth: '180px' }}>
                              {p.bulk_conversion > 1 ? (
                                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                  {/* Bulk Unit Box Input */}
                                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
                                    <label style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', textAlign: 'center' }}>{p.bulk_unit_name || 'Box'}</label>
                                    <input
                                      type="number"
                                      min="0"
                                      value={Math.floor(qty / p.bulk_conversion)}
                                      onChange={(e) => {
                                        const box = Math.max(0, parseInt(e.target.value) || 0);
                                        const pcs = qty % p.bulk_conversion;
                                        setQty(pid, box * p.bulk_conversion + pcs);
                                      }}
                                      className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-center"
                                    />
                                  </div>
                                  {/* Base Unit Pieces Input */}
                                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
                                    <label style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', textAlign: 'center' }}>{p.unit_name || 'Pcs'}</label>
                                    <input
                                      type="number"
                                      min="0"
                                      value={qty % p.bulk_conversion}
                                      onChange={(e) => {
                                        const pcs = Math.max(0, parseInt(e.target.value) || 0);
                                        const box = Math.floor(qty / p.bulk_conversion);
                                        setQty(pid, box * p.bulk_conversion + pcs);
                                      }}
                                      className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-center"
                                    />
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1.5 bg-slate-100/80 border border-slate-200/50 rounded-xl p-1 shadow-inner animate-fade-in">
                                  <button
                                    onClick={() => updateQty(pid, -1)}
                                    className="w-8 h-8 rounded-lg bg-white hover:bg-slate-100 flex items-center justify-center transition-colors shadow-sm cursor-pointer border border-slate-200/30"
                                  >
                                    <Minus className="w-3.5 h-3.5 text-slate-600" />
                                  </button>
                                  <div className="flex items-center gap-1 px-2">
                                    <span className="text-[10px] text-slate-400 font-bold uppercase">{p.unit_name || 'Pcs'}:</span>
                                    <input
                                      type="number"
                                      value={qty}
                                      onChange={(e) => setQty(pid, e.target.value)}
                                      className="w-8 text-center bg-transparent border-none text-xs font-extrabold text-midnight p-0 outline-none"
                                    />
                                  </div>
                                  <button
                                    onClick={() => updateQty(pid, 1)}
                                    className="w-8 h-8 rounded-lg bg-white hover:bg-slate-100 flex items-center justify-center transition-colors shadow-sm cursor-pointer border border-slate-200/30"
                                  >
                                    <Plus className="w-3.5 h-3.5 text-slate-600" />
                                  </button>
                                </div>
                              )}
                              <button
                                onClick={() => setQty(pid, 0)}
                                className="text-[9px] font-bold text-rose-500 hover:text-rose-700 bg-transparent border-none p-0 mt-0.5 cursor-pointer self-center"
                              >
                                Remove Selection
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Cart sidebar */}
        <div className="lg:w-80 flex-shrink-0">
          <div className="bg-white rounded-2xl shadow-card p-5 sticky top-4 border border-slate-100">
            <h3 className="font-bold text-midnight mb-4 flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-primary" />
              Cart Summary
            </h3>

            {cartItems.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <ShoppingCart className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Your cart is empty</p>
                <p className="text-xs mt-1">Add products from the list</p>
              </div>
            ) : (
              <>
                <div className="divide-y divide-gray-50 max-h-[40vh] overflow-y-auto mb-4">
                  {cartItems.map((item) => (
                    <div key={item.id || item._id} className="flex items-center justify-between py-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-midnight truncate">{item.name}</p>
                        <p className="text-xs text-gray-400">
                          {item.bulk_conversion > 1 ? (
                            <>
                              {(item.quantity / item.bulk_conversion).toFixed(2)} {item.bulk_unit_name || 'Box'} × ₹{(item.price * item.bulk_conversion).toFixed(2)}
                            </>
                          ) : (
                            <>
                              {item.quantity} {item.unit_name || 'Pcs'} × ₹{parseFloat(item.price || 0).toFixed(2)}
                            </>
                          )}
                        </p>
                      </div>
                      <p className="text-sm font-bold text-midnight flex-shrink-0 ml-3">
                        ₹{(parseFloat(item.price || 0) * item.quantity).toFixed(2)}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="border-t border-gray-100 pt-3 mb-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-semibold text-gray-500">Total ({cartItems.length} items)</span>
                    <span className="text-xl font-extrabold text-midnight">₹{cartTotal.toFixed(2)}</span>
                  </div>
                </div>
              </>
            )}

            <div className="space-y-2.5">
              <button onClick={() => handleSubmit(true)} disabled={cartItems.length === 0 || submitting}
                className="w-full py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-40 flex items-center justify-center gap-2 cursor-pointer bg-white">
                <Save className="w-4 h-4" />
                Save Draft
              </button>
              <button onClick={() => setConfirmModal(true)} disabled={cartItems.length === 0 || submitting}
                className="btn-glow w-full py-2.5 rounded-xl bg-primary text-white text-sm font-semibold disabled:opacity-40 flex items-center justify-center gap-2 cursor-pointer shadow-md">
                <Send className="w-4 h-4" />
                Submit Final
              </button>
              <button onClick={() => { setTemplateName(''); setSaveTemplateModal(true); }}
                disabled={cartItems.length === 0}
                className="w-full py-2 rounded-xl text-xs font-medium text-primary hover:bg-indigo-50 transition-colors disabled:opacity-40 flex items-center justify-center gap-1.5 cursor-pointer">
                <Bookmark className="w-3.5 h-3.5" />
                Save as Template
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Confirm submit modal */}
      <Modal open={confirmModal} onClose={() => setConfirmModal(false)} title="Confirm Submission">
        <div className="text-center">
          <div className="w-14 h-14 rounded-full bg-indigo-50 flex items-center justify-center mx-auto mb-4">
            <Send className="w-7 h-7 text-primary" />
          </div>
          <p className="text-gray-700 mb-2">Submit your daily selection?</p>
          <p className="text-sm text-gray-400 mb-6">{cartItems.length} items · ₹{cartTotal.toFixed(2)} estimated total</p>
          <div className="flex gap-3">
            <button onClick={() => setConfirmModal(false)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50">Cancel</button>
            <button onClick={() => handleSubmit(false)} disabled={submitting}
              className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold btn-glow disabled:opacity-50">
              {submitting ? 'Submitting...' : 'Confirm Submit'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Save template modal */}
      <Modal open={saveTemplateModal} onClose={() => setSaveTemplateModal(false)} title="Save as Template">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Template Name</label>
            <input value={templateName} onChange={(e) => setTemplateName(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm" placeholder="e.g. Weekly Essentials" />
          </div>
          <p className="text-sm text-gray-400">{cartItems.length} items will be saved in this template.</p>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setSaveTemplateModal(false)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50">Cancel</button>
            <button onClick={saveAsTemplate} disabled={!templateName}
              className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold btn-glow disabled:opacity-50">
              Save Template
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

/* ================================================================
   MY ORDERS VIEW — past selections with status and expand
   ================================================================ */
function MyOrdersView({ api, currentUser, navigateTo, setCart, setExistingSelection }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [issueModal, setIssueModal] = useState(null);
  const [issueForm, setIssueForm] = useState({ product_name: '', issue_type: 'missing', quantity: '', notes: '' });

  useEffect(() => {
    const load = async () => {
      try {
        const data = await api('/selections/mine');
        setOrders(Array.isArray(data) ? data : data?.selections || data?.data || []);
      } catch { setOrders([]); }
      setLoading(false);
    };
    load();
  }, [api]);

  const submitIssue = async () => {
    if (!issueModal) return;
    try {
      await api('/discrepancies', {
        method: 'POST',
        body: JSON.stringify({ ...issueForm, selection_id: issueModal.id || issueModal._id }),
      });
      setIssueModal(null);
      setIssueForm({ product_name: '', issue_type: 'missing', quantity: '', notes: '' });
    } catch {}
  };

  const handleEditOrder = (order) => {
    const c = {};
    (order.items || []).forEach(item => {
      c[item.product_id || item.id] = item.quantity || 0;
    });
    setCart(c);
    setExistingSelection(order);
    navigateTo('make-selection');
  };

  const formatOrderDate = (order) => {
    if (!order.date) return 'Order';
    const dateStr = new Date(order.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    if (order.created_at) {
      try {
        const utcDate = new Date(order.created_at.replace(' ', 'T') + 'Z');
        const timeStr = utcDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        return `${dateStr} (${timeStr})`;
      } catch {
        return dateStr;
      }
    }
    return dateStr;
  };

  if (loading) return <Loader text="Loading orders..." />;
  if (orders.length === 0) return <EmptyState icon={ListOrdered} title="No orders yet" message="Your daily selections will appear here." />;

  const statusOrder = ['draft', 'submitted', 'packed', 'shipped', 'delivered'];

  return (
    <div className="space-y-3 animate-fade-in">
      {orders.map((order) => {
        const isExpanded = expanded === (order.id || order._id);
        const items = order.items || [];
        const total = items.reduce((sum, i) => sum + (parseFloat(i.unit_price || i.price || 0) * (i.quantity || 0)), 0);
        const currentIdx = statusOrder.indexOf(order.status || 'submitted');

        return (
          <div key={order.id || order._id} className="bg-white rounded-2xl shadow-card overflow-hidden card-hover">
            <button onClick={() => setExpanded(isExpanded ? null : (order.id || order._id))}
              className="w-full flex items-center gap-4 px-5 py-4 text-left">
              <div className="flex-1 min-w-0">
                <p className="font-bold text-midnight">
                  {formatOrderDate(order)}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">{items.length} items · ₹{total.toFixed(2)}</p>
              </div>
              <StatusBadge status={order.status || 'submitted'} />

              {/* Progress dots */}
              <div className="hidden sm:flex items-center gap-1">
                {statusOrder.map((step, idx) => (
                  <React.Fragment key={step}>
                    <div className={`w-2 h-2 rounded-full ${idx <= currentIdx ? 'bg-primary' : 'bg-gray-200'}`} />
                    {idx < 4 && <div className={`w-3 h-0.5 ${idx < currentIdx ? 'bg-primary' : 'bg-gray-200'}`} />}
                  </React.Fragment>
                ))}
              </div>

              <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
            </button>

            {isExpanded && (
              <div className="border-t border-gray-50 px-5 py-4 animate-fade-in">
                {items.length > 0 ? (
                  <table className="w-full text-sm mb-4">
                    <thead>
                      <tr className="text-left text-xs text-gray-400 uppercase">
                        <th className="pb-2">Product</th>
                        <th className="pb-2">Qty</th>
                        <th className="pb-2">Price</th>
                        <th className="pb-2">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {items.map((item, idx) => (
                        <tr key={idx}>
                          <td className="py-2 font-medium text-midnight">{item.product_name || item.name}</td>
                          <td className="py-2 text-gray-500">{item.quantity}</td>
                          <td className="py-2 text-gray-500">₹{parseFloat(item.unit_price || item.price || 0).toFixed(2)}</td>
                          <td className="py-2 font-semibold text-midnight">₹{(parseFloat(item.unit_price || item.price || 0) * (item.quantity || 0)).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : <p className="text-sm text-gray-400 mb-4">No items.</p>}

                <div className="flex gap-3">
                  {(order.status === 'draft' || order.status === 'submitted') && (
                    <button onClick={() => handleEditOrder(order)}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl border border-indigo-200 text-primary text-sm font-semibold hover:bg-indigo-50 transition-colors bg-white cursor-pointer">
                      <PlusCircle className="w-4 h-4" />
                      Edit Selection
                    </button>
                  )}

                  {order.status === 'delivered' && (
                    <button onClick={() => setIssueModal(order)}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl border border-orange-200 text-warning text-sm font-semibold hover:bg-orange-50 transition-colors">
                      <AlertTriangle className="w-4 h-4" />
                      Report Issue
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Report Issue Modal */}
      <Modal open={!!issueModal} onClose={() => setIssueModal(null)} title="Report Discrepancy">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Product Name</label>
            <input value={issueForm.product_name} onChange={(e) => setIssueForm({ ...issueForm, product_name: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm" placeholder="Which product?" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Issue Type</label>
              <select value={issueForm.issue_type} onChange={(e) => setIssueForm({ ...issueForm, issue_type: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm">
                <option value="missing">Missing Item</option>
                <option value="damaged">Damaged</option>
                <option value="wrong_item">Wrong Item</option>
                <option value="wrong_quantity">Wrong Quantity</option>
                <option value="quality">Quality Issue</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Quantity</label>
              <input type="number" value={issueForm.quantity} onChange={(e) => setIssueForm({ ...issueForm, quantity: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm" placeholder="0" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Notes</label>
            <textarea value={issueForm.notes} onChange={(e) => setIssueForm({ ...issueForm, notes: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm" rows={3} placeholder="Describe the issue..." />
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setIssueModal(null)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50">Cancel</button>
            <button onClick={submitIssue} disabled={!issueForm.product_name}
              className="flex-1 py-2.5 rounded-xl bg-warning text-white text-sm font-semibold hover:bg-orange-600 transition-colors disabled:opacity-50">
              Submit Report
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

/* ================================================================
   TEMPLATES VIEW — saved selection templates
   ================================================================ */
function TemplatesView({ api }) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await api('/templates');
      setTemplates(Array.isArray(data) ? data : data?.data || []);
    } catch { setTemplates([]); }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [api]);

  const handleDelete = async (id) => {
    try {
      await api(`/templates/${id}`, { method: 'DELETE' });
      loadData();
    } catch {}
  };

  if (loading) return <Loader text="Loading templates..." />;
  if (templates.length === 0) return <EmptyState icon={Bookmark} title="No templates saved" message="Save a selection as a template for quick reuse." />;

  return (
    <div className="space-y-3 animate-fade-in">
      {templates.map((tmpl) => {
        const isExpanded = expanded === (tmpl.id || tmpl._id);
        const items = tmpl.items || [];
        return (
          <div key={tmpl.id || tmpl._id} className="bg-white rounded-2xl shadow-card overflow-hidden card-hover">
            <div className="flex items-center gap-4 px-5 py-4">
              <button onClick={() => setExpanded(isExpanded ? null : (tmpl.id || tmpl._id))} className="flex-1 flex items-center gap-3 text-left">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white flex-shrink-0">
                  <Bookmark className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-midnight">{tmpl.name || 'Untitled Template'}</p>
                  <p className="text-xs text-gray-400">{items.length} items</p>
                </div>
              </button>
              <button onClick={() => handleDelete(tmpl.id || tmpl._id)}
                className="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-danger transition-colors flex-shrink-0">
                <Trash2 className="w-4 h-4" />
              </button>
              <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
            </div>

            {isExpanded && (
              <div className="border-t border-gray-50 px-5 py-4 animate-fade-in">
                {items.length > 0 ? (
                  <div className="divide-y divide-gray-50">
                    {items.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between py-2">
                        <span className="text-sm font-medium text-midnight">{item.product_name || item.name}</span>
                        <span className="text-sm text-gray-500">Qty: {item.quantity}</span>
                      </div>
                    ))}
                  </div>
                ) : <p className="text-sm text-gray-400">No items in this template.</p>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ================================================================
   REQUEST PRODUCT VIEW — form + list of past requests
   ================================================================ */
function RequestProductView({ api }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ product_name: '', description: '' });
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    try {
      const data = await api('/product-requests/mine');
      setRequests(Array.isArray(data) ? data : data?.data || []);
    } catch { setRequests([]); }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [api]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.product_name) return;
    setSubmitting(true);
    try {
      await api('/product-requests', { method: 'POST', body: JSON.stringify(form) });
      setForm({ product_name: '', description: '' });
      loadData();
    } catch {}
    setSubmitting(false);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Form */}
      <div className="bg-white rounded-2xl shadow-card p-5">
        <h3 className="font-bold text-midnight mb-4 flex items-center gap-2">
          <PlusCircle className="w-4 h-4 text-primary" />
          Request a New Product
        </h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Product Name</label>
            <input value={form.product_name} onChange={(e) => setForm({ ...form, product_name: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm" placeholder="What product do you need?" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Description / Notes</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm" rows={3} placeholder="Describe the product, preferred brand, etc." />
          </div>
          <button type="submit" disabled={submitting || !form.product_name}
            className="btn-glow px-6 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold disabled:opacity-50 flex items-center gap-2">
            {submitting ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Send className="w-4 h-4" />}
            Submit Request
          </button>
        </form>
      </div>

      {/* Past requests */}
      <div>
        <h3 className="font-bold text-midnight mb-3">Your Past Requests</h3>
        {loading ? <Loader text="Loading..." /> : requests.length === 0 ? (
          <EmptyState icon={PlusCircle} title="No requests" message="You haven't requested any products yet." />
        ) : (
          <div className="grid gap-3">
            {requests.map((r) => (
              <div key={r.id || r._id} className="bg-white rounded-xl p-4 shadow-card card-hover flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
                  <Package className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-midnight">{r.product_name || r.name}</p>
                  <p className="text-xs text-gray-400 truncate">{r.description || 'No description'}</p>
                </div>
                <StatusBadge status={r.status || 'pending'} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ================================================================
   NOTIFICATIONS VIEW
   ================================================================ */
function NotificationsView({ api }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await api('/notifications');
      setNotifications(Array.isArray(data) ? data : data?.data || []);
    } catch { setNotifications([]); }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [api]);

  const markAllRead = async () => {
    try {
      await api('/notifications/read-all', { method: 'PUT' });
      loadData();
    } catch {}
  };

  const markRead = async (id) => {
    try {
      await api(`/notifications/${id}/read`, { method: 'PUT' });
      loadData();
    } catch {}
  };

  if (loading) return <Loader text="Loading notifications..." />;

  const unread = notifications.filter((n) => !n.read).length;

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      {notifications.length > 0 && unread > 0 && (
        <div className="flex justify-end">
          <button onClick={markAllRead}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-primary hover:bg-indigo-50 transition-colors">
            <Check className="w-4 h-4" />
            Mark All Read ({unread})
          </button>
        </div>
      )}

      {notifications.length === 0 ? (
        <EmptyState icon={Bell} title="All caught up!" message="You don't have any notifications." />
      ) : (
        <div className="grid gap-2">
          {notifications.map((n) => (
            <button
              key={n.id || n._id}
              onClick={() => !n.read && markRead(n.id || n._id)}
              className={`w-full text-left bg-white rounded-xl p-4 shadow-card card-hover flex items-start gap-3 transition-all ${
                !n.read ? 'border-l-4 border-primary bg-indigo-50/30' : ''
              }`}
            >
              <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                !n.read ? 'bg-primary/10' : 'bg-gray-100'
              }`}>
                {n.type === 'price_change' ? <DollarSign className="w-4 h-4 text-primary" /> :
                 n.type === 'order_update' ? <Package className="w-4 h-4 text-secondary" /> :
                 n.type === 'announcement' ? <Star className="w-4 h-4 text-warning" /> :
                 <Bell className="w-4 h-4 text-gray-500" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm ${!n.read ? 'font-bold text-midnight' : 'font-medium text-gray-700'}`}>
                  {n.title || n.message}
                </p>
                {n.title && n.message && <p className="text-xs text-gray-400 mt-0.5">{n.message}</p>}
                <p className="text-xs text-gray-400 mt-1.5 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {n.time || (n.created_at ? new Date(n.created_at).toLocaleString() : '—')}
                </p>
              </div>
              {!n.read && (
                <div className="w-2.5 h-2.5 rounded-full bg-primary flex-shrink-0 mt-2 animate-pulse-soft" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ================================================================
   IMPORT PRODUCTS VIEW
   ================================================================ */
function ImportProductsView({ api, currentUser }) {
  const [file, setFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      const ext = droppedFile.name.split('.').pop().toLowerCase();
      if (ext === 'csv' || ext === 'json') {
        setFile(droppedFile);
        setError('');
        setResult(null);
      } else {
        setError('Only CSV and JSON files are supported.');
      }
    }
  };

  const handleChange = (e) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      const ext = selectedFile.name.split('.').pop().toLowerCase();
      if (ext === 'csv' || ext === 'json') {
        setFile(selectedFile);
        setError('');
        setResult(null);
      } else {
        setError('Only CSV and JSON files are supported.');
      }
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    setError('');
    setResult(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const data = await api('/products/import', {
        method: 'POST',
        body: formData,
      });
      setResult(data);
      setFile(null);
    } catch (err) {
      setError(err.message || 'Failed to import products.');
    } finally {
      setLoading(false);
    }
  };

  const downloadSample = (type) => {
    let content = '';
    let filename = '';
    let mime = '';

    if (type === 'csv') {
      content = 'name,price,stock,category,zone,description,image_url\nOrganic Apples,150.00,50,Fruits,A,Fresh Red Delicious Apples,https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6\nFresh Whole Milk,65.00,100,Dairy,B,Rich organic whole milk,';
      filename = 'sample_products.csv';
      mime = 'text/csv';
    } else {
      content = JSON.stringify([
        {
          name: "Organic Apples",
          price: 150.00,
          stock: 50,
          category: "Fruits",
          zone: "A",
          description: "Fresh Red Delicious Apples",
          image_url: "https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6"
        },
        {
          name: "Fresh Whole Milk",
          price: 65.00,
          stock: 100,
          category: "Dairy",
          zone: "B",
          description: "Rich organic whole milk",
          image_url: ""
        }
      ], null, 2);
      filename = 'sample_products.json';
      mime = 'application/json';
    }

    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
      {/* Welcome header */}
      <div className="bg-gradient-to-r from-indigo-900 to-midnight rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
        <div className="absolute -right-10 -top-10 w-40 h-40 bg-white/5 rounded-full blur-2xl" />
        <h2 className="text-2xl font-extrabold flex items-center gap-2">
          <Upload className="w-6 h-6 text-indigo-300" />
          Import Store Products
        </h2>
        <p className="text-indigo-200 mt-1.5 text-sm max-w-xl">
          Quickly bulk upload your product catalog using a CSV or JSON file. Existing items with the same name will be updated with the new prices and stock numbers.
        </p>
      </div>

      {/* Main Container */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Upload Zone */}
        <div className="md:col-span-2 bg-white rounded-2xl p-6 shadow-card border border-slate-100 flex flex-col justify-between min-h-[350px]">
          <div>
            <h3 className="font-bold text-midnight mb-4">Upload File</h3>
            
            {/* Drag & Drop Box */}
            <div
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center transition-all ${
                dragActive
                  ? 'border-primary bg-indigo-50/50 scale-[0.99]'
                  : file
                  ? 'border-emerald-300 bg-emerald-50/20'
                  : 'border-slate-200 hover:border-slate-300 bg-slate-50/30'
              }`}
            >
              {file ? (
                <>
                  <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mb-4 text-emerald-600 animate-pulse-soft">
                    <FileUp className="w-7 h-7" />
                  </div>
                  <p className="font-bold text-midnight text-sm max-w-xs truncate">{file.name}</p>
                  <p className="text-xs text-gray-400 mt-1">{(file.size / 1024).toFixed(1)} KB</p>
                  <button
                    onClick={() => setFile(null)}
                    className="mt-4 px-3 py-1 text-xs font-semibold text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                  >
                    Remove File
                  </button>
                </>
              ) : (
                <>
                  <div className="w-14 h-14 rounded-full bg-indigo-50 flex items-center justify-center mb-4 text-primary">
                    <Upload className="w-7 h-7" />
                  </div>
                  <p className="font-bold text-midnight text-sm">Drag and drop your file here</p>
                  <p className="text-xs text-gray-400 mt-1">Supports CSV and JSON files (Max 5MB)</p>
                  
                  <label className="mt-4 px-4 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-bold shadow-sm cursor-pointer transition-colors">
                    Browse Files
                    <input
                      type="file"
                      accept=".csv,.json"
                      onChange={handleChange}
                      className="hidden"
                    />
                  </label>
                </>
              )}
            </div>

            {error && (
              <div className="mt-4 p-3 bg-rose-50 border border-rose-100 rounded-xl text-xs font-semibold text-rose-600 flex items-center gap-2 animate-fade-in">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}
          </div>

          <div className="mt-6 flex justify-end">
            <button
              onClick={handleUpload}
              disabled={loading || !file}
              className="px-6 py-3 bg-primary hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-glow flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Start Import
                </>
              )}
            </button>
          </div>
        </div>

        {/* Formats and Guidelines */}
        <div className="bg-white rounded-2xl p-6 shadow-card border border-slate-100 space-y-5">
          <h3 className="font-bold text-midnight">Format Instructions</h3>
          
          <div className="space-y-4 text-xs">
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
              <p className="font-bold text-midnight mb-2">Required Fields</p>
              <ul className="list-disc list-inside space-y-1 text-slate-500 font-medium">
                <li><code className="bg-white px-1 py-0.5 rounded border">name</code> / <code className="bg-white px-1 py-0.5 rounded border">product_name</code></li>
                <li><code className="bg-white px-1 py-0.5 rounded border">price</code> / <code className="bg-white px-1 py-0.5 rounded border">current_price</code></li>
                <li><code className="bg-white px-1 py-0.5 rounded border">stock</code> / <code className="bg-white px-1 py-0.5 rounded border">stock_quantity</code></li>
              </ul>
            </div>

            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
              <p className="font-bold text-midnight mb-2">Optional Fields</p>
              <ul className="list-disc list-inside space-y-1 text-slate-500 font-medium">
                <li><code className="bg-white px-1 py-0.5 rounded border">category</code> (e.g. Fruits, Dairy)</li>
                <li><code className="bg-white px-1 py-0.5 rounded border">zone</code> (A, B, C, D)</li>
                <li><code className="bg-white px-1 py-0.5 rounded border">description</code></li>
                <li><code className="bg-white px-1 py-0.5 rounded border">image_url</code></li>
              </ul>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 space-y-2">
            <p className="text-xs font-bold text-slate-400 uppercase">Download Templates</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => downloadSample('csv')}
                className="py-2.5 px-3 bg-slate-50 hover:bg-slate-100 rounded-xl text-xs font-bold text-slate-700 flex items-center justify-center gap-1.5 border border-slate-100 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                CSV Sample
              </button>
              <button
                onClick={() => downloadSample('json')}
                className="py-2.5 px-3 bg-slate-50 hover:bg-slate-100 rounded-xl text-xs font-bold text-slate-700 flex items-center justify-center gap-1.5 border border-slate-100 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                JSON Sample
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Results Section */}
      {result && (
        <div className="bg-white rounded-2xl p-6 shadow-card border border-slate-100 animate-slide-up space-y-6">
          <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
            <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
              <Check className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-midnight">Import Results</h3>
              <p className="text-xs text-emerald-600 font-semibold">{result.message}</p>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-emerald-50/30 border border-emerald-100/50 rounded-2xl p-4 text-center">
              <p className="text-2xl font-black text-emerald-600">{result.imported}</p>
              <p className="text-xs font-bold text-slate-400 uppercase mt-1">Imported</p>
            </div>
            <div className="bg-amber-50/30 border border-amber-100/50 rounded-2xl p-4 text-center">
              <p className="text-2xl font-black text-warning">{result.skipped}</p>
              <p className="text-xs font-bold text-slate-400 uppercase mt-1">Skipped / Failed</p>
            </div>
            <div className="bg-slate-50 rounded-2xl p-4 text-center">
              <p className="text-2xl font-black text-midnight">{result.imported + result.skipped}</p>
              <p className="text-xs font-bold text-slate-400 uppercase mt-1">Total Processed</p>
            </div>
          </div>

          {/* Errors Log */}
          {result.errors && result.errors.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-bold text-rose-500 uppercase flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                Error Logs (Showing first {result.errors.length})
              </p>
              <div className="bg-rose-50/20 border border-rose-100/30 rounded-xl p-4 font-mono text-[11px] text-rose-600 space-y-1.5 max-h-[180px] overflow-y-auto">
                {result.errors.map((err, idx) => (
                  <p key={idx} className="leading-tight">• {err}</p>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
