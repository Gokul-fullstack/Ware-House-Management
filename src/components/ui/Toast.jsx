import React, { useEffect } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';

const icons = { success: CheckCircle, error: XCircle, warning: AlertTriangle, info: Info };

function Toast({ toast, onClose }) {
  const Icon = icons[toast.type] || Info;
  return (
    <div className={`toast toast-${toast.type}`}>
      <div className="toast-icon"><Icon /></div>
      <div className="toast-content">
        <div className="toast-title">{toast.title}</div>
        {toast.message && <div className="toast-message">{toast.message}</div>}
      </div>
      <button className="toast-close" onClick={() => onClose(toast.id)}><X size={16} /></button>
    </div>
  );
}

export function ToastContainer() {
  const { toasts, removeToast } = useApp();
  if (!toasts.length) return null;
  return (
    <div className="toast-container">
      {toasts.map(t => <Toast key={t.id} toast={t} onClose={removeToast} />)}
    </div>
  );
}
