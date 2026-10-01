import React, { useState, useEffect, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { Camera, MapPin, CheckCircle2, XCircle, RefreshCw, Bell, WifiOff, Wifi, Home, User, Settings as SettingsIcon, ShieldCheck, Lock, LogOut } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const AgentScanner = ({ loggedUser }) => {
  const [activeTab, setActiveTab] = useState('home');

  const [scannedResult, setScannedResult] = useState(null);
  const [gpsLocation, setGpsLocation] = useState(null);
  const [locationError, setLocationError] = useState('');
  const [verificationStatus, setVerificationStatus] = useState(null); 
  const [errorMessage, setErrorMessage] = useState('');
  const [distanceMeters, setDistanceMeters] = useState(null);

  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  
  // Unahing gamitin ang loggedUser prop, i-fallback sa localStorage, at i-save agad para laging updated
  const getInitialAgent = () => {
    if (loggedUser && loggedUser.id) {
      localStorage.setItem('current_agent', JSON.stringify(loggedUser));
      return loggedUser;
    }
    try {
      const stored = localStorage.getItem('current_agent');
      if (stored) return JSON.parse(stored);
    } catch (e) {}
    return { id: 2, name: 'Juan Dela Cruz' }; 
  };

  const initialAgent = getInitialAgent();
  const [currentAgentId, setCurrentAgentId] = useState(initialAgent.id || 2);
  const [agentName, setAgentName] = useState(initialAgent.name || 'Juan Dela Cruz');
  
  const [notifications, setNotifications] = useState([]);
  const [hasUnread, setHasUnread] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordMessage, setPasswordMessage] = useState('');
  const [passwordStatus, setPasswordStatus] = useState(null);

  const [isOnline, setIsOnline] = useState(navigator.onLine);

  const selectedCustomerRef = useRef(selectedCustomer);
  const gpsLocationRef = useRef(gpsLocation);
  const currentAgentIdRef = useRef(currentAgentId);

  useEffect(() => {
    selectedCustomerRef.current = selectedCustomer;
  }, [selectedCustomer]);

  useEffect(() => {
    gpsLocationRef.current = gpsLocation;
  }, [gpsLocation]);

  useEffect(() => {
    currentAgentIdRef.current = currentAgentId;
  }, [currentAgentId]);

  // Sinisigurong nag-a-update ang state at localStorage kapag nagpalit o pumasok ang loggedUser prop
  useEffect(() => {
    if (loggedUser && loggedUser.id) {
      setCurrentAgentId(loggedUser.id);
      setAgentName(loggedUser.name);
      localStorage.setItem('current_agent', JSON.stringify(loggedUser));
    }
  }, [loggedUser]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      syncOfflineVisits();
      if (currentAgentId) fetchAssignedStoresOnline(currentAgentId);
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    if (navigator.onLine) {
      syncOfflineVisits();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [currentAgentId]);

  const syncOfflineVisits = async () => {
    const pendingVisits = JSON.parse(localStorage.getItem('offline_visits_queue') || '[]');
    if (pendingVisits.length === 0) return;

    try {
      const remainingVisits = [];
      for (const visit of pendingVisits) {
        const response = await fetch(`${API_URL}/api/visits`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(visit)
        });
        if (!response.ok) {
          remainingVisits.push(visit);
        }
      }
      localStorage.setItem('offline_visits_queue', JSON.stringify(remainingVisits));
    } catch (err) {
      console.error("Background sync failed:", err);
    }
  };

  const fetchAssignedStoresOnline = async (agentId) => {
    try {
      const storesRes = await fetch(`${API_URL}/api/agents/${agentId}/assigned-stores`);
      if (storesRes.ok) {
        const storesData = await storesRes.json();
        if (Array.isArray(storesData)) {
          processStoreUpdates(agentId, storesData);
          setErrorMessage('');
          return true;
        }
      }
    } catch (err) {
      console.log("Online fetch assigned stores warning:", err);
    }
    return false;
  };

  const processStoreUpdates = (agentId, newStores) => {
    setCustomers(newStores);
    if (newStores.length > 0 && (!selectedCustomer || !newStores.some(s => s.id === selectedCustomer.id))) {
      setSelectedCustomer(newStores[0]);
    } else if (newStores.length === 0) {
      setSelectedCustomer(null);
    }

    const savedNotifs = JSON.parse(localStorage.getItem(`agent_notifications_${agentId}`) || '[]');
    setNotifications(savedNotifs);

    const unreadStateKey = `agent_has_unread_${agentId}`;
    const savedUnread = localStorage.getItem(unreadStateKey);
    if (savedUnread !== null) {
      setHasUnread(savedUnread === 'true');
    }

    const cacheKey = `last_known_stores_count_${agentId}`;
    const savedCount = localStorage.getItem(cacheKey);
    
    if (savedCount === null) {
      localStorage.setItem(cacheKey, newStores.length.toString());
      return;
    }

    const prevCount = parseInt(savedCount, 10);

    if (newStores.length > prevCount) {
      const addedCount = newStores.length - prevCount;
      const newNotif = {
        title: "New Store Assigned",
        message: `Admin added ${addedCount} new store(s) to your assigned list.`,
        created_at: "Just now"
      };

      const updatedNotifs = [newNotif, ...savedNotifs];
      setNotifications(updatedNotifs);
      setHasUnread(true);

      localStorage.setItem(`agent_notifications_${agentId}`, JSON.stringify(updatedNotifs));
      localStorage.setItem(unreadStateKey, 'true');
    }

    localStorage.setItem(cacheKey, newStores.length.toString());
  };

  useEffect(() => {
    const initStores = async () => {
      try {
        const agentSpecificCache = localStorage.getItem(`cached_assigned_stores_${currentAgentId}`);
        if (agentSpecificCache) {
          try {
            const parsed = JSON.parse(agentSpecificCache);
            if (Array.isArray(parsed)) {
              processStoreUpdates(currentAgentId, parsed);
            }
          } catch (e) {}
        }

        if (navigator.onLine) {
          await fetchAssignedStoresOnline(currentAgentId);
        }
      } catch (err) {
        console.error("Init error:", err);
      }
    };

    if (currentAgentId) {
      initStores();
    }
  }, [currentAgentId]);

  useEffect(() => {
    if (currentAgentId && customers.length > 0) {
      localStorage.setItem(`cached_assigned_stores_${currentAgentId}`, JSON.stringify(customers));
    }
  }, [customers, currentAgentId]);

  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3;
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return Math.round(R * c);
  };

  const getAgentLocation = () => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGpsLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setLocationError('');
      },
      () => {
        setLocationError('Failed to get GPS location.');
      },
      { enableHighAccuracy: true }
    );
  };

  useEffect(() => {
    getAgentLocation();
  }, []);

  useEffect(() => {
    if (activeTab === 'home' && !scannedResult) {
      const timer = setTimeout(() => {
        const scannerElement = document.getElementById("reader");
        if (scannerElement) {
          try {
            const scanner = new Html5QrcodeScanner("reader", {
              fps: 10,
              qrbox: { width: 250, height: 250 }
            }, false);

            scanner.render((decodedText) => {
              setScannedResult(decodedText);
              scanner.clear().catch(() => {});
              verifyVisit(decodedText);
            }, () => {});
          } catch (e) {}
        }
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [activeTab, scannedResult]);

  const verifyVisit = async (token) => {
    setVerificationStatus('verifying');
    setErrorMessage('');

    const currentCustomer = selectedCustomerRef.current;
    const currentGps = gpsLocationRef.current;
    const agentId = currentAgentIdRef.current;

    if (!currentGps) {
      setVerificationStatus('failed');
      setErrorMessage('GPS Location unavailable.');
      return;
    }

    if (!currentCustomer) {
      setVerificationStatus('failed');
      setErrorMessage('No store selected.');
      return;
    }

    const targetLat = parseFloat(currentCustomer.latitude);
    const targetLng = parseFloat(currentCustomer.longitude);

    const dist = calculateDistance(currentGps.lat, currentGps.lng, targetLat, targetLng);
    setDistanceMeters(dist);

    if (token !== currentCustomer.qr_token) {
      setVerificationStatus('failed');
      setErrorMessage(`Invalid QR code for ${currentCustomer.name}.`);
      return;
    }

    if (dist > 20) {
      setVerificationStatus('failed');
      setErrorMessage(`Too far from ${currentCustomer.name} (${dist}m away). Max is 3m.`);
      return;
    }

    const visitPayload = {
      agent_id: agentId || 2,
      customer_id: currentCustomer.id,
      agent_lat: currentGps.lat,
      agent_lng: currentGps.lng,
      distance_meters: dist,
      status: 'verified'
    };

    if (navigator.onLine) {
      try {
        const response = await fetch(`${API_URL}/api/visits`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(visitPayload)
        });

        const data = await response.json();
        if (response.ok) {
          setVerificationStatus('success');
        } else {
          setVerificationStatus('failed');
          setErrorMessage(data.error || 'Failed to record visit.');
        }
      } catch (err) {
        saveOfflineQueue(visitPayload);
      }
    } else {
      saveOfflineQueue(visitPayload);
    }
  };

  const saveOfflineQueue = (payload) => {
    const existingQueue = JSON.parse(localStorage.getItem('offline_visits_queue') || '[]');
    existingQueue.push(payload);
    localStorage.setItem('offline_visits_queue', JSON.stringify(existingQueue));
    setVerificationStatus('success');
  };

  const handleCustomerChange = (e) => {
    const customerId = parseInt(e.target.value);
    const found = customers.find((c) => c.id === customerId);
    setSelectedCustomer(found);
  };

  const handlePasswordChangeSubmit = async (e) => {
    e.preventDefault();
    setPasswordMessage('');
    setPasswordStatus(null);

    if (newPassword !== confirmPassword) {
      setPasswordStatus('error');
      setPasswordMessage('New passwords do not match.');
      return;
    }

    if (newPassword.length < 6) {
      setPasswordStatus('error');
      setPasswordMessage('Password must be at least 6 characters.');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/agents/${currentAgentId || 2}/change-password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword })
      });

      const data = await response.json();

      if (response.ok) {
        setPasswordStatus('success');
        setPasswordMessage('Password successfully updated!');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setPasswordStatus('error');
        setPasswordMessage(data.error || 'Failed to update password.');
      }
    } catch (err) {
      setPasswordStatus('error');
      setPasswordMessage('Network error. Make sure server is running.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-between max-w-md mx-auto relative shadow-2xl border-x border-slate-800">
      <header className="bg-slate-900 border-b border-slate-800 px-4 py-3 sticky top-0 z-50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-blue-500" />
          <div>
            <h1 className="text-sm font-extrabold tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">
              GeoVerify
            </h1>
            <p className="text-[10px] text-slate-400">Logged in as: <span className="text-slate-200 font-semibold">{agentName}</span> (AGENT)</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className={`text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1 border ${isOnline ? 'bg-emerald-950/80 text-emerald-400 border-emerald-800' : 'bg-amber-950/80 text-amber-400 border-amber-800'}`}>
            {isOnline ? <Wifi className="w-2.5 h-2.5" /> : <WifiOff className="w-2.5 h-2.5" />}
            {isOnline ? 'Online' : 'Offline'}
          </div>
          <button
            onClick={() => {
              localStorage.clear();
              window.location.reload();
            }}
            className="bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-bold px-2.5 py-1 rounded-lg transition cursor-pointer flex items-center gap-1"
          >
            <LogOut className="w-3 h-3" /> Logout
          </button>
        </div>
      </header>

      <main className="flex-1 p-4 overflow-y-auto mb-16 space-y-4">
        {activeTab === 'home' && (
          <div className="space-y-4">
            <div className="bg-slate-900 p-3.5 rounded-xl border border-slate-800 shadow-sm text-center">
              <label className="text-[11px] text-slate-400 block mb-1">Assigned Target Store:</label>
              {customers.length > 0 ? (
                <select
                  value={selectedCustomer ? selectedCustomer.id : ''}
                  onChange={handleCustomerChange}
                  className="bg-slate-800 text-white text-xs font-semibold rounded-lg border border-slate-700 p-2 focus:ring-2 focus:ring-blue-500 w-full text-center outline-none cursor-pointer"
                >
                  {customers.map((store) => (
                    <option key={store.id} value={store.id}>
                      {store.name} ({store.address || 'Main Branch'})
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-xs text-amber-400 bg-amber-950/50 p-2 rounded-lg border border-amber-900/50">
                  {errorMessage || "No stores assigned to this agent yet."}
                </p>
              )}
            </div>

            {!scannedResult ? (
              <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 shadow-inner">
                <div id="reader" className="overflow-hidden rounded-xl"></div>
              </div>
            ) : (
              <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 text-center space-y-4">
                {verificationStatus === 'verifying' && (
                  <div className="space-y-3 py-6">
                    <RefreshCw className="w-10 h-10 text-blue-400 animate-spin mx-auto" />
                    <p className="font-semibold text-sm">Validating visit...</p>
                  </div>
                )}

                {verificationStatus === 'success' && (
                  <div className="space-y-3 py-4">
                    <CheckCircle2 className="w-16 h-16 text-emerald-400 mx-auto" />
                    <h2 className="text-xl font-bold text-emerald-400">
                      {isOnline ? 'Visit Verified!' : 'Verified (Offline Saved)'}
                    </h2>
                    <p className="text-xs text-slate-300">
                      Matched for <span className="font-bold text-white">{selectedCustomer?.name}</span> ({distanceMeters}m away).
                    </p>
                  </div>
                )}

                {verificationStatus === 'failed' && (
                  <div className="space-y-3 py-4">
                    <XCircle className="w-16 h-16 text-rose-500 mx-auto" />
                    <h2 className="text-xl font-bold text-rose-400">Verification Failed</h2>
                    <p className="text-xs text-slate-300">{errorMessage}</p>
                  </div>
                )}

                <button
                  onClick={() => { setScannedResult(null); setVerificationStatus(null); }}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-2.5 rounded-xl text-sm transition cursor-pointer"
                >
                  Scan Another Code
                </button>
              </div>
            )}

            <div className="bg-slate-900 p-3.5 rounded-xl border border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <MapPin className={`w-5 h-5 ${gpsLocation ? 'text-emerald-400' : 'text-amber-400 animate-bounce'}`} />
                <div>
                  <p className="text-xs font-semibold">GPS Location Status</p>
                  <p className="text-[10px] text-slate-400">
                    {gpsLocation ? `${gpsLocation.lat.toFixed(4)}, ${gpsLocation.lng.toFixed(4)}` : 'Acquiring GPS...'}
                  </p>
                </div>
              </div>
              <button 
                onClick={getAgentLocation}
                className="text-xs bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg text-slate-300 cursor-pointer border border-slate-700"
              >
                Refresh
              </button>
            </div>
          </div>
        )}

        {activeTab === 'profile' && (
          <div className="space-y-4">
            <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 text-center space-y-3">
              <div className="w-20 h-20 bg-blue-600/20 border-2 border-blue-500 text-blue-400 rounded-full flex items-center justify-center text-2xl font-bold mx-auto">
                {agentName.charAt(0)}
              </div>
              <div>
                <h2 className="text-lg font-bold">{agentName}</h2>
                <p className="text-xs text-slate-400">Field Agent ID: #{currentAgentId || 2}</p>
              </div>
            </div>

            <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Account Details</h3>
              <div className="flex justify-between text-xs py-2 border-b border-slate-800">
                <span className="text-slate-400">Role</span>
                <span className="font-semibold text-emerald-400">Field Verifier (AGENT)</span>
              </div>
              <div className="flex justify-between text-xs py-2 border-b border-slate-800">
                <span className="text-slate-400">Assigned Stores Count</span>
                <span className="font-semibold">{customers.length} Stores</span>
              </div>
              <div className="flex justify-between text-xs py-2">
                <span className="text-slate-400">Connection Status</span>
                <span className="font-semibold">{isOnline ? 'Connected' : 'Offline Mode'}</span>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'notifications' && (
          <div className="space-y-3">
            <h2 className="text-sm font-bold text-slate-300 px-1">Recent Notifications</h2>
            {notifications.length > 0 ? (
              notifications.map((notif, idx) => (
                <div key={idx} className="bg-slate-900 p-4 rounded-xl border border-slate-800 space-y-1 shadow-sm">
                  <div className="flex justify-between items-start">
                    <p className="text-xs font-bold text-blue-400">{notif.title}</p>
                    <span className="text-[10px] text-slate-500">{notif.created_at}</span>
                  </div>
                  <p className="text-xs text-slate-300">{notif.message}</p>
                </div>
              ))
            ) : (
              <div className="bg-slate-900 p-8 rounded-2xl border border-slate-800 text-center text-slate-400 text-xs">
                No new notifications.
              </div>
            )}
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="space-y-4">
            <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 space-y-3">
              <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
                <Lock className="w-4 h-4 text-blue-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">Change Password</h3>
              </div>

              <form onSubmit={handlePasswordChangeSubmit} className="space-y-3 pt-1">
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">Current Password</label>
                  <input 
                    type="password"
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-800 border border-slate-700 text-xs rounded-lg p-2 text-white outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">New Password</label>
                  <input 
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-800 border border-slate-700 text-xs rounded-lg p-2 text-white outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">Confirm New Password</label>
                  <input 
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-800 border border-slate-700 text-xs rounded-lg p-2 text-white outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {passwordMessage && (
                  <p className={`text-[11px] p-2 rounded-lg border ${passwordStatus === 'success' ? 'bg-emerald-950/50 text-emerald-400 border-emerald-900/50' : 'bg-rose-950/50 text-rose-400 border-rose-900/50'}`}>
                    {passwordMessage}
                  </p>
                )}

                <button 
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 rounded-xl text-xs transition cursor-pointer"
                >
                  Update Password
                </button>
              </form>
            </div>

            <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Preferences</h3>
              <div className="flex items-center justify-between py-2 border-b border-slate-800 text-xs">
                <span>High Accuracy GPS</span>
                <input type="checkbox" defaultChecked className="accent-blue-600 w-4 h-4 cursor-pointer" />
              </div>
              <div className="flex items-center justify-between py-2 border-b border-slate-800 text-xs">
                <span>Push Notifications</span>
                <input type="checkbox" defaultChecked className="accent-blue-600 w-4 h-4 cursor-pointer" />
              </div>
              <div className="flex items-center justify-between py-2 text-xs">
                <span>Dark Theme</span>
                <input type="checkbox" defaultChecked disabled className="accent-blue-600 w-4 h-4 cursor-pointer" />
              </div>
            </div>

            <button 
              onClick={() => {
                localStorage.clear();
                window.location.reload();
              }}
              className="w-full bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 border border-rose-800 font-bold py-2.5 rounded-xl text-xs transition cursor-pointer"
            >
              Clear Cache & Logout
            </button>
          </div>
        )}
      </main>

      <nav className="bg-slate-900 border-t border-slate-800 fixed bottom-0 left-0 right-0 max-w-md mx-auto flex justify-around items-center h-16 px-2 z-50 shadow-lg">
        <button
          onClick={() => setActiveTab('home')}
          className={`flex flex-col items-center justify-center flex-1 h-full cursor-pointer transition ${activeTab === 'home' ? 'text-blue-500 font-bold border-t-2 border-blue-500' : 'text-slate-400 hover:text-slate-200'}`}
        >
          <Home className="w-5 h-5 mb-1" />
          <span className="text-[10px]">Home</span>
        </button>

        <button
          onClick={() => setActiveTab('profile')}
          className={`flex flex-col items-center justify-center flex-1 h-full cursor-pointer transition ${activeTab === 'profile' ? 'text-blue-500 font-bold border-t-2 border-blue-500' : 'text-slate-400 hover:text-slate-200'}`}
        >
          <User className="w-5 h-5 mb-1" />
          <span className="text-[10px]">Profile</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('notifications');
            setHasUnread(false);
            if (currentAgentId) {
              localStorage.setItem(`agent_has_unread_${currentAgentId}`, 'false');
            }
          }}
          className={`flex flex-col items-center justify-center flex-1 h-full cursor-pointer relative transition ${activeTab === 'notifications' ? 'text-blue-500 font-bold border-t-2 border-blue-500' : 'text-slate-400 hover:text-slate-200'}`}
        >
          <div className="relative">
            <Bell className="w-5 h-5 mb-1" />
            {hasUnread && (
              <span className="absolute -top-1 -right-2 bg-rose-500 text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                !
              </span>
            )}
          </div>
          <span className="text-[10px]">Alerts</span>
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          className={`flex flex-col items-center justify-center flex-1 h-full cursor-pointer transition ${activeTab === 'settings' ? 'text-blue-500 font-bold border-t-2 border-blue-500' : 'text-slate-400 hover:text-slate-200'}`}
        >
          <SettingsIcon className="w-5 h-5 mb-1" />
          <span className="text-[10px]">Settings</span>
        </button>
      </nav>
    </div>
  );
};

export default AgentScanner;