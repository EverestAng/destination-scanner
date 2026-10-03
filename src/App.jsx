import React, { useState, useEffect } from 'react';
import AdminDashboard from './AdminDashboard';
import AgentScanner from './AgentScanner';
import { Lock, User, ShieldCheck, Shield, Smartphone } from 'lucide-react';

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
        
        {/* HEADER & LOGO */}
        <div className="text-center mb-6">
          <div className="inline-flex p-3 bg-blue-500/10 border border-blue-500/20 rounded-full text-blue-400 mb-2">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-white">GeoVerify Portal</h1>
          <p className="text-xs text-slate-400 mt-1">Employee Login System</p>
        </div>

        {/* TAB SWITCHER */}
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

        {/* LOGIN FORM */}
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
            <label className="text-xs font-semibold text-slate-300">Password</label>
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

        {/* COMPANY BRANDING / FOOTER */}
        <div className="mt-6 text-center text-slate-500 text-[11px] space-y-1">
          <p>© 2026 GeoVerify Inc. All rights reserved.</p>
          <p>Secure Field Verification & Management System</p>
        </div>

      </div>
    </div>
  );
}

export default App;