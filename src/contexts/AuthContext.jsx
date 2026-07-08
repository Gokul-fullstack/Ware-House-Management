import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AuthContext = createContext(null);

const API_BASE = typeof window !== 'undefined' && window.electronAPI ? 'http://localhost:3456' : '';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(() => localStorage.getItem('session_token'));

  const verify = useCallback(async () => {
    const t = localStorage.getItem('session_token');
    if (!t) { setLoading(false); return; }
    try {
      const res = await fetch(`${API_BASE}/api/auth/verify`, { headers: { 'x-session-token': t } });
      if (res.ok) { const data = await res.json(); setUser(data.user); setToken(t); }
      else { localStorage.removeItem('session_token'); setUser(null); setToken(null); }
    } catch { localStorage.removeItem('session_token'); setUser(null); setToken(null); }
    setLoading(false);
  }, []);

  useEffect(() => { verify(); }, [verify]);

  const login = async (username, password) => {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed');
    localStorage.setItem('session_token', data.token);
    setToken(data.token);
    setUser(data.user);
    return data.user;
  };

  const logout = async () => {
    try { await fetch(`${API_BASE}/api/auth/logout`, { method: 'POST', headers: { 'x-session-token': token } }); } catch {}
    localStorage.removeItem('session_token');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function useApi() {
  const { token } = useAuth();
  const fetchApi = useCallback(async (url, options = {}) => {
    const res = await fetch(`${API_BASE}${url}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', 'x-session-token': token || '', ...options.headers },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  }, [token]);
  return fetchApi;
}
