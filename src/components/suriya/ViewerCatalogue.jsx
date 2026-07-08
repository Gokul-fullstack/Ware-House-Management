import React, { useState, useEffect, useMemo } from 'react';
import { Search, Package, MapPin, PackageSearch, Tag, Star, LayoutGrid, List, X } from 'lucide-react';
import { EmptyState, Loader } from '../App';

/* ================================================================
   VIEWER CATALOGUE — read-only product catalog, beautiful grid/list
   ================================================================ */
export default function ViewerCatalogue({ api }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeCat, setActiveCat] = useState('');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'list'
  const [currentPage, setCurrentPage] = useState(1);
  const [quickViewProduct, setQuickViewProduct] = useState(null);
  const ITEMS_PER_PAGE = 20;

  useEffect(() => {
    const load = async () => {
      try {
        const data = await api('/products');
        setProducts(Array.isArray(data) ? data : data?.products || data?.data || []);
      } catch { setProducts([]); }
      setLoading(false);
    };
    load();
  }, [api]);

  const categories = useMemo(() => {
    return ['', ...new Set(products.map((p) => p.category).filter(Boolean))].sort((a, b) => {
      if (!a) return -1;
      if (!b) return 1;
      return a.localeCompare(b);
    });
  }, [products]);

  const filtered = useMemo(() => {
    return products.filter((p) => {
      const matchSearch = !search || p.name?.toLowerCase().includes(search.toLowerCase()) ||
                          p.description?.toLowerCase().includes(search.toLowerCase());
      const matchCat = !activeCat || p.category === activeCat;
      return matchSearch && matchCat;
    });
  }, [products, search, activeCat]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const getStockInfo = (stock) => {
    const s = parseInt(stock) || 0;
    if (s <= 0) return { label: 'Out of Stock', color: 'bg-red-50 text-danger', dot: 'bg-danger' };
    if (s <= 10) return { label: 'Low Stock', color: 'bg-orange-50 text-warning', dot: 'bg-warning' };
    return { label: 'In Stock', color: 'bg-green-50 text-success', dot: 'bg-success' };
  };

  const zoneColors = {
    A: 'bg-indigo-100 text-primary',
    B: 'bg-teal-100 text-teal-700',
    C: 'bg-amber-100 text-amber-700',
    D: 'bg-rose-100 text-rose-700',
  };

  return (
    <div className="animate-fade-in">
      {/* Hero section */}
      <div className="relative bg-gradient-to-r from-midnight via-indigo-900 to-midnight rounded-2xl p-8 sm:p-10 mb-6 overflow-hidden">
        {/* Decorative blobs */}
        <div className="absolute -top-20 -right-20 w-60 h-60 bg-primary/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-20 -left-20 w-60 h-60 bg-secondary/20 rounded-full blur-3xl" />

        <div className="relative z-10 text-center max-w-xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 text-white/80 text-xs font-medium mb-4 backdrop-blur-sm">
            <Package className="w-3.5 h-3.5" />
            Browse our complete inventory
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">Product Catalogue</h1>
          <p className="text-white/60 mt-2 text-sm">Explore all available products across our trading sectors</p>

          {/* Search bar */}
          <div className="relative mt-6 max-w-md mx-auto">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
            <input
              type="text"
              placeholder="Search products by name or description..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
              className="w-full pl-12 pr-4 py-3.5 rounded-xl bg-white/10 border border-white/10 text-white placeholder:text-white/40 text-sm backdrop-blur-sm focus:bg-white/15 focus:border-white/20 transition-all"
            />
          </div>
        </div>
      </div>

      {/* Category filter chips */}
      {categories.length > 1 && (
        <div className="flex flex-wrap gap-2 mb-6">
          {categories.map((cat) => (
            <button
              key={cat || 'all'}
              onClick={() => { setActiveCat(cat); setCurrentPage(1); }}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                activeCat === cat
                  ? 'bg-primary text-white shadow-glow'
                  : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200 hover:border-primary/30'
              }`}
            >
              {cat || 'All Products'}
            </button>
          ))}
        </div>
      )}

      {/* Product count & Grid/List controls */}
      {!loading && (
        <div className="flex items-center justify-between gap-4 mb-5 bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
          <p className="text-xs sm:text-sm text-slate-500 font-medium">
            Showing <span className="font-bold text-midnight">{(currentPage-1)*ITEMS_PER_PAGE + 1}–{Math.min(currentPage*ITEMS_PER_PAGE, filtered.length)}</span> of <span className="font-bold text-midnight">{filtered.length}</span> product{filtered.length !== 1 ? 's' : ''}
            {activeCat && <span> in <span className="font-bold text-primary">{activeCat}</span></span>}
          </p>
          
          {/* Amazon-style View Toggle */}
          <div className="flex items-center bg-slate-100 border border-slate-200/50 rounded-xl p-0.5 shadow-inner">
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
      )}

      {/* Content */}
      {loading ? <Loader text="Loading catalogue..." /> : filtered.length === 0 ? (
        <EmptyState
          icon={PackageSearch}
          title="No products found"
          message={search ? `No products match "${search}". Try a different search term.` : 'No products available in this category.'}
        />
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 animate-fade-in">
          {paginated.map((p) => {
            const stockInfo = getStockInfo(p.stock);
            const zone = p.zone || 'A';
            const ratingScore = (((p.id || 1) * 3) % 10) * 0.1 + 4.1;
            const ratingCount = (((p.id || 1) * 17) % 180) + 24;
            const discount = 15;
            const originalPrice = parseFloat(p.price || 0) / (1 - (discount / 100));

            return (
              <div key={p.id || p._id} className="bg-white rounded-2xl shadow-card hover:shadow-lg hover:-translate-y-0.5 overflow-hidden group flex flex-col h-full border border-slate-100/50 transition-all duration-300">
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
                    <Package className="w-10 h-10 text-gray-200" />
                  </div>
                  {/* Zone badge on image */}
                  <div className={`absolute top-2 right-2 px-2 py-0.5 rounded-lg text-[9px] font-extrabold ${zoneColors[zone] || 'bg-gray-100 text-gray-700'} shadow-sm`}>
                    <div className="flex items-center gap-1">
                      <MapPin className="w-2.5 h-2.5" />
                      Zone {zone}
                    </div>
                  </div>
                </div>

                {/* Info */}
                <div className="p-4 flex flex-col flex-1">
                  {/* Category and stock status */}
                  <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-indigo-50 border border-indigo-100/20 text-primary text-[10px] font-semibold">
                      <Tag className="w-2.5 h-2.5" />
                      {p.category || 'General'}
                    </span>
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-extrabold ${stockInfo.color}`}>
                      <span className={`w-1 h-1 rounded-full ${stockInfo.dot}`} />
                      {stockInfo.label}
                    </span>
                  </div>

                  {/* Name */}
                  <h3 className="font-extrabold text-midnight text-sm sm:text-base leading-tight mb-1 line-clamp-2 min-h-[40px] hover:text-primary transition-colors cursor-pointer" title={p.name} onClick={() => setQuickViewProduct(p)}>
                    {p.name}
                  </h3>

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
                    <p className="text-xs text-gray-400 mb-3 line-clamp-2 min-h-[32px]">{p.description}</p>
                  )}

                  {/* Price + stock row */}
                  <div className="mt-auto pt-3 border-t border-gray-100">
                    <div className="flex items-baseline gap-1.5 flex-wrap">
                      <p className="text-xl font-black text-midnight">₹{parseFloat(p.price || 0).toFixed(2)}</p>
                      <span className="text-[11px] text-gray-400 line-through">₹{originalPrice.toFixed(2)}</span>
                      <span className="text-[9px] text-emerald-500 font-extrabold uppercase bg-emerald-50 px-1.5 py-0.5 rounded-md">{discount}% off</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col gap-4 animate-fade-in">
          {paginated.map((p) => {
            const stockInfo = getStockInfo(p.stock);
            const zone = p.zone || 'A';
            const ratingScore = (((p.id || 1) * 3) % 10) * 0.1 + 4.1;
            const ratingCount = (((p.id || 1) * 17) % 180) + 24;
            const discount = 15;
            const originalPrice = parseFloat(p.price || 0) / (1 - (discount / 100));

            return (
              <div key={p.id || p._id} className="bg-white rounded-2xl shadow-card hover:shadow-md border border-slate-100/50 transition-all duration-300 overflow-hidden flex flex-col sm:flex-row group w-full">
                {/* Centered Image Container on Left */}
                <div className="relative w-full sm:w-[200px] aspect-[16/10] sm:aspect-square bg-white flex items-center justify-center p-3 border-r border-slate-50 overflow-hidden flex-shrink-0">
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
                  {/* Zone badge */}
                  <div className={`absolute top-2 left-2 px-2 py-0.5 rounded-lg text-[9px] font-extrabold ${zoneColors[zone] || 'bg-gray-100 text-gray-700'} shadow-sm`}>
                    <div className="flex items-center gap-1">
                      <MapPin className="w-2.5 h-2.5" />
                      Zone {zone}
                    </div>
                  </div>
                </div>

                {/* Right Side: Info */}
                <div className="p-5 sm:p-6 flex-1 flex flex-col justify-between">
                  <div>
                    {/* Category & Stock */}
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-indigo-50 border border-indigo-100/20 text-primary text-[10px] font-semibold">
                        <Tag className="w-2.5 h-2.5" />
                        {p.category || 'General'}
                      </span>
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-extrabold ${stockInfo.color}`}>
                        <span className={`w-1 h-1 rounded-full ${stockInfo.dot}`} />
                        {stockInfo.label}
                      </span>
                    </div>

                    {/* Name */}
                    <h3 className="font-extrabold text-midnight text-base sm:text-lg leading-snug mb-1" onClick={() => setQuickViewProduct(p)} style={{cursor: 'pointer'}}>
                      {p.name}
                    </h3>

                    {/* Ratings */}
                    <div className="flex items-center gap-1.5 mb-2.5">
                      <div className="flex items-center text-amber-500 bg-amber-50 px-1.5 py-0.5 rounded-md">
                        <Star className="w-3 h-3 fill-current" />
                        <span className="text-[10px] font-black ml-0.5">{ratingScore.toFixed(1)}</span>
                      </div>
                      <span className="text-[10px] text-gray-400 font-bold">({ratingCount} customer reviews)</span>
                    </div>

                    {/* Description */}
                    {p.description && (
                      <p className="text-xs text-gray-400 mb-3 line-clamp-2 max-w-2xl">{p.description}</p>
                    )}
                  </div>

                  {/* Price & Delivery */}
                  <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-4 mt-4">
                    <div className="flex items-baseline gap-2">
                      <p className="text-2xl font-black text-midnight">₹{parseFloat(p.price || 0).toFixed(2)}</p>
                      <span className="text-xs text-gray-400 line-through">₹{originalPrice.toFixed(2)}</span>
                      <span className="text-[10px] text-emerald-500 font-extrabold uppercase bg-emerald-50 px-2 py-0.5 rounded-md">{discount}% off</span>
                    </div>
                    
                    {/* Free shipping mock */}
                    <div className="text-right hidden sm:block">
                      <p className="text-[11px] text-slate-500 font-semibold">FREE Delivery tomorrow</p>
                      <p className="text-[10px] text-emerald-600 font-bold">Available, ship immediately</p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-8 pb-4">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >← Previous</button>
          <div className="flex items-center gap-1">
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              let page;
              if (totalPages <= 7) page = i + 1;
              else if (currentPage <= 4) page = i + 1;
              else if (currentPage >= totalPages - 3) page = totalPages - 6 + i;
              else page = currentPage - 3 + i;
              return (
                <button key={page} onClick={() => setCurrentPage(page)}
                  className={`w-9 h-9 rounded-lg text-sm font-bold transition-all ${
                    currentPage === page
                      ? 'bg-primary text-white shadow-glow'
                      : 'bg-white text-slate-500 hover:bg-slate-50 border border-slate-200'
                  }`}
                >{page}</button>
              );
            })}
          </div>
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >Next →</button>
        </div>
      )}

      {/* Quick View Modal */}
      {quickViewProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)'}} onClick={() => setQuickViewProduct(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="flex flex-col sm:flex-row">
              {/* Image */}
              <div className="sm:w-[280px] aspect-square bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center flex-shrink-0 rounded-t-2xl sm:rounded-l-2xl sm:rounded-tr-none overflow-hidden">
                {quickViewProduct.image_url ? (
                  <img src={quickViewProduct.image_url} alt={quickViewProduct.name} className="w-full h-full object-cover" />
                ) : (
                  <Package className="w-16 h-16 text-gray-200" />
                )}
              </div>
              {/* Details */}
              <div className="p-6 flex-1">
                <div className="flex items-center justify-between mb-3">
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-indigo-50 text-primary text-xs font-semibold">
                    <Tag className="w-3 h-3" />
                    {quickViewProduct.category || 'General'}
                  </span>
                  <button onClick={() => setQuickViewProduct(null)} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
                    <X className="w-5 h-5 text-slate-400" />
                  </button>
                </div>
                <h2 className="text-xl font-extrabold text-midnight mb-2">{quickViewProduct.name}</h2>
                {quickViewProduct.description && (
                  <p className="text-sm text-slate-500 mb-4 leading-relaxed">{quickViewProduct.description}</p>
                )}
                <div className="flex items-baseline gap-2 mb-4">
                  <span className="text-3xl font-black text-midnight">₹{parseFloat(quickViewProduct.price || 0).toFixed(2)}</span>
                  <span className="text-sm text-gray-400 line-through">₹{(parseFloat(quickViewProduct.price || 0) / 0.85).toFixed(2)}</span>
                  <span className="text-xs text-emerald-600 font-extrabold bg-emerald-50 px-2 py-0.5 rounded-md">15% off</span>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-slate-50 rounded-xl p-3">
                    <p className="text-[10px] text-slate-400 font-bold uppercase">Zone</p>
                    <p className="text-sm font-bold text-midnight flex items-center gap-1"><MapPin className="w-3.5 h-3.5 text-primary" />{quickViewProduct.zone || 'A'}</p>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-3">
                    <p className="text-[10px] text-slate-400 font-bold uppercase">Stock</p>
                    <p className="text-sm font-bold text-midnight">{parseInt(quickViewProduct.stock || 0)} units</p>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-3">
                    <p className="text-[10px] text-slate-400 font-bold uppercase">Category</p>
                    <p className="text-sm font-bold text-midnight">{quickViewProduct.category || 'General'}</p>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-3">
                    <p className="text-[10px] text-slate-400 font-bold uppercase">Rating</p>
                    <p className="text-sm font-bold text-amber-500 flex items-center gap-1"><Star className="w-3.5 h-3.5 fill-current" />{(((quickViewProduct.id || 1) * 3) % 10 * 0.1 + 4.1).toFixed(1)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-emerald-600 font-semibold">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                  FREE Delivery available
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
