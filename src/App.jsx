import React, { useState, useEffect } from 'react';
import AdminDashboard from './AdminDashboard';
import AgentScanner from './AgentScanner';
import { Lock, User, ShieldCheck, Shield, Smartphone, KeyRound, X } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

function App() {
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const savedUser = localStorage.getItem('geo_current_user');
      return savedUser ? JSON.parse(savedUser) : null;
    } catch (e) {
      return null;
    }
  });

  const [activeTab, setActiveTab] = useState('admin');
  const [email, setEmail] = useState('admin@geoverify.com');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [agents, setAgents] = useState([]);

  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [forgotMessage, setForgotMessage] = useState('');
  const [forgotStatus, setForgotStatus] = useState(null);
  const [isResetting, setIsResetting] = useState(false);

  const fetchAgents = async () => {
    try {
      const res = await fetch(`${API_URL}/api/agents`);
      const data = await res.json();
      setAgents(data);
    } catch (err) {
      console.error('Failed to fetch agents:', err);
    }
  };

  useEffect(() => {
    if (currentUser && currentUser.role === 'admin') {
      fetchAgents();
    }
  }, [currentUser]);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setLoginError('');
    if (tab === 'admin') {
      setEmail('admin@geoverify.com');
      setPassword('');
    } else {
      setEmail('');
      setPassword('');
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');

    try {
      const res = await fetch(`${API_URL}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (res.ok) {
        if (activeTab === 'admin' && data.role !== 'admin') {
          setLoginError('This account is not authorized as an Administrator.');
          return;
        }
        if (activeTab === 'agent' && data.role !== 'agent') {
          setLoginError('This account is not authorized as a Field Agent.');
          return;
        }

        setCurrentUser(data);
        localStorage.setItem('geo_current_user', JSON.stringify(data));
      } else {
        setLoginError(data.message || 'Invalid email or password!');
      }
    } catch (err) {
      setLoginError('Cannot connect to server. Ensure backend is running.');
    }
  };

  const handleForgotPasswordSubmit = async (e) => {
    e.preventDefault();
    setForgotMessage('');
    setForgotStatus(null);
    setIsResetting(true);

    try {
      const res = await fetch(`${API_URL}/api/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail, newPassword }),
      });

      const data = await res.json();

      if (res.ok) {
        setForgotStatus('success');
        setForgotMessage(data.message);
        setTimeout(() => {
          setIsForgotModalOpen(false);
          setForgotEmail('');
          setNewPassword('');
          setForgotMessage('');
          setForgotStatus(null);
        }, 3000);
      } else {
        setForgotStatus('error');
        setForgotMessage(data.error || 'Failed to reset password.');
      }
    } catch (err) {
      setForgotStatus('error');
      setForgotMessage('Cannot connect to server.');
    } finally {
      setIsResetting(false);
    }
  };

  const handleAddAgent = async (newAgentData) => {
    try {
      const res = await fetch(`${API_URL}/api/agents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newAgentData),
      });

      if (res.ok) {
        fetchAgents();
      }
    } catch (err) {
      console.error('Failed to add agent:', err);
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setEmail('admin@geoverify.com');
    setPassword('');
    setActiveTab('admin');
    localStorage.removeItem('geo_current_user');
  };

  if (currentUser) {
    return (
      <div>
        <div className="bg-slate-950 text-slate-300 px-4 py-2 flex justify-between items-center text-xs border-b border-slate-800">
          <span>Logged in as: <b className="text-white">{currentUser.name}</b> ({currentUser.role.toUpperCase()})</span>
          <button 
            onClick={handleLogout}
            className="bg-rose-600 hover:bg-rose-700 text-white px-3 py-1 rounded transition font-semibold cursor-pointer"
          >
            Logout
          </button>
        </div>

        {currentUser.role === 'admin' ? (
          <AdminDashboard agentsList={agents} onAddAgent={handleAddAgent} currentUser={currentUser} />
        ) : (
          <AgentScanner loggedUser={currentUser} />
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 font-sans relative">
      <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-2xl w-full max-w-md">
        
        <div className="text-center mb-6">
          <div className="inline-flex p-3 bg-blue-500/10 border border-blue-500/20 rounded-full text-blue-400 mb-2">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-white">GeoVerify Portal</h1>
          <p className="text-xs text-slate-400 mt-1">Employee Login System</p>
        </div>

        <div className="grid grid-cols-2 gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 mb-6">
          <button
            type="button"
            onClick={() => handleTabChange('admin')}
            className={`py-2 text-xs font-bold rounded-lg transition flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'admin' 
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' 
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Shield className="w-3.5 h-3.5" /> Admin Portal
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('agent')}
            className={`py-2 text-xs font-bold rounded-lg transition flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'agent' 
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20' 
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" /> Agent Portal
          </button>
        </div>

        {loginError && (
          <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs rounded-lg font-semibold">
            {loginError}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-300">Email Address</label>
            <div className="relative mt-1">
              <User className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={activeTab === 'admin' ? 'admin@geoverify.com' : 'juan@agent.com'} 
                className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 text-white rounded-lg text-sm focus:outline-blue-500"
                required
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center">
              <label className="text-xs font-semibold text-slate-300">Password</label>
              <button
                type="button"
                onClick={() => {
                  setForgotEmail(email || '');
                  setNewPassword('');
                  setForgotMessage('');
                  setForgotStatus(null);
                  setIsForgotModalOpen(true);
                }}
                className="text-[11px] text-blue-400 hover:underline cursor-pointer"
              >
                Forgot Password?
              </button>
            </div>
            <div className="relative mt-1">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••" 
                className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 text-white rounded-lg text-sm focus:outline-blue-500"
                required
              />
            </div>
          </div>

          <button 
            type="submit" 
            className={`w-full font-bold py-2.5 rounded-lg text-sm transition shadow-lg cursor-pointer text-white ${
              activeTab === 'admin' ? 'bg-blue-600 hover:bg-blue-500 shadow-blue-600/20' : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20'
            }`}
          >
            Sign In to {activeTab === 'admin' ? 'Admin' : 'Agent'} Portal
          </button>
        </form>

        <div className="mt-6 text-center text-slate-500 text-[11px] space-y-1">
          <p>© 2026 GeoVerify Inc. All rights reserved.</p>
          <p>Secure Field Verification & Management System</p>
        </div>

      </div>

      {isForgotModalOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl relative text-slate-200">
            <button 
              type="button"
              onClick={() => setIsForgotModalOpen(false)}
              className="absolute top-4 right-4 p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-500/10 text-blue-400 rounded-xl border border-blue-500/20">
                <KeyRound className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-white">Reset Account Password</h3>
                <p className="text-xs text-slate-400">Enter your email and set a new password.</p>
              </div>
            </div>

            <form onSubmit={handleForgotPasswordSubmit} className="space-y-3 pt-2">
              <div>
                <label className="text-xs font-semibold text-slate-300">Registered Email Address</label>
                <input 
                  type="email" 
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="e.g. admin@geoverify.com or agent email"
                  className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 text-white rounded-lg text-sm focus:outline-blue-500"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300">New Password</label>
                <input 
                  type="password" 
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password (min. 3 chars)"
                  className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 text-white rounded-lg text-sm focus:outline-blue-500"
                  required
                />
              </div>

              {forgotMessage && (
                <div className={`p-3 rounded-lg text-xs font-semibold border ${
                  forgotStatus === 'success' 
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' 
                    : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                }`}>
                  {forgotMessage}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button 
                  type="button"
                  onClick={() => setIsForgotModalOpen(false)}
                  className="w-1/2 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={isResetting}
                  className="w-1/2 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold transition disabled:opacity-50 cursor-pointer shadow-lg shadow-blue-600/20"
                >
                  {isResetting ? 'Resetting...' : 'Reset Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;