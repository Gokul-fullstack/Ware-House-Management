import React from 'react';
import { PackageSearch, X } from 'lucide-react';

/* ================================================================
   STATUS BADGE COMPONENT
   ================================================================ */
export const StatusBadge = ({ status, className = '' }) => {
  const base = 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize';
  const key = (status || '').toLowerCase().replace(/\s+/g, '_');
  return <span className={`${base} badge-${key} ${className}`}>{status}</span>;
};

/* ================================================================
   LOADING SPINNER
   ================================================================ */
export const Loader = ({ text = 'Loading...' }) => (
  <div className="flex flex-col items-center justify-center py-20 animate-fade-in">
    <div className="spinner mb-4" />
    <p className="text-sm text-gray-500 font-medium">{text}</p>
  </div>
);

/* ================================================================
   EMPTY STATE
   ================================================================ */
export const EmptyState = ({ icon: Icon = PackageSearch, title, message }) => (
  <div className="flex flex-col items-center justify-center py-20 animate-fade-in">
    <div className="w-20 h-20 rounded-full bg-indigo-50 flex items-center justify-center mb-5">
      <Icon className="w-10 h-10 text-indigo-500/50" />
    </div>
    <h3 className="text-lg font-semibold text-gray-700 mb-1">{title || 'Nothing here yet'}</h3>
    <p className="text-sm text-gray-400 max-w-sm text-center">{message || 'Data will appear here once available.'}</p>
  </div>
);

/* ================================================================
   MODAL COMPONENT
   ================================================================ */
export const Modal = ({ open, onClose, title, children, wide }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 modal-backdrop" onClick={onClose}>
      <div
        className={`bg-white rounded-2xl shadow-2xl w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} max-h-[90vh] overflow-y-auto animate-slide-up`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-slate-800">{title}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
};
