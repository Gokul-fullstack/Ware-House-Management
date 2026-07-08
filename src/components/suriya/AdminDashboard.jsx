import React, { useState, useEffect, useMemo } from 'react';
import {
  Package, Users, ShoppingCart, TrendingUp, Plus, Search, Filter,
  Edit3, Trash2, Check, X, ChevronLeft, ChevronRight, ArrowUpRight,
  ArrowDownRight, Eye, AlertTriangle, MapPin, Clock, Bell, RefreshCw,
  Megaphone, FileText, CheckCircle, XCircle, PackageCheck, Truck,
  PackageOpen, ClipboardList, DollarSign, Activity, BarChart3, Star, Download
} from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { StatusBadge, Loader, EmptyState, Modal } from '../App';

/* ================================================================
   ADMIN DASHBOARD — renders sub-pages based on currentPage prop
   ================================================================ */
export default function AdminDashboard({ currentPage, api, currentUser }) {
  switch (currentPage) {
    case 'dashboard':       return <DashboardHome api={api} />;
    case 'products':        return <ProductsView api={api} />;
    case 'price-history':   return <PriceHistoryView api={api} />;
    case 'users':           return <UsersView api={api} />;
    case 'daily-selections':return <DailySelectionsView api={api} />;
    case 'discrepancies':   return <DiscrepanciesView api={api} />;
    case 'product-requests':return <ProductRequestsView api={api} />;
    case 'announcements':   return <AnnouncementsView api={api} />;
    case 'notifications':   return <NotificationsView api={api} />;
    case 'audit-logs':      return <AuditLogsView api={api} />;
    default:                return <DashboardHome api={api} />;
  }
}

/* ================================================================
   REUSABLE: STAT CARD
   ================================================================ */
function StatCard({ icon: Icon, label, value, gradient, trend }) {
  return (
    <div className={`${gradient} rounded-2xl p-5 text-white card-hover stat-card-interactive animate-fade-in`}>
      <div className="flex items-start justify-between">
        <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center">
          <Icon className="w-5 h-5" />
        </div>
        {trend !== undefined && (
          <span className={`flex items-center gap-0.5 text-xs font-semibold px-2 py-1 rounded-full ${
            trend >= 0 ? 'bg-white/20 text-white' : 'bg-white/20 text-white'
          }`}>
            {trend >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {Math.abs(trend)}%
          </span>
        )}
      </div>
      <p className="mt-4 text-3xl font-extrabold">{value ?? '—'}</p>
      <p className="text-white/70 text-sm font-medium mt-1">{label}</p>
    </div>
  );
}

/* ================================================================
   DASHBOARD HOME — stats, charts, activity feed
   ================================================================ */
function DashboardHome({ api }) {
  const [stats, setStats] = useState(null);
  const [chartData, setChartData] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [s, c, t, a] = await Promise.allSettled([
          api('/admin/stats'),
          api('/admin/chart/daily-selections'),
          api('/admin/chart/top-products'),
          api('/admin/activity'),
        ]);
        if (s.status === 'fulfilled') setStats(s.value);
        if (c.status === 'fulfilled') setChartData(Array.isArray(c.value) ? c.value : c.value?.data || []);
        if (t.status === 'fulfilled') setTopProducts(Array.isArray(t.value) ? t.value : t.value?.data || []);
        if (a.status === 'fulfilled') setActivity(Array.isArray(a.value) ? a.value : a.value?.data || []);
      } catch {}
      setLoading(false);
    };
    load();
  }, [api]);

  if (loading) return <Loader text="Loading dashboard..." />;

  // Fallback demo data when backend is unavailable
  const safeStats = stats || {};
  const safeChart = chartData.length ? chartData : [];
  const safeTop = topProducts.length ? topProducts : [];
  const safeActivity = activity.length ? activity : [];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard icon={Package} label="Total Products" value={safeStats.total_products ?? 0} gradient="stat-gradient-1" />
        <StatCard icon={Users} label="Total Users" value={safeStats.total_users ?? 0} gradient="stat-gradient-2" />
        <StatCard icon={ShoppingCart} label="Today's Selections" value={safeStats.todays_selections ?? 0} gradient="stat-gradient-3" />
        <StatCard icon={Clock} label="Pending Approvals" value={safeStats.pending_approvals ?? 0} gradient="stat-gradient-4" />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Line chart — daily selections */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-5 shadow-card card-hover">
          <h3 className="font-bold text-midnight mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            Daily Selection Volume (14 Days)
          </h3>
          {safeChart.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <TrendingUp className="w-10 h-10 mb-2 opacity-30" />
              <p className="text-sm">No selection volume data available</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={safeChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <Tooltip
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
                />
                <Line type="monotone" dataKey="selections" stroke="#4F46E5" strokeWidth={2.5} dot={{ r: 3, fill: '#4F46E5' }} activeDot={{ r: 6, fill: '#4F46E5', stroke: '#fff', strokeWidth: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Bar chart — top products */}
        <div className="bg-white rounded-2xl p-5 shadow-card card-hover">
          <h3 className="font-bold text-midnight mb-4 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-secondary" />
            Top 5 Requested
          </h3>
          {safeTop.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <BarChart3 className="w-10 h-10 mb-2 opacity-30" />
              <p className="text-sm">No requests data available</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={safeTop} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: '#94a3b8' }} width={100} />
                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />
                <Bar dataKey="count" fill="#06B6D4" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Activity feed */}
      <div className="bg-white rounded-2xl p-5 shadow-card card-hover">
        <h3 className="font-bold text-midnight mb-4 flex items-center gap-2">
          <Activity className="w-4 h-4 text-success" />
          Recent Activity
        </h3>
        {safeActivity.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-gray-400">
            <Activity className="w-10 h-10 mb-2 opacity-30" />
            <p className="text-sm">No recent activities logged</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {safeActivity.map((item, i) => (
              <div key={item.id || i} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center flex-shrink-0">
                  <Activity className="w-3.5 h-3.5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-gray-800 font-medium truncate">{item.action}</p>
                  <p className="text-xs text-gray-400">{item.user}</p>
                </div>
                <span className="text-xs text-gray-400 flex-shrink-0">{item.time}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ================================================================
   PRODUCTS VIEW — CRUD table with search, filter, modal
   ================================================================ */
function ProductsView({ api }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ code: '', name: '', description: '', category_id: '', category: '', unit_id: '', bulk_unit_id: '', bulk_conversion: '1', purchase_price: '', price: '', mrp: '', gst_rate: '18', hsn_code: '', stock: '', min_stock_level: '', zone: 'A', image_url: '' });
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [categoriesList, setCategoriesList] = useState([]);
  const [unitsList, setUnitsList] = useState([]);

  const loadProducts = async () => {
    setLoading(true);
    try {
      const data = await api('/products');
      setProducts(Array.isArray(data) ? data : data?.products || data?.data || []);
    } catch { setProducts([]); }
    setLoading(false);
  };

  const loadUnitsAndCats = async () => {
    try {
      const cats = await api('/categories');
      const units = await api('/units');
      setCategoriesList(cats || []);
      setUnitsList(units || []);
    } catch (e) {
      console.error('Failed to load categories/units in WMS', e);
    }
  };

  useEffect(() => { 
    loadProducts(); 
    loadUnitsAndCats();
  }, [api]);

  const categories = useMemo(() => {
    const cats = [...new Set(products.map((p) => p.category).filter(Boolean))];
    return cats.sort();
  }, [products]);

  const filtered = useMemo(() => {
    return products.filter((p) => {
      const matchSearch = !search || p.name?.toLowerCase().includes(search.toLowerCase());
      const matchCat = !catFilter || p.category === catFilter;
      return matchSearch && matchCat;
    });
  }, [products, search, catFilter]);

  const openCreate = () => {
    setEditing(null);
    setForm({ code: '', name: '', description: '', category_id: '', category: '', unit_id: '', bulk_unit_id: '', bulk_conversion: '1', purchase_price: '', price: '', mrp: '', gst_rate: '18', hsn_code: '', stock: '', min_stock_level: '', zone: 'A', image_url: '' });
    setModalOpen(true);
  };

  const openEdit = (p) => {
    setEditing(p);
    setForm({
      code: p.code || '',
      name: p.name || '',
      description: p.description || '',
      category_id: p.category_id || '',
      category: p.category_name || p.category || '',
      unit_id: p.unit_id || '',
      bulk_unit_id: p.bulk_unit_id || '',
      bulk_conversion: p.bulk_conversion?.toString() || '1',
      purchase_price: p.purchase_price?.toString() || '',
      price: p.selling_price !== undefined ? p.selling_price?.toString() : p.price?.toString() || '',
      mrp: p.mrp?.toString() || '',
      gst_rate: p.gst_rate?.toString() || '18',
      hsn_code: p.hsn_code || '',
      stock: p.current_stock !== undefined ? p.current_stock?.toString() : p.stock?.toString() || '',
      min_stock_level: p.min_stock_level?.toString() || '',
      zone: p.zone || 'A',
      image_url: p.image_url || p.image_path || '',
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        ...form,
        purchase_price: parseFloat(form.purchase_price) || 0,
        price: parseFloat(form.price) || 0,
        mrp: parseFloat(form.mrp) || 0,
        gst_rate: parseFloat(form.gst_rate) || 18,
        stock: parseInt(form.stock) || 0,
        min_stock_level: parseInt(form.min_stock_level) || 0,
        category_id: form.category_id ? parseInt(form.category_id) : null,
        unit_id: form.unit_id ? parseInt(form.unit_id) : null,
        bulk_unit_id: form.bulk_unit_id ? parseInt(form.bulk_unit_id) : null,
        bulk_conversion: parseFloat(form.bulk_conversion) || 1,
        image_path: form.image_url,
      };
      if (editing) {
        await api(`/products/${editing.id || editing._id}`, { method: 'PUT', body: JSON.stringify(payload) });
      } else {
        await api('/products', { method: 'POST', body: JSON.stringify(payload) });
      }
      setModalOpen(false);
      loadProducts();
    } catch {}
    setSaving(false);
  };

  const handleDelete = async (id) => {
    try {
      await api(`/products/${id}`, { method: 'DELETE' });
      loadProducts();
    } catch {}
    setDeleteId(null);
  };

  if (loading) return <Loader text="Loading products..." />;

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex flex-1 gap-3 w-full sm:w-auto">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search products..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm"
            />
          </div>
          <select
            value={catFilter}
            onChange={(e) => setCatFilter(e.target.value)}
            className="px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-700"
          >
            <option value="">All Categories</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <button onClick={openCreate} className="btn-glow flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold">
          <Plus className="w-4 h-4" />
          Add Product
        </button>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <EmptyState title="No products found" message="Try adjusting your search or add a new product." />
      ) : (
        <div className="bg-white rounded-2xl shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50/80 text-left">
                  <th className="px-5 py-3.5 font-semibold text-gray-500 text-xs uppercase tracking-wider">Product</th>
                  <th className="px-5 py-3.5 font-semibold text-gray-500 text-xs uppercase tracking-wider">Category</th>
                  <th className="px-5 py-3.5 font-semibold text-gray-500 text-xs uppercase tracking-wider">Price</th>
                  <th className="px-5 py-3.5 font-semibold text-gray-500 text-xs uppercase tracking-wider">Stock</th>
                  <th className="px-5 py-3.5 font-semibold text-gray-500 text-xs uppercase tracking-wider">Zone</th>
                  <th className="px-5 py-3.5 font-semibold text-gray-500 text-xs uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((p) => (
                  <tr key={p.id || p._id} className="table-row-hover">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-slate-50 overflow-hidden flex-shrink-0 flex items-center justify-center relative border border-slate-100">
                          {p.image_url && (
                            <img 
                              src={p.image_url} 
                              alt={p.name} 
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.target.onerror = null;
                                e.target.style.display = 'none';
                                const sibling = e.target.nextSibling;
                                if (sibling) sibling.style.display = 'flex';
                              }}
                            />
                          )}
                          <div 
                            className="w-full h-full flex items-center justify-center bg-slate-50 text-slate-300"
                            style={{ display: p.image_url ? 'none' : 'flex' }}
                          >
                            <Package className="w-4 h-4" />
                          </div>
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-midnight truncate">{p.name}</p>
                          {p.description && <p className="text-xs text-gray-400 truncate max-w-[200px]">{p.description}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="px-2.5 py-1 rounded-full bg-indigo-50 text-primary text-xs font-medium">{p.category || '—'}</span>
                    </td>
                    <td className="px-5 py-3.5 font-semibold text-midnight">
                      ₹{parseFloat(p.bulk_conversion > 1 ? (p.price || 0) * p.bulk_conversion : p.price || 0).toFixed(2)}
                      {p.bulk_conversion > 1 && (
                        <span className="text-[10px] text-gray-400 font-normal ml-1">/ {p.bulk_unit_name || 'Box'}</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`font-semibold ${p.stock <= 0 ? 'text-danger' : p.stock <= 10 ? 'text-warning' : 'text-success'}`}>
                        {p.stock ?? 0}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="px-2.5 py-1 rounded-full bg-gray-100 text-gray-700 text-xs font-bold">{p.zone || '—'}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex gap-1.5">
                        <button onClick={() => openEdit(p)} className="p-2 rounded-lg hover:bg-indigo-50 text-gray-500 hover:text-primary transition-colors">
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button onClick={() => setDeleteId(p.id || p._id)} className="p-2 rounded-lg hover:bg-red-50 text-gray-500 hover:text-danger transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Product' : 'Add Product'} wide={true}>
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5 font-sans">Name *</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-sans" placeholder="Product name" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5 font-sans">Item Code</label>
              <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-sans" placeholder="Auto-generated if empty" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5 font-sans">Category</label>
              <select value={form.category_id} onChange={(e) => {
                const selectedId = e.target.value;
                const cat = categoriesList.find(c => String(c.id) === String(selectedId));
                setForm({ ...form, category_id: selectedId, category: cat ? cat.name : '' });
              }} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-sans bg-white">
                <option value="">Select Category</option>
                {categoriesList.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5 font-sans">Base Unit (e.g. Pcs)</label>
              <select value={form.unit_id} onChange={(e) => setForm({ ...form, unit_id: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-sans bg-white">
                <option value="">Select Base Unit</option>
                {unitsList.map(u => <option key={u.id} value={u.id}>{u.name} ({u.short_name})</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5 font-sans">Bulk Unit (e.g. Box)</label>
              <select value={form.bulk_unit_id} onChange={(e) => setForm({ ...form, bulk_unit_id: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-sans bg-white">
                <option value="">Select Bulk Unit</option>
                {unitsList.map(u => <option key={u.id} value={u.id}>{u.name} ({u.short_name})</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5 font-sans">Bulk Conversion Factor</label>
              <input type="number" value={form.bulk_conversion} onChange={(e) => setForm({ ...form, bulk_conversion: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-sans" placeholder="e.g. 10" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5 font-sans">GST Rate (%)</label>
              <input type="number" step="0.01" value={form.gst_rate} onChange={(e) => setForm({ ...form, gst_rate: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-sans" placeholder="18.00" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5 font-sans">HSN Code</label>
              <input value={form.hsn_code} onChange={(e) => setForm({ ...form, hsn_code: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-sans" placeholder="e.g. 1514" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5 font-sans">Purchase Price (₹, excl. GST)</label>
              <input type="number" step="0.01" value={form.purchase_price} onChange={(e) => setForm({ ...form, purchase_price: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-sans" placeholder="0.00" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5 font-sans">Final Selling Price (₹, incl. GST)</label>
              <input type="number" step="0.01" value={form.final_selling_price} onChange={(e) => {
                const finalVal = e.target.value;
                const gstMul = 1 + (Number(form.gst_rate) || 18) / 100;
                const exclGst = Number(finalVal) > 0 ? (Number(finalVal) / gstMul).toFixed(4) : '';
                setForm({ ...form, final_selling_price: finalVal, price: exclGst });
              }}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-sans" placeholder="0.00" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5 font-sans">Selling Price (₹, excl. GST)</label>
              <input type="number" step="0.01" value={form.price} onChange={(e) => {
                const exclVal = e.target.value;
                const gstMul = 1 + (Number(form.gst_rate) || 18) / 100;
                const finalSell = Number(exclVal) > 0 ? (Number(exclVal) * gstMul).toFixed(2) : '';
                setForm({ ...form, price: exclVal, final_selling_price: finalSell });
              }}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-sans" placeholder="0.00" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5 font-sans">MRP (₹)</label>
              <input type="number" step="0.01" value={form.mrp} onChange={(e) => setForm({ ...form, mrp: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-sans" placeholder="0.00" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5 font-sans">Warehouse Storage Zone</label>
              <select value={form.zone} onChange={(e) => setForm({ ...form, zone: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-sans bg-white">
                {['A', 'B', 'C', 'D', 'E'].map((z) => <option key={z} value={z}>Zone {z}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5 font-sans">{editing ? 'Current Stock' : 'Opening Stock'}</label>
              <input type="number" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-sans" placeholder="0" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5 font-sans">Min Stock Level</label>
              <input type="number" value={form.min_stock_level} onChange={(e) => setForm({ ...form, min_stock_level: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-sans" placeholder="0" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5 font-sans">Image URL</label>
            <input value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-sans" placeholder="https://..." />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5 font-sans">Description</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-sans" rows={2} placeholder="Product description" />
          </div>

          <div className="flex gap-3 pt-2">
            <button onClick={() => setModalOpen(false)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors font-sans">Cancel</button>
            <button onClick={handleSave} disabled={saving || !form.name}
              className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold btn-glow disabled:opacity-50 flex items-center justify-center gap-2 font-sans">
              {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Check className="w-4 h-4" />}
              {editing ? 'Update' : 'Create'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete confirmation */}
      <Modal open={!!deleteId} onClose={() => setDeleteId(null)} title="Confirm Deletion">
        <div className="text-center">
          <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
            <Trash2 className="w-7 h-7 text-danger" />
          </div>
          <p className="text-gray-700 mb-6">Are you sure you want to delete this product? This action cannot be undone.</p>
          <div className="flex gap-3">
            <button onClick={() => setDeleteId(null)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50">Cancel</button>
            <button onClick={() => handleDelete(deleteId)} className="flex-1 py-2.5 rounded-xl bg-danger text-white text-sm font-semibold hover:bg-red-700 transition-colors">Delete</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

/* ================================================================
   PRICE HISTORY VIEW
   ================================================================ */
function PriceHistoryView({ api }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await api('/products/price-history');
        setHistory(Array.isArray(data) ? data : data?.data || []);
      } catch { setHistory([]); }
      setLoading(false);
    };
    load();
  }, [api]);

  if (loading) return <Loader text="Loading price history..." />;
  if (history.length === 0) return <EmptyState icon={DollarSign} title="No price changes" message="Price changes will be tracked here automatically." />;

  return (
    <div className="bg-white rounded-2xl shadow-card overflow-hidden animate-fade-in">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50/80 text-left">
              <th className="px-5 py-3.5 font-semibold text-gray-500 text-xs uppercase tracking-wider">Date</th>
              <th className="px-5 py-3.5 font-semibold text-gray-500 text-xs uppercase tracking-wider">Product</th>
              <th className="px-5 py-3.5 font-semibold text-gray-500 text-xs uppercase tracking-wider">Old Price</th>
              <th className="px-5 py-3.5 font-semibold text-gray-500 text-xs uppercase tracking-wider">New Price</th>
              <th className="px-5 py-3.5 font-semibold text-gray-500 text-xs uppercase tracking-wider">Changed By</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {history.map((h, i) => {
              const oldP = parseFloat(h.old_price || 0);
              const newP = parseFloat(h.new_price || 0);
              const increased = newP > oldP;
              return (
                <tr key={h.id || i} className="table-row-hover">
                  <td className="px-5 py-3.5 text-gray-500">{h.date || new Date(h.created_at || h.timestamp).toLocaleDateString()}</td>
                  <td className="px-5 py-3.5 font-semibold text-midnight">{h.product_name || h.product}</td>
                  <td className="px-5 py-3.5 text-gray-500">₹{oldP.toFixed(2)}</td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex items-center gap-1 font-semibold ${increased ? 'text-danger' : 'text-success'}`}>
                      {increased ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                      ₹{newP.toFixed(2)}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-gray-500">{h.changed_by || h.user || 'Admin'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ================================================================
   USERS VIEW — table with approve/disable, add user modal
   ================================================================ */
function UsersView({ api }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'store_owner', store_name: '', gst_number: '', store_address: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Edit user states
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', email: '', password: '', role: 'store_owner', store_name: '', gst_number: '', store_address: '' });
  const [editError, setEditError] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await api('/users');
      setUsers(Array.isArray(data) ? data : data?.users || data?.data || []);
    } catch { setUsers([]); }
    setLoading(false);
  };

  useEffect(() => { loadUsers(); }, [api]);

  const handleAction = async (userId, action) => {
    try {
      await api(`/users/${userId}/${action}`, { method: 'PUT' });
      loadUsers();
    } catch {}
  };

  const handleDeleteUser = async (userId) => {
    try {
      await api(`/users/${userId}`, { method: 'DELETE' });
      loadUsers();
    } catch {}
  };

  const handleAddUser = async () => {
    setError('');
    
    // Mandatory fields validation for Store Owners
    if (form.role === 'store_owner') {
      if (!form.name.trim() || !form.email.trim() || !form.password.trim() || !form.store_name.trim() || !form.store_address.trim()) {
        setError('Please fill in all mandatory fields (Name, Email, Password, Store Name, and Store Address) for Store Owners.');
        return;
      }
    } else {
      // General validation
      if (!form.name.trim() || !form.email.trim() || !form.password.trim()) {
        setError('Name, Email, and Password are required.');
        return;
      }
    }

    setSaving(true);
    try {
      await api('/users', { method: 'POST', body: JSON.stringify(form) });
      setModalOpen(false);
      setForm({ name: '', email: '', password: '', role: 'store_owner', store_name: '', gst_number: '', store_address: '' });
      loadUsers();
    } catch (err) {
      setError(err.message || 'Failed to create user. Please try again.');
    }
    setSaving(false);
  };

  const handleEditClick = (u) => {
    setEditingUser(u);
    setEditForm({
      name: u.name || '',
      email: u.email || '',
      password: '', // Blank by default, if provided it updates
      role: u.role || 'store_owner',
      store_name: u.store_name || '',
      gst_number: u.gst_number || '',
      store_address: u.store_address || ''
    });
    setEditError('');
    setEditModalOpen(true);
  };

  const handleSaveEdit = async () => {
    setEditError('');
    
    // Mandatory fields validation for Store Owners (Password is optional on edit)
    if (editForm.role === 'store_owner') {
      if (!editForm.name.trim() || !editForm.email.trim() || !editForm.store_name.trim() || !editForm.store_address.trim()) {
        setEditError('Name, Email, Store Name, and Store Address are all mandatory for Store Owners.');
        return;
      }
    } else {
      if (!editForm.name.trim() || !editForm.email.trim()) {
        setEditError('Name and Email are required.');
        return;
      }
    }

    setEditSaving(true);
    try {
      const payload = { ...editForm };
      if (!payload.password) delete payload.password; // Do not send empty password string
      
      await api(`/users/${editingUser.id || editingUser._id}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
      setEditModalOpen(false);
      setEditingUser(null);
      loadUsers();
    } catch (err) {
      setEditError(err.message || 'Failed to update user. Please try again.');
    }
    setEditSaving(false);
  };

  if (loading) return <Loader text="Loading users..." />;

  return (
    <div className="space-y-4 animate-fade-in font-sans">
      <div className="flex justify-end">
        <button onClick={() => setModalOpen(true)} className="btn-glow flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold cursor-pointer">
          <Plus className="w-4 h-4" />
          Add User
        </button>
      </div>

      {users.length === 0 ? (
        <EmptyState icon={Users} title="No users" message="Add users to get started." />
      ) : (
        <div className="bg-white rounded-2xl shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50/80 text-left">
                  <th className="px-5 py-3.5 font-semibold text-gray-500 text-xs uppercase tracking-wider">Name</th>
                  <th className="px-5 py-3.5 font-semibold text-gray-500 text-xs uppercase tracking-wider">Email</th>
                  <th className="px-5 py-3.5 font-semibold text-gray-500 text-xs uppercase tracking-wider">Role</th>
                  <th className="px-5 py-3.5 font-semibold text-gray-500 text-xs uppercase tracking-wider">Store</th>
                  <th className="px-5 py-3.5 font-semibold text-gray-500 text-xs uppercase tracking-wider">GST Number</th>
                  <th className="px-5 py-3.5 font-semibold text-gray-500 text-xs uppercase tracking-wider">Address</th>
                  <th className="px-5 py-3.5 font-semibold text-gray-500 text-xs uppercase tracking-wider">Status</th>
                  <th className="px-5 py-3.5 font-semibold text-gray-500 text-xs uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {users.map((u) => (
                  <tr key={u.id || u._id} className="table-row-hover">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                          {(u.name || u.email || 'U').charAt(0).toUpperCase()}
                        </div>
                        <span className="font-semibold text-midnight">{u.name || '—'}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-gray-500">{u.email}</td>
                    <td className="px-5 py-3.5"><StatusBadge status={u.role} /></td>
                    <td className="px-5 py-3.5 text-gray-500">{u.store_name || '—'}</td>
                    <td className="px-5 py-3.5 text-gray-500">{u.gst_number || '—'}</td>
                    <td className="px-5 py-3.5 text-gray-500 max-w-[200px] break-words" title={u.store_address}>{u.store_address || '—'}</td>
                    <td className="px-5 py-3.5">
                      <StatusBadge status={u.approved || u.is_approved ? 'approved' : 'pending'} />
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex gap-1.5">
                        {(!u.approved && !u.is_approved) && (
                          <button onClick={() => handleAction(u.id || u._id, 'approve')}
                            className="p-2 rounded-lg hover:bg-green-50 text-gray-500 hover:text-success transition-colors cursor-pointer" title="Approve">
                            <CheckCircle className="w-4 h-4" />
                          </button>
                        )}
                        <button onClick={() => handleAction(u.id || u._id, 'disable')}
                          className="p-2 rounded-lg hover:bg-orange-50 text-gray-500 hover:text-warning transition-colors cursor-pointer" title="Disable">
                          <XCircle className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleEditClick(u)}
                          className="p-2 rounded-lg hover:bg-indigo-50 text-gray-500 hover:text-primary transition-colors cursor-pointer" title="Edit">
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDeleteUser(u.id || u._id)}
                          className="p-2 rounded-lg hover:bg-red-50 text-gray-500 hover:text-danger transition-colors cursor-pointer" title="Delete">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add User Modal */}
      <Modal open={modalOpen} onClose={() => { setModalOpen(false); setError(''); }} title="Add User">
        <div className="space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-100 text-rose-600 text-xs font-semibold flex items-center gap-2 animate-fade-in">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5 font-sans">Name <span className="text-red-500">*</span></label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-sans" placeholder="Full name" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5 font-sans">Email <span className="text-red-500">*</span></label>
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-sans" placeholder="email@example.com" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5 font-sans">Password <span className="text-red-500">*</span></label>
            <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-sans" placeholder="••••••••" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5 font-sans">Role</label>
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-sans">
                <option value="admin">Admin</option>
                <option value="store_owner">Store Owner</option>
                <option value="viewer">Viewer</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5 font-sans">Store Name {form.role === 'store_owner' && <span className="text-red-500">*</span>}</label>
              <input value={form.store_name} onChange={(e) => setForm({ ...form, store_name: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-sans" placeholder="Store name" />
            </div>
          </div>
          {form.role === 'store_owner' && (
            <>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5 font-sans">GST Number</label>
                <input value={form.gst_number || ''} onChange={(e) => setForm({ ...form, gst_number: e.target.value.toUpperCase() })}
                  maxLength={15}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-sans" placeholder="15 alphanumeric characters" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5 font-sans">Store Address <span className="text-red-500">*</span></label>
                <input value={form.store_address || ''} onChange={(e) => setForm({ ...form, store_address: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-sans" placeholder="Store address" />
              </div>
            </>
          )}
          <div className="flex gap-3 pt-2">
            <button onClick={() => setModalOpen(false)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 font-sans">Cancel</button>
            <button onClick={handleAddUser} disabled={saving || !form.email || !form.password}
              className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold btn-glow disabled:opacity-50 font-sans">
              {saving ? 'Creating...' : 'Create User'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Edit User Modal */}
      <Modal open={editModalOpen} onClose={() => { setEditModalOpen(false); setEditError(''); }} title="Edit User">
        <div className="space-y-4 font-sans">
          {editError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-100 text-rose-600 text-xs font-semibold flex items-center gap-2 animate-fade-in">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{editError}</span>
            </div>
          )}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5 font-sans">Name <span className="text-red-500">*</span></label>
            <input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-sans" placeholder="Full name" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5 font-sans">Email <span className="text-red-500">*</span></label>
            <input type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-sans" placeholder="email@example.com" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5 font-sans">Password <span className="text-gray-400 text-[10px]">(Leave blank to keep unchanged)</span></label>
            <input type="password" value={editForm.password} onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-sans" placeholder="••••••••" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5 font-sans">Role</label>
              <select value={editForm.role} onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-sans">
                <option value="admin">Admin</option>
                <option value="store_owner">Store Owner</option>
                <option value="viewer">Viewer</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5 font-sans">Store Name {editForm.role === 'store_owner' && <span className="text-red-500">*</span>}</label>
              <input value={editForm.store_name} onChange={(e) => setEditForm({ ...editForm, store_name: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-sans" placeholder="Store name" />
            </div>
          </div>
          {editForm.role === 'store_owner' && (
            <>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5 font-sans">GST Number</label>
                <input value={editForm.gst_number || ''} onChange={(e) => setEditForm({ ...editForm, gst_number: e.target.value.toUpperCase() })}
                  maxLength={15}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-sans" placeholder="15 alphanumeric characters" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5 font-sans">Store Address <span className="text-red-500">*</span></label>
                <input value={editForm.store_address || ''} onChange={(e) => setEditForm({ ...editForm, store_address: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-sans" placeholder="Store address" />
              </div>
            </>
          )}
          <div className="flex gap-3 pt-2">
            <button onClick={() => setEditModalOpen(false)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 font-sans">Cancel</button>
            <button onClick={handleSaveEdit} disabled={editSaving || !editForm.email}
              className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold btn-glow disabled:opacity-50 font-sans">
              {editSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

/* ================================================================
   DAILY SELECTIONS VIEW — date picker, store cards, status updates
   ================================================================ */
function DailySelectionsView({ api }) {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selections, setSelections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);

  const getSelectionTime = (createdAt) => {
    if (!createdAt) return '';
    try {
      const utcDate = new Date(createdAt.replace(' ', 'T') + 'Z');
      return utcDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const loadSelections = async () => {
    setLoading(true);
    try {
      const data = await api(`/selections?date=${selectedDate}`);
      setSelections(Array.isArray(data) ? data : data?.selections || data?.data || []);
    } catch { setSelections([]); }
    setLoading(false);
  };

  useEffect(() => { loadSelections(); }, [api, selectedDate]);

  const changeDate = (offset) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + offset);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const updateStatus = async (id, status) => {
    try {
      await api(`/selections/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) });
      loadSelections();
    } catch {}
  };

  const generatePickList = () => {
    // Group all items by zone
    const zones = {};
    selections.forEach((s) => {
      (s.items || []).forEach((item) => {
        const zone = item.zone || 'A';
        if (!zones[zone]) zones[zone] = [];
        zones[zone].push({ ...item, store: s.store_name });
      });
    });
    // For now just alert — could generate PDF
    const list = Object.entries(zones)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([zone, items]) => `\nZone ${zone}:\n${items.map((i) => `  • ${i.product_name || i.name} x${i.quantity} (${i.store})`).join('\n')}`)
      .join('\n');
    alert(`Zone-Based Pick List\n${'='.repeat(40)}${list || '\nNo items to pick.'}`);
  };

  const exportConsolidatedCSV = () => {
    const summary = {};
    selections.forEach((s) => {
      (s.items || []).forEach((item) => {
        const pid = item.product_id || item.id;
        if (!summary[pid]) {
          summary[pid] = {
            name: item.product_name || item.name,
            category: item.category || 'General',
            quantity: 0,
            zone: item.zone || 'A',
            price: parseFloat(item.unit_price || item.price || 0)
          };
        }
        summary[pid].quantity += item.quantity || 0;
      });
    });

    const list = Object.values(summary);
    if (list.length === 0) {
      alert('No items to export for this date.');
      return;
    }

    let csvContent = 'Product Name,Category,Total Quantity,Zone,Unit Price (INR),Estimated Subtotal (INR)\n';
    list.forEach((item) => {
      const name = `"${item.name.replace(/"/g, '""')}"`;
      const subtotal = (item.quantity * item.price).toFixed(2);
      csvContent += `${name},${item.category},${item.quantity},${item.zone},₹${item.price.toFixed(2)},₹${subtotal}\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Consolidated_Daily_Selections_${selectedDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exportStoreCSV = (sel) => {
    const items = sel.items || [];
    if (items.length === 0) {
      alert('No items in this selection.');
      return;
    }

    let csvContent = `Store Name: ${sel.store_name || 'Store'},GSTIN: ${sel.gst_number || 'N/A'},Store Address: "${(sel.store_address || 'N/A').replace(/"/g, '""')}",Date: ${selectedDate}\n\n`;
    csvContent += 'Product Name,Quantity,Unit Price (INR),Subtotal (INR),Zone\n';
    
    items.forEach((item) => {
      const name = `"${(item.product_name || item.name).replace(/"/g, '""')}"`;
      const price = parseFloat(item.unit_price || item.price || 0);
      const subtotal = (price * (item.quantity || 0)).toFixed(2);
      csvContent += `${name},${item.quantity},₹${price.toFixed(2)},₹${subtotal},${item.zone || 'A'}\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${(sel.store_name || 'Store').replace(/\s+/g, '_')}_Selection_${selectedDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const formatDate = (d) => new Date(d + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Date picker */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 justify-between">
        <div className="flex items-center gap-2">
          <button onClick={() => changeDate(-1)} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div className="px-4 py-2 bg-white rounded-xl border border-gray-200 font-semibold text-midnight text-sm">
            {formatDate(selectedDate)}
          </div>
          <button onClick={() => changeDate(1)} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
            <ChevronRight className="w-5 h-5 text-gray-600" />
          </button>
          <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-2 rounded-xl border border-gray-200 text-sm" />
        </div>
        <div className="flex gap-2">
          <button onClick={exportConsolidatedCSV} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-indigo-700 transition-colors cursor-pointer shadow-sm">
            <Download className="w-4 h-4" />
            Export CSV
          </button>
          <button onClick={generatePickList} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-secondary text-white text-sm font-semibold hover:bg-teal-600 transition-colors cursor-pointer shadow-sm">
            <MapPin className="w-4 h-4" />
            Generate Pick List
          </button>
        </div>
      </div>

      {loading ? <Loader text="Loading selections..." /> : selections.length === 0 ? (
        <EmptyState icon={ClipboardList} title="No selections for this date" message="Store owners haven't submitted selections for this day." />
      ) : (
        <div className="grid gap-4">
          {selections.map((sel) => {
            const isExpanded = expanded === (sel.id || sel._id);
            const items = sel.items || [];
            const total = items.reduce((sum, i) => sum + (parseFloat(i.unit_price || i.price || 0) * (i.quantity || 0)), 0);
            return (
              <div key={sel.id || sel._id} className="bg-white rounded-2xl shadow-card overflow-hidden card-hover">
                <button
                  onClick={() => setExpanded(isExpanded ? null : (sel.id || sel._id))}
                  className="w-full flex items-center gap-4 px-5 py-4 text-left"
                >
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-bold flex-shrink-0">
                    {(sel.store_name || 'S').charAt(0)}
                  </div>
                   <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="flex flex-col">
                        <p className="font-bold text-midnight leading-tight">{sel.store_name || 'Store'}</p>
                        {sel.store_owner_name && (
                          <p className="text-[10px] text-gray-500 font-semibold leading-normal">Owner: {sel.store_owner_name}</p>
                        )}
                      </div>
                      {sel.gst_number && (
                        <span className="text-[9px] bg-slate-100 text-slate-500 font-bold px-1.5 py-0.5 rounded border border-slate-200">
                          GSTIN: {sel.gst_number}
                        </span>
                      )}
                      {sel.store_address && (
                        <span className="text-[9px] bg-indigo-50 text-indigo-600 font-medium px-1.5 py-0.5 rounded border border-indigo-100 whitespace-normal break-words" title={sel.store_address}>
                          📍 {sel.store_address}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-1">{items.length} items · ₹{total.toFixed(2)} est. total {sel.created_at && getSelectionTime(sel.created_at) && `· Time: ${getSelectionTime(sel.created_at)}`}</p>
                  </div>
                  <StatusBadge status={sel.status || 'submitted'} />
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
                            <th className="pb-2">Unit Price</th>
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
                    ) : <p className="text-sm text-gray-400 mb-4">No items in this selection.</p>}

                    <div className="flex flex-wrap gap-2 items-center justify-between border-t border-slate-50 pt-4 mt-2">
                      <div className="flex flex-wrap gap-2">
                        {['packed', 'shipped', 'delivered'].map((s) => (
                          <button key={s} onClick={() => updateStatus(sel.id || sel._id, s)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 hover:bg-gray-50 transition-colors capitalize cursor-pointer">
                            {s === 'packed' && <PackageCheck className="w-3.5 h-3.5" />}
                            {s === 'shipped' && <Truck className="w-3.5 h-3.5" />}
                            {s === 'delivered' && <CheckCircle className="w-3.5 h-3.5" />}
                            Mark {s}
                          </button>
                        ))}
                      </div>
                      <button onClick={() => exportStoreCSV(sel)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-50 hover:bg-indigo-100 text-primary border border-indigo-100 transition-colors cursor-pointer">
                        <Download className="w-3.5 h-3.5" />
                        Download CSV
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ================================================================
   DISCREPANCIES VIEW
   ================================================================ */
function DiscrepanciesView({ api }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await api('/discrepancies');
      setItems(Array.isArray(data) ? data : data?.data || []);
    } catch { setItems([]); }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [api]);

  const handleAction = async (id, action) => {
    try {
      await api(`/discrepancies/${id}/${action}`, { method: 'PUT' });
      loadData();
    } catch {}
  };

  if (loading) return <Loader text="Loading discrepancies..." />;
  if (items.length === 0) return <EmptyState icon={AlertTriangle} title="No discrepancies" message="All orders are in good shape." />;

  return (
    <div className="bg-white rounded-2xl shadow-card overflow-hidden animate-fade-in">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50/80 text-left">
              <th className="px-5 py-3.5 font-semibold text-gray-500 text-xs uppercase tracking-wider">Date</th>
              <th className="px-5 py-3.5 font-semibold text-gray-500 text-xs uppercase tracking-wider">Store Owner</th>
              <th className="px-5 py-3.5 font-semibold text-gray-500 text-xs uppercase tracking-wider">Product</th>
              <th className="px-5 py-3.5 font-semibold text-gray-500 text-xs uppercase tracking-wider">Issue</th>
              <th className="px-5 py-3.5 font-semibold text-gray-500 text-xs uppercase tracking-wider">Qty</th>
              <th className="px-5 py-3.5 font-semibold text-gray-500 text-xs uppercase tracking-wider">Notes</th>
              <th className="px-5 py-3.5 font-semibold text-gray-500 text-xs uppercase tracking-wider">Status</th>
              <th className="px-5 py-3.5 font-semibold text-gray-500 text-xs uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {items.map((d) => (
              <tr key={d.id || d._id} className="table-row-hover">
                <td className="px-5 py-3.5 text-gray-500">{d.date || new Date(d.created_at).toLocaleDateString()}</td>
                <td className="px-5 py-3.5 font-medium text-midnight">{d.store_owner || d.user_name || '—'}</td>
                <td className="px-5 py-3.5 text-gray-700">{d.product_name || d.product || '—'}</td>
                <td className="px-5 py-3.5"><StatusBadge status={d.issue_type || d.type || 'other'} /></td>
                <td className="px-5 py-3.5 text-gray-500">{d.quantity ?? '—'}</td>
                <td className="px-5 py-3.5 text-gray-500 max-w-[200px] truncate">{d.notes || '—'}</td>
                <td className="px-5 py-3.5"><StatusBadge status={d.status || 'pending'} /></td>
                <td className="px-5 py-3.5">
                  <div className="flex gap-1.5">
                    <button onClick={() => handleAction(d.id || d._id, 'resolve')} className="p-2 rounded-lg hover:bg-green-50 text-gray-500 hover:text-success transition-colors" title="Resolve">
                      <CheckCircle className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleAction(d.id || d._id, 'reject')} className="p-2 rounded-lg hover:bg-red-50 text-gray-500 hover:text-danger transition-colors" title="Reject">
                      <XCircle className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ================================================================
   PRODUCT REQUESTS VIEW
   ================================================================ */
function ProductRequestsView({ api }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await api('/product-requests');
      setRequests(Array.isArray(data) ? data : data?.data || []);
    } catch { setRequests([]); }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [api]);

  const handleAction = async (id, action) => {
    try {
      await api(`/product-requests/${id}/${action}`, { method: 'PUT' });
      loadData();
    } catch {}
  };

  if (loading) return <Loader text="Loading requests..." />;
  if (requests.length === 0) return <EmptyState icon={PackageOpen} title="No product requests" message="Store owners can request new products to be added." />;

  return (
    <div className="bg-white rounded-2xl shadow-card overflow-hidden animate-fade-in">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50/80 text-left">
              <th className="px-5 py-3.5 font-semibold text-gray-500 text-xs uppercase tracking-wider">Date</th>
              <th className="px-5 py-3.5 font-semibold text-gray-500 text-xs uppercase tracking-wider">Store Owner</th>
              <th className="px-5 py-3.5 font-semibold text-gray-500 text-xs uppercase tracking-wider">Product Name</th>
              <th className="px-5 py-3.5 font-semibold text-gray-500 text-xs uppercase tracking-wider">Description</th>
              <th className="px-5 py-3.5 font-semibold text-gray-500 text-xs uppercase tracking-wider">Status</th>
              <th className="px-5 py-3.5 font-semibold text-gray-500 text-xs uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {requests.map((r) => (
              <tr key={r.id || r._id} className="table-row-hover">
                <td className="px-5 py-3.5 text-gray-500">{r.date || new Date(r.created_at).toLocaleDateString()}</td>
                <td className="px-5 py-3.5 font-medium text-midnight">{r.store_owner || r.user_name || '—'}</td>
                <td className="px-5 py-3.5 font-semibold text-midnight">{r.product_name || r.name}</td>
                <td className="px-5 py-3.5 text-gray-500 max-w-[250px] truncate">{r.description || '—'}</td>
                <td className="px-5 py-3.5"><StatusBadge status={r.status || 'pending'} /></td>
                <td className="px-5 py-3.5">
                  {(r.status === 'pending' || !r.status) && (
                    <div className="flex gap-1.5">
                      <button onClick={() => handleAction(r.id || r._id, 'approve')} className="p-2 rounded-lg hover:bg-green-50 text-gray-500 hover:text-success transition-colors" title="Approve">
                        <CheckCircle className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleAction(r.id || r._id, 'reject')} className="p-2 rounded-lg hover:bg-red-50 text-gray-500 hover:text-danger transition-colors" title="Reject">
                        <XCircle className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ================================================================
   ANNOUNCEMENTS VIEW — CRUD
   ================================================================ */
function AnnouncementsView({ api }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ title: '', message: '' });
  const [saving, setSaving] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await api('/announcements');
      setItems(Array.isArray(data) ? data : data?.data || []);
    } catch { setItems([]); }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [api]);

  const openCreate = () => { setEditing(null); setForm({ title: '', message: '' }); setModalOpen(true); };
  const openEdit = (a) => { setEditing(a); setForm({ title: a.title || '', message: a.message || '' }); setModalOpen(true); };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editing) {
        await api(`/announcements/${editing.id || editing._id}`, { method: 'PUT', body: JSON.stringify(form) });
      } else {
        await api('/announcements', { method: 'POST', body: JSON.stringify(form) });
      }
      setModalOpen(false);
      loadData();
    } catch {}
    setSaving(false);
  };

  const handleDelete = async (id) => {
    try {
      await api(`/announcements/${id}`, { method: 'DELETE' });
      loadData();
    } catch {}
  };

  if (loading) return <Loader text="Loading announcements..." />;

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex justify-end">
        <button onClick={openCreate} className="btn-glow flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold">
          <Plus className="w-4 h-4" />
          New Announcement
        </button>
      </div>

      {items.length === 0 ? (
        <EmptyState icon={Megaphone} title="No announcements" message="Create an announcement to notify all users." />
      ) : (
        <div className="grid gap-3">
          {items.map((a) => (
            <div key={a.id || a._id} className="bg-white rounded-2xl p-5 shadow-card card-hover">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Megaphone className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h4 className="font-bold text-midnight">{a.title}</h4>
                    <p className="text-sm text-gray-500 mt-1">{a.message}</p>
                    {a.created_at && <p className="text-xs text-gray-400 mt-2">{new Date(a.created_at).toLocaleString()}</p>}
                  </div>
                </div>
                <div className="flex gap-1.5 flex-shrink-0">
                  <button onClick={() => openEdit(a)} className="p-2 rounded-lg hover:bg-indigo-50 text-gray-500 hover:text-primary transition-colors">
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(a.id || a._id)} className="p-2 rounded-lg hover:bg-red-50 text-gray-500 hover:text-danger transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Announcement' : 'New Announcement'}>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Title</label>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm" placeholder="Announcement title" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Message</label>
            <textarea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm" rows={4} placeholder="Announcement message..." />
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setModalOpen(false)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50">Cancel</button>
            <button onClick={handleSave} disabled={saving || !form.title}
              className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold btn-glow disabled:opacity-50">
              {saving ? 'Saving...' : editing ? 'Update' : 'Publish'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

/* ================================================================
   AUDIT LOGS VIEW
   ================================================================ */
function AuditLogsView({ api }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await api('/audit-logs');
        setLogs(Array.isArray(data) ? data : data?.data || []);
      } catch { setLogs([]); }
      setLoading(false);
    };
    load();
  }, [api]);

  if (loading) return <Loader text="Loading audit logs..." />;
  if (logs.length === 0) return <EmptyState icon={FileText} title="No audit logs" message="System actions will be recorded here." />;

  return (
    <div className="bg-white rounded-2xl shadow-card overflow-hidden animate-fade-in">
      <div className="overflow-x-auto max-h-[70vh] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10">
            <tr className="bg-gray-50/95 text-left backdrop-blur-sm">
              <th className="px-5 py-3.5 font-semibold text-gray-500 text-xs uppercase tracking-wider">Timestamp</th>
              <th className="px-5 py-3.5 font-semibold text-gray-500 text-xs uppercase tracking-wider">User</th>
              <th className="px-5 py-3.5 font-semibold text-gray-500 text-xs uppercase tracking-wider">Action</th>
              <th className="px-5 py-3.5 font-semibold text-gray-500 text-xs uppercase tracking-wider">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {logs.map((log, i) => (
              <tr key={log.id || i} className="table-row-hover">
                <td className="px-5 py-3.5 text-gray-500 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-gray-400" />
                    {log.timestamp || new Date(log.created_at).toLocaleString()}
                  </div>
                </td>
                <td className="px-5 py-3.5 font-medium text-midnight">{log.user || log.user_name || '—'}</td>
                <td className="px-5 py-3.5">
                  <span className="px-2.5 py-1 rounded-full bg-indigo-50 text-primary text-xs font-medium">{log.action || '—'}</span>
                </td>
                <td className="px-5 py-3.5 text-gray-500 max-w-[400px] truncate">{log.details || log.description || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
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
    <div className="space-y-4 animate-fade-in font-sans">
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
                 n.type === 'order_update' || n.title?.includes('Selection') || n.title?.includes('Registration') ? <Package className="w-4 h-4 text-secondary" /> :
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
