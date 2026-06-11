'use client';
import { useState, useEffect } from 'react';

export default function KeysPage() {
  const [keys, setKeys] = useState([]);
  const [selectedType, setSelectedType] = useState('30');

  const generateKey = async () => {
    const res = await fetch('/api/keys/generate', { method: 'POST', body: JSON.stringify({ type: selectedType }), headers: { 'Content-Type': 'application/json' } });
    const data = await res.json();
    setKeys([data.key, ...keys]);
  };

  const copyKey = (key) => {
    navigator.clipboard.writeText(key);
    alert('Copied!');
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">🔑 License Keys</h1>
        <div className="flex gap-4">
          <select value={selectedType} onChange={(e) => setSelectedType(e.target.value)} className="bg-secondary border border-[#2a2a3a] rounded-lg px-4 py-2">
            <option value="1">1 Day</option>
            <option value="7">7 Days</option>
            <option value="30">30 Days</option>
            <option value="90">90 Days</option>
            <option value="0">Lifetime</option>
          </select>
          <button onClick={generateKey} className="btn-primary">➕ Generate Key</button>
        </div>
      </div>

      {/* Keys Table */}
      <div className="card overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#2a2a3a]">
              <th className="text-left p-3">Key</th>
              <th className="text-left p-3">User</th>
              <th className="text-left p-3">HWID</th>
              <th className="text-left p-3">Expires</th>
              <th className="text-left p-3">Status</th>
              <th className="text-left p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {keys.map((key) => (
              <tr key={key.key} className="border-b border-[#1a1a2a]">
                <td className="p-3 font-mono text-sm">{key.key}</td>
                <td className="p-3">{key.discordName || '-'}</td>
                <td className="p-3">{key.hwid ? '🔒 Locked' : '⚠️ Not set'}</td>
                <td className="p-3">{key.expiresAt ? new Date(key.expiresAt).toDateString() : 'Lifetime'}</td>
                <td className="p-3">
                  <span className={`px-2 py-1 rounded-full text-xs ${key.blacklisted ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>
                    {key.blacklisted ? 'Blacklisted' : 'Active'}
                  </span>
                </td>
                <td className="p-3">
                  <button onClick={() => copyKey(key.key)} className="text-primary hover:text-primary/80 mr-2">📋 Copy</button>
                  <button className="text-red-400 hover:text-red-300">🗑️</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
