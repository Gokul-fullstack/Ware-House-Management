import React, { useState } from 'react';
import { User, Lock, Eye, EyeOff, Mail, Users, ShoppingCart, FileText, MapPin, AlertTriangle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Modal } from '../components/App';

export default function Login() {
  const { login } = useAuth();
  const [authTab, setAuthTab] = useState('login'); // 'login', 'store_signup'
  
  // Login fields
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  
  // Signup fields
  const [name, setName] = useState('');
  const [storeName, setStoreName] = useState('');
  const [gstNumber, setGstNumber] = useState('');
  const [storeAddress, setStoreAddress] = useState('');
  const [email, setEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [successModal, setSuccessModal] = useState(false);

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password) { setError('Please enter username and password'); return; }
    setLoading(true); setError('');
    try {
      await login(username, password);
    }
    catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  const handleStoreSignUp = async (e) => {
    e.preventDefault();
    if (!email || !signupPassword || !name || !storeName || !storeAddress) {
      setError('Please fill in all required fields');
      return;
    }
    setLoading(true); setError('');
    try {
      const API_BASE = typeof window !== 'undefined' && window.electronAPI ? 'http://localhost:3456' : '';
      const res = await fetch(`${API_BASE}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password: signupPassword,
          name,
          store_name: storeName,
          gst_number: gstNumber || null,
          store_address: storeAddress
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Registration failed');
      
      setSuccessModal(true);
      // Reset signup fields
      setName('');
      setStoreName('');
      setGstNumber('');
      setStoreAddress('');
      setEmail('');
      setSignupPassword('');
      setAuthTab('login');
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };



  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #0a0e1a 0%, #1a1040 30%, #0f172a 60%, #091225 100%)', position: 'relative', overflow: 'hidden', padding: 20 }}>
      {/* Animated background orbs */}
      <div style={{ position: 'absolute', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(59,130,246,0.08) 0%, transparent 70%)', top: '-10%', left: '-5%', animation: 'float 8s ease-in-out infinite' }} />
      <div style={{ position: 'absolute', width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,0.06) 0%, transparent 70%)', bottom: '-5%', right: '-3%', animation: 'float 10s ease-in-out infinite reverse' }} />

      <div style={{ width: '100%', maxWidth: 450, padding: 40, background: 'rgba(17, 24, 39, 0.85)', backdropFilter: 'blur(30px)', border: '1px solid rgba(71, 85, 105, 0.3)', borderRadius: 24, boxShadow: '0 30px 80px rgba(0,0,0,0.5)', position: 'relative', zIndex: 1 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ width: 64, height: 64, margin: '0 auto 16px', background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 800, color: '#fff' }}>AT</div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: 4 }}>Arun Traders</h1>
          <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Billing & Supply Chain Management</p>
        </div>

        {/* Sliding Tab Toggler */}
        <div style={{ position: 'relative', padding: 4, borderRadius: 12, backgroundColor: 'rgba(255, 255, 255, 0.05)', display: 'flex', marginBottom: 24 }}>
          <div
            style={{
              position: 'absolute',
              top: 4,
              bottom: 4,
              borderRadius: 8,
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              transition: 'all 0.3s ease-out',
              left: authTab === 'login' ? 4 : '50%',
              width: '48%'
            }}
          />
          <button type="button" onClick={() => { setAuthTab('login'); setError(''); }}
            style={{ position: 'relative', zIndex: 1, width: '50%', py: 8, textAlign: 'center', border: 'none', background: 'none', color: authTab === 'login' ? '#fff' : '#94a3b8', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer', padding: '10px 0' }}
          >Sign In</button>
          <button type="button" onClick={() => { setAuthTab('store_signup'); setError(''); }}
            style={{ position: 'relative', zIndex: 1, width: '50%', py: 8, textAlign: 'center', border: 'none', background: 'none', color: authTab === 'store_signup' ? '#fff' : '#94a3b8', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer', padding: '10px 0' }}
          >Client Sign-Up</button>
        </div>

        {error && <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, color: '#ef4444', fontSize: '0.82rem', marginBottom: 20, textAlign: 'center' }}>{error}</div>}

        {/* login view */}
        {authTab === 'login' && (
          <form onSubmit={handleLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }} autoComplete="off">
            <div className="input-group">
              <label>Username / Email</label>
              <div className="input-with-icon">
                <User />
                <input className="input" type="text" placeholder="Enter username or email" value={username} onChange={e => setUsername(e.target.value)} autoFocus autoComplete="new-username" />
              </div>
            </div>

            <div className="input-group">
              <label>Password</label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <div className="input-with-icon" style={{ flex: 1 }}>
                  <Lock />
                  <input
                    className="input"
                    type={showPw ? 'text' : 'password'}
                    placeholder="Enter password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    style={{ paddingRight: 40 }}
                    autoComplete="new-password"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', zIndex: 2, padding: 4, display: 'flex', alignItems: 'center' }}
                >
                  {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%', marginTop: 8 }} disabled={loading}>
              {loading ? <div className="loading-spinner loading-spinner-sm" /> : 'Sign In'}
            </button>
          </form>
        )}

        {/* store signup view */}
        {authTab === 'store_signup' && (
          <form onSubmit={handleStoreSignUp} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="input-group">
              <label>Full Name</label>
              <div className="input-with-icon">
                <Users />
                <input className="input" type="text" placeholder="Full name" value={name} onChange={e => setName(e.target.value)} required />
              </div>
            </div>

            <div className="input-group">
              <label>Store Name</label>
              <div className="input-with-icon">
                <ShoppingCart />
                <input className="input" type="text" placeholder="Store or grocery name" value={storeName} onChange={e => setStoreName(e.target.value)} required />
              </div>
            </div>

            <div className="input-group">
              <label>GST Number (Optional)</label>
              <div className="input-with-icon">
                <FileText />
                <input className="input" type="text" placeholder="GSTIN (15 characters)" value={gstNumber} onChange={e => setGstNumber(e.target.value.toUpperCase())} maxLength={15} />
              </div>
            </div>

            <div className="input-group">
              <label>Store Address</label>
              <div className="input-with-icon">
                <MapPin />
                <input className="input" type="text" placeholder="Store address" value={storeAddress} onChange={e => setStoreAddress(e.target.value)} required />
              </div>
            </div>

            <div className="input-group">
              <label>Email Address</label>
              <div className="input-with-icon">
                <Mail />
                <input className="input" type="email" placeholder="Email address" value={email} onChange={e => setEmail(e.target.value)} required />
              </div>
            </div>

            <div className="input-group">
              <label>Password</label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <div className="input-with-icon" style={{ flex: 1 }}>
                  <Lock />
                  <input
                    className="input"
                    type={showPw ? 'text' : 'password'}
                    placeholder="Create a password"
                    value={signupPassword}
                    onChange={e => setSignupPassword(e.target.value)}
                    style={{ paddingRight: 40 }}
                    required
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', zIndex: 2, padding: 4, display: 'flex', alignItems: 'center' }}
                >
                  {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%', marginTop: 8 }} disabled={loading}>
              {loading ? <div className="loading-spinner loading-spinner-sm" /> : 'Create Client Account'}
            </button>
          </form>
        )}



      </div>

      {/* Signup Success Modal */}
      <Modal open={successModal} onClose={() => setSuccessModal(false)} title="Registration Submitted">
        <div style={{ textAlign: 'center', padding: '16px 8px' }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', backgroundColor: 'rgba(16,185,129,0.1)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', boxShadow: 'inset 0 0 10px rgba(16,185,129,0.1)' }}>
            <svg style={{ width: 32, height: 32 }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 'bold', color: '#1e293b', marginBottom: 8 }}>Pending Admin Approval</h3>
          <p style={{ fontSize: '0.875rem', color: '#64748b', lineHeight: '1.6', marginBottom: 24 }}>
            Thank you for registering as a client! Your account request has been successfully transmitted.
            An administrator will evaluate your request and activate your access shortly.
          </p>
          <button
            onClick={() => setSuccessModal(false)}
            className="btn btn-primary"
            style={{ width: '100%', padding: '10px 0', borderRadius: 12, fontWeight: 'semibold', cursor: 'pointer' }}
          >
            Acknowledge
          </button>
        </div>
      </Modal>

      <style>{`@keyframes float { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-20px) } }`}</style>
    </div>
  );
}
