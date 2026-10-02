import React, { useState, useEffect } from 'react';
import { 
  Users, MapPin, CheckCircle, 
  Plus, ShieldCheck, UserPlus, User, Trash2, Download, KeyRound, Mail, X, CheckSquare, Search, Settings, Clock, RefreshCw
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import jsPDF from 'jspdf';
import QRCode from 'qrcode';

import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const DefaultIcon = L.icon({
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

const LocationPickerMarker = ({ position, setPosition, onLocationSelect }) => {
  const map = useMapEvents({
    click(e) {
      const { lat, lng } = e.latlng;
      setPosition([lat, lng]);
      onLocationSelect(lat, lng);
    },
  });

  useEffect(() => {
    if (position && position[0] && position[1]) {
      map.flyTo(position, map.getZoom());
    }
  }, [position, map]);

  return position ? <Marker position={position} /> : null;
};

const AdminDashboard = ({ currentUser }) => {
  const [activeTab, setActiveTab] = useState('overview');

  // Agent State
  const [agentName, setAgentName] = useState('');
  const [agentsList, setAgentsList] = useState([]);
  const [agentSuccessMsg, setAgentSuccessMsg] = useState('');

  // Agent Store Assignment Modal State
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [assignedStoreIds, setAssignedStoreIds] = useState([]);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isSavingAssignments, setIsSavingAssignments] = useState(false);
  const [storeSearchQuery, setStoreSearchQuery] = useState('');

  // Store, Map & Visits State
  const [mapCenter] = useState([7.0736, 125.6110]);
  const [selectedPin, setSelectedPin] = useState([7.0736, 125.6110]);
  const [customers, setCustomers] = useState([]);
  const [visitsList, setVisitsList] = useState([]);
  const [newCustomer, setNewCustomer] = useState({ 
    name: '', 
    address: '', 
    lat: '7.0736', 
    lng: '125.6110'
  });

  // Visit Logs Filtering State
  const [visitSearchQuery, setVisitSearchQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Admin Password Settings State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordMessage, setPasswordMessage] = useState('');
  const [passwordStatus, setPasswordStatus] = useState(null);

  const fetchCustomers = async () => {
    try {
      const res = await fetch(`${API_URL}/api/customers`);
      if (res.ok) {
        const data = await res.json();
        setCustomers(data.map(c => ({
          id: c.id,
          name: c.name,
          address: c.address,
          lat: c.latitude,
          lng: c.longitude,
          qr: c.qr_token,
          agent_id: c.agent_id 
        })));
      }
    } catch (err) {
      console.error('Fetch stores error:', err);
    }
  };

  const fetchAgents = async () => {
    try {
      const res = await fetch(`${API_URL}/api/agents`);
      if (res.ok) {
        const data = await res.json();
        setAgentsList(data);
      }
    } catch (err) {
      console.error('Fetch agents error:', err);
    }
  };

  const fetchVisits = async () => {
    try {
      const res = await fetch(`${API_URL}/api/visits`);
      if (res.ok) {
        const data = await res.json();
        setVisitsList(data);
      }
    } catch (err) {
      console.error('Fetch visits error:', err);
    }
  };

  useEffect(() => {
    fetchCustomers();
    fetchAgents();
    fetchVisits();
  }, []);

  const handleMapClick = (lat, lng) => {
    setNewCustomer((prev) => ({
      ...prev,
      lat: lat.toFixed(6),
      lng: lng.toFixed(6),
    }));
  };

  const handleLatChange = (e) => {
    const newLat = e.target.value;
    setNewCustomer((prev) => ({ ...prev, lat: newLat }));
    const parsedLat = parseFloat(newLat);
    const parsedLng = parseFloat(newCustomer.lng);
    if (!isNaN(parsedLat) && !isNaN(parsedLng)) setSelectedPin([parsedLat, parsedLng]);
  };

  const handleLngChange = (e) => {
    const newLng = e.target.value;
    setNewCustomer((prev) => ({ ...prev, lng: newLng }));
    const parsedLat = parseFloat(newCustomer.lat);
    const parsedLng = parseFloat(newLng);
    if (!isNaN(parsedLat) && !isNaN(parsedLng)) setSelectedPin([parsedLat, parsedLng]);
  };

  const handleCreateAgent = async (e) => {
    e.preventDefault();

    if (!agentName.trim()) {
      alert('Please enter the Agent Full Name.');
      return;
    }

    try {
      const res = await fetch(`${API_URL}/api/agents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: agentName }),
      });

      const data = await res.json();

      if (res.ok) {
        setAgentSuccessMsg(`Agent Created! Email: ${data.agent.email} | Default Pass: 123`);
        setAgentName('');
        fetchAgents();
        setTimeout(() => setAgentSuccessMsg(''), 5000);
      } else {
        alert(`Failed to create agent: ${data.error}`);
      }
    } catch (err) {
      console.error('Create agent error:', err);
      alert('Cannot connect to Express backend server!');
    }
  };

  const handleDeleteAgent = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete agent "${name}"?`)) return;

    try {
      const res = await fetch(`${API_URL}/api/agents/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchAgents();
        fetchCustomers();
      } else {
        alert('Failed to delete agent.');
      }
    } catch (err) {
      console.error('Delete agent error:', err);
    }
  };

  const handleOpenAssignModal = async (agent) => {
    setSelectedAgent(agent);
    setStoreSearchQuery('');
    setAssignedStoreIds([]);

    try {
      const res = await fetch(`${API_URL}/api/agents/${agent.id}/stores`);
      if (res.ok) {
        const data = await res.json();
        setAssignedStoreIds(data);
      } else {
        console.warn('Backend endpoint returned error status, proceeding with empty store list.');
      }
    } catch (err) {
      console.error('Error fetching assigned stores:', err);
    } finally {
      setIsAssignModalOpen(true);
    }
  };

  const handleToggleStoreAssignment = (storeId) => {
    setAssignedStoreIds(prev => 
      prev.includes(storeId) 
        ? prev.filter(id => id !== storeId) 
        : [...prev, storeId]
    );
  };

  const storesForThisAgent = customers.filter(store => 
    !store.agent_id || store.agent_id === selectedAgent?.id
  );

  const filteredStores = storesForThisAgent.filter(store => 
    store.name.toLowerCase().includes(storeSearchQuery.toLowerCase()) ||
    store.address.toLowerCase().includes(storeSearchQuery.toLowerCase())
  );

  const handleSelectAllFiltered = () => {
    const filteredIds = filteredStores.map(s => s.id);
    const allSelected = filteredIds.every(id => assignedStoreIds.includes(id));

    if (allSelected) {
      setAssignedStoreIds(prev => prev.filter(id => !filteredIds.includes(id)));
    } else {
      setAssignedStoreIds(prev => Array.from(new Set([...prev, ...filteredIds])));
    }
  };

  const handleSaveAssignments = async () => {
    if (!selectedAgent) return;
    setIsSavingAssignments(true);

    try {
      const res = await fetch(`${API_URL}/api/agents/${selectedAgent.id}/stores`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storeIds: assignedStoreIds })
      });

      if (res.ok) {
        alert(`Assigned stores updated for ${selectedAgent.name}!`);
        setIsAssignModalOpen(false);
        fetchCustomers();
      } else {
        alert('Failed to update store assignments. Make sure your Express endpoint is set up.');
      }
    } catch (err) {
      console.error('Save assignment error:', err);
      alert('Cannot connect to server.');
    } finally {
      setIsSavingAssignments(false);
    }
  };

  const handleAddCustomer = async (e) => {
    e.preventDefault();

    if (!newCustomer.name.trim() || !newCustomer.address.trim() || !newCustomer.lat || !newCustomer.lng) {
      alert('Please fill out all required fields.');
      return;
    }

    try {
      const res = await fetch(`${API_URL}/api/customers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCustomer),
      });

      if (res.ok) {
        alert(`Store Location Added Successfully!\nStore Name: ${newCustomer.name}`);
        setNewCustomer({ name: '', address: '', lat: '7.0736', lng: '125.6110' });
        fetchCustomers();
      } else {
        const errData = await res.json();
        alert(`Failed to save: ${errData.error || 'Server error'}`);
      }
    } catch (err) {
      console.error('Failed to add store location:', err);
      alert('Cannot connect to Express backend server!');
    }
  };

  const handleDeleteCustomer = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete store "${name}"?`)) return;

    try {
      const res = await fetch(`${API_URL}/api/customers/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchCustomers();
        fetchVisits();
      } else {
        alert('Failed to delete store location.');
      }
    } catch (err) {
      console.error('Delete store error:', err);
    }
  };

  const downloadQRPdf = async (store) => {
    try {
      const qrDataUrl = await QRCode.toDataURL(store.qr, { width: 300, margin: 2 });
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

      doc.setLineWidth(1);
      doc.rect(10, 10, 190, 277);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(22);
      doc.text('OFFICIAL PROOF OF VISIT QR', 105, 30, { align: 'center' });

      doc.setFontSize(16);
      doc.setTextColor(40, 40, 40);
      doc.text(store.name, 105, 45, { align: 'center' });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      doc.setTextColor(100, 100, 100);
      doc.text(`Address: ${store.address}`, 105, 52, { align: 'center' });
      doc.text(`GPS Coordinates: ${store.lat}, ${store.lng}`, 105, 58, { align: 'center' });

      doc.addImage(qrDataUrl, 'PNG', 55, 75, 100, 100);

      doc.setFontSize(10);
      doc.setTextColor(120, 120, 120);
      doc.text('Please display this QR Code visibly inside the store premises.', 105, 190, { align: 'center' });
      doc.text('Field Agents can only scan this QR code once per day.', 105, 196, { align: 'center' });

      doc.setFont('courier', 'bold');
      doc.setFontSize(9);
      doc.text(`Token: ${store.qr}`, 105, 210, { align: 'center' });

      doc.save(`QR_${store.name.replace(/\s+/g, '_')}.pdf`);
    } catch (err) {
      console.error('PDF Generation Error:', err);
      alert('Failed to generate PDF file.');
    }
  };

  const handleAdminPasswordChange = async (e) => {
    e.preventDefault();
    setPasswordMessage('');
    setPasswordStatus(null);

    if (newPassword !== confirmPassword) {
      setPasswordStatus('error');
      setPasswordMessage('New passwords do not match.');
      return;
    }

    if (newPassword.length < 3) {
      setPasswordStatus('error');
      setPasswordMessage('Password must be at least 3 characters.');
      return;
    }

    const adminId = currentUser ? currentUser.id : 1;

    try {
      const response = await fetch(`${API_URL}/api/agents/${adminId}/change-password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword })
      });

      const data = await response.json();

      if (response.ok) {
        setPasswordStatus('success');
        setPasswordMessage('Admin password successfully updated!');
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

  // Filter logic for Visit Logs
  const filteredVisits = visitsList.filter((visit) => {
    const matchesSearch = 
      (visit.agent_name && visit.agent_name.toLowerCase().includes(visitSearchQuery.toLowerCase())) ||
      (visit.store_name && visit.store_name.toLowerCase().includes(visitSearchQuery.toLowerCase()));

    let matchesDate = true;
    if (visit.timestamp) {
      const visitDateOnly = visit.timestamp.split('T')[0]; // YYYY-MM-DD
      if (startDate && visitDateOnly < startDate) {
        matchesDate = false;
      }
      if (endDate && visitDateOnly > endDate) {
        matchesDate = false;
      }
    }

    return matchesSearch && matchesDate;
  });

  const previewFirstName = agentName.trim() ? agentName.trim().split(' ')[0].toLowerCase().replace(/[^a-z0-9]/g, '') : 'firstname';

  return (
    <div className="flex h-screen bg-slate-100 font-sans text-slate-800">
      <aside className="w-64 bg-slate-900 text-white p-5 flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-3 mb-8">
            <ShieldCheck className="text-blue-400 w-8 h-8" />
            <h1 className="text-xl font-bold tracking-wide">GeoVerify Admin</h1>
          </div>

          <nav className="space-y-2">
            {[
              { id: 'overview', label: 'Overview', icon: CheckCircle },
              { id: 'customers', label: 'Store Locations', icon: MapPin },
              { id: 'agents', label: 'Field Agents', icon: Users },
              { id: 'settings', label: 'Settings', icon: Settings },
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-3 w-full px-4 py-3 rounded-lg text-sm font-medium transition cursor-pointer ${
                    activeTab === tab.id ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="border-t border-slate-800 pt-4 text-xs text-slate-500">
          Proof of Visit System v1.0
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto p-8">
        <header className="flex justify-between items-center mb-8 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
          <div>
            <h2 className="text-2xl font-bold capitalize">{activeTab} Dashboard</h2>
            <p className="text-sm text-slate-500">Manage store locations, agents, and system activity.</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse"></span>
            <span className="text-sm font-semibold text-slate-600">System Online</span>
          </div>
        </header>

        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 border-l-4 border-l-blue-500">
                <p className="text-xs text-slate-500 font-semibold uppercase">Total Store Locations</p>
                <p className="text-3xl font-extrabold mt-2">{customers.length}</p>
              </div>
              <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 border-l-4 border-l-emerald-500">
                <p className="text-xs text-slate-500 font-semibold uppercase">Active Field Agents</p>
                <p className="text-3xl font-extrabold mt-2">{agentsList.length}</p>
              </div>
              <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 border-l-4 border-l-indigo-500">
                <p className="text-xs text-slate-500 font-semibold uppercase">Verified Visits</p>
                <p className="text-3xl font-extrabold mt-2">{visitsList.length}</p>
              </div>
            </div>

            {/* Recent Visit Logs Table & Filters */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-4">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <h3 className="font-bold text-lg flex items-center gap-2">
                  <Clock className="w-5 h-5 text-indigo-600" /> Recent Visit Logs
                </h3>

                {/* Filtering controls */}
                <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                  <div className="relative flex-1 md:w-56">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input 
                      type="text"
                      value={visitSearchQuery}
                      onChange={(e) => setVisitSearchQuery(e.target.value)}
                      placeholder="Search agent or store..."
                      className="w-full pl-9 pr-3 py-1.5 border rounded-lg text-xs focus:outline-blue-500 bg-slate-50"
                    />
                  </div>

                  <div className="flex items-center gap-1 text-xs">
                    <span className="text-slate-400 font-medium">From:</span>
                    <input 
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="p-1.5 border rounded-lg text-xs bg-slate-50 focus:outline-blue-500"
                    />
                  </div>

                  <div className="flex items-center gap-1 text-xs">
                    <span className="text-slate-400 font-medium">To:</span>
                    <input 
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="p-1.5 border rounded-lg text-xs bg-slate-50 focus:outline-blue-500"
                    />
                  </div>

                  {(visitSearchQuery || startDate || endDate) && (
                    <button 
                      onClick={() => { setVisitSearchQuery(''); setStartDate(''); setEndDate(''); }}
                      className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
                      title="Reset Filters"
                    >
                      <RefreshCw className="w-3.5 h-3.5" /> Reset
                    </button>
                  )}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-400 font-semibold bg-slate-50">
                      <th className="p-3">Store Name</th>
                      <th className="p-3">Field Agent</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Distance</th>
                      <th className="p-3">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredVisits.length > 0 ? (
                      filteredVisits.map((visit) => (
                        <tr key={visit.id} className="hover:bg-slate-50/80 transition">
                          <td className="p-3 font-bold text-slate-800">{visit.store_name || 'Unknown Store'}</td>
                          <td className="p-3 text-slate-600 font-medium">{visit.agent_name || 'Unknown Agent'}</td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded font-bold uppercase text-[10px] ${
                              visit.status === 'verified' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                            }`}>
                              {visit.status}
                            </span>
                          </td>
                          <td className="p-3 font-mono text-slate-500">
                            {Math.round(visit.distance_meters) === 1 ? '1 meter' : `${Math.round(visit.distance_meters)} meters`}
                          </td>
                          <td className="p-3 text-slate-400">{new Date(visit.timestamp).toLocaleString()}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="5" className="text-center text-slate-400 py-8">
                          No matching visit logs found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'customers' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-4">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <Plus className="w-5 h-5 text-blue-600" /> Add Store Location
              </h3>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500 flex justify-between">
                  <span>Pin Location on Map</span>
                  <span className="text-blue-600 font-normal">Click map or type Lat/Lng</span>
                </label>
                <div className="h-44 w-full rounded-xl overflow-hidden border border-slate-300 shadow-inner z-0 relative">
                  <MapContainer center={mapCenter} zoom={13} style={{ height: '100%', width: '100%' }}>
                    <TileLayer
                      attribution='&copy; OpenStreetMap'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <LocationPickerMarker 
                      position={selectedPin} 
                      setPosition={setSelectedPin} 
                      onLocationSelect={handleMapClick} 
                    />
                  </MapContainer>
                </div>
              </div>

              <form onSubmit={handleAddCustomer} className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-slate-500">Business / Store Name</label>
                  <input 
                    type="text" 
                    value={newCustomer.name}
                    onChange={(e) => setNewCustomer({...newCustomer, name: e.target.value})}
                    placeholder="e.g. Marites Store" 
                    className="w-full mt-1 p-2 border rounded-lg text-sm focus:outline-blue-500" 
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-500">Address / City</label>
                  <input 
                    type="text" 
                    value={newCustomer.address}
                    onChange={(e) => setNewCustomer({...newCustomer, address: e.target.value})}
                    placeholder="e.g. Tagum City" 
                    className="w-full mt-1 p-2 border rounded-lg text-sm focus:outline-blue-500" 
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-semibold text-slate-500">Latitude</label>
                    <input 
                      type="number" 
                      step="any"
                      value={newCustomer.lat}
                      onChange={handleLatChange}
                      placeholder="e.g. 7.0736"
                      className="w-full mt-1 p-2 border bg-slate-50 rounded-lg text-sm font-mono focus:outline-blue-500" 
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500">Longitude</label>
                    <input 
                      type="number" 
                      step="any"
                      value={newCustomer.lng}
                      onChange={handleLngChange}
                      placeholder="e.g. 125.6110"
                      className="w-full mt-1 p-2 border bg-slate-50 rounded-lg text-sm font-mono focus:outline-blue-500" 
                      required
                    />
                  </div>
                </div>

                <button 
                  type="submit" 
                  className="w-full bg-blue-600 text-white font-semibold py-2.5 rounded-lg hover:bg-blue-700 transition cursor-pointer"
                >
                  Save Store Location
                </button>
              </form>
            </div>

            <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
              <h3 className="font-bold text-lg mb-4">Registered Store Locations ({customers.length})</h3>
              <div className="space-y-4">
                {customers.map((c) => (
                  <div key={c.id} className="flex justify-between items-center p-4 border rounded-xl hover:border-blue-400 transition">
                    <div>
                      <h4 className="font-bold">{c.name}</h4>
                      <p className="text-xs text-slate-500">{c.address}</p>
                      <p className="text-xs text-slate-400 font-mono mt-1">GPS: {c.lat}, {c.lng}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono bg-slate-100 px-2.5 py-1 rounded text-slate-700 font-semibold border border-slate-200">{c.qr}</span>
                      
                      <button 
                        onClick={() => downloadQRPdf(c)}
                        className="p-2 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition flex items-center gap-1 text-xs font-semibold cursor-pointer"
                        title="Download QR PDF"
                      >
                        <Download className="w-4 h-4" /> PDF
                      </button>

                      <button 
                        onClick={() => handleDeleteCustomer(c.id, c.name)}
                        className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                        title="Delete Store Location"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'agents' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-4">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-blue-600" /> Create Agent Account
              </h3>

              {agentSuccessMsg && (
                <div className="p-3 bg-emerald-100 text-emerald-700 text-xs rounded-lg font-semibold">
                  {agentSuccessMsg}
                </div>
              )}

              <form onSubmit={handleCreateAgent} className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-slate-500">Agent Full Name</label>
                  <div className="relative mt-1">
                    <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input 
                      type="text" 
                      value={agentName}
                      onChange={(e) => setAgentName(e.target.value)}
                      placeholder="e.g. Ricardo Dalisay" 
                      className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:outline-blue-500" 
                      required
                    />
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-lg text-xs space-y-1.5 border border-slate-200">
                  <p className="text-slate-500 font-semibold flex items-center gap-1">
                    <KeyRound className="w-3.5 h-3.5 text-blue-600" /> Auto-Generated System Credentials
                  </p>
                  <p className="text-slate-600 font-mono flex items-center gap-1">
                    <Mail className="w-3.5 h-3.5 text-slate-400" /> Email: <span className="text-blue-600 font-bold">{previewFirstName}@agent.com</span>
                  </p>
                  <p className="text-slate-600 font-mono">
                    Password: <span className="text-emerald-600 font-bold">123</span>
                  </p>
                </div>

                <button 
                  type="submit" 
                  className="w-full bg-blue-600 text-white font-semibold py-2.5 rounded-lg hover:bg-blue-700 transition cursor-pointer"
                >
                  Create Agent Account
                </button>
              </form>
            </div>

            <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
              <h3 className="font-bold text-lg mb-1">Active Field Agents ({agentsList.length})</h3>
              <p className="text-xs text-slate-500 mb-4">Click on an agent to assign specific stores to visit.</p>
              
              <div className="space-y-3">
                {agentsList.map((agent) => (
                  <div 
                    key={agent.id} 
                    onClick={() => handleOpenAssignModal(agent)}
                    className="p-4 border rounded-xl flex justify-between items-center hover:border-blue-500 hover:shadow-md transition cursor-pointer bg-white"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold">
                        {agent.name.charAt(0)}
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-slate-800">{agent.name}</h4>
                        <p className="text-xs text-slate-500 font-mono">{agent.email}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <button 
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleOpenAssignModal(agent); }}
                        className="text-xs bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg font-semibold border border-blue-200 flex items-center gap-1 hover:bg-blue-100 cursor-pointer"
                      >
                        <CheckSquare className="w-3.5 h-3.5" /> Assign Stores
                      </button>
                      <button 
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleDeleteAgent(agent.id, agent.name); }}
                        className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                        title="Delete Agent Account"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="max-w-xl mx-auto space-y-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <Settings className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-lg text-slate-800">Admin Account Settings</h3>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-lg">
                  {currentUser ? currentUser.name.charAt(0) : 'A'}
                </div>
                <div>
                  <h4 className="font-bold text-slate-900">{currentUser ? currentUser.name : 'System Admin'}</h4>
                  <p className="text-xs text-slate-500 font-mono">{currentUser ? currentUser.email : 'admin@geoverify.com'}</p>
                  <span className="inline-block mt-1 text-[10px] font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded">ADMINISTRATOR</span>
                </div>
              </div>

              <form onSubmit={handleAdminPasswordChange} className="space-y-4 pt-2">
                <h4 className="font-bold text-sm text-slate-700 flex items-center gap-1.5">
                  <KeyRound className="w-4 h-4 text-blue-600" /> Change Admin Password
                </h4>

                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">Current Password</label>
                  <input 
                    type="password"
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-white border border-slate-300 text-xs rounded-lg p-2.5 text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">New Password</label>
                  <input 
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-white border border-slate-300 text-xs rounded-lg p-2.5 text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">Confirm New Password</label>
                  <input 
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-white border border-slate-300 text-xs rounded-lg p-2.5 text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {passwordMessage && (
                  <p className={`text-xs p-3 rounded-lg border ${passwordStatus === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
                    {passwordMessage}
                  </p>
                )}

                <button 
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl text-xs transition cursor-pointer"
                >
                  Update Admin Password
                </button>
              </form>
            </div>
          </div>
        )}

        {isAssignModalOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl border border-slate-200 relative">
              <button 
                type="button"
                onClick={() => setIsAssignModalOpen(false)}
                className="absolute top-4 right-4 p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              <div>
                <h3 className="font-bold text-lg text-slate-800">
                  Assign Stores to <span className="text-blue-600">{selectedAgent?.name}</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Selected <span className="font-bold text-blue-600">{assignedStoreIds.length}</span> stores for this agent
                </p>
              </div>

              <div className="space-y-2">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input 
                    type="text"
                    value={storeSearchQuery}
                    onChange={(e) => setStoreSearchQuery(e.target.value)}
                    placeholder="Search available store name or address..."
                    className="w-full pl-9 pr-3 py-2 border rounded-xl text-xs focus:outline-blue-500 bg-slate-50"
                  />
                  {storeSearchQuery && (
                    <button 
                      type="button"
                      onClick={() => setStoreSearchQuery('')}
                      className="absolute right-3 top-2.5 text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {filteredStores.length > 0 && (
                  <div className="flex justify-between items-center px-1">
                    <span className="text-[11px] text-slate-400">
                      Showing {filteredStores.length} available stores
                    </span>
                    <button 
                      type="button"
                      onClick={handleSelectAllFiltered}
                      className="text-[11px] font-semibold text-blue-600 hover:underline cursor-pointer"
                    >
                      {filteredStores.every(s => assignedStoreIds.includes(s.id)) ? 'Deselect All Shown' : 'Select All Shown'}
                    </button>
                  </div>
                )}
              </div>

              <div className="max-h-64 overflow-y-auto space-y-2 border rounded-xl p-3 bg-slate-50">
                {filteredStores.length > 0 ? (
                  filteredStores.map((store) => {
                    const isChecked = assignedStoreIds.includes(store.id);
                    return (
                      <label 
                        key={store.id} 
                        className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition ${
                          isChecked 
                            ? 'bg-blue-50/70 border-blue-300' 
                            : 'bg-white border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <input 
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleStoreAssignment(store.id)}
                          className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 accent-blue-600 cursor-pointer"
                        />
                        <div className="flex-1">
                          <p className="text-xs font-bold text-slate-800">{store.name}</p>
                          <p className="text-[10px] text-slate-500">{store.address}</p>
                        </div>
                      </label>
                    );
                  })
                ) : (
                  <p className="text-xs text-center text-slate-400 py-6">
                    {storeSearchQuery ? `No available stores match "${storeSearchQuery}"` : 'No available unassigned stores left.'}
                  </p>
                )}
              </div>

              <div className="flex gap-2 pt-2">
                <button 
                  type="button"
                  onClick={() => setIsAssignModalOpen(false)}
                  className="w-1/2 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="button"
                  onClick={handleSaveAssignments}
                  disabled={isSavingAssignments}
                  className="w-1/2 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold transition disabled:opacity-50 cursor-pointer"
                >
                  {isSavingAssignments ? 'Saving...' : 'Save Assignment'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default AdminDashboard;