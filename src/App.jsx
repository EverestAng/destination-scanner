import React, { useState, useEffect } from 'react';
import AdminDashboard from './AdminDashboard';
import AgentScanner from './AgentScanner';
import { Lock, User, ShieldCheck } from 'lucide-react';

// Dynamic API URL para sa Vercel (Render backend) at Localhost development
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [agents, setAgents] = useState([]);

  // Fetch agents list from PostgreSQL via Express API
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

  // Login Handler for Staff / Admins / Agents
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
        setCurrentUser(data);
      } else {
        setLoginError(data.message || 'Invalid email or password!');
      }
    } catch (err) {
      setLoginError('Cannot connect to server. Ensure backend is running.');
    }
  };

  // Add Agent Handler (Inserts to Database)
  const handleAddAgent = async (newAgentData) => {
    try {
      const res = await fetch(`${API_URL}/api/agents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newAgentData),
      });

      if (res.ok) {
        fetchAgents(); // Refresh list from DB
      }
    } catch (err) {
      console.error('Failed to add agent:', err);
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setEmail('');
    setPassword('');
  };

  // Kapag Naka-login na ang Employee (Admin or Agent)
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

  // Employee Direct Login Portal (Admin & Field Agents Only)
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 font-sans relative">
      <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-2xl w-full max-w-md">
        <div className="text-center mb-6">
          <div className="inline-flex p-3 bg-blue-500/10 border border-blue-500/20 rounded-full text-blue-400 mb-2">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-white">GeoVerify Portal</h1>
          <p className="text-xs text-slate-400 mt-1">Employee Login (Admin & Field Agents)</p>
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
                placeholder="admin@geoverify.com" 
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
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-2.5 rounded-lg text-sm transition shadow-lg shadow-blue-600/20 cursor-pointer"
          >
            Sign In
          </button>
        </form>

        <div className="mt-6 p-3 bg-slate-950/60 rounded-lg text-[11px] text-slate-400 border border-slate-800/80 space-y-1">
          <p className="font-bold text-slate-200">Database Accounts:</p>
          <p>👑 <b>Admin:</b> admin@geoverify.com | pwd: <code>admin</code></p>
          <p>📱 <b>Agent:</b> juan@agent.com | pwd: <code>123</code></p>
        </div>
      </div>
    </div>
  );
}

export default App;