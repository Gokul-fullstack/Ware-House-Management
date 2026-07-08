import React, { useState, useEffect, useMemo } from 'react';
import { Search, Download, RefreshCw, Box, AlertTriangle, TrendingUp, DollarSign } from 'lucide-react';
import { useApi } from '../../contexts/AuthContext';
import { useApp } from '../../contexts/AppContext';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts';

export default function StockReportPage() {
  const fetchApi = useApi();
  const { formatCurrency, addToast } = useApp();

  const [items, setItems] = useState([]);
  const [totalVal, setTotalVal] = useState(0);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const stockRes = await fetchApi('/api/reports/stock-report');
      setItems(stockRes.items || []);
      setTotalVal(stockRes.totalValue || 0);

      const catRes = await fetchApi('/api/categories');
      setCategories(catRes || []);
    } catch (err) {
      console.error(err);
      addToast('error', 'Error', 'Failed to fetch inventory reports');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filtered Items
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const matchSearch = 
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.code || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.hsn_code || '').toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchCategory = !selectedCategory || String(item.category_id) === String(selectedCategory);
      
      const isLowStock = item.current_stock <= (item.min_stock_level || 0);
      const matchLowStock = !showLowStockOnly || isLowStock;

      return matchSearch && matchCategory && matchLowStock;
    });
  }, [items, searchQuery, selectedCategory, showLowStockOnly]);

  // Calculations for KPI Cards
  const kpis = useMemo(() => {
    let totalItems = filteredItems.length;
    let purchaseValuation = 0;
    let sellingValuation = 0;
    let lowStockCount = 0;

    filteredItems.forEach(i => {
      purchaseValuation += (i.current_stock || 0) * (i.purchase_price || 0);
      sellingValuation += (i.current_stock || 0) * (i.selling_price || 0);
      if (i.current_stock <= (i.min_stock_level || 0)) {
        lowStockCount++;
      }
    });

    return {
      totalItems,
      purchaseValuation,
      sellingValuation,
      lowStockCount
    };
  }, [filteredItems]);

  // Chart data: Top 10 items by valuation
  const chartData = useMemo(() => {
    return [...items]
      .map(i => ({
        name: i.name.length > 15 ? i.name.substring(0, 15) + '...' : i.name,
        'Valuation (₹)': Number(((i.current_stock || 0) * (i.purchase_price || 0)).toFixed(2))
      }))
      .sort((a, b) => b['Valuation (₹)'] - a['Valuation (₹)'])
      .slice(0, 8); // Top 8 items
  }, [items]);

  // Export to CSV
  const handleExportCSV = () => {
    if (!filteredItems.length) {
      addToast('warning', 'No Data', 'No inventory items to export');
      return;
    }

    const headers = ['Item Code', 'Item Name', 'HSN Code', 'Category', 'Current Stock', 'Unit', 'Purchase Price (₹)', 'Selling Price (₹)', 'Stock Value (Purchase Cost) (₹)', 'MRP (₹)'];
    const rows = filteredItems.map(i => [
      `"${i.code || ''}"`,
      `"${i.name}"`,
      `"${i.hsn_code || ''}"`,
      `"${i.category_name || ''}"`,
      i.current_stock,
      `"${i.unit_name || ''}"`,
      i.purchase_price.toFixed(2),
      i.selling_price.toFixed(2),
      ((i.current_stock || 0) * (i.purchase_price || 0)).toFixed(2),
      i.mrp.toFixed(2)
    ]);

    // Add valuation totals row
    rows.push([
      '"TOTAL"',
      `"${kpis.totalItems} Items"`,
      '""',
      '""',
      '""',
      '""',
      '""',
      '""',
      kpis.purchaseValuation.toFixed(2),
      '""'
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Stock_Valuation_Report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addToast('success', 'Export Completed', 'Inventory report exported to CSV');
  };

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 className="page-title">Stock Report & Valuation</h1>
          <p className="page-subtitle">Inspect inventory assets, quantities, and warnings</p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button className="btn btn-secondary" onClick={fetchData} disabled={loading}>
            <RefreshCw size={16} className={loading ? 'spin' : ''} style={{ marginRight: 6 }} /> Reload
          </button>
          <button className="btn btn-primary" onClick={handleExportCSV}>
            <Download size={16} style={{ marginRight: 6 }} /> Export CSV
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="card" style={{ padding: 16, marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Search Box */}
          <div className="search-box" style={{ maxWidth: 300, flex: 1, margin: 0 }}>
            <Search size={16} />
            <input 
              type="text" 
              placeholder="Search code, name, HSN..." 
              className="form-control"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Category Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 14, color: 'var(--color-text-muted)' }}>Category:</span>
            <select 
              className="form-control" 
              value={selectedCategory} 
              onChange={e => setSelectedCategory(e.target.value)}
              style={{ padding: '6px 12px', minWidth: 150 }}
            >
              <option value="">All Categories</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>

          {/* Low Stock Toggle */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none', marginLeft: 16 }}>
            <input 
              type="checkbox" 
              checked={showLowStockOnly} 
              onChange={e => setShowLowStockOnly(e.target.checked)}
              style={{ width: 16, height: 16, cursor: 'pointer' }}
            />
            <span style={{ fontSize: 14, color: showLowStockOnly ? '#f59e0b' : 'var(--color-text-muted)' }}>
              Show Low Stock Only
            </span>
          </label>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid-4" style={{ marginBottom: 24, gap: 16 }}>
        <div className="card card-kpi" style={{ borderLeft: '4px solid #3b82f6', padding: 20 }}>
          <div className="card-kpi-header" style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-text-muted)', marginBottom: 8 }}>
            <span>Total Stock Items</span>
            <Box size={20} style={{ color: '#3b82f6' }} />
          </div>
          <h2 style={{ fontSize: 24, fontWeight: 'bold' }}>{kpis.totalItems}</h2>
          <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Unique Products Listed</span>
        </div>

        <div className="card card-kpi" style={{ borderLeft: '4px solid #10b981', padding: 20 }}>
          <div className="card-kpi-header" style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-text-muted)', marginBottom: 8 }}>
            <span>Stock Value (Purchase)</span>
            <DollarSign size={20} style={{ color: '#10b981' }} />
          </div>
          <h2 style={{ fontSize: 24, fontWeight: 'bold' }}>{formatCurrency(kpis.purchaseValuation)}</h2>
          <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Asset Value at Cost</span>
        </div>

        <div className="card card-kpi" style={{ borderLeft: '4px solid #8b5cf6', padding: 20 }}>
          <div className="card-kpi-header" style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-text-muted)', marginBottom: 8 }}>
            <span>Stock Value (Retail)</span>
            <TrendingUp size={20} style={{ color: '#8b5cf6' }} />
          </div>
          <h2 style={{ fontSize: 24, fontWeight: 'bold' }}>{formatCurrency(kpis.sellingValuation)}</h2>
          <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Asset Value at Retail</span>
        </div>

        <div className="card card-kpi" style={{ borderLeft: `4px solid ${kpis.lowStockCount > 0 ? '#ef4444' : '#10b981'}`, padding: 20 }}>
          <div className="card-kpi-header" style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-text-muted)', marginBottom: 8 }}>
            <span>Low Stock Warnings</span>
            <AlertTriangle size={20} style={{ color: kpis.lowStockCount > 0 ? '#ef4444' : '#10b981' }} />
          </div>
          <h2 style={{ fontSize: 24, fontWeight: 'bold', color: kpis.lowStockCount > 0 ? '#ef4444' : 'inherit' }}>
            {kpis.lowStockCount}
          </h2>
          <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Stock below minimum level</span>
        </div>
      </div>

      {/* Visual Analytics */}
      {chartData.length > 0 && (
        <div className="card" style={{ padding: 20, marginBottom: 24, minHeight: 320 }}>
          <h3 style={{ fontSize: 16, marginBottom: 16 }}>Top Products by Valuation (₹ Value)</h3>
          <div style={{ width: '100%', height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 20, left: 30, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={true} stroke="rgba(255,255,255,0.05)" />
                <XAxis type="number" stroke="var(--color-text-muted)" fontSize={12} tickLine={false} />
                <YAxis dataKey="name" type="category" stroke="var(--color-text-muted)" fontSize={11} tickLine={false} width={100} />
                <Tooltip 
                  formatter={(val) => [`₹${val.toLocaleString('en-IN')}`, 'Valuation']}
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: 8 }}
                />
                <Bar dataKey="Valuation (₹)" radius={[0, 4, 4, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index % 2 === 0 ? '#3b82f6' : '#60a5fa'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Inventory Data Grid */}
      <div className="card" style={{ padding: 20 }}>
        <h3 style={{ fontSize: 16, marginBottom: 16 }}>Item Inventory Asset List</h3>
        {loading ? (
          <div style={{ display: 'flex', height: 200, justifyContent: 'center', alignItems: 'center', color: 'var(--color-text-muted)' }}>
            <RefreshCw size={24} className="spin" style={{ marginRight: 8 }} /> Loading inventory details...
          </div>
        ) : filteredItems.length === 0 ? (
          <div style={{ display: 'flex', height: 200, justifyContent: 'center', alignItems: 'center', color: 'var(--color-text-muted)' }}>
            No products match the selected filters
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Item Name</th>
                  <th>Category</th>
                  <th>HSN Code</th>
                  <th style={{ textAlign: 'right' }}>Stock Level</th>
                  <th>Unit</th>
                  <th style={{ textAlign: 'right' }}>Purchase Price</th>
                  <th style={{ textAlign: 'right' }}>Selling Price</th>
                  <th style={{ textAlign: 'right' }}>MRP</th>
                  <th style={{ textAlign: 'right' }}>Asset Value</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map(item => {
                  const isLow = item.current_stock <= (item.min_stock_level || 0);
                  const totalStockValue = (item.current_stock || 0) * (item.purchase_price || 0);

                  return (
                    <tr key={item.id} className={isLow ? 'row-warning' : ''} style={isLow ? { backgroundColor: 'rgba(239, 68, 68, 0.03)' } : {}}>
                      <td style={{ fontWeight: 'bold' }}>{item.code || '-'}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {item.name}
                          {isLow && (
                            <span 
                              style={{ 
                                display: 'inline-flex', 
                                alignItems: 'center', 
                                gap: 2, 
                                fontSize: 10, 
                                backgroundColor: 'rgba(239, 68, 68, 0.1)', 
                                color: '#ef4444', 
                                padding: '2px 6px', 
                                borderRadius: 4, 
                                fontWeight: 500 
                              }}
                            >
                              <AlertTriangle size={10} /> Low
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ color: 'var(--color-text-muted)' }}>{item.category_name || '-'}</td>
                      <td style={{ fontFamily: 'monospace', color: 'var(--color-text-muted)' }}>{item.hsn_code || '-'}</td>
                      <td style={{ textAlign: 'right', fontWeight: 'bold', color: isLow ? '#ef4444' : 'inherit' }}>
                        {item.current_stock}
                      </td>
                      <td>{item.unit_name}</td>
                      <td style={{ textAlign: 'right' }}>{formatCurrency(item.purchase_price)}</td>
                      <td style={{ textAlign: 'right' }}>{formatCurrency(item.selling_price)}</td>
                      <td style={{ textAlign: 'right' }}>{formatCurrency(item.mrp)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{formatCurrency(totalStockValue)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
